import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAppStore, generateId } from '@/store';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/useToast';
import MarkdownRenderer from '@/components/MarkdownRenderer';
import ConfirmDialog from '@/components/ConfirmDialog';
import { replaceTemplateVariables } from '@/utils/templateUtils';
import { isDeepSeekThinkingEnabled } from '@/utils/deepseekUtils';
import { playVoiceStreaming, stopCurrentVoice, addVoiceStateListener, getVoiceState } from '@/utils/voiceUtils';
import { useAuth } from '@/hooks/useAuth';
import { 
  useChatScroll, 
  useSkillRouter, 
  useChatEngine, 
  useDebugTouch 
} from './hooks';
import { usePageContext } from '@/hooks/usePageContext';
import { ChatInput, MessageList } from './components';

const Chats: React.FC = () => {
  const { className: pageClassName } = usePageContext();
  const { sessionId } = useParams();
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState('');
  const editDialogRef = useRef<HTMLDialogElement>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [confirmDeleteDialog, setConfirmDeleteDialog] = useState<{ isOpen: boolean; messageId: string | null }>({ isOpen: false, messageId: null });
  const [viewingFile, setViewingFile] = useState<{ path: string; content: string } | null>(null);
  const [visibleActionButtons, setVisibleActionButtons] = useState<string | null>(null);
  const [voicePlayingState, setVoicePlayingState] = useState(getVoiceState());
  // 聊天样式由全局 store 管理
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const pendingMessageRef = useRef<string | null>(null);
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  
  // 获取用户认证信息
  const { user } = useAuth();
  
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
    agentSkills,
    currentUser,
    currentUserProfile,
    voiceSettings,
    searchConfig,
    autoTitleConfig,
    assistantConfig,
    chatStyle,
    setCurrentSession,
    createTempSession,
    addMessage,
    updateMessage,
    switchMessageVersion,
    deleteMessage,
    setCurrentModel,
    markSessionNeedsTitle,
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
  // const isTemporarySession = tempSessionId === currentSession?.id;

  // 恢复 Skill 状态逻辑已移动到 useSkillRouter
  
  // 使用 useMemo 优化角色获取逻辑，避免频繁重新计算
  const currentRole = useMemo(() => {
    // 1. 如果有当前会话（包括临时会话），严格使用会话关联的角色
    if (currentSession?.roleId) {
      return aiRoles.find(r => r.id === currentSession.roleId) || null;
    }
    
    // 2. 如果没有当前会话（处于新建/欢迎页），则使用选中角色或默认角色
    if (!currentSession) {
       return (selectedRoleId ? aiRoles.find(r => r.id === selectedRoleId) : null) || aiRoles[0] || null;
    }
    
    return null;
  }, [currentSession, aiRoles, selectedRoleId]);
  const currentModel = currentSession ? llmConfigs.find(m => m.id === currentSession.modelId) : llmConfigs.find(m => m.id === currentModelId);

  // 计算最后一条消息的长度，用于驱动滚动 hook
  const lastMessage = currentSession?.messages?.[currentSession.messages.length - 1];
  const lastMessageContentLength = useMemo(() => {
    if (!lastMessage) return 0;
    // 综合考虑正文、思考内容和图片
    return (lastMessage.content?.length || 0) + 
           (lastMessage.reasoningContent?.length || 0) + 
           (lastMessage.images?.length || 0);
  }, [lastMessage]);

  // 智能滚动逻辑 extracted to hook
  const { 
    scrollRef: scrollMaskRef, 
    scrollMaskClasses
  } = useChatScroll({
    currentSessionId: currentSession?.id,
    messagesLength: currentSession?.messages?.length || 0,
    isGenerating,
    isLoading,
    lastMessageContentLength
  });

  // Skill router hook
  const { 
    decideSkillsWithLLM, 
    decideSkillFilesWithLLM, 
    buildSkillFilesContext,
    skillLoadStateRef 
  } = useSkillRouter({
    currentSession,
    currentModel,
    effectiveAssistantConfig
  });

  // Chat Engine hook
  const { 
    sendMessage, 
    regenerateMessage, 
    stopGeneration
  } = useChatEngine({
    sessionId: currentSession?.id,
    currentSession,
    currentModel,
    currentRole,
    userProfile: currentUserProfile,
    agentSkills,
    globalPrompts,
    searchConfig,
    effectiveAssistantConfig,
    skillLoadStateRef,
    decideSkillsWithLLM,
    decideSkillFilesWithLLM,
    buildSkillFilesContext
  });

  // Debug Touch hook
  const {
    debugTouchStartRoot,
    debugTouchMoveRoot,
    debugTouchEndRoot,
    debugTouchStartList,
    debugTouchMoveList,
    debugTouchEndList,
    debugTouchStartBubble,
    debugTouchMoveBubble,
    debugTouchEndBubble
  } = useDebugTouch();

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
        console.warn('CHAT_PAGE_SEND_PENDING_START', { sessionId, at: new Date().toISOString() });
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
        console.warn('CHAT_PAGE_AI_PLACEHOLDER', { sessionId: currentSession.id, aiMessageId, at: new Date().toISOString() });
        const supportsReasoning = isDeepSeekThinkingEnabled(currentModel) ||
                                 currentModel?.model?.includes('deepseek-reasoner') || 
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
          await sendMessage(aiMessageId, userMessage);
        } catch (error) {
          if (error instanceof Error && error.name === 'AbortError') {
            toast.error('请求被取消或网络连接中断');
          } else {
            toast.error('发送消息失败，请重试');
          }
          stopGeneration();
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
            console.warn('CHAT_PAGE_TEMP_CLEANUP', { tempSessionId: currentTempSessionId, at: new Date().toISOString() });
            console.log('🧹 清理未使用的临时会话:', currentTempSessionId);
            useAppStore.getState().deleteTempSession();
          }
        }
      }, 100);
    };
  }, []); // 空依赖数组，只在组件卸载时执行

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
      console.warn('CHAT_PAGE_TEMP_CREATE', { newSessionId, roleIdToUse, modelIdToUse, at: new Date().toISOString() });

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
      console.warn('CHAT_PAGE_PENDING_SET', { newSessionId, pendingLength: pendingMessageRef.current.length, at: new Date().toISOString() });
      navigate(`/chat/${newSessionId}`);
      return;
    }

    if (!currentModel || !currentModel.enabled) {
      toast.error('当前模型未配置或已禁用');
      return;
    }
    
    // 获取用户名和角色名，用于模板替换
    const userName = currentUserProfile?.name || '用户';
    const charName = currentRole?.name || '未知角色';
    
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
    const supportsReasoning = isDeepSeekThinkingEnabled(currentModel) ||
                             currentModel?.model?.includes('deepseek-reasoner') || 
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
      await sendMessage(aiMessageId, userMessage);
    } catch (error) {
      
      // 根据错误类型显示不同的提示
      const err = error as Error;
      if (err?.name === 'AbortError') {
        toast.error('请求被取消或网络连接中断');
      } else {
        toast.error('发送消息失败，请重试');
      }
      
    } finally {
      setIsLoading(false);
      setIsGenerating(false);
    }
  };


  // 停止生成
  const handleStopGeneration = () => {
    stopGeneration();
  };

  // 重新生成消息
  const handleRegenerateMessage = async (messageId: string) => {
    await regenerateMessage(messageId);
  };

  const handleMarkdownLinkClick = useCallback((href: string) => {
    const roleSkillIds = currentRole?.skillIds || [];
    if (roleSkillIds.length === 0) return false;

    for (const skillId of roleSkillIds) {
      const skill = agentSkills.find(s => s.id === skillId);
      if (!skill || !skill.files) continue;

      const normalizedHref = href.replace(/^(\.\/|\/)/, '');
      
      const file = skill.files.find((f: any) => {
        const normalizedPath = f.path.replace(/^(\.\/|\/)/, '');
        return normalizedPath === normalizedHref;
      });

      if (file) {
        setViewingFile({ path: file.path, content: file.content });
        return true;
      }
    }
    
    return false;
  }, [currentRole, agentSkills]);

  return (
    <div className={cn(
      "chat-container flex flex-col h-full bg-base-100",
      (!currentSession || currentSession.messages.length === 0) && "justify-center hero-bg-img h-[calc(100%+1px)]",
      pageClassName
    ) 
    }
      onTouchStart={debugTouchStartRoot}
      onTouchMove={debugTouchMoveRoot}
      onTouchEnd={debugTouchEndRoot}
    >
      {/* 消息列表 */}
      <MessageList
        currentSession={currentSession || null}
        user={user}
        currentUser={currentUser}
        currentUserProfile={currentUserProfile}
        currentRole={currentRole}
        aiRoles={aiRoles}
        userRoles={userRoles}
        isLoading={isLoading}
        voicePlayingState={voicePlayingState}
        visibleActionButtons={visibleActionButtons}
        setVisibleActionButtons={setVisibleActionButtons}
        onRegenerate={handleRegenerateMessage}
        onReadMessage={async (id, content, role) => {
          try {
            await handleReadMessage(id, content, role);
          } catch (error) {
             // Already handled in handleReadMessage with toast
          }
        }}
        onUpdateMessage={updateMessage}
        onEditMessage={(id, content) => {
          setEditingMessageId(id);
          setEditingContent(content);
          setIsEditModalOpen(true);
        }}
        onDeleteMessage={(id) => setConfirmDeleteDialog({ isOpen: true, messageId: id })}
        onSwitchVersion={switchMessageVersion}
        onLinkClick={handleMarkdownLinkClick}
        scrollRef={scrollMaskRef}
        scrollMaskClasses={scrollMaskClasses}
        chatStyle={chatStyle}
        debugTouchStartList={debugTouchStartList}
        debugTouchMoveList={debugTouchMoveList}
        debugTouchEndList={debugTouchEndList}
        debugTouchStartBubble={debugTouchStartBubble}
        debugTouchMoveBubble={debugTouchMoveBubble}
        debugTouchEndBubble={debugTouchEndBubble}
      />

      {/* 输入区域 */}
      <div className={cn('p-4 pt-0', (!currentSession) && "flex-1 pb-[calc(50vh-10rem)]")}>
        <ChatInput
          message={message}
          setMessage={setMessage}
          isLoading={isLoading}
          isGenerating={isGenerating}
          onSendMessage={handleSendMessage}
          onStopGeneration={handleStopGeneration}
          selectedRoleId={selectedRoleId}
          setSelectedRoleId={setSelectedRoleId}
          currentUserProfile={currentUserProfile}
          currentRole={currentRole}
          currentModel={currentModel}
          textareaRef={textareaRef}
        />
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

      {/* 查看文件模态框 */}
      <dialog 
        className="modal" 
        open={!!viewingFile}
        onClose={() => setViewingFile(null)}
      >
        <div className="modal-box w-11/12 max-w-4xl">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-lg flex items-center gap-2">
              <span className="opacity-70">文件预览:</span>
              <span className="font-mono bg-base-200 px-2 py-1 rounded text-sm">{viewingFile?.path}</span>
            </h3>
            <button className="btn btn-sm btn-circle btn-ghost" onClick={() => setViewingFile(null)}>✕</button>
          </div>
          <div className="bg-base-200 rounded-lg p-0 overflow-hidden max-h-[70vh] border border-base-content/10">
            <div className="overflow-auto max-h-[70vh] p-4">
               {viewingFile?.path.endsWith('.md') ? (
                 <MarkdownRenderer content={viewingFile.content} />
               ) : (
                 <pre className="text-sm font-mono whitespace-pre-wrap break-all">
                   {viewingFile?.content}
                 </pre>
               )}
            </div>
          </div>
          <div className="modal-action">
            <button className="btn" onClick={() => setViewingFile(null)}>关闭</button>
          </div>
        </div>
        <div className="modal-backdrop" onClick={() => setViewingFile(null)}>
          <button>close</button>
        </div>
      </dialog>

      {/* 收藏助手快捷按钮已移除：改为 tips 中的内联角色选择器 */}
      
      {/* 删除确认弹窗 */}
      <ConfirmDialog
        isOpen={confirmDeleteDialog.isOpen}
        onClose={() => setConfirmDeleteDialog({ isOpen: false, messageId: null })}
        onConfirm={async () => {
          if (confirmDeleteDialog.messageId) {
            try {
              await deleteMessage(currentSession!.id, confirmDeleteDialog.messageId);
              toast.success('消息已移至回收站');
            } catch (error) {
              console.error('删除消息失败:', error);
              toast.error('删除消息失败，请重试');
            }
            setConfirmDeleteDialog({ isOpen: false, messageId: null });
          }
        }}
        title="移至回收站"
        message="确定将此消息移至回收站？"
        confirmText="确定"
        cancelText="取消"
      />
    </div>
  );
};

export default Chats;
