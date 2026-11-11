'use strict';
// ═══════════════════════════════════════════════════════════════════════════
// LinguaVerse HAMKORLIK MARKAZI — umumiy mantiq (API, cron va to'lov shu yerdan foydalanadi)
//
// Tamoyil: kam xavfli ishlar AVTOMATIK, yuqori xavfli ishlar ADMIN tasdig'ida.
//   Avtomatik: do'st/o'qituvchi hamkorligi, kontent yaratuvchini API orqali tekshirish,
//              klik/ro'yxatdan o'tishni hisoblash, komissiyani ushlab turish va
//              (xavf past, summa kichik bo'lsa) balansga o'tkazish, darajalar, YOUTUBER imtiyozi.
//   Admin:     o'quv markazi/brend/korporativ/elchi arizalari, API bilan tekshirib bo'lmaydigan
//              ijtimoiy tarmoqlar, katta yoki shubhali komissiyalar, brend sahifasini e'lon
//              qilish, pul yechish (payment.js — har doim admin).
//
// Kolleksiyalar (hammasi faqat server — mijoz o'qiy/yoza olmaydi):
//   partnerAccounts/{uid}       hamkor hisobi
//   partnerCodes/{CODE}         kod → uid
//   partnerAttribution/{uid}    bu foydalanuvchini qaysi hamkor olib kelgan
//   partnerCommissions/{order}  har bir to'lov uchun komissiya
//   partnerStats/{uid_YYYYMMDD} kunlik statistika
//   partnerClicks/{id}          noyob kliklar (35 kundan keyin o'chiriladi)
//   partnerRequests/{id}        guruh/korporativ litsenziya so'rovlari
//   partnerAudit/{id}           admin va tizim qarorlari jurnali
//   partnerConfig/program       admin sozlamalari
// ═══════════════════════════════════════════════════════════════════════════
const crypto = require('node:crypto');

const TERMS_VERSION = '2026-11-11';
const DAY = 86400_000;

// Hamkor turlari. auto — ariza darhol faollashadi; verify — avtomatik tekshiruv;
// review — admin tasdig'i shart.
const TYPES = Object.freeze({
  referral:   { label: "Do'st taklif qilish", icon: '🎁', rate: 0.20, recurring: false, auto: true,
                pitch: "Har bir taklif qilgan do'stingizning birinchi to'lovidan 20%." },
  teacher:    { label: "O'qituvchi / repetitor", icon: '👩‍🏫', rate: 0.25, recurring: true, auto: true, roster: true,
                pitch: "O'quvchilaringizni ulang, ularning to'lovlaridan 12 oy davomida 25%." },
  creator:    { label: 'Kontent yaratuvchi', icon: '🎬', rate: 0.30, recurring: true, verify: 'social', perk: 'youtuber',
                pitch: 'YouTube, Instagram, TikTok, Telegram. 30% komissiya + bepul YOUTUBER rejasi (150 video).' },
  school:     { label: "O'quv markazi / maktab", icon: '🏫', rate: 0.30, recurring: true, review: true, roster: true, bulk: true,
                pitch: "Guruh litsenziyalari, o'quvchilar ro'yxati va 30% komissiya." },
  brand:      { label: 'Brend (o‘z sahifangiz)', icon: '🏢', rate: 0.30, recurring: true, review: true, verify: 'dns', page: true,
                pitch: "Brendingiz rangi va nomi bilan LinguaVerse sahifasi. Domen DNS orqali tasdiqlanadi." },
  corporate:  { label: 'Korporativ (xodimlar uchun)', icon: '💼', rate: 0.15, recurring: true, review: true, bulk: true, roster: true,
                pitch: "Xodimlaringiz uchun ommaviy litsenziya va hisobot." },
  ambassador: { label: 'Talaba elchi', icon: '🎓', rate: 0.25, recurring: true, review: true,
                pitch: "Universitetingizda LinguaVerse vakili bo'ling: to'lovlardan 25%." }
});
const PLATFORMS = Object.freeze({
  youtube:   { label: 'YouTube', min: 1000, auto: true },
  telegram:  { label: 'Telegram kanal', min: 1000, auto: true },
  instagram: { label: 'Instagram', min: 5000, auto: false },
  tiktok:    { label: 'TikTok', min: 5000, auto: false }
});
// Daraja — oxirgi 90 kundagi to'lov qilgan mijozlar soni bo'yicha. Bonus stavkaga qo'shiladi.
const TIERS = Object.freeze([
  { id: 'start',    label: 'Start',    min: 0,  bonus: 0 },
  { id: 'silver',   label: 'Silver',   min: 5,  bonus: 0.05 },
  { id: 'gold',     label: 'Gold',     min: 20, bonus: 0.10 },
  { id: 'platinum', label: 'Platinum', min: 50, bonus: 0.15 }
]);
const MAX_RATE = 0.45;
const DEFAULTS = Object.freeze({
  holdDays: 14,               // qaytarish (refund) muddati — komissiya shu vaqt ushlab turiladi
  autoApproveMax: 150000,     // bundan katta komissiya — admin tasdig'ida
  riskReview: 50,             // xavf bali shundan yuqori — admin tasdig'ida
  attributionMonths: 12,      // takroriy komissiya muddati
  attachWindowDays: 7,        // ro'yxatdan o'tgandan keyin shu kun ichida kod ulanishi mumkin
  dailySignupFlag: 25,        // bir kunda shundan ko'p ro'yxatdan o'tish — shubhali
  creatorRenewSignups: 3,     // YOUTUBER imtiyozi har oy: kamida shuncha yangi foydalanuvchi YOKI yangi video
  autoApproveTeachers: true,
  paused: false               // dastur vaqtincha to'xtatilgan (yangi arizalar qabul qilinmaydi)
});
const RESERVED = /^(ADMIN|LINGUA|LINGUAVERSE|LV|SUPPORT|HELP|OFFICIAL|RASMIY|TEST|NULL|UNDEFINED|ROOT|STAFF|PROMO|FREE|BEPUL)/;

