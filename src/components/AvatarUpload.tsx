import React, { useState, useRef } from 'react';
import { Upload, X, Camera } from 'lucide-react';
import { cn } from '../lib/utils';
import { fileToBase64, validateImageFile } from '../utils/avatarUtils';
import Avatar from './Avatar';
import { toast } from '../hooks/useToast';

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
      const base64 = await fileToBase64(file);
      onAvatarChange(base64);
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
          className="rounded-sm"
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

      {/* 操作按钮 */}
      <div className="flex space-x-2">
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
      </div>

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
        <p className="text-xs text-base-content/60">
          支持 JPEG、PNG、GIF、WebP 格式
        </p>
        <p className="text-xs text-base-content/60">
          文件大小不超过 5MB
        </p>
        {!currentAvatar && (
          <p className="text-xs text-base-content/40 mt-1">
            未上传头像时将根据角色名自动生成
          </p>
        )}
      </div>
    </div>
  );
};

export default AvatarUpload;