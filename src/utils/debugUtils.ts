import { useAppStore } from '@/store';
import { ChatSession } from '@/store';

const console: Console = { ...globalThis.console, log: (..._args: any[]) => {} };

/**
 * 手动同步函数 - 可在浏览器控制台中调用
 * 使用方式: window.manualSync(forceSync = false)
 * @param forceSync 是否强制同步，绕过流式消息检查
 */
export const manualSync = async (forceSync = false) => {
  console.log('🔄 开始手动同步...');
  console.log('⏰ 同步时间:', new Date().toISOString());
  console.log('🔧 强制同步模式:', forceSync ? '启用' : '禁用');
  
  try {
    // 获取当前状态
    const store = useAppStore.getState();
    const { 
      chatSessions, 
      currentSessionId
    } = store;
    
    // 导入数据同步服务
    const { dataSyncService } = await import('../services/DataSyncService');
    
    // 检查网络状态
    const isOnline = navigator.onLine;
    
    // 检查流式消息状态的函数
    const hasStreamingMessages = () => {
      return chatSessions.some((session: ChatSession) => 
        session.messages.some(msg => msg.isStreaming)
      );
    };
    
    console.log('📊 同步前状态检查:');
    console.log('  - 在线状态:', isOnline);
    console.log('  - 当前会话ID:', currentSessionId);
    console.log('  - 会话总数:', chatSessions.length);
    console.log('  - 数据同步服务状态:', dataSyncService.getStatus());
    console.log('  - 上次同步时间:', dataSyncService.getLastSyncTime() ? new Date(dataSyncService.getLastSyncTime()!).toISOString() : '从未同步');
    
    // 检查流式消息状态
    const streamingStatus = hasStreamingMessages();
    console.log('  - 流式消息状态:', streamingStatus ? '存在流式消息' : '无流式消息');
    
    if (streamingStatus && !forceSync) {
      console.warn('⚠️  检测到流式消息正在进行中，同步被阻止');
      console.warn('💡 如需强制同步，请使用: window.manualSync(true)');
      
      // 详细检查哪些消息正在流式传输
      chatSessions.forEach((session: ChatSession) => {
        const streamingMessages = session.messages.filter(msg => msg.isStreaming);
        if (streamingMessages.length > 0) {
          console.log(`  - 会话 ${session.id} 有 ${streamingMessages.length} 条流式消息:`);
          streamingMessages.forEach(msg => {
            console.log(`    * 消息ID: ${msg.id}, 角色: ${msg.role}, 内容长度: ${msg.content.length}`);
          });
        }
      });
      return;
    }
    
    if (streamingStatus && forceSync) {
      console.warn('🚨 强制同步模式：忽略流式消息检查');
    }
    
    if (!isOnline) {
      console.error('❌ 网络离线，无法进行同步');
      return;
    }
    
    console.log('📤 开始执行聊天数据同步...');
    const syncStartTime = Date.now();
    
    try {
      // 创建一个临时的同步函数来模拟 useUserData 中的同步逻辑
      const performChatSync = async () => {
        const { supabase } = await import('../lib/supabase');
        
        // 获取当前用户
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          throw new Error('用户未登录');
        }
        
        console.log('📤 开始上传本地数据到云端...');
        
        // 准备会话数据
        const sessionsData = chatSessions.map(session => ({
          id: session.id,
          user_id: user.id,
          title: session.title,
          is_hidden: session.isHidden || false,
          is_pinned: session.isPinned || false,
          metadata: {
            roleId: session.roleId,
            modelId: session.modelId,
            createdAt: session.createdAt,
            updatedAt: session.updatedAt
          },
          updated_at: new Date().toISOString()
        }));
        
        // 上传会话数据
        if (sessionsData.length > 0) {
          const { error: sessionError } = await supabase
            .from('chat_sessions')
            .upsert(sessionsData, { onConflict: 'id' });
          
          if (sessionError) {
            throw new Error(`会话同步失败: ${sessionError.message}`);
          }
          console.log(`✅ 已同步 ${sessionsData.length} 个会话`);
        }
        
        // 准备消息数据
        const allMessages = chatSessions.flatMap(session => 
          session.messages.map(message => {
            const messageData = {
              id: message.id,
              session_id: session.id,
              role: message.role,
              content: message.content,
              reasoning_content: message.reasoningContent || '',
              metadata: {
                timestamp: new Date(message.timestamp),
                roleId: message.roleId,
                userProfileId: message.userProfileId
              },
              message_timestamp: message.message_timestamp || new Date(message.timestamp).toISOString(),
              snowflake_id: null as string | null
            };
            
            // 🔒 Snowflake ID 保护机制：只有在不存在时才设置为 null，已存在的绝不覆盖
            if (message.snowflake_id) {
              messageData.snowflake_id = message.snowflake_id;
              console.log(`🔒 [手动同步-Snowflake保护] 保护已存在的 snowflake_id: ${message.snowflake_id} (消息: ${message.id})`);
            } else {
              messageData.snowflake_id = null;
              console.log(`⚠️ [手动同步-Snowflake保护] 消息缺少 snowflake_id，设置为 null: ${message.id}`);
            }
            
            return messageData;
          })
        );
        
        // 上传消息数据 - 使用与 useUserData.ts 相同的 Snowflake ID 冲突检测策略
        if (allMessages.length > 0) {
          console.log(`🔒 [手动同步-Snowflake策略] 开始同步 ${allMessages.length} 条消息`);
          
          // 🔒 Snowflake ID 冲突检测：分离有 snowflake_id 和无 snowflake_id 的消息
          const messagesWithSnowflake = allMessages.filter(msg => msg.snowflake_id)
          const messagesWithoutSnowflake = allMessages.filter(msg => !msg.snowflake_id)
          
          console.log(`🔒 [手动同步-Snowflake分类] 有snowflake_id=${messagesWithSnowflake.length}, 无snowflake_id=${messagesWithoutSnowflake.length}`);
          
          try {
            if (messagesWithSnowflake.length > 0 && messagesWithoutSnowflake.length > 0) {
              // 如果同时有两种类型的消息，分别处理
              console.log(`🔒 [手动同步-Snowflake策略] 分别处理两种类型的消息`);
              
              // 对于有 snowflake_id 的消息，使用更安全的策略
              const withSnowflakeResult = await supabase
                .from('messages')
                .upsert(messagesWithSnowflake, { 
                  onConflict: 'id',
                  ignoreDuplicates: true // 如果存在冲突，忽略重复插入
                });
              
              if (withSnowflakeResult.error) {
                console.error(`❌ [手动同步-Snowflake错误] 有snowflake_id的消息同步失败:`, withSnowflakeResult.error);
                throw new Error(`有snowflake_id的消息同步失败: ${withSnowflakeResult.error.message}`);
              }
              
              const withoutSnowflakeResult = await supabase
                .from('messages')
                .upsert(messagesWithoutSnowflake, { 
                  onConflict: 'id',
                  ignoreDuplicates: false
                });
              
              if (withoutSnowflakeResult.error) {
                console.error(`❌ [手动同步-Snowflake错误] 无snowflake_id的消息同步失败:`, withoutSnowflakeResult.error);
                throw new Error(`无snowflake_id的消息同步失败: ${withoutSnowflakeResult.error.message}`);
              }
              
              console.log(`✅ [手动同步-Snowflake成功] 分别同步完成: 有snowflake_id=${messagesWithSnowflake.length}, 无snowflake_id=${messagesWithoutSnowflake.length}`);
            } else if (messagesWithSnowflake.length > 0) {
              // 只有带 snowflake_id 的消息
              console.log(`🔒 [手动同步-Snowflake策略] 仅处理有snowflake_id的消息: ${messagesWithSnowflake.length}条`);
              const { error: messageError } = await supabase
                .from('messages')
                .upsert(messagesWithSnowflake, { 
                  onConflict: 'id',
                  ignoreDuplicates: true // 对于有 snowflake_id 的消息，忽略重复
                });
              
              if (messageError) {
                throw new Error(`有snowflake_id的消息同步失败: ${messageError.message}`);
              }
            } else {
              // 只有无 snowflake_id 的消息
              console.log(`🔒 [手动同步-Snowflake策略] 仅处理无snowflake_id的消息: ${messagesWithoutSnowflake.length}条`);
              const { error: messageError } = await supabase
                .from('messages')
                .upsert(messagesWithoutSnowflake, { 
                  onConflict: 'id',
                  ignoreDuplicates: false
                });
              
              if (messageError) {
                throw new Error(`无snowflake_id的消息同步失败: ${messageError.message}`);
              }
            }
            
            console.log(`✅ [手动同步-Snowflake完成] 已同步 ${allMessages.length} 条消息`);
          } catch (conflictError) {
            console.error(`❌ [手动同步-Snowflake冲突] 消息同步处理失败:`, conflictError);
            throw conflictError;
          }
        }
        
        console.log('📥 开始从云端拉取最新数据...');
        
        // 从云端获取会话
        const { data: sessions, error: sessionsError } = await supabase
          .from('chat_sessions')
          .select('*')
          .eq('user_id', user.id)
          .order('updated_at', { ascending: false });
        
        if (sessionsError) {
          throw new Error(`获取会话失败: ${sessionsError.message}`);
        }
        
        const cloudSessions: ChatSession[] = [];
        
        for (const session of sessions || []) {
          // 获取会话的消息
          const { data: messages, error: messagesError } = await supabase
            .from('messages')
            .select('*')
            .eq('session_id', session.id)
            .order('message_timestamp', { ascending: true });
          
          if (messagesError) {
            throw new Error(`获取消息失败: ${messagesError.message}`);
          }
          
          const sessionMessages: any[] = (messages || []).map(msg => ({
            id: msg.id,
            role: msg.role,
            content: msg.content,
            reasoningContent: msg.reasoning_content || undefined,
            timestamp: new Date(msg.metadata?.timestamp || msg.message_timestamp),
            roleId: msg.metadata?.roleId,
            userProfileId: msg.metadata?.userProfileId,
            snowflake_id: msg.snowflake_id || null,
            isStreaming: false // 确保从云端获取的消息不是流式状态
          }));
          
          cloudSessions.push({
            id: session.id,
            title: session.title,
            messages: sessionMessages,
            roleId: session.metadata?.roleId || 'default-assistant',
            modelId: session.metadata?.modelId || 'gpt-3.5-turbo',
            isHidden: session.is_hidden || false,
            isPinned: session.is_pinned || false,
            createdAt: new Date(session.metadata?.createdAt || session.created_at),
            updatedAt: new Date(session.metadata?.updatedAt || session.updated_at)
          });
        }
        
        // 更新本地状态
        useAppStore.setState({ chatSessions: cloudSessions });
        console.log(`✅ 已从云端获取 ${cloudSessions.length} 个会话`);
        
        return {
          uploadedSessions: sessionsData.length,
          uploadedMessages: allMessages.length,
          downloadedSessions: cloudSessions.length
        };
      };
      
      const chatSyncResult = await performChatSync();
      
      // 同时执行配置数据同步
      const configSyncResult = await dataSyncService.manualSync();
      
      const syncDuration = Date.now() - syncStartTime;
      console.log(`✅ 聊天数据同步完成，耗时: ${syncDuration}ms`);
      console.log('聊天同步结果:', chatSyncResult);
      console.log('配置同步结果:', configSyncResult);
      
    } catch (syncError) {
      console.error('❌ 同步失败:', syncError);
      console.error('同步错误详情:', {
        message: syncError instanceof Error ? syncError.message : String(syncError),
        stack: syncError instanceof Error ? syncError.stack : undefined
      });
    }
    
    // 获取同步后的状态
    const newStore = useAppStore.getState();
    console.log('📊 同步后状态:');
    console.log('  - 会话总数:', newStore.chatSessions.length);
    console.log('  - 当前会话ID:', newStore.currentSessionId);
    console.log('  - 数据同步服务状态:', dataSyncService.getStatus());
    console.log('  - 新的同步时间:', dataSyncService.getLastSyncTime() ? new Date(dataSyncService.getLastSyncTime()!).toISOString() : '未更新');
    
    // 比较同步前后的变化
    const sessionCountChange = newStore.chatSessions.length - chatSessions.length;
    if (sessionCountChange !== 0) {
      console.log(`📈 会话数量变化: ${sessionCountChange > 0 ? '+' : ''}${sessionCountChange}`);
    }
    
    // 检查消息数量变化
    let totalMessagesBefore = 0;
    let totalMessagesAfter = 0;
    
    chatSessions.forEach((session: ChatSession) => {
      totalMessagesBefore += session.messages.length;
    });
    
    newStore.chatSessions.forEach((session: ChatSession) => {
      totalMessagesAfter += session.messages.length;
    });
    
    const messageCountChange = totalMessagesAfter - totalMessagesBefore;
    if (messageCountChange !== 0) {
      console.log(`💬 消息数量变化: ${messageCountChange > 0 ? '+' : ''}${messageCountChange}`);
    }
    
    // 检查流式消息状态是否已清理
    const finalStreamingStatus = hasStreamingMessages();
    console.log('  - 同步后流式消息状态:', finalStreamingStatus ? '仍存在流式消息' : '无流式消息');
    
    console.log('🎉 手动同步完成!');
    
  } catch (error) {
    console.error('💥 手动同步过程中发生错误:', error);
    console.error('错误详情:', {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString()
    });
  }
};

