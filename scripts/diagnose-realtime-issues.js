import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

// 使用正确的Supabase配置
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRicWdobnBxcW5jZnlkcm5xcG9kIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDIxMTQzOSwiZXhwIjoyMDY5Nzg3NDM5fQ.luOL6-JmaHdUZ36ZD-KBL37iBqlKvg8CY8IKa6JF2nQ';

console.log('🔍 Supabase Realtime 诊断开始...');
console.log('📍 项目URL:', supabaseUrl);

// 创建客户端实例
const anonClient = createClient(supabaseUrl, supabaseAnonKey, {
  realtime: {
    autoConnect: true,
    timeout: 20000,
    heartbeatIntervalMs: 30000,
    reconnectAfterMs: (tries) => Math.min(1000 * Math.pow(2, tries), 30000)
  }
});

const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

async function diagnoseRealtimeIssues() {
  try {
    console.log('\n=== 1. 检查Realtime功能状态 ===');
    
    // 检查Realtime连接状态
    console.log('🔗 Realtime连接状态:', anonClient.realtime.isConnected());
    console.log('🔗 Socket状态:', anonClient.realtime.socket?.readyState);
    
    // 尝试创建测试频道
    const testChannel = anonClient.channel('test-realtime-status');
    console.log('📡 测试频道创建:', testChannel ? '成功' : '失败');
    
    console.log('\n=== 2. 检查表权限和RLS策略 ===');
    
    // 检查chat_sessions表权限
    try {
      const { data: chatSessionsData, error: chatSessionsError } = await serviceClient
        .from('chat_sessions')
        .select('count', { count: 'exact', head: true });
      
      if (chatSessionsError) {
        console.log('❌ chat_sessions表访问失败:', chatSessionsError.message);
      } else {
        console.log('✅ chat_sessions表访问成功，记录数:', chatSessionsData);
      }
    } catch (error) {
      console.log('❌ chat_sessions表访问异常:', error.message);
    }
    
    // 检查messages表权限
    try {
      const { data: messagesData, error: messagesError } = await serviceClient
        .from('messages')
        .select('count', { count: 'exact', head: true });
      
      if (messagesError) {
        console.log('❌ messages表访问失败:', messagesError.message);
      } else {
        console.log('✅ messages表访问成功，记录数:', messagesData);
      }
    } catch (error) {
      console.log('❌ messages表访问异常:', error.message);
    }
    
    console.log('\n=== 3. 检查RLS策略详情 ===');
    
    // 查询RLS策略
    try {
      const { data: rlsPolicies, error: rlsError } = await serviceClient
        .from('pg_policies')
        .select('*')
        .in('tablename', ['chat_sessions', 'messages']);
      
      if (rlsError) {
        console.log('❌ RLS策略查询失败:', rlsError.message);
      } else {
        console.log('📋 RLS策略详情:');
        rlsPolicies.forEach(policy => {
          console.log(`  表: ${policy.tablename}`);
          console.log(`  策略名: ${policy.policyname}`);
          console.log(`  命令: ${policy.cmd}`);
          console.log(`  角色: ${policy.roles}`);
          console.log(`  表达式: ${policy.qual}`);
          console.log('  ---');
        });
      }
    } catch (error) {
      console.log('❌ RLS策略查询异常:', error.message);
    }
    
    console.log('\n=== 4. 检查表权限授权 ===');
    
    // 查询表权限
    try {
      const { data: permissions, error: permError } = await serviceClient
        .rpc('check_table_permissions', {
          table_names: ['chat_sessions', 'messages']
        });
      
      if (permError) {
        console.log('❌ 权限查询失败:', permError.message);
        
        // 手动查询权限
        const { data: manualPerms, error: manualError } = await serviceClient
          .from('information_schema.role_table_grants')
          .select('*')
          .eq('table_schema', 'public')
          .in('table_name', ['chat_sessions', 'messages'])
          .in('grantee', ['anon', 'authenticated']);
        
        if (manualError) {
          console.log('❌ 手动权限查询失败:', manualError.message);
        } else {
          console.log('📋 表权限详情:');
          manualPerms.forEach(perm => {
            console.log(`  表: ${perm.table_name}, 角色: ${perm.grantee}, 权限: ${perm.privilege_type}`);
          });
        }
      } else {
        console.log('✅ 权限查询成功:', permissions);
      }
    } catch (error) {
      console.log('❌ 权限查询异常:', error.message);
    }
    
    console.log('\n=== 5. 测试实际订阅 ===');
    
    // 测试chat_sessions订阅
    const testUserId = '0edc31df-f12e-4a64-92dd-5f926a148a93';
    
    console.log('🧪 测试chat_sessions订阅...');
    const chatSessionsChannel = anonClient
      .channel(`test_chat_sessions_${testUserId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'chat_sessions',
        filter: `user_id=eq.${testUserId}`
      }, (payload) => {
        console.log('📨 chat_sessions变更:', payload);
      })
      .subscribe((status) => {
        console.log('📡 chat_sessions订阅状态:', status);
        if (status === 'SUBSCRIBED') {
          console.log('✅ chat_sessions订阅成功');
        } else if (status === 'CHANNEL_ERROR') {
          console.log('❌ chat_sessions订阅失败: CHANNEL_ERROR');
        }
      });
    
    // 测试messages订阅
    console.log('🧪 测试messages订阅...');
    const messagesChannel = anonClient
      .channel(`test_messages_${testUserId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'messages'
      }, (payload) => {
        console.log('📨 messages变更:', payload);
      })
      .subscribe((status) => {
        console.log('📡 messages订阅状态:', status);
        if (status === 'SUBSCRIBED') {
          console.log('✅ messages订阅成功');
        } else if (status === 'CHANNEL_ERROR') {
          console.log('❌ messages订阅失败: CHANNEL_ERROR');
        }
      });
    
    // 等待订阅结果
    await new Promise(resolve => setTimeout(resolve, 10000));
    
    console.log('\n=== 6. 最终状态检查 ===');
    console.log('🔗 Realtime连接状态:', anonClient.realtime.isConnected());
    console.log('📡 活跃频道数:', anonClient.realtime.channels.length);
    console.log('📋 频道状态:', anonClient.realtime.channels.map(ch => ({
      topic: ch.topic,
      state: ch.state
    })));
    
    // 清理
    chatSessionsChannel.unsubscribe();
    messagesChannel.unsubscribe();
    testChannel.unsubscribe();
    
  } catch (error) {
    console.error('❌ 诊断过程中发生错误:', error);
  }
}

// 运行诊断
diagnoseRealtimeIssues().then(() => {
  console.log('\n🏁 Realtime诊断完成');
  process.exit(0);
}).catch(error => {
  console.error('❌ 诊断失败:', error);
  process.exit(1);
});