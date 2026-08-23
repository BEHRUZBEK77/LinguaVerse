// ═══════════════════════════════════════════════════════════════════════════
// _firestore.js — SERVER TOMONIDAN Firestore'ga kirish
//
// Nega kerak: firestore.rules foydalanuvchiga o'ziga `plan` yozishni
// TAQIQLAYDI (aks holda hamma bepul PREMIUM olardi). Demak tarifni faqat
// ishonchli server faollashtira oladi — to'lov tasdiqlangandan keyin.
//
// Kutubxonasiz: Google service-account JWT'sini Node'ning o'z crypto moduli
// bilan imzolab, Firestore REST API'ga murojaat qilamiz. npm install kerak emas.
//
// SOZLASH — Netlify Environment Variables:
//   FIREBASE_PROJECT_ID     = linguaverse-81b52
//   FIREBASE_CLIENT_EMAIL   = firebase-adminsdk-xxx@...iam.gserviceaccount.com
//   FIREBASE_PRIVATE_KEY    = -----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n
//
// Qayerdan olish: Firebase Console → Project settings → Service accounts
//   → "Generate new private key" → yuklangan JSON ichidan.
// DIQQAT: private key butun bazaga to'liq huquq beradi. Faqat env'da saqlang.
// ═══════════════════════════════════════════════════════════════════════════

const crypto = require('crypto');

const PROJECT = () => process.env.FIREBASE_PROJECT_ID || 'linguaverse-81b52';
const BASE = () => `https://firestore.googleapis.com/v1/projects/${PROJECT()}/databases/(default)/documents`;

// ───────────────────────────────────────────────────────────────────────────
// TOKEN — bir soatlik, keshlanadi
// ───────────────────────────────────────────────────────────────────────────
let cachedToken = null;
let cachedUntil = 0;

function b64url(input) {
  return Buffer.from(input).toString('base64')
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

async function accessToken() {
  if (cachedToken && Date.now() < cachedUntil - 60_000) return cachedToken;

  const email = process.env.FIREBASE_CLIENT_EMAIL;
  let key = process.env.FIREBASE_PRIVATE_KEY;

  if (!email || !key) {
    throw new Error('FIREBASE_CLIENT_EMAIL yoki FIREBASE_PRIVATE_KEY sozlanmagan');
  }

  // Netlify env'da yangi qator "\n" matn sifatida saqlanadi — tiklaymiz
  key = key.replace(/\\n/g, '\n');

  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = b64url(JSON.stringify({
    iss: email,
    scope: 'https://www.googleapis.com/auth/datastore',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600
  }));

  const signer = crypto.createSign('RSA-SHA256');
  signer.update(`${header}.${claims}`);
  const signature = signer.sign(key, 'base64')
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

  const jwt = `${header}.${claims}.${signature}`;

  const resp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt
    })
  });

  const data = await resp.json();
  if (!resp.ok) throw new Error('Token olinmadi: ' + (data.error_description || data.error));

  cachedToken = data.access_token;
  cachedUntil = Date.now() + data.expires_in * 1000;
  return cachedToken;
}

// ───────────────────────────────────────────────────────────────────────────
// TIP O'GIRISH — Firestore REST tiplangan qiymatlar ishlatadi
// ───────────────────────────────────────────────────────────────────────────
function toValue(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') {
    return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  }
  if (typeof v === 'string') return { stringValue: v };
  if (v instanceof Date) return { timestampValue: v.toISOString() };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(toValue) } };
  if (typeof v === 'object') {
    const fields = {};
    for (const [k, val] of Object.entries(v)) fields[k] = toValue(val);
    return { mapValue: { fields } };
  }
  return { stringValue: String(v) };
}

function fromValue(v) {
  if (!v) return null;
  if ('nullValue' in v) return null;
  if ('booleanValue' in v) return v.booleanValue;
  if ('integerValue' in v) return parseInt(v.integerValue, 10);
  if ('doubleValue' in v) return v.doubleValue;
  if ('stringValue' in v) return v.stringValue;
  if ('timestampValue' in v) return new Date(v.timestampValue);
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(fromValue);
  if ('mapValue' in v) return fromFields(v.mapValue.fields || {});
  return null;
}

function toFields(obj) {
  const fields = {};
  for (const [k, v] of Object.entries(obj)) fields[k] = toValue(v);
  return fields;
}

function fromFields(fields) {
  const out = {};
  for (const [k, v] of Object.entries(fields || {})) out[k] = fromValue(v);
  return out;
}

// ───────────────────────────────────────────────────────────────────────────
// AMALLAR
// ───────────────────────────────────────────────────────────────────────────

