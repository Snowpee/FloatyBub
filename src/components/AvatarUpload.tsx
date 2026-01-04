import React, { useState, useRef, useEffect } from 'react';
import { Camera } from 'lucide-react';
import { cn } from '../lib/utils';
import { validateImageFile } from '../utils/avatarUtils';
import Avatar from './Avatar';
import { toast } from '../hooks/useToast';
import { createStorageService, StorageService } from '../services/storage/StorageService';

interface AvatarUploadProps {
  name: string;
  currentAvatar?: string;
  onAvatarChange: (avatar: string | undefined) => void;
  className?: string;
}

const AvatarUpload: React.FC<AvatarUploadProps> = ({
  name,
  currentAvatar,
  onAvatarChange,
  className = ''
}) => {
  const [isUploading, setIsUploading] = useState(false);
  const [storageService, setStorageService] = useState<StorageService | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 初始化存储服务
  useEffect(() => {
    const service = createStorageService();
    setStorageService(service);
    if (!service) {
      console.warn('Storage service not available');
    }
  }, []);

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

  return (
    <div className={cn('flex flex-col items-center space-y-4', className)}>
      {/* 头像预览 */}
      <div className="relative">
        <Avatar
          name={name}
          avatar={currentAvatar}
          size="xl"
          className="rounded-full border border-base-300"
        />
        
        {/* 上传按钮覆盖层 */}
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 bg-opacity-50 rounded-full opacity-0 hover:opacity-100 transition-opacity cursor-pointer"
             onClick={handleUploadClick}>
          {isUploading ? (
            <div className="loading loading-spinner loading-sm text-white"></div>
          ) : (
            <Camera className="h-6 w-6 text-white" />
          )}
        </div>
      </div>

      {/* 操作按钮 */}
      {/* <div className="flex space-x-2">
        <button
          type="button"
          onClick={handleUploadClick}
          disabled={isUploading}
          className="btn btn-sm btn-primary"
        >
          <Upload className="h-4 w-4 mr-1" />
          {isUploading ? '上传中...' : '上传头像'}
        </button>
        
        {currentAvatar && (
          <button
            type="button"
            onClick={handleRemoveAvatar}
            className="btn btn-sm btn-ghost text-error"
          >
            <X className="h-4 w-4 mr-1" />
            移除
          </button>
        )}
      </div> */}

      {/* 隐藏的文件输入 */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
        onChange={handleFileSelect}
        className="hidden"
      />

      {/* 提示文字 */}
      <div className="text-center">
        <p className="text-sm text-base-content/70">
          点击头像上传新头像
        </p>
        <p className="text-xs text-base-content/50">
          支持常见图片格式，文件大小不超过 5MB
        </p>
      </div>
    </div>
  );
};

export default AvatarUpload;
