// ═══════════════════════════════════════════════════════════════════════════
// js/fb/firebase-firestore.js — "firebase/firestore" API'si, ichida Supabase
//
// Hujjatlar Supabase'dagi `docs` jadvalida, Firestore yo'llari bilan saqlanadi.
//   o'qish     → to'g'ridan-to'g'ri jadvaldan (RLS qoidalari bilan)
//   yozish     → lv_write() RPC (firestore.rules ning SQL nusxasi tekshiradi)
//   so'rov     → lv_query() RPC (where / orderBy / limit)
//   tranzaksiya→ lv_commit() (versiya bilan, to'qnashuvda qayta urinadi)
//   onSnapshot → Supabase Realtime
// serverTimestamp(), increment(), arrayUnion() ... serverda bajariladi.
// ═══════════════════════════════════════════════════════════════════════════
import { supabase, FirebaseError } from './client.js';

// ── Timestamp ──
export class Timestamp {
  constructor(seconds, nanoseconds = 0) { this.seconds = seconds; this.nanoseconds = nanoseconds; }
  static fromDate(d) { const ms = d.getTime(); return new Timestamp(Math.floor(ms / 1000), (ms % 1000) * 1e6); }
  static fromMillis(ms) { return new Timestamp(Math.floor(ms / 1000), (ms % 1000) * 1e6); }
  static now() { return Timestamp.fromMillis(Date.now()); }
  toDate() { return new Date(this.toMillis()); }
  toMillis() { return this.seconds * 1000 + Math.floor(this.nanoseconds / 1e6); }
  isEqual(o) { return o instanceof Timestamp && o.seconds === this.seconds && o.nanoseconds === this.nanoseconds; }
  valueOf() { return String(this.toMillis()).padStart(16, '0'); }
  toJSON() { return { seconds: this.seconds, nanoseconds: this.nanoseconds }; }
  toString() { return this.toDate().toISOString(); }
}

// ── Qiymatlarni kodlash ──
const SENTINEL = Symbol('lv-sentinel');
const sentinel = obj => Object.assign(obj, { [SENTINEL]: true });
export const serverTimestamp = () => sentinel({ $op: 'ts' });
export const increment = n => sentinel({ $op: 'inc', n: Number(n) || 0 });
export const arrayUnion = (...v) => sentinel({ $op: 'union', v });
export const arrayRemove = (...v) => sentinel({ $op: 'remove', v });
export const deleteField = () => sentinel({ $op: 'del' });

function enc(v) {
  if (v === undefined) return undefined;
  if (v === null) return null;
  if (v instanceof Timestamp) return { $t: v.toDate().toISOString() };
  if (v instanceof Date) return { $t: v.toISOString() };
  if (v && v[SENTINEL]) {
    if (v.$op === 'union' || v.$op === 'remove') return { $op: v.$op, v: v.v.map(enc) };
    return { ...v };
  }
  if (v instanceof DocumentReference) return v.path;
  if (Array.isArray(v)) return v.map(x => (x === undefined ? null : enc(x)));
  if (typeof v === 'object') {
    const o = {};
    for (const [k, x] of Object.entries(v)) if (x !== undefined) o[k] = enc(x);
    return o;
  }
  if (typeof v === 'number' && !Number.isFinite(v)) return null;
  return v;
}
function dec(v) {
  if (v === null || v === undefined) return v ?? null;
  if (Array.isArray(v)) return v.map(dec);
  if (typeof v === 'object') {
    if (typeof v.$t === 'string' && Object.keys(v).length === 1) return Timestamp.fromDate(new Date(v.$t));
    const o = {};
    for (const [k, x] of Object.entries(v)) o[k] = dec(x);
    return o;
  }
  return v;
}

// ── Xatolar ──
function mapErr(error) {
  const m = String(error?.message || error || '');
  let code = 'unknown';
  if (/permission-denied|permission denied|42501/i.test(m) || error?.code === '42501') code = 'permission-denied';
  else if (/unauthenticated|JWT/i.test(m)) code = 'unauthenticated';
  else if (/not-found|P0002/i.test(m) || error?.code === 'P0002') code = 'not-found';
  else if (/already-exists|23505/i.test(m) || error?.code === '23505') code = 'already-exists';
  else if (/invalid-argument|22023/i.test(m)) code = 'invalid-argument';
  else if (/failed to fetch|network|timeout/i.test(m)) code = 'unavailable';
  return new FirebaseError(code, m);
}

