import { createBrowserRouter } from 'react-router-dom';
import App from '../App';
import ChatPage from '../pages/ChatPage';
import RoleListPage from '../pages/RoleListPage';
import Home from '../pages/Home';
import NotFound from '../pages/NotFound';
import GlobalSettingsPage from '../pages/GlobalSettingsPage';
import ConfigPage from '../pages/ConfigPage';
import RolesPage from '../pages/RolesPage';
import UserRolesPage from '../pages/UserRolesPage';
import GlobalPromptsPage from '../pages/GlobalPromptsPage';
import VoiceSettingsPage from '../pages/VoiceSettingsPage';
import DataPage from '../pages/DataPage';
import KnowledgeManagement from '../pages/KnowledgeManagement';
import SearchSettingsPage from '../pages/SearchSettingsPage';
import VoiceTest from '../pages/tests/VoiceTest';
import ToastTestPage from '../pages/tests/ToastTestPage';
import DatabaseConnectionTestPage from '../pages/tests/DatabaseConnectionTestPage';
import S3StorageTestPage from '../pages/tests/S3StorageTestPage';
import LongPressMenuPlayground from '../pages/tests/LongPressMenuPlayground';
import MobileNavPlayground from '../pages/tests/MobileNavPlayground';
import MobileNavStandalone from '../pages/tests/MobileNavStandalone';
import MobileNavDragTest from '../pages/tests/MobileNavDragTest';
import SupabaseDebugPage from '../pages/SupabaseDebugPage';
import SyncTestPage from '../pages/SyncTestPage';
import ActionSheetDemo from '../components/ActionSheetDemo';

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
        path: 'tests/voice',
        element: <VoiceTest />
      },
      {
        path: 'tests/database',
        element: <DatabaseConnectionTestPage />
      },
      {
        path: 'tests/s3-storage',
        element: <S3StorageTestPage />
      },
      {
        path: 'tests/longpress-menu',
        element: <LongPressMenuPlayground />
      },
      {
        path: 'tests/mobile-nav',
        element: <MobileNavPlayground />
      },
      {
        path: 'tests/toast-test',
        element: <ToastTestPage />
      },
      {
        path: 'tests/debug',
        element: <SupabaseDebugPage />
      },
      {
        path: 'tests/sync-test',
        element: <SyncTestPage />
      },
      {
        path: 'demo/action-sheet',
        element: <ActionSheetDemo />
      },
      {
        path: '*',
        element: <NotFound />
      }
    ]
  },
  {
    path: '/tests/mobile-nav-standalone',
    element: <MobileNavStandalone />
  },
  {
    path: '/tests/mobile-nav-drag',
    element: <MobileNavDragTest />
  }
]);
