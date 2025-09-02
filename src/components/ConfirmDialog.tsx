import React, { useEffect, useRef } from 'react';
import { AlertTriangle, X } from 'lucide-react';

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

  const handleConfirm = (_e: React.FormEvent) => {
    // 先关闭对话框，避免等待异步操作导致关闭延迟
    dialogRef.current?.close();
    onConfirm();
  };

  const handleDialogClose = () => {
    onClose();
  };

  const getVariantClasses = () => {
    switch (variant) {
      case 'danger':
        return {
          icon: 'text-error',
          confirmButton: 'btn-error'
        };
      case 'warning':
        return {
          icon: 'text-warning',
          confirmButton: 'btn-warning'
        };
      case 'info':
        return {
          icon: 'text-info',
          confirmButton: 'btn-info'
        };
      default:
        return {
          icon: 'text-error',
          confirmButton: 'btn-error'
        };
    }
  };

  const variantClasses = getVariantClasses();

  return (
    <dialog 
      ref={dialogRef}
      className="modal"
      onClose={handleDialogClose}
    >
      <div className="modal-box max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-base-200">
              <AlertTriangle className={`w-5 h-5 ${variantClasses.icon}`} />
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
          <form method="dialog" onSubmit={handleConfirm}>
            <button
              type="submit"
              className={`btn ${variantClasses.confirmButton}`}
            >
              {confirmText}
            </button>
          </form>
        </div>
      </div>
      <form method="dialog" className="modal-backdrop">
        <button>close</button>
      </form>
    </dialog>
  );
};

export default ConfirmDialog;