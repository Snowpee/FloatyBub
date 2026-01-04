import React, { useState } from 'react'
import { Eye, EyeOff, Mail, Lock, LogIn } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'

interface LoginFormProps {
  onSuccess?: () => void
  onSwitchToRegister?: () => void
  onForgotPassword?: () => void
}

export function LoginForm({ onSuccess, onSwitchToRegister, onForgotPassword }: LoginFormProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  
  const { signIn, error, clearError } = useAuth()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isSubmitting) return

    setIsSubmitting(true)
    clearError()

    try {
      const { error } = await signIn(email, password)
      if (!error) {
        onSuccess?.()
      }
    } catch (err) {
      console.error('Login error:', err)
    } finally {
      setIsSubmitting(false)
    }
  }

  const isFormValid = email.trim() && password.trim()

  return (
    <div className="w-full">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold mb-2">
          欢迎回来
        </h2>
        <p className="text-base-content/70">
          登录您的账户以继续使用
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* 邮箱输入 */}
        <div className="form-control">
          <label className="input input-bordered flex items-center gap-2 w-full">
            <Mail className="h-4 w-4 opacity-70" />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="grow"
              placeholder="请输入您的邮箱"
              required
              autoComplete="email"
            />
          </label>
        </div>

        {/* 密码输入 */}
        <div className="form-control">
          <label className="input input-bordered flex items-center gap-2 w-full">
            <Lock className="h-4 w-4 opacity-70" />
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="grow"
              placeholder="请输入您的密码"
              required
              autoComplete="current-password"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="btn btn-ghost btn-sm btn-circle"
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          </label>
        </div>

        {/* 错误信息 */}
        {error && (
          <div className="alert alert-error">
            <span className="text-sm">{error}</span>
          </div>
        )}

        {/* 忘记密码链接 */}
        <div className="flex justify-end">
          <button
            type="button"
            onClick={onForgotPassword}
            className="link link-primary text-sm"
          >
            忘记密码？
          </button>
        </div>

        {/* 登录按钮 */}
        <button
          type="submit"
          disabled={!isFormValid || isSubmitting}
          className="btn btn-primary w-full"
        >
          {isSubmitting ? (
            <>
              <span className="loading loading-spinner loading-sm"></span>
              登录中...
            </>
          ) : (
            <>
              <LogIn className="h-4 w-4" />
              登录
            </>
          )}
        </button>

        {/* 注册链接 */}
        <div className="text-center">
          <span className="text-sm text-base-content/70">
            还没有账户？{' '}
            <button
              type="button"
              onClick={onSwitchToRegister}
              className="link link-primary font-medium"
            >
              立即注册
            </button>
          </span>
        </div>
      </form>
    </div>
  )
}