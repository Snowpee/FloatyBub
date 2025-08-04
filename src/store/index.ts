import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// 导入默认头像
import avatar01 from '../assets/avatar/avatar-01.png';
import avatar02 from '../assets/avatar/avatar-02.png';
import avatar03 from '../assets/avatar/avatar-03.png';

// LLM模型配置接口
export interface LLMConfig {
  id: string;
  name: string;
  provider: 'openai' | 'claude' | 'gemini' | 'kimi' | 'deepseek' | 'custom';
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
  globalPromptId?: string; // 关联的全局提示词ID
  voiceModelId?: string; // 角色专属语音模型ID
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
  isStreaming?: boolean;
  roleId?: string; // 对于assistant消息，存储AI角色ID；对于user消息，可以为空
  userProfileId?: string; // 对于user消息，存储用户资料ID；对于assistant消息，可以为空
  versions?: string[]; // 消息的多个版本内容
  currentVersionIndex?: number; // 当前显示的版本索引
  reasoningContent?: string; // DeepSeek等模型的思考过程内容
  isReasoningComplete?: boolean; // 思考过程是否完成
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
}

// 语音设置接口
export interface VoiceSettings {
  provider: 'fish-audio' | 'other';
  apiUrl: string;
  apiKey: string;
  readingMode: 'all' | 'dialogue-only';
  customModels: VoiceModel[];
  defaultVoiceModelId?: string;
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

// 应用状态接口
interface AppState {
  // LLM配置
  llmConfigs: LLMConfig[];
  currentModelId: string | null;
  
  // AI角色
  aiRoles: AIRole[];
  
  // 用户资料
  userProfiles: UserProfile[];
  currentUserProfile: UserProfile | null;
  
  // 全局提示词
  globalPrompts: GlobalPrompt[];
  
  // 聊天会话
  chatSessions: ChatSession[];
  currentSessionId: string | null;
  tempSessionId: string | null; // 临时会话ID
  sessionsNeedingTitle: Set<string>; // 需要生成标题的会话ID集合
  
  // UI状态
  theme: 'light' | 'dark' | 'cupcake' | 'floaty';
  sidebarOpen: boolean;
  
  // 语音设置
  voiceSettings: VoiceSettings | null;
  
  // Actions
  // LLM配置相关
  addLLMConfig: (config: Omit<LLMConfig, 'id'>) => void;
  updateLLMConfig: (id: string, config: Partial<LLMConfig>) => void;
  deleteLLMConfig: (id: string) => void;
  setCurrentModel: (id: string) => void;
  
