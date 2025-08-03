import React, { useState, useEffect, useRef } from 'react';
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
  const menuRef = useRef<HTMLDivElement>(null);
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
  const handleDeleteSession = (sessionIdToDelete: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    deleteChatSession(sessionIdToDelete);
    setShowDeleteMenu(null);
    
    // 如果删除的是当前会话，导航到聊天首页
    if (activeSessionId === sessionIdToDelete) {
      navigate('/chat');
    }
    
    toast.success('会话已删除');
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
    return aiRoles.find(r => r.id === roleId)?.name || '未知角色';
  };

  const getRole = (roleId: string) => {
    return aiRoles.find(r => r.id === roleId);
  };

  const getModelName = (modelId: string) => {
    return llmConfigs.find(m => m.id === modelId)?.name || '未知模型';
  };

  // 完全过滤掉临时会话，使其不在侧边栏显示
  // 同时确保只有包含用户消息的会话才会显示
  const displaySessions = chatSessions.filter(session => {
    // 如果是临时会话，则不显示
    if (tempSessionId === session.id) {
      return false;
    }
    // 只显示包含至少一条用户消息的会话
    const hasUserMessage = session.messages.some(message => message.role === 'user');
    return hasUserMessage;
  });
  
  if (displaySessions.length === 0) {
    return (
      <div className="p-4 text-center text-gray-500 dark:text-gray-400">
        <MessageCircle className="h-12 w-12 mx-auto mb-2 opacity-50" />
        <p className="text-sm">还没有聊天记录</p>
        <p className="text-xs mt-1">开始您的第一次对话吧</p>
      </div>
    );
  }

  return (
    <div className="space-y-2 p-2">
      {displaySessions.slice(0, 20).map((session, index) => (
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
            animationDelay: `${index * 50}ms`,
            animationDuration: '400ms',
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
                       <span>删除</span>
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
      ))}
      
      {displaySessions.length > 20 && (
        <Link
          to="/history"
          className="block p-3 text-center text-sm text-blue-600 dark:text-blue-400 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg transition-colors"
        >
          查看更多历史记录 ({displaySessions.length - 20}+)
        </Link>
      )}
    </div>
  );
};

export default ChatSessionList;