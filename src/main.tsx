import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import './index.css';
import { router } from './router';
import { useAppStore } from './store';

// 主题初始化现在完全由 zustand store 负责
// 这里只设置一个默认主题，防止闪烁
document.documentElement.setAttribute('data-theme', 'light');
console.log('🚀 设置默认主题，等待 store 初始化');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
