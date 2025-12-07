import React, { useState, useEffect, useRef, useCallback } from 'react';
import ConfirmDialog from './components/ConfirmDialog';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAppStore } from './store';
import { toast } from './hooks/useToast';
import {
  MessageCircle,
  Settings,
  Menu,
  Plus,
  Trash2,
  MoreHorizontal,
  Pin,
  PinOff,
  EyeOff,
  LogIn,
  User,
  Save,
  X,
  Search,

} from 'lucide-react';
import { Sparkles } from 'lucide-react';
import { cn, isCapacitorIOS } from './lib/utils';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import Popconfirm from './components/Popconfirm';
import SettingsModal from './screens/settings/Settings';
import { useAuth } from './hooks/useAuth';
import { UserAvatar } from './components/auth/UserAvatar';
import { AuthModal } from './components/auth/AuthModal';
import HistoryModal from './screens/history/HistoryModal';
import SessionItem from './components/SessionItem';
import VirtualScrollContainer from './components/VirtualScrollContainer';
import AvatarUpload from './components/AvatarUpload';
import { useUserData } from './hooks/useUserData';
import { supabase } from './lib/supabase';
import { avatarCache } from './utils/imageCache';
import { useScrollMask } from './hooks/useScrollMask';

const console: Console = { ...globalThis.console, log: (..._args: any[]) => { } };

type TabType = 'global' | 'config' | 'roles' | 'userRoles' | 'globalPrompts' | 'voice' | 'data' | 'knowledge' | 'search';


