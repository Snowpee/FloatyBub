import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import './index.css';
import { router } from './router';
import { useAppStore } from './store';

// 初始化主题
const initializeTheme = () => {
  console.log('🚀 应用主题初始化开始');
  
  const storedData = localStorage.getItem('ai-chat-storage');
  console.log('🚀 localStorage 数据:', storedData ? '存在' : '不存在');
  
  if (storedData) {
    try {
      const { state } = JSON.parse(storedData);
      const theme = state?.theme || 'light';
      console.log('🚀 从 localStorage 读取的主题:', theme);
      
      document.documentElement.setAttribute('data-theme', theme);
      console.log('🚀 设置 data-theme 属性:', theme);
      
      // 只为 dark 主题添加 dark class，其他主题完全依赖 DaisyUI
      if (theme === 'dark') {
        document.documentElement.classList.add('dark');
        console.log('🚀 添加 dark 类');
      } else {
        document.documentElement.classList.remove('dark');
        console.log('🚀 移除 dark 类');
      }
    } catch (error) {
      console.error('🚀 解析存储的主题数据失败:', error);
      document.documentElement.setAttribute('data-theme', 'light');
      console.log('🚀 设置默认主题: light');
    }
  } else {
    document.documentElement.setAttribute('data-theme', 'light');
    console.log('🚀 设置默认主题: light (无存储数据)');
  }
  
  console.log('🚀 应用主题初始化完成');
};

// 在渲染前初始化主题
initializeTheme();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
