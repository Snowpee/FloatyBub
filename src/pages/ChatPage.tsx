import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAppStore, generateId } from '../store';
import { Bot, Send, Square, Loader2, Trash2, Volume2, RefreshCw, ChevronLeft, ChevronRight, Users, User, Cpu, Plus, Edit3, Globe, SlidersHorizontal, X } from 'lucide-react';
import { cn, getApiBaseUrl } from '../lib/utils';
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
import { playVoice, playVoiceStreaming, stopCurrentVoice, addVoiceStateListener, getVoiceState } from '../utils/voiceUtils';
import { supabase } from '../lib/supabase';
import { useUserData } from '../hooks/useUserData';
import { useAuth } from '../hooks/useAuth';
import { ChatEnhancementService } from '../services/chatEnhancementService';
import { useKnowledgeStore } from '../stores/knowledgeStore';
import { useScrollMask } from '../hooks/useScrollMask';

const ChatPage: React.FC = () => {
  const { sessionId } = useParams();
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState('');
  const editDialogRef = useRef<HTMLDialogElement>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [visibleActionButtons, setVisibleActionButtons] = useState<string | null>(null);
  const [voicePlayingState, setVoicePlayingState] = useState(getVoiceState());
  const [isUserScrolling, setIsUserScrolling] = useState(false);
  // 聊天样式由全局 store 管理
  // 联网搜索阶段指示
  const [isWebSearching, setIsWebSearching] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const prevSessionIdRef = useRef<string | null>(null);
  const prevMessageCountRef = useRef<number>(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pendingMessageRef = useRef<string | null>(null);
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  
  // 获取数据同步功能
  const { syncToCloud } = useUserData();
  
  // 获取用户认证信息
  const { user } = useAuth();
  
  // 获取知识库store
  const { getRoleKnowledgeBase } = useKnowledgeStore();

  // 过去通过 localStorage + 事件管理；现在改为从 store 读取

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
    currentUser,
    currentUserProfile,
    voiceSettings,
    searchConfig,
    autoTitleConfig,
    assistantConfig,
    sendMessageShortcut,
    chatStyle,
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
    updateSearchConfig,
    generateSessionTitle,
    markSessionNeedsTitle,
    checkSessionNeedsTitle,
    removeSessionNeedsTitle,
    getFavoriteRoles
  } = useAppStore();

  // 统一辅助配置：优先使用新的 assistantConfig，回退到 autoTitleConfig
  const effectiveAssistantConfig = assistantConfig || autoTitleConfig;

  // 获取启用的模型
  const enabledModels = llmConfigs.filter(m => m.enabled);

  // 控制编辑消息模态显示/隐藏
  useEffect(() => {
    const dialog = editDialogRef.current;
    if (!dialog) return;
    if (isEditModalOpen) {
      dialog.showModal();
    } else {
      dialog.close();
    }
  }, [isEditModalOpen]);

  // 收藏助手（用于 /chat 首屏默认与选择）
  const favoriteRoles = getFavoriteRoles();
  useEffect(() => {
    if (!sessionId) {
      const defaultRoleId = favoriteRoles[0]?.id || aiRoles[0]?.id || null;
      setSelectedRoleId(prev => prev ?? defaultRoleId);
    }
  }, [sessionId, favoriteRoles, aiRoles]);

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
      role = (selectedRoleId ? aiRoles.find(r => r.id === selectedRoleId) : null) || aiRoles[0];
    }
    
    return role;
  }, [currentSession?.id, currentSession?.roleId, aiRoles, tempSessionId, selectedRoleId]);
  const currentModel = currentSession ? llmConfigs.find(m => m.id === currentSession.modelId) : llmConfigs.find(m => m.id === currentModelId);

  // 智能滚动遮罩：根据滚动位置动态添加/移除顶部/底部/两端遮罩
  const { scrollContainerRef: scrollMaskRef, scrollMaskClasses } = useScrollMask({
    gradientPadding: '1rem',
    dependencies: [currentSession?.id, currentSession?.messages?.length]
  });

  // 如果有sessionId参数，设置为当前会话
  useEffect(() => {
    if (sessionId && sessionId !== currentSessionId) {
      setCurrentSession(sessionId);
    }
  }, [sessionId, currentSessionId, setCurrentSession]);

  // 路由到具体会话后，自动发送在 /chat 首屏记录的待发送消息
  useEffect(() => {
    const sendPending = async () => {
      if (sessionId && pendingMessageRef.current && currentSession) {
        const text = pendingMessageRef.current;
        pendingMessageRef.current = null;

        const userName = currentUserProfile?.name || '用户';
        const charName = currentRole?.name || 'AI助手';
        const userMessage = replaceTemplateVariables(text, userName, charName);

        setIsLoading(true);
        setIsGenerating(true);

        addMessage(currentSession.id, {
          role: 'user',
          content: userMessage,
          timestamp: new Date()
        }, () => {
          if (effectiveAssistantConfig?.enabled) {
            markSessionNeedsTitle(currentSession.id);
          }
        });

        const aiMessageId = generateId();
        const supportsReasoning = currentModel?.model?.includes('deepseek-reasoner') || 
                                 currentModel?.model?.includes('o1') ||
                                 currentModel?.name?.toLowerCase().includes('reasoning');

        addMessage(currentSession.id, {
          id: aiMessageId,
          role: 'assistant',
          content: '',
          timestamp: new Date(),
          isStreaming: true,
          ...(supportsReasoning && {
            reasoningContent: '',
            isReasoningComplete: false
          })
        } as any);

        try {
          await callAIAPI(currentSession.id, aiMessageId, userMessage);
        } catch (error) {
          if (error instanceof Error && error.name === 'AbortError') {
            toast.error('请求被取消或网络连接中断');
          } else {
            toast.error('发送消息失败，请重试');
          }
          cleanupRequest();
        } finally {
          setIsLoading(false);
          setIsGenerating(false);
        }
      }
    };
    sendPending();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, currentSession?.id]);
  
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
    const container = scrollMaskRef.current;
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

  useEffect(() => {
    const container = scrollMaskRef.current;
    if (!container) return;
    requestAnimationFrame(() => {
      container.scrollTop = container.scrollHeight;
      setIsUserScrolling(false);
    });
  }, [currentSession?.id]);

  const isStreamingActive = useMemo(() => {
    return !!currentSession?.messages?.some(m => (m as any).isStreaming);
  }, [currentSession?.id, currentSession?.messages]);

  useEffect(() => {
    if (!isStreamingActive) return;
    const container = scrollMaskRef.current;
    if (!container) return;
    const { scrollTop, scrollHeight, clientHeight } = container;
    const atBottom = scrollHeight - scrollTop - clientHeight < 10;
    if (atBottom) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
    }
  }, [isStreamingActive, currentSession?.messages]);

  useEffect(() => {
    const msgs = currentSession?.messages || [];
    if (msgs.length === 0) return;
    const last = msgs[msgs.length - 1];
    if (last.role === 'user') {
      messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
      setIsUserScrolling(false);
    }
  }, [currentSession?.messages?.length]);

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

  // 处理朗读消息（使用流式播放）
  const handleReadMessage = async (messageId: string, content: string, messageRole?: any | null) => {
    try {
      // 确定使用的角色（优先使用消息的角色，然后是当前角色）
      const roleToUse = messageRole || currentRole;
      await playVoiceStreaming(messageId, content, roleToUse, voiceSettings);
    } catch (error) {
      toast.error(`朗读失败: ${error instanceof Error ? error.message : '未知错误'}`);
    }
  };
  


  // 发送消息
  const handleSendMessage = async () => {
    if (!message.trim() || isLoading) return;
    
    if (!currentSession) {
      // 无会话：创建临时会话并跳转到新会话，然后自动发送
      const roleIdToUse = selectedRoleId || favoriteRoles[0]?.id || aiRoles[0]?.id;
      if (!roleIdToUse) {
        toast.error('请先创建或选择一个助手');
        return;
      }

      const modelIdToUse = (currentModel && currentModel.enabled)
        ? currentModel.id
        : enabledModels[0]?.id;
      if (!modelIdToUse) {
        toast.error('请先配置并启用一个模型');
        return;
      }

      setCurrentModel(modelIdToUse);

      const newSessionId = createTempSession(roleIdToUse, modelIdToUse);

      const selectedRole = aiRoles.find(r => r.id === roleIdToUse);
      const openingMessage = selectedRole?.openingMessages && selectedRole.openingMessages[0];
      if (openingMessage?.trim()) {
        addMessage(newSessionId, {
          role: 'assistant',
          content: openingMessage,
          timestamp: new Date()
        });
      }

      pendingMessageRef.current = message.trim();
      setMessage('');
      navigate(`/chat/${newSessionId}`);
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
      // 临时会话转为正式会话后，标记需要生成标题（仅在开启时）
      if (effectiveAssistantConfig?.enabled) {
        markSessionNeedsTitle(currentSession.id);
      }
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

  // 构建完整的系统提示词（保留向后兼容性）
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

  // 构建分离的系统消息数组
  const buildSystemMessages = (role: any, globalPrompts: any[], userProfile: any, knowledgeContext?: string) => {
    const messages = [];
    
    // 获取用户名和角色名，用于模板替换
    const userName = userProfile?.name || '用户';
    const charName = role?.name || 'AI助手';
    
    // 1. 添加用户资料信息作为独立的system消息
    if (userProfile) {
      const userInfo = [`用户名：${userProfile.name}`];
      if (userProfile.description && userProfile.description.trim()) {
        userInfo.push(`用户简介：${userProfile.description.trim()}`);
      }
      messages.push({
        role: 'system',
        content: `[用户信息：${userInfo.join('，')}]`
      });
    }
    
    // 2. 添加每个全局提示词作为独立的system消息
    const promptIds = role.globalPromptIds || (role.globalPromptId ? [role.globalPromptId] : []);
    if (promptIds && promptIds.length > 0) {
      promptIds.forEach(promptId => {
        const globalPrompt = globalPrompts.find(p => p.id === promptId);
        if (globalPrompt && globalPrompt.prompt.trim()) {
          const processedPrompt = replaceTemplateVariables(globalPrompt.prompt.trim(), userName, charName);
          messages.push({
            role: 'system',
            content: `[全局设置：${processedPrompt}]`
          });
        }
      });
    }
    
    // 3. 添加角色设置作为独立的system消息
    if (role.systemPrompt && role.systemPrompt.trim()) {
      const processedPrompt = replaceTemplateVariables(role.systemPrompt.trim(), userName, charName);
      messages.push({
        role: 'system',
        content: `[角色设置：${processedPrompt}]`
      });
    }
    
    // 4. 添加知识库信息作为独立的system消息（如果有）
    if (knowledgeContext && knowledgeContext.trim()) {
      messages.push({
        role: 'system',
        content: knowledgeContext
      });
    }
    
    return messages;
  };

  // 构建AI API调用函数
  const callAIAPI = async (sessionId: string, messageId: string, userMessage: string) => {
    if (!currentModel || !currentRole) {
      throw new Error('模型或角色未配置');
    }

    try {
      // ⚙️ [联网搜索] 通过 LLM 进行意图识别（结构化 JSON 输出）
      const decideWebSearchWithLLM = async (text: string): Promise<{ need: boolean; queries: string[]; confidence: number }> => {
        const classificationSystemPrompt = [
          '你是一个“联网搜索判定助手”。你的任务是判断用户消息是否需要联网搜索才能得到准确回答。',
          '请仅输出严格的 JSON：{"need_search": <true|false>, "confidence": <0-1>, "queries": [<string>...] }。',
          '判定为需要搜索的典型情况：涉及最新/最近/今天/新闻/发布/价格/汇率/天气/比分/股票/币价/下载地址/官网/文档/动态数据等。',
          '如果需要搜索，请给出最多2条简洁的搜索查询（queries），尽量贴近信息源检索习惯；否则 queries 输出空数组。',
          '不要输出除 JSON 以外的任何文本。'
        ].join('\n');

        // 构造跨提供商的最小化请求体（不使用流式）
        let apiUrl = '';
        let headers: Record<string, string> = { 'Content-Type': 'application/json' };
        let body: any = {};

        // 选择用于判定的“全局辅助模型”
        let auxModel = currentModel;
        if (effectiveAssistantConfig?.strategy === 'custom' && effectiveAssistantConfig?.modelId) {
          const custom = llmConfigs.find(m => m.id === effectiveAssistantConfig.modelId);
          if (custom) auxModel = custom;
        } else {
          const followModelId = currentSession?.modelId || currentModelId || auxModel?.id;
          const followed = llmConfigs.find(m => m.id === followModelId);
          if (followed) auxModel = followed;
        }

        if (!auxModel) {
          console.warn('⚠️ [联网搜索] 未找到可用的辅助模型，回退不触发搜索');
          return { need: false, queries: [], confidence: 0.0 };
        }

        switch (auxModel.provider) {
          case 'claude': {
            apiUrl = auxModel.baseUrl || getDefaultBaseUrl('claude');
            if (!apiUrl.endsWith('/v1/messages')) apiUrl = apiUrl.replace(/\/$/, '') + '/v1/messages';
            headers['x-api-key'] = auxModel.apiKey;
            headers['anthropic-version'] = '2023-06-01';
            body = {
              model: auxModel.model,
              max_tokens: 128,
              temperature: 0,
              stream: false,
              messages: [{ role: 'user', content: text }]
            };
            // Claude 将系统提示放到 system 字段
            body.system = classificationSystemPrompt;
            break;
          }
          case 'gemini': {
            // 如果是 OpenRouter 的 Gemini，走 OpenAI 兼容格式；否则回退启发式
            const isOpenRouter = auxModel.baseUrl?.includes('openrouter');
            if (isOpenRouter) {
              apiUrl = auxModel.baseUrl || getDefaultBaseUrl(auxModel.provider);
              if (!apiUrl.endsWith('/v1/chat/completions')) apiUrl = apiUrl.replace(/\/$/, '') + '/v1/chat/completions';
              headers['Authorization'] = `Bearer ${auxModel.apiKey}`;
              body = {
                model: auxModel.model,
                temperature: 0,
                max_tokens: 128,
                stream: false,
                messages: [
                  { role: 'system', content: classificationSystemPrompt },
                  { role: 'user', content: text }
                ]
              };
            } else {
              // 原生 Gemini 接口适配较复杂，暂时回退为启发式
              console.log('ℹ️ [联网搜索] 原生 Gemini 暂回退为启发式判定');
              return { need: false, queries: [], confidence: 0.0 };
            }
            break;
          }
          default: {
            // OpenAI兼容：openai, deepseek, kimi, custom, openrouter等
            apiUrl = auxModel.baseUrl || getDefaultBaseUrl(auxModel.provider);
            if (!apiUrl.endsWith('/v1/chat/completions')) apiUrl = apiUrl.replace(/\/$/, '') + '/v1/chat/completions';
            headers['Authorization'] = `Bearer ${auxModel.apiKey}`;
            body = {
              model: auxModel.model,
              temperature: 0,
              max_tokens: 128,
              stream: false,
              messages: [
                { role: 'system', content: classificationSystemPrompt },
                { role: 'user', content: text }
              ]
            };
          }
        }

        const resp = await fetch(apiUrl, { method: 'POST', headers, body: JSON.stringify(body) });
        if (!resp.ok) {
          const errText = await resp.text().catch(() => '');
          console.warn('⚠️ [联网搜索] LLM判定接口非200，回退启发式:', resp.status, errText);
          return { need: false, queries: [], confidence: 0.0 };
        }
        const json = await resp.json();

        // 解析不同提供商的文本内容
        let textOut = '';
        if (auxModel.provider === 'claude') {
          try {
            const blocks = json?.content || [];
            const firstText = blocks.find((b: any) => b?.type === 'text')?.text || '';
            textOut = String(firstText || '');
          } catch (_) {}
        } else if (auxModel.provider === 'gemini' && auxModel.baseUrl?.includes('openrouter')) {
          textOut = json?.choices?.[0]?.message?.content || '';
        } else {
          textOut = json?.choices?.[0]?.message?.content || '';
        }

        // 规范化提取可能的 JSON（剥离 Markdown 代码块、截取首尾花括号）
        const tryExtractJson = (s: string) => {
          const trimmed = (s || '').trim();
          const fenceJson = trimmed.match(/```json\s*([\s\S]*?)\s*```/i);
          if (fenceJson && fenceJson[1]) return fenceJson[1].trim();
          const fenceAny = trimmed.match(/```\s*([\s\S]*?)\s*```/);
          if (fenceAny && fenceAny[1]) return fenceAny[1].trim();
          const start = trimmed.indexOf('{');
          const end = trimmed.lastIndexOf('}');
          if (start !== -1 && end !== -1 && end > start) {
            return trimmed.slice(start, end + 1).trim();
          }
          return trimmed;
        };

        const candidate = tryExtractJson(String(textOut || ''));
        try {
          const parsed = JSON.parse(candidate);
          const need = !!parsed?.need_search;
          const queries = Array.isArray(parsed?.queries) ? parsed.queries.filter((s: any) => typeof s === 'string') : [];
          const confidence = typeof parsed?.confidence === 'number' ? parsed.confidence : (need ? 0.7 : 0.5);
          console.log('✅ [联网搜索] LLM 判定结果:', { need, confidence, queries, raw: textOut, json: candidate });
          return { need, queries, confidence };
        } catch (e) {
          console.warn('⚠️ [联网搜索] LLM 输出无法解析为JSON，回退不搜索:', e, { raw: textOut, candidate });
          return { need: false, queries: [], confidence: 0.0 };
        }
      };

      // 🔍 [知识库增强] 检查当前角色是否配置了知识库
      console.log('🔍 [知识库增强] 开始检查角色知识库关联:', { roleId: currentRole.id });
      const roleKnowledgeBase = await getRoleKnowledgeBase(currentRole.id);
      console.log('📚 [知识库增强] 角色知识库查询结果:', { 
        roleId: currentRole.id, 
        hasKnowledgeBase: !!roleKnowledgeBase,
        knowledgeBaseId: roleKnowledgeBase?.id,
        knowledgeBaseName: roleKnowledgeBase?.name
      });
      
      let knowledgeContext = '';
      
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
          
          // 构建知识库上下文
          const allEntries = enhancedContext.knowledgeResults.flatMap(result => result.entries);
          if (allEntries.length > 0) {
            const knowledgeItems = allEntries.map(entry => {
              const keywords = entry.keywords.join('、');
              return `【${entry.name}】\n关键词：${keywords}\n解释：${entry.explanation}`;
            }).join('\n\n');
            knowledgeContext = `[相关知识库信息]\n${knowledgeItems}\n[/相关知识库信息]`;
          }
          
          console.log('✨ [知识库增强] 成功增强聊天上下文:', {
            roleId: currentRole.id,
            originalMessageLength: userMessage.length,
            extractedKeywords: enhancedContext.extractedKeywords,
            knowledgeResultsCount: enhancedContext.knowledgeResults.length,
            knowledgeContextLength: knowledgeContext.length,
            hasKnowledgeContent: enhancedContext.knowledgeResults.some(r => r.entries.length > 0)
          });
          
        } catch (enhancementError) {
          console.warn('⚠️ [知识库增强] 增强处理失败，不使用知识库增强:', enhancementError);
          knowledgeContext = '';
        }
      } else {
        console.log('ℹ️ [知识库增强] 当前角色未配置知识库');
      }

      // 🌐 [联网搜索] 根据开关 + LLM意图识别决定是否检索网络信息
      let webSearchContext = '';
      if (searchConfig?.enabled) {
        // 1) 先让 LLM 判定是否需要搜索，并给出建议查询词
        let needSearch = false;
        let queryToUse = userMessage;
        try {
          const decision = await decideWebSearchWithLLM(userMessage);
          needSearch = decision.need;
          if (decision.queries && decision.queries.length > 0) {
            queryToUse = decision.queries[0];
          }
        } catch (e) {
          console.warn('⚠️ [联网搜索] LLM判定失败，回退不触发搜索:', e);
          needSearch = false;
        }

        if (needSearch) {
          console.log('🌐 [联网搜索] LLM判定需要搜索，准备执行搜索');
          // 开始显示联网搜索指示
          setIsWebSearching(true);
        try {
          const apiBaseUrl = getApiBaseUrl();
          const params = new URLSearchParams();
          // 关键词：优先使用 LLM 给出的查询词（由后端统一处理编码）
          params.set('q', queryToUse);
          // 数量与安全搜索配置
          if (searchConfig?.maxResults) params.set('num', String(searchConfig.maxResults));
          if (searchConfig?.safeSearch) params.set('safe', searchConfig.safeSearch);
          // 语言与国家（如果提供）
          if (searchConfig?.language) params.set('hl', searchConfig.language);
          if (searchConfig?.country) params.set('gl', searchConfig.country);
          // 请求返回日期信息（包含可选 Last-Modified 回退）
          params.set('withDate', '1');
          // 可选：前端透传自定义 key/cx（若用户手动配置）
          if (searchConfig?.apiKey?.trim()) params.set('key', searchConfig.apiKey.trim());
          if (searchConfig?.engineId?.trim()) params.set('cx', searchConfig.engineId.trim());

          const searchUrl = `${apiBaseUrl}/api/search?${params.toString()}`;
          const res = await fetch(searchUrl, {
            headers: {
              // 后端会校验此密钥（开发环境可为空字符串）
              'x-api-key': import.meta.env.VITE_API_SECRET || ''
            }
          });
          if (!res.ok) {
            const errText = await res.text().catch(() => '');
            console.warn('⚠️ [联网搜索] 搜索接口返回非200:', res.status, errText);
          } else {
            const data = await res.json();
            const items = Array.isArray(data?.items) ? data.items : [];
            if (items.length > 0) {
              const topItems = items.slice(0, searchConfig?.maxResults || 5);
              const formatted = topItems.map((it: any, idx: number) => {
                const title = (it?.title || it?.link || '').toString();
                const link = (it?.link || '').toString();
                const snippetRaw = (it?.snippet || it?.htmlSnippet || '') as string;
                const snippet = snippetRaw.replace(/\s+/g, ' ').trim();
                const dateTxt = it?.date ? (() => {
                  try { return new Date(it.date).toISOString().slice(0, 10); } catch { return String(it.date).slice(0, 10); }
                })() : '未知';
                return `${idx + 1}. ${title}\n链接：${link}\n日期：${dateTxt}\n摘要：${snippet}`;
              }).join('\n\n');
              webSearchContext = `[联网搜索结果]\n${formatted}\n[/联网搜索结果]`;
              console.log('✅ [联网搜索] 成功获取并格式化搜索结果:', {
                count: items.length,
                usedCount: topItems.length
              });
            } else {
              console.log('ℹ️ [联网搜索] 未返回有效搜索结果');
            }
          }
        } catch (searchErr) {
          console.warn('⚠️ [联网搜索] 搜索流程出现异常，不影响对话生成:', searchErr);
        } finally {
          // 结束联网搜索指示
          setIsWebSearching(false);
        }
        } else {
          console.log('ℹ️ [联网搜索] LLM 判定不需要搜索，已跳过');
        }
      } else {
        console.log('ℹ️ [联网搜索] 智能联网已关闭，跳过搜索');
      }

      // 构建分离的系统消息
      const systemMessages = buildSystemMessages(currentRole, globalPrompts, currentUserProfile, knowledgeContext);

      // 注入当前日期与时区信息，避免模型因缺失来源日期而误判
      try {
        const now = new Date();
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'local';
        const dateContext = `[当前日期信息]\n现在是：${now.toISOString()}（${tz}）\n在使用联网搜索结果时，若某条结果未提供发布日期或更新日期，请避免自行推断并明确标注“日期未知”。\n[/当前日期信息]`;
        systemMessages.push({ role: 'system', content: dateContext });
      } catch {}

      // 将联网搜索上下文作为独立的system消息追加（若有）
      if (webSearchContext && webSearchContext.trim()) {
        systemMessages.push({ role: 'system', content: webSearchContext });
      }
      
      // 构建消息历史
      const messages = [];
      
      // 添加所有系统消息
      messages.push(...systemMessages);
      
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
          // Claude需要将多个系统消息合并为单个系统提示词
          const claudeSystemMessages = messages.filter(m => m.role === 'system');
          if (claudeSystemMessages.length > 0) {
            body.system = claudeSystemMessages.map(m => m.content).join('\n\n');
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
            // Gemini需要将多个系统消息合并为单个系统指令
            const geminiSystemMessages = messages.filter(m => m.role === 'system');
            if (geminiSystemMessages.length > 0) {
              body.systemInstruction = {
                parts: [{ text: geminiSystemMessages.map(m => m.content).join('\n\n') }]
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
                    

                  }
                  
                  // OpenAI/Custom解析结果
                } else if (currentModel.provider === 'kimi') {
                  content = parsed.choices?.[0]?.delta?.content || '';
                  
                  // 处理图片数据
                  if (parsed.choices?.[0]?.delta?.images) {
                    const rawImages = parsed.choices[0].delta.images;

                    
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
                    

                  }
                  
                  // Kimi解析结果
                } else if (currentModel.provider === 'deepseek') {
                  content = parsed.choices?.[0]?.delta?.content || '';
                  // 检查是否是DeepSeek的reasoning模型响应
                  reasoningContent = parsed.choices?.[0]?.delta?.reasoning_content || '';
                  
                  // 处理图片数据
                  if (parsed.choices?.[0]?.delta?.images) {
                    const rawImages = parsed.choices[0].delta.images;

                    
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
                    

                  }
                  
                  // DeepSeek解析结果
                } else if (currentModel.provider === 'claude') {
                  if (parsed.type === 'content_block_delta') {
                    content = parsed.delta?.text || '';
                  }
                  
                  // 处理图片数据
                  if (parsed.delta?.images) {
                    const rawImages = parsed.delta.images;

                    
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
                    

                  }
                  
                  // Claude解析结果
                } else if (currentModel.provider === 'gemini') {
                  content = parsed.candidates?.[0]?.content?.parts?.[0]?.text || '';
                  
                  // 处理图片数据
                  if (parsed.candidates?.[0]?.content?.parts) {
                    const parts = parsed.candidates[0].content.parts;
                    const imageParts = parts.filter((part: any) => part.inline_data);
                    if (imageParts.length > 0) {

                      images = imageParts.map((part: any) => {
                        if (part.inline_data && part.inline_data.data) {
                          return `data:${part.inline_data.mime_type};base64,${part.inline_data.data}`;
                        }
                        return null;
                      }).filter(Boolean);

                    }
                  }
                  
                  // Gemini解析结果
                }



                // 累积图片数据
                if (images && images.length > 0) {

                  
                  currentImages = [...currentImages, ...images];
                  

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
      
      // 检查是否需要生成标题，并根据配置选择模型
      if (checkSessionNeedsTitle(sessionId)) {
        if (!effectiveAssistantConfig?.enabled) {
          // 若已关闭自动标题，则清除标记
          removeSessionNeedsTitle(sessionId);
        } else {
          let titleModelConfig = currentModel;
          if (effectiveAssistantConfig?.strategy === 'custom' && effectiveAssistantConfig?.modelId) {
            titleModelConfig = llmConfigs.find(m => m.id === effectiveAssistantConfig.modelId) || titleModelConfig;
          } else {
            const followModelId = currentSession?.modelId || currentModelId || titleModelConfig?.id;
            titleModelConfig = llmConfigs.find(m => m.id === followModelId) || titleModelConfig;
          }

          if (titleModelConfig) {
            generateSessionTitle(sessionId, titleModelConfig)
              .then(() => {
                removeSessionNeedsTitle(sessionId);
              })
              .catch(() => {
                // 即使失败也要清除标记，避免重复尝试
                removeSessionNeedsTitle(sessionId);
              });
          } else {
            // 找不到模型也清除标记，避免卡住
            removeSessionNeedsTitle(sessionId);
          }
        }
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

    
    if (!currentSession || !currentModel || !currentRole || isLoading) {

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

      // 构建分离的系统消息
      const systemMessages = buildSystemMessages(currentRole, globalPrompts, currentUserProfile);
      
      // 构建消息历史
      const messages = [];
      
      // 添加分离的系统消息
      messages.push(...systemMessages);
      
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
      

      
      const newContent = typeof result === 'string' ? result : result.content;
      const newImages = typeof result === 'object' ? result.images : undefined;
      

      
      console.log('🔄 重新生成完成，准备添加新版本:', {
        messageId: messageId.substring(0, 8) + '...',
        originalContentLength: originalContent.length,
        newContentLength: newContent.length,
        hasImages: newImages && newImages.length > 0
      });

      // 完成生成后，添加为新版本（传入原始内容和图片数据）

      
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
        const claudeSystemMessages = messages.filter(m => m.role === 'system');
        body = {
          model: currentModel.model,
          messages: messages.filter(m => m.role !== 'system'),
          max_tokens: currentModel.maxTokens,
          temperature: currentModel.temperature,
          stream: true
        };
        if (claudeSystemMessages.length > 0) {
          body.system = claudeSystemMessages.map(m => m.content).join('\n\n');
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
          const geminiSystemMessages = messages.filter(m => m.role === 'system');
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
          if (geminiSystemMessages.length > 0) {
            body.systemInstruction = {
              parts: [{ text: geminiSystemMessages.map(m => m.content).join('\n\n') }]
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

      
      while (true) {

        const { done, value } = await reader.read();
        
        if (done) {

          break;
        }

        const chunk = decoder.decode(value, { stream: true });

        
        const lines = chunk.split('\n');


        for (const line of lines) {

          
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim();
            
            if (data === '[DONE]') {
              console.log('🏁 [流式结束] 接收到[DONE]标记');
              continue;
            }

            try {

              const parsed = JSON.parse(data);
              let content = '';
              let reasoningContent = '';
              let images: string[] = [];



              // 根据不同provider解析响应
              if (currentModel.provider === 'openai' || currentModel.provider === 'custom' || currentModel.provider === 'openrouter') {
                content = parsed.choices?.[0]?.delta?.content || '';
                // 检查是否是DeepSeek的reasoning模型响应
                reasoningContent = parsed.choices?.[0]?.delta?.reasoning_content || '';
                
                // 统一的图片数据检测和处理逻辑
                let rawImages = null;
                
                // 首先检查delta.images（标准位置）
                if (parsed.choices?.[0]?.delta?.images) {
                  rawImages = parsed.choices[0].delta.images;
                }
                // 检查choice级别的images
                else if (parsed.choices?.[0]?.images) {
                  rawImages = parsed.choices[0].images;

                }
                // 检查顶级images
                else if (parsed.images) {
                  rawImages = parsed.images;

                }
                // 检查message级别的images
                else if (parsed.choices?.[0]?.message?.images) {
                  rawImages = parsed.choices[0].message.images;

                }
                else {

                }
                
                // 🔍 [关键修复] 统一处理图片数据
                if (rawImages) {

                  
                  // 处理不同格式的图片数据
                  if (Array.isArray(rawImages)) {
                    images = rawImages.map((img: any, index: number) => {
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
                    }).filter(Boolean); // 过滤掉null值
                  } else if (typeof rawImages === 'string') {
                    images = [rawImages];
                  } else {
                    images = [rawImages];
                  }
                }
              } else if (currentModel.provider === 'kimi') {
                content = parsed.choices?.[0]?.delta?.content || '';
                if (parsed.choices?.[0]?.delta?.images) {
                  const rawImages = parsed.choices[0].delta.images;
                  
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
                }
              } else if (currentModel.provider === 'deepseek') {
                content = parsed.choices?.[0]?.delta?.content || '';
                // 检查是否是DeepSeek的reasoning模型响应
                reasoningContent = parsed.choices?.[0]?.delta?.reasoning_content || '';
                if (parsed.choices?.[0]?.delta?.images) {
                  const rawImages = parsed.choices[0].delta.images;
                  
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
                }
              } else if (currentModel.provider === 'claude') {
                if (parsed.type === 'content_block_delta') {
                  content = parsed.delta?.text || '';
                }
                // Claude可能在其他地方包含图片数据
                if (parsed.delta?.images) {
                  const rawImages = parsed.delta.images;
                  
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
                }
              } else if (currentModel.provider === 'gemini') {
                content = parsed.candidates?.[0]?.content?.parts?.[0]?.text || '';
                // Gemini的图片数据可能在parts中
                const parts = parsed.candidates?.[0]?.content?.parts || [];
                const imageParts = parts.filter((part: any) => part.images);
                if (imageParts.length > 0) {
                  const rawImages = imageParts.flatMap((part: any) => part.images);
                  
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
                  currentImages.push(...images);
                }
                
                // 重新生成模式：只显示流式效果，不更新versions
                // 临时更新消息内容以显示流式效果，但不触发versions更新
                 
                 // 创建要设置的images值（流式过程中）
                 const streamingImagesToSet = currentImages.length > 0 ? [...currentImages] : undefined;
                 
                // 🔧 [关键修复] 流式过程中也使用函数式更新确保状态一致性
                useAppStore.setState((state) => {
                  const updatedSessions = state.chatSessions.map(s => {
                    if (s.id !== sessionId) return s;
                    
                    const updatedMessages = s.messages.map(m => {
                      if (m.id !== messageId) return m;
                      
                      const updatedMessage = {
                        ...m,
                        content: currentContent,
                        reasoningContent: currentReasoningContent,
                        images: streamingImagesToSet,
                        isStreaming: true,
                        isReasoningComplete: isFirstContent
                        // 注意：不更新versions字段，保持原有版本历史
                      };
                      
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
    const finalImagesToSet = currentImages.length > 0 ? [...currentImages] : undefined;
    
    // 🔧 [关键修复] 使用函数式更新确保状态一致性
    useAppStore.setState((state) => {

      
      const updatedSessions = state.chatSessions.map(s => {
        if (s.id !== sessionId) return s;
        

        
        const updatedMessages = s.messages.map(m => {
          if (m.id !== messageId) return m;
          

          
          // 🔧 [关键修复] 确保images字段正确设置
          
          const updatedMessage = {
            ...m,
            content: currentContent,
            reasoningContent: currentReasoningContent,
            images: finalImagesToSet || [], // 确保images始终是数组
            isStreaming: false,
            isReasoningComplete: true
            // 注意：不更新versions字段，保持原有版本历史
          };
          

          
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
      
      return newState;
    });
    
    // 验证状态更新后的实际数据
    const updatedState = useAppStore.getState();
    const updatedSession = updatedState.chatSessions.find(s => s.id === sessionId);
    const updatedMessage = updatedSession?.messages.find(m => m.id === messageId);
    
    console.log('✅ 重新生成流式输出完成，内容长度:', currentContent.length);
    
    // 检查是否需要生成标题（重新生成时也可能需要）
    if (checkSessionNeedsTitle(sessionId)) {
      if (!effectiveAssistantConfig?.enabled) {
        removeSessionNeedsTitle(sessionId);
      } else {
        let titleModelConfig = currentModel;
        if (effectiveAssistantConfig?.strategy === 'custom' && effectiveAssistantConfig?.modelId) {
          titleModelConfig = llmConfigs.find(m => m.id === effectiveAssistantConfig.modelId) || titleModelConfig;
        } else {
          const followModelId = currentSession?.modelId || currentModelId || titleModelConfig?.id;
          titleModelConfig = llmConfigs.find(m => m.id === followModelId) || titleModelConfig;
        }

        if (titleModelConfig) {
          generateSessionTitle(sessionId, titleModelConfig)
            .then(() => {
              removeSessionNeedsTitle(sessionId);
            })
            .catch(() => {
              removeSessionNeedsTitle(sessionId);
            });
        } else {
          removeSessionNeedsTitle(sessionId);
        }
      }
    }
    
    // 请求完成后清理 AbortController
    abortControllerRef.current = null;
    setIsGenerating(false);



    return { content: currentContent, images: currentImages };
  };

  // 处理键盘事件
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (sendMessageShortcut === 'ctrlEnter') {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        handleSendMessage();
      }
    } else {
      // enter 直接发送，Shift+Enter 允许换行
      if (e.key === 'Enter') {
        if (e.shiftKey) return;
        e.preventDefault();
        handleSendMessage();
      }
    }
  };

  // 保持在 /chat 首屏，提供输入框与收藏助手选择，不再跳转角色选择器

  return (
    <div className={cn(
      "chat-container flex flex-col h-full bg-base-100",
      (!currentSession || currentSession.messages.length === 0) && "justify-center hero-bg-img"
    ) 
    }>
      {/* 消息列表 */}
      <div 
        ref={scrollMaskRef}
        className={cn(
          "flex-1 overflow-y-auto p-4 space-y-4 flex justify-end",
          scrollMaskClasses,
          "md:[--gradient-mask-padding:2rem]"
        )}
      >
        <div className={cn(
          'max-w-3xl mx-auto w-full pb-12',
          (!currentSession || !currentSession.messages || currentSession.messages.length === 0) ? " h-full" : "h-fit",
           chatStyle === 'document' && 'px-4'
           )}>
        {(!currentSession || !currentSession.messages || currentSession.messages.length === 0) ? (
          <div className={cn(
            'flex flex-col items-center text-base-content/60 h-full',
            (!currentSession) ? "justify-end" : "justify-center"
            )}>
            <h3 className={cn(
              (!currentSession) ? "text-primary text-3xl" : "text-black/30 text-2xl"
            )}>
              {(currentSession)
                ? `Hi，我是${currentRole?.name || 'AI助手'}`
                : (user
                  ? `Hi，${
                      currentUser?.name ||
                      (user as any)?.user_metadata?.display_name ||
                      (user as any)?.user_metadata?.nickname ||
                      (user as any)?.user_metadata?.name ||
                      (user as any)?.user_metadata?.full_name ||
                      '用户'
                    }`
                  : 'Hi，聊点什么？'
                )}
            </h3>
          </div>
        ) : (
          <>
            {/* 联网搜索进度指示：移至助手对话气泡内显示 */}
            {currentSession.messages
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
                       // 为兼容旧消息或缺失标记的情况：
                       // 1) 若 isReasoningComplete 已存在，直接使用
                       // 2) 若缺失，则当正文已出现或消息不在流式状态时视为已完成
                       isComplete={msg.isReasoningComplete ?? (!!msg.content || !msg.isStreaming)}
                     />
                   )}

                  {/* 联网搜索进度指示：当助手消息占位符正在生成且触发了联网搜索时，显示在气泡内 */}
                  {msg.role === 'assistant' && msg.isStreaming && isWebSearching && (
                    <div className="mb-2 flex items-center gap-2 text-xs text-base-content/70">
                      <Loader2 className="w-3 h-3 animate-spin text-primary" />
                      <span>正在联网搜索…</span>
                      <progress className="progress progress-primary w-24" />
                    </div>
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
                  {msg.images && msg.images.length > 0 && (
                    <div className="mt-3 space-y-2">
                      {msg.images.map((imageData, index) => (
                        <div key={index} className="relative">
                          <img
                            src={imageData.startsWith('data:') ? imageData : `data:image/png;base64,${imageData}`}
                            alt={`Generated image ${index + 1}`}
                            className="max-w-full h-auto rounded-lg shadow-md border border-base-300"
                            style={{ maxHeight: '400px' }}
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                            }}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {msg.isStreaming && !isWebSearching && (
                    <Loader2 className="h-4 w-4 animate-spin mt-2" />
                  )}

                {/* 操作按钮组 - hover时显示或移动端点击显示 */}
                <div className={cn(
                  'absolute flex gap-1 p-1 bg-base-100 text-base-content rounded-[var(--radius-box)] transition-opacity duration-200 z-10 backdrop-blur-sm shadow-sm',
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
                        className="btn btn-sm btn-circle btn-ghost h-7 w-7"
                        title="重新生成"
                        disabled={isLoading}
                        onClick={() => handleRegenerateMessage(msg.id)}
                      >
                        <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
                      </button>
                    ) : null;
                  })()}
                  
                  {/* 编辑按钮 */}
                  <button
                    className="btn btn-sm btn-circle btn-ghost h-7 w-7"
                    title="编辑"
                    onClick={() => {
                      setEditingMessageId(msg.id);
                      setEditingContent(msg.content);
                      setIsEditModalOpen(true);
                    }}
                  >
                    <Edit3 className="h-4 w-4 " />
                  </button>
                  
                  {/* 删除按钮 */}
                  <Popconfirm
                    title="确定将此消息移至回收站？"
                    onConfirm={async () => {
                      try {
                        await deleteMessage(currentSession!.id, msg.id);
                        toast.success('消息已移至回收站');
                      } catch (error) {
                        console.error('删除消息失败:', error);
                        toast.error('删除消息失败，请重试');
                      }
                    }}
                  >
                    <button
                      className="btn btn-sm btn-circle btn-ghost h-7 w-7"
                      title="移至回收站"
                    >
                      <Trash2 className="h-4 w-4 " />
                    </button>
                  </Popconfirm>
                  
                  {/* 朗读按钮 - 仅对AI消息显示 */}
                  {msg.role === 'assistant' && (
                    <button
                      className={cn(
                        "btn btn-sm btn-circle btn-ghost h-7 w-7",
                        voicePlayingState.isPlaying && voicePlayingState.currentMessageId === msg.id
                          ? "text-primary hover:bg-primary/10"
                          : " hover:bg-black/10"
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
                          className="btn btn-sm btn-circle btn-ghost h-7 w-7"
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
                          className="btn btn-sm btn-circle btn-ghost h-7 w-7"
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
                  'absolute flex gap-1 p-1 bg-base-100 text-base-content rounded-[var(--radius-box)] transition-opacity duration-200 z-10 backdrop-blur-sm shadow-sm',
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
                        className="btn btn-sm btn-circle btn-ghost h-7 w-7"
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
                        className="btn btn-sm btn-circle btn-ghost h-7 w-7"
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

          ))}
          </>
        )}
        <div ref={messagesEndRef} />
        </div>
      </div>

      {/* 输入区域 */}
      <div className={cn('p-4 pt-0', (!currentSession) && "flex-1 pb-[calc(50vh-10rem)]")}>
        <div className="chat-input max-w-3xl mx-auto">
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

              {/* 聊天选项（角色选择 + 联网设定） */}
              <div className="dropdown dropdown-top">
                {/* 图标型按钮：调节 */}
                <div tabIndex={0} role="button" className="btn btn-xs btn-ghost h-8 min-h-8" title="聊天选项">
                  <SlidersHorizontal className="w-4 h-4 text-base-content/60" />
                </div>
                {/* tips 弹窗内容 */}
                <div tabIndex={0} className="dropdown-content z-[1] shadow bg-base-100 rounded-box p-4 w-64 space-y-2">
                  {/* 联网开关 */}
                  <div className="flex items-center justify-between py-1">
                    <div className="flex items-center gap-2 text-sm">
                      <Globe className="w-4 h-4 text-base-content/60" />
                      <span>智能联网</span>
                    </div>
                    <input
                      type="checkbox"
                      className="toggle toggle-primary toggle-sm"
                      checked={!!searchConfig?.enabled}
                      onChange={(e) => {
                        updateSearchConfig({ enabled: e.target.checked });
                        (document.activeElement as HTMLElement)?.blur();
                        toast.success(e.target.checked ? '已启用智能联网' : '已关闭联网');
                      }}
                    />
                  </div>

                  {/* 角色选择（内联选择器） */}
                  <div className="flex items-center justify-between py-1">
                    <div className="flex items-center gap-2 text-sm">
                      <Users className="w-4 h-4 text-base-content/60" />
                      <span>角色</span>
                    </div>
                    <select
                      className="select select-sm select-ghost w-auto"
                      value={selectedRoleId ?? (aiRoles[0]?.id ?? '')}
                      onChange={(e) => {
                        setSelectedRoleId(e.target.value);
                        (document.activeElement as HTMLElement)?.blur();
                      }}
                    >
                      {aiRoles.map((role) => (
                        <option key={role.id} value={role.id}>
                          {role.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
              {/* 收藏助手下拉已移除，改为输入框下方按钮组 */}
              </div>

          </div>
          
          {/* 右下角按钮组 */}
          <div className="flex space-x-2">
            {/* 模型选择器 */}
            <div className="dropdown dropdown-top dropdown-end">
              <div tabIndex={0} role="button" className="btn btn-xs btn-ghost h-8 min-h-8 font-normal" title="选择模型">
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
      {/* 编辑消息模态框：常规尺寸 */}
      <dialog 
        ref={editDialogRef}
        className="modal"
        onClose={() => {
          setIsEditModalOpen(false);
          setEditingMessageId(null);
          setEditingContent('');
        }}
      >
        <div className="modal-box max-w-2xl w-full p-0">
          <div className="flex items-center justify-between p-6">
            <h2 className="text-xl font-bold text-base-content">编辑消息</h2>
            <form method="dialog">
              <button className="btn btn-sm btn-circle btn-ghost" title="关闭">
                <X className="h-5 w-5" />
              </button>
            </form>
          </div>

          <div className="px-6 pb-4">
            <fieldset className="fieldset floating-label">
              <span className="label">消息内容</span>
              <textarea
                value={editingContent}
                onChange={(e) => setEditingContent(e.target.value)}
                rows={6}
                className="textarea textarea-bordered w-full"
                placeholder="编辑消息内容..."
              />
            </fieldset>
          </div>

          <div className="modal-action px-6 pb-6">
            <form method="dialog">
              <button
                className="btn btn-ghost"
                onClick={() => {
                  setIsEditModalOpen(false);
                  setEditingMessageId(null);
                  setEditingContent('');
                }}
              >
                取消
              </button>
            </form>
            <form
              method="dialog"
              onSubmit={(e) => {
                e.preventDefault();
                if (!editingMessageId || !editingContent.trim()) return;
                try {
                  updateMessage(currentSession!.id, editingMessageId, editingContent.trim());
                  toast.success('消息已更新');
                } finally {
                  setIsEditModalOpen(false);
                  setEditingMessageId(null);
                  setEditingContent('');
                }
              }}
            >
              <button className="btn btn-primary" type="submit">保存</button>
            </form>
          </div>
        </div>
        <form method="dialog" className="modal-backdrop">
          <button>close</button>
        </form>
      </dialog>

      {/* 收藏助手快捷按钮已移除：改为 tips 中的内联角色选择器 */}
      </div>
    </div>
  );
};

export default ChatPage;
