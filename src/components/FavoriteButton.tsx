import React from 'react';
import { Heart } from 'lucide-react';

interface FavoriteButtonProps {
  isFavorite?: boolean;
  onClick: () => void;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const FavoriteButton: React.FC<FavoriteButtonProps> = ({
  isFavorite = false,
  onClick,
  className = '',
  size = 'md'
}) => {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6'
  };

  const buttonSizeClasses = {
    sm: 'p-1',
    md: 'p-1.5',
    lg: 'p-2'
  };

  return (
    <button
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onClick();
      }}
      className={`
        ${buttonSizeClasses[size]}
        rounded-full
        transition-all
        duration-200
        ease-in-out
        hover:bg-red-50
        hover:scale-110
        active:scale-95
        focus:outline-none
        focus:ring-2
        focus:ring-red-200
        ${className}
      `}
      title={isFavorite ? '取消收藏' : '添加收藏'}
    >
      <Heart
        className={`
          ${sizeClasses[size]}
          transition-all
          duration-200
          ease-in-out
          ${isFavorite 
            ? 'fill-red-500 text-red-500' 
            : 'text-gray-400 hover:text-red-400'
          }
        `}
      />
    </button>
  );
};

export default FavoriteButton;