/**
 * 检查同步状态的辅助函数
 */
export const checkSyncStatus = async () => {
  const store = useAppStore.getState();
  const { chatSessions, currentSessionId } = store;
  
  // 导入数据同步服务
  const { dataSyncService } = await import('../services/DataSyncService');
  
  // 检查网络状态
  const isOnline = navigator.onLine;
  
  // 检查流式消息状态的函数
  const hasStreamingMessages = () => {
    return chatSessions.some((session: ChatSession) => 
      session.messages.some(msg => msg.isStreaming)
    );
  };
  
  console.log('🔍 当前同步状态检查:');
  console.log('  - 在线状态:', isOnline);
  console.log('  - 数据同步服务状态:', dataSyncService.getStatus());
  console.log('  - 上次同步:', dataSyncService.getLastSyncTime() ? new Date(dataSyncService.getLastSyncTime()!).toISOString() : '从未同步');
  console.log('  - 会话总数:', chatSessions.length);
  console.log('  - 当前会话:', currentSessionId);
  console.log('  - 流式消息:', hasStreamingMessages() ? '存在' : '无');
  
  const lastSyncTime = dataSyncService.getLastSyncTime();
  if (lastSyncTime) {
    const timeSinceSync = Date.now() - lastSyncTime;
    const minutesSinceSync = Math.floor(timeSinceSync / (1000 * 60));
    console.log(`  - 距离上次同步: ${minutesSinceSync} 分钟`);
  }
};

