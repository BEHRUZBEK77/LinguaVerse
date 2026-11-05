// ═══════════════════════════════════════════════════════════════════════════
// lv-i18n.js — lv-core.js MA'LUMOTLARINING TARJIMASI
//
// lv-core.js raqamlar va mantiqni saqlaydi (narx, limit, model qaysi rejada).
// Bu fayl esa o'sha narsalarning KO'RINADIGAN matnini 6 tilda beradi.
//
// Nega alohida fayl: lv-core.js har bir sahifada yuklanadi va u yerda mantiq
// bo'lishi kerak. Tarjimalar hajmli, lekin faqat ko'rsatish uchun kerak.
//
// Ishlatish:
//   import { planText, modelText, resourceText } from './js/lv-i18n.js';
//   const p = planText('nova', 'ru');   // { name, tagline, perks:[...] }
// ═══════════════════════════════════════════════════════════════════════════

import { PLANS, MODELS, RESOURCES } from './lv-core.js';

export const SUPPORTED = ['uz', 'ru', 'en', 'tr', 'de', 'ar'];

// ───────────────────────────────────────────────────────────────────────────
// REJALAR
// NOVA / MEGA / PREMIUM — brend nomlari, tarjima qilinmaydi.
// Faqat "Bepul" va tavsiflar tarjima qilinadi.
// ───────────────────────────────────────────────────────────────────────────
const PLAN_TEXT = {
  free: {
    uz: {
      name: 'Bepul', tagline: 'Boshlash uchun yetarli',
      perks: ['NOVA AI — kuniga 40 ta savol', 'Speaking 15 daqiqa/kun',
              'Kuniga 4 ta AI dars', 'Barcha 8 til ochiq', 'Coin va XP tizimi']
    },
    ru: {
      name: 'Бесплатно', tagline: 'Достаточно, чтобы начать',
      perks: ['NOVA AI — 40 вопросов в день', 'Речь 15 минут в день',
              '4 AI-урока в день', 'Все 8 языков открыты', 'Система монет и XP']
    },
    en: {
      name: 'Free', tagline: 'Enough to get started',
      perks: ['NOVA AI — 40 questions a day', 'Speaking 15 min/day',
              '4 AI lessons a day', 'All 8 languages unlocked', 'Coins and XP system']
    },
    tr: {
      name: 'Ücretsiz', tagline: 'Başlamak için yeterli',
      perks: ['NOVA AI — günde 40 soru', 'Konuşma 15 dakika/gün',
              'Günde 4 AI dersi', '8 dilin tamamı açık', 'Coin ve XP sistemi']
    },
    de: {
      name: 'Kostenlos', tagline: 'Genug für den Anfang',
      perks: ['NOVA AI — 40 Fragen pro Tag', 'Sprechen 15 Min/Tag',
              '4 KI-Lektionen pro Tag', 'Alle 8 Sprachen frei', 'Coins und XP']
    },
    ar: {
      name: 'مجاني', tagline: 'كافٍ للبدء',
      perks: ['NOVA AI — 40 سؤالًا يوميًا', 'محادثة 15 دقيقة يوميًا',
              '4 دروس ذكية يوميًا', 'جميع اللغات الثماني متاحة', 'نظام العملات و XP']
    }
  },

  nova: {
    uz: {
      name: 'NOVA', tagline: "Kundalik jiddiy o'rganish",
      perks: ['NOVA AI — kuniga 200 ta savol', "PRO AI (o'ylash rejimi) — kuniga 50 ta",
              'Speaking 40 daqiqa/kun + talaffuz bahosi', 'Kuniga 12 ta AI dars', "Reklama yo'q"]
    },
    ru: {
      name: 'NOVA', tagline: 'Серьёзная ежедневная учёба',
      perks: ['NOVA AI — 200 вопросов в день', 'PRO AI (режим размышления) — 50 в день',
              'Речь 40 мин/день + оценка произношения', '12 AI-уроков в день', 'Без рекламы']
    },
    en: {
      name: 'NOVA', tagline: 'Serious daily study',
      perks: ['NOVA AI — 200 questions a day', 'PRO AI (thinking mode) — 50 a day',
              'Speaking 40 min/day + pronunciation scoring', '12 AI lessons a day', 'No ads']
    },
    tr: {
      name: 'NOVA', tagline: 'Ciddi günlük çalışma',
      perks: ['NOVA AI — günde 200 soru', 'PRO AI (düşünme modu) — günde 50',
              'Konuşma 40 dk/gün + telaffuz puanı', 'Günde 12 AI dersi', 'Reklamsız']
    },
    de: {
      name: 'NOVA', tagline: 'Ernsthaftes tägliches Lernen',
      perks: ['NOVA AI — 200 Fragen pro Tag', 'PRO AI (Denkmodus) — 50 pro Tag',
              'Sprechen 40 Min/Tag + Aussprachebewertung', '12 KI-Lektionen pro Tag', 'Keine Werbung']
    },
    ar: {
      name: 'NOVA', tagline: 'دراسة يومية جادة',
      perks: ['NOVA AI — 200 سؤال يوميًا', 'PRO AI (وضع التفكير) — 50 يوميًا',
              'محادثة 40 دقيقة/يوم + تقييم النطق', '12 درسًا ذكيًا يوميًا', 'بدون إعلانات']
    }
  },

  mega: {
    uz: {
      name: 'MEGA', tagline: 'Tezroq natija, kuchliroq AI', badge: 'Eng mashhur',
      perks: ['MEGA AI — kuniga 150 ta savol', "PRO+ chuqur o'ylash — kuniga 60 ta",
              'NOVA va PRO limitlari 2x oshgan', 'Speaking 80 daqiqa/kun',
              'Kuniga 30 ta AI dars', "Shaxsiy o'quv rejasi"]
    },
    ru: {
      name: 'MEGA', tagline: 'Быстрее результат, мощнее ИИ', badge: 'Популярный',
      perks: ['MEGA AI — 150 вопросов в день', 'PRO+ глубокое размышление — 60 в день',
              'Лимиты NOVA и PRO удвоены', 'Речь 80 мин/день',
              '30 AI-уроков в день', 'Персональный учебный план']
    },
    en: {
      name: 'MEGA', tagline: 'Faster results, stronger AI', badge: 'Most popular',
      perks: ['MEGA AI — 150 questions a day', 'PRO+ deep thinking — 60 a day',
              'NOVA and PRO limits doubled', 'Speaking 80 min/day',
              '30 AI lessons a day', 'Personal study plan']
    },
    tr: {
      name: 'MEGA', tagline: 'Daha hızlı sonuç, güçlü AI', badge: 'En popüler',
      perks: ['MEGA AI — günde 150 soru', 'PRO+ derin düşünme — günde 60',
              'NOVA ve PRO limitleri 2 katı', 'Konuşma 80 dk/gün',
              'Günde 30 AI dersi', 'Kişisel çalışma planı']
    },
    de: {
      name: 'MEGA', tagline: 'Schneller Ergebnisse, stärkere KI', badge: 'Am beliebtesten',
      perks: ['MEGA AI — 150 Fragen pro Tag', 'PRO+ tiefes Denken — 60 pro Tag',
              'NOVA- und PRO-Limits verdoppelt', 'Sprechen 80 Min/Tag',
              '30 KI-Lektionen pro Tag', 'Persönlicher Lernplan']
    },
    ar: {
      name: 'MEGA', tagline: 'نتائج أسرع، ذكاء أقوى', badge: 'الأكثر شيوعًا',
      perks: ['MEGA AI — 150 سؤالًا يوميًا', 'PRO+ تفكير عميق — 60 يوميًا',
              'حدود NOVA و PRO مضاعفة', 'محادثة 80 دقيقة/يوم',
              '30 درسًا ذكيًا يوميًا', 'خطة دراسية شخصية']
    }
  },

  premium: {
    uz: {
      name: 'PREMIUM', tagline: "Professional til o'rgatish ustozi",
      perks: ['PREMIUM AI — kuniga 220 ta savol', "MEGA+ eng chuqur o'ylash — kuniga 90 ta",
              'Barcha quyi modellar maksimal limitda', 'Speaking 150 daqiqa/kun',
              'Kuniga 60 ta AI dars', 'Imtihonga tayyorlov (IELTS/Goethe/TOPIK)',
              "Ustuvor qo'llab-quvvatlash"]
    },
    ru: {
      name: 'PREMIUM', tagline: 'Профессиональный преподаватель',
      perks: ['PREMIUM AI — 220 вопросов в день', 'MEGA+ глубочайшее размышление — 90 в день',
              'Все младшие модели на максимуме', 'Речь 150 мин/день',
              '60 AI-уроков в день', 'Подготовка к экзаменам (IELTS/Goethe/TOPIK)',
              'Приоритетная поддержка']
    },
    en: {
      name: 'PREMIUM', tagline: 'Professional language instructor',
      perks: ['PREMIUM AI — 220 questions a day', 'MEGA+ deepest thinking — 90 a day',
              'All lower models at maximum limits', 'Speaking 150 min/day',
              '60 AI lessons a day', 'Exam preparation (IELTS/Goethe/TOPIK)',
              'Priority support']
    },
    tr: {
      name: 'PREMIUM', tagline: 'Profesyonel dil öğretmeni',
      perks: ['PREMIUM AI — günde 220 soru', 'MEGA+ en derin düşünme — günde 90',
              'Tüm alt modeller maksimum limitte', 'Konuşma 150 dk/gün',
              'Günde 60 AI dersi', 'Sınav hazırlığı (IELTS/Goethe/TOPIK)',
              'Öncelikli destek']
    },
    de: {
      name: 'PREMIUM', tagline: 'Professioneller Sprachlehrer',
      perks: ['PREMIUM AI — 220 Fragen pro Tag', 'MEGA+ tiefstes Denken — 90 pro Tag',
              'Alle unteren Modelle auf Maximum', 'Sprechen 150 Min/Tag',
              '60 KI-Lektionen pro Tag', 'Prüfungsvorbereitung (IELTS/Goethe/TOPIK)',
              'Vorrangiger Support']
    },
    ar: {
      name: 'PREMIUM', tagline: 'مدرّس لغة محترف',
      perks: ['PREMIUM AI — 220 سؤالًا يوميًا', 'MEGA+ أعمق تفكير — 90 يوميًا',
              'جميع النماذج الأدنى بأقصى حد', 'محادثة 150 دقيقة/يوم',
              '60 درسًا ذكيًا يوميًا', 'التحضير للامتحانات (IELTS/Goethe/TOPIK)',
              'دعم ذو أولوية']
    }
  }
};

