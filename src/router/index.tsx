import { createBrowserRouter } from 'react-router-dom';
import App from '../App';
import ChatPage from '../pages/ChatPage';
import ConfigPage from '../pages/ConfigPage';
import RolesPage from '../pages/RolesPage';
import DataPage from '../pages/DataPage';
import SettingsPage from '../pages/SettingsPage';
import Home from '../pages/Home';

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
        path: 'settings',
        element: <SettingsPage />
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
      }
    ]
  }
]);