/**
 * 测试 WASM 分词功能
 */
export const testWasmSegment = async (text: string) => {
  console.log('🧪 [测试] 开始 WASM 分词测试');
  console.log('📝 [测试] 输入文本长度:', text.length);
  console.log('📝 [测试] 输入文本末尾:', text.slice(-50));
  
  try {
    // 直接调用全局测试函数
    if (typeof (window as any).testWasmSegment === 'function') {
      const startTime = performance.now();
      const result = await (window as any).testWasmSegment(text);
      const endTime = performance.now();
      
      console.log('⏱️ [测试] 分词耗时:', (endTime - startTime).toFixed(2) + 'ms');
      console.log('🔢 [测试] 分词结果数量:', result.length);
      console.log('📋 [测试] 分词结果:', result);
      console.log('🔍 [测试] 最后10个词:', result.slice(-10));
      
      // 检查关键词
      const hasOldHome = result.some(word => word.includes('老家'));
      const hasWhere = result.some(word => word.includes('哪里'));
      const hasIgnore = result.some(word => word.includes('忽略'));
      
      console.log('🔍 [测试] 关键词检查:');
      console.log('  - 包含"老家":', hasOldHome ? '✅' : '❌');
      console.log('  - 包含"哪里":', hasWhere ? '✅' : '❌');
      console.log('  - 包含"忽略":', hasIgnore ? '✅' : '❌');
      
      return result;
    } else {
      console.warn('⚠️ [测试] 全局 testWasmSegment 函数不可用');
      return [];
    }
  } catch (error) {
    console.error('❌ [测试] WASM 分词测试失败:', error);
    throw error;
  }
};

