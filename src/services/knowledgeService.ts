// 知识库服务 - 处理所有知识库相关的API调用

import { v4 as uuidv4 } from 'uuid'
import { supabase } from '../lib/supabase'
import { indexedDBStorage } from '../store/storage'
import type {
  KnowledgeBase,
  KnowledgeEntry,
  CreateKnowledgeBaseRequest,
  UpdateKnowledgeBaseRequest,
  CreateKnowledgeEntryRequest,
  UpdateKnowledgeEntryRequest,
  KnowledgeBaseStats,
  ImportKnowledgeEntriesRequest
} from '../types/knowledge'

type KnowledgeScope = 'local' | string

type KnowledgeSyncItem = {
  id: string
  entity: 'knowledge_base' | 'knowledge_entry' | 'role_knowledge'
  op: 'upsert' | 'delete' | 'set'
  data: any
  timestamp: number
  retries: number
}

const LEGACY_LOCAL_STORAGE_KEYS = {
  KNOWLEDGE_BASES: 'knowledge_bases',
  KNOWLEDGE_ENTRIES: 'knowledge_entries',
  ROLE_KNOWLEDGE_MAP: 'role_knowledge_map'
}

const keyFor = {
  bases: (scope: KnowledgeScope) => `knowledge:bases:${scope}`,
  entries: (scope: KnowledgeScope) => `knowledge:entries:${scope}`,
  roleMap: (scope: KnowledgeScope) => `knowledge:roleMap:${scope}`,
  syncQueue: (scope: KnowledgeScope) => `knowledge:syncQueue:${scope}`,
  lastPullAt: (scope: KnowledgeScope) => `knowledge:lastPullAt:${scope}`,
  lastUserScope: 'knowledge:lastUserScope',
  migratedV1: 'knowledge:migrated:v1'
}

let lastUserScopeCache: string | null = null

const isValidUUID = (str: string): boolean => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  return uuidRegex.test(str)
}

const safeJsonParse = <T>(value: string | null, fallback: T): T => {
  if (!value) return fallback
  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}

const rememberLastUserScope = async (userId: string): Promise<void> => {
  if (!userId) return
  if (lastUserScopeCache === userId) return
  lastUserScopeCache = userId
  try {
    await indexedDBStorage.setItem(keyFor.lastUserScope, userId)
  } catch {}
}

const getLastUserScope = async (): Promise<string | null> => {
  if (lastUserScopeCache) return lastUserScopeCache
  try {
    const raw = await indexedDBStorage.getItem(keyFor.lastUserScope)
    if (!raw) return null
    lastUserScopeCache = raw
    return raw
  } catch {
    return null
  }
}

const resolveFallbackScope = async (): Promise<string | null> => {
  const scope = await getLastUserScope()
  if (!scope) return null
  if (scope === 'local') return null
  if (!isValidUUID(scope)) return null
  return scope
}

const readJson = async <T>(key: string, fallback: T): Promise<T> => {
  const raw = await indexedDBStorage.getItem(key)
  return safeJsonParse<T>(raw, fallback)
}

const writeJson = async (key: string, value: unknown): Promise<void> => {
  await indexedDBStorage.setItem(key, JSON.stringify(value))
}

const nowIso = () => new Date().toISOString()

const isProbablyNetworkError = (error: unknown) => {
  if (!navigator.onLine) return true
  if (error instanceof TypeError) return true
  const message = error instanceof Error ? error.message : String(error)
  const m = message.toLowerCase()
  return m.includes('failed to fetch') || m.includes('network') || m.includes('connection') || m.includes('timeout')
}

const compareIsoDesc = (a?: string, b?: string) => {
  const at = a ? new Date(a).getTime() : 0
  const bt = b ? new Date(b).getTime() : 0
  return bt - at
}