  // AI角色相关
  addAIRole: (role: Omit<AIRole, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateAIRole: (id: string, role: Partial<AIRole>) => void;
  deleteAIRole: (id: string) => void;
  
  // 全局提示词相关
  addGlobalPrompt: (prompt: Omit<GlobalPrompt, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateGlobalPrompt: (id: string, prompt: Partial<GlobalPrompt>) => void;
  deleteGlobalPrompt: (id: string) => void;
  
  // 聊天会话相关
  createChatSession: (roleId: string, modelId: string) => string;
  createTempSession: (roleId: string, modelId: string) => string;
  saveTempSession: () => void;
  deleteTempSession: () => void;
  generateSessionTitle: (sessionId: string, llmConfig: LLMConfig) => Promise<void>;
  updateChatSession: (id: string, session: Partial<ChatSession>) => void;
  deleteChatSession: (id: string) => void;
  hideSession: (id: string) => void;
  showSession: (id: string) => void;
  setCurrentSession: (id: string) => void;
  addMessage: (sessionId: string, message: Omit<ChatMessage, 'id'> & { id?: string }, onTempSessionSaved?: (sessionId: string) => void) => void;
  updateMessage: (sessionId: string, messageId: string, content: string, isStreaming?: boolean) => void;
  updateMessageWithReasoning: (sessionId: string, messageId: string, content?: string, reasoningContent?: string, isStreaming?: boolean, isReasoningComplete?: boolean) => void;
  regenerateMessage: (sessionId: string, messageId: string) => Promise<void>;
  addMessageVersion: (sessionId: string, messageId: string, newContent: string) => void;
  addMessageVersionWithOriginal: (sessionId: string, messageId: string, originalContent: string, newContent: string) => void;
  switchMessageVersion: (sessionId: string, messageId: string, versionIndex: number) => void;
  deleteMessage: (sessionId: string, messageId: string) => void;
  
  // 标题生成相关
  markSessionNeedsTitle: (sessionId: string) => void;
  removeSessionNeedsTitle: (sessionId: string) => void;
  checkSessionNeedsTitle: (sessionId: string) => boolean;
  
  // 用户资料相关
  addUserProfile: (profile: Omit<UserProfile, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateUserProfile: (id: string, profile: Partial<UserProfile>) => void;
  deleteUserProfile: (id: string) => void;
  setCurrentUserProfile: (profile: UserProfile | null) => void;
  
  // UI相关
  setTheme: (theme: 'light' | 'dark' | 'cupcake' | 'floaty') => void;
  toggleSidebar: () => void;
  
  // 语音设置相关
  setVoiceSettings: (settings: VoiceSettings | null) => void;
  
  // 数据导入导出
  exportData: () => string;
  importData: (data: string) => boolean;
  clearAllData: () => void;
}

// 生成唯一ID
const generateId = () => Math.random().toString(36).substr(2, 9);

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

// 默认AI角色
const defaultRoles: AIRole[] = [
  {
    id: 'default-assistant',
    name: 'AI助手',
    description: '通用AI助手，可以帮助您解答问题和完成各种任务',
    systemPrompt: '你是一个有用的AI助手，请用友好、专业的语气回答用户的问题。',
    openingMessages: ['你好！我是你的AI助手，很高兴为你服务。有什么我可以帮助你的吗？'],
    currentOpeningIndex: 0,
    avatar: avatar01,
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: 'code-expert',
    name: '编程专家',
    description: '专业的编程助手，擅长代码编写、调试和技术问题解答',
    systemPrompt: '你是一个专业的编程专家，擅长多种编程语言和技术栈。请提供准确、实用的编程建议和代码示例。',
    openingMessages: ['你好！我是编程专家，专注于帮助你解决各种编程问题。无论是代码调试、架构设计还是技术选型，我都很乐意为你提供专业建议。'],
    currentOpeningIndex: 0,
    avatar: avatar02,
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    id: 'creative-writer',
    name: '创意写手',
    description: '富有创意的写作助手，擅长文案创作和内容策划',
    systemPrompt: '你是一个富有创意的写作专家，擅长各种文体的创作。请用生动、有趣的语言帮助用户完成写作任务。',
    openingMessages: ['嗨！我是你的创意写手伙伴，擅长各种文体创作。无论你需要写文案、故事、诗歌还是其他创意内容，我都能为你提供灵感和帮助！'],
    currentOpeningIndex: 0,
    avatar: avatar03,
    createdAt: new Date(),
    updatedAt: new Date()
  }
];

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      // 初始状态
      llmConfigs: [],
      currentModelId: null,
      aiRoles: defaultRoles,
      userProfiles: [],
      currentUserProfile: null,
      globalPrompts: [],
      chatSessions: [],
      currentSessionId: null,
      tempSessionId: null,
      sessionsNeedingTitle: new Set(),
      theme: 'floaty',
      sidebarOpen: typeof window !== 'undefined' ? window.innerWidth >= 768 : true,
      voiceSettings: loadVoiceSettingsFromStorage(),
      
      // LLM配置相关actions
      addLLMConfig: (config) => {
        const newConfig: LLMConfig = {
          ...config,
          id: generateId()
        };
        set((state) => ({
          llmConfigs: [...state.llmConfigs, newConfig]
        }));
      },
      
      updateLLMConfig: (id, config) => {
        set((state) => ({
          llmConfigs: state.llmConfigs.map(c => 
            c.id === id ? { ...c, ...config } : c
          )
        }));
      },
      
      deleteLLMConfig: (id) => {
        set((state) => ({
          llmConfigs: state.llmConfigs.filter(c => c.id !== id),
          currentModelId: state.currentModelId === id ? null : state.currentModelId
        }));
      },
      
      setCurrentModel: (id) => {
        const state = get();
        set({ currentModelId: id });
        
        // 如果有当前会话，同时更新会话的模型ID
        if (state.currentSessionId) {
          set((state) => ({
            chatSessions: state.chatSessions.map(s => 
              s.id === state.currentSessionId 
                ? { ...s, modelId: id }
                : s
            )
          }));
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
      },
      
      updateAIRole: (id, role) => {
        set((state) => ({
          aiRoles: state.aiRoles.map(r => 
            r.id === id ? { ...r, ...role, updatedAt: new Date() } : r
          )
        }));
      },
      
      deleteAIRole: (id) => {
        set((state) => ({
          aiRoles: state.aiRoles.filter(r => r.id !== id)
        }));
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
          userProfiles: [...state.userProfiles, newProfile]
        }));
      },
      
