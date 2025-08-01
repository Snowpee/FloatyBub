import React from 'react';
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
        return <CheckCircle className="w-5 h-5" />;
      case 'error':
        return <XCircle className="w-5 h-5" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5" />;
      case 'info':
      default:
        return <Info className="w-5 h-5" />;
    }
  };

  const getAlertClass = () => {
    switch (toast.type) {
      case 'success':
        return 'alert-success';
      case 'error':
        return 'alert-error';
      case 'warning':
        return 'alert-warning';
      case 'info':
      default:
        return 'alert-info';
    }
  };

  return (
    <div className={cn('alert shadow-lg w-80 min-w-80 max-w-80', getAlertClass())}>
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

  console.log('🎨 [ToastContainer] 组件渲染，接收到的通知数量:', toasts.length);
  console.log('🎨 [ToastContainer] 通知详情:', toasts.map(t => ({ id: t.id, type: t.type, message: t.message, position: t.position })));

  // 按位置分组toasts
  const groupedToasts = toasts.reduce((acc, toast) => {
    const position = toast.position || 'top-end';
    if (!acc[position]) {
      acc[position] = [];
    }
    acc[position].push(toast);
    return acc;
  }, {} as Record<string, ToastMessage[]>);

  console.log('🎨 [ToastContainer] 分组后的通知:', Object.keys(groupedToasts).map(pos => ({ position: pos, count: groupedToasts[pos].length })));

  const getPositionClasses = (position: string) => {
    const baseClasses = 'toast z-50';
    
    switch (position) {
      case 'top-start':
        return `${baseClasses} toast-top toast-start`;
      case 'top-center':
        return `${baseClasses} toast-top toast-center`;
      case 'top-end':
        return `${baseClasses} toast-top toast-end`;
      case 'middle-start':
        return `${baseClasses} toast-start toast-middle`;
      case 'middle-center':
        return `${baseClasses} toast-center toast-middle`;
      case 'middle-end':
        return `${baseClasses} toast-end toast-middle`;
      case 'bottom-start':
        return `${baseClasses} toast-start`;
      case 'bottom-center':
        return `${baseClasses} toast-center`;
      case 'bottom-end':
        return `${baseClasses} toast-end`;
      default:
        return `${baseClasses} toast-top toast-end`;
    }
  };

  return (
    <>
      {Object.entries(groupedToasts).map(([position, positionToasts]) => (
        <div key={position} className={getPositionClasses(position)}>
          {positionToasts.map((toast) => (
            <ToastItem
              key={toast.id}
              toast={toast}
              onDismiss={toastApi.dismiss}
            />
          ))}
        </div>
      ))}
    </>
  );
};

export default ToastContainer;