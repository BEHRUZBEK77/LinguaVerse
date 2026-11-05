// ═══════════════════════════════════════════════════════════════════════════
// auth-bridge.js — FIREBASE → SUPABASE O'TISH KO'PRIGI
//
//   POST { action:'signup', email, password, name }   → yangi hisob (email tasdiqlangan holda)
//   POST { action:'legacy-login', email, password }   → eski Firebase paroli bilan kirish:
//        parol Firebase'da tekshiriladi, to'g'ri bo'lsa Supabase'ga o'tkaziladi.
//        Foydalanuvchi hech narsani sezmaydi — eski paroli bilan kiraveradi.
//   POST { action:'claim', accessToken }               → Google bilan kirgan eski foydalanuvchini
//        email orqali eski Firebase uid'iga bog'laydi (ma'lumotlari yo'qolmasin).
//   POST { action:'reset', email }                     → parolni tiklash xati
//   POST { action:'migrate', secret }                  → bir martalik ko'chirish (bo'laklab):
//        Firebase Auth foydalanuvchilari + barcha Firestore hujjatlari → Supabase
//   POST { action:'migrate-status', secret }
//
// Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, MIGRATION_SECRET,
//      FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY,
//      FIREBASE_WEB_API_KEY (ixtiyoriy — sayt konfiguratsiyasidagi ochiq kalit)
// ═══════════════════════════════════════════════════════════════════════════

const crypto = require('crypto');
const fsdb = require('./_firestore.js');
const ratelimit = require('./_ratelimit.js');
const { mapUser } = require('./_auth.js');

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

const SB = () => (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
const SKEY = () => process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const FB_PROJECT = () => process.env.FIREBASE_PROJECT_ID || 'linguaverse-81b52';
const FB_WEB_KEY = () => process.env.FIREBASE_WEB_API_KEY || 'AIzaSyB-QDASPCTIKCx445PpeKFKC8fWydKHMcI';

// ───────────────────────────────────────────────────────────────────────────
// SUPABASE ADMIN
// ───────────────────────────────────────────────────────────────────────────
async function sbAdmin(method, path, body) {
  const r = await fetch(`${SB()}/auth/v1/admin/${path}`, {
    method,
    headers: { apikey: SKEY(), Authorization: `Bearer ${SKEY()}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) {
    const e = new Error(d.msg || d.message || d.error_description || `HTTP ${r.status}`);
    e.status = r.status; e.code = d.error_code || d.code;
    throw e;
  }
  return d;
}

async function sbFindByEmail(email) {
  const want = String(email || '').toLowerCase();
  for (let page = 1; page <= 50; page++) {
    const d = await sbAdmin('GET', `users?page=${page}&per_page=1000`);
    const list = d.users || [];
    const hit = list.find(u => (u.email || '').toLowerCase() === want);
    if (hit) return hit;
    if (list.length < 1000) return null;
  }
  return null;
}

async function sbFindByLegacy(legacyUid) {
  for (let page = 1; page <= 50; page++) {
    const d = await sbAdmin('GET', `users?page=${page}&per_page=1000`);
    const list = d.users || [];
    const hit = list.find(u => u.app_metadata?.legacy_uid === legacyUid);
    if (hit) return hit;
    if (list.length < 1000) return null;
  }
  return null;
}

const randomPassword = () => crypto.randomBytes(24).toString('base64url');

// ───────────────────────────────────────────────────────────────────────────
// FIREBASE (eski)
// ───────────────────────────────────────────────────────────────────────────
let gTok = null, gTokUntil = 0;
async function googleToken() {
  if (gTok && Date.now() < gTokUntil - 60_000) return gTok;
  const email = process.env.FIREBASE_CLIENT_EMAIL;
  const key = (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n');
  if (!email || !key) throw new Error('FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY sozlanmagan');
  const b64 = s => Buffer.from(s).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const head = b64(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = b64(JSON.stringify({ iss: email, scope: 'https://www.googleapis.com/auth/cloud-platform https://www.googleapis.com/auth/datastore https://www.googleapis.com/auth/identitytoolkit', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 }));
  const sig = crypto.createSign('RSA-SHA256').update(`${head}.${claims}`).sign(key).toString('base64url');
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${head}.${claims}.${sig}` })
  });
  const d = await r.json();
  if (!r.ok) throw new Error('Google token: ' + (d.error_description || d.error));
  gTok = d.access_token; gTokUntil = Date.now() + d.expires_in * 1000;
  return gTok;
}

