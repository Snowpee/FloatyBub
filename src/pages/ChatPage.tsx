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
  Plus
} from 'lucide-react';
import { cn } from '../lib/utils';
import { toast } from 'sonner';
import RoleSelector from '../components/RoleSelector';
import MarkdownRenderer from '../components/MarkdownRenderer';
import Avatar from '../components/Avatar';
import { replaceTemplateVariables } from '../utils/templateUtils';

const ChatPage: React.FC = () => {
  const { sessionId } = useParams();
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const {
    currentSessionId,
    chatSessions,
    aiRoles,
    llmConfigs,
    currentRoleId,
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
    setCurrentRole,
    setCurrentModel
  } = useAppStore();

  // 获取启用的模型
  const enabledModels = llmConfigs.filter(m => m.enabled);

  // 获取当前会话
  const currentSession = chatSessions.find(s => s.id === (sessionId || currentSessionId));
  const currentRole = aiRoles.find(r => r.id === currentRoleId);
  const currentModel = llmConfigs.find(m => m.id === currentModelId);

  // 如果有sessionId参数，设置为当前会话
  useEffect(() => {
    if (sessionId && sessionId !== currentSessionId) {
      setCurrentSession(sessionId);
    }
  }, [sessionId, currentSessionId, setCurrentSession]);
  
  // 组件卸载时清理未使用的临时会话
  useEffect(() => {
    return () => {
      // 如果当前会话是临时会话且没有消息，则删除它
      if (tempSessionId && currentSession && currentSession.messages.length === 0) {
        deleteTempSession();
      }
    };
  }, [tempSessionId, currentSession, deleteTempSession]);

  // 自动滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [currentSession?.messages]);

  // 自动调整文本框高度
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [message]);

  // 创建新会话
  const navigate = useNavigate();
  
  const handleNewSession = () => {
    // 优先使用当前会话的角色和模型，如果没有当前会话则使用全局设置
    const roleId = currentSession?.roleId || currentRoleId;
    const modelId = currentSession?.modelId || currentModelId;
    
    if (!roleId || !modelId) {
      toast.error('请先配置AI角色和模型');
      return;
    }
    
    // 创建新的临时会话，使用当前会话的角色和模型
    const newSessionId = createTempSession(roleId, modelId);
    
    // 导航到新会话页面
    navigate(`/chat/${newSessionId}`);
    
    toast.success('已创建新会话');
  };

  // 发送消息
  const handleSendMessage = async () => {
    if (!message.trim() || isLoading) return;
    
    if (!currentSession) {
      handleNewSession();
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
    addMessage(currentSession.id, {
      id: aiMessageId,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      isStreaming: true
    });

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
          apiUrl = currentModel.baseUrl || 'https://generativelanguage.googleapis.com';
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

                // 根据不同provider解析响应
                if (currentModel.provider === 'openai' || currentModel.provider === 'custom') {
                  content = parsed.choices?.[0]?.delta?.content || '';
                } else if (currentModel.provider === 'claude') {
                  if (parsed.type === 'content_block_delta') {
                    content = parsed.delta?.text || '';
                  }
                } else if (currentModel.provider === 'gemini') {
                  content = parsed.candidates?.[0]?.content?.parts?.[0]?.text || '';
                }

                // 调试日志
                if (content) {
                  console.log('Received content:', content);
                }

                if (content) {
                  currentContent += content;
                  updateMessage(sessionId, messageId, currentContent);
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

      // 移除流式标记
      updateMessage(sessionId, messageId, currentContent, false);
      
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

  // 处理键盘事件
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
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
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div className="max-w-6xl mx-auto">
        {currentSession?.messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-base-content/60">
            <Bot className="h-16 w-16 mb-4" />
            <h3 className="text-xl font-medium mb-2">开始新的对话</h3>
            <p className="text-center max-w-md">
              选择一个AI角色和模型，然后开始与AI助手对话。
            </p>
          </div>
        ) : (
          currentSession?.messages.map((msg) => (
            <div
              key={msg.id}
              className={cn(
                'chat',
                msg.role === 'user' ? 'chat-end' : 'chat-start'
              )}
            >
              <div className="chat-image avatar">
                {msg.role === 'assistant' ? (
                  <Avatar
                    name={currentRole?.name || 'AI助手'}
                    avatar={currentRole?.avatar}
                    size="md"
                  />
                ) : (
                  currentUserProfile ? (
                    <Avatar
                      name={currentUserProfile.name}
                      avatar={currentUserProfile.avatar}
                      size="md"
                    />
                  ) : (
                    <div 
                      className="w-8 h-8 rounded-full bg-base-300 flex items-center justify-items-center content-center text-center">
                      <User className="h-4 w-4 text-accent" />
                    </div>
                  )
                )}              </div>
              
              <div
                className={cn(
                  'chat-bubble max-w-xs lg:max-w-md xl:max-w-lg',
                  msg.role === 'user'
                    ? 'chat-bubble-accent'
                    : ''
                )}
              >
                <MarkdownRenderer content={msg.content} />
                {msg.isStreaming && (
                  <Loader2 className="h-4 w-4 animate-spin mt-2" />
                )}
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
        </div>
      </div>

      {/* 输入区域 */}
      <div className="border-t border-base-300 p-4">
        {/* 输入框 - 单独一行 */}
        <div className="mb-3">
          <textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入消息..."
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
            {/* 新建会话按钮 */}
            <button
              onClick={handleNewSession}
              className="btn btn-ghost btn-sm"
              title="新建会话"
            >
              <Plus className="h-4 w-4" />
            </button>
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
  );
};

export default ChatPage;