const mergeByIdPreferNewer = <T extends { id: string; updated_at?: string }>(local: T[], remote: T[]): T[] => {
  const map = new Map<string, T>()
  local.forEach(item => map.set(item.id, item))
  remote.forEach(item => {
    const existing = map.get(item.id)
    if (!existing) {
      map.set(item.id, item)
      return
    }
    const localTime = existing.updated_at ? new Date(existing.updated_at).getTime() : 0
    const remoteTime = item.updated_at ? new Date(item.updated_at).getTime() : 0
    if (remoteTime >= localTime) {
      map.set(item.id, item)
    }
  })
  return Array.from(map.values())
}

const mergeRoleMapPreferLocal = (remoteMap: Record<string, string>, localMap: Record<string, string>) => {
  return { ...remoteMap, ...localMap }
}

async function getAuthContext(): Promise<{ isLoggedIn: boolean; userId?: string; scope: KnowledgeScope }> {
  try {
    const { data: { user }, error } = await supabase.auth.getUser()
    const isLoggedIn = !error && !!user

    if (isLoggedIn && user?.id) {
      await rememberLastUserScope(user.id)
    }

    return { isLoggedIn, userId: user?.id, scope: isLoggedIn && user?.id ? user.id : 'local' }
  } catch {
    return { isLoggedIn: false, scope: 'local' }
  }
}

export class KnowledgeService {
  private static initialized = false
  private static initPromise: Promise<void> | null = null

  private static async ensureInitialized(): Promise<void> {
    if (this.initialized) return
    if (this.initPromise) return this.initPromise

    this.initPromise = (async () => {
      if (typeof window !== 'undefined') {
        window.addEventListener('online', () => {
          this.processSyncQueue().catch(() => {})
        })
      }
      await this.migrateLegacyLocalStorage()
      this.initialized = true
    })()

    return this.initPromise
  }

  private static async migrateLegacyLocalStorage(): Promise<void> {
    if (typeof window === 'undefined') return
    const migrated = await indexedDBStorage.getItem(keyFor.migratedV1)
    if (migrated === '1') return

    const legacyBases = safeJsonParse<KnowledgeBase[]>(localStorage.getItem(LEGACY_LOCAL_STORAGE_KEYS.KNOWLEDGE_BASES), [])
    const legacyEntries = safeJsonParse<KnowledgeEntry[]>(localStorage.getItem(LEGACY_LOCAL_STORAGE_KEYS.KNOWLEDGE_ENTRIES), [])
    const legacyRoleMap = safeJsonParse<Record<string, string>>(localStorage.getItem(LEGACY_LOCAL_STORAGE_KEYS.ROLE_KNOWLEDGE_MAP), {})

    if (legacyBases.length > 0) {
      const existing = await readJson<KnowledgeBase[]>(keyFor.bases('local'), [])
      await writeJson(keyFor.bases('local'), mergeByIdPreferNewer(existing, legacyBases))
    }
    if (legacyEntries.length > 0) {
      const existing = await readJson<KnowledgeEntry[]>(keyFor.entries('local'), [])
      await writeJson(keyFor.entries('local'), mergeByIdPreferNewer(existing, legacyEntries))
    }
    if (Object.keys(legacyRoleMap).length > 0) {
      const existing = await readJson<Record<string, string>>(keyFor.roleMap('local'), {})
      await writeJson(keyFor.roleMap('local'), { ...existing, ...legacyRoleMap })
    }

    try {
      localStorage.removeItem(LEGACY_LOCAL_STORAGE_KEYS.KNOWLEDGE_BASES)
      localStorage.removeItem(LEGACY_LOCAL_STORAGE_KEYS.KNOWLEDGE_ENTRIES)
      localStorage.removeItem(LEGACY_LOCAL_STORAGE_KEYS.ROLE_KNOWLEDGE_MAP)
    } catch {}

    await indexedDBStorage.setItem(keyFor.migratedV1, '1')
  }

