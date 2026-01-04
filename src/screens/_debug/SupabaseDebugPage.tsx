import React, { useState } from 'react'
import { SupabaseDebugger } from '@/utils/supabaseDebug'
import { useAuth } from '@/hooks/useAuth'
import { CheckCircle, XCircle, AlertCircle, Play, RefreshCw, Database, Network, Shield, Settings } from 'lucide-react'

interface DiagnosticResult {
  configCheck: boolean
  authCheck: boolean
  networkCheck: boolean
  tableAccess: boolean
  errors: string[]
}

interface QueryResult {
  success: boolean
  data?: any
  error?: any
}

const SupabaseDebugPage: React.FC = () => {
  const { user } = useAuth()
  const [isRunning, setIsRunning] = useState(false)
  const [diagnosticResult, setDiagnosticResult] = useState<DiagnosticResult | null>(null)
  const [queryResult, setQueryResult] = useState<QueryResult | null>(null)
  const [logs, setLogs] = useState<string[]>([])

  const addLog = (message: string) => {
    setLogs(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`])
  }

  const runFullDiagnostic = async () => {
    setIsRunning(true)
    setLogs([])
    addLog('开始完整诊断...')
    
    try {
      // 运行连接诊断
      addLog('运行连接诊断...')
      const result = await SupabaseDebugger.testConnection()
      setDiagnosticResult(result)
      addLog(`连接诊断完成: ${result.errors.length === 0 ? '成功' : '发现问题'}`)
      
      // 如果用户已登录，测试具体查询
      if (user) {
        addLog('测试用户数据查询...')
        const queryRes = await SupabaseDebugger.testSpecificQuery(user.id)
        setQueryResult(queryRes)
        addLog(`查询测试完成: ${queryRes.success ? '成功' : '失败'}`)
      }
      
      // 记录网络详情
      SupabaseDebugger.logNetworkDetails()
      addLog('网络环境信息已记录到控制台')
      
    } catch (error) {
      addLog(`诊断过程出错: ${error}`)
    } finally {
      setIsRunning(false)
      addLog('诊断完成')
    }
  }

  const runConnectionTest = async () => {
    setIsRunning(true)
    addLog('运行连接测试...')
    
    try {
      const result = await SupabaseDebugger.testConnection()
      setDiagnosticResult(result)
      addLog('连接测试完成')
    } catch (error) {
      addLog(`连接测试出错: ${error}`)
    } finally {
      setIsRunning(false)
    }
  }

  const runQueryTest = async () => {
    if (!user) {
      addLog('需要登录才能测试查询')
      return
    }
    
    setIsRunning(true)
    addLog('运行查询测试...')
    
    try {
      const result = await SupabaseDebugger.testSpecificQuery(user.id)
      setQueryResult(result)
      addLog('查询测试完成')
    } catch (error) {
      addLog(`查询测试出错: ${error}`)
    } finally {
      setIsRunning(false)
    }
  }

  const clearLogs = () => {
    setLogs([])
    setDiagnosticResult(null)
    setQueryResult(null)
  }

  const StatusIcon: React.FC<{ status: boolean | null }> = ({ status }) => {
    if (status === null) return <AlertCircle className="w-5 h-5 text-gray-400" />
    return status ? 
      <CheckCircle className="w-5 h-5 text-green-500" /> : 
      <XCircle className="w-5 h-5 text-red-500" />
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-6xl mx-auto">
        {/* 页面标题 */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Supabase 连接诊断
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            诊断 Supabase 连接状态、配置和数据库访问权限
          </p>
        </div>

        {/* 配置信息 */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
            <Settings className="w-5 h-5 mr-2" />
            配置信息
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Supabase URL
              </label>
              <div className="bg-gray-100 dark:bg-gray-700 p-3 rounded border text-sm font-mono">
                {import.meta.env.VITE_SUPABASE_URL || '未配置'}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                匿名密钥状态
              </label>
              <div className="bg-gray-100 dark:bg-gray-700 p-3 rounded border text-sm">
                {import.meta.env.VITE_SUPABASE_ANON_KEY ? '已配置' : '未配置'}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                用户系统状态
              </label>
              <div className="bg-gray-100 dark:bg-gray-700 p-3 rounded border text-sm">
                {import.meta.env.VITE_ENABLE_USER_SYSTEM === 'true' ? '已启用' : '未启用'}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                当前用户
              </label>
              <div className="bg-gray-100 dark:bg-gray-700 p-3 rounded border text-sm">
                {user ? `${user.email} (${user.id})` : '未登录'}
              </div>
            </div>
          </div>
        </div>

        {/* 操作按钮 */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            诊断操作
          </h2>
          <div className="flex flex-wrap gap-4">
            <button
              onClick={runFullDiagnostic}
              disabled={isRunning}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isRunning ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Play className="w-4 h-4 mr-2" />}
              完整诊断
            </button>
            
            <button
              onClick={runConnectionTest}
              disabled={isRunning}
              className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Network className="w-4 h-4 mr-2" />
              连接测试
            </button>
            
            <button
              onClick={runQueryTest}
              disabled={isRunning || !user}
              className="flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Database className="w-4 h-4 mr-2" />
              查询测试
            </button>
            
            <button
              onClick={clearLogs}
              className="flex items-center px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              清除日志
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 诊断结果 */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
              <Shield className="w-5 h-5 mr-2" />
              诊断结果
            </h2>
            
            {diagnosticResult ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded">
                  <span className="text-sm font-medium">配置检查</span>
                  <StatusIcon status={diagnosticResult.configCheck} />
                </div>
                <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded">
                  <span className="text-sm font-medium">认证检查</span>
                  <StatusIcon status={diagnosticResult.authCheck} />
                </div>
                <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded">
                  <span className="text-sm font-medium">网络连接</span>
                  <StatusIcon status={diagnosticResult.networkCheck} />
                </div>
                <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded">
                  <span className="text-sm font-medium">表访问权限</span>
                  <StatusIcon status={diagnosticResult.tableAccess} />
                </div>
                
                {diagnosticResult.errors.length > 0 && (
                  <div className="mt-4">
                    <h3 className="text-sm font-medium text-red-600 dark:text-red-400 mb-2">错误信息:</h3>
                    <div className="space-y-1">
                      {diagnosticResult.errors.map((error, index) => (
                        <div key={index} className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 p-2 rounded">
                          {error}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-gray-500 dark:text-gray-400 text-center py-8">
                点击诊断按钮开始检查
              </div>
            )}
          </div>

          {/* 查询结果 */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
              <Database className="w-5 h-5 mr-2" />
              查询结果
            </h2>
            
            {queryResult ? (
              <div>
                <div className="flex items-center mb-3">
                  <StatusIcon status={queryResult.success} />
                  <span className="ml-2 text-sm font-medium">
                    {queryResult.success ? '查询成功' : '查询失败'}
                  </span>
                </div>
                
                {queryResult.success && queryResult.data && (
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                      找到 {queryResult.data.length} 条会话记录
                    </p>
                    <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded text-xs font-mono max-h-40 overflow-y-auto">
                      {JSON.stringify(queryResult.data, null, 2)}
                    </div>
                  </div>
                )}
                
                {!queryResult.success && queryResult.error && (
                  <div className="bg-red-50 dark:bg-red-900/20 p-3 rounded">
                    <p className="text-xs text-red-600 dark:text-red-400 font-mono">
                      {JSON.stringify(queryResult.error, null, 2)}
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-gray-500 dark:text-gray-400 text-center py-8">
                {user ? '点击查询测试按钮开始' : '需要登录才能测试查询'}
              </div>
            )}
          </div>
        </div>

        {/* 日志输出 */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mt-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            实时日志
          </h2>
          <div className="bg-black text-green-400 p-4 rounded font-mono text-sm h-64 overflow-y-auto">
            {logs.length > 0 ? (
              logs.map((log, index) => (
                <div key={index} className="mb-1">
                  {log}
                </div>
              ))
            ) : (
              <div className="text-gray-500">等待日志输出...</div>
            )}
          </div>
        </div>

        {/* 使用说明 */}
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-6 mt-6">
          <h2 className="text-lg font-semibold text-blue-900 dark:text-blue-100 mb-3">
            使用说明
          </h2>
          <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-2">
            <li>• <strong>完整诊断</strong>: 运行所有检查项目，包括配置、认证、网络和数据库访问</li>
            <li>• <strong>连接测试</strong>: 仅测试 Supabase 服务器连接状态</li>
            <li>• <strong>查询测试</strong>: 测试具体的数据库查询操作（需要登录）</li>
            <li>• 所有详细的诊断信息都会输出到浏览器控制台</li>
            <li>• 如果遇到问题，请检查环境变量配置和网络连接</li>
          </ul>
        </div>
      </div>
    </div>
  )
}

export default SupabaseDebugPage