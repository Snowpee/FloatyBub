import React, { useState } from 'react';
import { X, Settings, Users, Database, History, FileText, UserCircle, Volume2, ArrowLeft } from 'lucide-react';
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
}

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<TabType>('config');
  const [showList, setShowList] = useState(true); // 移动端是否显示列表视图

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

  if (!isOpen) return null;

  // 移动端处理函数
  const handleMobileTabClick = (tabId: TabType) => {
    setActiveTab(tabId);
    setShowList(false);
  };

  const handleBackToList = () => {
    setShowList(true);
  };

  const handleClose = () => {
    setShowList(true); // 重置到列表视图
    onClose();
  };

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
        className="absolute inset-0 bg-black/50" 
        onClick={handleClose}
      />
      
      {/* 弹窗内容 */}
      <div className={cn(
        "hero-modal relative bg-base-100 shadow-xl flex overflow-hidden",
        // 桌面端：居中弹窗
        "md:rounded-lg md:w-full md:max-w-6xl md:h-[800px] md:max-h-[calc(100vh-2rem)] md:mx-4",
        // 移动端：全屏减去顶部预留空间
        "w-full h-full"
      )}>
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
                            <div className="font-medium text-base-content">{tab.name}</div>
                            <div className="text-sm text-base-content/60">
                              {tab.id === 'config' && '配置AI模型和API设置'}
                              {tab.id === 'roles' && '管理AI角色卡片'}
                              {tab.id === 'userProfiles' && '设置用户角色信息'}
                              {tab.id === 'globalPrompts' && '管理全局提示词模板'}
                              {tab.id === 'voice' && '配置语音合成设置'}
                              {tab.id === 'data' && '数据导入导出管理'}
                              {tab.id === 'history' && '聊天历史记录管理'}
                            </div>
                          </div>
                          <div className="text-base-content/40">
                            <ArrowLeft className="h-4 w-4 rotate-180" />
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
                  <ArrowLeft className="h-4 w-4" />
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
                <ActiveComponent />
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
            <ActiveComponent />
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;