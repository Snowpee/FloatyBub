import React, { useState, useRef, useEffect } from 'react';
import { useAppStore, AIRole } from '../store';
import {
  Plus,
  Edit,
  Trash2,
  Save,
  X
} from 'lucide-react';
import { cn } from '../lib/utils';
import { toast } from '../hooks/useToast';
import ConfirmDialog from '../components/ConfirmDialog';
import Avatar from '../components/Avatar';
import RoleAvatarUpload from '../components/RoleAvatarUpload';
import { generateAvatar, generateRandomLocalAvatar } from '../utils/avatarUtils';

interface RolesPageProps {
  onCloseModal?: () => void;
}

const RolesPage: React.FC<RolesPageProps> = ({ onCloseModal }) => {
  const {
    aiRoles,
    globalPrompts,
    addAIRole,
    updateAIRole,
    deleteAIRole
  } = useAppStore();

  const [isEditing, setIsEditing] = useState(false);
  const modalRef = useRef<HTMLDialogElement>(null);
  const confirmDialogRef = useRef<HTMLDialogElement>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    roleId: string;
    roleName: string;
  }>({ isOpen: false, roleId: '', roleName: '' });
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    systemPrompt: '',
    openingMessages: [''],
    currentOpeningIndex: 0,
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
      openingMessages: role.openingMessages || [''],
      currentOpeningIndex: role.currentOpeningIndex || 0,
      avatar: role.avatar,
      globalPromptId: role.globalPromptId || ''
    });
    setEditingId(role.id);
    setIsEditing(true);
    modalRef.current?.showModal();
  };

  const handleAdd = () => {
    // 生成随机头像
    const generateRandomAvatar = () => {
      return generateRandomLocalAvatar();
    };
    
    setFormData({
      name: '',
      description: '',
      systemPrompt: '',
      openingMessages: [''],
      currentOpeningIndex: 0,
      avatar: generateRandomAvatar(),
      globalPromptId: ''
    });
    setEditingId(null);
    setIsEditing(true);
    modalRef.current?.showModal();
  };

  const handleSave = () => {
    if (!formData.name?.trim()) {
      toast.error('请输入角色名称');
      return;
    }

    // 过滤空的开场白
    const filteredOpeningMessages = formData.openingMessages.filter(msg => msg.trim() !== '');
    if (filteredOpeningMessages.length === 0) {
      filteredOpeningMessages.push(''); // 至少保留一个空的开场白
    }

    const roleData = {
      ...formData,
      openingMessages: filteredOpeningMessages,
      currentOpeningIndex: Math.min(formData.currentOpeningIndex, filteredOpeningMessages.length - 1)
    };

    if (editingId) {
      updateAIRole(editingId, roleData);
      toast.success('角色更新成功');
    } else {
      addAIRole(roleData as Omit<AIRole, 'id' | 'createdAt' | 'updatedAt'>);
      toast.success('角色创建成功');
    }

    modalRef.current?.close();
    setIsEditing(false);
    setEditingId(null);
  };

  const handleCancel = () => {
    modalRef.current?.close();
  };

  // 监听 dialog 关闭事件，重置状态
  useEffect(() => {
    const dialog = modalRef.current;
    if (dialog) {
      const handleClose = () => {
        setIsEditing(false);
        setEditingId(null);
        setFormData({
          name: '',
          description: '',
          systemPrompt: '',
          openingMessages: [''],
          currentOpeningIndex: 0,
          avatar: '',
          globalPromptId: ''
        });
      };
      
      dialog.addEventListener('close', handleClose);
      return () => dialog.removeEventListener('close', handleClose);
    }
  }, []);

  // 开场白管理函数
  const addOpeningMessage = () => {
    setFormData(prev => ({
      ...prev,
      openingMessages: [...prev.openingMessages, '']
    }));
  };

  const removeOpeningMessage = (index: number) => {
    if (formData.openingMessages.length <= 1) {
      toast.error('至少需要保留一个开场白');
      return;
    }
    setFormData(prev => ({
      ...prev,
      openingMessages: prev.openingMessages.filter((_, i) => i !== index),
      currentOpeningIndex: Math.min(prev.currentOpeningIndex, prev.openingMessages.length - 2)
    }));
  };

  const updateOpeningMessage = (index: number, value: string) => {
    setFormData(prev => ({
      ...prev,
      openingMessages: prev.openingMessages.map((msg, i) => i === index ? value : msg)
    }));
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
    confirmDialogRef.current?.showModal();
  };

  const confirmDelete = () => {
    deleteAIRole(confirmDialog.roleId);
    toast.success('角色已删除');
    confirmDialogRef.current?.close();
  };

  const handleCancelDelete = () => {
    confirmDialogRef.current?.close();
  };

  // 监听删除确认 dialog 关闭事件
  useEffect(() => {
    const dialog = confirmDialogRef.current;
    if (dialog) {
      const handleClose = () => {
        setConfirmDialog({ isOpen: false, roleId: '', roleName: '' });
      };
      
      dialog.addEventListener('close', handleClose);
      return () => dialog.removeEventListener('close', handleClose);
    }
  }, []);



  // 移除getIconComponent，现在使用Avatar组件

  const getRoleTypeLabel = (id: string) => {
    if (defaultRoles.includes(id)) {
      return '系统角色';
    }
    return '自定义角色';
  };

  return (
    <div className="max-w-6xl mx-auto p-6 md:pt-0">
      <div className="mb-6">
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
      <div className="grid gap-6 md:grid-cols-2">
        {aiRoles.map((role) => {
          const isDefault = defaultRoles.includes(role.id);

          return (
            <div
              key={role.id}
              className={cn(
                'card bg-base-100 shadow-sm hover:shadow-md transition-all duration-200'
              )}
            >
              <div className="card-body pb-4 group">
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
                

              </div>

              {/* 角色描述 */}
              <div className="mb-4">
                <p className="text-sm text-base-content/60 line-clamp-2 overflow-hidden text-ellipsis">
                  {role.description}
                </p>
              </div>
              <div className="text-xs text-base-content/50 mt-auto">
                创建于 {new Date(role.createdAt).toLocaleDateString()}
              </div>
              {/* 创建时间和当前角色toggle */}
              <div className="mt-auto pt-3 border-t border-base-300 flex items-center justify-between">
                <div className="flex space-x-1">
                  <button
                    onClick={() => handleEdit(role)}
                    className="btn btn-sm"
                  >
                    <Edit className="h-4 w-4" />
                  </button>
                  {!isDefault && (
                    <button
                      onClick={() => handleDelete(role.id)}
                      className="btn btn-circle btn-sm text-error ml-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>

              </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* 编辑/添加模态框 */}
      <dialog ref={modalRef} className="modal">
        <div className="modal-box max-w-2xl w-full">
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

            <div className="space-y-6">
              {/* 基本信息 */}
              <fieldset className="fieldset bg-base-200 border-base-300 rounded-box border p-4">
                <legend className="fieldset-legend">基本信息</legend>
                
                <label className="label">角色头像</label>
                <RoleAvatarUpload
                  name={formData.name || '新角色'}
                  currentAvatar={formData.avatar}
                  onAvatarChange={(avatar) => setFormData({ ...formData, avatar })}
                  className="self-center"
                />

                <label className="label">角色名称 *</label>
                <input
                  type="text"
                  value={formData.name || ''}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="input input-bordered w-full"
                  placeholder="例如: 编程助手"
                />
                
                <label className="label">角色描述 *</label>
                <textarea
                  value={formData.description || ''}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                  className="textarea textarea-bordered w-full"
                  placeholder="简要描述这个角色的特点和用途"
                />
              </fieldset>

              {/* 提示词配置 */}
              <fieldset className="fieldset bg-base-200 border-base-300 rounded-box border p-4">
                <legend className="fieldset-legend">提示词配置</legend>
                
                <label className="label">全局提示词（可选）</label>
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
                  <p className="label text-info text-sm mt-1">
                    已选择全局提示词，保存后将在对话时自动应用
                  </p>
                )}
                
                <label className="label mt-4">系统提示词 *</label>
                <textarea
                  value={formData.systemPrompt || ''}
                  onChange={(e) => setFormData({ ...formData, systemPrompt: e.target.value })}
                  rows={6}
                  className="textarea textarea-bordered w-full"
                  placeholder="定义AI的角色、行为方式和回答风格。例如：你是一个专业的编程助手，擅长多种编程语言..."
                />
              </fieldset>

              {/* 开场白设置 */}
              <fieldset className="fieldset bg-base-200 border-base-300 rounded-box border p-4">
                <legend className="fieldset-legend">开场白设置</legend>
                
                <label className="label">开场白（可选）</label>
                <div className="space-y-3">
                  {formData.openingMessages.map((message, index) => (
                    <div key={index} className="flex gap-2">
                      <textarea
                        value={message}
                        onChange={(e) => updateOpeningMessage(index, e.target.value)}
                        rows={3}
                        className="textarea textarea-bordered flex-1"
                        placeholder={`开场白 ${index + 1}：设置角色的开场白，将作为对话的第一句话显示`}
                      />
                      {formData.openingMessages.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeOpeningMessage(index)}
                          className="btn btn-ghost btn-sm text-error hover:bg-error/10"
                          title="删除此开场白"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={addOpeningMessage}
                    className="btn btn-outline btn-sm w-full"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    新增更多开场白
                  </button>
                </div>
                <p className="label text-base-content/60 text-sm mt-2 whitespace-normal">
                  开场白将在新对话开始时以翻页方式显示，用户可以选择喜欢的开场白
                </p>
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
      <dialog ref={confirmDialogRef} className="modal">
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
                onClick={handleCancelDelete}
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

export default RolesPage;