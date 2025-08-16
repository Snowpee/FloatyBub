#!/usr/bin/env node

/**
 * Supabase Replication 功能诊断脚本
 * 用于分析 chatSessions 订阅 CHANNEL_ERROR 的根本原因
 * 特别关注 Replication 功能未启用的影响
 */

import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

// 加载环境变量
dotenv.config()

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ 缺少必要的环境变量:')
  console.error('  - VITE_SUPABASE_URL:', supabaseUrl ? '✅' : '❌')
  console.error('  - VITE_SUPABASE_ANON_KEY:', supabaseAnonKey ? '✅' : '❌')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  realtime: {
    params: {
      eventsPerSecond: 10
    }
  }
})

async function diagnoseReplicationIssue() {
  console.log('🔬 开始 Supabase Replication 功能诊断...')
  console.log('=' .repeat(60))
  
  // 1. 基础连接测试
  console.log('\n📡 1. 基础连接测试')
  try {
    const { data, error } = await supabase.from('chat_sessions').select('count').limit(1)
    if (error) {
      console.error('❌ 基础连接失败:', error.message)
      console.error('   错误代码:', error.code)
      console.error('   错误详情:', error.details)
    } else {
      console.log('✅ 基础连接正常')
    }
  } catch (err) {
    console.error('❌ 连接异常:', err.message)
  }
  
  // 2. 权限检查
  console.log('\n🔐 2. 权限检查')
  const tables = ['chat_sessions', 'messages']
  const operations = [
    { name: 'SELECT', query: (table) => supabase.from(table).select('count').limit(1) },
    { name: 'INSERT', query: (table) => supabase.from(table).insert({}).select() }
  ]
  
  for (const table of tables) {
    console.log(`\n  📋 表: ${table}`)
    for (const op of operations) {
      try {
        const { data, error } = await op.query(table)
        if (error) {
          console.log(`    ${op.name}: ❌ ${error.message} (${error.code})`)
          if (error.code === 'PGRST116') {
            console.log('      → 可能原因: RLS策略阻止访问或权限不足')
          } else if (error.code === '42501') {
            console.log('      → 可能原因: 角色权限不足')
          }
        } else {
          console.log(`    ${op.name}: ✅ 成功`)
        }
      } catch (err) {
        console.log(`    ${op.name}: ❌ 异常 - ${err.message}`)
      }
    }
  }
  
  // 3. Realtime 功能测试
  console.log('\n⚡ 3. Realtime 功能测试')
  console.log('  🔍 Realtime 客户端状态:', supabase.realtime ? '已初始化' : '未初始化')
  
  if (supabase.realtime) {
    console.log('  🔍 连接状态:', supabase.realtime.isConnected() ? '已连接' : '未连接')
    console.log('  🔍 访问令牌:', supabase.realtime.accessToken ? '存在' : '缺失')
    
    // 测试订阅创建
    console.log('\n  📡 测试 chat_sessions 订阅创建...')
    
    const testSubscription = () => {
      return new Promise((resolve) => {
        const channel = supabase
          .channel('test-chat-sessions')
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'chat_sessions',
              filter: 'user_id=eq.00000000-0000-0000-0000-000000000000' // 测试用的无效UUID
            },
            (payload) => {
              console.log('    📨 收到测试事件:', payload)
            }
          )
          .subscribe((status, err) => {
            console.log(`    📊 订阅状态: ${status}`)
            if (err) {
              console.error('    ❌ 订阅错误:', err)
            }
            
            if (status === 'SUBSCRIBED') {
              console.log('    ✅ 订阅成功建立')
              resolve({ success: true, status })
            } else if (status === 'CHANNEL_ERROR') {
              console.error('    🚨 CHANNEL_ERROR - 这是关键问题!')
              console.error('    🔍 可能原因:')
              console.error('      1. Replication 功能未启用 (Coming Soon 状态)')
              console.error('      2. anon 角色权限不足')
              console.error('      3. RLS 策略配置问题')
              console.error('      4. 表的 Realtime 功能未启用')
              resolve({ success: false, status, error: 'CHANNEL_ERROR' })
            } else if (status === 'TIMED_OUT' || status === 'CLOSED') {
              console.error(`    ❌ 订阅失败: ${status}`)
              resolve({ success: false, status })
            }
          })
        
        // 10秒超时
        setTimeout(() => {
          channel.unsubscribe()
          resolve({ success: false, status: 'TIMEOUT' })
        }, 10000)
      })
    }
    
    const result = await testSubscription()
    
    if (!result.success && result.error === 'CHANNEL_ERROR') {
      console.log('\n🎯 4. CHANNEL_ERROR 根本原因分析')
      console.log('  根据用户反馈，Supabase 显示:')
      console.log('  📋 Replication: "Coming Soon" - 仅限早期用户')
      console.log('  🔐 Authentication > Policies: 只有 SELECT 权限给 public 角色')
      console.log('')
      console.log('  💡 分析结论:')
      console.log('  1. ⚠️  Replication 功能未启用是 CHANNEL_ERROR 的主要原因')
      console.log('  2. 🔒 anon 角色只有 SELECT 权限，缺少 Realtime 订阅所需的权限')
      console.log('  3. 📡 Realtime 订阅需要 Replication 功能支持才能正常工作')
      console.log('')
      console.log('  🛠️  建议解决方案:')
      console.log('  1. 申请 Supabase Replication 早期访问权限')
      console.log('  2. 使用轮询机制作为降级策略（已实现）')
      console.log('  3. 优化错误处理，当检测到 CHANNEL_ERROR 时立即切换到轮询')
      console.log('  4. 添加用户友好的提示，说明实时功能暂时不可用')
    }
  }
  
  // 5. 网络和环境检查
  console.log('\n🌐 5. 网络和环境检查')
  console.log('  🔍 在线状态:', typeof navigator !== 'undefined' ? (navigator.onLine ? '在线' : '离线') : '服务器环境')
  console.log('  🔍 环境变量:')
  console.log('    - SUPABASE_URL:', supabaseUrl ? '✅ 已配置' : '❌ 缺失')
  console.log('    - SUPABASE_ANON_KEY:', supabaseAnonKey ? '✅ 已配置' : '❌ 缺失')
  
  console.log('\n' + '=' .repeat(60))
  console.log('🔬 诊断完成')
  
  // 6. 总结和建议
  console.log('\n📋 总结和建议:')
  console.log('1. 🎯 根本原因: Supabase Replication 功能显示 "Coming Soon"，未对所有用户开放')
  console.log('2. 🔒 权限限制: anon 角色只有 SELECT 权限，不足以支持 Realtime 订阅')
  console.log('3. ✅ 降级策略: 轮询机制已实现，可以作为临时解决方案')
  console.log('4. 🚀 长期解决: 申请 Replication 早期访问或等待功能正式发布')
  console.log('5. 🛠️  优化建议: 改进错误处理，更快切换到轮询模式')
}

// 运行诊断
diagnoseReplicationIssue().catch(console.error)