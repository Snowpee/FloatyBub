import React, { useState, useEffect } from 'react'
import { safeFormatDate } from '@/utils/dateUtils'
import { Cloud, CloudOff, RefreshCw, CheckCircle, AlertCircle, Wifi, WifiOff, Database } from 'lucide-react'
import { dataSyncService, type SyncStatus } from '@/services/DataSyncService'
import { useUserData } from '@/hooks/useUserData'
import { cn } from '@/lib/utils'

interface SyncStatusIndicatorProps {
  className?: string
  showText?: boolean
  size?: 'sm' | 'md' | 'lg'
  type?: 'chat' | 'data' | 'combined'
}

export function SyncStatusIndicator({ 
  className, 
  showText = true, 
  size = 'md',
  type = 'combined'
}: SyncStatusIndicatorProps) {
  const [status, setStatus] = useState<SyncStatus>(dataSyncService.getStatus())
  const [lastSyncTime, setLastSyncTime] = useState<number | null>(dataSyncService.getLastSyncTime())
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  
  // 获取聊天会话同步状态
  const { syncing: chatSyncing, lastSyncTime: chatLastSyncTime, syncError: chatSyncError, dataSyncStatus, dataSyncLastTime, syncFromCloud, syncProgress } = useUserData()

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

  const getStatusConfig = () => {
    if (!isOnline) {
      return {
        icon: WifiOff,
        color: 'text-gray-500',
        bgColor: 'bg-gray-100',
        text: '离线模式',
        description: '网络未连接，数据将在连接恢复后同步'
      }
    }

    // 根据类型返回不同的状态
    if (type === 'chat') {
      if (chatSyncing) {
        const progressText = syncProgress?.message || '正在同步聊天记录到云端'
        const progressPercent = syncProgress?.percent || 0
        return {
          icon: RefreshCw,
          color: 'text-blue-500',
          bgColor: 'bg-blue-50',
          text: '聊天同步中',
          description: progressPercent > 0 ? `${progressText} (${progressPercent}%)` : progressText,
          animate: true
        }
      }
      if (chatSyncError) {
        return {
          icon: AlertCircle,
          color: 'text-red-500',
          bgColor: 'bg-red-50',
          text: '聊天同步失败',
          description: chatSyncError
        }
      }
      return {
        icon: Cloud,
        color: 'text-green-500',
        bgColor: 'bg-green-50',
        text: '聊天已同步',
        description: chatLastSyncTime ? `最后同步: ${chatLastSyncTime.toLocaleTimeString()}` : '聊天记录已同步'
      }
    }

    if (type === 'data') {
      switch (dataSyncStatus) {
        case 'idle':
          return {
            icon: Database,
            color: 'text-blue-500',
            bgColor: 'bg-blue-50',
            text: '数据待同步',
            description: '等待数据同步'
          }
        case 'syncing':
          return {
            icon: RefreshCw,
            color: 'text-blue-500',
            bgColor: 'bg-blue-50',
            text: '数据同步中',
            description: '正在同步配置数据到云端',
            animate: true
          }
        case 'synced':
          return {
            icon: CheckCircle,
            color: 'text-green-500',
            bgColor: 'bg-green-50',
            text: '数据已同步',
            description: dataSyncLastTime ? `最后同步: ${formatTime(dataSyncLastTime)}` : '配置数据已同步'
          }
        case 'error':
          return {
            icon: AlertCircle,
            color: 'text-red-500',
            bgColor: 'bg-red-50',
            text: '数据同步失败',
            description: '配置数据同步出现错误'
          }
        default:
          return {
            icon: Database,
            color: 'text-gray-500',
            bgColor: 'bg-gray-100',
            text: '数据状态未知',
            description: '配置数据同步状态未知'
          }
      }
    }

    // combined 类型：综合显示
    const isSyncing = chatSyncing || dataSyncStatus === 'syncing'
    const hasError = chatSyncError || dataSyncStatus === 'error'
    
    if (isSyncing) {
      const progressText = syncProgress?.message || '正在同步数据到云端'
      const progressPercent = syncProgress?.percent || 0
      return {
        icon: RefreshCw,
        color: 'text-blue-500',
        bgColor: 'bg-blue-50',
        text: '同步中',
        description: progressPercent > 0 ? `${progressText} (${progressPercent}%)` : progressText,
        animate: true
      }
    }
    
    if (hasError) {
      return {
        icon: AlertCircle,
        color: 'text-red-500',
        bgColor: 'bg-red-50',
        text: '同步失败',
        description: chatSyncError || '数据同步出现错误'
      }
    }
    
    return {
      icon: CheckCircle,
      color: 'text-green-500',
      bgColor: 'bg-green-50',
      text: '已同步',
      description: '所有数据已同步'
    }
  }

  const formatTime = (timestamp: number): string => {
    const now = Date.now()
    const diff = now - timestamp
    
    if (diff < 60000) { // 小于1分钟
      return '刚刚'
    } else if (diff < 3600000) { // 小于1小时
      return `${Math.floor(diff / 60000)}分钟前`
    } else if (diff < 86400000) { // 小于1天
      return `${Math.floor(diff / 3600000)}小时前`
    } else {
      return safeFormatDate(timestamp)
    }
  }

  const handleManualSync = async () => {
    if (!isOnline) return
    if (type === 'chat' && chatSyncing) return
    if (type === 'data' && dataSyncStatus === 'syncing') return
    if (type === 'combined' && (chatSyncing || dataSyncStatus === 'syncing')) return
    
    try {
      if (type === 'chat' || type === 'combined') {
        await syncFromCloud()
      }
      
      if (type === 'data' || type === 'combined') {
        await dataSyncService.manualSync()
      }
    } catch (error) {
      console.error('手动同步失败:', error)
    }
  }

  const config = getStatusConfig()
  const Icon = config.icon
  
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6'
  }

  const textSizeClasses = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base'
  }

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <button
        onClick={handleManualSync}
        disabled={!isOnline || status === 'syncing'}
        className={cn(
          'flex items-center justify-center rounded-full p-1.5 transition-colors',
          config.bgColor,
          'hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-50'
        )}
        title={config.description}
      >
        <Icon 
          className={cn(
            sizeClasses[size],
            config.color,
            config.animate && 'animate-spin'
          )} 
        />
      </button>
      
      {showText && (
        <div className="flex flex-col">
          <span className={cn(
            'font-medium',
            config.color,
            textSizeClasses[size]
          )}>
            {config.text}
          </span>
          {size !== 'sm' && (
            <span className="text-xs text-gray-500">
              {config.description}
            </span>
          )}
        </div>
      )}
    </div>
  )
}

// 简化版本的同步状态指示器，只显示图标
export function SyncStatusIcon({ className, size = 'md' }: { className?: string, size?: 'sm' | 'md' | 'lg' }) {
  return (
    <SyncStatusIndicator 
      className={className}
      showText={false}
      size={size}
    />
  )
}