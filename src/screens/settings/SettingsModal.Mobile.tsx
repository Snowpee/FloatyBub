import React, { useState, useEffect, useRef } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn, isCapacitorIOS } from '../../lib/utils';
import { NavProvider, NavContainer, NavLink, BackButton } from '../../components/navigation/MobileNav';
import { useDragToClose } from '../../hooks/useDragToClose';
import { tabs, TabType, SettingsModalProps } from './config';

const SettingsModalMobile: React.FC<SettingsModalProps> = ({ isOpen, onClose, defaultTab = 'global' }) => {
  const [activeTab, setActiveTab] = useState<TabType>(defaultTab);
  const [isClosing, setIsClosing] = useState(false);
  const [shouldRender, setShouldRender] = useState(isOpen);
  const [isVisible, setIsVisible] = useState(false);
  const isIOS = isCapacitorIOS();
  const scrollLockRef = useRef<{ scrollY: number; bodyTop: string; bodyPosition: string; bodyWidth: string; htmlOverflow: string; htmlOverscrollBehavior: string; rootPointerEvents: string; rootTouchAction: string } | null>(null);

  // 当 defaultTab 改变时更新 activeTab
  useEffect(() => {
    setActiveTab(defaultTab);
  }, [defaultTab]);

  // 使用拖动关闭Hook
  const {
    dragY,
    isDragging,
    isChildrenDisabled,
    isRebounding,
    dragKey,
    bind,
    resetDragState
  } = useDragToClose({
    onClose,
    isClosing,
    isRebounding: false,
    closeThreshold: 100,
    velocityThreshold: 0.5,
    reboundDuration: 300,
    enableMobileOnly: true
  });

  // 处理弹窗打开逻辑
  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
      setIsClosing(false);
      resetDragState();
      
      const timer = setTimeout(() => {
        setIsVisible(true);
      }, 10);
      return () => clearTimeout(timer);
    } else if (shouldRender) {
      setIsClosing(true);
      setIsVisible(false);
      
      const delay = 300;
      const timer = setTimeout(() => {
        setShouldRender(false);
        setIsClosing(false);
      }, delay);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // 滚动锁定逻辑
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const root = document.getElementById('root') as HTMLElement | null;
    
    if (isOpen) {
      const prev = {
        scrollY: window.scrollY || 0,
        bodyTop: body.style.top,
        bodyPosition: body.style.position,
        bodyWidth: body.style.width,
        htmlOverflow: html.style.overflow,
        htmlOverscrollBehavior: (html.style as any).overscrollBehavior || '',
        rootPointerEvents: root?.style.pointerEvents || '',
        rootTouchAction: (root?.style as any)?.touchAction || ''
      };
      scrollLockRef.current = prev;
      html.style.overflow = 'hidden';
      (html.style as any).overscrollBehavior = 'none';
      body.style.position = 'fixed';
      body.style.top = `-${prev.scrollY}px`;
      body.style.width = '100%';
      if (root) {
        root.style.pointerEvents = 'none';
        (root.style as any).touchAction = 'none';
      }
    } else {
      const prev = scrollLockRef.current;
      html.style.overflow = prev?.htmlOverflow || '';
      (html.style as any).overscrollBehavior = prev?.htmlOverscrollBehavior || '';
      body.style.position = prev?.bodyPosition || '';
      body.style.top = prev?.bodyTop || '';
      body.style.width = prev?.bodyWidth || '';
      if (root) {
        root.style.pointerEvents = prev?.rootPointerEvents || '';
        (root.style as any).touchAction = prev?.rootTouchAction || '';
      }
      if (prev && typeof prev.scrollY === 'number') {
        window.scrollTo(0, prev.scrollY);
      }
    }
  }, [isOpen]);

  const handleClose = () => {
    if (isRebounding || isDragging) {
      return;
    }
    onClose();
  };

  // 移动端根页面
  const SettingsRootList: React.FC = () => {
    return (
      <div className="flex flex-col relative overflow-hidden">
        <div 
          {...bind()}
          className={cn(
            "px-2 bg-base-200 flex h-[var(--height-header)]",
            "cursor-move select-none",
            "md:touch-auto touch-none",
            isDragging && "bg-base-200/50"
          )}
        >
          <div className="flex w-[var(--height-header)] h-[var(--height-header)] items-center justify-center">
            <button onClick={handleClose} className="btn btn-circle bg-base-100">
              <X className="h-5 w-5" />
            </button>
          </div>
          <h2 className="text-lg font-semibold text-base-content m-auto items-center justify-center flex w-[calc(100%-2rem)]">设置</h2>
          <div className="flex w-[var(--height-header)] h-[var(--height-header)] items-center justify-center">
          </div>
        </div>
        <div className="flex-1 bg-base-200 overflow-y-scroll max-h-[calc(100dvh-env(safe-area-inset-bottom)-var(--height-header))] h-[calc(100dvh-env(safe-area-inset-bottom)-var(--height-header))] overscroll-contain">
          <ul className="join join-vertical p-4 space-y-0 w-full min-h-[calc(100dvh-env(safe-area-inset-bottom)-var(--height-header)+1px)]">
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
                  <div className={`flex flex-1 h-18 items-center justify-center mr-4 border-b border-base-300 ${isLast ? 'border-b-0' : ''}`}>
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
    useEffect(() => { setActiveTab((tabId as TabType) || activeTab); }, [tabId]);
    return (
      <div className="flex flex-col overflow-hidden min-h-full bg-base-200">
        <div 
          {...bind()}
          className={cn(
            "px-2 flex items-center gap-3 h-16",
            "cursor-move select-none",
            "md:touch-auto touch-none",
            isDragging && "bg-base-200/50"
          )}
        >
          <div className="flex w-16 h-16 items-center justify-center">
            <BackButton className="btn btn-circle bg-base-100">
              <ChevronLeft className="h-5 w-5" />
            </BackButton>
          </div>
          <h2 className="text-lg font-semibold text-base-content m-auto items-center justify-center flex w-[calc(100%-2rem)]">{title}</h2>
          <div className="flex w-16 h-16 items-center justify-center">
          </div>
        </div>
        <div className="flex-1 overflow-y-scroll max-h-[calc(100dvh-4rem)] h-[calc(100dvh-4rem)] overscroll-contain">
          <Component className="min-h-[calc(100dvh-4rem+1px)]" onCloseModal={handleClose} />
        </div>
      </div>
    )
  };

  if (!shouldRender) {
    return null;
  }

  return (
    <div className={cn(
      "fixed inset-0 z-50",
      "pt-4",
      "pt-[env(safe-area-inset-top)]"
    )}>
      {/* 背景遮罩 */}
      <div 
        className={cn(
          "modal-backdrop absolute inset-0 bg-black/50",
          "transition-opacity duration-200 ease-out",
          isClosing ? "opacity-0" : "opacity-100"
        )}
        onClick={handleClose}
      />
      
      {/* 弹窗内容 */}
      <div 
        key={`drag-container-${dragKey}`}
        className={cn(
          "hero-modal settings-modal relative bg-base-100 shadow-xl flex overflow-hidden",
          "w-full h-full",
          isIOS && "ios-mode",
          isChildrenDisabled && "[&_*]:pointer-events-none",
          (isDragging || isRebounding) ? "" : "transition-transform duration-200 ease-[cubic-bezier(0.25,0.46,0.45,0.94)]",
          (isDragging || isRebounding)
            ? ""
            : isVisible && !isClosing
            ? "translate-y-0"
            : "translate-y-full"
        )}
        style={{
          transform: (isDragging || isRebounding || dragY > 0) 
            ? `translateY(${dragY}px)` 
            : undefined,
          willChange: 'transform',
          backfaceVisibility: 'hidden',
          WebkitBackfaceVisibility: 'hidden'
        }}
      >
        <div className="w-full flex flex-col relative overflow-hidden">
          <NavProvider root={SettingsRootList}>
            <NavContainer animated swipeGesture iosSwipeStartMargin={isIOS ? 0 : 30} />
          </NavProvider>
        </div>
      </div>
    </div>
  );
};

export default SettingsModalMobile;
