import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Plus, RefreshCw } from 'lucide-react';
import { InputProvider } from '../../../components/InputProvider';
import BottomSheetModal from '../../../components/BottomSheetModal';

interface VoiceModelModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (modelId: string, note: string) => Promise<void>;
  isAdding: boolean;
}

const VoiceModelModal: React.FC<VoiceModelModalProps> = ({
  isOpen,
  onClose,
  onAdd,
  isAdding
}) => {
  // 简单的桌面端检测逻辑
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    // 初始化检测
    setIsDesktop(window.innerWidth >= 1024);

    const checkDesktop = () => {
      setIsDesktop(window.innerWidth >= 1024);
    };
    
    window.addEventListener('resize', checkDesktop);
    return () => window.removeEventListener('resize', checkDesktop);
  }, []);

  const [newModelInput, setNewModelInput] = useState('');
  const [newModelNote, setNewModelNote] = useState('');

  useEffect(() => {
    if (isOpen) {
      setNewModelInput('');
      setNewModelNote('');
    }
  }, [isOpen]);

  const handleAdd = () => {
    onAdd(newModelInput, newModelNote);
  };

  const ModalContent = (
    <InputProvider>
      <div className="flex flex-col gap-4">
        {/* 模型信息 */}
      <fieldset className="bub-fieldset">
        <label className="bub-input w-full">
          <span className="label">模型 ID / URL</span>
          <input
            type="text"
            className=""
            value={newModelInput}
            onChange={(e) => setNewModelInput(e.target.value)}
            placeholder="输入模型ID或Fish Audio网址"
          />
        </label>
      </fieldset>

      {/* 用户备注 */}
      <fieldset className="bub-fieldset">
        <label className="bub-input w-full">
          <span className="label">备注</span>
          <input
            type="text"
            className=""
            value={newModelNote}
            onChange={(e) => setNewModelNote(e.target.value)}
            placeholder="为此模型添加备注"
          />
        </label>
      </fieldset>
      </div>
    </InputProvider>
  );

  if (!isOpen) return null;

  // 桌面端渲染
  if (isDesktop) {
    return createPortal(
      <dialog className="modal modal-open modal-middle" open>
        <div className="modal-box w-full max-w-md bg-base-200 shadow-2xl">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-base-content">
              添加新模型
            </h2>
            <button
              onClick={onClose}
              className="btn btn-ghost btn-sm btn-circle"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="py-4">
            {ModalContent}
          </div>

          <div className="modal-action">
            <button
              onClick={onClose}
              className="btn btn-ghost"
            >
              取消
            </button>
            <button
              onClick={handleAdd}
              className="btn btn-primary"
              disabled={isAdding || !newModelInput.trim()}
            >
              {isAdding ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              {isAdding ? '添加中...' : '添加模型'}
            </button>
          </div>
        </div>
        <form method="dialog" className="modal-backdrop">
          <button onClick={onClose}>close</button>
        </form>
      </dialog>,
      document.body
    );
  }

  // 移动端渲染
  return createPortal(
    <BottomSheetModal
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      onClose={onClose}
      dismissible={true}
      dragEnabled={true}
      distanceThreshold={120}
      velocityThreshold={0.5}
      rubberband={true}
      safeArea={true}
      headerTitle={<div className="text-center text-lg font-semibold text-base-content">添加新模型</div>}
      rightActions={[
        { 
          icon: isAdding ? <RefreshCw className="h-5 w-5 animate-spin" /> : <Plus className="h-5 w-5" />, 
          className: 'btn btn-primary btn-square', 
          onClick: handleAdd,
          disabled: isAdding || !newModelInput.trim()
        }
      ]}
      leftActions={[
        {
          icon: <X className="h-5 w-5" />,
          className: 'btn btn-ghost btn-square bg-base-100',
          role: 'close'
        }
      ]}
    >
      <div className="flex-1 overflow-hidden">
        <div className="h-full overflow-y-auto px-4 pb-8 pt-4">
          {ModalContent}
        </div>
      </div>
    </BottomSheetModal>,
    document.body
  );
};

export default VoiceModelModal;
