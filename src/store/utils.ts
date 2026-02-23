import { VoiceSettings, SearchConfig, AutoTitleConfig, AssistantConfig, AIRole } from './types';
import { supabase } from '@/lib/supabase';
import { dataSyncService } from '@/services/DataSyncService';
import { ensureSnowflakeIdString } from '@/utils/snowflakeId';

const console: Console = { ...globalThis.console, log: (..._args: any[]) => {} };

// 🔧 自定义序列化器：保护 snowflake_id 字段的大整数精度
export const SNOWFLAKE_ID_PREFIX = '__SNOWFLAKE_ID__';

/**
 * 自定义序列化器：在序列化前保护 snowflake_id 字段
 * 将 snowflake_id 字符串添加特殊前缀，防止 JSON.stringify 将其转换为数字
 */
export function customSerializer(data: any): string {
  // 深度遍历对象，保护所有 snowflake_id 字段
  function protectSnowflakeIds(obj: any): any {
    if (obj === null || typeof obj !== 'object') {
      return obj;
    }
    
    if (Array.isArray(obj)) {
      return obj.map(protectSnowflakeIds);
    }
    
    const result: any = {};
    for (const [key, value] of Object.entries(obj)) {
      if (key === 'snowflake_id' && typeof value === 'string' && value) {
        // 为 snowflake_id 添加保护前缀
        result[key] = SNOWFLAKE_ID_PREFIX + value;
      } else {
        result[key] = protectSnowflakeIds(value);
      }
    }
    return result;
  }
  
  const protectedData = protectSnowflakeIds(data);
  return JSON.stringify(protectedData);
}

/**
 * 自定义反序列化器：恢复被保护的 snowflake_id 字段
 * 移除特殊前缀，恢复原始的 snowflake_id 字符串
 */
export function customDeserializer(str: string): any {
  const data = JSON.parse(str);
  
  // 深度遍历对象，恢复所有被保护的 snowflake_id 字段
  function restoreSnowflakeIds(obj: any): any {
    if (obj === null || typeof obj !== 'object') {
      return obj;
    }
    
    if (Array.isArray(obj)) {
      return obj.map(restoreSnowflakeIds);
    }
    
    const result: any = {};
    for (const [key, value] of Object.entries(obj)) {
      if (key === 'snowflake_id' && typeof value === 'string' && value.startsWith(SNOWFLAKE_ID_PREFIX)) {
        // 移除保护前缀，恢复原始 snowflake_id
        result[key] = value.substring(SNOWFLAKE_ID_PREFIX.length);
      } else {
        result[key] = restoreSnowflakeIds(value);
      }
    }
    return result;
  }
  
  return restoreSnowflakeIds(data);
}

// 默认头像路径（使用public目录下的静态资源）
export const avatar01 = '/avatars/avatar-01.png';
export const avatar02 = '/avatars/avatar-02.png';
export const avatar03 = '/avatars/avatar-03.png';

// 生成符合 UUID v4 标准的唯一ID
export const generateId = () => {
  // 生成符合 UUID v4 格式的字符串
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

// 验证 UUID 格式
export const isValidUUID = (id: string): boolean => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
};

// 将旧格式 ID 转换为 UUID 格式
export const convertToUUID = (oldId: string): string => {
  if (isValidUUID(oldId)) {
    return oldId;
  }
  // 为旧格式 ID 生成一个新的 UUID
  return generateId();
};

// 数据同步辅助函数
export const queueDataSync = async (type: 'llm_config' | 'ai_role' | 'global_prompt' | 'voice_settings' | 'general_settings' | 'user_profile' | 'user_role' | 'agent_skill', data: any) => {
  try {
    console.log('🔄 queueDataSync: 准备同步数据', { type, data })
    
    // 检查用户是否已登录
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.log('⚠️ queueDataSync: 用户未登录，跳过同步')
      return;
    }
    
    console.log('✅ queueDataSync: 用户已登录，开始同步', user.id)
    
    // 添加到同步队列
    await dataSyncService.queueSync(type, data);
    console.log('✅ queueDataSync: 数据已添加到同步队列')

  } catch (error) {
    console.error('❌ queueDataSync: 同步失败', error)
  }
};

// 默认语音设置
export const defaultVoiceSettings: VoiceSettings = {
  provider: 'fish-audio',
  apiUrl: 'https://api.fish.audio',
  apiKey: '',
  readingMode: 'all',
  customModels: [
    { id: '59cb5986671546eaa6ca8ae6f29f6d22', name: '央视配音', description: '专业新闻播报风格', isPreset: true },
    { id: 'faccba1a8ac54016bcfc02761285e67f', name: '电台女声', description: '温柔电台主播风格', isPreset: true }
  ],
  defaultVoiceModelId: '59cb5986671546eaa6ca8ae6f29f6d22'
};

// 默认联网搜索设置
export const defaultSearchConfig: SearchConfig = {
  enabled: false,
  provider: 'google-cse',
  apiKey: '',
  engineId: '',
  language: 'zh-CN',
  country: 'CN',
  safeSearch: 'off',
  maxResults: 5
};

