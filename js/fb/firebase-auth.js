// ═══════════════════════════════════════════════════════════════════════════
// js/fb/firebase-auth.js — "firebase/auth" API'si, ichida Supabase Auth
//
// ESKI FOYDALANUVCHILAR (Firebase'dan ko'chganlar):
//  • Email/parol: avval Supabase'da tekshiriladi; mos kelmasa parol eski
//    Firebase hisobida tekshirilib, Supabase'ga o'tkaziladi (auth-bridge).
//    Foydalanuvchi eski paroli bilan kiraveradi — hech narsa sezmaydi.
//  • Google: kirgandan keyin email bo'yicha eski uid'ga bog'lanadi (claim),
//    shuning uchun users/{eski_uid} dagi barcha ma'lumotlari joyida.
// user.uid — eski Firebase uid (bo'lsa), aks holda Supabase uuid.
// ═══════════════════════════════════════════════════════════════════════════
import { supabase, STORAGE_KEY, FN_BASE, FirebaseError, SUPABASE_URL, SUPABASE_KEY } from './client.js';

// ── Foydalanuvchi obyekti (Firebase User shakli) ──
class User {
  constructor(u) {
    const meta = u.user_metadata || {};
    const app = u.app_metadata || {};
    this.uid = app.legacy_uid || u.id;
    this.supabaseId = u.id;
    this.email = u.email || null;
    this.displayName = meta.full_name || meta.name || meta.displayName || null;
    this.photoURL = meta.avatar_url || meta.picture || null;
    this.emailVerified = !!(u.email_confirmed_at || u.confirmed_at);
    this.isAnonymous = !!u.is_anonymous;
    this.phoneNumber = u.phone || null;
    const providers = (u.identities || []).map(i => i.provider);
    this.providerData = providers.map(p => ({
      providerId: p === 'email' ? 'password' : p === 'google' ? 'google.com' : p,
      uid: this.uid, email: this.email, displayName: this.displayName, photoURL: this.photoURL
    }));
    this.providerId = 'firebase';
    this.metadata = {
      creationTime: u.created_at ? new Date(u.created_at).toUTCString() : null,
      lastSignInTime: u.last_sign_in_at ? new Date(u.last_sign_in_at).toUTCString() : null
    };
    this.tenantId = null;
  }
  async getIdToken(forceRefresh = false) {
    if (forceRefresh) {
      const { data } = await supabase.auth.refreshSession();
      if (data?.session) return data.session.access_token;
    }
    const { data } = await supabase.auth.getSession();
    if (!data?.session) throw new FirebaseError('auth/user-token-expired', 'Sessiya tugagan');
    return data.session.access_token;
  }
  async getIdTokenResult(forceRefresh = false) {
    const token = await this.getIdToken(forceRefresh);
    let claims = {};
    try { claims = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))); } catch {}
    return { token, claims, expirationTime: claims.exp ? new Date(claims.exp * 1000).toUTCString() : null };
  }
  async reload() {
    const { data } = await supabase.auth.getUser();
    if (data?.user) setUser(data.user, false);
  }
  toJSON() { return { uid: this.uid, email: this.email, displayName: this.displayName, photoURL: this.photoURL }; }
}

// ── Holat ──
let current = null;
let ready = false;
const listeners = new Set();
const idListeners = new Set();

function setUser(u, notify = true) {
  current = u ? new User(u) : null;
  if (notify && ready) emit();
}
let lastUid;                       // onAuthStateChanged faqat foydalanuvchi o'zgarganda ishlaydi (Firebase kabi)
function emit() {
  const uid = current ? current.uid : null;
  for (const cb of idListeners) { try { cb(current); } catch (e) { console.error(e); } }
  if (uid === lastUid) return;
  lastUid = uid;
  for (const cb of listeners) { try { cb(current); } catch (e) { console.error(e); } }
}

// Sahifa ochilishi bilanoq (sinxron) — saqlangan sessiyadan
try {
  const raw = localStorage.getItem(STORAGE_KEY);
  const s = raw ? JSON.parse(raw) : null;
  const u = s?.user || s?.currentSession?.user;
  if (u && (!s.expires_at || s.expires_at * 1000 > Date.now() - 3600_000)) current = new User(u);
} catch { /* xususiy rejim */ }

async function bridge(action, payload) {
  const r = await fetch(FN_BASE + 'auth-bridge', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, ...payload })
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new FirebaseError(d.code || 'auth/internal-error', d.error || 'Xatolik');
  return d;
}

