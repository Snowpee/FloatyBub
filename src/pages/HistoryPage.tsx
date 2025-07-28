import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAppStore } from '../store';
import {
  Search,
  Trash2,
  MessageCircle,
  Calendar,
  User,
  Bot,
  Download,
  Filter,
  ChevronDown
} from 'lucide-react';
import { cn } from '../lib/utils';
import { toast } from 'sonner';
import ConfirmDialog from '../components/ConfirmDialog';
import Avatar from '../components/Avatar';

const HistoryPage: React.FC = () => {
  const {
    chatSessions,
    aiRoles,
    llmConfigs,
    deleteChatSession,
    setCurrentSession
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
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [showFilters, setShowFilters] = useState(false);

  // 过滤和排序会话
  const filteredAndSortedSessions = useMemo(() => {
    let filtered = chatSessions.filter(session => {
      const matchesSearch = session.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        session.messages.some(msg => msg.content.toLowerCase().includes(searchTerm.toLowerCase()));
      
      const matchesRole = selectedRole === '' || selectedRole === 'all' || session.roleId === selectedRole;
      const matchesModel = selectedModel === '' || selectedModel === 'all' || session.modelId === selectedModel;
      
      return matchesSearch && matchesRole && matchesModel;
    });

    // 排序
    filtered.sort((a, b) => {
      let comparison = 0;
      
      if (sortBy === 'date') {
        comparison = new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
      } else if (sortBy === 'title') {
        comparison = a.title.localeCompare(b.title);
      }
      
      return sortOrder === 'asc' ? comparison : -comparison;
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

  const confirmDeleteSession = () => {
    deleteChatSession(confirmDialog.sessionId);
    toast.success('会话已删除');
  };

  const handleExportSession = (sessionId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
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
    return lastUserMessage?.content.slice(0, 100) + (lastUserMessage?.content.length > 100 ? '...' : '') || '暂无消息';
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

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-base-content mb-2">
          历史管理
        </h1>
        <p className="text-base-content/70">
          查看和管理您的聊天历史记录
        </p>
      </div>

      {/* 搜索和过滤器 */}
      <div className="mb-6 space-y-4">
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
            className="btn btn-ghost btn-sm"
          >
            <Filter className="h-4 w-4 mr-2" />
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
                  className="select select-bordered w-full"
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
                  className="select select-bordered w-full"
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
                    className="select select-bordered flex-1"
                  >
                    <option value="date">时间</option>
                    <option value="title">标题</option>
                  </select>
                  <select
                    value={sortOrder}
                    onChange={(e) => setSortOrder(e.target.value as 'asc' | 'desc')}
                    className="select select-bordered flex-1"
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
              <div className="card-body">
                <div className="flex items-start justify-between">
                  <Link
                    to={`/chat/${session.id}`}
                    onClick={() => setCurrentSession(session.id)}
                    className="flex-1 min-w-0 hover:text-primary transition-colors"
                  >
                    {/* 会话标题和时间 */}
                    <div className="flex items-center space-x-3 mb-2">
                      <h3 className="card-title text-base-content truncate">
                        {session.title}
                      </h3>
                      <span className="flex items-center text-sm text-base-content/60">
                        <Calendar className="h-3 w-3 mr-1" />
                        {formatDate(session.updatedAt)}
                      </span>
                    </div>

                    {/* 角色和模型信息 */}
                    <div className="flex items-center space-x-4 mb-3">
                      <div className="flex items-center space-x-2 text-sm text-base-content/70">
                        <Avatar
                          name={getRoleName(session.roleId)}
                          avatar={getRole(session.roleId)?.avatar}
                          size="sm"
                        />
                        <span>{getRoleName(session.roleId)}</span>
                      </div>
                      <span className="flex items-center text-sm text-base-content/70">
                        <Bot className="h-3 w-3 mr-1" />
                        {getModelName(session.modelId)}
                      </span>
                      <span className="text-sm text-base-content/60">
                        {session.messages.length} 条消息
                      </span>
                    </div>

                    {/* 消息预览 */}
                    <p className="text-base-content/60 text-sm line-clamp-2">
                      {getMessagePreview(session.messages)}
                    </p>
                  </Link>

                  {/* 操作按钮 */}
                  <div className="flex items-center space-x-2 ml-4">
                    <button
                      onClick={(e) => handleExportSession(session.id, e)}
                      className="btn btn-ghost btn-sm btn-square text-info hover:bg-info/10"
                      title="导出会话"
                    >
                      <Download className="h-4 w-4" />
                    </button>
                    <button
                      onClick={(e) => handleDeleteSession(session.id, e)}
                      className="btn btn-ghost btn-sm btn-square text-error hover:bg-error/10"
                      title="删除会话"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 删除确认模态框 */}
      {confirmDialog.isOpen && (
        <div className="modal modal-open">
          <div className="modal-box">
            <h3 className="font-bold text-lg mb-4">删除会话</h3>
            <p className="py-4">
              确定要删除会话 "{confirmDialog.sessionTitle}" 吗？此操作不可撤销，所有聊天记录将被永久删除。
            </p>
            <div className="modal-action">
              <button
                onClick={() => setConfirmDialog({ isOpen: false, sessionId: '', sessionTitle: '' })}
                className="btn"
              >
                取消
              </button>
              <button
                onClick={confirmDeleteSession}
                className="btn btn-error"
              >
                删除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HistoryPage;