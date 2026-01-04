import React from 'react';
import { Monitor, Moon, Sun, Laptop } from 'lucide-react';
import { useAppStore } from '@/store';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/useToast';
import { usePageContext } from '@/hooks/usePageContext';

interface GlobalSettingsProps {
  onCloseModal?: () => void;
  className?: string;
}

type ChatStyle = 'conversation' | 'document';

const GlobalSettings: React.FC<GlobalSettingsProps> = ({ onCloseModal, className }) => {
  const {
    autoTitleConfig,
    assistantConfig,
    updateAssistantConfig,
    llmConfigs,
    sendMessageShortcut,
    setSendMessageShortcut,
    chatStyle,
    setChatStyle,
    theme,
    setTheme
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
    <div className={cn("p-4 md:p-6 max-w-4xl mx-auto md:pt-0", className)}>
      {/* <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="block w-full card bg-base-100 mb-4">
          <div className="card-body py-4">
            <h3 className="font-bold text-xl text-base-content">
              {pageTitle}
            </h3>
            <p className="text-base-content/60 text-sm">
              {pageDescription}
            </p>
            </div>
          </div>
      </div> */}

      <div className="flex flex-col gap-6">
        {/* 基础设置 */}
        <div>
          <fieldset className='bub-fieldset'>
            
            {/* 聊天样式设置 */}
            <div className="py-4">
              <div className="flex flex-row gap-3">
                <label className={cn(
                  "flex-1 flex flex-col items-center justify-center p-2 rounded-xl border cursor-pointer transition-all",
                  chatStyle === 'conversation' 
                    ? "border-primary bg-primary/5 text-primary" 
                    : "border-base-300 hover:bg-base-200"
                )}>
                  <input 
                    type="radio" 
                    name="chatStyle" 
                    value="conversation" 
                    checked={chatStyle === 'conversation'} 
                    onChange={() => handleChatStyleChange('conversation')} 
                    className="hidden" 
                  />
                  <span className="text-base font-medium">对话模式</span>
                  <span className="text-sm opacity-50 mt-0.5">使用气泡样式，适合聊天</span> 
                </label>
                
                <label className={cn(
                  "flex-1 flex flex-col items-center justify-center p-2 rounded-xl border cursor-pointer transition-all",
                  chatStyle === 'document' 
                    ? "border-primary bg-primary/5 text-primary" 
                    : "border-base-300 hover:bg-base-200"
                )}>
                  <input 
                    type="radio" 
                    name="chatStyle" 
                    value="document" 
                    checked={chatStyle === 'document'} 
                    onChange={() => handleChatStyleChange('document')} 
                    className="hidden" 
                  />
                  <span className="text-base font-medium">文档模式</span>
                  <span className="text-sm opacity-50 mt-0.5">纯净样式，适合阅读</span>
                </label>
              </div>
            </div>

            {/* 全局辅助模型 */}
            <div>
              <label className='bub-select'>
                <span className="label">全局辅助模型</span>
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
            <div>
              <label className='bub-select'>
                <span className="label">发送消息快捷键</span>
                {(() => {
                  const isMac = typeof navigator !== 'undefined' && ((navigator.platform || '').toUpperCase().includes('MAC') || /Mac|iPhone|iPad|iPod/.test(navigator.userAgent || ''));
                  const ctrlLabel = isMac ? 'Cmd + Enter' : 'Ctrl + Enter';
                  return (
                    <select
                      value={sendMessageShortcut}
                      onChange={(e) => setSendMessageShortcut(e.target.value as 'enter' | 'ctrlEnter')}
                    >
                      <option value="ctrlEnter">{ctrlLabel}</option>
                      <option value="enter">Enter</option>
                    </select>
                  );
                })()}
              </label>
            </div>


            {/* 自动总结标题 */}
            <div className="bub-checkbox">
              <span className="label">自动总结标题</span>
              <input
                type="checkbox"
                checked={!!effectiveAssistantConfig?.enabled}
                onChange={(e) => updateAssistantConfig({ enabled: e.target.checked })}
                className="toggle toggle-primary"
              />
            </div>

          </fieldset>
        </div>

        {/* 其他设置 */}
        <div>
          <h3 className="text-sm font-medium text-base-content/50 mb-2 pl-[calc(1rem+1px)]">外观设置</h3>
          <div>
            <fieldset className='bub-fieldset'>
              
              {/* 主题设置 */}
                <label className='bub-select'>
                  <span className="label">主题</span>
                  <select
                    value={theme}
                    onChange={(e) => setTheme(e.target.value as any)}
                  >
                    <option value="floaty">浮光 (默认)</option>
                    <option value="light">简洁</option>
                    <option value="dark">暗色</option>
                    <option value="cupcake">纸杯蛋糕</option>
                  </select>
                </label>
            </fieldset>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GlobalSettings;
