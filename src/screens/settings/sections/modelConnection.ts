import type { LLMConfig } from '@/store';
import { getDefaultBaseUrl } from '@/utils/providerUtils';
import { applyDeepSeekThinkingOptions } from '@/utils/deepseekUtils';

export const supportsModelDiscovery = (provider: LLMConfig['provider']) => ['openai', 'kimi', 'deepseek', 'openrouter', 'custom'].includes(provider);
function apiRoot(config: Omit<LLMConfig, 'id'>) {
  const raw = (config.proxyUrl || config.baseUrl || getDefaultBaseUrl(config.provider)).trim().replace(/\/+$/, '');
  const url = new URL(raw);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) throw new Error('服务地址格式不正确');
  return raw;
}
function endpoint(root: string, path: string, version = 'v1') {
  return `${root.replace(new RegExp(`/${version}$`), '')}/${version}/${path}`;
}
export function modelRequest(config: Omit<LLMConfig, 'id'>, discover = false) {
  const root = apiRoot(config);
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  let url: string;
  let body: Record<string, unknown> | undefined;
  if (discover) {
    if (!supportsModelDiscovery(config.provider)) throw new Error('请手动输入此提供商的模型 ID');
    headers.Authorization = `Bearer ${config.apiKey}`;
    url = endpoint(root, 'models');
  } else if (config.provider === 'gemini') {
    headers['x-goog-api-key'] = config.apiKey;
    url = endpoint(root.replace(/\/v1$/, ''), `models/${encodeURIComponent(config.model.replace(/^models\//, ''))}:generateContent`, 'v1beta');
    body = { contents: [{ role: 'user', parts: [{ text: 'Hello' }] }], generationConfig: { maxOutputTokens: 64 } };
  } else if (config.provider === 'claude') {
    headers['x-api-key'] = config.apiKey;
    headers['anthropic-version'] = '2023-06-01';
    headers['anthropic-dangerous-direct-browser-access'] = 'true';
    url = endpoint(root, 'messages');
    body = { model: config.model, messages: [{ role: 'user', content: 'Hello' }], max_tokens: 64 };
  } else {
    headers.Authorization = `Bearer ${config.apiKey}`;
    url = endpoint(root, 'chat/completions');
    body = { model: config.model, messages: [{ role: 'user', content: 'Hello' }],
      ...(config.provider === 'openai' ? { max_completion_tokens: 64 } : { max_tokens: 64 }) };
    applyDeepSeekThinkingOptions(body, config);
  }
  return { url, init: { method: discover ? 'GET' : 'POST', headers, ...(body ? { body: JSON.stringify(body) } : {}) } };
}
export class ModelConnectionError extends Error {
  constructor(public status: number) { super(`HTTP ${status}`); }
}
export function modelConnectionError(error: unknown) {
  if (error instanceof ModelConnectionError) {
    if (error.status === 401) return '认证失败，请检查 API 密钥。';
    if (error.status === 403) return '访问被拒绝，请检查密钥和模型权限。';
    if (error.status === 429) return '请求受限，请检查调用频率或账户额度。';
    if (error.status === 404) return '接口或模型不存在，请检查服务地址和模型 ID。';
    return `服务返回 HTTP ${error.status}，请检查配置后重试。`;
  }
  if (error instanceof Error && ['AbortError', 'TimeoutError'].includes(error.name)) return '请求已取消或超时，请重试。';
  // Do not render raw server bodies, URLs or fetch error messages: they can echo credentials.
  return '无法完成请求，请检查网络、服务地址及跨域访问设置。';
}
export async function runModelRequest(config: Omit<LLMConfig, 'id'>, discover: boolean, signal: AbortSignal) {
  const request = modelRequest(config, discover);
  const response = await fetch(request.url, { ...request.init, signal });
  if (!response.ok) throw new ModelConnectionError(response.status);
  if (!discover) return [];
  const data: unknown = await response.json();
  const rows = data && typeof data === 'object' && 'data' in data && Array.isArray(data.data) ? data.data : [];
  return [...new Set(rows.flatMap((row: unknown) => row && typeof row === 'object' && 'id' in row && typeof row.id === 'string' && row.id.trim() ? [row.id] : []))].sort();
}
