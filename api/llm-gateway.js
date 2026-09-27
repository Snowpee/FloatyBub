const {
  compatibleProviders,
  completionUrl,
  openRuntime,
  supabaseFetch,
} = require('./_lib/voice-runtime');

const query = (table, select, filters = '') => `/rest/v1/${table}?select=${encodeURIComponent(select)}${filters}`;

module.exports = async (req, res) => {
  if (req.method === 'GET') return res.status(200).json({ status: 'ok', protocol: 'openai-chat-completions-sse' });
  if (req.method !== 'POST') return res.status(405).json({ error: { message: 'Method not allowed', type: 'invalid_request_error' } });
  const expected = process.env.FLOATY_LLM_GATEWAY_SECRET;
  const provided = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!expected || provided !== expected) return res.status(401).json({ error: { message: 'Unauthorized', type: 'authentication_error' } });

  try {
    const token = req.body?.fishaudio_extra_body?.runtime_token;
    const runtime = openRuntime(token);
    if (runtime.userId !== req.body?.user_id) throw new Error('Runtime user mismatch');

    const [models, sessions, history] = await Promise.all([
      supabaseFetch(query('llm_configs', 'id,user_id,provider,model,config', `&id=eq.${encodeURIComponent(runtime.modelConfigId)}`), runtime.accessToken),
      runtime.conversationId ? supabaseFetch(query('chat_sessions', 'id,user_id', `&id=eq.${encodeURIComponent(runtime.conversationId)}`), runtime.accessToken) : [],
      runtime.conversationId ? supabaseFetch(query('messages', 'role,content,message_timestamp', `&session_id=eq.${encodeURIComponent(runtime.conversationId)}&order=message_timestamp.desc&limit=40`), runtime.accessToken) : [],
    ]);
    const config = models[0];
    if (!config || !compatibleProviders.has(config.provider) || (runtime.conversationId && !sessions[0])) throw new Error('Runtime configuration unavailable');

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
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 9000);
    req.on('aborted', () => controller.abort());
    const upstream = await fetch(completionUrl(config), {
      method: 'POST', headers, body: JSON.stringify(upstreamBody), signal: controller.signal,
    });
    if (!upstream.ok || !upstream.body) {
      clearTimeout(timeout);
      const details = await upstream.text().catch(() => '');
      console.error('llm upstream failed', { status: upstream.status, details: details.slice(0, 300) });
      return res.status(502).json({ error: { message: 'LLM upstream unavailable', type: 'upstream_error' } });
    }

    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();
    const reader = upstream.body.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(Buffer.from(value));
    }
    clearTimeout(timeout);
    return res.end();
  } catch (error) {
    console.error('llm-gateway failed', { message: error.message });
    if (!res.headersSent) return res.status(400).json({ error: { message: 'Invalid voice runtime', type: 'invalid_request_error' } });
    return res.end();
  }
};
