import React from 'react';
import { NavProvider, NavContainer, NavLink, BackButton, useNav } from '../../components/navigation/MobileNav';
import GlobalSettingsPage from '../GlobalSettingsPage';
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
    <div className="flex flex-col h-full bg-gradient-to-br from-blue-50 to-indigo-50 p-6">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold text-gray-800">Home</h1>
      </div>
      <div className="space-y-4">
        <NavLink component={SettingsNavPage} className="btn btn-primary w-full">Open Settings</NavLink>
        <NavLink component={ToastNavPage} className="btn btn-secondary w-full">Open Toast Playground</NavLink>
        <button onClick={() => nav.push(ToastNavPage)} className="btn btn-accent w-full">Push via API</button>
      </div>
      <div className="mt-8 p-4 bg-white rounded-lg shadow">
        <h3 className="font-semibold mb-2">导航栈信息</h3>
        <p className="text-sm text-gray-600">当前栈深度: {nav.stack.length}</p>
        <p className="text-sm text-gray-600">可返回: {nav.canGoBack() ? '是' : '否'}</p>
      </div>
    </div>
  );
};

const DetailPage: React.FC<{ title?: string; color?: string }> = ({ title = 'Detail', color = 'bg-blue-500' }) => {
  const nav = useNav();
  return (
    <div className={`flex flex-col h-full ${color} p-6 text-white`}>
      <div className="flex items-center justify-between mb-8">
        <BackButton>← 返回</BackButton>
        <h1 className="text-2xl font-bold">{title}</h1>
        <div className="w-16"></div>
      </div>
      <div className="flex-1 flex flex-col justify-center items-center space-y-4">
        <div className="bg-white/20 backdrop-blur-sm p-6 rounded-xl">
          <p className="text-lg mb-4">这是 {title} 页面</p>
          <p className="text-sm opacity-80">栈深度: {nav.stack.length}</p>
        </div>
        <NavLink component={DetailPage} props={{ title: `${title} - Nested`, color: 'bg-pink-500' }} className="btn btn-ghost bg-white/20 hover:bg-white/30">Push Another Page</NavLink>
        {nav.stack.length > 2 && (
          <button onClick={() => nav.popToRoot()} className="btn btn-ghost bg-white/20 hover:bg-white/30">Pop to Root</button>
        )}
      </div>
    </div>
  );
};

const SettingsPage: React.FC = () => {
  const nav = useNav();
  return (
    <div className="flex flex-col h-full bg-gradient-to-br from-gray-50 to-gray-100 p-6">
      <div className="flex items-center justify-between mb-8">
        <BackButton>← 返回</BackButton>
        <h1 className="text-2xl font-bold">Settings</h1>
        <div className="w-16"></div>
      </div>
      <div className="space-y-4">
        <div className="card bg-base-100 shadow-xl">
          <div className="card-body">
            <h2 className="card-title">账户设置</h2>
            <p className="text-gray-600">管理你的账户信息</p>
          </div>
        </div>
        <div className="card bg-base-100 shadow-xl">
          <div className="card-body">
            <h2 className="card-title">通知</h2>
            <p className="text-gray-600">配置通知偏好</p>
          </div>
        </div>
        <button onClick={() => nav.replace(HomePage)} className="btn btn-error w-full mt-4">Replace with Home</button>
      </div>
    </div>
  );
};

export default function MobileNavPlayground() {
  return (
    <div className="w-full h-[calc(100vh-4rem)]">
      <NavProvider root={HomePage}>
        <NavContainer animated swipeGesture />
      </NavProvider>
    </div>
  );
}