import React, { useState, useRef, useEffect } from 'react';
import { useAppStore, UserProfile } from '../store';
import {
  Plus,
  Edit,
  Trash2,
  Save,
  X,
  User,
  CheckCircle
} from 'lucide-react';
import { cn } from '../lib/utils';
import { toast } from '../hooks/useToast';
import ConfirmDialog from '../components/ConfirmDialog';
import EmptyState from '../components/EmptyState';
import { generateAvatar, generateRandomLocalAvatar } from '../utils/avatarUtils';
// 生成随机头像
const generateRandomAvatar = () => {
  return generateRandomLocalAvatar();
};

interface UserProfilesPageProps {
  onCloseModal?: () => void;
}

const UserProfilesPage: React.FC<UserProfilesPageProps> = ({ onCloseModal }) => {
  const {
    userProfiles,
    currentUserProfile,
    addUserProfile,
    updateUserProfile,
    deleteUserProfile,
    setCurrentUserProfile
  } = useAppStore();

  const [isEditing, setIsEditing] = useState(false);
  const modalRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = modalRef.current;
    if (dialog) {
      const handleClose = () => {
        setIsEditing(false);
        setEditingId(null);
      };
      dialog.addEventListener('close', handleClose);
      return () => dialog.removeEventListener('close', handleClose);
    }
  }, []);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    profileId: string;
    profileName: string;
  }>({ isOpen: false, profileId: '', profileName: '' });

  const [formData, setFormData] = useState<{
    name: string;
    description: string;
    avatar: string;
  }>({ name: '', description: '', avatar: '' });

  const handleAdd = () => {
    const newAvatar = generateRandomAvatar();
    setFormData({ name: '', description: '', avatar: newAvatar });
    setIsEditing(true);
    setEditingId(null);
    modalRef.current?.showModal();
  };

  const handleEdit = (profile: UserProfile) => {
    setFormData({
      name: profile.name,
      description: profile.description,
      avatar: profile.avatar
    });
    setIsEditing(true);
    setEditingId(profile.id);
    modalRef.current?.showModal();
  };

  const handleSave = () => {
    if (!formData.name.trim()) {
      toast.error('请输入用户名');
      return;
    }

    try {
      if (editingId) {
        updateUserProfile(editingId, {
          name: formData.name.trim(),
          description: formData.description.trim(),
          avatar: formData.avatar
        });
        toast.success('用户资料已更新');
      } else {
        addUserProfile({
          name: formData.name.trim(),
          description: formData.description.trim(),
          avatar: formData.avatar
        });
        toast.success('用户资料已添加');
      }
      modalRef.current?.close();
    } catch (error) {
      console.error('保存用户资料失败:', error);
      toast.error('保存用户资料失败');
    }
  };

  const handleCancel = () => {
    modalRef.current?.close();
  };

  const handleDelete = (id: string) => {
    const profile = userProfiles.find(p => p.id === id);
    setConfirmDialog({
      isOpen: true,
      profileId: id,
      profileName: profile?.name || '未知用户'
    });
  };

  const confirmDelete = async () => {
    try {
      await deleteUserProfile(confirmDialog.profileId);
      toast.success('用户资料已删除');
    } catch (error) {
      console.error('删除用户资料失败:', error);
      toast.error(error instanceof Error ? error.message : '删除用户资料失败');
    }
  };

  const handleSetCurrent = (profile: UserProfile) => {
    setCurrentUserProfile(profile);
    toast.success(`已切换到用户：${profile.name}`);
  };

  const generateNewAvatar = () => {
    setFormData({ ...formData, avatar: generateRandomAvatar() });
  };

  return (
    <div className="max-w-6xl mx-auto p-6 md:pt-0">
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-base-content/60 mt-1">管理用户资料，在对话时传递给AI</p>
        </div>
        <button
          onClick={handleAdd}
          className="btn btn-primary btn-sm"
        >
          <Plus className="h-4 w-4" />
          添加用户资料
        </button>
      </div>

      {/* 当前用户显示 */}
      {currentUserProfile && (
        <div className="hero-list p-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="avatar">
              <div className="w-10 h-10 rounded-full">
                <img src={currentUserProfile.avatar} alt={currentUserProfile.name} />
              </div>
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h3 className="font-medium text-base-content">{currentUserProfile.name}</h3>
                <div className="badge badge-outline badge-primary">当前角色</div>
              </div>
              
              {currentUserProfile.description && (
                <p className="text-sm text-base-content/60 mt-1">{currentUserProfile.description}</p>
              )}
            </div>
            <button
              onClick={() => setCurrentUserProfile(null)}
              className="btn btn-ghost btn-sm"
            >
              取消设置
            </button>
          </div>
        </div>
      )}
             
      {/* 用户资料列表 */}
      {userProfiles.length > 0 && (
        <p className="text-base-content mb-4">用户资料列表</p>
      )}
      {userProfiles.length === 0 ? (
        <EmptyState message="暂无用户资料，点击上方按钮添加第一个用户资料" />
      ) : (
        <div className="grid gap-4">
          {userProfiles.map((profile) => (
            <div
              key={profile.id}
              className={cn(
                "hero-list",
                currentUserProfile?.id === profile.id
                  ? "border-primary"
                  : "border-base-300 hover:border-base-400"
              )}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3 flex-1">
                  <div className="avatar">
                    <div className="w-12 h-12 rounded-full">
                      <img src={profile.avatar} alt={profile.name} />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-base-content truncate">{profile.name}</h3>
                      {currentUserProfile?.id === profile.id && (
                        <CheckCircle className="h-4 w-4 text-primary flex-shrink-0" />
                      )}
                    </div>
                    {profile.description && (
                      <p className="text-sm text-base-content/60 mt-1 line-clamp-2">{profile.description}</p>
                    )}
                    <p className="text-xs text-base-content/40 mt-2">
                      创建于 {new Date(profile.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1 ml-4">
                  {currentUserProfile?.id !== profile.id && (
                    <button
                      onClick={() => handleSetCurrent(profile)}
                      className="btn btn-ghost btn-sm"
                      title="设为当前角色"
                    >
                      <User className="h-4 w-4" />
                    </button>
                  )}
                  <button
                    onClick={() => handleEdit(profile)}
                    className="btn btn-ghost btn-sm"
                    title="编辑"
                  >
                    <Edit className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(profile.id)}
                    className="btn btn-ghost btn-sm text-error hover:bg-error/10"
                    title="删除"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 编辑对话框 */}
      <dialog ref={modalRef} className="modal">
        <div className="modal-box max-w-2xl w-full">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-base-content">
                {editingId ? '编辑用户资料' : '添加用户资料'}
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
                <legend className="fieldset-legend">基本信息</legend>
                
                {/* 头像 */}
                <div className="flex items-center gap-3 mb-4">
                  <div className="avatar">
                    <div className="w-16 h-16 rounded-full">
                      <img src={formData.avatar} alt="头像预览" />
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={generateNewAvatar}
                    className="btn btn-outline btn-sm border-base-300 bg-base-100 hover:bg-base-200"
                  >
                    随机生成
                  </button>
                </div>

                <label className="input w-full mb-1">
                  <span className="label">昵称 *</span>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className=""
                    placeholder="你希望 AI 如何称呼你？"
                    maxLength={50}
                  />
                </label>
                
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                  className="textarea textarea-bordered w-full mb-1"
                  placeholder="用户简介，简要描述用户的特点和背景（可选）"
                  maxLength={500}
                />
                <span className="label-text">用户简介将在对话时传递给AI，帮助AI更好地理解用户背景</span>
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
                disabled={!formData.name.trim()}
              >
                <Save className="h-4 w-4" />
                保存
              </button>
            </div>
        </div>
        <form method="dialog" className="modal-backdrop">
          <button>close</button>
        </form>
      </dialog>

      {/* 删除确认对话框 */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        onClose={() => setConfirmDialog({ isOpen: false, profileId: '', profileName: '' })}
        onConfirm={confirmDelete}
        title="删除用户资料"
        message={`确定要删除用户资料 "${confirmDialog.profileName}" 吗？此操作不可撤销。`}
        confirmText="删除"
        cancelText="取消"
        variant="danger"
      />
    </div>
  );
};

export default UserProfilesPage;