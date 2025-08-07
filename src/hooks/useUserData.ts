import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAppStore } from '../store'
import { quickConnectionCheck } from '../utils/databaseConnectionTest'
import { useAuth } from './useAuth'
import { SupabaseDebugger } from '../utils/supabaseDebug'
import { dataSyncService } from '../services/DataSyncService'
import type { ChatSession, ChatMessage } from '../store'
import type { SyncStatus, SyncResult } from '../services/DataSyncService'

// UUID 相关工具函数
const generateId = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

const isValidUUID = (id: string): boolean => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
};

const convertToUUID = (oldId: string): string => {
  if (isValidUUID(oldId)) {
    return oldId;
  }
  return generateId();
};

export interface UserDataState {
  syncing: boolean
  lastSyncTime: Date | null
  syncError: string | null
  dataSyncStatus: SyncStatus
  dataSyncLastTime: number | null
  syncProgress: { percent: number; message: string }
}

export interface UserDataActions {
  syncToCloud: () => Promise<void>
  syncFromCloud: () => Promise<void>
  enableAutoSync: () => void
  disableAutoSync: () => void
  clearSyncError: () => void
  queueDataSync: (type: 'llm_config' | 'ai_role' | 'global_prompt' | 'voice_settings', data: any) => Promise<void>
  manualDataSync: () => Promise<SyncResult>
}

