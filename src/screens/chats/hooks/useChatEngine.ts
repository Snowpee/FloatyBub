import { useState, useRef, useCallback, useEffect } from 'react';
import { useAppStore } from '@/store';
import { useKnowledgeStore } from '@/store/knowledgeStore';
import { toast } from '@/hooks/useToast';
import { ChatEnhancementService } from '@/services/chatEnhancementService';
import { getDefaultBaseUrl } from '@/utils/providerUtils';
import { executeWebSearch, executeVisitPage, getToolsForProvider } from '@/tools';
import { stopCurrentVoice } from '@/utils/voiceUtils';
import { buildSystemMessages } from '../utils/chatUtils';
import { useUserData } from '@/hooks/useUserData';

interface UseChatEngineProps {
  sessionId?: string;
  currentSession: any;
  currentModel: any;
  currentRole: any;
  userProfile: any;
  agentSkills: any[];
  globalPrompts: any[];
  searchConfig: any;
  effectiveAssistantConfig: any;
  skillLoadStateRef: React.MutableRefObject<Map<string, { activeSkillIds: string[]; loadedPaths: string[] }>>;
  decideSkillsWithLLM: (text: string, role: any) => Promise<{ skillIds: string[]; confidence: number }>;
  decideSkillFilesWithLLM: (text: string, role: any, selectedSkillIds?: string[], alreadyLoadedPaths?: string[]) => Promise<{ paths: string[]; confidence: number }>;
  buildSkillFilesContext: (role: any, requestedPaths: string[], selectedSkillIds?: string[]) => string;
}

