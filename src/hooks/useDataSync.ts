import { useState, useEffect, useCallback, useRef } from 'react'
import { dataSyncService, type SyncStatus, type SyncResult } from '@/services/DataSyncService'
import { supabase } from '@/lib/supabase'
import { useAppStore, type AgentSkill } from '@/store'
import { useKnowledgeStore } from '@/store/knowledgeStore'
import type { KnowledgeBase, KnowledgeEntry } from '@/types/knowledge'

export interface DataSyncHookReturn {
  status: SyncStatus
  lastSyncTime: number | null
  isOnline: boolean
  queueSync: (type: 'llm_config' | 'ai_role' | 'global_prompt' | 'voice_settings' | 'general_settings' | 'agent_skill' | 'knowledge_base' | 'knowledge_entry', data: any) => Promise<void>
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
  
  const { agentSkills, addAgentSkill, updateAgentSkill, deleteAgentSkill } = useAppStore()
  const { globalPrompts, addGlobalPrompt, updateGlobalPrompt, deleteGlobalPrompt } = useAppStore()
  
  const { 
    knowledgeBases, 
    knowledgeEntries,
    createKnowledgeBase, 
    updateKnowledgeBase, 
    deleteKnowledgeBase,
    createKnowledgeEntry, 
    updateKnowledgeEntry, 
    deleteKnowledgeEntry 
  } = useKnowledgeStore()

  const debouncedSkillSync = useRef<NodeJS.Timeout | null>(null)
  const debouncedPromptSync = useRef<NodeJS.Timeout | null>(null)
  const debouncedKnowledgeBaseSync = useRef<NodeJS.Timeout | null>(null)
  const debouncedKnowledgeEntrySync = useRef<NodeJS.Timeout | null>(null)

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

  // Agent Skills Realtime Subscription
  useEffect(() => {
    if (!user?.id) return

    // console.log('[SkillSync] 🔌 初始化 Realtime 订阅', `agent_skills_${user.id}`)

    const channel = supabase
      .channel(`agent_skills_${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'agent_skills',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          // console.log('[SkillSync] 📥 收到 Realtime 事件:', payload.eventType, payload)
          const { eventType, new: newRecord, old: oldRecord } = payload

          if (eventType === 'INSERT' || eventType === 'UPDATE') {
             const skill: AgentSkill = {
                id: newRecord.id,
                name: newRecord.name,
                description: newRecord.description || '',
                content: newRecord.content || '',
                files: newRecord.files || [],
                enabled: newRecord.enabled ?? true,
                createdAt: new Date(newRecord.created_at),
                updatedAt: new Date(newRecord.updated_at)
             }
             if (eventType === 'INSERT') {
                // console.log('[SkillSync] 📥 插入本地 Skill:', skill.name)
                addAgentSkill(skill, { skipSync: true })
             } else {
                // console.log('[SkillSync] 📥 更新本地 Skill:', skill.name)
                updateAgentSkill(skill.id, skill, { skipSync: true })
             }
          } else if (eventType === 'DELETE') {
             // console.log('[SkillSync] 📥 删除本地 Skill:', oldRecord.id)
             deleteAgentSkill(oldRecord.id, { skipSync: true })
          }
        }
      )
      .subscribe((status) => {
        // console.log('[SkillSync] 🔌 订阅状态:', status)
      })

    return () => {
      // console.log('[SkillSync] 🔌 取消 Realtime 订阅')
      supabase.removeChannel(channel)
    }
  }, [user?.id, addAgentSkill, updateAgentSkill, deleteAgentSkill])

  // Global Prompts Realtime Subscription
  useEffect(() => {
    if (!user?.id) return

    // console.log('[PromptSync] 🔌 初始化 Realtime 订阅', `global_prompts_${user.id}`)

    const channel = supabase
      .channel(`global_prompts_${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'global_prompts',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          // console.log('[PromptSync] 📥 收到 Realtime 事件:', payload.eventType, payload)
          const { eventType, new: newRecord, old: oldRecord } = payload

          if (eventType === 'INSERT' || eventType === 'UPDATE') {
             const prompt: any = {
                id: newRecord.id,
                title: newRecord.title,
                description: newRecord.description || '',
                prompt: newRecord.prompt || newRecord.content, // DB可能是content, store是prompt
                createdAt: new Date(newRecord.created_at),
                updatedAt: new Date(newRecord.updated_at)
             }
             if (eventType === 'INSERT') {
                // console.log('[PromptSync] 📥 插入本地 Prompt:', prompt.title)
                addGlobalPrompt(prompt, { skipSync: true })
             } else {
                // console.log('[PromptSync] 📥 更新本地 Prompt:', prompt.title)
                updateGlobalPrompt(prompt.id, prompt, { skipSync: true })
             }
          } else if (eventType === 'DELETE') {
             // console.log('[PromptSync] 📥 删除本地 Prompt:', oldRecord.id)
             deleteGlobalPrompt(oldRecord.id, { skipSync: true })
          }
        }
      )
      .subscribe((status) => {
        // console.log('[PromptSync] 🔌 订阅状态:', status)
      })

    return () => {
      // console.log('[PromptSync] 🔌 取消 Realtime 订阅')
      supabase.removeChannel(channel)
    }
  }, [user?.id, addGlobalPrompt, updateGlobalPrompt, deleteGlobalPrompt])

