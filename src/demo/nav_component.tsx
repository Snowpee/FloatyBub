import React, { createContext, useContext, useState, useRef, useEffect } from 'react';

// ==================== 类型定义 ====================
interface PageConfig {
  id: string;
  component: React.ComponentType<any>;
  props?: Record<string, any>;
}

interface NavContextType {
  stack: PageConfig[];
  push: (component: React.ComponentType<any>, props?: Record<string, any>) => void;
  pop: () => void;
  popToRoot: () => void;
  canGoBack: () => boolean;
  replace: (component: React.ComponentType<any>, props?: Record<string, any>) => void;
}

// ==================== Context ====================
const NavContext = createContext<NavContextType | null>(null);

export const useNav = () => {
  const context = useContext(NavContext);
  if (!context) throw new Error('useNav must be used within NavProvider');
  return context;
};

// ==================== NavProvider ====================
interface NavProviderProps {
  root: React.ComponentType<any>;
  rootProps?: Record<string, any>;
  children?: React.ReactNode;
}

export const NavProvider: React.FC<NavProviderProps> = ({ root, rootProps = {}, children }) => {
  const [stack, setStack] = useState<PageConfig[]>([
    { id: '0', component: root, props: rootProps }
  ]);
  const idCounter = useRef(1);

  const push = (component: React.ComponentType<any>, props = {}) => {
    const newPage: PageConfig = {
      id: String(idCounter.current++),
      component,
      props
    };
    setStack(prev => [...prev, newPage]);
  };

  const pop = () => {
    if (stack.length > 1) {
      setStack(prev => prev.slice(0, -1));
    }
  };

  const popToRoot = () => {
    setStack(prev => [prev[0]]);
  };

  const canGoBack = () => stack.length > 1;

  const replace = (component: React.ComponentType<any>, props = {}) => {
    const newPage: PageConfig = {
      id: String(idCounter.current++),
      component,
      props
    };
    setStack(prev => [...prev.slice(0, -1), newPage]);
  };

  return (
    <NavContext.Provider value={{ stack, push, pop, popToRoot, canGoBack, replace }}>
      {children}
    </NavContext.Provider>
  );
};

// ==================== NavContainer ====================
interface NavContainerProps {
  animated?: boolean;
  swipeGesture?: boolean;
}

