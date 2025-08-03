import React, { useState, useEffect } from 'react';
import { X, Settings, Users, Database, History, FileText, UserCircle, Volume2, ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '../lib/utils';
import ConfigPage from '../pages/ConfigPage';
import RolesPage from '../pages/RolesPage';
import UserProfilesPage from '../pages/UserProfilesPage';
import DataPage from '../pages/DataPage';
import HistoryPage from '../pages/HistoryPage';
import GlobalPromptsPage from '../pages/GlobalPromptsPage';
import VoiceSettingsPage from '../pages/VoiceSettingsPage';

type TabType = 'config' | 'roles' | 'userProfiles' | 'globalPrompts' | 'voice' | 'data' | 'history';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTab?: TabType;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, defaultTab = 'config' }) => {
  const [activeTab, setActiveTab] = useState<TabType>(defaultTab);
  const [showList, setShowList] = useState(true); // 移动端是否显示列表视图
  const [isClosing, setIsClosing] = useState(false); // 控制关闭动画
  const [shouldRender, setShouldRender] = useState(isOpen); // 控制组件渲染
  const [isVisible, setIsVisible] = useState(false); // 控制弹窗可见性

  // 当 defaultTab 改变时更新 activeTab
  useEffect(() => {
    setActiveTab(defaultTab);
  }, [defaultTab]);

  // 处理弹窗显示/隐藏动画
  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
      setIsClosing(false);
      // 延迟一帧开始入场动画，确保初始状态正确
      const timer = setTimeout(() => {
        setIsVisible(true);
      }, 10);
      return () => clearTimeout(timer);
    } else if (shouldRender) {
      // 检测是否为移动端
      const isMobile = window.innerWidth < 768;
      
      if (isMobile) {
        setIsClosing(true);
        setIsVisible(false);
        // 等待动画完成后隐藏组件
        const timer = setTimeout(() => {
          setShouldRender(false);
          setIsClosing(false);
        }, 300);
        return () => clearTimeout(timer);
      } else {
        // 桌面端：设置关闭状态并等待透明度动画完成
        setIsClosing(true);
        setIsVisible(false);
        const timer = setTimeout(() => {
          setShouldRender(false);
          setIsClosing(false);
        }, 200); // 与透明度动画时间匹配
        return () => clearTimeout(timer);
      }
    }
  }, [isOpen, shouldRender]);

  const tabs = [
    {
      id: 'config' as TabType,
      name: '模型',
      icon: Settings,
      component: ConfigPage
    },
    {
      id: 'roles' as TabType,
      name: '角色卡',
      icon: Users,
      component: RolesPage
    },
    {
      id: 'userProfiles' as TabType,
      name: '用户角色',
      icon: UserCircle,
      component: UserProfilesPage
    },
    {
      id: 'globalPrompts' as TabType,
      name: '全局提示词',
      icon: FileText,
      component: GlobalPromptsPage
    },
    {
      id: 'voice' as TabType,
      name: '语音',
      icon: Volume2,
      component: VoiceSettingsPage
    },
    {
      id: 'data' as TabType,
      name: '数据',
      icon: Database,
      component: DataPage
    },
    {
      id: 'history' as TabType,
      name: '历史',
      icon: History,
      component: HistoryPage
    }
  ];

  const ActiveComponent = tabs.find(tab => tab.id === activeTab)?.component || ConfigPage;

  // 移动端处理函数
  const handleMobileTabClick = (tabId: TabType) => {
    setActiveTab(tabId);
    setShowList(false);
  };

  const handleBackToList = () => {
    setShowList(true);
  };

  const handleClose = () => {
    // 检测是否为移动端
    const isMobile = window.innerWidth < 768;
    
    if (isMobile) {
      // 移动端：设置动画状态并延迟关闭
      setShowList(true); // 重置到列表视图
      setIsClosing(true);
      setTimeout(() => {
        onClose();
      }, 50);
    } else {
      // 桌面端：直接调用onClose，动画由useEffect处理
      onClose();
    }
  };

  if (!shouldRender) {
    return null;
  }

  return (
    <div className={cn(
      "fixed inset-0 z-50",
      // 桌面端：居中显示
      "md:flex md:items-center md:justify-center",
      // 移动端：顶部预留1rem
      "pt-4 md:pt-0"
    )}>
      {/* 背景遮罩 */}
      <div 
        className={cn(
          "modal-backdrop absolute inset-0 bg-black/50",
          // 桌面端保留透明动画
          "md:animate-in md:fade-in md:duration-200",
          // 移动端透明度动画
          "transition-opacity duration-200 ease-out",
          isClosing ? "opacity-0" : "opacity-100"
        )}
        onClick={handleClose}
      />
      
      {/* 弹窗内容 */}
      <div 
        className={cn(
          "hero-modal relative bg-base-100 shadow-xl flex overflow-hidden",
          // 桌面端：居中弹窗
          "md:rounded-lg md:w-full md:max-w-6xl md:h-[800px] md:max-h-[calc(100vh-2rem)] md:mx-4",
          // 移动端：全屏减去顶部预留空间
          "w-full h-full",
          // 桌面端透明度和位移动画
          "md:transition-all md:duration-200 md:ease-out",
          // 移动端滑入滑出动画 - 使用更平滑的缓动函数
          "transition-transform duration-200 ease-[cubic-bezier(0.25,0.46,0.45,0.94)]",
          // 桌面端透明度和位移控制 - 使用isVisible状态实现淡入淡出和上下弹入弹出
          isVisible && !isClosing 
            ? "md:opacity-100 md:translate-y-0" 
            : "md:opacity-0 md:translate-y-2",
          // 移动端动画状态控制
          isVisible && !isClosing
            ? "translate-y-0"                     // 可见状态：正常位置
            : "translate-y-full md:translate-y-2" // 隐藏状态：移动端在屏幕下方，桌面端稍微下方
        )}
      >
        {/* 左侧导航栏 */}
        <div className="w-64 bg-base-100 border-r border-base-300 flex-shrink-0 hidden md:flex flex-col">
          {/* 标题栏 */}
          <div className="p-6 pb-4">
            <h2 className="text-lg font-semibold text-base-content">设置</h2>
          </div>
          
          {/* 导航菜单 */}
          <div className="flex-1 overflow-y-auto">
            <ul className="menu p-3 space-y-1 w-full">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <li key={tab.id}>
                    <button
                      onClick={() => setActiveTab(tab.id)}
                      className={cn(
                        'flex items-center gap-3 w-full text-left rounded-lg px-3 py-2 transition-colors',
                        activeTab === tab.id
                          ? 'bg-base-300 text-base-content'
                          : 'text-base-content hover:bg-base-300'
                      )}
                    >
                      <Icon className="h-5 w-5" />
                      <span>{tab.name}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>

        {/* 移动端内容 */}
        <div className="md:hidden w-full flex flex-col">
          {showList ? (
            // 移动端设置列表视图
            <>
              <div className="p-4 border-b border-base-300 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-base-content">设置</h2>
                <button
                   onClick={handleClose}
                   className="btn btn-ghost btn-sm btn-circle"
                 >
                   <X className="h-4 w-4" />
                 </button>
              </div>
              
              {/* 设置项列表 */}
              <div className="flex-1 overflow-y-auto">
                <ul className="menu p-4 space-y-2 w-full">
                  {tabs.map((tab) => {
                    const Icon = tab.icon;
                    return (
                      <li key={tab.id}>
                        <button
                          onClick={() => handleMobileTabClick(tab.id)}
                          className="flex items-center gap-4 w-full text-left p-4 rounded-lg hover:bg-base-200 transition-colors"
                        >
                          <div className="flex items-center justify-center w-10 h-10 bg-primary/10 rounded-lg">
                            <Icon className="h-5 w-5 text-primary" />
                          </div>
                          <div className="flex-1">
                            <div className="font-medium text-base text-base-content">{tab.name}</div>
                          </div>
                          <div className="text-base-content">
                            <ChevronLeft className="h-4 w-4 rotate-180" />
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </>
          ) : (
            // 移动端设置详情视图
            <>
              <div className="p-4 border-b border-base-300 flex items-center gap-3">
                <button
                  onClick={handleBackToList}
                  className="btn btn-ghost btn-sm btn-circle"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <h2 className="text-lg font-semibold text-base-content flex-1">
                  {tabs.find(tab => tab.id === activeTab)?.name}
                </h2>
                <button
                   onClick={handleClose}
                   className="btn btn-ghost btn-sm btn-circle"
                 >
                   <X className="h-4 w-4" />
                 </button>
              </div>
              
              {/* 内容区域 */}
              <div className="flex-1 overflow-y-auto">
                <ActiveComponent onCloseModal={handleClose} />
              </div>
            </>
          )}
        </div>

        {/* 右侧内容区域 */}
        <div className="hidden md:flex flex-1 flex-col min-h-0">
          {/* 桌面端标题栏 */}
          <div className="flex items-center justify-between p-6 pb-4 flex-shrink-0">
            <h3 className="text-lg font-medium text-base-content">
              {tabs.find(tab => tab.id === activeTab)?.name}
            </h3>
            <button
              onClick={handleClose}
              className="btn btn-ghost btn-sm btn-circle"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          
          {/* 内容区域 */}
          <div className="flex-1 overflow-y-auto min-h-0">
            <ActiveComponent onCloseModal={handleClose} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;