import React, { useState, useEffect, useRef } from 'react';
import { X, ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import ConfigSettings from './sections/ConfigSettings';
import { tabs, TabType, SettingsModalProps } from './config';

const SettingsModalDesktop: React.FC<SettingsModalProps> = ({ isOpen, onClose, defaultTab = 'global' }) => {
  const [activeTab, setActiveTab] = useState<TabType>(defaultTab);
  
  // 二级页面检测状态
  const [isDetailView, setIsDetailView] = useState(false);
  const [detailTitle, setDetailTitle] = useState('');

  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) setActiveTab(defaultTab);
  }, [defaultTab, isOpen]);

  const handleTabClick = (tabId: TabType) => setActiveTab(tabId);

  // Observe only this dialog's section, not hidden Ionic pages or other modals.
  useEffect(() => {
    const content = contentRef.current;
    if (!isOpen || !content) return;
    const detectDetailView = () => {
      const section = content.querySelector(`[data-${activeTab}-page]`);
      setIsDetailView(section?.getAttribute('data-is-detail-view') === 'true');
      setDetailTitle(section?.getAttribute('data-detail-title') || '');
    };
    detectDetailView();
    const observer = new MutationObserver(detectDetailView);
    observer.observe(content, {
      childList: true, subtree: true, attributes: true,
      attributeFilter: ['data-is-detail-view', 'data-detail-title'],
    });
    return () => observer.disconnect();
  }, [activeTab, isOpen]);

  const ActiveComponent = tabs.find(tab => tab.id === activeTab)?.component || ConfigSettings;

  if (!isOpen) return null;

  return (
    <dialog className="modal modal-open animate-in fade-in zoom-in-95 duration-200" open>
      {/* 背景遮罩 */}
      <form method="dialog" className="modal-backdrop">
          <button onClick={onClose}>close</button>
      </form>

      {/* 弹窗内容 */}
      <div className="modal-box w-full max-w-5xl h-[800px] max-h-[calc(100vh-2rem)] p-0 flex bg-base-100 shadow-xl overflow-hidden">
        
        {/* 左侧导航栏 */}
        <div className="w-64 bg-base-100 border-r border-base-300/50 flex-shrink-0 flex flex-col">
          <div className="px-6 h-[var(--height-header)] flex items-center">
            <h2 className="text-lg font-semibold text-base-content">设置</h2>
          </div>
          
          <div className="flex-1 overflow-y-auto">
            <ul className="menu p-3 pt-0 space-y-1 w-full">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <li key={tab.id}>
                    <button
                      onClick={() => handleTabClick(tab.id)}
                      className={cn(
                        'flex items-center gap-3 w-full text-left rounded-[var(--radius-field)] px-3 py-2 transition-colors',
                        activeTab === tab.id
                          ? 'bg-base-300 text-base-content'
                          : 'text-base-content hover:bg-base-300'
                      )}
                    >
                      <Icon className="h-5 w-5" />
                      <span>{tab.name}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>

        {/* 右侧内容区域 */}
        <div className="flex flex-1 flex-col min-h-0 min-w-0">
          {/* 标题栏 */}
          <div className="flex items-center justify-between pl-6 pr-4 flex-shrink-0 bg-base-200 h-[var(--height-header)]">
            <div className="flex items-center gap-3">
              {isDetailView && detailTitle ? (
                <div className="flex items-center gap-3">
                  <button
                    aria-label="返回设置列表"
                    onClick={() => {
                      const content = contentRef.current;
                      const backButton = content?.querySelector<HTMLButtonElement>(
                        '.knowledge-entry-manager [data-back-button]'
                      ) || content?.querySelector<HTMLButtonElement>('[data-back-button]');
                      backButton?.click();
                    }}
                    className="btn btn-ghost btn-sm btn-circle"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                  <h1 className="text-lg font-semibold text-base-content">{detailTitle}</h1>
                </div>
              ) : (
                <h1 className="text-lg font-semibold text-base-content">
                  {tabs.find(tab => tab.id === activeTab)?.name}
                </h1>
              )}
            </div>
            <button
              onClick={onClose}
              aria-label="关闭设置"
              className="btn btn-ghost btn-sm btn-circle"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          
          {/* 内容 */}
          <div ref={contentRef} className="flex-1 overflow-y-auto min-h-0 bg-base-200">
            <ActiveComponent 
              className="h-fit-content"
              onCloseModal={onClose} 
            />
          </div>
        </div>
      </div>
    </dialog>
  );
};

export default SettingsModalDesktop;