// ───────────────────────────────────────────────────────────────────────────
// MODELLAR — nomlar brend, faqat izoh tarjima qilinadi
// ───────────────────────────────────────────────────────────────────────────
const MODEL_TEXT = {
  nova: {
    uz: 'Tez javob beradi. Kundalik savollar, tarjima, oddiy mashqlar uchun.',
    ru: 'Отвечает быстро. Для повседневных вопросов, перевода и простых упражнений.',
    en: 'Answers fast. For everyday questions, translation and simple exercises.',
    tr: 'Hızlı yanıt verir. Günlük sorular, çeviri ve basit alıştırmalar için.',
    de: 'Antwortet schnell. Für Alltagsfragen, Übersetzung und einfache Übungen.',
    ar: 'يجيب بسرعة. للأسئلة اليومية والترجمة والتمارين البسيطة.'
  },
  pro: {
    uz: "Javob berishdan oldin o'ylaydi. Grammatika tahlili va xato tushuntirish uchun.",
    ru: 'Размышляет перед ответом. Для разбора грамматики и объяснения ошибок.',
    en: 'Thinks before answering. For grammar analysis and explaining mistakes.',
    tr: 'Cevaptan önce düşünür. Dilbilgisi analizi ve hata açıklaması için.',
    de: 'Denkt vor der Antwort. Für Grammatikanalyse und Fehlererklärung.',
    ar: 'يفكّر قبل الإجابة. لتحليل القواعد وشرح الأخطاء.'
  },
  mega: {
    uz: "NOVA'dan sezilarli kuchliroq. Tabiiy suhbat va batafsil tushuntirish.",
    ru: 'Заметно мощнее NOVA. Естественный разговор и подробные объяснения.',
    en: 'Noticeably stronger than NOVA. Natural conversation and detailed explanations.',
    tr: "NOVA'dan belirgin şekilde güçlü. Doğal sohbet ve ayrıntılı açıklama.",
    de: 'Deutlich stärker als NOVA. Natürliches Gespräch und ausführliche Erklärungen.',
    ar: 'أقوى بوضوح من NOVA. محادثة طبيعية وشرح مفصّل.'
  },
  proplus: {
    uz: "Chuqur o'ylash rejimi. Murakkab grammatika, insho tahlili, imtihon savollari.",
    ru: 'Режим глубокого размышления. Сложная грамматика, разбор эссе, экзаменационные задания.',
    en: 'Deep thinking mode. Complex grammar, essay analysis, exam questions.',
    tr: 'Derin düşünme modu. Karmaşık dilbilgisi, kompozisyon analizi, sınav soruları.',
    de: 'Tiefer Denkmodus. Komplexe Grammatik, Aufsatzanalyse, Prüfungsfragen.',
    ar: 'وضع التفكير العميق. قواعد معقّدة، تحليل المقالات، أسئلة الامتحانات.'
  },
  premium: {
    uz: 'Eng kuchli tezkor model. Professional ustoz darajasidagi javoblar.',
    ru: 'Самая мощная быстрая модель. Ответы на уровне профессионального преподавателя.',
    en: 'The most powerful fast model. Answers at professional instructor level.',
    tr: 'En güçlü hızlı model. Profesyonel öğretmen seviyesinde yanıtlar.',
    de: 'Das stärkste schnelle Modell. Antworten auf Niveau eines Profi-Lehrers.',
    ar: 'أقوى نموذج سريع. إجابات بمستوى مدرّس محترف.'
  },
  megaplus: {
    uz: "Platformadagi eng zo'ri. To'liq tahlil, o'quv rejasi, imtihonga tayyorlov.",
    ru: 'Лучшее на платформе. Полный разбор, учебный план, подготовка к экзаменам.',
    en: 'The best on the platform. Full analysis, study plan, exam preparation.',
    tr: 'Platformdaki en iyisi. Tam analiz, çalışma planı, sınav hazırlığı.',
    de: 'Das Beste auf der Plattform. Vollanalyse, Lernplan, Prüfungsvorbereitung.',
    ar: 'الأفضل في المنصة. تحليل كامل، خطة دراسية، تحضير للامتحانات.'
  }
};

