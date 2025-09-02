// 知识库卡片组件

import React, { useState } from 'react';
import { BookOpen, Edit, Trash2, Calendar, FileText } from 'lucide-react';
import { useKnowledgeStore } from '../../stores/knowledgeStore';
import ConfirmDialog from '../ConfirmDialog';
import type { KnowledgeBase, KnowledgeBaseStats } from '../../types/knowledge';

interface KnowledgeBaseCardProps {
  knowledgeBase: KnowledgeBase;
  stats?: KnowledgeBaseStats;
  onView: () => void;
  onEdit: (knowledgeBase: KnowledgeBase) => void;
}

export const KnowledgeBaseCard: React.FC<KnowledgeBaseCardProps> = ({
  knowledgeBase,
  stats,
  onView,
  onEdit
}) => {
  const { deleteKnowledgeBase, loading } = useKnowledgeStore();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleDelete = () => {
    setShowDeleteConfirm(true);
  };

  const handleConfirmDelete = async () => {
    try {
      await deleteKnowledgeBase(knowledgeBase.id);
      setShowDeleteConfirm(false);
    } catch (error) {
      console.error('删除知识库失败:', error);
    }
  };

  const handleCancelDelete = () => {
    setShowDeleteConfirm(false);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <div className="card bg-base-100 shadow-xl hover:shadow-2xl transition-shadow">
      <div className="card-body">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="avatar placeholder">
              <div className="bg-primary text-primary-content rounded-lg w-12 h-12">
                <BookOpen className="w-6 h-6" />
              </div>
            </div>
            <div>
              <h3 className="card-title text-base-content">{knowledgeBase.name}</h3>
              <p className="text-sm text-base-content/60">
                创建于 {formatDate(knowledgeBase.created_at)}
              </p>
            </div>
          </div>
          
          <div className="dropdown dropdown-end">
            <div tabIndex={0} role="button" className="btn btn-ghost btn-sm btn-circle">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
              </svg>
            </div>
            <ul tabIndex={0} className="dropdown-content z-[1] menu p-2 shadow bg-base-100 rounded-box w-52">
              <li>
                <button onClick={() => onEdit(knowledgeBase)} className="flex items-center gap-2">
                  <Edit className="w-4 h-4" />
                  编辑
                </button>
              </li>
              <li>
                <button onClick={onView} className="flex items-center gap-2">
                  <BookOpen className="w-4 h-4" />
                  查看详情
                </button>
              </li>
              <li>
                <button onClick={handleDelete} disabled={loading} className="flex items-center gap-2 text-error">
                  <Trash2 className="w-4 h-4" />
                  删除
                </button>
              </li>
            </ul>
          </div>
        </div>

        {knowledgeBase.description && (
          <p className="text-base-content/70 text-sm mb-4 line-clamp-2">
            {knowledgeBase.description}
          </p>
        )}

        <div className="flex items-center justify-between text-sm">
          <div className="badge badge-outline gap-1">
            <FileText className="w-3 h-3" />
            {stats?.entryCount || 0} 条目
          </div>
          
          {stats?.lastUpdated && (
            <span className="text-base-content/40 text-xs">
              更新于 {formatDate(stats.lastUpdated)}
            </span>
          )}
        </div>
      </div>

      {/* 删除确认对话框 */}
      <ConfirmDialog
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleConfirmDelete}
        title="删除知识库"
        message={`确定要删除知识库「${knowledgeBase.name}」吗？此操作不可恢复。`}
        confirmText="删除"
        cancelText="取消"
        variant="danger"
      />
    </div>
  );
};