import React from 'react'
import { User, LogOut, Settings, Cloud, CloudOff, Bug } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { useUserData } from '../../hooks/useUserData'
import { useAppStore } from '../../store'
import { debugSupabase, debugQuery, logNetwork } from '../../utils/supabaseDebug'

interface UserAvatarProps {
  onOpenSettings?: () => void
}

export function UserAvatar({ onOpenSettings }: UserAvatarProps) {
  
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

  const handleSignOut = async () => {
    await signOut()
    // 刷新页面以确保状态完全更新
    window.location.reload()
  }

  const handleSettings = () => {
    onOpenSettings?.()
  }

  const handleDebug = async () => {
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
      <div className="flex items-center gap-2 p-2">
        <div className="skeleton w-8 h-8 rounded-full shrink-0" />
        <div className="skeleton h-4 w-16" />
      </div>
    )
  }

  // 如果没有用户，显示加载状态而不是返回null
  if (!displayUser) {
    return (
      <div className="flex items-center gap-2 p-2">
        <div className="skeleton w-8 h-8 rounded-full shrink-0" />
        <div className="skeleton h-4 w-16" />
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
    <div className="dropdown dropdown-top dropdown-end">
      {/* 用户头像按钮 */}
      <div
        tabIndex={0}
        role="button"
        className="btn btn-sm btn-ghost items-left gap-2 p-2 pl-0 justify-items-left"
        title={`${displayName} (${displayUser.email})`}
      >
        {/* 头像 */}
        <div className="avatar indicator">
          <div className="w-7 rounded-full">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={displayName}
              />
            ) : (
              <div className={`w-7 h-7 rounded-full ${getAvatarColor(displayName)} flex items-center justify-center text-white text-sm font-medium`}>
                {displayName.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
          
          {/* 同步状态指示器 */}
          {syncing ? (
            <span className="status status-base status-primary indicator-item animate-pulse" title="同步中..."></span>
          ) : syncError ? (
            <span className="status status-base status-error indicator-item" title={`同步错误: ${syncError}`}></span>
          ) : (
            <span className="status status-base status-success indicator-item" title={`最后同步: ${formatLastSync(lastSyncTime)}`}></span>
          )}
        </div>
        
        {/* 用户名 */}
        <span className="text-sm font-medium max-w-24 truncate">
          {displayName}
        </span>
      </div>

      {/* 下拉菜单 */}
      <div
        tabIndex={0}
        className="dropdown-content menu bg-base-100 rounded-box z-[1] w-64 p-4 shadow-lg left-0"
      >
        {/* 用户信息 */}
        <div className="pb-4">
          <div className="flex items-center gap-3">
            <div className="avatar">
              <div className="w-10 rounded-full">
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt={displayName}
                  />
                ) : (
                  <div className={`w-10 h-10 rounded-full ${getAvatarColor(displayName)} flex items-center justify-center text-white font-medium`}>
                    {displayName.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">
                {displayName}
              </p>
              <p className="text-xs text-base-content/70 truncate">
                {displayUser.email}
              </p>
            </div>
          </div>
        </div>

        {/* 同步状态 */}
        <div className="py-4 bg-base-200 rounded-lg px-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {syncing ? (
                <Cloud className="w-4 h-4 text-info animate-pulse" />
              ) : syncError ? (
                <CloudOff className="w-4 h-4 text-error" />
              ) : (
                <Cloud className="w-4 h-4 text-success" />
              )}
              <span className="text-sm text-base-content/70">
                {syncing ? '同步中...' : syncError ? '同步失败' : '已同步'}
              </span>
            </div>
            <span className="text-sm text-base-content/40">
              {formatLastSync(lastSyncTime)}
            </span>
          </div>
          {syncError && (
            <p className="text-xs text-error mt-1 truncate" title={syncError}>
              {syncError}
            </p>
          )}
        </div>

        {/* 菜单项 */}
        <li
          className='py-2'
        >
          <button
            onClick={() => {
              handleSettings();
              (document.activeElement as HTMLElement)?.blur();
            }}
            //点击后关闭本菜单
            
            className="flex items-center gap-3"
          >
            <Settings className="w-4 h-4" />
            设置
          </button>
        </li>
        
        {syncError && (
          <li
            className='py-2'
          >
            <button
              onClick={handleDebug}
              className="flex items-center gap-3 text-warning"
            >
              <Bug className="w-4 h-4" />
              调试连接
            </button>
          </li>
        )}
        
        <li>
          <button
            onClick={handleSignOut}
            className="flex items-center gap-3 text-error"
          >
            <LogOut className="w-4 h-4" />
            退出登录
          </button>
        </li>
      </div>
    </div>
  )
}