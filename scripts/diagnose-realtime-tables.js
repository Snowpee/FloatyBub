#!/usr/bin/env node

// 诊断Realtime表级别配置的脚本
// 检查chat_sessions和messages表是否启用了Realtime功能

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// 加载环境变量
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ 缺少必需的环境变量:');
  console.error('   VITE_SUPABASE_URL:', !!supabaseUrl);
  console.error('   VITE_SUPABASE_ANON_KEY:', !!supabaseAnonKey);
  process.exit(1);
}

// 使用anon key创建客户端进行基础检查
const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: false
  },
  realtime: {
    autoConnect: true,
    timeout: 20000,
    heartbeatIntervalMs: 30000
  }
});

async function checkRealtimeConfiguration() {
  console.log('🔍 检查Realtime表级别配置...');
  console.log('=' .repeat(50));

  try {
    // 检查基础表访问权限
    console.log('\n📋 检查基础表访问权限:');
    const targetTables = ['chat_sessions', 'messages'];
    
    for (const tableName of targetTables) {
      try {
        const { data, error } = await supabase
          .from(tableName)
          .select('id')
          .limit(1);
        
        if (error) {
          console.error(`   ❌ 表 ${tableName} 访问失败:`, error.message);
        } else {
          console.log(`   ✅ 表 ${tableName} 访问正常`);
        }
      } catch (err) {
        console.error(`   ❌ 表 ${tableName} 访问异常:`, err.message);
      }
    }



    // 测试实际的Realtime连接
    console.log('\n🔗 测试Realtime连接:');
    const testChannel = supabase.channel('test-connection');
    
    const connectionPromise = new Promise((resolve) => {
      const timeout = setTimeout(() => {
        resolve('timeout');
      }, 5000);

      testChannel
        .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_sessions' }, () => {})
        .subscribe((status) => {
          clearTimeout(timeout);
          resolve(status);
        });
    });

    const connectionStatus = await connectionPromise;
    console.log(`   连接状态: ${connectionStatus}`);
    
    if (connectionStatus === 'SUBSCRIBED') {
      console.log('   ✅ Realtime连接成功');
    } else {
      console.log('   ❌ Realtime连接失败');
    }

    // 清理测试连接
    supabase.removeChannel(testChannel);

  } catch (error) {
    console.error('❌ 诊断过程中发生错误:', error);
  }

  console.log('\n' + '='.repeat(50));
  console.log('🏁 Realtime诊断完成');
}

// 运行诊断
checkRealtimeConfiguration().catch(console.error);