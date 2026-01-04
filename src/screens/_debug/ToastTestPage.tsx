import React from 'react';
import { toast } from '@/hooks/useToast';
import { CheckCircle, XCircle, Info, AlertTriangle } from 'lucide-react';

const ToastTestPage: React.FC = () => {
  const handleSuccessToast = () => {
    console.log('🟢 [ToastTest] 点击成功通知按钮');
    const result = toast.success('操作成功完成！', {
      title: '成功',
      duration: 3000
    });
    console.log('🟢 [ToastTest] toast.success 返回值:', result);
  };

  const handleErrorToast = () => {
    console.log('🔴 [ToastTest] 点击错误通知按钮');
    const result = toast.error('发生了一个错误，请重试。', {
      title: '错误',
      duration: 5000
    });
    console.log('🔴 [ToastTest] toast.error 返回值:', result);
  };

  const handleInfoToast = () => {
    console.log('🔵 [ToastTest] 点击信息通知按钮');
    const result = toast.info('这是一条信息提示。', {
      duration: 4000
    });
    console.log('🔵 [ToastTest] toast.info 返回值:', result);
  };

  const handleWarningToast = () => {
    console.log('🟡 [ToastTest] 点击警告通知按钮');
    const result = toast.warning('请注意这个警告信息。', {
      title: '警告',
      duration: 4000
    });
    console.log('🟡 [ToastTest] toast.warning 返回值:', result);
  };

  const handleCustomPositionToast = () => {
    console.log('🟣 [ToastTest] 点击居中位置按钮');
    const result = toast.success('这是一个居中显示的通知', {
      position: 'top-center',
      duration: 3000
    });
    console.log('🟣 [ToastTest] toast.success (居中) 返回值:', result);
  };

  const handleLongDurationToast = () => {
    console.log('⏰ [ToastTest] 点击长时间显示按钮');
    const result = toast.info('这是一个长时间显示的通知，10秒后自动消失', {
      duration: 10000
    });
    console.log('⏰ [ToastTest] toast.info (长时间) 返回值:', result);
  };

  const handlePersistentToast = () => {
    console.log('📌 [ToastTest] 点击持久通知按钮');
    const result = toast.warning('这是一个持久通知，需要手动关闭', {
      duration: 0 // 0表示不自动消失
    });
    console.log('📌 [ToastTest] toast.warning (持久) 返回值:', result);
  };

  const clearAllToasts = () => {
    console.log('🧹 [ToastTest] 点击清除所有按钮');
    toast.clear();
    console.log('🧹 [ToastTest] toast.clear 执行完成');
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="card bg-base-100 shadow-xl">
        <div className="card-body">
          <h1 className="card-title text-2xl mb-6">
            <Info className="w-6 h-6" />
            Toast 通知系统测试
          </h1>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <button 
              className="btn btn-success"
              onClick={handleSuccessToast}
            >
              <CheckCircle className="w-4 h-4" />
              成功通知
            </button>
            
            <button 
              className="btn btn-error"
              onClick={handleErrorToast}
            >
              <XCircle className="w-4 h-4" />
              错误通知
            </button>
            
            <button 
              className="btn btn-info"
              onClick={handleInfoToast}
            >
              <Info className="w-4 h-4" />
              信息通知
            </button>
            
            <button 
              className="btn btn-warning"
              onClick={handleWarningToast}
            >
              <AlertTriangle className="w-4 h-4" />
              警告通知
            </button>
            
            <button 
              className="btn btn-secondary"
              onClick={handleCustomPositionToast}
            >
              居中位置
            </button>
            
            <button 
              className="btn btn-accent"
              onClick={handleLongDurationToast}
            >
              长时间显示
            </button>
            
            <button 
              className="btn btn-neutral"
              onClick={handlePersistentToast}
            >
              持久通知
            </button>
            
            <button 
              className="btn btn-ghost"
              onClick={clearAllToasts}
            >
              清除所有
            </button>
          </div>
          
          <div className="divider"></div>
          
          <div className="alert alert-info">
            <Info className="w-5 h-5" />
            <div>
              <h3 className="font-bold">测试说明</h3>
              <div className="text-sm">
                点击上面的按钮来测试不同类型的通知。新的通知系统基于 DaisyUI 组件，
                提供了更好的样式控制和响应式设计。
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ToastTestPage;