      updateUserProfile: (id, profile) => {
        set((state) => ({
          userProfiles: state.userProfiles.map(p => 
            p.id === id ? { ...p, ...profile, updatedAt: new Date() } : p
          )
        }));
      },
      
      deleteUserProfile: (id) => {
        set((state) => ({
          userProfiles: state.userProfiles.filter(p => p.id !== id),
          currentUserProfile: state.currentUserProfile?.id === id ? null : state.currentUserProfile
        }));
      },
      
      setCurrentUserProfile: (profile) => {
        set({ currentUserProfile: profile });
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
      },
      
      updateGlobalPrompt: (id, prompt) => {
        set((state) => ({
          globalPrompts: state.globalPrompts.map(p => 
            p.id === id ? { ...p, ...prompt, updatedAt: new Date() } : p
          )
        }));
      },
      
      deleteGlobalPrompt: (id) => {
        set((state) => ({
          globalPrompts: state.globalPrompts.filter(p => p.id !== id),
          // 清除使用了该全局提示词的角色关联
          aiRoles: state.aiRoles.map(role => 
            role.globalPromptId === id ? { ...role, globalPromptId: undefined } : role
          )
        }));
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
        
        set((state) => ({
          chatSessions: [newSession, ...state.chatSessions],
          currentSessionId: sessionId,
          tempSessionId: sessionId
        }));
        return sessionId;
      },
      
      saveTempSession: () => {
        set({ tempSessionId: null });
      },
      
      generateSessionTitle: async (sessionId, llmConfig) => {
        console.log('🎯 开始生成会话标题');
        console.log('📋 传入参数:', { sessionId, llmConfig: { ...llmConfig, apiKey: '***' } });
        
        const state = get();
        const session = state.chatSessions.find(s => s.id === sessionId);
        
        console.log('🔍 找到的会话:', session ? { id: session.id, title: session.title, messagesCount: session.messages.length } : '未找到');
        
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
          switch (llmConfig.provider) {
            case 'openai':
            case 'deepseek':
            case 'custom':
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
              break;
              
            case 'claude':
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
              break;
              
            default:
              console.warn('❌ 不支持的模型provider，跳过标题生成:', llmConfig.provider);
              return;
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
            tempSessionId: null
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
      
      deleteChatSession: (id) => {
        set((state) => ({
          chatSessions: state.chatSessions.filter(s => s.id !== id),
          currentSessionId: state.currentSessionId === id ? null : state.currentSessionId
        }));
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
      
      addMessage: (sessionId, message, onTempSessionSaved) => {
        const state = get();
        const session = state.chatSessions.find(s => s.id === sessionId);
        
        const newMessage: ChatMessage = {
          ...message,
          id: message.id || generateId(),
          timestamp: new Date(),
          roleId: session?.roleId,
          userProfileId: message.role === 'user' ? state.currentUserProfile?.id : undefined
        };
        
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
        
        set((state) => ({
          chatSessions: state.chatSessions.map(s => 
            s.id === sessionId 
              ? { ...s, messages: [...s.messages, newMessage], updatedAt: new Date() }
              : s
          )
        }));
      },
      
      updateMessage: (sessionId, messageId, content, isStreaming) => {
        set((state) => ({
          chatSessions: state.chatSessions.map(s => 
            s.id === sessionId 
              ? {
                  ...s,
                  messages: s.messages.map(m => 
                    m.id === messageId ? { 
                      ...m, 
                      content, 
                      isStreaming: isStreaming !== undefined ? isStreaming : m.isStreaming 
                    } : m
                  ),
                  updatedAt: new Date()
                }
              : s
          )
        }));
      },

      updateMessageWithReasoning: (sessionId, messageId, content, reasoningContent, isStreaming, isReasoningComplete) => {
        
        set((state) => ({
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
                      ...(isReasoningComplete !== undefined && { isReasoningComplete })
                    } : m
                  ),
                  updatedAt: new Date()
                }
              : s
          )
        }));
        
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