// ───────────────────────────────────────────────────────────────────────────
// RESURSLAR
// ───────────────────────────────────────────────────────────────────────────
const RESOURCE_TEXT = {
  nova:      { uz: 'NOVA savollari', ru: 'Вопросы NOVA', en: 'NOVA questions', tr: 'NOVA soruları', de: 'NOVA-Fragen', ar: 'أسئلة NOVA' },
  pro:       { uz: 'PRO savollari', ru: 'Вопросы PRO', en: 'PRO questions', tr: 'PRO soruları', de: 'PRO-Fragen', ar: 'أسئلة PRO' },
  mega:      { uz: 'MEGA savollari', ru: 'Вопросы MEGA', en: 'MEGA questions', tr: 'MEGA soruları', de: 'MEGA-Fragen', ar: 'أسئلة MEGA' },
  proplus:   { uz: 'PRO+ savollari', ru: 'Вопросы PRO+', en: 'PRO+ questions', tr: 'PRO+ soruları', de: 'PRO+-Fragen', ar: 'أسئلة PRO+' },
  premium:   { uz: 'PREMIUM savollari', ru: 'Вопросы PREMIUM', en: 'PREMIUM questions', tr: 'PREMIUM soruları', de: 'PREMIUM-Fragen', ar: 'أسئلة PREMIUM' },
  megaplus:  { uz: 'MEGA+ savollari', ru: 'Вопросы MEGA+', en: 'MEGA+ questions', tr: 'MEGA+ soruları', de: 'MEGA+-Fragen', ar: 'أسئلة MEGA+' },
  speak_min: { uz: 'Speaking', ru: 'Речь', en: 'Speaking', tr: 'Konuşma', de: 'Sprechen', ar: 'المحادثة' },
  lesson:    { uz: 'AI darslar', ru: 'AI-уроки', en: 'AI lessons', tr: 'AI dersleri', de: 'KI-Lektionen', ar: 'دروس ذكية' },
  coach:     { uz: 'AI Coach seanslari', ru: 'Сессии AI Coach', en: 'AI Coach sessions', tr: 'AI Coach seansları', de: 'KI-Coach-Sitzungen', ar: 'جلسات المدرّب' },
  vocab_ai:  { uz: "AI lug'at qo'shish", ru: 'Пополнение словаря ИИ', en: 'AI vocabulary adds', tr: 'AI sözlük ekleme', de: 'KI-Wortschatz', ar: 'إضافات القاموس' },
  translate: { uz: 'Tez tarjima', ru: 'Быстрый перевод', en: 'Quick translation', tr: 'Hızlı çeviri', de: 'Schnellübersetzung', ar: 'ترجمة سريعة' }
};

