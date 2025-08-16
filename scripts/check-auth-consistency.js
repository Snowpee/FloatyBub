import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// 加载环境变量
dotenv.config({ path: join(__dirname, '..', '.env') })

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ 缺少Supabase环境变量')
  console.log('VITE_SUPABASE_URL:', supabaseUrl ? '已设置' : '未设置')
  console.log('VITE_SUPABASE_ANON_KEY:', supabaseAnonKey ? '已设置' : '未设置')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false
  }
})

async function checkAuthConsistency() {
  console.log('🔍 检查认证状态一致性...')
  console.log('=')
  
  try {
    // 1. 检查Supabase会话状态
    console.log('📋 1. Supabase会话状态检查')
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    
    if (sessionError) {
      console.error('❌ 获取会话失败:', sessionError.message)
      return
    }
    
    console.log('会话状态:', session ? '已登录' : '未登录')
    if (session) {
      console.log('用户ID:', session.user.id)
      console.log('用户邮箱:', session.user.email)
      console.log('访问令牌存在:', !!session.access_token)
      console.log('刷新令牌存在:', !!session.refresh_token)
      console.log('令牌过期时间:', new Date(session.expires_at * 1000).toLocaleString())
      console.log('当前时间:', new Date().toLocaleString())
      console.log('令牌是否过期:', Date.now() > session.expires_at * 1000)
    }
    
    console.log('\n📋 2. 用户认证状态检查')
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    if (userError) {
      console.error('❌ 获取用户失败:', userError.message)
    } else {
      console.log('用户认证状态:', user ? '已认证' : '未认证')
      if (user) {
        console.log('认证用户ID:', user.id)
        console.log('认证用户邮箱:', user.email)
      }
    }
    
    console.log('\n📋 3. 数据库访问权限测试')
    
    // 测试chat_sessions表访问
    try {
      const { data: chatSessions, error: chatError } = await supabase
        .from('chat_sessions')
        .select('id, user_id')
        .limit(1)
      
      if (chatError) {
        console.error('❌ chat_sessions表访问失败:', chatError.message)
        console.log('错误代码:', chatError.code)
        console.log('错误详情:', chatError.details)
      } else {
        console.log('✅ chat_sessions表访问成功')
        console.log('返回记录数:', chatSessions?.length || 0)
      }
    } catch (error) {
      console.error('❌ chat_sessions表访问异常:', error.message)
    }
    
    // 测试messages表访问
    try {
      const { data: messages, error: msgError } = await supabase
        .from('messages')
        .select('id, session_id')
        .limit(1)
      
      if (msgError) {
        console.error('❌ messages表访问失败:', msgError.message)
        console.log('错误代码:', msgError.code)
        console.log('错误详情:', msgError.details)
      } else {
        console.log('✅ messages表访问成功')
        console.log('返回记录数:', messages?.length || 0)
      }
    } catch (error) {
      console.error('❌ messages表访问异常:', error.message)
    }
    
    console.log('\n📋 4. Realtime连接测试')
    
    // 测试Realtime连接状态
    const realtimeStatus = supabase.realtime.isConnected()
    console.log('Realtime连接状态:', realtimeStatus ? '已连接' : '未连接')
    
    // 尝试建立简单的Realtime订阅
    if (session?.user) {
      console.log('\n📋 5. 测试chatSessions订阅')
      
      const channel = supabase
        .channel('test-chat-sessions')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'chat_sessions',
            filter: `user_id=eq.${session.user.id}`
          },
          (payload) => {
            console.log('📨 收到chatSessions变化:', payload)
          }
        )
      
      // 订阅并等待状态
      const subscribePromise = new Promise((resolve) => {
        channel.subscribe((status, err) => {
          console.log('chatSessions订阅状态:', status)
          if (err) {
            console.error('chatSessions订阅错误:', err)
          }
          resolve(status)
        })
      })
      
      // 等待3秒看订阅状态
      setTimeout(() => {
        console.log('最终chatSessions订阅状态:', channel.state)
        supabase.removeChannel(channel)
      }, 3000)
      
      await subscribePromise
    } else {
      console.log('⚠️ 用户未登录，跳过订阅测试')
    }
    
    console.log('\n📋 6. 本地存储检查')
    
    // 检查localStorage中的认证数据
    if (typeof localStorage !== 'undefined') {
      const authKey = `sb-${supabaseUrl.split('//')[1].split('.')[0]}-auth-token`
      const storedAuth = localStorage.getItem(authKey)
      console.log('本地存储认证数据:', storedAuth ? '存在' : '不存在')
      
      if (storedAuth) {
        try {
          const authData = JSON.parse(storedAuth)
          console.log('存储的用户ID:', authData.user?.id || '无')
          console.log('存储的访问令牌:', authData.access_token ? '存在' : '不存在')
          console.log('存储的刷新令牌:', authData.refresh_token ? '存在' : '不存在')
        } catch (error) {
          console.error('❌ 解析本地存储数据失败:', error.message)
        }
      }
    } else {
      console.log('⚠️ localStorage不可用（Node.js环境）')
    }
    
  } catch (error) {
    console.error('❌ 认证一致性检查失败:', error.message)
    console.error('错误堆栈:', error.stack)
  }
}

// 运行检查
checkAuthConsistency().then(() => {
  console.log('\n🏁 认证一致性检查完成')
  process.exit(0)
}).catch((error) => {
  console.error('❌ 检查过程异常:', error)
  process.exit(1)
})