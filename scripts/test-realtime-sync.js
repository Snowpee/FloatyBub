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

// 创建两个客户端模拟不同用户
const client1 = createClient(supabaseUrl, supabaseAnonKey, {
  realtime: {
    autoConnect: true,
    params: {
      eventsPerSecond: 10
    },
    timeout: 20000,
    heartbeatIntervalMs: 30000,
    reconnectAfterMs: (tries) => Math.min(1000 * Math.pow(2, tries), 30000)
  }
})

const client2 = createClient(supabaseUrl, supabaseAnonKey, {
  realtime: {
    autoConnect: true,
    params: {
      eventsPerSecond: 10
    },
    timeout: 20000,
    heartbeatIntervalMs: 30000,
    reconnectAfterMs: (tries) => Math.min(1000 * Math.pow(2, tries), 30000)
  }
})

console.log('🚀 开始实时同步测试...')
console.log('🔧 Supabase 配置:')
console.log('URL:', supabaseUrl)
console.log('Anon Key:', supabaseAnonKey.substring(0, 20) + '...')

let messagesReceived = 0
let chatSessionsReceived = 0

// 客户端1订阅messages
const messagesChannel1 = client1
  .channel('messages-sync-test')
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'messages'
  }, (payload) => {
    console.log('📨 客户端1收到messages变更:', payload.eventType, payload.new?.id)
    messagesReceived++
  })
  .subscribe((status) => {
    console.log('📡 客户端1 messages订阅状态:', status)
  })

// 客户端1订阅chat_sessions
const chatSessionsChannel1 = client1
  .channel('chat-sessions-sync-test')
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'chat_sessions'
  }, (payload) => {
    console.log('💬 客户端1收到chat_sessions变更:', payload.eventType, payload.new?.id)
    chatSessionsReceived++
  })
  .subscribe((status) => {
    console.log('📡 客户端1 chat_sessions订阅状态:', status)
  })

// 等待订阅建立
setTimeout(async () => {
  console.log('\n🔍 开始测试数据同步...')
  
  try {
    // 测试1: 创建chat_session
    console.log('\n📝 测试1: 创建chat_session')
    const { data: sessionData, error: sessionError } = await client2
      .from('chat_sessions')
      .insert({
        user_id: 'test-user-' + Date.now(),
        title: '测试会话 ' + new Date().toLocaleTimeString(),
        metadata: { test: true }
      })
      .select()
      .single()
    
    if (sessionError) {
      console.error('❌ 创建chat_session失败:', sessionError)
    } else {
      console.log('✅ 创建chat_session成功:', sessionData.id)
    }
    
    // 等待实时更新
    await new Promise(resolve => setTimeout(resolve, 2000))
    
    // 测试2: 创建message
    if (sessionData) {
      console.log('\n📝 测试2: 创建message')
      const { data: messageData, error: messageError } = await client2
        .from('messages')
        .insert({
          session_id: sessionData.id,
          role: 'user',
          content: '测试消息 ' + new Date().toLocaleTimeString(),
          metadata: { test: true }
        })
        .select()
        .single()
      
      if (messageError) {
        console.error('❌ 创建message失败:', messageError)
      } else {
        console.log('✅ 创建message成功:', messageData.id)
      }
    }
    
    // 等待实时更新
    await new Promise(resolve => setTimeout(resolve, 3000))
    
    // 输出测试结果
    console.log('\n📊 同步测试结果:')
    console.log('- Messages实时更新接收:', messagesReceived, '次')
    console.log('- ChatSessions实时更新接收:', chatSessionsReceived, '次')
    
    if (messagesReceived > 0 && chatSessionsReceived > 0) {
      console.log('✅ 实时同步功能正常工作')
    } else {
      console.log('❌ 实时同步存在问题')
      console.log('  - Messages订阅:', messagesReceived > 0 ? '✅' : '❌')
      console.log('  - ChatSessions订阅:', chatSessionsReceived > 0 ? '✅' : '❌')
    }
    
  } catch (error) {
    console.error('❌ 测试过程中发生错误:', error)
  } finally {
    // 清理订阅
    console.log('\n🧹 清理订阅...')
    await messagesChannel1.unsubscribe()
    await chatSessionsChannel1.unsubscribe()
    process.exit(0)
  }
}, 3000)

// 错误处理
process.on('unhandledRejection', (error) => {
  console.error('❌ 未处理的Promise拒绝:', error)
  process.exit(1)
})