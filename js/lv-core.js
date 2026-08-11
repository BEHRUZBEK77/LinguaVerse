// ═══════════════════════════════════════════════════════════════════════════
// lv-core.js — LinguaVerse YAGONA MANBA (single source of truth)
//
// Bu fayl butun platformaning poydevori. Rejalar, AI modellar, limitlar va
// promptlar FAQAT shu yerda ta'riflanadi. Boshqa hech qaysi faylda PLANS yoki
// PLAN_LIMITS bo'lmasligi kerak — aks holda limitlar yana bir-biriga zid bo'ladi.
//
// Ishlatish:
//   import { LV } from './js/lv-core.js';
//   await LV.ready();                        // auth + user profil yuklanadi
//   const g = await LV.can('mega');          // limit tekshirish
//   if (!g.ok) return toast(g.message);
//   const r = await LV.ai('mega', messages); // so'rov + avtomatik hisoblash
// ═══════════════════════════════════════════════════════════════════════════

import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  getFirestore, doc, getDoc, setDoc, updateDoc, runTransaction,
  serverTimestamp, increment, collection, addDoc
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ───────────────────────────────────────────────────────────────────────────
// FIREBASE
// ───────────────────────────────────────────────────────────────────────────
export const FB_CONFIG = {
  apiKey: "AIzaSyB-QDASPCTIKCx445PpeKFKC8fWydKHMcI",
  authDomain: "linguaverse-81b52.firebaseapp.com",
  projectId: "linguaverse-81b52",
  storageBucket: "linguaverse-81b52.firebasestorage.app",
  messagingSenderId: "1037869292716",
  appId: "1:1037869292716:web:567bf2c9f9ed0862941309",
  measurementId: "G-H8WH5FTTEY"
};

const app = getApps().length ? getApp() : initializeApp(FB_CONFIG);
const auth = getAuth(app);
const db = getFirestore(app);
export { app, auth, db };

// ───────────────────────────────────────────────────────────────────────────
// SAYT ILDIZI — modulning o'z joyidan hisoblanadi.
//
// Nega mutlaq '/...' yo'l emas: sayt Netlify'da ildizda turadi, lekin mahalliy
// ishlab chiqishda ko'pincha ost-papkada bo'ladi. import.meta.url har ikkalasida
// ham to'g'ri ildizni beradi.
//   .../LinguaVerse-main/js/lv-core.js  →  BASE = .../LinguaVerse-main/
// ───────────────────────────────────────────────────────────────────────────
export const BASE = new URL('../', import.meta.url).pathname;

/** Sayt ildiziga nisbatan yo'l quradi. */
export const url = (p = '') => BASE + String(p).replace(/^\//, '');

// Server proxy'lar — API kalitlar HECH QACHON klientda bo'lmaydi
const AI_URL = url('.netlify/functions/ai');
const SPEECH_URL = url('.netlify/functions/azure-speech');

// ───────────────────────────────────────────────────────────────────────────
// MUHIM: bu yerda ilgari noma'lum uchinchi-tomon "to'g'ridan-to'g'ri worker"
// (gentle-hat-d9fa.akromovbehruz7.workers.dev) zaxira sifatida ishlatilgan.
// U bizniki emas edi va system-prompt/til-cheklovlarni (masalan tanlangan
// tilda gapirish qoidasini) hurmat qilishi kafolatlanmagan — aynan shu
// sabab foydalanuvchi bir tilni tanlaganda AI boshqa tilda javob berib
// qolishi mumkin edi. Endi bunday noma'lum zaxira yo'q: Netlify funksiyasi
// ishlamasa, foydalanuvchiga aniq xato ko'rsatiladi.
// ───────────────────────────────────────────────────────────────────────────

let functionsAvailable = null;   // bir marta aniqlanadi va eslab qolinadi

/**
 * AI so'rovi — faqat bizning Netlify funksiyamiz orqali.
 * @returns {{ok:boolean, text?:string, backend?:string, error?:string}}
 */
export async function aiRequest(payload, signal) {
  if (functionsAvailable !== false) {
    try {
      const r = await fetch(AI_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal
      });

      // 404/503 — funksiya umuman topilmadi (statik server/deploy muammosi).
      if (r.status === 404 || r.status === 503) {
        functionsAvailable = false;
        console.warn('[LV] Netlify AI funksiyasi topilmadi (', r.status, ')');
      } else {
        functionsAvailable = true;
        const data = await r.json();
        if (r.ok) {
          return {
            ok: true,
            text: data.text || data.candidates?.[0]?.content?.parts?.[0]?.text || '',
            thinking: data.thinking || null,
            backend: data.backend,
            reserve: data.reserve
          };
        }
        console.warn('[LV] AI funksiyasi xato berdi:', data.error);
        return { ok: false, error: data.error || 'AI hozir javob bera olmayapti. Bir ozdan keyin urinib ko\'ring.' };
      }
    } catch (e) {
      if (e.name === 'AbortError') throw e;
      functionsAvailable = false;
      console.warn('[LV] AI funksiyasiga yetib bo\'lmadi:', e.message);
    }
  }

  return { ok: false, error: 'AI hozir javob bera olmayapti. Internetni tekshirib, qayta urinib ko\'ring.' };
}

