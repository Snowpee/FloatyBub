import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '../lib/utils';

interface PopconfirmProps {
  title?: string;
  description?: string;
  onConfirm: () => void;
  onCancel?: () => void;
  children: React.ReactElement;
  placement?: 'top' | 'bottom' | 'left' | 'right';
  okText?: string;
  cancelText?: string;
  /** 自定义基准元素，如果不提供则使用触发元素作为基准 */
  getPopupContainer?: () => HTMLElement;
  /** 当 Popconfirm 打开时的回调，用于通知父组件 */
  onOpen?: () => void;
  /** 当 Popconfirm 关闭时的回调，用于通知父组件 */
  onClose?: () => void;
}

export const Popconfirm: React.FC<PopconfirmProps> = ({
  title = '确认删除？',
  description,
  onConfirm,
  onCancel,
  children,
  placement = 'top',
  okText = '确认',
  cancelText = '取消',
  getPopupContainer,
  onOpen,
  onClose
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const [isPositioned, setIsPositioned] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);

  // 点击外部关闭
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(event.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // ESC 键关闭
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  const handleConfirm = () => {
    onConfirm();
    setIsOpen(false);
    onClose?.();
  };

  const handleCancel = () => {
    onCancel?.();
    setIsOpen(false);
    onClose?.();
  };

  // 计算弹出框位置
  const calculatePosition = () => {
    // 获取基准元素，优先使用自定义容器，否则使用触发元素
    const baseElement = getPopupContainer ? getPopupContainer() : triggerRef.current;
    if (!baseElement) return;
    
    const triggerRect = baseElement.getBoundingClientRect();
    const popoverWidth = 256; // w-64 = 16rem = 256px
    const popoverHeight = 120; // 估算高度
    const offset = 8;
    
    let top = 0;
    let left = 0;
    
    switch (placement) {
      case 'top':
        top = triggerRect.top - popoverHeight - offset;
        left = triggerRect.left + triggerRect.width / 2 - popoverWidth / 2;
        break;
      case 'bottom':
        top = triggerRect.bottom + offset;
        left = triggerRect.left + triggerRect.width / 2 - popoverWidth / 2;
        break;
      case 'left':
        top = triggerRect.top + triggerRect.height / 2 - popoverHeight / 2;
        left = triggerRect.left - popoverWidth - offset;
        break;
      case 'right':
        top = triggerRect.top + triggerRect.height / 2 - popoverHeight / 2;
        left = triggerRect.right + offset;
        break;
      default:
        top = triggerRect.top - popoverHeight - offset;
        left = triggerRect.left + triggerRect.width / 2 - popoverWidth / 2;
    }
    
    // 确保不超出视窗边界
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    if (left < 0) left = 8;
    if (left + popoverWidth > viewportWidth) left = viewportWidth - popoverWidth - 8;
    if (top < 0) top = 8;
    if (top + popoverHeight > viewportHeight) top = viewportHeight - popoverHeight - 8;
    
    setPosition({ top, left });
    setIsPositioned(true);
  };

  // 更新位置
  useEffect(() => {
    if (isOpen) {
      setIsPositioned(false);
      // 使用 requestAnimationFrame 确保在下一帧计算位置
      requestAnimationFrame(() => {
        calculatePosition();
      });
      
      const handleResize = () => {
        setIsPositioned(false);
        requestAnimationFrame(() => {
          calculatePosition();
        });
      };
      const handleScroll = () => {
        setIsPositioned(false);
        requestAnimationFrame(() => {
          calculatePosition();
        });
      };
      
      window.addEventListener('resize', handleResize);
      window.addEventListener('scroll', handleScroll, true);
      
      return () => {
        window.removeEventListener('resize', handleResize);
        window.removeEventListener('scroll', handleScroll, true);
      };
    } else {
      setIsPositioned(false);
    }
  }, [isOpen, placement]);

  return (
    <div className="relative inline-block">
      {/* 触发元素 */}
      <div
        ref={triggerRef}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          const newIsOpen = !isOpen;
          setIsOpen(newIsOpen);
          if (newIsOpen) {
            onOpen?.();
          }
        }}
      >
        {children}
      </div>

      {/* 使用 Portal 渲染 Popconfirm 内容到 body */}
      {isOpen && createPortal(
        <div
          ref={popoverRef}
          className={`fixed z-[9999] w-64 p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg transition-opacity transition-transform duration-200 ease-out ${
            isPositioned ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
          }`}
          style={{
            top: `${position.top}px`,
            left: `${position.left}px`,
            visibility: isPositioned ? 'visible' : 'hidden'
          }}
        >
          {/* 内容 */}
          <div className="space-y-3">
            <div className="text-sm font-medium text-gray-900 dark:text-white">
              {title}
            </div>
            {description && (
              <div className="text-xs text-gray-600 dark:text-gray-400">
                {description}
              </div>
            )}
            
            {/* 按钮组 */}
            <div className="flex justify-end space-x-2">
              <button
                onClick={handleCancel}
                className="btn btn-sm btn-ghost text-xs"
              >
                {cancelText}
              </button>
              <button
                onClick={handleConfirm}
                className="btn btn-sm btn-error text-xs"
              >
                {okText}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default Popconfirm;