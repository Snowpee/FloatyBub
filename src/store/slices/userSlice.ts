import { StateCreator } from 'zustand';
import { AppState, UserSlice, UserProfile } from '../types';
import { generateId, queueDataSync } from '../utils';
import { supabase } from '@/lib/supabase';

export const createUserSlice: StateCreator<AppState, [], [], UserSlice> = (set, get) => ({
  // 初始状态
  userRoles: [],
  currentUserProfile: null,
  currentUser: null,

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
    queueDataSync('general_settings', { currentUserProfileId: profile?.id ?? null });
  },
  
  // 用户认证相关actions
  setCurrentUser: (user) => {
    set({ currentUser: user });
  }
});
