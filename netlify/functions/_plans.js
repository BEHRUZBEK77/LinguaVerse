// ═══════════════════════════════════════════════════════════════════════════
// _plans.js — SERVER TOMONDAGI narxlar
//
// Nega alohida fayl: js/lv-core.js brauzer ES moduli, Netlify funksiyalari esa
// CommonJS. Server klient yuborgan summaga ISHONMASLIGI kerak — aks holda
// kimdir 79 999 o'rniga 1 so'm yuborib PREMIUM olardi.
//
// ⚠️  Bu yerdagi narxlar js/lv-core.js bilan BIR XIL bo'lishi shart.
//     Tekshirish:  node scripts/check-plan-sync.js
// ═══════════════════════════════════════════════════════════════════════════

const PLANS = {
  free:    { id: 'free',    name: 'Bepul',   price: 0,     days: 0  },
  nova:    { id: 'nova',    name: 'NOVA',    price: 39999, days: 30 },
  mega:    { id: 'mega',    name: 'MEGA',    price: 49999, days: 30 },
  premium: { id: 'premium', name: 'PREMIUM', price: 79999, days: 30 }
};

// Davomiyliklar — js/lv-core.js bilan BIR XIL bo'lishi shart.
// days → planExpiry shuncha kunga qo'shib hisoblanadi.
const DURATIONS = {
  daily:   { key: 'daily',   label: 'Kunlik',   days: 1 },
  monthly: { key: 'monthly', label: 'Oylik',    days: 30 },
  q3:      { key: 'q3',      label: '3 oylik',  days: 90 },
  q6:      { key: 'q6',      label: '6 oylik',  days: 180 },
  yearly:  { key: 'yearly',  label: '1 yillik', days: 365 }
};

const DURATION_ORDER = ['daily', 'monthly', 'q3', 'q6', 'yearly'];

/** Reja narxini davomiylikka qarab hisoblaydi (so'm). Klient ko'rsatgan
 *  summa bilan mos — js/lv-core.js da ham aynan shu formula turishi shart. */
function planPrice(planId, duration = 'monthly') {
  const base = PLANS[planId]?.price || 0;
  if (!base) return 0;
  if (!duration || duration === 'monthly') return base;   // oylik = bazaviy narx, yaxlitlanmaydi
  let p = base;
  if (duration === 'daily') p = base / 30;
  else if (duration === 'q3') p = base * 3 * 0.95;      // 5% chegirma
  else if (duration === 'q6') p = base * 6 * 0.90;      // 10% chegirma
  else if (duration === 'yearly') p = base * 12 * 0.80; // 20% chegirma
  return Math.max(0, Math.round(p / 100) * 100);
}

/** Reja mavjud va pullikmi? duration bo'lsa — shu davr uchun narx/days qaytaradi. */
function paidPlan(id, duration) {
  const p = PLANS[id];
  if (!p || p.price <= 0) return null;
  const dur = DURATIONS[duration] || DURATIONS.monthly;
  return { ...p, duration: dur.key, durationLabel: dur.label, days: dur.days, price: planPrice(id, dur.key) };
}

// ── REFERAL MUKOFOTI ──
// Taklif qilingan do'st BIRINCHI marta pullik reja sotib olganda, taklif
// qiluvchiga to'lov summasining shu ulushi haqiqiy pul (balance) sifatida
// beriladi. Foiz — server tomonda, klient o'zgartira olmaydi.
const REFERRAL_PERCENT = 0.20;   // 20%

function referralReward(planPrice) {
  return Math.round((planPrice * REFERRAL_PERCENT) / 100) * 100;   // 100 so'mgacha yaxlitlash
}

module.exports = { PLANS, DURATIONS, DURATION_ORDER, planPrice, paidPlan, REFERRAL_PERCENT, referralReward };
