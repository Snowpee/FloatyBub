import { StateCreator } from 'zustand';
import { AppState, ChatSlice, ChatSession, ChatMessage } from '../types';
import { generateId, convertToUUID } from '../utils';
import { generateSnowflakeId } from '@/utils/snowflakeId';
import { supabase } from '@/lib/supabase';

export const createChatSlice: StateCreator<AppState, [], [], ChatSlice> = (set, get) => ({
  // 初始状态
  chatSessions: [],
  currentSessionId: null,
  tempSessionId: null,
  tempSession: null,
  sessionsNeedingTitle: new Set(),

  // 聊天会话相关actions
  createChatSession: (roleId, modelId) => {
    const state = get();
    const sessionId = generateId();
    const role = state.aiRoles.find(r => r.id === roleId);
    
    const newSession: ChatSession = {
      id: sessionId,
      title: `与${role?.name || 'AI'}的对话`,
      roleId,
      modelId,
      messages: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      pendingUpload: true,
      activeSkillIds: [],
      loadedSkillFiles: []
    };
    
    set((state) => ({
      chatSessions: [newSession, ...state.chatSessions],
      currentSessionId: sessionId,
      tempSessionId: null
    }));
    return sessionId;
  },
  
  createTempSession: (roleId, modelId) => {
    const state = get();
    const sessionId = generateId();
    const role = state.aiRoles.find(r => r.id === roleId);
    
    const newSession: ChatSession = {
      id: sessionId,
      title: `与${role?.name || 'AI'}的对话`,
      roleId,
      modelId,
      messages: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      pendingUpload: true,
      activeSkillIds: [],
      loadedSkillFiles: []
    };
    
    console.warn('TEMP_SESSION_CREATED', { sessionId, roleId, modelId, at: new Date().toISOString() });
    // 将临时会话存储在单独的字段中，不添加到chatSessions数组
    set((state) => ({
      currentSessionId: sessionId,
      tempSessionId: sessionId,
      tempSession: newSession
    }));
    return sessionId;
  },
  
  saveTempSession: () => {
    const state = get();
    if (state.tempSession) {
      console.warn('TEMP_SESSION_SAVED', { sessionId: state.tempSession.id, at: new Date().toISOString() });
      // 将临时会话正式添加到chatSessions数组中，并设置为当前会话
      set((state) => ({
        chatSessions: [state.tempSession!, ...state.chatSessions],
        currentSessionId: state.tempSession!.id, // 设置为当前会话
        tempSessionId: null,
        tempSession: null
      }));
    } else {
      // 如果没有临时会话，只清空tempSessionId
      set({ tempSessionId: null });
    }
  },
  
  deleteTempSession: () => {
    const { tempSessionId, currentSessionId } = get();
    if (tempSessionId) {
      console.warn('TEMP_SESSION_DELETED', { sessionId: tempSessionId, currentSessionId, at: new Date().toISOString() });
      set((state) => ({
        chatSessions: state.chatSessions.filter(s => s.id !== tempSessionId),
        // 只有当要删除的临时会话确实是当前会话时，才清空currentSessionId
        currentSessionId: currentSessionId === tempSessionId ? null : currentSessionId,
        tempSessionId: null,
        tempSession: null
      }));
    }
  },
  
  generateSessionTitle: async (sessionId, llmConfig) => {
    console.log('🎯 开始生成会话标题');
    console.log('📋 传入参数:', { sessionId, llmConfig: { ...llmConfig, apiKey: '***' } });
    
    const state = get();
    const session = state.chatSessions.find(s => s.id === sessionId);
    
    console.log('🔍 找到的会话:', session ? { id: session.id, title: session.title, messagesCount: session.messages.length } : '未找到');
    
    if (!session || session.messages.length === 0) {
      console.log('❌ 会话不存在或无消息，跳过标题生成');
      return;
    }
    
    // 获取前几条消息用于生成标题
    const messagesToAnalyze = session.messages
      .filter(m => m.role === 'user' || m.role === 'assistant')
      .slice(0, 4) // 取前4条消息
      .map(m => `${m.role === 'user' ? '用户' : 'AI'}：${m.content}`)
      .join('\n');
    
    console.log('📝 分析的消息内容:', messagesToAnalyze);
    
    if (!messagesToAnalyze.trim()) {
      console.log('❌ 没有可分析的消息内容，跳过标题生成');
      return;
    }
    
    try {
      // 构建生成标题的请求
      const titlePrompt = `请根据以下对话内容，生成一个简短的对话标题（不超过10个字）。只返回标题，不要其他内容：\n\n${messagesToAnalyze}`;
      
      console.log('💬 构建的提示词:', titlePrompt);
      
      let apiUrl = '';
      let headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };
      let body: any = {};
      
      console.log('🔧 模型提供商:', llmConfig.provider);
      
      // 检查是否为thinking模型
      const isThinkingModel = llmConfig.model?.includes('reasoner') || llmConfig.model?.includes('thinking');
      console.log('🧠 是否为thinking模型:', isThinkingModel, '模型名称:', llmConfig.model);
      
      // 根据不同provider构建请求
      // 将provider分为两大类：Claude特殊格式 和 OpenAI兼容格式
      if (llmConfig.provider === 'claude') {
        // Claude使用特殊的API格式
        apiUrl = llmConfig.baseUrl || 'https://api.anthropic.com';
        if (!apiUrl.endsWith('/v1/messages')) {
          apiUrl = apiUrl.replace(/\/$/, '') + '/v1/messages';
        }
        headers['x-api-key'] = llmConfig.apiKey;
        headers['anthropic-version'] = '2023-06-01';
        body = {
          model: llmConfig.model,
          messages: [{ role: 'user', content: titlePrompt }],
          max_tokens: 20,
          temperature: 0.3
        };
      } else {
        // 其他所有provider都使用OpenAI兼容格式
        // 包括：openai, kimi, deepseek, custom, openrouter 等
        apiUrl = llmConfig.baseUrl || 'https://api.openai.com';
        if (!apiUrl.endsWith('/v1/chat/completions')) {
          apiUrl = apiUrl.replace(/\/$/, '') + '/v1/chat/completions';
        }
        headers['Authorization'] = `Bearer ${llmConfig.apiKey}`;
        body = {
          model: llmConfig.model,
          messages: [{ role: 'user', content: titlePrompt }],
          temperature: 0.3,
          max_tokens: 20,
          // 对于thinking模型，使用流式调用以获取完整内容
          stream: isThinkingModel
        };
      }
      
      // 如果配置了代理URL，使用代理
      if (llmConfig.proxyUrl) {
        console.log('🔄 使用代理URL:', llmConfig.proxyUrl);
        apiUrl = llmConfig.proxyUrl;
      }
      
      console.log('🌐 API请求信息:', {
        url: apiUrl,
        headers: { ...headers, Authorization: headers.Authorization ? '***' : undefined, 'x-api-key': headers['x-api-key'] ? '***' : undefined },
        body
      });
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(body)
      });
      
      console.log('📡 API响应状态:', response.status, response.statusText);
      
      if (!response.ok) {
        console.warn('❌ 生成标题失败:', response.status, response.statusText);
        return;
      }
      
      let result: any;
      
      // 处理流式响应（thinking模型）
      if (isThinkingModel && body.stream) {
        console.log('🌊 处理thinking模型的流式响应');
        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        let content = '';
        let reasoning_content = '';
        
        if (reader) {
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              
              const chunk = decoder.decode(value);
              const lines = chunk.split('\n');
              
              for (const line of lines) {
                if (line.startsWith('data: ')) {
                  const data = line.slice(6).trim();
                  if (data === '[DONE]') continue;
                  
                  try {
                    const parsed = JSON.parse(data);
                    const delta = parsed.choices?.[0]?.delta;
                    
                    if (delta?.content) {
                      content += delta.content;
                    }
                    if (delta?.reasoning_content) {
                      reasoning_content += delta.reasoning_content;
                    }
                  } catch (e) {
                    // 忽略解析错误
                  }
                }
              }
            }
          } finally {
            reader.releaseLock();
          }
        }
        
        // 构造类似非流式响应的结果格式
        result = {
          choices: [{
            message: {
              role: 'assistant',
              content: content,
              reasoning_content: reasoning_content
            }
          }]
        };
        
        console.log('🌊 流式响应解析完成:', {
          content: content,
          reasoning_content: reasoning_content.substring(0, 100) + '...'
        });
      } else {
        // 非流式响应
        result = await response.json();
        console.log('📦 API响应数据:', result);
      }
      
      // 添加详细的choices结构调试
      if (result.choices && result.choices[0]) {
        console.log('🔍 choices[0]完整结构:', JSON.stringify(result.choices[0], null, 2));
      }
      
      let generatedTitle = '';
      
      // 解析响应获取标题
      if (llmConfig.provider === 'claude') {
        generatedTitle = result.content?.[0]?.text || '';
      } else {
        // 标准OpenAI格式
        const choice = result.choices?.[0];
        if (choice) {
          // 对于thinking模型，优先使用content字段（实际回复内容）
          // reasoning_content包含思考过程，不适合作为标题
          generatedTitle = choice.message?.content || '';
          
          console.log('🔍 提取到的content内容:', generatedTitle);
          console.log('🧠 reasoning_content内容长度:', choice.message?.reasoning_content?.length || 0);
          
          // 如果是thinking模型且通过流式获取到了content，应该有内容
          if (isThinkingModel && !generatedTitle) {
            console.warn('⚠️ thinking模型的content字段仍为空，可能流式解析有问题');
            // 作为最后的备选，可以尝试从reasoning_content中提取简短的关键词
            // 但这不是理想的解决方案
            const reasoningContent = choice.message?.reasoning_content || '';
            if (reasoningContent) {
              // 尝试提取关键词或短语作为标题
              const keywordMatch = reasoningContent.match(/(?:关于|讨论|询问|请求|问题|话题)[：:]?\s*([^。，！？\n]{2,15})/);
              if (keywordMatch) {
                generatedTitle = keywordMatch[1].trim();
                console.log('📝 从reasoning_content提取关键词作为标题:', generatedTitle);
              }
            }
          }
          
          // 如果仍然没有标题，尝试其他字段（非thinking模型的兼容性处理）
          if (!generatedTitle && choice.message && !isThinkingModel) {
            const messageKeys = Object.keys(choice.message).filter(key => 
              key !== 'reasoning_content' && key !== 'role'
            );
            console.log('🔍 message对象的其他字段:', messageKeys);
            
            for (const key of messageKeys) {
              if (typeof choice.message[key] === 'string' && choice.message[key].trim()) {
                generatedTitle = choice.message[key];
                console.log(`📝 从字段 ${key} 提取到内容:`, generatedTitle);
                break;
              }
            }
          }
        }
      }
      
      console.log('🏷️ 原始生成的标题:', generatedTitle);
      
      // 清理和验证标题
      generatedTitle = generatedTitle.trim().replace(/["']/g, '');
      
      // 智能截取标题，确保长度在20字符以内
      if (generatedTitle.length > 20) {
        console.log('📏 标题过长，开始智能截取');
        
        // 去除常见的冗余描述
        generatedTitle = generatedTitle
          .replace(/^首先，?/, '')
          .replace(/^用户要求我?/, '')
          .replace(/根据对话内容生成一个简短的对话标题[。，]?/, '')
          .replace(/对话内容是[：:]?/, '')
          .replace(/\n+/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
        
        // 如果仍然过长，直接截取前20个字符
        if (generatedTitle.length > 20) {
          generatedTitle = generatedTitle.substring(0, 20);
        }
        
        // 如果截取后为空或太短，使用默认标题
        if (generatedTitle.length < 2) {
          generatedTitle = '新对话';
        }
      }
      
      console.log('✨ 清理后的标题:', generatedTitle);
      
      if (generatedTitle && generatedTitle.length <= 20) {
        console.log('✅ 标题验证通过，开始更新会话');
        // 使用统一更新入口以确保 pendingUpload 标记与 updatedAt
        get().updateChatSession(sessionId, { title: generatedTitle });
        console.log('🎉 会话标题更新成功:', generatedTitle);
      } else {
        console.log('❌ 标题验证失败:', { title: generatedTitle, length: generatedTitle.length });
      }
    } catch (error) {
      console.error('💥 生成标题时出错:', error);
    }
  },
  
  updateChatSession: (id, session) => {
    set((state) => ({
      chatSessions: state.chatSessions.map(s => 
        s.id === id ? { ...s, ...session, updatedAt: new Date(), pendingUpload: true } : s
      )
    }));
  },
  
  deleteChatSession: async (id) => {
    // 先保存原始状态，以便在失败时回滚
    const originalState = get();
    const originalSession = originalState.chatSessions.find(s => s.id === id);
    const originalCurrentSessionId = originalState.currentSessionId;
    
    // 先从本地状态删除
    set((state) => ({
      chatSessions: state.chatSessions.filter(s => s.id !== id),
      currentSessionId: state.currentSessionId === id ? null : state.currentSessionId
    }));
    
    // 检查用户认证状态
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      
      if (authError) {
        console.warn('⚠️ 获取用户认证状态失败:', authError.message);
      }
      
      // 如果用户未登录（访客模式），只执行本地删除，不同步数据库
      if (!user) {
        console.log('👤 访客模式：只执行本地删除，跳过数据库同步');
        return; // 直接返回，不执行数据库操作
      }
      
      // 用户已登录：执行软删除到数据库
      console.log('🔐 用户已登录：执行数据库软删除');

      const now = new Date().toISOString();

      // 软删除会话中的所有消息（将 deleted_at 设置为当前时间）
      const { error: messagesError } = await supabase
        .from('messages')
        .update({ deleted_at: now })
        .eq('session_id', id);

      if (messagesError) {
        throw new Error(`软删除会话消息失败: ${messagesError.message}`);
      }

      // 软删除会话本身
      const { error: sessionError } = await supabase
        .from('chat_sessions')
        .update({ deleted_at: now })
        .eq('id', id);

      if (sessionError) {
        throw new Error(`软删除会话失败: ${sessionError.message}`);
      }

      console.log('✅ 数据库同步软删除成功');
      
    } catch (error) {
      // 回滚本地状态
      if (originalSession) {
        set((state) => ({
          chatSessions: [...state.chatSessions, originalSession],
          currentSessionId: originalCurrentSessionId
        }));
      }
      console.error('删除会话时发生错误:', error);
      throw new Error(`删除会话时发生错误: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  },
  
  hideSession: (id) => {
    set((state) => ({
      chatSessions: state.chatSessions.map(s => 
        s.id === id ? { ...s, isHidden: true, updatedAt: new Date(), pendingUpload: true } : s
      )
    }));
  },
  
  showSession: (id) => {
    set((state) => ({
      chatSessions: state.chatSessions.map(s => 
        s.id === id ? { ...s, isHidden: false, updatedAt: new Date(), pendingUpload: true } : s
      )
    }));
  },
  
  pinSession: (id) => {
    set((state) => ({
      chatSessions: state.chatSessions.map(s => 
        s.id === id ? { ...s, isPinned: true, updatedAt: new Date(), pendingUpload: true } : s
      )
    }));
  },
  
  unpinSession: (id) => {
    set((state) => ({
      chatSessions: state.chatSessions.map(s => 
        s.id === id ? { ...s, isPinned: false, updatedAt: new Date(), pendingUpload: true } : s
      )
    }));
  },
  
  setCurrentSession: (id) => {
    const state = get();
    const newSession = state.chatSessions.find(s => s.id === id);
    
    set({ 
      currentSessionId: id,
      // 只有当会话的modelId确实存在时才更新全局状态
      // 避免因为时序问题导致全局状态被undefined覆盖
      currentModelId: newSession?.modelId ? newSession.modelId : state.currentModelId
    });
  },
  
  migrateIdsToUUID: () => {
    const state = get();
    let hasChanges = false;
    const idMapping = new Map<string, string>();
    
    const updatedSessions = state.chatSessions.map(session => {
      const originalSessionId = session.id;
      const newSessionId = convertToUUID(session.id);
      
      if (originalSessionId !== newSessionId) {
        idMapping.set(originalSessionId, newSessionId);
        hasChanges = true;
        console.log(`🔄 迁移会话 ID: ${originalSessionId} -> ${newSessionId}`);
      }
      
      const updatedMessages = session.messages.map(message => {
        const originalMessageId = message.id;
        const newMessageId = convertToUUID(message.id);
        
        if (originalMessageId !== newMessageId) {
          hasChanges = true;
          console.log(`🔄 迁移消息 ID: ${originalMessageId} -> ${newMessageId}`);
        }
        
        return originalMessageId !== newMessageId 
          ? { ...message, id: newMessageId }
          : message;
      });
      
      return {
        ...session,
        id: newSessionId,
        messages: updatedMessages
      };
    });
    
    if (hasChanges) {
      // 更新当前会话 ID
      let newCurrentSessionId = state.currentSessionId;
      if (state.currentSessionId && idMapping.has(state.currentSessionId)) {
        newCurrentSessionId = idMapping.get(state.currentSessionId)!;
        console.log(`🔄 更新当前会话 ID: ${state.currentSessionId} -> ${newCurrentSessionId}`);
      }
      
      set({
        chatSessions: updatedSessions,
        currentSessionId: newCurrentSessionId
      });
      
      console.log(`✅ ID 迁移完成，共更新 ${updatedSessions.length} 个会话`);
    }
    
    return hasChanges;
  },
  
  addMessage: (sessionId, message, onTempSessionSaved) => {
    const state = get();
    // 首先检查是否是临时会话
    const session = state.tempSession?.id === sessionId ? state.tempSession : state.chatSessions.find(s => s.id === sessionId);
    
    const newMessage: ChatMessage = {
      ...message,
      id: message.id || generateId(),
      timestamp: message.timestamp || new Date(),
      // 设置 message_timestamp，确保只在首次创建时生成
      message_timestamp: message.message_timestamp || (message.timestamp || new Date()).toISOString(),
      roleId: session?.roleId,
      userProfileId: message.role === 'user' ? state.currentUserProfile?.id : undefined,
      // 新增：默认标记为待上传，成功同步后清除
      pendingUpload: message.pendingUpload !== undefined ? message.pendingUpload : true,
      // 初始化版本管理字段
      versions: message.versions || (message.content ? [message.content] : []),
      currentVersionIndex: message.currentVersionIndex !== undefined ? message.currentVersionIndex : 0
    };
    
    // 调试日志：版本字段初始化
    console.log('🔧 消息版本字段初始化:', {
      messageId: newMessage.id,
      role: message.role,
      content: message.content,
      versions: newMessage.versions,
      currentVersionIndex: newMessage.currentVersionIndex
    });
    
    // 🔒 Snowflake ID 保护机制：只有在不存在时才生成新的，已存在的绝不覆盖
    if (message.snowflake_id) {
      newMessage.snowflake_id = message.snowflake_id;
      console.log('🔒 保护已存在的 Snowflake ID:', message.snowflake_id);
    } else {
      newMessage.snowflake_id = generateSnowflakeId();
      console.log('🆕 生成新的 Snowflake ID:', newMessage.snowflake_id);
    }
    
    // 打印消息创建信息
    console.log('📝 消息创建:', { id: newMessage.id, message_timestamp: newMessage.message_timestamp, snowflake_id: newMessage.snowflake_id });
    
    // 如果是临时会话的第一条用户消息，将其转为正式会话
    const { tempSessionId } = get();
    const isFirstUserMessage = tempSessionId === sessionId && message.role === 'user';
    if (isFirstUserMessage) {
      console.warn('TEMP_SESSION_FIRST_USER_MESSAGE', { sessionId, messageId: newMessage.id, at: new Date().toISOString() });
      get().saveTempSession();
      // 调用回调函数，通知ChatPage生成标题
      if (onTempSessionSaved) {
        onTempSessionSaved(sessionId);
      }
    }
    
    // 更新会话状态：区分临时会话和正式会话
    set((state) => {
      if (state.tempSession?.id === sessionId) {
        // 如果是临时会话，更新tempSession
        return {
          tempSession: {
            ...state.tempSession,
            messages: [...state.tempSession.messages, newMessage],
            updatedAt: new Date()
          }
        };
      } else {
        // 如果是正式会话，更新chatSessions
        return {
          chatSessions: state.chatSessions.map(s => 
            s.id === sessionId 
              ? { ...s, messages: [...s.messages, newMessage], updatedAt: new Date() }
              : s
          )
        };
      }
    });
  },
  
  updateMessage: (sessionId, messageId, content, isStreaming) => {
    set((state) => {
      if (state.tempSession?.id === sessionId) {
        // 如果是临时会话，更新tempSession
        return {
          tempSession: {
            ...state.tempSession,
            messages: state.tempSession.messages.map(m => 
              m.id === messageId ? { 
                ...m, 
                content,
                // 当流式输出完成时，更新versions数组
                versions: (() => {
                  if (isStreaming === false && content) {
                    const newVersions = m.versions && m.versions.length > 0 && m.versions[0] !== '' ? 
                      [...m.versions.slice(0, -1), content] : [content];
                    console.log('🔧 流式输出完成，更新versions:', {
                      messageId: m.id,
                      oldVersions: m.versions,
                      newVersions,
                      content
                    });
                    return newVersions;
                  }
                  return m.versions;
                })(),
                isStreaming: isStreaming !== undefined ? isStreaming : m.isStreaming 
              } : m
            ),
            updatedAt: new Date()
          }
        };
      } else {
        // 如果是正式会话，更新chatSessions
        return {
          chatSessions: state.chatSessions.map(s => 
            s.id === sessionId 
              ? {
                  ...s,
                  messages: s.messages.map(m => 
                    m.id === messageId ? { 
                      ...m, 
                      content,
                      // 当流式输出完成时，更新versions数组
                      versions: (() => {
                        if (isStreaming === false && content) {
                          const newVersions = m.versions && m.versions.length > 0 && m.versions[0] !== '' ? 
                            [...m.versions.slice(0, -1), content] : [content];
                          console.log('🔧 流式输出完成，更新versions:', {
                            messageId: m.id,
                            oldVersions: m.versions,
                            newVersions,
                            content
                          });
                          return newVersions;
                        }
                        return m.versions;
                      })(),
                      isStreaming: isStreaming !== undefined ? isStreaming : m.isStreaming 
                    } : m
                  ),
                  updatedAt: new Date()
                }
              : s
          )
        };
      }
    });
  },

  updateMessageWithReasoning: (sessionId, messageId, content, reasoningContent, isStreaming, isReasoningComplete, images) => {
    set((state) => {
      if (state.tempSession?.id === sessionId) {
        // 如果是临时会话，更新tempSession
        return {
          tempSession: {
            ...state.tempSession,
            messages: state.tempSession.messages.map(m => 
              m.id === messageId ? { 
                ...m, 
                ...(content !== undefined && { content }),
                ...(reasoningContent !== undefined && { reasoningContent }),
                ...(isStreaming !== undefined && { isStreaming }),
                ...(isReasoningComplete !== undefined && { isReasoningComplete }),
                ...(images !== undefined && { images }),
                // 当流式输出完成时，更新versions数组
                ...(isStreaming === false && content !== undefined && (() => {
                  const newVersions = m.versions && m.versions.length > 0 && m.versions[0] !== '' ? 
                    [...m.versions.slice(0, -1), content] : [content];
                  console.log('🔧 推理模式流式输出完成，更新versions:', {
                    messageId: m.id,
                    oldVersions: m.versions,
                    newVersions,
                    content
                  });
                  return { versions: newVersions };
                })())
              } : m
            ),
            updatedAt: new Date()
          }
        };
      } else {
        // 如果是正式会话，更新chatSessions
        return {
          chatSessions: state.chatSessions.map(s => 
            s.id === sessionId 
              ? {
                  ...s,
                  messages: s.messages.map(m => 
                    m.id === messageId ? { 
                      ...m, 
                      ...(content !== undefined && { content }),
                      ...(reasoningContent !== undefined && { reasoningContent }),
                      ...(isStreaming !== undefined && { isStreaming }),
                      ...(isReasoningComplete !== undefined && { isReasoningComplete }),
                      ...(images !== undefined && { images }),
                      // 当流式输出完成时，更新versions数组
                      ...(isStreaming === false && content !== undefined && (() => {
                        const newVersions = m.versions && m.versions.length > 0 && m.versions[0] !== '' ? 
                          [...m.versions.slice(0, -1), content] : [content];
                        console.log('🔧 推理模式流式输出完成，更新versions:', {
                          messageId: m.id,
                          oldVersions: m.versions,
                          newVersions,
                          content
                        });
                        return { versions: newVersions };
                      })())
                    } : m
                  ),
                  updatedAt: new Date()
                }
              : s
          )
        };
      }
    });
    
    // 输出简洁的状态变化日志
    if (isReasoningComplete) {
      console.log('✅ 思考过程完成');
    }
    if (!isStreaming) {
      console.log('🏁 内容输出完成');
    }
  },

  regenerateMessage: async (sessionId, messageId) => {
    // 这个函数将在ChatPage中调用，因为需要访问LLM API
    // 这里只是一个占位符，实际实现在ChatPage中
    throw new Error('regenerateMessage should be implemented in ChatPage');
  },

  addMessageVersion: (sessionId, messageId, newContent) => {
    set((state) => ({
      chatSessions: state.chatSessions.map(s => 
        s.id === sessionId 
          ? {
              ...s,
              messages: s.messages.map(m => 
                m.id === messageId ? {
                  ...m,
                  versions: m.versions ? [...m.versions, newContent] : [m.content, newContent],
                  currentVersionIndex: m.versions ? m.versions.length : 1,
                  content: newContent
                } : m
              ),
              updatedAt: new Date()
            }
          : s
      )
    }));
  },

  addMessageVersionWithOriginal: (sessionId, messageId, originalContent, newContent, newImages) => {
    console.log('🔄 开始添加消息版本:', {
      sessionId: sessionId.substring(0, 8) + '...',
      messageId: messageId.substring(0, 8) + '...',
      originalContent: originalContent.substring(0, 50) + '...',
      newContent: newContent.substring(0, 50) + '...',
      hasNewImages: newImages && newImages.length > 0,
      newImagesCount: newImages ? newImages.length : 0
    });
    
    set((state) => {
      const targetSession = state.chatSessions.find(s => s.id === sessionId);
      const targetMessage = targetSession?.messages.find(m => m.id === messageId);
      
      if (!targetMessage) {
        console.error('❌ 未找到目标消息');
        return state;
      }
      
      console.log('📋 当前消息状态:', {
        messageId: targetMessage.id.substring(0, 8) + '...',
        currentVersions: targetMessage.versions,
        currentVersionIndex: targetMessage.currentVersionIndex,
        currentContent: targetMessage.content.substring(0, 50) + '...'
      });
      
      // 确保versions数组存在且包含当前内容
      let newVersions: string[];
      let newVersionIndex: number;
      
      if (!targetMessage.versions || targetMessage.versions.length === 0) {
        // 如果没有versions或为空，创建包含原始内容和新内容的数组
        newVersions = [originalContent, newContent];
        newVersionIndex = 1; // 指向新内容
      } else {
        // 如果已有versions，追加新内容
        newVersions = [...targetMessage.versions, newContent];
        newVersionIndex = newVersions.length - 1; // 指向新添加的版本
      }
      
      console.log('✅ 新版本数据:', {
        newVersions: newVersions.map((v, i) => `[${i}]: ${v.substring(0, 30)}...`),
        newVersionIndex,
        newContent: newContent.substring(0, 50) + '...'
      });
      
      // 延迟验证数据库同步（等待同步完成）
      setTimeout(async () => {
        try {
          console.log('🔍 [重新生成验证] 开始验证消息数据库同步:', {
            messageId: messageId.substring(0, 8) + '...',
            expectedVersionsCount: newVersions.length,
            expectedVersionIndex: newVersionIndex
          });
          
          const { data: dbMessage, error } = await supabase
            .from('messages')
            .select('id, content, versions, current_version_index')
            .eq('id', messageId)
            .single();
          
          if (error) {
            console.error('❌ [重新生成验证] 查询数据库失败:', error);
            return;
          }
          
          if (!dbMessage) {
            console.error('❌ [重新生成验证] 数据库中未找到消息:', messageId);
            return;
          }
          
          console.log('📊 [重新生成验证] 数据库中的消息数据:', {
            messageId: dbMessage.id.substring(0, 8) + '...',
            content: dbMessage.content?.substring(0, 50) + '...',
            versions: dbMessage.versions ? `数组长度: ${dbMessage.versions.length}` : 'NULL',
            versionsPreview: dbMessage.versions?.map((v: string, i: number) => `[${i}]: ${v?.substring(0, 30)}...`) || 'NULL',
            currentVersionIndex: dbMessage.current_version_index
          });
          
          // 验证数据一致性
          const versionsMatch = JSON.stringify(dbMessage.versions) === JSON.stringify(newVersions);
          const indexMatch = dbMessage.current_version_index === newVersionIndex;
          const contentMatch = dbMessage.content === newContent;
          
          if (versionsMatch && indexMatch && contentMatch) {
            console.log('✅ [重新生成验证] 数据库同步验证成功 - 所有字段一致');
          } else {
            console.error('❌ [重新生成验证] 数据库同步验证失败:', {
              versionsMatch,
              indexMatch,
              contentMatch,
              expected: {
                versions: newVersions.map((v, i) => `[${i}]: ${v.substring(0, 30)}...`),
                currentVersionIndex: newVersionIndex,
                content: newContent.substring(0, 50) + '...'
              },
              actual: {
                versions: dbMessage.versions?.map((v: string, i: number) => `[${i}]: ${v?.substring(0, 30)}...`) || 'NULL',
                currentVersionIndex: dbMessage.current_version_index,
                content: dbMessage.content?.substring(0, 50) + '...'
              }
            });
          }
        } catch (error) {
          console.error('❌ [重新生成验证] 验证过程出错:', error);
        }
      }, 3000); // 等待3秒让同步完成
      
      const updatedState = {
        chatSessions: state.chatSessions.map(s => 
          s.id === sessionId 
            ? {
                ...s,
                messages: s.messages.map(m => 
                  m.id === messageId ? {
                    ...m,
                    versions: newVersions,
                    currentVersionIndex: newVersionIndex,
                    content: newContent,
                    images: newImages || m.images, // 更新图片数据
                    isStreaming: false // 完成生成
                  } : m
                ),
                updatedAt: new Date()
              }
            : s
        )
      };
      
      // 验证图片数据是否正确保存
      const updatedMessage = updatedState.chatSessions
        .find(s => s.id === sessionId)?.messages
        .find(m => m.id === messageId);
      
      return updatedState;
    });
  },

  switchMessageVersion: (sessionId, messageId, versionIndex) => {
    set((state) => ({
      chatSessions: state.chatSessions.map(s => 
        s.id === sessionId 
          ? {
              ...s,
              messages: s.messages.map(m => 
                m.id === messageId && m.versions ? {
                  ...m,
                  currentVersionIndex: versionIndex,
                  content: m.versions[versionIndex] || m.content
                } : m
              ),
              updatedAt: new Date()
            }
          : s
      )
    }));
    
    // 触发数据库同步 - 通过更新时间戳触发同步检测
    // 注意：queueDataSync不支持chat_sessions类型，所以通过updatedAt触发同步
  },

  deleteMessage: async (sessionId, messageId) => {
    // 先保存原始状态，以便在失败时回滚
    const originalState = get();
    const originalSession = originalState.chatSessions.find(s => s.id === sessionId);
    
    // 先从本地状态删除
    set((state) => ({
      chatSessions: state.chatSessions.map(s => 
        s.id === sessionId 
          ? {
              ...s,
              messages: s.messages.filter(m => m.id !== messageId),
              updatedAt: new Date()
            }
          : s
      )
    }));
    
    // 检查用户认证状态
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      
      if (authError) {
        console.warn('⚠️ 获取用户认证状态失败:', authError.message);
      }
      
      // 如果用户未登录（访客模式），只执行本地删除，不同步数据库
      if (!user) {
        console.log('👤 访客模式：只执行本地删除消息，跳过数据库同步');
        return; // 直接返回，不执行数据库操作
      }
      
      // 用户已登录：执行软删除到数据库
      console.log('🔐 用户已登录：执行消息数据库软删除');

      const now = new Date().toISOString();
      const { error } = await supabase
        .from('messages')
        .update({ deleted_at: now })
        .eq('id', messageId);
      
      if (error) {
        // 回滚本地状态
        if (originalSession) {
          set((state) => ({
            chatSessions: state.chatSessions.map(s => 
              s.id === sessionId ? originalSession : s
            )
          }));
        }
        console.error('软删除消息失败:', error);
        throw new Error(`软删除消息失败: ${error.message}`);
      }
      
      console.log('✅ 消息数据库同步软删除成功');
      
    } catch (error) {
      // 如果是我们抛出的错误，直接重新抛出
      if (error instanceof Error && error.message.includes('软删除消息失败')) {
        throw error;
      }
      
      // 回滚本地状态
      if (originalSession) {
        set((state) => ({
          chatSessions: state.chatSessions.map(s => 
            s.id === sessionId ? originalSession : s
          )
        }));
      }
      console.error('删除消息时发生错误:', error);
      throw new Error(`删除消息时发生错误: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  },
  
  // 标题生成相关actions
  markSessionNeedsTitle: (sessionId) => {
    set((state) => ({
      sessionsNeedingTitle: new Set([...state.sessionsNeedingTitle, sessionId])
    }));
  },
  
  removeSessionNeedsTitle: (sessionId) => {
    set((state) => {
      const newSet = new Set(state.sessionsNeedingTitle);
      newSet.delete(sessionId);
      return { sessionsNeedingTitle: newSet };
    });
  },
  
  checkSessionNeedsTitle: (sessionId) => {
    return get().sessionsNeedingTitle.has(sessionId);
  }
});