const clean = (v, max = 150) => String(v ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max);
const toTime = v => v instanceof Date ? v.getTime() : v && typeof v === 'object' ? Date.parse(v.$t || v.iso || '') || 0 : Date.parse(v || '') || 0;
const dayKey = (t = Date.now()) => new Date(t).toISOString().slice(0, 10).replace(/-/g, '');
const ipHash = ip => ip && ip !== 'unknown' ? crypto.createHash('sha256').update('lv-partner:' + ip).digest('hex').slice(0, 20) : null;
const roundSum = n => Math.max(0, Math.round(Number(n || 0) / 100) * 100);

function validCode(code) {
  const c = String(code || '').trim().toUpperCase();
  return /^[A-Z0-9]{4,16}$/.test(c) ? c : null;
}
function codeAllowed(code) { const c = validCode(code); return !!c && !RESERVED.test(c); }
function suggestCode(name, salt = crypto.randomBytes(2).toString('hex')) {
  const base = String(name || '').normalize('NFKD').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
  const body = base.length >= 3 && !RESERVED.test(base) ? base : 'LVP';
  return (body + salt.toUpperCase().replace(/[^A-Z0-9]/g, '')).slice(0, 12);
}
function tierFor(sales90) {
  let t = TIERS[0];
  for (const x of TIERS) if (sales90 >= x.min) t = x;
  const next = TIERS[TIERS.indexOf(t) + 1] || null;
  return { ...t, next: next ? { id: next.id, label: next.label, need: next.min - sales90 } : null };
}
function rateFor(account, sales90) {
  const type = TYPES[account?.type] || TYPES.referral;
  if (Number.isFinite(account?.rateOverride) && account.rateOverride >= 0) return Math.min(MAX_RATE, account.rateOverride);
  return Math.min(MAX_RATE, +(type.rate + tierFor(sales90).bonus).toFixed(4));
}
function settings(stored) {
  const s = { ...DEFAULTS };
  for (const [k, v] of Object.entries(stored || {})) {
    if (!(k in DEFAULTS)) continue;
    if (typeof DEFAULTS[k] === 'boolean') s[k] = v === true || v === 'true';
    else if (Number.isFinite(Number(v)) && Number(v) >= 0) s[k] = Number(v);
  }
  s.holdDays = Math.min(90, Math.max(0, s.holdDays));
  return s;
}

/**
 * Xavf bahosi (0–100). Faqat signal — qaror emas: yuqori bo'lsa admin ko'radi.
 *   ctx: { account, attribution, buyerUid, signupsThatDay, amount }
 */
function riskScore(ctx) {
  const flags = [];
  let score = 0;
  const a = ctx.attribution || {}, p = ctx.account || {};
  if (ctx.buyerUid && ctx.buyerUid === p.uid) { score += 100; flags.push("o'zini o'zi taklif qilgan"); }
  if (a.ipHash && p.ipHashes && p.ipHashes.includes(a.ipHash)) { score += 60; flags.push('xaridor va hamkor bir xil IP manzildan'); }
  if (ctx.signupsThatDay >= (ctx.dailySignupFlag || DEFAULTS.dailySignupFlag)) { score += 30; flags.push(`bir kunda ${ctx.signupsThatDay} ta ro'yxatdan o'tish`); }
  const ageMin = (toTime(ctx.now || Date.now()) - toTime(a.at)) / 60000;
  if (a.at && ageMin >= 0 && ageMin < 3) { score += 15; flags.push("ro'yxatdan o'tib 3 daqiqada to'lov"); }
  if (p.status && p.status !== 'active') { score += 100; flags.push('hamkor faol emas'); }
  return { score: Math.min(100, score), flags };
}

