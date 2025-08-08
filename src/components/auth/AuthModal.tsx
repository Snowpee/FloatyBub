import React, { useState } from 'react'
import { X } from 'lucide-react'
import { LoginForm } from './LoginForm'
import { RegisterForm } from './RegisterForm'
import { ForgotPasswordForm } from './ForgotPasswordForm'

type AuthMode = 'login' | 'register' | 'forgot-password'

interface AuthModalProps {
  isOpen: boolean
  onClose: () => void
  initialMode?: AuthMode
}

export function AuthModal({ isOpen, onClose, initialMode = 'login' }: AuthModalProps) {
  const [mode, setMode] = useState<AuthMode>(initialMode)
  const [showSuccessMessage, setShowSuccessMessage] = useState(false)

  if (!isOpen) return null

  const handleSuccess = () => {
    if (mode === 'register' || mode === 'forgot-password') {
      setShowSuccessMessage(true)
      setTimeout(() => {
        setShowSuccessMessage(false)
        onClose()
      }, 3000)
    } else {
      // 登录成功后刷新页面以确保状态完全更新
      onClose()
      window.location.reload()
    }
  }

  const handleSwitchMode = (newMode: AuthMode) => {
    setMode(newMode)
    setShowSuccessMessage(false)
  }

  const renderContent = () => {
    if (showSuccessMessage) {
      return (
        <div className="text-center py-8">
          <div className="w-16 h-16 mx-auto mb-4 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center">
            <svg className="w-8 h-8 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            {mode === 'register' ? '注册成功！' : '邮件已发送！'}
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            {mode === 'register' 
              ? '请检查您的邮箱并点击确认链接来激活账户。'
              : '请检查您的邮箱并按照说明重置密码。'
            }
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-500">
            此窗口将在几秒后自动关闭...
          </p>
        </div>
      )
    }

    switch (mode) {
      case 'login':
        return (
          <LoginForm
            onSuccess={handleSuccess}
            onSwitchToRegister={() => handleSwitchMode('register')}
            onForgotPassword={() => handleSwitchMode('forgot-password')}
          />
        )
      case 'register':
        return (
          <RegisterForm
            onSuccess={handleSuccess}
            onSwitchToLogin={() => handleSwitchMode('login')}
          />
        )
      case 'forgot-password':
        return (
          <ForgotPasswordForm
            onSuccess={handleSuccess}
            onBackToLogin={() => handleSwitchMode('login')}
          />
        )
      default:
        return null
    }
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* 背景遮罩 */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={onClose}
      />
      
      {/* 模态框内容 */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative w-full max-w-md transform overflow-hidden rounded-2xl bg-white dark:bg-gray-800 shadow-xl transition-all">
          {/* 关闭按钮 */}
          <div className="absolute right-4 top-4 z-10">
            <button
              onClick={onClose}
              className="rounded-lg p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          
          {/* 内容区域 */}
          <div className="px-6 py-8">
            {renderContent()}
          </div>
        </div>
      </div>
    </div>
  )
}