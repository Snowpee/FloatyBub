import { supabase } from '../lib/supabase'

// Supabase 连接调试工具
export class SupabaseDebugger {
  static async testConnection() {
    console.log('🔍 开始 Supabase 连接诊断...')
    
    const results = {
      configCheck: false,
      authCheck: false,
      networkCheck: false,
      tableAccess: false,
      errors: [] as string[]
    }

    try {
      // 1. 检查配置
      console.log('1️⃣ 检查 Supabase 配置...')
      const url = import.meta.env.VITE_SUPABASE_URL
      const key = import.meta.env.VITE_SUPABASE_ANON_KEY
      
      if (!url || !key) {
        results.errors.push('缺少必要的环境变量')
        console.error('❌ 环境变量缺失:', { url: !!url, key: !!key })
      } else {
        results.configCheck = true
        console.log('✅ 配置检查通过')
      }

      // 2. 检查认证状态
      console.log('2️⃣ 检查认证状态...')
      try {
        // 添加超时机制防止无限等待
        const authPromise = supabase.auth.getSession()
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('认证状态检查超时')), 10000) // 10秒超时
        })
        
        const { data: { session }, error: sessionError } = await Promise.race([
          authPromise,
          timeoutPromise
        ]) as any
        
        if (sessionError) {
          results.errors.push(`认证错误: ${sessionError.message}`)
          console.error('❌ 认证状态检查失败:', sessionError)
        } else {
          results.authCheck = true
          console.log('✅ 认证状态:', session ? '已登录' : '未登录')
          if (session) {
            console.log('👤 用户信息:', {
              id: session.user.id,
              email: session.user.email,
              expires_at: new Date(session.expires_at! * 1000).toLocaleString()
            })
          }
        }
      } catch (authError) {
        results.errors.push(`认证检查异常: ${authError}`)
        console.error('❌ 认证检查异常:', authError)
      }

      // 3. 检查网络连接
      console.log('3️⃣ 检查网络连接...')
      try {
        // 添加超时机制
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 8000) // 8秒超时
        
        const response = await fetch(`${url}/rest/v1/`, {
          method: 'HEAD',
          headers: {
            'apikey': key,
            'Authorization': `Bearer ${key}`
          },
          signal: controller.signal
        })
        
        clearTimeout(timeoutId)
        
        if (response.ok) {
          results.networkCheck = true
          console.log('✅ 网络连接正常')
        } else {
          results.errors.push(`网络连接失败: ${response.status} ${response.statusText}`)
          console.error('❌ 网络连接失败:', response.status, response.statusText)
        }
      } catch (networkError) {
        const errorMsg = networkError instanceof Error && networkError.name === 'AbortError' 
          ? '网络连接超时' 
          : `网络连接异常: ${networkError}`
        results.errors.push(errorMsg)
        console.error('❌ 网络连接异常:', networkError)
      }

      // 4. 检查表访问权限
      console.log('4️⃣ 检查表访问权限...')
      try {
        // 添加超时机制
        const tablePromise = supabase
          .from('chat_sessions')
          .select('count', { count: 'exact', head: true })
        
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('表访问检查超时')), 8000) // 8秒超时
        })
        
        const { data, error: tableError } = await Promise.race([
          tablePromise,
          timeoutPromise
        ]) as any
        
        if (tableError) {
          results.errors.push(`表访问错误: ${tableError.message}`)
          console.error('❌ 表访问失败:', tableError)
        } else {
          results.tableAccess = true
          console.log('✅ 表访问正常')
        }
      } catch (tableAccessError) {
        results.errors.push(`表访问异常: ${tableAccessError}`)
        console.error('❌ 表访问异常:', tableAccessError)
      }

    } catch (generalError) {
      results.errors.push(`总体检查异常: ${generalError}`)
      console.error('❌ 总体检查异常:', generalError)
    }

    console.log('🏁 诊断完成:', results)
    return results
  }

  static async testSpecificQuery(userId: string) {
    console.log('🔍 测试具体查询...')
    
    try {
      // 测试失败的查询
      console.log('测试查询: chat_sessions')
      const { data: sessions, error: sessionsError } = await supabase
        .from('chat_sessions')
        .select('*')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false })

      if (sessionsError) {
        console.error('❌ 查询失败:', sessionsError)
        return { success: false, error: sessionsError }
      } else {
        console.log('✅ 查询成功:', sessions?.length || 0, '条记录')
        return { success: true, data: sessions }
      }
    } catch (error) {
      console.error('❌ 查询异常:', error)
      return { success: false, error }
    }
  }

  static logNetworkDetails() {
    console.log('🌐 网络环境信息:')
    console.log('- User Agent:', navigator.userAgent)
    console.log('- Online:', navigator.onLine)
    console.log('- Connection:', (navigator as any).connection?.effectiveType || 'unknown')
    console.log('- Location:', window.location.href)
    console.log('- Referrer:', document.referrer)
  }
}

// 导出便捷函数
export const debugSupabase = () => SupabaseDebugger.testConnection()
export const debugQuery = (userId: string) => SupabaseDebugger.testSpecificQuery(userId)
export const logNetwork = () => SupabaseDebugger.logNetworkDetails()