/** Firebase'da email+parolni tekshiradi. To'g'ri bo'lsa { localId, email, displayName }. */
async function fbVerifyPassword(email, password) {
  const r = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FB_WEB_KEY()}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, returnSecureToken: false })
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) return null;
  return { localId: d.localId, email: d.email, displayName: d.displayName || '' };
}

async function fbLookupEmail(email) {
  const t = await googleToken();
  const r = await fetch(`https://identitytoolkit.googleapis.com/v1/projects/${FB_PROJECT()}/accounts:lookup`, {
    method: 'POST', headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: [email] })
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error('Firebase lookup: ' + (d.error?.message || r.status));
  return (d.users || [])[0] || null;
}

// ───────────────────────────────────────────────────────────────────────────
// AMALLAR
// ───────────────────────────────────────────────────────────────────────────
function err(status, code, message) { return Object.assign(new Error(message), { statusCode: status, code }); }
const validEmail = e => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(e || ''));

async function signup(body) {
  const email = String(body.email || '').trim().toLowerCase();
  const password = String(body.password || '');
  if (!validEmail(email)) throw err(400, 'auth/invalid-email', 'Email noto‘g‘ri');
  if (password.length < 6) throw err(400, 'auth/weak-password', 'Parol kamida 6 belgi bo‘lsin');

  // Eski (Firebase) hisob bo'lsa — yangisini ochmaymiz, eski parol bilan kirsin
  try { if (await fbLookupEmail(email)) throw err(409, 'auth/email-already-in-use', 'Bu email allaqachon ro‘yxatdan o‘tgan'); }
  catch (e) { if (e.code === 'auth/email-already-in-use') throw e; }

  try {
    await sbAdmin('POST', 'users', {
      email, password, email_confirm: true,
      user_metadata: body.name ? { full_name: String(body.name).slice(0, 80) } : {}
    });
  } catch (e) {
    if (e.status === 422 || /already/i.test(e.message)) throw err(409, 'auth/email-already-in-use', 'Bu email allaqachon ro‘yxatdan o‘tgan');
    throw e;
  }
  return { ok: true };
}

async function legacyLogin(body) {
  const email = String(body.email || '').trim().toLowerCase();
  const password = String(body.password || '');
  if (!validEmail(email) || !password) throw err(400, 'auth/invalid-credential', 'Email yoki parol noto‘g‘ri');

  const fb = await fbVerifyPassword(email, password);
  if (!fb) throw err(401, 'auth/invalid-credential', 'Email yoki parol noto‘g‘ri');

  const existing = await sbFindByEmail(email);
  if (existing) {
    await sbAdmin('PUT', `users/${existing.id}`, {
      password, email_confirm: true,
      app_metadata: { ...(existing.app_metadata || {}), legacy_uid: existing.app_metadata?.legacy_uid || fb.localId }
    });
  } else {
    await sbAdmin('POST', 'users', {
      email, password, email_confirm: true,
      app_metadata: { legacy_uid: fb.localId },
      user_metadata: fb.displayName ? { full_name: fb.displayName } : {}
    });
  }
  return { ok: true, migrated: true };
}