/** Google bilan kirgan eski foydalanuvchini eski uid'iga bog'lash. */
async function maybeClaim(session) {
  const u = session?.user;
  if (!u || u.is_anonymous || u.app_metadata?.legacy_uid) return u;
  const flag = 'lv_claim_checked_' + u.id;
  try { if (sessionStorage.getItem(flag)) return u; } catch {}
  try {
    const d = await bridge('claim', { accessToken: session.access_token });
    try { sessionStorage.setItem(flag, '1'); } catch {}
    if (d.changed) {
      const { data } = await supabase.auth.refreshSession();
      return data?.session?.user || u;
    }
  } catch (e) { console.warn('[auth] eski hisobga bog‘lanmadi:', e.message); }
  return u;
}

const readyPromise = (async () => {
  try {
    const { data } = await supabase.auth.getSession();
    const u = data?.session ? await maybeClaim(data.session) : null;
    setUser(u, false);
  } catch (e) {
    console.warn('[auth] sessiya o‘qilmadi:', e.message);
    current = null;
  }
  ready = true;
  emit();
})();

supabase.auth.onAuthStateChange((event, session) => {
  if (!ready) return;
  if (event === 'SIGNED_IN' && session?.user && !session.user.app_metadata?.legacy_uid && !session.user.is_anonymous) {
    maybeClaim(session).then(u => setUser(u));
    return;
  }
  if (event === 'TOKEN_REFRESHED' && current && session?.user && new User(session.user).uid === current.uid) {
    current = new User(session.user);           // uid o'zgarmagan — tinglovchilarni bezovta qilmaymiz
    return;
  }
  setUser(session?.user || null);
});

// ── Auth obyekti ──
const auth = {
  get currentUser() { return current; },
  get app() { return { name: '[DEFAULT]' }; },
  languageCode: 'uz',
  settings: {},
  config: {},
  onAuthStateChanged(cb, onError) { return onAuthStateChanged(auth, cb, onError); },
  onIdTokenChanged(cb) { return onIdTokenChanged(auth, cb); },
  signOut() { return signOut(auth); },
  authStateReady() { return readyPromise; },
  useDeviceLanguage() {},
  setPersistence() { return Promise.resolve(); }
};

export function getAuth() { return auth; }
export function initializeAuth() { return auth; }

export function onAuthStateChanged(_auth, cb, onError) {
  const fn = typeof cb === 'function' ? cb : cb?.next?.bind(cb);
  if (!fn) return () => {};
  listeners.add(fn);
  // Yangi tinglovchi joriy holatni darhol oladi (Firebase kabi)
  if (ready) Promise.resolve().then(() => listeners.has(fn) && fn(current));
  return () => listeners.delete(fn);
}

export function onIdTokenChanged(_auth, cb) {
  idListeners.add(cb);
  if (ready) Promise.resolve().then(() => cb(current));
  return () => idListeners.delete(cb);
}

// ── Xatolar: Supabase → Firebase kodlari ──
function mapErr(e) {
  if (e instanceof FirebaseError) return e;
  const m = String(e?.message || e || '');
  const status = e?.status;
  let code = 'auth/internal-error';
  if (/invalid login credentials|invalid_credentials/i.test(m)) code = 'auth/invalid-credential';
  else if (/already (registered|been registered)|user_already_exists|email_exists/i.test(m)) code = 'auth/email-already-in-use';
  else if (/password should be|weak_password|at least \d+ characters/i.test(m)) code = 'auth/weak-password';
  else if (/rate limit|too many|over_request_rate_limit/i.test(m) || status === 429) code = 'auth/too-many-requests';
  else if (/invalid email|unable to validate email|email_address_invalid/i.test(m)) code = 'auth/invalid-email';
  else if (/anonymous sign-ins are disabled|signups not allowed|provider is not enabled/i.test(m)) code = 'auth/operation-not-allowed';
  else if (/network|failed to fetch/i.test(m)) code = 'auth/network-request-failed';
  return new FirebaseError(code, m);
}

const cred = user => ({ user, providerId: null, operationType: 'signIn' });

async function finishSignIn(session) {
  const u = await maybeClaim(session);
  setUser(u, false);
  ready = true;
  emit();
  return cred(current);
}

export async function signInWithEmailAndPassword(_auth, email, password) {
  email = String(email || '').trim();
  let { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error && /invalid login credentials|invalid_credentials|email not confirmed/i.test(error.message)) {
    // Eski Firebase hisobi — parolni o'sha yerda tekshirib, Supabase'ga o'tkazamiz
    try { await bridge('legacy-login', { email, password }); }
    catch (e) { throw e.code === 'auth/too-many-requests' ? e : new FirebaseError('auth/invalid-credential', 'Email yoki parol noto‘g‘ri'); }
    ({ data, error } = await supabase.auth.signInWithPassword({ email, password }));
  }
  if (error) throw mapErr(error);
  return finishSignIn(data.session);
}

