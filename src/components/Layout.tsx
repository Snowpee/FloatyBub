import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  PinOff,
  Palette,
  EyeOff,
  LogIn,
  Edit3,
  User,
  Save,
  X,
  Search,
  Clock,
  BookOpen
} from 'lucide-react';
import { cn } from '../lib/utils';
import Popconfirm from './Popconfirm';
import SettingsModal from './SettingsModal';
import { useAuth } from '../hooks/useAuth';
import { UserAvatar } from './auth/UserAvatar';
import { AuthModal } from './auth/AuthModal';
import HistoryModal from './HistoryModal';
import Avatar from './Avatar';
import VirtualScrollContainer from './VirtualScrollContainer';
import AvatarUpload from './AvatarUpload';
import { useUserData } from '../hooks/useUserData';
import { supabase } from '../lib/supabase';
import { avatarCache } from '../utils/imageCache';
import { useScrollMask } from '../hooks/useScrollMask';



type TabType = 'global' | 'config' | 'roles' | 'userRoles' | 'globalPrompts' | 'voice' | 'data' | 'knowledge' | 'search';


const Layout: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { theme, setTheme, currentUser, setCurrentUser, updateUserProfile } = useAppStore();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  
  // 虚拟滚动配置
  const ITEM_HEIGHT = 44; // 每个聊天项目的固定高度（px）
  const {
    sidebarOpen,
    toggleSidebar,
    createChatSession,
    chatSessions,
    setCurrentSession,
    deleteChatSession,
    updateChatSession,
    hideSession,
    pinSession,
    unpinSession,
    createTempSession,
    aiRoles,
    currentModelId,
    tempSessionId,
    tempSession,
    deleteTempSession
  } = useAppStore();
  
  // 使用智能滚动遮罩 Hook
  const { scrollContainerRef: scrollMaskRef, scrollMaskClasses } = useScrollMask({
    gradientPadding: '1rem'
  });
  
  // 功能开关
  const isUserSystemEnabled = import.meta.env.VITE_ENABLE_USER_SYSTEM === 'true';
  
  // 认证相关
  const { user, loading: authLoading } = useAuth();
  const { queueDataSync } = useUserData();
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  
  // 设置弹窗状态
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsDefaultTab, setSettingsDefaultTab] = useState<TabType>('global');
  
  // 历史记录弹窗状态
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  
  // 用户资料modal状态
  const [isUserProfileModalOpen, setIsUserProfileModalOpen] = useState(false);
  const [editingName, setEditingName] = useState('');
  const [editingAvatar, setEditingAvatar] = useState<string | undefined>(undefined);
  const [isSaving, setIsSaving] = useState(false);
  const userProfileDialogRef = useRef<HTMLDialogElement>(null);
  
  // 重命名状态
  const [renamingSessionId, setRenamingSessionId] = useState<string | null>(null);
  const [renamingTitle, setRenamingTitle] = useState('');
  
  // 从URL中获取当前对话ID
  const currentSessionId = location.pathname.startsWith('/chat/') 
    ? location.pathname.split('/chat/')[1] 
    : null;

  // 用户资料modal处理函数
  const handleOpenUserProfileModal = () => {
    const displayUser = currentUser || user;
    const displayName = currentUser?.name || displayUser?.user_metadata?.display_name || displayUser?.email?.split('@')[0] || 'User';
    const avatarUrl = currentUser?.avatar || displayUser?.user_metadata?.avatar_url;
    
    setEditingName(displayName);
    setEditingAvatar(avatarUrl);
    setIsUserProfileModalOpen(true);
  };

  const handleCloseUserProfileModal = () => {
    const dialog = userProfileDialogRef.current;
    if (dialog) {
      dialog.close();
    }
    setIsUserProfileModalOpen(false);
    setEditingName('');
    setEditingAvatar(undefined);
  };

  const handleSaveUserProfile = async () => {
    console.log('🚀 保存用户资料:', editingName.trim());
    
    if (!editingName.trim()) {
      toast.error('用户名不能为空');
      return;
    }
    
    setIsSaving(true);
    try {
      // 更新本地用户资料
      if (currentUser) {
        updateUserProfile(currentUser.id, {
          name: editingName.trim(),
          avatar: editingAvatar
        });
        console.log('✅ 本地资料已更新');
      }
      
      // 更新Supabase认证用户元数据
      if (user) {
        const updateData = {
          display_name: editingName.trim(),
          avatar_url: editingAvatar
        };
        
        const { error } = await supabase.auth.updateUser({
          data: updateData
        });
        
        if (error) {
          console.error('❌ 更新失败:', error);
          toast.error('保存失败，请重试');
          return;
        }
        
        // 重新获取用户数据并更新本地状态
        const { data: { user: updatedUser }, error: getUserError } = await supabase.auth.getUser();
        
        if (getUserError) {
          console.error('❌ 获取用户数据失败:', getUserError);
        } else if (updatedUser) {
          const newUserState = {
            id: currentUser?.id || updatedUser.id,
            name: updatedUser.user_metadata?.display_name || currentUser?.name || 'User',
            email: currentUser?.email || updatedUser.email || '',
            avatar: updatedUser.user_metadata?.avatar_url || currentUser?.avatar || '',
            preferences: currentUser?.preferences || {}
          };
          
          setCurrentUser(newUserState);
          console.log('✅ 用户资料更新完成:', newUserState.name);
          
          // 同步用户资料到数据库
          const userData = {
            user_id: updatedUser.id,
            name: updatedUser.user_metadata?.display_name || editingName.trim(),
            avatar: updatedUser.user_metadata?.avatar_url || editingAvatar,
            email: updatedUser.email || ''
          };
          
          await queueDataSync('user_profile', userData);
          console.log('✅ 用户资料已同步到数据库');
        }
      }
      
      toast.success('用户资料更新成功');
      handleCloseUserProfileModal();
    } catch (error) {
      console.error('💥 保存失败:', error);
      toast.error('保存失败，请重试');
    } finally {
      setIsSaving(false);
    }
  };

  // 使用 dialog 元素控制模态框显示
  useEffect(() => {
    const dialog = userProfileDialogRef.current;
    if (!dialog) return;

    if (isUserProfileModalOpen) {
      dialog.showModal();
    }
    
    // 监听 dialog 的关闭事件，确保状态同步
    const handleDialogClose = () => {
      if (isUserProfileModalOpen) {
        setIsUserProfileModalOpen(false);
        setEditingName('');
        setEditingAvatar(undefined);
      }
    };
    
    dialog.addEventListener('close', handleDialogClose);
    
    return () => {
      dialog.removeEventListener('close', handleDialogClose);
    };
  }, [isUserProfileModalOpen]);

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
        const validTabs = ['global', 'config', 'roles', 'userRoles', 'globalPrompts', 'voice', 'data', 'knowledge', 'search'];
        
        // 设置默认页面
        if (settingPath && validTabs.includes(settingPath)) {
          setSettingsDefaultTab(settingPath as TabType);
        } else {
          setSettingsDefaultTab('global');
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
      const isDesktop = window.innerWidth >= 1024;
      const isMobile = window.innerWidth < 768;
      
      // 如果从桌面端切换到平板/移动端，自动关闭侧边栏
      if (!isDesktop && sidebarOpen) {
        toggleSidebar();
      }
      // 如果从平板/移动端切换到桌面端，自动打开侧边栏
      else if (isDesktop && !sidebarOpen) {
        toggleSidebar();
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [sidebarOpen, toggleSidebar]);

  // 预加载用户头像
  useEffect(() => {
    const displayUser = currentUser || user;
    const avatarUrl = currentUser?.avatar || displayUser?.user_metadata?.avatar_url;
    
    if (avatarUrl) {
      // 预加载用户头像到缓存
      avatarCache.preloadImage(avatarUrl).catch(error => {
        console.warn('预加载用户头像失败:', error);
      });
    }
  }, [currentUser, user]);

  // 移除navigation数组，不再需要

  // 获取会话的最后活跃时间（最后消息时间或更新时间）
  const getLastActiveTime = (session: any) => {
    if (session.messages && session.messages.length > 0) {
      const lastMessage = session.messages[session.messages.length - 1];
      // 优先使用 message_timestamp，其次是 timestamp，最后是 updatedAt
      const messageTime = lastMessage.message_timestamp || lastMessage.timestamp;
      if (messageTime) {
        const time = new Date(messageTime).getTime();
        return time;
      }
    }
    // 如果没有消息或消息没有时间戳，使用会话的更新时间
    const time = new Date(session.updatedAt).getTime();
    return time;
  };

  // 过滤会话数据
  const filteredSessions = chatSessions
    .filter(session => {
      // 过滤掉隐藏的对话
      if (session.isHidden) {
        return false;
      }
      // 临时会话现在存储在tempSession字段中，不在chatSessions数组里，所以不需要过滤
      // 只显示包含至少一条用户消息的对话
      const hasUserMessage = session.messages.some(message => message.role === 'user');
      return hasUserMessage;
    })
    .sort((a, b) => {
      // 首先按置顶状态排序，置顶的在前面
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      
      // 获取最后活跃时间作为主要排序依据
      const aTime = getLastActiveTime(a);
      const bTime = getLastActiveTime(b);
      
      // 按最后活跃时间降序排序（最近活跃的在前）
      return bTime - aTime;
    });

  // 所有会话数据，用于虚拟滚动
  const allSessions = filteredSessions;
  const totalSessions = filteredSessions.length;
  

  
  // 为每个对话创建ref的映射
  const sessionRefs = useRef<Record<string, React.RefObject<HTMLAnchorElement>>>({});
  
  // 确保每个对话都有对应的ref
  allSessions.forEach(session => {
    if (!sessionRefs.current[session.id]) {
      sessionRefs.current[session.id] = React.createRef<HTMLAnchorElement>();
    }
  });
  
  // 清理不存在的对话的ref
  const existingSessionIds = new Set(allSessions.map(s => s.id));
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

  // 根据roleId获取AI角色信息
  const getAIRole = (roleId: string) => {
    return aiRoles.find(role => role.id === roleId) || aiRoles[0];
  };

  const deleteSession = async (sessionId: string) => {
    try {
      await deleteChatSession(sessionId);
      
      // 如果删除的是当前对话，导航到聊天首页
      if (currentSessionId === sessionId) {
        navigate('/chat');
      }
      
      toast.success('对话已移至回收站');
    } catch (error) {
      console.error('删除对话失败:', error);
      toast.error(error instanceof Error ? error.message : '删除对话失败');
    }
  };

  // 检测是否为移动设备
  const isMobile = () => {
    return window.innerWidth < 1024; // lg breakpoint
  };

  // 在非桌面端（移动端和平板端）自动关闭侧边栏
  const closeSidebarOnNonDesktop = () => {
    if (isMobile() && sidebarOpen) {
      toggleSidebar();
    }
  };

  // 渲染单个聊天项目的函数
  const renderChatItem = useCallback((session: any, index: number, isVisible: boolean) => {
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
          closeSidebarOnNonDesktop();
        }}
        className={cn(
          "chat-list p-3 my-1 transition-colors group block group",
          isActive 
            ? "bg-base-300" 
            : "hover:bg-base-200"
        )}
        style={{ height: ITEM_HEIGHT }}
      >
        <div className="flex items-center justify-between h-full">
          <div className="flex items-center flex-1 min-w-0 gap-2">
            <Avatar
              name={getAIRole(session.roleId)?.name || '未知角色'}
              avatar={getAIRole(session.roleId)?.avatar}
              size="sm"
            />
            <h4 className="text-sm font-normal text-base-content truncate">
              {session.title}
            </h4>
            {session.isPinned && (
              <Pin className="h-3 w-3 text-base-content/50 flex-shrink-0 mr-1" />
            )}
          </div>
          <div 
            className="dropdown dropdown-end md:hidden group-hover:block"
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
            <ul tabIndex={0} className="dropdown-content z-[1] menu p-2 shadow bg-base-100 rounded-box w-36">
              <li>
                <button
                  onClick={() => {
                    if (session.isPinned) {
                      unpinSession(session.id);
                    } else {
                      pinSession(session.id);
                    }
                    // 关闭dropdown
                    (document.activeElement as HTMLElement)?.blur();
                  }}
                  className="text-sm"
                >
                  {session.isPinned ? (
                    <PinOff className="h-4 w-4" />
                  ) : (
                    <Pin className="h-4 w-4" />
                  )}
                  {session.isPinned ? '取消置顶' : '置顶'}
                </button>
              </li>
              <li>
                <Popconfirm
                  title="重命名对话"
                  description={
                    <div className="">
                      <input
                        type="text"
                        value={renamingSessionId === session.id ? renamingTitle : session.title}
                        onChange={(e) => {
                          if (renamingSessionId === session.id) {
                            setRenamingTitle(e.target.value);
                          } else {
                            setRenamingSessionId(session.id);
                            setRenamingTitle(e.target.value);
                          }
                        }}
                        className="input w-full p-2 text-sm"
                        placeholder="输入新的对话标题..."
                      />
                    </div>
                  }
                  onConfirm={() => {
                    if (renamingTitle.trim()) {
                      updateChatSession(session.id, { title: renamingTitle.trim() });
                      setRenamingSessionId(null);
                      setRenamingTitle('');
                      toast.success('对话已重命名');
                    }
                  }}
                  onCancel={() => {
                    setRenamingSessionId(null);
                    setRenamingTitle('');
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
                  okText="确认"
                  cancelText="取消"
                  getPopupContainer={() => sessionRefs.current[session.id]?.current || undefined}
                >
                  <button className="text-sm w-full text-left flex items-center">
                    <Edit3 className="h-4 w-4 mr-2" />
                    重命名
                  </button>
                </Popconfirm>
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
                  title="移至回收站？"
                  description={`对话将移至回收站，不会立即永久删除`}
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
                  okText="移至回收站"
                  cancelText="取消"
                  getPopupContainer={() => linkRef?.current || undefined}
                >
                  <button className="text-sm text-error w-full text-left flex items-center">
                    <Trash2 className="h-4 w-4 mr-2" />
                    移至回收站
                  </button>
                </Popconfirm>
              </li>
            </ul>
          </div>
        </div>
      </Link>
    );
  }, [currentSessionId, renamingSessionId, renamingTitle, setCurrentSession, closeSidebarOnNonDesktop, getAIRole, updateChatSession, hideSession, deleteSession, sessionRefs, ITEM_HEIGHT]);

  const handleNewChat = () => {
    // 导航到聊天页面，让用户选择角色
    navigate('/chat');
    // 在移动端自动关闭侧边栏
    closeSidebarOnNonDesktop();
  };

  const handleNewSession = () => {
    // 优先使用当前对话的角色和模型
    const currentSession = chatSessions.find(s => s.id === currentSessionId);
    const roleId = currentSession?.roleId;
    const modelId = currentSession?.modelId || currentModelId;
    
    if (!roleId || !modelId) {
      // 如果没有当前对话或缺少角色/模型信息，导航到角色选择页面
      navigate('/chat');
      closeSidebarOnNonDesktop();
      return;
    }
    
    // 创建新的临时对话，使用当前对话的角色和模型
    const newSessionId = createTempSession(roleId, modelId);
    
    // 导航到新对话页面
    navigate(`/chat/${newSessionId}`);
    closeSidebarOnNonDesktop();
  };

  return (
    <div className="min-h-screen bg-base-200 flex overflow-y-scroll overflow-x-hidden">
      {/* 侧边栏 */}
      <div 
        className={cn(
          'w-70 md:w-64 bg-base-100 border-base-300/50 border-r-[length:var(--border)]  transition-all duration-200 ease-in-out flex-shrink-0',
          // 移动端：固定定位
          'fixed lg:fixed z-40 h-full lg:h-screen',
          // PWA 安全区
          'pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]',
          // 显示控制：移动端和桌面端都根据sidebarOpen状态控制
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}>
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center justify-between h-16 px-4 box-content flex-shrink-0">
            <a href="/" className="flex items-center">
              <h1 className="text-xl font-bold text-base-content">Floaty Bub</h1>
            </a>
          </div>

          {/* 新建聊天按钮 */}
          <div className="p-4 pb-0">
            <button
              onClick={handleNewChat}
              className="btn mr-2 w-full"
            >
              <Plus className="h-4 w-4" />
              新建对话
            </button>
          </div>

          {/* 导航菜单已移除，保留新建聊天按钮作为主要入口 */}


          {/* 历史对话列表 - 虚拟滚动 */}
          <div className="chat-lists flex-1 overflow-y-auto">
            {allSessions.length === 0 ? (
              <div className="text-center py-8">
                <MessageCircle className="h-8 w-8 text-base-content/40 mx-auto mb-2" />
                <p className="text-xs text-base-content/60">
                  还没有对话记录
                </p>
              </div>
            ) : (
              <VirtualScrollContainer
                items={allSessions.map(session => ({ ...session, id: session.id }))}
                itemHeight={ITEM_HEIGHT}
                renderItem={renderChatItem}
                overscan={5}
                scrollMaskRef={scrollMaskRef}
                className={cn(
                  'rounded-lg h-full',
                  scrollMaskClasses
                )}
              />
            )}
            

          </div>

          {/* 底部操作区 */}
          <div className="p-4 pt-0 flex-shrink-0">
            <div className="grid grid-cols-1 gap-2">
              
              <div className="flex justify-between gap-2">
                {isUserSystemEnabled ? (
                  (user || currentUser) ? (
                    <UserAvatar 
                  onOpenSettings={() => {
                    window.location.hash = '#setting';
                    closeSidebarOnNonDesktop();
                  }}
                  onOpenProfileModal={handleOpenUserProfileModal}
                  className='grow'
                />
                  ) : (
                    <div className="dropdown dropdown-top dropdown-start grow">
                      <button 
                        className="btn btn-ghost btn-md w-full"
                        tabIndex={0}
                        >
                        <User className="h-4 w-4" />
                        访客模式
                      </button>
                      <ul tabIndex={0} className="dropdown-content z-[1] menu p-2 w-48">
                        <span className="text-sm text-base-content/40 px-3 py-2">登录以同步</span>  

                        <li
                          className="mb-2"
                        >
                          <button
                            onClick={() => setIsAuthModalOpen(true)}
                            className="btn btn-md btn-primary"
                            disabled={authLoading}
                          >
                            <LogIn className="h-4 w-4" />
                            {authLoading ? '加载中...' : '登录'}
                          </button>
                        </li>
                        {/* <li>
                          <button 
                            onClick={() => {
                              navigate('/settings/knowledge');
                              (document.activeElement as HTMLElement)?.blur();
                              closeSidebarOnNonDesktop();
                            }}
                            className="btn btn-md"
                          >
                            <BookOpen className="h-4 w-4" />
                            知识库
                          </button>
                        </li> */}
                        <li>
                          <button 
                            onClick={() => {
                              window.location.hash = '#setting';
                              (document.activeElement as HTMLElement)?.blur();
                              closeSidebarOnNonDesktop();
                            }}
                            className="btn btn-md"
                          >
                            <Settings className="h-4 w-4" />
                            设置
                          </button>
                        </li>
                      </ul>
                    </div>
                  )
                ) : (
                  <button
                    onClick={() => {
                      window.location.hash = '#setting';
                      closeSidebarOnNonDesktop();
                    }}
                    className="btn btn-ghost btn-md"
                  >
                    <Settings className="h-4 w-4" />
                    设置
                  </button>
                )}

                
                <div className="dropdown dropdown-top dropdown-end">
                  <div className="tooltip" data-tip="切换主题">
                    <button
                      tabIndex={0}
                      className="btn btn-ghost btn-circle btn-md"
                      title="切换主题"
                    >
                      <Palette className="h-4 w-4" />
                      {/* {theme === 'floaty' ? '浮光' : theme === 'dark' ? '暗色' : theme === 'light' ? '简洁' : theme === 'cupcake' ? '纸杯蛋糕' : '主题'} */}
                    </button>
                  </div>
                  <ul tabIndex={0} className="dropdown-content z-[1] menu p-2 w-32">
                    <span className="text-base text-base-content/40 px-3 py-2">主题</span>
                    <li>
                      <button
                        onClick={() => {
                          setTheme('floaty');
                          (document.activeElement as HTMLElement)?.blur();
                        }}
                        className={`text-base ${theme === 'floaty' ? 'bg-base-200' : ''}`}
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
                        className={`text-base ${theme === 'dark' ? 'bg-base-200' : ''}`}
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
                        className={`text-base ${theme === 'light' ? 'bg-base-200' : ''}`}
                      >
                        简洁
                      </button>
                    </li>
                    <li>
                      <button
                        onClick={() => {
                          setTheme('cupcake');
                          (document.activeElement as HTMLElement)?.blur();
                        }}
                        className={`text-base ${theme === 'cupcake' ? 'bg-base-200' : ''}`}
                      >
                        纸杯蛋糕
                      </button>
                    </li>

                  </ul>
                </div>
                <div className="tooltip" data-tip="搜索对话">
                  <button 
                    type="button" 
                    className='btn btn-circle btn-ghost btn-base'
                    onClick={() => setIsHistoryModalOpen(true)}
                    title="历史记录"
                  >
                    <Search className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 主内容区域 */}
      <div className={cn(
        "flex flex-col flex-1 min-h-screen transition-all duration-200 ease-in-out h-screen bg-base-100",
        // 在桌面端根据侧边栏状态调整左边距
        sidebarOpen ? "lg:ml-64" : "lg:ml-0"
      )}>
        {/* 顶部栏 */}
        <header className="bg-base-100 bg-opacity-90 pt-[env(safe-area-inset-top)]">
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
              // 优先从临时会话获取标题，如果不是临时会话则从正式会话获取
              const currentSession = currentSessionId === tempSessionId 
                ? tempSession 
                : chatSessions.find(s => s.id === currentSessionId);
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
                          聊聊新话题
                        </button>
                      </li>
                      <li>
                        <button
                          onClick={() => {
                            if (currentSession.isPinned) {
                              unpinSession(currentSession.id);
                            } else {
                              pinSession(currentSession.id);
                            }
                            // 关闭dropdown
                            (document.activeElement as HTMLElement)?.blur();
                          }}
                          className="text-sm"
                        >
                          {currentSession.isPinned ? (
                            <PinOff className="h-4 w-4" />
                          ) : (
                            <Pin className="h-4 w-4" />
                          )}
                          {currentSession.isPinned ? '取消置顶' : '置顶'}
                        </button>
                      </li>
                      <li>
                        <button
                           onClick={() => {
                             hideSession(currentSession.id);
                             toast.success('对话已从列表中隐藏');
                             // 导航到 chat 路由
                             navigate('/chat');
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
                          title="移至回收站？"
                          description={`对话将移至回收站，不会立即永久删除`}
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
                          okText="移至回收站"
                          cancelText="取消"
                        >
                          <button className="text-sm text-error w-full text-left flex items-center">
                            <Trash2 className="h-4 w-4 mr-2" />
                            移至回收站
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
        <main className={cn("flex-1 overflow-y-scroll", {
          'pb-[env(safe-area-inset-bottom)]': isMobile,
        })}>
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
      
      {/* 认证弹窗 */}
      <AuthModal 
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
      />
      
      {/* 历史记录弹窗 */}
      <HistoryModal 
        isOpen={isHistoryModalOpen} 
        onClose={() => setIsHistoryModalOpen(false)}
      />
      
      {/* 用户资料编辑弹窗 */}
      <dialog 
        ref={userProfileDialogRef}
        className="modal bg-black/50 backdrop:bg-black/50 p-0 m-0 max-w-none max-h-none w-full h-full"
      >
        <div className="modal-box bg-base-200 border border-base-300 max-w-md mx-auto mt-20">
          <button 
            onClick={handleCloseUserProfileModal}
            className="btn btn-sm btn-circle btn-ghost absolute right-2 top-2 z-10"
          >
            <X className="w-4 h-4" />
          </button>
          
          <h3 className="font-bold text-lg mb-4">修改资料</h3>
          
          <div className="space-y-4">
            {/* 头像上传 */}
            <div className="flex flex-col items-center space-y-2">
              <AvatarUpload 
                  name={editingName}
                  currentAvatar={editingAvatar}
                  onAvatarChange={setEditingAvatar}
                />
            </div>
            
            {/* 用户名输入 */}
            <div>
              <label className="input w-full">
                <span className="label">昵称</span>
              
              <input 
                type="text" 
                value={editingName}
                onChange={(e) => setEditingName(e.target.value)}
                className=""
                placeholder="请输入昵称"
                maxLength={50}
              />
              </label>
            </div>
            
            {/* 操作按钮 */}
            <div className="flex justify-end space-x-2 pt-4">
              <button 
                onClick={handleCloseUserProfileModal}
                className="btn btn-ghost"
                disabled={isSaving}
              >
                取消
              </button>
              <button 
                onClick={handleSaveUserProfile}
                className="btn btn-primary"
                disabled={isSaving || !editingName.trim()}
              >
                {isSaving ? (
                  <>
                    <span className="loading loading-spinner loading-sm"></span>
                    保存中...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-1" />
                    保存
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </dialog>
    </div>
  );
};

export default Layout;