import { useContext } from 'react';
import { SettingsNavigationContext } from '../SettingsNavigationContext';
import ConfigSettingsDesktop from './ConfigSettings.Desktop';
import ConfigSettingsMobile from './ConfigSettings.Mobile';

export interface ConfigSettingsProps {
  onCloseModal?: () => void;
  className?: string;
}

export default function ConfigSettings(props: ConfigSettingsProps) {
  return useContext(SettingsNavigationContext)
    ? <ConfigSettingsMobile /> : <ConfigSettingsDesktop {...props} />;
}
