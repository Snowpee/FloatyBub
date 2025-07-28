import React, { useState } from 'react';
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
import { toast } from 'sonner';
import EmptyState from '../components/EmptyState';


const GlobalPromptsPage: React.FC = () => {
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
  const [formData, setFormData] = useState<Partial<GlobalPrompt>>({
    title: '',
    prompt: ''
  });

  const handleEdit = (prompt: GlobalPrompt) => {
    setFormData({
      title: prompt.title,
      prompt: prompt.prompt
    });
    setEditingId(prompt.id);
    setIsEditing(true);
  };

  const handleAdd = () => {
    setFormData({
      title: '',
      prompt: ''
    });
    setEditingId(null);
    setIsEditing(true);
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

    setIsEditing(false);
    setEditingId(null);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditingId(null);
  };

  const handleDelete = (id: string) => {
    const prompt = globalPrompts.find(p => p.id === id);
    setConfirmDialog({
      isOpen: true,
      promptId: id,
      promptTitle: prompt?.title || '未知提示词'
    });
  };

  const confirmDelete = () => {
    deleteGlobalPrompt(confirmDialog.promptId);
    toast.success('全局提示词已删除');
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-base-content mb-2">
          全局提示词配置
        </h1>
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
              <div className="card-body">
                {/* 提示词头部 */}
                <div className="flex items-start justify-between mb-4">
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
                  
                  <div className="flex space-x-1">
                    <button
                      onClick={() => handleEdit(prompt)}
                      className="btn btn-ghost btn-sm btn-square"
                    >
                      <Edit className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(prompt.id)}
                      className="btn btn-ghost btn-sm btn-square text-error hover:bg-error/10"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* 提示词内容预览 */}
                <div className="mb-4">
                  <h4 className="text-sm font-medium text-base-content/70 mb-2">
                    提示词内容
                  </h4>
                  <div className="bg-base-200 rounded-md p-3 text-xs text-base-content/60 max-h-32 overflow-y-auto">
                    {prompt.prompt}
                  </div>
                </div>

                {/* 创建时间 */}
                <div className="mt-3 pt-3 border-t border-base-300 text-xs text-base-content/50">
                  创建于 {new Date(prompt.createdAt).toLocaleDateString()}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 编辑/添加模态框 */}
      {isEditing && (
        <div className="modal modal-open">
          <div className="modal-box w-11/12 max-w-2xl">
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

            <div className="space-y-4">
              {/* 标题 */}
              <div>
                <label className="label">
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

              {/* 提示词内容 */}
              <div>
                <label className="label">
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

              {/* 提示词建议 */}
              <div className="alert alert-info">
                <h4 className="text-sm font-medium mb-2">
                  💡 全局提示词编写建议
                </h4>
                <ul className="text-xs space-y-1">
                  <li>• 定义通用的行为准则和价值观</li>
                  <li>• 设置回答的基本格式和风格</li>
                  <li>• 包含安全性和道德约束</li>
                  <li>• 避免过于具体的领域知识，保持通用性</li>
                </ul>
              </div>
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
        </div>
      )}

      {/* 删除确认模态框 */}
      {confirmDialog.isOpen && (
        <div className="modal modal-open">
          <div className="modal-box">
            <h3 className="text-lg font-semibold text-base-content mb-4">
              删除全局提示词
            </h3>
            <p className="text-base-content/70 mb-6">
              确定要删除全局提示词 "{confirmDialog.promptTitle}" 吗？此操作不可撤销，使用该提示词的角色将失去关联。
            </p>
            <div className="modal-action">
              <button
                onClick={() => setConfirmDialog({ isOpen: false, promptId: '', promptTitle: '' })}
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
        </div>
      )}
    </div>
  );
};

export default GlobalPromptsPage;