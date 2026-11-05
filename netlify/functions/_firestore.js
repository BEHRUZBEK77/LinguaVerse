// ═══════════════════════════════════════════════════════════════════════════
// _firestore.js — SERVER TOMONIDAN bazaga kirish (endi SUPABASE)
//
// Nomi tarixiy: avval Firebase Firestore edi. Ko'chishdan keyin barcha
// funksiyalar (to'lov, AI ustoz, kurslar, reyting...) xuddi shu API bilan
// Supabase'dagi `docs` jadvaliga yozadi — hujjat yo'llari o'zgarmagan:
// users/{uid}, orders/{id}, users/{uid}/billing/subscription ...
//
// Server service_role kaliti bilan ishlaydi (Firebase Admin SDK kabi —
// xavfsizlik qoidalarini chetlab o'tadi). Kalit faqat Netlify env'da.
//
// SOZLASH — Netlify Environment Variables:
//   SUPABASE_URL               = https://gdifhnsffhscuetpyqwx.supabase.co
//   SUPABASE_SERVICE_ROLE_KEY  = (Supabase → Project Settings → API → service_role)
//
// Vaqt qiymatlari bazada {"$t":"ISO"} ko'rinishida saqlanadi va bu yerda
// avtomatik Date ga aylanadi (Firestore Timestamp kabi).
// ═══════════════════════════════════════════════════════════════════════════

const crypto = require('crypto');
const legacy = require('./_firebase-legacy.js');

const URL_ = () => (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
const KEY = () => process.env.SUPABASE_SERVICE_ROLE_KEY || '';

function configured() {
  return !!(URL_() && KEY());
}

function headers(extra = {}) {
  return { apikey: KEY(), Authorization: `Bearer ${KEY()}`, 'Content-Type': 'application/json', ...extra };
}

// ── Qiymatlarni kodlash: Date ↔ {"$t":"ISO"} ──
function enc(v) {
  if (v === undefined) return undefined;
  if (v === null) return null;
  if (v instanceof Date) return { $t: v.toISOString() };
  if (Array.isArray(v)) return v.map(x => (x === undefined ? null : enc(x)));
  if (typeof v === 'object') {
    const o = {};
    for (const [k, x] of Object.entries(v)) if (x !== undefined) o[k] = enc(x);
    return o;
  }
  return v;
}
function dec(v) {
  if (v === null || v === undefined) return v ?? null;
  if (Array.isArray(v)) return v.map(dec);
  if (typeof v === 'object') {
    if (typeof v.$t === 'string' && Object.keys(v).length === 1) return new Date(v.$t);
    const o = {};
    for (const [k, x] of Object.entries(v)) o[k] = dec(x);
    return o;
  }
  return v;
}

function split(path) {
  const s = String(path).split('/');
  if (s.length % 2 !== 0 || s.some(x => !x)) throw new Error("Noto'g'ri hujjat yo'li: " + path);
  return { col: s[s.length - 2], parent: s.slice(0, -2).join('/'), id: s[s.length - 1] };
}

async function rest(method, query, body, extraHeaders) {
  if (!configured()) throw new Error('SUPABASE_URL yoki SUPABASE_SERVICE_ROLE_KEY sozlanmagan');
  const r = await fetch(`${URL_()}/rest/v1/${query}`, {
    method, headers: headers(extraHeaders), body: body === undefined ? undefined : JSON.stringify(body)
  });
  const text = await r.text();
  const data = text ? JSON.parse(text) : null;
  if (!r.ok) {
    const err = new Error(`supabase ${method} ${query.split('?')[0]}: ${data?.message || r.status}`);
    err.status = r.status; err.code = data?.code;
    throw err;
  }
  return data;
}

async function readRow(path) {
  const rows = await rest('GET', `docs?path=eq.${encodeURIComponent(path)}&select=data,version`);
  return rows && rows[0] ? rows[0] : null;
}

/** Hujjatni o'qiydi. Topilmasa null. */
async function getDoc(docPath) {
  const row = await readRow(docPath);
  if (!row) return null;
  return { id: split(docPath).id, ...dec(row.data) };
}

/**
 * Atomik "o'qi → o'zgartir → yoz" (versiya bilan). Boshqa jarayon orada
 * yozib ulgursa — qayta urinadi. mutate(data|null) → patch | null.
 * Patch yuqori darajadagi maydonlarni almashtiradi (Firestore updateMask kabi).
 */
async function transact(docPath, mutate, retries = 5) {
  const { col, parent } = split(docPath);
  for (let i = 0; i < retries; i++) {
    const row = await readRow(docPath);
    const current = row ? dec(row.data) : null;
    const patch = await mutate(current ? { ...current } : null);
    if (patch === null || patch === undefined) return current;

    const next = enc({ ...(current || {}), ...patch });
    if (row) {
      const upd = await rest('PATCH',
        `docs?path=eq.${encodeURIComponent(docPath)}&version=eq.${row.version}`,
        { data: next, version: row.version + 1, updated_at: new Date().toISOString() },
        { Prefer: 'return=representation' });
      if (Array.isArray(upd) && upd.length) return { id: split(docPath).id, ...dec(upd[0].data) };
    } else {
      try {
        const ins = await rest('POST', 'docs', { path: docPath, col, parent, data: next }, { Prefer: 'return=representation' });
        if (Array.isArray(ins) && ins.length) return { id: split(docPath).id, ...dec(ins[0].data) };
      } catch (e) {
        if (e.code !== '23505') throw e;            // parallel yaratildi — qayta urinamiz
      }
    }
    await new Promise(r => setTimeout(r, 30 + Math.random() * 120));
  }
  throw new Error('transact: ' + retries + ' urinishdan keyin ham bajarilmadi');
}

/** Maydonlarni yangilaydi (merge) — qolganlari tegilmaydi. Hujjat bo'lmasa yaratadi. */
async function setDoc(docPath, data) {
  return transact(docPath, () => ({ ...data }));
}

/** Tanlangan maydonlarni o'chiradi. */
async function deleteFields(docPath, fields) {
  if (!Array.isArray(fields) || fields.length === 0 || fields.some(f => typeof f !== 'string' || !f)) {
    throw new Error('deleteFields: maydonlar ro‘yxati noto‘g‘ri');
  }
  const { col, parent } = split(docPath);
  for (let i = 0; i < 5; i++) {
    const row = await readRow(docPath);
    if (!row) return null;
    const next = { ...row.data };
    for (const f of fields) delete next[f];
    const upd = await rest('PATCH', `docs?path=eq.${encodeURIComponent(docPath)}&version=eq.${row.version}`,
      { data: next, version: row.version + 1, updated_at: new Date().toISOString() }, { Prefer: 'return=representation' });
    if (Array.isArray(upd) && upd.length) return { id: split(docPath).id, ...dec(upd[0].data) };
    void col; void parent;
  }
  throw new Error('deleteFields: bajarilmadi');
}

/** Hujjatni butunlay o'chiradi. */
async function deleteDoc(docPath) {
  await rest('DELETE', `docs?path=eq.${encodeURIComponent(docPath)}`);
  return true;
}

/** Yangi hujjat qo'shadi. docId berilmasa tasodifiy ID (Firestore uslubida, 20 belgi). */
function autoId() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const b = crypto.randomBytes(20);
  let s = '';
  for (let i = 0; i < 20; i++) s += chars[b[i] % chars.length];
  return s;
}
async function addDoc(collectionPath, data, docId = null) {
  const id = docId || autoId();
  const path = `${collectionPath}/${id}`;
  const { col, parent } = split(path);
  const ins = await rest('POST', 'docs', { path, col, parent, data: enc(data) }, { Prefer: 'return=representation' });
  return { id, ...dec(ins[0].data) };
}

