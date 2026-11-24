import { useContext } from 'react';
import { SettingsNavigationContext } from '@/screens/settings/SettingsNavigationContext';
import GlobalSettingsDesktop from './GlobalSettings.Desktop';
import GlobalSettingsMobile from './GlobalSettings.Mobile';

export interface GlobalSettingsProps {
  onCloseModal?: () => void;
  className?: string;
}

export default function GlobalSettings(props: GlobalSettingsProps) {
  const navigation = useContext(SettingsNavigationContext);
  // The shell owns the platform decision. A desktop dialog never picks the
  // mobile controls based on an unrelated viewport or user-agent heuristic.
  return navigation ? <GlobalSettingsMobile {...props} /> : <GlobalSettingsDesktop {...props} />;
}
