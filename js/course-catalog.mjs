// ═══════════════════════════════════════════════════════════════════════════
// course-catalog.mjs — VIDEO KURSLAR katalogi (brauzer + server uchun umumiy)
//
// Har bir til uchun 150 ta video dars — har CEFR darajasida 25 ta:
//   B2 kursi (200 000 so'm): A1 → A2 → B1 → B2  = 100 dars
//   C2 kursi (400 000 so'm): C1 → C2            =  50 dars  (+ B2 kursi ichida → jami 150)
//
// Narxlar netlify/functions/_plans.js dagi COURSE_LEVELS bilan BIR XIL bo'lishi
// shart — server o'z manbasidan undiradi. Tekshirish:
//   node scripts/check-plan-sync.js
//
// Har bir dars "AI video dars": AI ustoz ssenariy yozadi (slaydlar + nutq),
// video fabrika (scripts/render-lesson-video.mjs) uni MP4 ga montaj qiladi.
// MP4 hali tayyor bo'lmagan dars saytda jonli pleyerda ochiladi.
// Mavzular tilga bog'liq emas — AI har bir tilning o'z grammatikasiga
// moslab o'rgatadi (masalan rus tilida kelishiklar, koreyschada hurmat shakllari).
// ═══════════════════════════════════════════════════════════════════════════

export const CATALOG_VERSION = 3;   // dars ro'yxati o'zgarsa oshiriladi (eski kesh aralashmasin)

export const COURSE_PRICES = { b2: 200000, c2: 400000 };

export const COURSE_LANGS = [
  { id: 'english', name: 'Ingliz tili', native: 'English', flag: '🇬🇧', locale: 'en-GB', exam: 'IELTS' },
  { id: 'russian', name: 'Rus tili', native: 'Русский', flag: '🇷🇺', locale: 'ru-RU', exam: 'TORFL (ТРКИ)' },
  { id: 'spanish', name: 'Ispan tili', native: 'Español', flag: '🇪🇸', locale: 'es-ES', exam: 'DELE' },
  { id: 'german', name: 'Nemis tili', native: 'Deutsch', flag: '🇩🇪', locale: 'de-DE', exam: 'Goethe-Zertifikat' },
  { id: 'turkish', name: 'Turk tili', native: 'Türkçe', flag: '🇹🇷', locale: 'tr-TR', exam: 'YÖS / TÖMER' },
  { id: 'arabic', name: 'Arab tili', native: 'العربية', flag: '🇸🇦', locale: 'ar-SA', exam: 'ALPT' },
  { id: 'korean', name: 'Koreys tili', native: '한국어', flag: '🇰🇷', locale: 'ko-KR', exam: 'TOPIK' },
  { id: 'chinese', name: 'Xitoy tili', native: '中文', flag: '🇨🇳', locale: 'zh-CN', exam: 'HSK' }
];