  private static async shouldPullFromCloud(scope: KnowledgeScope): Promise<boolean> {
    const lastPullAt = await indexedDBStorage.getItem(keyFor.lastPullAt(scope))
    const last = lastPullAt ? Number(lastPullAt) : 0
    return Date.now() - last > 2 * 60 * 1000
  }

  private static async pullFromCloudIfNeeded(): Promise<void> {
    await this.ensureInitialized()
    const { isLoggedIn, userId, scope } = await getAuthContext()
    if (!isLoggedIn || !userId) return
    if (!navigator.onLine) return
    if (!(await this.shouldPullFromCloud(scope))) return

    const localBases = await readJson<KnowledgeBase[]>(keyFor.bases(scope), [])
    const localEntries = await readJson<KnowledgeEntry[]>(keyFor.entries(scope), [])
    const localRoleMap = await readJson<Record<string, string>>(keyFor.roleMap(scope), {})

    const [{ data: remoteBases, error: basesError }, { data: remoteEntries, error: entriesError }, { data: roleRows, error: rolesError }] = await Promise.all([
      supabase.from('knowledge_bases').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
      supabase.from('knowledge_entries').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
      supabase.from('ai_roles').select('id, knowledge_base_id').eq('user_id', userId)
    ])

    if (basesError || entriesError || rolesError) {
      const message = basesError?.message || entriesError?.message || rolesError?.message || '拉取云端知识库失败'
      throw new Error(message)
    }

    const remoteRoleMap: Record<string, string> = {}
    ;(roleRows || []).forEach((r: any) => {
      if (r?.id && r?.knowledge_base_id) {
        remoteRoleMap[r.id] = r.knowledge_base_id
      }
    })

    const mergedBases = mergeByIdPreferNewer(localBases, (remoteBases || []) as KnowledgeBase[])
    const mergedEntries = mergeByIdPreferNewer(localEntries, (remoteEntries || []) as KnowledgeEntry[])
    const mergedRoleMap = mergeRoleMapPreferLocal(remoteRoleMap, localRoleMap)

    await Promise.all([
      writeJson(keyFor.bases(scope), mergedBases),
      writeJson(keyFor.entries(scope), mergedEntries),
      writeJson(keyFor.roleMap(scope), mergedRoleMap),
      indexedDBStorage.setItem(keyFor.lastPullAt(scope), String(Date.now()))
    ])
  }

  private static async enqueueSync(item: Omit<KnowledgeSyncItem, 'id' | 'timestamp' | 'retries'>): Promise<void> {
    const { scope } = await getAuthContext()
    const queue = await readJson<KnowledgeSyncItem[]>(keyFor.syncQueue(scope), [])
    const fullItem: KnowledgeSyncItem = {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      retries: 0,
      ...item
    }
    queue.push(fullItem)
    await writeJson(keyFor.syncQueue(scope), queue)
  }

  private static async processSyncQueue(): Promise<void> {
    await this.ensureInitialized()
    const { isLoggedIn, userId, scope } = await getAuthContext()
    if (!isLoggedIn || !userId) return
    if (!navigator.onLine) return

    const queue = await readJson<KnowledgeSyncItem[]>(keyFor.syncQueue(scope), [])
    if (queue.length === 0) return

    const maxRetries = 3
    const remaining: KnowledgeSyncItem[] = []

    for (const item of queue) {
      try {
        await this.syncItemToCloud(item, userId)
      } catch (error) {
        if (isProbablyNetworkError(error)) {
          item.retries++
          if (item.retries < maxRetries) {
            remaining.push(item)
          }
          continue
        }

        item.retries++
        if (item.retries < maxRetries) {
          remaining.push(item)
        }
      }
    }

    await writeJson(keyFor.syncQueue(scope), remaining)
  }

