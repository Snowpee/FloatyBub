import { supabase } from '@/lib/supabase'

const console: Console = { ...globalThis.console, log: (..._args: any[]) => {} }

export interface ConnectionTestResult {
  isConnected: boolean
  responseTime: number
  error?: string
  details?: {
    authStatus: boolean
    databaseAccess: boolean
    tableAccess: boolean
    timestamp: string
  }
}

export interface ConnectionStatus {
  status: 'connected' | 'disconnected' | 'testing' | 'error'
  lastChecked: Date | null
  responseTime: number | null
  error: string | null
}

class DatabaseConnectionTester {
  private static instance: DatabaseConnectionTester
  private connectionStatus: ConnectionStatus = {
    status: 'disconnected',
    lastChecked: null,
    responseTime: null,
    error: null
  }
  private listeners: Array<(status: ConnectionStatus) => void> = []

  static getInstance(): DatabaseConnectionTester {
    if (!DatabaseConnectionTester.instance) {
      DatabaseConnectionTester.instance = new DatabaseConnectionTester()
    }
    return DatabaseConnectionTester.instance
  }

  /**
   * 测试数据库连接
   */
  async testConnection(): Promise<ConnectionTestResult> {
    const startTime = Date.now()
    
    try {
      this.updateStatus('testing')

      // 1. 测试基本连接（使用 head + count 方式进行轻量健康检查）
      const { error: healthError } = await supabase
        .from('user_profiles')
        .select('id', { head: true, count: 'exact' })
        .limit(1)

      const responseTime = Date.now() - startTime

      // 2. 测试认证状态
      const { data: { session }, error: authError } = await supabase.auth.getSession()
      const authStatus = !authError && session !== null

      // 3. 测试数据库访问
      const databaseAccess = !healthError

      // 4. 测试表访问权限
      let tableAccess = false
      try {
        const { error: tableError } = await supabase
          .from('chat_sessions')
          .select('id')
          .limit(1)
        tableAccess = !tableError
      } catch (error) {
        // 表访问测试失败
      }

      const isConnected = databaseAccess && (authStatus || tableAccess)

      const result: ConnectionTestResult = {
        isConnected,
        responseTime,
        details: {
          authStatus,
          databaseAccess,
          tableAccess,
          timestamp: new Date().toISOString()
        }
      }

      if (!isConnected) {
        result.error = healthError?.message || authError?.message || '连接失败'
      }

      // 更新状态
      this.updateStatus(
        isConnected ? 'connected' : 'error',
        responseTime,
        result.error
      )



      return result
    } catch (error) {
      const responseTime = Date.now() - startTime
      const errorMessage = error instanceof Error ? error.message : '未知错误'
      
      this.updateStatus('error', responseTime, errorMessage)

      return {
        isConnected: false,
        responseTime,
        error: errorMessage
      }
    }
  }

  /**
   * 快速连接检查（用于同步前检查）
   */
  async quickConnectionCheck(): Promise<boolean> {
    try {
      const startTime = Date.now()
      
      // 创建超时Promise
      const timeoutPromise = new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('连接超时')), 5000)
      )
      
      // 创建数据库查询Promise（使用 head + count 方式）
      const dbQueryPromise = supabase
        .from('user_profiles')
        .select('id', { head: true, count: 'exact' })
        .limit(1)
      
      // 使用Promise.race进行超时控制
      const result = await Promise.race([
        dbQueryPromise,
        timeoutPromise
      ])

      const responseTime = Date.now() - startTime
      const isConnected = !result.error
      
      console.log(`🔍 [quickConnectionCheck] 连接检查结果: ${isConnected ? '成功' : '失败'}, 耗时: ${responseTime}ms`)
      if (result.error) {
        console.log(`❌ [quickConnectionCheck] 错误详情:`, result.error)
      }
      
      return isConnected
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知错误'
      console.log(`❌ [quickConnectionCheck] 连接检查异常:`, errorMessage)
      
      // 如果是超时错误，返回false
      if (errorMessage.includes('连接超时')) {
        return false
      }
      
      // 其他错误也返回false
      return false
    }
  }

  /**
   * 获取当前连接状态
   */
  getConnectionStatus(): ConnectionStatus {
    return { ...this.connectionStatus }
  }

  /**
   * 监听连接状态变化
   */
  onStatusChange(callback: (status: ConnectionStatus) => void): () => void {
    this.listeners.push(callback)
    
    // 返回取消监听的函数
    return () => {
      const index = this.listeners.indexOf(callback)
      if (index > -1) {
        this.listeners.splice(index, 1)
      }
    }
  }

  /**
   * 更新连接状态
   */
  private updateStatus(
    status: ConnectionStatus['status'],
    responseTime?: number,
    error?: string
  ) {
    this.connectionStatus = {
      status,
      lastChecked: new Date(),
      responseTime: responseTime || null,
      error: error || null
    }

    // 通知所有监听器
    this.listeners.forEach(callback => {
      try {
        callback(this.getConnectionStatus())
      } catch (error) {
        // 状态监听器错误
      }
    })
  }

  /**
   * 启动定期连接检查
   */
  startPeriodicCheck(intervalMs: number = 60000): () => void {
    const interval = setInterval(() => {
      this.quickConnectionCheck()
    }, intervalMs)

    return () => {
      clearInterval(interval)
    }
  }
}

// 导出单例实例
export const databaseConnectionTester = DatabaseConnectionTester.getInstance()

// 导出便捷函数
export const testDatabaseConnection = () => databaseConnectionTester.testConnection()
export const quickConnectionCheck = () => databaseConnectionTester.quickConnectionCheck()
export const getDatabaseConnectionStatus = () => databaseConnectionTester.getConnectionStatus()
export const onDatabaseStatusChange = (callback: (status: ConnectionStatus) => void) => 
  databaseConnectionTester.onStatusChange(callback)