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
    <div className={theme === 'dark' ? 'dark' : ''}>
      <Layout />
      <Toaster 
        theme={theme}
        position="top-right"
        richColors
      />
    </div>
  );
}

export default App;