  private static async syncItemToCloud(item: KnowledgeSyncItem, userId: string): Promise<void> {
    if (item.entity === 'knowledge_base') {
      if (item.op === 'upsert') {
        const kb: KnowledgeBase = item.data
        const payload: any = {
          id: kb.id,
          user_id: userId,
          name: kb.name,
          description: kb.description || '',
          created_at: kb.created_at,
          updated_at: kb.updated_at
        }
        const { error } = await supabase.from('knowledge_bases').upsert(payload, { onConflict: 'id' })
        if (error) throw new Error(`知识库同步失败: ${error.message}`)
        return
      }

      if (item.op === 'delete') {
        const baseId: string = item.data?.id
        if (!baseId) return
        await supabase.from('knowledge_entries').delete().eq('knowledge_base_id', baseId)
        const { error } = await supabase.from('knowledge_bases').delete().eq('id', baseId)
        if (error) throw new Error(`删除知识库同步失败: ${error.message}`)
        return
      }
    }

    if (item.entity === 'knowledge_entry') {
      if (item.op === 'upsert') {
        const e: KnowledgeEntry = item.data
        const payload: any = {
          id: e.id,
          name: e.name,
          keywords: e.keywords,
          explanation: e.explanation,
          knowledge_base_id: e.knowledge_base_id,
          created_at: e.created_at,
          updated_at: e.updated_at,
          user_id: userId
        }
        const { error } = await supabase.from('knowledge_entries').upsert(payload, { onConflict: 'id' })
        if (error) throw new Error(`知识条目同步失败: ${error.message}`)
        return
      }

      if (item.op === 'delete') {
        const entryId: string = item.data?.id
        if (!entryId) return
        const { error } = await supabase.from('knowledge_entries').delete().eq('id', entryId)
        if (error) throw new Error(`删除知识条目同步失败: ${error.message}`)
        return
      }
    }

    if (item.entity === 'role_knowledge' && item.op === 'set') {
      const roleId: string = item.data?.roleId
      const knowledgeBaseId: string | null = item.data?.knowledgeBaseId ?? null
      if (!roleId) return
      if (!isValidUUID(roleId)) return

      const { data: roleExists, error: checkError } = await supabase
        .from('ai_roles')
        .select('id')
        .eq('id', roleId)
        .single()

      if (checkError && (checkError as any).code === 'PGRST116') {
        throw new Error('角色尚未同步到数据库')
      }
      if (checkError) {
        throw new Error(`检查角色失败: ${checkError.message}`)
      }
      if (!roleExists) {
        throw new Error('角色不存在')
      }

      const { error } = await supabase
        .from('ai_roles')
        .update({ knowledge_base_id: knowledgeBaseId })
        .eq('id', roleId)

      if (error) throw new Error(`更新角色知识库失败: ${error.message}`)
    }
  }

  static async getKnowledgeBases(): Promise<KnowledgeBase[]> {
    await this.ensureInitialized()

    const auth = await getAuthContext()
    let scopeToUse = auth.scope
    let bases = await readJson<KnowledgeBase[]>(keyFor.bases(scopeToUse), [])

    if (!auth.isLoggedIn && scopeToUse === 'local' && bases.length === 0) {
      const fallbackScope = await resolveFallbackScope()
      if (fallbackScope) {
        const fallbackBases = await readJson<KnowledgeBase[]>(keyFor.bases(fallbackScope), [])
        if (fallbackBases.length > 0) {
          scopeToUse = fallbackScope
          bases = fallbackBases
        }
      }
    }

    if (bases.length === 0) {
      try {
        await this.pullFromCloudIfNeeded()
      } catch {}
      bases = await readJson<KnowledgeBase[]>(keyFor.bases(scopeToUse), [])
    } else {
      this.pullFromCloudIfNeeded().catch(() => {})
    }

    return bases.sort((a, b) => compareIsoDesc(a.created_at, b.created_at))
  }