// ── Havolalar ──
const db = { type: 'firestore', app: { name: '[DEFAULT]' }, toJSON: () => ({}) };
export function getFirestore() { return db; }
export function initializeFirestore() { return db; }
export const persistentLocalCache = () => ({});
export const persistentMultipleTabManager = () => ({});
export const memoryLocalCache = () => ({});
export function enableIndexedDbPersistence() { return Promise.resolve(); }
export function enableMultiTabIndexedDbPersistence() { return Promise.resolve(); }

function autoId() {
  const c = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const b = crypto.getRandomValues(new Uint8Array(20));
  let s = ''; for (const x of b) s += c[x % c.length];
  return s;
}

export class DocumentReference {
  constructor(path) {
    this.type = 'document'; this.path = path; this.firestore = db;
    const s = path.split('/'); this.id = s[s.length - 1];
  }
  get parent() { return new CollectionReference(this.path.split('/').slice(0, -1).join('/')); }
  withConverter() { return this; }
}
export class Query {
  constructor(colPath, group = false, filters = [], orders = [], lim = null) {
    this.type = 'query'; this._col = colPath; this._group = group; this._filters = filters; this._orders = orders; this._limit = lim; this.firestore = db;
  }
  withConverter() { return this; }
}
export class CollectionReference extends Query {
  constructor(path) {
    super(path);
    this.type = 'collection'; this.path = path;
    const s = path.split('/'); this.id = s[s.length - 1];
  }
  get parent() { const s = this.path.split('/'); return s.length > 1 ? new DocumentReference(s.slice(0, -1).join('/')) : null; }
}

function joinPath(base, segs) {
  const parts = [];
  if (base && base.path) parts.push(base.path);
  for (const s of segs) if (s !== undefined && s !== null && s !== '') parts.push(String(s));
  return parts.join('/').split('/').filter(Boolean).join('/');
}

export function doc(parent, ...segs) {
  let path;
  if (parent instanceof CollectionReference || parent instanceof DocumentReference) path = joinPath(parent, segs);
  else path = joinPath(null, segs);
  if (path.split('/').length % 2 === 1) path += '/' + autoId();      // doc(collectionRef) → avto ID
  if (path.split('/').length % 2 !== 0) throw new FirebaseError('invalid-argument', 'Hujjat yo‘li juft segmentli bo‘lishi kerak: ' + path);
  return new DocumentReference(path);
}

export function collection(parent, ...segs) {
  const path = (parent instanceof DocumentReference || parent instanceof CollectionReference) ? joinPath(parent, segs) : joinPath(null, segs);
  if (path.split('/').length % 2 !== 1) throw new FirebaseError('invalid-argument', 'Kolleksiya yo‘li toq segmentli bo‘lishi kerak: ' + path);
  return new CollectionReference(path);
}

export function collectionGroup(_db, id) { return new Query(id, true); }

// ── So'rov cheklovlari ──
export const where = (f, op, v) => ({ kind: 'where', f: String(f), op, v });
export const orderBy = (f, dir = 'asc') => ({ kind: 'orderBy', f: String(f), dir });
export const limit = n => ({ kind: 'limit', n });
export const limitToLast = n => ({ kind: 'limit', n, last: true });
export const documentId = () => '__name__';

export function query(base, ...cons) {
  const q = new Query(base._col || base.path, base._group, [...(base._filters || [])], [...(base._orders || [])], base._limit);
  for (const c of cons.flat()) {
    if (!c) continue;
    if (c.kind === 'where') q._filters.push({ f: c.f, op: c.op, v: enc(c.v) });
    else if (c.kind === 'orderBy') q._orders.push({ f: c.f, dir: c.dir });
    else if (c.kind === 'limit') { q._limit = c.n; q._last = !!c.last; }
  }
  return q;
}

// ── Snapshot'lar ──
class DocumentSnapshot {
  constructor(ref, row) {
    this.ref = ref; this.id = ref.id; this._row = row;
    this.metadata = { hasPendingWrites: false, fromCache: false };
  }
  exists() { return !!this._row; }
  data() { return this._row ? dec(this._row.data) : undefined; }
  get(field) {
    let v = this.data();
    for (const k of String(field).split('.')) v = v == null ? undefined : v[k];
    return v;
  }
}
class QueryDocumentSnapshot extends DocumentSnapshot { }
class QuerySnapshot {
  constructor(q, docs, prev = []) {
    this.query = q; this.docs = docs; this.size = docs.length; this.empty = docs.length === 0;
    this.metadata = { hasPendingWrites: false, fromCache: false };
    this._prev = prev;
  }
  forEach(cb, thisArg) { this.docs.forEach(d => cb.call(thisArg, d)); }
  docChanges() {
    const prev = new Map(this._prev.map((d, i) => [d.ref.path, { d, i }]));
    const out = [];
    this.docs.forEach((d, i) => {
      const p = prev.get(d.ref.path);
      if (!p) out.push({ type: 'added', doc: d, oldIndex: -1, newIndex: i });
      else if (JSON.stringify(p.d._row?.data) !== JSON.stringify(d._row?.data) || p.i !== i) out.push({ type: 'modified', doc: d, oldIndex: p.i, newIndex: i });
      prev.delete(d.ref.path);
    });
    for (const { d, i } of prev.values()) out.push({ type: 'removed', doc: d, oldIndex: i, newIndex: -1 });
    return out;
  }
}

