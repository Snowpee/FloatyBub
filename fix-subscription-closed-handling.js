#!/usr/bin/env node

/**
 * 修复订阅 CLOSED 状态处理问题
 * 分析：诊断脚本显示订阅能建立（SUBSCRIBED）但随后变为 CLOSED
 * 问题：chat_sessions 订阅缺少 CLOSED 状态的处理逻辑
 */

import fs from 'fs'
import path from 'path'

const useUserDataPath = '/Users/dan/git/--traeTest/floaty-bub/src/hooks/useUserData.ts'

console.log('🔧 开始修复订阅 CLOSED 状态处理问题...')
console.log('=' .repeat(60))

// 读取当前文件内容
const content = fs.readFileSync(useUserDataPath, 'utf8')

// 查找 chat_sessions 订阅的状态处理部分
const chatSessionsSubscribePattern = /(\.subscribe\(\(status, err\) => \{[\s\S]*?\}\))/
const match = content.match(chatSessionsSubscribePattern)

if (!match) {
  console.error('❌ 未找到 chat_sessions 订阅状态处理代码')
  process.exit(1)
}

console.log('✅ 找到 chat_sessions 订阅状态处理代码')
console.log('🔍 当前处理逻辑长度:', match[0].length, '字符')

// 检查是否已经有 CLOSED 状态处理
if (content.includes('status === \'CLOSED\'') && content.includes('chat_sessions')) {
  console.log('✅ chat_sessions 订阅已包含 CLOSED 状态处理')
} else {
  console.log('❌ chat_sessions 订阅缺少 CLOSED 状态处理')
  console.log('🛠️  需要添加 CLOSED 状态处理逻辑')
}

// 分析问题
console.log('\n🔍 问题分析:')
console.log('1. 📊 诊断脚本显示：订阅先 SUBSCRIBED 然后 CLOSED')
console.log('2. 🔍 代码分析：messages 订阅有 CLOSED 处理，chat_sessions 没有')
console.log('3. 🚨 影响：CLOSED 状态未被正确处理，可能导致状态不一致')

console.log('\n💡 解决方案:')
console.log('1. 为 chat_sessions 订阅添加 CLOSED 状态处理')
console.log('2. 统一两个订阅的状态处理逻辑')
console.log('3. 改进 CLOSED 状态的重连策略')

console.log('\n🎯 具体修复内容:')
console.log('- 添加 CLOSED 状态检测和处理')
console.log('- 区分正常关闭和异常关闭')
console.log('- 对异常 CLOSED 状态启用重连机制')
console.log('- 统一状态更新逻辑')

// 生成修复代码片段
const closedHandlingCode = `        } else if (status === 'CLOSED') {
          console.log('🔒 chat_sessions 订阅已关闭')
          setSubscriptionStatus(prev => ({ ...prev, chatSessions: 'CLOSED' }))
          setRealtimeConnected(false)
          
          // 检查是否是异常关闭（订阅刚建立就关闭）
          const now = Date.now()
          const timeSinceLastSuccess = now - (connectionStatsRef.current.lastStabilityCheck || 0)
          
          if (timeSinceLastSuccess < 30000) { // 30秒内关闭认为是异常
            console.warn('⚠️ 检测到异常关闭，可能需要重连')
            
            // 如果还有重试次数，尝试重连
            if (realtimeRetryCount < MAX_REALTIME_RETRIES && user?.id) {
              const retryDelay = calculateRetryDelay()
              console.log(\`⏰ 将在 \${retryDelay}ms 后重试 chat_sessions 订阅（异常关闭恢复）\`)
              
              realtimeRetryTimeoutRef.current = setTimeout(() => {
                console.log('🔄 重试 chat_sessions 订阅（从异常关闭恢复）')
                setRealtimeRetryCount(prev => prev + 1)
                cleanupChatSessionsSubscription()
                setupChatSessionsSubscription()
              }, retryDelay)
            } else {
              console.warn('⚠️ 启用 chatSessions 订阅降级策略（异常关闭后）')
              if (navigator.onLine && user?.id) {
                startFallbackPolling()
              }
            }
          } else {
            console.log('ℹ️ 正常关闭，清理重试定时器')
            if (realtimeRetryTimeoutRef.current) {
              clearTimeout(realtimeRetryTimeoutRef.current)
              realtimeRetryTimeoutRef.current = null
            }
          }`

console.log('\n📝 生成的修复代码:')
console.log(closedHandlingCode)

console.log('\n🔧 修复完成建议:')
console.log('1. 手动将上述代码添加到 chat_sessions 订阅的状态处理中')
console.log('2. 确保 calculateRetryDelay 函数在作用域内可用')
console.log('3. 测试修复后的订阅行为')
console.log('4. 监控 CLOSED 状态的处理效果')

console.log('\n' + '=' .repeat(60))
console.log('🔧 修复分析完成')