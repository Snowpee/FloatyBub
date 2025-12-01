import React from 'react';
import { NavProvider, NavContainer, NavLink, BackButton, useNav } from '../../components/navigation/MobileNav';
import GlobalSettingsPage from '../../screens/settings/sections/GlobalSettingsPage';
import ToastTestPage from './ToastTestPage';

const PageShell: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="flex flex-col h-full bg-base-100">
    <div className="flex items-center justify-between p-4">
      <BackButton>← 返回</BackButton>
      <h1 className="text-2xl font-bold">{title}</h1>
      <div className="w-16"></div>
    </div>
    <div className="flex-1 overflow-auto">{children}</div>
  </div>
);

const SettingsNavPage: React.FC = () => {
  const nav = useNav();
  return (
    <PageShell title="Settings">
      <GlobalSettingsPage onCloseModal={() => nav.pop()} />
    </PageShell>
  );
};

const ToastNavPage: React.FC = () => (
  <PageShell title="Toast Playground">
    <ToastTestPage />
  </PageShell>
);

const HomePage: React.FC = () => {
  const nav = useNav();
  return (
    <div className="flex flex-col h-full mt-[env(safe-area-inset-top)] bg-gradient-to-br from-blue-50 to-indigo-50 p-6">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold text-gray-800">MobileNav Standalone</h1>
      </div>
      <div className="space-y-4">
        <NavLink component={SettingsNavPage} className="btn btn-primary w-full">Open Settings</NavLink>
        <NavLink component={ToastNavPage} className="btn btn-secondary w-full">Open Toast Playground</NavLink>
        <button onClick={() => nav.push(ToastNavPage)} className="btn btn-accent w-full">Push via API</button>
      </div>
    </div>
  );
};

export default function MobileNavStandalone() {
  return (
    <div className="w-full h-screen mt-[env(safe-area-inset-top)]">
      <NavProvider root={HomePage}>
        <NavContainer animated swipeGesture />
      </NavProvider>
    </div>
  );
}