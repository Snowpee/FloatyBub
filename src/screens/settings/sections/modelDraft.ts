import type { LLMConfig } from '@/store';
import { getDefaultBaseUrl } from '@/utils/providerUtils';

export const modelProviders: { value: LLMConfig['provider']; label: string }[] = [
  { value: 'openai', label: 'OpenAI' }, { value: 'claude', label: 'Claude' },
  { value: 'gemini', label: 'Gemini' }, { value: 'kimi', label: 'Kimi' },
  { value: 'deepseek', label: 'DeepSeek' }, { value: 'openrouter', label: 'OpenRouter' },
  { value: 'custom', label: '自定义（OpenAI 兼容）' },
];
export type ModelDraft = Omit<LLMConfig, 'id' | 'temperature' | 'maxTokens'> & { temperature: string; maxTokens: string };
export function createModelDraft(config?: LLMConfig) {
  let value: ModelDraft = {
    name: config?.name ?? '', provider: config?.provider ?? 'openai', apiKey: config?.apiKey ?? '',
    model: config?.model ?? '', baseUrl: config?.baseUrl ?? '', proxyUrl: config?.proxyUrl ?? '',
    temperature: String(config?.temperature ?? 0.7), maxTokens: String(config?.maxTokens ?? 2048),
    enabled: config?.enabled ?? true, deepseekThinkingMode: config?.deepseekThinkingMode ?? 'default',
    deepseekReasoningEffort: config?.deepseekReasoningEffort ?? 'high',
  };
  const original = JSON.stringify(value);
  const listeners = new Set<() => void>();
  return {
    id: config?.id,
    getSnapshot: () => value,
    subscribe: (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; },
    isDirty: () => JSON.stringify(value) !== original,
    patch: (patch: Partial<ModelDraft>) => { value = { ...value, ...patch }; listeners.forEach(fn => fn()); },
  };
}
export type ModelDraftSession = ReturnType<typeof createModelDraft>;

function urlError(value: string) {
  if (!value.trim()) return undefined;
  try { const url = new URL(value.trim()); if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) return '请输入不含账号、查询参数或片段的 HTTP(S) 地址'; }
  catch { return '请输入完整的 HTTP(S) 地址'; }
}
export function validateModelDraft(draft: ModelDraft) {
  const errors: Partial<Record<keyof ModelDraft, string>> = {};
  if (!draft.name.trim()) errors.name = '请输入配置名称';
  if (!draft.apiKey.trim()) errors.apiKey = '请输入 API 密钥';
  if (!draft.model.trim()) errors.model = '请选择模型或手动输入模型 ID';
  if (!modelProviders.some(p => p.value === draft.provider)) errors.provider = '请选择提供商';
  errors.baseUrl = urlError(draft.baseUrl ?? '');
  errors.proxyUrl = urlError(draft.proxyUrl ?? '');
  if (draft.provider === 'custom' && !draft.baseUrl?.trim() && !draft.proxyUrl?.trim()) errors.baseUrl = '自定义提供商需要填写服务地址';
  if (draft.temperature.trim() === '' || !Number.isFinite(Number(draft.temperature)) || Number(draft.temperature) < 0 || Number(draft.temperature) > 2) errors.temperature = '请输入 0～2 的数值';
  if (draft.maxTokens.trim() === '' || !Number.isSafeInteger(Number(draft.maxTokens)) || Number(draft.maxTokens) < 1) errors.maxTokens = '请输入大于 0 的整数';
  return Object.fromEntries(Object.entries(errors).filter(([, message]) => !!message)) as Partial<Record<keyof ModelDraft, string>>;
}
export function modelDraftConfig(draft: ModelDraft): Omit<LLMConfig, 'id'> {
  return { ...draft, name: draft.name.trim(), apiKey: draft.apiKey.trim(), model: draft.model.trim(),
    baseUrl: draft.baseUrl?.trim() || undefined, proxyUrl: draft.proxyUrl?.trim() || undefined,
    temperature: Number(draft.temperature), maxTokens: Number(draft.maxTokens) };
}
export function changeModelProvider(session: ModelDraftSession, provider: LLMConfig['provider']) {
  const current = session.getSnapshot();
  if (current.provider === provider) return;
  // Keep deliberate custom endpoints, but replace defaults belonging to the old provider.
  const previousDefault = getDefaultBaseUrl(current.provider);
  session.patch({ provider, model: '', baseUrl: !current.baseUrl || current.baseUrl === previousDefault ? '' : current.baseUrl });
}
