import React, { useEffect, useState } from 'react'
import { useUserData } from '../hooks/useUserData'
import { useAuth } from '../hooks/useAuth'
import { useAppStore } from '../store'

const SyncTestPage: React.FC = () => {
  const { user } = useAuth()
  const { chatSessions } = useAppStore()
  const { 
    syncing, 
    syncError, 
    syncProgress, 
    lastSyncTime,
    dataSyncStatus,
    dataSyncLastTime,
    syncToCloud,
    syncFromCloud 
  } = useUserData()
  
  const [logs, setLogs] = useState<string[]>([])
  
  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString()
    setLogs(prev => [...prev.slice(-20), `[${timestamp}] ${message}`])
  }
  
  useEffect(() => {
    addLog(`页面加载 - 用户: ${user?.email || '未登录'}, 会话数: ${chatSessions.length}`)
  }, [user, chatSessions.length])
  
  useEffect(() => {
    if (syncing) {
      addLog('开始同步到云端...')
    } else {
      addLog('同步完成或停止')
    }
  }, [syncing])
  
  useEffect(() => {
    if (syncError) {
      addLog(`同步错误: ${syncError}`)
    }
  }, [syncError])
  
  useEffect(() => {
    if (syncProgress) {
      addLog(`同步进度: ${syncProgress.percent}% - ${syncProgress.message}`)
    }
  }, [syncProgress])
  
  const handleManualSync = async () => {
    addLog('手动触发同步...')
    try {
      await syncToCloud()
      addLog('手动同步完成')
    } catch (error) {
      addLog(`手动同步失败: ${error}`)
    }
  }
  
  const handleSyncFromCloud = async () => {
    addLog('手动从云端同步...')
    try {
      await syncFromCloud()
      addLog('从云端同步完成')
    } catch (error) {
      addLog(`从云端同步失败: ${error}`)
    }
  }
  
  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">数据同步测试页面</h1>
      
      {/* 用户状态 */}
      <div className="bg-gray-100 p-4 rounded-lg mb-6">
        <h2 className="text-lg font-semibold mb-2">用户状态</h2>
        <p>用户: {user?.email || '未登录'}</p>
        <p>用户ID: {user?.id || 'N/A'}</p>
        <p>会话数量: {chatSessions.length}</p>
      </div>
      
      {/* 同步状态 */}
      <div className="bg-blue-100 p-4 rounded-lg mb-6">
        <h2 className="text-lg font-semibold mb-2">同步状态</h2>
        <p>正在同步: {syncing ? '是' : '否'}</p>
        <p>同步错误: {syncError || '无'}</p>
        <p>最后同步时间: {lastSyncTime ? new Date(lastSyncTime).toLocaleString() : '从未同步'}</p>
        <p>数据同步状态: {dataSyncStatus}</p>
        <p>数据最后同步时间: {dataSyncLastTime ? new Date(dataSyncLastTime).toLocaleString() : '从未同步'}</p>
        {syncProgress && (
          <p>同步进度: {syncProgress.percent}% - {syncProgress.message}</p>
        )}
      </div>
      
      {/* 操作按钮 */}
      <div className="mb-6">
        <button 
          onClick={handleManualSync}
          disabled={syncing || !user}
          className="bg-blue-500 text-white px-4 py-2 rounded mr-4 disabled:bg-gray-400"
        >
          手动同步到云端
        </button>
        <button 
          onClick={handleSyncFromCloud}
          disabled={syncing || !user}
          className="bg-green-500 text-white px-4 py-2 rounded disabled:bg-gray-400"
        >
          从云端同步
        </button>
      </div>
      
      {/* 日志显示 */}
      <div className="bg-black text-green-400 p-4 rounded-lg">
        <h2 className="text-lg font-semibold mb-2">实时日志</h2>
        <div className="h-64 overflow-y-auto font-mono text-sm">
          {logs.map((log, index) => (
            <div key={index} className="mb-1">{log}</div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default SyncTestPage