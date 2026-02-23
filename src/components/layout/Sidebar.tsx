import React, { useRef, useState, useCallback, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  MessageCircle, 
  Plus, 
  Search, 
  Settings, 
  User, 
  LogIn,
  Sparkles
} from 'lucide-react';
import { useAppStore } from '@/store';
import { cn, isMobile, isCapacitorIOS } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { useScrollMask } from '@/hooks/useScrollMask';
import VirtualScrollContainer from '@/components/VirtualScrollContainer';
import { UserAvatar } from '@/components/auth/UserAvatar';
import { SessionItem } from '@/screens/chats';
import Popconfirm from '@/components/Popconfirm';
import ConfirmDialog from '@/components/ConfirmDialog';
import { toast } from '@/hooks/useToast';
import { getLastActiveTime } from '@/utils/dateUtils';

interface SidebarProps {
  className?: string;
  style?: React.CSSProperties;
  sidebarRef?: React.RefObject<HTMLDivElement>;
  onOpenSettings: () => void;
  onOpenHistory: () => void;
  onOpenAuth: () => void;
  onOpenProfile: () => void;
  onCloseSidebar?: () => void;
}

const Sidebar = ({
  className,
  style,
  sidebarRef,
  onOpenSettings,
  onOpenHistory,
  onOpenAuth,
  onOpenProfile,
  onCloseSidebar
}: SidebarProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    sidebarOpen,
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
    currentUser,
    tempSessionId,
    tempSession
  } = useAppStore();

  const { user, loading: authLoading } = useAuth();
  
  // 虚拟滚动配置
  const ITEM_HEIGHT = 44;
  const { scrollContainerRef: scrollMaskRef, scrollMaskClasses } = useScrollMask({
    gradientPadding: '1rem'
  });

  const isUserSystemEnabled = import.meta.env.VITE_ENABLE_USER_SYSTEM === 'true';
  const currentSessionId = location.pathname.startsWith('/chat/')
    ? location.pathname.split('/chat/')[1]
    : null;

  // Local state for popups
  const [renamingSessionId, setRenamingSessionId] = useState<string | null>(null);
  const [renamingTitle, setRenamingTitle] = useState('');
  const [deletingSessionId, setDeletingSessionId] = useState<string | null>(null);
  const [popconfirmAnchorEl, setPopconfirmAnchorEl] = useState<HTMLElement | null>(null);

  // iOS Confirm State
  const [iosConfirmOpen, setIosConfirmOpen] = useState(false);
  const [iosConfirmTitle, setIosConfirmTitle] = useState('');
  const [iosConfirmMessage, setIosConfirmMessage] = useState<React.ReactNode>('');
  const [iosConfirmConfirmText, setIosConfirmConfirmText] = useState('确认');
  const [iosConfirmCancelText, setIosConfirmCancelText] = useState('取消');
  const [iosConfirmVariant, setIosConfirmVariant] = useState<'danger' | 'warning' | 'info'>('warning');
  const [iosConfirmType, setIosConfirmType] = useState<'rename' | 'trash' | null>(null);
  const [iosConfirmSessionId, setIosConfirmSessionId] = useState<string | null>(null);

  // 过滤会话数据
  const filteredSessions = useMemo(() => {
    return chatSessions
      .filter(session => {
        if (session.isHidden) return false;
        // 只显示包含至少一条用户消息的对话
        return session.messages.some(message => message.role === 'user');
      })
      .sort((a, b) => {
        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;
        const aTime = getLastActiveTime(a);
        const bTime = getLastActiveTime(b);
        return bTime - aTime;
      });
  }, [chatSessions, getLastActiveTime]);

  const allSessions = filteredSessions;

  const handleSessionSelect = useCallback((id: string) => {
    setCurrentSession(id);
    onCloseSidebar?.();
  }, [setCurrentSession, onCloseSidebar]);

  const handleSessionHide = useCallback((id: string) => {
    hideSession(id);
    toast.success('对话已从列表中隐藏');
  }, [hideSession]);

  const handleSessionRename = useCallback((id: string, title: string, anchorEl: HTMLElement | null) => {
    setRenamingSessionId(id);
    setRenamingTitle(title);
    // 确保 anchorEl 存在，如果不存在则尝试使用 document.body (虽然这可能导致位置不对，但比不显示好)
    // 但通过 isActionOpen 修复后，anchorEl 应该是存在的
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

  // AI Role helper
  const getAIRole = useCallback((roleId: string) => {
    return aiRoles.find(role => role.id === roleId);
  }, [aiRoles]);

  // Render Item
  const renderSessionItem = useCallback((session: any) => {
    const isActive = session.id === currentSessionId || session.id === tempSessionId;
    const role = getAIRole(session.roleId);
    // 当该会话正在被重命名或删除时，强制保持操作菜单按钮显示，以便 Popconfirm 能正确定位
    const isActionOpen = renamingSessionId === session.id || deletingSessionId === session.id;
    
    return (
      <SessionItem
        key={session.id}
        session={session}
        isActive={isActive}
        role={role}
        isIOSCap={isCapacitorIOS()}
        itemHeight={ITEM_HEIGHT}
        onSelect={handleSessionSelect}
        onRename={handleSessionRename}
        onDelete={handleSessionDelete}
        onHide={handleSessionHide}
        onPin={pinSession}
        onUnpin={unpinSession}
        onIOSRename={handleIOSRename}
        onIOSTrash={handleIOSTrash}
        isActionOpen={isActionOpen}
      />
    );
  }, [currentSessionId, tempSessionId, getAIRole, handleSessionSelect, handleSessionRename, handleSessionDelete, handleSessionHide, pinSession, unpinSession, handleIOSRename, handleIOSTrash, renamingSessionId, deletingSessionId]);

  const handleNewSession = () => {
    navigate('/chat');
    onCloseSidebar?.();
  };

  const deleteSession = async (id: string) => {
    try {
      await deleteChatSession(id);
      toast.success('对话已移至回收站');
      if (currentSessionId === id) {
        navigate('/chat');
      }
    } catch (error) {
      console.error('删除对话失败:', error);
      toast.error('删除对话失败');
    }
  };

  const renameSession = async (id: string, newTitle: string) => {
    try {
      await updateChatSession(id, { title: newTitle });
      toast.success('重命名成功');
    } catch (error) {
      console.error('重命名失败:', error);
      toast.error('重命名失败');
    }
  };

  const handleIOSConfirm = () => {
    if (iosConfirmType === 'rename' && iosConfirmSessionId) {
      renameSession(iosConfirmSessionId, renamingTitle);
    } else if (iosConfirmType === 'trash' && iosConfirmSessionId) {
      deleteSession(iosConfirmSessionId);
    }
    setIosConfirmOpen(false);
  };

  return (
    <div
      className={cn(
        'w-70 md:w-64 bg-base-100 border-base-300/50 border-r-[length:var(--border)] transition-transform duration-300 ease-in-out flex-shrink-0',
        'fixed lg:fixed z-40 h-full lg:h-screen',
        'pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]',
        className
      )}
      ref={sidebarRef}
      style={style}
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
            onClick={handleNewSession}
            className="btn w-full gap-2 justify-start px-4"
          >
            <Plus className="h-5 w-5" />
            新建聊天
          </button>
          
          {/* 发现智能体入口 */}
           <div className="mt-2">
              <button
                 onClick={() => { navigate('/roles'); onCloseSidebar?.(); }}
                 className="btn btn-ghost w-full gap-2 justify-start px-4"
              >
                 <Sparkles className="h-5 w-5" />
                 <span className="font-normal">发现智能体</span>
              </button>
           </div>
        </div>

        {/* 历史对话列表 */}
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
                    onOpenSettings={onOpenSettings}
                    onOpenProfileModal={onOpenProfile}
                    className='grow'
                  />
                ) : (
                  <div className="dropdown dropdown-top dropdown-start grow">
                    <button className="btn btn-ghost btn-md" tabIndex={0}>
                      <User className="h-5 w-5" />
                      访客模式
                    </button>
                    <ul tabIndex={0} className="dropdown-content z-[1] menu p-2 w-48">
                      <span className="text-sm text-base-content/40 px-3 py-2">登录以同步</span>
                      <li className="mb-2">
                        <button
                          onClick={onOpenAuth}
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
              ) : ''}

              <div className="tooltip" data-tip="搜索对话">
                <button
                  type="button"
                  className='btn btn-circle btn-ghost btn-base'
                  onClick={onOpenHistory}
                  title="历史记录"
                >
                  <Search className="h-5 w-5" />
                </button>
              </div>
              <div>
                <button
                  onClick={onOpenSettings}
                  className="btn btn-ghost btn-circle"
                >
                  <Settings className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Popconfirm for Rename */}
      <Popconfirm
        open={!!renamingSessionId}
        anchorEl={popconfirmAnchorEl}
        title="重命名对话"
        description={
            <input
              type="text"
              value={renamingTitle}
              onChange={(e) => setRenamingTitle(e.target.value)}
              className="input w-full p-2 text-sm"
              placeholder="输入新名称"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                    if (renamingSessionId && renamingTitle.trim()) {
                        renameSession(renamingSessionId, renamingTitle);
                        setRenamingSessionId(null);
                        setPopconfirmAnchorEl(null);
                    }
                }
              }}
            />
        }
        onConfirm={() => {
          if (renamingSessionId && renamingTitle.trim()) {
            renameSession(renamingSessionId, renamingTitle);
            setRenamingSessionId(null);
            setPopconfirmAnchorEl(null);
          }
        }}
        onCancel={() => {
          setRenamingSessionId(null);
          setPopconfirmAnchorEl(null);
        }}
        okText="保存"
        cancelText="取消"
      />

      {/* Popconfirm for Delete */}
      <Popconfirm
        open={!!deletingSessionId}
        anchorEl={popconfirmAnchorEl}
        title="移至回收站"
        description="确定要将此对话移至回收站吗？"
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
      
      {/* iOS Confirm Dialog */}
      <ConfirmDialog
        isOpen={iosConfirmOpen}
        title={iosConfirmTitle}
        confirmText={iosConfirmConfirmText}
        cancelText={iosConfirmCancelText}
        variant={iosConfirmVariant}
        onConfirm={handleIOSConfirm}
        onClose={() => setIosConfirmOpen(false)}
      >
        {iosConfirmType === 'rename' ? (
             <div className="space-y-2">
                <input
                  type="text"
                  value={renamingTitle}
                  onChange={(e) => setRenamingTitle(e.target.value)}
                  className="input input-bordered w-full"
                  placeholder="输入新名称"
                  autoFocus
                />
             </div>
        ) : (
             <p>{iosConfirmMessage}</p>
        )}
      </ConfirmDialog>
    </div>
  );
};

export default Sidebar;