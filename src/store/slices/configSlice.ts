import { StateCreator } from 'zustand';
import { AppState, ConfigSlice, LLMConfig, GlobalPrompt, AgentSkill } from '../types';
import { generateId, queueDataSync } from '../utils';
import { supabase } from '@/lib/supabase';

export const createConfigSlice: StateCreator<AppState, [], [], ConfigSlice> = (set, get) => ({
  // 初始状态
  llmConfigs: [],
  currentModelId: null,
  globalPrompts: [],
  agentSkills: [],

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

  // 全局提示词相关 actions
  addGlobalPrompt: (prompt, options?: { skipSync?: boolean }) => {
    console.log('[PromptSync] ➕ 添加 Prompt:', prompt.title, 'skipSync:', options?.skipSync);
    
    // 检查是否存在同名或同ID的 Prompt
    const state = get();
    const existingPrompt = state.globalPrompts.find(p => p.id === prompt.id); // 暂只检查ID
    
    if (existingPrompt) {
      console.log('[PromptSync] ⚠️ Prompt 已存在，转为更新:', prompt.title);
      get().updateGlobalPrompt(prompt.id!, prompt as GlobalPrompt, options);
      return;
    }

    const newPrompt: GlobalPrompt = {
      ...prompt,
      id: prompt.id || generateId(),
      createdAt: prompt.createdAt || new Date(),
      updatedAt: prompt.updatedAt || new Date(),
      pendingUpload: !options?.skipSync
    };
    set((state) => ({
      globalPrompts: [...state.globalPrompts, newPrompt]
    }));
  },
  
  updateGlobalPrompt: (id, prompt, options?: { skipSync?: boolean }) => {
    console.log('[PromptSync] ✏️ 更新 Prompt:', id, 'skipSync:', options?.skipSync);
    set((state) => {
      const newPrompts = state.globalPrompts.map(p => {
        if (p.id === id) {
          // 优化时间戳逻辑
          const timestamp = prompt.updatedAt 
            ? prompt.updatedAt 
            : (options?.skipSync ? p.updatedAt : new Date());

          return { 
            ...p, 
            ...prompt, 
            updatedAt: timestamp,
            pendingUpload: !options?.skipSync 
          };
        }
        return p;
      });
      return { globalPrompts: newPrompts };
    });
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

  // Agent Skills 相关 actions
  addAgentSkill: (skill, options) => {
    console.log('[SkillSync] ➕ 添加 Skill:', skill.name, 'skipSync:', options?.skipSync)
    
    // 检查是否存在同名或同ID的 Skill
    const state = get();
    const existingSkill = state.agentSkills.find(s => s.id === skill.id);
    
    if (existingSkill) {
      console.log('[SkillSync] ⚠️ Skill 已存在，转为更新:', skill.name);
      get().updateAgentSkill(skill.id!, skill as AgentSkill, options);
      return;
    }

    const newSkill: AgentSkill = {
      ...skill,
      id: skill.id || generateId(),
      createdAt: skill.createdAt || new Date(),
      updatedAt: skill.updatedAt || new Date(),
      pendingUpload: !options?.skipSync
    };
    set((state) => ({
      agentSkills: [...state.agentSkills, newSkill]
    }));
  },

  updateAgentSkill: (id, skill, options) => {
    console.log('[SkillSync] ✏️ 更新 Skill:', id, 'skipSync:', options?.skipSync)
    set((state) => {
      const newSkills = state.agentSkills.map(s => {
        if (s.id === id) {
          // 优化时间戳逻辑：
          // 1. 如果传入了 updatedAt，直接使用 (Realtime 或明确更新)
          // 2. 如果是 skipSync (如上传完成清除标记)，保持原有时间不变
          // 3. 否则 (用户编辑)，更新为当前时间
          const timestamp = skill.updatedAt 
            ? skill.updatedAt 
            : (options?.skipSync ? s.updatedAt : new Date());
            
          return { 
            ...s, 
            ...skill, 
            updatedAt: timestamp,
            pendingUpload: !options?.skipSync
          };
        }
        return s;
      });
      return { agentSkills: newSkills };
    });
  },

  deleteAgentSkill: async (id, options) => {
    // 先保存原始状态，以便在失败时回滚
    const originalState = get();
    const originalSkill = originalState.agentSkills.find(s => s.id === id);
    
    // 先从本地状态删除
    set((state) => ({
      agentSkills: state.agentSkills.filter(s => s.id !== id),
      // 清除使用了该 Skill 的角色关联 (Array filter)
      aiRoles: state.aiRoles.map(role => 
        role.skillIds ? { ...role, skillIds: role.skillIds.filter(sid => sid !== id) } : role
      )
    }));
    
    if (options?.skipSync) {
      return;
    }

    // 同步删除到数据库
    try {
      const { error } = await supabase
        .from('agent_skills')
        .delete()
        .eq('id', id);
      
      if (error) {
        // 回滚本地状态
        if (originalSkill) {
          set((state) => ({
            agentSkills: [...state.agentSkills, originalSkill],
            aiRoles: originalState.aiRoles // Restore roles too
          }));
        }
        console.error('删除 Skill 失败:', error);
        throw new Error(`删除 Skill 失败: ${error.message}`);
      }
    } catch (error) {
      // 如果是我们抛出的错误，直接重新抛出
      if (error instanceof Error && error.message.includes('删除 Skill 失败')) {
        throw error;
      }
      
      // 回滚本地状态
      if (originalSkill) {
        set((state) => ({
          agentSkills: [...state.agentSkills, originalSkill],
          aiRoles: originalState.aiRoles
        }));
      }
      console.error('删除 Skill 时发生错误:', error);
      throw new Error(`删除 Skill 时发生错误: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  }
});
