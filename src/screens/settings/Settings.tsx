import React, { useState, useEffect } from 'react';
import SettingsModalDesktop from './SettingsModal.Desktop';
import SettingsModalMobile from './SettingsModal.Mobile';
import { TabType } from './config';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTab?: TabType;
}

const SettingsModal: React.FC<SettingsModalProps> = (props) => {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    // 初始检测
    checkMobile();

    // 监听窗口大小变化
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // 根据设备类型分发渲染
  if (isMobile) {
    return <SettingsModalMobile {...props} />;
  }

  return <SettingsModalDesktop {...props} />;
};

export default SettingsModal;
