import React, { useState, useEffect, useRef } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAppStore } from '../store';
import { toast } from '../hooks/useToast';
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
import Popconfirm from './Popconfirm';
import SettingsModal from './SettingsModal';

type TabType = 'config' | 'roles' | 'userProfiles' | 'globalPrompts' | 'voice' | 'data' | 'history';


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
    hideSession,
    createTempSession,

    currentModelId,
    tempSessionId,
    deleteTempSession
  } = useAppStore();
  
  // 设置弹窗状态
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsDefaultTab, setSettingsDefaultTab] = useState<TabType>('config');
  
  // 从URL中获取当前对话ID
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

  // 监听 hash 变化来控制设置弹窗
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash;
      
      if (hash.startsWith('#setting')) {
        // 解析设置页面类型
        const settingPath = hash.replace('#setting', '').replace('/', '');
        const validTabs = ['config', 'roles', 'userProfiles', 'globalPrompts', 'voice', 'data', 'history'];
        
        // 设置默认页面
        if (settingPath && validTabs.includes(settingPath)) {
          setSettingsDefaultTab(settingPath as TabType);
        } else {
          setSettingsDefaultTab('config');
        }
        
        // 打开设置弹窗
        setIsSettingsOpen(true);
      } else {
        // 关闭设置弹窗
        setIsSettingsOpen(false);
      }
    };

    // 初始检查
    handleHashChange();
    
    // 监听 hash 变化
    window.addEventListener('hashchange', handleHashChange);
    
    return () => {
      window.removeEventListener('hashchange', handleHashChange);
    };
  }, []);


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

  // 显示最近的对话（只显示未隐藏的对话，过滤掉临时对话和没有用户消息的对话）
  const recentSessions = chatSessions
    .filter(session => {
      // 过滤掉隐藏的对话
      if (session.isHidden) {
        return false;
      }
      // 过滤掉临时对话
      if (tempSessionId === session.id) {
        return false;
      }
      // 只显示包含至少一条用户消息的对话
      const hasUserMessage = session.messages.some(message => message.role === 'user');
      return hasUserMessage;
    })
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 20);

  // 为每个对话创建ref的映射
  const sessionRefs = useRef<Record<string, React.RefObject<HTMLAnchorElement>>>({});
  
  // 确保每个对话都有对应的ref
  recentSessions.forEach(session => {
    if (!sessionRefs.current[session.id]) {
      sessionRefs.current[session.id] = React.createRef<HTMLAnchorElement>();
    }
  });
  
  // 清理不存在的对话的ref
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
    
    // 如果删除的是当前对话，导航到聊天首页
    if (currentSessionId === sessionId) {
      navigate('/chat');
    }
    
    toast.success('对话已删除');
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

  const handleNewSession = () => {
    // 优先使用当前对话的角色和模型
    const currentSession = chatSessions.find(s => s.id === currentSessionId);
    const roleId = currentSession?.roleId;
    const modelId = currentSession?.modelId || currentModelId;
    
    if (!roleId || !modelId) {
      // 如果没有当前对话或缺少角色/模型信息，导航到角色选择页面
      navigate('/chat');
      closeSidebarOnMobile();
      return;
    }
    
    // 创建新的临时对话，使用当前对话的角色和模型
    const newSessionId = createTempSession(roleId, modelId);
    
    // 导航到新对话页面
    navigate(`/chat/${newSessionId}`);
    closeSidebarOnMobile();
  };

  return (
    <div className="min-h-screen bg-base-200 flex overflow-y-scroll overflow-x-hidden">
      {/* 侧边栏 */}
      <div className={cn(
        'w-64 bg-base-100 border-base-300/50 border-r-[length:var(--border)]  transition-all duration-200 ease-in-out flex-shrink-0',
        // 移动端：固定定位
        'fixed lg:fixed z-40 h-full lg:h-screen',
        // 显示控制：移动端和桌面端都根据sidebarOpen状态控制
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      )}>
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center justify-between h-16 px-4 box-content">
            <a href="/" className="flex items-center">
              <h1 className="text-xl font-bold text-base-content">Floaty Bub</h1>
            </a>
          </div>

          {/* 新建聊天按钮 */}
          <div className="p-4 pb-0">
            <button
              onClick={handleNewChat}
              className="btn btn-block"
            >
              <Plus className="h-4 w-4" />
              新建对话
            </button>
          </div>

          {/* 导航菜单已移除，保留新建聊天按钮作为主要入口 */}



          {/* 历史对话列表 */}
          <div className="flex-1 overflow-y-auto p-4 gradient-mask-y [--gradient-mask-padding:1rem]">
            <div className="space-y-2">
              {recentSessions.length === 0 ? (
                <div className="text-center py-8">
                  <MessageCircle className="h-8 w-8 text-base-content/40 mx-auto mb-2" />
                  <p className="text-xs text-base-content/60">
                    还没有对话记录
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
                      "chat-list p-3 transition-colors group",
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
                                console.log('置顶对话:', session.id);
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
                                 toast.success('对话已从列表中隐藏');
                                 // 关闭dropdown
                                 (document.activeElement as HTMLElement)?.blur();
                               }}
                               className="text-sm"
                             >
                               <EyeOff className="h-4 w-4" />
                               隐藏对话
                             </button>
                          </li>
                          <li>
                            <Popconfirm
                              title="确认删除？"
                              description={`删除对话后无法恢复`}
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
          <div className="p-4 pt-0">
            <div className="grid grid-cols-1 gap-2">

              
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => {
                    window.location.hash = '#setting';
                    closeSidebarOnMobile();
                  }}
                  className="btn btn-ghost btn-sm"
                >
                  <Settings className="h-4 w-4" />
                  设置
                </button>
                
                <div className="dropdown dropdown-top dropdown-end">
                  <button
                    tabIndex={0}
                    className="btn btn-ghost btn-sm"
                    title="切换主题"
                  >
                    <Palette className="h-4 w-4" />
                    {theme === 'floaty' ? '浮光' : theme === 'dark' ? '暗色' : theme === 'light' ? '简洁' : theme === 'cupcake' ? '纸杯蛋糕' : '主题'}
                  </button>
                  <ul tabIndex={0} className="dropdown-content z-[1] menu p-2 w-32">
                    <span className="text-sm text-base-content/40 px-3 py-2">主题</span>
                    <li>
                      <button
                        onClick={() => {
                          setTheme('floaty');
                          (document.activeElement as HTMLElement)?.blur();
                        }}
                        className={`text-sm ${theme === 'floaty' ? 'bg-base-200' : ''}`}
                      >
                        浮光
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
                        暗色
                      </button>
                    </li>
                    <li>
                      <button
                        onClick={() => {
                          setTheme('light');
                          (document.activeElement as HTMLElement)?.blur();
                        }}
                        className={`text-sm ${theme === 'light' ? 'bg-base-200' : ''}`}
                      >
                        简洁
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
                        纸杯蛋糕
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
        <header className="bg-base-100 bg-opacity-90">
          <div className="relative flex items-center h-16 px-4">
            {/* 左侧按钮 */}
            <div className="flex items-center space-x-4">
              <button
                onClick={toggleSidebar}
                className="btn btn-ghost btn-sm"
              >
                <Menu className="h-5 w-5" />
              </button>
            </div>
            
            {/* 对话标题 - 绝对居中显示 */}
            {location.pathname.startsWith('/chat') && currentSessionId && (() => {
              const currentSession = chatSessions.find(s => s.id === currentSessionId);
              return currentSession ? (
                <div className="absolute left-1/2 transform -translate-x-1/2">
                  <h1 className="text-lg font-medium text-base-content truncate max-w-xs">
                    {currentSession.title}
                  </h1>
                </div>
              ) : null;
            })()}
            
            {/* 右侧占位，保持布局平衡 */}
            <div className="flex items-center space-x-4 ml-auto">
              {/* 对话操作下拉选单 - 仅在聊天页面且有当前对话且不是临时对话时显示 */}
              {location.pathname.startsWith('/chat') && currentSessionId && tempSessionId !== currentSessionId && (() => {
                const currentSession = chatSessions.find(s => s.id === currentSessionId);
                return currentSession ? (
                  <div className="dropdown dropdown-end">
                    <button
                      tabIndex={0}
                      className="btn btn-ghost btn-sm"
                      title="更多操作"
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </button>
                    <ul tabIndex={0} className="dropdown-content menu p-2 shadow bg-base-100 rounded-box w-44">
                      <li>
                        <button onClick={() => {
                          handleNewSession();
                          (document.activeElement as HTMLElement)?.blur();
                        }}>
                          <Plus className="h-4 w-4" />
                          新建前角色对话
                        </button>
                      </li>
                      <li>
                        <button
                          onClick={() => {
                            // TODO: 实现置顶功能
                            console.log('置顶对话:', currentSession.id);
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
                             hideSession(currentSession.id);
                             toast.success('对话已从列表中隐藏');
                             // 关闭dropdown
                             (document.activeElement as HTMLElement)?.blur();
                           }}
                           className="text-sm"
                         >
                           <EyeOff className="h-4 w-4" />
                           隐藏对话
                         </button>
                      </li>
                      <li>
                        <Popconfirm
                          title="确认删除？"
                          description={`删除对话后无法恢复`}
                          onConfirm={() => {
                            deleteSession(currentSession.id);
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
                          placement="left"
                          okText="删除"
                          cancelText="取消"
                        >
                          <button className="text-sm text-error w-full text-left flex items-center">
                            <Trash2 className="h-4 w-4 mr-2" />
                            删除
                          </button>
                        </Popconfirm>
                      </li>
                    </ul>
                  </div>
                ) : null;
              })()}
            </div>
          </div>
        </header>

        {/* 页面内容 */}
        <main className="flex-1 overflow-y-scroll">
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

      {/* 设置弹窗 */}
      <SettingsModal 
        isOpen={isSettingsOpen} 
        onClose={() => {
          setIsSettingsOpen(false);
          // 清除 hash
          if (window.location.hash.startsWith('#setting')) {
            window.location.hash = '';
          }
        }}
        defaultTab={settingsDefaultTab}
      />
    </div>
  );
};

export default Layout;