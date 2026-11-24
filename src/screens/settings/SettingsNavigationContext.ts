import { createContext, type ComponentType } from 'react';

export interface SettingsNavigation {
  push: (component: ComponentType<Record<string, unknown>>, props?: Record<string, unknown>, options?: { layout: 'ionic' }) => void;
  pop: () => void;
  setBackNavigationGuard?: (guard: (() => Promise<boolean>) | null) => void;
}

// Ionic provides navigation; desktop and standalone routes use inline details.
export const SettingsNavigationContext = createContext<SettingsNavigation | null>(null);