// ── 25 tadan mavzu har bir CEFR darajasi uchun ──
// [mavzu, ko'nikma]
const CEFR_TOPICS = {
  A1: [
    ['Alifbo, tovushlar va talaffuz asoslari', 'Talaffuz'],
    ['Salomlashish, tanishish va xayrlashish', 'Speaking'],
    ['Raqamlar 1–100, yosh va telefon raqami', 'Lug\'at'],
    ['O\'zim, oilam va qarindoshlar', 'Lug\'at'],
    ['"Bo\'lmoq" fe\'li va eng oddiy gaplar', 'Grammatika'],
    ['Kasblar va ish joylari', 'Lug\'at'],
    ['Soat, kun tartibi va vaqt', 'Lug\'at'],
    ['Hozirgi zamon: odatlar va kundalik ishlar', 'Grammatika'],
    ['Ovqat, ichimlik va kafeda buyurtma berish', 'Speaking'],
    ['Uy, xonalar va jihozlar', 'Lug\'at'],
    ['Shaharda yo\'l so\'rash va tushuntirish', 'Speaking'],
    ['Ranglar, kiyim va do\'konda xarid', 'Lug\'at'],
    ['So\'roq gaplar tuzish', 'Grammatika'],
    ['Inkor gaplar', 'Grammatika'],
    ['Hafta kunlari, oylar va sanalar', 'Lug\'at'],
    ['Ob-havo va fasllar', 'Lug\'at'],
    ['Sevimli mashg\'ulotlar va bo\'sh vaqt', 'Speaking'],
    ['Qila olaman / qila olmayman', 'Grammatika'],
    ['Sifatlar: odam va narsalarni tasvirlash', 'Lug\'at'],
    ['Ko\'plik va sanoq', 'Grammatika'],
    ['Kishilik va egalik olmoshlari', 'Grammatika'],
    ['Joy predloglari: qayerda?', 'Grammatika'],
    ['Transport va chipta olish', 'Speaking'],
    ['Oddiy matnni o\'qish va tinglash', 'Listening'],
    ['A1 yakuniy imtihon', 'Imtihon']
  ],
  A2: [
    ['O\'tgan zamon: muntazam fe\'llar', 'Grammatika'],
    ['O\'tgan zamon: noto\'g\'ri fe\'llar', 'Grammatika'],
    ['O\'tgan dam olish haqida hikoya qilish', 'Speaking'],
    ['Kelajak rejalari va niyatlar', 'Grammatika'],
    ['Qiyosiy daraja: kattaroq, yaxshiroq', 'Grammatika'],
    ['Orttirma daraja: eng yaxshi', 'Grammatika'],
    ['Sog\'liq: shifokorda va dorixonada', 'Speaking'],
    ['Mehmonxona va sayohatda', 'Speaking'],
    ['Ish va o\'qish hayoti', 'Lug\'at'],
    ['Hozir davom etayotgan harakat', 'Grammatika'],
    ['Taklif qilish, rozi bo\'lish va rad etish', 'Speaking'],
    ['Buyruq, iltimos va maslahat', 'Grammatika'],
    ['Bayramlar va urf-odatlar', 'Madaniyat'],
    ['Restoranda: menyu va hisob', 'Speaking'],
    ['Qisqa xat va xabar yozish', 'Writing'],
    ['Sanaladigan va sanalmaydigan otlar', 'Grammatika'],
    ['Miqdor so\'zlari: ko\'p, oz, biroz', 'Grammatika'],
    ['Bog\'lovchilar: va, lekin, chunki, shuning uchun', 'Grammatika'],
    ['Tabiat, hayvonlar va atrof', 'Lug\'at'],
    ['Kino, musiqa va kitoblar', 'Speaking'],
    ['Pul, narx va savdolashish', 'Lug\'at'],
    ['Telefon, internet va ijtimoiy tarmoqlar', 'Lug\'at'],
    ['Hayotiy tajriba haqida gapirish', 'Grammatika'],
    ['Tinglash: e\'lonlar va dialoglar', 'Listening'],
    ['A2 yakuniy imtihon', 'Imtihon']
  ],
  B1: [
    ['Zamonlar tizimi: umumiy takrorlash', 'Grammatika'],
    ['Tugallangan zamon va tajriba', 'Grammatika'],
    ['O\'tmishdagi davomli harakat va hikoya', 'Grammatika'],
    ['Kelasi zamonning turli shakllari', 'Grammatika'],
    ['Real shart gaplar', 'Grammatika'],
    ['Gipotetik shart gaplar', 'Grammatika'],
    ['Majburiyat, ruxsat va maslahat (modal)', 'Grammatika'],
    ['Majhul nisbat asoslari', 'Grammatika'],
    ['Nisbiy (aniqlovchi) ergash gaplar', 'Grammatika'],
    ['Fikr bildirish va uni asoslash', 'Speaking'],
    ['Ishga kirish suhbati', 'Speaking'],
    ['Ta\'lim va o\'qish', 'Lug\'at'],
    ['Texnologiya va kundalik hayot', 'Lug\'at'],
    ['Sog\'lom turmush tarzi', 'Lug\'at'],
    ['Atrof-muhit va ekologiya', 'Lug\'at'],
    ['Ko\'chirma gap asoslari', 'Grammatika'],
    ['Fe\'lning noaniq shakllari (infinitiv, harakat nomi)', 'Grammatika'],
    ['Eng kerakli 30 ta barqaror ibora', 'Lug\'at'],
    ['Rasmiy va norasmiy xat', 'Writing'],
    ['O\'qish: asosiy g\'oyani topish', 'Reading'],
    ['Tinglash: tafsilotlarni ushlash', 'Listening'],
    ['Taqqoslash va farqlash', 'Speaking'],
    ['Hikoya qilish texnikasi', 'Speaking'],
    ['Muammo va yechim haqida gapirish', 'Speaking'],
    ['B1 yakuniy imtihon', 'Imtihon']
  ],
  B2: [
    ['B1 dan B2 ga: nimalar o\'zgaradi', 'Strategiya'],
    ['Zamonlar: nozik farqlar va kontekst', 'Grammatika'],
    ['O\'zingiz haqingizda ravon gapirish', 'Speaking'],
    ['Shart gaplar: real, gipotetik, aralash', 'Grammatika'],
    ['Ish va karyera lug\'ati', 'Lug\'at'],
    ['Fikrni dalil bilan himoya qilish', 'Speaking'],
    ['Majhul nisbat va rasmiy uslub', 'Grammatika'],
    ['Ta\'lim va texnologiya mavzusi', 'Lug\'at'],
    ['Tinglab tushunish: asosiy g\'oya va tafsilot', 'Listening'],
    ['O\'qish strategiyasi: tez ko\'z yugurtirish va qidirish', 'Reading'],
    ['Ko\'chirma gap: to\'liq tizim', 'Grammatika'],
    ['Rasmiy va norasmiy xat yozish', 'Writing'],
    ['Murakkab qo\'shma gaplar tuzish', 'Grammatika'],
    ['Eng ko\'p ishlatiladigan 100 ta so\'z birikmasi', 'Lug\'at'],
    ['Tajriba bo\'lishish: 2 daqiqalik monolog', 'Speaking'],
    ['Atrof-muhit va jamiyat', 'Lug\'at'],
    ['Esse tuzilmasi: kirish, dalil, xulosa', 'Writing'],
    ['Talaffuz: urg\'u, ohang va bog\'lanish', 'Talaffuz'],
    ['Munozara va qarshi fikr bildirish', 'Speaking'],
    ['Taxmin va ehtimollik ifodalash', 'Grammatika'],
    ['Media, reklama va yangiliklar', 'Lug\'at'],
    ['Madaniyatlararo farqlar', 'Madaniyat'],
    ['Grafik va jadvalni tasvirlash', 'Writing'],
    ['Imtihon strategiyasi: B2 darajasi', 'Strategiya'],
    ['B2 yakuniy imtihon va sertifikat', 'Imtihon']
  ],
  C1: [
    ['B2 dan C1 ga: ilg\'or daraja yo\'l xaritasi', 'Strategiya'],
    ['Inversiya va urg\'u beruvchi tuzilmalar', 'Grammatika'],
    ['Akademik lug\'at: eng muhim 300 so\'z', 'Lug\'at'],
    ['Sinonimlar orasidagi nozik farqlar', 'Lug\'at'],
    ['Idiomalarni tabiiy ishlatish', 'Lug\'at'],
    ['Modal fe\'llarning ilg\'or ma\'nolari', 'Grammatika'],
    ['To\'xtamasdan 2 daqiqa gapirish texnikasi', 'Speaking'],
    ['Abstrakt mavzularda fikr yuritish', 'Speaking'],
    ['Nominalizatsiya va akademik uslub', 'Writing'],
    ['Kogeziya: bog\'lovchi vositalar', 'Writing'],
    ['Argumentli esse: band 7–8 namunalar', 'Writing'],
    ['Murakkab matnlarda muallif niyati', 'Reading'],
    ['Tez nutq va turli aksentlarni tushunish', 'Listening'],
    ['Ishontirish va muzokara', 'Speaking'],
    ['Gapni boshqacha ifodalash (paraphrasing)', 'Lug\'at'],
    ['Ilg\'or ergash gaplar va kesimsiz konstruksiyalar', 'Grammatika'],
    ['Ish yozishmalari va hisobotlar', 'Writing'],
    ['Fan va texnologiya munozarasi', 'Speaking'],
    ['Iqtisod va biznes lug\'ati', 'Lug\'at'],
    ['Taqdimot qilish san\'ati', 'Speaking'],
    ['Ohang orqali ma\'no berish', 'Talaffuz'],
    ['Eng ko\'p uchraydigan C1 xatolari', 'Grammatika'],
    ['Imtihon strategiyasi: vaqt va stress', 'Strategiya'],
    ['To\'liq mock imtihon: Speaking va Writing', 'Imtihon'],
    ['C1 yakuniy imtihon', 'Imtihon']
  ],
  C2: [
    ['C1 dan C2 ga: ona tiliga yaqinlashish', 'Strategiya'],
    ['Registr: rasmiydan so\'zlashuvgacha', 'Lug\'at'],
    ['Kesatiq, yumor va kinoya', 'Madaniyat'],
    ['Frazeologizmlar va maqollar', 'Lug\'at'],
    ['Ritorik vositalar va nutq san\'ati', 'Speaking'],
    ['Murakkab grammatik tuzilmalar ustasi', 'Grammatika'],
    ['Adabiy matnlarni tahlil qilish', 'Reading'],
    ['Falsafa va axloq mavzularida munozara', 'Speaking'],
    ['Siyosat va xalqaro munosabatlar lug\'ati', 'Lug\'at'],
    ['Ilmiy maqola uslubida yozish', 'Writing'],
    ['Band 9 esse: to\'liq tahlil', 'Writing'],
    ['Tezkor nutqdagi ohang va niyatni ilg\'ash', 'Listening'],
    ['Madaniy kontekst va tarixiy ishoralar', 'Madaniyat'],
    ['So\'z yasash: old va oxirgi qo\'shimchalar', 'Lug\'at'],
    ['Nozik grammatik nuanslar va istisnolar', 'Grammatika'],
    ['Diplomatik til va yumshatish vositalari', 'Speaking'],
    ['Mavzuni chuqur rivojlantirish (Part 3 darajasi)', 'Speaking'],
    ['Ommaviy nutq va debat', 'Speaking'],
    ['Tarjima va ikki tilli fikrlash', 'Strategiya'],
    ['Ilg\'or talaffuz: tabiiy nutq oqimi', 'Talaffuz'],
    ['Xatolarsiz yozish: tahrir va korrektura', 'Writing'],
    ['To\'liq mock imtihon: Speaking', 'Imtihon'],
    ['To\'liq mock imtihon: Writing va Reading', 'Imtihon'],
    ['Imtihon kuni: strategiya va psixologiya', 'Strategiya'],
    ['C2 yakuniy imtihon va sertifikat', 'Imtihon']
  ]
};