// ═══════════════════════════════════════════════════════════════════════════
// 1) REJALAR — narxlar so'mda
// ═══════════════════════════════════════════════════════════════════════════
export const PLANS = {
  free: {
    id: 'free',
    name: 'Bepul',
    tagline: "Boshlash uchun yetarli",
    icon: '<i class="fa-solid fa-seedling" style="color:#34d399"></i>',
    fa: 'fa-seedling',
    color: '#64748b',
    accent: '#94a3b8',
    price: 0,
    priceLabel: 'Bepul',
    order: 0,
    models: ['nova'],
    perks: [
      'NOVA AI — kuniga 40 ta savol',
      'Speaking 15 daqiqa/kun',
      'Kuniga 4 ta AI dars',
      'Barcha 8 til ochiq',
      'Coin va XP tizimi'
    ]
  },
  nova: {
    id: 'nova',
    name: 'NOVA',
    tagline: "Kundalik jiddiy o'rganish",
    icon: '<i class="fa-solid fa-bolt" style="color:#f5c842"></i>',
    fa: 'fa-bolt',
    color: '#3b82f6',
    accent: '#60a5fa',
    price: 39999,
    priceLabel: "39 999 so'm",
    order: 1,
    models: ['nova', 'pro'],
    perks: [
      'NOVA AI — kuniga 200 ta savol',
      "PRO AI (o'ylash rejimi) — kuniga 50 ta",
      'Speaking 40 daqiqa/kun + talaffuz bahosi',
      'Kuniga 12 ta AI dars',
      "Reklama yo'q"
    ]
  },
  mega: {
    id: 'mega',
    name: 'MEGA',
    tagline: "Tezroq natija, kuchliroq AI",
    icon: '<i class="fa-solid fa-rocket" style="color:#a78bfa"></i>',
    fa: 'fa-rocket',
    color: '#8b5cf6',
    accent: '#a78bfa',
    price: 49999,
    priceLabel: "49 999 so'm",
    order: 2,
    badge: 'Eng mashhur',
    models: ['nova', 'pro', 'mega', 'proplus'],
    perks: [
      'MEGA AI — kuniga 150 ta savol',
      "PRO+ chuqur o'ylash — kuniga 60 ta",
      'NOVA va PRO limitlari 2x oshgan',
      'Speaking 80 daqiqa/kun',
      'Kuniga 30 ta AI dars',
      "Shaxsiy o'quv rejasi"
    ]
  },
  premium: {
    id: 'premium',
    name: 'PREMIUM',
    tagline: "Professional til o'rgatish ustozi",
    icon: '<i class="fa-solid fa-crown" style="color:#f5c842"></i>',
    fa: 'fa-crown',
    color: '#f59e0b',
    accent: '#fbbf24',
    price: 79999,
    priceLabel: "79 999 so'm",
    order: 3,
    models: ['nova', 'pro', 'mega', 'proplus', 'premium', 'megaplus'],
    perks: [
      'PREMIUM AI — kuniga 220 ta savol',
      "MEGA+ eng chuqur o'ylash — kuniga 90 ta",
      'Barcha quyi modellar maksimal limitda',
      'Speaking 150 daqiqa/kun',
      'Kuniga 60 ta AI dars',
      'Imtihonga tayyorlov (IELTS/Goethe/TOPIK)',
      "Ustuvor qo'llab-quvvatlash"
    ]
  }
};

export const PLAN_ORDER = ['free', 'nova', 'mega', 'premium'];

// ─────────────────────────────────────────────────────────────────────────────
// DAVOMIYLIKLAR — rejalar kunlik / oylik / 3 oylik / 6 oylik / 1 yillik sotiladi.
//    days   → planExpiry shuncha kunga qo'shib hisoblanadi (server tomonida)
//    Narxlar serverda netlify/functions/_plans.js bilan BIR XIL formula.
// ─────────────────────────────────────────────────────────────────────────────
export const DURATIONS = {
  daily:   { key: 'daily',   label: 'Kunlik',   days: 1 },
  monthly: { key: 'monthly', label: 'Oylik',    days: 30 },
  q3:      { key: 'q3',      label: '3 oylik',  days: 90 },
  q6:      { key: 'q6',      label: '6 oylik',  days: 180 },
  yearly:  { key: 'yearly',  label: '1 yillik', days: 365 }
};

export const DURATION_ORDER = ['daily', 'monthly', 'q3', 'q6', 'yearly'];

/** Reja narxini davomiylikka qarab hisoblaydi (so'm). Faqat ko'rsatish uchun —
 *  server o'z manbasidan hisoblaydi, klient narxni o'zgartira olmaydi. */
export function planPrice(planId, duration = 'monthly') {
  const base = PLANS[planId]?.price || 0;
  if (!base) return 0;
  if (!duration || duration === 'monthly') return base;   // oylik = bazaviy narx, yaxlitlanmaydi
  let p = base;
  if (duration === 'daily') p = base / 30;
  else if (duration === 'q3') p = base * 3 * 0.95;    // 5% chegirma
  else if (duration === 'q6') p = base * 6 * 0.90;    // 10% chegirma
  else if (duration === 'yearly') p = base * 12 * 0.80; // 20% chegirma
  return Math.max(0, Math.round(p / 100) * 100);
}

// ═══════════════════════════════════════════════════════════════════════════
// 2) AI MODELLAR — foydalanuvchi ko'radigan nomlar
//    Haqiqiy backend modeli serverda (netlify/functions/ai.js) tanlanadi.
// ═══════════════════════════════════════════════════════════════════════════
export const MODELS = {
  nova: {
    id: 'nova', name: 'NOVA', icon: '<i class="fa-solid fa-bolt" style="color:#f5c842"></i>', fa: 'fa-bolt', color: '#3b82f6',
    thinking: false, minPlan: 'free', speed: 'Juda tez',
    desc: 'Tez javob beradi. Kundalik savollar, tarjima, oddiy mashqlar uchun.'
  },
  pro: {
    id: 'pro', name: 'PRO', icon: '<i class="fa-solid fa-brain" style="color:#a78bfa"></i>', fa: 'fa-brain', color: '#6366f1',
    thinking: true, minPlan: 'nova', speed: "O'rtacha",
    desc: "Javob berishdan oldin o'ylaydi. Grammatika tahlili va xato tushuntirish uchun."
  },
  mega: {
    id: 'mega', name: 'MEGA', icon: '<i class="fa-solid fa-rocket" style="color:#a78bfa"></i>', fa: 'fa-rocket', color: '#8b5cf6',
    thinking: false, minPlan: 'mega', speed: 'Tez',
    desc: "NOVA'dan sezilarli kuchliroq. Tabiiy suhbat va batafsil tushuntirish."
  },
  proplus: {
    id: 'proplus', name: 'PRO+', icon: '<i class="fa-solid fa-gem" style="color:#60a5fa"></i>', fa: 'fa-gem', color: '#a855f7',
    thinking: true, minPlan: 'mega', speed: 'Sekinroq, aniqroq',
    desc: "Chuqur o'ylash rejimi. Murakkab grammatika, insho tahlili, imtihon savollari."
  },
  premium: {
    id: 'premium', name: 'PREMIUM', icon: '<i class="fa-solid fa-crown" style="color:#f5c842"></i>', fa: 'fa-crown', color: '#f59e0b',
    thinking: false, minPlan: 'premium', speed: 'Tez',
    desc: 'Eng kuchli tezkor model. Professional ustoz darajasidagi javoblar.'
  },
  megaplus: {
    id: 'megaplus', name: 'MEGA+', icon: '<i class="fa-solid fa-gem" style="color:#00D4FF"></i>', fa: 'fa-star', color: '#f43f5e',
    thinking: true, minPlan: 'premium', speed: 'Eng chuqur',
    desc: "Platformadagi eng zo'ri. To'liq tahlil, o'quv rejasi, imtihonga tayyorlov."
  }
};