// ── So'rovlar (Firestore REST operator nomlari saqlangan) ──
const OPS = {
  EQUAL: '==', NOT_EQUAL: '!=', LESS_THAN: '<', LESS_THAN_OR_EQUAL: '<=',
  GREATER_THAN: '>', GREATER_THAN_OR_EQUAL: '>=', ARRAY_CONTAINS: 'array-contains',
  IN: 'in', NOT_IN: 'not-in', ARRAY_CONTAINS_ANY: 'array-contains-any'
};
const mapFilters = filters => (filters || []).map(f => ({ f: f.field, op: OPS[f.op] || f.op, v: enc(f.value) }));

async function rpcQuery(col, parent, filters, orders, limit) {
  const rows = await rest('POST', 'rpc/lv_query', { c: col, par: parent, filters, orders, lim: limit });
  return (rows || []).map(r => ({ id: r.path.split('/').pop(), path: r.path, ...dec(r.data) }));
}

/** Collection group: shu nomdagi barcha kolleksiyalar (ichma-ich ham). */
async function queryGroup(collectionId, filters = [], pageSize = 200) {
  return rpcQuery(collectionId, null, mapFilters(filters), [], pageSize);
}

/** Bitta (ildiz) kolleksiyadan maydon bo'yicha kamayish tartibida TOP N. */
async function queryTop(collectionId, orderField, limitN = 20) {
  return rpcQuery(collectionId, '', [], [{ f: orderField, dir: 'desc' }], limitN);
}

/** Ildiz kolleksiyani filtrlab, (ixtiyoriy) maydon bo'yicha kamayish tartibida. */
async function queryList(collectionId, filters = [], orderField = null, limitN = 30) {
  return rpcQuery(collectionId, '', mapFilters(filters), orderField ? [{ f: orderField, dir: 'desc' }] : [], limitN);
}

/** Aniq hujjatlar soni. */
async function countCollection(collectionId) {
  const n = await rest('POST', 'rpc/lv_count', { c: collectionId, par: '', filters: [] });
  return Number(n) || 0;
}

/** Eski API bilan moslik: endi token kerak emas (service_role kaliti). */
async function accessToken() {
  return KEY();
}

module.exports = {
  getDoc, setDoc, deleteFields, deleteDoc, addDoc, transact, queryGroup, queryTop,
  countCollection, queryList, accessToken, configured,
  // Firestore REST format o'giruvchilari (ko'chirish skripti va eski testlar uchun)
  toValue: legacy.toValue, fromValue: legacy.fromValue,
  enc, dec, split, autoId
};
