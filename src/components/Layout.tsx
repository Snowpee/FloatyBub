import React, { useState, useEffect, useRef } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAppStore } from '../store';
import {
  MessageCircle,
  Settings,
  Menu,
  Plus,
  Trash2,
  MoreHorizontal,
  Pin,
  Palette,
  EyeOff
} from 'lucide-react';
import { cn } from '../lib/utils';
import { toast } from 'sonner';
import Popconfirm from './Popconfirm';


const Layout: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { theme, setTheme } = useAppStore();
  const {
    sidebarOpen,
    toggleSidebar,
    createChatSession,
    chatSessions,
    setCurrentSession,
    deleteChatSession,
    hideSession
  } = useAppStore();
  
  // 从URL中获取当前会话ID
  const currentSessionId = location.pathname.startsWith('/chat/') 
    ? location.pathname.split('/chat/')[1] 
    : null;

  // 监听主题变化
  useEffect(() => {
    console.log('📱 Layout 组件主题状态变化:', {
      theme,
      documentDataTheme: document.documentElement.getAttribute('data-theme'),
      documentHasDarkClass: document.documentElement.classList.contains('dark'),
      timestamp: new Date().toISOString()
    });
  }, [theme]);


  // 监听窗口大小变化，在移动端和桌面端切换时调整侧边栏状态
  useEffect(() => {
    const handleResize = () => {
      const isMobile = window.innerWidth < 768;
      // 如果从桌面端切换到移动端，自动关闭侧边栏
      if (isMobile && sidebarOpen) {
        toggleSidebar();
      }
      // 如果从移动端切换到桌面端，自动打开侧边栏
      else if (!isMobile && !sidebarOpen) {
        toggleSidebar();
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [sidebarOpen, toggleSidebar]);

  // 移除navigation数组，不再需要

  // 显示最近的会话（只显示未隐藏的会话）
  const recentSessions = chatSessions
    .filter(session => !session.isHidden)
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 20);

  // 为每个会话创建ref的映射
  const sessionRefs = useRef<Record<string, React.RefObject<HTMLAnchorElement>>>({});
  
  // 确保每个会话都有对应的ref
  recentSessions.forEach(session => {
    if (!sessionRefs.current[session.id]) {
      sessionRefs.current[session.id] = React.createRef<HTMLAnchorElement>();
    }
  });
  
  // 清理不存在的会话的ref
  const existingSessionIds = new Set(recentSessions.map(s => s.id));
  Object.keys(sessionRefs.current).forEach(sessionId => {
    if (!existingSessionIds.has(sessionId)) {
      delete sessionRefs.current[sessionId];
    }
  });

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('zh-CN', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(date));
  };

  const getMessagePreview = (messages: any[]) => {
    const lastUserMessage = messages.filter(m => m.role === 'user').pop();
    return lastUserMessage?.content || '暂无消息';
  };

  const deleteSession = (sessionId: string) => {
    deleteChatSession(sessionId);
    toast.success('会话已删除');
  };

  // 检测是否为移动设备
  const isMobile = () => {
    return window.innerWidth < 1024; // lg breakpoint
  };

  // 在移动端自动关闭侧边栏
  const closeSidebarOnMobile = () => {
    if (isMobile() && sidebarOpen) {
      toggleSidebar();
    }
  };

  const handleNewChat = () => {
    // 导航到聊天页面，让用户选择角色
    navigate('/chat');
    // 在移动端自动关闭侧边栏
    closeSidebarOnMobile();
  };

  return (
    <div className="min-h-screen bg-base-200 flex">
      {/* 侧边栏 */}
      <div className={cn(
        'w-64 bg-base-100 border-r border-base-300 transition-all duration-200 ease-in-out flex-shrink-0',
        // 移动端：固定定位
        'fixed lg:fixed z-40 h-full lg:h-screen',
        // 显示控制：移动端和桌面端都根据sidebarOpen状态控制
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      )}>
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center justify-between h-16 px-4 border-b border-base-300 box-content">
            <a href="/" className="flex items-center">
              <h1 className="text-xl font-bold text-base-content">Floaty Bub</h1>
            </a>
          </div>

          {/* 新建聊天按钮 */}
          <div className="p-4 pb-0">
            <button
              onClick={handleNewChat}
              className="btn btn-soft btn-accent btn-block"
            >
              <Plus className="h-4 w-4" />
              新建聊天
            </button>
          </div>

          {/* 导航菜单已移除，保留新建聊天按钮作为主要入口 */}



          {/* 历史对话列表 */}
          <div className="flex-1 overflow-y-auto p-4">
            <div className="space-y-2">
              {recentSessions.length === 0 ? (
                <div className="text-center py-8">
                  <MessageCircle className="h-8 w-8 text-base-content/40 mx-auto mb-2" />
                  <p className="text-xs text-base-content/60">
                    还没有聊天记录
                  </p>
                </div>
              ) : (
                recentSessions.map((session) => {
                  const isActive = session.id === currentSessionId;
                  const linkRef = sessionRefs.current[session.id];
                  return (
                  <Link
                    ref={linkRef}
                    key={session.id}
                    to={`/chat/${session.id}`}
                    onClick={() => {
                      setCurrentSession(session.id);
                      // 在移动端自动关闭侧边栏
                      closeSidebarOnMobile();
                    }}
                    className={cn(
                      "block p-3 rounded-lg transition-colors group",
                      isActive 
                        ? "bg-base-300" 
                        : "hover:bg-base-200"
                    )}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-medium text-base-content truncate mb-1">
                          {session.title}
                        </h4>
                        <div className="flex items-center text-xs text-base-content/60 mb-1">
                          {formatDate(session.updatedAt)}
                        </div>
                        <p className="text-xs text-base-content/70 line-clamp-2">
                          {getMessagePreview(session.messages)}
                        </p>
                      </div>
                      <div 
                        className="dropdown dropdown-end"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                        }}
                      >
                        <button
                          tabIndex={0}
                          className="opacity-100 md:opacity-0 md:group-hover:opacity-100 btn btn-ghost btn-xs"
                          title="更多操作"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </button>
                        <ul tabIndex={0} className="dropdown-content z-[1] menu p-2 shadow bg-base-100 rounded-box w-32">
                          <li>
                            <button
                              onClick={() => {
                                // TODO: 实现置顶功能
                                console.log('置顶会话:', session.id);
                                // 关闭dropdown
                                (document.activeElement as HTMLElement)?.blur();
                              }}
                              className="text-sm"
                            >
                              <Pin className="h-4 w-4" />
                              置顶
                            </button>
                          </li>
                          <li>
                            <button
                               onClick={() => {
                                 hideSession(session.id);
                                 toast.success('会话已移除');
                                 // 关闭dropdown
                                 (document.activeElement as HTMLElement)?.blur();
                               }}
                               className="text-sm"
                             >
                               <EyeOff className="h-4 w-4" />
                               移除对话
                             </button>
                          </li>
                          <li>
                            <Popconfirm
                              title="确认删除？"
                              description={`删除会话后无法恢复`}
                              onConfirm={() => {
                                deleteSession(session.id);
                              }}
                              onOpen={() => {
                                // Popconfirm显示时立即关闭dropdown
                                const dropdownElement = document.querySelector('.dropdown.dropdown-end');
                                if (dropdownElement) {
                                  const button = dropdownElement.querySelector('button[tabindex="0"]') as HTMLElement;
                                  button?.blur();
                                }
                                (document.activeElement as HTMLElement)?.blur();
                              }}
                              onClose={() => {
                                // 关闭dropdown
                                const dropdownElement = document.querySelector('.dropdown.dropdown-end');
                                if (dropdownElement) {
                                  const button = dropdownElement.querySelector('button[tabindex="0"]') as HTMLElement;
                                  button?.blur();
                                }
                                (document.activeElement as HTMLElement)?.blur();
                              }}
                              placement="right"
                              okText="删除"
                              cancelText="取消"
                              getPopupContainer={() => linkRef?.current || undefined}
                            >
                              <button className="text-sm text-error w-full text-left flex items-center">
                                <Trash2 className="h-4 w-4 mr-2" />
                                删除
                              </button>
                            </Popconfirm>
                          </li>
                        </ul>
                      </div>
                    </div>
                  </Link>
                  );
                })
              )}
            </div>
          </div>

          {/* 底部操作区 */}
          <div className="p-4 border-t border-base-300">
            <div className="grid grid-cols-1 gap-2">

              
              <div className="grid grid-cols-2 gap-2">
                <Link
                  to="/settings"
                  onClick={closeSidebarOnMobile}
                  className="btn btn-ghost btn-sm"
                >
                  <Settings className="h-4 w-4" />
                  设置
                </Link>
                
                <div className="dropdown dropdown-top dropdown-end">
                  <button
                    tabIndex={0}
                    className="btn btn-ghost btn-sm"
                    title="切换主题"
                  >
                    <Palette className="h-4 w-4" />
                    {theme === 'light' ? '亮色' : theme === 'dark' ? '深色' : theme === 'cupcake' ? '杯子蛋糕' : theme === 'floaty' ? '幻想' : '主题'}
                  </button>
                  <ul tabIndex={0} className="dropdown-content z-[1] menu p-2 shadow bg-base-100 rounded-box w-32">
                    <li>
                      <button
                        onClick={() => {
                          setTheme('light');
                          (document.activeElement as HTMLElement)?.blur();
                        }}
                        className={`text-sm ${theme === 'light' ? 'bg-base-200' : ''}`}
                      >
                        亮色主题
                      </button>
                    </li>
                    <li>
                      <button
                        onClick={() => {
                          setTheme('dark');
                          (document.activeElement as HTMLElement)?.blur();
                        }}
                        className={`text-sm ${theme === 'dark' ? 'bg-base-200' : ''}`}
                      >
                        深色主题
                      </button>
                    </li>
                    <li>
                      <button
                        onClick={() => {
                          console.log('🎨 点击杯子蛋糕主题按钮');
                          console.log('🎨 当前主题:', theme);
                          setTheme('cupcake');
                          console.log('🎨 调用 setTheme 完成');
                          // 延迟检查主题是否生效
                          setTimeout(() => {
                            const currentStoreTheme = useAppStore.getState().theme;
                            console.log('🎨 延迟检查 - 当前主题:', document.documentElement.getAttribute('data-theme'));
                            console.log('🎨 延迟检查 - store 主题:', currentStoreTheme);
                            console.log('🎨 延迟检查 - 主题切换验证:', {
                              domTheme: document.documentElement.getAttribute('data-theme'),
                              storeTheme: currentStoreTheme,
                              isConsistent: document.documentElement.getAttribute('data-theme') === currentStoreTheme
                            });
                          }, 100);
                          (document.activeElement as HTMLElement)?.blur();
                        }}
                        className={`text-sm ${theme === 'cupcake' ? 'bg-base-200' : ''}`}
                      >
                        杯子蛋糕
                      </button>
                    </li>
                    <li>
                      <button
                        onClick={() => {
                          setTheme('floaty');
                          (document.activeElement as HTMLElement)?.blur();
                        }}
                        className={`text-sm ${theme === 'floaty' ? 'bg-base-200' : ''}`}
                      >
                        幻想主题
                      </button>
                    </li>

                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 主内容区域 */}
      <div className={cn(
        "flex flex-col flex-1 min-h-screen transition-all duration-200 ease-in-out h-screen",
        // 在桌面端根据侧边栏状态调整左边距
        sidebarOpen ? "lg:ml-64" : "lg:ml-0"
      )}>
        {/* 顶部栏 */}
        <header className="bg-base-100 bg-opacity-90 border-b border-base-300 backdrop-blur">
          <div className="flex items-center justify-between h-16 px-4">
            <div className="flex items-center space-x-4">
              <button
                onClick={toggleSidebar}
                className="btn btn-ghost btn-sm"
              >
                <Menu className="h-5 w-5" />
              </button>
              

            </div>
            

            
            {/* 会话标题 - 居中显示 */}
            {location.pathname.startsWith('/chat') && currentSessionId && (() => {
              const currentSession = chatSessions.find(s => s.id === currentSessionId);
              return currentSession ? (
                <div className="flex-1 text-center">
                  <h1 className="text-lg font-medium text-base-content truncate max-w-xs mx-auto">
                    {currentSession.title}
                  </h1>
                </div>
              ) : null;
            })()}
          </div>
        </header>

        {/* 页面内容 */}
        <main className="flex-1 overflow-scroll">
          <Outlet />
        </main>
      </div>

      {/* 移动端遮罩 */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={toggleSidebar}
        />
      )}


    </div>
  );
};

export default Layout;