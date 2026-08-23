// ═══════════════════════════════════════════════════════════════════════════
// REYTING (LEADERBOARD) YANGILASH — REJALASHTIRILGAN FUNKSIYA
//
// Nega kerak: `users` kolleksiyasini klient to'g'ridan-to'g'ri o'qiy olmaydi
// (firestore.rules — har kim faqat o'zinikini ko'radi, aks holda email,
// balance kabi maxfiy maydonlar ham oshkor bo'lardi). Lekin reyting uchun
// boshqalarning XP/coin/unit sonini ko'rsatish kerak.
//
// Yechim: server (admin huquq bilan) har necha daqiqada `users`dan top N ni
// o'qiydi va FAQAT OCHIQ maydonlarni (displayName, xp, coins, unitsCompleted)
// alohida `leaderboard/{uid}` hujjatlariga yozadi. Klient shu kolleksiyani
// o'qiydi — firestore.rules'da bu allaqachon ruxsat etilgan:
//   match /leaderboard/{docId} { allow read: if signedIn(); allow write: if isAdmin(); }
//
// Jadval: netlify.toml da belgilanadi (masalan har 15 daqiqada bir marta).
// ═══════════════════════════════════════════════════════════════════════════

const fsdb = require('./_firestore');

// Reyting qaysi maydonlar bo'yicha yuritiladi — Russia.js va boshqa til
// fayllaridagi `loadLBSection(field, ...)` chaqiruvi bilan mos:
//   field = 'xp' | 'coins' | 'unitsCompleted'
const FIELDS = ['xp', 'coins', 'unitsCompleted'];
const TOP_N = 50; // eng katta klient so'rovi (Chinese.js limit(50)) bilan mos

// Faqat shu maydonlar `leaderboard` hujjatiga ko'chiriladi — email, balance,
// role kabi maxfiy narsalar hech qachon bu yerga tushmaydi.
function pickPublicFields(user) {
  return {
    displayName: user.displayName || user.email?.split('@')[0] || 'O\'quvchi',
    xp: user.xp || 0,
    coins: user.coins || 0,
    unitsCompleted: user.unitsCompleted || 0,
    plan: user.plan || 'free', // faqat rozetka ko'rsatish uchun, maxfiy emas
    updatedAt: new Date().toISOString()
  };
}

exports.handler = async function () {
  const started = Date.now();

  if (!fsdb.configured()) {
    console.warn('[leaderboard] Firestore admin sozlanmagan — o\'tkazib yuborildi');
    return { statusCode: 200, body: JSON.stringify({ ok: false, reason: 'firestore_sozlanmagan' }) };
  }

  try {
    // Har bir maydon bo'yicha alohida TOP N so'raymiz va bitta
    // birlashtirilgan uid to'plamini hosil qilamiz (union), so'ng har biriga
    // barcha uchta maydonni yozamiz — shunda foydalanuvchi istalgan
    // tab (XP/Coins/Units) da to'g'ri son bilan ko'rinadi.
    const merged = new Map(); // uid -> user data

    for (const field of FIELDS) {
      const top = await fsdb.queryTop('users', field, TOP_N);
      for (const u of top) {
        if (!merged.has(u.id)) merged.set(u.id, u);
      }
    }

    let written = 0;
    for (const [uid, user] of merged.entries()) {
      await fsdb.setDoc(`leaderboard/${uid}`, pickPublicFields(user));
      written++;
    }

    // Reytingdan tushib qolgan (endi top N ichida yo'q) eski hujjatlarni
    // tozalash — bu yerda soddalik uchun o'tkazib yuborilgan; ular vaqt
    // o'tishi bilan `updatedAt` orqali eskirganini bilib bo'ladi. Agar
    // ro'yxat uzoq muddat aralashib qolsa, keyinroq tozalash logikasi
    // qo'shiladi.

    console.log(`[leaderboard] ${Math.round((Date.now() - started) / 1000)}s ichida ${written} ta hujjat yangilandi`);
    return { statusCode: 200, body: JSON.stringify({ ok: true, written }) };

  } catch (e) {
    console.error('[leaderboard] XATO:', e.stack || e.message);
    return { statusCode: 200, body: JSON.stringify({ ok: false, error: e.message }) };
  }
};
