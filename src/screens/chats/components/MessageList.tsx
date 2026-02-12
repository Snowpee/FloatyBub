import React, { useRef } from 'react';
import { cn } from '@/lib/utils';
import MessageItem from './MessageItem';
import { ChatSession, ChatMessage, AIRole } from '@/store/types';

interface MessageListProps {
  currentSession: ChatSession | null;
  user: any;
  currentUser: any;
  currentUserProfile: any;
  currentRole: any;
  aiRoles: AIRole[];
  userRoles: any[];
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
  onSwitchVersion: (sessionId: string, messageId: string, index: number) => void;
  onLinkClick: (href: string) => boolean;
  scrollRef: React.RefObject<HTMLDivElement>;
  scrollMaskClasses: string;
  chatStyle: string;
  debugTouchStartList?: (e: React.TouchEvent) => void;
  debugTouchMoveList?: (e: React.TouchEvent) => void;
  debugTouchEndList?: (e: React.TouchEvent) => void;
  debugTouchStartBubble?: (e: React.TouchEvent) => void;
  debugTouchMoveBubble?: (e: React.TouchEvent) => void;
  debugTouchEndBubble?: (e: React.TouchEvent) => void;
}

const MessageList: React.FC<MessageListProps> = ({
  currentSession,
  user,
  currentUser,
  currentUserProfile,
  currentRole,
  aiRoles,
  userRoles,
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
  scrollRef,
  scrollMaskClasses,
  chatStyle,
  debugTouchStartList,
  debugTouchMoveList,
  debugTouchEndList,
  debugTouchStartBubble,
  debugTouchMoveBubble,
  debugTouchEndBubble
}) => {
  if (!currentSession || !currentSession.messages || currentSession.messages.length === 0) {
    return (
      <div 
        ref={scrollRef}
        className={cn(
          "flex-1 overflow-y-auto p-4 space-y-4 flex justify-end",
          scrollMaskClasses,
          "md:[--gradient-mask-padding:2rem]"
        )}
        onTouchStart={debugTouchStartList}
        onTouchMove={debugTouchMoveList}
        onTouchEnd={debugTouchEndList}
      >
        <div className={cn(
          'max-w-3xl mx-auto w-full pb-12 h-full flex flex-col items-center justify-end',
          chatStyle === 'document' && 'px-4'
        )}>
           <h3 className={cn(
              (!currentSession) ? "text-primary text-3xl" : "text-black/30 text-2xl"
            )}>
              {(currentSession)
                ? `Hi，我是${currentRole?.name || '未知角色'}`
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
      </div>
    );
  }

  // Sort messages logic from original Chats.tsx
  const sortedMessages = [...currentSession.messages].sort((a, b) => {
    // 三级排序策略：snowflake_id -> message_timestamp -> created_at
    if (a.snowflake_id && b.snowflake_id) {
      return String(a.snowflake_id).localeCompare(String(b.snowflake_id));
    } else if (a.snowflake_id && !b.snowflake_id) {
      return 1;
    } else if (!a.snowflake_id && b.snowflake_id) {
      return -1;
    } else {
       if (a.message_timestamp && b.message_timestamp) {
         return parseFloat(a.message_timestamp) - parseFloat(b.message_timestamp);
       }
       return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
     }
  });

  return (
    <div 
      ref={scrollRef}
      className={cn(
        "flex-1 overflow-y-auto p-4 space-y-4 flex justify-end",
        scrollMaskClasses,
        "md:[--gradient-mask-padding:2rem]"
      )}
      onTouchStart={debugTouchStartList}
      onTouchMove={debugTouchMoveList}
      onTouchEnd={debugTouchEndList}
    >
      <div className={cn(
        'max-w-3xl mx-auto w-full pb-12 h-fit',
        (currentSession) && "h-[calc(100%+1px)]",
         chatStyle === 'document' && 'px-4'
      )}>
        {sortedMessages.map((msg, index) => {
           // Helper calculations for MessageItem
           // Check if it's the latest AI message
           const lastAssistantMessageIndex = sortedMessages
             .map((m, i) => ({ message: m, index: i }))
             .filter(({ message }) => message.role === 'assistant')
             .pop()?.index;
           
           // Note: sortedMessages index might differ from original if sorted differently, 
           // but here we are iterating sortedMessages so index is consistent with display order.
           // However, lastAssistantMessageIndex needs to be based on the sorted array too.
           const isLatestAssistant = index === lastAssistantMessageIndex;

           // Check if it's the first AI message
           const firstAssistantMessageIndex = sortedMessages.findIndex(m => m.role === 'assistant');
           const isFirstAssistantMessage = index === firstAssistantMessageIndex;
           
           // Check if conversation has started (has user messages)
           const hasUserMessages = sortedMessages.some(m => m.role === 'user');

           return (
             <MessageItem
               key={msg.id}
               msg={msg}
               currentSessionId={currentSession.id}
               isLatestAssistant={isLatestAssistant}
               isFirstAssistantMessage={isFirstAssistantMessage}
               hasUserMessages={hasUserMessages}
               isLoading={isLoading}
               voicePlayingState={voicePlayingState}
               visibleActionButtons={visibleActionButtons}
               setVisibleActionButtons={setVisibleActionButtons}
               onRegenerate={onRegenerate}
               onReadMessage={onReadMessage}
               onUpdateMessage={onUpdateMessage}
               onEditMessage={onEditMessage}
               onDeleteMessage={onDeleteMessage}
               onSwitchVersion={(messageId, index) => onSwitchVersion(currentSession.id, messageId, index)}
               onLinkClick={onLinkClick}
               currentUserProfile={currentUserProfile}
               currentRole={currentRole}
               aiRoles={aiRoles}
               userRoles={userRoles}
               user={user}
               currentUser={currentUser}
               chatStyle={chatStyle}
               debugTouchStartBubble={debugTouchStartBubble}
               debugTouchMoveBubble={debugTouchMoveBubble}
               debugTouchEndBubble={debugTouchEndBubble}
             />
           );
        })}
      </div>
    </div>
  );
};

export default MessageList;