/**
 * 测试优化分词功能（滑动窗口）
 */
export const testOptimizedSegment = async (text: string) => {
  console.log('🧪 [测试] 开始优化分词测试');
  
  try {
    // 直接调用全局测试函数
    if (typeof (window as any).testOptimizedSegment === 'function') {
      const startTime = performance.now();
      const result = await (window as any).testOptimizedSegment(text);
      const endTime = performance.now();
      
      console.log('⏱️ [测试] 优化分词耗时:', (endTime - startTime).toFixed(2) + 'ms');
      console.log('🔢 [测试] 分词结果数量:', result.length);
      console.log('📋 [测试] 分词结果:', result);
      
      return result;
    } else {
      console.warn('⚠️ [测试] 全局 testOptimizedSegment 函数不可用');
      return [];
    }
  } catch (error) {
    console.error('❌ [测试] 优化分词测试失败:', error);
    throw error;
  }
};

/**
 * 获取 WASM 状态
 */
export const getWasmStatus = async () => {
  try {
    // 直接调用全局状态函数
    if (typeof (window as any).getWasmStatus === 'function') {
      return await (window as any).getWasmStatus();
    } else {
      // 备用状态检查
      const status = {
        wasmLoaded: (window as any).wasmJieba ? true : false,
        wasmJiebaAvailable: typeof (window as any).wasmJieba?.cut === 'function',
        timestamp: new Date().toISOString()
      };
      
      console.log('📊 [状态] WASM 状态:', status);
      return status;
    }
  } catch (error) {
    console.error('❌ [状态] 获取 WASM 状态失败:', error);
    return { error: error.message };
  }
};

