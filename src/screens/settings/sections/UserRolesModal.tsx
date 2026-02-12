import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Check
} from 'lucide-react';
import { InputProvider } from '@/components/InputProvider';
import { UserProfile } from '@/store';
import { toast } from '@/hooks/useToast';
import BottomSheetModal from '@/components/BottomSheetModal';
import RoleAvatarUpload from '@/screens/settings/components/RoleAvatarUpload';
import { generateRandomLocalAvatar } from '@/utils/avatarUtils';

export interface UserRoleFormData {
  name: string;
  description: string;
  avatar: string;
}

interface UserRolesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (data: UserRoleFormData) => Promise<void> | void;
  initialProfile: UserProfile | null;
}

const UserRolesModal: React.FC<UserRolesModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  initialProfile
}) => {
  // 简单的桌面端检测逻辑
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    // 初始化检测
    setIsDesktop(window.innerWidth >= 1024);

    const checkDesktop = () => {
      setIsDesktop(window.innerWidth >= 1024);
    };
    
    window.addEventListener('resize', checkDesktop);
    return () => window.removeEventListener('resize', checkDesktop);
  }, []);

  const [formData, setFormData] = useState<UserRoleFormData>({
    name: '',
    description: '',
    avatar: ''
  });

  // 初始化表单数据
  useEffect(() => {
    if (isOpen) {
      if (initialProfile) {
        // 编辑模式
        setFormData({
          name: initialProfile.name,
          description: initialProfile.description || '',
          avatar: initialProfile.avatar
        });
      } else {
        // 创建模式
        setFormData({
          name: '',
          description: '',
          avatar: generateRandomLocalAvatar()
        });
      }
    }
  }, [isOpen, initialProfile]);

  const handleSave = async () => {
    if (!formData.name?.trim()) {
      toast.error('请输入用户名');
      return;
    }

    await onConfirm(formData);
  };

  // 表单内容
  const FormContent = (
    <InputProvider>
      <div className="flex flex-col gap-6">
        {/* 基本信息 */}
      <fieldset className='bub-fieldset py-4'>
        <RoleAvatarUpload
          name={formData.name || '用户'}
          currentAvatar={formData.avatar}
          onAvatarChange={(avatar) => setFormData({ ...formData, avatar: avatar || '' })}
          className="self-center pb-4"
        />
        <div>
          <label className='bub-input'>
            <span className="label">昵称 *</span>
            <input
              type="text"
              value={formData.name || ''}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className=""
              placeholder="你希望 AI 如何称呼你？"
              maxLength={50}
            />
          </label>
        </div>
        
        <div>
          <div className='bub-textarea'>
            <span className="label">用户简介</span>
            <textarea
              value={formData.description || ''}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={4}
              className="w-full pt-8"
              placeholder="用户简介，简要描述用户的特点和背景（可选）。将在对话时传递给AI，帮助AI更好地理解用户背景。"
              maxLength={500}
            />
          </div>
        </div>
      </fieldset>
      </div>
    </InputProvider>
  );

  if (!isOpen) return null;

  // 桌面端渲染
  if (isDesktop) {
    return createPortal(
      <dialog className="modal modal-open modal-middle" open>
        <div className="modal-box w-11/12 max-w-lg p-0 flex flex-col bg-base-200 shadow-2xl max-h-[90vh]">
          {/* Header */}
          <div className="px-6 py-4 flex items-center justify-between border-b border-base-200">
            <div className="text-lg font-bold text-base-content">{initialProfile ? '编辑用户资料' : '添加用户资料'}</div>
            <button className="btn btn-sm btn-circle btn-ghost" onClick={onClose}>
              <X className="h-5 w-5" />
            </button>
          </div>
          
          {/* Content */}
          <div className="flex-1 overflow-y-auto px-6 py-4">
            {FormContent}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-base-200 flex justify-end gap-2">
            <button className="btn" onClick={onClose}>取消</button>
            <button className="btn btn-primary" onClick={handleSave}>
              <Check className="h-4 w-4 mr-1" />
              保存
            </button>
          </div>
        </div>
        
        <form method="dialog" className="modal-backdrop">
          <button onClick={onClose}>close</button>
        </form>
      </dialog>,
      document.body
    );
  }

  // 移动端渲染
  return createPortal(
    <BottomSheetModal
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      onClose={onClose}
      dismissible={true}
      dragEnabled={true}
      distanceThreshold={120}
      velocityThreshold={0.5}
      rubberband={true}
      safeArea={true}
      debug={true}
      fullScreen={false}
      headerTitle={<div className="text-center text-lg font-semibold text-base-content">{initialProfile ? '编辑用户资料' : '添加用户资料'}</div>}
      rightActions={[
        { 
          icon: <Check className="h-5 w-5" />, 
          className: 'btn btn-primary btn-square', 
          onClick: handleSave
        }
      ]}
      leftActions={[
        {
          icon: <X className="h-5 w-5" />,
          className: 'btn btn-ghost btn-square bg-base-100',
          role: 'close'
        }
      ]}
    >
      <div className="flex-1 overflow-hidden">
        <div className="h-full overflow-y-auto px-4 pb-8">
          {FormContent}
        </div>
      </div>
    </BottomSheetModal>,
    document.body
  );
};

export default UserRolesModal;
