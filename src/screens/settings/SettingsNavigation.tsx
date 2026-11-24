import { useContext, type ComponentType, type ReactNode } from 'react';
import { SettingsNavigationContext } from './SettingsNavigationContext';

type NavLinkProps = {
  component: ComponentType<Record<string, unknown>>;
  props?: Record<string, unknown>;
  children: ReactNode;
  className?: string;
};

export function NavLink({ component, props, children, className }: NavLinkProps) {
  const navigation = useContext(SettingsNavigationContext);
  if (!navigation) throw new Error('Settings NavLink requires SettingsNavigationContext');
  return (
    <button type="button" className={className} onClick={() => navigation.push(component, props)}>
      {children}
    </button>
  );
}

export function BackButton({ children = '返回', className }: { children?: ReactNode; className?: string }) {
  const navigation = useContext(SettingsNavigationContext);
  if (!navigation) throw new Error('Settings BackButton requires SettingsNavigationContext');
  return (
    <button type="button" aria-label="返回" className={className} onClick={(event) => {
      event.preventDefault();
      event.stopPropagation();
      navigation.pop();
    }}>
      {children}
    </button>
  );
}
