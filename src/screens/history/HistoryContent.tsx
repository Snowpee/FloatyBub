import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAppStore } from '../../store';
import {
  Search,
  Trash2,
  MessageCircle,
  Calendar,
  User,
  Bot,
  Download,
  Filter,
  ChevronDown,
  Eye,
  EyeOff,
  MoreHorizontal,
  Trash
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { toast } from '../../hooks/useToast';
import ConfirmDialog from '../../components/ConfirmDialog';
import Avatar from '../../components/Avatar';

interface HistoryPageProps {
  onCloseModal?: () => void;
}

const HistoryContent: React.FC<HistoryPageProps> = ({ onCloseModal }) => {
  const {
    chatSessions,
    aiRoles,
    llmConfigs,
    deleteChatSession,
    setCurrentSession,
    showSession,
    hideSession,
    sidebarOpen,
    toggleSidebar
  } = useAppStore();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRole, setSelectedRole] = useState<string>('');
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [sortBy, setSortBy] = useState<'date' | 'title'>('date');
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    sessionId: string;
    sessionTitle: string;
  }>({ isOpen: false, sessionId: '', sessionTitle: '' });
  const modalRef = useRef<HTMLDialogElement>(null);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [showFilters, setShowFilters] = useState(false);

  // 获取会话的最后活跃时间（最后消息时间或更新时间）
  const getLastActiveTime = (session: any) => {
    if (session.messages && session.messages.length > 0) {
      const lastMessage = session.messages[session.messages.length - 1];
      const messageTime = lastMessage.message_timestamp || lastMessage.timestamp;
      if (messageTime) {
        const t = new Date(messageTime).getTime();
        return isNaN(t) ? 0 : t;
      }
    }
    const ut = new Date(session.updatedAt).getTime();
    return isNaN(ut) ? 0 : ut;
  };

  // 过滤和排序会话
  const filteredAndSortedSessions = useMemo(() => {
    let filtered = chatSessions.filter(session => {
      const matchesSearch = session.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        session.messages.some(msg => msg.content.toLowerCase().includes(searchTerm.toLowerCase()));
      
      const matchesRole = selectedRole === '' || selectedRole === 'all' || session.roleId === selectedRole;
      const matchesModel = selectedModel === '' || selectedModel === 'all' || session.modelId === selectedModel;
      
      return matchesSearch && matchesRole && matchesModel;
    });

    // 排序 - 默认按时间降序（最新的在最上面）
    filtered.sort((a, b) => {
      let comparison = 0;
      
      if (sortBy === 'date') {
        // 使用最后活跃时间进行排序，与侧边栏保持一致
        const aTime = getLastActiveTime(a);
        const bTime = getLastActiveTime(b);
        comparison = bTime - aTime; // 按最后活跃时间降序
      } else if (sortBy === 'title') {
        comparison = a.title.localeCompare(b.title);
        return sortOrder === 'asc' ? comparison : -comparison;
      }
      
      // 对于日期排序，始终使用降序（最新的在最上面）
      return sortBy === 'date' ? comparison : (sortOrder === 'asc' ? comparison : -comparison);
    });

    return filtered;
  }, [chatSessions, searchTerm, selectedRole, selectedModel, sortBy, sortOrder]);

  const handleDeleteSession = (sessionId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    const session = chatSessions.find(s => s.id === sessionId);
    setConfirmDialog({
      isOpen: true,
      sessionId: sessionId,
      sessionTitle: session?.title || '未知会话'
    });
  };

  const confirmDeleteSession = async () => {
    try {
      await deleteChatSession(confirmDialog.sessionId);
      toast.success('会话已移至回收站');
      setConfirmDialog({ isOpen: false, sessionId: '', sessionTitle: '' });
    } catch (error) {
      console.error('删除会话失败:', error);
      toast.error(error instanceof Error ? error.message : '删除会话失败');
    }
  };

  const handleCancel = () => {
    setConfirmDialog({ isOpen: false, sessionId: '', sessionTitle: '' });
  };

  // 使用 ConfirmDialog 控制打开/关闭，无需原生 dialog 事件监听

  const handleToggleSession = (sessionId: string, isHidden: boolean, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (isHidden) {
      showSession(sessionId);
      toast.success('会话已重新加载到侧边栏');
    } else {
      hideSession(sessionId);
      toast.success('会话已从侧边栏隐藏');
    }
  };

  const handleExportSession = (sessionId: string, e: React.MouseEvent) => {
    e.preventDefault();
    // 移除 e.stopPropagation() 以允许事件冒泡到 dropdown 容器触发关闭逻辑
    
    const session = chatSessions.find(s => s.id === sessionId);
    if (!session) return;

    const role = aiRoles.find(r => r.id === session.roleId);
    const model = llmConfigs.find(m => m.id === session.modelId);
    
    const exportData = {
      title: session.title,
      role: role?.name || '未知角色',
      model: model?.name || '未知模型',
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      messages: session.messages.map(msg => ({
        role: msg.role,
        content: msg.content,
        timestamp: msg.timestamp
      }))
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: 'application/json'
    });
    
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chat-${session.title}-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast.success('会话已导出');
  };

  const formatDate = (date: Date | string | number) => {
    if (!date) return '未知日期';
    let d = date instanceof Date ? date : new Date(date as any);
    if (isNaN(d.getTime()) && typeof date === 'string') {
      const normalized = (date as string).replace(' ', 'T');
      d = new Date(normalized);
    }
    if (isNaN(d.getTime())) return '未知日期';
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (days === 0) {
      return '今天';
    } else if (days === 1) {
      return '昨天';
    } else if (days < 7) {
      return `${days}天前`;
    } else {
      return d.toLocaleDateString();
    }
  };

  const getMessagePreview = (messages: any[]) => {
    const lastUserMessage = messages.filter(m => m.role === 'user').pop();
    return lastUserMessage?.content.slice(0, 100) + (lastUserMessage?.content.length > 100 ? '...' : '') || '暂无消息';
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

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto md:pt-4">
      {/* <div className="mb-6">
        <p className="text-base-content/70">
          查看和管理您的聊天历史记录
        </p>
      </div> */}

      {/* 搜索和过滤器 */}
      <div className="mb-4 space-y-4">
        {/* 搜索框 */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-base-content/40" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="搜索会话标题或消息内容..."
            className="input input-bordered w-full pl-10"
          />
        </div>

        {/* 过滤器切换 */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="btn md:btn-sm"
          >
            <Filter className="h-4 w-4 mr-1" />
            过滤器
            <ChevronDown className={cn(
              'h-4 w-4 ml-1 transition-transform',
              showFilters && 'rotate-180'
            )} />
          </button>
          
          <div className="text-sm text-base-content/60">
            共 {filteredAndSortedSessions.length} 个会话
          </div>
        </div>

        {/* 过滤器面板 */}
        {showFilters && (
          <div className="card bg-base-200 p-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* 角色过滤 */}
              <div>
                <label className="label">
                  <span className="label-text">角色</span>
                </label>
                <select
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value)}
                  className="select md:select-sm select-bordered w-full"
                >
                  <option value="">所有角色</option>
                  {aiRoles.map(role => (
                    <option key={role.id} value={role.id}>
                      {role.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* 模型过滤 */}
              <div>
                <label className="label">
                  <span className="label-text">模型</span>
                </label>
                <select
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  className="select md:select-sm select-bordered w-full"
                >
                  <option value="">所有模型</option>
                  {llmConfigs.map(config => (
                    <option key={config.id} value={config.id}>
                      {config.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* 排序 */}
              <div>
                <label className="label">
                  <span className="label-text">排序</span>
                </label>
                <div className="flex space-x-2">
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as 'date' | 'title')}
                    className="select md:select-sm select-bordered flex-1"
                  >
                    <option value="date">时间</option>
                    <option value="title">标题</option>
                  </select>
                  <select
                    value={sortOrder}
                    onChange={(e) => setSortOrder(e.target.value as 'asc' | 'desc')}
                    className="select md:select-sm select-bordered flex-1"
                  >
                    <option value="desc">降序</option>
                    <option value="asc">升序</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 会话列表 */}
      {filteredAndSortedSessions.length === 0 ? (
        <div className="text-center py-12">
          <MessageCircle className="h-16 w-16 text-base-content/40 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-base-content mb-2">
            {searchTerm || selectedRole || selectedModel ? '没有找到匹配的会话' : '还没有聊天记录'}
          </h3>
          <p className="text-base-content/60">
            {searchTerm || selectedRole || selectedModel 
              ? '尝试调整搜索条件或过滤器'
              : '开始您的第一次AI对话吧'
            }
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredAndSortedSessions.map((session) => (
            <div key={session.id} className="card bg-base-100 shadow-sm border border-base-300 hover:shadow-md transition-shadow">
              <div className="card-body p-4">
                <div className="flex flex-col md:flex-row md:items-start md:justify-between space-y-4 md:space-y-0">
                  <div className="flex-1 min-w-0">
                    {/* 会话标题 */}
                    <div className="mb-2 flex items-center justify-start">
                      <h4 className="card-title text-base-content text-base truncate">
                        {session.title}
                      </h4>
                      {session.isHidden && (
                        <EyeOff className="h-4 w-4 ml-2 text-base-content/60" />
                      )}
                    </div>

                    {/* 模型和统计信息 - 移动端一行显示 */}
                    <div className="flex items-center space-x-4 text-sm">
                      <span className="flex items-center text-base-content/60">
                        {getRoleName(session.roleId)}
                      </span>
                      <span className="text-base-content/60">
                        {session.messages.length} 条消息
                      </span>
                      <span className="flex items-center text-base-content/60">
                        <Calendar className="h-3 w-3 mr-1" />
                        {formatDate(session.updatedAt)}
                      </span>
                    </div>
                  </div>

                  {/* 操作按钮 */}
                  <div className="flex items-center justify-between md:ml-4 w-full md:w-auto">
                    {/* 全部修改到 dropdown 中 */}
                    <div className="dropdown dropdown-start md:dropdown-end mr-2">
                      <label tabIndex={0} className="btn btn-sm btn-circle">
                        <MoreHorizontal className="h-4 w-4" />
                      </label>
                      <ul 
                        tabIndex={0} 
                        className="dropdown-content menu p-2 shadow bg-base-100 rounded-box w-52"
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
                          <a 
                            href="#" 
                            className="justify-start"
                            onClick={(e) => {
                              e.preventDefault();

                              if (session.isHidden) {
                                showSession(session.id);
                                toast.success('会话已重新加载到侧边栏');
                              } else {
                                hideSession(session.id);
                                toast.success('会话已从侧边栏隐藏');
                              }
                            }}
                          >
                            {session.isHidden ? (
                              <Eye className="h-4 w-4" />
                            ) : (
                              <EyeOff className="h-4 w-4" />
                            )}
                            {session.isHidden ? 
                              `显示会话` 
                              :
                              `隐藏会话`
                            }
                          </a>
                        </li>
                        <li>
                          <a href="#" className="justify-start"
                             onClick={(e) => handleExportSession(session.id, e)}
                          >
                            <Download className="h-4 w-4" />
                            导出会话
                          </a>
                        </li>
                        <li>
                          <a href="#" 
                            className="justify-start text-error"
                            onClick={(e) => {
                              e.preventDefault();
                              setConfirmDialog({ isOpen: true, sessionId: session.id, sessionTitle: session.title });
                            }}
                            >
                            <Trash className="h-4 w-4" />
                            移至回收站
                          </a>
                        </li>
                      </ul>
                    </div>
                    <Link
                      to={`/chat/${session.id}`}
                      onClick={() => {
                        setCurrentSession(session.id);
                        console.log('[HistoryModal] trigger: navigate to session', { sessionId: session.id });
                        onCloseModal?.();
                        // 如果在移动端，跳转后关闭侧边栏
                        if (window.innerWidth < 1024 && sidebarOpen) {
                          toggleSidebar();
                        }
                      }}
                      className="btn btn-sm md:ml-2"
                    >查看会话</Link>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 移至回收站确认弹窗（统一使用 ConfirmDialog） */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        onClose={() => setConfirmDialog({ isOpen: false, sessionId: '', sessionTitle: '' })}
        onConfirm={confirmDeleteSession}
        title="移至回收站"
        message={`确定要将会话 "${confirmDialog.sessionTitle}" 移至回收站吗？该操作不会立即永久删除。`}
        confirmText="移至回收站"
        cancelText="取消"
        variant="warning"
      />
    </div>
  );
};

export default HistoryContent;
