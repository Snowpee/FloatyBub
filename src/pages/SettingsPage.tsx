import React, { useState } from 'react';
import { Settings, Users, Database, History, FileText, UserCircle, Volume2 } from 'lucide-react';
import { cn } from '../lib/utils';
import { SyncStatusIndicator } from '../components/SyncStatusIndicator';
import { DatabaseConnectionIndicator } from '../components/DatabaseConnectionIndicator';
import ConfigPage from './ConfigPage';
import RolesPage from './RolesPage';
import userRolesPage from './UserRolesPage';
import DataPage from './DataPage';
import HistoryPage from './HistoryPage';
import GlobalPromptsPage from './GlobalPromptsPage';
import VoiceSettingsPage from './VoiceSettingsPage';

type TabType = 'config' | 'roles' | 'userRoles' | 'globalPrompts' | 'voice' | 'data' | 'history';

const SettingsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('config');

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
      id: 'userRoles' as TabType,
      name: '用户角色',
      icon: UserCircle,
      component: userRolesPage
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

  return (
    <div className="h-full flex flex-col">
      {/* 标签栏 */}
      <div className="bg-base-100 shadow-sm">
        <div className="px-6">
          <div className="flex items-center justify-between">
            <div className="tabs tabs-bordered" role="tablist">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    'tab tab-bordered flex items-center gap-2',
                    activeTab === tab.id
                      ? 'tab-active text-primary'
                      : 'text-base-content/60 hover:text-base-content'
                  )}
                  role="tab"
                >
                  <Icon className="h-4 w-4" />
                  <span className="hidden md:inline">{tab.name}</span>
                </button>
              );
            })}
            </div>
            
            {/* 状态指示器 */}
            <div className="flex items-center gap-4">
              <DatabaseConnectionIndicator size="sm" />
              <SyncStatusIndicator size="sm" />
            </div>
          </div>
        </div>
      </div>

      {/* 内容区域 */}
      <div className="flex-1 overflow-y-auto">
        <ActiveComponent />
      </div>
    </div>
  );
};

export default SettingsPage;