export const useChatEngine = ({
  sessionId,
  currentSession,
  currentModel,
  currentRole,
  userProfile,
  agentSkills,
  globalPrompts,
  searchConfig,
  effectiveAssistantConfig,
  skillLoadStateRef,
  decideSkillsWithLLM,
  decideSkillFilesWithLLM,
  buildSkillFilesContext
}: UseChatEngineProps) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const {
    updateChatSession,
    updateMessage,
    updateMessageWithReasoning,
    addMessageVersionWithOriginal,
    generateSessionTitle,
    removeSessionNeedsTitle,
    checkSessionNeedsTitle,
    llmConfigs,
    currentModelId,
  } = useAppStore();

  const { getRoleKnowledgeBase } = useKnowledgeStore();
  const { syncToCloud } = useUserData();

  const cleanupRequest = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, []);

  const stopGeneration = useCallback(() => {
    cleanupRequest();
    setIsGenerating(false);
    setIsLoading(false);
    stopCurrentVoice();
    toast.info('已停止生成');
  }, [cleanupRequest]);

  // 组件卸载时清理请求
  useEffect(() => {
    return () => {
      cleanupRequest();
    };
  }, [cleanupRequest]);

  const executeLLMLoop = async (initialMessages: any[], messageId: string, currentSessionId: string) => {
    // API调用准备
    const tools = searchConfig?.enabled ? getToolsForProvider(currentModel.provider) : undefined;
    
    let currentTurnMessages = [...initialMessages];
    let turnCount = 0;
    const MAX_TURNS = 5;
    
    cleanupRequest();
    abortControllerRef.current = new AbortController();

    let finalContent = '';
    let finalReasoning = '';
    let finalImages: string[] = [];

    try {
      while (turnCount < MAX_TURNS) {
          turnCount++;
          console.log(`🔄 [LLM Loop] Turn ${turnCount}/${MAX_TURNS}`);

          let apiUrl = '';
          let headers: Record<string, string> = {
            'Content-Type': 'application/json'
          };
          let body: any = {};

          switch (currentModel.provider) {
            case 'claude':
              apiUrl = currentModel.baseUrl || getDefaultBaseUrl('claude');
              if (!apiUrl.endsWith('/v1/messages')) {
                apiUrl = apiUrl.replace(/\/$/, '') + '/v1/messages';
              }
              headers['x-api-key'] = currentModel.apiKey;
              headers['anthropic-version'] = '2023-06-01';
              
              body = {
                model: currentModel.model,
                messages: currentTurnMessages.filter(m => m.role !== 'system'),
                max_tokens: currentModel.maxTokens,
                temperature: currentModel.temperature,
                stream: true
              };
              
              if (tools && tools.length > 0) {
                body.tools = tools;
              }

              const claudeSystemMessages = currentTurnMessages.filter(m => m.role === 'system');
              if (claudeSystemMessages.length > 0) {
                body.system = claudeSystemMessages.map(m => m.content).join('\n\n');
              }
              break;

            case 'gemini':
              if (currentModel.provider === 'gemini' && !currentModel.baseUrl?.includes('openrouter')) {
                apiUrl = currentModel.baseUrl || getDefaultBaseUrl('gemini');
                if (!apiUrl.includes('/v1beta/models/')) {
                  apiUrl = apiUrl.replace(/\/$/, '') + `/v1beta/models/${currentModel.model}:streamGenerateContent?key=${currentModel.apiKey}`;
                }
                body = {
                  contents: currentTurnMessages.filter(m => m.role !== 'system').map(m => ({
                    role: m.role === 'assistant' ? 'model' : 'user',
                    parts: [{ text: m.content }]
                  })),
                  generationConfig: {
                    temperature: currentModel.temperature,
                    maxOutputTokens: currentModel.maxTokens
                  }
                };
                
                if (tools && tools.length > 0) {
                   body.tools = [{ function_declarations: tools }];
                }

                const geminiSystemMessages = currentTurnMessages.filter(m => m.role === 'system');
                if (geminiSystemMessages.length > 0) {
                  body.systemInstruction = {
                    parts: [{ text: geminiSystemMessages.map(m => m.content).join('\n\n') }]
                  };
                }
              } else {
                apiUrl = currentModel.baseUrl || getDefaultBaseUrl(currentModel.provider);
                if (!apiUrl.endsWith('/v1/chat/completions')) {
                  apiUrl = apiUrl.replace(/\/$/, '') + '/v1/chat/completions';
                }
                headers['Authorization'] = `Bearer ${currentModel.apiKey}`;
                body = {
                  model: currentModel.model,
                  messages: currentTurnMessages,
                  temperature: currentModel.temperature,
                  max_tokens: currentModel.maxTokens,
                  stream: true
                };
                if (tools && tools.length > 0) {
                  body.tools = tools;
                  body.tool_choice = 'auto';
                }
              }
              break;

            default:
              apiUrl = currentModel.baseUrl || getDefaultBaseUrl(currentModel.provider);
              if (!apiUrl.endsWith('/v1/chat/completions')) {
                apiUrl = apiUrl.replace(/\/$/, '') + '/v1/chat/completions';
              }
              headers['Authorization'] = `Bearer ${currentModel.apiKey}`;
              body = {
                model: currentModel.model,
                messages: currentTurnMessages,
                temperature: currentModel.temperature,
                max_tokens: currentModel.maxTokens,
                stream: true
              };
              if (tools && tools.length > 0) {
                body.tools = tools;
                body.tool_choice = 'auto';
              }
          }

          if (currentModel.proxyUrl) {
            apiUrl = currentModel.proxyUrl;
          }

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
          if (!reader) throw new Error('无法读取响应流');

          const decoder = new TextDecoder();
          let currentContent = '';
          let currentReasoningContent = '';
          let currentImages: string[] = [];
          
          let toolCallAccumulator: any[] = [];

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

                    if (currentModel.provider === 'openai' || currentModel.provider === 'custom' || currentModel.provider === 'openrouter' || currentModel.provider === 'deepseek' || currentModel.provider === 'kimi') {
                      const delta = parsed.choices?.[0]?.delta;
                      content = delta?.content || '';
                      reasoningContent = delta?.reasoning_content || '';
                      
                      if (delta?.tool_calls) {
                         const toolCalls = delta.tool_calls;
                         for (const tc of toolCalls) {
                           const index = tc.index;
                           if (!toolCallAccumulator[index]) {
                             toolCallAccumulator[index] = { id: tc.id, type: tc.type, function: { name: '', arguments: '' } };
                           }
                           if (tc.id) toolCallAccumulator[index].id = tc.id;
                           if (tc.type) toolCallAccumulator[index].type = tc.type;
                           if (tc.function) {
                             if (tc.function.name) toolCallAccumulator[index].function.name += tc.function.name;
                             if (tc.function.arguments) toolCallAccumulator[index].function.arguments += tc.function.arguments;
                           }
                         }
                      }

                      if (delta?.images) {
                        const rawImages = delta.images;
                        if (Array.isArray(rawImages)) {
                          images = rawImages.map((img: any) => {
                             if (typeof img === 'string') return img;
                             if (img?.image_url?.url) return img.image_url.url;
                             if (img?.url) return img.url;
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
                    } else if (currentModel.provider === 'gemini') {
                      content = parsed.candidates?.[0]?.content?.parts?.[0]?.text || '';
                      
                      const parts = parsed.candidates?.[0]?.content?.parts || [];
                      for (const part of parts) {
                         if (part.functionCall) {
                           const fc = part.functionCall;
                           const callId = 'call_' + Math.random().toString(36).slice(2, 11);
                           toolCallAccumulator.push({
                             id: callId,
                             type: 'function',
                             function: {
                               name: fc.name,
                               arguments: JSON.stringify(fc.args)
                             }
                           });
                         }
                      }
                    } 
                    
                    if (content) currentContent += content;
                    if (reasoningContent) currentReasoningContent += reasoningContent;
                    if (images.length > 0) currentImages = [...currentImages, ...images];

                    if (content || reasoningContent || images.length > 0) {
                       const isFirstContent = !!content && !finalContent && !currentContent;
                       
                       updateMessageWithReasoning(
                          currentSessionId,
                          messageId,
                          (finalContent || '') + currentContent,
                          currentReasoningContent,
                          true,
                          isFirstContent,
                          currentImages.length > 0 ? currentImages : undefined
                        );
                    }

                  } catch (e) {}
                }
              }
            }
          } finally {
            reader.releaseLock();
          }

          const validToolCalls = toolCallAccumulator.filter(tc => tc.id && tc.function?.name);
          
          finalContent = currentContent;
          finalReasoning = currentReasoningContent;
          finalImages = currentImages;
          
          if (validToolCalls.length > 0) {
             if (!currentContent) {
                const isVisiting = validToolCalls.some(tc => tc.function.name === 'visit_page');
                const isSearching = validToolCalls.some(tc => tc.function.name === 'web_search');
                
                let statusMsg = '正在处理...';
                if (isVisiting) statusMsg = '正在访问链接...';
                else if (isSearching) statusMsg = '正在搜索网络...';
                
                updateMessage(currentSessionId, messageId, statusMsg, true);
             }
             
             const toolResults = await Promise.all(validToolCalls.map(async (tc: any) => {
                const name = tc.function.name;
                const argsStr = tc.function.arguments;
                let args: any = {};
                try { args = JSON.parse(argsStr); } catch (e) { console.error('Failed to parse tool args', e); }
                
                if (name === 'web_search') {
                   const result = await executeWebSearch(args.query, searchConfig, args.count);
                   return {
                     tool_call_id: tc.id,
                     role: 'tool',
                     name: name,
                     content: result
                   };
                } else if (name === 'visit_page') {
                   const result = await executeVisitPage(args.url);
                   return {
                     tool_call_id: tc.id,
                     role: 'tool',
                     name: name,
                     content: result
                   };
                }
                return {
                   tool_call_id: tc.id,
                   role: 'tool',
                   name: name,
                   content: 'Unknown tool'
                };
             }));
             
             currentTurnMessages.push({
               role: 'assistant',
               content: currentContent || null,
               tool_calls: validToolCalls,
               reasoning_content: currentReasoningContent || undefined
             } as any);
             
             currentTurnMessages.push(...toolResults);
             
             continue;
          } else {
             break;
          }
      }

      updateMessageWithReasoning(
        currentSessionId, 
        messageId, 
        finalContent || undefined,
        finalReasoning || undefined,
        false,
        true,
        finalImages.length > 0 ? finalImages : undefined
      );
      
      try {
        await syncToCloud();
      } catch (syncError) {}
      
      if (checkSessionNeedsTitle(currentSessionId)) {
        if (!effectiveAssistantConfig?.enabled) {
          removeSessionNeedsTitle(currentSessionId);
        } else {
          let titleModelConfig = currentModel;
          if (effectiveAssistantConfig?.strategy === 'custom' && effectiveAssistantConfig?.modelId) {
            titleModelConfig = llmConfigs.find((m: any) => m.id === effectiveAssistantConfig.modelId) || titleModelConfig;
          } else {
            const followModelId = currentSession?.modelId || currentModelId || titleModelConfig?.id;
            titleModelConfig = llmConfigs.find((m: any) => m.id === followModelId) || titleModelConfig;
          }

          if (titleModelConfig) {
            generateSessionTitle(currentSessionId, titleModelConfig)
              .then(() => {
                removeSessionNeedsTitle(currentSessionId);
              })
              .catch(() => {
                removeSessionNeedsTitle(currentSessionId);
              });
          } else {
            removeSessionNeedsTitle(currentSessionId);
          }
        }
      }
      
      return {
        content: finalContent,
        reasoning: finalReasoning,
        images: finalImages
      };

    } catch (error: any) {
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
      
      updateMessage(currentSessionId, messageId, `抱歉，发生了错误: ${errorMessage}`, false);
      throw error;
    } finally {
      abortControllerRef.current = null;
      setIsGenerating(false);
    }
  };

  const prepareSkills = async (userMessage: string, sessionId: string, role: any) => {
    const skillDecision = await decideSkillsWithLLM(userMessage, role);
    
    const prevSkillState = skillLoadStateRef.current.get(sessionId) || { activeSkillIds: [], loadedPaths: [] };
    const newlyActivatedSkillIds = skillDecision.skillIds.filter(id => !prevSkillState.activeSkillIds.includes(id));
    const hasRemovedSkills = prevSkillState.activeSkillIds.some(id => !skillDecision.skillIds.includes(id));
    const skillsChanged = newlyActivatedSkillIds.length > 0 || hasRemovedSkills;
    let loadedPaths = skillsChanged ? [] : [...prevSkillState.loadedPaths];
    const normalizedLoadedSet = new Set(loadedPaths.map(p => String(p || '').replace(/^(\.\/|\/)/, '')));

    if (skillDecision.skillIds.length === 0) {
      const newState = { activeSkillIds: [], loadedPaths: [] };
      skillLoadStateRef.current.set(sessionId, newState);
      updateChatSession(sessionId, { activeSkillIds: newState.activeSkillIds, loadedSkillFiles: newState.loadedPaths });
    } else {
      const newState = { activeSkillIds: [...skillDecision.skillIds], loadedPaths };
      skillLoadStateRef.current.set(sessionId, newState);
      updateChatSession(sessionId, { activeSkillIds: newState.activeSkillIds, loadedSkillFiles: newState.loadedPaths });

      const hasSkillFiles = skillDecision.skillIds.some(id => {
        const skill = agentSkills.find((s: any) => s.id === id);
        return !!(skill && Array.isArray(skill.files) && skill.files.length > 0);
      });

      if (hasSkillFiles) {
        const skillFileDecision = await decideSkillFilesWithLLM(userMessage, role, skillDecision.skillIds, loadedPaths);

        const newPaths = skillFileDecision.paths
          .map(p => String(p || '').replace(/^(\.\/|\/)/, ''))
          .filter(p => p && !normalizedLoadedSet.has(p));

        if (newPaths.length > 0) {
          loadedPaths = [...loadedPaths, ...newPaths];
          const newState = { activeSkillIds: [...skillDecision.skillIds], loadedPaths };
          skillLoadStateRef.current.set(sessionId, newState);
          updateChatSession(sessionId, { activeSkillIds: newState.activeSkillIds, loadedSkillFiles: newState.loadedPaths });
        }
      }
    }
    return { skillIds: skillDecision.skillIds, loadedPaths };
  };

  const sendMessage = async (messageId: string, userMessage: string) => {
    if (!sessionId) return;
    if (!currentModel || !currentRole) {
      throw new Error('模型或角色未配置');
    }

    try {
      setIsGenerating(true);

      // 🔍 [知识库增强]
      console.log('🔍 [知识库增强] 开始检查角色知识库关联:', { roleId: currentRole.id });
      const roleKnowledgeBase = await getRoleKnowledgeBase(currentRole.id);
      
      let knowledgeContext = '';
      
      if (roleKnowledgeBase) {
        try {
          const enhancedContext = await ChatEnhancementService.enhanceChatContext(
            userMessage,
            roleKnowledgeBase.id,
            {
              maxResults: 5,
              minRelevanceScore: 0.3,
              includeDebugInfo: true
            }
          );
          
          const allEntries = enhancedContext.knowledgeResults.flatMap(result => result.entries);
          if (allEntries.length > 0) {
            const knowledgeItems = allEntries.map(entry => {
              const keywords = entry.keywords.join('、');
              return `【${entry.name}】\n关键词：${keywords}\n解释：${entry.explanation}`;
            }).join('\n\n');
            knowledgeContext = `[相关知识库信息]\n${knowledgeItems}\n[/相关知识库信息]`;
          }
        } catch (enhancementError) {
          console.warn('⚠️ [知识库增强] 增强处理失败，不使用知识库增强:', enhancementError);
          knowledgeContext = '';
        }
      }

      const { skillIds, loadedPaths } = await prepareSkills(userMessage, sessionId, currentRole);

      const systemMessages = buildSystemMessages(currentRole, globalPrompts, agentSkills, userProfile, knowledgeContext, skillIds);
      if (skillIds.length > 0 && loadedPaths.length > 0) {
        const skillFilesContext = buildSkillFilesContext(currentRole, loadedPaths, skillIds);
        if (skillFilesContext) {
          systemMessages.push({ role: 'system', content: skillFilesContext });
        }
      }

      try {
        const now = new Date();
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'local';
        const dateContext = `[当前日期信息]\n现在是：${now.toISOString()}（${tz}）\n在使用联网搜索结果时，若某条结果未提供发布日期或更新日期，请避免自行推断并明确标注“日期未知”。\n[/当前日期信息]`;
        systemMessages.push({ role: 'system', content: dateContext });
      } catch {}

      const messages = [];
      messages.push(...systemMessages);
      
      messages.push(...currentSession!.messages.filter((m: any) => m.role !== 'assistant' || !m.isStreaming).map((m: any) => {
        const msg: any = {
          role: m.role,
          content: m.content
        };
        if (m.reasoningContent) {
          msg.reasoning_content = m.reasoningContent;
        }
        return msg;
      }));
      
      messages.push({
        role: 'user',
        content: userMessage
      });

      await executeLLMLoop(messages, messageId, sessionId);

    } catch (error) {
      setIsGenerating(false);
      throw error;
    }
  };

  const regenerateMessage = async (messageId: string) => {
    if (!sessionId || !currentSession || !currentModel || !currentRole || isLoading) {
      return;
    }

    const messageIndex = currentSession.messages.findIndex((m: any) => m.id === messageId);
    if (messageIndex === -1 || currentSession.messages[messageIndex].role !== 'assistant') {
      return;
    }

    const lastAssistantMessageIndex = currentSession.messages.map((m: any, i: number) => ({ message: m, index: i }))
      .filter(({ message }: any) => message.role === 'assistant')
      .pop()?.index;
    
    if (messageIndex !== lastAssistantMessageIndex) {
      toast.error('只能重新生成最新的AI回复');
      return;
    }

    setIsLoading(true);
    setIsGenerating(true);

    try {
      const contextMessages = currentSession.messages.slice(0, messageIndex);
      const lastUserMessage = contextMessages.filter((m: any) => m.role === 'user').pop();
      if (!lastUserMessage) {
        toast.error('找不到对应的用户消息');
        return;
      }

      const { skillIds, loadedPaths } = await prepareSkills(lastUserMessage.content, sessionId, currentRole);

      // Reset message content
      const supportsReasoning = currentModel.name?.toLowerCase().includes('deepseek-reasoner') || 
                               currentModel.name?.toLowerCase().includes('o1') || 
                               currentModel.name?.toLowerCase().includes('reasoning');
      
      const originalContent = currentSession.messages[messageIndex].content;

      if (supportsReasoning) {
        updateMessageWithReasoning(sessionId, messageId, '', '', true, false);
      } else {
        updateMessage(sessionId, messageId, '', true);
      }

      const systemMessages = buildSystemMessages(currentRole, globalPrompts, agentSkills, userProfile, undefined, skillIds);
      if (skillIds.length > 0 && loadedPaths.length > 0) {
        const skillFilesContext = buildSkillFilesContext(currentRole, loadedPaths, skillIds);
        if (skillFilesContext) {
          systemMessages.push({ role: 'system', content: skillFilesContext });
        }
      }

      const messages = [];
      messages.push(...systemMessages);
      messages.push(...contextMessages.map((m: any) => ({
        role: m.role,
        content: m.content
      })));

      const result = await executeLLMLoop(messages, messageId, sessionId);
      
      const newContent = result.content;
      const newImages = result.images;
      
      addMessageVersionWithOriginal(sessionId, messageId, originalContent, newContent, newImages);
      
      toast.success('重新生成完成');
    } catch (error) {
       toast.error('重新生成失败');
    } finally {
       setIsLoading(false);
       setIsGenerating(false);
    }
  };

  return {
    isGenerating,
    isLoading,
    sendMessage,
    regenerateMessage,
    stopGeneration
  };
};