// ═══════════════════════════════════════════════════════════════════════════
// _ttsBudget.js — OVOZ UCHUN OYLIK BEPUL LIMIT NAZORATI
//
// Azure Speech bepul tarifi (F0): oyiga 500 000 belgi neural ovoz.
// Dars ovozlari (sayt + video fabrika) shu limitdan oshmasligi uchun har oy
// sarflangan belgilar ttsBudget/YYYY-MM hujjatida hisoblanadi. Limit tugasa:
//   • saytdagi interaktiv dars brauzer ovoziga o'tadi (bepul, cheksiz)
//   • video fabrika keyingi oygacha kutadi
// Env: TTS_MONTHLY_CHARS (standart 450000 — jonli speaking ustozga zaxira qoladi)
// Pullik tarifga o'tsangiz: TTS_MONTHLY_CHARS=0 → cheklov o'chadi.
// ═══════════════════════════════════════════════════════════════════════════
'use strict';
const fsdb = require('./_firestore.js');

const limit = () => {
  const v = process.env.TTS_MONTHLY_CHARS;
  return v === undefined || v === '' ? 450000 : Math.max(0, Number(v) || 0);
};
const month = (d = new Date()) => d.toISOString().slice(0, 7);
const docPath = (d) => `ttsBudget/${month(d)}`;

/** chars belgini band qiladi. Limit yetmasa {ok:false}. limit=0 → cheklovsiz. */
async function reserve(chars, d = new Date()) {
  const max = limit();
  chars = Math.max(0, Math.round(chars));
  if (!max) return { ok: true, used: 0, limit: 0, unlimited: true };
  let ok = false, used = 0;
  await fsdb.transact(docPath(d), cur => {
    used = Number(cur?.used) || 0;
    if (used + chars > max) return null;
    ok = true; used += chars;
    return { used, limit: max, updatedAt: new Date() };
  });
  return { ok, used, limit: max };
}

async function status(d = new Date()) {
  const doc = await fsdb.getDoc(docPath(d)).catch(() => null);
  const max = limit();
  return { month: month(d), used: Number(doc?.used) || 0, limit: max, unlimited: !max };
}

module.exports = { reserve, status, limit, month };
