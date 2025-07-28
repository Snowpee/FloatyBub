import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import './index.css';
import { router } from './router';
import { useAppStore } from './store';

// 初始化主题
const initializeTheme = () => {
  const storedData = localStorage.getItem('ai-chat-storage');
  if (storedData) {
    try {
      const { state } = JSON.parse(storedData);
      const theme = state?.theme || 'light';
      document.documentElement.setAttribute('data-theme', theme);
      if (theme === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    } catch (error) {
      console.warn('Failed to initialize theme:', error);
      document.documentElement.setAttribute('data-theme', 'light');
    }
  } else {
    document.documentElement.setAttribute('data-theme', 'light');
  }
};

// 在渲染前初始化主题
initializeTheme();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
