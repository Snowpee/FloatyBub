import type { CapacitorConfig } from '@capacitor/cli';

// Capacitor configuration for packaging the existing Vite build without
// impacting the web app. The webDir points to Vite's default output: "dist".
// We do not change Vite base or build settings here, so web remains untouched.
const config: CapacitorConfig = {
  appId: 'com.floatybub.app',
  appName: 'Floaty Bub',
  webDir: 'dist',
  // Optional server settings for development with live reload.
  // Keep disabled by default to avoid avoiding normal web builds.
  server: {
    cleartext: true
    // For live reload on device, uncomment and set your dev server url:
    // url: 'http://localhost:5173',
    // androidScheme: 'http',
  }
};

export default config;