  // Knowledge Base Realtime Subscription
  useEffect(() => {
    if (!user?.id) return

    console.log('[KBSync] 🔌 初始化 Knowledge Base Realtime 订阅', `knowledge_bases_${user.id}`)

    const channel = supabase
      .channel(`knowledge_bases_${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'knowledge_bases',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          console.log('[KBSync] 📥 收到 Knowledge Base 事件:', payload.eventType, payload)
          const { eventType, new: newRecord, old: oldRecord } = payload

          if (eventType === 'INSERT' || eventType === 'UPDATE') {
             const kbRequest = {
                id: newRecord.id,
                name: newRecord.name,
                description: newRecord.description || '',
                user_id: newRecord.user_id,
                created_at: newRecord.created_at,
                updated_at: newRecord.updated_at
             }
             if (eventType === 'INSERT') {
                console.log('[KBSync] 📥 插入本地 Knowledge Base:', kbRequest.name)
                createKnowledgeBase(kbRequest, { skipSync: true })
             } else {
                console.log('[KBSync] 📥 更新本地 Knowledge Base:', kbRequest.name)
                updateKnowledgeBase(newRecord.id, kbRequest, { skipSync: true })
             }
          } else if (eventType === 'DELETE') {
             console.log('[KBSync] 📥 删除本地 Knowledge Base:', oldRecord.id)
             deleteKnowledgeBase(oldRecord.id, { skipSync: true })
          }
        }
      )
      .subscribe((status) => {
        console.log('[KBSync] 🔌 Knowledge Base 订阅状态:', status)
      })

    return () => {
      console.log('[KBSync] 🔌 取消 Knowledge Base Realtime 订阅')
      supabase.removeChannel(channel)
    }
  }, [user?.id, createKnowledgeBase, updateKnowledgeBase, deleteKnowledgeBase])

  // Knowledge Entry Realtime Subscription
  useEffect(() => {
    if (!user?.id) return

    console.log('[EntrySync] 🔌 初始化 Knowledge Entry Realtime 订阅', `knowledge_entries_${user.id}`)

    const channel = supabase
      .channel(`knowledge_entries_${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'knowledge_entries',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          console.log('[EntrySync] 📥 收到 Knowledge Entry 事件:', payload.eventType, payload)
          const { eventType, new: newRecord, old: oldRecord } = payload

          if (eventType === 'INSERT' || eventType === 'UPDATE') {
             const entryRequest = {
                id: newRecord.id,
                name: newRecord.name,
                keywords: newRecord.keywords || [],
                explanation: newRecord.explanation || '',
                knowledge_base_id: newRecord.knowledge_base_id,
                user_id: newRecord.user_id,
                created_at: newRecord.created_at,
                updated_at: newRecord.updated_at
             }
             if (eventType === 'INSERT') {
                console.log('[EntrySync] 📥 插入本地 Knowledge Entry:', entryRequest.name)
                createKnowledgeEntry(entryRequest, { skipSync: true })
             } else {
                console.log('[EntrySync] 📥 更新本地 Knowledge Entry:', entryRequest.name)
                updateKnowledgeEntry(newRecord.id, entryRequest, { skipSync: true })
             }
          } else if (eventType === 'DELETE') {
             console.log('[EntrySync] 📥 删除本地 Knowledge Entry:', oldRecord.id)
             deleteKnowledgeEntry(oldRecord.id, { skipSync: true })
          }
        }
      )
      .subscribe((status) => {
        console.log('[EntrySync] 🔌 Knowledge Entry 订阅状态:', status)
      })

    return () => {
      console.log('[EntrySync] 🔌 取消 Knowledge Entry Realtime 订阅')
      supabase.removeChannel(channel)
    }
  }, [user?.id, createKnowledgeEntry, updateKnowledgeEntry, deleteKnowledgeEntry])

