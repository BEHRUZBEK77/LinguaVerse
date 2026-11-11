const { app, BrowserWindow, shell, session } = require('electron');

// Asosiy manzil ochilmasa (ba'zi provayderlar *.workers.dev ni to'sadi) — zaxira manzil
const APP_URLS = [process.env.LINGUAVERSE_URL, 'https://linguaverse-uz.pages.dev', 'https://linguaverse.akromovbehruz7.workers.dev'].filter(Boolean);
const APP_URL = APP_URLS[0] + '/?lv_app=desktop';
const APP_ORIGINS = APP_URLS.map(u => new URL(u).origin);
const AUTH_ORIGINS = ['https://gdifhnsffhscuetpyqwx.supabase.co'];
const GOOGLE_AUTH_ORIGIN = 'https://accounts.google.com';

function isTrustedAppUrl(value) {
  try {
    const url = new URL(value);
    return APP_ORIGINS.includes(url.origin) || AUTH_ORIGINS.includes(url.origin);
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
    backgroundColor: '#0B0D12',
    title: 'LinguaVerse',
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
    if (isTrustedAppUrl(url) || isGoogleAuthUrl(url)) return;
    event.preventDefault();
    openExternal(url);
  });
  window.webContents.on('will-redirect', (event, url) => {
    if (isTrustedAppUrl(url) || isGoogleAuthUrl(url)) return;
    event.preventDefault();
    openExternal(url);
  });

  // Manzil ochilmasa — keyingi zaxira manzilga o'tamiz
  let attempt = 0;
  window.webContents.on('did-fail-load', (_e, code, _desc, url, isMainFrame) => {
    if (!isMainFrame || code === -3) return;                 // -3: foydalanuvchi bekor qildi
    if (++attempt < APP_URLS.length) void window.loadURL(APP_URLS[attempt] + '/?lv_app=desktop');
    else void window.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent('<body style="background:#0B0D12;color:#F3EEE4;font:16px system-ui;display:grid;place-items:center;height:100vh;margin:0"><div style="text-align:center"><h2 style="font-family:Georgia,serif;font-weight:500">Internetga ulanib bo‘lmadi</h2><p style="color:#8C877D">Ulanishni tekshirib, ilovani qayta oching.</p></div></body>'));
  });
  void window.loadURL(APP_URL);
}

// Google "xavfsiz bo'lmagan brauzer" deb rad etmasligi uchun oddiy Chrome user-agent
app.userAgentFallback = app.userAgentFallback.replace(/\s?(Electron|linguaverse)\/\S+/gi, '');

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
