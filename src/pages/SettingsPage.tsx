import React, { useState } from 'react';
import { Settings, Users, Database, History, FileText, UserCircle } from 'lucide-react';
import { cn } from '../lib/utils';
import ConfigPage from './ConfigPage';
import RolesPage from './RolesPage';
import UserProfilesPage from './UserProfilesPage';
import DataPage from './DataPage';
import HistoryPage from './HistoryPage';
import GlobalPromptsPage from './GlobalPromptsPage';

type TabType = 'config' | 'roles' | 'userProfiles' | 'globalPrompts' | 'data' | 'history';

const SettingsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('config');

  const tabs = [
    {
      id: 'config' as TabType,
      name: '模型配置',
      icon: Settings,
      component: ConfigPage
    },
    {
      id: 'roles' as TabType,
      name: '角色管理',
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
      name: '全局提示词配置',
      icon: FileText,
      component: GlobalPromptsPage
    },
    {
      id: 'data' as TabType,
      name: '数据管理',
      icon: Database,
      component: DataPage
    },
    {
      id: 'history' as TabType,
      name: '历史管理',
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