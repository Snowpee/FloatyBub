import React, { useRef, useState } from 'react';
import { Loader2, Trash2, Volume2, RefreshCw, ChevronLeft, ChevronRight, User, Edit3, Copy, MoreHorizontal, Zap, Square } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/useToast';
import MarkdownRenderer from '@/components/MarkdownRenderer';
import ThinkingProcess from './ThinkingProcess';
import Avatar from '@/components/Avatar';
import AudioWaveform from '@/components/AudioWaveform';
import { replaceTemplateVariables } from '@/utils/templateUtils';
import { ChatMessage, AIRole } from '@/store/types';

interface MessageItemProps {
  msg: ChatMessage;
  currentSessionId: string;
  isLatestAssistant: boolean;
  isFirstAssistantMessage: boolean;
  hasUserMessages: boolean;
  isLoading: boolean;
  voicePlayingState: {
    isPlaying: boolean;
    isGenerating: boolean;
    currentMessageId: string | null;
  };
  visibleActionButtons: string | null;
  setVisibleActionButtons: (id: string | null) => void;
  onRegenerate: (id: string) => void;
  onReadMessage: (id: string, content: string, role?: AIRole | null) => void;
  onUpdateMessage: (sessionId: string, messageId: string, content: string) => void;
  onEditMessage: (id: string, content: string) => void;
  onDeleteMessage: (id: string) => void;
  onSwitchVersion: (messageId: string, index: number) => void;
  onLinkClick: (href: string) => boolean;
  currentUserProfile: any;
  currentRole: any;
  aiRoles: AIRole[];
  userRoles: any[];
  user: any;
  currentUser: any;
  chatStyle: string;
  debugTouchStartBubble?: (e: React.TouchEvent) => void;
  debugTouchMoveBubble?: (e: React.TouchEvent) => void;
  debugTouchEndBubble?: (e: React.TouchEvent) => void;
}

const SkillUsageIndicator: React.FC<{ skillName: string }> = ({ skillName }) => (
  <div className="flex items-center gap-1.5 text-xs text-primary/80 bg-primary/5 px-2 py-1 rounded-md mb-2 w-fit border border-primary/10">
    <Zap className="w-3 h-3" />
    <span>已调用技能：<span className="font-medium">{skillName}</span></span>
  </div>
);

const tryExtractJson = (s: string) => {
  try {
    return JSON.parse(s);
  } catch (e) {
    return null;
  }
};

