import React, { useState, useEffect } from 'react'
import { safeFormatDate } from '@/utils/dateUtils'
import { Database, Wifi, WifiOff, AlertCircle, CheckCircle, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { 
  ConnectionStatus, 
  onDatabaseStatusChange, 
  getDatabaseConnectionStatus,
  testDatabaseConnection 
} from '@/utils/databaseConnectionTest'

interface DatabaseConnectionIndicatorProps {
  size?: 'sm' | 'md' | 'lg'
  showDetails?: boolean
  className?: string
}

export const DatabaseConnectionIndicator: React.FC<DatabaseConnectionIndicatorProps> = ({
  size = 'md',
  showDetails = false,
  className
}) => {
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>(getDatabaseConnectionStatus())
  const [isExpanded, setIsExpanded] = useState(false)
  const [isTesting, setIsTesting] = useState(false)

  useEffect(() => {
    // 监听连接状态变化
    const unsubscribe = onDatabaseStatusChange((status) => {
      setConnectionStatus(status)
    })

    return unsubscribe
  }, [])

  const handleTestConnection = async () => {
    setIsTesting(true)
    try {
      await testDatabaseConnection()
    } catch (error) {
      console.error('手动测试连接失败:', error)
    } finally {
      setIsTesting(false)
    }
  }

  const getStatusIcon = () => {
    if (isTesting || connectionStatus.status === 'testing') {
      return <Clock className={cn('animate-spin', getSizeClass())} />
    }
    
    switch (connectionStatus.status) {
      case 'connected':
        return <CheckCircle className={cn('text-success', getSizeClass())} />
      case 'disconnected':
        return <WifiOff className={cn('text-base-content/40', getSizeClass())} />
      case 'error':
        return <AlertCircle className={cn('text-error', getSizeClass())} />
      default:
        return <Database className={cn('text-base-content/60', getSizeClass())} />
    }
  }

  const getStatusText = () => {
    if (isTesting || connectionStatus.status === 'testing') {
      return '测试中...'
    }
    
    switch (connectionStatus.status) {
      case 'connected':
        return '已连接'
      case 'disconnected':
        return '未连接'
      case 'error':
        return '连接错误'
      default:
        return '未知状态'
    }
  }

  const getStatusColor = () => {
    if (isTesting || connectionStatus.status === 'testing') {
      return 'text-info'
    }
    
    switch (connectionStatus.status) {
      case 'connected':
        return 'text-success'
      case 'disconnected':
        return 'text-base-content/40'
      case 'error':
        return 'text-error'
      default:
        return 'text-base-content/60'
    }
  }

  const getSizeClass = () => {
    switch (size) {
      case 'sm':
        return 'h-3 w-3'
      case 'lg':
        return 'h-6 w-6'
      default:
        return 'h-4 w-4'
    }
  }

  const getTextSizeClass = () => {
    switch (size) {
      case 'sm':
        return 'text-xs'
      case 'lg':
        return 'text-base'
      default:
        return 'text-sm'
    }
  }

  const formatResponseTime = (time: number | null) => {
    if (time === null) return ''
    if (time < 1000) return `${time}ms`
    return `${(time / 1000).toFixed(1)}s`
  }

  const formatLastChecked = (date: Date | null) => {
    if (!date) return '从未检查'
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    
    if (diff < 60000) return '刚刚'
    if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`
    return safeFormatDate(date)
  }

  if (!showDetails) {
    // 简单模式：只显示图标和状态
    return (
      <div 
        className={cn(
          'flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity',
          className
        )}
        onClick={() => setIsExpanded(!isExpanded)}
        title={`数据库连接状态: ${getStatusText()}`}
      >
        {getStatusIcon()}
        <span className={cn(getStatusColor(), getTextSizeClass())}>
          {getStatusText()}
        </span>
        {connectionStatus.responseTime && (
          <span className={cn('text-base-content/60', getTextSizeClass())}>
            ({formatResponseTime(connectionStatus.responseTime)})
          </span>
        )}
      </div>
    )
  }

  // 详细模式：显示完整信息
  return (
    <div className={cn('space-y-3', className)}>
      {/* 状态标题 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Database className="h-5 w-5 text-base-content/60" />
          <h3 className="font-medium text-base-content">数据库连接状态</h3>
        </div>
        <button
          onClick={handleTestConnection}
          disabled={isTesting || connectionStatus.status === 'testing'}
          className="btn btn-sm btn-outline"
        >
          {isTesting ? (
            <>
              <Clock className="h-3 w-3 animate-spin" />
              测试中
            </>
          ) : (
            <>
              <Wifi className="h-3 w-3" />
              测试连接
            </>
          )}
        </button>
      </div>

      {/* 状态卡片 */}
      <div className="card bg-base-200 shadow-sm">
        <div className="card-body p-4 space-y-3">
          {/* 主要状态 */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {getStatusIcon()}
              <div>
                <div className={cn('font-medium', getStatusColor())}>
                  {getStatusText()}
                </div>
                <div className="text-xs text-base-content/60">
                  上次检查: {formatLastChecked(connectionStatus.lastChecked)}
                </div>
              </div>
            </div>
            
            {connectionStatus.responseTime && (
              <div className="text-right">
                <div className="text-sm font-medium text-base-content">
                  {formatResponseTime(connectionStatus.responseTime)}
                </div>
                <div className="text-xs text-base-content/60">
                  响应时间
                </div>
              </div>
            )}
          </div>

          {/* 错误信息 */}
          {connectionStatus.error && (
            <div className="alert alert-error alert-sm">
              <AlertCircle className="h-4 w-4" />
              <span className="text-sm">{connectionStatus.error}</span>
            </div>
          )}

          {/* 连接详情 */}
          {connectionStatus.status === 'connected' && (
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="flex items-center gap-1">
                <CheckCircle className="h-3 w-3 text-success" />
                <span>数据库可访问</span>
              </div>
              <div className="flex items-center gap-1">
                <CheckCircle className="h-3 w-3 text-success" />
                <span>表权限正常</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default DatabaseConnectionIndicator