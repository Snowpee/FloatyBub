import React, { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { LoginForm } from './LoginForm'
import { RegisterForm } from './RegisterForm'
import { ForgotPasswordForm } from './ForgotPasswordForm'
import BottomSheetModal from '../BottomSheetModal'

type AuthMode = 'login' | 'register' | 'forgot-password'

interface AuthModalProps {
  isOpen: boolean
  onClose: () => void
  initialMode?: AuthMode
}

export function AuthModal({ isOpen, onClose, initialMode = 'login' }: AuthModalProps) {
  const [mode, setMode] = useState<AuthMode>(initialMode)
  const [showSuccessMessage, setShowSuccessMessage] = useState(false)
  const [isDesktop, setIsDesktop] = useState(false)

  useEffect(() => {
    // 初始化检测
    setIsDesktop(window.innerWidth >= 1024)

    const checkDesktop = () => {
      setIsDesktop(window.innerWidth >= 1024)
    }
    
    window.addEventListener('resize', checkDesktop)
    return () => window.removeEventListener('resize', checkDesktop)
  }, [])

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

  const getTitle = () => {
    if (showSuccessMessage) return '操作成功'
    switch (mode) {
      case 'login': return '登录'
      case 'register': return '注册'
      case 'forgot-password': return '找回密码'
      default: return '认证'
    }
  }

  const renderContent = () => {
    if (showSuccessMessage) {
      return (
        <div className="text-center py-8">
          <div className="w-16 h-16 mx-auto mb-4 bg-success/20 rounded-full flex items-center justify-center">
            <svg className="w-8 h-8 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h3 className="text-lg font-bold mb-2">
            {mode === 'register' ? '注册成功！' : '邮件已发送！'}
          </h3>
          <p className="text-base-content/70 mb-4">
            {mode === 'register' 
              ? '请检查您的邮箱并点击确认链接来激活账户。'
              : '请检查您的邮箱并按照说明重置密码。'
            }
          </p>
          <p className="text-sm text-base-content/50">
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

  if (!isOpen) return null

  // 桌面端：使用 DaisyUI Modal
  if (isDesktop) {
    return createPortal(
      <dialog className="modal modal-open modal-middle" open>
        <div className="modal-box w-full max-w-md p-0 flex flex-col bg-base-100 shadow-2xl">
          {/* Header */}
          <div className="px-6 py-4 flex items-center justify-between">
            <div className="text-lg font-bold text-base-content"></div>
            <form method="dialog">
              <button className="btn btn-sm btn-circle btn-ghost" onClick={onClose}>
                <X className="h-5 w-5" />
              </button>
            </form>
          </div>
          
          {/* Content */}
          <div className="p-6">
            {renderContent()}
          </div>
        </div>
        
        {/* Backdrop */}
        <form method="dialog" className="modal-backdrop">
          <button onClick={onClose}>close</button>
        </form>
      </dialog>,
      document.body
    )
  }

  // 移动端：使用 BottomSheetModal
  return createPortal(
    <BottomSheetModal
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          onClose()
        }
      }}
      onClose={onClose}
      dismissible={true}
      dragEnabled={true}
      headerTitle={<div className="text-center text-lg font-semibold text-base-content"></div>}
      leftActions={[{ icon: <X className="h-5 w-5" />, className: 'btn btn-circle', role: 'close' }]}
    >
      <div className="flex-1 overflow-hidden">
        <div className="h-full overflow-y-auto px-4 pb-8">
          {renderContent()}
        </div>
      </div>
    </BottomSheetModal>,
    document.body
  )
}