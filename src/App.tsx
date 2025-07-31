import React from 'react';
import Layout from './components/Layout';
import ToastContainer from './components/ToastContainer';

function App() {
  console.log('🚀 [App] App 组件渲染');
  return (
    <div>
      <Layout />
      <ToastContainer />
      {/* 移除重复的 Outlet，Layout 组件内部已经有了 */}
    </div>
  );
}

export default App;