  // Agent Skills Debounced Sync
  useEffect(() => {
    if (!user?.id) return

    const pendingSkills = agentSkills.filter(s => s.pendingUpload)
    if (pendingSkills.length > 0) {
      console.log('[SkillSync] ⏳ 检测到待同步 Skills:', pendingSkills.length, pendingSkills.map(s => s.name))
    }

    if (pendingSkills.length === 0) return

    if (debouncedSkillSync.current) {
      // console.log('[SkillSync] 🔄 重置防抖计时器')
      clearTimeout(debouncedSkillSync.current)
    }

    // console.log('[SkillSync] ⏱️ 启动防抖计时器 (2s)')
    debouncedSkillSync.current = setTimeout(async () => {
      // console.log('[SkillSync] 🚀 触发批量同步')
      for (const skill of pendingSkills) {
        try {
          // console.log('[SkillSync] 📤 加入同步队列:', skill.name)
          await dataSyncService.queueSync('agent_skill', skill)
          // console.log('[SkillSync] ✅ 标记同步完成:', skill.name)
          updateAgentSkill(skill.id, { pendingUpload: false } as any, { skipSync: true })
        } catch (error) {
          console.error('[SkillSync] ❌ 同步失败:', skill.name, error)
        }
      }
    }, 2000)

    return () => {
      if (debouncedSkillSync.current) {
        clearTimeout(debouncedSkillSync.current)
      }
    }
  }, [agentSkills, user?.id, updateAgentSkill])

  // Global Prompts Debounced Sync
  useEffect(() => {
    if (!user?.id) return

    const pendingPrompts = globalPrompts.filter(p => p.pendingUpload)
    if (pendingPrompts.length > 0) {
      // console.log('[PromptSync] ⏳ 检测到待同步 Prompts:', pendingPrompts.length, pendingPrompts.map(p => p.title))
    }

    if (pendingPrompts.length === 0) return

    if (debouncedPromptSync.current) {
      // console.log('[PromptSync] 🔄 重置防抖计时器')
      clearTimeout(debouncedPromptSync.current)
    }

    // console.log('[PromptSync] ⏱️ 启动防抖计时器 (2s)')
    debouncedPromptSync.current = setTimeout(async () => {
      // console.log('[PromptSync] 🚀 触发批量同步')
      for (const prompt of pendingPrompts) {
        try {
          // console.log('[PromptSync] 📤 加入同步队列:', prompt.title)
          await dataSyncService.queueSync('global_prompt', prompt)
          // console.log('[PromptSync] ✅ 标记同步完成:', prompt.title)
          updateGlobalPrompt(prompt.id, { pendingUpload: false } as any, { skipSync: true })
        } catch (error) {
          console.error('[PromptSync] ❌ 同步失败:', prompt.title, error)
        }
      }
    }, 2000)

    return () => {
      if (debouncedPromptSync.current) {
        clearTimeout(debouncedPromptSync.current)
      }
    }
  }, [globalPrompts, user?.id, updateGlobalPrompt])

