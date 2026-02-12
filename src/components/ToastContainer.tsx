import React, { useState, useEffect } from 'react';
import { useTransition, animated } from '@react-spring/web';
import { useToast, ToastMessage } from '@/hooks/useToast';
import { X, CheckCircle, XCircle, Info, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ToastItemProps {
  toast: ToastMessage;
  onDismiss: (id: string) => void;
}

const ToastItem: React.FC<ToastItemProps> = ({ toast, onDismiss }) => {
  const getIcon = () => {
    switch (toast.type) {
      case 'success':
        return <CheckCircle className="w-5 h-5 text-success" />;
      case 'error':
        return <XCircle className="w-5 h-5 text-error" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-warning" />;
      case 'info':
      default:
        return <Info className="w-5 h-5 text-info" />;
    }
  };

  return (
    <div className={cn('alert shadow-lg w-auto max-w-[92vw] sm:w-80 bg-base-100/50 glass')}>
      <div className="flex items-center gap-3 flex-1">
        {getIcon()}
        <div className="flex-1 min-w-0">
          {toast.title && (
            <div className="font-semibold text-base break-words">{toast.title}</div>
          )}
          <div className={cn('text-sm break-words', toast.title ? 'opacity-80' : '')}>
            {toast.message}
          </div>
        </div>
      </div>
      <button
        onClick={() => onDismiss(toast.id)}
        className="btn btn-sm btn-ghost btn-circle flex-shrink-0 ml-auto"
        aria-label="关闭通知"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};

const ToastContainer: React.FC = () => {
  const { toasts, toast: toastApi } = useToast();
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    // 检测屏幕大小变化
    const mediaQuery = window.matchMedia('(max-width: 767px)');
    
    // 设置初始状态
    setIsMobile(mediaQuery.matches);
    
    // 监听屏幕大小变化
    const handleChange = (e: MediaQueryListEvent) => {
      setIsMobile(e.matches);
    };
    
    mediaQuery.addEventListener('change', handleChange);
    
    // 清理监听器
    return () => {
      mediaQuery.removeEventListener('change', handleChange);
    };
  }, []);

  // 动画配置
  // 使用 x, y 数值而不是直接的 transform 字符串，以确保插值能够正确执行
  // 之前的 bug 是因为 enter 使用 translate3d(3个值) 而 leave 使用 translateX(1个值)，导致插值失败
  const transitions = useTransition(toasts, {
    from: { 
      x: isMobile ? 0 : 100, 
      y: isMobile ? 300 : 0 
    },
    enter: { 
      x: 0, 
      y: 0 
    },
    leave: { 
      x: isMobile ? 0 : 100,
      y: isMobile ? 300 : 0
    },
    keys: (toast) => toast.id,
    config: { tension: 300, friction: 30 },
  });

  // 渲染动画项
  const items = transitions(({ x, y }, toast) => (
    <animated.div 
      style={{
        transform: isMobile 
          ? y.to(v => `translate3d(0, ${v}%, 0)`)
          : x.to(v => `translate3d(${v}%, 0, 0)`)
      }}
    >
      <ToastItem
        toast={toast}
        onDismiss={toastApi.dismiss}
      />
    </animated.div>
  ));
  
  // 确保 items 是数组
  const renderedItems = Array.isArray(items) ? items : [items];
  
  // 如果没有要渲染的项（包括正在退出的项），则不渲染容器（销毁 DOM）
  // 只有当 transitions 列表确实为空时，才销毁
  // 在 react-spring 中，如果 transitions 没有内容，可能返回 null 或空数组
  if (!items || (Array.isArray(items) && items.length === 0)) {
    return null;
  }

  // 根据屏幕大小动态设置toast位置
  // z-index 提高到 9999 以防被遮挡
  const toastClasses = cn(
    'toast z-[9999]',
    isMobile 
      ? 'toast-bottom toast-center pb-[env(safe-area-inset-bottom)]' 
      : 'toast-top toast-end'
  );

  return (
    <div className={toastClasses}>
      {renderedItems}
    </div>
  );
};

export default ToastContainer;