import React, { useState } from 'react';
import { useAppStore, AIRole } from '../store';
import {
  Plus,
  Edit,
  Trash2,
  Save,
  X
} from 'lucide-react';
import { cn } from '../lib/utils';
import { toast } from 'sonner';
import ConfirmDialog from '../components/ConfirmDialog';
import Avatar from '../components/Avatar';
import AvatarUpload from '../components/AvatarUpload';

const RolesPage: React.FC = () => {
  const {
    aiRoles,
    currentRoleId,
    globalPrompts,
    addAIRole,
    updateAIRole,
    deleteAIRole,
    setCurrentRole
  } = useAppStore();

  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    roleId: string;
    roleName: string;
  }>({ isOpen: false, roleId: '', roleName: '' });
  const [formData, setFormData] = useState<Partial<AIRole>>({
    name: '',
    description: '',
    systemPrompt: '',
    openingMessage: '',
    avatar: '',
    globalPromptId: ''
  });

  // 移除roleIcons，现在使用Avatar组件

  const defaultRoles = [
    'default-assistant',
    'code-expert',
    'creative-writer'
  ];

  const handleEdit = (role: AIRole) => {
    setFormData({
      name: role.name,
      description: role.description,
      systemPrompt: role.systemPrompt,
      openingMessage: role.openingMessage || '',
      avatar: role.avatar,
      globalPromptId: role.globalPromptId || ''
    });
    setEditingId(role.id);
    setIsEditing(true);
  };

  const handleAdd = () => {
    setFormData({
      name: '',
      description: '',
      systemPrompt: '',
      openingMessage: '',
      avatar: undefined,
      globalPromptId: ''
    });
    setEditingId(null);
    setIsEditing(true);
  };

  const handleSave = () => {
    if (!formData.name || !formData.description || !formData.systemPrompt) {
      toast.error('请填写所有必填字段');
      return;
    }

    if (editingId) {
      updateAIRole(editingId, formData);
      toast.success('角色已更新');
    } else {
      addAIRole(formData as Omit<AIRole, 'id' | 'createdAt' | 'updatedAt'>);
      toast.success('角色已添加');
    }

    setIsEditing(false);
    setEditingId(null);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditingId(null);
  };

  const handleDelete = (id: string) => {
    if (defaultRoles.includes(id)) {
      toast.error('默认角色不能删除');
      return;
    }

    const role = aiRoles.find(r => r.id === id);
    setConfirmDialog({
      isOpen: true,
      roleId: id,
      roleName: role?.name || '未知角色'
    });
  };

  const confirmDelete = () => {
    deleteAIRole(confirmDialog.roleId);
    toast.success('角色已删除');
  };

  const handleSetCurrent = (id: string) => {
    setCurrentRole(id);
    toast.success('已切换角色');
  };

  // 移除getIconComponent，现在使用Avatar组件

  const getRoleTypeLabel = (id: string) => {
    if (defaultRoles.includes(id)) {
      return '系统角色';
    }
    return '自定义角色';
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-base-content mb-2">
          角色管理
        </h1>
        <p className="text-base-content/60">
          创建和管理AI角色，定义不同的对话风格和专业领域
        </p>
      </div>

      {/* 添加按钮 */}
      <div className="mb-6">
        <button
          onClick={handleAdd}
          className="btn btn-primary"
        >
          <Plus className="h-4 w-4 mr-2" />
          创建新角色
        </button>
      </div>

      {/* 角色网格 */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {aiRoles.map((role) => {
          const isDefault = defaultRoles.includes(role.id);
          const isCurrent = role.id === currentRoleId;

          return (
            <div
              key={role.id}
              className={cn(
                'card bg-base-100 shadow-sm hover:shadow-md transition-all duration-200'
              )}
            >
              <div className="card-body">
              {/* 角色头部 */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <Avatar
                    name={role.name}
                    avatar={role.avatar}
                    size="lg"
                  />
                  <div>
                    <h3 className="text-lg font-medium text-base-content">
                      {role.name}
                    </h3>
                    <span className={cn(
                      'badge badge-sm badge-outline',
                      isDefault ? 'badge-success' : 'badge-info'
                    )}>
                      {getRoleTypeLabel(role.id)}
                    </span>
                  </div>
                </div>
                
                {!isDefault && (
                  <div className="flex space-x-1">
                    <button
                      onClick={() => handleEdit(role)}
                      className="btn btn-ghost btn-sm"
                    >
                      <Edit className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(role.id)}
                      className="btn btn-ghost btn-sm text-error"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>

              {/* 角色描述 */}
              <div className="mb-4">
                <h4 className="text-sm font-medium text-base-content/70 mb-2">
                  描述
                </h4>
                <p className="text-sm text-base-content/60 line-clamp-2">
                  {role.description}
                </p>
              </div>

              {/* 系统提示词预览 */}
              <div className="mb-4">
                <h4 className="text-sm font-medium text-base-content/70 mb-2">
                  系统提示词
                </h4>
                <div className="bg-base-200 rounded-md p-3 text-xs text-base-content/60 max-h-20 overflow-y-auto">
                  {role.systemPrompt}
                </div>
              </div>

              {/* 创建时间和当前角色toggle */}
              <div className="mt-3 pt-3 border-t border-base-300 flex items-center justify-between">
                <div className="text-xs text-base-content/50">
                  创建于 {new Date(role.createdAt).toLocaleDateString()}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-base-content/60">默认角色</span>
                  <input
                    type="radio"
                    className="radio radio-xs radio-accent"
                    checked={isCurrent}
                    onChange={() => handleSetCurrent(role.id)}
                    disabled={isCurrent}
                  />
                </div>
              </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* 编辑/添加模态框 */}
      {isEditing && (
        <div className="modal modal-open">
          <div className="modal-box w-11/12 max-w-2xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-base-content">
                {editingId ? '编辑角色' : '创建新角色'}
              </h2>
              <button
                onClick={handleCancel}
                className="btn btn-sm btn-circle btn-ghost"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              {/* 角色名称 */}
              <div className="form-control">
                <label className="label">
                  <span className="label-text">角色名称 *</span>
                </label>
                <input
                  type="text"
                  value={formData.name || ''}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="input input-bordered w-full"
                  placeholder="例如: 编程助手"
                />
              </div>

              {/* 角色描述 */}
              <div className="form-control">
                <label className="label">
                  <span className="label-text">角色描述 *</span>
                </label>
                <textarea
                  value={formData.description || ''}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                  className="textarea textarea-bordered w-full"
                  placeholder="简要描述这个角色的特点和用途"
                />
              </div>

              {/* 角色头像上传 */}
              <div className="form-control">
                <label className="label">
                  <span className="label-text">角色头像</span>
                </label>
                <AvatarUpload
                  name={formData.name || '新角色'}
                  currentAvatar={formData.avatar}
                  onAvatarChange={(avatar) => setFormData({ ...formData, avatar })}
                  className="self-center"
                />
              </div>

              {/* 全局提示词选择 */}
              <div className="form-control">
                <label className="label">
                  <span className="label-text">全局提示词（可选）</span>
                </label>
                <select
                  value={formData.globalPromptId || ''}
                  onChange={(e) => setFormData({ ...formData, globalPromptId: e.target.value })}
                  className="select select-bordered w-full"
                >
                  <option value="">不使用全局提示词</option>
                  {globalPrompts.map((prompt) => (
                    <option key={prompt.id} value={prompt.id}>
                      {prompt.title}
                    </option>
                  ))}
                </select>
                {formData.globalPromptId && (
                  <label className="label">
                    <span className="label-text-alt text-info">
                      已选择全局提示词，保存后将在对话时自动应用
                    </span>
                  </label>
                )}
              </div>

              {/* 系统提示词 */}
              <div className="form-control">
                <label className="label">
                  <span className="label-text">系统提示词 *</span>
                </label>
                <textarea
                  value={formData.systemPrompt || ''}
                  onChange={(e) => setFormData({ ...formData, systemPrompt: e.target.value })}
                  rows={6}
                  className="textarea textarea-bordered w-full"
                  placeholder="定义AI的角色、行为方式和回答风格。例如：你是一个专业的编程助手，擅长多种编程语言..."
                />
              </div>

              {/* 开场白 */}
              <div className="form-control">
                <label className="label">
                  <span className="label-text">开场白（可选）</span>
                </label>
                <textarea
                  value={formData.openingMessage || ''}
                  onChange={(e) => setFormData({ ...formData, openingMessage: e.target.value })}
                  rows={3}
                  className="textarea textarea-bordered w-full"
                  placeholder="设置角色的开场白，将作为对话的第一句话显示。例如：你好！我是你的编程助手，有什么编程问题需要帮助吗？"
                />
                <label className="label">
                  <span className="label-text-alt text-base-content/60">
                    开场白将在新对话开始时自动显示
                  </span>
                </label>
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
            <div className="flex items-center mb-4">
              <Trash2 className="h-6 w-6 text-error mr-3" />
              <h3 className="text-lg font-semibold text-base-content">
                删除角色
              </h3>
            </div>
            <p className="text-base-content/70 mb-6">
              确定要删除角色 "{confirmDialog.roleName}" 吗？此操作不可撤销。
            </p>
            <div className="modal-action">
              <button
                onClick={() => setConfirmDialog({ isOpen: false, roleId: '', roleName: '' })}
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

export default RolesPage;