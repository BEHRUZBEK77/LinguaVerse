// ═══════════════════════════════════════════════════════════════════════════
// js/fb/firebase-app.js — "firebase/app" o'rnini bosuvchi modul
// Ilova obyekti faqat moslik uchun; haqiqiy ulanish js/fb/client.js da.
// ═══════════════════════════════════════════════════════════════════════════
import './client.js';

const apps = [];

export function initializeApp(options = {}, name = '[DEFAULT]') {
  const existing = apps.find(a => a.name === name);
  if (existing) return existing;
  const app = { name, options, automaticDataCollectionEnabled: false };
  apps.push(app);
  return app;
}

export function getApps() {
  return apps.slice();
}

export function getApp(name = '[DEFAULT]') {
  return apps.find(a => a.name === name) || initializeApp({}, name);
}

export function deleteApp(app) {
  const i = apps.indexOf(app);
  if (i >= 0) apps.splice(i, 1);
  return Promise.resolve();
}

export const SDK_VERSION = 'supabase-compat-1.0';
