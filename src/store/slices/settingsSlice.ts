import { StateCreator } from 'zustand';
import { AppState, SettingsSlice } from '../types';
import { 
  queueDataSync, 
  defaultVoiceSettings, 
  defaultSearchConfig, 
  defaultAutoTitleConfig, 
  defaultAssistantConfig, 
  defaultRoles 
} from '../utils';
import { convertAvatarForExport, convertAvatarFromImport } from '@/utils/avatarUtils';
import { ensureSnowflakeIdString } from '@/utils/snowflakeId';

export const createSettingsSlice: StateCreator<AppState, [], [], SettingsSlice> = (set, get) => ({
  pendingSettingsSync: [],
  // 初始状态
  theme: 'floaty',
  sidebarOpen: typeof window !== 'undefined' ? window.innerWidth >= 1024 : true,
  chatStyle: 'conversation',
  sendMessageShortcut: 'ctrlEnter',
  voiceSettings: defaultVoiceSettings,
  searchConfig: defaultSearchConfig,
  autoTitleConfig: defaultAutoTitleConfig,
  assistantConfig: defaultAssistantConfig,
  defaultRoleId: '00000000-0000-4000-8000-000000000001',

  // UI相关actions
  setTheme: (theme) => {
    console.log('🔧 store.setTheme 开始执行:', {
      oldTheme: get().theme,
      newTheme: theme,
      timestamp: new Date().toISOString()
    });
    
    set({ theme });
    queueDataSync('general_settings', { theme });
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

  setChatStyle: (style) => {
    set({ chatStyle: style });
    // 云同步 general_settings（增量）
    queueDataSync('general_settings', { chatStyle: style });
  },

  setSendMessageShortcut: (shortcut) => {
    set({ sendMessageShortcut: shortcut });
    // 云同步 general_settings
    if (shortcut) {
      queueDataSync('general_settings', { sendMessageShortcut: shortcut });
    }
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
    if (config) {
      queueDataSync('general_settings', { searchConfig: config });
    }
  },
  
  updateSearchConfig: (partial) => {
    const current = get().searchConfig;
    const newConfig = { ...current, ...partial };
    set({ searchConfig: newConfig });
    queueDataSync('general_settings', { searchConfig: newConfig });
  },

  // 自动标题设置相关actions（保持与助手设置同步）
  setAutoTitleConfig: (config) => {
    set({ autoTitleConfig: config, assistantConfig: { ...get().assistantConfig, ...config } });
    if (config) {
      queueDataSync('general_settings', { assistantConfig: config, autoTitleConfig: config });
    }
  },
  
  updateAutoTitleConfig: (partial) => {
    const currentAuto = get().autoTitleConfig;
    const newConfig = { ...currentAuto, ...partial };
    set({ autoTitleConfig: newConfig, assistantConfig: { ...get().assistantConfig, ...newConfig } });
    queueDataSync('general_settings', { assistantConfig: newConfig, autoTitleConfig: newConfig });
  },

  // 助手设置相关actions（新）
  setAssistantConfig: (config) => {
    set({ assistantConfig: config, autoTitleConfig: { ...get().autoTitleConfig, ...config } });
    if (config) {
      queueDataSync('general_settings', { assistantConfig: config, autoTitleConfig: config });
    }
  },
  
  updateAssistantConfig: (partial) => {
    const current = get().assistantConfig;
    const newConfig = { ...current, ...partial };
    set({ assistantConfig: newConfig, autoTitleConfig: { ...get().autoTitleConfig, ...newConfig } });
    queueDataSync('general_settings', { assistantConfig: newConfig, autoTitleConfig: newConfig });
  },

  // 默认角色设置相关
  setDefaultRoleId: (roleId) => {
    set({ defaultRoleId: roleId });
    queueDataSync('general_settings', { defaultRoleId: roleId });
  },

  // 全量同步：将当前所有通用设置一次性推送云端
  syncGeneralSettingsFull: async () => {
    try {
      const state = get();
      const payload = {
        settings: {
          theme: state.theme,
          currentModelId: state.currentModelId,
          currentUserProfileId: state.currentUserProfile?.id ?? null,
          chatStyle: state.chatStyle,
          sendMessageShortcut: state.sendMessageShortcut,
          assistantConfig: state.assistantConfig,
          // 兼容旧客户端：同时提供 autoTitleConfig
          autoTitleConfig: state.autoTitleConfig,
          searchConfig: state.searchConfig,
          defaultRoleId: state.defaultRoleId
        },
        __full: true
      };
      await queueDataSync('general_settings', payload);
    } catch (error) {
      console.error('❌ syncGeneralSettingsFull 失败:', error);
    }
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
      agentSkills: state.agentSkills,
      chatSessions: state.chatSessions,
      currentModelId: state.currentModelId,
      currentUserProfile,
      voiceSettings: state.voiceSettings,
      assistantConfig: state.assistantConfig,
      autoTitleConfig: state.autoTitleConfig,
      defaultRoleId: state.defaultRoleId,
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
      
      const agentSkills = (data.agentSkills || []).map((skill: any) => ({
        ...skill,
        createdAt: new Date(skill.createdAt || Date.now()),
        updatedAt: new Date(skill.updatedAt || Date.now())
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
        agentSkills,
        chatSessions,
        currentModelId: data.currentModelId || null,
        currentUserProfile,
        voiceSettings: data.voiceSettings || null,
        assistantConfig: data.assistantConfig || data.autoTitleConfig || defaultAssistantConfig,
        autoTitleConfig: data.autoTitleConfig || data.assistantConfig || defaultAutoTitleConfig,
        defaultRoleId: data.defaultRoleId || null,
        theme: data.theme || 'floaty'
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
      agentSkills: [],
      chatSessions: [],
      currentSessionId: null,
      tempSessionId: null,
      tempSession: null,
      sessionsNeedingTitle: new Set(),
      theme: 'floaty',
      sidebarOpen: true,
      defaultRoleId: null
    });
  }
});
