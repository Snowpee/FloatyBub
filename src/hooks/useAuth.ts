import { useState, useEffect, useRef, useCallback } from 'react'
import { User, Session, AuthError } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { useAppStore } from '../store'

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
  
  const { setCurrentUser } = useAppStore()
  const syncTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const lastSyncUserIdRef = useRef<string | null>(null)
  const lastAuthEventRef = useRef<{ event: string; userId: string | null; timestamp: number } | null>(null)

  useEffect(() => {
    console.log('🔄 [useAuth] Hook 初始化')
    let retryCount = 0
    const maxRetries = 3
    const retryDelay = 1000 // 1秒

    // 获取初始会话（带重试机制）
    const getInitialSession = async (attempt = 1) => {
      try {
        console.log(`🔄 [useAuth] 尝试获取会话 (${attempt}/${maxRetries})...`)
        const { data: { session }, error } = await supabase.auth.getSession()
        
        if (error) {
          console.error('[useAuth] Error getting session:', error)
          
          // 如果是网络错误且还有重试次数，则重试
          if (attempt < maxRetries && (error.message.includes('fetch') || error.message.includes('network'))) {
            console.log(`⏳ [useAuth] ${retryDelay}ms 后重试...`)
            setTimeout(() => getInitialSession(attempt + 1), retryDelay)
            return
          }
          
          setError(error.message)
        } else {
          console.log('✅ [useAuth] 会话获取成功:', session?.user?.email || '未登录')
          setSession(session)
          setUser(session?.user ?? null)
          
          if (session?.user) {
            // 检查store中是否已有用户数据，避免重复同步
            const { currentUser } = useAppStore.getState()
            if (!currentUser || currentUser.id !== session.user.id) {
              await syncUserProfile(session.user)
            } else {
              console.log('✅ [useAuth] 用户数据已存在，跳过同步')
            }
          } else {
            // 确保清除用户状态
            setCurrentUser(null)
          }
        }
      } catch (err) {
        console.error('[useAuth] Error in getInitialSession:', err)
        
        // 如果是网络错误且还有重试次数，则重试
        if (attempt < maxRetries) {
          console.log(`⏳ [useAuth] ${retryDelay}ms 后重试...`)
          setTimeout(() => getInitialSession(attempt + 1), retryDelay)
          return
        }
        
        setError('Failed to get session')
      } finally {
        // 只有在最后一次尝试时才设置 loading 为 false
        if (attempt >= maxRetries || retryCount === 0) {
          setLoading(false)
        }
      }
    }

    getInitialSession()

    // 监听认证状态变化（优化日志输出）
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
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
        
        setSession(session)
        setUser(session?.user ?? null)
        setLoading(false)
        setError(null) // 清除之前的错误
        
        if (session?.user) {
          // 检查store中是否已有用户数据，避免重复同步
          const { currentUser } = useAppStore.getState()
          if (!currentUser || currentUser.id !== session.user.id || event === 'SIGNED_IN') {
            await syncUserProfile(session.user)
          } else {
            console.log('✅ [useAuth] 用户数据已存在，跳过同步')
          }
        } else {
          setCurrentUser(null)
        }
      }
    )

    return () => {
        console.log('🧹 [useAuth] Hook 清理')
        subscription.unsubscribe()
        // 清理防抖定时器
        if (syncTimeoutRef.current) {
          clearTimeout(syncTimeoutRef.current)
        }
      }
    }, []) // 空依赖数组，确保只在组件挂载时执行一次

  // 同步用户资料到本地状态（带重试机制和防抖）
  const syncUserProfile = useCallback(async (user: User, attempt = 1) => {
    // 防抖机制：如果是同一个用户且在短时间内多次调用，则取消之前的调用
    if (syncTimeoutRef.current) {
      clearTimeout(syncTimeoutRef.current)
    }
    
    // 如果是同一个用户，延迟执行以避免重复调用
    if (lastSyncUserIdRef.current === user.id && attempt === 1) {
      syncTimeoutRef.current = setTimeout(() => {
        syncUserProfile(user, attempt)
      }, 300) // 300ms 防抖延迟
      return
    }
    
    lastSyncUserIdRef.current = user.id
    const maxRetries = 3
    const retryDelay = 1000
    
    try {
      // 减少重复日志输出：只在第一次尝试或重试时输出日志
      if (attempt === 1 || attempt > 1) {
        const shouldLog = Math.random() < 0.3 // 30%的概率输出日志
        if (shouldLog) {
          console.log(`🔄 同步用户资料 (${attempt}/${maxRetries})...`, user.email)
        }
      }
      
      // 查询用户资料
      const { data: profile, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('user_id', user.id)
        .single()

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        console.error('Error fetching user profile:', error)
        
        // 如果是网络错误且还有重试次数，则重试
        if (attempt < maxRetries && (error.message.includes('fetch') || error.message.includes('network'))) {
          console.log(`⏳ ${retryDelay}ms 后重试同步用户资料...`)
          setTimeout(() => syncUserProfile(user, attempt + 1), retryDelay)
          return
        }
        
        // 如果查询失败，使用基本用户信息作为后备
        console.log('📝 使用基本用户信息作为后备')
        setCurrentUser({
          id: user.id,
          name: user.user_metadata?.display_name || user.email?.split('@')[0] || 'User',
          email: user.email || '',
          avatar: user.user_metadata?.avatar_url || '',
          preferences: {}
        })
        return
      }

      // 如果没有用户资料，创建一个
      if (!profile) {
        console.log('📝 创建新用户资料...')
        const { error: insertError } = await supabase
          .from('user_profiles')
          .insert({
            user_id: user.id,
            display_name: user.user_metadata?.display_name || user.email?.split('@')[0] || 'User',
            avatar_url: user.user_metadata?.avatar_url || null,
            preferences: {}
          })

        if (insertError) {
          console.error('Error creating user profile:', insertError)
          
          // 如果创建失败，使用基本用户信息作为后备
          console.log('📝 创建失败，使用基本用户信息作为后备')
          setCurrentUser({
            id: user.id,
            name: user.user_metadata?.display_name || user.email?.split('@')[0] || 'User',
            email: user.email || '',
            avatar: user.user_metadata?.avatar_url || '',
            preferences: {}
          })
          return
        }

        // 重新获取创建的资料
        const { data: newProfile } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('user_id', user.id)
          .single()

        if (newProfile) {
          console.log('✅ 用户资料创建并同步成功')
          setCurrentUser({
            id: newProfile.id,
            name: newProfile.display_name || 'User',
            email: user.email || '',
            avatar: newProfile.avatar_url || '',
            preferences: newProfile.preferences || {}
          })
        } else {
          // 如果重新获取失败，使用基本信息
          console.log('📝 重新获取失败，使用基本用户信息')
          setCurrentUser({
            id: user.id,
            name: user.user_metadata?.display_name || user.email?.split('@')[0] || 'User',
            email: user.email || '',
            avatar: user.user_metadata?.avatar_url || '',
            preferences: {}
          })
        }
      } else {
        console.log('✅ 用户资料同步成功')
        setCurrentUser({
          id: profile.id,
          name: profile.display_name || 'User',
          email: user.email || '',
          avatar: profile.avatar_url || '',
          preferences: profile.preferences || {}
        })
      }
    } catch (err) {
      console.error('Error syncing user profile:', err)
      
      // 如果是网络错误且还有重试次数，则重试
      if (attempt < maxRetries && (err instanceof Error && (err.message.includes('fetch') || err.message.includes('network')))) {
        console.log(`⏳ ${retryDelay}ms 后重试同步用户资料...`)
        setTimeout(() => syncUserProfile(user, attempt + 1), retryDelay)
        return
      }
      
      // 如果所有重试都失败，使用基本用户信息作为后备
      console.log('📝 同步失败，使用基本用户信息作为后备')
      setCurrentUser({
        id: user.id,
        name: user.user_metadata?.display_name || user.email?.split('@')[0] || 'User',
        email: user.email || '',
        avatar: user.user_metadata?.avatar_url || '',
        preferences: {}
      })
    }
  }, [setCurrentUser]) // useCallback 依赖项

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