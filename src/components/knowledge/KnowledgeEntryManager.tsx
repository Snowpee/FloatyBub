// 知识条目管理组件

import React, { useEffect, useState } from 'react';
import { ArrowLeft, Plus, Search, Edit, Trash2, Tag, FileText } from 'lucide-react';
import { useKnowledgeStore } from '../../stores/knowledgeStore';
import { KnowledgeEntryForm } from './KnowledgeEntryForm';
import { KnowledgeEntryCard } from './KnowledgeEntryCard';
import ConfirmDialog from '../ConfirmDialog';
import type { KnowledgeBase, KnowledgeEntry } from '../../types/knowledge';
import { toast } from '../../hooks/useToast';
import { KnowledgeService } from '../../services/knowledgeService';

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

  const handleImport = () => {
    if (onBulkImport) {
      onBulkImport();
    } else {
      performAction('import_entries');
    }
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
      className="min-h-screen bg-base-100 knowledge-entry-manager"
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
        <div className="mb-8">
          {/* 描述信息 */}
          <p className="text-base-content/70 mb-4">
            {knowledgeBase.description || '管理知识库中的条目'}
          </p>

          {/* 统计信息 */}
          {knowledgeEntries.length > 0 && (
            <div className="card bg-base-200 p-4">
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
          )}
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
          <div className="mb-6 flex flex-col sm:flex-row gap-4 justify-between">
            {/* 搜索框 */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-base-content/40 w-5 h-5" />
              <input
                type="text"
                placeholder="搜索条目名称、关键词或内容..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="input input-bordered w-full pl-10"
              />
            </div>

            {/* 操作按钮 */}
            <div className="flex gap-2">
              <button
                onClick={handleCreateEntry}
                className="btn btn-primary gap-2"
              >
                <Plus className="w-4 h-4" />
                添加条目
              </button>
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
          <div className="grid gap-4">
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
          <KnowledgeEntryForm
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