// ── O'qish ──
async function readRow(path) {
  const { data, error } = await supabase.from('docs').select('data,version').eq('path', path).maybeSingle();
  if (error) throw mapErr(error);
  return data;
}

export async function getDoc(ref) {
  return new DocumentSnapshot(ref, await readRow(ref.path));
}
export const getDocFromServer = getDoc;
export const getDocFromCache = getDoc;

function qParams(q) {
  const parts = q._col.split('/');
  const col = parts[parts.length - 1];
  const parent = q._group ? null : parts.slice(0, -1).join('/');
  const filters = q._filters.map(f => (f.f === '__name__' ? { ...f, f: '__id__' } : f));
  let orders = q._orders;
  if (q._last) orders = orders.map(o => ({ ...o, dir: o.dir === 'desc' ? 'asc' : 'desc' }));
  return { c: col, par: parent, filters, orders, lim: q._limit || 1000 };
}

async function runQuery(q) {
  const p = qParams(q);
  // documentId() bo'yicha filtr — yo'l bo'yicha (kam ishlatiladi)
  const idFilters = p.filters.filter(f => f.f === '__id__');
  p.filters = p.filters.filter(f => f.f !== '__id__');
  const { data, error } = await supabase.rpc('lv_query', p);
  if (error) throw mapErr(error);
  let rows = data || [];
  for (const f of idFilters) {
    const want = Array.isArray(f.v) ? f.v.map(String) : [String(f.v)];
    rows = rows.filter(r => {
      const id = r.path.split('/').pop();
      return f.op === 'in' ? want.includes(id) : f.op === '!=' ? id !== want[0] : id === want[0];
    });
  }
  if (q._last) rows = rows.reverse();
  return rows.map(r => new QueryDocumentSnapshot(new DocumentReference(r.path), r));
}

export async function getDocs(q) {
  return new QuerySnapshot(q, await runQuery(q));
}
export const getDocsFromServer = getDocs;
export const getDocsFromCache = getDocs;

export async function getCountFromServer(q) {
  const p = qParams(q);
  const { data, error } = await supabase.rpc('lv_count', { c: p.c, par: p.par, filters: p.filters });
  if (error) throw mapErr(error);
  return { data: () => ({ count: Number(data) || 0 }) };
}

// ── Yozish ──
async function write(path, data, mode) {
  const { error } = await supabase.rpc('lv_write', { p: path, patch: enc(data) ?? {}, mode });
  if (error) throw mapErr(error);
}

export async function setDoc(ref, data, options = {}) {
  const merge = options && (options.merge || options.mergeFields);
  await write(ref.path, data, merge ? 'merge' : 'set');
}

export async function updateDoc(ref, dataOrField, ...rest) {
  let data = dataOrField;
  if (typeof dataOrField === 'string' || dataOrField?.constructor?.name === 'FieldPath') {
    data = {};
    const all = [dataOrField, ...rest];
    for (let i = 0; i < all.length; i += 2) data[String(all[i])] = all[i + 1];
  }
  await write(ref.path, data, 'update');
}

export async function addDoc(colRef, data) {
  const ref = doc(colRef);
  await write(ref.path, data, 'create');
  return ref;
}

export async function deleteDoc(ref) {
  await write(ref.path, {}, 'delete');
}

// ── Batch ──
export function writeBatch() {
  const ops = [];
  const b = {
    set(ref, data, opt = {}) { ops.push({ path: ref.path, data: enc(data) ?? {}, mode: opt.merge ? 'merge' : 'set' }); return b; },
    update(ref, data) { ops.push({ path: ref.path, data: enc(data) ?? {}, mode: 'update' }); return b; },
    delete(ref) { ops.push({ path: ref.path, data: {}, mode: 'delete' }); return b; },
    async commit() {
      const { data, error } = await supabase.rpc('lv_commit', { reads: [], writes: ops });
      if (error) throw mapErr(error);
      if (data === false) throw new FirebaseError('aborted', 'Yozish bajarilmadi');
    }
  };
  return b;
}