      addMessageVersionWithOriginal: (sessionId, messageId, originalContent, newContent) => {
        set((state) => ({
          chatSessions: state.chatSessions.map(s => 
            s.id === sessionId 
              ? {
                  ...s,
                  messages: s.messages.map(m => 
                    m.id === messageId ? {
                      ...m,
                      versions: m.versions ? [...m.versions, newContent] : [originalContent, newContent],
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
      },

      deleteMessage: (sessionId, messageId) => {
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
      },
      
      // 数据导入导出actions
      exportData: () => {
        const state = get();
        const exportData = {
          llmConfigs: state.llmConfigs,
          aiRoles: state.aiRoles,
          userProfiles: state.userProfiles,
          globalPrompts: state.globalPrompts,
          chatSessions: state.chatSessions,
          currentModelId: state.currentModelId,

          currentUserProfile: state.currentUserProfile,
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
          
          // 恢复Date对象
          const aiRoles = data.aiRoles.map((role: any) => ({
            ...role,
            createdAt: new Date(role.createdAt || Date.now()),
            updatedAt: new Date(role.updatedAt || Date.now())
          }));
          
          const userProfiles = (data.userProfiles || []).map((profile: any) => ({
            ...profile,
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
              timestamp: new Date(msg.timestamp || Date.now())
            }))
          }));
          
          // 更新状态
          set({
            llmConfigs: data.llmConfigs,
            aiRoles,
            userProfiles,
            globalPrompts,
            chatSessions,
            currentModelId: data.currentModelId || null,

            currentUserProfile: data.currentUserProfile || null,
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

          userProfiles: [],
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
      version: 2, // 增加版本号以触发迁移
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
        return persistedState;
      },
      partialize: (state) => ({
        llmConfigs: state.llmConfigs,
        currentModelId: state.currentModelId,
        aiRoles: state.aiRoles,

        userProfiles: state.userProfiles,
        currentUserProfile: state.currentUserProfile,
        globalPrompts: state.globalPrompts,
        chatSessions: state.chatSessions,
        currentSessionId: state.currentSessionId,
        tempSessionId: state.tempSessionId,
        theme: state.theme,
        sidebarOpen: state.sidebarOpen,
        voiceSettings: state.voiceSettings
      }),
      storage: {
        getItem: (name) => {
          const str = localStorage.getItem(name);
          if (!str) return null;
          try {
            const { state } = JSON.parse(str);
            // 恢复Date对象
            if (state.aiRoles) {
              state.aiRoles = state.aiRoles.map((role: any) => ({
                ...role,
                createdAt: new Date(role.createdAt),
                updatedAt: new Date(role.updatedAt)
              }));
            }
            if (state.userProfiles) {
              state.userProfiles = state.userProfiles.map((profile: any) => ({
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
                  timestamp: new Date(msg.timestamp)
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
          localStorage.setItem(name, JSON.stringify({
            state: value,
            version: 1
          }));
        },
        removeItem: (name) => localStorage.removeItem(name)
      }
    }
  )
);