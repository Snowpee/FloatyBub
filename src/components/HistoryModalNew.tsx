import React from 'react';
import { X } from 'lucide-react';
import HistoryPage from '../pages/HistoryPage';
import { Capacitor } from '@capacitor/core';
import BottomSheetModal from './BottomSheetModal';

interface HistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const HistoryModalNew: React.FC<HistoryModalProps> = ({ isOpen, onClose }) => {
  const isCapacitorIOS = Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios';

  if (!isOpen) return null;

  return (
    <BottomSheetModal
      isOpen={isOpen}
      onOpenChange={(open) => { if (!open) onClose(); }}
      onClose={onClose}
      dismissible={true}
      dragEnabled={isCapacitorIOS}
      distanceThreshold={120}
      velocityThreshold={0.5}
      rubberband={true}
      safeArea={true}
      debug={false}
      headerTitle={<div className="text-center text-lg font-semibold text-base-content">历史记录</div>}
      rightActions={[{ icon: <X className="h-4 w-4" />, className: 'btn btn-ghost btn-sm btn-square', role: 'close' }]}
    >
      <div className="flex-1 overflow-hidden">
        <div className="h-full overflow-y-auto pt-4">
          <HistoryPage onCloseModal={onClose} />
        </div>
      </div>
    </BottomSheetModal>
  );
};

export default HistoryModalNew;

