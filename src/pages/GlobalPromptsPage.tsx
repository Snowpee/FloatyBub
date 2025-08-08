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


interface GlobalPromptsPageProps {
  onCloseModal?: () => void;
}

const GlobalPromptsPage: React.FC<GlobalPromptsPageProps> = ({ onCloseModal }) => {
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
  const confirmModalRef = useRef<HTMLDialogElement>(null);
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
    const confirmModal = confirmModalRef.current;
    
    const handleModalClose = () => {
      setIsEditing(false);
      setEditingId(null);
    };
    
    const handleConfirmModalClose = () => {
      setConfirmDialog({ isOpen: false, promptId: '', promptTitle: '' });
    };
    
    if (modal) {
      modal.addEventListener('close', handleModalClose);
    }
    
    if (confirmModal) {
      confirmModal.addEventListener('close', handleConfirmModalClose);
    }
    
    return () => {
      if (modal) {
        modal.removeEventListener('close', handleModalClose);
      }
      if (confirmModal) {
        confirmModal.removeEventListener('close', handleConfirmModalClose);
      }
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
    confirmModalRef.current?.showModal();
  };

  const confirmDelete = async () => {
    try {
      await deleteGlobalPrompt(confirmDialog.promptId);
      toast.success('全局提示词已删除');
      confirmModalRef.current?.close();
    } catch (error) {
      console.error('删除全局提示词失败:', error);
      toast.error(error instanceof Error ? error.message : '删除全局提示词失败');
    }
  };

  const handleConfirmCancel = () => {
    setConfirmDialog({ isOpen: false, promptId: '', promptTitle: '' });
    confirmModalRef.current?.close();
  };

  return (
    <div className="p-6 max-w-6xl mx-auto md:pt-0">
      <div className="mb-6">
        <p className="text-base-content/70">
          管理可在角色中复用的全局提示词模板
        </p>
      </div>

      <div className="mb-6">
        <button
          onClick={handleAdd}
          className="btn btn-primary"
        >
          <Plus className="h-4 w-4 mr-2" />
          创建新提示词
        </button>
      </div>

      {/* 提示词列表 */}
      {globalPrompts.length === 0 ? (
        <EmptyState message="点击上方按钮创建您的第一个全局提示词" />
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
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

            <div>
              {/* 基本信息 */}
              <fieldset className="fieldset">
                
                <div>
                  {/* 标题 */}
                  <div className="form-control">
                    <label className="label mb-1">
                      <span className="label-text">标题 *</span>
                    </label>
                    <input
                      type="text"
                      value={formData.title || ''}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      className="input input-bordered w-full"
                      placeholder="例如: 专业编程助手提示词"
                    />
                  </div>

                  {/* 描述 */}
                  <div className="form-control">
                    <label className="label mb-1">
                      <span className="label-text">描述</span>
                    </label>
                    <input
                      type="text"
                      value={formData.description || ''}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      className="input input-bordered w-full"
                      placeholder="简要描述该提示词的用途和特点"
                    />
                  </div>
                </div>
              </fieldset>

              {/* 提示词配置 */}
              <fieldset className="fieldset">

                <div>
                  {/* 提示词内容 */}
                  <div className="form-control">
                    <label className="label mb-1">
                      <span className="label-text">提示词内容 *</span>
                    </label>
                    <textarea
                      value={formData.prompt || ''}
                      onChange={(e) => setFormData({ ...formData, prompt: e.target.value })}
                      rows={8}
                      className="textarea textarea-bordered w-full"
                      placeholder="输入全局提示词内容，这将作为系统级别的指导原则..."
                    />
                  </div>
                </div>
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

      {/* 删除确认模态框 */}
      <dialog ref={confirmModalRef} className="modal">
        <div className="modal-box">
            <h3 className="text-lg font-semibold text-base-content mb-4">
              删除全局提示词
            </h3>
            <p className="text-base-content/70 mb-6">
              确定要删除全局提示词 "{confirmDialog.promptTitle}" 吗？此操作不可撤销，使用该提示词的角色将失去关联。
            </p>
            <div className="modal-action">
              <button
                onClick={handleConfirmCancel}
                className="btn btn-ghost"
              >
                取消
              </button>
              <button
                onClick={confirmDelete}
                className="btn btn-error"
              >
                删除
              </button>
            </div>
        </div>
        <form method="dialog" className="modal-backdrop">
          <button>close</button>
        </form>
      </dialog>
    </div>
  );
};

export default GlobalPromptsPage;