  static async getKnowledgeBaseStats(): Promise<KnowledgeBaseStats[]> {
    await this.ensureInitialized()

    const auth = await getAuthContext()
    let scopeToUse = auth.scope
    let [bases, entries] = await Promise.all([
      readJson<KnowledgeBase[]>(keyFor.bases(scopeToUse), []),
      readJson<KnowledgeEntry[]>(keyFor.entries(scopeToUse), [])
    ])

    if (!auth.isLoggedIn && scopeToUse === 'local' && bases.length === 0 && entries.length === 0) {
      const fallbackScope = await resolveFallbackScope()
      if (fallbackScope) {
        const [fallbackBases, fallbackEntries] = await Promise.all([
          readJson<KnowledgeBase[]>(keyFor.bases(fallbackScope), []),
          readJson<KnowledgeEntry[]>(keyFor.entries(fallbackScope), [])
        ])
        if (fallbackBases.length > 0 || fallbackEntries.length > 0) {
          scopeToUse = fallbackScope
          bases = fallbackBases
          entries = fallbackEntries
        }
      }
    }

    if (bases.length === 0 && entries.length === 0) {
      try {
        await this.pullFromCloudIfNeeded()
      } catch {}
      ;[bases, entries] = await Promise.all([
        readJson<KnowledgeBase[]>(keyFor.bases(scopeToUse), []),
        readJson<KnowledgeEntry[]>(keyFor.entries(scopeToUse), [])
      ])
    } else {
      this.pullFromCloudIfNeeded().catch(() => {})
    }

    const entryGroups = new Map<string, KnowledgeEntry[]>()
    entries.forEach(e => {
      const list = entryGroups.get(e.knowledge_base_id) || []
      list.push(e)
      entryGroups.set(e.knowledge_base_id, list)
    })

    return bases
      .map(kb => {
        const list = entryGroups.get(kb.id) || []
        const lastUpdated = list.length > 0
          ? list.map(e => e.updated_at).sort(compareIsoDesc)[0]
          : kb.updated_at
        return {
          id: kb.id,
          name: kb.name,
          entryCount: list.length,
          lastUpdated
        }
      })
      .sort((a, b) => compareIsoDesc(a.lastUpdated, b.lastUpdated))
  }

  static async createKnowledgeBase(request: CreateKnowledgeBaseRequest): Promise<KnowledgeBase> {
    await this.ensureInitialized()
    const { isLoggedIn, userId, scope } = await getAuthContext()

    const newKnowledgeBase: KnowledgeBase = {
      id: uuidv4(),
      name: request.name,
      description: request.description || '',
      user_id: isLoggedIn && userId ? userId : 'local_user',
      created_at: nowIso(),
      updated_at: nowIso()
    }

    const existingBases = await readJson<KnowledgeBase[]>(keyFor.bases(scope), [])
    await writeJson(keyFor.bases(scope), [newKnowledgeBase, ...existingBases])

    await this.enqueueSync({ entity: 'knowledge_base', op: 'upsert', data: newKnowledgeBase })
    await this.processSyncQueue()

    return newKnowledgeBase
  }

  static async updateKnowledgeBase(id: string, request: UpdateKnowledgeBaseRequest): Promise<KnowledgeBase> {
    await this.ensureInitialized()
    const { scope } = await getAuthContext()

    const bases = await readJson<KnowledgeBase[]>(keyFor.bases(scope), [])
    const index = bases.findIndex(b => b.id === id)
    if (index === -1) {
      throw new Error('知识库不存在')
    }

    const updatedBase: KnowledgeBase = {
      ...bases[index],
      name: request.name !== undefined ? request.name : bases[index].name,
      description: request.description !== undefined ? request.description : bases[index].description,
      updated_at: nowIso()
    }

    const next = [...bases]
    next[index] = updatedBase
    await writeJson(keyFor.bases(scope), next)

    await this.enqueueSync({ entity: 'knowledge_base', op: 'upsert', data: updatedBase })
    await this.processSyncQueue()

    return updatedBase
  }

