import { Settings, Users, Database, FileText, UserCircle, Volume2, Globe, BookOpen, Search } from 'lucide-react';
import ConfigSettings from './sections/ConfigSettings';
import RolesSettings from './sections/RolesSettings';
import UserRolesSettings from './sections/UserRolesSettings';
import DataSettings from './sections/DataSettings';
import GlobalSettings from './sections/GlobalSettings';
import GlobalPromptsSettings from './sections/GlobalPromptsSettings';
import VoiceSettings from './sections/VoiceSettings';
import KnowledgeSettings from './sections/KnowledgeSettings';
import SearchSettings from './sections/SearchSettings';

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
    component: GlobalSettings
  },
  {
    id: 'config' as TabType,
    name: '模型',
    icon: Settings,
    component: ConfigSettings
  },
  {
    id: 'roles' as TabType,
    name: '角色卡',
    icon: Users,
    component: RolesSettings
  },
  {
    id: 'userRoles' as TabType,
    name: '用户角色',
    icon: UserCircle,
    component: UserRolesSettings
  },
  {
    id: 'knowledge' as TabType,
    name: '知识库',
    icon: BookOpen,
    component: KnowledgeSettings
  },
  {
    id: 'globalPrompts' as TabType,
    name: '全局提示词',
    icon: FileText,
    component: GlobalPromptsSettings
  },
  {
    id: 'voice' as TabType,
    name: '语音',
    icon: Volume2,
    component: VoiceSettings
  },
  {
    id: 'search' as TabType,
    name: '网络搜索',
    icon: Search,
    component: SearchSettings
  },
  {
    id: 'data' as TabType,
    name: '数据',
    icon: Database,
    component: DataSettings
  },
];
