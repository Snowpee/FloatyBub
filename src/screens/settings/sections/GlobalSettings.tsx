import React from 'react';
import { cn } from '../../../lib/utils';
import { toast } from '../../../hooks/useToast';
import { useAppStore } from '../../../store';

interface GlobalSettingsProps {
  onCloseModal?: () => void;
  className?: string;
}

type ChatStyle = 'conversation' | 'document';

const GlobalSettings: React.FC<GlobalSettingsProps> = ({ onCloseModal, className }) => {
  const {
    autoTitleConfig,
    assistantConfig,
    setAssistantConfig,
    updateAssistantConfig,
    llmConfigs,
    currentModelId,
    sendMessageShortcut,
    setSendMessageShortcut,
    chatStyle,
    setChatStyle
  } = useAppStore();

  // 统一辅助配置：优先使用新的 assistantConfig，回退到 autoTitleConfig
  const effectiveAssistantConfig = assistantConfig || autoTitleConfig;

  // 保存聊天样式设置
  const handleChatStyleChange = (style: ChatStyle) => {
    setChatStyle(style);
  };

  const pageTitle = '全局设置';
  const pageDescription = '配置全局应用设置和偏好';
  
  return (
    <div className={cn("max-w-6xl mx-auto p-4 md:p-6 md:pt-0", className)}>
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        {/* 常规情况下，头部就使用卡片，md及以上就使用普通的div，需要先定义什么是 isMobile */}
        {/* 定义 isMobile 为 md 及以上 */}
        <div className="block md:hidden w-full card bg-base-100">
          <div className="card-body py-4">
            <h3 className="font-bold text-xl text-base-content">
              {pageTitle}
            </h3>
            <p className="text-base-content/60">
              {pageDescription}
            </p>
            </div>
          </div>
      </div>



      {/* 对话设置 */}
      <div className="card bg-base-100 shadow-sm mb-4 mt-4">
        <div className="card-body gap-4">

          {/* 组合 */}
          <div className="join join-vertical hero-join-items">

          {/* 聊天样式设置 */}
          <div className="bg-base-100 join-item border-b border-base-300 pb-4">
            <div className="form-control w-full gap-4 flex items-center">
              <div className="w-full flex flex-row gap-3">
                {/* 对话样式选项 */}
                <label className="flex items-center space-x-3 cursor-pointer p-3 rounded-[var(--radius-box)] border-[length:var(--border)]  border-base-300 hover:bg-base-50 transition-colors w-1/2">
                  <input
                    type="radio"
                    name="chatStyle"
                    value="conversation"
                    checked={chatStyle === 'conversation'}
                    onChange={() => handleChatStyleChange('conversation')}
                    className="radio radio-primary"
                  />
                  <div className="flex-1">
                    <div className="text-base-content">对话模式</div>
                    <div className="text-sm text-base-content/60">聊天气泡样式</div>
                  </div>
                </label>

                {/* 文档样式选项 */}
                <label className="flex items-center space-x-3 cursor-pointer p-3 rounded-[var(--radius-box)] border-[length:var(--border)] border-base-300 hover:bg-base-50 transition-colors w-1/2">
                  <input
                    type="radio"
                    name="chatStyle"
                    value="document"
                    checked={chatStyle === 'document'}
                    onChange={() => handleChatStyleChange('document')}
                    className="radio radio-primary"
                  />
                  <div className="flex-1">
                    <div className="text-base-content">文档模式</div>
                    <div className="text-sm text-base-content/60">适合长文本阅读</div>
                  </div>
                </label>
          </div>
        </div>
          </div>
          {/* 全局辅助模型（含“跟随当前会话模型”首项），常显并置于自动标题之上 */}
          <div className="form-control flex hero-fieldset items-center gap-4 join-item py-4 border-b border-base-300">
            <p className="hero-label-md text-base my-2 flex-1">全局辅助模型</p>
            <label className="ml-auto flex flex-1">
              <select
                value={(effectiveAssistantConfig?.strategy === 'follow') ? 'follow' : (effectiveAssistantConfig?.modelId || '')}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === 'follow') {
                    updateAssistantConfig({ strategy: 'follow', modelId: null });
                  } else {
                    updateAssistantConfig({ strategy: 'custom', modelId: val });
                  }
                }}
                className="select select-ghost text-base w-full hero-mobile-group"
              >
                <option value="follow">跟随当前会话模型</option>
                {llmConfigs
                  .filter(c => c.enabled)
                  .map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name || `${c.provider}:${c.model}`}
                    </option>
                  ))}
              </select>
            </label>
          </div>
          {/* 发送消息快捷键 */}
          <div className="form-control flex hero-fieldset items-center join-item py-4 gap-4 border-b border-base-300">
            <p className="hero-label-md text-base my-2 flex-1">发送消息</p>
            <label className="ml-auto flex flex-1">
              {(() => {
                const isMac = typeof navigator !== 'undefined' && ((navigator.platform || '').toUpperCase().includes('MAC') || /Mac|iPhone|iPad|iPod/.test(navigator.userAgent || ''));
                const ctrlLabel = isMac ? 'Cmd + Enter' : 'Ctrl + Enter';
                return (
                  <select
                    value={sendMessageShortcut}
                    onChange={(e) => setSendMessageShortcut(e.target.value as 'enter' | 'ctrlEnter')}
                    className="select select-ghost text-base w-full hero-mobile-group"
                  >
                    <option value="ctrlEnter">{ctrlLabel}</option>
                    <option value="enter">Enter</option>
                  </select>
                );
              })()}
            </label>
          </div>

          {/* 自动标题总结 */}
          <div className="form-control flex hero-fieldset items-center join-item py-4">
            <p className="hero-label-md text-base my-2 flex-1">自动总结标题</p>
            <label className="w-full md:w-auto ml-auto flex flex-1">
              <input
                type="checkbox"
                checked={!!effectiveAssistantConfig?.enabled}
                onChange={(e) => updateAssistantConfig({ enabled: e.target.checked })}
                className="toggle ml-auto checked:border-primary checked:text-primary"
              />
            </label>
          </div>

          {/* 原“总结模型”选择已升级为“全局辅助模型”，不再与自动标题开关联动 */}

        </div>
      </div>
      </div>

      {/* 其他全局设置可以在这里添加 */}
      <h3 className="font-medium text-base mb-2 px-[calc(1.5rem+var(--border))] text-base-content/50">
        其他设置
      </h3>
      <div className="card bg-base-100 shadow-sm">
        <div className="card-body">
          <p className="text-base-content/60 text-sm">
            更多全局设置选项即将推出...
          </p>
        </div>
      </div>
    </div>
  );
};

export default GlobalSettings;
