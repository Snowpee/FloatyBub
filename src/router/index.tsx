import { createBrowserRouter } from 'react-router-dom';
import App from '../App';
import ChatPage from '../pages/ChatPage';
import Home from '../pages/Home';
import NotFound from '../pages/NotFound';
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
      },
      {
        path: '*',
        element: <NotFound />
      }
    ]
  }
]);