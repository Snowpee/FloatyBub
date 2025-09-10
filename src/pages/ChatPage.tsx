import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAppStore, generateId } from '../store';
import {
  Send,
  Bot,
  User,
  Loader2,
  Square,
  Cpu,
  Plus,
  RefreshCw,
  Edit3,
  Trash2,
  Volume2,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { cn } from '../lib/utils';
import { toast } from '../hooks/useToast';
import RoleSelector from '../components/RoleSelector';
import MarkdownRenderer from '../components/MarkdownRenderer';
import ThinkingProcess from '../components/ThinkingProcess';
import Avatar from '../components/Avatar';
import Popconfirm from '../components/Popconfirm';
import AudioWaveform from '../components/AudioWaveform';
import { replaceTemplateVariables } from '../utils/templateUtils';
import { useAnimatedText } from '../components/AnimatedText';
import { getDefaultBaseUrl } from '../utils/providerUtils';
import { playVoice, stopCurrentVoice, addVoiceStateListener, getVoiceState } from '../utils/voiceUtils';
import { supabase } from '../lib/supabase';
import { useUserData } from '../hooks/useUserData';
import { useAuth } from '../hooks/useAuth';
import { ChatEnhancementService } from '../services/chatEnhancementService';
import { useKnowledgeStore } from '../stores/knowledgeStore';

const ChatPage: React.FC = () => {
  const { sessionId } = useParams();
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState('');
  const [visibleActionButtons, setVisibleActionButtons] = useState<string | null>(null);
  const [voicePlayingState, setVoicePlayingState] = useState(getVoiceState());
  const [isUserScrolling, setIsUserScrolling] = useState(false);
  const [chatStyle, setChatStyle] = useState<'conversation' | 'document'>('conversation');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // 获取数据同步功能
  const { syncToCloud } = useUserData();
  
  // 获取用户认证信息
  const { user } = useAuth();
  
  // 获取知识库store
  const { getRoleKnowledgeBase } = useKnowledgeStore();

  // 初始化聊天样式
  useEffect(() => {
    const savedStyle = localStorage.getItem('chatStyle') as 'conversation' | 'document' | null;
    if (savedStyle) {
      setChatStyle(savedStyle);
    }
  }, []);

  // 监听聊天样式变更事件
  useEffect(() => {
    const handleChatStyleChange = (event: CustomEvent<{ style: 'conversation' | 'document' }>) => {
      setChatStyle(event.detail.style);
    };

    window.addEventListener('chatStyleChanged', handleChatStyleChange as EventListener);
    return () => {
      window.removeEventListener('chatStyleChanged', handleChatStyleChange as EventListener);
    };
  }, []);

  const {
    currentSessionId,
    chatSessions,
    aiRoles,
    userRoles,
    llmConfigs,
    currentModelId,
    tempSessionId,
    tempSession,
    globalPrompts,
    currentUserProfile,
    voiceSettings,
    setCurrentSession,
    createChatSession,
    createTempSession,
    deleteTempSession,
    addMessage,
    updateMessage,
    updateMessageWithReasoning,
    addMessageVersion,
    addMessageVersionWithOriginal,
    switchMessageVersion,
    deleteMessage,
    setCurrentModel,
    generateSessionTitle,
    markSessionNeedsTitle,
    checkSessionNeedsTitle,
    removeSessionNeedsTitle
  } = useAppStore();

  // 获取启用的模型
  const enabledModels = llmConfigs.filter(m => m.enabled);

  // 获取当前会话：优先从tempSession获取临时会话数据
  const currentSession = useMemo(() => {
    // 如果当前sessionId匹配tempSessionId，且tempSession存在，则使用tempSession
    if (sessionId === tempSessionId && tempSession) {
      return tempSession;
    }
    // 否则从chatSessions数组中查找
    return chatSessions.find(s => s.id === sessionId);
  }, [sessionId, tempSessionId, tempSession, chatSessions]);
  

  // 临时会话和正式会话使用相同的角色获取逻辑
  const isTemporarySession = tempSessionId === currentSession?.id;
  
  // 使用 useMemo 优化角色获取逻辑，避免频繁重新计算
  const currentRole = useMemo(() => {
    let role = null;
    
    // 优先使用当前会话的roleId
    if (currentSession?.roleId) {
      role = aiRoles.find(r => r.id === currentSession.roleId);
    }
    
    // 如果会话角色不存在，回退到第一个可用角色
    if (!role && aiRoles.length > 0) {
      role = aiRoles[0];
    }
    
    return role;
  }, [currentSession?.id, currentSession?.roleId, aiRoles, tempSessionId]);
  const currentModel = currentSession ? llmConfigs.find(m => m.id === currentSession.modelId) : llmConfigs.find(m => m.id === currentModelId);

  // 如果有sessionId参数，设置为当前会话
  useEffect(() => {
    if (sessionId && sessionId !== currentSessionId) {
      setCurrentSession(sessionId);
    }
  }, [sessionId, currentSessionId, setCurrentSession]);
  
  // 组件卸载时清理未使用的临时会话
  useEffect(() => {
    return () => {
      // 组件卸载时检查是否需要清理临时会话
      // 使用 setTimeout 确保在下一个事件循环中执行，避免状态不一致
      setTimeout(() => {
        const currentState = useAppStore.getState();
        const { tempSessionId: currentTempSessionId, chatSessions, currentSessionId: currentActiveSessionId } = currentState;
        
        // 只有在以下条件全部满足时才清理临时会话：
        // 1. 存在临时会话ID
        // 2. 临时会话确实存在于会话列表中
        // 3. 临时会话没有任何用户消息（只有AI开场白或完全为空）
        // 4. 临时会话不是当前活跃的会话（用户已经离开了这个会话）
        if (currentTempSessionId) {
          const tempSession = chatSessions.find(s => s.id === currentTempSessionId);
          
          if (tempSession && 
              !tempSession.messages.some(m => m.role === 'user') &&
              currentActiveSessionId !== currentTempSessionId) {
            console.log('🧹 清理未使用的临时会话:', currentTempSessionId);
            useAppStore.getState().deleteTempSession();
          }
        }
      }, 100);
    };
  }, []); // 空依赖数组，只在组件卸载时执行

  // 调试功能：输出消息数据结构
  const debugMessageData = useCallback(async () => {
    if (!currentSession?.messages || currentSession.messages.length === 0) {
      return;
    }

    try {
      // 获取所有消息ID
      const messageIds = currentSession.messages.map(msg => msg.id);
      
      // 查询数据库中的消息数据
      const { data: dbMessages, error } = await supabase
        .from('messages')
        .select('id, content, snowflake_id::text, message_timestamp, created_at')
        .in('id', messageIds);

      if (error) {
        console.error('❌ [调试] 查询数据库消息失败:', error);
        return;
      }

      // 构建调试数据结构
      const debugData = currentSession.messages.map(localMsg => {
        const dbMsg = dbMessages?.find(db => db.id === localMsg.id);
        return {
          messageId: localMsg.id,
          content: localMsg.content.substring(0, 100) + (localMsg.content.length > 100 ? '...' : ''),
          role: localMsg.role,
          timestamp: localMsg.timestamp,
          message_timestamp: localMsg.message_timestamp,
          snowflakeId: {
            local: localMsg.snowflake_id || null,
            database: dbMsg?.snowflake_id || null,
            consistent: localMsg.snowflake_id === dbMsg?.snowflake_id
          },
          database: {
            exists: !!dbMsg,
            message_timestamp: dbMsg?.message_timestamp || null,
            created_at: dbMsg?.created_at || null
          }
        };
      });

      console.log('【流式图片问题调试】🔍 [调试] 会话消息数据结构:', {
        sessionId: currentSession.id,
        sessionTitle: currentSession.title,
        messageCount: currentSession.messages.length,
        databaseMessageCount: dbMessages?.length || 0,
        messages: debugData
      });

    } catch (error) {
      console.error('❌ [调试] 调试功能执行失败:', error);
    }
  }, [currentSession]);

  // 在会话加载完成后触发调试输出
  useEffect(() => {
    if (currentSession?.messages && currentSession.messages.length > 0) {
      // 延迟执行，确保会话完全加载
      const timer = setTimeout(() => {
        debugMessageData();
      }, 1000);
      
      return () => clearTimeout(timer);
    }
  }, [currentSession?.id, debugMessageData]);

  // 用户滚动检测
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      // 检测用户是否主动滚动（不在底部）
      const { scrollTop, scrollHeight, clientHeight } = container;
      const isAtBottom = scrollHeight - scrollTop - clientHeight < 10; // 10px容差
      
      if (!isAtBottom) {
        setIsUserScrolling(true);
      } else {
        // 如果用户滚动到底部，重置状态
        setIsUserScrolling(false);
      }

      // 清除之前的定时器
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }

      // 设置定时器，如果用户停止滚动一段时间后重置状态
      scrollTimeoutRef.current = setTimeout(() => {
        const { scrollTop, scrollHeight, clientHeight } = container;
        const isAtBottom = scrollHeight - scrollTop - clientHeight < 10;
        if (isAtBottom) {
          setIsUserScrolling(false);
        }
      }, 1000); // 1秒后检查
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    
    return () => {
      container.removeEventListener('scroll', handleScroll);
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);

  // 优化的自动滚动到底部
  useEffect(() => {
    // 只有在用户没有主动滚动时才自动滚动
    if (!isUserScrolling) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [currentSession?.messages, isUserScrolling]);

  // 点击外部区域关闭按钮组
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      // 如果点击的不是消息气泡或按钮组，则关闭按钮组
      if (!target.closest('.chat-bubble') && !target.closest('.absolute.flex.gap-1')) {
        setVisibleActionButtons(null);
      }
    };

    if (visibleActionButtons) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [visibleActionButtons]);

  // 自动调整文本框高度
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [message]);

  // 监听语音播放状态
  useEffect(() => {
    const unsubscribe = addVoiceStateListener(setVoicePlayingState);
    return unsubscribe;
  }, []);

  // 页面卸载时停止语音播放
  useEffect(() => {
    return () => {
      stopCurrentVoice();
    };
  }, []);



  // 创建新会话
  const navigate = useNavigate();
  
  // 动态placeholder文本
  const animatedPlaceholder = useAnimatedText({ 
    isAnimating: isGenerating, 
    baseText: '回复中', 
    staticText: '输入消息...' 
  });

  // 处理朗读消息
  const handleReadMessage = async (messageId: string, content: string, messageRole?: any | null) => {
    try {
      // 确定使用的角色（优先使用消息的角色，然后是当前角色）
      const roleToUse = messageRole || currentRole;
      await playVoice(messageId, content, roleToUse, voiceSettings);
    } catch (error) {
      toast.error(`朗读失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  };
  


  // 发送消息
  const handleSendMessage = async () => {
    if (!message.trim() || isLoading) return;
    
    if (!currentSession) {
      // 如果没有当前会话，导航到聊天首页让用户选择角色
      navigate('/chat');
      return;
    }

    if (!currentModel || !currentModel.enabled) {
      toast.error('当前模型未配置或已禁用');
      return;
    }
    
    // 获取用户名和角色名，用于模板替换
    const userName = currentUserProfile?.name || '用户';
    const charName = currentRole?.name || 'AI助手';
    
    // 对用户输入应用模板替换
    const userMessage = replaceTemplateVariables(message.trim(), userName, charName);
    
    setMessage('');
    setIsLoading(true);
    setIsGenerating(true);

    // 添加用户消息（新消息不传入snowflake_id，让addMessage生成）
    addMessage(currentSession.id, {
      role: 'user',
      content: userMessage,
      timestamp: new Date()
      // 注意：新消息不传入snowflake_id，让addMessage方法生成新的ID
    }, () => {
      // 临时会话转为正式会话后，标记需要生成标题
      markSessionNeedsTitle(currentSession.id);
    });

    // 添加AI消息占位符
    const aiMessageId = generateId();
    
    // 检查当前模型是否支持思考过程
    const supportsReasoning = currentModel?.model?.includes('deepseek-reasoner') || 
                             currentModel?.model?.includes('o1') ||
                             currentModel?.name?.toLowerCase().includes('reasoning');
    
    const aiMessage = {
      id: aiMessageId,
      role: 'assistant' as const,
      content: '',
      timestamp: new Date(),
      isStreaming: true,
      // 注意：新消息不传入snowflake_id，让addMessage方法生成新的ID
      ...(supportsReasoning && {
        reasoningContent: '',
        isReasoningComplete: false
      })
    };
    
    addMessage(currentSession.id, aiMessage);

    try {
      // 调用AI API
      await callAIAPI(currentSession.id, aiMessageId, userMessage);
    } catch (error) {
      
      // 根据错误类型显示不同的提示
      if (error instanceof Error && error.name === 'AbortError') {
        toast.error('请求被取消或网络连接中断');
      } else {
        toast.error('发送消息失败，请重试');
      }
      
      // 清理可能残留的 AbortController
      cleanupRequest();
    } finally {
      setIsLoading(false);
      setIsGenerating(false);
    }
  };

  // 清理正在进行的请求
  const cleanupRequest = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  };

  // 组件卸载时清理请求
  useEffect(() => {
    return () => {
      cleanupRequest();
    };
  }, []);

  // 构建完整的系统提示词
  const buildSystemPrompt = (role: any, globalPrompts: any[], userProfile: any) => {
    const parts = [];
    
    // 获取用户名和角色名，用于模板替换
    const userName = userProfile?.name || '用户';
    const charName = role?.name || 'AI助手';
    
    // 添加用户资料信息
    if (userProfile) {
      const userInfo = [`用户名：${userProfile.name}`];
      if (userProfile.description && userProfile.description.trim()) {
        userInfo.push(`用户简介：${userProfile.description.trim()}`);
      }
      parts.push(`[用户信息：${userInfo.join('，')}]`);
    }
    
    // 添加全局提示词（应用模板替换）
    // 支持新的globalPromptIds数组和旧的globalPromptId字段
    const promptIds = role.globalPromptIds || (role.globalPromptId ? [role.globalPromptId] : []);
    if (promptIds && promptIds.length > 0) {
      promptIds.forEach(promptId => {
        const globalPrompt = globalPrompts.find(p => p.id === promptId);
        if (globalPrompt && globalPrompt.prompt.trim()) {
          const processedPrompt = replaceTemplateVariables(globalPrompt.prompt.trim(), userName, charName);
          parts.push(`[全局设置：${processedPrompt}]`);
        }
      });
    }
    
    // 添加角色提示词（应用模板替换）
    if (role.systemPrompt && role.systemPrompt.trim()) {
      const processedPrompt = replaceTemplateVariables(role.systemPrompt.trim(), userName, charName);
      parts.push(`[角色设置：${processedPrompt}]`);
    }
    
    return parts.join('\n\n');
  };

  // 构建AI API调用函数
  const callAIAPI = async (sessionId: string, messageId: string, userMessage: string) => {
    if (!currentModel || !currentRole) {
      throw new Error('模型或角色未配置');
    }

    try {
      // 🔍 [知识库增强] 检查当前角色是否配置了知识库
      console.log('🔍 [知识库增强] 开始检查角色知识库关联:', { roleId: currentRole.id });
      const roleKnowledgeBase = await getRoleKnowledgeBase(currentRole.id);
      console.log('📚 [知识库增强] 角色知识库查询结果:', { 
        roleId: currentRole.id, 
        hasKnowledgeBase: !!roleKnowledgeBase,
        knowledgeBaseId: roleKnowledgeBase?.id,
        knowledgeBaseName: roleKnowledgeBase?.name
      });
      let enhancedSystemPrompt = '';
      
      if (roleKnowledgeBase) {
        console.log('📚 [知识库增强] 当前角色配置了知识库:', {
          roleId: currentRole.id,
          knowledgeBaseId: roleKnowledgeBase.id,
          knowledgeBaseName: roleKnowledgeBase.name
        });
        
        try {
          // 使用知识库增强服务处理用户消息
          const enhancedContext = await ChatEnhancementService.enhanceChatContext(
            userMessage,
            roleKnowledgeBase.id,
            {
              maxResults: 5,
              minRelevanceScore: 0.3,
              includeDebugInfo: true
            }
          );
          
          // 构建基础系统提示词
          const baseSystemPrompt = buildSystemPrompt(currentRole, globalPrompts, currentUserProfile);
          
          // 将知识库上下文注入到系统提示词中
          enhancedSystemPrompt = ChatEnhancementService.injectKnowledgeContext(
            baseSystemPrompt,
            enhancedContext
          );
          
          console.log('✨ [知识库增强] 成功增强聊天上下文:', {
            roleId: currentRole.id,
            originalMessageLength: userMessage.length,
            extractedKeywords: enhancedContext.extractedKeywords,
            knowledgeResultsCount: enhancedContext.knowledgeResults.length,
            basePromptLength: baseSystemPrompt.length,
            enhancedPromptLength: enhancedSystemPrompt.length,
            hasKnowledgeContent: enhancedContext.knowledgeResults.some(r => r.entries.length > 0)
          });
          
        } catch (enhancementError) {
          console.warn('⚠️ [知识库增强] 增强处理失败，使用原始系统提示词:', enhancementError);
          enhancedSystemPrompt = buildSystemPrompt(currentRole, globalPrompts, currentUserProfile);
        }
      } else {
        console.log('ℹ️ [知识库增强] 当前角色未配置知识库，使用原始系统提示词');
        // 没有配置知识库，使用原始系统提示词
        enhancedSystemPrompt = buildSystemPrompt(currentRole, globalPrompts, currentUserProfile);
      }
      
      // 使用增强后的系统提示词
      const systemPrompt = enhancedSystemPrompt;
      
      // 构建消息历史
      const messages = [];
      
      // 只有当系统提示词不为空时才添加 system 消息
      if (systemPrompt) {
        messages.push({
          role: 'system',
          content: systemPrompt
        });
      }
      
      // 添加历史消息
      messages.push(...currentSession!.messages.filter(m => m.role !== 'assistant' || !m.isStreaming).map(m => ({
        role: m.role,
        content: m.content
      })));
      
      // 添加当前用户消息
      messages.push({
        role: 'user',
        content: userMessage
      });

      // 🔍 [调试] 输出发送给 LLM 的消息结构
      console.log('📤 [LLM消息] 发送给 LLM 的完整消息结构:', JSON.stringify({
        timestamp: new Date().toISOString(),
        sessionId,
        messageId,
        model: {
          provider: currentModel.provider,
          model: currentModel.model,
          temperature: currentModel.temperature,
          maxTokens: currentModel.maxTokens
        },
        role: {
          id: currentRole.id,
          name: currentRole.name
        },
        messages: messages.map((msg, index) => ({
          index,
          role: msg.role,
          contentLength: msg.content.length,
          contentPreview: msg.content.substring(0, 100) + (msg.content.length > 100 ? '...' : ''),
          isSystemPrompt: msg.role === 'system',
          isCurrentUserMessage: index === messages.length - 1 && msg.role === 'user'
        }))
      }, null, 2));

      // API调用准备

      // 根据不同的provider调用相应的API
      let apiUrl = '';
      let headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };
      let body: any = {};



      switch (currentModel.provider) {
        case 'claude':
          // Claude使用特殊的API格式
          apiUrl = currentModel.baseUrl || getDefaultBaseUrl('claude');
          if (!apiUrl.endsWith('/v1/messages')) {
            apiUrl = apiUrl.replace(/\/$/, '') + '/v1/messages';
          }
          headers['x-api-key'] = currentModel.apiKey;
          headers['anthropic-version'] = '2023-06-01';
          body = {
            model: currentModel.model,
            messages: messages.filter(m => m.role !== 'system'),
            max_tokens: currentModel.maxTokens,
            temperature: currentModel.temperature,
            stream: true
          };
          // 只有当系统提示词不为空时才添加 system 字段
          if (systemPrompt) {
            body.system = systemPrompt;
          }
          break;

        case 'gemini':
          // 只有真正的Google Gemini API才使用原生格式
          // OpenRouter的Gemini模型应该使用OpenAI兼容格式
          if (currentModel.provider === 'gemini' && !currentModel.baseUrl?.includes('openrouter')) {
            apiUrl = currentModel.baseUrl || getDefaultBaseUrl('gemini');
            if (!apiUrl.includes('/v1beta/models/')) {
              apiUrl = apiUrl.replace(/\/$/, '') + `/v1beta/models/${currentModel.model}:streamGenerateContent?key=${currentModel.apiKey}`;
            }
            body = {
              contents: messages.filter(m => m.role !== 'system').map(m => ({
                role: m.role === 'assistant' ? 'model' : 'user',
                parts: [{ text: m.content }]
              })),
              generationConfig: {
                temperature: currentModel.temperature,
                maxOutputTokens: currentModel.maxTokens
              }
            };
            // 只有当系统提示词不为空时才添加 systemInstruction
            if (systemPrompt) {
              body.systemInstruction = {
                parts: [{ text: systemPrompt }]
              };
            }
          } else {
            // OpenRouter的Gemini模型使用OpenAI兼容格式
            apiUrl = currentModel.baseUrl || getDefaultBaseUrl(currentModel.provider);
            if (!apiUrl.endsWith('/v1/chat/completions')) {
              apiUrl = apiUrl.replace(/\/$/, '') + '/v1/chat/completions';
            }
            headers['Authorization'] = `Bearer ${currentModel.apiKey}`;
            body = {
              model: currentModel.model,
              messages,
              temperature: currentModel.temperature,
              max_tokens: currentModel.maxTokens,
              stream: true
            };
          }
          break;

        default:
          // 默认使用OpenAI兼容格式 (适用于 openai, kimi, deepseek, custom 等)
          apiUrl = currentModel.baseUrl || getDefaultBaseUrl(currentModel.provider);
          if (!apiUrl.endsWith('/v1/chat/completions')) {
            apiUrl = apiUrl.replace(/\/$/, '') + '/v1/chat/completions';
          }
          headers['Authorization'] = `Bearer ${currentModel.apiKey}`;
          body = {
            model: currentModel.model,
            messages,
            temperature: currentModel.temperature,
            max_tokens: currentModel.maxTokens,
            stream: true
          };
      }

      // 如果配置了代理URL，使用代理
      if (currentModel.proxyUrl) {
        apiUrl = currentModel.proxyUrl;
      }

      // 🔍 [调试] 输出 API 请求体结构
      console.log('🚀 [API请求] 发送给 LLM 提供商的请求结构:', JSON.stringify({
        timestamp: new Date().toISOString(),
        provider: currentModel.provider,
        apiUrl,
        headers: Object.keys(headers).reduce((acc, key) => {
          // 隐藏敏感信息，只显示键名
          acc[key] = key.toLowerCase().includes('key') || key.toLowerCase().includes('authorization') 
            ? '[HIDDEN]' 
            : headers[key];
          return acc;
        }, {} as Record<string, string>),
        requestBody: body
      }, null, 2));

      // API请求准备完成

      // 清理之前的请求并创建新的 AbortController
      cleanupRequest();
      abortControllerRef.current = new AbortController();
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: abortControllerRef.current.signal // 移除固定超时，允许长时间响应
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API请求失败: ${response.status} ${errorText}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('无法读取响应流');
      }

      const decoder = new TextDecoder();
      let currentContent = '';
      let currentReasoningContent = '';
      let currentImages: string[] = [];

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6).trim();
              if (data === '[DONE]') continue;

              try {
                const parsed = JSON.parse(data);
                let content = '';
                let reasoningContent = '';
                let images: string[] = [];

                // 简化的API响应日志

                // 根据不同provider解析响应
                if (currentModel.provider === 'openai' || currentModel.provider === 'custom' || currentModel.provider === 'openrouter') {
                  content = parsed.choices?.[0]?.delta?.content || '';
                  // 检查是否是DeepSeek的reasoning模型响应
                  reasoningContent = parsed.choices?.[0]?.delta?.reasoning_content || '';
                  
                  // 处理图片数据
                  if (parsed.choices?.[0]?.delta?.images) {
                    const rawImages = parsed.choices[0].delta.images;
                    console.log('【流式图片问题调试】🖼️ [图片数据] 原始格式:', JSON.stringify(rawImages, null, 2));
                    
                    // 处理不同格式的图片数据
                    if (Array.isArray(rawImages)) {
                      images = rawImages.map((img: any) => {
                        if (typeof img === 'string') {
                          // 如果是字符串，直接使用
                          return img;
                        } else if (img && typeof img === 'object') {
                          // 如果是对象，尝试提取URL
                          if (img.image_url && img.image_url.url) {
                            return img.image_url.url;
                          } else if (img.url) {
                            return img.url;
                          }
                        }
                        return null;
                      }).filter(Boolean);
                    } else {
                      images = [rawImages];
                    }
                    
                    console.log('【流式图片问题调试】🖼️ [图片数据] 解析后格式:', images);
                  }
                  
                  // OpenAI/Custom解析结果
                } else if (currentModel.provider === 'kimi') {
                  content = parsed.choices?.[0]?.delta?.content || '';
                  
                  // 处理图片数据
                  if (parsed.choices?.[0]?.delta?.images) {
                    const rawImages = parsed.choices[0].delta.images;
                    console.log('【流式图片问题调试】🖼️ [Kimi图片数据] 原始格式:', JSON.stringify(rawImages, null, 2));
                    
                    // 处理不同格式的图片数据
                    if (Array.isArray(rawImages)) {
                      images = rawImages.map((img: any) => {
                        if (typeof img === 'string') {
                          return img;
                        } else if (img && typeof img === 'object') {
                          if (img.image_url && img.image_url.url) {
                            return img.image_url.url;
                          } else if (img.url) {
                            return img.url;
                          }
                        }
                        return null;
                      }).filter(Boolean);
                    } else {
                      images = [rawImages];
                    }
                    
                    console.log('【流式图片问题调试】🖼️ [Kimi图片数据] 解析后格式:', images);
                  }
                  
                  // Kimi解析结果
                } else if (currentModel.provider === 'deepseek') {
                  content = parsed.choices?.[0]?.delta?.content || '';
                  // 检查是否是DeepSeek的reasoning模型响应
                  reasoningContent = parsed.choices?.[0]?.delta?.reasoning_content || '';
                  
                  // 处理图片数据
                  if (parsed.choices?.[0]?.delta?.images) {
                    const rawImages = parsed.choices[0].delta.images;
                    console.log('【流式图片问题调试】🖼️ [DeepSeek图片数据] 原始格式:', JSON.stringify(rawImages, null, 2));
                    
                    // 处理不同格式的图片数据
                    if (Array.isArray(rawImages)) {
                      images = rawImages.map((img: any) => {
                        if (typeof img === 'string') {
                          return img;
                        } else if (img && typeof img === 'object') {
                          if (img.image_url && img.image_url.url) {
                            return img.image_url.url;
                          } else if (img.url) {
                            return img.url;
                          }
                        }
                        return null;
                      }).filter(Boolean);
                    } else {
                      images = [rawImages];
                    }
                    
                    console.log('【流式图片问题调试】🖼️ [DeepSeek图片数据] 解析后格式:', images);
                  }
                  
                  // DeepSeek解析结果
                } else if (currentModel.provider === 'claude') {
                  if (parsed.type === 'content_block_delta') {
                    content = parsed.delta?.text || '';
                  }
                  
                  // 处理图片数据
                  if (parsed.delta?.images) {
                    const rawImages = parsed.delta.images;
                    console.log('【流式图片问题调试】🖼️ [Claude图片数据] 原始格式:', JSON.stringify(rawImages, null, 2));
                    
                    // 处理不同格式的图片数据
                    if (Array.isArray(rawImages)) {
                      images = rawImages.map((img: any) => {
                        if (typeof img === 'string') {
                          return img;
                        } else if (img && typeof img === 'object') {
                          if (img.image_url && img.image_url.url) {
                            return img.image_url.url;
                          } else if (img.url) {
                            return img.url;
                          }
                        }
                        return null;
                      }).filter(Boolean);
                    } else {
                      images = [rawImages];
                    }
                    
                    console.log('【流式图片问题调试】🖼️ [Claude图片数据] 解析后格式:', images);
                  }
                  
                  // Claude解析结果
                } else if (currentModel.provider === 'gemini') {
                  content = parsed.candidates?.[0]?.content?.parts?.[0]?.text || '';
                  
                  // 处理图片数据
                  if (parsed.candidates?.[0]?.content?.parts) {
                    const parts = parsed.candidates[0].content.parts;
                    const imageParts = parts.filter((part: any) => part.inline_data);
                    if (imageParts.length > 0) {
                      console.log('【流式图片问题调试】🖼️ [Gemini图片数据] 原始格式:', JSON.stringify(imageParts, null, 2));
                      images = imageParts.map((part: any) => {
                        if (part.inline_data && part.inline_data.data) {
                          return `data:${part.inline_data.mime_type};base64,${part.inline_data.data}`;
                        }
                        return null;
                      }).filter(Boolean);
                      console.log('【流式图片问题调试】🖼️ [Gemini图片数据] 解析后格式:', images);
                    }
                  }
                  
                  // Gemini解析结果
                }



                // 累积图片数据
                if (images && images.length > 0) {
                  console.log('【流式图片问题调试】📥 [图片累积] 累积前状态:', {
                    累积前currentImages长度: currentImages.length,
                    累积前currentImages内容: currentImages.map((img, i) => `${i + 1}: ${img.substring(0, 50)}...`),
                    新增images长度: images.length,
                    新增images内容: images.map((img, i) => `${i + 1}: ${img.substring(0, 50)}...`)
                  });
                  
                  currentImages = [...currentImages, ...images];
                  
                  console.log('【流式图片问题调试】📥 [图片累积] 累积后状态:', {
                    累积后currentImages长度: currentImages.length,
                    累积后currentImages内容: currentImages.map((img, i) => `${i + 1}: ${img.substring(0, 50)}...`),
                    累积是否成功: currentImages.length > 0
                  });
                }

                // 更新消息内容
                if (content || reasoningContent || (images && images.length > 0)) {
                  const beforeContent = currentContent;
                  const beforeReasoning = currentReasoningContent;
                  
                  // 检测到正文内容开始时，立即标记思考过程完成
                  const isFirstContent = content && !currentContent;
                  
                  if (content) {
                    currentContent += content;
                  }
                  if (reasoningContent) {
                    currentReasoningContent += reasoningContent;
                  }
                  
                  updateMessageWithReasoning(
                    sessionId, 
                    messageId, 
                    currentContent || undefined,
                    currentReasoningContent || undefined,
                    true,
                    isFirstContent, // 如果是第一次收到正文内容，立即标记思考过程完成
                    currentImages.length > 0 ? currentImages : undefined
                  );
                }
              } catch (e) {
                // 忽略JSON解析错误
              }
            }
          }
        }
      } finally {
        reader.releaseLock();
      }


      
      updateMessageWithReasoning(
        sessionId, 
        messageId, 
        currentContent || undefined,
        currentReasoningContent || undefined,
        false,
        true,
        currentImages.length > 0 ? currentImages : undefined
      );
      
      // 强制触发数据同步，确保AI回复保存到数据库
      try {
        console.log('🚀 AI回复完成，强制触发数据同步');
        await syncToCloud();
        console.log('✅ AI回复同步完成');
      } catch (syncError) {
        console.error('❌ AI回复同步失败:', syncError);
        // 同步失败不影响UI流程，但记录错误
      }
      
      // 检查是否需要生成标题
      if (checkSessionNeedsTitle(sessionId) && currentModel) {
        generateSessionTitle(sessionId, currentModel)
          .then(() => {
            removeSessionNeedsTitle(sessionId);
          })
          .catch(error => {
            // 即使失败也要清除标记，避免重复尝试
            removeSessionNeedsTitle(sessionId);
          });
      }
      
      // 请求完成后清理 AbortController
      abortControllerRef.current = null;
      setIsGenerating(false);

    } catch (error) {
      
      // 处理不同类型的错误
      let errorMessage = '未知错误';
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          errorMessage = '请求被中断，可能是网络连接问题或响应时间过长';
        } else if (error.message.includes('timeout')) {
          errorMessage = '请求超时，请检查网络连接或稍后重试';
        } else {
          errorMessage = error.message;
        }
      }
      
      updateMessage(sessionId, messageId, `抱歉，发生了错误: ${errorMessage}`, false);
      setIsGenerating(false);
      throw error;
    }
  };

  // 停止生成
  const handleStopGeneration = () => {
    cleanupRequest();
    setIsGenerating(false);
    setIsLoading(false);
    stopCurrentVoice(); // 停止语音播放
    toast.info('已停止生成');
  };

  // 重新生成消息
  const handleRegenerateMessage = async (messageId: string) => {
    console.log('【流式图片问题调试】🔄 [重新生成] handleRegenerateMessage被调用!', {
      messageId: messageId.substring(0, 8) + '...',
      hasCurrentSession: !!currentSession,
      hasCurrentModel: !!currentModel,
      hasCurrentRole: !!currentRole,
      isLoading
    });
    
    if (!currentSession || !currentModel || !currentRole || isLoading) {
      console.log('【流式图片问题调试】❌ [重新生成] 前置条件检查失败，退出重新生成');
      return;
    }

    const messageIndex = currentSession.messages.findIndex(m => m.id === messageId);
    if (messageIndex === -1 || currentSession.messages[messageIndex].role !== 'assistant') {
      return;
    }

    // 检查是否是最新的AI消息
    const lastAssistantMessageIndex = currentSession.messages.map((m, i) => ({ message: m, index: i }))
      .filter(({ message }) => message.role === 'assistant')
      .pop()?.index;
    
    if (messageIndex !== lastAssistantMessageIndex) {
      toast.error('只能重新生成最新的AI回复');
      return;
    }

    setIsLoading(true);
    setIsGenerating(true);

    try {
      // 获取该消息之前的所有消息作为上下文
      const contextMessages = currentSession.messages.slice(0, messageIndex);
      
      // 获取最后一条用户消息
      const lastUserMessage = contextMessages.filter(m => m.role === 'user').pop();
      if (!lastUserMessage) {
        toast.error('找不到对应的用户消息');
        return;
      }

      // 构建完整的系统提示词
      const systemPrompt = buildSystemPrompt(currentRole, globalPrompts, currentUserProfile);
      
      // 构建消息历史
      const messages = [];
      
      // 只有当系统提示词不为空时才添加 system 消息
      if (systemPrompt) {
        messages.push({
          role: 'system',
          content: systemPrompt
        });
      }
      
      // 添加历史消息（不包括要重新生成的消息）
      messages.push(...contextMessages.map(m => ({
        role: m.role,
        content: m.content
      })));

      // 保存原始内容
      const originalContent = currentSession.messages[messageIndex].content;
      
      // 检查当前模型是否支持思考过程
      const supportsReasoning = currentModel.name?.toLowerCase().includes('deepseek-reasoner') || 
                               currentModel.name?.toLowerCase().includes('o1') || 
                               currentModel.name?.toLowerCase().includes('reasoning');
      
      // 重置目标消息的状态，根据模型能力决定是否设置思考过程字段
      // 同时重置versions字段为空数组，准备接收新的重新生成内容
      if (supportsReasoning) {
        updateMessageWithReasoning(
          currentSession.id,
          messageId,
          '', // 清空内容
          '', // 清空思考过程内容
          true, // 设置为流式状态
          false // 设置思考过程未完成
        );
      } else {
        // 对于不支持思考的模型，只更新基本消息内容
        updateMessage(currentSession.id, messageId, '', true);
      }
      
      // 不需要重置versions数组，addMessageVersionWithOriginal会正确处理版本追加
      // 只需要标记消息正在重新生成
      useAppStore.setState((state) => ({
        chatSessions: state.chatSessions.map(s => 
          s.id === currentSession.id 
            ? {
                ...s,
                messages: s.messages.map(m => 
                  m.id === messageId ? {
                    ...m,
                    isStreaming: true // 标记为正在生成
                  } : m
                ),
                updatedAt: new Date()
              }
            : s
        )
      }));
      
      // 调用AI API生成新内容
      const result = await callAIAPIForRegeneration(messages, messageId, currentSession.id);
      
      console.log('【流式图片问题调试】📥 [结果接收] callAIAPIForRegeneration返回结果:', {
        resultType: typeof result,
        isString: typeof result === 'string',
        isObject: typeof result === 'object',
        hasContent: result && (typeof result === 'string' || result.content),
        hasImages: result && typeof result === 'object' && result.images,
        imagesCount: result && typeof result === 'object' && result.images ? result.images.length : 0,
        result: result
      });
      
      const newContent = typeof result === 'string' ? result : result.content;
      const newImages = typeof result === 'object' ? result.images : undefined;
      
      console.log('【流式图片问题调试】🔍 [数据提取] 提取后的数据:', {
        newContentLength: newContent ? newContent.length : 0,
        newImagesType: typeof newImages,
        newImagesCount: newImages ? newImages.length : 0,
        newImages: newImages
      });
      
      console.log('🔄 重新生成完成，准备添加新版本:', {
        messageId: messageId.substring(0, 8) + '...',
        originalContentLength: originalContent.length,
        newContentLength: newContent.length,
        hasImages: newImages && newImages.length > 0
      });

      // 完成生成后，添加为新版本（传入原始内容和图片数据）
      console.log('【流式图片问题调试】📝 [版本保存] 准备保存消息版本:', {
        hasNewImages: newImages && newImages.length > 0,
        newImagesCount: newImages ? newImages.length : 0,
        newImages: newImages
      });
      
      addMessageVersionWithOriginal(currentSession.id, messageId, originalContent, newContent, newImages);
      
      toast.success('重新生成完成');
    } catch (error) {
      toast.error('重新生成失败，请重试');
    } finally {
      setIsLoading(false);
      setIsGenerating(false);
    }
  };

  // 为重新生成调用AI API的函数
  const callAIAPIForRegeneration = async (messages: any[], messageId: string, sessionId: string) => {
    console.log('【流式图片问题调试】🔄 [函数入口] callAIAPIForRegeneration被调用!');
    console.log('【流式图片问题调试】🔄 [函数入口] 参数信息:', {
      messageId: messageId.substring(0, 8) + '...',
      sessionId: sessionId.substring(0, 8) + '...',
      messagesCount: messages.length,
      currentProvider: currentModel?.provider
    });
    if (!currentModel) {
      throw new Error('模型未配置');
    }

    // 重新生成API调用

    // 根据不同的provider调用相应的API
    let apiUrl = '';
    let headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };
    let body: any = {};

    switch (currentModel.provider) {
      case 'openai':
        apiUrl = currentModel.baseUrl || 'https://api.openai.com';
        if (!apiUrl.endsWith('/v1/chat/completions')) {
          apiUrl = apiUrl.replace(/\/$/, '') + '/v1/chat/completions';
        }
        headers['Authorization'] = `Bearer ${currentModel.apiKey}`;
        body = {
          model: currentModel.model,
          messages,
          temperature: currentModel.temperature,
          max_tokens: currentModel.maxTokens,
          stream: true
        };
        break;

      case 'claude':
        apiUrl = currentModel.baseUrl || 'https://api.anthropic.com';
        if (!apiUrl.endsWith('/v1/messages')) {
          apiUrl = apiUrl.replace(/\/$/, '') + '/v1/messages';
        }
        headers['x-api-key'] = currentModel.apiKey;
        headers['anthropic-version'] = '2023-06-01';
        const systemMessage = messages.find(m => m.role === 'system');
        body = {
          model: currentModel.model,
          messages: messages.filter(m => m.role !== 'system'),
          max_tokens: currentModel.maxTokens,
          temperature: currentModel.temperature,
          stream: true
        };
        if (systemMessage) {
          body.system = systemMessage.content;
        }
        break;

      case 'gemini':
        // 只有真正的Google Gemini API才使用原生格式
        // OpenRouter的Gemini模型应该使用OpenAI兼容格式
        if (currentModel.provider === 'gemini' && !currentModel.baseUrl?.includes('openrouter')) {
          apiUrl = currentModel.baseUrl || 'https://generativelanguage.googleapis.com';
          if (!apiUrl.includes('/v1beta/models/')) {
            apiUrl = apiUrl.replace(/\/$/, '') + `/v1beta/models/${currentModel.model}:streamGenerateContent?key=${currentModel.apiKey}`;
          }
          const systemMsg = messages.find(m => m.role === 'system');
          body = {
            contents: messages.filter(m => m.role !== 'system').map(m => ({
              role: m.role === 'assistant' ? 'model' : 'user',
              parts: [{ text: m.content }]
            })),
            generationConfig: {
              temperature: currentModel.temperature,
              maxOutputTokens: currentModel.maxTokens
            }
          };
          if (systemMsg) {
            body.systemInstruction = {
              parts: [{ text: systemMsg.content }]
            };
          }
        } else {
          // OpenRouter的Gemini模型使用OpenAI兼容格式
          apiUrl = currentModel.baseUrl || '';
          if (!apiUrl.endsWith('/v1/chat/completions')) {
            apiUrl = apiUrl.replace(/\/$/, '') + '/v1/chat/completions';
          }
          headers['Authorization'] = `Bearer ${currentModel.apiKey}`;
          body = {
            model: currentModel.model,
            messages,
            temperature: currentModel.temperature,
            max_tokens: currentModel.maxTokens,
            stream: true
          };
        }
        break;

      default:
        // 自定义provider，使用OpenAI兼容格式
        apiUrl = currentModel.baseUrl || '';
        if (!apiUrl.endsWith('/v1/chat/completions')) {
          apiUrl = apiUrl.replace(/\/$/, '') + '/v1/chat/completions';
        }
        headers['Authorization'] = `Bearer ${currentModel.apiKey}`;
        body = {
          model: currentModel.model,
          messages,
          temperature: currentModel.temperature,
          max_tokens: currentModel.maxTokens,
          stream: true
        };
    }

    // 如果配置了代理URL，使用代理
    if (currentModel.proxyUrl) {
      apiUrl = currentModel.proxyUrl;
    }



    // 清理之前的请求并创建新的 AbortController
    cleanupRequest();
    abortControllerRef.current = new AbortController();
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: abortControllerRef.current.signal
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API请求失败: ${response.status} ${errorText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('无法读取响应流');
    }

    const decoder = new TextDecoder();
    let currentContent = '';
    let currentReasoningContent = '';
    let currentImages: string[] = [];

    try {
      console.log('【流式图片问题调试】🔄 [流式响应] 开始读取流式响应数据...');
      
      while (true) {
        console.log('【流式图片问题调试】🔄 [流式响应] 等待下一个chunk...');
        const { done, value } = await reader.read();
        
        if (done) {
          console.log('【流式图片问题调试】🔄 [流式响应] 流式响应读取完成');
          break;
        }

        const chunk = decoder.decode(value, { stream: true });
        console.log('📦 [原始chunk] 接收到chunk数据:', {
          chunkLength: chunk.length,
          chunkPreview: chunk.substring(0, 200) + (chunk.length > 200 ? '...' : ''),
          chunkFull: chunk
        });
        
        const lines = chunk.split('\n');
        console.log('📝 [chunk分割] 分割后的lines数组:', {
          linesCount: lines.length,
          lines: lines.map((line, index) => `${index}: "${line}"`)
        });

        for (const line of lines) {
          console.log('📄 [处理line] 当前处理的line:', `"${line}"`);
          
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim();
            console.log('📊 [data提取] 提取的data内容:', {
              dataLength: data.length,
              dataPreview: data.substring(0, 200) + (data.length > 200 ? '...' : ''),
              dataFull: data
            });
            
            if (data === '[DONE]') {
              console.log('🏁 [流式结束] 接收到[DONE]标记');
              continue;
            }

            try {
              console.log('【流式图片问题调试】🔍 [JSON解析] 准备解析JSON数据:', data);
              const parsed = JSON.parse(data);
              console.log('✅ [JSON解析] JSON解析成功:', JSON.stringify(parsed, null, 2));
              let content = '';
              let reasoningContent = '';
              let images: string[] = [];

              // 🔍 [全面调试] 记录完整的parsed对象结构
              console.log('【流式图片问题调试】🔍 [完整响应] 当前provider:', currentModel.provider);
              console.log('【流式图片问题调试】🔍 [完整响应] 完整parsed对象:', JSON.stringify(parsed, null, 2));
              
              // 🔍 [结构分析] 检查choices数组结构
              if (parsed.choices && Array.isArray(parsed.choices)) {
                console.log('【流式图片问题调试】🔍 [结构分析] choices数组长度:', parsed.choices.length);
                parsed.choices.forEach((choice: any, index: number) => {
                  console.log(`【流式图片问题调试】🔍 [结构分析] choice[${index}]完整结构:`, JSON.stringify(choice, null, 2));
                });
              }
              
              // 🔍 [图片搜索] 在整个响应中搜索可能的图片字段
              const searchForImages = (obj: any, path: string = '') => {
                if (!obj || typeof obj !== 'object') return;
                
                for (const [key, value] of Object.entries(obj)) {
                  const currentPath = path ? `${path}.${key}` : key;
                  
                  // 检查可能包含图片的字段名
                  if (key.toLowerCase().includes('image') || 
                      key.toLowerCase().includes('img') || 
                      key.toLowerCase().includes('picture') ||
                      key.toLowerCase().includes('photo')) {
                    console.log(`【流式图片问题调试】🔍 [图片搜索] 发现可能的图片字段: ${currentPath}`, value);
                  }
                  
                  // 检查base64数据
                  if (typeof value === 'string' && value.includes('base64')) {
                    console.log(`【流式图片问题调试】🔍 [图片搜索] 发现base64数据: ${currentPath}`, value.substring(0, 100) + '...');
                  }
                  
                  // 递归搜索
                  if (typeof value === 'object' && value !== null) {
                    searchForImages(value, currentPath);
                  }
                }
              };
              
              searchForImages(parsed);

              // 根据不同provider解析响应
              if (currentModel.provider === 'openai' || currentModel.provider === 'custom' || currentModel.provider === 'openrouter') {
                content = parsed.choices?.[0]?.delta?.content || '';
                // 检查是否是DeepSeek的reasoning模型响应
                reasoningContent = parsed.choices?.[0]?.delta?.reasoning_content || '';
                
                // 详细调试：检查整个delta对象
                console.log('【流式图片问题调试】🔍 [调试] 当前provider:', currentModel.provider);
                console.log('【流式图片问题调试】🔍 [调试] 完整delta对象:', JSON.stringify(parsed.choices?.[0]?.delta, null, 2));
                
                // 🔍 [OpenRouter特殊检查] 检查OpenRouter特有的响应格式
                if (currentModel.provider === 'openrouter') {
                  console.log('【流式图片问题调试】🔍 [OpenRouter] 检查choice完整结构:', JSON.stringify(parsed.choices?.[0], null, 2));
                  
                  // 检查是否在choice级别有图片数据
                  if (parsed.choices?.[0]?.images) {
                    console.log('【流式图片问题调试】🔍 [OpenRouter] 在choice级别发现图片数据:', parsed.choices[0].images);
                  }
                  
                  // 检查是否在顶级有图片数据
                  if (parsed.images) {
                    console.log('【流式图片问题调试】🔍 [OpenRouter] 在顶级发现图片数据:', parsed.images);
                  }
                  
                  // 检查是否在message级别有图片数据
                  if (parsed.choices?.[0]?.message?.images) {
                    console.log('【流式图片问题调试】🔍 [OpenRouter] 在message级别发现图片数据:', parsed.choices[0].message.images);
                  }
                }
                
                // 🔍 [关键修复] 统一的图片数据检测和处理逻辑
                let rawImages = null;
                
                console.log('【流式图片问题调试】🔍 [图片检测] 开始检查图片数据位置...');
                console.log('【流式图片问题调试】🔍 [图片检测] delta对象完整结构:', JSON.stringify(parsed.choices?.[0]?.delta, null, 2));
                console.log('【流式图片问题调试】🔍 [图片检测] delta.images存在:', !!parsed.choices?.[0]?.delta?.images);
                console.log('【流式图片问题调试】🔍 [图片检测] delta.images内容:', parsed.choices?.[0]?.delta?.images);
                console.log('【流式图片问题调试】🔍 [图片检测] choice.images存在:', !!parsed.choices?.[0]?.images);
                console.log('【流式图片问题调试】🔍 [图片检测] 顶级images存在:', !!parsed.images);
                console.log('【流式图片问题调试】🔍 [图片检测] message.images存在:', !!parsed.choices?.[0]?.message?.images);
                
                // 首先检查delta.images（标准位置）
                if (parsed.choices?.[0]?.delta?.images) {
                  rawImages = parsed.choices[0].delta.images;
                  console.log('【流式图片问题调试】🖼️ [图片数据] ✅ 在delta.images中检测到图片数据!');
                  console.log('【流式图片问题调试】🖼️ [图片数据] delta.images原始数据:', JSON.stringify(rawImages, null, 2));
                }
                // 检查choice级别的images
                else if (parsed.choices?.[0]?.images) {
                  rawImages = parsed.choices[0].images;
                  console.log('【流式图片问题调试】🖼️ [图片数据] ✅ 在choice.images中检测到图片数据!', rawImages);
                }
                // 检查顶级images
                else if (parsed.images) {
                  rawImages = parsed.images;
                  console.log('【流式图片问题调试】🖼️ [图片数据] ✅ 在顶级images中检测到图片数据!', rawImages);
                }
                // 检查message级别的images
                else if (parsed.choices?.[0]?.message?.images) {
                  rawImages = parsed.choices[0].message.images;
                  console.log('【流式图片问题调试】🖼️ [图片数据] ✅ 在message.images中检测到图片数据!', rawImages);
                }
                else {
                  console.log('【流式图片问题调试】🔍 [图片检测] ❌ 未在任何位置检测到图片数据');
                }
                
                // 🔍 [关键修复] 统一处理图片数据
                if (rawImages) {
                  console.log('【流式图片问题调试】🖼️ [图片数据] 开始处理原始图片数据...');
                  console.log('【流式图片问题调试】🖼️ [图片数据] 原始格式:', JSON.stringify(rawImages, null, 2));
                  console.log('【流式图片问题调试】🖼️ [图片数据] 数组长度:', Array.isArray(rawImages) ? rawImages.length : 'not array');
                  console.log('【流式图片问题调试】🖼️ [图片数据] 数据类型:', typeof rawImages);
                  
                  // 处理不同格式的图片数据
                  if (Array.isArray(rawImages)) {
                    console.log('【流式图片问题调试】🖼️ [图片数据] 处理数组格式的图片数据，数组长度:', rawImages.length);
                    images = rawImages.map((img: any, index: number) => {
                      console.log(`【流式图片问题调试】🖼️ [图片数据] 处理第${index + 1}个图片:`);
                      console.log(`【流式图片问题调试】🖼️ [图片数据] 第${index + 1}个图片完整结构:`, JSON.stringify(img, null, 2));
                      console.log(`【流式图片问题调试】🖼️ [图片数据] 第${index + 1}个图片类型:`, typeof img);
                      
                      if (typeof img === 'string') {
                        // 如果是字符串，直接使用
                        console.log(`【流式图片问题调试】🖼️ [图片数据] 第${index + 1}个图片是字符串:`, img.substring(0, 50) + '...');
                        return img;
                      } else if (img && typeof img === 'object') {
                        console.log(`【流式图片问题调试】🖼️ [图片数据] 第${index + 1}个图片是对象，检查字段...`);
                        console.log(`【流式图片问题调试】🖼️ [图片数据] 第${index + 1}个图片.image_url存在:`, !!img.image_url);
                        console.log(`【流式图片问题调试】🖼️ [图片数据] 第${index + 1}个图片.image_url.url存在:`, !!img.image_url?.url);
                        console.log(`【流式图片问题调试】🖼️ [图片数据] 第${index + 1}个图片.url存在:`, !!img.url);
                        
                        // 如果是对象，尝试提取URL
                        if (img.image_url && img.image_url.url) {
                          console.log(`【流式图片问题调试】🖼️ [图片数据] 第${index + 1}个图片从image_url.url提取:`, img.image_url.url.substring(0, 50) + '...');
                          return img.image_url.url;
                        } else if (img.url) {
                          console.log(`【流式图片问题调试】🖼️ [图片数据] 第${index + 1}个图片从url提取:`, img.url.substring(0, 50) + '...');
                          return img.url;
                        } else {
                          console.log(`【流式图片问题调试】🖼️ [图片数据] 第${index + 1}个图片对象中未找到url字段`);
                        }
                      }
                      console.log(`【流式图片问题调试】🖼️ [图片数据] 第${index + 1}个图片无法提取URL`);
                      return null;
                    }).filter(Boolean); // 过滤掉null值
                    
                    console.log('【流式图片问题调试】🖼️ [图片数据] 数组处理完成，过滤后长度:', images.length);
                  } else if (typeof rawImages === 'string') {
                    console.log('【流式图片问题调试】🖼️ [图片数据] 字符串格式，直接使用:', rawImages.substring(0, 50) + '...');
                    images = [rawImages];
                  } else {
                    console.log('【流式图片问题调试】🖼️ [图片数据] 其他格式，尝试转换:', rawImages);
                    images = [rawImages];
                  }
                  
                  console.log('【流式图片问题调试】🖼️ [图片数据] 最终解析结果:');
                  console.log('【流式图片问题调试】🖼️ [图片数据] 解析后数量:', images.length);
                  console.log('【流式图片问题调试】🖼️ [图片数据] 解析后格式:', images.map((img, i) => `${i + 1}: ${typeof img === 'string' ? img.substring(0, 50) + '...' : img}`));
                  
                  // 验证每个图片URL的格式
                  images.forEach((img, i) => {
                    if (typeof img === 'string') {
                      console.log(`【流式图片问题调试】🖼️ [图片验证] 第${i + 1}个图片URL格式检查:`, {
                        长度: img.length,
                        是否以data开头: img.startsWith('data:'),
                        是否包含base64: img.includes('base64'),
                        前缀: img.substring(0, 30)
                      });
                    }
                  });
                } else {
                  console.log('【流式图片问题调试】🔍 [调试] 未检测到图片数据');
                }
              } else if (currentModel.provider === 'kimi') {
                content = parsed.choices?.[0]?.delta?.content || '';
                if (parsed.choices?.[0]?.delta?.images) {
                  const rawImages = parsed.choices[0].delta.images;
                  console.log('【流式图片问题调试】🖼️ [Kimi图片数据] 原始格式:', JSON.stringify(rawImages, null, 2));
                  
                  // 处理不同格式的图片数据
                  if (Array.isArray(rawImages)) {
                    images = rawImages.map((img: any) => {
                      if (typeof img === 'string') {
                        return img;
                      } else if (img && typeof img === 'object') {
                        if (img.image_url && img.image_url.url) {
                          return img.image_url.url;
                        } else if (img.url) {
                          return img.url;
                        }
                      }
                      return null;
                    }).filter(Boolean);
                  } else {
                    images = [rawImages];
                  }
                  
                  console.log('【流式图片问题调试】🖼️ [Kimi图片数据] 解析后格式:', images);
                }
              } else if (currentModel.provider === 'deepseek') {
                content = parsed.choices?.[0]?.delta?.content || '';
                // 检查是否是DeepSeek的reasoning模型响应
                reasoningContent = parsed.choices?.[0]?.delta?.reasoning_content || '';
                if (parsed.choices?.[0]?.delta?.images) {
                  const rawImages = parsed.choices[0].delta.images;
                  console.log('【流式图片问题调试】🖼️ [DeepSeek图片数据] 原始格式:', JSON.stringify(rawImages, null, 2));
                  
                  // 处理不同格式的图片数据
                  if (Array.isArray(rawImages)) {
                    images = rawImages.map((img: any) => {
                      if (typeof img === 'string') {
                        return img;
                      } else if (img && typeof img === 'object') {
                        if (img.image_url && img.image_url.url) {
                          return img.image_url.url;
                        } else if (img.url) {
                          return img.url;
                        }
                      }
                      return null;
                    }).filter(Boolean);
                  } else {
                    images = [rawImages];
                  }
                  
                  console.log('【流式图片问题调试】🖼️ [DeepSeek图片数据] 解析后格式:', images);
                }
              } else if (currentModel.provider === 'claude') {
                if (parsed.type === 'content_block_delta') {
                  content = parsed.delta?.text || '';
                }
                // Claude可能在其他地方包含图片数据
                if (parsed.delta?.images) {
                  const rawImages = parsed.delta.images;
                  console.log('【流式图片问题调试】🖼️ [Claude图片数据] 原始格式:', JSON.stringify(rawImages, null, 2));
                  
                  // 处理不同格式的图片数据
                  if (Array.isArray(rawImages)) {
                    images = rawImages.map((img: any) => {
                      if (typeof img === 'string') {
                        return img;
                      } else if (img && typeof img === 'object') {
                        if (img.image_url && img.image_url.url) {
                          return img.image_url.url;
                        } else if (img.url) {
                          return img.url;
                        }
                      }
                      return null;
                    }).filter(Boolean);
                  } else {
                    images = [rawImages];
                  }
                  
                  console.log('【流式图片问题调试】🖼️ [Claude图片数据] 解析后格式:', images);
                }
              } else if (currentModel.provider === 'gemini') {
                content = parsed.candidates?.[0]?.content?.parts?.[0]?.text || '';
                // Gemini的图片数据可能在parts中
                const parts = parsed.candidates?.[0]?.content?.parts || [];
                const imageParts = parts.filter((part: any) => part.images);
                if (imageParts.length > 0) {
                  const rawImages = imageParts.flatMap((part: any) => part.images);
                  console.log('【流式图片问题调试】🖼️ [Gemini图片数据] 原始格式:', JSON.stringify(rawImages, null, 2));
                  
                  // 处理不同格式的图片数据
                  if (Array.isArray(rawImages)) {
                    images = rawImages.map((img: any) => {
                      if (typeof img === 'string') {
                        return img;
                      } else if (img && typeof img === 'object') {
                        if (img.image_url && img.image_url.url) {
                          return img.image_url.url;
                        } else if (img.url) {
                          return img.url;
                        }
                      }
                      return null;
                    }).filter(Boolean);
                  } else {
                    images = [rawImages];
                  }
                  
                  console.log('【流式图片问题调试】🖼️ [Gemini图片数据] 解析后格式:', images);
                }
              }

              // 关键节点：检测到内容开始
              if ((content || reasoningContent) && process.env.NODE_ENV === 'development') {
                if (content && !currentContent) {
                  console.log('📝 重新生成：正文内容开始输出');
                }
                if (reasoningContent && !currentReasoningContent) {
                  console.log('🧠 重新生成：思考过程开始');
                }
              }

              // 更新消息内容
              if (content || reasoningContent || images.length > 0) {
                // 检测到正文内容开始时，立即标记思考过程完成
                const isFirstContent = content && !currentContent;
                
                if (content) {
                  currentContent += content;
                }
                if (reasoningContent) {
                  currentReasoningContent += reasoningContent;
                }
                
                // 累积图片数据
                if (images.length > 0) {
                  console.log('【流式图片问题调试】📥 [状态更新] 累积图片数据前 currentImages长度:', currentImages.length);
                  console.log('【流式图片问题调试】📥 [状态更新] 累积图片数据前 currentImages内容:', currentImages.map((img, i) => `${i + 1}: ${img.substring(0, 50)}...`));
                  console.log('【流式图片问题调试】📥 [状态更新] 新增图片数据:', images);
                  console.log('【流式图片问题调试】📥 [状态更新] 新增图片数据详细:', images.map((img, i) => `${i + 1}: ${typeof img} - ${img.substring(0, 100)}...`));
                  
                  // 检查currentImages是否被意外修改
                  const beforeLength = currentImages.length;
                  const beforeContent = [...currentImages];
                  
                  currentImages.push(...images);
                  
                  console.log('【流式图片问题调试】📥 [状态更新] 累积图片数据后 currentImages长度:', currentImages.length);
                  console.log('【流式图片问题调试】📥 [状态更新] 累积图片数据后 currentImages内容:', currentImages.map((img, i) => `${i + 1}: ${img.substring(0, 50)}...`));
                  
                  // 验证累积是否成功
                  if (currentImages.length !== beforeLength + images.length) {
                    console.error('【流式图片问题调试】❌ [状态更新] 图片累积异常! 期望长度:', beforeLength + images.length, '实际长度:', currentImages.length);
                  }
                  
                  // 检查是否有重复或丢失
                  console.log('【流式图片问题调试】📊 [状态更新] 图片累积统计:', {
                    累积前数量: beforeLength,
                    新增数量: images.length,
                    累积后数量: currentImages.length,
                    期望数量: beforeLength + images.length,
                    累积成功: currentImages.length === beforeLength + images.length
                  });
                }
                
                // 重新生成模式：只显示流式效果，不更新versions
                // 临时更新消息内容以显示流式效果，但不触发versions更新
                console.log('【流式图片问题调试】🔄 [状态更新] 重新生成模式 - 更新消息状态前检查:', {
                  messageId,
                  currentImagesLength: currentImages.length,
                  currentImagesIsArray: Array.isArray(currentImages),
                  currentImagesType: typeof currentImages,
                  currentImagesContent: currentImages.map((img, i) => `${i + 1}: ${typeof img} - ${img.substring(0, 50)}...`),
                  willSetImages: currentImages.length > 0 ? [...currentImages] : undefined,
                  willSetImagesLength: currentImages.length > 0 ? currentImages.length : 0
                });
                
                // 额外检查：确保currentImages没有被意外清空
                 if (currentImages.length === 0 && images.length > 0) {
                   console.error('【流式图片问题调试】❌ [状态更新] 严重错误: currentImages被意外清空!', {
                     刚刚处理的图片数量: images.length,
                     当前currentImages长度: currentImages.length,
                     currentImages内容: currentImages
                   });
                 }
                 
                 // 创建要设置的images值（流式过程中）
                 const streamingImagesToSet = currentImages.length > 0 ? [...currentImages] : undefined;
                 console.log('【流式图片问题调试】🔄 [状态更新] 流式过程中要设置的images值:', {
                   类型: typeof streamingImagesToSet,
                   是否为数组: Array.isArray(streamingImagesToSet),
                   长度: streamingImagesToSet?.length || 0,
                   内容预览: streamingImagesToSet?.map((img, i) => `${i + 1}: ${img.substring(0, 50)}...`) || '无内容'
                 });
                 
                // 🔧 [关键修复] 流式过程中也使用函数式更新确保状态一致性
                useAppStore.setState((state) => {
                  console.log('【流式图片问题调试】🔄 [状态更新] 流式setState函数内部检查:', {
                    当前状态中的会话数量: state.chatSessions.length,
                    目标sessionId: sessionId,
                    找到目标会话: !!state.chatSessions.find(s => s.id === sessionId),
                    目标messageId: messageId,
                    streamingImagesToSet长度: streamingImagesToSet?.length || 0
                  });
                  
                  const updatedSessions = state.chatSessions.map(s => {
                    if (s.id !== sessionId) return s;
                    
                    const updatedMessages = s.messages.map(m => {
                      if (m.id !== messageId) return m;
                      
                      console.log('【流式图片问题调试】🔄 [状态更新] 流式更新目标消息:', {
                        messageId: m.id,
                        原始images: m.images,
                        原始images长度: m.images?.length || 0,
                        新的images: streamingImagesToSet,
                        新的images长度: streamingImagesToSet?.length || 0
                      });
                      
                      const updatedMessage = {
                        ...m,
                        content: currentContent,
                        reasoningContent: currentReasoningContent,
                        images: streamingImagesToSet,
                        isStreaming: true,
                        isReasoningComplete: isFirstContent
                        // 注意：不更新versions字段，保持原有版本历史
                      };
                      
                      console.log('【流式图片问题调试】🔄 [状态更新] 流式消息更新完成:', {
                        messageId: updatedMessage.id,
                        更新后images: updatedMessage.images,
                        更新后images长度: updatedMessage.images?.length || 0,
                        更新后images类型: typeof updatedMessage.images,
                        更新后images是数组: Array.isArray(updatedMessage.images)
                      });
                      
                      return updatedMessage;
                    });
                    
                    return {
                      ...s,
                      messages: updatedMessages
                    };
                  });
                  
                  return {
                    chatSessions: updatedSessions
                  };
                });
              }
            } catch (e) {
              // 忽略JSON解析错误
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }


    
    // 重新生成模式：流式输出完成，标记为非流式状态但不更新versions
    // 最终的版本管理由handleRegenerateMessage中的addMessageVersionWithOriginal处理
    console.log('【流式图片问题调试】✅ [状态更新] 重新生成完成 - 最终状态更新前检查:', {
      messageId,
      finalCurrentImagesLength: currentImages.length,
      finalCurrentImagesIsArray: Array.isArray(currentImages),
      finalCurrentImagesType: typeof currentImages,
      finalCurrentImagesContent: currentImages.map((img, i) => `${i + 1}: ${typeof img} - ${img.substring(0, 50)}...`),
      finalWillSetImages: currentImages.length > 0 ? [...currentImages] : undefined,
      finalWillSetImagesLength: currentImages.length > 0 ? currentImages.length : 0,
      条件判断结果: currentImages.length > 0,
      最终设置的images值: currentImages.length > 0 ? '数组副本' : 'undefined'
    });
    
    // 最终检查：如果currentImages有内容但条件判断失败
    if (currentImages.length > 0) {
      console.log('【流式图片问题调试】✅ [状态更新] 最终状态 - currentImages有内容，将设置到消息状态');
    } else {
      console.warn('【流式图片问题调试】⚠️ [状态更新] 最终状态 - currentImages为空，消息状态的images将设置为undefined');
    }
    
    // 创建要设置的images值
    console.log('【流式图片问题调试】🎯 [状态更新] 创建finalImagesToSet前检查:', {
      currentImages长度: currentImages.length,
      currentImages类型: typeof currentImages,
      currentImages是数组: Array.isArray(currentImages),
      currentImages内容: currentImages.map((img, i) => `${i + 1}: ${typeof img} - ${img.substring(0, 50)}...`),
      条件判断: currentImages.length > 0,
      将创建的值: currentImages.length > 0 ? '数组副本' : 'undefined'
    });
    
    const finalImagesToSet = currentImages.length > 0 ? [...currentImages] : undefined;
    
    console.log('【流式图片问题调试】🎯 [状态更新] finalImagesToSet创建完成:', {
      类型: typeof finalImagesToSet,
      是否为数组: Array.isArray(finalImagesToSet),
      长度: finalImagesToSet?.length || 0,
      内容预览: finalImagesToSet?.map((img, i) => `${i + 1}: ${img.substring(0, 50)}...`) || '无内容',
      与currentImages长度对比: {
        currentImages长度: currentImages.length,
        finalImagesToSet长度: finalImagesToSet?.length || 0,
        长度一致: currentImages.length === (finalImagesToSet?.length || 0)
      }
    });
    
    // 🔧 [关键修复] 使用函数式更新确保状态一致性
    useAppStore.setState((state) => {
      console.log('【流式图片问题调试】🔧 [状态更新] setState函数内部检查:', {
        当前状态中的会话数量: state.chatSessions.length,
        目标sessionId: sessionId,
        找到目标会话: !!state.chatSessions.find(s => s.id === sessionId),
        目标messageId: messageId,
        finalImagesToSet长度: finalImagesToSet?.length || 0
      });
      
      const updatedSessions = state.chatSessions.map(s => {
        if (s.id !== sessionId) return s;
        
        console.log('【流式图片问题调试】🔧 [状态更新] 处理目标会话:', {
          sessionId: s.id,
          消息数量: s.messages.length,
          目标消息存在: !!s.messages.find(m => m.id === messageId)
        });
        
        const updatedMessages = s.messages.map(m => {
          if (m.id !== messageId) return m;
          
          console.log('【流式图片问题调试】🔧 [状态更新] 更新目标消息:', {
            messageId: m.id,
            原始images: m.images,
            原始images长度: m.images?.length || 0,
            新的images: finalImagesToSet,
            新的images长度: finalImagesToSet?.length || 0
          });
          
          // 🔧 [关键修复] 确保images字段正确设置
          console.log('【流式图片问题调试】🔧 [状态更新] 设置images字段前检查:', {
            finalImagesToSet: finalImagesToSet,
            finalImagesToSet类型: typeof finalImagesToSet,
            finalImagesToSet长度: finalImagesToSet?.length || 0,
            finalImagesToSet是数组: Array.isArray(finalImagesToSet),
            备用值: [],
            最终将设置的值: finalImagesToSet || [],
            最终值类型: typeof (finalImagesToSet || []),
            最终值长度: (finalImagesToSet || []).length,
            最终值是数组: Array.isArray(finalImagesToSet || [])
          });
          
          const updatedMessage = {
            ...m,
            content: currentContent,
            reasoningContent: currentReasoningContent,
            images: finalImagesToSet || [], // 确保images始终是数组
            isStreaming: false,
            isReasoningComplete: true
            // 注意：不更新versions字段，保持原有版本历史
          };
          
          console.log('【流式图片问题调试】🔧 [状态更新] updatedMessage创建完成:', {
            messageId: updatedMessage.id,
            images字段: updatedMessage.images,
            images类型: typeof updatedMessage.images,
            images长度: updatedMessage.images?.length || 0,
            images是数组: Array.isArray(updatedMessage.images),
            images内容预览: updatedMessage.images?.map((img, i) => `${i + 1}: ${img.substring(0, 50)}...`) || '无内容'
          });
          
          console.log('【流式图片问题调试】🔧 [状态更新] 消息更新完成:', {
            messageId: updatedMessage.id,
            更新后images: updatedMessage.images,
            更新后images长度: updatedMessage.images?.length || 0,
            更新后images类型: typeof updatedMessage.images,
            更新后images是数组: Array.isArray(updatedMessage.images)
          });
          
          return updatedMessage;
        });
        
        return {
          ...s,
          messages: updatedMessages
        };
      });
      
      const newState = {
        ...state,
        chatSessions: updatedSessions
      };
      
      // 🔧 [关键修复] 立即验证状态更新
      const verifySession = newState.chatSessions.find(s => s.id === sessionId);
      const verifyMessage = verifySession?.messages.find(m => m.id === messageId);
      console.log('【流式图片问题调试】🔍 [状态更新] 立即验证新状态:', {
        找到会话: !!verifySession,
        找到消息: !!verifyMessage,
        验证消息images: verifyMessage?.images,
        验证消息images长度: verifyMessage?.images?.length || 0,
        验证消息images类型: typeof verifyMessage?.images,
        验证消息images是数组: Array.isArray(verifyMessage?.images)
      });
      
      return newState;
    });
    
    // 验证状态更新后的实际数据
    const updatedState = useAppStore.getState();
    const updatedSession = updatedState.chatSessions.find(s => s.id === sessionId);
    const updatedMessage = updatedSession?.messages.find(m => m.id === messageId);
    console.log('【流式图片问题调试】🔍 [状态验证] 更新后的消息状态详细检查:', {
      messageId,
      找到会话: !!updatedSession,
      找到消息: !!updatedMessage,
      updatedMessageImages: updatedMessage?.images,
      updatedMessageImagesType: typeof updatedMessage?.images,
      updatedMessageImagesIsArray: Array.isArray(updatedMessage?.images),
      updatedMessageImagesLength: updatedMessage?.images?.length || 0,
      updatedMessageImagesContent: updatedMessage?.images?.map((img, i) => `${i + 1}: ${img.substring(0, 50)}...`) || '无内容',
      消息其他字段: {
        content: updatedMessage?.content?.substring(0, 50) + '...',
        isStreaming: updatedMessage?.isStreaming,
        isReasoningComplete: updatedMessage?.isReasoningComplete
      }
    });
    
    // 最终验证：对比设置前后的数据
    console.log('【流式图片问题调试】📊 [状态验证] 设置前后对比:', {
      设置前currentImages长度: currentImages.length,
      设置前finalImagesToSet长度: finalImagesToSet?.length || 0,
      设置后消息images长度: updatedMessage?.images?.length || 0,
      数据一致性: (finalImagesToSet?.length || 0) === (updatedMessage?.images?.length || 0)
    });
    
    // 如果数据不一致，输出错误信息
    if ((finalImagesToSet?.length || 0) !== (updatedMessage?.images?.length || 0)) {
      console.error('【流式图片问题调试】❌ [状态验证] 数据不一致错误!', {
        期望设置的图片数量: finalImagesToSet?.length || 0,
        实际消息中的图片数量: updatedMessage?.images?.length || 0,
        原始currentImages: currentImages,
        设置的finalImagesToSet: finalImagesToSet,
        实际消息images: updatedMessage?.images
      });
    }
    
    console.log('✅ 重新生成流式输出完成，内容长度:', currentContent.length);
    
    // 检查是否需要生成标题（重新生成时也可能需要）
    if (checkSessionNeedsTitle(sessionId) && currentModel) {
      generateSessionTitle(sessionId, currentModel)
        .then(() => {
          removeSessionNeedsTitle(sessionId);
        })
        .catch(error => {
          // 即使失败也要清除标记，避免重复尝试
          removeSessionNeedsTitle(sessionId);
        });
    }
    
    // 请求完成后清理 AbortController
    abortControllerRef.current = null;
    setIsGenerating(false);

    console.log('【流式图片问题调试】✅ [函数返回] callAIAPIForRegeneration即将返回结果:', {
      contentLength: currentContent.length,
      imagesCount: currentImages.length,
      images: currentImages,
      contentPreview: currentContent.substring(0, 100) + '...'
    });

    return { content: currentContent, images: currentImages };
  };

  // 处理键盘事件
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // 如果没有 sessionId，显示角色选择器
  if (!sessionId) {
    return <RoleSelector />;
  }

  return (
    <div className="chat-container flex flex-col h-full bg-base-100">
      {/* 消息列表 */}
      <div 
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto p-4 pb-10 space-y-4 gradient-mask-y [--gradient-mask-padding:1rem] md:[--gradient-mask-padding:2rem]"
      >
        <div className={cn('max-w-4xl mx-auto', chatStyle === 'document' && 'px-4')}>
        {currentSession?.messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-[calc(100vh-500px)] text-base-content/60">
            {/* 添加加载状态检查和默认值 */}
            {aiRoles.length === 0 ? (
              <h3 className="text-black/40 text-xl font-medium mb-2">正在加载角色信息...</h3>
            ) : (
              <h3 className="text-black/40 text-xl font-medium mb-2">
                Hello，我是 {currentRole?.name || '智能助手'}
              </h3>
            )}
          </div>
        ) : (
          currentSession?.messages
            .slice() // 创建副本避免修改原数组
            .sort((a, b) => {
              // 三级排序策略：snowflake_id -> message_timestamp -> created_at
              if (a.snowflake_id && b.snowflake_id) {
                // 都有 snowflake_id，按 snowflake_id 排序（转换为字符串比较，因为 snowflake_id 具有时间有序性）
                return String(a.snowflake_id).localeCompare(String(b.snowflake_id));
              } else if (a.snowflake_id && !b.snowflake_id) {
                // 只有 a 有 snowflake_id，a 排在后面（新消息）
                return 1;
              } else if (!a.snowflake_id && b.snowflake_id) {
                // 只有 b 有 snowflake_id，b 排在后面（新消息）
                return -1;
              } else {
                 // 都没有 snowflake_id，使用原有的排序逻辑
                 if (a.message_timestamp && b.message_timestamp) {
                   return parseFloat(a.message_timestamp) - parseFloat(b.message_timestamp);
                 }
                 // 最后使用 timestamp 排序
                 return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
               }
            })
            .map((msg) => (
                            
            <div
              key={msg.id}
              className={cn(
                'mb-2 chat',
                msg.role === 'user' ? 'chat-end' : 'chat-start',
                chatStyle === 'document' && 'chat-box'
              )}
            >
              <div className="chat-image avatar">
                {msg.role === 'assistant' ? (
                  (() => {
                    // 根据消息的roleId获取对应的AI角色，添加多重fallback
                    let messageRole = null;
                    if (msg.roleId) {
                      messageRole = aiRoles.find(r => r.id === msg.roleId);
                    }
                    // 如果没有找到，尝试使用会话的roleId
                    if (!messageRole && currentSession?.roleId) {
                      messageRole = aiRoles.find(r => r.id === currentSession.roleId);
                    }
                    // 然后fallback到当前角色
                    if (!messageRole) {
                      messageRole = currentRole;
                    }
                    // 最后fallback到第一个可用角色
                    if (!messageRole && aiRoles.length > 0) {
                      messageRole = aiRoles[0];
                    }
                    return (
                      <Avatar
                        name={messageRole?.name || 'AI助手'}
                        avatar={messageRole?.avatar}
                        size="md"
                      />
                    );
                  })()
                ) : (
                  (() => {
                    // 修改头像显示逻辑：
                    // 1. 如果设置了用户角色（有userProfileId），则使用角色头像
                    // 2. 如果用户登录但未设置角色，则使用用户头像
                    // 3. 如果用户未登录，则显示默认图标
                    if (msg.userProfileId) {
                      // 有角色ID，使用角色头像
                      const messageUserProfile = userRoles.find(p => p.id === msg.userProfileId);
                      return messageUserProfile ? (
                        <Avatar
                          name={messageUserProfile.name}
                          avatar={messageUserProfile.avatar}
                          size="md"
                        />
                      ) : (
                        <div 
                          className="w-8 h-8 rounded-full bg-base-300 flex items-center justify-items-center content-center text-center">
                          <User className="h-4 w-4 text-accent" />
                        </div>
                      );
                    } else if (user) {
                      // 用户已登录但未设置角色，使用用户头像
                      return (
                        <Avatar
                          name={user.user_metadata?.full_name || user.email || '用户'}
                          avatar={user.user_metadata?.avatar_url}
                          size="md"
                        />
                      );
                    } else {
                      // 用户未登录，显示默认图标
                      return (
                        <div 
                          className="w-8 h-8 rounded-full bg-base-300 flex items-center justify-items-center content-center text-center">
                          <User className="h-4 w-4 text-accent" />
                        </div>
                      );
                    }
                  })()
                )}              </div>

                <div
                  className={cn(
                    'chat-bubble cursor-pointer md:max-w-xl md:cursor-default relative group',
                    msg.role === 'user'
                      ? 'chat-bubble-accent'
                      : ''
                  )}
                  onClick={() => {
                    // 移动端点击切换按钮组显示
                    if (window.innerWidth < 768) {
                      setVisibleActionButtons(visibleActionButtons === msg.id ? null : msg.id);
                    }
                  }}
                >
                  {/* 音频波纹 - 仅在AI消息播放时显示在右上角 */}
                  {msg.role === 'assistant' && voicePlayingState.isPlaying && voicePlayingState.currentMessageId === msg.id && (
                    <div className="absolute -top-1 -right-1 z-20">
                      <AudioWaveform className="bg-base-100 rounded-full p-1 shadow-sm" />
                    </div>
                  )}
                  
                  {/* 显示思考过程 - 对AI消息且有实际思考内容时显示 */}
                   {msg.role === 'assistant' && msg.reasoningContent && msg.reasoningContent.trim() && (
                     <ThinkingProcess 
                       content={msg.reasoningContent}
                       isComplete={msg.isReasoningComplete || false}
                     />
                   )}
                  
                  {(() => {
                    const processedContent = replaceTemplateVariables(
                      msg.content,
                      currentUserProfile?.name || '用户',
                      currentRole?.name || 'AI助手'
                    );
                    
                    return (
                      <MarkdownRenderer content={processedContent} />
                    );
                  })()}
                  
                  {/* 渲染图片 - 当消息包含images时显示 */}
                  {(() => {
                    console.log('【流式图片问题调试】🖼️ [消息渲染] 检查图片数据:', {
                      messageId: msg.id?.substring(0, 8) + '...',
                      hasImages: !!msg.images,
                      imagesLength: msg.images ? msg.images.length : 0,
                      imagesContent: msg.images ? msg.images.map((img, i) => `${i + 1}: ${img.substring(0, 50)}...`) : 'undefined',
                      willRenderImages: !!(msg.images && msg.images.length > 0)
                    });
                    
                    return msg.images && msg.images.length > 0 ? (
                      <div className="mt-3 space-y-2">
                        {msg.images.map((imageData, index) => {
                          console.log(`【流式图片问题调试】🖼️ [消息渲染] 渲染图片 ${index + 1}:`, {
                            messageId: msg.id?.substring(0, 8) + '...',
                            imageIndex: index,
                            imageDataLength: imageData.length,
                            imageDataPreview: imageData.substring(0, 100) + '...',
                            startsWithData: imageData.startsWith('data:'),
                            finalSrc: imageData.startsWith('data:') ? imageData.substring(0, 50) + '...' : `data:image/png;base64,${imageData.substring(0, 50)}...`
                          });
                          
                          return (
                            <div key={index} className="relative">
                              <img
                                src={imageData.startsWith('data:') ? imageData : `data:image/png;base64,${imageData}`}
                                alt={`Generated image ${index + 1}`}
                                className="max-w-full h-auto rounded-lg shadow-md border border-base-300"
                                style={{ maxHeight: '400px' }}
                                onLoad={() => {
                                  console.log(`【流式图片问题调试】✅ [消息渲染] 图片 ${index + 1} 加载成功:`, {
                                    messageId: msg.id?.substring(0, 8) + '...',
                                    imageIndex: index
                                  });
                                }}
                                onError={(e) => {
                                  console.error(`【流式图片问题调试】❌ [消息渲染] 图片 ${index + 1} 加载失败:`, {
                                    messageId: msg.id?.substring(0, 8) + '...',
                                    imageIndex: index,
                                    error: e,
                                    src: e.currentTarget.src.substring(0, 100) + '...'
                                  });
                                  e.currentTarget.style.display = 'none';
                                }}
                              />
                            </div>
                          );
                        })}
                      </div>
                    ) : null;
                  })()}
                  
                  {msg.isStreaming && (
                    <Loader2 className="h-4 w-4 animate-spin mt-2" />
                  )}

                {/* 操作按钮组 - hover时显示或移动端点击显示 */}
                <div className={cn(
                  'absolute flex gap-1 p-1 bg-base-100 text-base-content rounded-md transition-opacity duration-200 z-10 backdrop-blur-sm shadow-sm',
                  'opacity-0 group-hover:opacity-100', // 桌面端hover显示
                  'md:opacity-0 md:group-hover:opacity-100', // 桌面端确保hover效果
                  visibleActionButtons === msg.id ? 'opacity-100' : '', // 移动端点击显示
                  msg.role === 'user' 
                    ? 'right-0 top-full mt-1' 
                    : 'left-0 top-full mt-1'
                )}>

                  {/* 重新生成按钮 - 仅对最新的AI消息显示，但不在第一条开场白时显示 */}
                  {msg.role === 'assistant' && (() => {
                    // 检查是否是最新的AI消息
                    const lastAssistantMessageIndex = currentSession?.messages
                      .map((m, i) => ({ message: m, index: i }))
                      .filter(({ message }) => message.role === 'assistant')
                      .pop()?.index;
                    const currentIndex = currentSession?.messages.findIndex(m => m.id === msg.id);
                    const isLatestAssistant = currentIndex === lastAssistantMessageIndex;
                    
                    // 检查是否是第一条AI消息（开场白）
                    const isFirstAssistantMessage = currentSession?.messages.findIndex(m => m.role === 'assistant') === currentIndex;
                    // 检查是否已经开始对话（是否有用户消息）
                    const hasUserMessages = currentSession?.messages.some(m => m.role === 'user');
                    
                    // 只有在最新AI消息且不是第一条开场白（或已开始对话）时显示
                    return isLatestAssistant && (!isFirstAssistantMessage || hasUserMessages) ? (
                      <button
                        className="p-1 rounded text-gray-500 hover:bg-black/10 transition-colors disabled:opacity-50"
                        title="重新生成"
                        disabled={isLoading}
                        onClick={() => handleRegenerateMessage(msg.id)}
                      >
                        <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
                      </button>
                    ) : null;
                  })()}
                  
                  {/* 编辑按钮 */}
                  <Popconfirm
                    title="编辑消息"
                    description={
                      <div className="">
                        <textarea
                          value={editingMessageId === msg.id ? editingContent : msg.content}
                          onChange={(e) => {
                            if (editingMessageId === msg.id) {
                              setEditingContent(e.target.value);
                            } else {
                              setEditingMessageId(msg.id);
                              setEditingContent(e.target.value);
                            }
                          }}
                          className="textarea w-full p-2 resize-none text-sm"
                          rows={3}
                          placeholder="编辑消息内容..."
                        />
                      </div>
                    }
                    onConfirm={() => {
                      if (editingContent.trim()) {
                        updateMessage(currentSession!.id, msg.id, editingContent.trim());
                        setEditingMessageId(null);
                        setEditingContent('');
                        toast.success('消息已更新');
                      }
                    }}
                    onCancel={() => {
                      setEditingMessageId(null);
                      setEditingContent('');
                    }}
                    okText="保存"
                    cancelText="取消"
                  >
                    <button
                      className="p-1 rounded text-gray-500 hover:bg-black/10 transition-colors"
                      title="编辑"
                    >
                      <Edit3 className="h-4 w-4 " />
                    </button>
                  </Popconfirm>
                  
                  {/* 删除按钮 */}
                  <Popconfirm
                    title="确定要删除这条消息吗？"
                    onConfirm={async () => {
                      try {
                        await deleteMessage(currentSession!.id, msg.id);
                        toast.success('消息已删除');
                      } catch (error) {
                        console.error('删除消息失败:', error);
                        toast.error('删除消息失败，请重试');
                      }
                    }}
                  >
                    <button
                      className="p-1 rounded text-gray-500 hover:bg-black/10 transition-colors"
                      title="删除"
                    >
                      <Trash2 className="h-4 w-4 " />
                    </button>
                  </Popconfirm>
                  
                  {/* 朗读按钮 - 仅对AI消息显示 */}
                  {msg.role === 'assistant' && (
                    <button
                      className={cn(
                        "p-1 rounded transition-colors",
                        voicePlayingState.isPlaying && voicePlayingState.currentMessageId === msg.id
                          ? "text-primary hover:bg-primary/10"
                          : "text-gray-500 hover:bg-black/10"
                      )}
                      title={
                        voicePlayingState.isGenerating && voicePlayingState.currentMessageId === msg.id
                          ? "正在生成语音..."
                          : voicePlayingState.isPlaying && voicePlayingState.currentMessageId === msg.id
                          ? "停止朗读"
                          : "朗读"
                      }
                      onClick={async () => {
                        // 获取消息对应的角色
                        let messageRole = null;
                        if (msg.roleId) {
                          messageRole = aiRoles.find(r => r.id === msg.roleId);
                        }
                        try {
                          await handleReadMessage(msg.id, msg.content, messageRole);
                        } catch (error) {
                          // 错误已在handleReadMessage中处理
                        }
                      }}
                    >
                      {voicePlayingState.isGenerating && voicePlayingState.currentMessageId === msg.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : voicePlayingState.isPlaying && voicePlayingState.currentMessageId === msg.id ? (
                        <Square className="h-4 w-4" />
                      ) : (
                        <Volume2 className="h-4 w-4" />
                      )}
                    </button>
                  )}
                  
                  {/* 切换开场白按钮 - 仅对第一条AI消息且角色有多个开场白且未开始对话时显示 */}
                  {msg.role === 'assistant' && (() => {
                    // 检查是否是第一条AI消息
                    const isFirstAssistantMessage = currentSession?.messages.findIndex(m => m.role === 'assistant') === currentSession?.messages.findIndex(m => m.id === msg.id);
                    // 检查是否已经开始对话（是否有用户消息）
                    const hasUserMessages = currentSession?.messages.some(m => m.role === 'user');
                    // 获取消息对应的角色（优先使用消息的roleId，然后是会话的roleId）
                    let messageRole = null;
                    if (msg.roleId) {
                      messageRole = aiRoles.find(r => r.id === msg.roleId);
                    } else if (currentSession?.roleId) {
                      messageRole = aiRoles.find(r => r.id === currentSession.roleId);
                    }
                    // 检查是否有多个开场白
                    const hasMultipleOpenings = messageRole?.openingMessages && messageRole.openingMessages.length > 1;
                    
                    return isFirstAssistantMessage && hasMultipleOpenings && !hasUserMessages ? (
                      <>
                        <button
                          className="p-1 rounded text-gray-500 hover:bg-black/10 transition-colors"
                          title="上一个开场白"
                          onClick={() => {
                            const currentIndex = messageRole.openingMessages.findIndex(opening => opening === msg.content) || 0;
                            const newIndex = currentIndex > 0 ? currentIndex - 1 : messageRole.openingMessages.length - 1;
                            const newOpening = messageRole.openingMessages[newIndex];
                            if (newOpening) {
                              updateMessage(currentSession!.id, msg.id, newOpening);
                              toast.success('已切换到上一个开场白');
                            }
                          }}
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </button>
                        <span className="text-xs text-gray-500 px-1 content-center">
                          {(messageRole.openingMessages.findIndex(opening => opening === msg.content) || 0) + 1}/{messageRole.openingMessages.length}
                        </span>
                        <button
                          className="p-1 rounded text-gray-500 hover:bg-black/10 transition-colors"
                          title="下一个开场白"
                          onClick={() => {
                            const currentIndex = messageRole.openingMessages.findIndex(opening => opening === msg.content) || 0;
                            const newIndex = currentIndex < messageRole.openingMessages.length - 1 ? currentIndex + 1 : 0;
                            const newOpening = messageRole.openingMessages[newIndex];
                            if (newOpening) {
                              updateMessage(currentSession!.id, msg.id, newOpening);
                              toast.success('已切换到下一个开场白');
                            }
                          }}
                        >
                          <ChevronRight className="h-4 w-4" />
                        </button>
                      </>
                    ) : null;
                  })()}
                </div>
                {/* 版本切换按钮组 - hover时显示或移动端点击显示 */}
                <div className={cn(
                  'absolute flex gap-1 p-1 bg-base-100 text-base-content rounded-md transition-opacity duration-200 z-10 backdrop-blur-sm shadow-sm',
                  'opacity-0 group-hover:opacity-100', // 桌面端hover显示
                  'md:opacity-0 md:group-hover:opacity-100', // 桌面端确保hover效果
                  visibleActionButtons === msg.id ? 'opacity-100' : '', // 移动端点击显示
                  msg.role === 'user' 
                    ? 'left-0 top-full mt-1' 
                    : 'right-0 top-full mt-1'
                )}>
                  {/* 版本切换按钮 - 对有多个版本的消息显示 */}
                  {msg.versions && msg.versions.length > 1 && (
                    <>
                      <button
                        className="p-1 rounded text-gray-500 hover:bg-black/10 transition-colors disabled:opacity-50"
                        title="上一个版本"
                        disabled={(msg.currentVersionIndex || 0) === 0}
                        onClick={() => {
                          const currentIndex = msg.currentVersionIndex || 0;
                          if (currentIndex > 0) {
                            switchMessageVersion(currentSession!.id, msg.id, currentIndex - 1);
                          }
                        }}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </button>
                      <span className="text-xs text-gray-500 px-1 content-center">
                        {(msg.currentVersionIndex || 0) + 1}/{msg.versions.length}
                      </span>
                      <button
                        className="p-1 rounded text-gray-500 hover:bg-black/10 transition-colors disabled:opacity-50"
                        title="下一个版本"
                        disabled={(msg.currentVersionIndex || 0) === msg.versions.length - 1}
                        onClick={() => {
                          const currentIndex = msg.currentVersionIndex || 0;
                          if (currentIndex < msg.versions.length - 1) {
                            switchMessageVersion(currentSession!.id, msg.id, currentIndex + 1);
                          }
                        }}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </>
                  )}
                  </div>
                </div>
                

              </div>

          ))
        )}
        <div ref={messagesEndRef} />
        </div>
      </div>

      {/* 输入区域 */}
      <div className="p-4 pt-0">
        <div className="chat-input max-w-4xl mx-auto">
        {/* 输入框 - 单独一行 */}
        <div className="mb-3">
          <textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={animatedPlaceholder}
            className="textarea textarea-ghost w-full resize-none focus:outline-none"
            rows={1}
            style={{ minHeight: '40px', maxHeight: '120px' }}
            disabled={isGenerating}
          />
          {/* 模板替换预览 */}
          {message.trim() && (message.includes('{{user}}') || message.includes('{{char}}')) && (
            <div className="mt-2 p-2 bg-base-200 rounded text-sm text-base-content/70">
              <span className="text-xs text-base-content/50">预览: </span>
              {replaceTemplateVariables(message, currentUserProfile?.name || '用户', currentRole?.name || 'AI助手')}
            </div>
          )}
        </div>
        
        {/* 按钮区域 - 左右分布 */}
        <div className="flex justify-between items-center">
          {/* 左下角按钮组 */}
          <div className="flex space-x-2">
            {/* 模型选择器 */}
            <div className="flex items-center gap-1">
              <div className="dropdown dropdown-top">
                <div tabIndex={0} role="button" className="btn btn-xs btn-ghost h-8 min-h-8" title="选择模型">
                <Bot className="w-4 h-4 text-base-content/60" />
                {currentModel?.name || '选择模型'}
                <svg className="w-3 h-3 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
              <ul tabIndex={0} className="dropdown-content menu bg-base-100 rounded-box z-[1] w-52 p-2 shadow">
                {enabledModels.map((model) => (
                  <li key={model.id}>
                    <a 
                      onClick={() => {
                        setCurrentModel(model.id);
                        // 点击后收起 dropdown
                        (document.activeElement as HTMLElement)?.blur();
                      }}
                      className={currentModel?.id === model.id ? 'active' : ''}
                    >
                      {model.name}
                    </a>
                  </li>
                ))}
              </ul>
              </div>
            </div>

          </div>
          
          {/* 右下角按钮组 */}
          <div className="flex space-x-2">
            {/* 停止按钮 - 仅在生成时显示 */}
            {isGenerating && (
              <button
                onClick={handleStopGeneration}
                className="btn btn-error btn-sm"
                title="停止生成"
              >
                <Square className="h-4 w-4" />
              </button>
            )}
            
            {/* 发送按钮 */}
            <button
              onClick={handleSendMessage}
              disabled={!message.trim() || isLoading || isGenerating}
              className={cn(
                'btn btn-sm flex-shrink-0',
                message.trim() && !isLoading && !isGenerating
                  ? 'btn-primary'
                  : 'btn-disabled'
              )}
            >
              {isLoading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Send className="h-5 w-5" />
              )}
            </button>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
};

export default ChatPage;