export function useUserData(): UserDataState & UserDataActions {
  const { user } = useAuth()
  const { 
    chatSessions,
    migrateIdsToUUID
  } = useAppStore()
  
  const [syncing, setSyncing] = useState(false)
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null)
  const [syncError, setSyncError] = useState<string | null>(null)
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(true)
  const [dataSyncStatus, setDataSyncStatus] = useState<SyncStatus>('idle')
  const [dataSyncLastTime, setDataSyncLastTime] = useState<number | null>(null)
  const [syncQueue, setSyncQueue] = useState<Set<string>>(new Set())
  const [syncProgress, setSyncProgress] = useState({ percent: 0, message: '' })

  // 自动同步间隔（5分钟）
  const AUTO_SYNC_INTERVAL = 5 * 60 * 1000
  
  // 应用启动时执行 ID 迁移
  useEffect(() => {
    const performInitialMigration = () => {
      try {
        const migrationPerformed = migrateIdsToUUID()
        if (migrationPerformed) {

        }
      } catch (error) {

      }
    }
    
    performInitialMigration()
  }, [migrateIdsToUUID])

  // 监听DataSyncService状态变化
  useEffect(() => {
    const unsubscribe = dataSyncService.onStatusChange((status) => {
      setDataSyncStatus(status)
      setDataSyncLastTime(dataSyncService.getLastSyncTime())
    })

    // 初始化状态
    setDataSyncStatus(dataSyncService.getStatus())
    setDataSyncLastTime(dataSyncService.getLastSyncTime())

    return unsubscribe
  }, [])

  // 同步到云端
  const syncToCloud = useCallback(async (retryCount = 0) => {
    if (!user || syncing) return
    
    // 生成同步标识符
    const syncId = `${user.id}-${Date.now()}`
    
    // 检查是否已在队列中
    if (syncQueue.has(user.id)) {
      
      return
    }
    
    // 添加到同步队列
    setSyncQueue(prev => new Set(prev).add(user.id))
    setSyncing(true)
    setSyncError(null)

    try {
      // 同步前检查数据库连通性

      const isConnected = await quickConnectionCheck()
      
      if (!isConnected) {
        throw new Error('数据库连接不可用，请检查网络连接或稍后重试')
      }
      


      // 首先执行 ID 迁移
      const migrationPerformed = migrateIdsToUUID()
      if (migrationPerformed) {

      }
      
      // 获取最新的会话数据（迁移后的）
      const currentSessions = useAppStore.getState().chatSessions
      
      // 检查并转换 ID 格式（使用迁移后的数据）
       const sessionsToUpdate: ChatSession[] = []
       const updatedSessions = currentSessions.map(session => {
        const originalSessionId = session.id
        const newSessionId = convertToUUID(session.id)
        const sessionNeedsUpdate = originalSessionId !== newSessionId
        
        const updatedMessages = session.messages.map(message => {
          const originalMessageId = message.id
          const newMessageId = convertToUUID(message.id)
          const messageNeedsUpdate = originalMessageId !== newMessageId
          
          if (messageNeedsUpdate) {

          }
          
          return messageNeedsUpdate ? { ...message, id: newMessageId } : message
        })
        
        const updatedSession = {
          ...session,
          id: newSessionId,
          messages: updatedMessages
        }
        
        if (sessionNeedsUpdate || updatedMessages.some((msg, index) => msg.id !== session.messages[index]?.id)) {
          sessionsToUpdate.push(updatedSession)
          if (sessionNeedsUpdate) {

          }
        }
        
        return updatedSession
      })
      
      // 如果有 ID 需要更新，先更新本地存储
      if (sessionsToUpdate.length > 0) {

        useAppStore.setState({ chatSessions: updatedSessions })
      }
      
      // 批量同步聊天会话到云端
      // 批量同步聊天会话到云端
      setSyncProgress({ percent: 10, message: '准备同步数据...' })
      
      // 检查网络状态
      if (!navigator.onLine) {
        throw new Error('网络连接不可用，请检查网络设置')
      }
      
      setSyncProgress({ percent: 20, message: '检查网络连接...' })
      
      // 批量准备会话数据
      const sessionsData = updatedSessions.map(session => ({
        id: session.id,
        user_id: user.id,
        title: session.title,
        metadata: {
          roleId: session.roleId,
          modelId: session.modelId,
          createdAt: session.createdAt,
          updatedAt: session.updatedAt
        },
        updated_at: new Date().toISOString()
      }))
      
      // 分批处理会话（每批最多50个）
      const BATCH_SIZE = 50
      const totalBatches = Math.ceil(sessionsData.length / BATCH_SIZE)
      setSyncProgress({ percent: 30, message: `同步会话 (0/${totalBatches} 批次)...` })
      
      for (let i = 0; i < sessionsData.length; i += BATCH_SIZE) {
        const batch = sessionsData.slice(i, i + BATCH_SIZE)
        const batchIndex = Math.floor(i/BATCH_SIZE) + 1
        
        const sessionPromise = supabase
          .from('chat_sessions')
          .upsert(batch, { onConflict: 'id' })
        
        const sessionTimeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error(`会话批量同步超时 (批次 ${Math.floor(i/BATCH_SIZE) + 1})`)), 45000) // 45秒超时
        })
        
        const { error: sessionError } = await Promise.race([
          sessionPromise,
          sessionTimeoutPromise
        ]) as any

        if (sessionError) {

          throw new Error(`Failed to batch sync sessions: ${sessionError.message}`)
        }
        
        // 更新进度
        const sessionProgress = 30 + Math.floor((batchIndex / totalBatches) * 20)
        setSyncProgress({ 
          percent: sessionProgress, 
          message: `同步会话 (${batchIndex}/${totalBatches} 批次)...` 
        })
      }

      // 批量同步所有消息
      setSyncProgress({ percent: 50, message: '准备同步消息...' })
      const allMessages = updatedSessions.flatMap(session => 
        session.messages.map(message => ({
          id: message.id,
          session_id: session.id,
          role: message.role,
          content: message.content,
          reasoning_content: message.reasoningContent || null,
          metadata: {
            timestamp: message.timestamp,
            roleId: message.roleId,
            userProfileId: message.userProfileId
          },
          created_at: new Date(message.timestamp).toISOString()
        }))
      )
      
      // 分批处理消息（每批最多100个）
      const MESSAGE_BATCH_SIZE = 100
      const totalMessageBatches = Math.ceil(allMessages.length / MESSAGE_BATCH_SIZE)
      setSyncProgress({ percent: 60, message: `同步消息 (0/${totalMessageBatches} 批次)...` })
      
      for (let i = 0; i < allMessages.length; i += MESSAGE_BATCH_SIZE) {
        const batch = allMessages.slice(i, i + MESSAGE_BATCH_SIZE)
        const messageBatchIndex = Math.floor(i/MESSAGE_BATCH_SIZE) + 1
        
        const messagePromise = supabase
          .from('messages')
          .upsert(batch, { onConflict: 'id' })
        
        const messageTimeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error(`消息批量同步超时 (批次 ${Math.floor(i/MESSAGE_BATCH_SIZE) + 1})`)), 30000) // 30秒超时
        })
        
        const { error: messageError } = await Promise.race([
          messagePromise,
          messageTimeoutPromise
        ]) as any

        if (messageError) {

          throw new Error(`Failed to batch sync messages: ${messageError.message}`)
        }
        
        // 更新进度
         const messageProgress = 60 + Math.floor((messageBatchIndex / totalMessageBatches) * 30)
         setSyncProgress({ 
           percent: messageProgress, 
           message: `同步消息 (${messageBatchIndex}/${totalMessageBatches} 批次)...` 
         })
      }

      setLastSyncTime(new Date())
      setSyncProgress({ percent: 100, message: '同步完成' })
      
      // 2秒后重置进度
      setTimeout(() => {
        setSyncProgress({ percent: 0, message: '' })
      }, 2000)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to sync to cloud'
      setSyncError(errorMessage)
      setSyncProgress({ percent: 0, message: '同步失败' })
      console.error('❌ 同步到云端失败:', error)
      
      // 智能重试逻辑
      const shouldRetry = (
        retryCount < 3 && 
        navigator.onLine && 
        !errorMessage.includes('not authenticated') && 
        !errorMessage.includes('JWT') &&
        !errorMessage.includes('permission denied') &&
        (errorMessage.includes('timeout') || errorMessage.includes('network') || errorMessage.includes('fetch'))
      )
      
      if (shouldRetry) {
        const delay = Math.min(2000 * Math.pow(2, retryCount), 15000) // 2秒起步，最大延迟15秒

        setTimeout(() => {
          syncToCloud(retryCount + 1)
        }, delay)
      } else {
        if (retryCount >= 3) {

        } else if (!navigator.onLine) {

        } else {

        }
      }
    } finally {
      // 从同步队列中移除
      setSyncQueue(prev => {
        const newQueue = new Set(prev)
        newQueue.delete(user.id)
        return newQueue
      })
      setSyncing(false)
    }
  }, [user, syncing, migrateIdsToUUID])

  // 从云端同步（带重试机制）
  const syncFromCloud = useCallback(async (attempt = 1) => {
    const maxRetries = 3
    const retryDelay = 2000 // 2秒
    
    if (!user || syncing) return

    setSyncing(true)
    if (attempt === 1) {
      setSyncError(null) // 只在第一次尝试时清除错误
    }

    try {
      // 同步前检查数据库连通性
      if (attempt === 1) {

        const isConnected = await quickConnectionCheck()
        
        if (!isConnected) {
          throw new Error('数据库连接不可用，请检查网络连接或稍后重试')
        }
        

      }
      

      
      // 检查网络连接和认证状态（添加超时机制）
      const authPromise = supabase.auth.getSession()
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('认证状态检查超时')), 15000) // 15秒超时
      })
      
      const { data: { session } } = await Promise.race([
        authPromise,
        timeoutPromise
      ]) as any
      
      if (!session) {
        console.warn('No active session found, user may need to re-authenticate')
        throw new Error('User not authenticated')
      }

      // 获取用户的聊天会话（添加超时机制）
      const sessionsPromise = supabase
        .from('chat_sessions')
        .select('*')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false })
      
      const sessionsTimeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('获取会话数据超时')), 25000) // 25秒超时
      })
      
      const { data: sessions, error: sessionsError } = await Promise.race([
        sessionsPromise,
        sessionsTimeoutPromise
      ]) as any

      if (sessionsError) {

        
        // 运行诊断
        const debugResult = await SupabaseDebugger.testConnection()
        
        // 测试具体查询
        const queryResult = await SupabaseDebugger.testSpecificQuery(user.id)
        
        throw new Error(`Failed to fetch sessions: ${sessionsError.message} (Code: ${sessionsError.code})`)
      }

      const cloudSessions: ChatSession[] = []

      for (const session of sessions || []) {
        // 获取会话的消息
        const { data: messages, error: messagesError } = await supabase
          .from('messages')
          .select('*')
          .eq('session_id', session.id)
          .order('created_at', { ascending: true })

        if (messagesError) {
          throw new Error(`Failed to fetch messages for session ${session.id}: ${messagesError.message}`)
        }

        const sessionMessages: ChatMessage[] = (messages || []).map(msg => ({
          id: msg.id,
          role: msg.role as 'user' | 'assistant',
          content: msg.content,
          reasoningContent: msg.reasoning_content || undefined,
          timestamp: new Date(msg.metadata?.timestamp || msg.created_at),
          roleId: msg.metadata?.roleId,
          userProfileId: msg.metadata?.userProfileId
        }))

        cloudSessions.push({
          id: session.id,
          title: session.title,
          messages: sessionMessages,
          roleId: session.metadata?.roleId || 'default-assistant',
          modelId: session.metadata?.modelId || 'gpt-3.5-turbo',
          createdAt: new Date(session.metadata?.createdAt || session.created_at),
          updatedAt: new Date(session.metadata?.updatedAt || session.updated_at)
        })
      }

      // 安全的时间比较函数
      const safeGetTime = (dateValue: any): number => {
        if (!dateValue) return 0
        if (dateValue instanceof Date) return dateValue.getTime()
        if (typeof dateValue === 'string') return new Date(dateValue).getTime()
        if (typeof dateValue === 'number') return dateValue
        return 0
      }

      // 合并本地和云端数据（云端数据优先）
      const mergedSessions = new Map<string, ChatSession>()
      
      // 先添加本地会话
      chatSessions.forEach(session => {
        mergedSessions.set(session.id, session)
      })
      
      // 用云端会话覆盖（如果云端更新时间更晚）
      cloudSessions.forEach(cloudSession => {
        const localSession = mergedSessions.get(cloudSession.id)
        if (!localSession || safeGetTime(cloudSession.updatedAt) > safeGetTime(localSession.updatedAt)) {
          mergedSessions.set(cloudSession.id, cloudSession)
        }
      })

      const finalSessions = Array.from(mergedSessions.values())
        .sort((a, b) => safeGetTime(b.updatedAt) - safeGetTime(a.updatedAt))

      useAppStore.setState({ chatSessions: finalSessions })
      setLastSyncTime(new Date())
      

      setSyncing(false)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to sync from cloud'

      
      // 如果是认证错误，不要继续重试
      if (errorMessage.includes('not authenticated') || errorMessage.includes('JWT')) {

        setSyncError('认证已过期，请重新登录')
        setSyncing(false)
        return
      }
      
      // 如果是网络错误且还有重试次数，则重试
      if (attempt < maxRetries && (errorMessage.includes('Failed to fetch') || errorMessage.includes('network') || errorMessage.includes('fetch'))) {

        setTimeout(() => {
          syncFromCloud(attempt + 1)
        }, retryDelay)
        return
      }
      
      // 设置错误信息并停止同步
      setSyncError(errorMessage)
      setSyncing(false)
    }
  }, [user, syncing])

  // 启用自动同步
  const enableAutoSync = useCallback(() => {
    setAutoSyncEnabled(true)
  }, [])

  // 禁用自动同步
  const disableAutoSync = useCallback(() => {
    setAutoSyncEnabled(false)
  }, [])

  // 清除同步错误
  const clearSyncError = useCallback(() => {
    setSyncError(null)
  }, [])

  // 队列数据同步
  const queueDataSync = useCallback(async (type: 'llm_config' | 'ai_role' | 'global_prompt' | 'voice_settings', data: any) => {
    try {
      await dataSyncService.queueSync(type, data)

    } catch (error) {

      throw error
    }
  }, [])

  // 手动数据同步
  const manualDataSync = useCallback(async () => {
    try {
      const result = await dataSyncService.manualSync()

      return result
    } catch (error) {

      throw error
    }
  }, [])

  // 防抖同步引用
  const debouncedSyncFromCloud = useRef<NodeJS.Timeout | null>(null)
  const debouncedSyncToCloud = useRef<NodeJS.Timeout | null>(null)
  const lastSyncFromCloudTime = useRef<number>(0)
  const lastSyncToCloudTime = useRef<number>(0)

  // 防抖的云端同步函数
  const debouncedSyncFromCloudFn = useCallback(() => {
    const now = Date.now()
    const timeSinceLastSync = now - lastSyncFromCloudTime.current
    
    // console.log('🔄 [useUserData] 防抖云端同步检查', { timeSinceLastSync })
    
    // 如果距离上次同步不足10秒，则跳过
    if (timeSinceLastSync < 10000) {

      return
    }
    
    if (debouncedSyncFromCloud.current) {
      clearTimeout(debouncedSyncFromCloud.current)
    }
    
    debouncedSyncFromCloud.current = setTimeout(() => {

      lastSyncFromCloudTime.current = Date.now()
      syncFromCloud()
    }, 1000)
  }, [syncFromCloud])

  // 检查是否有消息正在流式输出
  const hasStreamingMessages = useCallback(() => {
    return chatSessions.some(session => 
      session.messages?.some(message => message.isStreaming === true)
    )
  }, [chatSessions])

  // 防抖的云端上传函数
  const debouncedSyncToCloudFn = useCallback(() => {
    const now = Date.now()
    const timeSinceLastSync = now - lastSyncToCloudTime.current
    
    // console.log('🔄 [useUserData] 防抖云端上传检查', { timeSinceLastSync })
    
    // 如果距离上次同步不足8秒，则跳过
    if (timeSinceLastSync < 8000) {

      return
    }

    // 检查是否有消息正在流式输出
    if (hasStreamingMessages()) {

      return
    }
    
    if (debouncedSyncToCloud.current) {
      clearTimeout(debouncedSyncToCloud.current)
    }
    
    debouncedSyncToCloud.current = setTimeout(() => {
      // 再次检查流式状态，确保延迟执行时仍然安全
      if (hasStreamingMessages()) {

        return
      }

      lastSyncToCloudTime.current = Date.now()
      syncToCloud()
    }, 2000)
  }, [syncToCloud, hasStreamingMessages])

  // 自动同步效果
  useEffect(() => {
    // console.log('🔄 [useUserData] 自动同步效果初始化', { userId: user?.id, autoSyncEnabled })
    
    if (!user?.id || !autoSyncEnabled) {

      return
    }

    // 延迟初始同步，确保认证状态稳定
    const initialSyncTimeout = setTimeout(() => {

      debouncedSyncFromCloudFn()
    }, 2000)

    // 立即执行一次同步到云端（如果有本地数据）
    const currentSessions = useAppStore.getState().chatSessions
    if (currentSessions.length > 0) {

      setTimeout(() => {
        debouncedSyncToCloudFn()
      }, 3000)
    }

    // 设置定时同步
    const interval = setInterval(() => {
      if (autoSyncEnabled && user?.id) {

        debouncedSyncToCloudFn()
      }
    }, AUTO_SYNC_INTERVAL)

    return () => {

      clearTimeout(initialSyncTimeout)
      clearInterval(interval)
      if (debouncedSyncFromCloud.current) {
        clearTimeout(debouncedSyncFromCloud.current)
      }
      if (debouncedSyncToCloud.current) {
        clearTimeout(debouncedSyncToCloud.current)
      }
    }
  }, [user?.id, autoSyncEnabled, debouncedSyncFromCloudFn, debouncedSyncToCloudFn])



  // 用于跟踪上一次的会话状态，检测消息完成
  const prevSessionsRef = useRef<string>('')
  
  // 检测消息是否刚刚完成（从streaming变为非streaming状态）
   const checkMessageCompletion = useCallback(() => {
     const currentSessionsStr = JSON.stringify(chatSessions.map(s => ({
       id: s.id,
       messageCount: s.messages?.length || 0,
       lastMessageIsStreaming: s.messages?.[s.messages.length - 1]?.isStreaming || false
     })))
     
     const hasChanged = prevSessionsRef.current !== currentSessionsStr
     const hasStreamingNow = hasStreamingMessages()
     
     if (hasChanged && !hasStreamingNow && prevSessionsRef.current) {
       // 数据有变化且当前没有流式消息，可能是消息刚完成

       prevSessionsRef.current = currentSessionsStr
       return true
     }
     
     prevSessionsRef.current = currentSessionsStr
     return false
   }, [chatSessions, hasStreamingMessages])

  // 监听数据变化，自动同步到云端
  useEffect(() => {
    // console.log('🔄 [useUserData] 数据变化监听', {
    //   userId: user?.id,
    //   autoSyncEnabled,
    //   syncing,
    //   sessionsCount: sessions.length
    // })
    
    if (!user?.id || !autoSyncEnabled || syncing || chatSessions.length === 0) {

      return
    }

    // 检查是否有消息正在流式输出
    if (hasStreamingMessages()) {

      return
    }

    // 检查是否是消息完成触发的变化
    if (checkMessageCompletion()) {

      debouncedSyncToCloudFn()
    } else {
      // 对于其他变化（如新建会话等），也进行同步但延迟更长

      debouncedSyncToCloudFn()
    }
  }, [user?.id, autoSyncEnabled, chatSessions, debouncedSyncToCloudFn, hasStreamingMessages, checkMessageCompletion])

  return {
    syncing,
    lastSyncTime,
    syncError,
    dataSyncStatus,
    dataSyncLastTime,
    syncProgress,
    syncToCloud,
    syncFromCloud,
    enableAutoSync,
    disableAutoSync,
    clearSyncError,
    queueDataSync,
    manualDataSync
  }
}