  static async deleteKnowledgeBase(id: string): Promise<void> {
    await this.ensureInitialized()
    const { scope } = await getAuthContext()

    const [bases, entries, roleMap] = await Promise.all([
      readJson<KnowledgeBase[]>(keyFor.bases(scope), []),
      readJson<KnowledgeEntry[]>(keyFor.entries(scope), []),
      readJson<Record<string, string>>(keyFor.roleMap(scope), {})
    ])

    const nextBases = bases.filter(b => b.id !== id)
    const nextEntries = entries.filter(e => e.knowledge_base_id !== id)

    const nextRoleMap: Record<string, string> = { ...roleMap }
    Object.entries(nextRoleMap).forEach(([roleId, baseId]) => {
      if (baseId === id) {
        delete nextRoleMap[roleId]
      }
    })

    await Promise.all([
      writeJson(keyFor.bases(scope), nextBases),
      writeJson(keyFor.entries(scope), nextEntries),
      writeJson(keyFor.roleMap(scope), nextRoleMap)
    ])

    await this.enqueueSync({ entity: 'knowledge_base', op: 'delete', data: { id } })
    await this.processSyncQueue()
  }

  static async getKnowledgeEntries(knowledgeBaseId: string): Promise<KnowledgeEntry[]> {
    await this.ensureInitialized()

    const auth = await getAuthContext()
    let scopeToUse = auth.scope
    let entries = await readJson<KnowledgeEntry[]>(keyFor.entries(scopeToUse), [])
    let filtered = entries.filter(e => e.knowledge_base_id === knowledgeBaseId)

    if (!auth.isLoggedIn && scopeToUse === 'local' && filtered.length === 0) {
      const fallbackScope = await resolveFallbackScope()
      if (fallbackScope) {
        const fallbackEntries = await readJson<KnowledgeEntry[]>(keyFor.entries(fallbackScope), [])
        const fallbackFiltered = fallbackEntries.filter(e => e.knowledge_base_id === knowledgeBaseId)
        if (fallbackFiltered.length > 0) {
          scopeToUse = fallbackScope
          entries = fallbackEntries
          filtered = fallbackFiltered
        }
      }
    }

    if (filtered.length === 0) {
      try {
        await this.pullFromCloudIfNeeded()
      } catch {}
      entries = await readJson<KnowledgeEntry[]>(keyFor.entries(scopeToUse), [])
      filtered = entries.filter(e => e.knowledge_base_id === knowledgeBaseId)
    } else {
      this.pullFromCloudIfNeeded().catch(() => {})
    }

    return filtered.sort((a, b) => compareIsoDesc(a.created_at, b.created_at))
  }

  static async createKnowledgeEntry(request: CreateKnowledgeEntryRequest): Promise<KnowledgeEntry> {
    await this.ensureInitialized()
    const { isLoggedIn, userId, scope } = await getAuthContext()

    const newEntry: KnowledgeEntry = {
      id: uuidv4(),
      name: request.name,
      keywords: request.keywords,
      explanation: request.explanation,
      knowledge_base_id: request.knowledge_base_id,
      created_at: nowIso(),
      updated_at: nowIso()
    }

    const existingEntries = await readJson<KnowledgeEntry[]>(keyFor.entries(scope), [])
    await writeJson(keyFor.entries(scope), [newEntry, ...existingEntries])

    await this.enqueueSync({ entity: 'knowledge_entry', op: 'upsert', data: { ...newEntry, user_id: isLoggedIn && userId ? userId : undefined } })
    await this.processSyncQueue()

    return newEntry
  }

  static async updateKnowledgeEntry(id: string, request: UpdateKnowledgeEntryRequest): Promise<KnowledgeEntry> {
    await this.ensureInitialized()
    const { scope } = await getAuthContext()

    const entries = await readJson<KnowledgeEntry[]>(keyFor.entries(scope), [])
    const index = entries.findIndex(e => e.id === id)
    if (index === -1) {
      throw new Error('知识条目不存在')
    }

    const updatedEntry: KnowledgeEntry = {
      ...entries[index],
      name: request.name !== undefined ? request.name : entries[index].name,
      keywords: request.keywords !== undefined ? request.keywords : entries[index].keywords,
      explanation: request.explanation !== undefined ? request.explanation : entries[index].explanation,
      updated_at: nowIso()
    }

    const next = [...entries]
    next[index] = updatedEntry
    await writeJson(keyFor.entries(scope), next)

    await this.enqueueSync({ entity: 'knowledge_entry', op: 'upsert', data: updatedEntry })
    await this.processSyncQueue()

    return updatedEntry
  }

