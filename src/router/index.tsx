import { createBrowserRouter } from 'react-router-dom';
import App from '../App';
import ChatPage from '../screens/chats/Chats';
import RoleListPage from '../screens/RoleListPage';
import Home from '../screens/Home';
import NotFound from '../screens/NotFound';
import GlobalSettingsPage from '../screens/settings/sections/GlobalSettingsPage';
import ConfigPage from '../screens/settings/sections/ConfigPage';
import RolesPage from '../screens/settings/sections/RolesPage';
import UserRolesPage from '../screens/settings/sections/UserRolesPage';
import GlobalPromptsPage from '../screens/settings/sections/GlobalPromptsPage';
import VoiceSettingsPage from '../screens/settings/sections/VoiceSettingsPage';
import DataPage from '../screens/settings/sections/DataPage';
import KnowledgeManagement from '../screens/settings/sections/KnowledgeManagement';
import SearchSettingsPage from '../screens/settings/sections/SearchSettingsPage';
import VoiceTest from '../screens/_debug/VoiceTest';
import ToastTestPage from '../screens/_debug/ToastTestPage';
import DatabaseConnectionTestPage from '../screens/_debug/DatabaseConnectionTestPage';
import S3StorageTestPage from '../screens/_debug/S3StorageTestPage';
import LongPressMenuPlayground from '../screens/_debug/LongPressMenuPlayground';
import MobileNavPlayground from '../screens/_debug/MobileNavPlayground';
import MobileNavStandalone from '../screens/_debug/MobileNavStandalone';
import MobileNavDragTest from '../screens/_debug/MobileNavDragTest';
import SupabaseDebugPage from '../screens/_debug/SupabaseDebugPage';
import SyncTestPage from '../screens/_debug/SyncTestPage';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    children: [
      {
        index: true,
        element: <Home />
      },
      {
        path: 'chat',
        element: <ChatPage />
      },
      {
        path: 'roles',
        element: <RoleListPage />
      },
      {
        path: 'chat/:sessionId',
        element: <ChatPage />
      },
      {
        path: 'settings',
        element: <GlobalSettingsPage />
      },
      {
        path: 'settings/global',
        element: <GlobalSettingsPage />
      },
      {
        path: 'settings/config',
        element: <ConfigPage />
      },
      {
        path: 'settings/roles',
        element: <RolesPage />
      },
      {
        path: 'settings/userRoles',
        element: <UserRolesPage />
      },
      {
        path: 'settings/globalPrompts',
        element: <GlobalPromptsPage />
      },
      {
        path: 'settings/voice',
        element: <VoiceSettingsPage />
      },
      {
        path: 'settings/search',
        element: <SearchSettingsPage />
      },
      {
        path: 'settings/data',
        element: <DataPage />
      },
      {
        path: 'settings/knowledge',
        element: <KnowledgeManagement />
      },

      {
        path: 'debug/voice',
        element: <VoiceTest />
      },
      {
        path: 'debug/database',
        element: <DatabaseConnectionTestPage />
      },
      {
        path: 'debug/s3-storage',
        element: <S3StorageTestPage />
      },
      {
        path: 'debug/longpress-menu',
        element: <LongPressMenuPlayground />
      },
      {
        path: 'debug/mobile-nav',
        element: <MobileNavPlayground />
      },
      {
        path: 'debug/toast-test',
        element: <ToastTestPage />
      },
      {
        path: 'debug/debug',
        element: <SupabaseDebugPage />
      },
      {
        path: 'debug/sync-test',
        element: <SyncTestPage />
      },
      {
        path: '*',
        element: <NotFound />
      }
    ]
  },
  {
    path: '/debug/mobile-nav-standalone',
    element: <MobileNavStandalone />
  },
  {
    path: '/debug/mobile-nav-drag',
    element: <MobileNavDragTest />
  }
]);
