import { supabase } from '../lib/supabase'
import type { Database } from '../lib/supabase'

// 同步项目类型
export interface SyncItem {
  id: string
  type: 'llm_config' | 'ai_role' | 'global_prompt' | 'voice_settings'
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

  constructor() {
    // 监听网络状态变化
    window.addEventListener('online', this.handleOnline.bind(this))
    window.addEventListener('offline', this.handleOffline.bind(this))
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
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }

  // 添加到同步队列
  async queueSync(type: SyncItem['type'], data: any): Promise<void> {
    const item: SyncItem = {
      id: this.generateId(),
      type,
      data: { ...data, updated_at: new Date().toISOString() },
      timestamp: Date.now(),
      retries: 0
    }

    this.syncQueue.push(item)


    if (this.isOnline && this.syncStatus !== 'syncing') {
      await this.processSyncQueue()
    }
  }

  // 处理同步队列
  private async processSyncQueue(): Promise<SyncResult> {
    if (this.syncQueue.length === 0) {
      return { success: true, syncedItems: 0 }
    }

    this.updateStatus('syncing')
    let syncedItems = 0
    const errors: string[] = []

    while (this.syncQueue.length > 0) {
      const item = this.syncQueue.shift()!

      try {
        await this.syncToCloud(item)
        syncedItems++

      } catch (error) {

        
        if (item.retries < this.maxRetries) {
          item.retries++
          this.syncQueue.unshift(item)
          await new Promise(resolve => setTimeout(resolve, this.retryDelay * item.retries))
        } else {
          errors.push(`${item.type}: ${error instanceof Error ? error.message : '未知错误'}`)
        }
      }
    }

    if (errors.length > 0) {
      this.updateStatus('error')
      return { success: false, error: errors.join('; '), syncedItems }
    } else {
      this.lastSyncTime = Date.now()
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
    // 将前端字段映射到数据库结构
    const dbData = {
      id: data.id,
      user_id: data.user_id,
      name: data.name,
      prompt: data.systemPrompt,
      avatar: data.avatar,
      settings: {
        description: data.description,
        openingMessages: data.openingMessages,
        currentOpeningIndex: data.currentOpeningIndex,
        globalPromptId: data.globalPromptId,
        voiceModelId: data.voiceModelId
      },
      created_at: data.createdAt ? new Date(data.createdAt).toISOString() : new Date().toISOString(),
      updated_at: data.updatedAt ? new Date(data.updatedAt).toISOString() : new Date().toISOString()
    }

    const { error } = await supabase
      .from('ai_roles')
      .upsert(dbData, { onConflict: 'id' })
    
    if (error) {
      throw new Error(`AI角色同步失败: ${error.message}`)
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
      category: data.description || 'general',
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

  // 从云端拉取数据
  async pullFromCloud(userParam?: any): Promise<{
    llmConfigs: any[]
    aiRoles: any[]
    globalPrompts: any[]
    voiceSettings: any | null
  }> {
    let user = userParam
    if (!user) {
      const { data: { user: authUser } } = await supabase.auth.getUser()
      user = authUser
    }
    if (!user) {
      throw new Error('用户未登录')
    }

    const [llmConfigsResult, aiRolesResult, globalPromptsResult, voiceSettingsResult] = await Promise.all([
      supabase.from('llm_configs').select('*').eq('user_id', user.id),
      supabase.from('ai_roles').select('*').eq('user_id', user.id),
      supabase.from('global_prompts').select('*').eq('user_id', user.id),
      supabase.from('voice_settings').select('*').eq('user_id', user.id).maybeSingle()
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
    // 语音设置可能不存在，不抛出错误

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
      avatar: item.avatar,
      description: item.settings?.description || '',
      openingMessages: item.settings?.openingMessages || [],
      currentOpeningIndex: item.settings?.currentOpeningIndex || 0,
      globalPromptId: item.settings?.globalPromptId || '',
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

    return {
      llmConfigs,
      aiRoles,
      globalPrompts,
      voiceSettings
    }
  }

  // 手动触发同步
  async manualSync(): Promise<SyncResult> {
    if (!this.isOnline) {
      throw new Error('网络未连接')
    }

    return await this.processSyncQueue()
  }

  // 清空同步队列
  clearQueue(): void {
    this.syncQueue = []
    this.updateStatus('idle')
  }

  // 网络连接恢复
  private async handleOnline(): Promise<void> {

    this.isOnline = true
    
    if (this.syncQueue.length > 0) {
      await this.processSyncQueue()
    }
  }

  // 网络断开
  private handleOffline(): void {

    this.isOnline = false
    this.updateStatus('offline')
  }

  // 销毁服务
  destroy(): void {
    window.removeEventListener('online', this.handleOnline.bind(this))
    window.removeEventListener('offline', this.handleOffline.bind(this))
    this.statusCallbacks = []
  }
}

// 创建全局实例
export const dataSyncService = new DataSyncService()