/** Komissiya qaror qadami: ushlab turish muddati tugagach — avtomatik yoki admin. */
function releaseDecision(c, cfg, orderStillPaid) {
  if (!orderStillPaid) return { status: 'reversed', reason: "to'lov bekor qilingan yoki qaytarilgan" };
  if ((c.risk || 0) >= cfg.riskReview) return { status: 'review', reason: 'xavf bali yuqori: ' + (c.flags || []).join(', ') };
  if ((c.commission || 0) > cfg.autoApproveMax) return { status: 'review', reason: `summa ${cfg.autoApproveMax.toLocaleString('en-US')} so'mdan katta` };
  return { status: 'credited', reason: 'avtomatik' };
}

/** Komissiya hisoblanishi kerakmi (turi va muddatiga qarab). */
function commissionAllowed({ account, attribution, previousSales, now = Date.now() }) {
  if (!account || account.status !== 'active') return false;
  if (!attribution || attribution.partnerUid !== account.uid) return false;
  if (toTime(attribution.expiresAt) && toTime(attribution.expiresAt) < now) return false;
  const type = TYPES[account.type] || TYPES.referral;
  if (!type.recurring && previousSales > 0) return false;   // do'st taklifi — faqat birinchi to'lov
  return true;
}

/** Ariza: tur va maydonlarni tekshiradi; qaysi yo'l bilan faollashishini aytadi. */
function validateApplication(body) {
  const type = clean(body.type, 20);
  const T = TYPES[type];
  if (!T) throw Object.assign(new Error("Hamkorlik turi noto'g'ri"), { status: 400 });
  if (body.consent !== true) throw Object.assign(new Error('Hamkorlik shartlariga rozilik kerak'), { status: 400 });
  const name = clean(body.name, 90);
  if (name.length < 2) throw Object.assign(new Error('Ism yoki tashkilot nomini kiriting'), { status: 400 });
  const contact = clean(body.contact, 120);
  if (!T.auto && contact.length < 5) throw Object.assign(new Error("Bog'lanish uchun telefon yoki Telegram kiriting"), { status: 400 });
  const out = { type, name, contact, about: clean(body.about, 600), city: clean(body.city, 60) };
  if (type === 'creator') {
    const platform = clean(body.platform, 20);
    if (!PLATFORMS[platform]) throw Object.assign(new Error('Platformani tanlang'), { status: 400 });
    const handle = socialHandle(platform, body.url);
    if (!handle) throw Object.assign(new Error('Kanal yoki sahifa havolasini to‘g‘ri kiriting'), { status: 400 });
    out.social = { platform, handle, url: clean(body.url, 200) };
  }
  if (type === 'brand') {
    const domain = validDomain(body.domain);
    if (!domain) throw Object.assign(new Error('Brendning rasmiy domenini kiriting (masalan: brend.uz)'), { status: 400 });
    out.brand = { domain, color: /^#[0-9a-f]{6}$/i.test(body.color || '') ? body.color : '#58d3b3', tagline: clean(body.tagline, 120) };
  }
  if (['school', 'corporate'].includes(type)) out.org = { size: Math.min(100000, Math.max(0, Math.floor(Number(body.size) || 0))), website: clean(body.website, 120) };
  return out;
}
function validDomain(d) {
  const x = clean(d, 100).toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  return /^(?=.{4,100}$)[a-z0-9](?:[a-z0-9.-]*[a-z0-9])\.[a-z]{2,}$/.test(x) && !x.includes('..') ? x : null;
}
/** Havoladan kanal/sahifa identifikatori: youtube → @handle yoki UC…; telegram → username. */
function socialHandle(platform, url) {
  const raw = clean(url, 200);
  if (!raw) return null;
  if (platform === 'telegram') { const m = raw.match(/^(?:https?:\/\/)?(?:t\.me\/|telegram\.me\/|@)?([A-Za-z][A-Za-z0-9_]{4,31})\/?$/); return m ? m[1] : null; }
  if (platform === 'youtube') {
    const m = raw.match(/youtube\.com\/(?:channel\/(UC[\w-]{22})|(@[\w.-]{3,30}))/i) || raw.match(/^(@[\w.-]{3,30})$/) || raw.match(/^(UC[\w-]{22})$/);
    return m ? (m[1] || m[2]) : null;
  }
  const host = platform === 'instagram' ? /instagram\.com\/([A-Za-z0-9_.]{2,30})/i : /tiktok\.com\/@([A-Za-z0-9_.]{2,30})/i;
  const m = raw.match(host) || raw.match(/^@?([A-Za-z0-9_.]{2,30})$/);
  return m ? m[1] : null;
}
function maskName(n) {
  const s = clean(n, 40) || 'Foydalanuvchi';
  return s.split(/\s+/).map(w => w[0] + (w.length > 1 ? '•'.repeat(Math.min(4, w.length - 1)) : '')).join(' ');
}

module.exports = {
  TERMS_VERSION, DAY, TYPES, PLATFORMS, TIERS, MAX_RATE, DEFAULTS,
  clean, toTime, dayKey, ipHash, roundSum, validCode, codeAllowed, suggestCode, tierFor, rateFor, settings,
  riskScore, releaseDecision, commissionAllowed, validateApplication, validDomain, socialHandle, maskName
};
