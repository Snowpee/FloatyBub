import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAppStore } from '../store'
import { quickConnectionCheck } from '../utils/databaseConnectionTest'
import { useAuth } from './useAuth'
import { SupabaseDebugger } from '../utils/supabaseDebug'
import { dataSyncService } from '../services/DataSyncService'
import { DataIntegrityChecker } from '../utils/dataIntegrityChecker'
import type { ChatSession, ChatMessage } from '../store'
import type { SyncStatus, SyncResult } from '../services/DataSyncService'
import type { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js'

// 配置开关：控制是否启用Realtime订阅功能
// 设置为false以禁用所有Realtime订阅，但保留轮询和手动同步功能
// 修改此值为true可重新启用Realtime功能
// 注意：禁用Realtime后，应用将依赖轮询机制进行数据同步
const ENABLE_REALTIME_SUBSCRIPTIONS = false

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

export const useUserData = () => {
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
  const [dataSyncLastTime, setDataSyncLastTime] = useState<number | null>(null)// 同步队列状态
  const [syncQueue, setSyncQueue] = useState<Set<string>>(new Set())
  
  // 队列清理机制：定期清理可能残留的队列项
  useEffect(() => {
    const cleanupInterval = setInterval(() => {
      setSyncQueue(prev => {
        if (prev.size > 0 && !syncing) {
          console.log('🧹 [队列清理] 检测到非同步状态下的队列残留，执行清理');
          return new Set();
        }
        return prev;
      });
    }, 30000); // 每30秒检查一次
    
    return () => clearInterval(cleanupInterval);
  }, [syncing])
   
   const [syncProgress, setSyncProgress] = useState({ percent: 0, message: '' })
  
  // Realtime 订阅状态
  const [realtimeConnected, setRealtimeConnected] = useState(false)
  const chatSessionsChannelRef = useRef<RealtimeChannel | null>(null)
  const messagesChannelRef = useRef<RealtimeChannel | null>(null)
  const realtimeRetryTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const [realtimeRetryCount, setRealtimeRetryCount] = useState(0)
  const lastRetryAttemptRef = useRef<number>(0) // 记录上次重试时间
  const connectionHealthCheckRef = useRef<NodeJS.Timeout | null>(null) // 连接健康检查定时器
  const lastConnectionCheckRef = useRef<number>(0) // 上次连接检查时间
  const isRebuilding = useRef({ chatSessions: false, messages: false }) // 跟踪重建状态
  const rebuildAttempts = useRef({ chatSessions: 0, messages: 0 }) // 跟踪重建次数
  const lastRebuildTime = useRef({ chatSessions: 0, messages: 0 }) // 跟踪上次重建时间
  
  // 连接质量监控状态
  const [connectionQuality, setConnectionQuality] = useState<'good' | 'poor' | 'unstable'>('good')
  const connectionStatsRef = useRef({ retryCount: 0, lastStabilityCheck: Date.now() })
  const stabilityCheckTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  
  // 订阅降级策略状态
  const [fallbackPollingEnabled, setFallbackPollingEnabled] = useState(false)
  const fallbackPollingIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const FALLBACK_POLLING_INTERVAL = 30000 // 30秒轮询间隔
  
  // 备用同步机制状态
  const backupSyncIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const BACKUP_SYNC_INTERVAL = 60000 // 60秒检查间隔
  const lastBackupSyncCheck = useRef<number>(0)
  
  // 添加订阅状态监控
  const [subscriptionStatus, setSubscriptionStatus] = useState({
    chatSessions: 'DISCONNECTED',
    messages: 'DISCONNECTED'
  })
  
  // 监控订阅状态变化
  useEffect(() => {
    console.log('📊 实时订阅状态更新:', subscriptionStatus)
    console.log('🔍 整体连接状态:', {
      chatSessions: subscriptionStatus.chatSessions,
      messages: subscriptionStatus.messages,
      allConnected: subscriptionStatus.chatSessions === 'SUBSCRIBED' && subscriptionStatus.messages === 'SUBSCRIBED'
    })
  }, [subscriptionStatus])

  // 连接健康检查函数
  const performConnectionHealthCheck = useCallback(() => {
    const now = Date.now()
    const lastCheckTime = lastConnectionCheckRef.current
    lastConnectionCheckRef.current = now
    
    console.log('🏥 执行连接健康检查...')
    console.log('🔍 当前订阅状态:', {
      chatSessions: subscriptionStatus.chatSessions,
      messages: subscriptionStatus.messages,
      realtimeConnected,
      networkOnline: navigator.onLine
    })
    
    // 检查网络连接
    if (!navigator.onLine) {
      console.warn('⚠️ 网络离线，暂停健康检查')
      return
    }
    
    // 分别检查各订阅状态，仅对真正异常的订阅进行重建
    // 增加对长时间DISCONNECTED状态的检测
    const timeSinceLastCheck = now - lastCheckTime
    
    const chatHasIssue =
      subscriptionStatus.chatSessions === 'CHANNEL_ERROR' ||
      subscriptionStatus.chatSessions === 'TIMED_OUT' ||
      subscriptionStatus.chatSessions === 'CLOSED' ||
      (subscriptionStatus.chatSessions === 'DISCONNECTED' && timeSinceLastCheck > 60000) // 超过1分钟DISCONNECTED
    
    const messagesHaveIssue =
      subscriptionStatus.messages === 'CHANNEL_ERROR' ||
      subscriptionStatus.messages === 'TIMED_OUT' ||
      subscriptionStatus.messages === 'CLOSED' ||
      (subscriptionStatus.messages === 'DISCONNECTED' && timeSinceLastCheck > 60000) // 超过1分钟DISCONNECTED
    
    // 检查是否有订阅正在重建中，避免重复触发
    const chatIsRebuilding = isRebuilding.current.chatSessions
    const messagesIsRebuilding = isRebuilding.current.messages
    
    if ((chatHasIssue || messagesHaveIssue) && user?.id && !chatIsRebuilding && !messagesIsRebuilding) {
      console.warn('⚠️ 检测到订阅连接异常，尝试选择性重建问题订阅', { chatHasIssue, messagesHaveIssue })
      
      // 重置重试计数，允许重新尝试
      setRealtimeRetryCount(0)
      lastRetryAttemptRef.current = 0
      
      if (chatHasIssue && !chatIsRebuilding) {
        const timeSinceLastRebuild = now - lastRebuildTime.current.chatSessions
        const attempts = rebuildAttempts.current.chatSessions
        
        // 智能重建逻辑：最大5次重建，指数退避延迟，最小冷却时间5分钟
        if (attempts < 5 && timeSinceLastRebuild > 300000) { // 5分钟冷却
          const rebuildDelay = Math.min(3000 * Math.pow(2, attempts), 30000) // 3s到30s指数退避
          
          console.log(`🧹 智能重建 chat_sessions 订阅 (第${attempts + 1}次尝试, 延迟${rebuildDelay}ms)`)
          isRebuilding.current.chatSessions = true
          rebuildAttempts.current.chatSessions += 1
          lastRebuildTime.current.chatSessions = now
          
          cleanupChatSessionsSubscription()
          setTimeout(() => {
            console.log('🚀 重新建立 chat_sessions 订阅')
            setupChatSessionsSubscription()
            isRebuilding.current.chatSessions = false
          }, rebuildDelay)
        } else {
          console.warn(`⚠️ chat_sessions 重建已达上限或冷却中 (尝试${attempts}/5次, 冷却${Math.round((300000 - timeSinceLastRebuild)/1000)}s)`)
        }
      }
      
      if (messagesHaveIssue && !messagesIsRebuilding) {
        const timeSinceLastRebuild = now - lastRebuildTime.current.messages
        const attempts = rebuildAttempts.current.messages
        
        // 智能重建逻辑：最大5次重建，指数退避延迟，最小冷却时间5分钟
        if (attempts < 5 && timeSinceLastRebuild > 300000) { // 5分钟冷却
          const rebuildDelay = Math.min(3000 * Math.pow(2, attempts), 30000) // 3s到30s指数退避
          
          console.log(`🧹 智能重建 messages 订阅 (第${attempts + 1}次尝试, 延迟${rebuildDelay}ms)`)
          isRebuilding.current.messages = true
          rebuildAttempts.current.messages += 1
          lastRebuildTime.current.messages = now
          
          cleanupMessagesSubscription()
          setTimeout(() => {
            console.log('🚀 重新建立 messages 订阅')
            setupMessagesSubscription()
            isRebuilding.current.messages = false
          }, rebuildDelay)
        } else {
          console.warn(`⚠️ messages 重建已达上限或冷却中 (尝试${attempts}/5次, 冷却${Math.round((300000 - timeSinceLastRebuild)/1000)}s)`)
        }
      }
    } else if (chatIsRebuilding || messagesIsRebuilding) {
      console.log('⏳ 订阅重建中，跳过健康检查', { chatIsRebuilding, messagesIsRebuilding })
    }
  }, [subscriptionStatus, realtimeConnected, user?.id])

  // 启动连接健康检查
  const startConnectionHealthCheck = useCallback(() => {
    if (connectionHealthCheckRef.current) {
      clearInterval(connectionHealthCheckRef.current)
    }
    
    // 根据网络质量调整健康检查频率
    const checkInterval = connectionQuality === 'poor' ? 60000 : 
                         connectionQuality === 'unstable' ? 90000 : 45000
    
    console.log(`🏥 启动连接健康检查 (每${checkInterval/1000}秒检查一次, 网络质量: ${connectionQuality})`)
    connectionHealthCheckRef.current = setInterval(() => {
      performConnectionHealthCheck()
    }, checkInterval)
  }, [performConnectionHealthCheck])

  // 停止连接健康检查
  const stopConnectionHealthCheck = useCallback(() => {
    if (connectionHealthCheckRef.current) {
      clearInterval(connectionHealthCheckRef.current)
      connectionHealthCheckRef.current = null
      console.log('🏥 已停止连接健康检查')
    }
  }, [])

  // 连接质量评估函数
  const assessConnectionQuality = useCallback(() => {
    const now = Date.now()
    const stats = connectionStatsRef.current
    const timeSinceLastCheck = now - stats.lastStabilityCheck
    
    // 每10分钟评估一次连接质量
    if (timeSinceLastCheck >= CONNECTION_STABILITY_CHECK_INTERVAL) {
      const retryRate = stats.retryCount / (timeSinceLastCheck / (60 * 1000)) // 每分钟重连次数
      
      // 获取网络信息
      const connection = (navigator as any).connection
      const effectiveType = connection?.effectiveType || 'unknown'
      const rtt = connection?.rtt || 0
      const downlink = connection?.downlink || 0
      
      let newQuality: 'good' | 'poor' | 'unstable'
      
      // 综合评估：网络条件 + 重试次数
      const isSlowNetwork = (
        effectiveType === 'slow-2g' || 
        effectiveType === '2g' || 
        effectiveType === '3g' || 
        rtt > 500 || 
        downlink < 1
      )
      
      const isVerySlowNetwork = (
        effectiveType === 'slow-2g' || 
        effectiveType === '2g' || 
        rtt > 1000 || 
        downlink < 0.5
      )
      
      if (stats.retryCount === 0 && !isSlowNetwork) {
        newQuality = 'good'
      } else if (isVerySlowNetwork || stats.retryCount > CONNECTION_QUALITY_THRESHOLD) {
        newQuality = 'unstable'
      } else if (isSlowNetwork || stats.retryCount > 0) {
        newQuality = 'poor'
      } else {
        newQuality = 'good'
      }
      
      if (newQuality !== connectionQuality) {
        console.log(`📊 连接质量评估: ${connectionQuality} → ${newQuality}`)
        console.log(`🔍 网络条件: ${effectiveType}, RTT: ${rtt}ms, 下行: ${downlink}Mbps`)
        console.log(`🔍 重连统计: ${stats.retryCount}次重连/${Math.round(timeSinceLastCheck/60000)}分钟`)
        setConnectionQuality(newQuality)
      }
      
      // 重置统计数据
      connectionStatsRef.current = {
        retryCount: 0,
        lastStabilityCheck: now
      }
    }
  }, [connectionQuality])

  // 记录重连事件
  const recordRetryAttempt = useCallback(() => {
    connectionStatsRef.current.retryCount += 1
    console.log(`📈 记录重连事件: 当前周期内第${connectionStatsRef.current.retryCount}次重连`)
    
    // 立即评估连接质量
    assessConnectionQuality()
  }, [assessConnectionQuality])

  // 启动连接稳定性检查
  const startStabilityCheck = useCallback(() => {
    if (stabilityCheckTimeoutRef.current) {
      clearInterval(stabilityCheckTimeoutRef.current)
    }
    
    console.log('📊 启动连接稳定性检查 (每5分钟评估一次)')
    stabilityCheckTimeoutRef.current = setInterval(() => {
      assessConnectionQuality()
    }, CONNECTION_STABILITY_CHECK_INTERVAL)
  }, [assessConnectionQuality])

  // 停止连接稳定性检查
  const stopStabilityCheck = useCallback(() => {
    if (stabilityCheckTimeoutRef.current) {
      clearInterval(stabilityCheckTimeoutRef.current)
      stabilityCheckTimeoutRef.current = null
      console.log('📊 已停止连接稳定性检查')
    }
  }, [])

  // 启动降级轮询机制
  const startFallbackPolling = useCallback(() => {
    if (fallbackPollingIntervalRef.current || !user?.id) {
      return
    }
    
    console.log('🔄 启动 chatSessions 降级轮询机制')
    setFallbackPollingEnabled(true)
    
    const pollChatSessions = async () => {
      try {
        console.log('📊 轮询获取 chatSessions 数据...')
        const { data, error } = await supabase
          .from('chat_sessions')
          .select('*')
          .eq('user_id', user.id)
          .order('updated_at', { ascending: false })
        
        if (error) {
          console.error('❌ 轮询获取 chatSessions 失败:', error)
          return
        }
        
        if (data) {
          console.log(`✅ 轮询获取到 ${data.length} 个会话`)
          // 转换数据格式并更新状态
          const sessions: ChatSession[] = data.map(session => ({
            id: session.id,
            title: session.title,
            messages: [], // 轮询时不获取消息，避免数据量过大
            createdAt: new Date(session.created_at),
            updatedAt: new Date(session.updated_at),
            snowflake_id: session.snowflake_id,
            roleId: session.role_id || undefined,
            modelId: session.model_id || undefined
          }))
          
          // 只更新会话列表，不影响消息
          const currentSessions = useAppStore.getState().chatSessions
          const updatedSessions = currentSessions.map(currentSession => {
            const polledSession = sessions.find(s => s.id === currentSession.id)
            if (polledSession) {
              return {
                ...currentSession,
                title: polledSession.title,
                updatedAt: polledSession.updatedAt
              }
            }
            return currentSession
          })
          
          // 添加新会话
          const newSessions = sessions.filter(polledSession => 
            !currentSessions.some(current => current.id === polledSession.id)
          )
          
          if (newSessions.length > 0) {
            console.log(`📝 发现 ${newSessions.length} 个新会话`)
            updatedSessions.push(...newSessions)
          }
          
          useAppStore.setState({ chatSessions: updatedSessions })
        }
      } catch (error) {
        console.error('❌ 轮询过程中发生错误:', error)
      }
    }
    
    // 立即执行一次轮询
    pollChatSessions()
    
    // 设置定时轮询
    fallbackPollingIntervalRef.current = setInterval(pollChatSessions, FALLBACK_POLLING_INTERVAL)
  }, [user?.id])
  
  // 停止降级轮询机制
  const stopFallbackPolling = useCallback(() => {
    if (fallbackPollingIntervalRef.current) {
      clearInterval(fallbackPollingIntervalRef.current)
      fallbackPollingIntervalRef.current = null
      console.log('🛑 已停止 chatSessions 降级轮询机制')
    }
    setFallbackPollingEnabled(false)
  }, [])

  // 自动同步间隔（5分钟）
  const AUTO_SYNC_INTERVAL = 5 * 60 * 1000
  const REALTIME_RETRY_DELAY = 8000 // 8秒基础重连延迟，适应3g网络
  const MAX_REALTIME_RETRIES = 3 // 减少最大重试次数，避免过度重连
  const MIN_RETRY_INTERVAL = 8000 // 最小重试间隔8秒，适应高延迟网络
  const MAX_RETRY_INTERVAL = 120000 // 最大重试间隔120秒，给网络更多恢复时间
  // 连接稳定性检查间隔（10分钟）
  const CONNECTION_STABILITY_CHECK_INTERVAL = 10 * 60 * 1000
  // 连接质量评估阈值
  const CONNECTION_QUALITY_THRESHOLD = 2 // 10分钟内重连次数超过2次认为连接不稳定
  // 错误类型优先级
  const ERROR_PRIORITY = {
    'CHANNEL_ERROR': 1,
    'TIMED_OUT': 2,
    'CLOSED': 3
  }
  
  // 应用启动时执行 ID 迁移
  useEffect(() => {
    const performInitialMigration = () => {
      try {
        const migrationPerformed = migrateIdsToUUID()
      } catch (error) {
        console.error('ID migration failed:', error)
      }
    }
    
    performInitialMigration()
  }, []) // 移除 migrateIdsToUUID 依赖，避免无限循环

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
    if (!user || syncing) {
      return
    }

    // 生成同步标识符和记录开始时间
    const syncId = `${user.id}-${Date.now()}`
    const syncStartTime = Date.now()
    
    // 详细的同步状态日志
    console.log(`🚀 ===== 开始同步到云端 =====`);
    console.log(`🔄 [同步开始] ID: ${syncId}`);
    console.log(`📊 [同步状态] 用户: ${user.id}, 重试次数: ${retryCount}, 在线状态: ${navigator.onLine}`);
    console.log(`📈 [同步队列] 当前队列大小: ${syncQueue.size}, 会话数量: ${chatSessions.length}`);
    console.log(`⏰ [同步时间] 开始时间: ${new Date(syncStartTime).toLocaleString()}`);

    // 数据完整性检查：在同步前验证 Snowflake ID 一致性
    try {
      const integrityResult = await DataIntegrityChecker.checkSnowflakeIdConsistency(chatSessions, user.id);
      DataIntegrityChecker.logIntegrityCheckResult(integrityResult);
      
      // 如果发现严重错误，记录但不阻止同步（保持数据流动性的）
      if (!integrityResult.isValid && integrityResult.errors.length > 0) {
        console.warn('⚠️ 发现数据完整性问题，但继续同步以保持数据流动性的');
      }
    } catch (error) {
      console.warn('⚠️ 数据完整性检查失败，继续同步:', error);
    }
    
    // 原子性检查和添加到同步队列，避免竞态条件
    let shouldProceed = false;
    setSyncQueue(prev => {
      if (prev.has(user.id)) {
        console.log('⏭️ 用户已在同步队列中，跳过此次同步');
        return prev;
      }
      shouldProceed = true;
      return new Set(prev).add(user.id);
    });
    
    // 如果没有成功添加到队列，直接返回
    if (!shouldProceed) {
      return;
    }
    
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
          
          return messageNeedsUpdate ? { ...message, id: newMessageId } : message
        })
        
        const updatedSession = {
          ...session,
          id: newSessionId,
          messages: updatedMessages
        }
        
        if (sessionNeedsUpdate || updatedMessages.some((msg, index) => msg.id !== session.messages[index]?.id)) {
          sessionsToUpdate.push(updatedSession)
        }
        
        return updatedSession
      })
      
      // 如果有 ID 需要更新，先更新本地存储
      if (sessionsToUpdate.length > 0) {
        useAppStore.setState({ chatSessions: updatedSessions })
      }
      
      // 批量同步聊天会话到云端
      console.log(`📋 [同步步骤] 准备同步数据...`);
      setSyncProgress({ percent: 10, message: '准备同步数据...' })
      
      // 检查网络状态
      if (!navigator.onLine) {
        throw new Error('网络连接不可用，请检查网络设置')
      }
      
      console.log(`🌐 [同步步骤] 网络连接检查通过`);
      setSyncProgress({ percent: 20, message: '检查网络连接...' })
      
      // 批量准备会话数据
      const sessionsData = updatedSessions.map(session => ({
        id: session.id,
        user_id: user.id,
        title: session.title,
        is_hidden: session.isHidden || false,
        is_pinned: session.isPinned || false,
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
      console.log(`📝 [同步步骤] 开始同步会话数据，共${sessionsData.length}个会话，分${totalBatches}批处理`);
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
      console.log(`💬 [同步步骤] 会话同步完成，开始准备同步消息数据`);
      setSyncProgress({ percent: 50, message: '准备同步消息...' })
      // 用于确保 message_timestamp 唯一性的计数器
      let timestampCounter = 0
      
      const allMessages = updatedSessions.flatMap(session => 
        session.messages.map(message => {
          // 为每个消息生成唯一的 message_timestamp
          let messageTimestamp = message.message_timestamp
          if (!messageTimestamp) {
            // 基于原始 timestamp 生成，但添加微秒偏移确保唯一性
            const baseTime = new Date(message.timestamp)
            const uniqueTime = new Date(baseTime.getTime() + timestampCounter)
            messageTimestamp = uniqueTime.toISOString()
            timestampCounter++ // 递增计数器
          }
          
          // 明确构造消息对象，排除 created_at 字段
          // 确保使用转换后的 UUID 格式 ID
          const messageData: {
            id: string;
            session_id: string;
            role: string;
            content: string;
            reasoning_content: string | null;
            metadata: Record<string, any>;
            message_timestamp: string;
            versions?: string[];
            current_version_index?: number;
            snowflake_id?: string;
          } = {
            id: message.id, // 这里的 message.id 已经是转换后的 UUID 格式
            session_id: session.id, // 这里的 session.id 已经是转换后的 UUID 格式
            role: message.role,
            content: message.content,
            reasoning_content: message.reasoningContent || null,
            metadata: {
              timestamp: message.timestamp,
              roleId: message.roleId,
              userProfileId: message.userProfileId
            },
            // 使用生成的唯一 message_timestamp
            message_timestamp: messageTimestamp,
            // 同步版本管理字段
            versions: message.versions,
            current_version_index: message.currentVersionIndex
          }
          
          // 版本字段同步日志
          console.log(`📝 [版本字段] 消息ID: ${message.id.substring(0, 8)}...`);
          console.log(`   📋 versions: ${message.versions ? JSON.stringify(message.versions) : 'null/undefined'}`);
          console.log(`   📊 currentVersionIndex: ${message.currentVersionIndex !== undefined ? message.currentVersionIndex : 'null/undefined'}`);
          console.log(`   🔄 同步到数据库: versions=${messageData.versions ? 'YES' : 'NO'}, current_version_index=${messageData.current_version_index !== undefined ? 'YES' : 'NO'}`);
          
          // Snowflake ID 保护机制：只有在不存在时才添加，已存在的绝不覆盖
          if (message.snowflake_id) {
            messageData.snowflake_id = message.snowflake_id
          }
          return messageData
        })
      )
      
      // 分批处理消息（每批最多100个）
      const MESSAGE_BATCH_SIZE = 100
      const totalMessageBatches = Math.ceil(allMessages.length / MESSAGE_BATCH_SIZE)
      console.log(`📨 [同步步骤] 开始同步消息数据，共${allMessages.length}条消息，分${totalMessageBatches}批处理`);
      setSyncProgress({ percent: 60, message: `同步消息 (0/${totalMessageBatches} 批次)...` })
      
      for (let i = 0; i < allMessages.length; i += MESSAGE_BATCH_SIZE) {
        const batch = allMessages.slice(i, i + MESSAGE_BATCH_SIZE)
        const messageBatchIndex = Math.floor(i/MESSAGE_BATCH_SIZE) + 1
        
        // Snowflake ID 冲突检测：分离有 snowflake_id 和无 snowflake_id 的消息
        const messagesWithSnowflake = batch.filter(msg => msg.snowflake_id)
        const messagesWithoutSnowflake = batch.filter(msg => !msg.snowflake_id)
        
        let messagePromise: Promise<any>
        
        try {
          if (messagesWithSnowflake.length > 0 && messagesWithoutSnowflake.length > 0) {
            // 如果同时有两种类型的消息，分别处理
            
            // 对于有 snowflake_id 的消息，使用更安全的策略
            const withSnowflakeResult = await supabase
              .from('messages')
              .upsert(messagesWithSnowflake, { 
                onConflict: 'id',
                ignoreDuplicates: true // 如果存在冲突，忽略重复插入
              })
            
            if (withSnowflakeResult.error) {
              console.error('有snowflake_id的消息同步失败:', withSnowflakeResult.error)
              throw withSnowflakeResult.error
            }
            
            const withoutSnowflakeResult = await supabase
              .from('messages')
              .upsert(messagesWithoutSnowflake, { 
                onConflict: 'id',
                ignoreDuplicates: false
              })
            
            if (withoutSnowflakeResult.error) {
              console.error('无snowflake_id的消息同步失败:', withoutSnowflakeResult.error)
              throw withoutSnowflakeResult.error
            }
            
            messagePromise = Promise.resolve({ error: null })
          } else if (messagesWithSnowflake.length > 0) {
            // 只有带 snowflake_id 的消息
            const result = await supabase
              .from('messages')
              .upsert(messagesWithSnowflake, { 
                onConflict: 'id',
                ignoreDuplicates: true // 对于有 snowflake_id 的消息，忽略重复
              })
            messagePromise = Promise.resolve(result)
          } else {
            // 只有无 snowflake_id 的消息
            const result = await supabase
              .from('messages')
              .upsert(messagesWithoutSnowflake, { 
                onConflict: 'id',
                ignoreDuplicates: false
              })
            messagePromise = Promise.resolve(result)
          }
        } catch (conflictError) {
          console.error(`批次 ${messageBatchIndex} 处理失败:`, conflictError)
          throw conflictError
        }
        
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

      const syncEndTime = new Date().toISOString()
      const syncDuration = Date.now() - new Date(syncStartTime).getTime()
      
      setLastSyncTime(new Date())
      setSyncProgress({ percent: 100, message: '同步完成' })
      
      // 详细的同步成功日志
      // 统计版本字段数据
      const messagesWithVersions = allMessages.filter(msg => msg.versions && msg.versions.length > 0);
      const messagesWithVersionIndex = allMessages.filter(msg => msg.current_version_index !== undefined && msg.current_version_index !== null);
      
      console.log(`✅ ===== 同步到云端完成 =====`);
      console.log(`✅ [同步成功] ID: ${syncId}`);
      console.log(`⏱️ [同步耗时] ${syncDuration}ms (${(syncDuration/1000).toFixed(2)}秒)`);
      console.log(`📊 [同步统计] 会话: ${sessionsData.length}个, 消息: ${allMessages.length}条`);
      console.log(`📋 [版本统计] 包含versions的消息: ${messagesWithVersions.length}条, 包含current_version_index的消息: ${messagesWithVersionIndex.length}条`);
      console.log(`🏁 [同步结束] 结束时间: ${new Date(syncEndTime).toLocaleString()}`);
      console.log(`🎉 [同步结果] 同步完成，共同步了${sessionsData.length}个会话，${allMessages.length}条消息`);
      
      // 数据库验证：检查同步后的数据是否正确存储
      try {
        console.log(`🔍 ===== 开始数据库验证 =====`);
        // 从chatSessions中提取ChatMessage对象进行验证
        const chatMessagesToVerify = chatSessions.flatMap(session => session.messages || []);
        await verifyDatabaseSync(chatMessagesToVerify);
        console.log(`✅ ===== 数据库验证完成 =====`);
      } catch (verifyError) {
        console.error(`❌ [数据库验证失败]`, verifyError);
      }
      
      // 2秒后重置进度
      setTimeout(() => {
        setSyncProgress({ percent: 0, message: '' })
      }, 2000)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to sync to cloud'
      const syncEndTime = new Date().toISOString()
      const syncDuration = Date.now() - new Date(syncStartTime).getTime()
      
      console.error(`❌ ===== 同步到云端失败 =====`);
      console.error(`❌ [同步失败] ID: ${syncId}`);
      console.error(`⏱️ [失败耗时] ${syncDuration}ms (${(syncDuration/1000).toFixed(2)}秒)`);
      console.error(`💥 [失败原因] ${errorMessage}`);
      console.error(`🔄 [重试信息] 当前重试次数: ${retryCount}`);
      console.error('🚨 [错误详情]:', {
        error: errorMessage,
        retryCount,
        userId: user.id,
        timestamp: syncEndTime,
        onlineStatus: navigator.onLine,
        syncId,
        stackTrace: error instanceof Error ? error.stack : undefined
      })
      
      setSyncError(errorMessage)
      setSyncProgress({ percent: 0, message: '同步失败' })
      
      // 增强的错误分类和重试逻辑
      const isNetworkError = (
        errorMessage.includes('timeout') || 
        errorMessage.includes('network') || 
        errorMessage.includes('fetch') ||
        errorMessage.includes('Failed to fetch') ||
        errorMessage.includes('NetworkError') ||
        !navigator.onLine
      )
      
      const isAuthError = (
        errorMessage.includes('not authenticated') || 
        errorMessage.includes('JWT') ||
        errorMessage.includes('permission denied') ||
        errorMessage.includes('Unauthorized')
      )
      
      const isServerError = (
        errorMessage.includes('Internal Server Error') ||
        errorMessage.includes('502') ||
        errorMessage.includes('503') ||
        errorMessage.includes('504')
      )
      
      const isRateLimitError = (
        errorMessage.includes('rate limit') ||
        errorMessage.includes('429') ||
        errorMessage.includes('Too Many Requests')
      )
      
      // 智能重试策略
      const shouldRetry = (
        retryCount < 3 && 
        navigator.onLine && 
        !isAuthError && // 认证错误不重试
        (isNetworkError || isServerError || isRateLimitError)
      )
      
      if (shouldRetry) {
        let delay: number
        
        if (isRateLimitError) {
          // 速率限制错误使用更长的延迟
          delay = Math.min(5000 * Math.pow(2, retryCount), 30000) // 5秒起步，最大30秒
        } else if (isNetworkError) {
          // 网络错误使用中等延迟
          delay = Math.min(3000 * Math.pow(2, retryCount), 20000) // 3秒起步，最大20秒
        } else {
          // 服务器错误使用标准延迟
          delay = Math.min(2000 * Math.pow(2, retryCount), 15000) // 2秒起步，最大15秒
        }
        
        console.log(`🔄 将在 ${delay}ms 后重试同步 (${retryCount + 1}/3)`, {
          errorType: isRateLimitError ? 'rate_limit' : isNetworkError ? 'network' : 'server',
          delay
        })
        
        setSyncProgress({ 
          percent: 0, 
          message: `同步失败，${Math.round(delay/1000)}秒后重试 (${retryCount + 1}/3)` 
        })
        
        setTimeout(() => {
          syncToCloud(retryCount + 1)
        }, delay)
      } else {
        // 不重试的情况，提供更详细的错误信息
        let userFriendlyMessage = '同步失败'
        
        if (isAuthError) {
          userFriendlyMessage = '认证失败，请重新登录'
        } else if (!navigator.onLine) {
          userFriendlyMessage = '网络连接不可用，请检查网络设置'
        } else if (retryCount >= 3) {
          userFriendlyMessage = '同步重试次数已达上限，请稍后手动重试'
        }
        
        setSyncProgress({ percent: 0, message: userFriendlyMessage })
        
        console.error('🚨 同步最终失败:', {
          reason: isAuthError ? 'auth_error' : !navigator.onLine ? 'offline' : 'max_retries',
          finalError: errorMessage,
          retryCount
        })
      }
    } finally {
      // 安全地从同步队列中移除，并记录队列状态
      setSyncQueue(prev => {
        const newQueue = new Set(prev)
        const wasInQueue = newQueue.delete(user.id)
        
        console.log(`🔄 [队列管理] 用户 ${user.id} ${wasInQueue ? '已从队列移除' : '不在队列中'}`);
        console.log(`📊 [队列状态] 当前队列大小: ${newQueue.size}`);
        
        return newQueue
      })
      setSyncing(false)
      
      // 记录同步结束时间和总耗时
      const syncEndTime = Date.now();
      const totalDuration = syncEndTime - syncStartTime;
      console.log(`⏰ [同步完成] 结束时间: ${new Date(syncEndTime).toISOString()}, 总耗时: ${totalDuration}ms`);
    }
  }, [user, syncing, migrateIdsToUUID])

  // 数据库验证函数：检查同步后的数据是否正确存储
  const verifyDatabaseSync = useCallback(async (localMessages: ChatMessage[]) => {
    if (!user) return;
    
    console.log(`🔍 [数据库验证] 开始验证 ${localMessages.length} 条消息`);
    
    // 获取数据库中的消息数据 - 通过session_id关联chat_sessions表
    const { data: dbMessages, error } = await supabase
      .from('messages')
      .select(`
        id, 
        content, 
        versions, 
        current_version_index,
        chat_sessions!inner(user_id)
      `)
      .eq('chat_sessions.user_id', user.id)
      .in('id', localMessages.map(msg => msg.id));
    
    if (error) {
      throw new Error(`数据库查询失败: ${error.message}`);
    }
    
    if (!dbMessages) {
      throw new Error('数据库返回空结果');
    }
    
    console.log(`📊 [数据库验证] 数据库返回 ${dbMessages.length} 条消息`);
    
    // 验证每条消息的版本数据
    let inconsistentCount = 0;
    const inconsistentMessages: string[] = [];
    
    for (const localMsg of localMessages) {
      const dbMsg = dbMessages.find(db => db.id === localMsg.id);
      
      if (!dbMsg) {
        console.warn(`⚠️ [数据库验证] 消息 ${localMsg.id} 在数据库中不存在`);
        inconsistentCount++;
        inconsistentMessages.push(`${localMsg.id}: 数据库中不存在`);
        continue;
      }
      
      // 验证versions字段
      const localVersions = localMsg.versions || [];
      const dbVersions = dbMsg.versions || [];
      const versionsMatch = JSON.stringify(localVersions) === JSON.stringify(dbVersions);
      
      // 验证current_version_index字段
      const localIndex = localMsg.currentVersionIndex || 0;
      const dbIndex = dbMsg.current_version_index || 0;
      const indexMatch = localIndex === dbIndex;
      
      if (!versionsMatch || !indexMatch) {
        inconsistentCount++;
        inconsistentMessages.push(`${localMsg.id}: versions=${versionsMatch ? '✓' : '✗'}, index=${indexMatch ? '✓' : '✗'}`);
        
        console.warn(`⚠️ [数据库验证] 消息 ${localMsg.id} 数据不一致:`);
        console.warn(`   本地 versions: ${JSON.stringify(localVersions)}`);
        console.warn(`   数据库 versions: ${JSON.stringify(dbVersions)}`);
        console.warn(`   本地 currentVersionIndex: ${localIndex}`);
        console.warn(`   数据库 current_version_index: ${dbIndex}`);
      } else {
        console.log(`✅ [数据库验证] 消息 ${localMsg.id} 数据一致`);
      }
    }
    
    // 输出验证结果
    if (inconsistentCount === 0) {
      console.log(`✅ [数据库验证] 所有 ${localMessages.length} 条消息数据一致`);
    } else {
      console.error(`❌ [数据库验证] 发现 ${inconsistentCount} 条消息数据不一致:`);
      inconsistentMessages.forEach(msg => console.error(`   ${msg}`));
    }
    
    return {
      totalMessages: localMessages.length,
      inconsistentCount,
      inconsistentMessages
    };
  }, [user])

  // 从云端同步（带重试机制）
  const syncFromCloud = useCallback(async (attempt = 1) => {
    const maxRetries = 3
    const retryDelay = 2000 // 2秒
    
    if (!user || syncing) return

    // 生成同步标识符和记录开始时间
    const syncId = `${user.id}-${Date.now()}`
    const syncStartTime = Date.now()
    
    // 详细的同步状态日志
    console.log(`⬇️ ===== 开始从云端同步 =====`);
    console.log(`🔄 [同步开始] ID: ${syncId}`);
    console.log(`📊 [同步状态] 用户: ${user.id}, 尝试次数: ${attempt}/${maxRetries}, 在线状态: ${navigator.onLine}`);
    console.log(`⏰ [同步时间] 开始时间: ${new Date(syncStartTime).toLocaleString()}`);

    setSyncing(true)
    if (attempt === 1) {
      setSyncError(null) // 只在第一次尝试时清除错误
    }

    try {
      // 同步前检查数据库连通性
      console.log(`📋 [同步步骤] 检查数据库连通性...`);
      if (attempt === 1) {
        const isConnected = await quickConnectionCheck()
        
        if (!isConnected) {
          throw new Error('数据库连接不可用，请检查网络连接或稍后重试')
        }
        console.log(`🌐 [同步步骤] 数据库连通性检查通过`);
      }
      
      // 检查网络连接和认证状态（添加超时机制）
      console.log(`🔐 [同步步骤] 检查用户认证状态...`);
      const authPromise = supabase.auth.getSession()
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('认证状态检查超时')), 15000) // 15秒超时
      })
      
      const { data: { session } } = await Promise.race([
        authPromise,
        timeoutPromise
      ]) as any
      
      if (!session) {
        throw new Error('User not authenticated')
      }
      
      console.log(`✅ [同步步骤] 用户认证验证通过`);
      console.log(`📝 [同步步骤] 开始获取云端会话数据...`);

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
      
      console.log(`📝 [同步步骤] 会话数据获取完成，共${sessions?.length || 0}个会话`);
      console.log(`💬 [同步步骤] 开始获取云端消息数据...`);

      const cloudSessions: ChatSession[] = []
      let totalMessages = 0

      for (const session of sessions || []) {
        // 获取会话的消息
        const { data: messages, error: messagesError } = await supabase
          .from('messages')
          .select('*, snowflake_id::text')
          .eq('session_id', session.id)
          .order('message_timestamp', { ascending: true })

        if (messagesError) {
          throw new Error(`Failed to fetch messages for session ${session.id}: ${messagesError.message}`)
        }

        const sessionMessages: ChatMessage[] = (messages || []).map(msg => {
          const mappedMessage = {
            id: msg.id,
            role: msg.role as 'user' | 'assistant',
            content: msg.content,
            reasoningContent: msg.reasoning_content || undefined,
            timestamp: new Date(msg.metadata?.timestamp || msg.message_timestamp),
            message_timestamp: msg.message_timestamp,
            snowflake_id: msg.snowflake_id,
            roleId: msg.metadata?.roleId,
            userProfileId: msg.metadata?.userProfileId,
            // 从数据库读取版本管理字段 - 确保有默认值
            versions: msg.versions || [msg.content || ''],
            currentVersionIndex: msg.current_version_index !== undefined && msg.current_version_index !== null ? msg.current_version_index : 0
          };
          
          // 版本字段读取日志
          console.log(`📖 [版本字段读取] 消息ID: ${msg.id.substring(0, 8)}...`);
          console.log(`   📋 数据库versions: ${msg.versions ? JSON.stringify(msg.versions) : 'null/undefined'}`);
          console.log(`   📊 数据库current_version_index: ${msg.current_version_index !== undefined ? msg.current_version_index : 'null/undefined'}`);
          console.log(`   🔄 映射到本地: versions=${mappedMessage.versions ? 'YES' : 'NO'}, currentVersionIndex=${mappedMessage.currentVersionIndex !== undefined ? 'YES' : 'NO'}`);
          
          return mappedMessage;
        })
        
        totalMessages += sessionMessages.length

        cloudSessions.push({
          id: session.id,
          title: session.title,
          messages: sessionMessages,
          roleId: session.metadata?.roleId || 'default-assistant',
          modelId: session.metadata?.modelId || 'gpt-3.5-turbo',
          isHidden: session.is_hidden || false,
          isPinned: session.is_pinned || false,
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

      console.log(`💬 [同步步骤] 消息数据获取完成，共${totalMessages}条消息`);
      console.log(`🔀 [同步步骤] 开始合并本地和云端数据...`);
      
      // 智能合并本地和云端数据
      const mergedSessions = new Map<string, ChatSession>()
      
      // 先添加本地会话
      chatSessions.forEach(session => {
        mergedSessions.set(session.id, session)
      })
      
      // 智能合并云端会话
      cloudSessions.forEach(cloudSession => {
        const localSession = mergedSessions.get(cloudSession.id)
        
        if (!localSession) {
          // 如果本地没有这个会话，直接使用云端数据
          mergedSessions.set(cloudSession.id, cloudSession)
        } else {
          // 如果本地有这个会话，需要智能合并
          const localTime = safeGetTime(localSession.updatedAt)
          const cloudTime = safeGetTime(cloudSession.updatedAt)
          
          // 检查本地是否有更多消息（可能未同步）
          const localMessageCount = localSession.messages?.length || 0
          const cloudMessageCount = cloudSession.messages?.length || 0
          
          // 如果本地消息更多，说明有未同步的新消息，保留本地数据
          if (localMessageCount > cloudMessageCount) {
            // 修复：保留本地消息，但从云端获取正确的snowflake_id
            const mergedMessages = localSession.messages?.map(localMsg => {
              // 在云端消息中查找对应的消息
              const cloudMsg = cloudSession.messages?.find(cm => cm.id === localMsg.id);
              if (cloudMsg && cloudMsg.snowflake_id && !localMsg.snowflake_id) {
                return {
                  ...localMsg,
                  snowflake_id: cloudMsg.snowflake_id
                };
              } else if (cloudMsg && cloudMsg.snowflake_id && localMsg.snowflake_id && cloudMsg.snowflake_id !== localMsg.snowflake_id) {
                return {
                  ...localMsg,
                  snowflake_id: cloudMsg.snowflake_id
                };
              }
              return localMsg;
            }) || [];
            
            mergedSessions.set(cloudSession.id, {
              ...localSession,
              // 保留本地的消息但修复snowflake_id
              messages: mergedMessages,
              updatedAt: localSession.updatedAt
            })
          } else if (cloudTime > localTime) {
            // 如果云端时间更新且消息数量不少于本地，使用云端数据
            mergedSessions.set(cloudSession.id, cloudSession)
          }
          // 否则保留本地数据（已经在map中）
        }
      })

      const finalSessions = Array.from(mergedSessions.values())
        .sort((a, b) => safeGetTime(b.updatedAt) - safeGetTime(a.updatedAt))

      // 统计版本字段数据
      const allFinalMessages = finalSessions.flatMap(session => session.messages || []);
      const messagesWithVersionsFromCloud = allFinalMessages.filter(msg => msg.versions && msg.versions.length > 0);
      const messagesWithVersionIndexFromCloud = allFinalMessages.filter(msg => msg.currentVersionIndex !== undefined && msg.currentVersionIndex !== null);
      
      console.log('✅ 从云端同步完成！')
      console.log(`📊 同步统计: 共处理 ${finalSessions.length} 个会话`)
      const finalTotalMessages = finalSessions.reduce((sum, session) => sum + (session.messages?.length || 0), 0)
      console.log(`📊 同步统计: 共处理 ${finalTotalMessages} 条消息`)
      console.log(`📋 [版本统计] 从云端读取包含versions的消息: ${messagesWithVersionsFromCloud.length}条, 包含currentVersionIndex的消息: ${messagesWithVersionIndexFromCloud.length}条`);
      console.log('🔄 正在更新本地状态...')

      useAppStore.setState({ chatSessions: finalSessions })
      setLastSyncTime(new Date())
      setSyncing(false)
      
      console.log('✅ 从云端同步全部完成！')
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to sync from cloud'
      console.error('❌ 从云端同步失败:', errorMessage)
      console.error('🔍 错误详情:', error)
      
      // 如果是认证错误，不要继续重试
      if (errorMessage.includes('not authenticated') || errorMessage.includes('JWT')) {
        console.error('🔐 认证错误: 用户认证已过期')
        setSyncError('认证已过期，请重新登录')
        setSyncing(false)
        return
      }
      
      // 如果是网络错误且还有重试次数，则重试
      if (attempt < maxRetries && (errorMessage.includes('Failed to fetch') || errorMessage.includes('network') || errorMessage.includes('fetch'))) {
        console.warn(`🔄 网络错误，正在重试 (${attempt}/${maxRetries})...`)
        setTimeout(() => {
          syncFromCloud(attempt + 1)
        }, retryDelay)
        return
      }
      
      // 设置错误信息并停止同步
      console.error('💥 从云端同步最终失败，已停止重试')
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
  const queueDataSync = useCallback(async (type: 'llm_config' | 'ai_role' | 'global_prompt' | 'voice_settings' | 'user_profile', data: any) => {
    try {
      await dataSyncService.queueSync(type, data)
    } catch (error) {
      console.error('数据同步失败:', error)
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

  // Realtime 订阅管理函数
  const setupChatSessionsSubscription = useCallback(() => {
    if (!user?.id) {
      return
    }
    
    // 确保清理旧订阅
    if (chatSessionsChannelRef.current) {
      console.log('🧹 清理现有 chat_sessions 订阅后重新创建')
      chatSessionsChannelRef.current.unsubscribe()
      chatSessionsChannelRef.current = null
    }

    console.log('🔄 设置 chat_sessions 实时订阅...')
    console.log('🔍 用户ID:', user.id)
    console.log('🔍 Supabase 客户端状态:', supabase ? '已初始化' : '未初始化')
    
    try {
      const channel = supabase
        .channel(`chat_sessions_${user.id}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'chat_sessions',
            filter: `user_id=eq.${user.id}`
          },
        async (payload: RealtimePostgresChangesPayload<any>) => {
          console.log('📨 chat_sessions 实时更新:', payload)
          console.log('🔍 当前用户ID:', user.id)
          console.log('🔍 事件类型:', payload.eventType)
          
          try {
            const { eventType, new: newRecord, old: oldRecord } = payload
            
            switch (eventType) {
              case 'INSERT':
                if (newRecord) {
                  console.log('➕ 新增会话:', newRecord.id)
                  // 获取完整的会话数据（包括消息）
                  const { data: messages } = await supabase
                    .from('messages')
                    .select('*, snowflake_id::text')
                    .eq('session_id', newRecord.id)
                    .order('message_timestamp', { ascending: true })
                  
                  const sessionMessages: ChatMessage[] = (messages || []).map(msg => ({
                    id: msg.id,
                    role: msg.role as 'user' | 'assistant',
                    content: msg.content,
                    reasoningContent: msg.reasoning_content || undefined,
                    timestamp: new Date(msg.metadata?.timestamp || msg.message_timestamp),
                    message_timestamp: msg.message_timestamp,
                    snowflake_id: msg.snowflake_id,
                    roleId: msg.metadata?.roleId,
                    userProfileId: msg.metadata?.userProfileId,
                    // 从数据库读取版本管理字段
                    versions: msg.versions,
                    currentVersionIndex: msg.current_version_index
                  }))
                  
                  const newSession: ChatSession = {
                    id: newRecord.id,
                    title: newRecord.title,
                    messages: sessionMessages,
                    roleId: newRecord.metadata?.roleId || 'default-assistant',
                    modelId: newRecord.metadata?.modelId || 'gpt-3.5-turbo',
                    isHidden: newRecord.is_hidden || false,
                    isPinned: newRecord.is_pinned || false,
                    createdAt: new Date(newRecord.metadata?.createdAt || newRecord.created_at),
                    updatedAt: new Date(newRecord.metadata?.updatedAt || newRecord.updated_at)
                  }
                  
                  // 更新本地状态
                  const currentSessions = useAppStore.getState().chatSessions
                  const existingIndex = currentSessions.findIndex(s => s.id === newSession.id)
                  
                  if (existingIndex === -1) {
                    useAppStore.setState({
                      chatSessions: [newSession, ...currentSessions]
                    })
                  }
                }
                break
                
              case 'UPDATE':
                if (newRecord) {
                  console.log('✏️ 更新会话:', newRecord.id)
                  const currentSessions = useAppStore.getState().chatSessions
                  const updatedSessions = currentSessions.map(session => {
                    if (session.id === newRecord.id) {
                      return {
                        ...session,
                        title: newRecord.title,
                        isHidden: newRecord.is_hidden || false,
                        isPinned: newRecord.is_pinned || false,
                        updatedAt: new Date(newRecord.metadata?.updatedAt || newRecord.updated_at)
                      }
                    }
                    return session
                  })
                  
                  useAppStore.setState({ chatSessions: updatedSessions })
                }
                break
                
              case 'DELETE':
                if (oldRecord) {
                  console.log('🗑️ 删除会话:', oldRecord.id)
                  const currentSessions = useAppStore.getState().chatSessions
                  const filteredSessions = currentSessions.filter(s => s.id !== oldRecord.id)
                  useAppStore.setState({ chatSessions: filteredSessions })
                }
                break
            }
          } catch (error) {
            console.error('❌ 处理 chat_sessions 实时更新失败:', error)
          }
        }
      )
      .subscribe((status, err) => {
        console.log('📡 chat_sessions 订阅状态:', status)
        console.log('🔍 当前重试次数:', realtimeRetryCount)
        
        // 添加详细的错误诊断信息
        if (err) {
          console.error('❌ chat_sessions 订阅错误详情:', err)
          console.error('🔍 错误类型:', typeof err)
          console.error('🔍 错误消息:', err.message || '无错误消息')
          console.error('🔍 错误堆栈:', err.stack || '无错误堆栈')
          console.error('🔍 错误代码:', (err as any)?.code || '无错误代码')
          console.error('🔍 错误详情:', (err as any)?.details || '无错误详情')
          console.error('🔍 错误提示:', (err as any)?.hint || '无错误提示')
        }
        
        // 添加频道配置诊断
        console.log('🔍 频道名称:', `chat_sessions_${user.id}`)
        console.log('🔍 过滤器配置:', `user_id=eq.${user.id}`)
        console.log('🔍 表名:', 'chat_sessions')
        console.log('🔍 模式:', 'public')
        console.log('🔍 Supabase 客户端状态:', supabase ? '已初始化' : '未初始化')
        console.log('🔍 Realtime 配置:', supabase.realtime?.accessToken ? '已配置' : '未配置')
        
        // 特殊处理 CHANNEL_ERROR 状态
        if (status === 'CHANNEL_ERROR') {
          console.error('🚨 CHANNEL_ERROR 详细诊断:')
          console.error('🔍 可能原因: 1) RLS策略阻止访问 2) 表不存在 3) 权限不足 4) Realtime功能未启用')
          console.error('🔍 建议检查: 1) chat_sessions表的RLS策略 2) anon角色权限 3) Realtime功能状态')
          
          // 增强的错误诊断机制
          const performEnhancedDiagnostics = async () => {
            try {
              console.log('🔬 开始增强错误诊断...')
              
              // 1. Supabase 连接状态检查
              console.log('🔍 Supabase 连接诊断:')
              console.log('  - 客户端初始化:', supabase ? '✅ 已初始化' : '❌ 未初始化')
              console.log('  - Realtime 实例:', supabase.realtime ? '✅ 存在' : '❌ 不存在')
              console.log('  - Realtime 连接状态:', supabase.realtime?.isConnected() ? '✅ 已连接' : '❌ 未连接')
              console.log('  - Socket 状态:', '已连接')
              console.log('  - 访问令牌:', supabase.realtime?.accessToken ? '✅ 存在' : '❌ 缺失')
              
              // 2. 认证状态检查
              const { data: session, error: authError } = await supabase.auth.getSession()
              console.log('🔍 认证状态诊断:')
              console.log('  - 会话状态:', session ? '✅ 已认证' : '❌ 未认证')
              console.log('  - 用户ID:', session?.session?.user?.id || '无')
               console.log('  - 访问令牌:', session?.session?.access_token ? '✅ 存在' : '❌ 缺失')
              if (authError) {
                console.error('  - 认证错误:', authError)
              }
              
              // 3. 表访问权限测试
              console.log('🔍 表访问权限测试:')
              const tableTests = [
                { table: 'chat_sessions', operation: 'SELECT' },
                { table: 'messages', operation: 'SELECT' }
              ]
              
              for (const test of tableTests) {
                try {
                  const result = await supabase.from(test.table).select('count').limit(1)
                  console.log(`  - ${test.table} ${test.operation}:`, result.error ? '❌ 失败' : '✅ 成功')
                  if (result.error) {
                    console.error(`    错误详情:`, result.error.message)
                    console.error(`    错误代码:`, result.error.code)
                  }
                } catch (testError) {
                  console.error(`  - ${test.table} ${test.operation}: ❌ 异常`, testError)
                }
              }
              
              // 4. 网络质量评估
              console.log('🔍 网络质量评估:')
              console.log('  - 在线状态:', navigator.onLine ? '✅ 在线' : '❌ 离线')
              console.log('  - 连接类型:', (navigator as any).connection?.effectiveType || '未知')
              console.log('  - 下行速度:', (navigator as any).connection?.downlink || '未知')
              console.log('  - RTT:', (navigator as any).connection?.rtt || '未知')
              
              // 5. Realtime 频道状态检查
              console.log('🔍 Realtime 频道状态:')
              const channels = supabase.realtime?.channels || []
              console.log('  - 总频道数:', channels.length)
              channels.forEach((ch, index) => {
                console.log(`  - 频道 ${index + 1}:`, {
                  topic: ch.topic,
                  state: ch.state,
                  joinedAt: 'N/A',
                  timeout: ch.timeout
                })
              })
              
              // 6. 环境变量检查
              console.log('🔍 环境配置检查:')
              console.log('  - SUPABASE_URL:', import.meta.env.VITE_SUPABASE_URL ? '✅ 已配置' : '❌ 缺失')
              console.log('  - SUPABASE_ANON_KEY:', import.meta.env.VITE_SUPABASE_ANON_KEY ? '✅ 已配置' : '❌ 缺失')
              
              console.log('🔬 增强错误诊断完成')
              
            } catch (diagnosticError) {
              console.error('🔬 增强错误诊断失败:', diagnosticError)
            }
          }
          
          performEnhancedDiagnostics()
        }
        
        if (status === 'SUBSCRIBED') {
          setRealtimeConnected(true)
          setRealtimeRetryCount(0)
          setSubscriptionStatus(prev => ({ ...prev, chatSessions: 'SUBSCRIBED' }))
          console.log('✅ chat_sessions 实时订阅已建立')
          // 记录成功连接，重置连接质量统计
          connectionStatsRef.current.retryCount = 0
          connectionStatsRef.current.lastStabilityCheck = Date.now()
          setConnectionQuality('good')
          // 重置重建计数，订阅成功后允许重新开始智能重建
          rebuildAttempts.current.chatSessions = 0
          console.log('🔄 重置 chat_sessions 重建计数')
          // 停止降级轮询，因为实时订阅已成功
          stopFallbackPolling()
        } else if (status === 'CLOSED') {
          console.log('🔒 chat_sessions 订阅已关闭')
          setSubscriptionStatus(prev => ({ ...prev, chatSessions: 'CLOSED' }))
          setRealtimeConnected(false)
          
          // 检查是否是异常关闭（订阅刚建立就关闭）
          const now = Date.now()
          const timeSinceLastSuccess = now - (connectionStatsRef.current.lastStabilityCheck || 0)
          
          if (timeSinceLastSuccess < 30000) { // 30秒内关闭认为是异常
            console.warn('⚠️ 检测到异常关闭，可能需要重连')
            
            // 如果还有重试次数，尝试重连
            if (realtimeRetryCount < MAX_REALTIME_RETRIES && user?.id) {
              const calculateRetryDelay = () => {
                // 基础延迟根据错误类型调整
                let baseDelay = REALTIME_RETRY_DELAY
                const errorPriority = ERROR_PRIORITY[status] || 3
                
                // 根据连接质量调整
                if (connectionQuality === 'poor') {
                  baseDelay *= 3.5
                } else if (connectionQuality === 'unstable') {
                  baseDelay *= 2.2
                }
                
                // 指数退避算法，但限制在合理范围内
                const exponentialDelay = baseDelay * Math.pow(1.5, realtimeRetryCount)
                return Math.min(Math.max(exponentialDelay, MIN_RETRY_INTERVAL), MAX_RETRY_INTERVAL)
              }
              
              const retryDelay = calculateRetryDelay()
              console.log(`⏰ 将在 ${retryDelay}ms 后重试 chat_sessions 订阅（异常关闭恢复）`)
              
              realtimeRetryTimeoutRef.current = setTimeout(() => {
                console.log('🔄 重试 chat_sessions 订阅（从异常关闭恢复）')
                setRealtimeRetryCount(prev => prev + 1)
                cleanupChatSessionsSubscription()
                setupChatSessionsSubscription()
              }, retryDelay)
            } else {
              console.warn('⚠️ 启用 chatSessions 订阅降级策略（异常关闭后）')
              if (navigator.onLine && user?.id) {
                startFallbackPolling()
              }
            }
          } else {
            console.log('ℹ️ 正常关闭，清理重试定时器')
            if (realtimeRetryTimeoutRef.current) {
              clearTimeout(realtimeRetryTimeoutRef.current)
              realtimeRetryTimeoutRef.current = null
            }
          }
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          setRealtimeConnected(false)
          setSubscriptionStatus(prev => ({ ...prev, chatSessions: status }))
          console.error('❌ chat_sessions 订阅失败:', status)
          console.log('🔍 网络状态:', navigator.onLine ? '在线' : '离线')
          // 记录重连事件并评估连接质量
          recordRetryAttempt()
          
          // 智能重连逻辑
          if (realtimeRetryCount < MAX_REALTIME_RETRIES && navigator.onLine) {
            if (realtimeRetryTimeoutRef.current) {
              clearTimeout(realtimeRetryTimeoutRef.current)
            }
            
            // 计算智能重试延迟
            const calculateRetryDelay = () => {
              // 基础延迟根据错误类型调整
              let baseDelay = REALTIME_RETRY_DELAY
              const errorPriority = ERROR_PRIORITY[status] || 3
              
              // 错误优先级越高，延迟越短
              if (errorPriority === 1) { // CHANNEL_ERROR
                baseDelay *= 1.5
              } else if (errorPriority === 2) { // TIMED_OUT
                baseDelay *= 1.2
              }
              
              // 根据连接质量调整
              if (connectionQuality === 'poor') {
                baseDelay *= 3.5 // 与messages订阅保持一致
              } else if (connectionQuality === 'unstable') {
                baseDelay *= 2.2 // 与messages订阅保持一致
              }
              
              // 指数退避算法，但限制在合理范围内
              const exponentialDelay = baseDelay * Math.pow(1.5, realtimeRetryCount)
              return Math.min(Math.max(exponentialDelay, MIN_RETRY_INTERVAL), MAX_RETRY_INTERVAL)
            }
            
            const retryDelay = calculateRetryDelay()
            console.log(`⏰ 将在 ${retryDelay}ms 后重试 chat_sessions 订阅`)
            console.log(`🔍 重试参数: 错误=${status}, 质量=${connectionQuality}, 次数=${realtimeRetryCount + 1}/${MAX_REALTIME_RETRIES}`)
            
            realtimeRetryTimeoutRef.current = setTimeout(() => {
              console.log(`🔄 重试 chat_sessions 订阅 (${realtimeRetryCount + 1}/${MAX_REALTIME_RETRIES})`)
              setRealtimeRetryCount(prev => prev + 1)
              cleanupChatSessionsSubscription()
              setupChatSessionsSubscription()
            }, retryDelay)
          } else {
            console.error('🚫 chat_sessions 订阅重试次数已达上限或网络离线')
            // 启用降级策略（轮询机制）
            if (navigator.onLine && user?.id) {
              console.warn('⚠️ 启用 chatSessions 订阅降级策略（轮询机制）')
              startFallbackPolling()
            }
          }
        }
      })
    
      chatSessionsChannelRef.current = channel
    } catch (error) {
      console.error('❌ 创建 chat_sessions 订阅时发生错误:', error)
      // 如果创建订阅失败，尝试重连
      if (realtimeRetryCount < MAX_REALTIME_RETRIES) {
        setTimeout(() => {
          console.log(`🔄 重试创建 chat_sessions 订阅 (${realtimeRetryCount + 1}/${MAX_REALTIME_RETRIES})`)
          setRealtimeRetryCount(prev => prev + 1)
          setupChatSessionsSubscription()
        }, REALTIME_RETRY_DELAY)
      }
    }
  }, [user?.id, realtimeRetryCount])

  // 清理 chat_sessions 订阅
  const cleanupChatSessionsSubscription = useCallback(() => {
    if (chatSessionsChannelRef.current) {
      console.log('🧹 清理 chat_sessions 订阅')
      chatSessionsChannelRef.current.unsubscribe()
      chatSessionsChannelRef.current = null
    }
    
    if (realtimeRetryTimeoutRef.current) {
      clearTimeout(realtimeRetryTimeoutRef.current)
      realtimeRetryTimeoutRef.current = null
    }
    
    setRealtimeConnected(false)
    setRealtimeRetryCount(0)
    setSubscriptionStatus(prev => ({ ...prev, chatSessions: 'DISCONNECTED' }))
  }, [])

  // Messages 订阅管理函数
  const setupMessagesSubscription = useCallback(() => {
    if (!user?.id) {
      return
    }
    
    // 确保清理旧订阅
    if (messagesChannelRef.current) {
      console.log('🧹 清理现有 messages 订阅后重新创建')
      messagesChannelRef.current.unsubscribe()
      messagesChannelRef.current = null
    }

    console.log('🔄 设置 messages 实时订阅...')
    console.log('🔍 用户ID:', user.id)
    console.log('🔍 Supabase 客户端状态:', supabase ? '已初始化' : '未初始化')
    console.log('🔍 当前重试次数:', realtimeRetryCount)
    
    // 清理之前的重试定时器
    if (realtimeRetryTimeoutRef.current) {
      clearTimeout(realtimeRetryTimeoutRef.current)
      realtimeRetryTimeoutRef.current = null
    }
    
    try {
      // 获取当前用户的会话列表
      const currentSessions = useAppStore.getState().chatSessions
      const sessionIds = currentSessions.map(s => s.id)
      
      console.log('🔍 当前会话数量:', sessionIds.length)
      console.log('🔍 会话IDs:', sessionIds)
      
      // 如果没有会话，延迟订阅直到有会话为止
      if (sessionIds.length === 0) {
        console.log('⏳ 没有会话，延迟创建messages订阅')
        setSubscriptionStatus(prev => ({ ...prev, messages: 'PENDING' }))
        
        // 5秒后重试，给会话加载一些时间
        setTimeout(() => {
          if (user?.id) {
            console.log('🔄 重试创建messages订阅')
            setupMessagesSubscription()
          }
        }, 5000)
        return
      }
      
      const messagesFilter = `session_id=in.(${sessionIds.join(',')})`
      console.log('🔍 messages 过滤器:', messagesFilter)
      
      const channel = supabase
        .channel(`messages_${user.id}`) // 使用固定频道名，避免重复创建
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'messages',
            filter: messagesFilter
          },
        async (payload: RealtimePostgresChangesPayload<any>) => {
          console.log('📨 messages 实时更新:', payload)
          console.log('🔍 当前用户ID:', user.id)
          console.log('🔍 事件类型:', payload.eventType)
          
          try {
            const { eventType, new: newRecord, old: oldRecord } = payload
            
            // 客户端过滤：检查消息所属的会话是否属于当前用户
            const currentSessions = useAppStore.getState().chatSessions
            const sessionId = (newRecord as any)?.session_id || (oldRecord as any)?.session_id
            console.log('🔍 消息会话ID:', sessionId)
            console.log('🔍 当前用户会话数量:', currentSessions.length)
            console.log('🔍 当前用户会话IDs:', currentSessions.map(s => s.id))
            
            const isUserSession = currentSessions.some(session => session.id === sessionId)
            console.log('🔍 是否属于当前用户会话:', isUserSession)
            
            if (!isUserSession) {
              console.log('🚫 跳过非当前用户的消息更新:', sessionId)
              return
            }
            
            switch (eventType) {
              case 'INSERT':
                if (newRecord) {
                  console.log('➕ 新增消息:', newRecord.id, '会话:', newRecord.session_id)
                  
                  // 详细记录版本字段的实时订阅插入情况
                  console.log('📊 实时订阅 INSERT - 版本字段详情:')
                  console.log('  - versions (数据库):', newRecord.versions)
                  console.log('  - current_version_index (数据库):', newRecord.current_version_index)
                  console.log('  - versions 类型:', typeof newRecord.versions, '值:', newRecord.versions === null ? 'NULL' : newRecord.versions === undefined ? 'UNDEFINED' : '有值')
                  console.log('  - current_version_index 类型:', typeof newRecord.current_version_index, '值:', newRecord.current_version_index === null ? 'NULL' : newRecord.current_version_index === undefined ? 'UNDEFINED' : '有值')
                  
                  const newMessage: ChatMessage = {
                    id: newRecord.id,
                    role: newRecord.role as 'user' | 'assistant',
                    content: newRecord.content,
                    reasoningContent: newRecord.reasoning_content || undefined,
                    timestamp: new Date(newRecord.metadata?.timestamp || newRecord.message_timestamp),
                    message_timestamp: newRecord.message_timestamp,
                    snowflake_id: newRecord.snowflake_id,
                    roleId: newRecord.metadata?.roleId,
                    userProfileId: newRecord.metadata?.userProfileId,
                    // 实时订阅中的版本管理字段 - 确保有默认值
                    versions: newRecord.versions || [newRecord.content || ''],
                    currentVersionIndex: newRecord.current_version_index !== undefined && newRecord.current_version_index !== null ? newRecord.current_version_index : 0
                  }
                  
                  // 记录映射后的版本字段
                  console.log('📊 实时订阅 INSERT - 映射后版本字段:')
                  console.log('  - versions (本地):', newMessage.versions)
                  console.log('  - currentVersionIndex (本地):', newMessage.currentVersionIndex)
                  
                  // 更新对应会话的消息列表
                  const currentSessions = useAppStore.getState().chatSessions
                  const updatedSessions = currentSessions.map(session => {
                    if (session.id === newRecord.session_id) {
                      const existingMessageIndex = session.messages.findIndex(m => m.id === newMessage.id)
                      
                      if (existingMessageIndex === -1) {
                        // 按 message_timestamp 排序插入新消息
                        const updatedMessages = [...session.messages, newMessage]
                          .sort((a, b) => new Date(a.message_timestamp).getTime() - new Date(b.message_timestamp).getTime())
                        
                        return {
                          ...session,
                          messages: updatedMessages,
                          updatedAt: new Date()
                        }
                      }
                    }
                    return session
                  })
                  
                  useAppStore.setState({ chatSessions: updatedSessions })
                }
                break
                
              case 'UPDATE':
                if (newRecord) {
                  console.log('✏️ 更新消息:', newRecord.id, '会话:', newRecord.session_id)
                  
                  // 详细记录版本字段的实时订阅更新情况
                  console.log('📊 实时订阅 - 版本字段详情:')
                  console.log('  - versions (数据库):', newRecord.versions)
                  console.log('  - current_version_index (数据库):', newRecord.current_version_index)
                  console.log('  - versions 类型:', typeof newRecord.versions, '值:', newRecord.versions === null ? 'NULL' : newRecord.versions === undefined ? 'UNDEFINED' : '有值')
                  console.log('  - current_version_index 类型:', typeof newRecord.current_version_index, '值:', newRecord.current_version_index === null ? 'NULL' : newRecord.current_version_index === undefined ? 'UNDEFINED' : '有值')
                  
                  const updatedMessage: ChatMessage = {
                    id: newRecord.id,
                    role: newRecord.role as 'user' | 'assistant',
                    content: newRecord.content,
                    reasoningContent: newRecord.reasoning_content || undefined,
                    timestamp: new Date(newRecord.metadata?.timestamp || newRecord.message_timestamp),
                    message_timestamp: newRecord.message_timestamp,
                    snowflake_id: newRecord.snowflake_id,
                    roleId: newRecord.metadata?.roleId,
                    userProfileId: newRecord.metadata?.userProfileId,
                    // 实时订阅中的版本管理字段 - 确保有默认值
                    versions: newRecord.versions || [newRecord.content || ''],
                    currentVersionIndex: newRecord.current_version_index !== undefined && newRecord.current_version_index !== null ? newRecord.current_version_index : 0
                  }
                  
                  // 记录映射后的版本字段
                  console.log('📊 实时订阅 - 映射后版本字段:')
                  console.log('  - versions (本地):', updatedMessage.versions)
                  console.log('  - currentVersionIndex (本地):', updatedMessage.currentVersionIndex)
                  
                  // 更新对应会话中的消息
                  const currentSessions = useAppStore.getState().chatSessions
                  const updatedSessions = currentSessions.map(session => {
                    if (session.id === newRecord.session_id) {
                      const updatedMessages = session.messages.map(message => {
                        if (message.id === updatedMessage.id) {
                          return updatedMessage
                        }
                        return message
                      })
                      
                      return {
                        ...session,
                        messages: updatedMessages,
                        updatedAt: new Date()
                      }
                    }
                    return session
                  })
                  
                  useAppStore.setState({ chatSessions: updatedSessions })
                }
                break
                
              case 'DELETE':
                if (oldRecord) {
                  console.log('🗑️ 删除消息:', oldRecord.id, '会话:', oldRecord.session_id)
                  
                  // 从对应会话中删除消息
                  const currentSessions = useAppStore.getState().chatSessions
                  const updatedSessions = currentSessions.map(session => {
                    if (session.id === oldRecord.session_id) {
                      const filteredMessages = session.messages.filter(m => m.id !== oldRecord.id)
                      
                      return {
                        ...session,
                        messages: filteredMessages,
                        updatedAt: new Date()
                      }
                    }
                    return session
                  })
                  
                  useAppStore.setState({ chatSessions: updatedSessions })
                }
                break
            }
          } catch (error) {
            console.error('❌ 处理 messages 实时更新失败:', error)
          }
        }
      )
      .subscribe((status) => {
        console.log('📡 messages 订阅状态:', status)
        console.log('🔍 当前重试次数:', realtimeRetryCount)
        console.log('🔍 订阅频道引用:', messagesChannelRef.current ? '存在' : '不存在')
        
        if (status === 'SUBSCRIBED') {
          console.log('✅ messages 实时订阅已建立')
          setRealtimeRetryCount(0) // 重置重试计数
          setSubscriptionStatus(prev => ({ ...prev, messages: 'SUBSCRIBED' }))
          setRealtimeConnected(true)
          // 记录成功连接，重置连接质量统计
          connectionStatsRef.current.retryCount = 0
          connectionStatsRef.current.lastStabilityCheck = Date.now()
          setConnectionQuality('good')
          // 重置重建计数，订阅成功后允许重新开始智能重建
          rebuildAttempts.current.messages = 0
          console.log('🔄 重置 messages 重建计数')
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.error('❌ messages 订阅失败:', status)
          setSubscriptionStatus(prev => ({ ...prev, messages: status }))
          setRealtimeConnected(false)
          console.log('🔍 网络状态:', navigator.onLine ? '在线' : '离线')
          // recordReconnectionEvent() // 临时注释，避免编译错误
          
          // 增强的错误诊断机制
          if (status === 'CHANNEL_ERROR') {
            console.log('🔍 频道名称:', channel.topic)
            console.log('🔍 过滤器配置:', sessionIds.length > 0 ? `session_id=in.(${sessionIds.join(',')})` : 'session_id=eq.00000000-0000-0000-0000-000000000000')
            console.log('🔍 表名: messages')
            console.log('🔍 模式: public')
            console.log('🔍 Supabase 客户端状态:', supabase ? '已初始化' : '未初始化')
            console.log('🔍 Realtime 配置:', supabase?.realtime ? '已配置' : '未配置')
            
            console.log('🚨 CHANNEL_ERROR 详细诊断:')
            console.log('🔍 可能原因: 1) RLS策略阻止访问 2) 表不存在 3) 权限不足 4) Realtime功能未启用')
            console.log('🔍 建议检查: 1) messages表的RLS策略 2) anon角色权限 3) Realtime功能状态')
            
            // 执行增强诊断检查
            Promise.all([
              // 检查Supabase连接状态
              supabase?.auth.getSession().then(({ data: { session } }) => {
                console.log('🔍 认证状态:', session ? '已认证' : '未认证')
                console.log('🔍 用户ID:', session?.user?.id || '无')
                return session
              }).catch((err: any) => {
                console.error('❌ 认证状态检查失败:', err)
                return null
              }),
              
              // 检查messages表访问权限
              Promise.resolve(supabase?.from('messages').select('count', { count: 'exact', head: true })).then((result) => {
                if (!result) return false
                const { error, count } = result
                if (error) {
                  console.error('❌ messages表访问测试失败:', error.message)
                  return false
                } else {
                  console.log('🔍 messages表访问测试结果: 成功')
                  console.log('🔍 messages表记录数:', count)
                  return true
                }
              }).catch((err: any) => {
                console.error('❌ messages表访问测试异常:', err)
                return false
              }),
              
              // 网络质量评估
              fetch(window.location.origin, { method: 'HEAD' }).then(() => {
                console.log('🔍 网络质量: 良好')
                return true
              }).catch(() => {
                console.log('🔍 网络质量: 差')
                return false
              }),
              
              // 检查Realtime频道状态
              Promise.resolve().then(() => {
                const channels = supabase?.realtime?.channels || []
                console.log('🔍 当前Realtime频道数:', channels.length)
                console.log('🔍 Realtime连接状态:', supabase?.realtime?.isConnected() || false)
                return channels.length
              }),
              
              // 检查环境变量配置
              Promise.resolve().then(() => {
                const hasUrl = !!import.meta.env.VITE_SUPABASE_URL
                const hasAnonKey = !!import.meta.env.VITE_SUPABASE_ANON_KEY
                console.log('🔍 环境变量配置:')
                console.log('  - VITE_SUPABASE_URL:', hasUrl ? '已配置' : '未配置')
                console.log('  - VITE_SUPABASE_ANON_KEY:', hasAnonKey ? '已配置' : '未配置')
                return hasUrl && hasAnonKey
              })
            ]).then(([session, tableAccess, networkOk, channelCount, envOk]) => {
              console.log('🔍 诊断结果汇总:')
              console.log('  - 认证状态:', session ? '✅' : '❌')
              console.log('  - 表访问权限:', tableAccess ? '✅' : '❌')
              console.log('  - 网络连接:', networkOk ? '✅' : '❌')
              console.log('  - Realtime频道:', channelCount, '个')
              console.log('  - 环境配置:', envOk ? '✅' : '❌')
              
              if (!tableAccess) {
                console.log('💡 建议: 检查messages表的RLS策略和anon角色权限')
              }
              if (!networkOk) {
                console.log('💡 建议: 检查网络连接和Supabase服务状态')
              }
              if (!envOk) {
                console.log('💡 建议: 检查环境变量配置')
              }
            }).catch(err => {
              console.error('❌ 诊断检查失败:', err)
            })
          }
          
          // 检查最小重试间隔，防止过于频繁的重连
          const now = Date.now()
          const timeSinceLastRetry = now - lastRetryAttemptRef.current
          
          // 只有在真正的错误情况下才重连，避免正常关闭时的重连
          if (realtimeRetryCount < MAX_REALTIME_RETRIES && navigator.onLine && messagesChannelRef.current && timeSinceLastRetry >= MIN_RETRY_INTERVAL) {
            // 智能指数退避算法
            const calculateRetryDelay = () => {
              // 基础延迟根据错误类型调整
              let baseDelay = REALTIME_RETRY_DELAY
              const errorPriority = ERROR_PRIORITY[status] || 1
              baseDelay *= errorPriority
              
              // 指数退避：每次重试延迟翻倍
              const exponentialDelay = baseDelay * Math.pow(2, realtimeRetryCount)
              
              // 根据连接质量进一步调整
              let qualityMultiplier = 1
              if (connectionQuality === 'poor') {
                qualityMultiplier = 3.5 // 增加poor质量的延迟乘数
              } else if (connectionQuality === 'unstable') {
                qualityMultiplier = 2.2 // 增加unstable质量的延迟乘数
              }
              
              const finalDelay = exponentialDelay * qualityMultiplier
              
              // 限制在合理范围内
              return Math.min(Math.max(finalDelay, MIN_RETRY_INTERVAL), MAX_RETRY_INTERVAL)
            }
            
            const retryDelay = calculateRetryDelay()
            console.log(`⏰ 将在 ${retryDelay}ms 后重试 messages 订阅 (连接质量: ${connectionQuality})`)
            console.log(`🔍 重试参数: 错误=${status}, 质量=${connectionQuality}, 次数=${realtimeRetryCount + 1}/${MAX_REALTIME_RETRIES}`)
            
            // 清理之前的重试定时器，防止重复重试
            if (realtimeRetryTimeoutRef.current) {
              clearTimeout(realtimeRetryTimeoutRef.current)
              realtimeRetryTimeoutRef.current = null
            }
            
            realtimeRetryTimeoutRef.current = setTimeout(() => {
              // 再次检查是否仍需要重连
              if (messagesChannelRef.current && user?.id) {
                lastRetryAttemptRef.current = Date.now() // 更新重试时间
                console.log(`🔄 重试 messages 订阅 (${realtimeRetryCount + 1}/${MAX_REALTIME_RETRIES})`)
                setRealtimeRetryCount(prev => prev + 1)
                cleanupMessagesSubscription()
                setupMessagesSubscription()
              }
            }, retryDelay)
          } else {
            if (timeSinceLastRetry < MIN_RETRY_INTERVAL) {
              console.log(`⏸️ 距离上次重试时间过短 (${timeSinceLastRetry}ms < ${MIN_RETRY_INTERVAL}ms)，跳过重试`)
            } else {
              console.error('🚫 messages 订阅重试次数已达上限或网络离线')
            }
          }
        } else if (status === 'CLOSED') {
          console.log('🔒 messages 订阅已关闭')
          setSubscriptionStatus(prev => ({ ...prev, messages: 'CLOSED' }))
          setRealtimeConnected(false)
          // CLOSED 状态通常是正常关闭，不需要自动重连
          // 清理重试定时器，避免不必要的重连
          if (realtimeRetryTimeoutRef.current) {
            clearTimeout(realtimeRetryTimeoutRef.current)
            realtimeRetryTimeoutRef.current = null
          }
        }
      })
    
      messagesChannelRef.current = channel
    } catch (error) {
      console.error('❌ 创建 messages 订阅时发生错误:', error)
      setSubscriptionStatus(prev => ({ ...prev, messages: 'CHANNEL_ERROR' }))
      setRealtimeConnected(false)
      
      // 检查最小重试间隔，防止过于频繁的重连
      const now = Date.now()
      const timeSinceLastRetry = now - lastRetryAttemptRef.current
      
      // 如果创建订阅失败，尝试重连
          if (realtimeRetryCount < MAX_REALTIME_RETRIES && user?.id && timeSinceLastRetry >= MIN_RETRY_INTERVAL) {
            // 智能指数退避算法
            const calculateRetryDelay = () => {
              // 基础延迟
              let baseDelay = REALTIME_RETRY_DELAY
              
              // 指数退避：每次重试延迟翻倍
              const exponentialDelay = baseDelay * Math.pow(2, realtimeRetryCount)
              
              // 根据连接质量进一步调整
              let qualityMultiplier = 1
              if (connectionQuality === 'poor') {
                qualityMultiplier = 3.5 // 增加poor质量的延迟乘数
              } else if (connectionQuality === 'unstable') {
                qualityMultiplier = 2.2 // 增加unstable质量的延迟乘数
              }
              
              const finalDelay = exponentialDelay * qualityMultiplier
              
              // 限制在合理范围内
              return Math.min(Math.max(finalDelay, MIN_RETRY_INTERVAL), MAX_RETRY_INTERVAL)
            }
            
            const retryDelay = calculateRetryDelay()
            console.log(`⏰ ${retryDelay}ms 后重试创建 messages 订阅 (连接质量: ${connectionQuality})`)
            console.log(`🔍 重试参数: 质量=${connectionQuality}, 次数=${realtimeRetryCount + 1}/${MAX_REALTIME_RETRIES}`)
        
        // 清理之前的重试定时器，防止重复重试
        if (realtimeRetryTimeoutRef.current) {
          clearTimeout(realtimeRetryTimeoutRef.current)
          realtimeRetryTimeoutRef.current = null
        }
        
        realtimeRetryTimeoutRef.current = setTimeout(() => {
          if (user?.id) { // 再次确认用户仍然登录
            lastRetryAttemptRef.current = Date.now() // 更新重试时间
            console.log(`🔄 重试创建 messages 订阅 (${realtimeRetryCount + 1}/${MAX_REALTIME_RETRIES})`)
            setRealtimeRetryCount(prev => prev + 1)
            setupMessagesSubscription()
          }
        }, retryDelay)
      } else if (timeSinceLastRetry < MIN_RETRY_INTERVAL) {
        console.log(`⏸️ 距离上次重试时间过短 (${timeSinceLastRetry}ms < ${MIN_RETRY_INTERVAL}ms)，跳过重试`)
      }
    }
  }, [user?.id, realtimeRetryCount])

  // 清理 messages 订阅
  const cleanupMessagesSubscription = useCallback(() => {
    console.log('🧹 清理 messages 订阅')
    
    // 清理重试定时器
    if (realtimeRetryTimeoutRef.current) {
      clearTimeout(realtimeRetryTimeoutRef.current)
      realtimeRetryTimeoutRef.current = null
      console.log('🧹 已清理重试定时器')
    }
    
    // 清理订阅频道
    if (messagesChannelRef.current) {
      try {
        messagesChannelRef.current.unsubscribe()
        console.log('🧹 已取消订阅 messages 频道')
      } catch (error) {
        console.warn('⚠️ 取消订阅时发生错误:', error)
      } finally {
        messagesChannelRef.current = null
      }
    }
    
    // 更新订阅状态
    setSubscriptionStatus(prev => ({ ...prev, messages: 'DISCONNECTED' }))
    setRealtimeConnected(false)
  }, [])

  // 启动所有实时订阅
  const startRealtimeSubscriptions = useCallback(() => {
    if (!user?.id) {
      console.log('⚠️ 用户未登录，跳过实时订阅启动')
      return
    }
    
    // 检查配置开关，如果禁用则跳过Realtime订阅
    if (!ENABLE_REALTIME_SUBSCRIPTIONS) {
      console.log('⚠️ Realtime订阅已禁用，跳过启动')
      return
    }
    
    console.log('🚀 启动实时订阅...')
    setupChatSessionsSubscription()
    setupMessagesSubscription()
  }, [user?.id]) // 移除函数依赖，避免无限循环重建订阅

  // 清理所有实时订阅
  const cleanupAllRealtimeSubscriptions = useCallback(() => {
    console.log('🧹 清理所有实时订阅')
    cleanupChatSessionsSubscription()
    cleanupMessagesSubscription()
    
    // 停止连接健康检查
    stopConnectionHealthCheck()
    
    // 停止连接稳定性检查
    stopStabilityCheck()
    
    // 停止降级轮询
    stopFallbackPolling()
    
    // 重置连接状态
    setRealtimeConnected(false)
    setSubscriptionStatus({
      chatSessions: 'DISCONNECTED',
      messages: 'DISCONNECTED'
    })
  }, [cleanupChatSessionsSubscription, cleanupMessagesSubscription, stopConnectionHealthCheck])

  // 监听用户登录状态变化，管理订阅生命周期
  useEffect(() => {
    if (user?.id) {
      // 用户已登录，根据配置决定是否启动实时订阅
      if (ENABLE_REALTIME_SUBSCRIPTIONS) {
        console.log('👤 用户已登录，启动实时订阅')
        startRealtimeSubscriptions()
        // 启动连接健康检查
        startConnectionHealthCheck()
        // 启动连接稳定性检查
        startStabilityCheck()
      } else {
        console.log('👤 用户已登录，但Realtime订阅已禁用')
      }
    } else {
      // 用户未登录或已登出，清理所有订阅
      console.log('👤 用户已登出，清理实时订阅')
      cleanupAllRealtimeSubscriptions()
    }

    // 组件卸载时清理订阅
    return () => {
      cleanupAllRealtimeSubscriptions()
    }
  }, [user?.id]) // 只依赖user?.id，避免函数依赖导致的无限循环

  // 防抖同步引用
  const debouncedSyncFromCloud = useRef<NodeJS.Timeout | null>(null)
  const debouncedSyncToCloud = useRef<NodeJS.Timeout | null>(null)
  const lastSyncFromCloudTime = useRef<number>(0)
  const lastSyncToCloudTime = useRef<number>(0)

  // 检查是否有消息正在流式输出
  const hasStreamingMessages = useCallback(() => {
    const streamingMessages = chatSessions.flatMap(session => 
      session.messages?.filter(message => message.isStreaming) || []
    )
    const hasStreaming = streamingMessages.length > 0
    return hasStreaming
  }, [chatSessions])

  // 检查是否有本地未同步的数据
  const hasUnsyncedLocalData = useCallback(() => {
    const now = Date.now()
    const recentThreshold = 30000 // 30秒内的数据认为可能未同步
    
    return chatSessions.some(session => {
      // 检查会话是否在最近30秒内有更新
      const sessionTime = session.updatedAt ? new Date(session.updatedAt).getTime() : 0
      if (now - sessionTime < recentThreshold) {
        return true
      }
      
      // 检查是否有最近的消息
      return session.messages?.some(message => {
        const messageTime = message.timestamp ? new Date(message.timestamp).getTime() : 0
        return now - messageTime < recentThreshold
      })
    })
  }, [chatSessions])

  // 防抖的云端同步函数
  const debouncedSyncFromCloudFn = useCallback(() => {
    const now = Date.now()
    const timeSinceLastSync = now - lastSyncFromCloudTime.current
    
    // 如果距离上次同步不足10秒，则跳过
    if (timeSinceLastSync < 10000) {
      return
    }
    
    // 如果有本地未同步的数据，延迟从云端拉取
    if (hasUnsyncedLocalData()) {
      return
    }
    
    // 如果有消息正在流式输出，跳过
    if (hasStreamingMessages()) {
      return
    }
    
    if (debouncedSyncFromCloud.current) {
      clearTimeout(debouncedSyncFromCloud.current)
    }
    
    debouncedSyncFromCloud.current = setTimeout(() => {
      lastSyncFromCloudTime.current = Date.now()
      syncFromCloud()
    }, 1000)
  }, [syncFromCloud, hasUnsyncedLocalData, hasStreamingMessages])

  // 防抖的云端上传函数
  const debouncedSyncToCloudFn = useCallback(() => {
    const now = Date.now()
    const timeSinceLastSync = now - lastSyncToCloudTime.current
    
    // 减少时间间隔限制，从8秒改为3秒
    if (timeSinceLastSync < 3000) {
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
    }, 1000) // 减少延迟时间，从2秒改为1秒
  }, [syncToCloud, hasStreamingMessages, chatSessions.length])

  // 自动同步效果
  useEffect(() => {
    if (!user?.id || !autoSyncEnabled) {
      return
    }

    // 优先同步本地数据到云端
    const currentSessions = useAppStore.getState().chatSessions
    if (currentSessions.length > 0) {
      setTimeout(() => {
        debouncedSyncToCloudFn()
      }, 1000)
    }

    // 延迟从云端同步，确保本地数据先上传
    const initialSyncTimeout = setTimeout(() => {
      debouncedSyncFromCloudFn()
    }, 10000) // 延长到10秒，给本地数据上传更多时间

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
  }, [user?.id, autoSyncEnabled])



  // 用于跟踪上一次的会话状态，检测消息完成
  const prevSessionsRef = useRef<string>('')
  
  // 用于跟踪消息完成状态的引用
  const messageCompletionTracker = useRef<Map<string, { isStreaming: boolean; lastUpdate: number }>>(new Map())
  
  // 检测消息是否刚刚完成（从streaming变为非streaming状态）
   const checkMessageCompletion = useCallback(() => {
     const currentSessionsData = chatSessions.map(s => ({
       id: s.id,
       messageCount: s.messages?.length || 0,
       lastMessageId: s.messages?.[s.messages.length - 1]?.id,
       lastMessageIsStreaming: s.messages?.[s.messages.length - 1]?.isStreaming || false,
       lastMessageContent: s.messages?.[s.messages.length - 1]?.content?.slice(0, 50) || '',
       lastMessageRole: s.messages?.[s.messages.length - 1]?.role
     }))
     
     const currentSessionsStr = JSON.stringify(currentSessionsData)
     const hasChanged = prevSessionsRef.current !== currentSessionsStr
     const hasStreamingNow = hasStreamingMessages()
     
     let hasMessageCompleted = false
     const now = Date.now()
     
     // 使用更可靠的消息完成检测机制
     for (const sessionData of currentSessionsData) {
       if (sessionData.lastMessageId && sessionData.lastMessageRole === 'assistant') {
         const messageKey = `${sessionData.id}-${sessionData.lastMessageId}`
         const prevState = messageCompletionTracker.current.get(messageKey)
         
         // 更新当前状态
         messageCompletionTracker.current.set(messageKey, {
           isStreaming: sessionData.lastMessageIsStreaming,
           lastUpdate: now
         })
         
         // 检测从streaming到非streaming的转换
         if (prevState && prevState.isStreaming && !sessionData.lastMessageIsStreaming) {
           console.log('🎯 检测到AI消息完成:', {
             sessionId: sessionData.id,
             messageId: sessionData.lastMessageId,
             prevStreaming: prevState.isStreaming,
             currentStreaming: sessionData.lastMessageIsStreaming,
             timeSinceLastUpdate: now - prevState.lastUpdate
           })
           hasMessageCompleted = true
         }
       }
     }
     
     // 清理过期的跟踪记录（超过5分钟的记录）
     const fiveMinutesAgo = now - 5 * 60 * 1000
     for (const [key, state] of messageCompletionTracker.current.entries()) {
       if (state.lastUpdate < fiveMinutesAgo) {
         messageCompletionTracker.current.delete(key)
       }
     }
     
     // 兼容原有的检测逻辑作为备用
     if (!hasMessageCompleted && prevSessionsRef.current && hasChanged) {
       try {
         const prevData = JSON.parse(prevSessionsRef.current)
         for (let i = 0; i < currentSessionsData.length; i++) {
           const current = currentSessionsData[i]
           const prev = prevData.find((p: any) => p.id === current.id)
           if (prev && prev.lastMessageIsStreaming && !current.lastMessageIsStreaming && current.lastMessageRole === 'assistant') {
             console.log('🔄 备用检测机制触发AI消息完成:', {
               sessionId: current.id,
               messageId: current.lastMessageId
             })
             hasMessageCompleted = true
             break
           }
         }
       } catch (e) {
         console.warn('⚠️ 备用检测机制出错:', e)
       }
     }
     
     prevSessionsRef.current = currentSessionsStr
     return hasMessageCompleted
   }, [chatSessions, hasStreamingMessages])

  // 备用同步机制：检查是否有未同步的AI消息
  const checkForUnsyncedAIMessages = useCallback(async () => {
    if (!user?.id || syncing) {
      return false
    }
    
    try {
      // 查找所有非流式状态的AI消息
      const aiMessages = chatSessions.flatMap(session => 
        session.messages
          .filter(msg => msg.role === 'assistant' && !msg.isStreaming)
          .map(msg => ({ ...msg, sessionId: session.id }))
      )
      
      if (aiMessages.length === 0) {
        return false
      }
      
      // 检查数据库中是否存在这些消息
      const messageIds = aiMessages.map(msg => msg.id)
      const { data: dbMessages, error } = await supabase
        .from('messages')
        .select('id')
        .in('id', messageIds)
      
      if (error) {
        console.error('❌ 备用同步检查数据库失败:', error)
        return false
      }
      
      const dbMessageIds = new Set(dbMessages?.map(msg => msg.id) || [])
      const unsyncedMessages = aiMessages.filter(msg => !dbMessageIds.has(msg.id))
      
      if (unsyncedMessages.length > 0) {
        console.warn('⚠️ 发现未同步的AI消息:', {
          count: unsyncedMessages.length,
          messages: unsyncedMessages.map(msg => ({
            id: msg.id,
            sessionId: msg.sessionId,
            content: msg.content.slice(0, 50) + '...'
          }))
        })
        return true
      }
      
      return false
    } catch (error) {
      console.error('❌ 备用同步检查失败:', error)
      return false
    }
  }, [user?.id, syncing, chatSessions])
  
  // 检测是否有新的用户消息需要立即同步
  const checkForNewUserMessages = useCallback(() => {
    const currentSessionsData = chatSessions.map(s => ({
      id: s.id,
      messageCount: s.messages?.length || 0,
      lastMessageId: s.messages?.[s.messages.length - 1]?.id,
      lastMessageRole: s.messages?.[s.messages.length - 1]?.role,
      lastMessageIsStreaming: s.messages?.[s.messages.length - 1]?.isStreaming || false
    }))
    
    const currentSessionsStr = JSON.stringify(currentSessionsData)
    const hasChanged = prevSessionsRef.current !== currentSessionsStr
    
    // 检查是否有新的用户消息
    let hasNewUserMessage = false
    if (prevSessionsRef.current && hasChanged) {
      try {
        const prevData = JSON.parse(prevSessionsRef.current)
        for (let i = 0; i < currentSessionsData.length; i++) {
          const current = currentSessionsData[i]
          const prev = prevData.find((p: any) => p.id === current.id)
          
          // 检查是否有新消息且最后一条是用户消息
          if (prev && current.messageCount > prev.messageCount && 
              current.lastMessageRole === 'user' && !current.lastMessageIsStreaming) {
            hasNewUserMessage = true
            console.log('🔍 检测到新的用户消息，需要立即同步:', {
              sessionId: current.id,
              messageId: current.lastMessageId,
              prevCount: prev.messageCount,
              currentCount: current.messageCount
            })
            break
          }
        }
      } catch (e) {
        console.warn('⚠️ 检查新用户消息时出错:', e)
      }
    }
    
    return hasNewUserMessage
  }, [chatSessions])

  // 启动备用同步机制
  useEffect(() => {
    if (!user?.id || !autoSyncEnabled) {
      return
    }
    
    // 启动备用同步定时器
    backupSyncIntervalRef.current = setInterval(async () => {
      const now = Date.now()
      const timeSinceLastCheck = now - lastBackupSyncCheck.current
      
      // 避免过于频繁的检查
      if (timeSinceLastCheck < BACKUP_SYNC_INTERVAL) {
        return
      }
      
      lastBackupSyncCheck.current = now
      
      try {
        const hasUnsyncedMessages = await checkForUnsyncedAIMessages()
        if (hasUnsyncedMessages) {
          console.log('🔄 备用同步机制触发强制同步')
          await syncToCloud()
        }
      } catch (error) {
        console.error('❌ 备用同步机制执行失败:', error)
      }
    }, BACKUP_SYNC_INTERVAL)
    
    return () => {
      if (backupSyncIntervalRef.current) {
        clearInterval(backupSyncIntervalRef.current)
        backupSyncIntervalRef.current = null
      }
    }
  }, [user?.id, autoSyncEnabled, checkForUnsyncedAIMessages, syncToCloud])

  // 监听数据变化，自动同步到云端
  useEffect(() => {
    if (!user?.id || !autoSyncEnabled || syncing) {
      return
    }

    // 即使没有会话也要尝试同步（可能是删除操作）
    if (chatSessions.length === 0) {
      debouncedSyncToCloudFn()
      return
    }

    // 检查是否有新的用户消息
    const hasNewUserMessage = checkForNewUserMessages()
    
    if (hasNewUserMessage) {
      // 用户消息创建时立即同步，不受流式检测和防抖限制
      console.log('🚀 用户消息立即同步触发')
      if (debouncedSyncToCloud.current) {
        clearTimeout(debouncedSyncToCloud.current)
      }
      lastSyncToCloudTime.current = Date.now()
      syncToCloud()
      return
    }

    // 检查是否有消息正在流式输出
    if (hasStreamingMessages()) {
      return
    }

    // 检查是否是消息完成触发的变化
    const isMessageCompletion = checkMessageCompletion()
    
    if (isMessageCompletion) {
      // 消息完成时立即同步，不使用防抖
      console.log('🚀 AI消息完成同步触发')
      if (debouncedSyncToCloud.current) {
        clearTimeout(debouncedSyncToCloud.current)
      }
      lastSyncToCloudTime.current = Date.now()
      syncToCloud()
    } else {
      // 对于其他变化（如新建会话等），使用防抖同步
      debouncedSyncToCloudFn()
    }
  }, [user?.id, autoSyncEnabled, chatSessions, debouncedSyncToCloudFn, hasStreamingMessages, checkMessageCompletion, checkForNewUserMessages, syncing])

  return {
    // 同步状态
    syncing,
    lastSyncTime,
    syncError,
    dataSyncStatus,
    dataSyncLastTime,
    syncProgress,
    
    // 实时订阅状态
    realtimeConnected,
    
    // 同步函数
    syncToCloud,
    syncFromCloud,
    manualDataSync: manualDataSync,
    
    // 实时订阅管理
    startRealtimeSubscriptions,
    cleanupAllRealtimeSubscriptions,
    
    // 控制函数
    enableAutoSync,
    disableAutoSync,
    clearSyncError,
    
    // 队列数据同步
    queueDataSync
  }
}