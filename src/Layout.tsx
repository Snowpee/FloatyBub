import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAppStore } from '@/store';
import { toast } from '@/hooks/useToast';
import {
  Menu,
  Plus,
  Trash2,
  MoreHorizontal,
  Pin,
  PinOff,
  EyeOff,
  Save,
  X,
} from 'lucide-react';
import { cn, isCapacitorIOS } from '@/lib/utils';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import Popconfirm from '@/components/Popconfirm';
import SettingsModal from '@/screens/settings/Settings';
import { useAuth } from '@/hooks/useAuth';
import { AuthModal } from '@/components/auth/AuthModal';
import HistoryModal from '@/screens/history/HistoryModal';
import AvatarUpload from '@/components/AvatarUpload';
import { useUserData } from '@/hooks/useUserData';
import { supabase } from '@/lib/supabase';
import { avatarCache } from '@/utils/imageCache';
import Sidebar from '@/components/layout/Sidebar';
import { parseSettingsHash, type TabType } from '@/screens/settings/settingsRoutes';

const console: Console = { ...globalThis.console, log: (..._args: any[]) => { } };



const Layout = () => {
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

  const {
    sidebarOpen,
    toggleSidebar,
    chatSessions,
    deleteChatSession,
    hideSession,
    pinSession,
    unpinSession,
    createTempSession,
    currentModelId,
    tempSessionId,
    tempSession
  } = useAppStore();

  // 认证相关
  const { user, loading: authLoading } = useAuth();
  const { queueDataSync } = useUserData();
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  // 设置弹窗状态
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsDefaultTab, setSettingsDefaultTab] = useState<TabType | undefined>();

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

  // 删除状态 (Header Dropdown)
  const [deletingSessionId, setDeletingSessionId] = useState<string | null>(null);
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
    let cloudSyncWarning = false;
    try {
      // 更新本地用户资料
      if (currentUser) {
        updateUserProfile(currentUser.id, {
          name: editingName.trim(),
          avatar: editingAvatar
        });
        console.log('✅ 本地资料已更新');
      }

      if (user) {
        const displayName = editingName.trim();
        const avatar = editingAvatar;

        setCurrentUser({
          id: user.id,
          name: displayName,
          email: currentUser?.email || user.email || '',
          avatar: avatar || currentUser?.avatar || '',
          preferences: currentUser?.preferences || {}
        });

        const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
        const isRetryable = (message: string) => {
          const m = message.toLowerCase();
          return (
            m.includes('failed to fetch') ||
            m.includes('fetch') ||
            m.includes('network') ||
            m.includes('timeout') ||
            m.includes('connection') ||
            m.includes('http2')
          );
        };

        const isBase64Image = (value: string | undefined | null) => {
          if (!value) return false;
          return value.startsWith('data:image/');
        };

        if (isBase64Image(avatar)) {
          console.warn('🚫 检测到 base64 头像，禁止写入数据库，仅保留本地状态');
        }

        let cloudOk = false;
        if (navigator.onLine) {
          for (let attempt = 1; attempt <= 3; attempt++) {
            const profilePayload: any = {
              user_id: user.id,
              display_name: displayName,
              updated_at: new Date().toISOString()
            };

            if (!isBase64Image(avatar)) {
              profilePayload.avatar = avatar;
            }

            const { error } = await supabase
              .from('user_profiles')
              .upsert(profilePayload, { onConflict: 'user_id' });

            if (!error) {
              cloudOk = true;
              break;
            }

            const message = error.message || '';
            if (attempt < 3 && isRetryable(message)) {
              await sleep(Math.min(1000 * Math.pow(2, attempt - 1), 3000));
              continue;
            }
            break;
          }
        }

        if (!cloudOk) {
          cloudSyncWarning = true;
          try {
            const syncPayload: any = {
              user_id: user.id,
              name: displayName,
              email: user.email || ''
            };

            if (!isBase64Image(avatar)) {
              syncPayload.avatar = avatar;
            }

            await queueDataSync('user_profile', syncPayload);
          } catch (e) {
            console.warn('⚠️ 用户资料写入队列失败:', e);
          }
        }

        if (navigator.onLine) {
          for (let attempt = 1; attempt <= 2; attempt++) {
            const userMeta: any = {
              display_name: displayName
            };

            if (!isBase64Image(avatar)) {
              userMeta.avatar_url = avatar;
            }

            const { error } = await supabase.auth.updateUser({
              data: userMeta
            });

            if (!error) break;

            const message = error.message || '';
            if (attempt < 2 && isRetryable(message)) {
              await sleep(800);
              continue;
            }
            break;
          }
        }
      }

      toast.success(cloudSyncWarning ? '用户资料已保存到本地，云端稍后同步' : '用户资料更新成功');
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
      const route = parseSettingsHash(window.location.hash);
      setSettingsDefaultTab(route.tab);
      setIsSettingsOpen(route.isOpen);
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

  const handleNewSession = () => {
    // 导航到 /chat 根路由，进入新会话准备状态
    navigate('/chat');
    closeSidebarOnNonDesktop();
  };

  return (
    <div id="settings-presenting-page" className="min-h-screen bg-base-200 flex overflow-y-scroll overflow-x-hidden">
      {/* 侧边栏 */}
      <Sidebar
        sidebarRef={sidebarRef}
        onOpenSettings={() => {
          window.location.hash = '#setting';
        }}
        onOpenHistory={() => setIsHistoryModalOpen(true)}
        onOpenAuth={() => setIsAuthModalOpen(true)}
        onOpenProfile={handleOpenUserProfileModal}
        onCloseSidebar={closeSidebarOnNonDesktop}
        className={cn(
          // 移动端：固定定位
          'fixed lg:fixed z-40 h-full lg:h-screen',
          // PWA 安全区
          'pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]',
          // 显示控制：移动端和桌面端都根据sidebarOpen状态控制
          isMobile() ? 'translate-x-0' : (sidebarOpen ? 'translate-x-0' : '-translate-x-full')
        )}
        style={isMobile() ? {
          width: sidebarRef.current?.offsetWidth,
          transform: `translateX(${mobileTranslateX - (sidebarRef.current?.offsetWidth || drawerWidthRef.current)}px)`,
          transition: mobileDragging ? 'none' : 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
        } : undefined}
      />

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

      {/* 删除确认弹窗 (Header Dropdown) */}
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