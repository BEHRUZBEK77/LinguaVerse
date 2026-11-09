// ═══════════════════════════════════════════════════════════════════════════
// _keys.js — API KALITLARINI O'QISH (barcha funksiyalar uchun yagona manba)
//
// Kalitlar Firestore'dagi apiConfig/global hujjatidan yuklanadi; eski lokal
// fayl va environment variables esa zaxira manbalar sifatida qoladi.
// ═══════════════════════════════════════════════════════════════════════════

const fs = require('fs');
const path = require('path');
const firestore = require('./_firestore.js');

// Muammo: Netlify funksiya FS'ida __dirname = /var/task/netlify/functions
// data/ papkasi loyiha ildizida. Ikkala holatni ham qamrab olamiz.
const CANDIDATES = [
  path.join(__dirname, '..', '..', 'data', 'api-keys.json'), // mahalliy: ROOT/data/api-keys.json
  path.join(process.cwd(), 'data', 'api-keys.json')
];
let firestoreKeys = {};
let defaultModel = '';
let defaultProvider = '';

function dataFile() {
  for (const p of CANDIDATES) {
    try {
      if (fs.existsSync(p)) return p;
    } catch {}
  }
  // Birinchi (asosiy) yo'l — agar papka bo'lmasa, yozishda uni yaratamiz
  return CANDIDATES[0];
}

function isEphemeralRuntime() {
  return process.env.CLOUDFLARE_WORKER === 'true'
    || process.env.NETLIFY === 'true'
    || process.env.AWS_LAMBDA_FUNCTION_NAME != null
    || process.env.LAMBDA_TASK_ROOT != null;
}

function load() {
  const p = dataFile();
  try {
    if (fs.existsSync(p)) {
      const parsed = JSON.parse(fs.readFileSync(p, 'utf8'));
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
    }
  } catch (e) {
    console.error('[keys] fayl o\'qilmadi:', e.message);
  }
  return {};
}

/** Refreshes server-only settings from Firestore before handling a request. */
async function refreshFromFirestore() {
  if (!firestore.configured()) {
    firestoreKeys = {};
    defaultModel = '';
    defaultProvider = '';
    return;
  }
  const config = await firestore.getDoc('apiConfig/global');
  firestoreKeys = config?.apiKeys && typeof config.apiKeys === 'object' && !Array.isArray(config.apiKeys)
    ? config.apiKeys
    : {};
  defaultModel = typeof config?.defaultModel === 'string' ? config.defaultModel : '';
  defaultProvider = typeof config?.defaultProvider === 'string' ? config.defaultProvider : '';
}

function getPersisted() {
  return { ...firestoreKeys };
}

function setPersisted(value) {
  firestoreKeys = value && typeof value === 'object' && !Array.isArray(value) ? { ...value } : {};
}

function getDefaultModel() {
  return defaultModel;
}

function getDefaultProvider() {
  return defaultProvider;
}

function source(name) {
  if (firestoreKeys[name]) return 'firebase';
  const fileKeys = load();
  if (fileKeys[name]) return 'file';
  return process.env[name] ? 'environment' : 'none';
}

/** Key priority: Firestore, legacy local file, then environment variables. */
function get(name) {
  if (firestoreKeys[name] != null && firestoreKeys[name] !== '') return String(firestoreKeys[name]);
  const fileKeys = load();
  if (fileKeys[name] != null && fileKeys[name] !== '') return String(fileKeys[name]);
  return process.env[name] || '';
}

function configured(name) {
  return !!get(name);
}

/** Kalitlarni data/api-keys.json'ga saqlaydi. */
function save(keys) {
  const p = dataFile();
  try {
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, JSON.stringify(keys || {}, null, 2), 'utf8');
    return p;
  } catch (e) {
    console.error('[keys] saqlashda xato:', e.message);
    return null;
  }
}

/** Kalitni yashiradi — faqat oxirgi 4 ta belgini ko'rsatadi. */
function mask(value) {
  const s = String(value || '');
  if (!s) return '';
  if (s.length <= 6) return '****';
  return '****' + s.slice(-4);
}

module.exports = {
  load, get, configured, save, mask, dataFile, isEphemeralRuntime,
  refreshFromFirestore, getPersisted, setPersisted, getDefaultModel, getDefaultProvider, source
};
