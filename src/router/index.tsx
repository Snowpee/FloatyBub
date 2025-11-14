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
import SupabaseDebugPage from '../pages/SupabaseDebugPage';
import SyncTestPage from '../pages/SyncTestPage';

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
        path: '*',
        element: <NotFound />
      }
    ]
  }
]);
