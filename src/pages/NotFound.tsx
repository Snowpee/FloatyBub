import { useNavigate } from 'react-router-dom';
import { Home, ArrowLeft } from 'lucide-react';

const NotFound = () => {
  const navigate = useNavigate();

  const handleGoHome = () => {
    navigate('/');
  };

  const handleGoBack = () => {
    navigate(-1);
  };

  return (
    <div className="h-full flex items-center justify-center bg-base-100">
      <div className="text-center max-w-md mx-auto px-6">
        {/* 404 图标 */}
        <div className="mb-8">
          <div className="text-8xl font-bold text-primary mb-4">404</div>
          <div className="w-24 h-1 bg-primary mx-auto rounded-full"></div>
        </div>

        {/* 错误信息 */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-base-content mb-4">
            页面未找到
          </h1>
          <p className="text-base-content/60 leading-relaxed">
            抱歉，您访问的页面不存在。
            <br />
            可能是链接错误或页面已被移动。
          </p>
        </div>

        {/* 操作按钮 */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <button
            onClick={handleGoBack}
            className="btn btn-outline btn-primary flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            返回上页
          </button>
          <button
            onClick={handleGoHome}
            className="btn btn-primary flex items-center gap-2"
          >
            <Home className="h-4 w-4" />
            回到首页
          </button>
        </div>

        {/* 装饰元素 */}
        <div className="mt-12 opacity-20">
          <div className="flex justify-center space-x-2">
            <div className="w-2 h-2 bg-primary rounded-full animate-bounce"></div>
            <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
            <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NotFound;