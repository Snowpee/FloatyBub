import React, { useState, useEffect, lazy, Suspense } from 'react';
import SettingsModalDesktop from './SettingsModal.Desktop';
const SettingsModalMobile = lazy(() => import('./SettingsModal.Mobile'));
import { TabType } from './config';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTab?: TabType;
}

const SettingsModal: React.FC<SettingsModalProps> = (props) => {
  const [isMobile, setIsMobile] = useState(() => window.matchMedia('(max-width: 767px)').matches);

  useEffect(() => {
    const query = window.matchMedia('(max-width: 767px)');
    const checkMobile = () => setIsMobile(query.matches);
    checkMobile();
    query.addEventListener('change', checkMobile);
    return () => query.removeEventListener('change', checkMobile);
  }, []);

  // 根据设备类型分发渲染
  if (isMobile) {
    return <Suspense fallback={null}><SettingsModalMobile {...props} /></Suspense>;
  }

  return <SettingsModalDesktop {...props} />;
};

export default SettingsModal;
