import React, { useEffect } from 'react';
import { Send, Square, Loader2, SlidersHorizontal, Globe, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { replaceTemplateVariables } from '@/utils/templateUtils';
import { useAnimatedText } from '@/components/AnimatedText';
import { useAppStore } from '@/store';
import { toast } from '@/hooks/useToast';

interface ChatInputProps {
  message: string;
  setMessage: (msg: string) => void;
  isLoading: boolean;
  isGenerating: boolean;
  onSendMessage: () => void;
  onStopGeneration: () => void;
  selectedRoleId: string | null;
  setSelectedRoleId: (id: string) => void;
  currentUserProfile: any;
  currentRole: any;
  currentModel: any;
  textareaRef: React.RefObject<HTMLTextAreaElement>;
}

const ChatInput: React.FC<ChatInputProps> = ({
  message,
  setMessage,
  isLoading,
  isGenerating,
  onSendMessage,
  onStopGeneration,
  selectedRoleId,
  setSelectedRoleId,
  currentUserProfile,
  currentRole,
  currentModel,
  textareaRef
}) => {
  const { 
    llmConfigs, 
    setCurrentModel, 
    searchConfig, 
    updateSearchConfig, 
    aiRoles, 
    sendMessageShortcut 
  } = useAppStore();

  const enabledModels = llmConfigs.filter(m => m.enabled);

  // 自动调整文本框高度
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [message, textareaRef]);

  // 动态placeholder文本
  const animatedPlaceholder = useAnimatedText({ 
    isAnimating: isGenerating, 
    baseText: '回复中', 
    staticText: '输入消息...' 
  });

  // 处理键盘事件
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (sendMessageShortcut === 'ctrlEnter') {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        onSendMessage();
      }
    } else {
      // enter 直接发送，Shift+Enter 允许换行
      if (e.key === 'Enter') {
        if (e.shiftKey) return;
        e.preventDefault();
        onSendMessage();
      }
    }
  };

  return (
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
          style={{ minHeight: '40px', maxHeight: '120px'}}
          disabled={isGenerating}
        />
        {/* 模板替换预览 */}
        {message.trim() && (message.includes('{{user}}') || message.includes('{{char}}')) && (
          <div className="mt-2 p-2 bg-base-200 rounded text-sm text-base-content/70">
            <span className="text-xs text-base-content/50">预览: </span>
            {replaceTemplateVariables(message, currentUserProfile?.name || '用户', currentRole?.name || '未知角色')}
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
              onClick={onStopGeneration}
              className="btn btn-error btn-sm"
              title="停止生成"
            >
              <Square className="h-4 w-4" />
            </button>
          )}
          
          {/* 发送按钮 */}
          <button
            onClick={onSendMessage}
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
  );
};

export default ChatInput;
