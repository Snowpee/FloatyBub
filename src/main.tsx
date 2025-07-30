import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import './index.css';
import { router } from './router';
import { useAppStore } from './store';

// 主题初始化完全由 zustand store 负责
// 不在这里设置默认主题，避免覆盖存储的主题
console.log('🚀 等待 store 初始化主题');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
