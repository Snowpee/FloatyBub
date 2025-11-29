import React, { memo } from 'react';
import { X } from 'lucide-react';
import HistoryPage from '../pages/HistoryPage';
import { Capacitor } from '@capacitor/core';
import BottomSheetModal from './BottomSheetModal';

interface HistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const HistoryModalNew = memo<HistoryModalProps>(({ isOpen, onClose }) => {
  const isCapacitorIOS = Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios';

  console.log('[HistoryModal] render', { isOpen, isCapacitorIOS });

  if (!isOpen) return null;

  return (
    <BottomSheetModal
      isOpen={isOpen}
      onOpenChange={(open) => {
        console.log('[HistoryModal] parent onOpenChange', { open, platform: Capacitor.getPlatform(), isCapacitor: Capacitor.isNativePlatform() });
        if (!open) {
          console.log('[HistoryModal] trigger: bottom-sheet requested close via onOpenChange(false)');
          onClose();
        }
      }}
      onClose={() => {
        console.log('[HistoryModal] parent onClose invoked');
        onClose();
      }}
      dismissible={true}
      dragEnabled={true}
      distanceThreshold={120}
      velocityThreshold={0.5}
      rubberband={true}
      safeArea={true}
      debug={false}
      headerTitle={<div className="text-center text-lg font-semibold text-base-content">历史记录</div>}
      rightActions={[{ icon: <X className="h-4 w-4" />, className: 'btn btn-ghost btn-sm btn-square', role: 'close' }]}
    >
      <div className="flex-1 overflow-hidden">
        <div className="h-full overflow-y-auto">
          <HistoryPage onCloseModal={() => {
            console.log('[HistoryModal] trigger: HistoryPage requested close');
            onClose();
          }} />
        </div>
      </div>
    </BottomSheetModal>
  );
});

export default HistoryModalNew;