export const MODEL_IDS = ['nova', 'pro', 'mega', 'proplus', 'premium', 'megaplus'];

// ═══════════════════════════════════════════════════════════════════════════
// 3) LIMITLAR — [kunlik, haftalik, oylik].  null = reja bu resursni bermaydi.
//    Bu YAGONA limit jadvali. Boshqa joyda limit raqami yozilmasin.
// ═══════════════════════════════════════════════════════════════════════════
export const RESOURCES = {
  nova:      { label: 'NOVA savollari',      unit: 'ta',     icon: '<i class="fa-solid fa-bolt" style="color:#f5c842"></i>',  fa: 'fa-bolt' },
  pro:       { label: 'PRO savollari',       unit: 'ta',     icon: '<i class="fa-solid fa-brain" style="color:#a78bfa"></i>',  fa: 'fa-brain' },
  mega:      { label: 'MEGA savollari',      unit: 'ta',     icon: '<i class="fa-solid fa-rocket" style="color:#a78bfa"></i>',  fa: 'fa-rocket' },
  proplus:   { label: 'PRO+ savollari',      unit: 'ta',     icon: '<i class="fa-solid fa-gem" style="color:#60a5fa"></i>',  fa: 'fa-gem' },
  premium:   { label: 'PREMIUM savollari',   unit: 'ta',     icon: '<i class="fa-solid fa-crown" style="color:#f5c842"></i>',  fa: 'fa-crown' },
  megaplus:  { label: 'MEGA+ savollari',     unit: 'ta',     icon: '<i class="fa-solid fa-gem" style="color:#00D4FF"></i>',  fa: 'fa-star' },
  speak_min: { label: 'Speaking',            unit: 'daqiqa', icon: '<i class="fa-solid fa-microphone-lines" style="color:#f87171"></i>', fa: 'fa-microphone-lines' },
  writing:   { label: 'Writing tekshiruvi',  unit: 'ta',     icon: '<i class="fa-solid fa-pen-nib" style="color:#34d399"></i>', fa: 'fa-pen-nib' },
  lesson:    { label: 'AI darslar',          unit: 'ta',     icon: '<i class="fa-solid fa-book" style="color:#60a5fa"></i>',  fa: 'fa-book-open' },
  coach:     { label: 'AI Coach seanslari',  unit: 'ta',     icon: '<i class="fa-solid fa-graduation-cap" style="color:#a78bfa"></i>',  fa: 'fa-chalkboard-user' },
  vocab_ai:  { label: "AI lug'at qo'shish",  unit: 'marta',  icon: '<i class="fa-solid fa-book-open-reader" style="color:#a78bfa"></i>',  fa: 'fa-book-bookmark' },
  translate: { label: 'Tez tarjima',         unit: 'ta',     icon: '<i class="fa-solid fa-font" style="color:#60a5fa"></i>',  fa: 'fa-language' }
};

export const LIMITS = {
  // ── BEPUL: ataylab saxiy, lekin pullik rejalarga o'sish sababi qoladi
  free: {
    nova:      [40, 200, 600],
    pro:       null,
    mega:      null,
    proplus:   null,
    premium:   null,
    megaplus:  null,
    speak_min: [15, 60, 180],
    writing:   [6, 30, 90],
    lesson:    [4, 20, 50],
    coach:     [3, 15, 40],
    vocab_ai:  [5, 25, 70],
    translate: [60, 300, 900]
  },

  // ── NOVA — 39 999 so'm
  nova: {
    nova:      [200, 1000, 3000],
    pro:       [50, 250, 700],
    mega:      null,
    proplus:   null,
    premium:   null,
    megaplus:  null,
    speak_min: [40, 200, 600],
    writing:   [20, 100, 300],
    lesson:    [12, 60, 180],
    coach:     [10, 50, 150],
    vocab_ai:  [20, 100, 300],
    translate: [300, 1500, 4500]
  },

  // ── MEGA — 49 999 so'm
  mega: {
    nova:      [400, 2000, 6000],
    pro:       [120, 600, 1800],
    mega:      [150, 750, 2200],
    proplus:   [60, 300, 900],
    premium:   null,
    megaplus:  null,
    speak_min: [80, 400, 1200],
    writing:   [45, 225, 650],
    lesson:    [30, 150, 450],
    coach:     [20, 100, 300],
    vocab_ai:  [50, 250, 750],
    translate: [800, 4000, 12000]
  },

  // ── PREMIUM — 79 999 so'm.  Eng yuqori, lekin baribir cheklangan.
  premium: {
    nova:      [800, 4000, 12000],
    pro:       [250, 1250, 3800],
    mega:      [350, 1750, 5200],
    proplus:   [180, 900, 2700],
    premium:   [220, 1100, 3300],
    megaplus:  [90, 450, 1300],
    speak_min: [150, 750, 2200],
    writing:   [90, 450, 1300],
    lesson:    [60, 300, 900],
    coach:     [45, 225, 650],
    vocab_ai:  [120, 600, 1800],
    translate: [2000, 10000, 30000]
  }
};

const PERIODS = ['daily', 'weekly', 'monthly'];
const PERIOD_LABEL = { daily: 'Kunlik', weekly: 'Haftalik', monthly: 'Oylik' };
const PERIOD_RESET = {
  daily: 'Ertaga yarim tunda yangilanadi.',
  weekly: 'Dushanba kuni yangilanadi.',
  monthly: 'Keyingi oy boshida yangilanadi.'
};

