// ═══════════════════════════════════════════════════════════════════════════
// voice-reward.js — GAPIRISH VAQTI UCHUN XP/COIN (SERVER TARAFIDA)
//
// Nega server kerak: agar mukofot to'g'ridan-to'g'ri klientdan
// `updateDoc(users/{uid}, {xp: increment(3)})` bilan berilsa, istalgan odam
// brauzer konsolida shu qatorni minglab marta chaqirib, bir necha soniyada
// cheksiz XP/coin yasab olardi. Bu funksiya:
//   1. Firebase ID-tokenni tasdiqlaydi (kim ekanini haqiqatan biladi),
//   2. oxirgi mukofotdan kamida 55 soniya o'tganini serverda o'zi hisoblaydi
//      (klient aytgan vaqtga ishonmaydi),
//   3. shundan keyingina xp/coin qo'shadi.
//
// Klient (voice-room.html) har ~60 soniyada shu funksiyani chaqiradi;
// tezroq chaqirsa ham server rad etadi.
// ═══════════════════════════════════════════════════════════════════════════

const fsdb = require('./_firestore');
const { verifyIdToken } = require('./_auth');

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

const MIN_INTERVAL_MS = 55 * 1000; // klient 60s da so'raydi — 5s tolerantlik
const XP_REWARD = 3;
const COIN_REWARD = 1;

function json(statusCode, body) {
  return { statusCode, headers: { ...CORS, 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
}

exports.handler = async function (event) {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' };
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method Not Allowed' });

  if (!fsdb.configured()) {
    return json(200, { ok: false, error: "Server Firestore'ga ulanmagan" });
  }

  let payload;
  try { payload = JSON.parse(event.body || '{}'); }
  catch { return json(400, { error: "Noto'g'ri JSON" }); }

  try {
    const auth = await verifyIdToken(payload.idToken);
    const trackPath = `users/${auth.uid}/usage/voice_reward`;

    const now = Date.now();
    const prev = await fsdb.getDoc(trackPath).catch(() => null);
    const lastAt = prev?.lastRewardAt ? Date.parse(prev.lastRewardAt) : 0;

    if (now - lastAt < MIN_INTERVAL_MS) {
      return json(200, { ok: false, cooldown: true, waitMs: MIN_INTERVAL_MS - (now - lastAt) });
    }

    const userPath = `users/${auth.uid}`;
    const user = await fsdb.getDoc(userPath).catch(() => null);
    if (!user) return json(200, { ok: false, error: 'Foydalanuvchi topilmadi' });

    await fsdb.setDoc(userPath, {
      ...user,
      xp: (user.xp || 0) + XP_REWARD,
      coins: (user.coins || 0) + COIN_REWARD
    });
    await fsdb.setDoc(trackPath, { lastRewardAt: new Date(now).toISOString() });

    return json(200, { ok: true, xp: XP_REWARD, coins: COIN_REWARD });
  } catch (e) {
    console.error('[voice-reward]', e);
    return json(200, { ok: false, error: e.message });
  }
};
