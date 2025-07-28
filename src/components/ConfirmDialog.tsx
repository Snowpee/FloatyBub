import React, { useEffect, useRef } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { cn } from '../lib/utils';

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info';
}

const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = '确认',
  cancelText = '取消',
  variant = 'danger'
}) => {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen) {
      dialog.showModal();
    } else {
      dialog.close();
    }
  }, [isOpen]);

  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  const handleDialogClose = () => {
    onClose();
  };

  const variantStyles = {
    danger: {
      icon: 'text-red-500',
      confirmButton: 'bg-red-500 hover:bg-red-600 text-white',
      iconBg: 'bg-red-100'
    },
    warning: {
      icon: 'text-yellow-500',
      confirmButton: 'bg-yellow-500 hover:bg-yellow-600 text-white',
      iconBg: 'bg-yellow-100'
    },
    info: {
      icon: 'text-blue-500',
      confirmButton: 'bg-blue-500 hover:bg-blue-600 text-white',
      iconBg: 'bg-blue-100'
    }
  };

  const styles = variantStyles[variant];

  return (
    <dialog 
      ref={dialogRef}
      className="modal"
      onClose={handleDialogClose}
    >
      <div className="modal-box max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className={cn('p-2 rounded-full', styles.iconBg)}>
              <AlertTriangle className={cn('w-5 h-5', styles.icon)} />
            </div>
            <h3 className="text-lg font-semibold">
              {title}
            </h3>
          </div>
          <form method="dialog">
            <button className="btn btn-sm btn-circle btn-ghost">
              <X className="w-4 h-4" />
            </button>
          </form>
        </div>

        {/* Content */}
        <div className="mb-6">
          <p className="leading-relaxed">
            {message}
          </p>
        </div>

        {/* Actions */}
        <div className="modal-action">
          <form method="dialog">
            <button className="btn btn-ghost mr-3">
              {cancelText}
            </button>
          </form>
          <button
            onClick={handleConfirm}
            className={cn(
              'btn',
              variant === 'danger' && 'btn-error',
              variant === 'warning' && 'btn-warning', 
              variant === 'info' && 'btn-info'
            )}
          >
            {confirmText}
          </button>
        </div>
      </div>
      <form method="dialog" className="modal-backdrop">
        <button>close</button>
      </form>
    </dialog>
  );
};

export default ConfirmDialog;