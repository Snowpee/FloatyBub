import { supabase } from '@/lib/supabase';
import { useAppStore } from '@/store';
import { ensureSnowflakeIdString } from '@/utils/snowflakeId';

/**
 * Snowflake ID 数据修复工具
 * 用于修复因 JSON.stringify 精度丢失导致的本地和数据库 Snowflake ID 不一致问题
 */
export class SnowflakeIdDataRepair {
  /**
   * 从数据库恢复正确的 Snowflake ID 到本地存储
   * @returns 修复结果统计
   */
  static async repairSnowflakeIds(): Promise<{
    totalMessages: number;
    repairedMessages: number;
    errors: string[];
  }> {
    const errors: string[] = [];
    let totalMessages = 0;
    let repairedMessages = 0;

    try {
      console.log('🔧 开始 Snowflake ID 数据修复...');
      
      // 获取当前本地存储的所有消息
      const store = useAppStore.getState();
      const allLocalMessages: Array<{ id: string; sessionId: string; snowflake_id?: string }> = [];
      
      // 收集所有本地消息的 ID 和 snowflake_id
      store.chatSessions.forEach(session => {
        session.messages.forEach(message => {
          allLocalMessages.push({
            id: message.id,
            sessionId: session.id,
            snowflake_id: message.snowflake_id
          });
        });
      });
      
      totalMessages = allLocalMessages.length;
      console.log(`📊 找到 ${totalMessages} 条本地消息`);
      
      if (totalMessages === 0) {
        console.log('✅ 没有消息需要修复');
        return { totalMessages: 0, repairedMessages: 0, errors: [] };
      }
      
      // 从数据库批量查询正确的 Snowflake ID
      const localMessageIds = allLocalMessages.map(msg => msg.id);
      const { data: dbMessages, error } = await supabase
        .from('messages')
        .select('id, snowflake_id::text')
        .in('id', localMessageIds);
      
      if (error) {
        const errorMsg = `数据库查询失败: ${error.message}`;
        console.error('❌', errorMsg);
        errors.push(errorMsg);
        return { totalMessages, repairedMessages: 0, errors };
      }
      
      if (!dbMessages || dbMessages.length === 0) {
        const errorMsg = '数据库中没有找到对应的消息记录';
        console.warn('⚠️', errorMsg);
        errors.push(errorMsg);
        return { totalMessages, repairedMessages: 0, errors };
      }
      
      console.log(`📊 从数据库查询到 ${dbMessages.length} 条消息记录`);
      
      // 创建数据库消息的映射表
      const dbMessageMap = new Map<string, string>();
      dbMessages.forEach(dbMsg => {
        if (dbMsg.snowflake_id) {
          dbMessageMap.set(dbMsg.id, ensureSnowflakeIdString(dbMsg.snowflake_id));
        }
      });
      
      // 检查并修复不一致的 Snowflake ID
      const updatedSessions = [...store.chatSessions];
      let hasChanges = false;
      
      for (let sessionIndex = 0; sessionIndex < updatedSessions.length; sessionIndex++) {
        const session = updatedSessions[sessionIndex];
        const updatedMessages = [...session.messages];
        let sessionHasChanges = false;
        
        for (let messageIndex = 0; messageIndex < updatedMessages.length; messageIndex++) {
          const message = updatedMessages[messageIndex];
          const dbSnowflakeId = dbMessageMap.get(message.id);
          
          if (dbSnowflakeId && message.snowflake_id !== dbSnowflakeId) {
            console.log(`🔧 修复消息 ${message.id}: ${message.snowflake_id} -> ${dbSnowflakeId}`);
            
            // 更新消息的 snowflake_id
            updatedMessages[messageIndex] = {
              ...message,
              snowflake_id: dbSnowflakeId
            };
            
            repairedMessages++;
            sessionHasChanges = true;
            hasChanges = true;
          }
        }
        
        if (sessionHasChanges) {
          updatedSessions[sessionIndex] = {
            ...session,
            messages: updatedMessages
          };
        }
      }
      
      // 如果有修复，更新本地存储
      if (hasChanges) {
        console.log(`💾 更新本地存储，共修复 ${repairedMessages} 条消息`);
        
        // 直接更新 store 状态
        useAppStore.setState({ chatSessions: updatedSessions });
        
        console.log('✅ Snowflake ID 数据修复完成');
      } else {
        console.log('✅ 所有 Snowflake ID 都是一致的，无需修复');
      }
      
    } catch (error) {
      const errorMsg = `数据修复过程中发生错误: ${error instanceof Error ? error.message : String(error)}`;
      console.error('❌', errorMsg);
      errors.push(errorMsg);
    }
    
    return {
      totalMessages,
      repairedMessages,
      errors
    };
  }
  
