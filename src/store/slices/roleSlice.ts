import { StateCreator } from 'zustand';
import { AppState, RoleSlice, AIRole } from '../types';
import { generateId, queueDataSync } from '../utils';
import { supabase } from '@/lib/supabase';

export const createRoleSlice: StateCreator<AppState, [], [], RoleSlice> = (set, get) => ({
  // 初始状态
  aiRoles: [],

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
            roleId: (updatedRole as AIRole).id,
            roleName: (updatedRole as AIRole).name,
            isFavorite: (updatedRole as AIRole).isFavorite,
            userId: user.id
          });
          queueDataSync('ai_role', { ...(updatedRole as AIRole), user_id: user.id });
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
  }
});
