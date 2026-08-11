// ═══════════════════════════════════════════════════════════════════════════
// _keys.js — API KALITLARINI O'QISH (barcha funksiyalar uchun yagona manba)
//
// Tartibi:
//   1. data/api-keys.json  — admin panel orqali saqlangan kalitlar (avval)
//   2. process.env         — .env / Netlify Environment Variables (zaxira)
//
// Nega bu kerak: admin panel kalitlarni saqlaganda ular darhol ishlashi
// kerak. Fayl yozilgach, dev-server funksiyalarni har so'rovda qayta
// yuklagani uchun yangi kalit darhol qo'llanadi.
//
// Netlify'da faylga yozib bo'lmaydi (ephemeral FS) — u yerda kalitlar
// Netlify Environment Variables orqali beriladi va bu modul avtomatik
// env'dan o'qiydi. Ya'ni ikki joy bir xil ishlaydi.
// ═══════════════════════════════════════════════════════════════════════════

const fs = require('fs');
const path = require('path');

// Muammo: Netlify funksiya FS'ida __dirname = /var/task/netlify/functions
// data/ papkasi loyiha ildizida. Ikkala holatni ham qamrab olamiz.
const CANDIDATES = [
  path.join(__dirname, '..', '..', 'data', 'api-keys.json'), // mahalliy: ROOT/data/api-keys.json
  path.join(process.cwd(), 'data', 'api-keys.json')
];

function dataFile() {
  for (const p of CANDIDATES) {
    try {
      if (fs.existsSync(p)) return p;
    } catch {}
  }
  // Birinchi (asosiy) yo'l — agar papka bo'lmasa, yozishda uni yaratamiz
  return CANDIDATES[0];
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

/** Kalitni topadi: avval fayldan, yo'q bo'lsa process.env'dan. */
function get(name) {
  const fileKeys = load();
  if (fileKeys[name] != null && fileKeys[name] !== '') return String(fileKeys[name]);
  return process.env[name] || '';
}

function configured(name) {
  return !!get(name);
}

/** Barcha kalitlarni process.env'ga yozadi (qayta ishga tushirmasdan).
 *  `manage` — ro'yxatdagi lekin keys'da yo'q bo'lgan nomlar ham o'chiriladi
 *  (bo'sh maydon = eski env qiymati xotiraga yopishib qolmasligi uchun). */
function applyToEnv(keys, manage) {
  for (const [k, v] of Object.entries(keys || {})) {
    if (v != null && v !== '') process.env[k] = String(v);
    else delete process.env[k];
  }
  if (Array.isArray(manage)) {
    for (const k of manage) {
      const v = keys ? keys[k] : undefined;
      if (v === undefined || v === null || v === '') delete process.env[k];
    }
  }
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

module.exports = { load, get, configured, applyToEnv, save, mask, dataFile };
