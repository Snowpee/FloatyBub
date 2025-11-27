import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export interface ActionSheetItem {
  /** Label for the action button */
  label: React.ReactNode;
  /** Callback when the action is clicked */
  onClick: () => void;
  /** Whether the action is disabled */
  disabled?: boolean;
  /** Whether the action is destructive (displays in red) */
  destructive?: boolean;
  /** Custom class name for the action button */
  className?: string;
}

export interface ActionSheetProps {
  /** Whether the action sheet is open */
  isOpen: boolean;
  /** Callback to close the action sheet */
  onClose: () => void;
  /** Optional title displayed at the top */
  title?: React.ReactNode;
  /** Optional description displayed below the title */
  description?: React.ReactNode;
  /** List of actions to display */
  actions: ActionSheetItem[];
  /** Label for the cancel button. Defaults to "取消" (Cancel) */
  cancelLabel?: string;
  /** Whether to show the cancel button. Defaults to true */
  showCancel?: boolean;
  /** Class name for the outer modal container */
  className?: string;
}

/**
 * ActionSheet Component
 * 
 * An iOS-style action sheet that slides up from the bottom.
 * Uses DaisyUI modal classes but overrides internal styling to match iOS design patterns:
 * - Floating rounded groups
 * - Separated cancel button
 * - Blurred background support (if configured in theme)
 */
export const ActionSheet: React.FC<ActionSheetProps> = ({
  isOpen,
  onClose,
  title,
  description,
  actions,
  cancelLabel = '取消',
  showCancel = true,
  className,
}) => {
  // Combine classes safely
  const modalClasses = twMerge(
    'modal modal-bottom',
    isOpen && 'modal-open',
    className
  );

  return (
    <dialog className={modalClasses}>
      {/* Backdrop - clicking closes the modal */}
      <form method="dialog" className="modal-backdrop">
        <button onClick={onClose} type="button" className="cursor-default">close</button>
      </form>

      {/* 
        Container
        We use bg-transparent and shadow-none because we want to visually separate 
        the action list and the cancel button, effectively "breaking" the default 
        single-block modal style.
      */}
      <div className="modal-box bg-transparent shadow-none p-4 w-full max-w-md mx-auto border-none">
        
        {/* Main Action Group */}
        <div className="flex flex-col p-2 rounded-[var(--radius-box)] bg-base-100/50 backdrop-blur-lg overflow-hidden shadow-lg">
          {/* Header Section (Title & Description) */}
          {(title || description) && (
            <div className="px-4 py-3 pt-0 text-center">
              {title && (
                <div className="text-sm font-semibold text-base-content/70">
                  {title}
                </div>
              )}
              {description && (
                <div className="text-xs text-base-content/50 mt-1">
                  {description}
                </div>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col gap-2 pt-0">
            {actions.map((action, index) => (
              <button
                key={index}
                disabled={action.disabled}
                onClick={() => {
                  action.onClick();
                  onClose();
                }}
                className={clsx(
                  // Base styles
                  'btn btn-base w-full h-10',
                  // Colors
                  action.destructive ? 'text-error' : 'text-base-content',
                  // Disabled state
                  action.disabled && 'opacity-50 cursor-not-allowed',
                  // Custom class
                  action.className
                )}
              >
                {action.label}
              </button>
            ))}
          </div>
        </div>

        {/* Cancel Button (Separated) */}
        {showCancel && (
          <div className="mt-3 rounded-[var(--radius-field)] bg-base-100/50 backdrop-blur-lg shadow-lg overflow-hidden">
            <button
              onClick={onClose}
              className="w-full py-3.5 px-4 text-center text-[17px] font-semibold text-primary active:bg-base-200 transition-colors outline-none"
            >
              {cancelLabel}
            </button>
          </div>
        )}
      </div>
    </dialog>
  );
};

export default ActionSheet;
