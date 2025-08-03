import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAppStore } from '../store'
import { useAuth } from './useAuth'
import { SupabaseDebugger } from '../utils/supabaseDebug'
import type { ChatSession, ChatMessage } from '../store'

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
}

export interface UserDataActions {
  syncToCloud: () => Promise<void>
  syncFromCloud: () => Promise<void>
  enableAutoSync: () => void
  disableAutoSync: () => void
  clearSyncError: () => void
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

  // 自动同步间隔（5分钟）
  const AUTO_SYNC_INTERVAL = 5 * 60 * 1000
  
  // 应用启动时执行 ID 迁移
  useEffect(() => {
    const performInitialMigration = () => {
      try {
        const migrationPerformed = migrateIdsToUUID()
        if (migrationPerformed) {
          console.log('🚀 应用启动时完成 ID 格式迁移')
        }
      } catch (error) {
        console.error('❌ ID 迁移失败:', error)
      }
    }
    
    performInitialMigration()
  }, [migrateIdsToUUID])

  // 同步到云端
  const syncToCloud = useCallback(async () => {
    if (!user || syncing) return

    setSyncing(true)
    setSyncError(null)

    try {
      // 首先执行 ID 迁移
      const migrationPerformed = migrateIdsToUUID()
      if (migrationPerformed) {
        console.log('🔄 ID 迁移已完成，使用最新的会话数据')
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
            console.log(`🔄 转换消息 ID: ${originalMessageId} -> ${newMessageId}`)
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
            console.log(`🔄 转换会话 ID: ${originalSessionId} -> ${newSessionId}`)
          }
        }
        
        return updatedSession
      })
      
      // 如果有 ID 需要更新，先更新本地存储
      if (sessionsToUpdate.length > 0) {
        console.log(`📝 更新 ${sessionsToUpdate.length} 个会话的 ID 格式`)
        useAppStore.setState({ chatSessions: updatedSessions })
      }
      
      // 同步聊天会话到云端（添加超时机制）
      console.log(`📤 开始同步 ${updatedSessions.length} 个会话到云端...`)
      
