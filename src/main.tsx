import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import './index.css';
import { router } from './router';
import { useAppStore } from './store';
import { toast } from './hooks/useToast';

// 主题初始化完全由 zustand store 负责
// 不在这里设置默认主题，避免覆盖存储的主题
console.log('🚀 等待 store 初始化主题');

// 将toast暴露到全局作用域，方便在控制台测试
(window as any).toast = toast;
console.log('🔔 Toast已暴露到全局作用域，可在控制台使用 toast.success("测试消息") 等方法测试');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
