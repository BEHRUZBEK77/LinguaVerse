// ═══════════════════════════════════════════════════════════════════════════
// _ratelimit.js — ODDIY TEZLIK CHEKLOVI (IP bo'yicha)
//
// ai.js, azure-speech.js, gemini.js, groq.js, tts.js, whisper.js kabi
// funksiyalar hozircha Firebase ID-token talab qilmaydi (buni talab qilish
// butun ilovadagi ~15 sahifani bir vaqtda yangilashni talab qiladi — katta
// va xavfli o'zgarish). Shu oraliqda eng muhim himoya: bitta IP manzil
// daqiqasiga cheksiz so'rov yubora olmasin — bu to'lov proveyderlarining
// (Groq/Gemini/Azure) balansini bir necha daqiqada tugatib qo'yishning
// oldini oladi.
//
// Firestore orqali ishlaydi (Netlify funksiyalari statik xotiraga ega emas,
// har chaqiriqda yangi bo'lishi mumkin). Firestore sozlanmagan bo'lsa
// (masalan mahalliy devda), tekshiruv "ok:true" qaytaradi — funksiyaning
// o'zi ishlashdan to'xtamasin uchun.
// ═══════════════════════════════════════════════════════════════════════════

const fsdb = require('./_firestore');

/**
 * @param {string} key      — masalan `ai:${ip}` (endpoint nomi bilan birga,
 *                             turli funksiyalar bir-birining limitini
 *                             yemasligi uchun)
 * @param {object} opts     — { windowMs, max }
 */
async function checkRateLimit(key, opts = {}) {
  const windowMs = opts.windowMs || 60_000;
  const max = opts.max || 20;

  if (!fsdb.configured()) return { ok: true };

  const path = `rate_limits/${encodeURIComponent(key)}`;
  const now = Date.now();

  try {
    const doc = await fsdb.getDoc(path).catch(() => null);
    let windowStart = doc?.windowStart || 0;
    let count = doc?.count || 0;

    if (now - windowStart > windowMs) {
      windowStart = now;
      count = 0;
    }
    count++;

    await fsdb.setDoc(path, { windowStart, count, updatedAt: new Date(now).toISOString() });

    return { ok: count <= max, count, max, retryAfterMs: Math.max(0, windowMs - (now - windowStart)) };
  } catch (e) {
    // Rate-limit tekshiruvi o'zi ishlamay qolsa, foydalanuvchini butunlay
    // to'xtatib qo'ymaymiz — "fail open".
    console.warn('[ratelimit] tekshirilmadi:', e.message);
    return { ok: true };
  }
}

/** Netlify event'dan haqiqiy client IP manzilini ajratib oladi. */
function clientIp(event) {
  const h = event.headers || {};
  return h['x-nf-client-connection-ip']
      || (h['x-forwarded-for'] || '').split(',')[0].trim()
      || h['client-ip']
      || 'unknown';
}

module.exports = { checkRateLimit, clientIp };