/** Hujjatni o'qiydi. Topilmasa null. */
async function getDoc(docPath) {
  const token = await accessToken();
  const resp = await fetch(`${BASE()}/${docPath}`, {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (resp.status === 404) return null;
  const data = await resp.json();
  if (!resp.ok) throw new Error('getDoc: ' + (data.error?.message || resp.status));

  return { id: data.name.split('/').pop(), ...fromFields(data.fields) };
}

/**
 * Hujjatni yangilaydi (merge). updateMask tufayli faqat berilgan
 * maydonlar o'zgaradi — qolgani tegilmaydi.
 */
async function setDoc(docPath, data) {
  const token = await accessToken();
  const mask = Object.keys(data).map(k => `updateMask.fieldPaths=${encodeURIComponent(k)}`).join('&');

  const resp = await fetch(`${BASE()}/${docPath}?${mask}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: toFields(data) })
  });

  const out = await resp.json();
  if (!resp.ok) throw new Error('setDoc: ' + (out.error?.message || resp.status));
  return { id: out.name.split('/').pop(), ...fromFields(out.fields) };
}

/**
 * Kolleksiya-guruh bo'yicha so'rov (collection group query).
 *
 * Avto-to'lov uchun kerak: obunalar `users/{uid}/billing/subscription`
 * ichida yotadi, ya'ni har bir foydalanuvchida alohida. Ularni bitta
 * so'rov bilan topish uchun butun bazadagi `billing` kolleksiyalarini
 * birga qidiramiz.
 *
 * @param {string} collectionId  masalan 'billing'
 * @param {Array}  filters       [{ field, op, value }] — op: EQUAL,
 *                               LESS_THAN_OR_EQUAL, GREATER_THAN ...
 * @param {number} pageSize      nechta hujjat qaytsin
 * @returns {Promise<Array>}     har biri { id, path, ...maydonlar }
 */
async function queryGroup(collectionId, filters = [], pageSize = 200) {
  const token = await accessToken();

  const where = filters.length === 1
    ? { fieldFilter: mkFilter(filters[0]) }
    : { compositeFilter: { op: 'AND', filters: filters.map(f => ({ fieldFilter: mkFilter(f) })) } };

  const body = {
    structuredQuery: {
      from: [{ collectionId, allDescendants: true }],
      limit: pageSize,
      ...(filters.length ? { where } : {})
    }
  };

  const resp = await fetch(`${BASE()}:runQuery`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  const out = await resp.json();
  if (!resp.ok) throw new Error('queryGroup: ' + (out.error?.message || resp.status));

  // Javob massiv bo'lib keladi; bo'sh natijada `document` maydoni yo'q
  return (Array.isArray(out) ? out : [])
    .filter(x => x.document)
    .map(x => {
      const full = x.document.name;                   // .../documents/users/UID/billing/subscription
      const path = full.split('/documents/')[1] || '';
      return { id: path.split('/').pop(), path, ...fromFields(x.document.fields) };
    });
}

function mkFilter({ field, op, value }) {
  return { field: { fieldPath: field }, op, value: toValue(value) };
}

/**
 * Bitta kolleksiyani (masalan 'users') bitta maydon bo'yicha kamayish
 * tartibida saralab, TOP N hujjatni qaytaradi. Reyting (leaderboard)
 * uchun kerak: `users` to'g'ridan-to'g'ri klientdan o'qib bo'lmaydi
 * (firestore.rules — har kim faqat o'zinikini o'qiy oladi), shuning
 * uchun server (admin huquq bilan) top N ni o'qib, ochiq maydonlarni
 * alohida `leaderboard` kolleksiyasiga yozadi.
 *
 * @param {string} collectionId  masalan 'users'
 * @param {string} orderField    masalan 'xp'
 * @param {number} limitN        nechta hujjat
 * @returns {Promise<Array>}     har biri { id, ...maydonlar }
 */
async function queryTop(collectionId, orderField, limitN = 20) {
  const token = await accessToken();

  const body = {
    structuredQuery: {
      from: [{ collectionId }],
      orderBy: [{ field: { fieldPath: orderField }, direction: 'DESCENDING' }],
      limit: limitN
    }
  };

  const resp = await fetch(`${BASE()}:runQuery`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  const out = await resp.json();
  if (!resp.ok) throw new Error('queryTop: ' + (out.error?.message || resp.status));

  return (Array.isArray(out) ? out : [])
    .filter(x => x.document)
    .map(x => ({ id: x.document.name.split('/').pop(), ...fromFields(x.document.fields) }));
}

/**
 * Bitta kolleksiyani (ixtiyoriy) filtrlar bilan qidirib, (ixtiyoriy)
 * maydon bo'yicha saralaydi. queryGroup (faqat filtr) va queryTop (faqat
 * saralash) o'rtasidagi bo'shliqni to'ldiradi — masalan "target='english'
 * bo'yicha filtrlab, createdAt bo'yicha kamayish tartibida ber" kabi
 * so'rovlar uchun (community lug'at/unit/flashcard ro'yxati).
 *
 * @param {string} collectionId
 * @param {Array<{field,op,value}>} filters
 * @param {string|null} orderField
 * @param {number} limitN
 */
async function queryList(collectionId, filters = [], orderField = null, limitN = 30) {
  const token = await accessToken();

  const where = filters.length === 0 ? null
    : filters.length === 1 ? { fieldFilter: mkFilter(filters[0]) }
    : { compositeFilter: { op: 'AND', filters: filters.map(f => ({ fieldFilter: mkFilter(f) })) } };

  const body = {
    structuredQuery: {
      from: [{ collectionId }],
      limit: limitN,
      ...(where ? { where } : {}),
      ...(orderField ? { orderBy: [{ field: { fieldPath: orderField }, direction: 'DESCENDING' }] } : {})
    }
  };

  const resp = await fetch(`${BASE()}:runQuery`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  const out = await resp.json();
  if (!resp.ok) throw new Error('queryList: ' + (out.error?.message || resp.status));

  return (Array.isArray(out) ? out : [])
    .filter(x => x.document)
    .map(x => ({ id: x.document.name.split('/').pop(), ...fromFields(x.document.fields) }));
}

/** Yangi hujjat qo'shadi. docId berilmasa Firestore o'zi ID beradi. */
async function addDoc(collectionPath, data, docId = null) {
  const token = await accessToken();
  const q = docId ? `?documentId=${encodeURIComponent(docId)}` : '';

  const resp = await fetch(`${BASE()}/${collectionPath}${q}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: toFields(data) })
  });

  const out = await resp.json();
  if (!resp.ok) throw new Error('addDoc: ' + (out.error?.message || resp.status));
  return { id: out.name.split('/').pop(), ...fromFields(out.fields) };
}

