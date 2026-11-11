// ═══════════════════════════════════════════════════════════════════════════
// _auth.js — FOYDALANUVCHI TOKENINI TEKSHIRISH (endi Supabase Auth)
//
// Brauzer `idToken` sifatida Supabase access token yuboradi (js/fb/firebase-auth.js
// dagi user.getIdToken()). Server uni Supabase'ning o'zida tekshiradi —
// soxta yoki muddati o'tgan token rad etiladi.
//
// uid: Firebase'dan ko'chgan foydalanuvchida ESKI uid (app_metadata.legacy_uid)
// qaytariladi — shuning uchun users/{uid} yo'llari va barcha eski ma'lumotlar
// joyida qoladi. Yangi foydalanuvchida Supabase uuid.
// ═══════════════════════════════════════════════════════════════════════════

const URL_ = () => (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
const KEY = () => process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';

const cache = new Map();          // token → { user, until }  (bitta funksiya ishga tushishi ichida)

function mapUser(u) {
  const meta = u.user_metadata || {};
  const email = u.email || '';
  return {
    uid: (u.app_metadata && u.app_metadata.legacy_uid) || u.id,
    supabaseId: u.id,
    email,
    name: meta.full_name || meta.name || meta.displayName || (email ? email.split('@')[0] : "O'quvchi"),
    anonymous: !!u.is_anonymous,
    createdAt: u.created_at || null
  };
}

async function verifyIdToken(idToken) {
  if (!idToken) throw new Error('Token yuborilmagan');
  const hit = cache.get(idToken);
  if (hit && hit.until > Date.now()) return hit.user;

  if (!URL_() || !KEY()) throw new Error('SUPABASE_URL sozlanmagan');
  const r = await fetch(`${URL_()}/auth/v1/user`, {
    headers: { apikey: KEY(), Authorization: `Bearer ${idToken}` }
  });
  if (!r.ok) throw new Error(r.status === 401 || r.status === 403 ? 'Token muddati tugagan yoki noto‘g‘ri' : 'Token tekshirilmadi');
  const u = await r.json();
  if (!u || !u.id) throw new Error("Tokenda foydalanuvchi yo'q");

  const user = mapUser(u);
  cache.set(idToken, { user, until: Date.now() + 60_000 });
  if (cache.size > 500) cache.delete(cache.keys().next().value);
  return user;
}

module.exports = { verifyIdToken, mapUser };
