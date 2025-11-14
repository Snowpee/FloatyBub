import { useState, useEffect, useCallback } from 'react'
import { dataSyncService, type SyncStatus, type SyncResult } from '../services/DataSyncService'
import { supabase } from '../lib/supabase'

export interface DataSyncHookReturn {
  status: SyncStatus
  lastSyncTime: number | null
  isOnline: boolean
  queueSync: (type: 'llm_config' | 'ai_role' | 'global_prompt' | 'voice_settings' | 'general_settings', data: any) => Promise<void>
  manualSync: () => Promise<SyncResult>
  pullFromCloud: (userParam?: any) => Promise<any>
  clearQueue: () => void
}

/**
 * 数据同步Hook
 * 提供数据同步相关的状态和操作方法
 */
export function useDataSync(): DataSyncHookReturn {
  const [status, setStatus] = useState<SyncStatus>(dataSyncService.getStatus())
  const [lastSyncTime, setLastSyncTime] = useState<number | null>(dataSyncService.getLastSyncTime())
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [user, setUser] = useState<any>(null)

  // 获取当前用户
  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
    }
    getUser()

    // 监听认证状态变化
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user || null)
    })

    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    // 监听同步状态变化
    const unsubscribe = dataSyncService.onStatusChange((newStatus) => {
      setStatus(newStatus)
      setLastSyncTime(dataSyncService.getLastSyncTime())
    })

    // 监听网络状态变化
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)
    
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      unsubscribe()
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  // 添加到同步队列
  const queueSync = useCallback(async (
    type: 'llm_config' | 'ai_role' | 'global_prompt' | 'voice_settings' | 'general_settings', 
    data: any
  ) => {
    if (!user) {

      return
    }

    try {
      await dataSyncService.queueSync(type, data)
    } catch (error) {

      throw error
    }
  }, [user])

  // 手动同步
  const manualSync = useCallback(async (): Promise<SyncResult> => {
    if (!user) {
      throw new Error('用户未登录')
    }

    if (!isOnline) {
      throw new Error('网络未连接')
    }

    try {
      return await dataSyncService.manualSync()
    } catch (error) {

      throw error
    }
  }, [user, isOnline])

  // 从云端拉取数据
  const pullFromCloud = useCallback(async (userParam?: any) => {
    const currentUser = userParam || user
    if (!currentUser) {
      throw new Error('用户未登录')
    }

    if (!isOnline) {
      throw new Error('网络未连接')
    }

    try {
      const cloudData = await dataSyncService.pullFromCloud(currentUser)

      
      // 这里可以触发store更新，将云端数据合并到本地
      // 具体实现需要根据store的结构来定制
      
      return cloudData
    } catch (error) {

      throw error
    }
  }, [user, isOnline])

  // 清空同步队列
  const clearQueue = useCallback(() => {
    dataSyncService.clearQueue()
  }, [])

  return {
    status,
    lastSyncTime,
    isOnline,
    queueSync,
    manualSync,
    pullFromCloud,
    clearQueue
  }
}

/**
 * 自动同步Hook
 * 在数据变化时自动触发同步
 */
export function useAutoSync() {
  const { queueSync } = useDataSync()
  const [user, setUser] = useState<any>(null)

  // 获取当前用户
  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setUser(user)
    }
    getUser()

    // 监听认证状态变化
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user || null)
    })

    return () => subscription.unsubscribe()
  }, [])

  // 同步LLM配置
  const syncLLMConfig = useCallback(async (config: any) => {
    if (!user) return
    await queueSync('llm_config', config)
  }, [queueSync, user])

  // 同步AI角色
  const syncAIRole = useCallback(async (role: any) => {
    if (!user) return
    await queueSync('ai_role', role)
  }, [queueSync, user])

  // 同步全局提示词
  const syncGlobalPrompt = useCallback(async (prompt: any) => {
    if (!user) return
    await queueSync('global_prompt', prompt)
  }, [queueSync, user])

  // 同步语音设置
  const syncVoiceSettings = useCallback(async (settings: any) => {
    if (!user) return
    await queueSync('voice_settings', settings)
  }, [queueSync, user])

  return {
    syncLLMConfig,
    syncAIRole,
    syncGlobalPrompt,
    syncVoiceSettings
  }
}