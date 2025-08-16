import React, { useState, useRef, useEffect } from 'react'
import { User, LogOut, Settings, Cloud, CloudOff, Bug, Edit } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { useUserData } from '../../hooks/useUserData'
import { useAppStore } from '../../store'
import { generateAvatar } from '../../utils/avatarUtils'
import { debugSupabase, debugQuery, logNetwork } from '../../utils/supabaseDebug'
import Avatar from '../Avatar'
import clsx from 'clsx'

interface UserAvatarProps {
  onOpenSettings?: () => void
  onOpenProfileModal?: () => void
  className?: string
}

export function UserAvatar({ onOpenSettings, onOpenProfileModal, className }: UserAvatarProps) {
  
  const { user, loading: authLoading, signOut } = useAuth()
  const { syncing, lastSyncTime, syncError } = useUserData()
  const { currentUser } = useAppStore()
  
  // 处理打开用户资料modal
  const handleOpenProfileModal = () => {
    if (onOpenProfileModal) {
      onOpenProfileModal()
    }
  }


  
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
    logNetwork()
    
    // 测试基本连接
    const debugResult = await debugSupabase()
    
    if (displayUser?.id) {
      const queryResult = await debugQuery(displayUser.id)
      console.log('Query result:', queryResult)
    }
  }



  // 如果正在加载认证状态，显示加载指示器
  if (authLoading) {
    return (
      <div className="flex items-center gap-2">
        <div className="skeleton w-6 h-6 rounded-full shrink-0" />
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
    <>
      <div className={clsx("dropdown dropdown-top dropdown-end", className)}>
        {/* 用户头像按钮 */}
        <div
          tabIndex={0}
          role="button"
          className="btn btn-ghost items-left pl-0 justify-start rounded-full w-full"
          title={`${displayName} (${displayUser.email})`}
        >
          {/* 头像 */}
          <div className="avatar indicator h-full">
            <Avatar
              name={displayName}
              avatar={avatarUrl}
              size="sm"
              className="content-center justify-items-center"
            />
            
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
            <div className="flex items-center">
              <Avatar
                name={displayName}
                avatar={avatarUrl}
                size="md"
                className="w-10"
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {displayName}
                </p>
                <p className="text-xs text-base-content/70 truncate">
                  {displayUser.email}
                </p>
              </div>
              <button
                onClick={() => {
                  handleOpenProfileModal();
                  (document.activeElement as HTMLElement)?.blur();
                }}
                className="btn btn-ghost btn-sm btn-circle"
                title="修改用户资料"
              >
                <Edit className="w-4 h-4" />
              </button>
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
              <p className="text-xs text-error mt-1" title={syncError}>
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

    </>
  )
}