/** Google bilan kirgan foydalanuvchini eski Firebase hisobiga bog'laydi. */
async function claim(body) {
  const r = await fetch(`${SB()}/auth/v1/user`, { headers: { apikey: SKEY(), Authorization: `Bearer ${body.accessToken}` } });
  if (!r.ok) throw err(401, 'auth/invalid-user-token', 'Sessiya yaroqsiz');
  const u = await r.json();
  if (u.app_metadata?.legacy_uid) return { ok: true, legacyUid: u.app_metadata.legacy_uid, changed: false };
  if (!u.email || u.is_anonymous) return { ok: true, legacyUid: null };

  // Email tasdiqlangan bo'lishi shart (Google — doim tasdiqlangan)
  if (!u.email_confirmed_at && !u.confirmed_at) return { ok: true, legacyUid: null };

  let fb = null;
  try { fb = await fbLookupEmail(u.email); } catch (e) { console.warn('[bridge] lookup:', e.message); }
  if (!fb) return { ok: true, legacyUid: null };

  // Shu eski uid boshqa hisobga allaqachon berilmaganmi
  const taken = await sbFindByLegacy(fb.localId);
  if (taken && taken.id !== u.id) return { ok: true, legacyUid: null, conflict: true };

  await sbAdmin('PUT', `users/${u.id}`, { app_metadata: { ...(u.app_metadata || {}), legacy_uid: fb.localId } });
  return { ok: true, legacyUid: fb.localId, changed: true };
}

/** Parolni tiklash: eski hisob bo'lsa Firebase xati (SMTP sozlanmagan bo'lsa ham ishlaydi). */
async function reset(body, origin) {
  const email = String(body.email || '').trim().toLowerCase();
  if (!validEmail(email)) throw err(400, 'auth/invalid-email', 'Email noto‘g‘ri');
  let legacy = null;
  try { legacy = await fbLookupEmail(email); } catch { /* Firebase yo'q bo'lsa — Supabase */ }
  const hasPassword = !!legacy && ((legacy.providerUserInfo || []).some(p => p.providerId === 'password') || legacy.passwordHash !== undefined);
  if (hasPassword) {
    const r = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${FB_WEB_KEY()}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requestType: 'PASSWORD_RESET', email })
    });
    if (r.ok) return { ok: true, via: 'firebase' };
  }
  const r = await fetch(`${SB()}/auth/v1/recover?redirect_to=${encodeURIComponent((origin || '') + '/auth/reset.html')}`, {
    method: 'POST', headers: { apikey: SKEY(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ email })
  });
  if (!r.ok && r.status !== 404) {
    const d = await r.json().catch(() => ({}));
    if (r.status === 429) throw err(429, 'auth/too-many-requests', 'Juda ko‘p urinish. Biroz kuting.');
    throw err(400, 'auth/internal-error', d.msg || 'Xat yuborilmadi');
  }
  return { ok: true, via: 'supabase' };
}

// ───────────────────────────────────────────────────────────────────────────
// BIR MARTALIK KO'CHIRISH (bo'laklab — har chaqiruv ~8 soniya)
// ───────────────────────────────────────────────────────────────────────────
const FS = () => `https://firestore.googleapis.com/v1/projects/${FB_PROJECT()}/databases/(default)/documents`;
const SKIP_COLLECTIONS = new Set(['rate_limits', 'courseAudio']);
// Bu kolleksiyalar hujjatlarida ichki kolleksiya bo'lmaydi — tekshiruvni tejaymiz
const LEAF_COLLECTIONS = new Set(['orders', 'payouts', 'leaderboard', 'community_vocab', 'community_units',
  'community_flashcards', 'referrals', 'certificates', 'courseLessons', 'ieltsResults', 'purchaseRequests',
  'announcements', 'speakQuota', 'voiceRoomMembers', 'voiceRoomSecrets', 'admins', 'events', 'token_logs',
  'usage', 'vocabulary', 'flashcards', 'lessons', 'sessions', 'writing', 'inventory', 'messages']);

function fromFsValue(v) {
  if (!v) return null;
  if ('nullValue' in v) return null;
  if ('booleanValue' in v) return v.booleanValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return v.doubleValue;
  if ('stringValue' in v) return v.stringValue;
  if ('timestampValue' in v) return { $t: new Date(v.timestampValue).toISOString() };
  if ('referenceValue' in v) return String(v.referenceValue).split('/documents/')[1] || v.referenceValue;
  if ('geoPointValue' in v) return { latitude: v.geoPointValue.latitude, longitude: v.geoPointValue.longitude };
  if ('bytesValue' in v) return v.bytesValue;
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(fromFsValue);
  if ('mapValue' in v) return fromFsFields(v.mapValue.fields || {});
  return null;
}
function fromFsFields(f) { const o = {}; for (const [k, v] of Object.entries(f || {})) o[k] = fromFsValue(v); return o; }