  // Knowledge Base Debounced Sync
  useEffect(() => {
    if (!user?.id) return

    const pendingBases = knowledgeBases.filter(kb => kb.pendingUpload)
    if (pendingBases.length > 0) {
      console.log('[KBSync] ⏳ 检测到待同步 Knowledge Bases:', pendingBases.length, pendingBases.map(kb => kb.name))
    }

    if (pendingBases.length === 0) return

    if (debouncedKnowledgeBaseSync.current) {
      console.log('[KBSync] 🔄 重置防抖计时器')
      clearTimeout(debouncedKnowledgeBaseSync.current)
    }

    console.log('[KBSync] ⏱️ 启动防抖计时器 (2s)', { pendingCount: pendingBases.length })
    debouncedKnowledgeBaseSync.current = setTimeout(async () => {
      console.log('[KBSync] 🚀 触发批量同步', { count: pendingBases.length })
      // 处理待上传的
      for (const kb of pendingBases) {
        try {
          console.log('[KBSync] 📤 加入同步队列:', { id: kb.id, name: kb.name })
          await dataSyncService.queueSync('knowledge_base', kb)
          console.log('[KBSync] ✅ 标记同步完成:', kb.name)
          await updateKnowledgeBase(kb.id, {}, { skipSync: true })
        } catch (error) {
          console.error('[KBSync] ❌ 同步失败:', kb.name, error)
        }
      }
    }, 2000)

    return () => {
      if (debouncedKnowledgeBaseSync.current) {
        clearTimeout(debouncedKnowledgeBaseSync.current)
      }
    }
  }, [knowledgeBases, user?.id, updateKnowledgeBase])

  // Knowledge Entry Debounced Sync
  useEffect(() => {
    if (!user?.id) return

    const pendingEntries = knowledgeEntries.filter(e => e.pendingUpload)
    if (pendingEntries.length > 0) {
      console.log('[EntrySync] ⏳ 检测到待同步 Knowledge Entries:', pendingEntries.length, pendingEntries.map(e => e.name))
    }

    if (pendingEntries.length === 0) return

    if (debouncedKnowledgeEntrySync.current) {
      console.log('[EntrySync] 🔄 重置防抖计时器')
      clearTimeout(debouncedKnowledgeEntrySync.current)
    }

    console.log('[EntrySync] ⏱️ 启动防抖计时器 (2s)', { pendingCount: pendingEntries.length })
    debouncedKnowledgeEntrySync.current = setTimeout(async () => {
      console.log('[EntrySync] 🚀 触发批量同步', { count: pendingEntries.length })
      for (const entry of pendingEntries) {
        try {
          console.log('[EntrySync] 📤 加入同步队列:', { id: entry.id, name: entry.name, kbId: entry.knowledge_base_id })
          await dataSyncService.queueSync('knowledge_entry', entry)
          console.log('[EntrySync] ✅ 标记同步完成:', entry.name)
          await updateKnowledgeEntry(entry.id, {}, { skipSync: true })
        } catch (error) {
          console.error('[EntrySync] ❌ 同步失败:', entry.name, error)
        }
      }
    }, 2000)

    return () => {
      if (debouncedKnowledgeEntrySync.current) {
        clearTimeout(debouncedKnowledgeEntrySync.current)
      }
    }
  }, [knowledgeEntries, user?.id, updateKnowledgeEntry])

  // 添加到同步队列
  const queueSync = useCallback(async (
    type: 'llm_config' | 'ai_role' | 'global_prompt' | 'voice_settings' | 'general_settings' | 'agent_skill' | 'knowledge_base' | 'knowledge_entry', 
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
