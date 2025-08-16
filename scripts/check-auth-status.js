import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

// 加载环境变量
dotenv.config()

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ 缺少 Supabase 环境变量')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  realtime: {
    autoConnect: true,
    timeout: 30000,
    heartbeatIntervalMs: 30000
  }
})

async function checkAuthStatus() {
  console.log('🔍 检查认证状态...')
  
  try {
    // 检查当前会话
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    
    if (sessionError) {
      console.error('❌ 获取会话失败:', sessionError)
      return
    }
    
    if (session) {
      console.log('✅ 用户已认证')
      console.log('🔍 用户ID:', session.user.id)
      console.log('🔍 用户邮箱:', session.user.email)
      console.log('🔍 访问令牌存在:', !!session.access_token)
      console.log('🔍 刷新令牌存在:', !!session.refresh_token)
      console.log('🔍 令牌过期时间:', new Date(session.expires_at * 1000).toLocaleString())
      
      // 测试数据库访问权限
      console.log('\n🔍 测试数据库访问权限...')
      
      // 测试 chat_sessions 表访问
      const { data: sessions, error: sessionsError } = await supabase
        .from('chat_sessions')
        .select('id, title, created_at')
        .eq('user_id', session.user.id)
        .limit(1)
      
      if (sessionsError) {
        console.error('❌ chat_sessions 表访问失败:', sessionsError)
      } else {
        console.log('✅ chat_sessions 表访问正常，找到', sessions?.length || 0, '个会话')
      }
      
      // 测试 messages 表访问
      const { data: messages, error: messagesError } = await supabase
        .from('messages')
        .select('id, content, created_at')
        .limit(1)
      
      if (messagesError) {
        console.error('❌ messages 表访问失败:', messagesError)
      } else {
        console.log('✅ messages 表访问正常，找到', messages?.length || 0, '条消息')
      }
      
      // 测试 Realtime 连接
      console.log('\n🔍 测试 Realtime 连接...')
      console.log('🔍 Realtime 实例存在:', !!supabase.realtime)
      console.log('🔍 Realtime 连接状态:', supabase.realtime?.isConnected())
      console.log('🔍 访问令牌:', supabase.realtime?.accessToken ? '存在' : '缺失')
      
      // 测试简单订阅
      const testChannel = supabase
        .channel('auth_test')
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'chat_sessions',
          filter: `user_id=eq.${session.user.id}`
        }, (payload) => {
          console.log('📨 测试订阅收到数据:', payload)
        })
        .subscribe((status, err) => {
          console.log('📡 测试订阅状态:', status)
          if (err) {
            console.error('❌ 测试订阅错误:', err)
          }
          
          // 5秒后清理测试订阅
          setTimeout(() => {
            testChannel.unsubscribe()
            console.log('🧹 测试订阅已清理')
            process.exit(0)
          }, 5000)
        })
      
    } else {
      console.log('❌ 用户未认证')
      console.log('🔍 建议检查:')
      console.log('  1. 用户是否已登录')
      console.log('  2. 认证令牌是否有效')
      console.log('  3. 本地存储中的会话数据')
      process.exit(0)
    }
    
  } catch (error) {
    console.error('❌ 认证状态检查失败:', error)
    process.exit(1)
  }
}

checkAuthStatus()