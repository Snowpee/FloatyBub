import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

// 使用与应用相同的配置
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

console.log('🔍 测试 Realtime 连接状态和配置...');
console.log('📍 Supabase URL:', supabaseUrl);
console.log('🔑 使用 ANON KEY (前10位):', supabaseAnonKey?.substring(0, 10) + '...');

// 创建与应用相同配置的客户端
const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  realtime: {
    autoConnect: true,
    timeout: 20000,
    heartbeatIntervalMs: 30000,
    reconnectAfterMs: (tries) => Math.min(1000 * Math.pow(2, tries), 30000)
  }
});

console.log('\n=== 1. 初始连接状态检查 ===');
console.log('📡 Realtime 连接状态:', supabase.realtime.isConnected());
console.log('🔗 Socket 状态:', supabase.realtime.socket?.readyState);
console.log('📋 当前频道数:', supabase.realtime.channels.length);

// 等待连接建立
const waitForConnection = () => {
  return new Promise((resolve) => {
    let attempts = 0;
    const maxAttempts = 10;
    
    const checkConnection = () => {
      attempts++;
      console.log(`🔄 连接检查 ${attempts}/${maxAttempts}:`, {
        connected: supabase.realtime.isConnected(),
        socketState: supabase.realtime.socket?.readyState,
        channels: supabase.realtime.channels.length
      });
      
      if (supabase.realtime.isConnected() || attempts >= maxAttempts) {
        resolve(supabase.realtime.isConnected());
      } else {
        setTimeout(checkConnection, 1000);
      }
    };
    
    checkConnection();
  });
};

async function testRealtimeConnection() {
  try {
    console.log('\n=== 2. 等待连接建立 ===');
    const connected = await waitForConnection();
    console.log('🔗 连接建立结果:', connected);
    
    console.log('\n=== 3. 测试 chat_sessions 订阅 ===');
    
    // 模拟用户ID（从日志中获取）
    const testUserId = '0edc31df-f12e-4a64-92dd-5f926a148a93';
    
    const chatSessionsChannel = supabase
      .channel(`chat_sessions_${testUserId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'chat_sessions',
          filter: `user_id=eq.${testUserId}`
        },
        (payload) => {
          console.log('📨 chat_sessions 变更:', payload);
        }
      )
      .subscribe((status, err) => {
        console.log('📡 chat_sessions 订阅状态:', status);
        if (err) {
          console.log('❌ chat_sessions 订阅错误:', err);
        }
      });
    
    // 等待订阅状态稳定
    await new Promise(resolve => setTimeout(resolve, 3000));
    console.log('🔍 chat_sessions 频道状态:', chatSessionsChannel.state);
    
    console.log('\n=== 4. 测试 messages 订阅 ===');
    
    const messagesChannel = supabase
      .channel(`messages_${testUserId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages'
        },
        (payload) => {
          console.log('📨 messages 变更:', payload);
        }
      )
      .subscribe((status, err) => {
        console.log('📡 messages 订阅状态:', status);
        if (err) {
          console.log('❌ messages 订阅错误:', err);
        }
      });
    
    // 等待订阅状态稳定
    await new Promise(resolve => setTimeout(resolve, 3000));
    console.log('🔍 messages 频道状态:', messagesChannel.state);
    
    console.log('\n=== 5. 最终状态检查 ===');
    console.log('📡 Realtime 连接:', supabase.realtime.isConnected());
    console.log('🔗 Socket 状态:', supabase.realtime.socket?.readyState);
    console.log('📋 总频道数:', supabase.realtime.channels.length);
    console.log('📊 频道详情:', supabase.realtime.channels.map(ch => ({
      topic: ch.topic,
      state: ch.state,
      joinRef: ch.joinRef
    })));
    
    console.log('\n=== 6. 测试表访问权限 ===');
    
    // 测试 chat_sessions 表访问
    try {
      const { data: sessionsData, error: sessionsError } = await supabase
        .from('chat_sessions')
        .select('id, title')
        .eq('user_id', testUserId)
        .limit(1);
      
      if (sessionsError) {
        console.log('❌ chat_sessions 表访问失败:', sessionsError.message);
      } else {
        console.log('✅ chat_sessions 表访问成功，数据:', sessionsData?.length || 0, '条');
      }
    } catch (error) {
      console.log('❌ chat_sessions 表访问异常:', error.message);
    }
    
    // 测试 messages 表访问
    try {
      const { data: messagesData, error: messagesError } = await supabase
        .from('messages')
        .select('id, content')
        .limit(1);
      
      if (messagesError) {
        console.log('❌ messages 表访问失败:', messagesError.message);
      } else {
        console.log('✅ messages 表访问成功，数据:', messagesData?.length || 0, '条');
      }
    } catch (error) {
      console.log('❌ messages 表访问异常:', error.message);
    }
    
    // 清理订阅
    console.log('\n=== 7. 清理订阅 ===');
    await chatSessionsChannel.unsubscribe();
    await messagesChannel.unsubscribe();
    console.log('🧹 订阅已清理');
    
  } catch (error) {
    console.error('❌ 测试过程中发生错误:', error);
  }
}

// 运行测试
testRealtimeConnection().then(() => {
  console.log('\n🏁 Realtime 连接测试完成');
  process.exit(0);
}).catch(error => {
  console.error('❌ 测试失败:', error);
  process.exit(1);
});