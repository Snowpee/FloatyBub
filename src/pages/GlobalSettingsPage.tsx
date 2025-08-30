import React, { useState, useEffect } from 'react';
import { cn } from '../lib/utils';
import { toast } from '../hooks/useToast';

interface GlobalSettingsPageProps {
  onCloseModal?: () => void;
}

type ChatStyle = 'conversation' | 'document';

const GlobalSettingsPage: React.FC<GlobalSettingsPageProps> = ({ onCloseModal }) => {
  const [chatStyle, setChatStyle] = useState<ChatStyle>('conversation');

  // 从localStorage加载设置
  useEffect(() => {
    const savedChatStyle = localStorage.getItem('chatStyle') as ChatStyle;
    if (savedChatStyle && ['conversation', 'document'].includes(savedChatStyle)) {
      setChatStyle(savedChatStyle);
    }
  }, []);

  // 保存聊天样式设置
  const handleChatStyleChange = (style: ChatStyle) => {
    setChatStyle(style);
    localStorage.setItem('chatStyle', style);

    
    // 触发页面重新渲染以应用新样式
    window.dispatchEvent(new CustomEvent('chatStyleChanged', { detail: { style } }));
  };

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6 md:pt-0">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <p className="text-base-content/60">
            配置全局应用设置和偏好
          </p>
        </div>
      </div>



      {/* 对话设置 */}
      <div className="card bg-base-100 shadow-sm mb-4 mt-4">
        <div className="card-body gap-4">

          {/* 组合 */}
          <div className="join join-vertical hero-join-items">
          {/* 聊天样式设置 */}
          <div className="bg-base-100 join-item">
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

          {/* 自动标题总结 */}
          <div className="form-control flex hero-fieldset items-center join-item py-4 border-b border-base-300">
            <p className="hero-label-md text-base my-2 flex-1">自动总结标题</p>
            <label className="w-full md:w-auto ml-auto flex flex-1">
              <input type="checkbox" defaultChecked className="toggle ml-auto checked:border-primary checked:text-primary" />
            </label>
          </div>

          {/* 总结模型 */}
          <div className="form-control flex hero-fieldset items-center gap-4 join-item py-4 border-b border-base-300">
            <p className="hero-label-md text-base my-2 flex-1">总结模型</p>
            <label className="ml-auto flex flex-1">
              <select defaultValue="Pick a font" className="select select-ghost text-base w-full hero-mobile-group">
                <option disabled={true}>Pick a font</option>
                <option>Inter</option>
                <option>Poppins</option>
                <option>Raleway</option>
              </select>
            </label>
          </div>

          {/* 自动标题总结 */}
          <div className="form-control flex hero-fieldset items-center gap-4 join-item pt-4">
            <p className="hero-label-md text-base my-2 flex-1">测试</p>
            <label className="w-full ml-auto flex-1">
              <input type="input" placeholder='请输入' className="input w-full hero-mobile-group" />
            </label>
          </div>

        </div>
      </div>
      </div>

      {/* 其他全局设置可以在这里添加 */}
      <h3 className="font-medium text-base mb-2 px-6 text-base-content/50">
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

export default GlobalSettingsPage;