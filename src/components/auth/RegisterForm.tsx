import React, { useState } from 'react'
import { Eye, EyeOff, Mail, Lock, User, UserPlus } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'

interface RegisterFormProps {
  onSuccess?: () => void
  onSwitchToLogin?: () => void
}

export function RegisterForm({ onSuccess, onSwitchToLogin }: RegisterFormProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [validationErrors, setValidationErrors] = useState<string[]>([])
  
  const { signUp, error, clearError } = useAuth()

  // 密码验证规则
  const validatePassword = (password: string): string[] => {
    const errors: string[] = []
    if (password.length < 8) {
      errors.push('密码长度至少8位')
    }
    if (!/(?=.*[a-z])/.test(password)) {
      errors.push('密码需包含小写字母')
    }
    if (!/(?=.*[A-Z])/.test(password)) {
      errors.push('密码需包含大写字母')
    }
    if (!/(?=.*\d)/.test(password)) {
      errors.push('密码需包含数字')
    }
    return errors
  }

  // 表单验证
  const validateForm = (): boolean => {
    const errors: string[] = []
    
    if (!email.trim()) {
      errors.push('请输入邮箱地址')
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.push('请输入有效的邮箱地址')
    }
    
    if (!displayName.trim()) {
      errors.push('请输入显示名称')
    } else if (displayName.trim().length < 2) {
      errors.push('显示名称至少2个字符')
    }
    
    const passwordErrors = validatePassword(password)
    errors.push(...passwordErrors)
    
    if (password !== confirmPassword) {
      errors.push('两次输入的密码不一致')
    }
    
    setValidationErrors(errors)
    return errors.length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isSubmitting) return

    if (!validateForm()) return

    setIsSubmitting(true)
    clearError()

    try {
      const { error } = await signUp(email, password, displayName.trim())
      if (!error) {
        onSuccess?.()
      }
    } catch (err) {
      console.error('Register error:', err)
    } finally {
      setIsSubmitting(false)
    }
  }

  const isFormValid = email.trim() && password.trim() && confirmPassword.trim() && displayName.trim()

  return (
    <div className="w-full">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold mb-2">
          创建账户
        </h2>
        <p className="text-base-content/70">
          注册新账户开始使用
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* 显示名称输入 */}
        <div className="form-control">
          <label className="input input-bordered flex items-center gap-2 w-full">
            <User className="h-4 w-4 opacity-70" />
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="grow"
              placeholder="请输入您的昵称"
              required
              autoComplete="name"
            />
          </label>
        </div>

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
              placeholder="请输入密码"
              required
              autoComplete="new-password"
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

        {/* 确认密码输入 */}
        <div className="form-control">
          <label className="input input-bordered flex items-center gap-2 w-full">
            <Lock className="h-4 w-4 opacity-70" />
            <input
              type={showConfirmPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="grow"
              placeholder="请再次输入密码"
              required
              autoComplete="new-password"
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="btn btn-ghost btn-sm btn-circle"
            >
              {showConfirmPassword ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          </label>
        </div>

        {/* 密码要求提示 */}
        <div className="alert">
          <div className="text-xs text-base-content/70">
            <p className="font-medium mb-1">密码要求：至少8个字符，包含大小写字母，包含数字</p>
          </div>
        </div>

        {/* 验证错误信息 */}
        {validationErrors.length > 0 && (
          <div className="alert alert-error">
            <ul className="text-sm space-y-1">
              {validationErrors.map((error, index) => (
                <li key={index}>• {error}</li>
              ))}
            </ul>
          </div>
        )}

        {/* API 错误信息 */}
        {error && (
          <div className="alert alert-error">
            <span className="text-sm">{error}</span>
          </div>
        )}

        {/* 注册按钮 */}
        <button
          type="submit"
          disabled={!isFormValid || isSubmitting}
          className="btn btn-primary w-full"
        >
          {isSubmitting ? (
            <>
              <span className="loading loading-spinner loading-sm"></span>
              注册中...
            </>
          ) : (
            <>
              <UserPlus className="h-4 w-4" />
              注册
            </>
          )}
        </button>

        {/* 登录链接 */}
        <div className="text-center">
          <span className="text-sm text-base-content/70">
            已有账户？{' '}
            <button
              type="button"
              onClick={onSwitchToLogin}
              className="link link-primary font-medium"
            >
              立即登录
            </button>
          </span>
        </div>
      </form>
    </div>
  )
}