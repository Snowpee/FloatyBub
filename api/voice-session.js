const {
  authenticateSupabase,
  compatibleProviders,
  replaceVariables,
  sealRuntime,
  supabaseFetch,
} = require('./_lib/voice-runtime');

const first = (rows) => Array.isArray(rows) ? rows[0] : null;
const query = (table, select, filters = '') => `/rest/v1/${table}?select=${encodeURIComponent(select)}${filters}`;

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Max-Age', '86400');

  if (req.method === 'OPTIONS') return res.status(204).end();

  if (req.method === 'GET') {
    const missing = ['FISH_AUDIO_API_KEY', 'FISH_AGENT_ID', 'FLOATY_LLM_GATEWAY_SECRET', 'FLOATY_VOICE_RUNTIME_SECRET']
      .filter(name => !process.env[name]);
    return res.status(200).json({ configured: missing.length === 0, missing, provider: 'fish-agents-custom-llm' });
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });

  const accessToken = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  const user = accessToken ? await authenticateSupabase(accessToken).catch(() => null) : null;
  if (!user?.id) return res.status(401).json({ error: 'unauthorized' });

  const { roleId, conversationId, modelConfigId, userProfileId, voiceId, clientTimezone } = req.body || {};
  if (!roleId || !modelConfigId) return res.status(400).json({ error: 'invalid_request' });

  try {
    const [roles, models, profiles, prompts, conversations] = await Promise.all([
      supabaseFetch(query('ai_roles', 'id,user_id,name,prompt,settings,global_prompt_ids', `&id=eq.${encodeURIComponent(roleId)}`), accessToken),
      supabaseFetch(query('llm_configs', 'id,user_id,name,provider,model,config', `&id=eq.${encodeURIComponent(modelConfigId)}`), accessToken),
      userProfileId ? supabaseFetch(query('user_roles', 'id,user_id,name,description', `&id=eq.${encodeURIComponent(userProfileId)}`), accessToken) : [],
      supabaseFetch(query('global_prompts', 'id,user_id,content'), accessToken),
      conversationId ? supabaseFetch(query('chat_sessions', 'id,user_id,metadata', `&id=eq.${encodeURIComponent(conversationId)}`), accessToken) : [],
    ]);

    const role = first(roles);
    const model = first(models);
    const profile = first(profiles);
    if (!role || !model || (conversationId && !first(conversations))) return res.status(404).json({ error: 'configuration_not_found' });
    if (!compatibleProviders.has(model.provider)) return res.status(422).json({ error: 'provider_not_supported' });

    const userName = profile?.name || '用户';
    const roleName = role.name || 'AI助手';
    const promptIds = role.global_prompt_ids || role.settings?.globalPromptIds || [];
    const systemParts = [];
    if (profile) systemParts.push(`[用户信息：用户名：${profile.name}${profile.description ? `，用户简介：${profile.description}` : ''}]`);
    for (const item of prompts) {
      if (promptIds.includes(item.id) && item.content) systemParts.push(`[全局设置：${replaceVariables(item.content, userName, roleName)}]`);
    }
    if (role.prompt) systemParts.push(`[角色设置：${replaceVariables(role.prompt, userName, roleName)}]`);
    systemParts.push('[通话模式：仅进行基础对话，不使用或调用任何 Skill、工具或知识库。]');

    const opening = role.settings?.openingMessages?.[role.settings?.currentOpeningIndex || 0]
      || role.settings?.openingMessages?.[0]
      || `你好，我是${roleName}。`;
    const selectedVoice = voiceId || role.settings?.voiceModelId;
    const runtimeToken = sealRuntime({
      exp: Date.now() + 35 * 60 * 1000,
      accessToken,
      userId: user.id,
      roleId,
      conversationId: conversationId || null,
      modelConfigId,
    });

    const overrides = {
      system_prompt: systemParts.join('\n\n').slice(0, 100000),
      first_message: replaceVariables(opening, userName, roleName).slice(0, 10000),
      language: 'zh',
    };
    if (selectedVoice) overrides.voice_id = selectedVoice;

    const upstream = await fetch('https://api.fish.audio/v1/agent/sessions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.FISH_AUDIO_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agent_id: process.env.FISH_AGENT_ID,
        end_user_id: user.id,
        name: `${roleName} · Floaty`,
        overrides,
        llm_extra_body: { runtime_token: runtimeToken },
        client_timezone: clientTimezone,
        tool_events: false,
        record_audio: false,
      }),
      signal: AbortSignal.timeout(15000),
    });
    const body = await upstream.json().catch(() => ({}));
    if (!upstream.ok) return res.status(502).json({ error: 'session_unavailable', upstreamStatus: upstream.status });
    return res.status(200).json(body);
  } catch (error) {
    console.error('voice-session failed', { message: error.message });
    return res.status(500).json({ error: 'voice_session_failed' });
  }
};
