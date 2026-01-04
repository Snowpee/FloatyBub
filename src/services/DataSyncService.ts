import { supabase } from '../lib/supabase'
import { indexedDBStorage } from '../store/storage'
import { convertAvatarFromImport } from '../utils/avatarUtils'
import type { Database } from '../lib/supabase'

const console: Console = { ...globalThis.console, log: (..._args: any[]) => {} }

// 同步项目类型
export interface SyncItem {
  id: string
  type: 'llm_config' | 'ai_role' | 'global_prompt' | 'voice_settings' | 'general_settings' | 'user_profile' | 'user_role'
  data: any
  timestamp: number
  retries: number
}

// 同步状态类型
export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'error' | 'offline'

// 同步结果类型
export interface SyncResult {
  success: boolean
  error?: string
  syncedItems: number
}

// 数据同步服务类
export class DataSyncService {
  private syncQueue: SyncItem[] = []
  private isOnline = navigator.onLine
  private syncStatus: SyncStatus = 'idle'
  private lastSyncTime: number | null = null
  private maxRetries = 3
  private retryDelay = 1000 // 1秒
  private statusCallbacks: ((status: SyncStatus) => void)[] = []

  private initialized = false
  private initPromise: Promise<void> | null = null
  private currentUserId: string | null = null
  private onlineListener = () => {
    this.handleOnline().catch(() => {})
  }
  private offlineListener = () => {
    this.handleOffline()
  }

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', this.onlineListener)
      window.addEventListener('offline', this.offlineListener)
    }
  }

  private async ensureInitialized(): Promise<void> {
    if (this.initialized) return
    if (this.initPromise) return this.initPromise

    this.initPromise = (async () => {
      if (!this.isOnline) {
        this.updateStatus('offline')
      }
      this.initialized = true
    })()

    return this.initPromise
  }

  private getQueueKey(userId: string) {
    return `dataSync:queue:${userId}`
  }

  private getLastSyncTimeKey(userId: string) {
    return `dataSync:lastSyncTime:${userId}`
  }

  private safeJsonParse<T>(value: string | null, fallback: T): T {
    if (!value) return fallback
    try {
      return JSON.parse(value) as T
    } catch {
      return fallback
    }
  }

  private async ensureScopeForUser(userId: string): Promise<void> {
    await this.ensureInitialized()
    if (this.currentUserId === userId) return

    const [queueRaw, lastSyncRaw] = await Promise.all([
      indexedDBStorage.getItem(this.getQueueKey(userId)),
      indexedDBStorage.getItem(this.getLastSyncTimeKey(userId))
    ])

    this.syncQueue = this.safeJsonParse<SyncItem[]>(queueRaw, [])
    this.lastSyncTime = lastSyncRaw ? Number(lastSyncRaw) : null
    this.currentUserId = userId
  }

  private async persistQueue(): Promise<void> {
    if (!this.currentUserId) return
    await indexedDBStorage.setItem(this.getQueueKey(this.currentUserId), JSON.stringify(this.syncQueue))
  }

  private async persistLastSyncTime(): Promise<void> {
    if (!this.currentUserId || this.lastSyncTime === null) return
    await indexedDBStorage.setItem(this.getLastSyncTimeKey(this.currentUserId), String(this.lastSyncTime))
  }

  private isProbablyNetworkError(error: unknown) {
    if (!this.isOnline) return true
    if (!navigator.onLine) return true
    if (error instanceof TypeError) return true
    const message = error instanceof Error ? error.message : String(error)
    const m = message.toLowerCase()
    return m.includes('failed to fetch') || m.includes('network') || m.includes('connection') || m.includes('timeout')
  }

  // 添加状态监听器
  onStatusChange(callback: (status: SyncStatus) => void) {
    this.statusCallbacks.push(callback)
    return () => {
      const index = this.statusCallbacks.indexOf(callback)
      if (index > -1) {
        this.statusCallbacks.splice(index, 1)
      }
    }
  }

  // 更新同步状态
  private updateStatus(status: SyncStatus) {
    this.syncStatus = status
    this.statusCallbacks.forEach(callback => callback(status))
  }

  // 获取当前同步状态
  getStatus(): SyncStatus {
    return this.syncStatus
  }

  // 获取最后同步时间
  getLastSyncTime(): number | null {
    return this.lastSyncTime
  }

  // 生成唯一ID
  private generateId(): string {
    return crypto.randomUUID()
  }

  // 添加到同步队列
  async queueSync(type: SyncItem['type'], data: any): Promise<void> {
    await this.ensureInitialized()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      throw new Error('用户未登录')
    }
    await this.ensureScopeForUser(user.id)

    const item: SyncItem = {
      id: this.generateId(),
      type,
      data: { ...data, updated_at: new Date().toISOString() },
      timestamp: Date.now(),
      retries: 0
    }

    this.syncQueue.push(item)

    await this.persistQueue()


    if (this.isOnline && this.syncStatus !== 'syncing') {
      await this.processSyncQueue()
    } else if (!this.isOnline) {
      this.updateStatus('offline')
    }
  }

  // 处理同步队列
  private async processSyncQueue(): Promise<SyncResult> {
    await this.ensureInitialized()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      throw new Error('用户未登录')
    }
    await this.ensureScopeForUser(user.id)

    if (this.syncQueue.length === 0) {
      return { success: true, syncedItems: 0 }
    }

    this.updateStatus('syncing')
    let syncedItems = 0
    const errors: string[] = []

    const queueSnapshot = [...this.syncQueue]
    const remaining: SyncItem[] = []

    for (const originalItem of queueSnapshot) {
      let item: SyncItem = { ...originalItem }

      while (true) {
        try {
          await this.syncToCloud(item)
          syncedItems++
          break
        } catch (error) {
          const isNetwork = this.isProbablyNetworkError(error)
          item = { ...item, retries: item.retries + 1 }

          if (item.retries < this.maxRetries && isNetwork) {
            remaining.push(item)
            break
          }

          if (item.retries < this.maxRetries) {
            await new Promise(resolve => setTimeout(resolve, this.retryDelay * item.retries))
            continue
          }

          errors.push(`${item.type}: ${error instanceof Error ? error.message : '未知错误'}`)
          break
        }
      }
    }

    this.syncQueue = remaining
    await this.persistQueue()

    if (errors.length > 0) {
      this.updateStatus('error')
      return { success: false, error: errors.join('; '), syncedItems }
    } else {
      this.lastSyncTime = Date.now()
      await this.persistLastSyncTime()
      this.updateStatus('synced')
      return { success: true, syncedItems }
    }
  }

  // 同步到云端
  private async syncToCloud(item: SyncItem): Promise<void> {
    const { type, data } = item

    // 确保用户已登录
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      throw new Error('用户未登录')
    }

    // 添加用户ID
    const dataWithUserId = { ...data, user_id: user.id }

    switch (type) {
      case 'llm_config':
        await this.syncLLMConfig(dataWithUserId)
        break
      case 'ai_role':
        await this.syncAIRole(dataWithUserId)
        break
      case 'global_prompt':
        await this.syncGlobalPrompt(dataWithUserId)
        break
      case 'voice_settings':
        await this.syncVoiceSettings(dataWithUserId)
        break
      case 'general_settings':
        await this.syncGeneralSettings(dataWithUserId)
        break
      case 'user_profile':
        await this.syncUserProfile(dataWithUserId)
        break
      case 'user_role':
        await this.syncUserRole(dataWithUserId)
        break
      default:
        throw new Error(`未知的同步类型: ${type}`)
    }
  }

  // 同步LLM配置
  private async syncLLMConfig(data: any): Promise<void> {
    // 将前端字段映射到数据库结构
    const dbData = {
      id: data.id,
      user_id: data.user_id,
      name: data.name,
      provider: data.provider,
      model: data.model,
      config: {
        apiKey: data.apiKey,
        baseUrl: data.baseUrl,
        proxyUrl: data.proxyUrl,
        temperature: data.temperature,
        maxTokens: data.maxTokens,
        enabled: data.enabled
      },
      is_default: false,
      created_at: data.createdAt ? new Date(data.createdAt).toISOString() : new Date().toISOString(),
      updated_at: data.updatedAt ? new Date(data.updatedAt).toISOString() : new Date().toISOString()
    }

    const { error } = await supabase
      .from('llm_configs')
      .upsert(dbData, { onConflict: 'id' })
    
    if (error) {
      throw new Error(`LLM配置同步失败: ${error.message}`)
    }
  }

  // 同步AI角色
  private async syncAIRole(data: any): Promise<void> {
    console.log('🔄 syncAIRole: 开始同步AI角色到数据库', {
      roleId: data.id,
      roleName: data.name,
      isFavorite: data.isFavorite,
      userId: data.user_id
    });

    // 安全的日期转换函数
    const safeToISOString = (dateValue: any): string => {
      if (!dateValue) {
        return new Date().toISOString();
      }
      
      // 如果已经是字符串，尝试解析
      if (typeof dateValue === 'string') {
        const parsed = new Date(dateValue);
        if (isNaN(parsed.getTime())) {
          console.warn('⚠️ syncAIRole: 无效的日期字符串，使用当前时间', dateValue);
          return new Date().toISOString();
        }
        return parsed.toISOString();
      }
      
      // 如果是Date对象
      if (dateValue instanceof Date) {
        if (isNaN(dateValue.getTime())) {
          console.warn('⚠️ syncAIRole: 无效的Date对象，使用当前时间', dateValue);
          return new Date().toISOString();
        }
        return dateValue.toISOString();
      }
      
      // 其他情况，尝试转换
      try {
        const date = new Date(dateValue);
        if (isNaN(date.getTime())) {
          console.warn('⚠️ syncAIRole: 无法转换的日期值，使用当前时间', dateValue);
          return new Date().toISOString();
        }
        return date.toISOString();
      } catch (error) {
        console.warn('⚠️ syncAIRole: 日期转换异常，使用当前时间', dateValue, error);
        return new Date().toISOString();
      }
    };

    const isBase64Image = (value: string | undefined | null) => {
      if (!value) return false
      return value.startsWith('data:image/')
    }

    const dbData: any = {
      id: data.id,
      user_id: data.user_id,
      name: data.name,
      prompt: data.systemPrompt,
      is_favorite: data.isFavorite || false, // 添加收藏字段
      global_prompt_ids: data.globalPromptIds || [], // 新的多个提示词ID数组
      settings: {
        description: data.description,
        openingMessages: data.openingMessages,
        currentOpeningIndex: data.currentOpeningIndex,
        globalPromptId: data.globalPromptId, // 保持向后兼容
        globalPromptIds: data.globalPromptIds, // 新的多个提示词ID数组
        voiceModelId: data.voiceModelId
      },
      created_at: safeToISOString(data.createdAt),
      updated_at: safeToISOString(data.updatedAt)
    }

    if (!isBase64Image(data.avatar)) {
      dbData.avatar = data.avatar
    } else {
      console.warn('🚫 syncAIRole: 检测到 base64 头像，已在写库时丢弃')
    }

    console.log('📝 syncAIRole: 数据库数据结构', {
      id: dbData.id,
      user_id: dbData.user_id,
      name: dbData.name,
      is_favorite: dbData.is_favorite
    });

    const { error } = await supabase
      .from('ai_roles')
      .upsert(dbData, { onConflict: 'id' })
    
    if (error) {
      console.error('❌ syncAIRole: 同步失败', error);
      throw new Error(`AI角色同步失败: ${error.message}`)
    } else {
      console.log('✅ syncAIRole: 角色同步成功', {
        roleId: data.id,
        roleName: data.name,
        is_favorite: dbData.is_favorite
      });
    }
  }

  // 同步全局提示词
  private async syncGlobalPrompt(data: any): Promise<void> {
    // 将前端字段映射到数据库结构
    const dbData = {
      id: data.id,
      user_id: data.user_id,
      title: data.title,
      content: data.prompt,
      category: data.description || '',
      created_at: data.createdAt ? new Date(data.createdAt).toISOString() : new Date().toISOString(),
      updated_at: data.updatedAt ? new Date(data.updatedAt).toISOString() : new Date().toISOString()
    }

    const { error } = await supabase
      .from('global_prompts')
      .upsert(dbData, { onConflict: 'id' })
    
    if (error) {
      throw new Error(`全局提示词同步失败: ${error.message}`)
    }
  }

  // 同步语音设置
  private async syncVoiceSettings(data: any): Promise<void> {
    // 将前端VoiceSettings数据映射到数据库结构
    const dbData = {
      user_id: data.user_id,
      provider: data.provider || 'fish-audio',
      model: data.defaultVoiceModelId || 'default',
      config: {
        apiUrl: data.apiUrl,
        apiKey: data.apiKey,
        readingMode: data.readingMode,
        customModels: data.customModels,
        modelVersion: data.modelVersion,
        defaultVoiceModelId: data.defaultVoiceModelId
      },
      voice_model_id: null, // 不使用外键引用
      speed: 1.0, // 默认语音速度
      pitch: 1.0, // 默认音调
      volume: 1.0, // 默认音量
      enabled: true, // 默认启用
      auto_play: false, // 默认不自动播放
      updated_at: data.updated_at || new Date().toISOString()
    }

    // 语音设置每个用户只有一条记录，使用user_id作为唯一标识
    const { error } = await supabase
      .from('voice_settings')
      .upsert(dbData, { onConflict: 'user_id' })
    
    if (error) {
      throw new Error(`语音设置同步失败: ${error.message}`)
    }
  }

  // 同步通用设置（快捷键、自动标题等）
  private async syncGeneralSettings(data: any): Promise<void> {
    const isFullReplace = data.__full === true

    // 读取已有设置以执行合并，避免覆盖其他字段
    const { data: existing, error: fetchError } = await supabase
      .from('general_settings')
      .select('id, settings')
      .eq('user_id', data.user_id)
      .maybeSingle()

    if (fetchError) {
      // 不阻断同步；记录后继续执行 upsert
      console.warn('⚠️ general_settings 获取失败，继续执行 upsert:', fetchError.message)
    }

    // 仅将传入的字段合并/替换到 settings，移除未定义键
    const incomingSettings: Record<string, any> = {}
    if (data.settings && typeof data.settings === 'object') {
      Object.entries(data.settings).forEach(([k, v]) => {
        if (v !== undefined) incomingSettings[k] = v
      })
    } else {
      // 兼容直接传递具体字段的情况
      if (data.sendMessageShortcut !== undefined) {
        incomingSettings.sendMessageShortcut = data.sendMessageShortcut
      }
      if (data.assistantConfig !== undefined) {
        incomingSettings.assistantConfig = data.assistantConfig
      }
      if (data.autoTitleConfig !== undefined) {
        incomingSettings.autoTitleConfig = data.autoTitleConfig
      }
      if (data.searchConfig !== undefined) {
        incomingSettings.searchConfig = data.searchConfig
      }
      if (data.chatStyle !== undefined) {
        incomingSettings.chatStyle = data.chatStyle
      }
    }

    // 保持双向兼容：若仅存在其中一个配置，自动补齐另一个
    if (incomingSettings.assistantConfig && !incomingSettings.autoTitleConfig) {
      incomingSettings.autoTitleConfig = incomingSettings.assistantConfig
    }
    if (incomingSettings.autoTitleConfig && !incomingSettings.assistantConfig) {
      incomingSettings.assistantConfig = incomingSettings.autoTitleConfig
    }

    const settingsToWrite = isFullReplace
      ? incomingSettings // 全量替换：直接使用传入的设置对象
      : {
          ...(existing?.settings || {}),
          ...incomingSettings // 增量合并：保留已有字段，更新传入的部分
        }

    const upsertData = {
      user_id: data.user_id,
      settings: settingsToWrite,
      updated_at: data.updated_at || new Date().toISOString()
    }

    const { error } = await supabase
      .from('general_settings')
      .upsert(upsertData, { onConflict: 'user_id' })

    if (error) {
      throw new Error(`通用设置同步失败: ${error.message}`)
    }
  }

  // 同步用户资料
  private async syncUserProfile(data: any): Promise<void> {
    console.log('🔄 DataSyncService.syncUserProfile: 开始同步用户资料', data)

    const isBase64Image = (value: string | undefined | null) => {
      if (!value) return false
      return value.startsWith('data:image/')
    }
    
    // 将前端用户资料数据映射到数据库结构
    const dbData: any = {
      user_id: data.user_id,
      display_name: data.name || data.displayName || data.display_name,
      bio: data.bio || '',
      preferences: data.preferences || {},
      updated_at: data.updated_at || new Date().toISOString()
    }

    const incomingAvatar = data.avatar || data.avatarUrl || data.avatar_url
    if (!isBase64Image(incomingAvatar)) {
      dbData.avatar = incomingAvatar
    } else {
      console.warn('🚫 DataSyncService.syncUserProfile: 检测到 base64 头像，已在写库时丢弃')
    }

    console.log('📤 DataSyncService.syncUserProfile: 准备写入数据库', dbData)

    // 用户资料每个用户只有一条记录，使用user_id作为唯一标识
    const { error } = await supabase
      .from('user_profiles')
      .upsert(dbData, { onConflict: 'user_id' })
    
    if (error) {
      console.error('❌ DataSyncService.syncUserProfile: 同步失败', error)
      throw new Error(`用户资料同步失败: ${error.message}`)
    }
    
    console.log('✅ DataSyncService.syncUserProfile: 同步成功')
  }

  // 同步用户角色
  private async syncUserRole(data: any): Promise<void> {
    console.log('🔄 DataSyncService.syncUserRole: 开始同步用户角色', data)

    const isBase64Image = (value: string | undefined | null) => {
      if (!value) return false
      return value.startsWith('data:image/')
    }
    
    // 将前端用户角色数据映射到数据库结构
    const dbData: any = {
      id: data.id,
      user_id: data.user_id,
      name: data.name,
      description: data.description || '',
      created_at: data.createdAt ? new Date(data.createdAt).toISOString() : new Date().toISOString(),
      updated_at: data.updatedAt ? new Date(data.updatedAt).toISOString() : new Date().toISOString()
    }

    const incomingAvatar = data.avatar || ''
    if (!isBase64Image(incomingAvatar)) {
      dbData.avatar = incomingAvatar
    } else {
      dbData.avatar = ''
      console.warn('🚫 DataSyncService.syncUserRole: 检测到 base64 头像，已在写库时置空')
    }

    console.log('📤 DataSyncService.syncUserRole: 准备写入数据库', dbData)

    const { error } = await supabase
      .from('user_roles')
      .upsert(dbData, { onConflict: 'id' })
    
    if (error) {
      console.error('❌ DataSyncService.syncUserRole: 同步失败', error)
      throw new Error(`用户角色同步失败: ${error.message}`)
    }
    
    console.log('✅ DataSyncService.syncUserRole: 同步成功')
  }

  // 从云端拉取数据
  async pullFromCloud(userParam?: any): Promise<{
    llmConfigs: any[]
    aiRoles: any[]
    globalPrompts: any[]
    voiceSettings: any | null
    generalSettings: any | null
    userRoles: any[]
  }> {
    await this.ensureInitialized()

    let user = userParam
    if (!user) {
      const { data: { user: authUser } } = await supabase.auth.getUser()
      user = authUser
    }
    if (!user) {
      throw new Error('用户未登录')
    }

    await this.ensureScopeForUser(user.id)

    const [llmConfigsResult, aiRolesResult, globalPromptsResult, voiceSettingsResult, generalSettingsResult, userRolesResult] = await Promise.all([
      supabase.from('llm_configs').select('*').eq('user_id', user.id),
      supabase.from('ai_roles').select('*').eq('user_id', user.id),
      supabase.from('global_prompts').select('*').eq('user_id', user.id),
      supabase.from('voice_settings').select('*').eq('user_id', user.id).maybeSingle(),
      supabase.from('general_settings').select('*').eq('user_id', user.id).maybeSingle(),
      supabase.from('user_roles').select('*').eq('user_id', user.id)
    ])

    if (llmConfigsResult.error) {
      throw new Error(`拉取LLM配置失败: ${llmConfigsResult.error.message}`)
    }
    if (aiRolesResult.error) {
      throw new Error(`拉取AI角色失败: ${aiRolesResult.error.message}`)
    }
    if (globalPromptsResult.error) {
      throw new Error(`拉取全局提示词失败: ${globalPromptsResult.error.message}`)
    }
    if (userRolesResult.error) {
      throw new Error(`拉取用户角色失败: ${userRolesResult.error.message}`)
    }
    // 语音设置可能不存在，不抛出错误
    // 通用设置可能不存在，不抛出错误

    // 将数据库字段映射回前端格式
    const llmConfigs = (llmConfigsResult.data || []).map((item: any) => ({
      id: item.id,
      name: item.name,
      provider: item.provider,
      model: item.model,
      apiKey: item.config?.apiKey || '',
      baseUrl: item.config?.baseUrl || '',
      proxyUrl: item.config?.proxyUrl || '',
      temperature: item.config?.temperature || 0.7,
      maxTokens: item.config?.maxTokens || 2048,
      enabled: item.config?.enabled || false,
      createdAt: item.created_at,
      updatedAt: item.updated_at
    }))

    const aiRoles = (aiRolesResult.data || []).map((item: any) => ({
      id: item.id,
      name: item.name,
      systemPrompt: item.prompt,
      // 统一规范化头像字段，兼容 local:avatar-* 与 URL/路径
      avatar: convertAvatarFromImport(item.avatar) || item.avatar,
      isFavorite: item.is_favorite || false, // 添加收藏字段映射
      description: item.settings?.description || '',
      openingMessages: item.settings?.openingMessages || [],
      currentOpeningIndex: item.settings?.currentOpeningIndex || 0,
      globalPromptId: item.settings?.globalPromptId || '', // 保持向后兼容
      globalPromptIds: item.global_prompt_ids || item.settings?.globalPromptIds || [], // 新的多个提示词ID数组
      voiceModelId: item.settings?.voiceModelId || '',
      createdAt: item.created_at,
      updatedAt: item.updated_at
    }))

    const globalPrompts = (globalPromptsResult.data || []).map((item: any) => ({
      id: item.id,
      title: item.title,
      prompt: item.content,
      description: item.category,
      createdAt: item.created_at,
      updatedAt: item.updated_at
    }))

    // 将语音设置数据库格式转换回前端格式
    let voiceSettings = null
    if (voiceSettingsResult.data) {
      const dbVoiceSettings = voiceSettingsResult.data
      voiceSettings = {
        provider: dbVoiceSettings.provider || 'fish-audio',
        apiUrl: dbVoiceSettings.config?.apiUrl || 'https://api.fish.audio',
        apiKey: dbVoiceSettings.config?.apiKey || '',
        readingMode: dbVoiceSettings.config?.readingMode || 'all',
        customModels: dbVoiceSettings.config?.customModels || [],
        modelVersion: dbVoiceSettings.config?.modelVersion || 'speech-1.6',
        defaultVoiceModelId: dbVoiceSettings.config?.defaultVoiceModelId || ''
      }
    }

    // 将用户角色数据库格式转换回前端格式
    const userRoles = (userRolesResult.data || []).map((item: any) => ({
      id: item.id,
      name: item.name,
      description: item.description || '',
      // 统一规范化头像字段，兼容 local:avatar-* 与 URL/路径
      avatar: convertAvatarFromImport(item.avatar) || item.avatar || '',
      createdAt: item.created_at,
      updatedAt: item.updated_at
    }))

    // 将通用设置数据库格式转换回前端格式
    let generalSettings = null
    if (generalSettingsResult.data) {
      const gs = generalSettingsResult.data
      generalSettings = {
        // 仅在存在云端记录时返回，避免覆盖本地默认值
        sendMessageShortcut: gs.settings?.sendMessageShortcut,
        assistantConfig: gs.settings?.assistantConfig || gs.settings?.autoTitleConfig,
        autoTitleConfig: gs.settings?.autoTitleConfig,
        searchConfig: gs.settings?.searchConfig,
        // 新增：同步 chatStyle 到前端，兼容旧数据不存在该字段的情况
        chatStyle: gs.settings?.chatStyle
      }
    }

    return {
      llmConfigs,
      aiRoles,
      globalPrompts,
      voiceSettings,
      generalSettings,
      userRoles
    }
  }

  // 手动触发同步
  async manualSync(): Promise<SyncResult> {
    await this.ensureInitialized()
    if (!this.isOnline) {
      throw new Error('网络未连接')
    }

    return await this.processSyncQueue()
  }

  // 清空同步队列
  clearQueue(): void {
    const run = async () => {
      await this.ensureInitialized()
      this.syncQueue = []
      this.updateStatus(this.isOnline ? 'idle' : 'offline')
      if (this.currentUserId) {
        await indexedDBStorage.removeItem(this.getQueueKey(this.currentUserId))
      }
    }

    run().catch(() => {})
  }

  // 网络连接恢复
  private async handleOnline(): Promise<void> {
    await this.ensureInitialized()
    this.isOnline = true

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (user?.id) {
        await this.ensureScopeForUser(user.id)
      }
    } catch {}

    if (this.syncQueue.length > 0 && this.syncStatus !== 'syncing') {
      await this.processSyncQueue()
      return
    }

    this.updateStatus('idle')
  }

  // 网络断开
  private handleOffline(): void {
    this.isOnline = false
    this.updateStatus('offline')
  }

  // 确保默认角色存在于数据库中
  async ensureDefaultRolesExist(user: any, defaultRoles: any[]): Promise<void> {
    if (!user || !user.id) {
      console.warn('⚠️ [DataSyncService] 用户未登录，跳过默认角色同步')
      return
    }

    console.log('🔄 [DataSyncService] 开始检查默认角色是否存在于数据库中...')
    
    try {
      // 确保使用正确的UUID格式的默认角色ID
      const defaultRoleIdMap: { [key: string]: string } = {
        'default-assistant': '00000000-0000-4000-8000-000000000001',
        'code-expert': '00000000-0000-4000-8000-000000000002',
        'creative-writer': '00000000-0000-4000-8000-000000000003'
      }
      
      // 转换角色ID为正确的UUID格式
      const normalizedRoles = defaultRoles.map(role => {
        const normalizedId = defaultRoleIdMap[role.id] || role.id
        return {
          ...role,
          id: normalizedId
        }
      })
      
      const defaultRoleIds = normalizedRoles.map(role => role.id)
      console.log('🔍 [DataSyncService] 检查的默认角色ID:', defaultRoleIds)
      
      // 检查哪些默认角色在数据库中不存在
      const { data: existingRoles, error: checkError } = await supabase
        .from('ai_roles')
        .select('id')
        .eq('user_id', user.id)
        .in('id', defaultRoleIds)
      
      if (checkError) {
        console.error('❌ [DataSyncService] 检查默认角色失败:', checkError)
        throw new Error(`检查默认角色失败: ${checkError.message}`)
      }
      
      const existingRoleIds = (existingRoles || []).map(role => role.id)
      const missingRoles = normalizedRoles.filter(role => !existingRoleIds.includes(role.id))
      
      if (missingRoles.length === 0) {
        console.log('✅ [DataSyncService] 所有默认角色已存在于数据库中')
        return
      }
      
      console.log(`🔄 [DataSyncService] 发现 ${missingRoles.length} 个缺失的默认角色，开始同步...`, 
        missingRoles.map(role => `${role.name} (${role.id})`))
      
      // 同步缺失的默认角色到数据库
      for (const role of missingRoles) {
        try {
          const roleWithUserId = { ...role, user_id: user.id }
          await this.syncAIRole(roleWithUserId)
          console.log(`✅ [DataSyncService] 默认角色 "${role.name}" (${role.id}) 同步成功`)
        } catch (error: any) {
          console.error(`❌ [DataSyncService] 默认角色 "${role.name}" (${role.id}) 同步失败:`, error)
          // 继续同步其他角色，不中断整个过程
        }
      }
      
      console.log('✅ [DataSyncService] 默认角色同步检查完成')
      
    } catch (error: any) {
      console.error('❌ [DataSyncService] 默认角色同步检查失败:', error)
      throw new Error(`默认角色同步检查失败: ${error.message}`)
    }
  }

  // 销毁服务
  destroy(): void {
    if (typeof window !== 'undefined') {
      window.removeEventListener('online', this.onlineListener)
      window.removeEventListener('offline', this.offlineListener)
    }
    this.statusCallbacks = []
  }
}

// 创建全局实例
export const dataSyncService = new DataSyncService()
