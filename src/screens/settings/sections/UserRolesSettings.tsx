import React, { useState } from 'react';
import { Plus, Edit, Trash2, User, CheckCircle, MoreHorizontal } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { useAppStore, UserProfile } from '../../../store';
import EmptyState from '../../../components/EmptyState';
import ConfirmDialog from '../../../components/ConfirmDialog';
import { toast } from '../../../hooks/useToast';
import UserRolesModal, { UserRoleFormData } from './UserRolesModal';


interface UserRolesSettingsProps {
  onCloseModal?: () => void;
  className?: string;
}

const UserRolesSettings: React.FC<UserRolesSettingsProps> = ({ onCloseModal, className }) => {
  const {
    userRoles,
    currentUserProfile,
    addUserProfile,
    updateUserProfile,
    deleteUserProfile,
    setCurrentUserProfile
  } = useAppStore();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState<UserProfile | null>(null);

  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    profileId: string;
    profileName: string;
  }>({ isOpen: false, profileId: '', profileName: '' });

  const handleAdd = () => {
    setEditingProfile(null);
    setIsModalOpen(true);
  };

  const handleEdit = (profile: UserProfile) => {
    setEditingProfile(profile);
    setIsModalOpen(true);
  };

  const handleModalConfirm = async (data: UserRoleFormData) => {
    try {
      if (editingProfile) {
        updateUserProfile(editingProfile.id, {
          name: data.name.trim(),
          description: data.description.trim(),
          avatar: data.avatar
        });
        toast.success('用户资料已更新');
      } else {
        addUserProfile({
          name: data.name.trim(),
          description: data.description.trim(),
          avatar: data.avatar
        });
        toast.success('用户资料已添加');
      }
      setIsModalOpen(false);
    } catch (error) {
      console.error('保存用户资料失败:', error);
      toast.error('保存用户资料失败');
    }
  };

  const handleDelete = (id: string) => {
    const profile = userRoles.find(p => p.id === id);
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



  return (
    <div className={cn("max-w-6xl mx-auto p-4 md:p-6 md:pt-0", className)}>
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
        <div>
          <p className="text-base-content/60">管理用户资料，在对话时传递给AI</p>
        </div>
        <button
          onClick={handleAdd}
          className="btn btn-outline-light md:btn-primary w-full md:w-auto"
        >
          <Plus className="h-4 w-4" />
          添加用户角色
        </button>
      </div>

      {/* 当前用户显示 */}
      {currentUserProfile && (
        <div className="hero-list p-4 mb-4">
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
      {userRoles.length > 0 && (
        <p className="text-base-content mb-4">用户资料列表</p>
      )}
      {userRoles.length === 0 ? (
        <EmptyState message="暂无用户资料，点击上方按钮添加第一个用户资料" />
      ) : (
        <div className="grid gap-4">
          {userRoles.map((profile) => (
            <div
              key={profile.id}
              className={cn(
                "hero-list",
                currentUserProfile?.id === profile.id
                  ? "border-primary"
                  : "border-base-300 hover:border-base-400"
              )}
            >
              <div className="flex items-center justify-between">
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
                <div className="dropdown dropdown-end">
                  <label tabIndex={0} className="btn btn-sm">
                    <MoreHorizontal className="h-4 w-4" />
                  </label>
                  <ul tabIndex={0} className="dropdown-content menu bg-base-100 rounded-box z-[1] w-44 p-2 shadow-lg">
                    <li>
                      {currentUserProfile?.id !== profile.id ? (
                        <a
                          onClick={() => handleSetCurrent(profile)}
                          className="gap-3"
                        >
                          <User className="h-4 w-4" />
                          设置为当前角色
                        </a>
                      ): (
                        <a 
                          className="gap-3"
                          onClick={() => setCurrentUserProfile(null)}
                        >
                          <User className="h-4 w-4" />
                          取消设置
                        </a>
                      )}
                    </li>
                    <li>
                      <a onClick={() => handleEdit(profile)} className="gap-3">
                        <Edit className="h-4 w-4" />
                        编辑
                      </a>
                    </li>
                    <li>
                      <a onClick={() => handleDelete(profile.id)} className="gap-3 text-error hover:bg-error/10">
                        <Trash2 className="h-4 w-4" />
                        删除
                      </a>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 编辑对话框 */}
      <UserRolesModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onConfirm={handleModalConfirm}
        initialProfile={editingProfile}
      />

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

export default UserRolesSettings;
