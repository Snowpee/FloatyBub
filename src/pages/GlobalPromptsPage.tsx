import React, { useState, useRef, useEffect } from 'react';
import { useAppStore, GlobalPrompt } from '../store';
import {
  Plus,
  Edit,
  Trash2,
  Save,
  X,
  FileText
} from 'lucide-react';
import { cn } from '../lib/utils';
import { toast } from '../hooks/useToast';
import EmptyState from '../components/EmptyState';
import ConfirmDialog from '../components/ConfirmDialog';


interface GlobalPromptsPageProps {
  onCloseModal?: () => void;
  className?: string;
}

const GlobalPromptsPage: React.FC<GlobalPromptsPageProps> = ({ onCloseModal, className }) => {
  const {
    globalPrompts,
    addGlobalPrompt,
    updateGlobalPrompt,
    deleteGlobalPrompt
  } = useAppStore();

  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    promptId: string;
    promptTitle: string;
  }>({ isOpen: false, promptId: '', promptTitle: '' });
  
  const modalRef = useRef<HTMLDialogElement>(null);
  const [formData, setFormData] = useState<Partial<GlobalPrompt>>({
    title: '',
    description: '',
    prompt: ''
  });

  const handleEdit = (prompt: GlobalPrompt) => {
    setFormData({
      title: prompt.title,
      description: prompt.description || '',
      prompt: prompt.prompt
    });
    setEditingId(prompt.id);
    setIsEditing(true);
    modalRef.current?.showModal();
  };

  const handleAdd = () => {
    setFormData({
      title: '',
      description: '',
      prompt: ''
    });
    setEditingId(null);
    setIsEditing(true);
    modalRef.current?.showModal();
  };

  const handleSave = () => {
    if (!formData.title || !formData.prompt) {
      toast.error('请填写所有必填字段');
      return;
    }

    if (editingId) {
      updateGlobalPrompt(editingId, formData);
      toast.success('全局提示词已更新');
    } else {
      addGlobalPrompt(formData as Omit<GlobalPrompt, 'id' | 'createdAt' | 'updatedAt'>);
      toast.success('全局提示词已添加');
    }

    modalRef.current?.close();
  };

  useEffect(() => {
    const modal = modalRef.current;
    
    const handleModalClose = () => {
      setIsEditing(false);
      setEditingId(null);
    };
    
    
    if (modal) {
      modal.addEventListener('close', handleModalClose);
    }
    
    
    return () => {
      if (modal) {
        modal.removeEventListener('close', handleModalClose);
      }
      // 无需处理删除确认模态的 close 事件，交由 ConfirmDialog 的 onClose 控制
    };
  }, []);

  const handleCancel = () => {
    modalRef.current?.close();
  };

  const handleDelete = (id: string) => {
    const prompt = globalPrompts.find(p => p.id === id);
    setConfirmDialog({
      isOpen: true,
      promptId: id,
      promptTitle: prompt?.title || '未知提示词'
    });
  };

  const confirmDelete = async () => {
    try {
      await deleteGlobalPrompt(confirmDialog.promptId);
      toast.success('全局提示词已删除');
      setConfirmDialog({ isOpen: false, promptId: '', promptTitle: '' });
    } catch (error) {
      console.error('删除全局提示词失败:', error);
      toast.error(error instanceof Error ? error.message : '删除全局提示词失败');
    }
  };

  const handleConfirmCancel = () => {
    setConfirmDialog({ isOpen: false, promptId: '', promptTitle: '' });
  };

  return (
    <div className={cn("p-6 max-w-6xl mx-auto md:pt-0", className)}>
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <p className="text-base-content/70">
            管理可在角色中复用的全局提示词模板
          </p>
        </div>
        <button
          onClick={handleAdd}
          className="btn btn-outline-light md:btn-primary w-full md:w-auto"
        >
          <Plus className="h-4 w-4 mr-2" />
          添加全局提示词
        </button>
      </div>

      {/* 提示词列表 */}
      {globalPrompts.length === 0 ? (
        <EmptyState message="点击上方按钮创建您的第一个全局提示词" />
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-2">
          {globalPrompts.map((prompt) => (
            <div key={prompt.id} className="card bg-base-100 shadow-sm">
              <div className="card-body flex flex-col justify-between h-full pb-4 group">
                {/* 提示词头部 */}
                <div className="flex items-start justify-between mb-0">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <FileText className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="card-title text-base-content">
                        {prompt.title}
                      </h3>
                    </div>
                  </div>
                  
                </div>

                {/* 描述信息 */}
                {prompt.description && (
                  <div className="mb-4">
                    <p className="text-sm text-base-content/70 line-clamp-2">
                      {prompt.description}
                    </p>
                  </div>
                )}

                {/* 创建时间和按钮组 */}
                <div className="mt-auto">
                  <div className="mt-3 pt-3 border-t border-base-300 text-xs text-base-content/50 mb-3">
                    创建于 {new Date(prompt.createdAt).toLocaleDateString()}
                  </div>
                  <div className="flex space-x-1">
                  <button
                    onClick={() => handleEdit(prompt)}
                    className="btn btn-sm"
                  >
                    <Edit className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(prompt.id)}
                    className="btn btn-circle btn-sm text-error hover:bg-error/10 ml-2 md:opacity-0 group-hover:opacity-100 transition-opacity duration-200"
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

      {/* 编辑/添加模态框 */}
      <dialog ref={modalRef} className="modal">
        <div className="modal-box max-w-2xl w-full">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-base-content">
                {editingId ? '编辑全局提示词' : '创建全局提示词'}
              </h2>
              <button
                onClick={handleCancel}
                className="btn btn-sm btn-circle btn-ghost"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-2">
              {/* 基本信息 */}
              <fieldset className="fieldset bg-base-200 border-base-300 rounded-box border p-4">
                <legend className="fieldset-legend">提示词 *</legend>
                
                {/* 标题 */}
                <label className="input w-full mb-1">
                  <span className="label">标题</span>
                  <input
                    type="text"
                    value={formData.title || ''}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className=""
                    placeholder="例如: 专业编程助手提示词"
                  />
                </label>
                <textarea
                  value={formData.prompt || ''}
                  onChange={(e) => setFormData({ ...formData, prompt: e.target.value })}
                  rows={8}
                  className="textarea textarea-bordered w-full"
                  placeholder="输入全局提示词内容，这将作为系统级别的指导原则..."
                />
                <span className="label-text">定义全局提示词内容，可在角色中复用</span>
              </fieldset>

              {/* 提示词配置 */}
              <fieldset className="fieldset bg-base-200 border-base-300 rounded-box border p-4">
                <legend className="fieldset-legend">备注</legend>
                
                {/* 描述 */}
                <input
                  type="text"
                  value={formData.description || ''}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="input input-bordered w-full mb-1"
                  placeholder="简要描述该提示词的用途和特点"
                />

              </fieldset>
            </div>

            <div className="modal-action">
              <button
                onClick={handleCancel}
                className="btn btn-ghost"
              >
                取消
              </button>
              <button
                onClick={handleSave}
                className="btn btn-primary"
              >
                <Save className="h-4 w-4 mr-2" />
                保存
              </button>
            </div>
        </div>
        <form method="dialog" className="modal-backdrop">
          <button>close</button>
        </form>
      </dialog>

      {/* 删除确认弹窗（统一使用 ConfirmDialog） */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        onClose={() => setConfirmDialog({ isOpen: false, promptId: '', promptTitle: '' })}
        onConfirm={confirmDelete}
        title="删除全局提示词"
        message={`确定要删除全局提示词 "${confirmDialog.promptTitle}" 吗？此操作不可撤销，使用该提示词的角色将失去关联。`}
        confirmText="删除"
        cancelText="取消"
        variant="danger"
      />
    </div>
  );
};

export default GlobalPromptsPage;