async function fsCall(method, url, body) {
  const t = await googleToken();
  const r = await fetch(url, { method, headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error('Firestore: ' + (d.error?.message || r.status));
  return d;
}
async function listCollectionIds(docPath) {
  const url = docPath ? `${FS()}/${docPath}:listCollectionIds` : `${FS()}:listCollectionIds`;
  const ids = []; let pageToken;
  do {
    const d = await fsCall('POST', url, { pageSize: 300, ...(pageToken ? { pageToken } : {}) });
    ids.push(...(d.collectionIds || []));
    pageToken = d.nextPageToken;
  } while (pageToken);
  return ids;
}

async function sbUpsertDocs(rows) {
  if (!rows.length) return;
  const r = await fetch(`${SB()}/rest/v1/docs?on_conflict=path`, {
    method: 'POST',
    headers: { apikey: SKEY(), Authorization: `Bearer ${SKEY()}`, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify(rows)
  });
  if (!r.ok) throw new Error('Supabase yozish: ' + (await r.text()).slice(0, 200));
}

const STATE = 'migration/state';

async function migrateStep(deadline) {
  let st = await fsdb.getDoc(STATE);
  if (!st || !st.phase) {
    st = { phase: 'users', userPage: null, usersDone: 0, usersSkipped: 0, queue: [], docsDone: 0, perCollection: {}, startedAt: new Date() };
  }
  const log = [];

  // 1) FIREBASE AUTH → SUPABASE AUTH
  while (st.phase === 'users' && Date.now() < deadline) {
    const t = await googleToken();
    const q = `maxResults=200${st.userPage ? `&nextPageToken=${encodeURIComponent(st.userPage)}` : ''}`;
    const r = await fetch(`https://identitytoolkit.googleapis.com/v1/projects/${FB_PROJECT()}/accounts:batchGet?${q}`, { headers: { Authorization: `Bearer ${t}` } });
    const d = await r.json();
    if (!r.ok) throw new Error('Firebase users: ' + (d.error?.message || r.status));
    const users = (d.users || []);
    for (const u of users) {
      if (!u.email) { st.usersSkipped++; continue; }                 // anonim mehmonlar
      const providers = (u.providerUserInfo || []).map(p => p.providerId);
      try {
        await sbAdmin('POST', 'users', {
          email: u.email.toLowerCase(), password: randomPassword(), email_confirm: true,
          app_metadata: { legacy_uid: u.localId, legacy_providers: providers },
          user_metadata: { ...(u.displayName ? { full_name: u.displayName } : {}), ...(u.photoUrl ? { avatar_url: u.photoUrl } : {}) }
        });
        st.usersDone++;
      } catch (e) {
        if (e.status === 422 || /already/i.test(e.message)) {
          const ex = await sbFindByEmail(u.email);
          if (ex && !ex.app_metadata?.legacy_uid) await sbAdmin('PUT', `users/${ex.id}`, { app_metadata: { ...(ex.app_metadata || {}), legacy_uid: u.localId } });
          st.usersDone++;
        } else { log.push(`user ${u.email}: ${e.message}`); st.usersSkipped++; }
      }
    }
    st.userPage = d.nextPageToken || null;
    if (!st.userPage) {
      st.phase = 'docs';
      const roots = (await listCollectionIds('')).filter(c => !SKIP_COLLECTIONS.has(c));
      st.queue = roots.map(c => ({ col: c, token: null }));
    }
  }

  // 2) FIRESTORE → docs jadvali
  while (st.phase === 'docs' && Date.now() < deadline) {
    const task = st.queue[0];
    if (!task) { st.phase = 'done'; st.finishedAt = new Date(); break; }
    const url = `${FS()}/${task.col}?pageSize=300&showMissing=true${task.token ? `&pageToken=${encodeURIComponent(task.token)}` : ''}`;
    const d = await fsCall('GET', url);
    const rows = [];
    const subChecks = [];
    for (const doc of d.documents || []) {
      const path = doc.name.split('/documents/')[1];
      const parts = path.split('/');
      const col = parts[parts.length - 2];
      if (doc.fields || doc.createTime) {
        rows.push({ path, col, parent: parts.slice(0, -2).join('/'), data: fromFsFields(doc.fields || {}) });
      }
      if (!LEAF_COLLECTIONS.has(col)) subChecks.push(path);
    }
    await sbUpsertDocs(rows);
    st.docsDone += rows.length;
    const top = task.col.split('/')[0];
    st.perCollection[top] = (st.perCollection[top] || 0) + rows.length;

    // Ichki kolleksiyalar (parallel, 8 tadan)
    for (let i = 0; i < subChecks.length; i += 8) {
      const chunk = subChecks.slice(i, i + 8);
      const res = await Promise.all(chunk.map(p => listCollectionIds(p).then(ids => ({ p, ids })).catch(() => ({ p, ids: [] }))));
      for (const { p, ids } of res) for (const c of ids) if (!SKIP_COLLECTIONS.has(c)) st.queue.push({ col: `${p}/${c}`, token: null });
    }

    if (d.nextPageToken) task.token = d.nextPageToken;
    else st.queue.shift();
  }

  st.updatedAt = new Date();
  st.lastLog = log.slice(0, 20);
  // Navbat katta bo'lishi mumkin — bitta hujjatda saqlanadi (bir necha ming yo'l — yetarli)
  await fsdb.transact(STATE, () => st);
  return summarize(st);
}

function summarize(st) {
  return {
    phase: st?.phase || 'not-started',
    usersDone: st?.usersDone || 0, usersSkipped: st?.usersSkipped || 0,
    docsDone: st?.docsDone || 0, queue: (st?.queue || []).length,
    perCollection: st?.perCollection || {}, log: st?.lastLog || [],
    done: st?.phase === 'done'
  };
}

function checkSecret(body) {
  const s = process.env.MIGRATION_SECRET || '';
  if (!s || s.length < 12) throw err(503, 'not-configured', "MIGRATION_SECRET sozlanmagan (kamida 12 belgi)");
  const a = Buffer.from(String(body.secret || '')), b = Buffer.from(s);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) throw err(403, 'forbidden', 'Maxfiy kalit noto‘g‘ri');
}

// ───────────────────────────────────────────────────────────────────────────
exports.handler = async function (event) {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' };
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method Not Allowed' });
  let body;
  try { body = JSON.parse(event.body || '{}'); } catch { return json(400, { error: 'Noto‘g‘ri JSON' }); }
  const origin = event.headers?.origin || process.env.URL || '';

  try {
    if (['signup', 'legacy-login', 'reset'].includes(body.action)) {
      const rl = await ratelimit.checkRateLimit(`bridge:${body.action}:${ratelimit.clientIp(event)}`, { windowMs: 10 * 60_000, max: 15 });
      if (!rl.ok) return json(rl.unavailable ? 503 : 429, { error: 'Juda ko‘p urinish. Biroz kuting.', code: 'auth/too-many-requests' });
    }
    switch (body.action) {
      case 'signup':        return json(200, await signup(body));
      case 'legacy-login':  return json(200, await legacyLogin(body));
      case 'claim':         return json(200, await claim(body));
      case 'reset':         return json(200, await reset(body, origin));
      case 'migrate':       checkSecret(body); return json(200, await migrateStep(Date.now() + 7000));
      case 'migrate-status': checkSecret(body); return json(200, summarize(await fsdb.getDoc(STATE)));
      case 'migrate-reset': checkSecret(body); await fsdb.deleteDoc(STATE); return json(200, { ok: true });
      default: return json(400, { error: 'Noma‘lum action' });
    }
  } catch (e) {
    console.error('[auth-bridge]', body.action, e.message);
    return json(e.statusCode || 500, { error: e.message, code: e.code || 'auth/internal-error' });
  }
};

function json(statusCode, body) {
  return { statusCode, headers: { ...CORS, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, body: JSON.stringify(body) };
}

module.exports.fromFsFields = fromFsFields;
module.exports.mapUser = mapUser;