const MessageItem: React.FC<MessageItemProps> = ({
  msg,
  currentSessionId,
  isLatestAssistant,
  isFirstAssistantMessage,
  hasUserMessages,
  isLoading,
  voicePlayingState,
  visibleActionButtons,
  setVisibleActionButtons,
  onRegenerate,
  onReadMessage,
  onUpdateMessage,
  onEditMessage,
  onDeleteMessage,
  onSwitchVersion,
  onLinkClick,
  currentUserProfile,
  currentRole,
  aiRoles,
  userRoles,
  user,
  currentUser,
  chatStyle,
  debugTouchStartBubble,
  debugTouchMoveBubble,
  debugTouchEndBubble
}) => {
  const blurTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Helper to determine message role/avatar
  const getMessageRole = () => {
    let messageRole = null;
    if (msg.roleId) {
      messageRole = aiRoles.find(r => r.id === msg.roleId);
    }
    // Fallback logic if needed, but msg.roleId should be sufficient if set
    // In original code: fallback to currentSession.roleId then currentRole
    // We can just return null and let the caller handle defaults or handle it here
    // But for Avatar display, we need a role object if it's assistant
    if (!messageRole && currentRole) {
       // If message doesn't have specific role ID, use current role (contextual)
       // OR we might want to pass session's role ID
       messageRole = currentRole;
    }
    return messageRole;
  };

  const messageRole = getMessageRole();

  const handleMouseEnter = () => {
    if (blurTimeoutRef.current) {
      clearTimeout(blurTimeoutRef.current);
      blurTimeoutRef.current = null;
    }
  };

  const handleMouseLeave = (e: React.MouseEvent) => {
    const activeElement = document.activeElement;
    if (activeElement instanceof HTMLElement && e.currentTarget.contains(activeElement)) {
      const timeout = setTimeout(() => {
        activeElement.blur();
        blurTimeoutRef.current = null;
      }, 300);
      blurTimeoutRef.current = timeout;
    }
  };

  const renderAvatar = () => {
    if (msg.role === 'assistant') {
      return (
        <Avatar
          name={messageRole?.name || '未知角色'}
          avatar={messageRole?.avatar}
          size="md"
        />
      );
    } else {
      if (msg.userProfileId) {
        const messageUserProfile = userRoles.find(p => p.id === msg.userProfileId);
        return messageUserProfile ? (
          <Avatar
            name={messageUserProfile.name}
            avatar={messageUserProfile.avatar}
            size="md"
          />
        ) : (
          <div className="w-8 h-8 rounded-full bg-base-300 flex items-center justify-items-center content-center text-center">
            <User className="h-4 w-4 text-accent" />
          </div>
        );
      } else if (user) {
        return (
          <Avatar
            name={currentUser?.name || user.user_metadata?.full_name || user.email || '用户'}
            avatar={currentUser?.avatar || user.user_metadata?.avatar_url}
            size="md"
          />
        );
      } else {
        return (
          <div className="w-8 h-8 rounded-full bg-base-300 flex items-center justify-items-center content-center text-center">
            <User className="h-4 w-4 text-accent" />
          </div>
        );
      }
    }
  };

  return (
    <div
      className={cn(
        'mb-2 chat',
        msg.role === 'user' ? 'chat-end' : 'chat-start',
        chatStyle === 'document' && 'chat-box'
      )}
    >
      <div className="chat-image avatar">
        {renderAvatar()}
      </div>

      <div
        className={cn(
          'chat-bubble cursor-pointer md:max-w-xl md:cursor-default relative group',
          msg.role === 'user' ? 'chat-bubble-accent' : ''
        )}
        onTouchStart={debugTouchStartBubble}
        onTouchMove={debugTouchMoveBubble}
        onTouchEnd={debugTouchEndBubble}
        onClick={() => {
          if (window.innerWidth < 768) {
            setVisibleActionButtons(visibleActionButtons === msg.id ? null : msg.id);
          }
        }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {/* 音频波纹 */}
        {msg.role === 'assistant' && voicePlayingState.isPlaying && voicePlayingState.currentMessageId === msg.id && (
          <div className="absolute -top-1 -right-1 z-20">
            <AudioWaveform className="bg-base-100 rounded-full p-1 shadow-sm" />
          </div>
        )}

        <div>
          {/* 思考过程 */}
          {msg.role === 'assistant' && msg.reasoningContent && msg.reasoningContent.trim() && (
            <ThinkingProcess 
              content={msg.reasoningContent}
              isComplete={msg.isReasoningComplete || (!!msg.content && msg.content.length > 0)}
            />
          )}

          {/* 消息内容 */}
          {(() => {
            const skillMatch = msg.content.match(/<use_skill\s+name="([^"]+)"\s*\/?>/);
            const skillName = skillMatch ? skillMatch[1] : null;
            let contentToRender = msg.content;
            if (skillMatch) {
              contentToRender = contentToRender.replace(skillMatch[0], '').trim();
            }

            // Parse opening tags if present (simple check first)
            if (contentToRender.includes('<opening>') && contentToRender.includes('</opening>')) {
               // Render opening cards logic
               return contentToRender.split('\n').map((line, i) => {
                  const isOpening = line.startsWith('<opening>');
                  
                  if (isOpening) {
                    const content = line.replace('<opening>', '').replace('</opening>', '').trim();
                    const opening = tryExtractJson(content);
                    
                    return (
                      <div key={i} className="mb-2">
                        <div className="text-sm font-medium text-blue-500 mb-1">
                          开场白: {opening && typeof opening === 'object' && 'title' in opening ? (opening as any).title : '未命名'}
                        </div>
                        <div className="text-xs text-gray-500 bg-blue-50 p-2 rounded">
                          {opening && typeof opening === 'object' && 'greeting' in opening ? (opening as any).greeting : content}
                        </div>
                      </div>
                    );
                  }
                  
                  // Regular content rendering for non-opening lines (if any mixed in)
                  // But usually opening messages are structured. 
                  // If not opening line, render as markdown
                  if (!line.trim()) return null;
                   
                  const processedContent = replaceTemplateVariables(
                      line,
                      currentUserProfile?.name || '用户',
                      currentRole?.name || 'AI助手'
                    );

                  return (
                    <MarkdownRenderer 
                      key={i}
                      content={processedContent} 
                      className="pointer-events-auto" 
                      onLinkClick={onLinkClick}
                    />
                  );
               });
            }

            const processedContent = replaceTemplateVariables(
              contentToRender,
              currentUserProfile?.name || '用户',
              currentRole?.name || 'AI助手'
            );
            
            return (
              <>
                {skillName && <SkillUsageIndicator skillName={skillName} />}
                <MarkdownRenderer 
                  content={processedContent} 
                  className="pointer-events-auto" 
                  onLinkClick={onLinkClick}
                />
              </>
            );
          })()}
          
          {/* 图片渲染 */}
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
          
          {/* Loading Indicator */}
          {msg.isStreaming && (
            <Loader2 className="h-4 w-4 animate-spin mt-2" />
          )}

          {/* 操作按钮组 */}
          <div onClick={(e) => e.stopPropagation()} className={cn(
            'absolute flex gap-1 p-1 bg-base-100 text-base-content rounded-[var(--radius-box)] transition-opacity duration-200 z-10 backdrop-blur-sm shadow-sm pointer-events-auto',
            'delay-300 group-hover:delay-0',
            visibleActionButtons === msg.id ? 'delay-0' : '',
            'opacity-0 group-hover:opacity-100',
            'md:opacity-0 md:group-hover:opacity-100',
            visibleActionButtons === msg.id ? 'opacity-100' : '',
            msg.role === 'user' ? 'right-0 top-full mt-1' : 'left-0 top-full mt-1'
          )}>
            {/* Regenerate Button */}
            {msg.role === 'assistant' && isLatestAssistant && (!isFirstAssistantMessage || hasUserMessages) && (
              <button
                className="btn btn-sm btn-circle btn-ghost h-7 w-7"
                title="重新生成"
                disabled={isLoading}
                onClick={() => onRegenerate(msg.id)}
              >
                <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
              </button>
            )}
            
            {/* Copy Button */}
            <button
              className="btn btn-sm btn-circle btn-ghost h-7 w-7"
              title="复制"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(msg.content);
                  toast.success('已复制到剪贴板');
                } catch {
                  toast.error('复制失败');
                }
              }}
            >
              <Copy className="h-4 w-4" />
            </button>

            {/* Read Aloud Button */}
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
                onClick={() => onReadMessage(msg.id, msg.content, messageRole)}
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
            
            {/* Opening Switch Buttons */}
            {msg.role === 'assistant' && isFirstAssistantMessage && !hasUserMessages && messageRole?.openingMessages && messageRole.openingMessages.length > 1 && (
              <>
                <button
                  className="btn btn-sm btn-circle btn-ghost h-7 w-7"
                  title="上一个开场白"
                  onClick={() => {
                    const currentIndex = messageRole!.openingMessages!.findIndex((opening: string) => opening === msg.content) || 0;
                    const newIndex = currentIndex > 0 ? currentIndex - 1 : messageRole!.openingMessages!.length - 1;
                    const newOpening = messageRole!.openingMessages![newIndex];
                    if (newOpening) {
                      onUpdateMessage(currentSessionId, msg.id, newOpening);
                      toast.success('已切换到上一个开场白');
                    }
                  }}
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="text-xs text-gray-500 px-1 content-center">
                  {(messageRole.openingMessages.findIndex((opening: string) => opening === msg.content) || 0) + 1}/{messageRole.openingMessages.length}
                </span>
                <button
                  className="btn btn-sm btn-circle btn-ghost h-7 w-7"
                  title="下一个开场白"
                  onClick={() => {
                    const currentIndex = messageRole!.openingMessages!.findIndex((opening: string) => opening === msg.content) || 0;
                    const newIndex = currentIndex < messageRole!.openingMessages!.length - 1 ? currentIndex + 1 : 0;
                    const newOpening = messageRole!.openingMessages![newIndex];
                    if (newOpening) {
                      onUpdateMessage(currentSessionId, msg.id, newOpening);
                      toast.success('已切换到下一个开场白');
                    }
                  }}
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </>
            )}

            {/* Version Switch Buttons */}
            {msg.versions && msg.versions.length > 1 && (
              <>
                <button
                  className="btn btn-sm btn-circle btn-ghost h-7 w-7"
                  title="上一个版本"
                  disabled={(msg.currentVersionIndex || 0) === 0}
                  onClick={() => {
                    const currentIndex = msg.currentVersionIndex || 0;
                    if (currentIndex > 0) {
                      onSwitchVersion(msg.id, currentIndex - 1);
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
                    if (currentIndex < msg.versions!.length - 1) {
                      onSwitchVersion(msg.id, currentIndex + 1);
                    }
                  }}
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </>
            )}

            {/* More Menu */}
            <div className={cn("dropdown", msg.role === 'user' ? "dropdown-end" : "dropdown-bottom")}>
              <div tabIndex={0} role="button" className="btn btn-sm btn-circle btn-ghost h-7 w-7" title="更多">
                <MoreHorizontal className="h-4 w-4" />
              </div>
              <ul tabIndex={0} className="dropdown-content z-[1] menu p-2 shadow bg-base-100 rounded-box w-32">
                <li>
                  <a onClick={() => {
                    onEditMessage(msg.id, msg.content);
                    if (document.activeElement instanceof HTMLElement) {
                      document.activeElement.blur();
                    }
                  }}>
                    <Edit3 className="h-4 w-4" /> 编辑
                  </a>
                </li>
                <li>
                  <a className="text-error" onClick={() => {
                    onDeleteMessage(msg.id);
                    if (document.activeElement instanceof HTMLElement) {
                      document.activeElement.blur();
                    }
                  }}>
                    <Trash2 className="h-4 w-4" /> 删除
                  </a>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MessageItem;