// ── 60 TA ASOSIY DARS (har darajada 10 ta) — bular LinguaVerse'ning o'z
// 30 daqiqalik MP4 video darslari (AI ustoz + ElevenLabs/Azure ovoz).
// Qolgan 90 tasida AI YouTube'dan eng yaxshi darslarni topib ko'rsatadi
// (+ AI ustozning interaktiv darsi va test) — jami 150 ta dars.
// Raqamlar — CEFR_TOPICS dagi o'rin (0 dan). Har darajaning imtihoni (24) asosiy.
const CORE = {
  A1: [0, 1, 2, 3, 4, 6, 7, 8, 12, 24],     // alifbo, tanishuv, raqam, oila, "bo'lmoq", vaqt, hozirgi zamon, kafe, so'roq, imtihon
  A2: [0, 1, 3, 4, 6, 9, 11, 17, 22, 24],   // o'tgan zamon ×2, kelajak, qiyos, shifokor, davomiy, buyruq, bog'lovchi, tajriba, imtihon
  B1: [0, 1, 4, 5, 6, 7, 8, 9, 15, 24],     // zamonlar, perfekt, shart ×2, modal, majhul, nisbiy gap, fikr, ko'chirma gap, imtihon
  B2: [1, 3, 5, 6, 12, 13, 14, 16, 19, 24], // nozik zamonlar, shart, dalil, rasmiy uslub, qo'shma gap, birikmalar, monolog, esse, taxmin, imtihon
  C1: [1, 2, 5, 6, 8, 9, 10, 14, 21, 24],   // inversiya, akademik lug'at, modal, 2 daq. nutq, nominalizatsiya, kogeziya, esse, paraphrase, xatolar, imtihon
  C2: [1, 3, 5, 9, 10, 11, 15, 16, 20, 24]  // registr, frazeologiya, murakkab grammatika, ilmiy uslub, band 9 esse, ohang, diplomatik til, Part 3, tahrir, imtihon
};
export const CORE_PER_LEVEL = 10;

