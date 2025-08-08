import React, { useState, useRef, useEffect } from 'react'
import { User, LogOut, Settings, Cloud, CloudOff, Bug } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { useUserData } from '../../hooks/useUserData'
import { useAppStore } from '../../store'
import { debugSupabase, debugQuery, logNetwork } from '../../utils/supabaseDebug'

interface UserAvatarProps {
  onOpenSettings?: () => void
}

export function UserAvatar({ onOpenSettings }: UserAvatarProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  
  const { user, loading: authLoading, signOut } = useAuth()
  const { syncing, lastSyncTime, syncError } = useUserData()
  const { currentUser } = useAppStore()
  
  // 确保在有认证用户但没有currentUser时显示基本信息
  const displayUser = currentUser || user
  


  // 生成头像背景色
  const getAvatarColor = (name: string) => {
    const colors = [
      'bg-red-500', 'bg-blue-500', 'bg-green-500', 'bg-yellow-500',
      'bg-purple-500', 'bg-pink-500', 'bg-indigo-500', 'bg-teal-500'
    ]
    const index = name.charCodeAt(0) % colors.length
    return colors[index]
  }

  // 点击外部关闭菜单
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        menuRef.current && 
        !menuRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsMenuOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSignOut = async () => {
    setIsMenuOpen(false)
    await signOut()
    // 刷新页面以确保状态完全更新
    window.location.reload()
  }

  const handleSettings = () => {
    setIsMenuOpen(false)
    onOpenSettings?.()
  }

  const handleDebug = async () => {
    setIsMenuOpen(false)
    console.log('🐛 手动触发 Supabase 调试...')
    
    // 记录网络环境
    logNetwork()
    
    // 运行连接诊断
    const debugResult = await debugSupabase()
    
    // 如果用户已登录，测试具体查询
    if (displayUser) {
      const queryResult = await debugQuery(displayUser.id)
      console.log('🔍 查询测试结果:', queryResult)
    }
    
    // 显示诊断摘要
    const summary = {
      配置检查: debugResult.configCheck ? '✅' : '❌',
      认证检查: debugResult.authCheck ? '✅' : '❌',
      网络检查: debugResult.networkCheck ? '✅' : '❌',
      表访问: debugResult.tableAccess ? '✅' : '❌',
      错误数量: debugResult.errors.length
    }
    
    console.log('📋 诊断摘要:', summary)
    
    if (debugResult.errors.length > 0) {
      console.log('❌ 发现的问题:', debugResult.errors)
    }
  }



  // 如果正在加载认证状态，显示加载指示器
  if (authLoading) {
    return (
      <div className="flex items-center space-x-2 p-2 rounded-lg">
        <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 animate-pulse" />
        <div className="w-16 h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
      </div>
    )
  }

  // 如果没有用户，显示加载状态而不是返回null
  if (!displayUser) {
    return (
      <div className="flex items-center space-x-2 p-2 rounded-lg">
        <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 animate-pulse" />
        <div className="w-16 h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
      </div>
    )
  }

  // 使用 displayUser 来获取用户信息
  const displayName = currentUser?.name || displayUser.user_metadata?.display_name || displayUser.email?.split('@')[0] || 'User'
  const avatarUrl = currentUser?.avatar || displayUser.user_metadata?.avatar_url

  const formatLastSync = (date: Date | null) => {
    if (!date) return '从未同步'
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const minutes = Math.floor(diff / 60000)
    
    if (minutes < 1) return '刚刚同步'
    if (minutes < 60) return `${minutes}分钟前`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours}小时前`
    const days = Math.floor(hours / 24)
    return `${days}天前`
  }

  return (
    <div className="relative">
      {/* 用户头像按钮 */}
      <button
        ref={buttonRef}
        onClick={() => setIsMenuOpen(!isMenuOpen)}
        className="flex items-center space-x-2 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        title={`${displayName} (${displayUser.email})`}
      >
        {/* 头像 */}
        <div className="relative">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={displayName}
              className="w-8 h-8 rounded-full object-cover"
            />
          ) : (
            <div className={`w-8 h-8 rounded-full ${getAvatarColor(displayName)} flex items-center justify-center text-white text-sm font-medium`}>
              {displayName.charAt(0).toUpperCase()}
            </div>
          )}
          
          {/* 同步状态指示器 */}
          <div className="absolute -bottom-1 -right-1">
            {syncing ? (
              <div className="w-3 h-3 bg-blue-500 rounded-full animate-pulse" title="同步中..." />
            ) : syncError ? (
              <div className="w-3 h-3 bg-red-500 rounded-full" title={`同步错误: ${syncError}`} />
            ) : (
              <div className="w-3 h-3 bg-green-500 rounded-full" title={`最后同步: ${formatLastSync(lastSyncTime)}`} />
            )}
          </div>
        </div>
        
        {/* 用户名 */}
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300 max-w-24 truncate">
          {displayName}
        </span>
      </button>

      {/* 下拉菜单 */}
      {isMenuOpen && (
        <div
          ref={menuRef}
          className="absolute left-2 bottom-2 mt-2 w-64 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-2 z-50"
        >
          {/* 用户信息 */}
          <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center space-x-3">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={displayName}
                  className="w-10 h-10 rounded-full object-cover"
                />
              ) : (
                <div className={`w-10 h-10 rounded-full ${getAvatarColor(displayName)} flex items-center justify-center text-white font-medium`}>
                  {displayName.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                  {displayName}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                  {displayUser.email}
                </p>
              </div>
            </div>
          </div>

          {/* 同步状态 */}
          <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                {syncing ? (
                  <Cloud className="w-4 h-4 text-blue-500 animate-pulse" />
                ) : syncError ? (
                  <CloudOff className="w-4 h-4 text-red-500" />
                ) : (
                  <Cloud className="w-4 h-4 text-green-500" />
                )}
                <span className="text-xs text-gray-600 dark:text-gray-400">
                  {syncing ? '同步中...' : syncError ? '同步失败' : '已同步'}
                </span>
              </div>
              <span className="text-xs text-gray-500 dark:text-gray-500">
                {formatLastSync(lastSyncTime)}
              </span>
            </div>
            {syncError && (
              <p className="text-xs text-red-500 dark:text-red-400 mt-1 truncate" title={syncError}>
                {syncError}
              </p>
            )}
          </div>

          {/* 菜单项 */}
          <div className="py-1">
            <button
              onClick={handleSettings}
              className="w-full flex items-center px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <Settings className="w-4 h-4 mr-3" />
              设置
            </button>
            
            {syncError && (
              <button
                onClick={handleDebug}
                className="w-full flex items-center px-4 py-2 text-sm text-orange-600 dark:text-orange-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                <Bug className="w-4 h-4 mr-3" />
                调试连接
              </button>
            )}
            
            <button
              onClick={handleSignOut}
              className="w-full flex items-center px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <LogOut className="w-4 h-4 mr-3" />
              退出登录
            </button>
          </div>
        </div>
      )}
    </div>
  )
}