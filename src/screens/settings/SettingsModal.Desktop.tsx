import React, { useState, useEffect } from 'react';
import { X, ArrowLeft } from 'lucide-react';
import { cn } from '../../lib/utils';
import ConfigSettings from './sections/ConfigSettings';
import { tabs, TabType, SettingsModalProps } from './config';

const SettingsModalDesktop: React.FC<SettingsModalProps> = ({ isOpen, onClose, defaultTab = 'global' }) => {
  const [activeTab, setActiveTab] = useState<TabType>(defaultTab);
  
  // 二级页面检测状态
  const [isDetailView, setIsDetailView] = useState(false);
  const [detailTitle, setDetailTitle] = useState('');

  // 当 defaultTab 改变时更新 activeTab
  useEffect(() => {
    setActiveTab(defaultTab);
  }, [defaultTab]);

  // 标签切换处理函数
  const handleTabClick = (tabId: TabType) => {
    setActiveTab(tabId);
    
    // 强制更新状态检测，确保视图切换时状态正确
    const forceUpdateState = () => {
      const activeTabElement = document.querySelector(`[data-${tabId}-page]`);
      if (activeTabElement) {
        const isDetail = activeTabElement.getAttribute('data-is-detail-view') === 'true';
        const title = activeTabElement.getAttribute('data-detail-title') || '';
        setIsDetailView(isDetail);
        setDetailTitle(title);
      } else {
        setIsDetailView(false);
        setDetailTitle('');
      }
    };
    
    // 多次检测确保状态正确更新
    setTimeout(forceUpdateState, 10);
    setTimeout(forceUpdateState, 50);
    setTimeout(forceUpdateState, 100);
  };

  // 检测二级页面状态
  useEffect(() => {
    if (!isOpen) return;

    const detectDetailView = () => {
      const activeTabElement = document.querySelector(`[data-${activeTab}-page]`);
      
      if (activeTabElement) {
        const isDetail = activeTabElement.getAttribute('data-is-detail-view') === 'true';
        const title = activeTabElement.getAttribute('data-detail-title') || '';
        
        setIsDetailView(isDetail);
        setDetailTitle(title);
      } else {
        setIsDetailView(false);
        setDetailTitle('');
      }
    };

    // 多次检测确保状态正确
    const detectWithRetry = () => {
      detectDetailView();
      setTimeout(detectDetailView, 50);
      setTimeout(detectDetailView, 100);
    };

    const timer = setTimeout(detectWithRetry, 10);
    
    // 监听DOM属性变化
    const observer = new MutationObserver(() => {
      setTimeout(detectDetailView, 10);
    });
    
    const startObserving = () => {
      const activeTabElement = document.querySelector(`[data-${activeTab}-page]`);
      if (activeTabElement) {
        observer.observe(activeTabElement, {
          attributes: true,
          attributeFilter: ['data-is-detail-view', 'data-detail-title']
        });
        observer.observe(activeTabElement, {
          childList: true,
          subtree: true,
          attributes: true,
          attributeFilter: ['data-is-detail-view', 'data-detail-title']
        });
      }
    };
    
    const observerTimer = setTimeout(startObserving, 50);
    
    return () => {
      clearTimeout(timer);
      clearTimeout(observerTimer);
      observer.disconnect();
    };
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
          <div className="p-6 pb-4">
            <h2 className="text-lg font-semibold text-base-content">设置</h2>
          </div>
          
          <div className="flex-1 overflow-y-auto">
            <ul className="menu p-3 space-y-1 w-full">
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
        <div className="flex flex-1 flex-col min-h-0">
          {/* 标题栏 */}
          <div className="flex items-center justify-between p-6 pb-4 flex-shrink-0 bg-base-200">
            <div className="flex items-center gap-3">
              {isDetailView && detailTitle ? (
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => {
                      // 模拟返回操作
                      const knowledgeEntryBackButton = document.querySelector('.knowledge-entry-manager [data-back-button]') as HTMLButtonElement;
                      if (knowledgeEntryBackButton) {
                        knowledgeEntryBackButton.click();
                      } else {
                        const backButton = document.querySelector('[data-back-button]') as HTMLButtonElement;
                        if (backButton) {
                          backButton.click();
                        }
                      }
                      
                      // 强制更新状态
                      const forceUpdateState = () => {
                        const activeTabElement = document.querySelector(`[data-${activeTab}-page]`);
                        if (activeTabElement) {
                          const isDetail = activeTabElement.getAttribute('data-is-detail-view') === 'true';
                          const title = activeTabElement.getAttribute('data-detail-title') || '';
                          setIsDetailView(isDetail);
                          setDetailTitle(title);
                        } else {
                          setIsDetailView(false);
                          setDetailTitle('');
                        }
                      };
                      
                      setTimeout(forceUpdateState, 10);
                      setTimeout(forceUpdateState, 50);
                      setTimeout(forceUpdateState, 100);
                    }}
                    className="btn btn-ghost btn-sm btn-circle"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                  <h1 className="text-xl font-semibold text-base-content">{detailTitle}</h1>
                </div>
              ) : (
                <h1 className="text-xl font-semibold text-base-content">
                  {tabs.find(tab => tab.id === activeTab)?.name}
                </h1>
              )}
            </div>
            <button
              onClick={onClose}
              className="btn btn-ghost btn-sm btn-circle"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          
          {/* 内容 */}
          <div className="flex-1 overflow-y-auto min-h-0 bg-base-200">
            <ActiveComponent 
              {...({ className: 'h-fit-content' } as any)}
              onCloseModal={onClose} 
            />
          </div>
        </div>
      </div>
    </dialog>
  );
};

export default SettingsModalDesktop;
