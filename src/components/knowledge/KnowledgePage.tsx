import React, { useState, useEffect } from 'react';
import { BookOpen, Plus, Search, FileText, Users } from 'lucide-react';
import { useKnowledgeStore } from '../../stores/knowledgeStore';
import { KnowledgeBase } from '../../types/knowledge';
import { KnowledgeBaseCard } from './KnowledgeBaseCard';
import { KnowledgeBaseForm } from './KnowledgeBaseForm';
import { KnowledgeEntryManager } from './KnowledgeEntryManager';
import { KnowledgeBulkImport } from './KnowledgeBulkImport';
import ConfirmDialog from '../ConfirmDialog';

const KnowledgePage: React.FC = () => {
  const {
    knowledgeBases,
    knowledgeBaseStats,
    loading,
    loadKnowledgeBases,
    loadKnowledgeBaseStats,
    deleteKnowledgeBase
  } = useKnowledgeStore();

  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingKnowledgeBase, setEditingKnowledgeBase] = useState<KnowledgeBase | null>(null);
  const [viewingKnowledgeBase, setViewingKnowledgeBase] = useState<KnowledgeBase | null>(null);
  const [showBulkImport, setShowBulkImport] = useState<KnowledgeBase | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; knowledgeBase: KnowledgeBase | null }>({ isOpen: false, knowledgeBase: null });

  useEffect(() => {
    loadKnowledgeBases();
    loadKnowledgeBaseStats();
  }, [loadKnowledgeBases, loadKnowledgeBaseStats]);

  const filteredKnowledgeBases = knowledgeBases.filter(kb =>
    kb.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    kb.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleEdit = (knowledgeBase: KnowledgeBase) => {
    setEditingKnowledgeBase(knowledgeBase);
  };

  const handleDelete = (knowledgeBase: KnowledgeBase) => {
    setDeleteConfirm({ isOpen: true, knowledgeBase });
  };

  const handleConfirmDelete = async () => {
    if (deleteConfirm.knowledgeBase) {
      await deleteKnowledgeBase(deleteConfirm.knowledgeBase.id);
      setDeleteConfirm({ isOpen: false, knowledgeBase: null });
    }
  };

  const handleCancelDelete = () => {
    setDeleteConfirm({ isOpen: false, knowledgeBase: null });
  };

  const handleViewDetails = (knowledgeBase: KnowledgeBase) => {
    setViewingKnowledgeBase(knowledgeBase);
  };

  const handleFormClose = () => {
    setShowCreateForm(false);
    setEditingKnowledgeBase(null);
  };

  const handleFormSuccess = () => {
    handleFormClose();
    loadKnowledgeBases();
  };

  const handleBulkImportSuccess = () => {
    setShowBulkImport(null);
    loadKnowledgeBases();
  };

  return (
    <div className="p-0">
      {/* 页面标题和统计 */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-base-content mb-2">知识库管理</h1>
        <p className="text-base-content/70">
          管理您的知识库，包括创建、编辑、删除和批量导入知识条目
        </p>
        
        {/* 统计信息 */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="stats shadow">
            <div className="stat">
              <div className="stat-figure text-primary">
                <BookOpen className="w-8 h-8" />
              </div>
              <div className="stat-title">知识库总数</div>
              <div className="stat-value text-primary">{knowledgeBases.length}</div>
            </div>
          </div>
          
          <div className="stats shadow">
            <div className="stat">
              <div className="stat-figure text-secondary">
                <FileText className="w-8 h-8" />
              </div>
              <div className="stat-title">总条目数</div>
              <div className="stat-value text-secondary">
                {knowledgeBaseStats.reduce((sum, stats) => sum + stats.entryCount, 0)}
              </div>
            </div>
          </div>
          
          <div className="stats shadow">
            <div className="stat">
              <div className="stat-figure text-accent">
                <Users className="w-8 h-8" />
              </div>
              <div className="stat-title">关联角色</div>
              <div className="stat-value text-accent">
                0
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 操作栏 */}
      <div className="mb-6 flex flex-col sm:flex-row gap-4 justify-between">
        <div className="flex-1 max-w-md">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-base-content/40 w-4 h-4" />
            <input
              type="text"
              placeholder="搜索知识库..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input input-bordered w-full pl-10"
            />
          </div>
        </div>
        
        <div className="flex gap-2">
          <button
            onClick={() => setShowCreateForm(true)}
            className="btn btn-primary gap-2"
          >
            <Plus className="w-4 h-4" />
            创建知识库
          </button>
        </div>
      </div>

      {/* 知识库列表 */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <span className="loading loading-spinner loading-lg"></span>
        </div>
      ) : filteredKnowledgeBases.length === 0 ? (
        <div className="text-center py-12">
          <BookOpen className="w-16 h-16 text-base-content/40 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-base-content mb-2">
            {searchTerm ? '未找到匹配的知识库' : '还没有知识库'}
          </h3>
          <p className="text-base-content/70 mb-6">
            {searchTerm ? '尝试调整搜索条件' : '创建您的第一个知识库来开始使用'}
          </p>
          {!searchTerm && (
            <button
              onClick={() => setShowCreateForm(true)}
              className="btn btn-primary"
            >
              创建知识库
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredKnowledgeBases.map((knowledgeBase) => {
            const stats = knowledgeBaseStats.find(s => s.id === knowledgeBase.id);
            return (
              <KnowledgeBaseCard
                key={knowledgeBase.id}
                knowledgeBase={knowledgeBase}
                stats={stats}
                onEdit={handleEdit}
                onView={() => handleViewDetails(knowledgeBase)}
              />
            );
          })}
        </div>
      )}

      {/* 创建/编辑表单 */}
      {(showCreateForm || editingKnowledgeBase) && (
        <KnowledgeBaseForm
          knowledgeBase={editingKnowledgeBase}
          isOpen={showCreateForm || !!editingKnowledgeBase}
          onCancel={handleFormClose}
          onSuccess={handleFormSuccess}
        />
      )}

      {/* 知识条目管理 */}
      {viewingKnowledgeBase && (
        <KnowledgeEntryManager
          knowledgeBase={viewingKnowledgeBase}
          onClose={() => setViewingKnowledgeBase(null)}
          onBulkImport={() => {
            setShowBulkImport(viewingKnowledgeBase);
            setViewingKnowledgeBase(null);
          }}
        />
      )}

      {/* 批量导入 */}
      {showBulkImport && (
        <KnowledgeBulkImport
          knowledgeBase={showBulkImport}
          onCancel={() => setShowBulkImport(null)}
          onSuccess={handleBulkImportSuccess}
        />
      )}

      {/* 删除确认对话框 */}
      <ConfirmDialog
        isOpen={deleteConfirm.isOpen}
        onClose={() => setDeleteConfirm({ isOpen: false, knowledgeBase: null })}
        onConfirm={handleConfirmDelete}
        title="删除知识库"
        message={`确定要删除知识库 "${deleteConfirm.knowledgeBase?.name}" 吗？此操作不可恢复。`}
        confirmText="删除"
        cancelText="取消"
        variant="danger"
      />
    </div>
  );
};

export default KnowledgePage;