const UNIT_TEXT = {
  ta:     { uz: 'ta', ru: 'шт', en: '', tr: 'adet', de: '', ar: '' },
  daqiqa: { uz: 'daqiqa', ru: 'мин', en: 'min', tr: 'dk', de: 'Min', ar: 'دقيقة' },
  marta:  { uz: 'marta', ru: 'раз', en: 'times', tr: 'kez', de: 'Mal', ar: 'مرات' }
};

// ───────────────────────────────────────────────────────────────────────────
// OCHIQ FUNKSIYALAR — til topilmasa o'zbekchaga qaytadi
// ───────────────────────────────────────────────────────────────────────────
function pick(table, key, lang) {
  const row = table[key];
  if (!row) return null;
  return row[lang] ?? row.uz ?? null;
}

/** Reja matni: { id, name, tagline, perks, badge, icon, fa, color, price } */
export function planText(planId, lang = 'uz') {
  const base = PLANS[planId];
  if (!base) return null;
  const t = PLAN_TEXT[planId]?.[lang] || PLAN_TEXT[planId]?.uz || {};
  return {
    ...base,
    name: t.name ?? base.name,
    tagline: t.tagline ?? base.tagline,
    perks: t.perks ?? base.perks,
    badge: 'badge' in t ? t.badge : base.badge
  };
}

