import React, { useState, useRef } from 'react';
import { Camera, Shuffle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { validateImageFile, generateRandomLocalAvatar } from '@/utils/avatarUtils';
import Avatar from '@/components/Avatar';
import { toast } from '@/hooks/useToast';
import { createStorageService } from '@/services/storage/StorageService';

interface RoleAvatarUploadProps {
  name: string;
  currentAvatar?: string;
  onAvatarChange: (avatar: string | undefined) => void;
  className?: string;
}

// 生成随机头像
const generateRandomAvatar = (): string => {
  return generateRandomLocalAvatar();
};

const RoleAvatarUpload: React.FC<RoleAvatarUploadProps> = ({
  name,
  currentAvatar,
  onAvatarChange,
  className = ''
}) => {
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // 验证文件
    const validation = validateImageFile(file);
    if (!validation.valid) {
      toast.error(validation.error);
      return;
    }

    setIsUploading(true);
    try {
      // 创建存储服务实例
      const storageService = createStorageService();
      
      if (!storageService) {
        toast.error('未配置云存储，无法上传自定义头像');
        return;
      }

      const fileMetadata = await storageService.uploadAvatar(file);
      onAvatarChange(fileMetadata.accessUrl);
      toast.success('头像上传成功');
    } catch (error) {
      console.error('头像上传失败:', error);
      toast.error('头像上传失败，请重试');
    } finally {
      setIsUploading(false);
      // 清空input值，允许重复选择同一文件
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemoveAvatar = () => {
    onAvatarChange(undefined);
    toast.success('已移除自定义头像');
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleRandomAvatar = () => {
    const randomAvatar = generateRandomAvatar();
    onAvatarChange(randomAvatar);
    toast.success('已生成随机头像');
  };

  return (
    <div className={cn('flex items-center gap-4', className)}>
      {/* 头像预览 */}
      <div className="relative flex-shrink-0">
        <Avatar
          name={name}
          avatar={currentAvatar}
          size="xl"
          className=""
        />
        
        {/* 上传按钮覆盖层 */}
        <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 rounded-full opacity-0 hover:opacity-100 transition-opacity cursor-pointer"
             onClick={handleUploadClick}>
          {isUploading ? (
            <div className="loading loading-spinner loading-sm text-white"></div>
          ) : (
            <Camera className="h-6 w-6 text-white" />
          )}
        </div>
      </div>

      {/* 右侧内容 */}
      <div className="flex-1 space-y-2">
        {/* 操作按钮 */}
        <div className="flex gap-1">
          <button
            type="button"
            onClick={handleRandomAvatar}
            className="btn btn-sm border-base-300 bg-base-100 hover:bg-base-200"
          >
            <Shuffle className="h-4 w-4 mr-1" />
            随机生成
          </button>
          
          {/* {currentAvatar && (
            <button
              type="button"
              onClick={handleRemoveAvatar}
              className="btn btn-sm btn-ghost text-error"
            >
              <X className="h-4 w-4 mr-1" />
              移除
            </button>
          )} */}
        </div>

        {/* 提示文字 */}
        <div className="text-left">
          <p className="text-xs text-base-content/60">
            文件大小不超过 5MB。
          </p>
          {/* {!currentAvatar && (
            <p className="text-xs text-base-content/40 mt-1">
              未设置头像时将根据角色名自动生成
            </p>
          )} */}
        </div>
      </div>

      {/* 隐藏的文件输入 */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
        onChange={handleFileSelect}
        className="hidden"
      />
    </div>
  );
};

export default RoleAvatarUpload
