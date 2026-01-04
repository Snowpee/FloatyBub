import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useDragToClose } from '@/hooks/useDragToClose';

interface HeroModalProps {
  isOpen: boolean;
  title: string;
  onClose: () => void;
  onConfirm?: () => void;
  confirmText?: React.ReactNode;
  confirmIcon?: React.ReactNode; // 移动端使用的图标内容（可选）
  cancelText?: string;
  variant?: 'default' | 'primary' | 'danger' | 'warning' | 'info';
  fullScreenOnMobile?: boolean;
  children: React.ReactNode;
}

// 一个可复用的复杂内容模态组件，支持 Web 与 Mobile 的差异化布局：
// - Web：常规模态，右上角关闭，底部操作区（取消/确认）
// - Mobile：头部特殊化：关闭在左、标题居中、确认在右；始终全屏显示
const HeroModal: React.FC<HeroModalProps> = ({
  isOpen,
  title,
  onClose,
  onConfirm,
  confirmText = '确认',
  confirmIcon,
  cancelText = '取消',
  variant = 'primary',
  fullScreenOnMobile = true,
  children
}) => {
  // 控制渲染与动画状态（用于移动端入场/退场动画）
  const [isClosing, setIsClosing] = useState(false);
  const [shouldRender, setShouldRender] = useState(isOpen);
  const [isVisible, setIsVisible] = useState(false);

  const confirmBtnClass = (() => {
    switch (variant) {
      case 'danger':
        return 'btn-error';
      case 'warning':
        return 'btn-warning';
      case 'info':
        return 'btn-info';
      case 'primary':
        return 'btn-primary';
      default:
        return 'btn-primary';
    }
  })();
  
  // 拖动关闭（仅移动端启用）
  const {
    dragY,
    isDragging,
    isChildrenDisabled,
    isRebounding,
    dragKey,
    bind,
    resetDragState
  } = useDragToClose({
    onClose,
    isClosing,
    isRebounding: false,
    closeThreshold: 100,
    velocityThreshold: 0.5,
    reboundDuration: 300,
    enableMobileOnly: true
  });

  // 打开/关闭状态管理：在移动端做入场/退场动画
  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
      setIsClosing(false);
      resetDragState();
      const t = setTimeout(() => setIsVisible(true), 10);
      return () => clearTimeout(t);
    } else if (shouldRender) {
      const isMobile = window.innerWidth < 768;
      setIsClosing(true);
      setIsVisible(false);
      const delay = isMobile ? 300 : 200;
      const t = setTimeout(() => {
        setShouldRender(false);
        setIsClosing(false);
      }, delay);
      return () => clearTimeout(t);
    }
  }, [isOpen, resetDragState, shouldRender]);

  const handleClose = () => {
    if (isRebounding || isDragging) return;
    onClose();
  };

  if (!shouldRender) return null;

  return createPortal(
    <div className={cn(
      'fixed inset-0 z-[80]',
      'md:flex md:items-center md:justify-center',
      'pt-0'
    )}>
      {/* 背景遮罩 */}
      <div
        className={cn(
          'modal-backdrop absolute inset-0 bg-black/50',
          'transition-opacity duration-200 ease-out',
          isClosing ? 'opacity-0' : 'opacity-100'
        )}
        onClick={handleClose}
      />

      {/* 弹窗内容容器 */}
      <div
        key={`drag-container-${dragKey}`}
        className={cn(
          // 使用现有的 hero-modal 风格外壳
          'relative bg-base-100 shadow-xl flex flex-col rounded-0',
          // 桌面端尺寸
          'md:max-w-lg md:max-h-[45rem] md:mx-4 md:rounded-[var(--radius-box)]',
          // 移动端全屏
          fullScreenOnMobile ? 'w-full h-dvh' : 'h-full',
          // 拖动时禁用子元素交互
          isChildrenDisabled && '[&_*]:pointer-events-none',
          // 桌面端透明度和位移动画
          'md:transition-all md:duration-200 md:ease-out',
          isVisible && !isClosing ? 'md:opacity-100 md:translate-y-0' : 'md:opacity-0 md:translate-y-2',
          // 移动端滑入/滑出动画（拖动或回弹时禁用 CSS transition）
          (isDragging || isRebounding) ? '' : 'transition-transform duration-300 ease-[cubic-bezier(0.78, 0, 0.22, 1)]',
          (isDragging || isRebounding) ? '' : (isVisible && !isClosing ? 'translate-y-0' : 'translate-y-full md:translate-y-2')
        )}
        style={{
          transform: (isDragging || isRebounding || dragY > 0) ? `translateY(${dragY}px)` : undefined,
        }}
      >
        {/* 头部 - 移动端特殊布局，桌面端保留常规右上关闭 */}
        <div className={cn(
          'p-3 border-b border-base-300 pt-[calc(env(safe-area-inset-top)+1rem)]',
          'md:p-4 md:border-none'
        )}>
          {/* Mobile 头部：左关闭 / 中标题 / 右确认（可拖动） */}
          <div
            {...bind()}
            className={cn(
              'grid grid-cols-3 items-center md:hidden',
              'cursor-move select-none',
              'md:touch-auto touch-none',
              isDragging && 'bg-base-200/50'
            )}
          >
            <div className="flex items-center">
              <button className="btn btn-circle" onClick={handleClose} aria-label="关闭">
                <X className="h-4 w-4" />
              </button>
            </div>
            <h2 className="text-center text-base font-semibold text-base-content truncate">
              {title}
            </h2>
            <div className="flex items-center justify-end">
              {onConfirm && (
                <button className={cn('btn btn-circle', confirmBtnClass)} onClick={onConfirm}>
                  {confirmIcon ?? confirmText}
                </button>
              )}
            </div>
          </div>

          {/* Desktop 头部：标题 + 右上关闭 */}
          <div className="hidden md:flex items-center justify-between">
            <h2 className="text-lg font-semibold text-base-content">{title}</h2>
            <button className="btn btn-ghost btn-sm btn-square" onClick={handleClose} aria-label="关闭">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* 内容区域 */}
        <div className={cn('flex-1 min-h-0')}
        >
          <div className={cn('h-full overflow-y-auto', fullScreenOnMobile ? 'p-4' : 'p-4 md:p-6')}>
            {children}
          </div>
        </div>

        {/* 底部操作区：仅桌面端显示，移动端隐藏 */}
        <div className="hidden md:flex md:p-4 md:border-t md:border-base-300">
          <div className="ml-auto flex items-center gap-2">
            <button className="btn btn-ghost" onClick={handleClose}>{cancelText}</button>
            {onConfirm && (
              <button className={cn('btn', confirmBtnClass)} onClick={onConfirm}>
                {confirmText}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default HeroModal;