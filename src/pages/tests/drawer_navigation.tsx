import React, { useState, useRef } from 'react';
import { Menu, Home, User, Settings, ChevronRight } from 'lucide-react';

const DrawerNavigation = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [translateX, setTranslateX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [dragDirection, setDragDirection] = useState(null); // 'horizontal' 或 'vertical'
  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const currentXRef = useRef(0);
  const currentYRef = useRef(0);
  const mainViewRef = useRef(null);
  const drawerWidth = 280;
  
  // 方向判断阈值配置
  const DIRECTION_THRESHOLD = 15; // 开始判断方向的最小移动距离
  const HORIZONTAL_BIAS = 25; // 水平方向需要额外移动的距离才能触发抽屉

  const menuItems = [
    { icon: Home, label: '首页', path: '/' },
    { icon: User, label: '个人资料', path: '/profile' },
    { icon: Settings, label: '设置', path: '/settings' },
  ];

  const handleTouchStart = (e) => {
    startXRef.current = e.touches[0].clientX;
    startYRef.current = e.touches[0].clientY;
    currentXRef.current = e.touches[0].clientX;
    currentYRef.current = e.touches[0].clientY;
    setDragDirection(null);
  };

  const handleTouchMove = (e) => {
    currentXRef.current = e.touches[0].clientX;
    currentYRef.current = e.touches[0].clientY;
    
    const deltaX = currentXRef.current - startXRef.current;
    const deltaY = currentYRef.current - startYRef.current;
    const absDeltaX = Math.abs(deltaX);
    const absDeltaY = Math.abs(deltaY);
    
    // 首次移动时确定拖动方向
    if (dragDirection === null) {
      // 移动距离太小，还不能确定方向
      if (absDeltaX < DIRECTION_THRESHOLD && absDeltaY < DIRECTION_THRESHOLD) {
        return;
      }
      
      // 判断主要移动方向 - 给水平方向添加额外阈值
      // 水平滑动需要明显更多的 X 轴移动才能触发
      if (absDeltaX > absDeltaY + HORIZONTAL_BIAS) {
        // 水平移动明显超过垂直移动
        setDragDirection('horizontal');
        setIsDragging(true);
      } else if (absDeltaY > absDeltaX * 0.5) {
        // 垂直移动占主导，或者水平移动不够明显
        setDragDirection('vertical');
        return;
      } else {
        // 斜向移动或移动不够明确，暂不判断
        return;
      }
    }
    
    // 只有确定为水平拖动时才处理抽屉
    if (dragDirection !== 'horizontal') {
      return;
    }
    
    // 阻止默认滚动行为
    e.preventDefault();
    
    if (isOpen) {
      // 抽屉已打开，允许向左拖动关闭
      const newTranslate = Math.max(0, Math.min(drawerWidth, drawerWidth + deltaX));
      setTranslateX(newTranslate);
    } else {
      // 抽屉关闭，允许向右拖动打开
      if (deltaX > 0) {
        const newTranslate = Math.max(0, Math.min(drawerWidth, deltaX));
        setTranslateX(newTranslate);
      }
    }
  };

  const handleTouchEnd = () => {
    if (dragDirection !== 'horizontal' || !isDragging) {
      setDragDirection(null);
      return;
    }
    
    setIsDragging(false);
    setDragDirection(null);
    
    const deltaX = currentXRef.current - startXRef.current;
    
    // 根据拖动距离决定打开或关闭
    if (isOpen) {
      if (deltaX < -drawerWidth / 3) {
        closeDrawer();
      } else {
        openDrawer();
      }
    } else {
      if (deltaX > drawerWidth / 3) {
        openDrawer();
      } else {
        closeDrawer();
      }
    }
  };

  const openDrawer = () => {
    setIsOpen(true);
    setTranslateX(drawerWidth);
  };

  const closeDrawer = () => {
    setIsOpen(false);
    setTranslateX(0);
  };

  const toggleDrawer = () => {
    if (isOpen) {
      closeDrawer();
    } else {
      openDrawer();
    }
  };

  return (
    <div className="relative w-full h-screen overflow-hidden bg-gray-100">
      {/* 遮罩层 */}
      <div
        className={`absolute inset-0 bg-black transition-opacity duration-300 z-10 ${
          isOpen ? 'opacity-50' : 'opacity-0 pointer-events-none'
        }`}
        onClick={closeDrawer}
        style={{ opacity: translateX / drawerWidth * 0.5 }}
      />

      {/* 抽屉 */}
      <div
        className="absolute top-0 left-0 h-full bg-white shadow-2xl z-20"
        style={{
          width: `${drawerWidth}px`,
          transform: `translateX(${translateX - drawerWidth}px)`,
          transition: isDragging ? 'none' : 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        <div className="flex flex-col h-full">
          {/* 抽屉头部 */}
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-6 text-white">
            <div className="flex items-center space-x-3">
              <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center">
                <User size={32} />
              </div>
              <div>
                <h2 className="text-lg font-semibold">用户名</h2>
                <p className="text-sm text-blue-100">user@example.com</p>
              </div>
            </div>
          </div>

          {/* 菜单项 */}
          <nav className="flex-1 py-4">
            {menuItems.map((item, index) => {
              const Icon = item.icon;
              return (
                <button
                  key={index}
                  onClick={() => {
                    closeDrawer();
                    // 这里可以添加路由导航
                  }}
                  className="w-full flex items-center px-6 py-4 hover:bg-gray-50 active:bg-gray-100 transition-colors"
                >
                  <Icon size={24} className="text-gray-600" />
                  <span className="ml-4 text-gray-800 font-medium">{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* 抽屉底部 */}
          <div className="p-6 border-t border-gray-200">
            <p className="text-xs text-gray-500 text-center">版本 1.0.0</p>
          </div>
        </div>
      </div>

      {/* 主视图 */}
      <div
        ref={mainViewRef}
        className="absolute inset-0 bg-white z-5 overflow-y-auto"
        style={{
          transform: `translateX(${translateX}px)`,
          transition: isDragging ? 'none' : 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          touchAction: dragDirection === 'horizontal' ? 'none' : 'auto',
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* 导航栏 */}
        <div className="bg-blue-600 text-white p-4 shadow-md flex items-center sticky top-0 z-30">
          <button
            onClick={toggleDrawer}
            className="p-2 hover:bg-blue-700 rounded-lg active:bg-blue-800 transition-colors"
          >
            <Menu size={24} />
          </button>
          <h1 className="ml-4 text-xl font-semibold">Capacitor 抽屉导航</h1>
        </div>

        {/* 主内容区 */}
        <div className="p-6">
          <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mb-6">
            <h3 className="font-semibold text-blue-900 mb-2">使用说明</h3>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• 点击左上角菜单图标打开抽屉</li>
              <li>• <strong>需要明确的水平滑动才能触发抽屉</strong></li>
              <li>• 垂直滚动更容易触发，不会误开抽屉</li>
              <li>• 水平向左拖动或点击遮罩关闭</li>
            </ul>
          </div>

          <div className="space-y-4">
            <div className="bg-white rounded-lg shadow p-4">
              <h2 className="text-lg font-semibold text-gray-800 mb-2">优化的方向识别</h2>
              <ul className="space-y-2 text-gray-600">
                <li className="flex items-start">
                  <ChevronRight size={20} className="text-blue-600 mt-0.5 flex-shrink-0" />
                  <span className="ml-2"><strong>水平偏移阈值：25px</strong> - 需要明显的横向滑动</span>
                </li>
                <li className="flex items-start">
                  <ChevronRight size={20} className="text-blue-600 mt-0.5 flex-shrink-0" />
                  <span className="ml-2"><strong>基础阈值：15px</strong> - 开始判断方向的距离</span>
                </li>
                <li className="flex items-start">
                  <ChevronRight size={20} className="text-blue-600 mt-0.5 flex-shrink-0" />
                  <span className="ml-2">垂直滚动优先级更高，减少误触</span>
                </li>
                <li className="flex items-start">
                  <ChevronRight size={20} className="text-blue-600 mt-0.5 flex-shrink-0" />
                  <span className="ml-2">斜向滑动会等待更明确的方向</span>
                </li>
              </ul>
            </div>

            <div className="bg-gradient-to-r from-purple-100 to-pink-100 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-2">判断逻辑</h3>
              <div className="text-gray-700 text-sm space-y-2">
                <p>✅ <strong>触发抽屉：</strong> deltaX &gt; deltaY + 25px</p>
                <p>✅ <strong>垂直滚动：</strong> deltaY &gt; deltaX × 0.5</p>
                <p>⏸️ <strong>等待判断：</strong> 移动不够明确时继续观察</p>
              </div>
            </div>

            <div className="bg-gradient-to-r from-green-100 to-teal-100 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-2">🎯 体验对比</h3>
              <div className="space-y-3">
                <div className="bg-white/60 rounded p-3">
                  <p className="text-sm font-semibold text-gray-800 mb-1">常规方案</p>
                  <p className="text-xs text-gray-600">轻微的斜向滑动就可能误触发抽屉</p>
                </div>
                <div className="bg-white/60 rounded p-3">
                  <p className="text-sm font-semibold text-green-700 mb-1">优化后方案 ⭐</p>
                  <p className="text-xs text-gray-600">需要明确的横向滑动，大幅减少误触</p>
                </div>
              </div>
            </div>

            {/* 测试滚动区域 */}
            <div className="bg-white rounded-lg shadow p-4">
              <h3 className="text-lg font-semibold text-gray-800 mb-2">测试区域</h3>
              <p className="text-gray-600 mb-4">
                试试快速上下滚动，你会发现很难误触发抽屉！
              </p>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="bg-gradient-to-br from-blue-100 to-blue-200 p-4 rounded-lg text-center">
                  <p className="text-2xl font-bold text-blue-700">128</p>
                  <p className="text-sm text-blue-600 mt-1">访问量</p>
                </div>
                <div className="bg-gradient-to-br from-green-100 to-green-200 p-4 rounded-lg text-center">
                  <p className="text-2xl font-bold text-green-700">95%</p>
                  <p className="text-sm text-green-600 mt-1">满意度</p>
                </div>
              </div>
            </div>

            {/* 更多内容用于测试滚动 */}
            <div className="bg-white rounded-lg shadow p-4">
              <h3 className="text-lg font-semibold text-gray-800 mb-2">长内容测试</h3>
              <p className="text-gray-600 mb-3">快速上下滚动这些内容，感受优化效果...</p>
              {[1, 2, 3, 4, 5, 6, 7, 8].map((item) => (
                <div key={item} className="bg-gray-50 p-4 rounded mb-3">
                  <h4 className="font-semibold text-gray-700 mb-2">内容块 {item}</h4>
                  <p className="text-gray-600 text-sm">
                    这是一段测试内容。现在你可以轻松地垂直滚动，
                    而不用担心误触发抽屉。只有当你明确地进行横向滑动时，
                    抽屉才会被触发。这种设计更符合用户的使用习惯。
                  </p>
                </div>
              ))}
            </div>

            <div className="bg-gradient-to-r from-orange-100 to-red-100 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-2">参数调优建议</h3>
              <div className="text-gray-700 text-sm space-y-2">
                <p><strong>DIRECTION_THRESHOLD (15px):</strong> 基础阈值，太小会过于敏感</p>
                <p><strong>HORIZONTAL_BIAS (25px):</strong> 水平偏移量，增大可进一步减少误触</p>
                <p className="text-xs text-gray-600 mt-3">💡 可根据实际测试反馈调整这两个参数</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DrawerNavigation;