export async function createUserWithEmailAndPassword(_auth, email, password) {
  email = String(email || '').trim();
  await bridge('signup', { email, password });
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw mapErr(error);
  const c = await finishSignIn(data.session);
  c.operationType = 'signUp';
  return c;
}

export async function signInAnonymously() {
  const { data, error } = await supabase.auth.signInAnonymously();
  if (error) throw mapErr(error);
  return finishSignIn(data.session);
}

// ── Google ──
export class GoogleAuthProvider {
  constructor() { this.providerId = 'google.com'; this._scopes = []; this._params = {}; }
  addScope(s) { this._scopes.push(s); return this; }
  setCustomParameters(p) { this._params = { ...this._params, ...p }; return this; }
  static credentialFromResult() { return null; }
  static credentialFromError() { return null; }
}
GoogleAuthProvider.PROVIDER_ID = 'google.com';

// Provayder Supabase'da yoqilmagan bo'lsa, foydalanuvchi xom JSON xato
// sahifasiga yo'naltirilmasin — oldindan tekshirib, tushunarli xabar beramiz.
async function providerEnabled(name) {
  try {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/settings`, { headers: { apikey: SUPABASE_KEY } });
    if (!r.ok) return true;
    const s = await r.json();
    return s?.external?.[name] !== false;
  } catch { return true; }
}

async function oauth(provider) {
  const name = provider?.providerId === 'google.com' || provider instanceof GoogleAuthProvider ? 'google' : String(provider?.providerId || 'google').replace('.com', '');
  if (!(await providerEnabled(name))) {
    throw new FirebaseError('auth/operation-not-allowed', `${name === 'google' ? 'Google' : name} orqali kirish hozircha yoqilmagan. Iltimos, email va parol bilan kiring.`);
  }
  const { error } = await supabase.auth.signInWithOAuth({
    provider: name,
    options: {
      redirectTo: location.href.split('#')[0],
      scopes: (provider?._scopes || []).join(' ') || undefined,
      queryParams: { prompt: 'select_account', ...(provider?._params || {}) }
    }
  });
  if (error) throw mapErr(error);
  // Sahifa Google'ga yo'naltiriladi; qaytgach onAuthStateChanged ishlaydi
  return new Promise(() => {});
}
export const signInWithPopup = (_auth, provider) => oauth(provider);
export const signInWithRedirect = (_auth, provider) => oauth(provider);
export async function getRedirectResult() { await readyPromise; return current ? cred(current) : null; }

export async function signOut() {
  await supabase.auth.signOut().catch(() => {});
  try { localStorage.removeItem(STORAGE_KEY); } catch {}
  setUser(null);
}

export async function sendPasswordResetEmail(_auth, email) {
  await bridge('reset', { email: String(email || '').trim() });
}

export async function updateProfile(user, { displayName, photoURL } = {}) {
  const data = {};
  if (displayName !== undefined) data.full_name = displayName;
  if (photoURL !== undefined) data.avatar_url = photoURL;
  const { data: res, error } = await supabase.auth.updateUser({ data });
  if (error) throw mapErr(error);
  setUser(res.user, false);
  if (user) { if (displayName !== undefined) user.displayName = displayName; if (photoURL !== undefined) user.photoURL = photoURL; }
}

export async function updatePassword(_user, newPassword) {
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw mapErr(error);
}

export async function verifyBeforeUpdateEmail(_user, newEmail) {
  const { error } = await supabase.auth.updateUser({ email: newEmail });
  if (error) throw mapErr(error);
}
export const updateEmail = verifyBeforeUpdateEmail;

export const EmailAuthProvider = {
  PROVIDER_ID: 'password',
  credential(email, password) { return { providerId: 'password', email, password }; }
};

export async function reauthenticateWithCredential(user, credential) {
  const { error } = await supabase.auth.signInWithPassword({ email: credential.email, password: credential.password });
  if (error) {
    try { await bridge('legacy-login', { email: credential.email, password: credential.password }); }
    catch { throw new FirebaseError('auth/wrong-password', 'Parol noto‘g‘ri'); }
  }
  return cred(user || current);
}

export async function sendEmailVerification() { /* hisoblar tasdiqlangan holda yaratiladi */ }
export async function setPersistence() {}
export const browserLocalPersistence = { type: 'LOCAL' };
export const browserSessionPersistence = { type: 'SESSION' };
export const inMemoryPersistence = { type: 'NONE' };
export const indexedDBLocalPersistence = { type: 'LOCAL' };
export const browserPopupRedirectResolver = {};
export async function fetchSignInMethodsForEmail() { return []; }
export async function deleteUser() { throw new FirebaseError('auth/operation-not-allowed', "Hisobni o'chirish uchun admin bilan bog'laning"); }
