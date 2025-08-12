import React, { useRef } from 'react';
import { generateAvatar, isValidImageUrl } from '../utils/avatarUtils';
import { useAvatarPreload } from '../utils/imageCache';
import { cn } from '../lib/utils';

interface AvatarProps {
  name: string;
  avatar?: string; // 自定义头像URL或base64
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  showRing?: boolean;
  ringColor?: string;
}

const Avatar: React.FC<AvatarProps> = ({
  name,
  avatar,
  size = 'md',
  className = '',
  showRing = false,
  ringColor = 'ring-primary'
}) => {
  const imgRef = useRef<HTMLImageElement>(null);
  const { isLoaded, isLoading, hasError } = useAvatarPreload(avatar);
  
  const sizeClasses = {
    sm: 'w-6',
    md: 'w-8', 
    lg: 'w-12',
    xl: 'w-16'
  };
  
  const textSizeClasses = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base', 
    xl: 'text-lg'
  };

  const hasCustomAvatar = avatar && isValidImageUrl(avatar) && !hasError && isLoaded;
  const avatarData = generateAvatar(name);

  // 图片头像或loading状态
  if (avatar && isValidImageUrl(avatar) && !hasError) {
    return (
      <div className={cn(
        'avatar',
        showRing && `ring ring-offset-2 ring-offset-base-100 ${ringColor}`,
        className
      )}>
        <div className={cn(
          'rounded-full relative',
          sizeClasses[size]
        )}>
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-base-200 rounded-full">
              <div className="loading loading-spinner loading-xs"></div>
            </div>
          )}
          {hasCustomAvatar && (
            <img
              ref={imgRef}
              src={avatar}
              alt={`${name}的头像`}
              className={cn(
                 'transition-opacity duration-200',
                 isLoaded ? 'opacity-100' : 'opacity-0'
               )}
            />
          )}
        </div>
      </div>
    );
  }

  // 文字头像（placeholder）
  return (
    <div className={cn(
      'avatar placeholder',
      showRing && `ring ring-offset-2 ring-offset-base-100 ${ringColor}`,
      className
    )}>
      <div 
        className={cn(
          'rounded-full',
          'text-center',
          'content-center',
          sizeClasses[size],
          textSizeClasses[size]
        )}
        style={{
          backgroundColor: avatarData.backgroundColor,
          color: avatarData.textColor
        }}
      >
        <span className="text-white">{avatarData.initials}</span>
      </div>
    </div>
  );
};

export default Avatar;