/**
 * ATOMIK yangilash: hujjatni o'qiydi, mutate() ni qo'llaydi, yozadi.
 * Faqat hujjat o'qilgandan beri o'zgarmagan bo'lsa yozadi (currentDocument
 * sharti orqali). Bir vaqtda ikkita webhook kelsa ham ikki marta
 * hisoblanmaydi.
 */
async function transact(docPath, mutate, retries = 3) {
  for (let i = 0; i < retries; i++) {
    const token = await accessToken();

    const readResp = await fetch(`${BASE()}/${docPath}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const exists = readResp.status !== 404;
    const current = exists ? await readResp.json() : null;
    const data = exists ? fromFields(current.fields) : null;

    const patch = await mutate(data);
    if (patch === null) return data;   // mutate "hech narsa qilma" dedi

    const mask = Object.keys(patch).map(k => `updateMask.fieldPaths=${encodeURIComponent(k)}`).join('&');
    const precond = exists
      ? `currentDocument.updateTime=${encodeURIComponent(current.updateTime)}`
      : 'currentDocument.exists=false';

    const writeResp = await fetch(`${BASE()}/${docPath}?${mask}&${precond}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields: toFields(patch) })
    });

    if (writeResp.ok) {
      const out = await writeResp.json();
      return { id: out.name.split('/').pop(), ...fromFields(out.fields) };
    }

    // 409/412 — boshqa jarayon o'zgartirib ulgurdi, qaytadan urinamiz
    if (writeResp.status === 409 || writeResp.status === 412) continue;

    const err = await writeResp.json().catch(() => ({}));
    throw new Error('transact: ' + (err.error?.message || writeResp.status));
  }
  throw new Error('transact: ' + retries + ' urinishdan keyin ham bajarilmadi');
}

/** Sozlamalar to'liqmi? */
/** Hujjatni butunlay o'chiradi. */
async function deleteDoc(docPath) {
  const token = await accessToken();
  const resp = await fetch(`${BASE()}/${docPath}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!resp.ok && resp.status !== 404) {
    const out = await resp.json().catch(() => ({}));
    throw new Error('deleteDoc: ' + (out.error?.message || resp.status));
  }
  return true;
}

function configured() {
  return !!(process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY);
}

module.exports = { getDoc, setDoc, deleteDoc, addDoc, transact, queryGroup, queryTop, queryList, accessToken, configured, toValue, fromValue };