// ═══════════════════════════════════════════════════════════════════════════
// 4) DAVR KALITLARI — Toshkent vaqti (UTC+5) bo'yicha
// ═══════════════════════════════════════════════════════════════════════════
const TZ_OFFSET_MIN = 5 * 60;   // O'zbekiston UTC+5, yozgi vaqt yo'q

function tzNow(d = new Date()) {
  return new Date(d.getTime() + (TZ_OFFSET_MIN + d.getTimezoneOffset()) * 60000);
}

function isoWeek(d) {
  // ISO-8601: hafta dushanbadan boshlanadi
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = t.getUTCDay() || 7;            // yakshanba = 7
  t.setUTCDate(t.getUTCDate() + 4 - dayNum);    // shu haftaning payshanbasi
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((t - yearStart) / 86400000 + 1) / 7);
  return `${t.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

export function periodKeys(now = new Date()) {
  const d = tzNow(now);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return {
    daily: `d_${y}-${m}-${day}`,
    weekly: `w_${isoWeek(d)}`,
    monthly: `m_${y}-${m}`
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// 5) HOLAT
// ═══════════════════════════════════════════════════════════════════════════
const state = {
  user: null,
  profile: null,
  plan: 'free',
  planExpiry: null,
  usage: { daily: {}, weekly: {}, monthly: {} },
  loaded: false
};

let _readyPromise = null;
const listeners = new Set();

function emit() {
  const snap = LV.snapshot();
  listeners.forEach(fn => { try { fn(snap); } catch (e) { console.warn('[LV] listener error', e); } });
}

/** Reja muddati tugagan bo'lsa avtomatik free'ga tushiradi. */
function resolvePlan(profile) {
  if (!profile) return 'free';
  const p = profile.plan || 'free';
  if (!PLANS[p]) return 'free';
  if (p === 'free') return 'free';
  const exp = profile.planExpiry?.toDate ? profile.planExpiry.toDate()
            : (profile.planExpiry ? new Date(profile.planExpiry) : null);
  if (exp && exp.getTime() < Date.now()) return 'free';
  return p;
}

async function loadProfile(uid) {
  const ref = doc(db, 'users', uid);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    // Yangi foydalanuvchi — bazaviy hujjat yaratamiz
    const base = {
      uid,
      email: state.user?.email || '',
      displayName: state.user?.displayName || (state.user?.email || '').split('@')[0] || "O'quvchi",
      plan: 'free',
      planExpiry: null,
      coins: 0,
      xp: 0,
      streak: 0,
      onboarded: false,
      createdAt: serverTimestamp(),
      lastActive: serverTimestamp()
    };
    await setDoc(ref, base, { merge: true });
    return base;
  }

  const data = snap.data();
  updateDoc(ref, { lastActive: serverTimestamp() }).catch(() => {});
  return data;
}

async function loadUsage(uid) {
  const keys = periodKeys();
  const out = { daily: {}, weekly: {}, monthly: {} };
  await Promise.all(PERIODS.map(async p => {
    try {
      const s = await getDoc(doc(db, 'users', uid, 'usage', keys[p]));
      out[p] = s.exists() ? (s.data().counts || {}) : {};
    } catch { out[p] = {}; }
  }));
  return out;
}

// ═══════════════════════════════════════════════════════════════════════════
// 6) ASOSIY API
// ═══════════════════════════════════════════════════════════════════════════
export const LV = {

  /** Auth va profil yuklanishini kutadi. Har sahifada birinchi chaqiriladi. */
  ready() {
    if (_readyPromise) return _readyPromise;
    _readyPromise = new Promise(resolve => {
      onAuthStateChanged(auth, async u => {
        state.user = u || null;
        if (u) {
          try {
            state.profile = await loadProfile(u.uid);
            state.plan = resolvePlan(state.profile);
            state.planExpiry = state.profile.planExpiry || null;
            state.usage = await loadUsage(u.uid);
          } catch (e) {
            console.error('[LV] profil yuklanmadi:', e);
            state.profile = null;
            state.plan = 'free';
          }
        } else {
          state.profile = null;
          state.plan = 'free';
          state.usage = { daily: {}, weekly: {}, monthly: {} };
        }
        state.loaded = true;
        emit();
        resolve(LV.snapshot());
      });
    });
    return _readyPromise;
  },

  /** Holat o'zgarganda xabar beradi. Tozalash funksiyasini qaytaradi. */
  onChange(fn) {
    listeners.add(fn);
    if (state.loaded) fn(LV.snapshot());
    return () => listeners.delete(fn);
  },

  snapshot() {
    return {
      user: state.user,
      uid: state.user?.uid || null,
      signedIn: !!state.user,
      profile: state.profile,
      plan: state.plan,
      planInfo: PLANS[state.plan],
      planExpiry: state.planExpiry?.toDate ? state.planExpiry.toDate()
                : (state.planExpiry ? new Date(state.planExpiry) : null),
      onboarded: !!state.profile?.onboarded,
      usage: state.usage,
      loaded: state.loaded
    };
  },

  get plan() { return state.plan; },
  get uid() { return state.user?.uid || null; },
  get profile() { return state.profile; },

  // ── Rejaga oid yordamchilar ────────────────────────────────────────────
  planInfo(id = state.plan) { return PLANS[id] || PLANS.free; },
  planRank(id = state.plan) { const i = PLAN_ORDER.indexOf(id); return i < 0 ? 0 : i; },

  hasModel(modelId, planId = state.plan) {
    return !!(PLANS[planId] || PLANS.free).models.includes(modelId);
  },

  availableModels(planId = state.plan) {
    return (PLANS[planId] || PLANS.free).models.map(id => MODELS[id]).filter(Boolean);
  },

  requiredPlan(modelId) {
    const m = MODELS[modelId];
    return m ? PLANS[m.minPlan] : null;
  },

  limitFor(resource, planId = state.plan) {
    const table = LIMITS[planId] || LIMITS.free;
    return table[resource] ?? null;
  },

  // ── LIMIT TEKSHIRISH ──────────────────────────────────────────────────
  /**
   * Resursdan foydalanish mumkinmi (hisoblamasdan tekshiradi).
   * @returns {{ok:boolean, reason?:string, message?:string, upgrade?:object}}
   */
  async can(resource, amount = 1) {
    if (!state.loaded) await LV.ready();

    if (!state.user) {
      return {
        ok: false, reason: 'auth',
        message: 'Davom etish uchun tizimga kiring.',
        action: { label: 'Kirish', href: url('auth/login.html') }
      };
    }

    const limit = LV.limitFor(resource);
    if (limit === null || limit === undefined) {
      const next = PLAN_ORDER.find(p => LIMITS[p]?.[resource]);
      const label = RESOURCES[resource]?.label || resource;
      return {
        ok: false, reason: 'plan',
        message: next
          ? `${label} — ${PLANS[next].name} rejasidan boshlab mavjud.`
          : `${label} sizning rejangizda mavjud emas.`,
        upgrade: next ? PLANS[next] : null,
        action: { label: "Rejalarni ko'rish", href: url('order.html') }
      };
    }

    // Uchala davrni tekshiramiz — qaysi biri birinchi to'lsa, o'sha to'xtatadi
    for (let i = 0; i < PERIODS.length; i++) {
      const period = PERIODS[i];
      const cap = limit[i];
      const used = state.usage[period]?.[resource] || 0;
      if (used + amount > cap) {
        const label = RESOURCES[resource]?.label || resource;
        const unit = RESOURCES[resource]?.unit || '';
        const nextPlan = PLAN_ORDER.find(p => (LIMITS[p]?.[resource]?.[i] || 0) > cap);
        return {
          ok: false, reason: 'limit', period,
          message: `${PERIOD_LABEL[period]} limit tugadi: ${label} ${used}/${cap} ${unit}. ${PERIOD_RESET[period]}`,
          used, cap,
          upgrade: nextPlan ? PLANS[nextPlan] : null,
          action: nextPlan
            ? { label: `${PLANS[nextPlan].name} ga o'tish`, href: url('order.html?plan=' + nextPlan) }
            : null
        };
      }
    }

    return { ok: true, remaining: LV.remaining(resource) };
  },

  /** Har bir davr uchun qolgan miqdor. */
  remaining(resource, planId = state.plan) {
    const limit = LV.limitFor(resource, planId);
    if (!limit) return null;
    const out = {};
    PERIODS.forEach((p, i) => {
      const used = state.usage[p]?.[resource] || 0;
      out[p] = { used, cap: limit[i], left: Math.max(0, limit[i] - used) };
    });
    out.min = Math.min(out.daily.left, out.weekly.left, out.monthly.left);
    return out;
  },

  /**
   * Resursni ATOMIK sarflaydi. Transaction ichida qayta tekshiradi —
   * ikkita tab bir vaqtda ochilsa ham limit oshib ketmaydi.
   */
  async consume(resource, amount = 1, meta = {}) {
    const gate = await LV.can(resource, amount);
    if (!gate.ok) return gate;

    const uid = state.user.uid;
    const keys = periodKeys();
    const limit = LV.limitFor(resource);

    try {
      await runTransaction(db, async tx => {
        const refs = PERIODS.map(p => doc(db, 'users', uid, 'usage', keys[p]));
        const snaps = await Promise.all(refs.map(r => tx.get(r)));

        // Transaction ichida qayta tekshirish — poyga holatidan himoya
        snaps.forEach((s, i) => {
          const used = (s.exists() ? (s.data().counts || {})[resource] : 0) || 0;
          if (used + amount > limit[i]) {
            const err = new Error(`${PERIOD_LABEL[PERIODS[i]]} limit tugadi.`);
            err.code = 'LV_LIMIT';
            err.period = PERIODS[i];
            err.used = used;
            err.cap = limit[i];
            throw err;
          }
        });

        snaps.forEach((s, i) => {
          const payload = {
            period: PERIODS[i],
            key: keys[PERIODS[i]],
            plan: state.plan,
            updatedAt: serverTimestamp(),
            counts: { [resource]: increment(amount) }
          };
          if (s.exists()) tx.set(refs[i], payload, { merge: true });
          else tx.set(refs[i], { ...payload, createdAt: serverTimestamp() });
        });
      });

      PERIODS.forEach(p => {
        state.usage[p] = state.usage[p] || {};
        state.usage[p][resource] = (state.usage[p][resource] || 0) + amount;
      });
      emit();

      return { ok: true, remaining: LV.remaining(resource) };

    } catch (e) {
      if (e.code === 'LV_LIMIT') {
        // Boshqa tabda sarflangan — mahalliy nusxani to'g'rilaymiz
        state.usage = await loadUsage(uid);
        emit();
        return {
          ok: false, reason: 'limit', period: e.period,
          message: `${e.message} (${e.used}/${e.cap}) ${PERIOD_RESET[e.period]}`
        };
      }
      console.error('[LV] consume xatosi:', e);
      // Firestore yetib bo'lmasa foydalanuvchini bloklamaymiz, lekin belgilaymiz
      return { ok: true, degraded: true, error: e.message };
    }
  },

  async refreshUsage() {
    if (!state.user) return;
    state.usage = await loadUsage(state.user.uid);
    emit();
    return state.usage;
  },

  /** Barcha resurslar bo'yicha to'liq manzara — profil sahifasi uchun. */
  usageReport(planId = state.plan) {
    return Object.keys(RESOURCES).map(res => {
      const limit = LV.limitFor(res, planId);
      return {
        resource: res,
        ...RESOURCES[res],
        available: !!limit,
        limit,
        remaining: limit ? LV.remaining(res, planId) : null
      };
    });
  },

  // ── AI CHAQIRUV ───────────────────────────────────────────────────────
  /**
   * AI so'rovi + avtomatik limit hisoblash.
   * @param {string} modelId  nova | pro | mega | proplus | premium | megaplus
   * @param {Array}  messages [{role:'user'|'assistant'|'system', content:'...'}]
   * @param {object} opts     { task, target, native, level, temperature, maxTokens, signal }
   */
  async ai(modelId, messages, opts = {}) {
    if (!MODELS[modelId]) throw new Error(`Noma'lum model: ${modelId}`);

    if (!LV.hasModel(modelId)) {
      const need = LV.requiredPlan(modelId);
      return {
        ok: false, reason: 'plan',
        message: `${MODELS[modelId].name} — ${need.name} rejasidan boshlab mavjud.`,
        upgrade: need
      };
    }

    const gate = await LV.consume(modelId, 1, { task: opts.task });
    if (!gate.ok) return gate;

    const system = buildSystemPrompt({
      model: modelId,
      plan: state.plan,
      profile: state.profile,
      ...opts
    });

    const targetKey = (opts.target || state.profile?.targetLang || 'english').toLowerCase();

    const payload = {
      model: modelId,
      plan: state.plan,
      messages: [{ role: 'system', content: system }, ...messages],
      temperature: opts.temperature,
      maxTokens: opts.maxTokens
    };

    try {
      // aiRequest o'zi zaxira yo'lini boshqaradi
      let data = await aiRequest(payload, opts.signal);

      // LANGUAGE LOCK GUARD: javob boshqa yozuv tizimida chiqsa (masalan
      // koreys tanlanganda kirillcha javob kelsa), bir marta qattiqroq
      // eslatma bilan qayta so'raladi — foydalanuvchi noto'g'ri tildagi
      // javobni ko'rishdan oldin.
      if (data.ok && replyBreaksLanguageLock(data.text, targetKey)) {
        console.warn('[LV] LANGUAGE LOCK buzildi, qayta so\'ralmoqda...');
        const retryPayload = {
          ...payload,
          messages: [
            ...payload.messages,
            { role: 'assistant', content: data.text },
            { role: 'system', content: `YOUR PREVIOUS REPLY WAS WRONG — it was not written in the target language. Rewrite your reply again, entirely in the target language this time. No exceptions.` }
          ]
        };
        const retryData = await aiRequest(retryPayload, opts.signal);
        if (retryData.ok && !replyBreaksLanguageLock(retryData.text, targetKey)) {
          data = retryData;
        } else if (retryData.ok) {
          // Ikkinchi urinish ham buzilgan bo'lsa, foydalanuvchini javobsiz
          // qoldirishdan ko'ra bor javobni ko'rsatamiz, faqat jurnalga yozamiz.
          console.error('[LV] LANGUAGE LOCK ikkinchi urinishdan keyin ham buzildi');
          data = retryData;
        }
      }

      if (!data.ok) {
        await LV.refund(modelId, 1);
        return { ok: false, reason: 'ai', message: data.error };
      }

      return {
        ok: true,
        text: data.text || '',
        thinking: data.thinking || null,
        model: modelId,
        modelName: MODELS[modelId].name,
        backend: data.backend,
        reserve: data.reserve || false,
        remaining: LV.remaining(modelId)
      };

    } catch (e) {
      if (e.name === 'AbortError') { await LV.refund(modelId, 1); return { ok: false, reason: 'abort' }; }
      await LV.refund(modelId, 1);
      console.error('[LV] AI xatosi:', e);
      return { ok: false, reason: 'network', message: "Internet aloqasi yo'q. Qayta urinib ko'ring." };
    }
  },

  /** Muvaffaqiyatsiz so'rovdan keyin limitni qaytaradi. */
  async refund(resource, amount = 1) {
    if (!state.user) return;
    const keys = periodKeys();
    try {
      await Promise.all(PERIODS.map(p =>
        setDoc(doc(db, 'users', state.user.uid, 'usage', keys[p]),
          // plan maydoni shart: Firestore qoidasi uni users/{uid}.plan bilan solishtiradi
          { plan: state.plan, period: p, key: keys[p], counts: { [resource]: increment(-amount) } },
          { merge: true })
      ));
      PERIODS.forEach(p => {
        if (state.usage[p]?.[resource]) {
          state.usage[p][resource] = Math.max(0, state.usage[p][resource] - amount);
        }
      });
      emit();
    } catch (e) { console.warn('[LV] refund muvaffaqiyatsiz:', e.message); }
  },

  /** Rejaga mos eng kuchli model. Avtomatik tanlash uchun. */
  bestModel(thinking = false) {
    const avail = (PLANS[state.plan] || PLANS.free).models;
    const ranked = thinking ? ['megaplus', 'proplus', 'pro'] : ['premium', 'mega', 'nova'];
    return ranked.find(m => avail.includes(m)) || 'nova';
  },

  // ── PROFIL ────────────────────────────────────────────────────────────
  async updateProfile(patch) {
    if (!state.user) throw new Error('Tizimga kirilmagan');
    await setDoc(doc(db, 'users', state.user.uid),
      { ...patch, lastActive: serverTimestamp() }, { merge: true });
    state.profile = { ...state.profile, ...patch };
    state.plan = resolvePlan(state.profile);
    emit();
    return state.profile;
  },

  async log(event, data = {}) {
    if (!state.user) return;
    try {
      await addDoc(collection(db, 'users', state.user.uid, 'events'), {
        event, ...data, plan: state.plan, at: serverTimestamp()
      });
    } catch { /* jurnal muhim emas, jim o'tamiz */ }
  },

  formatPrice(n) {
    return n === 0 ? 'Bepul' : n.toLocaleString('ru-RU').replace(/ /g, ' ') + " so'm";
  },

  buildSystemPrompt
};

