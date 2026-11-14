const {
  compatibleProviders,
  completionUrl,
  openRuntime,
  supabaseFetch,
} = require('./_lib/voice-runtime');

const { pipeVoiceCompletion, VoiceGatewayError } = require('./_lib/voice-stream');

const query = (table, select, filters = '') => `/rest/v1/${table}?select=${encodeURIComponent(select)}${filters}`;

module.exports = async (req, res) => {
  if (req.method === 'GET') return res.status(200).json({ status: 'ok', protocol: 'openai-chat-completions-sse' });
  if (req.method !== 'POST') return res.status(405).json({ error: { message: 'Method not allowed', type: 'invalid_request_error' } });
  const expected = process.env.FLOATY_LLM_GATEWAY_SECRET;
  const provided = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!expected || provided !== expected) return res.status(401).json({ error: { message: 'Unauthorized', type: 'authentication_error' } });

  const startedAt = Date.now();
  const controller = new AbortController();
  let firstContentTimeout;
  let streamTimeout;
  let abortCode;
  const abort = () => { abortCode = 'client_disconnected'; controller.abort(); };
  const onClose = () => { if (!res.writableEnded) abort(); };
  req.on('aborted', abort);
  res.on('close', onClose);

  try {
    const token = req.body?.fishaudio_extra_body?.runtime_token;
    if (typeof token !== 'string' || !token) {
      throw new VoiceGatewayError('voice_runtime_missing', 'Start the call from Floaty Bub. Fish console tests do not include the required session runtime token.', 400);
    }
    let runtime;
    try { runtime = openRuntime(token); }
    catch { throw new VoiceGatewayError('voice_runtime_invalid', 'Voice session expired or has an invalid runtime token. Start a new call from Floaty Bub.', 401); }
    if (runtime.userId !== req.body?.user_id) throw new VoiceGatewayError('voice_runtime_user_mismatch', 'Voice session user does not match the request', 403);
    // Bound time to actual spoken output, not merely HTTP headers/keepalives.
    firstContentTimeout = setTimeout(() => { abortCode = 'llm_first_content_timeout'; controller.abort(); }, 8500);

    const [models, sessions, history] = await Promise.all([
      supabaseFetch(query('llm_configs', 'id,user_id,provider,model,config', `&id=eq.${encodeURIComponent(runtime.modelConfigId)}`), runtime.accessToken),
      runtime.conversationId ? supabaseFetch(query('chat_sessions', 'id,user_id', `&id=eq.${encodeURIComponent(runtime.conversationId)}`), runtime.accessToken) : [],
      runtime.conversationId ? supabaseFetch(query('messages', 'role,content,message_timestamp', `&session_id=eq.${encodeURIComponent(runtime.conversationId)}&order=message_timestamp.desc&limit=40`), runtime.accessToken) : [],
    ]);
    const config = models[0];
    if (!config || !compatibleProviders.has(config.provider) || (runtime.conversationId && !sessions[0])) throw new VoiceGatewayError('voice_configuration_unavailable', 'Voice model or conversation is no longer available', 404);

    const incoming = Array.isArray(req.body.messages) ? req.body.messages.filter(item => ['system', 'user', 'assistant'].includes(item?.role)) : [];
    const firstConversationIndex = incoming.findIndex(item => item.role !== 'system');
    const insertAt = firstConversationIndex < 0 ? incoming.length : firstConversationIndex;
    const priorMessages = [...history].reverse()
      .filter(item => ['user', 'assistant'].includes(item.role) && typeof item.content === 'string')
      .map(item => ({ role: item.role, content: item.content }));
    const messages = [...incoming.slice(0, insertAt), ...priorMessages, ...incoming.slice(insertAt)].slice(-80);

    const upstreamBody = {
      model: config.model,
      messages,
      stream: true,
      temperature: Number(config.config?.temperature ?? 0.7),
      max_tokens: Math.min(Number(config.config?.maxTokens ?? 2048), 4096),
    };
    const headers = { Authorization: `Bearer ${config.config?.apiKey || ''}`, 'Content-Type': 'application/json' };
    if (config.provider === 'openrouter') {
      headers['HTTP-Referer'] = process.env.PUBLIC_APP_URL || 'https://floaty.example';
      headers['X-Title'] = 'Floaty Voice';
    }
    // Grok 4.7 defaults to high, mandatory reasoning. Its voice path needs the
    // documented low effort; exclude hides reasoning, it does not disable it.
    if (config.provider === 'openrouter' && /^x-ai\/grok-4\.7(?:$|-)/.test(config.model)) {
      upstreamBody.reasoning = { effort: 'low', exclude: true };
    }
    if (config.provider === 'deepseek') {
      const mode = config.config?.deepseekThinkingMode;
      if (mode === 'enabled' || mode === 'disabled') upstreamBody.thinking = { type: mode };
      if (mode !== 'disabled' && config.config?.deepseekReasoningEffort) upstreamBody.reasoning_effort = config.config.deepseekReasoningEffort;
    }
    const upstream = await fetch(completionUrl(config), {
      method: 'POST', headers, body: JSON.stringify(upstreamBody), signal: controller.signal,
    });
    if (!upstream.ok || !upstream.body) {
      const details = await upstream.text().catch(() => '');
      console.error('llm upstream failed', { status: upstream.status, responseLength: details.length });
      throw new VoiceGatewayError('llm_upstream_http_error', `LLM upstream returned HTTP ${upstream.status}`);
    }

    return await pipeVoiceCompletion(upstream, res, {
      signal: controller.signal,
      onContent: () => {
        clearTimeout(firstContentTimeout);
        // Do not abort a healthy, already-speaking stream after 9 seconds.
        streamTimeout = setTimeout(() => { abortCode = 'llm_stream_timeout'; controller.abort(); }, 35000);
      },
    });
  } catch (error) {
    if (abortCode === 'client_disconnected') return;
    const code = abortCode || error.code || 'llm_gateway_failed';
    const status = abortCode ? 504 : error.status || 502;
    const message = abortCode ? 'Voice model response timed out. Use a faster model or lower reasoning effort.'
      : error instanceof VoiceGatewayError ? error.message : 'Voice model or database connection failed';
    console.error('llm-gateway failed', { code, elapsedMs: Date.now() - startedAt });
    const body = { error: { message, type: status < 500 ? 'invalid_request_error' : 'upstream_error', code } };
    if (!res.headersSent) return res.status(status).json(body);
    if (!res.destroyed && !res.writableEnded) {
      res.write(`data: ${JSON.stringify(body)}\n\n`);
      return res.end();
    }
  } finally {
    clearTimeout(firstContentTimeout);
    clearTimeout(streamTimeout);
    controller.abort();
    req.off('aborted', abort);
    res.off('close', onClose);
  }
};
