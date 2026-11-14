import type { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js'
import { supabase, type Database } from '@/lib/supabase'
import type { AgentSkill } from '@/store/types'
import type { KnowledgeBase, KnowledgeEntry } from '@/types/knowledge'

type SyncRows = {
  agent_skills: Omit<AgentSkill, 'createdAt' | 'updatedAt' | 'pendingUpload'> & {
    created_at: string
    updated_at: string
  }
  global_prompts: Database['public']['Tables']['global_prompts']['Row'] & {
    description?: string
    prompt?: string
  }
  knowledge_bases: KnowledgeBase
  knowledge_entries: KnowledgeEntry & { user_id: string }
}

type SyncTable = keyof SyncRows
type Subscription = { channel: RealtimeChannel; references: number }

const subscriptions = new Map<string, Subscription>()

/** These handlers update shared stores, so each database event must be applied once,
 * regardless of how many components currently use useDataSync. */
export function retainDataSyncSubscription<T extends SyncTable>(
  table: T,
  userId: string,
  onChange: (payload: RealtimePostgresChangesPayload<SyncRows[T]>) => void
): () => void {
  const key = `${table}_${userId}`
  let entry = subscriptions.get(key)

  if (!entry) {
    // removeChannel is asynchronous. A new lifecycle must never reuse the topic
    // of a channel that is still leaving (including React StrictMode remounts).
    const channel = supabase.channel(`${key}_${crypto.randomUUID()}`)
    entry = { channel, references: 0 }
    const currentEntry = entry
    subscriptions.set(key, currentEntry)
    channel.on<SyncRows[T]>('postgres_changes', {
      event: '*', schema: 'public', table, filter: `user_id=eq.${userId}`
    }, payload => {
      if (subscriptions.get(key) === currentEntry) onChange(payload)
    }).subscribe()
  }

  entry.references++
  const currentEntry = entry
  let released = false
  return () => {
    if (released) return
    released = true
    if (--currentEntry.references > 0) return
    subscriptions.delete(key)
    void supabase.removeChannel(currentEntry.channel).catch(error => {
      console.warn('清理数据同步订阅失败:', error)
    })
  }
}
