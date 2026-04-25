import type { LLMConfig } from '@/store';

type DeepSeekConfig = Pick<LLMConfig, 'provider' | 'model' | 'deepseekThinkingMode' | 'deepseekReasoningEffort'>;
type ChatBody = Record<string, unknown>;
type ChatMessagePayload = Record<string, unknown>;

export const applyDeepSeekThinkingOptions = (body: ChatBody, config?: Partial<DeepSeekConfig>) => {
  if (config?.provider !== 'deepseek') return body;

  const thinkingMode = config.deepseekThinkingMode || 'default';
  if (thinkingMode === 'enabled' || thinkingMode === 'disabled') {
    body.thinking = { type: thinkingMode };
  }

  if (thinkingMode !== 'disabled' && config.deepseekReasoningEffort) {
    body.reasoning_effort = config.deepseekReasoningEffort;
  }

  return body;
};

export const isDeepSeekThinkingEnabled = (config?: Partial<DeepSeekConfig>) => {
  if (config?.provider !== 'deepseek' || config.deepseekThinkingMode === 'disabled') return false;
  if (config.deepseekThinkingMode === 'enabled') return true;
  const model = config.model || '';
  return model.includes('deepseek-reasoner') || model.includes('deepseek-v4');
};

export const stripHistoricalReasoningContent = (messages: ChatMessagePayload[]) => {
  return messages.map((message) => {
    if (!message || !('reasoning_content' in message)) return message;
    const rest = { ...message };
    delete rest.reasoning_content;
    return rest;
  });
};
