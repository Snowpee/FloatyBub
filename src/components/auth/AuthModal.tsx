import React, { useState, useEffect, useRef } from 'react'
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
  const dialogRef = useRef<HTMLDialogElement>(null)

  // 使用 DaisyUI 的 dialog 元素控制模态框显示
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return

    if (isOpen) {
      dialog.showModal()
    } else {
      dialog.close()
    }
  }, [isOpen])

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

  return (
    <dialog ref={dialogRef} className="modal">
      <div className="modal-box w-full max-w-md">
        {/* 关闭按钮 */}
        <form method="dialog">
          <button 
            className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2"
            onClick={onClose}
          >
            ✕
          </button>
        </form>
        
        {/* 内容区域 */}
        {renderContent()}
      </div>
      
      {/* 点击外部关闭 */}
      <form method="dialog" className="modal-backdrop">
        <button onClick={onClose}>close</button>
      </form>
    </dialog>
  )
}