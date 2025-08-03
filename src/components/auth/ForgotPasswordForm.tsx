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
    <div className="w-full max-w-md mx-auto">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          重置密码
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          输入您的邮箱地址，我们将发送重置密码的链接
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* 邮箱输入 */}
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            邮箱地址
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Mail className="h-5 w-5 text-gray-400" />
            </div>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="block w-full pl-10 pr-3 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
              placeholder="请输入您的邮箱"
              required
              autoComplete="email"
            />
          </div>
        </div>

        {/* 错误信息 */}
        {error && (
          <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          </div>
        )}

        {/* 提示信息 */}
        <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <p className="text-sm text-blue-600 dark:text-blue-400">
            重置链接将发送到您的邮箱，请检查收件箱和垃圾邮件文件夹。
          </p>
        </div>

        {/* 发送按钮 */}
        <button
          type="submit"
          disabled={!isFormValid || isSubmitting}
          className="w-full flex items-center justify-center px-4 py-3 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isSubmitting ? (
            <div className="flex items-center">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              发送中...
            </div>
          ) : (
            <div className="flex items-center">
              <Send className="h-4 w-4 mr-2" />
              发送重置链接
            </div>
          )}
        </button>

        {/* 返回登录链接 */}
        <div className="text-center">
          <button
            type="button"
            onClick={onBackToLogin}
            className="inline-flex items-center text-sm text-blue-600 dark:text-blue-400 hover:text-blue-500 dark:hover:text-blue-300 font-medium transition-colors"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            返回登录
          </button>
        </div>
      </form>
    </div>
  )
}