  static async deleteKnowledgeEntry(id: string): Promise<void> {
    await this.ensureInitialized()
    const { scope } = await getAuthContext()

    const entries = await readJson<KnowledgeEntry[]>(keyFor.entries(scope), [])
    await writeJson(keyFor.entries(scope), entries.filter(e => e.id !== id))

    await this.enqueueSync({ entity: 'knowledge_entry', op: 'delete', data: { id } })
    await this.processSyncQueue()
  }

  static async importKnowledgeEntries(request: ImportKnowledgeEntriesRequest): Promise<KnowledgeEntry[]> {
    await this.ensureInitialized()
    const { isLoggedIn, userId, scope } = await getAuthContext()

    const newEntries: KnowledgeEntry[] = request.entries.map(entry => ({
      id: uuidv4(),
      name: entry.name,
      keywords: entry.keywords,
      explanation: entry.explanation,
      knowledge_base_id: request.knowledge_base_id,
      created_at: nowIso(),
      updated_at: nowIso()
    }))

    const existingEntries = await readJson<KnowledgeEntry[]>(keyFor.entries(scope), [])
    await writeJson(keyFor.entries(scope), [...newEntries, ...existingEntries])

    if (isLoggedIn && userId && navigator.onLine) {
      try {
        const payload = newEntries.map(e => ({
          ...e,
          user_id: userId
        }))
        const { error } = await supabase.from('knowledge_entries').upsert(payload, { onConflict: 'id' })
        if (error) {
          throw error
        }
      } catch (error) {
        if (isProbablyNetworkError(error)) {
          for (const e of newEntries) {
            await this.enqueueSync({ entity: 'knowledge_entry', op: 'upsert', data: { ...e, user_id: userId } })
          }
        } else {
          throw new Error(`批量导入知识条目失败: ${error instanceof Error ? error.message : String(error)}`)
        }
      }
    } else {
      for (const e of newEntries) {
        await this.enqueueSync({ entity: 'knowledge_entry', op: 'upsert', data: e })
      }
    }

    await this.processSyncQueue()

    return newEntries
  }

  static async searchKnowledgeEntries(knowledgeBaseId: string, keywords: string[]): Promise<KnowledgeEntry[]> {
    await this.ensureInitialized()
    if (!keywords.length) return []

    const auth = await getAuthContext()
    let scopeToUse = auth.scope
    let allEntries = await readJson<KnowledgeEntry[]>(keyFor.entries(scopeToUse), [])
    let baseEntries = allEntries.filter(e => e.knowledge_base_id === knowledgeBaseId)

    if (!auth.isLoggedIn && scopeToUse === 'local' && baseEntries.length === 0) {
      const fallbackScope = await resolveFallbackScope()
      if (fallbackScope) {
        const fallbackEntries = await readJson<KnowledgeEntry[]>(keyFor.entries(fallbackScope), [])
        const fallbackBaseEntries = fallbackEntries.filter(e => e.knowledge_base_id === knowledgeBaseId)
        if (fallbackBaseEntries.length > 0) {
          scopeToUse = fallbackScope
          allEntries = fallbackEntries
          baseEntries = fallbackBaseEntries
        }
      }
    }

    if (baseEntries.length === 0) {
      try {
        await this.pullFromCloudIfNeeded()
      } catch {}
      allEntries = await readJson<KnowledgeEntry[]>(keyFor.entries(scopeToUse), [])
      baseEntries = allEntries.filter(e => e.knowledge_base_id === knowledgeBaseId)
    } else {
      this.pullFromCloudIfNeeded().catch(() => {})
    }

    const normalizedKeywords = keywords.map(k => k.toLowerCase()).filter(Boolean)
    const matched = baseEntries.filter(entry => {
      const name = entry.name.toLowerCase()
      const explanation = entry.explanation.toLowerCase()
      return normalizedKeywords.some(keyword => {
        if (name.includes(keyword)) return true
        if (explanation.includes(keyword)) return true
        return entry.keywords.some(k => k.toLowerCase().includes(keyword))
      })
    })

    return matched.sort((a, b) => compareIsoDesc(a.created_at, b.created_at))
  }

