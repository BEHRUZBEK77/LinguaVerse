const { app, BrowserWindow, shell, session } = require('electron');

const APP_URL = process.env.LINGUAVERSE_URL || 'https://linguaverce.netlify.app';
const APP_ORIGIN = new URL(APP_URL).origin;
const FIREBASE_AUTH_ORIGIN = 'https://linguaverse-81b52.firebaseapp.com';
const GOOGLE_AUTH_ORIGIN = 'https://accounts.google.com';

function isTrustedAppUrl(value) {
  try {
    const url = new URL(value);
    return url.origin === APP_ORIGIN || url.origin === FIREBASE_AUTH_ORIGIN;
  } catch {
    return false;
  }
}

function isGoogleAuthUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.origin === GOOGLE_AUTH_ORIGIN;
  } catch {
    return false;
  }
}

function openExternal(value) {
  try {
    const url = new URL(value);
    if (url.protocol === 'https:' || url.protocol === 'http:') {
      void shell.openExternal(url.href);
    }
  } catch (error) {
    console.warn('[desktop] Ignoring invalid external URL:', error.message);
  }
}

function createWindow() {
  const window = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 360,
    minHeight: 600,
    show: false,
    backgroundColor: '#080d1a',
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true
    }
  });

  window.once('ready-to-show', () => window.show());
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (isTrustedAppUrl(url) || isGoogleAuthUrl(url)) {
      return {
        action: 'allow',
        overrideBrowserWindowOptions: {
          width: 520,
          height: 720,
          autoHideMenuBar: true,
          webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: true,
            webSecurity: true
          }
        }
      };
    }
    openExternal(url);
    return { action: 'deny' };
  });
  window.webContents.on('will-navigate', (event, url) => {
    if (isTrustedAppUrl(url)) return;
    event.preventDefault();
    openExternal(url);
  });
  window.webContents.on('will-redirect', (event, url) => {
    if (isTrustedAppUrl(url)) return;
    event.preventDefault();
    openExternal(url);
  });

  void window.loadURL(APP_URL);
}

app.whenReady().then(() => {
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback, details) => {
    const origin = details.requestingUrl || webContents.getURL();
    callback(isTrustedAppUrl(origin) && ['media', 'notifications'].includes(permission));
  });
  session.defaultSession.setPermissionCheckHandler((webContents, permission, origin) =>
    isTrustedAppUrl(origin) && ['media', 'notifications'].includes(permission)
  );
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
