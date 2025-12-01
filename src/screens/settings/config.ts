import { Settings, Users, Database, FileText, UserCircle, Volume2, Globe, BookOpen, Search } from 'lucide-react';
import ConfigPage from './sections/ConfigPage';
import RolesPage from './sections/RolesPage';
import userRolesPage from './sections/UserRolesPage';
import DataPage from './sections/DataPage';
import GlobalSettingsPage from './sections/GlobalSettingsPage';
import GlobalPromptsPage from './sections/GlobalPromptsPage';
import VoiceSettingsPage from './sections/VoiceSettingsPage';
import KnowledgePage from './sections/KnowledgePage';
import SearchSettingsPage from './sections/SearchSettingsPage';

export type TabType = 'global' | 'config' | 'roles' | 'userRoles' | 'globalPrompts' | 'voice' | 'data' | 'knowledge' | 'search';

export interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTab?: TabType;
}

export const tabs = [
  {
    id: 'global' as TabType,
    name: '全局设置',
    icon: Globe,
    component: GlobalSettingsPage
  },
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
    id: 'knowledge' as TabType,
    name: '知识库',
    icon: BookOpen,
    component: KnowledgePage
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
    id: 'search' as TabType,
    name: '网络搜索',
    icon: Search,
    component: SearchSettingsPage
  },
  {
    id: 'data' as TabType,
    name: '数据',
    icon: Database,
    component: DataPage
  },
];
