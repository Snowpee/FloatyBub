#!/usr/bin/env node

/**
 * chatSessions 订阅诊断脚本
 * 用于测试简化的订阅配置，隔离 CHANNEL_ERROR 问题
 */

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// 加载环境变量
config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ 缺少必需的环境变量');
  console.error('请确保 .env 文件中包含:');
  console.error('- VITE_SUPABASE_URL');
  console.error('- VITE_SUPABASE_ANON_KEY');
  process.exit(1);
}

console.log('🔧 Supabase 配置:');
console.log('URL:', supabaseUrl);
console.log('Anon Key:', supabaseAnonKey.substring(0, 20) + '...');

// 创建 Supabase 客户端
const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  },
  realtime: {
    params: {
      eventsPerSecond: 10
    }
  }
});

// 测试基本连接
async function testBasicConnection() {
  console.log('\n🔍 测试基本数据库连接...');
  try {
    const { data, error } = await supabase
      .from('chat_sessions')
      .select('count')
      .limit(1);
    
    if (error) {
      console.error('❌ 基本连接失败:', error.message);
      return false;
    }
    
    console.log('✅ 基本数据库连接正常');
    return true;
  } catch (err) {
    console.error('❌ 连接测试异常:', err.message);
    return false;
  }
}

// 测试简化的订阅（无过滤器）
async function testSimpleSubscription() {
  console.log('\n🔍 测试简化的 chat_sessions 订阅（无过滤器）...');
  
  return new Promise((resolve) => {
    let subscriptionResolved = false;
    
    // 设置超时
    const timeout = setTimeout(() => {
      if (!subscriptionResolved) {
        console.log('⏰ 订阅测试超时（30秒）');
        subscriptionResolved = true;
        resolve(false);
      }
    }, 30000);
    
    const channel = supabase
      .channel('test-chat-sessions-simple')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'chat_sessions'
          // 注意：这里没有任何过滤器
        },
        (payload) => {
          console.log('📨 收到 chat_sessions 变更:', payload);
        }
      )
      .subscribe((status, err) => {
        console.log('📡 简化订阅状态变更:', status);
        
        if (err) {
          console.error('❌ 订阅错误详情:', {
            message: err.message,
            code: err.code,
            details: err.details,
            hint: err.hint,
            stack: err.stack
          });
        }
        
        if (status === 'SUBSCRIBED') {
          console.log('✅ 简化订阅成功建立');
          if (!subscriptionResolved) {
            subscriptionResolved = true;
            clearTimeout(timeout);
            
            // 等待5秒后关闭订阅
            setTimeout(() => {
              channel.unsubscribe();
              resolve(true);
            }, 5000);
          }
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          console.error(`❌ 简化订阅失败: ${status}`);
          if (!subscriptionResolved) {
            subscriptionResolved = true;
            clearTimeout(timeout);
            resolve(false);
          }
        }
      });
  });
}

// 测试带用户过滤器的订阅
async function testFilteredSubscription() {
  console.log('\n🔍 测试带过滤器的 chat_sessions 订阅...');
  
  // 首先获取当前用户
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  
  if (authError || !user) {
    console.log('⚠️  未登录用户，跳过过滤器测试');
    return true; // 不算失败
  }
  
  console.log('👤 当前用户ID:', user.id);
  
  return new Promise((resolve) => {
    let subscriptionResolved = false;
    
    // 设置超时
    const timeout = setTimeout(() => {
      if (!subscriptionResolved) {
        console.log('⏰ 过滤器订阅测试超时（30秒）');
        subscriptionResolved = true;
        resolve(false);
      }
    }, 30000);
    
    const channel = supabase
      .channel('test-chat-sessions-filtered')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'chat_sessions',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          console.log('📨 收到过滤的 chat_sessions 变更:', payload);
        }
      )
      .subscribe((status, err) => {
        console.log('📡 过滤订阅状态变更:', status);
        
        if (err) {
          console.error('❌ 过滤订阅错误详情:', {
            message: err.message,
            code: err.code,
            details: err.details,
            hint: err.hint,
            stack: err.stack
          });
        }
        
        if (status === 'SUBSCRIBED') {
          console.log('✅ 过滤订阅成功建立');
          if (!subscriptionResolved) {
            subscriptionResolved = true;
            clearTimeout(timeout);
            
            // 等待5秒后关闭订阅
            setTimeout(() => {
              channel.unsubscribe();
              resolve(true);
            }, 5000);
          }
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          console.error(`❌ 过滤订阅失败: ${status}`);
          if (!subscriptionResolved) {
            subscriptionResolved = true;
            clearTimeout(timeout);
            resolve(false);
          }
        }
      });
  });
}

// 检查权限
async function checkPermissions() {
  console.log('\n🔍 检查 chat_sessions 表权限...');
  
  try {
    // 测试读取权限
    const { data, error } = await supabase
      .from('chat_sessions')
      .select('id, user_id, title')
      .limit(1);
    
    if (error) {
      console.error('❌ 读取权限检查失败:', error.message);
      return false;
    }
    
    console.log('✅ 读取权限正常');
    
    // 测试插入权限（如果用户已登录）
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (user) {
      console.log('👤 用户已登录，测试插入权限...');
      
      const testSession = {
        user_id: user.id,
        title: 'Test Session - ' + Date.now(),
        metadata: { test: true }
      };
      
      const { data: insertData, error: insertError } = await supabase
        .from('chat_sessions')
        .insert(testSession)
        .select()
        .single();
      
      if (insertError) {
        console.error('❌ 插入权限检查失败:', insertError.message);
        return false;
      }
      
      console.log('✅ 插入权限正常');
      
      // 清理测试数据
      await supabase
        .from('chat_sessions')
        .delete()
        .eq('id', insertData.id);
      
      console.log('🧹 测试数据已清理');
    } else {
      console.log('⚠️  用户未登录，跳过插入权限测试');
    }
    
    return true;
  } catch (err) {
    console.error('❌ 权限检查异常:', err.message);
    return false;
  }
}

// 主函数
async function main() {
  console.log('🚀 开始 chatSessions 订阅诊断...');
  
  const basicConnection = await testBasicConnection();
  if (!basicConnection) {
    console.log('\n❌ 基本连接失败，终止测试');
    process.exit(1);
  }
  
  const permissions = await checkPermissions();
  if (!permissions) {
    console.log('\n❌ 权限检查失败，但继续订阅测试...');
  }
  
  const simpleSubscription = await testSimpleSubscription();
  const filteredSubscription = await testFilteredSubscription();
  
  console.log('\n📊 测试结果总结:');
  console.log('- 基本连接:', basicConnection ? '✅ 成功' : '❌ 失败');
  console.log('- 权限检查:', permissions ? '✅ 成功' : '❌ 失败');
  console.log('- 简化订阅:', simpleSubscription ? '✅ 成功' : '❌ 失败');
  console.log('- 过滤订阅:', filteredSubscription ? '✅ 成功' : '❌ 失败');
  
  if (simpleSubscription && !filteredSubscription) {
    console.log('\n🔍 诊断结论: 过滤器可能是导致 CHANNEL_ERROR 的原因');
  } else if (!simpleSubscription) {
    console.log('\n🔍 诊断结论: chat_sessions 表的 Realtime 功能可能未正确启用');
  } else {
    console.log('\n🔍 诊断结论: 订阅功能正常，问题可能在应用层面');
  }
  
  process.exit(0);
}

// 错误处理
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ 未处理的 Promise 拒绝:', reason);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.error('❌ 未捕获的异常:', error);
  process.exit(1);
});

// 运行主函数
main().catch(console.error);