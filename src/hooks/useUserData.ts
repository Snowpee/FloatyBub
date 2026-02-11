import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useAppStore } from '@/store'
import { quickConnectionCheck } from '@/utils/databaseConnectionTest'
import { useAuth } from './useAuth'
import { SupabaseDebugger } from '@/utils/supabaseDebug'
import { dataSyncService } from '@/services/DataSyncService'
import { DataIntegrityChecker } from '@/utils/dataIntegrityChecker'
import type { ChatSession, ChatMessage } from '@/store'
import type { SyncStatus, SyncResult } from '@/services/DataSyncService'
import type { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js'

const console: Console = { ...globalThis.console, log: (..._args: any[]) => {} }

// 配置开关：控制是否启用Realtime订阅功能
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

const toISO = (v: any): string => {
  const d = v instanceof Date ? v : new Date(v);
  return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
};

// 全局上传同步单飞锁
let GLOBAL_SYNC_TO_CLOUD_LOCK = false

const USER_IDLE_THRESHOLD_MS = 2 * 60 * 1000
const CLOUD_PULL_INTERVAL_MS = 15 * 60 * 1000
const MIN_CLOUD_PULL_GAP_MS = 60 * 1000

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
  queueDataSync: (type: string, data: any) => Promise<void>
  manualDataSync: () => Promise<SyncResult>
}

