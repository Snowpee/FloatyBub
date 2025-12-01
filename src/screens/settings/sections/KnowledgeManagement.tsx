// 知识库管理页面

import React, { useEffect, useState } from 'react';
import { Plus, Search, BookOpen, Edit, Trash2, Download, Upload } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { usePageContext } from '../../../hooks/usePageContext';
import { useKnowledgeStore } from '../../../store/knowledgeStore';
import { KnowledgeBaseCard } from '../../../components/knowledge/KnowledgeBaseCard';
import { KnowledgeBaseForm } from '../../../components/knowledge/KnowledgeBaseForm';
import { KnowledgeEntryManager } from '../../../components/knowledge/KnowledgeEntryManager';
import { KnowledgeBulkImport } from '../../../components/knowledge/KnowledgeBulkImport';
import type { KnowledgeBase } from '../../../types/knowledge';

const KnowledgeManagement: React.FC = () => {
  const { className } = usePageContext();
  const {
    knowledgeBases,
    knowledgeBaseStats,
    loading,
    error,
    managementState,
    loadKnowledgeBases,
    loadKnowledgeBaseStats,
    setCurrentKnowledgeBase,
    performAction,
    clearError
  } = useKnowledgeStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedKnowledgeBase, setSelectedKnowledgeBase] = useState<KnowledgeBase | null>(null);

  useEffect(() => {
    loadKnowledgeBases();
    loadKnowledgeBaseStats();
  }, [loadKnowledgeBases, loadKnowledgeBaseStats]);

  const filteredKnowledgeBases = knowledgeBases.filter(kb =>
    kb.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (kb.description && kb.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const handleCreateKnowledgeBase = () => {
    performAction('create_knowledge_base');
  };

  const handleEditKnowledgeBase = (knowledgeBase: KnowledgeBase) => {
    setCurrentKnowledgeBase(knowledgeBase);
    performAction('edit_knowledge_base', { id: knowledgeBase.id });
  };

  const handleViewKnowledgeBase = (knowledgeBase: KnowledgeBase) => {
    setSelectedKnowledgeBase(knowledgeBase);
    setCurrentKnowledgeBase(knowledgeBase);
  };

  const handleBackToList = () => {
    setSelectedKnowledgeBase(null);
    setCurrentKnowledgeBase(null);
  };

  const handleImport = () => {
    performAction('import_entries');
  };

  const handleCancel = () => {
    performAction('cancel');
    setCurrentKnowledgeBase(null);
  };

  if (selectedKnowledgeBase) {
    return (
      <KnowledgeEntryManager
        knowledgeBase={selectedKnowledgeBase}
        onClose={handleBackToList}
      />
    );
  }

  return (
    <div className={cn("min-h-screen p-6", className)}>
      <div className="max-w-7xl mx-auto">
        {/* 页面标题 */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-base-content mb-2">知识库管理</h1>
          <p className="text-base-content/70">创建和管理您的知识库，为角色卡提供专业知识支持</p>
        </div>

        {/* 错误提示 */}
        {error && (
          <div className="alert alert-error mb-6">
            <div className="flex items-center justify-between w-full">
              <p>{error}</p>
              <button
                onClick={clearError}
                className="btn btn-ghost btn-sm"
              >
                ×
              </button>
            </div>
          </div>
        )}

        {/* 操作栏 */}
        <div className="mb-6 flex flex-col sm:flex-row gap-4 justify-between">
          {/* 搜索框 */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-base-content/40 w-5 h-5" />
            <input
              type="text"
              placeholder="搜索知识库..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input input-bordered w-full pl-10"
            />
          </div>

          {/* 操作按钮 */}
          <div className="flex gap-2">
            <button
              onClick={handleImport}
              className="btn btn-outline gap-2"
            >
              <Upload className="w-4 h-4" />
              批量导入
            </button>
            <button
              onClick={handleCreateKnowledgeBase}
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
            <BookOpen className="mx-auto h-12 w-12 text-base-content/40 mb-4" />
            <h3 className="text-lg font-medium text-base-content mb-2">
              {searchQuery ? '未找到匹配的知识库' : '还没有知识库'}
            </h3>
            <p className="text-base-content/70 mb-6">
              {searchQuery ? '尝试调整搜索条件' : '创建您的第一个知识库，开始构建专业知识体系'}
            </p>
            {!searchQuery && (
              <button
                onClick={handleCreateKnowledgeBase}
                className="btn btn-primary gap-2"
              >
                <Plus className="w-4 h-4" />
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
                  onView={() => handleViewKnowledgeBase(knowledgeBase)}
                  onEdit={() => handleEditKnowledgeBase(knowledgeBase)}
                />
              );
            })}
          </div>
        )}

        {/* 创建/编辑知识库表单 */}
        {(managementState.isCreatingKnowledgeBase || managementState.isEditingKnowledgeBase) && (
          <KnowledgeBaseForm 
            isOpen={managementState.isCreatingKnowledgeBase || managementState.isEditingKnowledgeBase}
            onCancel={handleCancel} 
            onSuccess={handleCancel} 
          />
        )}

        {/* 批量导入对话框 */}
        {managementState.isImporting && selectedKnowledgeBase && (
          <KnowledgeBulkImport 
            knowledgeBase={selectedKnowledgeBase}
            onCancel={handleCancel} 
          />
        )}
      </div>
    </div>
  );
};

export default KnowledgeManagement;