const build = levels => levels.flatMap(cefr => CEFR_TOPICS[cefr].map(([t, skill], i) => ({ t, skill, cefr, core: CORE[cefr].includes(i) })));

export const COURSE_LEVELS = {
  b2: {
    id: 'b2',
    name: 'A1 dan B2 gacha',
    short: 'B2',
    cefrs: ['A1', 'A2', 'B1', 'B2'],
    price: COURSE_PRICES.b2,
    priceLabel: "200 000 so'm",
    color: '#3b82f6',
    promise: "Noldan erkin muloqotgacha: 4 daraja, 100 ta video dars. IELTS 6.0–6.5 ga teng.",
    lessons: build(['A1', 'A2', 'B1', 'B2'])
  },
  c2: {
    id: 'c2',
    name: 'C1 va C2 — mukammal daraja',
    short: 'C2',
    cefrs: ['C1', 'C2'],
    price: COURSE_PRICES.c2,
    priceLabel: "400 000 so'm",
    color: '#e11d48',
    promise: "Ona tili darajasiga yaqin. IELTS 8.0–9.0. B2 kursi ham ichida — jami 150 ta video dars.",
    lessons: build(['C1', 'C2'])
  }
};

export const LESSONS_PER_LANGUAGE = COURSE_LEVELS.b2.lessons.length + COURSE_LEVELS.c2.lessons.length;   // 150
export const CORE_LESSONS_PER_LANGUAGE = [...COURSE_LEVELS.b2.lessons, ...COURSE_LEVELS.c2.lessons].filter(l => l.core).length;   // 60 (MP4)

/** Kurs kaliti: english_c2 */
export const courseKey = (lang, level) => `${lang}_${level}`;

/** Foydalanuvchi profilidan kursga kirish huquqi. C2 egasi B2 ni ham ko'radi. */
export function hasCourse(profile, lang, level) {
  const owned = profile?.courses || {};
  if (owned[courseKey(lang, level)]) return true;
  if (level === 'b2' && owned[courseKey(lang, 'c2')]) return true;
  return false;
}

/** Birinchi dars hammaga bepul ochiq — sifatni ko'rib keyin sotib olsin. */
export const FREE_PREVIEW_LESSONS = 1;