  static async setRoleKnowledgeBase(roleId: string, knowledgeBaseId: string | null): Promise<void> {
    await this.ensureInitialized()
    const { isLoggedIn, userId, scope } = await getAuthContext()

    const roleMap = await readJson<Record<string, string>>(keyFor.roleMap(scope), {})
    const next = { ...roleMap }
    if (knowledgeBaseId) {
      next[roleId] = knowledgeBaseId
    } else {
      delete next[roleId]
    }
    await writeJson(keyFor.roleMap(scope), next)

    if (!(isLoggedIn && userId && navigator.onLine)) {
      await this.enqueueSync({ entity: 'role_knowledge', op: 'set', data: { roleId, knowledgeBaseId } })
      return
    }

    if (!isValidUUID(roleId)) {
      return
    }

    try {
      const { error } = await supabase
        .from('ai_roles')
        .update({ knowledge_base_id: knowledgeBaseId })
        .eq('id', roleId)

      if (error) {
        throw error
      }
    } catch (error) {
      if (isProbablyNetworkError(error)) {
        await this.enqueueSync({ entity: 'role_knowledge', op: 'set', data: { roleId, knowledgeBaseId } })
      } else {
        throw new Error(`更新角色知识库失败: ${error instanceof Error ? error.message : String(error)}`)
      }
    }
  }

  static async getRoleKnowledgeBaseId(roleId: string): Promise<string | null> {
    await this.ensureInitialized()
    const auth = await getAuthContext()

    const roleMap = await readJson<Record<string, string>>(keyFor.roleMap(auth.scope), {})
    if (roleMap[roleId]) {
      return roleMap[roleId]
    }

    if (!auth.isLoggedIn && auth.scope === 'local') {
      const fallbackScope = await resolveFallbackScope()
      if (fallbackScope) {
        const fallbackRoleMap = await readJson<Record<string, string>>(keyFor.roleMap(fallbackScope), {})
        if (fallbackRoleMap[roleId]) {
          return fallbackRoleMap[roleId]
        }
      }
    }

    if (!auth.isLoggedIn) {
      return null
    }

    if (!navigator.onLine) {
      return null
    }

    if (!isValidUUID(roleId)) {
      return null
    }

    try {
      const { data, error } = await supabase
        .from('ai_roles')
        .select('knowledge_base_id')
        .eq('id', roleId)
        .single()

      if (error) {
        if ((error as any).code === 'PGRST116') {
          return null
        }
        throw error
      }

      const knowledgeBaseId = (data as any)?.knowledge_base_id || null
      if (knowledgeBaseId) {
        await writeJson(keyFor.roleMap(auth.scope), { ...roleMap, [roleId]: knowledgeBaseId })
      }
      return knowledgeBaseId
    } catch {
      return null
    }
  }

  static async getRoleKnowledgeBase(roleId: string): Promise<KnowledgeBase | null> {
    await this.ensureInitialized()
    const knowledgeBaseId = await this.getRoleKnowledgeBaseId(roleId)
    if (!knowledgeBaseId) return null

    const allBases = await this.getKnowledgeBases()
    return allBases.find(b => b.id === knowledgeBaseId) || null
  }
}
