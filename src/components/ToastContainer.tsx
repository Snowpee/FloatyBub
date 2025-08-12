import React, { useState, useEffect } from 'react';
import { useToast, ToastMessage } from '../hooks/useToast';
import { X, CheckCircle, XCircle, Info, AlertTriangle } from 'lucide-react';
import { cn } from '../lib/utils';

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
    <div className={cn('alert shadow-lg w-80 md:min-w-80 md:max-w-80 bg-base-100/80 glass')}>
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

  // 根据屏幕大小动态设置toast位置
  const toastClasses = cn(
    'toast toast-top z-50',
    isMobile ? 'toast-center pt-[env(safe-area-inset-top)]' : 'toast-end'
  );

  return (
    <div className={toastClasses}>
      {toasts.map((toast) => (
        <ToastItem
          key={toast.id}
          toast={toast}
          onDismiss={toastApi.dismiss}
        />
      ))}
    </div>
  );
};

export default ToastContainer;