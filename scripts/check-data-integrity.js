#!/usr/bin/env node

/**
 * 独立的数据完整性检查脚本
 * 用于在 Node.js 环境中检查 Snowflake ID 的一致性
 */

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// 获取当前文件的目录
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

// 加载环境变量
config({ path: path.join(projectRoot, '.env') });

// 验证必要的环境变量
if (!process.env.VITE_SUPABASE_URL || !process.env.VITE_SUPABASE_ANON_KEY) {
  console.error('❌ 缺少必要的环境变量:');
  console.error('   VITE_SUPABASE_URL:', process.env.VITE_SUPABASE_URL ? '✓' : '✗');
  console.error('   VITE_SUPABASE_ANON_KEY:', process.env.VITE_SUPABASE_ANON_KEY ? '✓' : '✗');
  process.exit(1);
}

// 初始化 Supabase 客户端
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

/**
 * 数据完整性检查结果结构
 * @typedef {Object} IntegrityCheckResult
 * @property {boolean} isValid
 * @property {string[]} warnings
 * @property {string[]} errors
 * @property {Array<{messageId: string, sessionId: string, localSnowflakeId?: string, cloudSnowflakeId?: string, issue: string}>} inconsistencies
 */

/**
 * 检查重复的 Snowflake ID
 */
async function checkDuplicateSnowflakeIds(userId) {
  try {
    console.log('🔍 检查重复的 Snowflake ID...');
    
    // 尝试使用 RPC 函数检查重复的 Snowflake ID
    const { data: rpcData, error: rpcError } = await supabase
      .rpc('check_duplicate_snowflake_ids', { user_id_param: userId });

    if (rpcError) {
      console.warn('RPC 函数调用失败，使用备用方法:', rpcError.message);
      return await checkDuplicateSnowflakeIdsManual(userId);
    }

    const duplicates = (rpcData || []).map((item) => ({
      snowflake_id: item.snowflake_id?.toString() || '',
      count: item.duplicate_count || 0,
      message_ids: item.message_ids || []
    }));

    return {
      hasDuplicates: duplicates.length > 0,
      duplicates
    };
  } catch (error) {
    console.warn('检查重复 Snowflake ID 时发生错误，使用备用方法:', error.message);
    return await checkDuplicateSnowflakeIdsManual(userId);
  }
}

/**
 * 手动检查重复的 Snowflake ID（备用方法）
 */
async function checkDuplicateSnowflakeIdsManual(userId) {
  try {
    console.log('🔍 使用手动方法检查重复的 Snowflake ID...');
    
    const { data: messages, error } = await supabase
      .from('messages')
      .select(`
        id,
        snowflake_id::text,
        session_id,
        chat_sessions!inner(user_id)
      `)
      .eq('chat_sessions.user_id', userId)
      .not('snowflake_id', 'is', null);

    if (error) {
      console.error('查询消息时发生错误:', error);
      return { hasDuplicates: false, duplicates: [] };
    }

    // 统计重复的 Snowflake ID
    const snowflakeIdMap = new Map();
    
    (messages || []).forEach((message) => {
      const snowflakeId = message.snowflake_id;
      if (snowflakeId) {
        if (!snowflakeIdMap.has(snowflakeId)) {
          snowflakeIdMap.set(snowflakeId, []);
        }
        snowflakeIdMap.get(snowflakeId).push(message.id);
      }
    });

    // 找出重复的 ID
    const duplicates = Array.from(snowflakeIdMap.entries())
      .filter(([_, messageIds]) => messageIds.length > 1)
      .map(([snowflakeId, messageIds]) => ({
        snowflake_id: snowflakeId,
        count: messageIds.length,
        message_ids: messageIds
      }));

    console.log(`手动检查完成: 找到 ${duplicates.length} 个重复的 Snowflake ID`);
    
    return {
      hasDuplicates: duplicates.length > 0,
      duplicates
    };
  } catch (error) {
    console.error('手动检查重复 Snowflake ID 时发生错误:', error);
    return { hasDuplicates: false, duplicates: [] };
  }
}

/**
 * 检查 Snowflake ID 一致性
 */