export const NavContainer: React.FC<NavContainerProps> = ({ 
  animated = true, 
  swipeGesture = false 
}) => {
  const { stack, pop, canGoBack } = useNav();
  const [animationState, setAnimationState] = useState<'idle' | 'entering' | 'leaving'>('idle');
  const [direction, setDirection] = useState<'forward' | 'backward'>('forward');
  const previousStackLength = useRef(stack.length);
  const touchStartX = useRef(0);
  const touchCurrentX = useRef(0);
  const [swipeOffset, setSwipeOffset] = useState(0);

  const currentPage = stack[stack.length - 1];
  const previousPage = stack.length > 1 ? stack[stack.length - 2] : null;

  // 监听栈变化触发动画
  useEffect(() => {
    if (!animated) return;
    
    const newLength = stack.length;
    const oldLength = previousStackLength.current;
    
    if (newLength > oldLength) {
      // Push 动画
      setDirection('forward');
      setAnimationState('entering');
      const timer = setTimeout(() => setAnimationState('idle'), 350);
      return () => clearTimeout(timer);
    } else if (newLength < oldLength) {
      // Pop 动画
      setDirection('backward');
      setAnimationState('leaving');
      const timer = setTimeout(() => setAnimationState('idle'), 350);
      return () => clearTimeout(timer);
    }
    
    previousStackLength.current = newLength;
  }, [stack.length, animated]);

  // 手势处理
  const handleTouchStart = (e: React.TouchEvent) => {
    if (!swipeGesture || !canGoBack()) return;
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!swipeGesture || !canGoBack() || touchStartX.current > 50) return;
    touchCurrentX.current = e.touches[0].clientX;
    const diff = touchCurrentX.current - touchStartX.current;
    if (diff > 0) {
      setSwipeOffset(Math.min(diff, window.innerWidth * 0.8));
    }
  };

  const handleTouchEnd = () => {
    if (!swipeGesture || !canGoBack()) return;
    const diff = touchCurrentX.current - touchStartX.current;
    if (diff > 120) {
      pop();
    }
    setSwipeOffset(0);
    touchStartX.current = 0;
    touchCurrentX.current = 0;
  };

  const CurrentComponent = currentPage.component;
  const PreviousComponent = previousPage?.component;

  // 计算动画样式
  const getPageStyle = (type: 'current' | 'previous') => {
    if (type === 'current') {
      // 当前页面
      if (swipeOffset > 0) {
        return {
          transform: `translateX(${swipeOffset}px)`,
          transition: 'none',
          boxShadow: '-4px 0 12px rgba(0,0,0,0.15)'
        };
      }
      
      if (animationState === 'entering' && direction === 'forward') {
        return {
          transform: 'translateX(0)',
          transition: 'transform 0.35s cubic-bezier(0.32, 0.72, 0, 1)'
        };
      }
      
      if (animationState === 'leaving' && direction === 'backward') {
        return {
          transform: 'translateX(100%)',
          transition: 'transform 0.35s cubic-bezier(0.32, 0.72, 0, 1)'
        };
      }
      
      return {
        transform: 'translateX(0)',
        transition: 'none'
      };
    } else {
      // 前一个页面
      const baseOpacity = swipeOffset > 0 ? Math.min(1, 0.5 + swipeOffset / 600) : 0.5;
      const baseTransform = swipeOffset > 0 ? -30 + (swipeOffset / 10) : -30;
      
      if (animationState === 'entering' && direction === 'forward') {
        return {
          transform: 'translateX(-30%)',
          opacity: 0.5,
          transition: 'all 0.35s cubic-bezier(0.32, 0.72, 0, 1)'
        };
      }
      
      if (animationState === 'leaving' && direction === 'backward') {
        return {
          transform: 'translateX(0)',
          opacity: 1,
          transition: 'all 0.35s cubic-bezier(0.32, 0.72, 0, 1)'
        };
      }
      
      if (swipeOffset > 0) {
        return {
          transform: `translateX(${baseTransform}%)`,
          opacity: baseOpacity,
          transition: 'none'
        };
      }
      
      return {
        transform: 'translateX(0)',
        opacity: 1,
        transition: 'none'
      };
    }
  };

  return (
    <div 
      className="relative w-full h-full overflow-hidden bg-base-100"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* 前一个页面（iOS 风格的退后效果） */}
      {previousPage && (animationState !== 'idle' || swipeOffset > 0) && (
        <div 
          className="absolute inset-0 bg-base-100"
          style={getPageStyle('previous')}
        >
          <PreviousComponent {...previousPage.props} />
        </div>
      )}

      {/* 当前页面 */}
      <div 
        className="absolute inset-0 bg-base-100"
        style={{
          ...getPageStyle('current'),
          zIndex: 10
        }}
      >
        <CurrentComponent {...currentPage.props} />
      </div>
    </div>
  );
};

// ==================== NavLink 组件 ====================
interface NavLinkProps {
  component: React.ComponentType<any>;
  props?: Record<string, any>;
  children: React.ReactNode;
  className?: string;
  replace?: boolean;
}

export const NavLink: React.FC<NavLinkProps> = ({ 
  component, 
  props = {}, 
  children, 
  className = '',
  replace = false 
}) => {
  const nav = useNav();

  const handleClick = () => {
    if (replace) {
      nav.replace(component, props);
    } else {
      nav.push(component, props);
    }
  };

  return (
    <button onClick={handleClick} className={className}>
      {children}
    </button>
  );
};

