import { createBrowserRouter } from 'react-router-dom';
import App from '../App';
import ChatPage from '../pages/ChatPage';
import Home from '../pages/Home';
import NotFound from '../pages/NotFound';
import VoiceTest from '../pages/tests/VoiceTest';
import ToastTestPage from '../pages/tests/ToastTestPage';
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
        path: 'chat/:sessionId',
        element: <ChatPage />
      },

      {
        path: 'tests/voice',
        element: <VoiceTest />
      },
      {
        path: 'toast-test',
        element: <ToastTestPage />
      },
      {
        path: 'debug',
        element: <SupabaseDebugPage />
      },
      {
        path: 'sync-test',
        element: <SyncTestPage />
      },
      {
        path: '*',
        element: <NotFound />
      }
    ]
  }
]);