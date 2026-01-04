import { createBrowserRouter } from 'react-router-dom';
import App from '@/App';
import ChatPage from '@/screens/chats/Chats';
import RoleListPage from '@/screens/RoleListPage';
import Home from '@/screens/Home';
import NotFound from '@/screens/NotFound';
import GlobalSettings from '@/screens/settings/sections/GlobalSettings';
import ConfigSettings from '@/screens/settings/sections/ConfigSettings';
import RolesSettings from '@/screens/settings/sections/RolesSettings';
import UserRolesSettings from '@/screens/settings/sections/UserRolesSettings';
import GlobalPromptsSettings from '@/screens/settings/sections/GlobalPromptsSettings';
import VoiceSettings from '@/screens/settings/sections/VoiceSettings';
import DataSettings from '@/screens/settings/sections/DataSettings';
import KnowledgeSettings from '@/screens/settings/sections/KnowledgeSettings';
import SearchSettings from '@/screens/settings/sections/SearchSettings';
import VoiceTest from '@/screens/_debug/VoiceTest';
import ToastTestPage from '@/screens/_debug/ToastTestPage';
import DatabaseConnectionTestPage from '@/screens/_debug/DatabaseConnectionTestPage';
import S3StorageTestPage from '@/screens/_debug/S3StorageTestPage';
import LongPressMenuPlayground from '@/screens/_debug/LongPressMenuPlayground';
import MobileNavPlayground from '@/screens/_debug/MobileNavPlayground';
import MobileNavStandalone from '@/screens/_debug/MobileNavStandalone';
import MobileNavDragTest from '@/screens/_debug/MobileNavDragTest';
import SupabaseDebugPage from '@/screens/_debug/SupabaseDebugPage';
import SyncTestPage from '@/screens/_debug/SyncTestPage';
import InputDemo from '@/screens/_debug/InputDemo';
import RoleModal from '@/screens/settings/sections/RolesModal';
import ConfigModal from '@/screens/settings/sections/ConfigModal';

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
        element: <GlobalSettings />
      },
      {
        path: 'settings/global',
        element: <GlobalSettings />
      },
      {
        path: 'settings/config',
        element: <ConfigSettings />
      },
      {
        path: 'settings/roles',
        element: <RolesSettings />
      },
      {
        path: 'settings/userRoles',
        element: <UserRolesSettings />
      },
      {
        path: 'settings/globalPrompts',
        element: <GlobalPromptsSettings />
      },
      {
        path: 'settings/voice',
        element: <VoiceSettings />
      },
      {
        path: 'settings/search',
        element: <SearchSettings />
      },
      {
        path: 'settings/data',
        element: <DataSettings />
      },
      {
        path: 'settings/knowledge',
        element: <KnowledgeSettings />
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
        path: 'debug/input-demo',
        element: <InputDemo />
      },
      {
        path: 'debug/role-modal',
        element: <RoleModal isOpen={true} onClose={() => {}} onConfirm={async () => {}} initialRole={undefined} knowledgeBases={[]} />
      },
      {
        path: 'debug/config-modal',
        element: <ConfigModal isOpen={true} onClose={() => {}} onConfirm={async () => {}} initialConfig={{}} title="调试标题" />
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
