import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { convertAvatarForExport, convertAvatarFromImport } from '../utils/avatarUtils';
import { dataSyncService } from '../services/DataSyncService';
import { supabase } from '../lib/supabase';
import { generateSnowflakeId, ensureSnowflakeIdString } from '../utils/snowflakeId';

// 🔧 自定义序列化器：保护 snowflake_id 字段的大整数精度
const SNOWFLAKE_ID_PREFIX = '__SNOWFLAKE_ID__';

/**
 * 自定义序列化器：在序列化前保护 snowflake_id 字段
 * 将 snowflake_id 字符串添加特殊前缀，防止 JSON.stringify 将其转换为数字
 */
function customSerializer(data: any): string {
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
function customDeserializer(str: string): any {
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
const avatar01 = '/avatars/avatar-01.png';
const avatar02 = '/avatars/avatar-02.png';
const avatar03 = '/avatars/avatar-03.png';

// LLM模型配置接口
export interface LLMConfig {
  id: string;
  name: string;
  provider: 'openai' | 'claude' | 'gemini' | 'kimi' | 'deepseek' | 'openrouter' | 'custom';
  apiKey: string;
  baseUrl?: string;
  proxyUrl?: string;
  model: string;
  temperature: number;
  maxTokens: number;
  enabled: boolean;
}

// AI角色接口
export interface AIRole {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
  openingMessages?: string[]; // 开场白数组
  currentOpeningIndex?: number; // 当前显示的开场白索引
  avatar?: string;
  globalPromptId?: string; // 关联的全局提示词ID（向后兼容）
  globalPromptIds?: string[]; // 关联的多个全局提示词ID数组
  voiceModelId?: string; // 角色专属语音模型ID
  isFavorite?: boolean; // 收藏状态
  createdAt: Date;
  updatedAt: Date;
}

// 用户资料接口
export interface UserProfile {
  id: string;
  name: string;
  description: string;
  avatar: string;
  createdAt: Date;
  updatedAt: Date;
}

// 全局提示词接口
export interface GlobalPrompt {
  id: string;
  title: string;
  description?: string;
  prompt: string;
  createdAt: Date;
  updatedAt: Date;
}

// 聊天消息接口
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  message_timestamp?: string; // 业务时间戳，用于数据库存储和排序，一旦设置不可修改
  snowflake_id?: string; // Snowflake ID，用于分布式环境下的唯一标识和排序
  isStreaming?: boolean;
  pendingUpload?: boolean; // 本地尚未上传到云端的标记
  roleId?: string; // 对于assistant消息，存储AI角色ID；对于user消息，可以为空
  userProfileId?: string; // 对于user消息，存储用户资料ID；对于assistant消息，可以为空
  versions?: string[]; // 消息的多个版本内容
  currentVersionIndex?: number; // 当前显示的版本索引
  reasoningContent?: string; // DeepSeek等模型的思考过程内容
  isReasoningComplete?: boolean; // 思考过程是否完成
  images?: string[]; // 图片数据数组，存储base64格式的图片
}

// 聊天会话接口
export interface ChatSession {
  id: string;
  title: string;
  roleId: string;
  modelId: string;
  messages: ChatMessage[];
  createdAt: Date;
  updatedAt: Date;
  isHidden?: boolean; // 是否从侧边栏隐藏
  isPinned?: boolean; // 是否置顶
}

// 语音设置接口
export interface VoiceSettings {
  provider: 'fish-audio' | 'other';
  apiUrl: string;
  apiKey: string;
  readingMode: 'all' | 'dialogue-only';
  customModels: VoiceModel[];
  defaultVoiceModelId?: string;
  modelVersion?: string;
}

// 语音模型接口
export interface VoiceModel {
  id: string;
  name: string;
  description?: string;
  author?: string;
  tags?: string[];
  userNote?: string;
  isPreset?: boolean;
}

// 联网搜索配置接口
export interface SearchConfig {
  enabled: boolean;                 // 是否启用联网搜索（全局）
  provider: 'google-cse';           // 搜索供应商（首期仅支持 Google CSE）
  apiKey?: string;                  // 用户填写的密钥（可选）
  engineId?: string;                // Google CSE 的 cx（可选）
  language?: string;                // 语言偏好，例如 'zh-CN'
  country?: string;                 // 地域，例如 'CN'
  safeSearch?: 'off' | 'active';    // 安全搜索开关
  maxResults?: number;              // 返回条数（默认 5）
}

// 应用状态接口
interface AppState {
  // LLM配置
  llmConfigs: LLMConfig[];
  currentModelId: string | null;
  
  // AI角色
  aiRoles: AIRole[];
  
  // 用户资料
  userRoles: UserProfile[];
  currentUserProfile: UserProfile | null;
  
  // 用户认证
  currentUser: any | null;
  
  // 全局提示词
  globalPrompts: GlobalPrompt[];
  
  // 聊天会话
  chatSessions: ChatSession[];
  currentSessionId: string | null;
  tempSessionId: string | null; // 临时会话ID
  tempSession: ChatSession | null; // 临时会话数据存储
  sessionsNeedingTitle: Set<string>; // 需要生成标题的会话ID集合
  
  // UI状态
  theme: 'light' | 'dark' | 'cupcake' | 'floaty';
  sidebarOpen: boolean;
  
  // 语音设置
  voiceSettings: VoiceSettings | null;

  // 联网搜索设置
  searchConfig: SearchConfig;
  
  // Actions
  // LLM配置相关
  addLLMConfig: (config: Omit<LLMConfig, 'id'>) => void;
  updateLLMConfig: (id: string, config: Partial<LLMConfig>) => void;
  deleteLLMConfig: (id: string) => Promise<void>;
  setCurrentModel: (id: string) => void;
  
  // AI角色相关
  addAIRole: (role: Omit<AIRole, 'id' | 'createdAt' | 'updatedAt'>) => AIRole;
  updateAIRole: (id: string, role: Partial<AIRole>) => void;
  deleteAIRole: (id: string) => Promise<void>;
  toggleRoleFavorite: (id: string) => void;
  getFavoriteRoles: () => AIRole[];
  
  // 全局提示词相关
  addGlobalPrompt: (prompt: Omit<GlobalPrompt, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateGlobalPrompt: (id: string, prompt: Partial<GlobalPrompt>) => void;
  deleteGlobalPrompt: (id: string) => Promise<void>;
  
  // 聊天会话相关
  createChatSession: (roleId: string, modelId: string) => string;
  createTempSession: (roleId: string, modelId: string) => string;
  saveTempSession: () => void;
  deleteTempSession: () => void;
  generateSessionTitle: (sessionId: string, llmConfig: LLMConfig) => Promise<void>;
  updateChatSession: (id: string, session: Partial<ChatSession>) => void;
  deleteChatSession: (id: string) => Promise<void>;
  hideSession: (id: string) => void;
  showSession: (id: string) => void;
  pinSession: (id: string) => void;
  unpinSession: (id: string) => void;
  setCurrentSession: (id: string) => void;
  migrateIdsToUUID: () => boolean;
  addMessage: (sessionId: string, message: Omit<ChatMessage, 'id'> & { id?: string }, onTempSessionSaved?: (sessionId: string) => void) => void;
  updateMessage: (sessionId: string, messageId: string, content: string, isStreaming?: boolean) => void;
  updateMessageWithReasoning: (sessionId: string, messageId: string, content?: string, reasoningContent?: string, isStreaming?: boolean, isReasoningComplete?: boolean, images?: string[]) => void;
  regenerateMessage: (sessionId: string, messageId: string) => Promise<void>;
  addMessageVersion: (sessionId: string, messageId: string, newContent: string) => void;
  addMessageVersionWithOriginal: (sessionId: string, messageId: string, originalContent: string, newContent: string, newImages?: string[]) => void;
  switchMessageVersion: (sessionId: string, messageId: string, versionIndex: number) => void;
  deleteMessage: (sessionId: string, messageId: string) => Promise<void>;
  
  // 标题生成相关
  markSessionNeedsTitle: (sessionId: string) => void;
  removeSessionNeedsTitle: (sessionId: string) => void;
  checkSessionNeedsTitle: (sessionId: string) => boolean;
  
  // 用户资料相关
  addUserProfile: (profile: Omit<UserProfile, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateUserProfile: (id: string, profile: Partial<UserProfile>) => void;
  deleteUserProfile: (id: string) => Promise<void>;
  setCurrentUserProfile: (profile: UserProfile | null) => void;
  
  // 用户认证相关
  setCurrentUser: (user: any | null) => void;
  
  // UI相关
  setTheme: (theme: 'light' | 'dark' | 'cupcake' | 'floaty') => void;
  toggleSidebar: () => void;
  
  // 语音设置相关
  setVoiceSettings: (settings: VoiceSettings | null) => void;

  // 联网搜索设置相关
  setSearchConfig: (config: SearchConfig) => void;
  updateSearchConfig: (partial: Partial<SearchConfig>) => void;
  
  // 数据导入导出
  exportData: () => string;
  importData: (data: string) => boolean;
  clearAllData: () => void;
}

// 生成符合 UUID v4 标准的唯一ID
const generateId = () => {
  // 生成符合 UUID v4 格式的字符串
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

// 验证 UUID 格式
const isValidUUID = (id: string): boolean => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
};

// 将旧格式 ID 转换为 UUID 格式
const convertToUUID = (oldId: string): string => {
  if (isValidUUID(oldId)) {
    return oldId;
  }
  // 为旧格式 ID 生成一个新的 UUID
  return generateId();
};

// 数据同步辅助函数
const queueDataSync = async (type: 'llm_config' | 'ai_role' | 'global_prompt' | 'voice_settings' | 'user_profile' | 'user_role', data: any) => {
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

// 从localStorage加载语音设置
const loadVoiceSettingsFromStorage = (): VoiceSettings => {
  // 预设的语音模型
  const presetModels: VoiceModel[] = [
    { id: '59cb5986671546eaa6ca8ae6f29f6d22', name: '央视配音', description: '专业新闻播报风格', isPreset: true },
    { id: 'faccba1a8ac54016bcfc02761285e67f', name: '电台女声', description: '温柔电台主播风格', isPreset: true }
  ];
  
  // 默认语音设置
  const defaultSettings: VoiceSettings = {
    provider: 'fish-audio',
    apiUrl: 'https://api.fish.audio',
    apiKey: '',
    readingMode: 'all',
    customModels: presetModels,
    defaultVoiceModelId: presetModels[0]?.id
  };
  
  try {
    const savedSettings = localStorage.getItem('voiceSettingsPage');
    if (savedSettings) {
      const parsed = JSON.parse(savedSettings);
      const customModels = parsed.customModels || [];
      const allModels = [...presetModels, ...customModels.filter((m: VoiceModel) => !m.isPreset)];
      
      return {
        provider: parsed.provider || defaultSettings.provider,
        apiUrl: parsed.apiUrl || defaultSettings.apiUrl,
        apiKey: parsed.apiKey || defaultSettings.apiKey,
        readingMode: parsed.readingMode || defaultSettings.readingMode,
        customModels: allModels,
        defaultVoiceModelId: parsed.defaultVoiceModelId || defaultSettings.defaultVoiceModelId
      };
    }
  } catch (error) {
    console.error('加载语音设置失败:', error);
  }
  
  return defaultSettings;
};

// 默认联网搜索设置
const defaultSearchConfig: SearchConfig = {
  enabled: false,
  provider: 'google-cse',
  apiKey: '',
  engineId: '',
  language: 'zh-CN',
  country: 'CN',
  safeSearch: 'off',
  maxResults: 5
};

// 默认AI角色 - 使用固定的UUID以确保跨用户一致性
// 使用固定的日期以避免序列化问题
const defaultRoleCreatedAt = new Date('2024-01-01T00:00:00.000Z');
const defaultRoleUpdatedAt = new Date('2024-01-01T00:00:00.000Z');

const defaultRoles: AIRole[] = [
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

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      // 初始状态
      llmConfigs: [],
      currentModelId: null,
      aiRoles: defaultRoles,
      userRoles: [],
      currentUserProfile: null,
      currentUser: null,
      globalPrompts: [],
      chatSessions: [],
      currentSessionId: null,
      tempSessionId: null,
      tempSession: null,
      sessionsNeedingTitle: new Set(),
      theme: 'floaty',
      sidebarOpen: typeof window !== 'undefined' ? window.innerWidth >= 1024 : true,
      voiceSettings: loadVoiceSettingsFromStorage(),
      searchConfig: defaultSearchConfig,
      
      // LLM配置相关actions
      addLLMConfig: (config) => {
        const newConfig: LLMConfig = {
          ...config,
          id: generateId()
        };
        set((state) => ({
          llmConfigs: [...state.llmConfigs, newConfig]
        }));
        // 自动同步到云端
        queueDataSync('llm_config', newConfig);
      },
      
      updateLLMConfig: (id, config) => {
        let updatedConfig: LLMConfig | null = null;
        set((state) => {
          const newConfigs = state.llmConfigs.map(c => {
            if (c.id === id) {
              updatedConfig = { ...c, ...config };
              return updatedConfig;
            }
            return c;
          });
          return { llmConfigs: newConfigs };
        });
        // 自动同步到云端
        if (updatedConfig) {
          queueDataSync('llm_config', updatedConfig);
        }
      },
      
      deleteLLMConfig: async (id) => {
        // 先保存原始状态，以便在失败时回滚
        const originalState = get();
        const originalConfig = originalState.llmConfigs.find(c => c.id === id);
        const originalCurrentModelId = originalState.currentModelId;
        
        // 先从本地状态删除
        set((state) => ({
          llmConfigs: state.llmConfigs.filter(c => c.id !== id),
          currentModelId: state.currentModelId === id ? null : state.currentModelId
        }));
        
        // 同步删除到数据库
        try {
          const { error } = await supabase
            .from('llm_configs')
            .delete()
            .eq('id', id);
          
          if (error) {
            // 回滚本地状态
            if (originalConfig) {
              set((state) => ({
                llmConfigs: [...state.llmConfigs, originalConfig],
                currentModelId: originalCurrentModelId
              }));
            }
            console.error('删除LLM配置失败:', error);
            throw new Error(`删除LLM配置失败: ${error.message}`);
          }
        } catch (error) {
          // 如果是我们抛出的错误，直接重新抛出
          if (error instanceof Error && error.message.includes('删除LLM配置失败')) {
            throw error;
          }
          
          // 回滚本地状态
          if (originalConfig) {
            set((state) => ({
              llmConfigs: [...state.llmConfigs, originalConfig],
              currentModelId: originalCurrentModelId
            }));
          }
          console.error('删除LLM配置时发生错误:', error);
          throw new Error(`删除LLM配置时发生错误: ${error instanceof Error ? error.message : '未知错误'}`);
        }
      },
      
      setCurrentModel: (id) => {
        const state = get();
        set({ currentModelId: id });
        
        // 如果有当前会话，同时更新会话的模型ID
        if (state.currentSessionId) {
          // 如果当前会话是临时会话，更新tempSession
          if (state.tempSessionId === state.currentSessionId && state.tempSession) {
            set((state) => ({
              tempSession: { ...state.tempSession!, modelId: id }
            }));
          } else {
            // 否则更新chatSessions中的会话
            set((state) => ({
              chatSessions: state.chatSessions.map(s => 
                s.id === state.currentSessionId 
                  ? { ...s, modelId: id }
                  : s
              )
            }));
          }
        }
      },
      
      // AI角色相关actions
      addAIRole: (role) => {
        const newRole: AIRole = {
          ...role,
          id: generateId(),
          createdAt: new Date(),
          updatedAt: new Date()
        };
        set((state) => ({
          aiRoles: [...state.aiRoles, newRole]
        }));
        // 自动同步到云端
        queueDataSync('ai_role', newRole);
        return newRole;
      },
      
      updateAIRole: (id, role) => {
        let updatedRole: AIRole | null = null;
        set((state) => {
          const newRoles = state.aiRoles.map(r => {
            if (r.id === id) {
              updatedRole = { ...r, ...role, updatedAt: new Date() };
              return updatedRole;
            }
            return r;
          });
          return { aiRoles: newRoles };
        });
        // 自动同步到云端
        if (updatedRole) {
          queueDataSync('ai_role', updatedRole);
        }
      },
      
      deleteAIRole: async (id) => {
        // 先保存原始状态，以便在失败时回滚
        const originalState = get();
        const originalRole = originalState.aiRoles.find(r => r.id === id);
        
        // 先从本地状态删除
        set((state) => ({
          aiRoles: state.aiRoles.filter(r => r.id !== id)
        }));
        
        // 同步删除到数据库
        try {
          const { error } = await supabase
            .from('ai_roles')
            .delete()
            .eq('id', id);
          
          if (error) {
            // 回滚本地状态
            if (originalRole) {
              set((state) => ({
                aiRoles: [...state.aiRoles, originalRole]
              }));
            }
            console.error('删除AI角色失败:', error);
            throw new Error(`删除AI角色失败: ${error.message}`);
          }
        } catch (error) {
          // 如果是我们抛出的错误，直接重新抛出
          if (error instanceof Error && error.message.includes('删除AI角色失败')) {
            throw error;
          }
          
          // 回滚本地状态
          if (originalRole) {
            set((state) => ({
              aiRoles: [...state.aiRoles, originalRole]
            }));
          }
          console.error('删除AI角色时发生错误:', error);
          throw new Error(`删除AI角色时发生错误: ${error instanceof Error ? error.message : '未知错误'}`);
        }
      },

      // 角色收藏相关
      toggleRoleFavorite: (id) => {
        // 旧ID到新UUID的映射
        const roleIdMapping: { [key: string]: string } = {
          'default-assistant': '00000000-0000-4000-8000-000000000001',
          'code-expert': '00000000-0000-4000-8000-000000000002',
          'creative-writer': '00000000-0000-4000-8000-000000000003'
        };
        
        // 如果传入的是旧ID，转换为新UUID
        const actualId = roleIdMapping[id] || id;
        
        let updatedRole: AIRole | null = null;
        set((state) => {
          const newRoles = state.aiRoles.map(role => {
            if (role.id === actualId) {
              updatedRole = { ...role, isFavorite: !role.isFavorite, updatedAt: new Date() };
              console.log('⭐ toggleRoleFavorite: 角色收藏状态已更新', {
                originalId: id,
                actualId: actualId,
                roleName: updatedRole.name,
                newFavoriteStatus: updatedRole.isFavorite
              });
              return updatedRole;
            }
            return role;
          });
          return { aiRoles: newRoles };
        });
        // 自动同步到云端
        if (updatedRole) {
          // 获取当前用户ID并添加到同步数据中
          supabase.auth.getUser().then(({ data: { user } }) => {
            if (user) {
              console.log('🔄 toggleRoleFavorite: 准备同步角色收藏状态到云端', {
                roleId: updatedRole!.id,
                roleName: updatedRole!.name,
                isFavorite: updatedRole!.isFavorite,
                userId: user.id
              });
              queueDataSync('ai_role', { ...updatedRole, user_id: user.id });
            } else {
              console.warn('⚠️ toggleRoleFavorite: 用户未登录，无法同步收藏状态');
            }
          });
        }
      },

      getFavoriteRoles: () => {
        const state = get();
        return state.aiRoles
          .filter(role => role.isFavorite === true)
          .sort((a, b) => {
            // 按 updatedAt 降序排序，最新收藏的在前
            const dateA = new Date(a.updatedAt).getTime();
            const dateB = new Date(b.updatedAt).getTime();
            return dateB - dateA;
          });
      },
      
      // 用户资料相关actions
      addUserProfile: (profile) => {
        const newProfile: UserProfile = {
          ...profile,
          id: generateId(),
          createdAt: new Date(),
          updatedAt: new Date()
        };
        set((state) => ({
          userRoles: [...state.userRoles, newProfile]
        }));
        // 自动同步到云端
        queueDataSync('user_role', newProfile);
      },
      
      updateUserProfile: (id, profile) => {
        console.log('🔄 Store: 开始更新用户资料', { id, profile })
        
        let updatedProfile: UserProfile | null = null;
        set((state) => {
          const newProfiles = state.userRoles.map(p => {
            if (p.id === id) {
              updatedProfile = { ...p, ...profile, updatedAt: new Date() };
              return updatedProfile;
            }
            return p;
          });
          console.log('✅ Store: 本地状态已更新', updatedProfile)
          return { userRoles: newProfiles };
        });
        
        // 自动同步到云端
        if (updatedProfile) {
          console.log('📤 Store: 准备同步到云端', updatedProfile)
          queueDataSync('user_role', updatedProfile);
        }
      },
      
      deleteUserProfile: async (id) => {
        // 先保存原始状态，以便在失败时回滚
        const originalState = get();
        const originalProfile = originalState.userRoles.find(p => p.id === id);
        const originalCurrentProfile = originalState.currentUserProfile;
        
        // 先从本地状态删除
        set((state) => ({
          userRoles: state.userRoles.filter(p => p.id !== id),
          currentUserProfile: state.currentUserProfile?.id === id ? null : state.currentUserProfile
        }));
        
        // 同步删除到数据库
        try {
          const { error } = await supabase
            .from('user_roles')
            .delete()
            .eq('id', id);
          
          if (error) {
            // 回滚本地状态
            if (originalProfile) {
              set((state) => ({
                userRoles: [...state.userRoles, originalProfile],
                currentUserProfile: originalCurrentProfile
              }));
            }
            console.error('删除用户配置失败:', error);
            throw new Error(`删除用户配置失败: ${error.message}`);
          }
        } catch (error) {
          // 如果是我们抛出的错误，直接重新抛出
          if (error instanceof Error && error.message.includes('删除用户配置失败')) {
            throw error;
          }
          
          // 回滚本地状态
          if (originalProfile) {
            set((state) => ({
              userRoles: [...state.userRoles, originalProfile],
              currentUserProfile: originalCurrentProfile
            }));
          }
          console.error('删除用户配置时发生错误:', error);
          throw new Error(`删除用户配置时发生错误: ${error instanceof Error ? error.message : '未知错误'}`);
        }
      },
      
      setCurrentUserProfile: (profile) => {
        set({ currentUserProfile: profile });
      },
      
      // 用户认证相关actions
      setCurrentUser: (user) => {
        set({ currentUser: user });
      },
      
      // 全局提示词相关actions
      addGlobalPrompt: (prompt) => {
        const newPrompt: GlobalPrompt = {
          ...prompt,
          id: generateId(),
          createdAt: new Date(),
          updatedAt: new Date()
        };
        set((state) => ({
          globalPrompts: [...state.globalPrompts, newPrompt]
        }));
        // 自动同步到云端
        queueDataSync('global_prompt', newPrompt);
      },
      
      updateGlobalPrompt: (id, prompt) => {
        let updatedPrompt: GlobalPrompt | null = null;
        set((state) => {
          const newPrompts = state.globalPrompts.map(p => {
            if (p.id === id) {
              updatedPrompt = { ...p, ...prompt, updatedAt: new Date() };
              return updatedPrompt;
            }
            return p;
          });
          return { globalPrompts: newPrompts };
        });
        // 自动同步到云端
        if (updatedPrompt) {
          queueDataSync('global_prompt', updatedPrompt);
        }
      },
      
      deleteGlobalPrompt: async (id) => {
        // 先保存原始状态，以便在失败时回滚
        const originalState = get();
        const originalPrompt = originalState.globalPrompts.find(p => p.id === id);
        const originalAiRoles = originalState.aiRoles;
        
        // 先从本地状态删除
        set((state) => ({
          globalPrompts: state.globalPrompts.filter(p => p.id !== id),
          // 清除使用了该全局提示词的角色关联
          aiRoles: state.aiRoles.map(role => 
            role.globalPromptId === id ? { ...role, globalPromptId: undefined } : role
          )
        }));
        
        // 同步删除到数据库
        try {
          const { error } = await supabase
            .from('global_prompts')
            .delete()
            .eq('id', id);
          
          if (error) {
            // 回滚本地状态
            if (originalPrompt) {
              set((state) => ({
                globalPrompts: [...state.globalPrompts, originalPrompt],
                aiRoles: originalAiRoles
              }));
            }
            console.error('删除全局提示词失败:', error);
            throw new Error(`删除全局提示词失败: ${error.message}`);
          }
        } catch (error) {
          // 如果是我们抛出的错误，直接重新抛出
          if (error instanceof Error && error.message.includes('删除全局提示词失败')) {
            throw error;
          }
          
          // 回滚本地状态
          if (originalPrompt) {
            set((state) => ({
              globalPrompts: [...state.globalPrompts, originalPrompt],
              aiRoles: originalAiRoles
            }));
          }
          console.error('删除全局提示词时发生错误:', error);
          throw new Error(`删除全局提示词时发生错误: ${error instanceof Error ? error.message : '未知错误'}`);
        }
      },
      
      // 聊天会话相关actions
      // 聊天会话相关actions
      createChatSession: (roleId, modelId) => {
        const state = get();
        const sessionId = generateId();
        const role = state.aiRoles.find(r => r.id === roleId);
        
        const newSession: ChatSession = {
          id: sessionId,
          title: `与${role?.name || 'AI'}的对话`,
          roleId,
          modelId,
          messages: [],
          createdAt: new Date(),
          updatedAt: new Date()
        };
        
        set((state) => ({
          chatSessions: [newSession, ...state.chatSessions],
          currentSessionId: sessionId,
          tempSessionId: null
        }));
        return sessionId;
      },
      
      createTempSession: (roleId, modelId) => {
        const state = get();
        const sessionId = generateId();
        const role = state.aiRoles.find(r => r.id === roleId);
        
        const newSession: ChatSession = {
          id: sessionId,
          title: `与${role?.name || 'AI'}的对话`,
          roleId,
          modelId,
          messages: [],
          createdAt: new Date(),
          updatedAt: new Date()
        };
        
        // 将临时会话存储在单独的字段中，不添加到chatSessions数组
        set((state) => ({
          currentSessionId: sessionId,
          tempSessionId: sessionId,
          tempSession: newSession
        }));
        return sessionId;
      },
      
      saveTempSession: () => {
        const state = get();
        if (state.tempSession) {
          // 将临时会话正式添加到chatSessions数组中，并设置为当前会话
          set((state) => ({
            chatSessions: [state.tempSession!, ...state.chatSessions],
            currentSessionId: state.tempSession!.id, // 设置为当前会话
            tempSessionId: null,
            tempSession: null
          }));
        } else {
          // 如果没有临时会话，只清空tempSessionId
          set({ tempSessionId: null });
        }
      },
      
      generateSessionTitle: async (sessionId, llmConfig) => {
        console.log('🎯 开始生成会话标题');
        console.log('📋 传入参数:', { sessionId, llmConfig: { ...llmConfig, apiKey: '***' } });
        
        const state = get();
        const session = state.chatSessions.find(s => s.id === sessionId);
        
        console.log('� 找到的会话:', session ? { id: session.id, title: session.title, messagesCount: session.messages.length } : '未找到');
        
        if (!session || session.messages.length === 0) {
          console.log('❌ 会话不存在或无消息，跳过标题生成');
          return;
        }
        
        // 获取前几条消息用于生成标题
        const messagesToAnalyze = session.messages
          .filter(m => m.role === 'user' || m.role === 'assistant')
          .slice(0, 4) // 取前4条消息
          .map(m => `${m.role === 'user' ? '用户' : 'AI'}：${m.content}`)
          .join('\n');
        
        console.log('📝 分析的消息内容:', messagesToAnalyze);
        
        if (!messagesToAnalyze.trim()) {
          console.log('❌ 没有可分析的消息内容，跳过标题生成');
          return;
        }
        
        try {
          // 构建生成标题的请求
          const titlePrompt = `请根据以下对话内容，生成一个简短的对话标题（不超过10个字）。只返回标题，不要其他内容：\n\n${messagesToAnalyze}`;
          
          console.log('💬 构建的提示词:', titlePrompt);
          
          let apiUrl = '';
          let headers: Record<string, string> = {
            'Content-Type': 'application/json'
          };
          let body: any = {};
          
          console.log('🔧 模型提供商:', llmConfig.provider);
          
          // 检查是否为thinking模型
          const isThinkingModel = llmConfig.model?.includes('reasoner') || llmConfig.model?.includes('thinking');
          console.log('🧠 是否为thinking模型:', isThinkingModel, '模型名称:', llmConfig.model);
          
          // 根据不同provider构建请求
          // 将provider分为两大类：Claude特殊格式 和 OpenAI兼容格式
          if (llmConfig.provider === 'claude') {
            // Claude使用特殊的API格式
            apiUrl = llmConfig.baseUrl || 'https://api.anthropic.com';
            if (!apiUrl.endsWith('/v1/messages')) {
              apiUrl = apiUrl.replace(/\/$/, '') + '/v1/messages';
            }
            headers['x-api-key'] = llmConfig.apiKey;
            headers['anthropic-version'] = '2023-06-01';
            body = {
              model: llmConfig.model,
              messages: [{ role: 'user', content: titlePrompt }],
              max_tokens: 20,
              temperature: 0.3
            };
          } else {
            // 其他所有provider都使用OpenAI兼容格式
            // 包括：openai, kimi, deepseek, custom, openrouter 等
            apiUrl = llmConfig.baseUrl || 'https://api.openai.com';
            if (!apiUrl.endsWith('/v1/chat/completions')) {
              apiUrl = apiUrl.replace(/\/$/, '') + '/v1/chat/completions';
            }
            headers['Authorization'] = `Bearer ${llmConfig.apiKey}`;
            body = {
              model: llmConfig.model,
              messages: [{ role: 'user', content: titlePrompt }],
              temperature: 0.3,
              max_tokens: 20,
              // 对于thinking模型，使用流式调用以获取完整内容
              stream: isThinkingModel
            };
          }
          
          // 如果配置了代理URL，使用代理
          if (llmConfig.proxyUrl) {
            console.log('🔄 使用代理URL:', llmConfig.proxyUrl);
            apiUrl = llmConfig.proxyUrl;
          }
          
          console.log('🌐 API请求信息:', {
            url: apiUrl,
            headers: { ...headers, Authorization: headers.Authorization ? '***' : undefined, 'x-api-key': headers['x-api-key'] ? '***' : undefined },
            body
          });
          
          const response = await fetch(apiUrl, {
            method: 'POST',
            headers,
            body: JSON.stringify(body)
          });
          
          console.log('📡 API响应状态:', response.status, response.statusText);
          
          if (!response.ok) {
            console.warn('❌ 生成标题失败:', response.status, response.statusText);
            return;
          }
          
          let result: any;
          
          // 处理流式响应（thinking模型）
          if (isThinkingModel && body.stream) {
            console.log('🌊 处理thinking模型的流式响应');
            const reader = response.body?.getReader();
            const decoder = new TextDecoder();
            let content = '';
            let reasoning_content = '';
            
            if (reader) {
              try {
                while (true) {
                  const { done, value } = await reader.read();
                  if (done) break;
                  
                  const chunk = decoder.decode(value);
                  const lines = chunk.split('\n');
                  
                  for (const line of lines) {
                    if (line.startsWith('data: ')) {
                      const data = line.slice(6).trim();
                      if (data === '[DONE]') continue;
                      
                      try {
                        const parsed = JSON.parse(data);
                        const delta = parsed.choices?.[0]?.delta;
                        
                        if (delta?.content) {
                          content += delta.content;
                        }
                        if (delta?.reasoning_content) {
                          reasoning_content += delta.reasoning_content;
                        }
                      } catch (e) {
                        // 忽略解析错误
                      }
                    }
                  }
                }
              } finally {
                reader.releaseLock();
              }
            }
            
            // 构造类似非流式响应的结果格式
            result = {
              choices: [{
                message: {
                  role: 'assistant',
                  content: content,
                  reasoning_content: reasoning_content
                }
              }]
            };
            
            console.log('🌊 流式响应解析完成:', {
              content: content,
              reasoning_content: reasoning_content.substring(0, 100) + '...'
            });
          } else {
            // 非流式响应
            result = await response.json();
            console.log('📦 API响应数据:', result);
          }
          
          // 添加详细的choices结构调试
          if (result.choices && result.choices[0]) {
            console.log('🔍 choices[0]完整结构:', JSON.stringify(result.choices[0], null, 2));
          }
          
          let generatedTitle = '';
          
          // 解析响应获取标题
          if (llmConfig.provider === 'claude') {
            generatedTitle = result.content?.[0]?.text || '';
          } else {
            // 标准OpenAI格式
            const choice = result.choices?.[0];
            if (choice) {
              // 对于thinking模型，优先使用content字段（实际回复内容）
              // reasoning_content包含思考过程，不适合作为标题
              generatedTitle = choice.message?.content || '';
              
              console.log('🔍 提取到的content内容:', generatedTitle);
              console.log('🧠 reasoning_content内容长度:', choice.message?.reasoning_content?.length || 0);
              
              // 如果是thinking模型且通过流式获取到了content，应该有内容
              if (isThinkingModel && !generatedTitle) {
                console.warn('⚠️ thinking模型的content字段仍为空，可能流式解析有问题');
                // 作为最后的备选，可以尝试从reasoning_content中提取简短的关键词
                // 但这不是理想的解决方案
                const reasoningContent = choice.message?.reasoning_content || '';
                if (reasoningContent) {
                  // 尝试提取关键词或短语作为标题
                  const keywordMatch = reasoningContent.match(/(?:关于|讨论|询问|请求|问题|话题)[：:]?\s*([^。，！？\n]{2,15})/);
                  if (keywordMatch) {
                    generatedTitle = keywordMatch[1].trim();
                    console.log('📝 从reasoning_content提取关键词作为标题:', generatedTitle);
                  }
                }
              }
              
              // 如果仍然没有标题，尝试其他字段（非thinking模型的兼容性处理）
              if (!generatedTitle && choice.message && !isThinkingModel) {
                const messageKeys = Object.keys(choice.message).filter(key => 
                  key !== 'reasoning_content' && key !== 'role'
                );
                console.log('🔍 message对象的其他字段:', messageKeys);
                
                for (const key of messageKeys) {
                  if (typeof choice.message[key] === 'string' && choice.message[key].trim()) {
                    generatedTitle = choice.message[key];
                    console.log(`📝 从字段 ${key} 提取到内容:`, generatedTitle);
                    break;
                  }
                }
              }
            }
          }
          
          console.log('🏷️ 原始生成的标题:', generatedTitle);
          
          // 清理和验证标题
          generatedTitle = generatedTitle.trim().replace(/["']/g, '');
          
          // 智能截取标题，确保长度在20字符以内
          if (generatedTitle.length > 20) {
            console.log('📏 标题过长，开始智能截取');
            
            // 去除常见的冗余描述
            generatedTitle = generatedTitle
              .replace(/^首先，?/, '')
              .replace(/^用户要求我?/, '')
              .replace(/根据对话内容生成一个简短的对话标题[。，]?/, '')
              .replace(/对话内容是[：:]?/, '')
              .replace(/\n+/g, ' ')
              .replace(/\s+/g, ' ')
              .trim();
            
            // 如果仍然过长，直接截取前20个字符
            if (generatedTitle.length > 20) {
              generatedTitle = generatedTitle.substring(0, 20);
            }
            
            // 如果截取后为空或太短，使用默认标题
            if (generatedTitle.length < 2) {
              generatedTitle = '新对话';
            }
          }
          
          console.log('✨ 清理后的标题:', generatedTitle);
          
          if (generatedTitle && generatedTitle.length <= 20) {
            console.log('✅ 标题验证通过，开始更新会话');
            // 更新会话标题
            set((state) => ({
              chatSessions: state.chatSessions.map(s => 
                s.id === sessionId 
                  ? { ...s, title: generatedTitle, updatedAt: new Date() }
                  : s
              )
            }));
            console.log('🎉 会话标题更新成功:', generatedTitle);
          } else {
            console.log('❌ 标题验证失败:', { title: generatedTitle, length: generatedTitle.length });
          }
        } catch (error) {
          console.error('💥 生成标题时出错:', error);
        }
      },
      
      deleteTempSession: () => {
        const { tempSessionId, currentSessionId } = get();
        if (tempSessionId) {
          set((state) => ({
            chatSessions: state.chatSessions.filter(s => s.id !== tempSessionId),
            // 只有当要删除的临时会话确实是当前会话时，才清空currentSessionId
            currentSessionId: currentSessionId === tempSessionId ? null : currentSessionId,
            tempSessionId: null,
            tempSession: null
          }));
        }
      },
      
      updateChatSession: (id, session) => {
        set((state) => ({
          chatSessions: state.chatSessions.map(s => 
            s.id === id ? { ...s, ...session, updatedAt: new Date() } : s
          )
        }));
      },
      
      deleteChatSession: async (id) => {
        // 先保存原始状态，以便在失败时回滚
        const originalState = get();
        const originalSession = originalState.chatSessions.find(s => s.id === id);
        const originalCurrentSessionId = originalState.currentSessionId;
        
        // 先从本地状态删除
        set((state) => ({
          chatSessions: state.chatSessions.filter(s => s.id !== id),
          currentSessionId: state.currentSessionId === id ? null : state.currentSessionId
        }));
        
        // 检查用户认证状态
        try {
          const { data: { user }, error: authError } = await supabase.auth.getUser();
          
          if (authError) {
            console.warn('⚠️ 获取用户认证状态失败:', authError.message);
          }
          
          // 如果用户未登录（访客模式），只执行本地删除，不同步数据库
          if (!user) {
            console.log('👤 访客模式：只执行本地删除，跳过数据库同步');
            return; // 直接返回，不执行数据库操作
          }
          
          // 用户已登录：执行软删除到数据库
          console.log('🔐 用户已登录：执行数据库软删除');

          const now = new Date().toISOString();

          // 软删除会话中的所有消息（将 deleted_at 设置为当前时间）
          const { error: messagesError } = await supabase
            .from('messages')
            .update({ deleted_at: now })
            .eq('session_id', id);

          if (messagesError) {
            throw new Error(`软删除会话消息失败: ${messagesError.message}`);
          }

          // 软删除会话本身
          const { error: sessionError } = await supabase
            .from('chat_sessions')
            .update({ deleted_at: now })
            .eq('id', id);

          if (sessionError) {
            throw new Error(`软删除会话失败: ${sessionError.message}`);
          }

          console.log('✅ 数据库同步软删除成功');
          
        } catch (error) {
          // 回滚本地状态
          if (originalSession) {
            set((state) => ({
              chatSessions: [...state.chatSessions, originalSession],
              currentSessionId: originalCurrentSessionId
            }));
          }
          console.error('删除会话时发生错误:', error);
          throw new Error(`删除会话时发生错误: ${error instanceof Error ? error.message : '未知错误'}`);
        }
      },
      
      hideSession: (id) => {
        set((state) => ({
          chatSessions: state.chatSessions.map(s => 
            s.id === id ? { ...s, isHidden: true, updatedAt: new Date() } : s
          )
        }));
      },
      
      showSession: (id) => {
        set((state) => ({
          chatSessions: state.chatSessions.map(s => 
            s.id === id ? { ...s, isHidden: false, updatedAt: new Date() } : s
          )
        }));
      },
      
      pinSession: (id) => {
        set((state) => ({
          chatSessions: state.chatSessions.map(s => 
            s.id === id ? { ...s, isPinned: true, updatedAt: new Date() } : s
          )
        }));
      },
      
      unpinSession: (id) => {
        set((state) => ({
          chatSessions: state.chatSessions.map(s => 
            s.id === id ? { ...s, isPinned: false, updatedAt: new Date() } : s
          )
        }));
      },
      
      setCurrentSession: (id) => {
        const state = get();
        const newSession = state.chatSessions.find(s => s.id === id);
        
        set({ 
          currentSessionId: id,
          // 只有当会话的modelId确实存在时才更新全局状态
          // 避免因为时序问题导致全局状态被undefined覆盖
          currentModelId: newSession?.modelId ? newSession.modelId : state.currentModelId
        });
      },
      
      // 迁移旧格式 ID 到 UUID 格式
      migrateIdsToUUID: () => {
        const state = get();
        let hasChanges = false;
        const idMapping = new Map<string, string>();
        
        const updatedSessions = state.chatSessions.map(session => {
          const originalSessionId = session.id;
          const newSessionId = convertToUUID(session.id);
          
          if (originalSessionId !== newSessionId) {
            idMapping.set(originalSessionId, newSessionId);
            hasChanges = true;
            console.log(`🔄 迁移会话 ID: ${originalSessionId} -> ${newSessionId}`);
          }
          
          const updatedMessages = session.messages.map(message => {
            const originalMessageId = message.id;
            const newMessageId = convertToUUID(message.id);
            
            if (originalMessageId !== newMessageId) {
              hasChanges = true;
              console.log(`🔄 迁移消息 ID: ${originalMessageId} -> ${newMessageId}`);
            }
            
            return originalMessageId !== newMessageId 
              ? { ...message, id: newMessageId }
              : message;
          });
          
          return {
            ...session,
            id: newSessionId,
            messages: updatedMessages
          };
        });
        
        if (hasChanges) {
          // 更新当前会话 ID
          let newCurrentSessionId = state.currentSessionId;
          if (state.currentSessionId && idMapping.has(state.currentSessionId)) {
            newCurrentSessionId = idMapping.get(state.currentSessionId)!;
            console.log(`🔄 更新当前会话 ID: ${state.currentSessionId} -> ${newCurrentSessionId}`);
          }
          
          set({
            chatSessions: updatedSessions,
            currentSessionId: newCurrentSessionId
          });
          
          console.log(`✅ ID 迁移完成，共更新 ${updatedSessions.length} 个会话`);
        }
        
        return hasChanges;
      },
      
      addMessage: (sessionId, message, onTempSessionSaved) => {
        const state = get();
        // 首先检查是否是临时会话
        const session = state.tempSession?.id === sessionId ? state.tempSession : state.chatSessions.find(s => s.id === sessionId);
        
      const newMessage: ChatMessage = {
        ...message,
        id: message.id || generateId(),
        timestamp: message.timestamp || new Date(),
        // 设置 message_timestamp，确保只在首次创建时生成
        message_timestamp: message.message_timestamp || (message.timestamp || new Date()).toISOString(),
        roleId: session?.roleId,
        userProfileId: message.role === 'user' ? state.currentUserProfile?.id : undefined,
        // 新增：默认标记为待上传，成功同步后清除
        pendingUpload: message.pendingUpload !== undefined ? message.pendingUpload : true,
        // 初始化版本管理字段
        versions: message.versions || (message.content ? [message.content] : []),
        currentVersionIndex: message.currentVersionIndex !== undefined ? message.currentVersionIndex : 0
      };
        
        // 调试日志：版本字段初始化
        console.log('🔧 消息版本字段初始化:', {
          messageId: newMessage.id,
          role: message.role,
          content: message.content,
          versions: newMessage.versions,
          currentVersionIndex: newMessage.currentVersionIndex
        });
        
        // 🔒 Snowflake ID 保护机制：只有在不存在时才生成新的，已存在的绝不覆盖
        if (message.snowflake_id) {
          newMessage.snowflake_id = message.snowflake_id;
          console.log('🔒 保护已存在的 Snowflake ID:', message.snowflake_id);
        } else {
          newMessage.snowflake_id = generateSnowflakeId();
          console.log('🆕 生成新的 Snowflake ID:', newMessage.snowflake_id);
        }
        
        // 打印消息创建信息
        console.log('📝 消息创建:', { id: newMessage.id, message_timestamp: newMessage.message_timestamp, snowflake_id: newMessage.snowflake_id });
        
        // 如果是临时会话的第一条用户消息，将其转为正式会话
        const { tempSessionId } = get();
        const isFirstUserMessage = tempSessionId === sessionId && message.role === 'user';
        if (isFirstUserMessage) {
          get().saveTempSession();
          // 调用回调函数，通知ChatPage生成标题
          if (onTempSessionSaved) {
            onTempSessionSaved(sessionId);
          }
        }
        
        // 更新会话状态：区分临时会话和正式会话
        set((state) => {
          if (state.tempSession?.id === sessionId) {
            // 如果是临时会话，更新tempSession
            return {
              tempSession: {
                ...state.tempSession,
                messages: [...state.tempSession.messages, newMessage],
                updatedAt: new Date()
              }
            };
          } else {
            // 如果是正式会话，更新chatSessions
            return {
              chatSessions: state.chatSessions.map(s => 
                s.id === sessionId 
                  ? { ...s, messages: [...s.messages, newMessage], updatedAt: new Date() }
                  : s
              )
            };
          }
        });
      },
      
      updateMessage: (sessionId, messageId, content, isStreaming) => {
        set((state) => {
          if (state.tempSession?.id === sessionId) {
            // 如果是临时会话，更新tempSession
            return {
              tempSession: {
                ...state.tempSession,
                messages: state.tempSession.messages.map(m => 
                  m.id === messageId ? { 
                    ...m, 
                    content,
                    // 当流式输出完成时，更新versions数组
                    versions: (() => {
                      if (isStreaming === false && content) {
                        const newVersions = m.versions && m.versions.length > 0 && m.versions[0] !== '' ? 
                          [...m.versions.slice(0, -1), content] : [content];
                        console.log('🔧 流式输出完成，更新versions:', {
                          messageId: m.id,
                          oldVersions: m.versions,
                          newVersions,
                          content
                        });
                        return newVersions;
                      }
                      return m.versions;
                    })(),
                    isStreaming: isStreaming !== undefined ? isStreaming : m.isStreaming 
                  } : m
                ),
                updatedAt: new Date()
              }
            };
          } else {
            // 如果是正式会话，更新chatSessions
            return {
              chatSessions: state.chatSessions.map(s => 
                s.id === sessionId 
                  ? {
                      ...s,
                      messages: s.messages.map(m => 
                        m.id === messageId ? { 
                          ...m, 
                          content,
                          // 当流式输出完成时，更新versions数组
                          versions: (() => {
                            if (isStreaming === false && content) {
                              const newVersions = m.versions && m.versions.length > 0 && m.versions[0] !== '' ? 
                                [...m.versions.slice(0, -1), content] : [content];
                              console.log('🔧 流式输出完成，更新versions:', {
                                messageId: m.id,
                                oldVersions: m.versions,
                                newVersions,
                                content
                              });
                              return newVersions;
                            }
                            return m.versions;
                          })(),
                          isStreaming: isStreaming !== undefined ? isStreaming : m.isStreaming 
                        } : m
                      ),
                      updatedAt: new Date()
                    }
                  : s
              )
            };
          }
        });
      },

      updateMessageWithReasoning: (sessionId, messageId, content, reasoningContent, isStreaming, isReasoningComplete, images) => {
        
        set((state) => {
          if (state.tempSession?.id === sessionId) {
            // 如果是临时会话，更新tempSession
            return {
              tempSession: {
                ...state.tempSession,
                messages: state.tempSession.messages.map(m => 
                  m.id === messageId ? { 
                    ...m, 
                    ...(content !== undefined && { content }),
                    ...(reasoningContent !== undefined && { reasoningContent }),
                    ...(isStreaming !== undefined && { isStreaming }),
                    ...(isReasoningComplete !== undefined && { isReasoningComplete }),
                    ...(images !== undefined && { images }),
                    // 当流式输出完成时，更新versions数组
                    ...(isStreaming === false && content !== undefined && (() => {
                      const newVersions = m.versions && m.versions.length > 0 && m.versions[0] !== '' ? 
                        [...m.versions.slice(0, -1), content] : [content];
                      console.log('🔧 推理模式流式输出完成，更新versions:', {
                        messageId: m.id,
                        oldVersions: m.versions,
                        newVersions,
                        content
                      });
                      return { versions: newVersions };
                    })())
                  } : m
                ),
                updatedAt: new Date()
              }
            };
          } else {
            // 如果是正式会话，更新chatSessions
            return {
              chatSessions: state.chatSessions.map(s => 
                s.id === sessionId 
                  ? {
                      ...s,
                      messages: s.messages.map(m => 
                        m.id === messageId ? { 
                          ...m, 
                          ...(content !== undefined && { content }),
                          ...(reasoningContent !== undefined && { reasoningContent }),
                          ...(isStreaming !== undefined && { isStreaming }),
                          ...(isReasoningComplete !== undefined && { isReasoningComplete }),
                          ...(images !== undefined && { images }),
                          // 当流式输出完成时，更新versions数组
                          ...(isStreaming === false && content !== undefined && (() => {
                            const newVersions = m.versions && m.versions.length > 0 && m.versions[0] !== '' ? 
                              [...m.versions.slice(0, -1), content] : [content];
                            console.log('🔧 推理模式流式输出完成，更新versions:', {
                              messageId: m.id,
                              oldVersions: m.versions,
                              newVersions,
                              content
                            });
                            return { versions: newVersions };
                          })())
                        } : m
                      ),
                      updatedAt: new Date()
                    }
                  : s
              )
            };
          }
        });
        
        // 输出简洁的状态变化日志
        if (isReasoningComplete) {
          console.log('✅ 思考过程完成');
        }
        if (!isStreaming) {
          console.log('🏁 内容输出完成');
        }
      },

      regenerateMessage: async (sessionId, messageId) => {
        // 这个函数将在ChatPage中调用，因为需要访问LLM API
        // 这里只是一个占位符，实际实现在ChatPage中
        throw new Error('regenerateMessage should be implemented in ChatPage');
      },

      addMessageVersion: (sessionId, messageId, newContent) => {
        set((state) => ({
          chatSessions: state.chatSessions.map(s => 
            s.id === sessionId 
              ? {
                  ...s,
                  messages: s.messages.map(m => 
                    m.id === messageId ? {
                      ...m,
                      versions: m.versions ? [...m.versions, newContent] : [m.content, newContent],
                      currentVersionIndex: m.versions ? m.versions.length : 1,
                      content: newContent
                    } : m
                  ),
                  updatedAt: new Date()
                }
              : s
          )
        }));
      },

      addMessageVersionWithOriginal: (sessionId, messageId, originalContent, newContent, newImages) => {
        console.log('🔄 开始添加消息版本:', {
          sessionId: sessionId.substring(0, 8) + '...',
          messageId: messageId.substring(0, 8) + '...',
          originalContent: originalContent.substring(0, 50) + '...',
          newContent: newContent.substring(0, 50) + '...',
          hasNewImages: newImages && newImages.length > 0,
          newImagesCount: newImages ? newImages.length : 0
        });
        

        
        set((state) => {
          const targetSession = state.chatSessions.find(s => s.id === sessionId);
          const targetMessage = targetSession?.messages.find(m => m.id === messageId);
          
          if (!targetMessage) {
            console.error('❌ 未找到目标消息');
            return state;
          }
          
          console.log('📋 当前消息状态:', {
            messageId: targetMessage.id.substring(0, 8) + '...',
            currentVersions: targetMessage.versions,
            currentVersionIndex: targetMessage.currentVersionIndex,
            currentContent: targetMessage.content.substring(0, 50) + '...'
          });
          
          // 确保versions数组存在且包含当前内容
          let newVersions: string[];
          let newVersionIndex: number;
          
          if (!targetMessage.versions || targetMessage.versions.length === 0) {
            // 如果没有versions或为空，创建包含原始内容和新内容的数组
            newVersions = [originalContent, newContent];
            newVersionIndex = 1; // 指向新内容
          } else {
            // 如果已有versions，追加新内容
            newVersions = [...targetMessage.versions, newContent];
            newVersionIndex = newVersions.length - 1; // 指向新添加的版本
          }
          
          console.log('✅ 新版本数据:', {
            newVersions: newVersions.map((v, i) => `[${i}]: ${v.substring(0, 30)}...`),
            newVersionIndex,
            newContent: newContent.substring(0, 50) + '...'
          });
          
          // 延迟验证数据库同步（等待同步完成）
          setTimeout(async () => {
            try {
              console.log('🔍 [重新生成验证] 开始验证消息数据库同步:', {
                messageId: messageId.substring(0, 8) + '...',
                expectedVersionsCount: newVersions.length,
                expectedVersionIndex: newVersionIndex
              });
              
              const { data: dbMessage, error } = await supabase
                .from('messages')
                .select('id, content, versions, current_version_index')
                .eq('id', messageId)
                .single();
              
              if (error) {
                console.error('❌ [重新生成验证] 查询数据库失败:', error);
                return;
              }
              
              if (!dbMessage) {
                console.error('❌ [重新生成验证] 数据库中未找到消息:', messageId);
                return;
              }
              
              console.log('📊 [重新生成验证] 数据库中的消息数据:', {
                messageId: dbMessage.id.substring(0, 8) + '...',
                content: dbMessage.content?.substring(0, 50) + '...',
                versions: dbMessage.versions ? `数组长度: ${dbMessage.versions.length}` : 'NULL',
                versionsPreview: dbMessage.versions?.map((v, i) => `[${i}]: ${v?.substring(0, 30)}...`) || 'NULL',
                currentVersionIndex: dbMessage.current_version_index
              });
              
              // 验证数据一致性
              const versionsMatch = JSON.stringify(dbMessage.versions) === JSON.stringify(newVersions);
              const indexMatch = dbMessage.current_version_index === newVersionIndex;
              const contentMatch = dbMessage.content === newContent;
              
              if (versionsMatch && indexMatch && contentMatch) {
                console.log('✅ [重新生成验证] 数据库同步验证成功 - 所有字段一致');
              } else {
                console.error('❌ [重新生成验证] 数据库同步验证失败:', {
                  versionsMatch,
                  indexMatch,
                  contentMatch,
                  expected: {
                    versions: newVersions.map((v, i) => `[${i}]: ${v.substring(0, 30)}...`),
                    currentVersionIndex: newVersionIndex,
                    content: newContent.substring(0, 50) + '...'
                  },
                  actual: {
                    versions: dbMessage.versions?.map((v, i) => `[${i}]: ${v?.substring(0, 30)}...`) || 'NULL',
                    currentVersionIndex: dbMessage.current_version_index,
                    content: dbMessage.content?.substring(0, 50) + '...'
                  }
                });
              }
            } catch (error) {
              console.error('❌ [重新生成验证] 验证过程出错:', error);
            }
          }, 3000); // 等待3秒让同步完成
          
          const updatedState = {
            chatSessions: state.chatSessions.map(s => 
              s.id === sessionId 
                ? {
                    ...s,
                    messages: s.messages.map(m => 
                      m.id === messageId ? {
                        ...m,
                        versions: newVersions,
                        currentVersionIndex: newVersionIndex,
                        content: newContent,
                        images: newImages || m.images, // 更新图片数据
                        isStreaming: false // 完成生成
                      } : m
                    ),
                    updatedAt: new Date()
                  }
                : s
            )
          };
          
          // 验证图片数据是否正确保存
          const updatedMessage = updatedState.chatSessions
            .find(s => s.id === sessionId)?.messages
            .find(m => m.id === messageId);
          

          
          return updatedState;
        });
      },

      switchMessageVersion: (sessionId, messageId, versionIndex) => {
        set((state) => ({
          chatSessions: state.chatSessions.map(s => 
            s.id === sessionId 
              ? {
                  ...s,
                  messages: s.messages.map(m => 
                    m.id === messageId && m.versions ? {
                      ...m,
                      currentVersionIndex: versionIndex,
                      content: m.versions[versionIndex] || m.content
                    } : m
                  ),
                  updatedAt: new Date()
                }
              : s
          )
        }));
        
        // 触发数据库同步 - 通过更新时间戳触发同步检测
        // 注意：queueDataSync不支持chat_sessions类型，所以通过updatedAt触发同步
      },

      deleteMessage: async (sessionId, messageId) => {
        // 先保存原始状态，以便在失败时回滚
        const originalState = get();
        const originalSession = originalState.chatSessions.find(s => s.id === sessionId);
        
        // 先从本地状态删除
        set((state) => ({
          chatSessions: state.chatSessions.map(s => 
            s.id === sessionId 
              ? {
                  ...s,
                  messages: s.messages.filter(m => m.id !== messageId),
                  updatedAt: new Date()
                }
              : s
          )
        }));
        
        // 检查用户认证状态
        try {
          const { data: { user }, error: authError } = await supabase.auth.getUser();
          
          if (authError) {
            console.warn('⚠️ 获取用户认证状态失败:', authError.message);
          }
          
          // 如果用户未登录（访客模式），只执行本地删除，不同步数据库
          if (!user) {
            console.log('👤 访客模式：只执行本地删除消息，跳过数据库同步');
            return; // 直接返回，不执行数据库操作
          }
          
          // 用户已登录：执行软删除到数据库
          console.log('🔐 用户已登录：执行消息数据库软删除');

          const now = new Date().toISOString();
          const { error } = await supabase
            .from('messages')
            .update({ deleted_at: now })
            .eq('id', messageId);
          
          if (error) {
            // 回滚本地状态
            if (originalSession) {
              set((state) => ({
                chatSessions: state.chatSessions.map(s => 
                  s.id === sessionId ? originalSession : s
                )
              }));
            }
            console.error('软删除消息失败:', error);
            throw new Error(`软删除消息失败: ${error.message}`);
          }
          
          console.log('✅ 消息数据库同步软删除成功');
          
        } catch (error) {
          // 如果是我们抛出的错误，直接重新抛出
          if (error instanceof Error && error.message.includes('软删除消息失败')) {
            throw error;
          }
          
          // 回滚本地状态
          if (originalSession) {
            set((state) => ({
              chatSessions: state.chatSessions.map(s => 
                s.id === sessionId ? originalSession : s
              )
            }));
          }
          console.error('删除消息时发生错误:', error);
          throw new Error(`删除消息时发生错误: ${error instanceof Error ? error.message : '未知错误'}`);
        }
      },
      
      // 标题生成相关actions
      markSessionNeedsTitle: (sessionId) => {
        set((state) => ({
          sessionsNeedingTitle: new Set([...state.sessionsNeedingTitle, sessionId])
        }));
      },
      
      removeSessionNeedsTitle: (sessionId) => {
        set((state) => {
          const newSet = new Set(state.sessionsNeedingTitle);
          newSet.delete(sessionId);
          return { sessionsNeedingTitle: newSet };
        });
      },
      
      checkSessionNeedsTitle: (sessionId) => {
        return get().sessionsNeedingTitle.has(sessionId);
      },
      
      // UI相关actions
      setTheme: (theme) => {
        console.log('🔧 store.setTheme 开始执行:', {
          oldTheme: get().theme,
          newTheme: theme,
          timestamp: new Date().toISOString()
        });
        
        set({ theme });
        console.log('🔧 store 状态已更新:', { theme: get().theme });
        
        // 更新 HTML 元素的 data-theme 属性以支持 DaisyUI 主题切换
        if (typeof document !== 'undefined') {
          const oldDataTheme = document.documentElement.getAttribute('data-theme');
          document.documentElement.setAttribute('data-theme', theme);
          const newDataTheme = document.documentElement.getAttribute('data-theme');
          console.log('🔧 data-theme 属性更新:', {
            old: oldDataTheme,
            new: newDataTheme,
            success: newDataTheme === theme
          });
          
          // 同时保持原有的 class 切换以兼容其他样式
          const hadDarkClass = document.documentElement.classList.contains('dark');
          if (theme === 'dark') {
            document.documentElement.classList.add('dark');
          } else {
            document.documentElement.classList.remove('dark');
          }
          const hasDarkClass = document.documentElement.classList.contains('dark');
          console.log('🔧 dark 类切换:', {
            before: hadDarkClass,
            after: hasDarkClass,
            shouldHaveDark: theme === 'dark'
          });
          
          // 强制触发重新渲染以确保主题生效
          document.documentElement.style.setProperty('--theme-transition', 'all 0.2s ease');
          setTimeout(() => {
            document.documentElement.style.removeProperty('--theme-transition');
          }, 200);
        }
        
        console.log('🔧 store.setTheme 执行完成');
      },
      
      toggleSidebar: () => {
        set((state) => ({ sidebarOpen: !state.sidebarOpen }));
      },
      
      // 语音设置相关actions
      setVoiceSettings: (settings) => {
        set({ voiceSettings: settings });
        // 自动同步到云端
        if (settings) {
          queueDataSync('voice_settings', settings);
        }
      },

      // 联网搜索设置相关actions
      setSearchConfig: (config) => {
        set({ searchConfig: config });
      },
      updateSearchConfig: (partial) => {
        set((state) => ({ searchConfig: { ...state.searchConfig, ...partial } }));
      },
      
      // 数据导入导出actions
      exportData: () => {
        const state = get();
        
        // 转换AI角色中的头像路径
        const aiRoles = state.aiRoles.map(role => ({
          ...role,
          avatar: convertAvatarForExport(role.avatar)
        }));
        
        // 转换用户资料中的头像路径
        const userRoles = state.userRoles.map(profile => ({
          ...profile,
          avatar: convertAvatarForExport(profile.avatar)
        }));
        
        // 转换当前用户资料中的头像路径
        const currentUserProfile = state.currentUserProfile ? {
          ...state.currentUserProfile,
          avatar: convertAvatarForExport(state.currentUserProfile.avatar)
        } : null;
        
        const exportData = {
          llmConfigs: state.llmConfigs,
          aiRoles,
          userRoles,
          globalPrompts: state.globalPrompts,
          chatSessions: state.chatSessions,
          currentModelId: state.currentModelId,
          currentUserProfile,
          voiceSettings: state.voiceSettings,
          theme: state.theme,
          exportedAt: new Date().toISOString(),
          version: '1.0'
        };
        return JSON.stringify(exportData, null, 2);
      },
      
      importData: (dataStr) => {
        try {
          const data = JSON.parse(dataStr);
          
          // 验证数据格式
          if (!data.version || !Array.isArray(data.llmConfigs) || !Array.isArray(data.aiRoles)) {
            console.error('Invalid data format');
            return false;
          }
          
          // 恢复Date对象并转换头像路径
          const aiRoles = data.aiRoles.map((role: any) => ({
            ...role,
            avatar: convertAvatarFromImport(role.avatar),
            createdAt: new Date(role.createdAt || Date.now()),
            updatedAt: new Date(role.updatedAt || Date.now())
          }));
          
          const userRoles = (data.userRoles || []).map((profile: any) => ({
            ...profile,
            avatar: convertAvatarFromImport(profile.avatar),
            createdAt: new Date(profile.createdAt || Date.now()),
            updatedAt: new Date(profile.updatedAt || Date.now())
          }));
          
          const globalPrompts = (data.globalPrompts || []).map((prompt: any) => ({
            ...prompt,
            createdAt: new Date(prompt.createdAt || Date.now()),
            updatedAt: new Date(prompt.updatedAt || Date.now())
          }));
          
          const chatSessions = (data.chatSessions || []).map((session: any) => ({
            ...session,
            createdAt: new Date(session.createdAt || Date.now()),
            updatedAt: new Date(session.updatedAt || Date.now()),
            messages: (session.messages || []).map((msg: any) => ({
              ...msg,
              timestamp: new Date(msg.timestamp || Date.now()),
              // 🔒 确保 snowflake_id 保持字符串类型，防止 JSON.parse 导致的精度丢失
              snowflake_id: msg.snowflake_id ? ensureSnowflakeIdString(msg.snowflake_id) : msg.snowflake_id
            }))
          }));
          
          // 转换当前用户资料的头像路径
          const currentUserProfile = data.currentUserProfile ? {
            ...data.currentUserProfile,
            avatar: convertAvatarFromImport(data.currentUserProfile.avatar)
          } : null;
          
          // 更新状态
          set({
            llmConfigs: data.llmConfigs,
            aiRoles,
            userRoles,
            globalPrompts,
            chatSessions,
            currentModelId: data.currentModelId || null,
            currentUserProfile,
            voiceSettings: data.voiceSettings || null,
            theme: data.theme || 'light'
          });
          
          return true;
        } catch (error) {
          console.error('Failed to import data:', error);
          return false;
        }
      },
      
      clearAllData: () => {
        set({
          llmConfigs: [],
          currentModelId: null,
          aiRoles: defaultRoles,

          userRoles: [],
          currentUserProfile: null,
          globalPrompts: [],
          chatSessions: [],
          currentSessionId: null,
          tempSessionId: null,
          theme: 'light',
          sidebarOpen: true
        });
      }
    }),
    {
      name: 'ai-chat-storage',
      version: 5, // 增加版本号以触发迁移 - 修复默认角色UUID
      onRehydrateStorage: () => {
        console.log('🔄 zustand 开始恢复存储数据');
        return (state, error) => {
          if (error) {
            console.error('🔄 zustand 恢复存储数据失败:', error);
            return;
          }
          if (state) {
            console.log('🔄 zustand 恢复存储数据成功，当前主题:', state.theme);
            // 应用存储的主题到 DOM
            if (typeof document !== 'undefined') {
              document.documentElement.setAttribute('data-theme', state.theme);
              if (state.theme === 'dark') {
                document.documentElement.classList.add('dark');
              } else {
                document.documentElement.classList.remove('dark');
              }
              console.log('🔄 DOM 主题已应用:', state.theme);
            }
          }
        };
      },
      migrate: (persistedState: any, version: number) => {
        // 数据迁移：为现有消息补充roleId信息
        if (version < 2 && persistedState?.chatSessions) {
          persistedState.chatSessions = persistedState.chatSessions.map((session: any) => ({
            ...session,
            messages: (session.messages || []).map((message: any) => ({
              ...message,
              // 如果消息没有roleId，使用会话的roleId
              roleId: message.roleId || session.roleId,
              // 确保timestamp是Date对象
              timestamp: message.timestamp ? new Date(message.timestamp) : new Date()
            }))
          }));
        }
        
        // 数据迁移：将globalPromptId迁移到globalPromptIds数组
        if (version < 3 && persistedState?.aiRoles) {
          persistedState.aiRoles = persistedState.aiRoles.map((role: any) => {
            // 如果角色有globalPromptId但没有globalPromptIds，进行迁移
            if (role.globalPromptId && !role.globalPromptIds) {
              return {
                ...role,
                globalPromptIds: [role.globalPromptId], // 将单个ID转换为数组
                // 保留原字段用于向后兼容
                globalPromptId: role.globalPromptId
              };
            }
            // 如果没有globalPromptIds字段，初始化为空数组
            if (!role.globalPromptIds) {
              return {
                ...role,
                globalPromptIds: []
              };
            }
            return role;
          });
        }
        
        // 数据迁移：更新默认角色ID为固定UUID
        if (version < 4 && persistedState?.aiRoles) {
          const defaultRoleIdMap: { [key: string]: string } = {
            'default-assistant': '00000000-0000-4000-8000-000000000001',
            'code-expert': '00000000-0000-4000-8000-000000000002',
            'creative-writer': '00000000-0000-4000-8000-000000000003'
          };
          
          persistedState.aiRoles = persistedState.aiRoles.map((role: any) => {
            // 如果是旧的默认角色ID，更新为新的UUID
            if (defaultRoleIdMap[role.id]) {
              return {
                ...role,
                id: defaultRoleIdMap[role.id]
              };
            }
            return role;
          });
          
          // 同时更新聊天会话中的角色ID引用
          if (persistedState?.chatSessions) {
            persistedState.chatSessions = persistedState.chatSessions.map((session: any) => {
              let updatedSession = { ...session };
              
              // 更新会话的roleId
              if (defaultRoleIdMap[session.roleId]) {
                updatedSession.roleId = defaultRoleIdMap[session.roleId];
              }
              
              // 更新消息中的roleId
              if (session.messages) {
                updatedSession.messages = session.messages.map((message: any) => {
                  if (message.roleId && defaultRoleIdMap[message.roleId]) {
                    return {
                      ...message,
                      roleId: defaultRoleIdMap[message.roleId]
                    };
                  }
                  return message;
                });
              }
              
              return updatedSession;
            });
          }
        }
        
        // 强制迁移：再次检查并更新默认角色ID（版本5）
        if (version < 5 && persistedState?.aiRoles) {
          console.log('🔄 [迁移] 执行版本5迁移：强制更新默认角色ID');
          const defaultRoleIdMap: { [key: string]: string } = {
            'default-assistant': '00000000-0000-4000-8000-000000000001',
            'code-expert': '00000000-0000-4000-8000-000000000002',
            'creative-writer': '00000000-0000-4000-8000-000000000003'
          };
          
          let hasChanges = false;
          persistedState.aiRoles = persistedState.aiRoles.map((role: any) => {
            // 如果是旧的默认角色ID，更新为新的UUID
            if (defaultRoleIdMap[role.id]) {
              console.log(`🔄 [迁移] 更新角色ID: ${role.id} -> ${defaultRoleIdMap[role.id]}`);
              hasChanges = true;
              return {
                ...role,
                id: defaultRoleIdMap[role.id]
              };
            }
            return role;
          });
          
          // 同时更新聊天会话中的角色ID引用
          if (persistedState?.chatSessions) {
            persistedState.chatSessions = persistedState.chatSessions.map((session: any) => {
              let updatedSession = { ...session };
              
              // 更新会话的roleId
              if (defaultRoleIdMap[session.roleId]) {
                console.log(`🔄 [迁移] 更新会话角色ID: ${session.roleId} -> ${defaultRoleIdMap[session.roleId]}`);
                updatedSession.roleId = defaultRoleIdMap[session.roleId];
                hasChanges = true;
              }
              
              // 更新消息中的roleId
              if (session.messages) {
                updatedSession.messages = session.messages.map((message: any) => {
                  if (message.roleId && defaultRoleIdMap[message.roleId]) {
                    console.log(`🔄 [迁移] 更新消息角色ID: ${message.roleId} -> ${defaultRoleIdMap[message.roleId]}`);
                    hasChanges = true;
                    return {
                      ...message,
                      roleId: defaultRoleIdMap[message.roleId]
                    };
                  }
                  return message;
                });
              }
              
              return updatedSession;
            });
          }
          
          if (hasChanges) {
            console.log('✅ [迁移] 版本5迁移完成，已更新默认角色ID');
          } else {
            console.log('ℹ️ [迁移] 版本5迁移：未发现需要更新的默认角色ID');
          }
        }
        
        return persistedState;
      },
      partialize: (state) => ({
        llmConfigs: state.llmConfigs,
        currentModelId: state.currentModelId,
        aiRoles: state.aiRoles,
        userRoles: state.userRoles,
        currentUserProfile: state.currentUserProfile,
        currentUser: state.currentUser, // 添加currentUser到持久化状态
        globalPrompts: state.globalPrompts,
        chatSessions: state.chatSessions,
        currentSessionId: state.currentSessionId,
        tempSessionId: state.tempSessionId,
        theme: state.theme,
        sidebarOpen: state.sidebarOpen,
        voiceSettings: state.voiceSettings,
        searchConfig: state.searchConfig
      }),
      storage: {
        getItem: (name) => {
          const str = localStorage.getItem(name);
          if (!str) return null;
          try {
            // 🔧 使用自定义反序列化器恢复被保护的 snowflake_id
            const { state } = customDeserializer(str);
            // 恢复Date对象
            if (state.aiRoles) {
              state.aiRoles = state.aiRoles.map((role: any) => ({
                ...role,
                createdAt: new Date(role.createdAt),
                updatedAt: new Date(role.updatedAt)
              }));
            }
            if (state.userRoles) {
              state.userRoles = state.userRoles.map((profile: any) => ({
                ...profile,
                createdAt: new Date(profile.createdAt),
                updatedAt: new Date(profile.updatedAt)
              }));
            }
            if (state.globalPrompts) {
              state.globalPrompts = state.globalPrompts.map((prompt: any) => ({
                ...prompt,
                createdAt: new Date(prompt.createdAt),
                updatedAt: new Date(prompt.updatedAt)
              }));
            }
            if (state.chatSessions) {
              state.chatSessions = state.chatSessions.map((session: any) => ({
                ...session,
                createdAt: new Date(session.createdAt),
                updatedAt: new Date(session.updatedAt),
                messages: session.messages.map((msg: any) => ({
                  ...msg,
                  timestamp: new Date(msg.timestamp),
                  // 🔒 确保 snowflake_id 保持字符串类型，防止精度丢失
                  snowflake_id: msg.snowflake_id ? ensureSnowflakeIdString(msg.snowflake_id) : msg.snowflake_id
                }))
              }));
            }
            return state;
          } catch (error) {
            console.warn('Failed to deserialize state:', error);
            return null;
          }
        },
        setItem: (name, value) => {
          // 🔧 使用自定义序列化器保护 snowflake_id 字段
          const serializedData = customSerializer({
            state: value,
            version: 1
          });
          localStorage.setItem(name, serializedData);
        },
        removeItem: (name) => localStorage.removeItem(name)
      }
    }
  )
);

// 导出工具函数
export { generateId, isValidUUID, convertToUUID };

// 在开发环境中将store暴露到window对象，方便测试数据生成器使用
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  (window as any).useAppStore = useAppStore;
  console.log('🔧 开发模式：useAppStore已暴露到window对象');
}