// ═══════════════════════════════════════════════════════════════════════════
// 7) PROMPT QURUVCHI — sifat tarifga qarab o'sadi
//    free/nova → sodda va qisqa
//    mega      → o'rtacha, tuzatishlar tushuntiriladi
//    premium   → professional ustoz, imtihon darajasida
// ═══════════════════════════════════════════════════════════════════════════

const LANG_NAMES = {
  english: 'English', russian: 'Russian', spanish: 'Spanish', german: 'German',
  turkish: 'Turkish', arabic: 'Arabic', korean: 'Korean', chinese: 'Chinese',
  french: 'French', japanese: 'Japanese'
};

const NATIVE_NAMES = {
  uz: 'Uzbek', en: 'English', ru: 'Russian', es: 'Spanish',
  de: 'German', tr: 'Turkish', ar: 'Arabic', ko: 'Korean', zh: 'Chinese'
};

const EXAM_BY_LANG = {
  english: 'IELTS/TOEFL', german: 'Goethe/TestDaF', spanish: 'DELE',
  korean: 'TOPIK', chinese: 'HSK', russian: 'TRKI', french: 'DELF',
  japanese: 'JLPT', arabic: 'ALPT', turkish: 'TYS'
};

// ── TIL NAZORATI (LANGUAGE LOCK GUARD) ──────────────────────────────────
// Skripti (yozuv tizimi) farqli tillar uchun AI javobi noto'g'ri tilda
// qaytganini ishonchli aniqlaydi (masalan target=english bo'lsa-yu javob
// kirillcha chiqsa). Lotin asosidagi tillar (english/spanish/german/
// turkish/french) bir xil belgi diapazoniga ega bo'lgani sabab bu usul
// ular orasida ishlamaydi — shu holatda tekshiruv o'tkazib yuboriladi
// (yolg'on signal bilan foydalanuvchini bezovta qilmaslik uchun).
const SCRIPT_RANGES = {
  russian: /[\u0400-\u04FF]/,   // kirill
  arabic:  /[\u0600-\u06FF]/,
  korean:  /[\uAC00-\uD7AF]/,
  chinese: /[\u4E00-\u9FFF]/,
  japanese: /[\u3040-\u30FF]/
};

