import React, { useState } from 'react';
import { generateAvatar, isValidImageUrl } from '../utils/avatarUtils';
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
  const [imageError, setImageError] = useState(false);
  
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

  const hasCustomAvatar = avatar && isValidImageUrl(avatar) && !imageError;
  const avatarData = generateAvatar(name);

  // 图片头像
  if (hasCustomAvatar) {
    return (
      <div className={cn(
        'avatar',
        showRing && `ring ring-offset-2 ring-offset-base-100 ${ringColor}`,
        className
      )}>
        <div className={cn(
          'rounded-full',
          sizeClasses[size]
        )}>
          <img
            src={avatar}
            alt={`${name}的头像`}
            onError={() => setImageError(true)}
          />
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