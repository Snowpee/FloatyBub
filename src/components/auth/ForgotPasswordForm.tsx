import React, { useState } from 'react'
import { Mail, ArrowLeft, Send } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'

interface ForgotPasswordFormProps {
  onSuccess?: () => void
  onBackToLogin?: () => void
}

export function ForgotPasswordForm({ onSuccess, onBackToLogin }: ForgotPasswordFormProps) {
  const [email, setEmail] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  
  const { resetPassword, error, clearError } = useAuth()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isSubmitting) return

    setIsSubmitting(true)
    clearError()

    try {
      const { error } = await resetPassword(email)
      if (!error) {
        onSuccess?.()
      }
    } catch (err) {
      console.error('Reset password error:', err)
    } finally {
      setIsSubmitting(false)
    }
  }

  const isFormValid = email.trim() && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)

  return (
    <div className="w-full">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold mb-2">
          重置密码
        </h2>
        <p className="text-base-content/70">
          输入您的邮箱地址，我们将发送重置链接
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

        {/* 错误信息 */}
        {error && (
          <div className="alert alert-error">
            <span className="text-sm">{error}</span>
          </div>
        )}

        {/* 提示信息 */}
        <div className="alert">
          <span className="text-sm text-base-content/70">
            重置链接将发送到您的邮箱，请检查收件箱和垃圾邮件文件夹。
          </span>
        </div>

        {/* 发送按钮 */}
        <button
          type="submit"
          disabled={!isFormValid || isSubmitting}
          className="btn btn-primary w-full"
        >
          {isSubmitting ? (
            <>
              <span className="loading loading-spinner loading-sm"></span>
              发送中...
            </>
          ) : (
            <>
              <Send className="h-4 w-4" />
              发送重置链接
            </>
          )}
        </button>

        {/* 返回登录链接 */}
        <div className="text-center">
          <button
            type="button"
            onClick={onBackToLogin}
            className="link link-primary text-sm font-medium"
          >
            ← 返回登录
          </button>
        </div>
      </form>
    </div>
  )
}