import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { cn } from '../lib/utils';
import { useDragToClose } from '../hooks/useDragToClose';
import HistoryPage from '../pages/HistoryPage';

interface HistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const HistoryModal: React.FC<HistoryModalProps> = ({ isOpen, onClose }) => {
  const [isClosing, setIsClosing] = useState(false);
  const [shouldRender, setShouldRender] = useState(isOpen);
  const [isVisible, setIsVisible] = useState(false);

  // 使用拖动关闭Hook
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

  // 处理弹窗打开逻辑
  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
      setIsClosing(false);
      resetDragState();
      
      const timer = setTimeout(() => {
        setIsVisible(true);
      }, 10);
      return () => clearTimeout(timer);
    } else if (shouldRender) {
      const isMobile = window.innerWidth < 768;
      
      setIsClosing(true);
      setIsVisible(false);
      
      const delay = isMobile ? 300 : 200;
      const timer = setTimeout(() => {
        setShouldRender(false);
        setIsClosing(false);
      }, delay);
      return () => clearTimeout(timer);
    }
  }, [isOpen, resetDragState, shouldRender]);

  const handleClose = () => {
    if (isRebounding || isDragging) {
      return;
    }
    onClose();
  };

  if (!shouldRender) {
    return null;
  }

  return (
    <div className={cn(
      "fixed inset-0 z-50",
      "md:flex md:items-center md:justify-center",
      "pt-4 md:pt-0",
      "pt-[calc(env(safe-area-inset-top)+1rem)]"
    )}>
      {/* 背景遮罩 */}
      <div 
        className={cn(
          "modal-backdrop absolute inset-0 bg-black/50",
          "md:animate-in md:fade-in md:duration-200",
          "transition-opacity duration-200 ease-out",
          isClosing ? "opacity-0" : "opacity-100"
        )}
        onClick={handleClose}
      />
      
      {/* 弹窗内容 */}
      <div 
        key={`drag-container-${dragKey}`}
        className={cn(
          "hero-modal relative bg-base-100 shadow-xl flex flex-col overflow-hidden",
          "md:rounded-lg md:w-full md:!max-w-4xl md:h-[800px] md:max-h-[calc(100vh-2rem)] md:mx-4",
          "w-full h-full",
          isChildrenDisabled && "[&_*]:pointer-events-none",
          // 桌面端透明度和位移动画
          "md:transition-all md:duration-200 md:ease-out",
          // 移动端滑入滑出动画 - 拖动或回弹时禁用 CSS transition
          (isDragging || isRebounding) ? "" : "transition-transform duration-200 ease-[cubic-bezier(0.25,0.46,0.45,0.94)]",
          // 桌面端透明度和位移控制
          isVisible && !isClosing 
            ? "md:opacity-100 md:translate-y-0" 
            : "md:opacity-0 md:translate-y-2",
          // 移动端动画状态控制
          (isDragging || isRebounding)
            ? "" // 拖动或回弹时不使用 Tailwind transform，避免与内联样式冲突
            : isVisible && !isClosing
            ? "translate-y-0"                     // 可见状态：正常位置
            : "translate-y-full md:translate-y-2" // 隐藏状态：移动端在屏幕下方，桌面端稍微下方
        )}
        style={{
          transform: (isDragging || isRebounding || dragY > 0) 
            ? `translateY(${dragY}px)` 
            : undefined,
        }}
      >
        {/* 标题栏 - 拖动区域 */}
        <div 
          {...bind()}
          className={cn(
            "flex items-center justify-between p-4 px-6 border-b border-base-300 bg-base-100",
            // 拖动区域样式
            "cursor-move select-none",
            // 移动端触摸操作优化 - 防止浏览器默认滚动行为干扰拖动
            "md:touch-auto touch-none",
            // 拖动时的视觉反馈
            isDragging && "bg-base-200/50"
          )}
        >
          <h2 className="text-lg font-semibold text-base-content">历史记录</h2>
          <button
            onClick={handleClose}
            className="btn btn-ghost btn-sm btn-square"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* 历史记录内容 */}
        <div className="flex-1 overflow-hidden">
          <div className="h-full overflow-y-auto pt-4">
            <HistoryPage onCloseModal={handleClose} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default HistoryModal;