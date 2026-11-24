import { setupIonicReact } from '@ionic/react';
import '@ionic/react/css/core.css';
import { ios27ThemeConfig } from '@rdlabo/ionic-theme-ios27';
import 'virtual:settings-ios27.css';

// Loaded with the mobile settings shell. Desktop startup does not initialize
// Ionic or load its global core stylesheet; no normalize/structure CSS is used.
setupIonicReact({ ...ios27ThemeConfig });