/** Model matni: { id, name, desc, icon, fa, color, thinking, minPlan } */
export function modelText(modelId, lang = 'uz') {
  const base = MODELS[modelId];
  if (!base) return null;
  return { ...base, desc: pick(MODEL_TEXT, modelId, lang) ?? base.desc };
}

/** Resurs matni: { label, unit, icon, fa } */
export function resourceText(resId, lang = 'uz') {
  const base = RESOURCES[resId];
  if (!base) return null;
  return {
    ...base,
    label: pick(RESOURCE_TEXT, resId, lang) ?? base.label,
    unit: pick(UNIT_TEXT, base.unit, lang) ?? base.unit
  };
}

export function allPlans(lang = 'uz') {
  return Object.keys(PLANS)
    .sort((a, b) => PLANS[a].order - PLANS[b].order)
    .map(id => planText(id, lang));
}

export function allModels(lang = 'uz') {
  return Object.keys(MODELS).map(id => modelText(id, lang));
}

export function allResources(lang = 'uz') {
  return Object.keys(RESOURCES).map(id => ({ id, ...resourceText(id, lang) }));
}

/** Joriy tilni localStorage dan oladi. */
export function currentLang() {
  const l = localStorage.getItem('lv_lang');
  return SUPPORTED.includes(l) ? l : 'uz';
}

/** Narxni tilga mos formatlaydi. */
export function formatPrice(amount, lang = 'uz') {
  const sep = amount.toLocaleString('ru-RU').replace(/ /g, ' ');
  const cur = { uz: "so'm", ru: 'сум' }[lang] || 'UZS';
  return `${sep} ${cur}`;
}

export default {
  planText, modelText, resourceText, allPlans, allModels, allResources,
  currentLang, formatPrice, SUPPORTED
};
