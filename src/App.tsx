import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import { Toaster } from 'sonner';
import { useAppStore } from './store';
import ChatPage from './pages/ChatPage';
import SettingsPage from './pages/SettingsPage';

function App() {
  const { theme } = useAppStore();

  return (
    <div>
      <Layout />
      <Toaster 
        theme={theme === 'dark' ? 'dark' : 'light'}
        position="top-right"
        richColors
        toastOptions={{
          unstyled: true,
          classNames: {
            toast: 'alert shadow-lg border-0 border-radius-[var(--radius-box)] max-w-sm sm:max-w-sm',
            title: 'font-semibold text-base',
            description: 'text-sm opacity-80',
            actionButton: 'btn btn-sm btn-primary',
            cancelButton: 'btn btn-sm btn-ghost',
            closeButton: 'btn btn-sm btn-ghost btn-circle',
            success: 'alert-success',
            error: 'alert-error',
            info: 'alert-info',
            warning: 'alert-warning',
          },
        }}
      />
    </div>
  );
}

export default App;
