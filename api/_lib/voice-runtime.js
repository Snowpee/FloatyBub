const crypto = require('node:crypto');

const requiredEnv = (name) => {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}`);
  return value;
};

const getSupabaseConfig = () => ({
  url: (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(/\/$/, ''),
  anonKey: process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '',
});

async function supabaseFetch(path, accessToken) {
  const { url, anonKey } = getSupabaseConfig();
  if (!url || !anonKey) throw new Error('Missing Supabase server configuration');
  const response = await fetch(`${url}${path}`, {
    headers: { apikey: anonKey, Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(4000),
  });
  if (!response.ok) throw new Error(`Supabase request failed (${response.status})`);
  return response.json();
}

async function authenticateSupabase(accessToken) {
  const { url, anonKey } = getSupabaseConfig();
  if (!url || !anonKey) throw new Error('Missing Supabase server configuration');
  const response = await fetch(`${url}/auth/v1/user`, {
    headers: { apikey: anonKey, Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(4000),
  });
  if (!response.ok) return null;
  return response.json();
}

function runtimeKey() {
  return crypto.createHash('sha256').update(requiredEnv('FLOATY_VOICE_RUNTIME_SECRET')).digest();
}

function sealRuntime(payload) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', runtimeKey(), iv);
  const plaintext = Buffer.from(JSON.stringify(payload));
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString('base64url');
}

function openRuntime(token) {
  const packed = Buffer.from(token, 'base64url');
  if (packed.length < 29) throw new Error('Invalid runtime token');
  const decipher = crypto.createDecipheriv('aes-256-gcm', runtimeKey(), packed.subarray(0, 12));
  decipher.setAuthTag(packed.subarray(12, 28));
  const payload = JSON.parse(Buffer.concat([decipher.update(packed.subarray(28)), decipher.final()]).toString('utf8'));
  if (!payload.exp || payload.exp < Date.now()) throw new Error('Expired runtime token');
  return payload;
}

const replaceVariables = (text, userName, roleName) => String(text || '')
  .replace(/\{\{user\}\}/gi, userName || '用户')
  .replace(/\{\{char\}\}/gi, roleName || 'AI助手');

const compatibleProviders = new Set(['openai', 'kimi', 'deepseek', 'openrouter', 'custom']);

function defaultBaseUrl(provider) {
  return ({
    openai: 'https://api.openai.com',
    kimi: 'https://api.moonshot.cn',
    deepseek: 'https://api.deepseek.com',
    openrouter: 'https://openrouter.ai/api',
  })[provider] || 'https://api.openai.com';
}

function completionUrl(config) {
  const raw = String(config.config?.baseUrl || defaultBaseUrl(config.provider)).replace(/\/$/, '');
  const endpoint = raw.endsWith('/chat/completions') ? raw : raw.endsWith('/v1') ? `${raw}/chat/completions` : `${raw}/v1/chat/completions`;
  const url = new URL(endpoint);
  if (url.protocol !== 'https:') throw new Error('LLM endpoint must use HTTPS');
  if (/^(localhost|127\.|0\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.)/i.test(url.hostname)) {
    throw new Error('Private LLM endpoint is not allowed');
  }
  return url.toString();
}

module.exports = {
  authenticateSupabase,
  compatibleProviders,
  completionUrl,
  openRuntime,
  replaceVariables,
  sealRuntime,
  supabaseFetch,
};
