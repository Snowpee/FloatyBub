import React, { memo, useState, useEffect } from 'react';
import { X } from 'lucide-react';
import HistoryContent from './HistoryContent';
import BottomSheetModal from '../../components/BottomSheetModal';

interface HistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const HistoryModal = memo<HistoryModalProps>(({ isOpen, onClose }) => {
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

  if (!isOpen) return null;

  // 桌面端：使用 DaisyUI Modal (Method 1: <dialog> element)
  if (isDesktop) {
    return (
      <dialog className="modal modal-open modal-middle" open>
        <div className="modal-box w-11/12 max-w-4xl h-[80vh] p-0 flex flex-col bg-base-100 shadow-2xl">
            {/* Header */}
            <div className="px-4 py-3 flex items-center justify-between border-b border-base-200">
                <div className="text-lg font-bold text-base-content">历史记录</div>
                <form method="dialog">
                  {/* if there is a button in form, it will close the modal */}
                  <button className="btn btn-sm btn-circle btn-ghost" onClick={onClose}>
                    <X className="h-5 w-5" />
                  </button>
                </form>
            </div>
            
            {/* Content */}
            <div className="flex-1 overflow-auto relative">
                <HistoryContent onCloseModal={onClose} />
            </div>
        </div>
        
        {/* Backdrop - DaisyUI recommended structure */}
        <form method="dialog" className="modal-backdrop">
            <button onClick={onClose}>close</button>
        </form>
      </dialog>
    );
  }

  // 移动端：使用 BottomSheetModal
  return (
    <BottomSheetModal
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}
      onClose={onClose}
      dismissible={true}
      dragEnabled={true}
      distanceThreshold={120}
      velocityThreshold={0.5}
      rubberband={true}
      safeArea={true}
      headerTitle={<div className="text-center text-lg font-semibold text-base-content">历史记录</div>}
      rightActions={[{ icon: <X className="h-4 w-4" />, className: 'btn btn-ghost btn-sm btn-square', role: 'close' }]}
    >
      <div className="flex-1 overflow-hidden">
        <div className="h-full overflow-y-auto">
          <HistoryContent onCloseModal={onClose} />
        </div>
      </div>
    </BottomSheetModal>
  );
});

export default HistoryModal;
