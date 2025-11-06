import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useAppStore } from '../store';
import { MessageCircle, Calendar, User, Bot, Trash2, MoreVertical } from 'lucide-react';
import { cn } from '../lib/utils';
import { toast } from '../hooks/useToast';
import Avatar from './Avatar';

const ChatSessionList: React.FC = () => {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const [showDeleteMenu, setShowDeleteMenu] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const menuRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadingTriggerRef = useRef<HTMLDivElement>(null);
  
  const ITEMS_PER_PAGE = 50;
  const {
    chatSessions,
    aiRoles,
    llmConfigs,
    currentSessionId,
    tempSessionId,
    setCurrentSession,
    deleteChatSession
  } = useAppStore();
  
  // 获取当前活跃的会话ID（优先使用URL参数）
  const activeSessionId = sessionId || currentSessionId;
  
  // 点击外部关闭菜单
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowDeleteMenu(null);
      }
    };
    
    if (showDeleteMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showDeleteMenu]);
  
  // 处理删除会话
  const handleDeleteSession = async (sessionIdToDelete: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    try {
      await deleteChatSession(sessionIdToDelete);
      setShowDeleteMenu(null);
      
      // 如果删除的是当前会话，导航到聊天首页
      if (activeSessionId === sessionIdToDelete) {
        navigate('/chat');
      }
      
      toast.success('会话已移至回收站');
    } catch (error) {
      console.error('删除会话失败:', error);
      toast.error(error instanceof Error ? error.message : '删除会话失败');
    }
  };
  
  // 切换删除菜单
  const toggleDeleteMenu = (sessionId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setShowDeleteMenu(showDeleteMenu === sessionId ? null : sessionId);
  };

  const formatDate = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - new Date(date).getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days === 0) {
      return '今天';
    } else if (days === 1) {
      return '昨天';
    } else if (days < 7) {
      return `${days}天前`;
    } else {
      return new Date(date).toLocaleDateString();
    }
  };

  const getMessagePreview = (messages: any[]) => {
    const lastUserMessage = messages.filter(m => m.role === 'user').pop();
    return lastUserMessage?.content.slice(0, 50) + (lastUserMessage?.content.length > 50 ? '...' : '') || '暂无消息';
  };

  const getRoleName = (roleId: string) => {
    const role = aiRoles.find(r => r.id === roleId) || aiRoles[0];
    return role?.name || '未知角色';
  };

  const getRole = (roleId: string) => {
    return aiRoles.find(r => r.id === roleId) || aiRoles[0];
  };

  const getModelName = (modelId: string) => {
    return llmConfigs.find(m => m.id === modelId)?.name || '未知模型';
  };

  // 过滤会话数据
  const filteredSessions = chatSessions.filter(session => {
    // 如果是临时会话，则不显示
    if (tempSessionId === session.id) {
      return false;
    }
    // 只显示包含至少一条用户消息的会话
    const hasUserMessage = session.messages.some(message => message.role === 'user');
    return hasUserMessage;
  });
  
  // 计算当前显示的会话
  const displaySessions = filteredSessions.slice(0, currentPage * ITEMS_PER_PAGE);
  const totalSessions = filteredSessions.length;
  
  // 更新hasMore状态
  useEffect(() => {
    setHasMore(displaySessions.length < totalSessions);
  }, [displaySessions.length, totalSessions]);
  
  // 加载更多数据
  const loadMore = useCallback(() => {
    if (isLoading || !hasMore) return;
    
    setIsLoading(true);
    // 模拟异步加载延迟
    setTimeout(() => {
      setCurrentPage(prev => prev + 1);
      setIsLoading(false);
    }, 200);
  }, [isLoading, hasMore]);
  
  // 设置Intersection Observer
  useEffect(() => {
    if (!loadingTriggerRef.current) return;
    
    observerRef.current = new IntersectionObserver(
      (entries) => {
        const target = entries[0];
        if (target.isIntersecting && hasMore && !isLoading) {
          loadMore();
        }
      },
      {
        root: scrollContainerRef.current,
        rootMargin: '100px', // 提前100px开始加载
        threshold: 0.1
      }
    );
    
    observerRef.current.observe(loadingTriggerRef.current);
    
    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [loadMore, hasMore, isLoading]);
  
  // 重置分页当会话数据变化时
  useEffect(() => {
    setCurrentPage(1);
  }, [chatSessions.length]);
  
  if (filteredSessions.length === 0) {
    return (
      <div className="p-4 text-center text-gray-500 dark:text-gray-400">
        <MessageCircle className="h-12 w-12 mx-auto mb-2 opacity-50" />
        <p className="text-sm">还没有聊天记录</p>
        <p className="text-xs mt-1">开始您的第一次对话吧</p>
      </div>
    );
  }

  return (
    <div 
      ref={scrollContainerRef}
      className="space-y-2 p-2 h-full overflow-y-auto"
      style={{
        scrollBehavior: 'smooth'
      }}
    >
      {displaySessions.map((session, index) => {
        // 使用React.memo优化的会话项组件
        const SessionItem = React.memo(({ session, index }: { session: any, index: number }) => (
        <Link
          key={session.id}
          to={`/chat/${session.id}`}
          onClick={() => setCurrentSession(session.id)}
          className={cn(
            'group block p-3 rounded-lg border transition-all duration-300 hover:shadow-sm',
            'opacity-0 translate-y-2 animate-fade-in',
            activeSessionId === session.id
              ? 'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-700'
              : 'bg-white border-gray-200 hover:border-gray-300 dark:bg-gray-800 dark:border-gray-700 dark:hover:border-gray-600'
          )}
            style={{
              animationDelay: `${(index % ITEMS_PER_PAGE) * 20}ms`, // 减少动画延迟
              animationDuration: '300ms',
              animationFillMode: 'forwards'
            }}
        >
          {/* 会话标题 */}
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-900 dark:text-white truncate flex-1">
              {session.title}
            </h3>
            <div className="flex items-center space-x-2">
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {formatDate(session.updatedAt)}
              </span>
              <div className="relative">
                <button
                  onClick={(e) => toggleDeleteMenu(session.id, e)}
                  className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors opacity-0 group-hover:opacity-100"
                >
                  <MoreVertical className="h-3 w-3 text-gray-400" />
                </button>
                {showDeleteMenu === session.id && (
                   <div 
                     ref={menuRef}
                     className="absolute right-0 top-6 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-10"
                   >
                     <button
                       onClick={(e) => handleDeleteSession(session.id, e)}
                       className="flex items-center space-x-2 w-full px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
                     >
                       <Trash2 className="h-3 w-3" />
                       <span>移至回收站</span>
                     </button>
                   </div>
                 )}
              </div>
            </div>
          </div>

          {/* 角色和模型信息 */}
          <div className="flex items-center space-x-3 mb-2 text-xs text-gray-600 dark:text-gray-400">
            <div className="flex items-center space-x-2">
              <Avatar
                name={getRoleName(session.roleId)}
                avatar={getRole(session.roleId)?.avatar}
                size="sm"
              />
              <span>{getRoleName(session.roleId)}</span>
            </div>
            <span className="flex items-center">
              <Bot className="h-3 w-3 mr-1" />
              {getModelName(session.modelId)}
            </span>
          </div>

          {/* 消息预览 */}
          <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2">
            {getMessagePreview(session.messages)}
          </p>

          {/* 消息数量 */}
          <div className="flex items-center justify-between mt-2">
            <span className="text-xs text-gray-400">
              {session.messages.length} 条消息
            </span>
          </div>
        </Link>
        ));
        
        return <SessionItem key={session.id} session={session} index={index} />;
      })}
      
      {/* 加载触发器和加载状态 */}
      {hasMore && (
        <div 
          ref={loadingTriggerRef}
          className="flex items-center justify-center py-4"
        >
          {isLoading ? (
            <div className="flex items-center space-x-2 text-gray-500 dark:text-gray-400">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
              <span className="text-xs">加载中...</span>
            </div>
          ) : (
            <div className="text-xs text-gray-400">
              滚动加载更多
            </div>
          )}
        </div>
      )}
      
      {/* 加载完成提示 */}
      {!hasMore && displaySessions.length > ITEMS_PER_PAGE && (
        <div className="text-center py-4">
          <span className="text-xs text-gray-400">
            已显示全部 {totalSessions} 条记录
          </span>
        </div>
      )}
    </div>
  );
};

export default ChatSessionList;
