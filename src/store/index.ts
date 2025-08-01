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
  provider: 'openai' | 'claude' | 'gemini' | 'custom';
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

// 应用状态接口
interface AppState {
  // LLM配置
  llmConfigs: LLMConfig[];
  currentModelId: string | null;
  
  // AI角色
  aiRoles: AIRole[];
  currentRoleId: string | null;
  
  // 用户资料
  userProfiles: UserProfile[];
  currentUserProfile: UserProfile | null;
  
  // 全局提示词
  globalPrompts: GlobalPrompt[];
  
  // 聊天会话
  chatSessions: ChatSession[];
  currentSessionId: string | null;
  tempSessionId: string | null; // 临时会话ID
  
  // UI状态
  theme: 'light' | 'dark' | 'cupcake' | 'floaty';
  sidebarOpen: boolean;
  
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
  setCurrentRole: (id: string) => void;
  
  // 全局提示词相关
  addGlobalPrompt: (prompt: Omit<GlobalPrompt, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateGlobalPrompt: (id: string, prompt: Partial<GlobalPrompt>) => void;
  deleteGlobalPrompt: (id: string) => void;
  
  // 聊天会话相关
  createChatSession: (roleId: string, modelId: string) => string;
  createTempSession: (roleId: string, modelId: string) => string;
  saveTempSession: () => void;
  deleteTempSession: () => void;
  updateChatSession: (id: string, session: Partial<ChatSession>) => void;
  deleteChatSession: (id: string) => void;
  hideSession: (id: string) => void;
  showSession: (id: string) => void;
  setCurrentSession: (id: string) => void;
  addMessage: (sessionId: string, message: Omit<ChatMessage, 'id'> & { id?: string }) => void;
  updateMessage: (sessionId: string, messageId: string, content: string, isStreaming?: boolean) => void;
  regenerateMessage: (sessionId: string, messageId: string) => Promise<void>;
  addMessageVersion: (sessionId: string, messageId: string, newContent: string) => void;
  addMessageVersionWithOriginal: (sessionId: string, messageId: string, originalContent: string, newContent: string) => void;
  switchMessageVersion: (sessionId: string, messageId: string, versionIndex: number) => void;
  deleteMessage: (sessionId: string, messageId: string) => void;
  
  // 用户资料相关
  addUserProfile: (profile: Omit<UserProfile, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateUserProfile: (id: string, profile: Partial<UserProfile>) => void;
  deleteUserProfile: (id: string) => void;
  setCurrentUserProfile: (profile: UserProfile | null) => void;
  
  // UI相关
  setTheme: (theme: 'light' | 'dark' | 'cupcake' | 'floaty') => void;
  toggleSidebar: () => void;
  
  // 数据导入导出
  exportData: () => string;
  importData: (data: string) => boolean;
  clearAllData: () => void;
}

// 生成唯一ID
const generateId = () => Math.random().toString(36).substr(2, 9);

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
      currentRoleId: 'default-assistant',
      userProfiles: [],
      currentUserProfile: null,
      globalPrompts: [],
      chatSessions: [],
      currentSessionId: null,
      tempSessionId: null,
      theme: 'floaty',
      sidebarOpen: typeof window !== 'undefined' ? window.innerWidth >= 768 : true,
      
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
        set({ currentModelId: id });
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
          aiRoles: state.aiRoles.filter(r => r.id !== id),
          currentRoleId: state.currentRoleId === id ? 'default-assistant' : state.currentRoleId
        }));
      },
      
      setCurrentRole: (id) => {
        set({ currentRoleId: id });
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
      
      deleteTempSession: () => {
        const { tempSessionId, chatSessions } = get();
        if (tempSessionId) {
          set((state) => ({
            chatSessions: state.chatSessions.filter(s => s.id !== tempSessionId),
            currentSessionId: null,
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
          currentRoleId: newSession?.roleId || state.currentRoleId,
          currentModelId: newSession?.modelId || state.currentModelId
        });
      },
      
      addMessage: (sessionId, message) => {
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
        if (tempSessionId === sessionId && message.role === 'user') {
          get().saveTempSession();
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
          currentRoleId: state.currentRoleId,
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
            currentRoleId: data.currentRoleId || 'default-assistant',
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
          currentRoleId: 'default-assistant',
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
        currentRoleId: state.currentRoleId,
        userProfiles: state.userProfiles,
        currentUserProfile: state.currentUserProfile,
        globalPrompts: state.globalPrompts,
        chatSessions: state.chatSessions,
        currentSessionId: state.currentSessionId,
        tempSessionId: state.tempSessionId,
        theme: state.theme,
        sidebarOpen: state.sidebarOpen
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