      for (const session of updatedSessions) {
        console.log(`📤 同步会话: ${session.title} (${session.id})`)
        
        // 添加超时机制的会话同步
        const sessionPromise = supabase
          .from('chat_sessions')
          .upsert({
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
          }, {
            onConflict: 'id'
          })
        
        const sessionTimeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error(`会话 ${session.id} 同步超时`)), 10000) // 10秒超时
        })
        
        const { error: sessionError } = await Promise.race([
          sessionPromise,
          sessionTimeoutPromise
        ]) as any

        if (sessionError) {
          console.error(`❌ 会话同步失败: ${session.id}`, sessionError)
          throw new Error(`Failed to sync session ${session.id}: ${sessionError.message}`)
        }
        
        console.log(`✅ 会话同步成功: ${session.id}`)

        // 同步消息（添加超时机制）
        console.log(`📤 同步 ${session.messages.length} 条消息...`)
        
        for (const message of session.messages) {
          const messagePromise = supabase
            .from('messages')
            .upsert({
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
            }, {
              onConflict: 'id'
            })
          
          const messageTimeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error(`消息 ${message.id} 同步超时`)), 8000) // 8秒超时
          })
          
          const { error: messageError } = await Promise.race([
            messagePromise,
            messageTimeoutPromise
          ]) as any

          if (messageError) {
            console.error(`❌ 消息同步失败: ${message.id}`, messageError)
            throw new Error(`Failed to sync message ${message.id}: ${messageError.message}`)
          }
        }
        
        console.log(`✅ 会话 ${session.id} 的所有消息同步完成`)
      }

      setLastSyncTime(new Date())
      console.log('✅ 数据同步到云端成功')
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to sync to cloud'
      setSyncError(errorMessage)
      console.error('❌ 同步到云端失败:', error)
    } finally {
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
      // 减少重复日志输出
      const shouldLog = attempt === 1 && Math.random() < 0.2 // 只在第一次尝试时有20%概率输出日志
      if (shouldLog) {
        console.log(`🔄 从云端同步数据 (${attempt}/${maxRetries})...`, { userId: user.id })
      }
      
      // 检查网络连接和认证状态（添加超时机制）
      const authPromise = supabase.auth.getSession()
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('认证状态检查超时')), 8000) // 8秒超时
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
        setTimeout(() => reject(new Error('获取会话数据超时')), 10000) // 10秒超时
      })
      
      const { data: sessions, error: sessionsError } = await Promise.race([
        sessionsPromise,
        sessionsTimeoutPromise
      ]) as any

      if (sessionsError) {
        console.error('❌ Supabase sessions error:', {
          error: sessionsError,
          code: sessionsError.code,
          message: sessionsError.message,
          details: sessionsError.details,
          hint: sessionsError.hint
        })
        
        // 运行诊断
        console.log('🔍 运行连接诊断...')
        const debugResult = await SupabaseDebugger.testConnection()
        console.log('📊 诊断结果:', debugResult)
        
        // 测试具体查询
        const queryResult = await SupabaseDebugger.testSpecificQuery(user.id)
        console.log('🔍 查询测试结果:', queryResult)
        
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

      // 合并本地和云端数据（云端数据优先）
      const mergedSessions = new Map<string, ChatSession>()
      
      // 先添加本地会话
      chatSessions.forEach(session => {
        mergedSessions.set(session.id, session)
      })
      
      // 用云端会话覆盖（如果云端更新时间更晚）
      cloudSessions.forEach(cloudSession => {
        const localSession = mergedSessions.get(cloudSession.id)
        if (!localSession || cloudSession.updatedAt.getTime() > localSession.updatedAt.getTime()) {
          mergedSessions.set(cloudSession.id, cloudSession)
        }
      })

      const finalSessions = Array.from(mergedSessions.values())
        .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())

      useAppStore.setState({ chatSessions: finalSessions })
      setLastSyncTime(new Date())
      
      // 减少重复的成功日志输出
      if (shouldLog) {
        console.log('✅ 云端数据同步成功')
      }
      setSyncing(false)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to sync from cloud'
      console.error(`❌ 云端同步失败 (${attempt}/${maxRetries}):`, error)
      
      // 如果是认证错误，不要继续重试
      if (errorMessage.includes('not authenticated') || errorMessage.includes('JWT')) {
        console.log('🔐 认证错误，停止同步')
        setSyncError('认证已过期，请重新登录')
        setSyncing(false)
        return
      }
      
      // 如果是网络错误且还有重试次数，则重试
      if (attempt < maxRetries && (errorMessage.includes('Failed to fetch') || errorMessage.includes('network') || errorMessage.includes('fetch'))) {
        console.log(`⏳ ${retryDelay}ms 后重试云端同步...`)
        setTimeout(() => {
          syncFromCloud(attempt + 1)
        }, retryDelay)
        return
      }
      
      // 设置错误信息并停止同步
      setSyncError(errorMessage)
      setSyncing(false)
    }
  }, [user, chatSessions, syncing])

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

  // 防抖同步引用
  const debouncedSyncFromCloud = useRef<NodeJS.Timeout | null>(null)
  const debouncedSyncToCloud = useRef<NodeJS.Timeout | null>(null)
  const lastSyncFromCloudTime = useRef<number>(0)
  const lastSyncToCloudTime = useRef<number>(0)

  // 防抖的云端同步函数
  const debouncedSyncFromCloudFn = useCallback(() => {
    const now = Date.now()
    const timeSinceLastSync = now - lastSyncFromCloudTime.current
    
    console.log('🔄 [useUserData] 防抖云端同步检查', { timeSinceLastSync })
    
    // 如果距离上次同步不足5秒，则跳过
    if (timeSinceLastSync < 5000) {
      console.log('⏸️ [useUserData] 跳过云端同步：时间间隔太短')
      return
    }
    
    if (debouncedSyncFromCloud.current) {
      clearTimeout(debouncedSyncFromCloud.current)
    }
    
    debouncedSyncFromCloud.current = setTimeout(() => {
      console.log('📥 [useUserData] 执行防抖云端同步')
      lastSyncFromCloudTime.current = Date.now()
      syncFromCloud()
    }, 1000)
  }, [syncFromCloud])

  // 防抖的云端上传函数
  const debouncedSyncToCloudFn = useCallback(() => {
    const now = Date.now()
    const timeSinceLastSync = now - lastSyncToCloudTime.current
    
    console.log('🔄 [useUserData] 防抖云端上传检查', { timeSinceLastSync })
    
    // 如果距离上次同步不足3秒，则跳过
    if (timeSinceLastSync < 3000) {
      console.log('⏸️ [useUserData] 跳过云端上传：时间间隔太短')
      return
    }
    
    if (debouncedSyncToCloud.current) {
      clearTimeout(debouncedSyncToCloud.current)
    }
    
    debouncedSyncToCloud.current = setTimeout(() => {
      console.log('📤 [useUserData] 执行防抖云端上传')
      lastSyncToCloudTime.current = Date.now()
      syncToCloud()
    }, 2000)
  }, [syncToCloud])

  // 自动同步效果
  useEffect(() => {
    console.log('🔄 [useUserData] 自动同步效果初始化', { userId: user?.id, autoSyncEnabled })
    
    if (!user?.id || !autoSyncEnabled) {
      console.log('⏸️ [useUserData] 跳过自动同步：用户未登录或已禁用')
      return
    }

    // 延迟初始同步，确保认证状态稳定
    const initialSyncTimeout = setTimeout(() => {
      console.log('🚀 [useUserData] 执行初始云端同步')
      debouncedSyncFromCloudFn()
    }, 2000)

    // 立即执行一次同步到云端（如果有本地数据）
    const currentSessions = useAppStore.getState().chatSessions
    if (currentSessions.length > 0) {
      console.log('📤 [useUserData] 发现本地数据，立即同步到云端')
      setTimeout(() => {
        debouncedSyncToCloudFn()
      }, 3000)
    }

    // 设置定时同步
    const interval = setInterval(() => {
      if (autoSyncEnabled && user?.id) {
        console.log('⏰ [useUserData] 定时同步到云端')
        debouncedSyncToCloudFn()
      }
    }, AUTO_SYNC_INTERVAL)

    return () => {
      console.log('🧹 [useUserData] 清理自动同步定时器')
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

  // 监听数据变化，自动同步到云端
  useEffect(() => {
    console.log('🔄 [useUserData] 数据变化监听', { 
      userId: user?.id, 
      autoSyncEnabled, 
      syncing, 
      sessionsCount: chatSessions.length 
    })
    
    if (!user?.id || !autoSyncEnabled || syncing || chatSessions.length === 0) {
      console.log('⏸️ [useUserData] 跳过数据同步：条件不满足')
      return
    }

    console.log('📤 [useUserData] 触发数据同步到云端')
    debouncedSyncToCloudFn()
  }, [chatSessions.length, user?.id, autoSyncEnabled, syncing, debouncedSyncToCloudFn])

  return {
    syncing,
    lastSyncTime,
    syncError,
    syncToCloud,
    syncFromCloud,
    enableAutoSync,
    disableAutoSync,
    clearSyncError
  }
}