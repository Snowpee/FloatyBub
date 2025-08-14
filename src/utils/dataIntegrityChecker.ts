/**
 * 数据完整性检查器
 * 用于验证 Snowflake ID 的一致性和数据完整性
 */

import { ChatSession, ChatMessage } from '../store/index';
import { supabase } from '../lib/supabase';

export interface IntegrityCheckResult {
  isValid: boolean;
  warnings: string[];
  errors: string[];
  inconsistencies: {
    messageId: string;
    sessionId: string;
    localSnowflakeId?: string;
    cloudSnowflakeId?: string;
    issue: string;
  }[];
}

export class DataIntegrityChecker {
  /**
   * 检查本地和云端 Snowflake ID 的一致性
   */
  static async checkSnowflakeIdConsistency(
    localSessions: ChatSession[],
    userId: string
  ): Promise<IntegrityCheckResult> {
    const result: IntegrityCheckResult = {
      isValid: true,
      warnings: [],
      errors: [],
      inconsistencies: []
    };

    try {
      // console.log('🔍 开始检查 Snowflake ID 一致性...');

      // 获取所有本地消息的 ID 列表
      const localMessageIds = localSessions.flatMap(session => 
        session.messages?.map(msg => msg.id) || []
      );

      if (localMessageIds.length === 0) {
        console.log('📝 没有本地消息需要检查');
        return result;
      }

      // 从云端获取对应的消息数据
      const { data: cloudMessages, error } = await supabase
        .from('messages')
        .select('id, snowflake_id::text')
        .in('id', localMessageIds);

      if (error) {
        result.errors.push(`获取云端消息数据失败: ${error.message}`);
        result.isValid = false;
        return result;
      }

      // 创建云端消息映射，确保 Snowflake ID 正确转换为字符串
      const cloudMessageMap = new Map<string, string | null>();
      (cloudMessages || []).forEach(msg => {
        // snowflake_id 现在已经是字符串类型，无需转换
        const snowflakeIdStr = msg.snowflake_id;
        cloudMessageMap.set(msg.id, snowflakeIdStr);
      });

      // 检查每个本地消息的 Snowflake ID 一致性
      for (const session of localSessions) {
        for (const message of session.messages || []) {
          const cloudSnowflakeId = cloudMessageMap.get(message.id);
          
          // 如果云端没有这条消息，跳过检查（可能是新消息）
          if (cloudSnowflakeId === undefined) {
            console.log(`🔍 [调试] 跳过检查，云端没有消息: ${message.id}`);
            continue;
          }

          // 确保本地 Snowflake ID 也转换为字符串进行比较
          const localSnowflakeIdStr = message.snowflake_id?.toString() || null;

          // 检查 Snowflake ID 是否一致（字符串比较）
          if (localSnowflakeIdStr !== cloudSnowflakeId) {
            const inconsistency = {
              messageId: message.id,
              sessionId: session.id,
              localSnowflakeId: localSnowflakeIdStr,
              cloudSnowflakeId: cloudSnowflakeId,
              issue: 'Snowflake ID 不一致'
            };

            result.inconsistencies.push(inconsistency);
            result.warnings.push(
              `消息 ${message.id} 的 Snowflake ID 不一致: 本地=${localSnowflakeIdStr}, 云端=${cloudSnowflakeId}`
            );
          }

          // 检查是否缺少 Snowflake ID
          if (!message.snowflake_id && cloudSnowflakeId) {
            result.warnings.push(
              `消息 ${message.id} 本地缺少 Snowflake ID，云端有: ${cloudSnowflakeId}`
            );
          }

          if (message.snowflake_id && !cloudSnowflakeId) {
            result.warnings.push(
              `消息 ${message.id} 云端缺少 Snowflake ID，本地有: ${message.snowflake_id}`
            );
          }
        }
      }

      // 检查重复的 Snowflake ID
      const duplicateResult = await this.checkDuplicateSnowflakeIds(userId);
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
   * 检查数据库中是否有重复的 Snowflake ID
   */
  static async checkDuplicateSnowflakeIds(userId: string): Promise<{
    hasDuplicates: boolean;
    duplicates: Array<{
      snowflake_id: string;
      count: number;
      message_ids: string[];
    }>;
  }> {
    try {
      // 尝试使用 RPC 函数检查重复的 Snowflake ID
      const { data: rpcData, error: rpcError } = await supabase
        .rpc('check_duplicate_snowflake_ids', { user_id_param: userId });

      if (rpcError) {
        // 检查是否是函数不存在的错误（404）
        if (rpcError.code === 'PGRST202' || rpcError.message?.includes('function') || rpcError.message?.includes('does not exist')) {
          console.warn('RPC 函数 check_duplicate_snowflake_ids 不存在，使用备用方法');
        } else {
          console.warn('RPC 函数调用失败，使用备用方法:', rpcError.message);
        }
        // 如果 RPC 调用失败，回退到手动查询
        return await this.checkDuplicateSnowflakeIdsManual(userId);
      }

      const duplicates = (rpcData || []).map((item: any) => ({
        snowflake_id: item.snowflake_id?.toString() || '',
        count: item.duplicate_count || 0,
        message_ids: item.message_ids || []
      }));

      return {
        hasDuplicates: duplicates.length > 0,
        duplicates
      };
    } catch (error: any) {
      console.error('检查重复 Snowflake ID 时发生错误:', error);
      
      // 检查是否是网络或权限相关的错误
      if (error?.code === 404 || error?.status === 404) {
        console.warn('RPC 函数不存在 (404)，使用备用方法');
      } else if (error?.code === 401 || error?.status === 401) {
        console.error('权限不足，无法执行检查');
        return { hasDuplicates: false, duplicates: [] };
      }
      
      // 发生异常时也回退到手动查询
      try {
        return await this.checkDuplicateSnowflakeIdsManual(userId);
      } catch (fallbackError) {
        console.error('备用方法也失败了:', fallbackError);
        return { hasDuplicates: false, duplicates: [] };
      }
    }
  }

  /**
   * 手动检查重复的 Snowflake ID（备用方法）
   */
  private static async checkDuplicateSnowflakeIdsManual(userId: string): Promise<{
    hasDuplicates: boolean;
    duplicates: Array<{
      snowflake_id: string;
      count: number;
      message_ids: string[];
    }>;
  }> {
    try {
      // 手动查询重复的 Snowflake ID
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
        // 检查是否是表不存在或权限问题
        if (error.code === 'PGRST116' || error.message?.includes('relation') || error.message?.includes('does not exist')) {
          console.error('messages 或 chat_sessions 表不存在或无权限访问:', error.message);
        } else if (error.code === '42501' || error.message?.includes('permission denied')) {
          console.error('权限不足，无法访问 messages 表:', error.message);
        } else {
          console.error('查询消息时发生错误:', error);
        }
        return { hasDuplicates: false, duplicates: [] };
      }

      // 统计重复的 Snowflake ID
      const snowflakeIdMap = new Map<string, string[]>();
      
      (messages || []).forEach((message: any) => {
        const snowflakeId = message.snowflake_id;
        if (snowflakeId) {
          if (!snowflakeIdMap.has(snowflakeId)) {
            snowflakeIdMap.set(snowflakeId, []);
          }
          snowflakeIdMap.get(snowflakeId)!.push(message.id);
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
    } catch (error: any) {
      console.error('手动检查重复 Snowflake ID 时发生错误:', error);
      
      // 提供更详细的错误信息
      if (error?.code === 404 || error?.status === 404) {
        console.error('表或资源不存在 (404)');
      } else if (error?.code === 401 || error?.status === 401) {
        console.error('认证失败 (401)');
      } else if (error?.code === 403 || error?.status === 403) {
        console.error('权限不足 (403)');
      }
      
      return { hasDuplicates: false, duplicates: [] };
    }
  }



  /**
   * 记录数据完整性检查结果
   */
  static logIntegrityCheckResult(result: IntegrityCheckResult): void {
    if (result.isValid) {
      // console.log('✅ 数据完整性检查通过');
    } else {
      console.warn('⚠️ 数据完整性检查发现问题:');
    }

    if (result.warnings.length > 0) {
      console.warn('⚠️ 警告:', result.warnings);
    }

    if (result.errors.length > 0) {
      console.error('❌ 错误:', result.errors);
    }

    if (result.inconsistencies.length > 0) {
      console.warn('🔄 不一致项:', result.inconsistencies);
    }
  }
}