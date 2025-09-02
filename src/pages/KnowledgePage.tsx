// 知识库管理页面组件

import React, { useState, useEffect } from 'react';
import { Plus, Search, BookOpen, Upload, FileText, Calendar, Edit, Trash2, Download } from 'lucide-react';
import { useKnowledgeStore } from '../stores/knowledgeStore';
import { KnowledgeBaseForm } from '../components/knowledge/KnowledgeBaseForm';
import { KnowledgeEntryManager } from '../components/knowledge/KnowledgeEntryManager';
import { KnowledgeBulkImport } from '../components/knowledge/KnowledgeBulkImport';
import ConfirmDialog from '../components/ConfirmDialog';
import type { KnowledgeBase } from '../types/knowledge';

interface KnowledgePageProps {
  onCloseModal?: () => void;
}

const KnowledgePage: React.FC<KnowledgePageProps> = ({ onCloseModal }) => {
  const {
    knowledgeBases,
    loading,
    loadKnowledgeBases,
    deleteKnowledgeBase,
    getKnowledgeBaseStats
  } = useKnowledgeStore();

  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [showEntryManager, setShowEntryManager] = useState(false);
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [selectedKnowledgeBase, setSelectedKnowledgeBase] = useState<KnowledgeBase | null>(null);
  const [knowledgeBaseStats, setKnowledgeBaseStats] = useState<Record<string, any>>({});
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; knowledgeBase: KnowledgeBase | null }>({ isOpen: false, knowledgeBase: null });

  useEffect(() => {
    loadKnowledgeBases();
  }, [loadKnowledgeBases]);

  // 获取知识库统计信息
  useEffect(() => {
    const loadStats = async () => {
      const stats: Record<string, any> = {};
      for (const kb of knowledgeBases) {
        try {
          stats[kb.id] = await getKnowledgeBaseStats(kb.id);
        } catch (error) {
          console.error(`获取知识库 ${kb.id} 统计信息失败:`, error);
        }
      }
      setKnowledgeBaseStats(stats);
    };

    if (knowledgeBases.length > 0) {
      loadStats();
    }
  }, [knowledgeBases, getKnowledgeBaseStats]);

  // 过滤知识库
  const filteredKnowledgeBases = knowledgeBases.filter(kb =>
    kb.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (kb.description && kb.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // 处理创建知识库
  const handleCreateKnowledgeBase = () => {
    setSelectedKnowledgeBase(null);
    setShowCreateForm(true);
  };

  // 处理编辑知识库
  const handleEditKnowledgeBase = (knowledgeBase: KnowledgeBase) => {
    setSelectedKnowledgeBase(knowledgeBase);
    setShowEditForm(true);
  };

  // 处理查看知识库详情
  const handleViewKnowledgeBase = (knowledgeBase: KnowledgeBase) => {
    setSelectedKnowledgeBase(knowledgeBase);
    setShowEntryManager(true);
  };

  // 处理批量导入
  const handleBulkImport = (knowledgeBase: KnowledgeBase) => {
    setSelectedKnowledgeBase(knowledgeBase);
    setShowBulkImport(true);
  };

  // 处理删除知识库
  const handleDeleteKnowledgeBase = (knowledgeBase: KnowledgeBase) => {
    setDeleteConfirm({ isOpen: true, knowledgeBase });
  };

  const handleConfirmDelete = async () => {
    if (deleteConfirm.knowledgeBase) {
      try {
        await deleteKnowledgeBase(deleteConfirm.knowledgeBase.id);
      } catch (error) {
        console.error('删除知识库失败:', error);
      }
    }
  };

  const handleCancelDelete = () => {
    setDeleteConfirm({ isOpen: false, knowledgeBase: null });
  };

  // 格式化日期
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  // 关闭所有弹窗
  const closeAllModals = () => {
    setShowCreateForm(false);
    setShowEditForm(false);
    setShowEntryManager(false);
    setShowBulkImport(false);
    setSelectedKnowledgeBase(null);
  };

  return (
    <div 
      className="p-6" 
      data-knowledge-page
      data-is-detail-view={showEntryManager ? 'true' : 'false'}
      data-detail-title={selectedKnowledgeBase?.name || ''}
    >
      {/* 隐藏的返回按钮，供SettingsModal调用 */}
      <button
        data-back-button
        onClick={closeAllModals}
        className="hidden"
        aria-hidden="true"
      />
      {/* 只有在没有显示详情视图时才显示主列表 */}
      {!showEntryManager && (
        <>
          {/* 页面头部 */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h1 className="text-2xl font-bold text-base-content">知识库管理</h1>
                <p className="text-base-content/70 mt-1">管理您的知识库和知识条目</p>
              </div>
              <button
                onClick={handleCreateKnowledgeBase}
                className="btn btn-primary btn-sm gap-2"
              >
                <Plus className="w-4 h-4" />
                新建知识库
              </button>
            </div>

            {/* 搜索框 */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-base-content/50" />
              <input
                type="text"
                placeholder="搜索知识库..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="input input-bordered w-full pl-10"
              />
            </div>
          </div>

          {/* 知识库列表 */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="loading loading-spinner loading-lg"></div>
            </div>
          ) : filteredKnowledgeBases.length === 0 ? (
            <div className="text-center py-12">
              <BookOpen className="w-16 h-16 text-base-content/30 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-base-content mb-2">
                {searchTerm ? '未找到匹配的知识库' : '还没有知识库'}
              </h3>
              <p className="text-base-content/70 mb-4">
                {searchTerm ? '尝试使用其他关键词搜索' : '创建您的第一个知识库来开始使用'}
              </p>
              {!searchTerm && (
                <button
                  onClick={handleCreateKnowledgeBase}
                  className="btn btn-primary gap-2"
                >
                  <Plus className="w-4 h-4" />
                  新建知识库
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredKnowledgeBases.map((knowledgeBase) => {
                const stats = knowledgeBaseStats[knowledgeBase.id];
                return (
                  <div
                    key={knowledgeBase.id}
                    className="card bg-base-100 shadow-sm border border-base-300 hover:shadow-md transition-shadow group"
                  >
                    <div className="card-body">
                      {/* 卡片头部 */}
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                            <BookOpen className="w-5 h-5 text-primary" />
                          </div>
                          <div>
                            <h3 className="card-title text-base">{knowledgeBase.name}</h3>
                            <div className="flex items-center gap-2 text-sm text-base-content/60 mt-1">
                              <Calendar className="w-3 h-3" />
                              <span>{formatDate(knowledgeBase.created_at)}</span>
                            </div>
                          </div>
                        </div>

                        {/* 操作按钮 */}
                        <div className="dropdown dropdown-end opacity-0 group-hover:opacity-100 transition-opacity">
                          <div tabIndex={0} role="button" className="btn btn-ghost btn-sm btn-circle">
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                              <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                            </svg>
                          </div>
                          <ul tabIndex={0} className="dropdown-content menu bg-base-100 rounded-box z-[1] w-52 p-2 shadow border border-base-300">
                            <li>
                              <button onClick={() => handleViewKnowledgeBase(knowledgeBase)}>
                                <FileText className="w-4 h-4" />
                                查看详情
                              </button>
                            </li>
                            <li>
                              <button onClick={() => handleEditKnowledgeBase(knowledgeBase)}>
                                <Edit className="w-4 h-4" />
                                编辑
                              </button>
                            </li>
                            <li>
                              <button onClick={() => handleBulkImport(knowledgeBase)}>
                                <Upload className="w-4 h-4" />
                                批量导入
                              </button>
                            </li>
                            <li>
                              <button 
                                onClick={() => handleDeleteKnowledgeBase(knowledgeBase)}
                                className="text-error"
                              >
                                <Trash2 className="w-4 h-4" />
                                删除
                              </button>
                            </li>
                          </ul>
                        </div>
                      </div>

                      {/* 描述 */}
                      {knowledgeBase.description && (
                        <p className="text-base-content/70 text-sm mb-4 line-clamp-2">
                          {knowledgeBase.description}
                        </p>
                      )}

                      {/* 统计信息 */}
                      <div className="flex items-center gap-4 text-sm text-base-content/60">
                        <div className="flex items-center gap-1">
                          <FileText className="w-3 h-3" />
                          <span>{stats?.entryCount || 0} 个条目</span>
                        </div>
                        {stats?.lastUpdated && (
                          <div className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            <span>更新于 {formatDate(stats.lastUpdated)}</span>
                          </div>
                        )}
                      </div>

                      {/* 操作按钮 */}
                      <div className="card-actions justify-end mt-4">
                        <button
                          onClick={() => handleViewKnowledgeBase(knowledgeBase)}
                          className="btn btn-primary btn-sm"
                        >
                          查看详情
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* 创建知识库表单 */}
      {showCreateForm && (
        <KnowledgeBaseForm
          isOpen={showCreateForm}
          onCancel={closeAllModals}
          onSuccess={closeAllModals}
        />
      )}

      {/* 编辑知识库表单 */}
      {showEditForm && selectedKnowledgeBase && (
        <KnowledgeBaseForm
          knowledgeBase={selectedKnowledgeBase}
          isOpen={showEditForm}
          onCancel={closeAllModals}
          onSuccess={closeAllModals}
        />
      )}

      {/* 知识条目管理器 */}
      {showEntryManager && selectedKnowledgeBase && (
        <KnowledgeEntryManager
          knowledgeBase={selectedKnowledgeBase}
          onClose={closeAllModals}
        />
      )}

      {/* 批量导入 */}
      {showBulkImport && selectedKnowledgeBase && (
        <KnowledgeBulkImport
          knowledgeBase={selectedKnowledgeBase}
          onCancel={closeAllModals}
        />
      )}

      {/* 删除确认对话框 */}
      <ConfirmDialog
        isOpen={deleteConfirm.isOpen}
        onClose={handleCancelDelete}
        onConfirm={handleConfirmDelete}
        title="删除知识库"
        message={`确定要删除知识库「${deleteConfirm.knowledgeBase?.name}」吗？此操作不可恢复。`}
        confirmText="删除"
        cancelText="取消"
        variant="danger"
      />
    </div>
  );
};

export default KnowledgePage;