// ── Tranzaksiya ──
export async function runTransaction(_db, fn, { maxAttempts = 5 } = {}) {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const reads = new Map();
    const writes = [];
    const tx = {
      async get(ref) {
        const row = await readRow(ref.path);
        reads.set(ref.path, row ? row.version : 0);
        return new DocumentSnapshot(ref, row);
      },
      set(ref, data, opt = {}) { writes.push({ path: ref.path, data: enc(data) ?? {}, mode: opt.merge ? 'merge' : 'set' }); return tx; },
      update(ref, dataOrField, ...rest) {
        let data = dataOrField;
        if (typeof dataOrField === 'string') { data = {}; const all = [dataOrField, ...rest]; for (let i = 0; i < all.length; i += 2) data[all[i]] = all[i + 1]; }
        writes.push({ path: ref.path, data: enc(data) ?? {}, mode: 'update' }); return tx;
      },
      delete(ref) { writes.push({ path: ref.path, data: {}, mode: 'delete' }); return tx; }
    };
    const result = await fn(tx);
    const { data, error } = await supabase.rpc('lv_commit', {
      reads: [...reads].map(([path, version]) => ({ path, version })),
      writes
    });
    if (error) throw mapErr(error);
    if (data === true) return result;
    await new Promise(r => setTimeout(r, 40 + Math.random() * 160));
  }
  throw new FirebaseError('aborted', 'Tranzaksiya bajarilmadi — qayta urinib ko‘ring');
}

// ── Jonli kuzatish (onSnapshot) ──
let chanSeq = 0;
export function onSnapshot(target, ...args) {
  let opts = {};
  if (args[0] && typeof args[0] === 'object' && !args[0].next && typeof args[0] !== 'function') opts = args.shift();
  let onNext = args[0], onError = args[1];
  if (onNext && typeof onNext === 'object') { onError = onNext.error?.bind(onNext); onNext = onNext.next?.bind(onNext); }
  void opts;

  const isDoc = target instanceof DocumentReference;
  let stopped = false, prevDocs = [], timer = 0, lastJson = null;

  const fetchNow = async () => {
    if (stopped) return;
    try {
      if (isDoc) {
        const row = await readRow(target.path);
        const j = JSON.stringify(row?.data ?? null);
        if (j === lastJson) return;
        lastJson = j;
        onNext?.(new DocumentSnapshot(target, row));
      } else {
        const docs = await runQuery(target);
        const j = JSON.stringify(docs.map(d => [d.ref.path, d._row?.data]));
        if (j === lastJson) return;
        lastJson = j;
        const snap = new QuerySnapshot(target, docs, prevDocs);
        prevDocs = docs;
        onNext?.(snap);
      }
    } catch (e) { onError ? onError(e instanceof FirebaseError ? e : mapErr(e)) : console.warn('[onSnapshot]', e.message); }
  };
  const schedule = () => { clearTimeout(timer); timer = setTimeout(fetchNow, 120); };

  const colName = isDoc ? target.path.split('/').slice(-2, -1)[0] : target._col.split('/').pop();
  const filter = isDoc ? `path=eq.${target.path}` : `col=eq.${colName}`;
  const channel = supabase.channel(`lv-${++chanSeq}-${Math.random().toString(36).slice(2, 7)}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'docs', filter }, payload => {
      if (!isDoc && !target._group) {
        const parent = target._col.split('/').slice(0, -1).join('/');
        const row = payload.new && payload.new.path ? payload.new : payload.old;
        if (row && row.parent !== undefined && row.parent !== parent) return;
      }
      schedule();
    })
    .subscribe(status => { if (status === 'SUBSCRIBED') schedule(); });   // ulanish oralig'idagi o'zgarishlar ham tushmasin

  // Realtime ishlamay qolsa ham yangilanib tursin
  const poll = setInterval(fetchNow, 15000);
  fetchNow();

  return () => {
    stopped = true;
    clearTimeout(timer); clearInterval(poll);
    supabase.removeChannel(channel);
  };
}

export function terminate() { return Promise.resolve(); }
export function clearIndexedDbPersistence() { return Promise.resolve(); }
export function connectFirestoreEmulator() {}
export class FieldPath { constructor(...s) { this._s = s; } toString() { return this._s.join('.'); } }
export class FieldValue { }
export class GeoPoint { constructor(latitude, longitude) { this.latitude = latitude; this.longitude = longitude; } }
export class Bytes { }