/**
 * 重新加载 WASM 模块
 */
export const reloadWasm = async () => {
  console.log('🔄 [重载] 开始重新加载 WASM 模块');
  
  try {
    // 直接调用全局重载函数
    if (typeof (window as any).reloadWasm === 'function') {
      return await (window as any).reloadWasm();
    } else {
      console.warn('⚠️ [重载] 全局重载函数不可用，尝试手动重载');
      
      // 清除现有的 WASM 模块
      delete (window as any).wasmJieba;
      
      const { ChatEnhancementService } = await import('../services/chatEnhancementService');
      
      // 重新初始化（如果方法存在）
      if (typeof ChatEnhancementService.reloadWasmJieba === 'function') {
        await ChatEnhancementService.reloadWasmJieba();
      } else {
        console.warn('⚠️ [重载] ChatEnhancementService.reloadWasmJieba 方法不存在');
      }
      
      console.log('✅ [重载] WASM 模块重新加载完成');
      return await getWasmStatus();
    }
  } catch (error) {
    console.error('❌ [重载] WASM 模块重新加载失败:', error);
    throw error;
  }
};

// 将函数挂载到 window 对象（在 main.tsx 中调用）
export const attachDebugFunctions = () => {
  if (typeof window !== 'undefined') {
    (window as any).manualSync = manualSync;
    (window as any).checkSyncStatus = checkSyncStatus;
    (window as any).testWasmSegment = testWasmSegment;
    (window as any).testOptimizedSegment = testOptimizedSegment;
    (window as any).getWasmStatus = getWasmStatus;
    (window as any).reloadWasm = reloadWasm;
    
    console.log('🛠️  调试函数已挂载到 window 对象:');
    console.log('  - window.manualSync() - 手动触发同步');
    console.log('  - window.checkSyncStatus() - 检查同步状态');
    console.log('  - window.testWasmSegment(text) - 测试 WASM 分词');
    console.log('  - window.testOptimizedSegment(text) - 测试优化分词');
    console.log('  - window.getWasmStatus() - 获取 WASM 状态');
    console.log('  - window.reloadWasm() - 重新加载 WASM 模块');
  }
};