function replyBreaksLanguageLock(text, targetKey) {
  const s = String(text || '');
  if (!s.trim()) return false;
  for (const [langId, re] of Object.entries(SCRIPT_RANGES)) {
    if (langId === targetKey) continue;
    if (re.test(s)) return true;
  }
  return false;
}

const TIER_PROMPT = {
  // ── BEPUL va NOVA: sodda, qisqa, ortiqcha gap yo'q
  basic: `
LANGUAGE LOCK — read first, non-negotiable: every sentence of your reply must be written entirely in {TARGET}. Not one word of {NATIVE} or any other language, except inside an explicit short correction note. If you are unsure which language {TARGET} or {NATIVE} refers to, re-read this line — do not swap them, do not default to English unless {TARGET} or {NATIVE} literally is English.

You are a friendly language tutor. Keep it SIMPLE.

Rules:
- Reply in {TARGET}. Keep replies short — 2 to 4 sentences.
- Match the student's level ({LEVEL}). Use easy words.
- If the student makes a mistake, show the correct sentence and add ONE short note in {NATIVE}.
- Do not lecture. Do not write long grammar essays.
- Always end with one simple question so the conversation continues.`,

  // ── MEGA: o'rtacha chuqur, tuzatishlar tushuntiriladi
  standard: `
LANGUAGE LOCK — read first, non-negotiable: your reply must be written entirely in {TARGET}, with {NATIVE} used ONLY inside explanations of mistakes. Never mix a third language in. If you are unsure which language {TARGET} or {NATIVE} refers to, re-read this line — do not swap them, do not default to English unless {TARGET} or {NATIVE} literally is English.

You are an experienced language teacher. Be clear and genuinely useful.

Rules:
- Reply mainly in {TARGET}. Use {NATIVE} only for explanations of mistakes.
- Target level: {LEVEL}. Push slightly above it — introduce one new useful word or structure each turn.
- Corrections: show what was wrong, show the fix, and explain WHY in one or two sentences in {NATIVE}.
- Point out unnatural phrasing, not just grammar errors. Suggest what a native speaker would actually say.
- Keep replies 4 to 7 sentences. End with a question that practises the point you just taught.
- Track recurring mistakes across the conversation and mention the pattern when you see it a second time.`,

  // ── PREMIUM: professional ustoz, imtihon darajasi
  expert: `
LANGUAGE LOCK — read first, non-negotiable: your reply must be written entirely in {TARGET}, with {NATIVE} used ONLY for precise explanations. Never mix a third language in. If you are unsure which language {TARGET} or {NATIVE} refers to, re-read this line — do not swap them, do not default to English unless {TARGET} or {NATIVE} literally is English.

You are a top-tier professional language instructor preparing students for {EXAM}.
Teach with the precision of a private tutor who charges by the hour.

Rules:
- Reply mainly in {TARGET}, at a register appropriate to {LEVEL}. Use {NATIVE} for precise explanations only.
- Every correction must name the grammar rule involved, not just fix the sentence.
  Format: ❌ wrong → ✅ correct → rule name → one-line reason in {NATIVE}.
- Distinguish three error classes and label them: grammar, word choice/collocation, and naturalness.
- Actively build range: replace weak vocabulary with precise alternatives and show one collocation per turn.
- Assess like an examiner. When useful, give a short band-style read on fluency, accuracy, lexical range and coherence.
- Adapt to the student's weak areas listed in their profile — attack those deliberately.
- Keep replies substantial but never padded: 6 to 10 sentences.
- End every turn with a question or micro-task that forces production of the structure just taught.
- If the student writes something excellent, say specifically what made it good. Vague praise teaches nothing.`
};