// ==================== Demo 页面组件 ====================
const HomePage: React.FC = () => {
  const nav = useNav();

  return (
    <div className="flex flex-col h-full bg-gradient-to-br from-blue-50 to-indigo-50 p-6">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold text-gray-800">Home</h1>
      </div>

      <div className="space-y-4">
        <NavLink 
          component={DetailPage} 
          props={{ title: 'Page 1', color: 'bg-purple-500' }}
          className="btn btn-primary w-full"
        >
          Go to Detail Page 1
        </NavLink>

        <NavLink 
          component={DetailPage} 
          props={{ title: 'Page 2', color: 'bg-green-500' }}
          className="btn btn-secondary w-full"
        >
          Go to Detail Page 2
        </NavLink>

        <button 
          onClick={() => nav.push(SettingsPage)}
          className="btn btn-accent w-full"
        >
          Open Settings (命令式调用)
        </button>
      </div>

      <div className="mt-8 p-4 bg-white rounded-lg shadow">
        <h3 className="font-semibold mb-2">导航栈信息</h3>
        <p className="text-sm text-gray-600">当前栈深度: {nav.stack.length}</p>
        <p className="text-sm text-gray-600">可返回: {nav.canGoBack() ? '是' : '否'}</p>
      </div>
    </div>
  );
};

const DetailPage: React.FC<{ title?: string; color?: string }> = ({ 
  title = 'Detail', 
  color = 'bg-blue-500' 
}) => {
  const nav = useNav();

  return (
    <div className={`flex flex-col h-full ${color} p-6 text-white`}>
      <div className="flex items-center justify-between mb-8">
        <button onClick={() => nav.pop()} className="btn btn-ghost btn-sm">
          ← 返回
        </button>
        <h1 className="text-2xl font-bold">{title}</h1>
        <div className="w-16"></div>
      </div>

      <div className="flex-1 flex flex-col justify-center items-center space-y-4">
        <div className="bg-white/20 backdrop-blur-sm p-6 rounded-xl">
          <p className="text-lg mb-4">这是 {title} 页面</p>
          <p className="text-sm opacity-80">栈深度: {nav.stack.length}</p>
        </div>

        <NavLink 
          component={DetailPage} 
          props={{ title: `${title} - Nested`, color: 'bg-pink-500' }}
          className="btn btn-ghost bg-white/20 hover:bg-white/30"
        >
          Push Another Page
        </NavLink>

        {nav.stack.length > 2 && (
          <button 
            onClick={() => nav.popToRoot()}
            className="btn btn-ghost bg-white/20 hover:bg-white/30"
          >
            Pop to Root
          </button>
        )}
      </div>
    </div>
  );
};

const SettingsPage: React.FC = () => {
  const nav = useNav();

  return (
    <div className="flex flex-col h-full bg-gradient-to-br from-gray-50 to-gray-100 p-6">
      <div className="flex items-center justify-between mb-8">
        <button onClick={() => nav.pop()} className="btn btn-ghost btn-sm">
          ← 返回
        </button>
        <h1 className="text-2xl font-bold">Settings</h1>
        <div className="w-16"></div>
      </div>

      <div className="space-y-4">
        <div className="card bg-base-100 shadow-xl">
          <div className="card-body">
            <h2 className="card-title">账户设置</h2>
            <p className="text-gray-600">管理你的账户信息</p>
          </div>
        </div>

        <div className="card bg-base-100 shadow-xl">
          <div className="card-body">
            <h2 className="card-title">通知</h2>
            <p className="text-gray-600">配置通知偏好</p>
          </div>
        </div>

        <button 
          onClick={() => nav.replace(HomePage)}
          className="btn btn-error w-full mt-4"
        >
          Replace with Home (不会增加栈)
        </button>
      </div>
    </div>
  );
};

// ==================== App ====================
export default function App() {
  return (
    <div className="w-full h-screen">
      <NavProvider root={HomePage}>
        <NavContainer animated={true} swipeGesture={true} />
      </NavProvider>
    </div>
  );
}