import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { indexedDBStorage } from './storage';
import { 
  customSerializer, 
  customDeserializer, 
  hydrateState,
  generateId, 
  isValidUUID, 
  convertToUUID 
} from './utils';
import { migrate, onRehydrateStorage } from './migrations';
import type { AppState, ChatMessage, ChatSession } from './types';
import { createSettingsSlice } from './slices/settingsSlice';
import { createChatSlice } from './slices/chatSlice';
import { createRoleSlice } from './slices/roleSlice';
import { createConfigSlice } from './slices/configSlice';
import { createUserSlice } from './slices/userSlice';

// Re-export types and utils
export * from './types';
export * from './utils';

const console: Console = { ...globalThis.console, log: (..._args: any[]) => {} };

type PersistedMessage = Partial<ChatMessage> & Record<string, unknown>;
type PersistedSession = Partial<ChatSession> & {
  messages?: PersistedMessage[];
};
type PersistedState = Partial<AppState> & {
  chatSessions?: PersistedSession[];
  tempSession?: PersistedSession | null;
};

const sanitizePersistedSession = <T extends PersistedSession>(session: T): T => {
  if (!session?.messages?.some((message: PersistedMessage) => message?.isStreaming)) {
    return session;
  }

  return {
    ...session,
    messages: session.messages.filter((message: PersistedMessage) => !message?.isStreaming)
  } as T;
};

const sanitizePersistedState = <T extends PersistedState>(state: T): T => ({
  ...state,
  chatSessions: state.chatSessions?.map(sanitizePersistedSession) || state.chatSessions,
  tempSession: state.tempSession ? sanitizePersistedSession(state.tempSession) : state.tempSession
});

export const useAppStore = create<AppState>()(
  persist(
    (...a) => ({
      ...createSettingsSlice(...a),
      ...createChatSlice(...a),
      ...createRoleSlice(...a),
      ...createConfigSlice(...a),
      ...createUserSlice(...a),
    }),
    {
      name: 'ai-chat-storage',
      version: 14, // 版本14：恢复/持久化时清理已中断的流式状态
      onRehydrateStorage,
      migrate,
      partialize: (state) => ({
        llmConfigs: state.llmConfigs,
        currentModelId: state.currentModelId,
        aiRoles: state.aiRoles,
        userRoles: state.userRoles,
        currentUserProfile: state.currentUserProfile,
        currentUser: state.currentUser,
        globalPrompts: state.globalPrompts,
        agentSkills: state.agentSkills,
        chatSessions: state.chatSessions.map(sanitizePersistedSession),
        currentSessionId: state.currentSessionId,
        tempSessionId: state.tempSessionId,
        theme: state.theme,
        sidebarOpen: state.sidebarOpen,
        chatStyle: state.chatStyle,
        voiceSettings: state.voiceSettings,
        searchConfig: state.searchConfig,
        assistantConfig: state.assistantConfig,
        autoTitleConfig: state.autoTitleConfig,
        sendMessageShortcut: state.sendMessageShortcut,
        defaultRoleId: state.defaultRoleId
      }),
      storage: {
        getItem: async (name) => {
          const str = await indexedDBStorage.getItem(name);
          if (!str) return null;
          try {
            // 🔧 使用自定义反序列化器恢复被保护的 snowflake_id
            // customDeserializer 返回 { state: persistObject, version: 1 }
            // 其中 persistObject 是 { state: AppState, version: number }
            const { state } = customDeserializer(str);
            
            // 恢复 persistObject.state (AppState) 中的 Date 对象和 snowflake_id
            if (state && state.state) {
              state.state = sanitizePersistedState(hydrateState(state.state));
            } else if (state) {
              // 兼容旧数据可能直接存储了 state
              // 但按照 setItem 逻辑，应该总是被包裹的
              // 这里保留原逻辑: const actualState = state.state || state;
              const actualState = state.state || state;
              const hydrated = sanitizePersistedState(hydrateState(actualState));
              if (state.state) {
                state.state = hydrated;
              } else {
                // 如果 state 本身就是 AppState (不太可能，因为 setItem 包裹了)，则返回 hydrated
                // 但 persist 需要 { state, version }
                // 这里的处理稍微有点棘手，遵循原代码逻辑：
                // return state; (where state is the wrapper inner content)
                // 原代码：const actualState = state.state || state; modify actualState; return state;
                // 所以我们修改了 state.state (引用)，返回 state 即可。
                // 如果 state.state 不存在，说明 state 就是 AppState? 
                // 如果 state 就是 AppState，那么 persist 中间件会认为它是 { state, version } 吗？
                // 应该不会走到 else 分支，除非数据损坏或极旧版本。
                // 我们主要关注正常路径。
                return sanitizePersistedState(hydrateState(state)); // 如果 state 是直接的 AppState
              }
            }
            
            return state;
          } catch (error) {
            console.warn('Failed to deserialize state:', error);
            return null;
          }
        },
        setItem: async (name, value) => {
          try {
            // 🔧 使用自定义序列化器保护 snowflake_id 字段
            // value 是 { state: AppState, version: number }
            // 我们将其包裹在 { state: value, version: 1 } 中
            const serializedData = customSerializer({
              state: value,
              version: 1
            });
            await indexedDBStorage.setItem(name, serializedData);
          } catch (error) {
            console.error('Failed to persist state:', error);
          }
        },
        removeItem: (name) => indexedDBStorage.removeItem(name)
      }
    }
  )
);

// 在开发环境中将store暴露到window对象，方便测试数据生成器使用
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  (window as any).useAppStore = useAppStore;
  console.log('🔧 开发模式：useAppStore已暴露到window对象');
}