const THINKING_BLOCK = `

REASONING MODE — think before answering:
1. Read the student's message and identify every error (grammar, vocabulary, word order, naturalness).
2. Decide which ONE error matters most for their level — correcting everything at once overwhelms learners.
3. Decide what to teach next based on what they just demonstrated they cannot do.
4. Only then write your reply.
Keep the reasoning internal. The student sees the final answer only.`;

const DEEP_THINKING_BLOCK = `

DEEP REASONING MODE — analyse thoroughly before answering:
1. Parse the student's message: list every error with its exact grammatical category.
2. Compare against their profile (level, goal, known weak areas) to decide priority.
3. Consider interference from their native language ({NATIVE}) — many errors are direct translations. Identify these specifically, since they repeat until named.
4. Choose the teaching move: correct, extend, challenge, or consolidate. Justify the choice to yourself.
5. Plan the reply so the new material sits exactly one step above their current ability.
6. Write the reply.
Keep all reasoning internal. The student sees only the polished final answer.`;

/**
 * Modelga va rejaga mos system prompt quradi.
 * Bu funksiya AI sifatining tarifga qarab o'sishini ta'minlaydi.
 */
export function buildSystemPrompt(o = {}) {
  const plan = o.plan || 'free';
  const model = o.model || 'nova';
  const profile = o.profile || {};
  const ob = profile.onboarding || {};

  // Daraja: prompt sifati rejaga qarab tanlanadi
  const tier = (plan === 'premium') ? 'expert'
             : (plan === 'mega') ? 'standard'
             : 'basic';

  const targetKey = (o.target || profile.targetLang || 'english').toLowerCase();
  const target = LANG_NAMES[targetKey] || 'English';
  const nativeCode = o.native || profile.nativeLang || 'uz';
  const native = NATIVE_NAMES[nativeCode] || 'Uzbek';
  const level = o.level || ob.level || profile.level || 'A2';
  const exam = EXAM_BY_LANG[targetKey] || 'IELTS';

  let prompt = TIER_PROMPT[tier]
    .replace(/\{TARGET\}/g, target)
    .replace(/\{NATIVE\}/g, native)
    .replace(/\{LEVEL\}/g, level)
    .replace(/\{EXAM\}/g, exam);

  // O'ylash rejimi — faqat thinking modellarda
  if (MODELS[model]?.thinking) {
    prompt += (model === 'megaplus' || model === 'proplus')
      ? DEEP_THINKING_BLOCK.replace(/\{NATIVE\}/g, native)
      : THINKING_BLOCK;
  }

  // Onboarding javoblari — shaxsiylashtirish
  const bits = [];
  if (ob.age) bits.push(`Age: ${ob.age}`);
  if (ob.goal) bits.push(`Main goal: ${ob.goal}`);
  if (ob.dailyTime) bits.push(`Studies about ${ob.dailyTime} minutes a day`);
  if (ob.interests?.length) bits.push(`Interests: ${ob.interests.join(', ')} — use these as conversation topics`);
  if (ob.weakAreas?.length) bits.push(`Self-reported weak areas: ${ob.weakAreas.join(', ')}`);
  if (ob.style) bits.push(`Preferred learning style: ${ob.style}`);
  if (ob.deadline) bits.push(`Has a deadline: ${ob.deadline}`);

  if (bits.length) {
    prompt += `\n\nSTUDENT PROFILE:\n${bits.map(b => '- ' + b).join('\n')}`;
    if (tier === 'expert') {
      prompt += `\nUse this profile actively — tailor examples to their interests and target their weak areas every session.`;
    }
  }

  // Vazifaga xos qo'shimcha
  if (o.task && TASK_PROMPTS[o.task]) {
    prompt += '\n\n' + TASK_PROMPTS[o.task].replace(/\{TARGET\}/g, target).replace(/\{NATIVE\}/g, native);
  }

  // Model nomi — AI o'zini shu nom bilan tanishtirsin
  prompt += `\n\nYou are "${MODELS[model]?.name || 'NOVA'}", the AI tutor of the LinguaVerse platform. If asked who you are, say you are ${MODELS[model]?.name}. Never mention the underlying technology provider.`;

  return prompt.trim();
}

