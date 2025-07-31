import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tsconfigPaths from "vite-tsconfig-paths";
import { traeBadgePlugin } from 'vite-plugin-trae-solo-badge';

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [
    react({
      babel: {
        plugins: mode === 'development' ? [
          'react-dev-locator',
        ] : [],
      },
    }),
    tsconfigPaths()
  ],
  server: {
    host: 'localhost',
    port: 5173
  }
}))
