// ═══════════════════════════════════════════════════════════════════════════
// AVTO-TO'LOV — KUNLIK ISHGA TUSHADIGAN FUNKSIYA
//
// Netlify buni netlify.toml dagi jadval bo'yicha o'zi chaqiradi (kuniga bir
// marta, 05:00 UTC = Toshkentda 10:00). Tashqaridan chaqirib bo'lmaydi —
// Netlify rejalashtirilgan funksiyalarga tashqi so'rovni o'tkazmaydi.
//
// Ish mantig'i payment.js ichida (runRenewals). Bu fayl faqat "soat" —
// mantiqni ikki joyda saqlamaymiz.
// ═══════════════════════════════════════════════════════════════════════════
const fsdb = require('./_firestore');

exports.handler = async function () {
  const started = Date.now();

  if (!fsdb.configured()) {
    console.warn('[renew] Firestore admin sozlanmagan — o\'tkazib yuborildi');
    return { statusCode: 200, body: JSON.stringify({ ok: false, reason: 'firestore_sozlanmagan' }) };
  }

  try {
    // payment.js ni to'g'ridan-to'g'ri chaqiramiz: HTTP orqali emas, chunki
    // o'z funksiyasiga so'rov yuborish keraksiz kechikish va xato manbai.
    const payment = require('./payment');
    if (typeof payment.runRenewals !== 'function') {
      throw new Error('payment.js runRenewals ni eksport qilmayapti');
    }

    const res = await payment.runRenewals(200);
    console.log(`[renew] ${Math.round((Date.now() - started) / 1000)}s ichida tugadi:`, JSON.stringify(res));
    return { statusCode: 200, body: JSON.stringify(res) };

  } catch (e) {
    // Xatoni yutmaymiz — Netlify jurnalida ko'rinsin, lekin 500 qaytarib
    // qayta-qayta urinishga sabab bo'lmaymiz (ertaga baribir yana ishlaydi).
    console.error('[renew] XATO:', e.stack || e.message);
    return { statusCode: 200, body: JSON.stringify({ ok: false, error: e.message }) };
  }
};
