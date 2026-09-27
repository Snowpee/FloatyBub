import type { SessionToken } from '@fishaudio/agent-react';
import { getApiBaseUrl } from '@/lib/utils';
import { supabase } from '@/lib/supabase';

export interface VoicePilotHealth {
  configured: boolean;
  missing: string[];
  provider: 'fish-agents' | 'fish-agents-custom-llm';
}

export interface VoiceSessionInput {
  roleId: string;
  modelConfigId: string;
  conversationId?: string;
  userProfileId?: string;
  voiceId?: string;
}

const baseUrl = (import.meta.env.VITE_VOICE_API_BASE_URL || getApiBaseUrl()).replace(/\/$/, '');

async function request<T>(init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${baseUrl}/api/voice-session`, init);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const messages: Record<string, string> = {
      unauthorized: '登录状态已失效，请重新登录。',
      invalid_request: '请选择 Agent 和受支持的 LLM 配置。',
      configuration_not_found: 'Agent、会话或 LLM 配置尚未同步到云端。',
      provider_not_supported: '当前验证版仅支持 OpenAI-compatible LLM。',
      session_unavailable: 'Fish Audio 无法创建通话，请检查 Custom LLM 和 Agent 发布状态。',
    };
    throw new Error(messages[body.error] || `通话请求失败（${response.status}）`);
  }
  return body as T;
}

export function getVoicePilotHealth() {
  return request<VoicePilotHealth>({ method: 'GET' });
}

export async function createVoiceSession(input: VoiceSessionInput): Promise<SessionToken> {
  const { data } = await supabase.auth.getSession();
  if (!data.session) throw new Error('请先登录，再开始通话。');
  return request<SessionToken>({
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session.access_token}` },
    body: JSON.stringify({
      ...input,
      clientTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    }),
  });
}
