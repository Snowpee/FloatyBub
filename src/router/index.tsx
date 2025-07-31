import { createBrowserRouter } from 'react-router-dom';
import App from '../App';
import ChatPage from '../pages/ChatPage';
import ConfigPage from '../pages/ConfigPage';
import RolesPage from '../pages/RolesPage';
import DataPage from '../pages/DataPage';
import Home from '../pages/Home';
import VoiceTest from '../pages/tests/VoiceTest';
import VercelModelTest from '../pages/tests/VercelModelTest';
import ToastTestPage from '../pages/tests/ToastTestPage';

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
        path: 'config',
        element: <ConfigPage />
      },
      {
        path: 'roles',
        element: <RolesPage />
      },

      {
        path: 'data',
        element: <DataPage />
      },
      {
        path: 'voice-test',
        element: <VoiceTest />
      },
      {
        path: 'vercel-model-test',
        element: <VercelModelTest />
      },
      {
        path: 'toast-test',
        element: <ToastTestPage />
      }
    ]
  }
]);