async function checkSnowflakeIdConsistency(userId) {
  const result = {
    isValid: true,
    warnings: [],
    errors: [],
    inconsistencies: []
  };

  try {
    console.log('🔍 开始检查 Snowflake ID 一致性...');

    // 获取用户的所有会话
    const { data: sessions, error: sessionsError } = await supabase
      .from('chat_sessions')
      .select('id')
      .eq('user_id', userId);

    if (sessionsError) {
      result.errors.push(`获取用户会话失败: ${sessionsError.message}`);
      result.isValid = false;
      return result;
    }

    if (!sessions || sessions.length === 0) {
      console.log('📝 用户没有会话数据');
      return result;
    }

    const sessionIds = sessions.map(s => s.id);

    // 获取所有消息
    const { data: messages, error: messagesError } = await supabase
      .from('messages')
      .select('id, snowflake_id::text, session_id')
      .in('session_id', sessionIds);

    if (messagesError) {
      result.errors.push(`获取消息数据失败: ${messagesError.message}`);
      result.isValid = false;
      return result;
    }

    if (!messages || messages.length === 0) {
      console.log('📝 没有消息需要检查');
      return result;
    }

    console.log(`📊 找到 ${messages.length} 条消息`);

    // 检查缺少 Snowflake ID 的消息
    const messagesWithoutSnowflakeId = messages.filter(msg => !msg.snowflake_id);
    if (messagesWithoutSnowflakeId.length > 0) {
      result.warnings.push(`发现 ${messagesWithoutSnowflakeId.length} 条消息缺少 Snowflake ID`);
      messagesWithoutSnowflakeId.forEach(msg => {
        result.inconsistencies.push({
          messageId: msg.id,
          sessionId: msg.session_id,
          cloudSnowflakeId: null,
          issue: '缺少 Snowflake ID'
        });
      });
    }

    // 检查重复的 Snowflake ID
    const duplicateResult = await checkDuplicateSnowflakeIds(userId);
    if (duplicateResult.hasDuplicates) {
      duplicateResult.duplicates.forEach(duplicate => {
        result.errors.push(`发现重复的 Snowflake ID: ${duplicate.snowflake_id} (出现 ${duplicate.count} 次)`);
      });
    }

    // 如果有不一致或错误，标记为无效
    if (result.inconsistencies.length > 0 || result.errors.length > 0) {
      result.isValid = false;
    }

    return result;

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '未知错误';
    result.errors.push(`数据完整性检查失败: ${errorMessage}`);
    result.isValid = false;
    return result;
  }
}

/**
 * 记录检查结果
 */
function logIntegrityCheckResult(result) {
  console.log('\n' + '='.repeat(50));
  console.log('📋 数据完整性检查结果');
  console.log('='.repeat(50));

  if (result.isValid) {
    console.log('✅ 数据完整性检查通过');
  } else {
    console.log('⚠️ 数据完整性检查发现问题');
  }

  if (result.warnings.length > 0) {
    console.log('\n⚠️ 警告:');
    result.warnings.forEach((warning, index) => {
      console.log(`   ${index + 1}. ${warning}`);
    });
  }

  if (result.errors.length > 0) {
    console.log('\n❌ 错误:');
    result.errors.forEach((error, index) => {
      console.log(`   ${index + 1}. ${error}`);
    });
  }

  if (result.inconsistencies.length > 0) {
    console.log('\n🔄 不一致项:');
    result.inconsistencies.forEach((inconsistency, index) => {
      console.log(`   ${index + 1}. 消息 ${inconsistency.messageId}: ${inconsistency.issue}`);
      if (inconsistency.localSnowflakeId) {
        console.log(`      本地: ${inconsistency.localSnowflakeId}`);
      }
      if (inconsistency.cloudSnowflakeId) {
        console.log(`      云端: ${inconsistency.cloudSnowflakeId}`);
      }
    });
  }

  console.log('\n' + '='.repeat(50));
}

/**
 * 获取用户 ID 的辅助函数
 */
async function getUserId() {
  // 首先尝试从命令行参数获取用户 ID
  const userIdFromArgs = process.argv[2];
  if (userIdFromArgs) {
    console.log('🔄 使用命令行提供的用户 ID:', userIdFromArgs);
    return userIdFromArgs;
  }
  
  // 尝试从认证状态获取用户 ID
  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (!authError && user) {
      console.log('✅ 用户已认证:', user.email);
      console.log('🆔 用户 ID:', user.id);
      return user.id;
    }
  } catch (error) {
    console.log('⚠️ 无法从认证状态获取用户信息:', error.message);
  }
  
  // 如果都失败了，提示用户
  console.error('❌ 无法获取用户 ID');
  console.log('\n💡 使用方法:');
  console.log('   node scripts/check-data-integrity.js [用户ID]');
  console.log('   或者在浏览器中登录应用后再运行此脚本');
  console.log('\n🔍 如何获取用户 ID:');
  console.log('   1. 在浏览器中打开开发者工具');
  console.log('   2. 在控制台中运行: localStorage.getItem("sb-dbqghnpqqncfydrnqpod-auth-token")');
  console.log('   3. 从返回的 JSON 中找到 user.id 字段');
  return null;
}

/**
 * 主函数
 */
async function main() {
  try {
    console.log('🚀 启动数据完整性检查脚本');
    console.log('📁 项目根目录:', projectRoot);
    console.log('🔗 Supabase URL:', process.env.VITE_SUPABASE_URL);
    
    const userId = await getUserId();
    if (!userId) {
      process.exit(1);
    }
    
    await runCheck(userId);
  } catch (error) {
    console.error('❌ 脚本执行失败:', error.message);
    process.exit(1);
  }
}

/**
 * 运行检查
 */
async function runCheck(userId) {
  try {
    const result = await checkSnowflakeIdConsistency(userId);
    logIntegrityCheckResult(result);
    
    if (!result.isValid) {
      console.log('\n💡 建议:');
      console.log('   1. 运行数据修复脚本恢复正确的 Snowflake ID');
      console.log('   2. 检查应用的序列化配置是否正确');
      console.log('   3. 确保所有新消息都正确生成了 Snowflake ID');
      process.exit(1);
    } else {
      console.log('\n🎉 所有检查都通过了！');
    }
  } catch (error) {
    console.error('❌ 检查过程中发生错误:', error);
    process.exit(1);
  }
}

// 运行主函数
main();