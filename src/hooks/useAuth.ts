import { useState, useEffect, useRef, useCallback } from 'react'
import { User, Session, AuthError } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { useAppStore } from '../store'
import { useDataSync } from './useDataSync'
import { dataSyncService } from '../services/DataSyncService'

export interface AuthState {
  user: User | null
  session: Session | null
  loading: boolean
  error: string | null
}

export interface AuthActions {
  signUp: (email: string, password: string, displayName?: string) => Promise<{ error: AuthError | null }>
  signIn: (email: string, password: string) => Promise<{ error: AuthError | null }>
  signOut: () => Promise<{ error: AuthError | null }>
  resetPassword: (email: string) => Promise<{ error: AuthError | null }>
  updateProfile: (updates: { display_name?: string; avatar_url?: string }) => Promise<{ error: any }>
  clearError: () => void
}

export function useAuth(): AuthState & AuthActions {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  const { 
    setCurrentUser 
  } = useAppStore()
  const { pullFromCloud } = useDataSync()
  const syncTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const lastSyncUserIdRef = useRef<string | null>(null)
  const lastAuthEventRef = useRef<{ event: string; userId: string | null; timestamp: number } | null>(null)
  
  // 组件挂载状态标志
  let isComponentMounted = true
  
  // 认证状态一致性检查
  const authConsistencyCheckRef = useRef<NodeJS.Timeout | null>(null)
  
  // 认证状态一致性检查函数
  const checkAuthConsistency = useCallback(async () => {
    if (!isComponentMounted) return
    
    try {
      // 获取当前Supabase会话状态
      const { data: { session: currentSession }, error } = await supabase.auth.getSession()
      
      if (error) {
        console.warn('⚠️ [useAuth] 认证状态检查失败:', error.message)
        return
      }
      
      const appHasUser = !!user
      const supabaseHasSession = !!currentSession
      
      // 检查状态不一致
      if (appHasUser && !supabaseHasSession) {
        console.warn('🔄 [useAuth] 检测到认证状态不一致：应用显示已登录但Supabase会话无效')
        console.log('🔄 [useAuth] 清除应用认证状态...')
        
        // 清除应用状态
        setUser(null)
        setSession(null)
        setCurrentUser(null)
        setError('会话已过期，请重新登录')
        
        // 强制刷新页面或重定向到登录页
        // 这里可以根据应用需求选择合适的处理方式
        
      } else if (!appHasUser && supabaseHasSession) {
        console.log('🔄 [useAuth] 检测到有效Supabase会话但应用未登录，恢复认证状态')
        
        // 恢复应用状态
        setSession(currentSession)
        setUser(currentSession.user)
        setError(null)
        
        // 同步用户资料
        await syncUserProfile(currentSession.user)
      }
      
    } catch (error: any) {
      console.warn('⚠️ [useAuth] 认证状态一致性检查异常:', error.message)
    }
  }, [user])
  
  // 启动定期认证状态检查
  const startAuthConsistencyCheck = useCallback(() => {
    if (authConsistencyCheckRef.current) {
      clearInterval(authConsistencyCheckRef.current)
    }
    
    // 每30秒检查一次认证状态一致性
    authConsistencyCheckRef.current = setInterval(() => {
      checkAuthConsistency()
    }, 30000)
    
    console.log('🔄 [useAuth] 启动认证状态一致性检查 (30秒间隔)')
  }, [checkAuthConsistency])
  
  // 停止认证状态检查
  const stopAuthConsistencyCheck = useCallback(() => {
    if (authConsistencyCheckRef.current) {
      clearInterval(authConsistencyCheckRef.current)
      authConsistencyCheckRef.current = null
      console.log('🛑 [useAuth] 停止认证状态一致性检查')
    }
  }, [])

  // 云端数据同步重试函数
  const syncCloudDataWithRetry = useCallback(async (user: any, maxRetries = 3) => {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`🔄 [useAuth] 云端数据同步尝试 ${attempt}/${maxRetries}...`)
        
        // 验证用户状态
        if (!user || !user.id) {
          console.warn('⚠️ [useAuth] 用户状态无效，跳过云端数据同步')
          return
        }
        
        const cloudData = await pullFromCloud(user)
        
        // 智能合并AI角色：保留默认角色，添加云端自定义角色
        const currentState = useAppStore.getState()
        let mergedAiRoles = currentState.aiRoles
        
        if (cloudData.aiRoles && cloudData.aiRoles.length > 0) {
          const defaultRoleIds = ['default-assistant', 'code-expert', 'creative-writer']
          const defaultRoles = currentState.aiRoles.filter(role => defaultRoleIds.includes(role.id))
          const cloudCustomRoles = cloudData.aiRoles.filter(role => !defaultRoleIds.includes(role.id))
          mergedAiRoles = [...defaultRoles, ...cloudCustomRoles]
        }
        
        // 合并通用设置（仅在云端存在时更新本地，避免覆盖本地默认值）
        const gs = cloudData.generalSettings || null
        useAppStore.setState({
          ...currentState,
          ...(cloudData.llmConfigs && { llmConfigs: cloudData.llmConfigs }),
          aiRoles: mergedAiRoles,
          ...(cloudData.globalPrompts && { globalPrompts: cloudData.globalPrompts }),
          ...(cloudData.voiceSettings && { voiceSettings: cloudData.voiceSettings }),
          ...(cloudData.userRoles && { userRoles: cloudData.userRoles }),
          ...(gs && gs.sendMessageShortcut !== undefined ? { sendMessageShortcut: gs.sendMessageShortcut } : {}),
          ...(gs && (gs.assistantConfig || gs.autoTitleConfig) ? { assistantConfig: gs.assistantConfig || gs.autoTitleConfig } : {}),
          ...(gs && (gs.autoTitleConfig || gs.assistantConfig) ? { autoTitleConfig: gs.autoTitleConfig || gs.assistantConfig } : {}),
          ...(gs && gs.searchConfig ? { searchConfig: gs.searchConfig } : {}),
          ...(gs && gs.chatStyle ? { chatStyle: gs.chatStyle as 'conversation' | 'document' } : {})
        })
        
        console.log('✅ [useAuth] 云端数据同步成功')

        // 在合并 generalSettings 后触发一次全量推送，确保云端数据完整性
        try {
          await useAppStore.getState().syncGeneralSettingsFull()
          console.log('✅ [useAuth] 已触发通用设置全量推送')
        } catch (syncError: any) {
          console.warn('⚠️ [useAuth] 通用设置全量推送失败，但不影响主流程:', syncError?.message || syncError)
        }
        
        // 确保默认角色存在于数据库中
        try {
          const defaultRoleIds = ['default-assistant', 'code-expert', 'creative-writer']
          const defaultRoles = currentState.aiRoles.filter(role => defaultRoleIds.includes(role.id))
          await dataSyncService.ensureDefaultRolesExist(user, defaultRoles)
          console.log('✅ [useAuth] 默认角色同步检查完成')
        } catch (error: any) {
          console.warn('⚠️ [useAuth] 默认角色同步检查失败，但不影响主流程:', error.message)
          // 不抛出错误，避免影响主要的数据同步流程
        }
        
        return // 成功后退出重试循环
        
      } catch (error: any) {
        console.warn(`⚠️ [useAuth] 云端数据同步失败 (尝试 ${attempt}/${maxRetries}):`, error.message)
        
        // 判断是否为可重试的错误
        const isRetryableError = 
          error.message?.includes('用户未登录') ||
          error.message?.includes('fetch') || 
          error.message?.includes('network') ||
          error.message?.includes('timeout') ||
          error.message?.includes('connection') ||
          error.code === 'PGRST301' ||
          error.status === 503 ||
          error.status === 502 ||
          error.status === 504
        
        if (attempt < maxRetries && isRetryableError) {
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000) // 指数退避，最大5秒
          console.log(`⏳ [useAuth] ${delay}ms 后重试云端数据同步...`)
          await new Promise(resolve => setTimeout(resolve, delay))
        } else {
          console.warn('⚠️ [useAuth] 云端数据同步最终失败，将使用本地默认数据')
          break
        }
      }
    }
  }, [pullFromCloud])

  useEffect(() => {
    console.log('🔄 [useAuth] Hook 初始化')
    const maxRetries = 5
    const retryDelay = 1000 // 1秒
    let isComponentMounted = true

    // 获取初始会话（改进的重试机制）
    const getInitialSession = async (attempt = 1) => {
      if (!isComponentMounted) return
      
      try {
        console.log(`🔄 [useAuth] 尝试获取会话 (${attempt}/${maxRetries})...`)
        
        // 添加超时控制
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Session fetch timeout')), 10000)
        })
        
        const sessionPromise = supabase.auth.getSession()
        const { data: { session }, error } = await Promise.race([sessionPromise, timeoutPromise]) as any
        
        if (!isComponentMounted) return
        
        if (error) {
          console.error('[useAuth] Error getting session:', error)
          
          // 如果还有重试次数，则重试
          if (attempt < maxRetries) {
            console.log(`⏳ [useAuth] ${retryDelay * attempt}ms 后重试...`)
            setTimeout(() => getInitialSession(attempt + 1), retryDelay * attempt)
            return
          }
          
          // 最后一次尝试失败，设置错误状态但不阻止应用运行
          console.warn('[useAuth] 所有重试都失败，将以未登录状态运行')
          setError(error.message)
          setSession(null)
          setUser(null)
          setCurrentUser(null)
        } else {
          console.log('✅ [useAuth] 会话获取成功:', session?.user?.email || '未登录')
          setSession(session)
          setUser(session?.user ?? null)
          setError(null) // 清除之前的错误
          
          if (session?.user) {
            // 检查store中是否已有用户数据，避免重复同步
            const { currentUser } = useAppStore.getState()
            if (!currentUser || currentUser.id !== session.user.id) {
              await syncUserProfile(session.user)
            } else {
              console.log('✅ [useAuth] 用户数据已存在，跳过用户资料同步')
              // 即使用户资料已存在，也要尝试同步云端数据（带重试机制）
              await syncCloudDataWithRetry(session.user)
            }
          } else {
            // 确保清除用户状态
            setCurrentUser(null)
          }
        }
      } catch (err) {
        if (!isComponentMounted) return
        
        console.error('[useAuth] Error in getInitialSession:', err)
        
        // 如果还有重试次数，则重试
        if (attempt < maxRetries) {
          console.log(`⏳ [useAuth] ${retryDelay * attempt}ms 后重试...`)
          setTimeout(() => getInitialSession(attempt + 1), retryDelay * attempt)
          return
        }
        
        // 最后一次尝试失败
        console.warn('[useAuth] 所有重试都失败，将以未登录状态运行')
        setError('Failed to get session')
        setSession(null)
        setUser(null)
        setCurrentUser(null)
      } finally {
        // 确保在所有情况下都设置 loading 为 false
        if (isComponentMounted && (attempt >= maxRetries || !error)) {
          setLoading(false)
        }
      }
    }

    // 延迟执行，确保组件完全挂载
    const initTimer = setTimeout(() => {
      if (isComponentMounted) {
        getInitialSession()
      }
    }, 100)

    // 清理函数
    return () => {
      isComponentMounted = false
      clearTimeout(initTimer)
      stopAuthConsistencyCheck()
    }
    // 监听认证状态变化（改进的处理逻辑）
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!isComponentMounted) return
        
        const currentUserId = session?.user?.id || null
        const now = Date.now()
        
        // 减少重复日志输出：如果是相同的事件和用户，且时间间隔小于2秒，则跳过日志
        const shouldLog = !lastAuthEventRef.current || 
          lastAuthEventRef.current.event !== event ||
          lastAuthEventRef.current.userId !== currentUserId ||
          (now - lastAuthEventRef.current.timestamp) > 2000
        
        if (shouldLog) {
          console.log('🔄 [useAuth] 认证状态变化:', event, session?.user?.email || '未登录')
          lastAuthEventRef.current = { event, userId: currentUserId, timestamp: now }
        }
        
        // 更新认证状态
        setSession(session)
        setUser(session?.user ?? null)
        setError(null) // 清除之前的错误
        
        // 对于TOKEN_REFRESHED事件，不需要重新同步用户数据
        if (event === 'TOKEN_REFRESHED' && session?.user) {
          console.log('🔄 [useAuth] Token已刷新，保持现有用户状态')
          setLoading(false)
          return
        }
        
        if (session?.user) {
          // 检查store中是否已有用户数据，避免重复同步
          const { currentUser } = useAppStore.getState()
          const shouldSync = !currentUser || 
                           currentUser.id !== session.user.id || 
                           event === 'SIGNED_IN' ||
                           event === 'INITIAL_SESSION'
          
          if (shouldSync) {
            try {
              await syncUserProfile(session.user)
            } catch (error) {
              console.error('[useAuth] 用户资料同步失败:', error)
              // 即使同步失败，也要设置基本用户信息
              setCurrentUser({
                id: session.user.id,
                name: session.user.user_metadata?.display_name || session.user.email?.split('@')[0] || 'User',
                email: session.user.email || '',
                avatar: session.user.user_metadata?.avatar_url || '',
                preferences: {}
              })
            }
          } else {
            console.log('✅ [useAuth] 用户数据已存在，跳过用户资料同步')
            // 即使用户资料已存在，也要尝试同步云端数据（带重试机制）
            await syncCloudDataWithRetry(session.user)
          }
          
          // 用户登录成功后启动认证状态一致性检查
          if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
            startAuthConsistencyCheck()
          }
        } else {
          // 用户登出，清除所有状态
          console.log('🔄 [useAuth] 用户已登出，清除状态')
          setCurrentUser(null)
          stopAuthConsistencyCheck()
        }
        
        setLoading(false)
      }
    )

    return () => {
        console.log('🧹 [useAuth] Hook 清理')
        isComponentMounted = false
        subscription.unsubscribe()
        stopAuthConsistencyCheck()
        // 清理防抖定时器
        if (syncTimeoutRef.current) {
          clearTimeout(syncTimeoutRef.current)
        }
      }
  }, []) // 空依赖数组，确保只在组件挂载时执行一次

  // 同步用户资料到本地状态（改进的错误处理和重试机制）
  const syncUserProfile = useCallback(async (user: User) => {
    // 防抖：如果短时间内多次调用，取消之前的调用
    if (syncTimeoutRef.current) {
      clearTimeout(syncTimeoutRef.current)
    }
    
    syncTimeoutRef.current = setTimeout(async () => {
      if (!isComponentMounted) return
      
      const maxRetries = 5
      let retryCount = 0
      
      while (retryCount < maxRetries) {
        try {
          console.log(`🔄 [useAuth] 同步用户资料 (尝试 ${retryCount + 1}/${maxRetries}):`, user.email)
          
          // 检查数据库连接状态
          const { data: healthCheck } = await supabase
            .from('user_profiles')
            .select('count')
            .limit(1)
            .single()
          
          // 首先尝试获取现有的用户资料
          const { data: existingProfile, error: fetchError } = await supabase
            .from('user_profiles')
            .select('*')
            .eq('user_id', user.id)
            .single()
          
          if (fetchError && fetchError.code !== 'PGRST116') {
            throw fetchError
          }
          
          let userProfile
          
          if (!existingProfile) {
            // 如果用户资料不存在，创建新的
            console.log('📝 [useAuth] 创建新用户资料')
            const newProfile = {
              user_id: user.id,
              display_name: user.user_metadata?.display_name || user.email?.split('@')[0] || 'User',
              avatar: user.user_metadata?.avatar_url || '',
              preferences: {}
            }
            
            const { data: createdProfile, error: createError } = await supabase
              .from('user_profiles')
              .insert([newProfile])
              .select()
              .single()
            
            if (createError) throw createError
            userProfile = createdProfile
          } else {
            // 如果用户资料已存在，更新必要的字段
            console.log('🔄 [useAuth] 更新现有用户资料')
            const updatedProfile = {
              display_name: user.user_metadata?.display_name || existingProfile.display_name,
              avatar: user.user_metadata?.avatar_url || existingProfile.avatar,
              updated_at: new Date().toISOString()
            }
            
            const { data: updated, error: updateError } = await supabase
              .from('user_profiles')
              .update(updatedProfile)
              .eq('user_id', user.id)
              .select()
              .single()
            
            if (updateError) throw updateError
            userProfile = updated
          }
          
          // 更新本地状态
          if (isComponentMounted) {
            setCurrentUser({
              id: userProfile.id || userProfile.user_id,
              name: userProfile.display_name || userProfile.name,
              avatar: userProfile.avatar,
              preferences: userProfile.preferences || {}
            })
            console.log('✅ [useAuth] 用户资料同步成功:', userProfile.display_name || userProfile.name)
            
            // 同步云端数据到本地（带重试机制）
            await syncCloudDataWithRetry(user)
          }
          return // 成功后退出重试循环
          
        } catch (error: any) {
          retryCount++
          console.error(`❌ [useAuth] 用户资料同步失败 (尝试 ${retryCount}/${maxRetries}):`, error.message)
          
          // 判断是否为可重试的错误
          const isRetryableError = 
            error.message?.includes('fetch') || 
            error.message?.includes('network') ||
            error.message?.includes('timeout') ||
            error.message?.includes('connection') ||
            error.code === 'PGRST301' || // PostgreSQL connection error
            error.code === 'PGRST204' || // No rows returned (temporary)
            error.code === 'PGRST000' || // Generic database error
            error.status === 503 ||      // Service unavailable
            error.status === 502 ||      // Bad gateway
            error.status === 504         // Gateway timeout
          
          if (retryCount < maxRetries && isRetryableError) {
            const delay = Math.min(1000 * Math.pow(2, retryCount - 1), 8000) // 指数退避，最大8秒
            console.log(`⏳ [useAuth] ${delay}ms 后重试...`)
            await new Promise(resolve => setTimeout(resolve, delay))
          } else {
            // 所有重试都失败了，使用基本用户信息作为后备
            console.warn('⚠️ [useAuth] 用户资料同步失败，使用基本信息')
            if (isComponentMounted) {
              setCurrentUser({
              id: user.id,
              name: user.user_metadata?.display_name || user.email?.split('@')[0] || 'User',
              avatar: user.user_metadata?.avatar_url || '',
              preferences: {}
            })
            }
            
            // 如果是权限错误，设置特定的错误状态
            if (error.message?.includes('permission') || error.code === 'PGRST301') {
              console.error('🚫 [useAuth] 数据库权限错误，可能需要检查RLS策略')
              setError('数据库访问权限错误，请联系管理员')
            }
            break
          }
        }
      }
    }, 300) // 300ms 防抖延迟
  }, [])

  const signUp = async (email: string, password: string, displayName?: string) => {
    setLoading(true)
    setError(null)
    
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            display_name: displayName || email.split('@')[0]
          }
        }
      })
      
      if (error) {
        setError(error.message)
      }
      
      return { error }
    } catch (err) {
      const errorMessage = 'An unexpected error occurred'
      setError(errorMessage)
      return { error: { message: errorMessage } as AuthError }
    } finally {
      setLoading(false)
    }
  }

  const signIn = async (email: string, password: string) => {
    setLoading(true)
    setError(null)
    
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password
      })
      
      if (error) {
        setError(error.message)
      }
      
      return { error }
    } catch (err) {
      const errorMessage = 'An unexpected error occurred'
      setError(errorMessage)
      return { error: { message: errorMessage } as AuthError }
    } finally {
      setLoading(false)
    }
  }

  const signOut = async () => {
    setLoading(true)
    setError(null)
    
    try {
      const { error } = await supabase.auth.signOut()
      
      if (error) {
        setError(error.message)
      } else {
        setCurrentUser(null)
      }
      
      return { error }
    } catch (err) {
      const errorMessage = 'An unexpected error occurred'
      setError(errorMessage)
      return { error: { message: errorMessage } as AuthError }
    } finally {
      setLoading(false)
    }
  }

  const resetPassword = async (email: string) => {
    setError(null)
    
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`
      })
      
      if (error) {
        setError(error.message)
      }
      
      return { error }
    } catch (err) {
      const errorMessage = 'An unexpected error occurred'
      setError(errorMessage)
      return { error: { message: errorMessage } as AuthError }
    }
  }

  const updateProfile = async (updates: { display_name?: string; avatar_url?: string }) => {
    if (!user) {
      const error = { message: 'No user logged in' }
      setError(error.message)
      return { error }
    }

    setError(null)
    
    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', user.id)
      
      if (error) {
        setError(error.message)
        return { error }
      }

      // 重新同步用户资料
      await syncUserProfile(user)
      
      return { error: null }
    } catch (err) {
      const errorMessage = 'An unexpected error occurred'
      setError(errorMessage)
      return { error: { message: errorMessage } }
    }
  }

  const clearError = () => {
    setError(null)
  }

  return {
    user,
    session,
    loading,
    error,
    signUp,
    signIn,
    signOut,
    resetPassword,
    updateProfile,
    clearError
  }
}