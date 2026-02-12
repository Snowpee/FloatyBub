import React, { useEffect } from 'react';
import Layout from './Layout';
import ToastContainer from './components/ToastContainer';
import { databaseConnectionTester } from './utils/databaseConnectionTest';

const console: Console = { ...globalThis.console, log: (..._args: any[]) => {} };

export function App() {
  console.log('🚀 [App] App 组件渲染');
  
  useEffect(() => {
    // 应用启动时测试数据库连接
    const initializeDatabaseConnection = async () => {
      console.log('🚀 [App] 应用启动，开始数据库连接测试...');
      
      try {
        const result = await databaseConnectionTester.testConnection();
        
        if (result.isConnected) {
          console.log('🚀 [App] ✅ 数据库连接成功，应用已就绪');
          
          // 启动定期连接检查（每分钟检查一次）
          databaseConnectionTester.startPeriodicCheck(60000);
        } else {
          console.warn('🚀 [App] ⚠️ 数据库连接失败，部分功能可能受限:', result.error);
        }
      } catch (error) {
        console.error('🚀 [App] ❌ 数据库连接测试异常:', error);
      }
    };
    
    // 延迟执行，确保其他初始化完成
    setTimeout(initializeDatabaseConnection, 1000);
  }, []);
  
  return (
    <div>
      <Layout />
      <ToastContainer />
      {/* 移除重复的 Outlet，Layout 组件内部已经有了 */}
    </div>
  );
}

