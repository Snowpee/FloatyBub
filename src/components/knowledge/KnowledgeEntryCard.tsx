// 知识条目卡片组件

import React from 'react';
import { Edit, Trash2, Tag, Calendar } from 'lucide-react';
import { useKnowledgeStore } from '../../stores/knowledgeStore';
import type { KnowledgeEntry } from '../../types/knowledge';

interface KnowledgeEntryCardProps {
  entry: KnowledgeEntry;
  onEdit: (entry: KnowledgeEntry) => void;
  onDelete: (entryId: string) => void;
}

export const KnowledgeEntryCard: React.FC<KnowledgeEntryCardProps> = ({
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