  /**
   * 验证修复效果
   * @returns 验证结果
   */
  static async validateRepair(): Promise<{
    isValid: boolean;
    inconsistentCount: number;
    details: string[];
  }> {
    try {
      console.log('🔍 验证 Snowflake ID 修复效果...');
      
      const store = useAppStore.getState();
      const allLocalMessages: Array<{ id: string; snowflake_id?: string }> = [];
      
      // 收集所有本地消息
      store.chatSessions.forEach(session => {
        session.messages.forEach(message => {
          allLocalMessages.push({
            id: message.id,
            snowflake_id: message.snowflake_id
          });
        });
      });
      
      if (allLocalMessages.length === 0) {
        return { isValid: true, inconsistentCount: 0, details: ['没有消息需要验证'] };
      }
      
      // 从数据库查询对比
      const localMessageIds = allLocalMessages.map(msg => msg.id);
      const { data: dbMessages, error } = await supabase
        .from('messages')
        .select('id, snowflake_id::text')
        .in('id', localMessageIds);
      
      if (error) {
        return {
          isValid: false,
          inconsistentCount: -1,
          details: [`数据库查询失败: ${error.message}`]
        };
      }
      
      // 创建数据库消息映射
      const dbMessageMap = new Map<string, string>();
      (dbMessages || []).forEach(dbMsg => {
        if (dbMsg.snowflake_id) {
          dbMessageMap.set(dbMsg.id, ensureSnowflakeIdString(dbMsg.snowflake_id));
        }
      });
      
      // 检查不一致的消息
      const inconsistentMessages: string[] = [];
      
      allLocalMessages.forEach(localMsg => {
        const dbSnowflakeId = dbMessageMap.get(localMsg.id);
        if (dbSnowflakeId && localMsg.snowflake_id !== dbSnowflakeId) {
          inconsistentMessages.push(
            `消息 ${localMsg.id}: 本地=${localMsg.snowflake_id}, 数据库=${dbSnowflakeId}`
          );
        }
      });
      
      const isValid = inconsistentMessages.length === 0;
      
      if (isValid) {
        console.log('✅ 验证通过：所有 Snowflake ID 都是一致的');
      } else {
        console.warn(`⚠️ 验证失败：发现 ${inconsistentMessages.length} 条不一致的消息`);
      }
      
      return {
        isValid,
        inconsistentCount: inconsistentMessages.length,
        details: isValid ? ['所有 Snowflake ID 都是一致的'] : inconsistentMessages
      };
      
    } catch (error) {
      return {
        isValid: false,
        inconsistentCount: -1,
        details: [`验证过程中发生错误: ${error instanceof Error ? error.message : String(error)}`]
      };
    }
  }
}

/**
 * 便捷的修复函数，可在浏览器控制台中直接调用
 */
export async function repairSnowflakeIds() {
  const result = await SnowflakeIdDataRepair.repairSnowflakeIds();
  console.log('🔧 修复结果:', result);
  return result;
}

/**
 * 便捷的验证函数，可在浏览器控制台中直接调用
 */
export async function validateSnowflakeIds() {
  const result = await SnowflakeIdDataRepair.validateRepair();
  console.log('🔍 验证结果:', result);
  return result;
}

// 在开发环境中将修复函数暴露到 window 对象
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  (window as any).repairSnowflakeIds = repairSnowflakeIds;
  (window as any).validateSnowflakeIds = validateSnowflakeIds;
  console.log('🔧 开发模式：Snowflake ID 修复工具已暴露到 window 对象');
  console.log('  - 使用 repairSnowflakeIds() 修复数据');
  console.log('  - 使用 validateSnowflakeIds() 验证修复效果');
}