// 默认自动标题设置
export const defaultAutoTitleConfig: AutoTitleConfig = {
  enabled: true,
  strategy: 'follow',
  modelId: null
};

// 默认助手设置（与自动标题一致，后续可扩展）
export const defaultAssistantConfig: AssistantConfig = {
  enabled: true,
  strategy: 'follow',
  modelId: null
};

// 默认AI角色 - 使用固定的UUID以确保跨用户一致性
// 使用固定的日期以避免序列化问题
export const defaultRoleCreatedAt = new Date('2024-01-01T00:00:00.000Z');
export const defaultRoleUpdatedAt = new Date('2024-01-01T00:00:00.000Z');

export const defaultRoles: AIRole[] = [
  {
    id: '00000000-0000-4000-8000-000000000001', // 固定UUID for AI助手
    name: 'AI助手',
    description: '通用AI助手，可以帮助您解答问题和完成各种任务',
    systemPrompt: '你是一个有用的AI助手，请用友好、专业的语气回答用户的问题。',
    openingMessages: ['你好！我是你的AI助手，很高兴为你服务。有什么我可以帮助你的吗？'],
    currentOpeningIndex: 0,
    avatar: avatar01,
    isFavorite: false,
    createdAt: defaultRoleCreatedAt,
    updatedAt: defaultRoleUpdatedAt
  },
  {
    id: '00000000-0000-4000-8000-000000000002', // 固定UUID for 编程专家
    name: '编程专家',
    description: '专业的编程助手，擅长代码编写、调试和技术问题解答',
    systemPrompt: '你是一个专业的编程专家，擅长多种编程语言和技术栈。请提供准确、实用的编程建议和代码示例。',
    openingMessages: ['你好！我是编程专家，专注于帮助你解决各种编程问题。无论是代码调试、架构设计还是技术选型，我都很乐意为你提供专业建议。'],
    currentOpeningIndex: 0,
    avatar: avatar02,
    isFavorite: false,
    createdAt: defaultRoleCreatedAt,
    updatedAt: defaultRoleUpdatedAt
  },
  {
    id: '00000000-0000-4000-8000-000000000003', // 固定UUID for 创意写手
    name: '创意写手',
    description: '富有创意的写作助手，擅长文案创作和内容策划',
    systemPrompt: '你是一个富有创意的写作专家，擅长各种文体的创作。请用生动、有趣的语言帮助用户完成写作任务。',
    openingMessages: ['嗨！我是你的创意写手伙伴，擅长各种文体创作。无论你需要写文案、故事、诗歌还是其他创意内容，我都能为你提供灵感和帮助！'],
    currentOpeningIndex: 0,
    avatar: avatar03,
    isFavorite: false,
    createdAt: defaultRoleCreatedAt,
    updatedAt: defaultRoleUpdatedAt
  }
];

// 恢复状态数据的日期对象和修复 snowflake_id
export const hydrateState = (state: any) => {
  if (!state) return state;

  // 辅助函数：安全地转换日期字符串为 Date 对象
  const safeDate = (dateStr: any) => {
    if (!dateStr) return new Date(); // 或者返回一个默认日期
    const date = new Date(dateStr);
    return isNaN(date.getTime()) ? new Date() : date; // 如果无效，返回当前时间或其他默认值
  };

  // 恢复Date对象
  if (state.aiRoles) {
    state.aiRoles = state.aiRoles.map((role: any) => ({
      ...role,
      createdAt: safeDate(role.createdAt),
      updatedAt: safeDate(role.updatedAt)
    }));
  }
  if (state.userRoles) {
    state.userRoles = state.userRoles.map((profile: any) => ({
      ...profile,
      createdAt: safeDate(profile.createdAt),
      updatedAt: safeDate(profile.updatedAt)
    }));
  }
  if (state.globalPrompts) {
    state.globalPrompts = state.globalPrompts.map((prompt: any) => ({
      ...prompt,
      createdAt: safeDate(prompt.createdAt),
      updatedAt: safeDate(prompt.updatedAt)
    }));
  }
  if (state.agentSkills) {
    state.agentSkills = state.agentSkills.map((skill: any) => ({
      ...skill,
      createdAt: safeDate(skill.createdAt),
      updatedAt: safeDate(skill.updatedAt)
    }));
  }
  if (state.chatSessions) {
    state.chatSessions = state.chatSessions.map((session: any) => ({
      ...session,
      createdAt: safeDate(session.createdAt),
      updatedAt: safeDate(session.updatedAt),
      messages: session.messages.map((msg: any) => ({
        ...msg,
        timestamp: safeDate(msg.timestamp),
        // 🔒 确保 snowflake_id 保持字符串类型，防止精度丢失
        snowflake_id: msg.snowflake_id ? ensureSnowflakeIdString(msg.snowflake_id) : msg.snowflake_id
      }))
    }));
  }
  return state;
};
