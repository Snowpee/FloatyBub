import { defaultAutoTitleConfig, defaultAssistantConfig } from './utils';

export const migrate = (persistedState: any, version: number) => {
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

  // 版本6迁移：注入自动标题默认配置
  if (version < 6) {
    if (!persistedState.autoTitleConfig) {
      persistedState.autoTitleConfig = defaultAutoTitleConfig;
    }
  }

  // 版本7迁移：注入发送消息快捷键默认配置
  if (version < 7) {
    if (!persistedState.sendMessageShortcut) {
      persistedState.sendMessageShortcut = 'ctrlEnter';
    }
  }

  // 版本8迁移：注入 chatStyle 默认配置，兼容旧 localStorage
  if (version < 8) {
    if (!persistedState.chatStyle) {
      try {
        const fromLocal = (typeof window !== 'undefined' ? (localStorage.getItem('chatStyle') as 'conversation' | 'document' | null) : null) || null;
        persistedState.chatStyle = fromLocal && (fromLocal === 'conversation' || fromLocal === 'document') ? fromLocal : 'conversation';
      } catch (_) {
        persistedState.chatStyle = 'conversation';
      }
    }
  }

  // 版本9迁移：新增 assistantConfig，优先从 autoTitleConfig 迁移，确保双向兼容
  if (version < 9) {
    if (!persistedState.assistantConfig) {
      persistedState.assistantConfig = persistedState.autoTitleConfig || defaultAssistantConfig;
    }
    // 兼容旧代码路径：若缺失 autoTitleConfig，则从 assistantConfig 回填
    if (!persistedState.autoTitleConfig) {
      persistedState.autoTitleConfig = persistedState.assistantConfig || defaultAutoTitleConfig;
    }
  }
  
  // 版本10迁移：新增 agentSkills
  if (version < 10) {
    if (!persistedState.agentSkills) {
      persistedState.agentSkills = [];
    }
  }

  // 版本11迁移：为 ChatSession 新增 activeSkillIds 和 loadedSkillFiles
  if (version < 11 && persistedState?.chatSessions) {
    persistedState.chatSessions = persistedState.chatSessions.map((session: any) => ({
      ...session,
      activeSkillIds: session.activeSkillIds || [],
      loadedSkillFiles: session.loadedSkillFiles || []
    }));
  }

  // 数据迁移：设置默认角色ID为AI助手
  if (version < 13) {
    if (persistedState && !persistedState.defaultRoleId) {
      persistedState.defaultRoleId = '00000000-0000-4000-8000-000000000001';
    }
  }

  return persistedState;
};

export const onRehydrateStorage = () => {
  console.log('🔄 zustand 开始恢复存储数据');
  return (state: any, error: any) => {
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
};
