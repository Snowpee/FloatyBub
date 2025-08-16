import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

// 加载环境变量
dotenv.config()

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ 缺少 Supabase 配置')
  process.exit(1)
}

// 创建 Supabase 客户端，使用与应用相同的配置
const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  realtime: {
    autoConnect: true,
    timeout: 20000,
    heartbeatIntervalMs: 30000,
    reconnectAfterMs: (tries) => Math.min(1000 * Math.pow(2, tries), 30000)
  }
})

async function testFixedSubscriptions() {
  console.log('🧪 测试修复后的订阅配置...')
  
  try {
    // 模拟用户ID（从日志中获取）
    const userId = '0edc31df-f12e-4a64-92dd-5f926a148a93'
    
    // 1. 获取用户的聊天会话
    console.log('\n📋 获取用户聊天会话...')
    const { data: sessions, error: sessionsError } = await supabase
      .from('chat_sessions')
      .select('id, title')
      .eq('user_id', userId)
    
    if (sessionsError) {
      console.error('❌ 获取聊天会话失败:', sessionsError)
      return
    }
    
    console.log('✅ 用户聊天会话:', sessions?.length || 0, '个')
    const sessionIds = sessions?.map(s => s.id) || []
    console.log('🔍 会话IDs:', sessionIds)
    
    // 2. 测试 chat_sessions 订阅
    console.log('\n📡 测试 chat_sessions 订阅...')
    const chatSessionsChannel = supabase
      .channel(`chat_sessions_${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'chat_sessions',
          filter: `user_id=eq.${userId}`
        },
        (payload) => {
          console.log('📨 chat_sessions 更新:', payload.eventType, payload.new?.id)
        }
      )
      .subscribe((status) => {
        console.log('📡 chat_sessions 订阅状态:', status)
      })
    
    // 3. 测试 messages 订阅（使用修复后的过滤器）
    console.log('\n📡 测试 messages 订阅...')
    const messagesFilter = sessionIds.length > 0 
      ? `session_id=in.(${sessionIds.join(',')})`
      : 'session_id=eq.never-match' // 如果没有会话，使用永不匹配的过滤器
    
    console.log('🔍 messages 过滤器:', messagesFilter)
    
    const messagesChannel = supabase
      .channel(`messages_${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages',
          filter: messagesFilter
        },
        (payload) => {
          console.log('📨 messages 更新:', payload.eventType, payload.new?.id)
        }
      )
      .subscribe((status) => {
        console.log('📡 messages 订阅状态:', status)
      })
    
    // 4. 等待订阅建立
    console.log('\n⏳ 等待订阅建立...')
    await new Promise(resolve => setTimeout(resolve, 5000))
    
    // 5. 检查最终状态
    console.log('\n🔍 最终状态检查:')
    console.log('📡 Realtime连接:', supabase.realtime.isConnected())
    console.log('🔗 总频道数:', supabase.realtime.channels.length)
    
    const channelStates = supabase.realtime.channels.map(ch => ({
      topic: ch.topic,
      state: ch.state,
      joinRef: ch.joinRef
    }))
    console.log('📋 频道状态:', channelStates)
    
    // 6. 测试数据访问权限
    console.log('\n🔐 测试数据访问权限...')
    
    // 测试 chat_sessions 访问
    const { data: testSessions, error: testSessionsError } = await supabase
      .from('chat_sessions')
      .select('count')
      .eq('user_id', userId)
    
    console.log('📊 chat_sessions 访问测试:', testSessionsError ? '失败' : '成功')
    if (testSessionsError) {
      console.error('❌ chat_sessions 访问错误:', testSessionsError)
    }
    
    // 测试 messages 访问
    if (sessionIds.length > 0) {
      const { data: testMessages, error: testMessagesError } = await supabase
        .from('messages')
        .select('count')
        .in('session_id', sessionIds)
      
      console.log('📊 messages 访问测试:', testMessagesError ? '失败' : '成功')
      if (testMessagesError) {
        console.error('❌ messages 访问错误:', testMessagesError)
      }
    }
    
    // 7. 清理订阅
    console.log('\n🧹 清理测试订阅...')
    chatSessionsChannel.unsubscribe()
    messagesChannel.unsubscribe()
    
    console.log('✅ 订阅配置测试完成')
    
  } catch (error) {
    console.error('❌ 测试过程中发生错误:', error)
  }
}

// 运行测试
testFixedSubscriptions().then(() => {
  console.log('\n🏁 测试结束')
  process.exit(0)
}).catch(error => {
  console.error('❌ 测试失败:', error)
  process.exit(1)
})