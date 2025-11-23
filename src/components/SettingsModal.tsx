import React, { useState, useEffect, useRef } from 'react';
import { X, Settings, Users, Database, FileText, UserCircle, Volume2, ArrowLeft, ChevronLeft, ChevronRight, Globe, BookOpen, Search } from 'lucide-react';
import { cn, isCapacitorIOS } from '../lib/utils';
import { NavProvider, NavContainer, NavLink, BackButton } from './navigation/MobileNav';
import { useDragToClose } from '../hooks/useDragToClose';
import ConfigPage from '../pages/ConfigPage';
import RolesPage from '../pages/RolesPage';
import userRolesPage from '../pages/UserRolesPage';
import DataPage from '../pages/DataPage';
import GlobalSettingsPage from '../pages/GlobalSettingsPage';
import GlobalPromptsPage from '../pages/GlobalPromptsPage';
import VoiceSettingsPage from '../pages/VoiceSettingsPage';
import KnowledgePage from '../pages/KnowledgePage';
import SearchSettingsPage from '../pages/SearchSettingsPage';

type TabType = 'global' | 'config' | 'roles' | 'userRoles' | 'globalPrompts' | 'voice' | 'data' | 'knowledge' | 'search';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTab?: TabType;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, defaultTab = 'global' }) => {
  const [activeTab, setActiveTab] = useState<TabType>(defaultTab);
  const [isClosing, setIsClosing] = useState(false); // 控制关闭动画
  const [shouldRender, setShouldRender] = useState(isOpen); // 控制组件渲染
  const [isVisible, setIsVisible] = useState(false); // 控制弹窗可见性
  const isIOS = isCapacitorIOS();
  const scrollLockRef = useRef<{ scrollY: number; bodyTop: string; bodyPosition: string; bodyWidth: string; htmlOverflow: string; htmlOverscrollBehavior: string; rootPointerEvents: string; rootTouchAction: string } | null>(null);

  // 二级页面检测状态
  const [isDetailView, setIsDetailView] = useState(false);
  const [detailTitle, setDetailTitle] = useState('');

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
    isRebounding: false, // 使用Hook内部的isRebounding状态
    closeThreshold: 100,
    velocityThreshold: 0.5,
    reboundDuration: 300,
    enableMobileOnly: true
  });

  // 当 defaultTab 改变时更新 activeTab
  useEffect(() => {
    setActiveTab(defaultTab);
  }, [defaultTab]);

  // 检测二级页面状态
  useEffect(() => {
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
      // 额外的延迟检测，确保DOM完全更新
      setTimeout(detectDetailView, 50);
      setTimeout(detectDetailView, 100);
    };

    // 初始检测
    const timer = setTimeout(detectWithRetry, 10);
    
    // 监听DOM属性变化
    const observer = new MutationObserver(() => {
      // 延迟检测，确保属性变化完全生效
      setTimeout(detectDetailView, 10);
    });
    
    // 开始观察
    const startObserving = () => {
      const activeTabElement = document.querySelector(`[data-${activeTab}-page]`);
      if (activeTabElement) {
        observer.observe(activeTabElement, {
          attributes: true,
          attributeFilter: ['data-is-detail-view', 'data-detail-title']
        });
        // 观察子树变化，捕获更多DOM变化
        observer.observe(activeTabElement, {
          childList: true,
          subtree: true,
          attributes: true,
          attributeFilter: ['data-is-detail-view', 'data-detail-title']
        });
      }
    };
    
    // 延迟开始观察，确保元素已存在
    const observerTimer = setTimeout(startObserving, 50);
    
    return () => {
      clearTimeout(timer);
      clearTimeout(observerTimer);
      observer.disconnect();
    };
  }, [activeTab, isOpen]); // 依赖activeTab和isOpen变化

  // 处理弹窗打开逻辑
  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
      setIsClosing(false); // 确保关闭状态也被重置
      // 重置所有拖动相关状态为初始值
      resetDragState();
      
      // 延迟一帧开始入场动画，确保初始状态正确
      const timer = setTimeout(() => {
        setIsVisible(true);
      }, 10);
      return () => clearTimeout(timer);
    } else if (shouldRender) {
      // 开始关闭流程
      setIsClosing(true);
      setIsVisible(false);
      
      // 等待动画完成后隐藏组件
      const delay = window.innerWidth < 768 ? 300 : 200;
      const timer = setTimeout(() => {
        setShouldRender(false);
        setIsClosing(false);
      }, delay);
      return () => clearTimeout(timer);
    }
  }, [isOpen]); // 只依赖isOpen，避免循环依赖

  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const root = document.getElementById('root') as HTMLElement | null;
    const isPhone = () => {
      const w = window.innerWidth;
      const ua = navigator.userAgent || '';
      const isMobileUA = /Mobi|Android|iPhone|iPod/i.test(ua);
      const isIPad = /iPad/i.test(ua);
      return w < 768 && isMobileUA && !isIPad;
    };
    if (isOpen && isPhone()) {
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

  const tabs = [
    {
      id: 'global' as TabType,
      name: '全局设置',
      icon: Globe,
      component: GlobalSettingsPage
    },
    {
      id: 'config' as TabType,
      name: '模型',
      icon: Settings,
      component: ConfigPage
    },
    {
      id: 'roles' as TabType,
      name: '角色卡',
      icon: Users,
      component: RolesPage
    },
    {
      id: 'userRoles' as TabType,
      name: '用户角色',
      icon: UserCircle,
      component: userRolesPage
    },
    {
      id: 'knowledge' as TabType,
      name: '知识库',
      icon: BookOpen,
      component: KnowledgePage
    },
    {
      id: 'globalPrompts' as TabType,
      name: '全局提示词',
      icon: FileText,
      component: GlobalPromptsPage
    },
    {
      id: 'voice' as TabType,
      name: '语音',
      icon: Volume2,
      component: VoiceSettingsPage
    },
    {
      id: 'search' as TabType,
      name: '网络搜索',
      icon: Search,
      component: SearchSettingsPage
    },
    {
      id: 'data' as TabType,
      name: '数据',
      icon: Database,
      component: DataPage
    },

  ];

  const ActiveComponent = tabs.find(tab => tab.id === activeTab)?.component || ConfigPage;

  // 移动端：使用 MobileNav，点击列表项通过 NavLink 进入详情页

  // 桌面端标签切换处理函数
  const handleDesktopTabClick = (tabId: TabType) => {
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

  const handleClose = () => {
    // 如果正在回弹或拖动，不允许关闭
    if (isRebounding || isDragging) {
      return;
    }
    
    // 统一调用onClose，动画由useEffect处理
    onClose();
  };

  // 移动端根页面：设置入口列表
  const SettingsRootList: React.FC = () => {
    return (
      <div className="flex flex-col relative overflow-hidden">
        <div 
          {...bind()}
          className={cn(
            "px-2 border-b border-base-300 flex h-[var(--height-header)]",
            "cursor-move select-none",
            "md:touch-auto touch-none",
            isDragging && "bg-base-200/50"
          )}
        >
          <div className="flex w-[var(--height-header)] h-[var(--height-header)] items-center justify-center">
            <button onClick={handleClose} className="btn btn-circle">
              <X className="h-5 w-5" />
            </button>
          </div>
          <h2 className="text-lg font-semibold text-base-content m-auto items-center justify-center flex w-[calc(100%-2rem)]">设置</h2>
          <div className="flex w-[var(--height-header)] h-[var(--height-header)] items-center justify-center">
          </div>
        </div>
        <div className="flex-1 overflow-y-scroll max-h-[calc(100vh-env(safe-area-inset-bottom)-var(--height-header))] h-[calc(100vh-env(safe-area-inset-bottom)-var(--height-header))] md:max-h-auto md:h-auto overscroll-contain">
          <ul className="join join-vertical p-4 space-y-0 w-full min-h-[calc(100vh-env(safe-area-inset-bottom)-var(--height-header)+1px)]">
            {tabs.map((tab, index) => {
              const Icon = tab.icon;
              const isLast = index === tabs.length - 1;
              return (
                // <li key={tab.id} className="join-item-hero border-x border-base-300 first:border-t last:border-b">
                  <NavLink
                    key={tab.id}
                    component={PageWrapper as any}
                    props={{ title: tab.name, Component: tab.component, tabId: tab.id }}
                    className="flex items-center gap-4 w-full text-left p-0 pl-4 active:bg-base-200 md:hover:bg-base-200 transition-colors join-item-box"
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
                // </li>
              )
            })}
          </ul>
        </div>
      </div>
    )
  };

  // 移动端详情页包装：带返回与关闭按钮
  const PageWrapper: React.FC<{ title: string; Component: React.ComponentType<any>; tabId?: TabType }> = ({ title, Component, tabId }) => {
    useEffect(() => { setActiveTab((tabId as TabType) || activeTab); }, [tabId]);
    return (
      <div className="flex flex-col overflow-hidden min-h-full">
        <div 
          {...bind()}
          className={cn(
            "px-2 border-b border-base-300 flex items-center gap-3 h-16",
            "cursor-move select-none",
            "md:touch-auto touch-none",
            isDragging && "bg-base-200/50"
          )}
        >
          <div className="flex w-16 h-16 items-center justify-center">
            <BackButton className="btn btn-circle">
              <ChevronLeft className="h-5 w-5" />
            </BackButton>
          </div>
          <h2 className="text-lg font-semibold text-base-content m-auto items-center justify-center flex w-[calc(100%-2rem)]">{title}</h2>
          <div className="flex w-16 h-16 items-center justify-center">
          </div>
        </div>
        <div className="flex-1 overflow-y-scroll max-h-[calc(100vh-4rem)] h-[calc(100vh-4rem)] md:max-h-auto md:h-auto overscroll-contain">
          <Component className="min-h-[calc(100vh-4rem+1px)]" onCloseModal={handleClose} />
        </div>
      </div>
    )
  };

  if (!shouldRender) {
    return null;
  }

  const isMobile = window.innerWidth < 768;

  return (
    <div className={cn(
      "fixed inset-0 z-50",
      // 桌面端：居中显示
      "md:flex md:items-center md:justify-center",
      // 移动端：顶部预留1rem
      "pt-4 md:pt-0",
      // PWA 安全区
      "pt-[env(safe-area-inset-top)]"
    )}>
      {/* 背景遮罩 */}
      <div 
        className={cn(
          "modal-backdrop absolute inset-0 bg-black/50",
          // 桌面端保留透明动画
          "md:animate-in md:fade-in md:duration-200",
          // 移动端透明度动画
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
          // 桌面端：居中弹窗
          "md:rounded-lg md:w-full md:max-w-6xl md:h-[800px] md:max-h-[calc(100vh-2rem)] md:mx-4",
          // 移动端：全屏减去顶部预留空间
          "w-full h-full",
          // iOS 专属动画模式
          isIOS && "ios-mode",
          // 拖动距离超过阈值时禁用所有子元素的指针事件，防止误触按钮
          isChildrenDisabled && "[&_*]:pointer-events-none",
          // 桌面端透明度和位移动画
          "md:transition-all md:duration-200 md:ease-out",
          // 移动端滑入滑出动画 - 拖动或回弹时禁用 CSS transition
          (isDragging || isRebounding) ? "" : "transition-transform duration-200 ease-[cubic-bezier(0.25,0.46,0.45,0.94)]",
          // 桌面端透明度和位移控制 - 使用isVisible状态实现淡入淡出和上下弹入弹出
          isVisible && !isClosing 
            ? "md:opacity-100 md:translate-y-0" 
            : "md:opacity-0 md:translate-y-2",
          // 移动端动画状态控制
          (isDragging || isRebounding)
            ? "" // 拖动或回弹时不使用 Tailwind transform，避免与内联样式冲突
            : isVisible && !isClosing
            ? "translate-y-0"                     // 可见状态：正常位置
            : "translate-y-full md:translate-y-2" // 隐藏状态：移动端在屏幕下方，桌面端稍微下方
        )}
        // 弹窗容器
        style={{
          transform: (isDragging || isRebounding || dragY > 0) 
            ? `translateY(${dragY}px)` 
            : undefined,
        }}
      >
        {/* 左侧导航栏 */}
        <div className="w-64 bg-base-100 border-r-[length:var(--border)] border-base-300/50 flex-shrink-0 hidden md:flex flex-col">
          {/* 标题栏 */}
          <div className="p-6 pb-4">
            <h2 className="text-lg font-semibold text-base-content">设置</h2>
          </div>
          
          {/* 导航菜单 */}
          <div className="flex-1 overflow-y-auto">
            <ul className="menu p-3 space-y-1 w-full">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <li key={tab.id}>
                    <button
                      onClick={() => handleDesktopTabClick(tab.id)}
                      className={cn(
                        'flex items-center gap-3 w-full text-left rounded-lg px-3 py-2 transition-colors',
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

        {/* 移动端内容：使用标准 MobileNav 组件 */}
        <div className="md:hidden w-full flex flex-col relative overflow-hidden">
          <NavProvider root={SettingsRootList}>
            <NavContainer animated swipeGesture iosSwipeStartMargin={isIOS ? 0 : 30} />
          </NavProvider>
        </div>

        {/* 右侧内容区域（仅桌面端渲染，避免移动端渲染导致 NavLink 无 Provider） */}
        { !isMobile && (
        <div className="hidden md:flex flex-1 flex-col min-h-0">
          {/* 桌面端标题栏 */}
          <div className="flex items-center justify-between p-6 pb-4 flex-shrink-0">
            <div className="flex items-center gap-3">
              {isDetailView && detailTitle ? (
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => {
                      // 对于二级页面，我们需要返回到上一级而不是关闭整个模态框
                      // 查找知识库条目管理器的返回按钮并触发点击
                      const knowledgeEntryBackButton = document.querySelector('.knowledge-entry-manager [data-back-button]') as HTMLButtonElement;
                      if (knowledgeEntryBackButton) {
                        knowledgeEntryBackButton.click();
                      } else {
                        // 如果没找到特定的返回按钮，则查找通用返回按钮
                        const backButton = document.querySelector('[data-back-button]') as HTMLButtonElement;
                        if (backButton) {
                          backButton.click();
                        }
                      }
                      
                      // 强制更新状态，确保返回后状态正确
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
                      
                      // 多次检测确保状态正确更新
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
              onClick={handleClose}
              className="btn btn-ghost btn-sm btn-circle"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          
          {/* 内容区域 */}
          <div className="flex-1 overflow-y-auto min-h-0">
            {(ActiveComponent as any) && (
              <ActiveComponent 
                {...({ className: 'h-full' } as any)}
                onCloseModal={handleClose} 
              />
            )}
          </div>
        </div>
        )}
      </div>
    </div>
  );
};

export default SettingsModal;