export const useUserData = () => {
  const { user } = useAuth()
  const { 
    chatSessions,
    migrateIdsToUUID
  } = useAppStore()
  
  const [syncing, setSyncing] = useState(false)
  const syncToCloudLockRef = useRef<boolean>(false)
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null)
  const [syncError, setSyncError] = useState<string | null>(null)
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(true)
  const [dataSyncStatus, setDataSyncStatus] = useState<SyncStatus>('idle')
  const [dataSyncLastTime, setDataSyncLastTime] = useState<number | null>(null)
  const [syncQueue, setSyncQueue] = useState<Set<string>>(new Set())
  
  // 离线队列
  const [offlineSyncQueue, setOfflineSyncQueue] = useState<Array<{
    id: string
    type: 'session' | 'message' | 'delete'
    data: any
    timestamp: number
    retryCount: number
  }>>([])
  
  const [isOfflineMode, setIsOfflineMode] = useState(!navigator.onLine)
  
  // 会话锁定机制
  const [lockedSessions, setLockedSessions] = useState<Set<string>>(new Set())
  const sessionLockTimeouts = useRef<Map<string, NodeJS.Timeout>>(new Map())
  
  // 进度状态
  const [syncProgress, setSyncProgress] = useState({ percent: 0, message: '' })

  // Realtime 状态
  const [realtimeConnected, setRealtimeConnected] = useState(false)
  const chatSessionsChannelRef = useRef<RealtimeChannel | null>(null)
  const messagesChannelRef = useRef<RealtimeChannel | null>(null)
  const realtimeRetryTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const [realtimeRetryCount, setRealtimeRetryCount] = useState(0)
  
  // 降级轮询
  const [fallbackPollingEnabled, setFallbackPollingEnabled] = useState(false)
  const fallbackPollingIntervalRef = useRef<NodeJS.Timeout | null>(null)
  
  // 网络状态
  const [networkStatus, setNetworkStatus] = useState({
    isOnline: navigator.onLine,
    connectionType: 'unknown',
    effectiveType: 'unknown',
    downlink: 0,
    rtt: 0
  })

  const lastUserActivityAtRef = useRef<number>(Date.now())
  const lastCloudPullAtRef = useRef<number>(0)
  const initialCloudPullScheduledForRef = useRef<string | null>(null)

  useEffect(() => {
    const markActivity = () => {
      lastUserActivityAtRef.current = Date.now()
    }

    window.addEventListener('pointerdown', markActivity)
    window.addEventListener('keydown', markActivity)
    window.addEventListener('touchstart', markActivity)
    window.addEventListener('focus', markActivity)

    return () => {
      window.removeEventListener('pointerdown', markActivity)
      window.removeEventListener('keydown', markActivity)
      window.removeEventListener('touchstart', markActivity)
      window.removeEventListener('focus', markActivity)
    }
  }, [])

  // ================== 会话锁定逻辑 ==================

  const lockSession = useCallback((sessionId: string, reason: string = '流式输出') => {
    setLockedSessions(prev => new Set([...prev, sessionId]))
    
    const existingTimeout = sessionLockTimeouts.current.get(sessionId)
    if (existingTimeout) clearTimeout(existingTimeout)
    
    const timeout = setTimeout(() => {
      unlockSession(sessionId, '超时自动解锁')
    }, 5 * 60 * 1000) // 5分钟超时
    
    sessionLockTimeouts.current.set(sessionId, timeout)
  }, [])
  
  const unlockSession = useCallback((sessionId: string, reason: string = '流式完成') => {
    setLockedSessions(prev => {
      const newSet = new Set(prev)
      newSet.delete(sessionId)
      return newSet
    })
    
    const timeout = sessionLockTimeouts.current.get(sessionId)
    if (timeout) {
      clearTimeout(timeout)
      sessionLockTimeouts.current.delete(sessionId)
    }
  }, [])
  
  const isSessionLocked = useCallback((sessionId: string) => {
    return lockedSessions.has(sessionId)
  }, [lockedSessions])

  const getLockedSessions = useCallback(() => {
    return Array.from(lockedSessions)
  }, [lockedSessions])
  
  // 自动锁定：监听流式状态
  useEffect(() => {
    const currentStreamingSessions = new Set<string>()
    
    chatSessions.forEach(session => {
      const hasStreamingMessage = session.messages?.some(msg => msg.isStreaming)
      if (hasStreamingMessage) {
        currentStreamingSessions.add(session.id)
        if (!lockedSessions.has(session.id)) {
          lockSession(session.id, '检测到流式消息')
        }
      }
    })
    
    lockedSessions.forEach(sessionId => {
      if (!currentStreamingSessions.has(sessionId)) {
        const sessionExists = chatSessions.some(s => s.id === sessionId)
        if (sessionExists) {
          unlockSession(sessionId, '流式消息已完成')
        } else {
          unlockSession(sessionId, '会话已删除')
        }
      }
    })
  }, [chatSessions, lockedSessions, lockSession, unlockSession])

  // ================== 辅助检测函数 ==================

  const hasStreamingMessages = useCallback(() => {
    return chatSessions.some(session => 
      session.messages?.some(message => message.isStreaming)
    )
  }, [chatSessions])

  // ================== 核心同步逻辑：上传到云端 ==================

  const syncToCloud = useCallback(async (retryCount = 0) => {
    if (!user || syncing) return;

    // 【Critial Fix】: 新逻辑不再因为有流式消息就直接 return
    // 我们只会在 map 消息时过滤掉正在 isStreaming 的消息
    // 这样新建的会话（User Prompt）可以立即同步，防止消失

    if (syncToCloudLockRef.current || GLOBAL_SYNC_TO_CLOUD_LOCK) {
      return;
    }
    syncToCloudLockRef.current = true;
    GLOBAL_SYNC_TO_CLOUD_LOCK = true;

    setSyncing(true);
    setSyncError(null);

    // 唯一的同步ID
    const syncId = `${user.id}-${Date.now()}`;

    try {
      // 1. ID 迁移检查
      migrateIdsToUUID();
      
      const currentSessions = useAppStore.getState().chatSessions;
      const tempSessionId = useAppStore.getState().tempSessionId;

      // 过滤临时会话
      const sessionsToSync = currentSessions.filter(session => 
        !tempSessionId || session.id !== tempSessionId
      );

      // 网络检查
      if (!navigator.onLine) {
        throw new Error('网络连接不可用，转入离线模式');
      }

      setSyncProgress({ percent: 20, message: '准备上传数据...' });

      // 2. 处理 UUID 转换 (只转换，不在这里setState，避免循环)
      const updatedSessions = sessionsToSync.map(session => {
        const newSessionId = convertToUUID(session.id);
        const updatedMessages = session.messages.map(message => ({
           ...message, 
           id: convertToUUID(message.id),
           // 确保versions字段包含当前内容，防止数据丢失
           versions: message.versions && message.versions.length > 0 ? message.versions : [message.content],
           currentVersionIndex: message.currentVersionIndex !== undefined ? message.currentVersionIndex : 0
        }));
        return { ...session, id: newSessionId, messages: updatedMessages };
      });

      // 3. 准备会话数据 (Upsert Sessions)
      const sessionsData = updatedSessions.map(session => ({
        id: session.id,
        user_id: user.id,
        title: session.title,
        is_hidden: session.isHidden || false,
        is_pinned: session.isPinned || false,
        metadata: {
          roleId: session.roleId,
          modelId: session.modelId,
          createdAt: toISO(session.createdAt),
          updatedAt: toISO(session.updatedAt),
          lastSyncedAt: new Date().toISOString()
        },
        updated_at: new Date().toISOString()
      }));

      // 分批同步会话
      const BATCH_SIZE = 50;
      for (let i = 0; i < sessionsData.length; i += BATCH_SIZE) {
        const batch = sessionsData.slice(i, i + BATCH_SIZE);
        const { error } = await supabase.from('chat_sessions').upsert(batch, { onConflict: 'id' });
        if (error) throw error;
      }

      setSyncProgress({ percent: 50, message: '同步消息...' });

      // 4. 准备消息数据 (Upsert Messages)
      // 【关键修复】：过滤掉 isStreaming 的消息，防止保存不完整数据
      // 但会话本身和 User Prompt (isStreaming=false) 会被保留，这解决了新建会话消失的问题
      
      let timestampCounter = 0;
      
      const allMessages = updatedSessions.flatMap(session => 
        session.messages
          .filter(message => !message.isStreaming) // 过滤掉正在流式的AI消息
          .map(message => {
            // 生成唯一时间戳
            let messageTimestamp = message.message_timestamp;
            if (!messageTimestamp || isNaN(new Date(messageTimestamp).getTime())) {
              const base = new Date((message as any).timestamp ?? Date.now());
              const baseMs = isNaN(base.getTime()) ? Date.now() : base.getTime();
              const uniqueTime = new Date(baseMs + timestampCounter++);
              messageTimestamp = uniqueTime.toISOString();
            }

            const messageData: any = {
              id: message.id,
              session_id: session.id,
              role: message.role,
              content: message.content,
              reasoning_content: message.reasoningContent || null,
              metadata: {
                timestamp: toISO((message as any).timestamp),
                roleId: message.roleId,
                userProfileId: message.userProfileId
              },
              message_timestamp: messageTimestamp,
              versions: message.versions,
              current_version_index: message.currentVersionIndex
            };

            if (message.snowflake_id) {
              messageData.snowflake_id = message.snowflake_id;
            }
            return messageData;
          })
      );

      // 分批同步消息
      const MESSAGE_BATCH_SIZE = 100;
      for (let i = 0; i < allMessages.length; i += MESSAGE_BATCH_SIZE) {
        const batch = allMessages.slice(i, i + MESSAGE_BATCH_SIZE);
        const { error } = await supabase.from('messages').upsert(batch, { onConflict: 'id' });
        if (error) throw error;
      }

      // 5. 清除 pendingUpload 标记
      const uploadedIds = new Set(allMessages.map(m => m.id));
      const currentSessionsForClear = useAppStore.getState().chatSessions;
      const finalizedSessions = currentSessionsForClear.map(s => ({
        ...s,
        lastSyncedAt: new Date(),
        pendingUpload: s.pendingUpload && hasStreamingMessages() ? true : false, // 如果还在流式，保留会话的pending标记
        messages: (s.messages || []).map(m => uploadedIds.has(m.id) ? { ...m, pendingUpload: false } : m)
      }));
      
      useAppStore.setState({ chatSessions: finalizedSessions });
      setLastSyncTime(new Date());
      setSyncProgress({ percent: 100, message: '同步完成' });

      // 简单清除进度条
      setTimeout(() => setSyncProgress({ percent: 0, message: '' }), 1000);

    } catch (error: any) {
      console.error('同步到云端失败:', error);
      setSyncError(error.message || '同步失败');
      
      // 简化的重试逻辑
      if (retryCount < 3 && navigator.onLine) {
        const delay = 2000 * Math.pow(2, retryCount);
        setTimeout(() => syncToCloud(retryCount + 1), delay);
      }
    } finally {
      syncToCloudLockRef.current = false;
      GLOBAL_SYNC_TO_CLOUD_LOCK = false;
      setSyncing(false);
      setSyncQueue(prev => {
        const next = new Set(prev);
        next.delete(user.id);
        return next;
      });
    }
  }, [user, syncing, migrateIdsToUUID, hasStreamingMessages]);

  // ================== 核心同步逻辑：从云端拉取 ==================

  const syncFromCloud = useCallback(async (attempt = 1) => {
    if (!user || syncing) return;

    // 本地流式状态保护：如果本地正在生成，不应该被云端（旧数据）覆盖
    // 【优化】：不再完全阻断，而是在 map/merge 阶段做保护
    const isLocalStreaming = hasStreamingMessages();
    
    setSyncing(true);
    if (attempt === 1) setSyncError(null);

    try {
      // 1. 获取会话列表
      const { data: sessions, error: sessionError } = await supabase
        .from('chat_sessions')
        .select('*')
        .eq('user_id', user.id)
        .is('deleted_at', null)
        .order('updated_at', { ascending: false });

      if (sessionError) throw sessionError;

      const baseSessions: any[] = (sessions || []).filter((s: any) => !s.is_deleted && !s.metadata?.deletedAt)

      let cloudSessions: ChatSession[] = []

      if (baseSessions.length > 0) {
        const sessionIdList = baseSessions.map((s: any) => s.id)
        const grouped = new Map<string, any[]>()
        const CHUNK_SIZE = 50
        for (let i = 0; i < sessionIdList.length; i += CHUNK_SIZE) {
          const chunk = sessionIdList.slice(i, i + CHUNK_SIZE)
          const { data: messagesRows, error: msgError } = await supabase
            .from('messages')
            .select('*, snowflake_id::text')
            .in('session_id', chunk)
            .is('deleted_at', null)
            .order('session_id', { ascending: true })
            .order('message_timestamp', { ascending: true })

          if (msgError) throw msgError

          for (const row of messagesRows || []) {
            const sessionId = (row as any).session_id as string
            const list = grouped.get(sessionId) || []
            list.push(row)
            grouped.set(sessionId, list)
          }
        }

        cloudSessions = baseSessions.map((session: any) => {
          const rows = grouped.get(session.id) || []
          const sessionMessages: ChatMessage[] = rows.map((msg: any) => ({
            id: msg.id,
            role: msg.role,
            content: msg.content,
            reasoningContent: msg.reasoning_content,
            timestamp: new Date(msg.metadata?.timestamp || msg.message_timestamp),
            message_timestamp: msg.message_timestamp,
            snowflake_id: msg.snowflake_id,
            roleId: msg.metadata?.roleId,
            userProfileId: msg.metadata?.userProfileId,
            versions: msg.versions || [msg.content || ''],
            currentVersionIndex: msg.current_version_index ?? 0
          }))

          return {
            id: session.id,
            title: session.title,
            messages: sessionMessages,
            roleId: session.metadata?.roleId,
            modelId: session.metadata?.modelId,
            isHidden: session.is_hidden,
            isPinned: session.is_pinned,
            createdAt: new Date(session.metadata?.createdAt || session.created_at),
            updatedAt: new Date(session.metadata?.updatedAt || session.updated_at),
            lastSyncedAt: session.metadata?.lastSyncedAt ? new Date(session.metadata.lastSyncedAt) : undefined
          }
        })
      }

      // 3. 合并逻辑 (Merge Strategy)
      const currentLocalSessions = useAppStore.getState().chatSessions;
      const mergedSessionsMap = new Map<string, ChatSession>();

      // 先放入本地会话
      currentLocalSessions.forEach(s => mergedSessionsMap.set(s.id, s));

      // 合并云端数据
      cloudSessions.forEach(cloudS => {
        const localS = mergedSessionsMap.get(cloudS.id);
        
        // 锁定保护：如果此特定会话正在流式输出，则完全忽略云端此会话的消息更新，只更新元数据
        const isThisSessionLocked = isSessionLocked(cloudS.id) || (localS?.messages?.some(m => m.isStreaming));

        if (!localS) {
          // 本地没有 -> 直接使用云端
          mergedSessionsMap.set(cloudS.id, cloudS);
        } else {
          // 本地有 -> 比较时间戳
          const localTime = localS.updatedAt ? new Date(localS.updatedAt).getTime() : 0;
          const cloudTime = cloudS.updatedAt ? new Date(cloudS.updatedAt).getTime() : 0;
          
          let finalMessages = localS.messages;

          if (!isThisSessionLocked) {
            // 如果未锁定，合并消息
            if (cloudS.messages.length >= localS.messages.length) {
               // 云端消息多/新，但要保留本地 pendingUpload 的状态
               const cloudMsgMap = new Map(cloudS.messages.map(m => [m.id, m]));
               
               const baseMessages = localS.messages.map(localM => {
                 if ((localM as any).pendingUpload) return localM; // 优先保留本地未上传的
                 return cloudMsgMap.get(localM.id) || localM;
               });
               
               // 找出云端新增的
               const localIdSet = new Set(localS.messages.map(m => m.id));
               const newCloudMsgs = cloudS.messages.filter(m => !localIdSet.has(m.id));
               
               finalMessages = [...baseMessages, ...newCloudMsgs].sort((a,b) => 
                 new Date(a.message_timestamp || 0).getTime() - new Date(b.message_timestamp || 0).getTime()
               );
            }
          }

          mergedSessionsMap.set(cloudS.id, {
            ...localS,
            messages: finalMessages,
            // 如果云端更新，采用云端元数据
            title: cloudTime > localTime ? cloudS.title : localS.title,
            isHidden: cloudTime > localTime ? cloudS.isHidden : localS.isHidden,
            isPinned: cloudTime > localTime ? cloudS.isPinned : localS.isPinned,
            updatedAt: cloudTime > localTime ? cloudS.updatedAt : localS.updatedAt
          });
        }
      });

      // 处理已删除会话 (基于 deleted_at)
      const { data: deletedRows } = await supabase
         .from('chat_sessions')
         .select('id')
         .eq('user_id', user.id)
         .not('deleted_at', 'is', null);
      
      const deletedIds = new Set((deletedRows || []).map((r:any) => r.id));

      const sessionIdsToCheck = Array.from(new Set([
        ...baseSessions.map((s: any) => s.id),
        ...currentLocalSessions.map(s => s.id)
      ]))
      const deletedMessageIdsBySession = new Map<string, Set<string>>()
      if (sessionIdsToCheck.length > 0) {
        const { data: deletedMessageRows, error: deletedMessageError } = await supabase
          .from('messages')
          .select('id, session_id, deleted_at')
          .in('session_id', sessionIdsToCheck)
          .not('deleted_at', 'is', null)

        if (deletedMessageError) throw deletedMessageError

        for (const row of deletedMessageRows || []) {
          const sessionId = (row as any).session_id as string
          const messageId = (row as any).id as string
          const set = deletedMessageIdsBySession.get(sessionId) || new Set<string>()
          set.add(messageId)
          deletedMessageIdsBySession.set(sessionId, set)
        }
      }
      
      const finalSessions = Array.from(mergedSessionsMap.values())
        .filter(s => {
            // 如果云端删除了，但本地锁定或正在流式，则保留（复活）
            if (deletedIds.has(s.id)) {
                return isSessionLocked(s.id) || s.messages.some(m => m.isStreaming || (m as any).pendingUpload);
            }
            return true;
        })
        .map(s => {
          const deletedMessageIds = deletedMessageIdsBySession.get(s.id)
          if (!deletedMessageIds || deletedMessageIds.size === 0) return s
          const filteredMessages = (s.messages || []).filter(m => {
            if (m.isStreaming || (m as any).pendingUpload) return true
            return !deletedMessageIds.has(m.id)
          })
          if (filteredMessages.length === (s.messages || []).length) return s
          return { ...s, messages: filteredMessages }
        })
        .sort((a, b) => {
            const tA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
            const tB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
            return tB - tA;
        });

      useAppStore.setState({ chatSessions: finalSessions });
      setLastSyncTime(new Date());
      setSyncing(false);

    } catch (error: any) {
      // 只有在非预期错误或最终失败时才使用 error 级别
      if (attempt >= 3) {
        console.error('从云端同步最终失败:', error);
        setSyncError(error.message);
      } else {
        console.warn(`从云端同步遇到临时错误 (尝试 ${attempt}/3):`, error.message || error);
      }
      
      setSyncing(false);
      
      if (attempt < 3 && navigator.onLine) {
        const delay = Math.min(30000, 2000 * Math.pow(2, attempt - 1))
        const canRetry = document.visibilityState === 'visible' && (Date.now() - lastUserActivityAtRef.current) < USER_IDLE_THRESHOLD_MS
        if (canRetry) {
          setTimeout(() => syncFromCloud(attempt + 1), delay)
        }
      }
    }
  }, [user, syncing, hasStreamingMessages, isSessionLocked]);


  // ================== 防抖与自动触发 ==================

  const debouncedSyncToCloud = useRef<NodeJS.Timeout | null>(null)
  const debouncedSyncFromCloud = useRef<NodeJS.Timeout | null>(null)
  const periodicCloudSyncRef = useRef<NodeJS.Timeout | null>(null)
  
  // 检测是否有用户的新消息
  const checkForNewUserMessages = useCallback(() => {
     // 简化的检测逻辑：如果有 pendingUpload=true 且非 streaming 的消息，直接触发
     return chatSessions.some(s => s.messages.some(m => (m as any).pendingUpload && !m.isStreaming));
  }, [chatSessions]);

  // 自动同步副作用
  useEffect(() => {
    if (!user?.id || !autoSyncEnabled) return;

    const { tempSessionId, currentSessionId } = useAppStore.getState();
    if (tempSessionId && tempSessionId === currentSessionId) return; // 临时会话不同步

    // 触发条件
    const needsSync = checkForNewUserMessages();
    // 即使是流式状态，如果有了新用户消息，原则上也应该同步（因为 syncToCloud 内部已经做了流式过滤）
    
    if (needsSync) {
        if (debouncedSyncToCloud.current) clearTimeout(debouncedSyncToCloud.current);
        debouncedSyncToCloud.current = setTimeout(() => {
            syncToCloud();
        }, 2000); // 2秒防抖
    }

    return () => {
        if (debouncedSyncToCloud.current) clearTimeout(debouncedSyncToCloud.current);
    }
  }, [user?.id, autoSyncEnabled, chatSessions, checkForNewUserMessages]);

  useEffect(() => {
    if (!user?.id || !autoSyncEnabled) return;

    const { tempSessionId, currentSessionId } = useAppStore.getState();
    const isTempActive = !!tempSessionId && tempSessionId === currentSessionId;

    const shouldDelayCloudPull = () => {
      if (isTempActive) return true;
      if (checkForNewUserMessages()) return true;
      if (hasStreamingMessages()) return true;
      return false;
    };

    const triggerCloudPull = (force = false) => {
      if (!navigator.onLine) return;
      const now = Date.now()
      if (!force) {
        if (document.visibilityState !== 'visible') return
        if (now - lastUserActivityAtRef.current > USER_IDLE_THRESHOLD_MS) return
        if (now - lastCloudPullAtRef.current < MIN_CLOUD_PULL_GAP_MS) return
        if (shouldDelayCloudPull()) return
      }
      if (!syncing) {
        lastCloudPullAtRef.current = now
        syncFromCloud();
      }
    };

    if (initialCloudPullScheduledForRef.current !== user.id) {
      initialCloudPullScheduledForRef.current = user.id
      if (debouncedSyncFromCloud.current) {
        clearTimeout(debouncedSyncFromCloud.current);
      }
      
      // 登录后的首次同步：采用 串行合并 策略
      // 1. 先尝试将本地数据上传到云端 (syncToCloud)
      // 2. 然后从云端拉取最新数据并合并 (syncFromCloud)
      // 这样可以最大程度避免本地数据被云端旧数据覆盖（虽然 syncFromCloud 有合并逻辑，但串行更安全）
      const performLoginSync = async () => {
        if (!navigator.onLine) return;
        
        console.log('🚀 [LoginSync] 开始登录后合并同步序列...');
        
        // 1. 上传本地数据
        try {
          console.log('🚀 [LoginSync] 步骤1: 上传本地数据...');
          await syncToCloud();
        } catch (e) {
          console.warn('⚠️ [LoginSync] 上传本地数据部分失败，继续尝试拉取...', e);
        }
        
        // 2. 拉取云端数据
        try {
          console.log('🚀 [LoginSync] 步骤2: 拉取并合并云端数据...');
          await syncFromCloud();
        } catch (e) {
          console.error('❌ [LoginSync] 拉取云端数据失败', e);
        }
        
        console.log('✅ [LoginSync] 登录同步序列完成');
      };

      // 延迟一点执行，确保 Auth 状态完全稳定
      debouncedSyncFromCloud.current = setTimeout(() => {
        performLoginSync();
      }, 1000);
    }

    if (periodicCloudSyncRef.current) {
      clearInterval(periodicCloudSyncRef.current);
    }
    periodicCloudSyncRef.current = setInterval(() => {
      triggerCloudPull(false);
    }, CLOUD_PULL_INTERVAL_MS);

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        lastUserActivityAtRef.current = Date.now()
        triggerCloudPull(false);
      }
    };

    const handleOnline = () => {
      lastUserActivityAtRef.current = Date.now()
      triggerCloudPull(true);
    };

    window.addEventListener('online', handleOnline);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      if (debouncedSyncFromCloud.current) {
        clearTimeout(debouncedSyncFromCloud.current);
        debouncedSyncFromCloud.current = null;
      }
      if (periodicCloudSyncRef.current) {
        clearInterval(periodicCloudSyncRef.current);
        periodicCloudSyncRef.current = null;
      }
      window.removeEventListener('online', handleOnline);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [user?.id, autoSyncEnabled, syncing, syncFromCloud, checkForNewUserMessages, hasStreamingMessages]);


  // ================== 队列数据同步 (Settings等) ==================
  
  const queueDataSync = useCallback(async (type: string, data: any) => {
    try {
      await dataSyncService.queueSync(type as any, data);
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        console.log('ℹ️ [useUserData] queueDataSync 请求被中止')
        return
      }
      throw error
    }
  }, []);

  const manualDataSync = useCallback(async () => {
    return await dataSyncService.manualSync();
  }, []);

  // ================== 返回接口 ==================

  return {
    syncing,
    lastSyncTime,
    syncError,
    dataSyncStatus,
    dataSyncLastTime,
    syncProgress,
    networkStatus,
    offlineSyncQueue,
    
    syncToCloud,
    syncFromCloud,
    manualDataSync,
    queueDataSync,
    
    enableAutoSync: () => setAutoSyncEnabled(true),
    disableAutoSync: () => setAutoSyncEnabled(false),
    clearSyncError: () => setSyncError(null),
    
    addToOfflineQueue: useCallback((type: any, data: any) => {
        setOfflineSyncQueue(prev => [...prev, {
            id: generateId(),
            type, data, timestamp: Date.now(), retryCount: 0
        }])
    }, []),
    processOfflineQueue: useCallback(async () => {
        // 简化版离线队列处理
        if (offlineSyncQueue.length > 0 && navigator.onLine) {
            await syncToCloud();
            setOfflineSyncQueue([]);
        }
    }, [offlineSyncQueue, syncToCloud]),
    
    lockSession,
    unlockSession,
    isSessionLocked,
    hasStreamingMessages,
    
    // 兼容原有接口保持不报错
    startRealtimeSubscriptions: () => {},
    cleanupAllRealtimeSubscriptions: () => {},
    realtimeConnected
  }
}