const Layout: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { theme, setTheme, currentUser, setCurrentUser, updateUserProfile } = useAppStore();
  const sidebarRef = useRef<HTMLDivElement>(null);
  const mainViewRef = useRef<HTMLDivElement>(null);
  const [mobileTranslateX, setMobileTranslateX] = useState<number>(0);
  const [mobileDragging, setMobileDragging] = useState<boolean>(false);
  const [dragDirection, setDragDirection] = useState<null | 'horizontal' | 'vertical'>(null);
  const startXRef = useRef<number>(0);
  const startYRef = useRef<number>(0);
  const currentXRef = useRef<number>(0);
  const currentYRef = useRef<number>(0);
  const drawerWidthRef = useRef<number>(280);
  const dropdownRefs = useRef<Record<string, React.RefObject<HTMLButtonElement>>>({});

  // 虚拟滚动配置
  const ITEM_HEIGHT = 44; // 每个聊天项目的固定高度（px）
  const {
    sidebarOpen,
    toggleSidebar,
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
    tempSession
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

  // 稳定的历史记录弹窗关闭函数
  const handleCloseHistoryModal = useCallback(() => {
    setIsHistoryModalOpen(false);
  }, []);

  // 用户资料modal状态
  const [isUserProfileModalOpen, setIsUserProfileModalOpen] = useState(false);
  const [editingName, setEditingName] = useState('');
  const [editingAvatar, setEditingAvatar] = useState<string | undefined>(undefined);
  const [isSaving, setIsSaving] = useState(false);
  const userProfileDialogRef = useRef<HTMLDialogElement>(null);

  // 重命名状态
  const [renamingSessionId, setRenamingSessionId] = useState<string | null>(null);
  const [renamingTitle, setRenamingTitle] = useState('');
  const [deletingSessionId, setDeletingSessionId] = useState<string | null>(null);
  const [iosConfirmOpen, setIosConfirmOpen] = useState(false);
  const [iosConfirmTitle, setIosConfirmTitle] = useState('');
  const [iosConfirmMessage, setIosConfirmMessage] = useState<React.ReactNode>('');
  const [iosConfirmConfirmText, setIosConfirmConfirmText] = useState('确认');
  const [iosConfirmCancelText, setIosConfirmCancelText] = useState('取消');
  const [iosConfirmVariant, setIosConfirmVariant] = useState<'danger' | 'warning' | 'info'>('warning');
  const [iosConfirmType, setIosConfirmType] = useState<'rename' | 'trash' | null>(null);
  const [iosConfirmSessionId, setIosConfirmSessionId] = useState<string | null>(null);
  const [popconfirmAnchorEl, setPopconfirmAnchorEl] = useState<HTMLElement | null>(null);

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

  // 根据roleId获取AI角色信息
  const getAIRole = useCallback((roleId: string) => {
    return aiRoles.find(role => role.id === roleId) || aiRoles[0];
  }, [aiRoles]);

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
  const isMobile = useCallback(() => {
    return window.innerWidth < 1024; // lg breakpoint
  }, []);

  // 在非桌面端（移动端和平板端）自动关闭侧边栏
  const closeSidebarOnNonDesktop = useCallback(() => {
    if (isMobile() && sidebarOpen) {
      toggleSidebar();
    }
  }, [isMobile, sidebarOpen, toggleSidebar]);

  useEffect(() => {
    if (isMobile()) {
      const w = sidebarRef.current?.offsetWidth || drawerWidthRef.current;
      drawerWidthRef.current = w;
      setMobileTranslateX(sidebarOpen ? w : 0);
    }
  }, [sidebarOpen]);

  const openDrawer = () => {
    const w = drawerWidthRef.current;
    setMobileTranslateX(w);
    if (!sidebarOpen) toggleSidebar();
    if (isCapacitorIOS()) {
      try {
        Haptics.impact({ style: ImpactStyle.Medium });
      } catch { }
    }
  };

  const closeDrawer = () => {
    setMobileTranslateX(0);
    if (sidebarOpen) toggleSidebar();
    if (isCapacitorIOS()) {
      try {
        Haptics.impact({ style: ImpactStyle.Light });
      } catch { }
    }
  };

  const DIRECTION_THRESHOLD = 15;
  const HORIZONTAL_BIAS = 25;
  const SNAP_THRESHOLD_RATIO = 0.35;
  const VELOCITY_THRESHOLD = 0.3;
  const QUICK_SWIPE_MIN_DISTANCE = 30;
  const QUICK_SWIPE_MAX_TIME = 300;
  const startTimeRef = useRef<number>(0);

  const handleTouchStartMain = (e: React.TouchEvent) => {
    if (!isMobile()) return;
    startXRef.current = e.touches[0].clientX;
    startYRef.current = e.touches[0].clientY;
    currentXRef.current = startXRef.current;
    currentYRef.current = startYRef.current;
    startTimeRef.current = performance.now();
    setDragDirection(null);
    const t = e.target as HTMLElement;
    const css = t ? window.getComputedStyle(t) : ({} as any);
    console.debug('[SwipeDebug]', {
      loc: 'LayoutMain',
      phase: 'start',
      startX: startXRef.current,
      startY: startYRef.current,
      cancelable: e.nativeEvent.cancelable,
      defaultPrevented: e.defaultPrevented,
      targetTag: t?.tagName,
      targetClasses: t?.className,
      css_touchAction: css?.touchAction,
      css_userSelect: css?.userSelect,
      css_pointerEvents: css?.pointerEvents
    });
  };

  const handleTouchMoveMain = (e: React.TouchEvent) => {
    if (!isMobile()) return;
    currentXRef.current = e.touches[0].clientX;
    currentYRef.current = e.touches[0].clientY;
    const deltaX = currentXRef.current - startXRef.current;
    const deltaY = currentYRef.current - startYRef.current;
    const absDeltaX = Math.abs(deltaX);
    const absDeltaY = Math.abs(deltaY);
    const t = e.target as HTMLElement;
    const css = t ? window.getComputedStyle(t) : ({} as any);
    console.debug('[SwipeDebug]', {
      loc: 'LayoutMain',
      phase: 'move',
      deltaX,
      deltaY,
      absDeltaX,
      absDeltaY,
      dragDirection,
      cancelable: e.nativeEvent.cancelable,
      defaultPrevented: e.defaultPrevented,
      targetTag: t?.tagName,
      targetClasses: t?.className,
      css_touchAction: css?.touchAction,
      css_userSelect: css?.userSelect,
      css_pointerEvents: css?.pointerEvents
    });
    if (dragDirection === null) {
      if (absDeltaX < DIRECTION_THRESHOLD && absDeltaY < DIRECTION_THRESHOLD) {
        return;
      }
      if (absDeltaX > absDeltaY + HORIZONTAL_BIAS) {
        setDragDirection('horizontal');
        setMobileDragging(true);
      } else if (absDeltaY > absDeltaX * 0.5) {
        setDragDirection('vertical');
        return;
      } else {
        return;
      }
    }
    if (dragDirection !== 'horizontal') return;
    e.preventDefault();
    const w = drawerWidthRef.current;
    if (sidebarOpen) {
      const newTranslate = Math.max(0, Math.min(w, w + deltaX));
      setMobileTranslateX(newTranslate);
    } else {
      if (deltaX > 0) {
        const newTranslate = Math.max(0, Math.min(w, deltaX));
        setMobileTranslateX(newTranslate);
      }
    }
  };

  const handleTouchEndMain = () => {
    if (!isMobile()) return;
    if (dragDirection !== 'horizontal' || !mobileDragging) {
      setDragDirection(null);
      return;
    }
    setMobileDragging(false);
    setDragDirection(null);
    const deltaX = currentXRef.current - startXRef.current;
    const deltaTime = Math.max(1, performance.now() - startTimeRef.current);
    const velocity = Math.abs(deltaX) / deltaTime;
    const isQuickSwipe = velocity > VELOCITY_THRESHOLD && Math.abs(deltaX) > QUICK_SWIPE_MIN_DISTANCE && deltaTime < QUICK_SWIPE_MAX_TIME;
    const w = drawerWidthRef.current;
    console.debug('[SwipeDebug]', {
      loc: 'LayoutMain',
      phase: 'end',
      deltaX,
      deltaTime,
      velocity,
      isQuickSwipe,
      mobileTranslateX,
      snapThreshold: w * SNAP_THRESHOLD_RATIO
    });
    if (isQuickSwipe) {
      if (deltaX > 0) {
        openDrawer();
      } else {
        closeDrawer();
      }
      return;
    }
    const shouldOpen = mobileTranslateX >= w * SNAP_THRESHOLD_RATIO;
    if (shouldOpen) {
      openDrawer();
    } else {
      closeDrawer();
    }
  };

  const handleTouchCancelMain = () => {
    handleTouchEndMain();
  };

  const handleTouchStartOverlay = (e: React.TouchEvent) => {
    if (!isMobile() || mobileTranslateX <= 0) return;
    startXRef.current = e.touches[0].clientX;
    startYRef.current = e.touches[0].clientY;
    currentXRef.current = startXRef.current;
    currentYRef.current = startYRef.current;
    startTimeRef.current = performance.now();
    setDragDirection(null);
    const t = e.target as HTMLElement;
    const css = t ? window.getComputedStyle(t) : ({} as any);
    console.debug('[SwipeDebug]', {
      loc: 'LayoutOverlay',
      phase: 'start',
      startX: startXRef.current,
      startY: startYRef.current,
      cancelable: e.nativeEvent.cancelable,
      defaultPrevented: e.defaultPrevented,
      targetTag: t?.tagName,
      targetClasses: t?.className,
      css_touchAction: css?.touchAction,
      css_userSelect: css?.userSelect,
      css_pointerEvents: css?.pointerEvents
    });
  };

  const handleTouchMoveOverlay = (e: React.TouchEvent) => {
    if (!isMobile() || mobileTranslateX <= 0) return;
    currentXRef.current = e.touches[0].clientX;
    currentYRef.current = e.touches[0].clientY;
    const deltaX = currentXRef.current - startXRef.current;
    const deltaY = currentYRef.current - startYRef.current;
    const absDeltaX = Math.abs(deltaX);
    const absDeltaY = Math.abs(deltaY);
    const t = e.target as HTMLElement;
    const css = t ? window.getComputedStyle(t) : ({} as any);
    console.debug('[SwipeDebug]', {
      loc: 'LayoutOverlay',
      phase: 'move',
      deltaX,
      deltaY,
      absDeltaX,
      absDeltaY,
      dragDirection,
      cancelable: e.nativeEvent.cancelable,
      defaultPrevented: e.defaultPrevented,
      targetTag: t?.tagName,
      targetClasses: t?.className,
      css_touchAction: css?.touchAction,
      css_userSelect: css?.userSelect,
      css_pointerEvents: css?.pointerEvents
    });
    if (dragDirection === null) {
      if (absDeltaX < DIRECTION_THRESHOLD && absDeltaY < DIRECTION_THRESHOLD) {
        return;
      }
      if (absDeltaX > absDeltaY + HORIZONTAL_BIAS) {
        setDragDirection('horizontal');
        setMobileDragging(true);
      } else if (absDeltaY > absDeltaX * 0.5) {
        setDragDirection('vertical');
        return;
      } else {
        return;
      }
    }
    if (dragDirection !== 'horizontal') return;
    e.preventDefault();
    const w = drawerWidthRef.current;
    const newTranslate = Math.max(0, Math.min(w, w + deltaX));
    setMobileTranslateX(newTranslate);
  };

  const handleTouchEndOverlay = () => {
    if (!isMobile()) return;
    if (dragDirection !== 'horizontal' || !mobileDragging) {
      setDragDirection(null);
      return;
    }
    setMobileDragging(false);
    setDragDirection(null);
    const deltaX = currentXRef.current - startXRef.current;
    const deltaTime = Math.max(1, performance.now() - startTimeRef.current);
    const velocity = Math.abs(deltaX) / deltaTime;
    const isQuickSwipe = velocity > VELOCITY_THRESHOLD && Math.abs(deltaX) > QUICK_SWIPE_MIN_DISTANCE && deltaTime < QUICK_SWIPE_MAX_TIME;
    const w = drawerWidthRef.current;
    console.debug('[SwipeDebug]', {
      loc: 'LayoutOverlay',
      phase: 'end',
      deltaX,
      deltaTime,
      velocity,
      isQuickSwipe,
      mobileTranslateX,
      snapThreshold: w * SNAP_THRESHOLD_RATIO
    });
    if (isQuickSwipe) {
      if (deltaX < 0) {
        closeDrawer();
      } else {
        openDrawer();
      }
      return;
    }
    const shouldOpen = mobileTranslateX >= w * SNAP_THRESHOLD_RATIO;
    if (shouldOpen) {
      openDrawer();
    } else {
      closeDrawer();
    }
  };

  const handleTouchCancelOverlay = () => {
    handleTouchEndOverlay();
  };



  const handleSessionSelect = useCallback((id: string) => {
    setCurrentSession(id);
    closeSidebarOnNonDesktop();
  }, [setCurrentSession, closeSidebarOnNonDesktop]);

  const handleSessionHide = useCallback((id: string) => {
    hideSession(id);
    toast.success('对话已从列表中隐藏');
  }, [hideSession]);

  const handleSessionRename = useCallback((id: string, title: string, anchorEl: HTMLElement | null) => {
    setRenamingSessionId(id);
    setRenamingTitle(title);
    setPopconfirmAnchorEl(anchorEl);
  }, []);

  const handleSessionDelete = useCallback((id: string, anchorEl: HTMLElement | null) => {
    setDeletingSessionId(id);
    setPopconfirmAnchorEl(anchorEl);
  }, []);

  const handleIOSRename = useCallback((id: string, title: string) => {
    setIosConfirmTitle('重命名对话');
    setIosConfirmSessionId(id);
    setRenamingTitle(title || '');
    setIosConfirmType('rename');
    setIosConfirmMessage('');
    setIosConfirmConfirmText('重命名');
    setIosConfirmCancelText('取消');
    setIosConfirmVariant('info');
    setIosConfirmOpen(true);
  }, []);

  const handleIOSTrash = useCallback((id: string) => {
    setIosConfirmTitle('移至回收站');
    setIosConfirmMessage('对话将移至回收站，不会立即永久删除。');
    setIosConfirmConfirmText('移至回收站');
    setIosConfirmCancelText('取消');
    setIosConfirmVariant('warning');
    setIosConfirmSessionId(id);
    setIosConfirmType('trash');
    setIosConfirmOpen(true);
  }, []);

  const renderSessionItem = useCallback((session: any) => {
    return (
      <SessionItem
        session={session}
        isActive={session.id === currentSessionId}
        role={getAIRole(session.roleId)}
        isIOSCap={isCapacitorIOS()}
        itemHeight={ITEM_HEIGHT}
        onSelect={handleSessionSelect}
        onPin={pinSession}
        onUnpin={unpinSession}
        onHide={handleSessionHide}
        onRename={handleSessionRename}
        onDelete={handleSessionDelete}
        isActionOpen={renamingSessionId === session.id || deletingSessionId === session.id}
        onIOSRename={handleIOSRename}
        onIOSTrash={handleIOSTrash}
      />
    );
  }, [currentSessionId, getAIRole, ITEM_HEIGHT, handleSessionSelect, pinSession, unpinSession, handleSessionHide, handleSessionRename, handleSessionDelete, renamingSessionId, deletingSessionId, handleIOSRename, handleIOSTrash]);

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
          'w-70 md:w-64 bg-base-100 border-base-300/50 border-r-[length:var(--border)]  transition-transform duration-200 ease-in-out flex-shrink-0',
          // 移动端：固定定位
          'fixed lg:fixed z-40 h-full lg:h-screen',
          // PWA 安全区
          'pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]',
          // 显示控制：移动端和桌面端都根据sidebarOpen状态控制
          isMobile() ? 'translate-x-0' : (sidebarOpen ? 'translate-x-0' : '-translate-x-full')
        )}
        ref={sidebarRef}
        style={isMobile() ? {
          width: sidebarRef.current?.offsetWidth,
          transform: `translateX(${mobileTranslateX - (sidebarRef.current?.offsetWidth || drawerWidthRef.current)}px)`,
          transition: mobileDragging ? 'none' : 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
        } : undefined}
      >
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
              className="btn border-none p-3 flex items-center justify-start flex-1 min-w-0 gap-2 w-full"
            >
              <div className="flex items-center flex-1 min-w-0 gap-2">
                <span className="w-6 h-6 rounded-full flex items-center justify-center">
                  <Plus className="h-4 w-4" />
                </span>
                <h4 className="text-sm text-base-content truncate">
                  新建对话
                </h4>
              </div>
            </button>
            {/* 发现智能体入口 */}
            <div className="mt-2">
              <button
                onClick={() => { navigate('/roles'); closeSidebarOnNonDesktop(); }}
                className="btn btn-ghost border-none p-3 flex items-center justify-start flex-1 min-w-0 gap-2 w-full"
              >
                <div className="flex items-center flex-1 min-w-0 gap-2">
                  <span className="w-6 h-6 rounded-full flex items-center justify-center">
                    <Sparkles className="h-4 w-4" />
                  </span>
                  <h4 className="text-sm text-base-content font-normal truncate">
                    发现智能体
                  </h4>
                </div>
              </button>
            </div>
            {/* {isMobile() && isCapacitorIOS() && (
            <div className="mt-2">
              <button
                onClick={() => { navigate('/tests/mobile-nav-drag'); closeSidebarOnNonDesktop(); }}
                className="btn btn-ghost border-none p-3 flex items-center justify-start flex-1 min-w-0 gap-2 w-full"
              >
                <div className="flex items-center flex-1 min-w-0 gap-2">
                  <span className="w-6 h-6 rounded-full flex items-center justify-center">
                    <Menu className="h-4 w-4" />
                  </span>
                  <h4 className="text-sm text-base-content font-normal truncate">
                    MobileNav 测试
                  </h4>
                </div>
              </button>
            </div>
          )} */}
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
                renderItem={renderSessionItem}
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
            <div className="grid grid-cols-1 gap-4">

              <div className="flex justify-between gap-2">
                {isUserSystemEnabled ? (
                  (user || currentUser) ? (
                    <UserAvatar
                      onOpenSettings={() => {
                        window.location.hash = '#setting';
                      }}
                      onOpenProfileModal={handleOpenUserProfileModal}
                      className='grow'
                    />
                  ) : (
                    <div className="dropdown dropdown-top dropdown-start grow">
                      <button
                        className="btn btn-ghost btn-md"
                        tabIndex={0}
                      >
                        <User className="h-5 w-5" />
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
                            <LogIn className="h-5 w-5" />
                            {authLoading ? '加载中...' : '登录'}
                          </button>
                        </li>
                      </ul>
                    </div>
                  )
                ) : (
                  ''
                )}

                <div className="tooltip" data-tip="搜索对话">
                  <button
                    type="button"
                    className='btn btn-circle btn-ghost btn-base'
                    onClick={() => setIsHistoryModalOpen(true)}
                    title="历史记录"
                  >
                    <Search className="h-5 w-5" />
                  </button>
                </div>
                <div>
                  <button
                    onClick={() => {
                      window.location.hash = '#setting';
                    }}
                    className="btn btn-ghost btn-circle"
                  >
                    <Settings className="h-5 w-5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 主内容区域 */}
      <div
        ref={mainViewRef}
        className={cn(
          "flex flex-col flex-1 min-h-screen h-screen bg-base-100 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]",
          // 在桌面端根据侧边栏状态调整左边距
          "lg:transition-all lg:duration-300 lg:ease-in-out",
          sidebarOpen ? "lg:ml-64" : "lg:ml-0"
        )}
        style={isMobile() ? {
          transform: `translateX(${mobileTranslateX}px)`,
          transition: mobileDragging ? 'none' : 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          touchAction: dragDirection === 'horizontal' ? 'none' as any : 'auto'
        } : undefined}
        onTouchStart={handleTouchStartMain}
        onTouchMove={handleTouchMoveMain}
        onTouchEnd={handleTouchEndMain}
        onTouchCancel={handleTouchCancelMain}
      >
        {/* 顶部栏 */}
        <header className="bg-base-100 bg-opacity-90 h-[var(--height-header)]">
          <div className="relative flex items-center px-3 md:px-4 h-full">
            {/* 左侧按钮 */}
            <div className="flex items-center space-x-4">
              <button
                onClick={toggleSidebar}
                className="btn btn-ghost btn-circle"
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
                      className="btn btn-ghost btn-circle"
                      title="更多操作"
                      ref={(el) => {
                        if (el) {
                          if (!dropdownRefs.current[`header-${currentSession.id}`]) {
                            dropdownRefs.current[`header-${currentSession.id}`] = { current: el };
                          } else {
                            (dropdownRefs.current[`header-${currentSession.id}`] as any).current = el;
                          }
                        }
                      }}
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </button>
                    <ul 
                      tabIndex={0} 
                      className="dropdown-content menu p-2 shadow bg-base-100 rounded-box w-44"
                      onClick={(e) => {
                        // 点击任意菜单项后自动关闭菜单
                        const target = e.target as HTMLElement;
                        // 确保点击的是按钮或按钮内部
                        if (target.closest('button') || target.closest('a')) {
                          (document.activeElement as HTMLElement)?.blur();
                        }
                      }}
                    >
                      <li>
                        <button onClick={() => {
                          handleNewSession();
                        }}
                          className="text-base gap-3"
                        >
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
                          }}
                          className="text-base gap-3"
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
                          }}
                          className="text-base gap-3"
                        >
                          <EyeOff className="h-4 w-4" />
                          隐藏对话
                        </button>
                      </li>
                      <li>
                        <button
                          onClick={() => {
                            setDeletingSessionId(currentSession.id);
                            setPopconfirmAnchorEl(dropdownRefs.current[`header-${currentSession.id}`]?.current);
                          }}
                          className="text-base gap-3 text-error"
                        >
                          <Trash2 className="h-4 w-4" />
                          移至回收站
                        </button>
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
          '': isMobile,
        })}>
          <Outlet context={{ className: "" }} />
        </main>
        <ConfirmDialog
          key={`confirm-${iosConfirmType || 'none'}-${renamingSessionId || 'na'}`}
          isOpen={iosConfirmOpen}
          onClose={() => { setIosConfirmOpen(false); setRenamingSessionId(null); setRenamingTitle(''); setIosConfirmType(null); setIosConfirmSessionId(null); }}
          onConfirm={() => {
            if (iosConfirmType === 'rename' && iosConfirmSessionId) {
              const trimmed = (renamingTitle || '').trim();
              if (trimmed) {
                updateChatSession(iosConfirmSessionId, { title: trimmed });
                toast.success('对话已重命名');
              }
              setRenamingSessionId(null);
              setRenamingTitle('');
            } else if (iosConfirmType === 'trash' && iosConfirmSessionId) {
              deleteSession(iosConfirmSessionId);
            }
            setIosConfirmOpen(false);
            setIosConfirmType(null);
            setIosConfirmSessionId(null);
          }}
          title={iosConfirmTitle}
          confirmText={iosConfirmConfirmText}
          cancelText={iosConfirmCancelText}
          variant={iosConfirmVariant}
        >
          {iosConfirmType === 'rename' ? (
            <div className="space-y-2">
              <div className="text-sm text-base-content/70">输入新的对话标题</div>
              <input
                type="text"
                className="input w-full p-2 text-sm"
                value={renamingTitle}
                onChange={(e) => setRenamingTitle(e.target.value)}
                autoFocus
                placeholder="输入新的对话标题..."
              />
            </div>
          ) : (
            iosConfirmMessage
          )}
        </ConfirmDialog>
      </div>

      {/* 移动端遮罩：抽屉开启时显示半透明黑色遮罩，点击可关闭，拦截底部交互 */}
      {isMobile() && (
        <div
          className="fixed inset-0 z-30 lg:hidden bg-black"
          style={{
            opacity: Math.max(0, Math.min(0.5, (mobileTranslateX / (sidebarRef.current?.offsetWidth || drawerWidthRef.current)) * 0.5)),
            pointerEvents: mobileTranslateX > 0 ? 'auto' as any : 'none' as any,
            transition: mobileDragging ? 'none' : 'opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            touchAction: 'none' as any,
          }}
          onClick={closeDrawer}
          onTouchStart={handleTouchStartOverlay}
          onTouchMove={handleTouchMoveOverlay}
          onTouchEnd={handleTouchEndOverlay}
          onTouchCancel={handleTouchCancelOverlay}
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
        onClose={handleCloseHistoryModal}
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

      {/* 重命名弹窗 */}
      <Popconfirm
        open={!!renamingSessionId}
        anchorEl={popconfirmAnchorEl}
        placement="bottom"
        title="重命名对话"
        description={
          <div className="">
            <input
              type="text"
              value={renamingTitle}
              onChange={(e) => setRenamingTitle(e.target.value)}
              className="input w-full p-2 text-sm"
              placeholder="输入新的对话标题..."
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  if (renamingTitle.trim() && renamingSessionId) {
                    updateChatSession(renamingSessionId, { title: renamingTitle.trim() });
                    toast.success('对话已重命名');
                    setRenamingSessionId(null);
                    setRenamingTitle('');
                    setPopconfirmAnchorEl(null);
                  }
                }
              }}
            />
          </div>
        }
        onOpenChange={(next) => {
          if (!next) {
            setRenamingSessionId(null);
            setRenamingTitle('');
            setPopconfirmAnchorEl(null);
          }
        }}
        onConfirm={() => {
          if (renamingTitle.trim() && renamingSessionId) {
            updateChatSession(renamingSessionId, { title: renamingTitle.trim() });
            toast.success('对话已重命名');
            setRenamingSessionId(null);
            setRenamingTitle('');
            setPopconfirmAnchorEl(null);
          }
        }}
        onCancel={() => {
          setRenamingSessionId(null);
          setRenamingTitle('');
          setPopconfirmAnchorEl(null);
        }}
        okText="确认"
        cancelText="取消"
      />

      {/* 删除确认弹窗 */}
      <Popconfirm
        open={!!deletingSessionId}
        anchorEl={popconfirmAnchorEl}
        placement="bottom"
        title="移至回收站？"
        description="对话将移至回收站，不会立即永久删除"
        onOpenChange={(next) => {
          if (!next) {
            setDeletingSessionId(null);
            setPopconfirmAnchorEl(null);
          }
        }}
        onConfirm={() => {
          if (deletingSessionId) {
            deleteSession(deletingSessionId);
            setDeletingSessionId(null);
            setPopconfirmAnchorEl(null);
          }
        }}
        onCancel={() => {
          setDeletingSessionId(null);
          setPopconfirmAnchorEl(null);
        }}
        okText="移至回收站"
        cancelText="取消"
      />

    </div>
  );
};

export default Layout;
