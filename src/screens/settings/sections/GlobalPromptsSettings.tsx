import React, { useState } from 'react';
import { useAppStore, GlobalPrompt } from '@/store';
import {
  Plus,
  Edit,
  Trash2,
  FileText,
  MoreVertical
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/useToast';
import EmptyState from '@/components/EmptyState';
import ConfirmDialog from '@/components/ConfirmDialog';
import GlobalPromptsModal, { GlobalPromptFormData } from './GlobalPromptsModal';


interface GlobalPromptsSettingsProps {
  onCloseModal?: () => void;
  className?: string;
}

const GlobalPromptsSettings: React.FC<GlobalPromptsSettingsProps> = ({ onCloseModal, className }) => {
  const {
    globalPrompts,
    addGlobalPrompt,
    updateGlobalPrompt,
    deleteGlobalPrompt
  } = useAppStore();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPrompt, setEditingPrompt] = useState<GlobalPrompt | null>(null);

  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    promptId: string;
    promptTitle: string;
  }>({ isOpen: false, promptId: '', promptTitle: '' });
  
  const handleEdit = (prompt: GlobalPrompt) => {
    setEditingPrompt(prompt);
    setIsModalOpen(true);
  };

  const handleAdd = () => {
    setEditingPrompt(null);
    setIsModalOpen(true);
  };

  const handleModalConfirm = async (data: GlobalPromptFormData) => {
    try {
      if (editingPrompt) {
        updateGlobalPrompt(editingPrompt.id, data);
        toast.success('全局提示词已更新');
      } else {
        addGlobalPrompt(data as any);
        toast.success('全局提示词已添加');
      }
      setIsModalOpen(false);
    } catch (error) {
      console.error('保存全局提示词失败:', error);
      toast.error('保存全局提示词失败');
    }
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
    <div className={cn("p-4 md:p-6 md:pt-0 max-w-6xl mx-auto", className)}>
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
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
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-2">
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
                  <div className="dropdown dropdown-end">
                    <label tabIndex={0} className="btn btn-sm btn-ghost">
                      <MoreVertical className="h-4 w-4" />
                    </label>
                    <ul tabIndex={0} className="dropdown-content menu p-2 shadow bg-base-100 rounded-box w-44">
                      <li>
                        <a onClick={() => handleEdit(prompt)} className="gap-3">
                          <Edit className="h-4 w-4" />
                          编辑
                        </a>
                      </li>
                      <li>
                        <a onClick={() => handleDelete(prompt.id)} className="text-error">
                          <Trash2 className="h-4 w-4" />
                          删除
                        </a>
                      </li>
                    </ul>
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

                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 编辑/添加模态框 */}
      <GlobalPromptsModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onConfirm={handleModalConfirm}
        initialPrompt={editingPrompt}
      />

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

export default GlobalPromptsSettings;
