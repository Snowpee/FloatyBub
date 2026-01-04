// 知识条目管理组件

import React, { useEffect, useState } from 'react';
import { ArrowLeft, Plus, Search, Edit, Trash2, Tag, FileText, Calendar } from 'lucide-react';
import { useKnowledgeStore } from '@/store/knowledgeStore';
import KnowledgeEntryModal from './KnowledgeEntryModal';
import ConfirmDialog from '@/components/ConfirmDialog';
import type { KnowledgeBase, KnowledgeEntry } from '@/types/knowledge';
import { toast } from '@/hooks/useToast';
import { KnowledgeService } from '@/services/knowledgeService';

interface KnowledgeEntryCardProps {
  entry: KnowledgeEntry;
  onEdit: (entry: KnowledgeEntry) => void;
  onDelete: (entryId: string) => void;
}

const KnowledgeEntryCard: React.FC<KnowledgeEntryCardProps> = ({
  entry,
  onEdit,
  onDelete
}) => {
  const { loading } = useKnowledgeStore();

  const handleEdit = () => {
    onEdit(entry);
  };

  const handleDelete = () => {
    onDelete(entry.id);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="card bg-base-100 border border-base-300 hover:border-base-content/20 transition-colors group">
      {/* 卡片头部 */}
      <div className="card-body">
        <div className="flex items-start justify-between mb-3">
          <h3 className="card-title text-base-content flex-1 mr-4">
            {entry.name}
          </h3>

          {/* 操作按钮 */}
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={handleEdit}
              className="btn btn-ghost btn-sm btn-circle"
              title="编辑条目"
            >
              <Edit className="w-4 h-4" />
            </button>
            <button
              onClick={handleDelete}
              disabled={loading}
              className="btn btn-ghost btn-sm btn-circle text-error hover:bg-error/10"
              title="删除条目"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 关键词标签 */}
        {entry.keywords.length > 0 && (
          <div className="flex items-center gap-2 mb-4">
            <Tag className="w-4 h-4 text-base-content/40" />
            <div className="flex flex-wrap gap-1">
              {entry.keywords.map((keyword, index) => (
                <span
                  key={index}
                  className="badge badge-primary badge-sm"
                >
                  {keyword}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* 解释内容 */}
        <div className="mb-4">
          <p className="text-base-content/70 text-sm leading-relaxed line-clamp-4">
            {entry.explanation}
          </p>
        </div>

        {/* 时间信息 */}
        <div className="flex items-center gap-4 text-xs text-base-content/50 pt-4 border-t border-base-300">
          <div className="flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            <span>创建于 {formatDate(entry.created_at)}</span>
          </div>
          {entry.updated_at !== entry.created_at && (
            <div className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              <span>更新于 {formatDate(entry.updated_at)}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

interface KnowledgeEntryManagerProps {
  knowledgeBase: KnowledgeBase;
  onClose: () => void;
  onBulkImport?: () => void;
}

export const KnowledgeEntryManager: React.FC<KnowledgeEntryManagerProps> = ({
  knowledgeBase,
  onClose,
  onBulkImport
}) => {
  const {
    knowledgeEntries,
    loading,
    error,
    managementState,
    loadKnowledgeEntries,
    performAction,
    clearError
  } = useKnowledgeStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEntry, setSelectedEntry] = useState<KnowledgeEntry | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{
    isOpen: boolean;
    entryId: string;
    entryName: string;
  }>({ isOpen: false, entryId: '', entryName: '' });

  useEffect(() => {
    loadKnowledgeEntries(knowledgeBase.id);
  }, [knowledgeBase.id, loadKnowledgeEntries]);

  const filteredEntries = knowledgeEntries.filter(entry => {
    const query = searchQuery.toLowerCase();
    return (
      entry.name.toLowerCase().includes(query) ||
      entry.explanation.toLowerCase().includes(query) ||
      entry.keywords.some(keyword => keyword.toLowerCase().includes(query))
    );
  });

  const handleCreateEntry = () => {
    performAction('create_entry');
  };

  const handleEditEntry = (entry: KnowledgeEntry) => {
    setSelectedEntry(entry);
    performAction('edit_entry', { id: entry.id });
  };

  const handleCancel = () => {
    performAction('cancel');
    setSelectedEntry(null);
  };

  const handleDeleteEntry = async (entryId: string) => {
    const entry = knowledgeEntries.find(e => e.id === entryId);
    setDeleteConfirm({
      isOpen: true,
      entryId,
      entryName: entry?.name || ''
    });
  };

  const handleConfirmDelete = async () => {
    const entryIdToDelete = deleteConfirm.entryId;
    const entryNameToDelete = deleteConfirm.entryName;
    
    try {
      await KnowledgeService.deleteKnowledgeEntry(entryIdToDelete);
      // 重新加载知识条目列表
      await loadKnowledgeEntries(knowledgeBase.id);
      toast.success(`知识条目「${entryNameToDelete}」已删除`);
    } catch (error) {
      console.error('删除知识条目失败:', error);
      toast.error('删除知识条目失败，请稍后重试');
    }
  };

  const handleCancelDelete = () => {
    setDeleteConfirm({ isOpen: false, entryId: '', entryName: '' });
  };

  return (
    <div 
      className="min-h-screen knowledge-entry-manager"
      data-knowledge-page
      data-is-detail-view="true"
      data-detail-title={knowledgeBase.name}
    >
      <div className="max-w-7xl mx-auto">
        {/* 隐藏的返回按钮，供SettingsModal检测使用 */}
        <button
          onClick={onClose}
          className="hidden"
          data-back-button
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        {/* 页面内容 */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
          {/* 统计信息 */}
          {knowledgeEntries.length > 0 && (
          <div>
            <p className="text-base-content/70">
              管理知识库中的条目
            </p>
          </div>
          )}

          {/* 操作按钮 */}
          <button
            onClick={handleCreateEntry}
            className="btn btn-outline-light md:btn md:btn-primary w-full md:w-auto"
          >
            <Plus className="w-4 h-4" />
            添加条目
          </button>

        </div>

        {/* 错误提示 */}
        {error && (
          <div className="alert alert-error mb-6">
            <span>{error}</span>
            <button
              onClick={clearError}
              className="btn btn-ghost btn-sm btn-circle"
            >
              ×
            </button>
          </div>
        )}

        {/* 操作栏 - 仅在有条目时显示 */}
        {knowledgeEntries.length > 0 && (
          <div className="mb-4 flex flex-col md:flex-row gap-4 justify-between">
            {/* 搜索框 */}
            <label className="input h-12 md:h-10 w-full">
              <Search className="text-base-content/40 w-5 h-5" />
              <input
                type="text"
                placeholder="搜索条目名称、关键词或内容..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="input input-bordered"
              />
            </label>
            {/* 统计信息 */}  
            <div className="card h-12 md:h-10 items-center justify-center w-full px-4">
              <div className="flex items-center gap-6 text-sm text-base-content/70">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  <span>共 {knowledgeEntries.length} 个条目</span>
                </div>
                <div className="flex items-center gap-2">
                  <Tag className="w-4 h-4" />
                  <span>
                    共 {new Set(knowledgeEntries.flatMap(entry => entry.keywords)).size} 个关键词
                  </span>
                </div>
              </div>
            </div>


          </div>
        )}

        {/* 条目列表 */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <span className="loading loading-spinner loading-lg"></span>
          </div>
        ) : filteredEntries.length === 0 ? (
          <div className="text-center py-12">
            <FileText className="mx-auto h-12 w-12 text-base-content/40 mb-4" />
            <h3 className="text-lg font-medium text-base-content mb-2">
              {searchQuery ? '未找到匹配的条目' : '还没有知识条目'}
            </h3>
            <p className="text-base-content/70 mb-6">
              {searchQuery ? '尝试调整搜索条件' : '添加您的第一个知识条目，开始构建知识体系'}
            </p>
            {!searchQuery && (
              <button
                onClick={handleCreateEntry}
                className="btn btn-primary gap-2"
              >
                <Plus className="w-4 h-4" />
                添加条目
              </button>
            )}
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {filteredEntries.map((entry) => (
              <KnowledgeEntryCard
                key={entry.id}
                entry={entry}
                onEdit={handleEditEntry}
                onDelete={handleDeleteEntry}
              />
            ))}
          </div>
        )}

        {/* 创建/编辑条目表单 */}
        {(managementState.isCreatingEntry || managementState.isEditingEntry) && (
          <KnowledgeEntryModal
            knowledgeBase={knowledgeBase}
            entry={selectedEntry}
            isOpen={managementState.isCreatingEntry || managementState.isEditingEntry}
            onCancel={handleCancel}
          />
        )}

        {/* 删除确认对话框 */}
        <ConfirmDialog
          isOpen={deleteConfirm.isOpen}
          onClose={() => setDeleteConfirm({ isOpen: false, entryId: '', entryName: '' })}
          onConfirm={handleConfirmDelete}
          title="删除知识条目"
          message={`确定要删除知识条目「${deleteConfirm.entryName}」吗？此操作不可恢复。`}
          confirmText="删除"
          cancelText="取消"
          variant="danger"
        />
      </div>
    </div>
  );
};
