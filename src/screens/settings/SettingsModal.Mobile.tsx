import React, { useState, useEffect, useContext } from 'react';
import { createPortal } from 'react-dom';
import { X, ChevronLeft } from 'lucide-react';
import { cn, isCapacitorIOS } from '../../lib/utils';
import { NavProvider, NavContainer, NavLink, BackButton } from '../../components/navigation/MobileNav';
import { tabs, TabType, SettingsModalProps } from './config';
import BottomSheetModal from '../../components/BottomSheetModal';
import { DragContext } from './SettingsContext';

const SettingsModalMobile: React.FC<SettingsModalProps> = ({ isOpen, onClose, defaultTab = 'global' }) => {
  const [activeTab, setActiveTab] = useState<TabType>(defaultTab);
  const isIOS = isCapacitorIOS();

  // 当 defaultTab 改变时更新 activeTab
  useEffect(() => {
    setActiveTab(defaultTab);
  }, [defaultTab]);

  // 移动端根页面
  const SettingsRootList: React.FC = () => {
    const { bind, requestClose } = useContext(DragContext);
    
    return (
      <div className="flex flex-col relative overflow-hidden h-full">
        <div 
          {...bind()}
          className={cn(
            "px-3 bg-base-200 flex h-[var(--height-header-m)] shrink-0 items-start",
            "cursor-move select-none",
            "md:touch-auto touch-none"
          )}
        >
          <div className="flex w-11 h-11 items-center justify-center">
            <button onClick={() => requestClose('close-button')} className="btn btn-circle bg-base-100">
              <X className="h-5 w-5" />
            </button>
          </div>
          <h2 className="text-lg font-semibold text-base-content h-11 items-center justify-center flex w-[calc(100%-2rem)]">设置</h2>
          <div className="flex w-11 h-11 items-center justify-center">
          </div>
        </div>
        <div className="flex-1 bg-base-200 overflow-y-scroll overscroll-contain">
          <ul className="join join-vertical p-4 pt-4 space-y-0 w-full min-h-[calc(100vh-var(--height-header-m)-env(safe-area-inset-top)-env(safe-area-inset-bottom)+1px)]">
            {tabs.map((tab, index) => {
              const Icon = tab.icon;
              const isLast = index === tabs.length - 1;
              return (
                <NavLink
                  key={tab.id}
                  component={PageWrapper as any}
                  props={{ title: tab.name, Component: tab.component, tabId: tab.id }}
                  className="flex items-center gap-4 w-full text-left p-0 pl-4 bg-base-100 join-item-box select-none"
                >
                  <div className="flex items-center justify-center w-10 h-10 bg-primary/10 rounded-lg">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <div className={`flex flex-1 h-16 items-center justify-center mr-4 border-b border-base-300 ${isLast ? 'border-b-0' : ''}`}>
                    <div className="flex-1">
                      <div className="font-medium text-base text-base-content">{tab.name}</div>
                    </div>
                    <div className="text-base-content">
                      <ChevronLeft className="h-4 w-4 rotate-180" />
                    </div>
                  </div>
                </NavLink>
              )
            })}
          </ul>
        </div>
      </div>
    )
  };

  // 移动端详情页包装
  const PageWrapper: React.FC<{ title: string; Component: React.ComponentType<any>; tabId?: TabType }> = ({ title, Component, tabId }) => {
    const { bind } = useContext(DragContext);
    
    useEffect(() => { setActiveTab((tabId as TabType) || activeTab); }, [tabId]);
    
    return (
      <div className="flex flex-col overflow-hidden h-full bg-base-200">
        <div 
          {...bind()}
          className={cn(
            "px-2 flex items-start gap-3 h-[var(--height-header-m)] shrink-0",
            "cursor-move select-none",
            "md:touch-auto touch-none"
          )}
        >
          <div className="flex w-10 h-10 items-center justify-center">
            <BackButton className="btn btn-circle bg-base-100">
              <ChevronLeft className="h-5 w-5" />
            </BackButton>
          </div>
          <h2 className="text-lg font-semibold text-base-content h-10 items-center justify-center flex w-[calc(100%-2rem)]">{title}</h2>
          <div className="flex w-10 h-10 items-center justify-center">
          </div>
        </div>
        <div className="flex-1 overflow-y-scroll overscroll-contain">
          <div className='h-[calc(100vh-var(--height-header-m)-env(safe-area-inset-top)-env(safe-area-inset-bottom)+1px)]'>
            <Component className="min-h-full pb-safe" onCloseModal={onClose} />
          </div>
        </div>
      </div>
    )
  };

  if (!isOpen) return null;

  return createPortal(
    <BottomSheetModal
      isOpen={isOpen}
      onClose={onClose}
      hideHeader
      className={cn("", isIOS && "ios-mode")}
      contentClassName="h-full"
    >
      {({ bind, requestClose }) => (
        <DragContext.Provider value={{ bind, requestClose }}>
          <div className="w-full h-full flex flex-col relative overflow-hidden">
            <NavProvider root={SettingsRootList}>
              <NavContainer animated swipeGesture iosSwipeStartMargin={isIOS ? 0 : 30} ignoreGlobalModalState />
            </NavProvider>
          </div>
        </DragContext.Provider>
      )}
    </BottomSheetModal>,
    document.body
  );
};

export default SettingsModalMobile;
