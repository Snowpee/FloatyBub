import React, { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAppStore } from '../store';
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
import { replaceTemplateVariables } from '../utils/templateUtils';
import { useAnimatedText } from '../components/AnimatedText';
import { getDefaultBaseUrl } from '../utils/providerUtils';

const ChatPage: React.FC = () => {
  const { sessionId } = useParams();
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState('');
  const [visibleActionButtons, setVisibleActionButtons] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const {
    currentSessionId,
    chatSessions,
    aiRoles,
    userProfiles,
    llmConfigs,
    currentModelId,
    tempSessionId,
    globalPrompts,
    currentUserProfile,
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
    setCurrentModel
  } = useAppStore();

  // 获取启用的模型
  const enabledModels = llmConfigs.filter(m => m.enabled);

  // 获取当前会话
  const currentSession = chatSessions.find(s => s.id === (sessionId || currentSessionId));
  // 临时会话和正式会话使用相同的角色获取逻辑
  const isTemporarySession = tempSessionId === currentSession?.id;
  
  // 简化的角色获取逻辑：优先使用会话角色，然后回退到第一个可用角色
  const getCurrentRole = () => {
    console.log('🔍 getCurrentRole 调用:', {
      sessionId: currentSession?.id,
      sessionRoleId: currentSession?.roleId,
      aiRolesCount: aiRoles.length,
      tempSessionId
    });
    
    let role = null;
    
    // 优先使用当前会话的roleId
    if (currentSession?.roleId) {
      role = aiRoles.find(r => r.id === currentSession.roleId);
      console.log('🔍 使用会话角色:', role?.name || 'NOT_FOUND');
    }
    
    // 如果会话角色不存在，回退到第一个可用角色
    if (!role && aiRoles.length > 0) {
      role = aiRoles[0];
      console.log('🔍 使用第一个角色:', role?.name || 'NOT_FOUND');
    }
    
    console.log('🔍 最终角色:', role?.name || 'NONE');
    return role;
  };
  
  const currentRole = getCurrentRole();
  const currentModel = currentSession ? llmConfigs.find(m => m.id === currentSession.modelId) : llmConfigs.find(m => m.id === currentModelId);

  // 如果有sessionId参数，设置为当前会话
  useEffect(() => {
    if (sessionId && sessionId !== currentSessionId) {
      setCurrentSession(sessionId);
    }
  }, [sessionId, currentSessionId, setCurrentSession]);
  
  // 组件卸载时清理未使用的临时会话
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    
    const cleanup = () => {
      // 延迟执行清理逻辑，避免在快速切换时误删会话
      timeoutId = setTimeout(() => {
        const state = {
          tempSessionId,
          currentSession,
          currentSessionId
        };
        
        // 只有在确实需要清理时才删除临时会话
        // 1. 必须存在临时会话ID
        // 2. 临时会话确实存在
        // 3. 临时会话没有用户消息
        // 4. 临时会话不是当前活跃会话（避免删除正在使用的会话）
        if (state.tempSessionId && 
            state.currentSession && 
            state.tempSessionId === state.currentSession.id &&
            !state.currentSession.messages.some(m => m.role === 'user') &&
            state.currentSessionId !== state.tempSessionId) {
          deleteTempSession();
        }
      }, 200); // 增加延迟时间，确保状态稳定
    };
    
    return () => {
      cleanup();
      // 清理定时器，避免内存泄漏
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, []); // 移除依赖项，避免重复注册清理逻辑

  // 自动滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [currentSession?.messages]);

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



  // 创建新会话
  const navigate = useNavigate();
  
  // 动态placeholder文本
  const animatedPlaceholder = useAnimatedText({ 
    isAnimating: isGenerating, 
    baseText: '回复中', 
    staticText: '输入消息...' 
  });
  


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

    // 添加用户消息
    addMessage(currentSession.id, {
      role: 'user',
      content: userMessage,
      timestamp: new Date()
    });

    // 添加AI消息占位符
    const aiMessageId = Math.random().toString(36).substr(2, 9);
    
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
      console.error('发送消息失败:', error);
      
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
    if (role.globalPromptId) {
      const globalPrompt = globalPrompts.find(p => p.id === role.globalPromptId);
      if (globalPrompt && globalPrompt.prompt.trim()) {
        const processedPrompt = replaceTemplateVariables(globalPrompt.prompt.trim(), userName, charName);
        parts.push(`[全局设置：${processedPrompt}]`);
      }
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

    // 关键节点：LLM开始回复
    console.log('🚀 LLM开始回复');

    try {
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
          // Gemini使用特殊的API格式
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

                // 简化的API响应日志

                // 根据不同provider解析响应
                if (currentModel.provider === 'openai' || currentModel.provider === 'custom') {
                  content = parsed.choices?.[0]?.delta?.content || '';
                  // 检查是否是DeepSeek的reasoning模型响应
                  reasoningContent = parsed.choices?.[0]?.delta?.reasoning_content || '';
                  
                  // OpenAI/Custom解析结果
                } else if (currentModel.provider === 'kimi') {
                  content = parsed.choices?.[0]?.delta?.content || '';
                  // Kimi解析结果
                } else if (currentModel.provider === 'deepseek') {
                  content = parsed.choices?.[0]?.delta?.content || '';
                  // 检查是否是DeepSeek的reasoning模型响应
                  reasoningContent = parsed.choices?.[0]?.delta?.reasoning_content || '';
                  // DeepSeek解析结果
                } else if (currentModel.provider === 'claude') {
                  if (parsed.type === 'content_block_delta') {
                    content = parsed.delta?.text || '';
                  }
                  // Claude解析结果
                } else if (currentModel.provider === 'gemini') {
                  content = parsed.candidates?.[0]?.content?.parts?.[0]?.text || '';
                  // Gemini解析结果
                }

                // 关键节点：检测到内容开始
                if ((content || reasoningContent) && process.env.NODE_ENV === 'development') {
                  if (content && !currentContent) {
                    console.log('📝 正文内容开始输出');
                  }
                  if (reasoningContent && !currentReasoningContent) {
                    console.log('🧠 思考过程开始');
                  }
                }

                // 更新消息内容
                if (content || reasoningContent) {
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
                  
                  // 内容累积更新
                  updateMessageWithReasoning(
                    sessionId, 
                    messageId, 
                    currentContent || undefined,
                    currentReasoningContent || undefined,
                    true,
                    isFirstContent // 如果是第一次收到正文内容，立即标记思考过程完成
                  );
                }
              } catch (e) {
                // 忽略JSON解析错误
                console.warn('解析流数据失败:', e);
              }
            }
          }
        }
      } finally {
        reader.releaseLock();
      }

      // 关键节点：流式响应完成
      console.log('🏁 正文完成');
      
      updateMessageWithReasoning(
        sessionId, 
        messageId, 
        currentContent || undefined,
        currentReasoningContent || undefined,
        false,
        true
      );
      
      // 请求完成后清理 AbortController
      abortControllerRef.current = null;
      setIsGenerating(false);

    } catch (error) {
      console.error('AI API调用失败:', error);
      
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
      
      // 重置目标消息的状态，确保思考过程能正确展开
      updateMessageWithReasoning(
        currentSession.id,
        messageId,
        '', // 清空内容
        '', // 清空思考过程内容
        true, // 设置为流式状态
        false // 设置思考过程未完成
      );
      
      // 调用AI API生成新内容
      const newContent = await callAIAPIForRegeneration(messages, messageId, currentSession.id);

      // 完成生成后，添加为新版本（传入原始内容）
      addMessageVersionWithOriginal(currentSession.id, messageId, originalContent, newContent);
      
      toast.success('重新生成完成');
    } catch (error) {
      console.error('重新生成失败:', error);
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

    // ===== 添加重新生成 API 请求体调试信息 =====
    console.log('重新生成请求URL:', apiUrl);
    console.log('重新生成请求头:', JSON.stringify(headers, null, 2));
    console.log('重新生成请求体:', JSON.stringify(body, null, 2));
    console.log('===============================\n');
    // ===== 重新生成 API 请求体调试信息结束 =====

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

              // 根据不同provider解析响应
              if (currentModel.provider === 'openai' || currentModel.provider === 'custom') {
                content = parsed.choices?.[0]?.delta?.content || '';
                // 检查是否是DeepSeek的reasoning模型响应
                reasoningContent = parsed.choices?.[0]?.delta?.reasoning_content || '';
              } else if (currentModel.provider === 'kimi') {
                content = parsed.choices?.[0]?.delta?.content || '';
              } else if (currentModel.provider === 'deepseek') {
                content = parsed.choices?.[0]?.delta?.content || '';
                // 检查是否是DeepSeek的reasoning模型响应
                reasoningContent = parsed.choices?.[0]?.delta?.reasoning_content || '';
              } else if (currentModel.provider === 'claude') {
                if (parsed.type === 'content_block_delta') {
                  content = parsed.delta?.text || '';
                }
              } else if (currentModel.provider === 'gemini') {
                content = parsed.candidates?.[0]?.content?.parts?.[0]?.text || '';
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
              if (content || reasoningContent) {
                // 检测到正文内容开始时，立即标记思考过程完成
                const isFirstContent = content && !currentContent;
                
                if (content) {
                  currentContent += content;
                }
                if (reasoningContent) {
                  currentReasoningContent += reasoningContent;
                }
                
                // 内容累积更新
                updateMessageWithReasoning(
                  sessionId, 
                  messageId, 
                  currentContent || undefined,
                  currentReasoningContent || undefined,
                  true,
                  isFirstContent // 如果是第一次收到正文内容，立即标记思考过程完成
                );
              }
            } catch (e) {
              // 忽略JSON解析错误
              console.warn('解析流数据失败:', e);
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    // 关键节点：流式响应完成
    console.log('🏁 重新生成完成');
    
    updateMessageWithReasoning(
      sessionId, 
      messageId, 
      currentContent || undefined,
      currentReasoningContent || undefined,
      false,
      true
    );
    
    // 请求完成后清理 AbortController
    abortControllerRef.current = null;
    setIsGenerating(false);

    return currentContent;
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
      <div className="flex-1 overflow-y-auto p-4 pb-10 space-y-4 gradient-mask-y [--gradient-mask-padding:1rem] md:[--gradient-mask-padding:2rem]">
        <div className="max-w-6xl mx-auto">
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
          currentSession?.messages.map((msg) => (
            <div
              key={msg.id}
              className={cn(
                'mb-2 chat',
                msg.role === 'user' ? 'chat-end' : 'chat-start'
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
                    // 根据消息的userProfileId获取对应的用户资料
                    const messageUserProfile = msg.userProfileId ? userProfiles.find(p => p.id === msg.userProfileId) : currentUserProfile;
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
                  })()
                )}              </div>
              
              <div className="group relative">
                <div
                  className={cn(
                    'chat-bubble max-w-xs lg:max-w-md xl:max-w-lg cursor-pointer md:cursor-default',
                    'min-h-fit h-auto flex flex-col',
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
                  {/* 显示思考过程 - 对AI消息且支持思考过程时显示 */}
                   {msg.role === 'assistant' && (msg.reasoningContent !== undefined) && (
                     <ThinkingProcess 
                       content={msg.reasoningContent}
                       isComplete={msg.isReasoningComplete || false}
                     />
                   )}
                  
                  <MarkdownRenderer content={replaceTemplateVariables(
                    msg.content,
                    currentUserProfile?.name || '用户',
                    currentRole?.name || 'AI助手'
                  )} />
                  {msg.isStreaming && (
                    <Loader2 className="h-4 w-4 animate-spin mt-2" />
                  )}
                </div>
                
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
                          className="w-full p-2 border border-gray-300 rounded-md resize-none text-sm"
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
                    onConfirm={() => {
                      deleteMessage(currentSession!.id, msg.id);
                      toast.success('消息已删除');
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
                      className="p-1 rounded text-gray-500 hover:bg-black/10 transition-colors"
                      title="朗读"
                      onClick={() => {
                        // TODO: 实现朗读功能
                        console.log('朗读消息:', msg.id);
                      }}
                    >
                      <Volume2 className="h-4 w-4 " />
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
        <div className="chat-input max-w-6xl mx-auto">
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