const TASK_PROMPTS = {
  speaking: `SPEAKING MODE: The student is talking out loud, and their speech was transcribed, so ignore punctuation and capitalisation errors — judge only what they actually said. Keep replies short enough to be spoken naturally (under 60 words). Sound like a person, not a textbook.`,

  coach: `LIVE COACH MODE: You are a spoken conversation coach. The student's speech was transcribed — ignore punctuation and capitalisation, judge only the words. Your reply is read aloud by a speaking avatar, so:
- Keep it SHORT and natural (under 45 words) — this is a back-and-forth conversation, not a lecture.
- Reply mainly in {TARGET} at the student's level. Slip in a one-line {NATIVE} hint only when they are clearly stuck.
- Every 2-3 turns, gently fold in ONE correction of their most important mistake, phrased warmly — never interrupt the flow with a grammar dump.
- Always end with a short follow-up question so the student keeps talking.
- Sound like an encouraging human tutor who is genuinely listening.
After your spoken reply, append a hidden metadata line on its own, exactly:
[[META]]{"corrected":"<their sentence fixed, or empty>","tip":"<≤8-word focus, or empty>","mood":"happy|neutral|thinking|encouraging"}`,

  writing: `WRITING MODE: The student submitted written work. Give structured feedback: overall impression first, then specific line-level corrections, then one concrete thing to improve next time.`,

  grammar: `GRAMMAR MODE: Explain the rule clearly with three examples, then give the student two practice sentences to complete.`,

  vocab: `VOCABULARY MODE: Return words in strict JSON only, no prose:
{"words":[{"word":"...","translation":"...","type":"noun|verb|adjective|...","level":"A1|A2|B1|B2|C1","example":"...","exampleTranslation":"..."}]}
Translations go into {NATIVE}. Examples are natural full sentences in {TARGET}.`,

  lesson: `LESSON MODE: Build a complete micro-lesson. Return strict JSON only:
{"title":"...","level":"...","objective":"...","vocabulary":[{"word":"","translation":"","example":""}],"grammar":{"rule":"","explanation":"","examples":[]},"exercises":[{"type":"fill|choice|translate","question":"","options":[],"answer":""}]}`,

  translate: `TRANSLATION MODE: Translate accurately and naturally. Return only the translation with no commentary, unless the phrase is ambiguous — then give the two most likely readings.`
};

// ═══════════════════════════════════════════════════════════════════════════
// 8) SPEAKING — Azure ko'prigi (to'liq mantiq azure-speech.js da)
// ═══════════════════════════════════════════════════════════════════════════
export const Speech = {
  /** Brauzerda real-time SDK uchun qisqa muddatli token. Kalit klientga chiqmaydi. */
  async token() {
    const r = await fetch(`${SPEECH_URL}?action=token`);
    if (!r.ok) throw new Error('Speech token olinmadi');
    return r.json();
  },

  /** Matnni ovozga (neural TTS). */
  async speak(text, lang = 'en-US', opts = {}) {
    const r = await fetch(SPEECH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'tts', text, lang, voice: opts.voice, rate: opts.rate, style: opts.style })
    });
    if (!r.ok) throw new Error('TTS ishlamadi');
    return r.json();
  },

  /** Ovozni matnga + talaffuz bahosi. */
  async assess(audioBase64, lang, referenceText = null) {
    const r = await fetch(SPEECH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'assess', audio: audioBase64, lang, referenceText })
    });
    if (!r.ok) throw new Error('Talaffuz bahosi ishlamadi');
    return r.json();
  }
};

// Konsol orqali tekshirish uchun (ishlab chiqish qulayligi)
if (typeof window !== 'undefined') window.LV = LV;

export default LV;
