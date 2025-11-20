import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '../lib/utils';

interface PopconfirmProps {
  title?: string;
  description?: string | React.ReactNode;
  onConfirm: () => void;
  onCancel?: () => void;
  children?: React.ReactElement;
  placement?: 'top' | 'bottom' | 'left' | 'right' | 'auto';
  okText?: string;
  cancelText?: string;
  /** 自定义基准元素，如果不提供则使用触发元素作为基准 */
  getPopupContainer?: () => HTMLElement;
  /** 当 Popconfirm 打开时的回调，用于通知父组件 */
  onOpen?: () => void;
  /** 当 Popconfirm 关闭时的回调，用于通知父组件 */
  onClose?: () => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  anchorEl?: HTMLElement | null;
  arrow?: boolean;
  arrowSize?: number;
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
  onClose,
  open,
  onOpenChange,
  anchorEl,
  arrow = true,
  arrowSize = 8
}) => {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = typeof open === 'boolean';
  const isOpen = isControlled ? !!open : internalOpen;
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const [isPositioned, setIsPositioned] = useState(false);
  const [resolvedPlacement, setResolvedPlacement] = useState<'top' | 'bottom' | 'left' | 'right'>('top');
  const [arrowStyle, setArrowStyle] = useState<React.CSSProperties>({});
  const [arrowColor, setArrowColor] = useState<string>('transparent');
  const popoverRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const [popoverSize, setPopoverSize] = useState<{ w: number; h: number }>({ w: 256, h: 120 });

  // 点击外部关闭
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(event.target as Node) &&
        (!triggerRef.current || !triggerRef.current.contains(event.target as Node)) &&
        (!anchorEl || !anchorEl.contains(event.target as Node))
      ) {
        if (isControlled) {
          onOpenChange?.(false);
        } else {
          setInternalOpen(false);
        }
        onClose?.();
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
        if (isControlled) {
          onOpenChange?.(false);
        } else {
          setInternalOpen(false);
        }
        onClose?.();
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
    if (isControlled) {
      onOpenChange?.(false);
    } else {
      setInternalOpen(false);
    }
    onClose?.();
  };

  const handleCancel = () => {
    onCancel?.();
    if (isControlled) {
      onOpenChange?.(false);
    } else {
      setInternalOpen(false);
    }
    onClose?.();
  };

  // 计算弹出框位置
  const calculatePosition = () => {
    // 获取基准元素，优先使用自定义容器，否则使用触发元素
    const baseElement = anchorEl ?? (getPopupContainer ? getPopupContainer() : triggerRef.current);
    if (!baseElement) return;
    const triggerRect = baseElement.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const measuredW = popoverRef.current?.offsetWidth || 256;
    const measuredH = popoverRef.current?.offsetHeight || 120;
    const popoverWidth = measuredW;
    const popoverHeight = measuredH;
    setPopoverSize({ w: popoverWidth, h: popoverHeight });
    const offset = 8 + (arrow ? arrowSize : 0);
    let top = 0;
    let left = 0;
    const spaces = {
      top: triggerRect.top,
      bottom: viewportHeight - triggerRect.bottom,
      left: triggerRect.left,
      right: viewportWidth - triggerRect.right,
    };
    const desired = placement;
    const choose = () => {
      if (desired === 'auto') {
        const verticalFitTop = spaces.top >= popoverHeight + offset;
        const verticalFitBottom = spaces.bottom >= popoverHeight + offset;
        const horizontalFitLeft = spaces.left >= popoverWidth + offset;
        const horizontalFitRight = spaces.right >= popoverWidth + offset;
        if (verticalFitTop || verticalFitBottom) {
          return verticalFitBottom ? 'bottom' : 'top';
        }
        if (horizontalFitLeft || horizontalFitRight) {
          return horizontalFitRight ? 'right' : 'left';
        }
        const maxSide = Object.entries(spaces).sort((a, b) => b[1] - a[1])[0][0] as 'top'|'bottom'|'left'|'right';
        return maxSide;
      }
      if (desired === 'top') {
        if (spaces.top < popoverHeight + offset) return 'bottom';
        return 'top';
      }
      if (desired === 'bottom') {
        if (spaces.bottom < popoverHeight + offset) return 'top';
        return 'bottom';
      }
      if (desired === 'left') {
        if (spaces.left < popoverWidth + offset) return 'right';
        return 'left';
      }
      if (desired === 'right') {
        if (spaces.right < popoverWidth + offset) return 'left';
        return 'right';
      }
      return 'top';
    };
    const finalPlacement = choose();
    setResolvedPlacement(finalPlacement);
    if (finalPlacement === 'top') {
      top = triggerRect.top - popoverHeight - offset;
      left = triggerRect.left + triggerRect.width / 2 - popoverWidth / 2;
    } else if (finalPlacement === 'bottom') {
      top = triggerRect.bottom + offset;
      left = triggerRect.left + triggerRect.width / 2 - popoverWidth / 2;
    } else if (finalPlacement === 'left') {
      top = triggerRect.top + triggerRect.height / 2 - popoverHeight / 2;
      left = triggerRect.left - popoverWidth - offset;
    } else {
      top = triggerRect.top + triggerRect.height / 2 - popoverHeight / 2;
      left = triggerRect.right + offset;
    }
    if (left < 8) left = 8;
    if (left + popoverWidth > viewportWidth - 8) left = viewportWidth - popoverWidth - 8;
    if (top < 8) top = 8;
    if (top + popoverHeight > viewportHeight - 8) top = viewportHeight - popoverHeight - 8;
    setPosition({ top, left });
    setIsPositioned(true);
    const bg = popoverRef.current ? getComputedStyle(popoverRef.current).backgroundColor : 'rgba(255,255,255,1)';
    setArrowColor(bg);
    const anchorCenterX = triggerRect.left + triggerRect.width / 2;
    const anchorCenterY = triggerRect.top + triggerRect.height / 2;
    const clamp = (val: number, min: number, max: number) => Math.max(min, Math.min(max, val));
    let style: React.CSSProperties = { position: 'absolute', width: 0, height: 0, filter: 'drop-shadow(0 2px 2px rgba(0,0,0,0.08))' };
    if (finalPlacement === 'top') {
      const x = clamp(anchorCenterX - left - arrowSize, arrowSize, popoverWidth - arrowSize);
      style = { ...style, bottom: -arrowSize, left: x, borderLeft: `${arrowSize}px solid transparent`, borderRight: `${arrowSize}px solid transparent`, borderTop: `${arrowSize}px solid ${bg}` } as any;
    } else if (finalPlacement === 'bottom') {
      const x = clamp(anchorCenterX - left - arrowSize, arrowSize, popoverWidth - arrowSize);
      style = { ...style, top: -arrowSize, left: x, borderLeft: `${arrowSize}px solid transparent`, borderRight: `${arrowSize}px solid transparent`, borderBottom: `${arrowSize}px solid ${bg}` } as any;
    } else if (finalPlacement === 'left') {
      const y = clamp(anchorCenterY - top - arrowSize, arrowSize, popoverHeight - arrowSize);
      style = { ...style, right: -arrowSize, top: y, borderTop: `${arrowSize}px solid transparent`, borderBottom: `${arrowSize}px solid transparent`, borderLeft: `${arrowSize}px solid ${bg}` } as any;
    } else {
      const y = clamp(anchorCenterY - top - arrowSize, arrowSize, popoverHeight - arrowSize);
      style = { ...style, left: -arrowSize, top: y, borderTop: `${arrowSize}px solid transparent`, borderBottom: `${arrowSize}px solid transparent`, borderRight: `${arrowSize}px solid ${bg}` } as any;
    }
    setArrowStyle(style);
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
  }, [isOpen, placement, anchorEl, arrow, arrowSize]);

  return (
    <>
      {children ? (
        <div className="relative inline-block">
          <div
            ref={triggerRef}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              const next = !isOpen;
              if (isControlled) {
                if (next) onOpen?.();
                onOpenChange?.(next);
              } else {
                setInternalOpen(next);
                if (next) onOpen?.();
              }
            }}
          >
            {children}
          </div>
        </div>
      ) : null}

      {isOpen && createPortal(
        <div
          ref={popoverRef}
          className={`hero-popover ${
            isPositioned ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
          }`}
          style={{
            top: `${position.top}px`,
            left: `${position.left}px`,
            visibility: isPositioned ? 'visible' : 'hidden'
          }}
        >
          {arrow && <div style={arrowStyle} />}
          <div className="space-y-3">
            <div className="text-md font-medium text-gray-900">
              {title}
            </div>
            {description && (
              <div className="text-sm text-gray-600">
                {description}
              </div>
            )}
            <div className="flex justify-end space-x-2">
              <button
                onClick={handleCancel}
                className="btn btn-sm btn-ghost text-sm"
              >
                {cancelText}
              </button>
              <button
                onClick={handleConfirm}
                className="btn btn-sm btn-primary text-sm"
              >
                {okText}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
};

export default Popconfirm;