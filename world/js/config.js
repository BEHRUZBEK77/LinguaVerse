// ═══════════════════════════════════════════════════════════════════════════
// config.js — 3D DUNYO MA'LUMOTLARI (YAGONA MANBA)
//
// Zonalar, lug'at so'zlari, NPC shaxslari, questlar va sozlamalar
// FAQAT shu yerda ta'riflanadi. Boshqa fayllar shu yerdan import qiladi.
//
// Til maqsadi: asosiy demo — ingliz tili. Tarjimalar o'zbek tilida.
// ═══════════════════════════════════════════════════════════════════════════

// ───────────────────────────────────────────────────────────────────────────
// DOIMIYLAR
// ───────────────────────────────────────────────────────────────────────────
export const WORLD = {
  size: { x: 176, z: 116 },          // shahar yarim o'lchamlari (devorlar)
  roadWidth: 16,
  districtHalf: 52,                   // har zona kvadrati yarmi
  spawn: { x: 0, z: 10 },             // o'yinchi paydo bo'ladigan joy (markaz maydon)
  playerRadius: 0.45,
  playerHeight: 1.7,
  walkSpeed: 4.2,
  runSpeed: 7.2,
  npcInteractDist: 3.4,
  propInteractDist: 4.0,
  labelDist: 5.5
};

// ───────────────────────────────────────────────────────────────────────────
// ZONALAR
// center — zona kvadratining markazi, size — tomoni.
// themeColor — HUD/minimap va yorug'lik tuslari uchun.
// ground — yer qoplamasi rangi.
// ───────────────────────────────────────────────────────────────────────────
export const ZONES = [
  { id: 'cafe',     name: 'Cafe',     nameUz: 'Kafe',     center: { x: -120, z: -60 }, theme: '#f59e0b', ground: 0x7a4a2b, ambient: 'cafe' },
  { id: 'market',   name: 'Market',   nameUz: 'Bozor',    center: { x: 0,    z: -60 }, theme: '#22c55e', ground: 0x8a7a4a, ambient: 'market' },
  { id: 'office',   name: 'Office',   nameUz: 'Ofis',     center: { x: 120,  z: -60 }, theme: '#3b82f6', ground: 0x5b6478, ambient: 'office' },
  { id: 'home',     name: 'Home',     nameUz: 'Uy',       center: { x: -120, z: 60 },  theme: '#ec4899', ground: 0x4a6b4a, ambient: 'home' },
  { id: 'school',   name: 'School',   nameUz: 'Maktab',   center: { x: 0,    z: 60 },  theme: '#a855f7', ground: 0x4a6b5a, ambient: 'school' },
  { id: 'airport',  name: 'Airport',  nameUz: 'Aэroport', center: { x: 120,  z: 60 },  theme: '#06b6d4', ground: 0x6a6a7a, ambient: 'airport' }
];

export const ZONE_BY_ID = Object.fromEntries(ZONES.map(z => [z.id, z]));

/** Zona ichidamizmi? */
export function zoneAt(x, z) {
  const h = WORLD.districtHalf;
  for (const zz of ZONES) {
    if (Math.abs(x - zz.center.x) <= h && Math.abs(z - zz.center.z) <= h) return zz;
  }
  return null;
}

// ───────────────────────────────────────────────────────────────────────────
// SHAHARLAR (palitra)
// Har bir shahar butun dunyoning rang/tematurasini o'zgartiradi.
// sky/fog — osmon, grass — umumiy yer, road — yo'l, tree — daraxt,
// building — bino tus koeffitsiyenti (1 = asl rang).
// ───────────────────────────────────────────────────────────────────────────
export const CITIES = [
  {
    id: 'toshkent', name: 'Toshkent', nameEn: 'Tashkent', flag: '🇺🇿', native: 'uz',
    desc: 'Yashil bog\'lar, choyxonalar va quyoshli maydonlar',
    sky: 0x87c8f0, fog: 0xa8cff0,
    grass: 0x3a7d3a, road: 0x3a3f4d, tree: 0x2f8a3f,
    building: 0xffffff, tint: 1.0, lamp: 0xffd23f,
    sun: 1.35, sunColor: 0xfff2d9
  },
  {
    id: 'berlin', name: 'Berlin', nameEn: 'Berlin', flag: '🇩🇪', native: 'de',
    desc: 'Zamonaviy metropol — aniq chiziqlar, kulrang-ko\'k maydonlar',
    sky: 0x9db8e0, fog: 0xb8c9e0,
    grass: 0x3f7a55, road: 0x33363f, tree: 0x2f7a45,
    building: 0xdfe3ea, tint: 0.92, lamp: 0xffe08a,
    sun: 1.05, sunColor: 0xfff0d6
  },
  {
    id: 'seul', name: 'Seul', nameEn: 'Seoul', flag: '🇰🇷', native: 'ko',
    desc: 'Yorqin neonli, futuristik — kechki osmon',
    sky: 0x2a3560, fog: 0x3a4470,
    grass: 0x2c5a3a, road: 0x23262f, tree: 0x2a7a4a,
    building: 0xcfd8ff, tint: 0.95, lamp: 0x7ef0ff,
    sun: 0.55, sunColor: 0xcfe0ff
  },
  {
    id: 'london', name: 'London', nameEn: 'London', flag: '🇬🇧', native: 'en',
    desc: 'Klassik metropol — g\'ishtli binolar, an\'anaviy ko\'chalar',
    sky: 0x9aa7b8, fog: 0xb9c2cc,
    grass: 0x5a7a4a, road: 0x2e2e36, tree: 0x2f7a45,
    building: 0xc9b09a, tint: 0.9, lamp: 0xffd166,
    sun: 0.95, sunColor: 0xfff1dc,
    weather: 'rain'
  },
  {
    id: 'tokyo', name: 'Tokio', nameEn: 'Tokyo', flag: '🇯🇵', native: 'ja',
    desc: 'Neon va sakura — o\'ng va tungi osmon',
    sky: 0x2f3b66, fog: 0x3f4a75,
    grass: 0x2c5a3a, road: 0x1f2129, tree: 0xc47fa8,
    building: 0xfff0f5, tint: 1.05, lamp: 0xff8ad0,
    sun: 0.6, sunColor: 0xffe0f0
  },
  {
    id: 'paris', name: 'Parij', nameEn: 'Paris', flag: '🇫🇷', native: 'fr',
    desc: 'Elegant osmon, qaymoq rangli binolar va romantik maydonlar',
    sky: 0xb8c9e8, fog: 0xcad5ea,
    grass: 0x5a8a4a, road: 0x2c2c34, tree: 0x3a8a5a,
    building: 0xe8d9b8, tint: 0.98, lamp: 0xffe08a,
    sun: 1.1, sunColor: 0xfff2d9
  }
];

export const CITY_BY_ID = Object.fromEntries(CITIES.map(c => [c.id, c]));

export function cityAt(id) {
  return CITY_BY_ID[id] || CITIES[0];
}

// ───────────────────────────────────────────────────────────────────────────
// LUG'AT SO'ZLARI
// Har bir zona uchun 8 tadan so'z. pos — mutlaq koordinata.
// prop — 3D predmet turi (Models.js da quriladi).
// ───────────────────────────────────────────────────────────────────────────
export const WORDS = [
  // ── KAFE ──
  { id: 'cafe_coffee', zone: 'cafe', word: 'coffee',    translation: 'kofe',     type: 'noun', level: 'A1', prop: 'cup',      pos: { x: -112, z: -40 }, example: 'I would like a coffee, please.', exampleTranslation: 'Bir kofe so\'rayman, iltimos.' },
  { id: 'cafe_menu',   zone: 'cafe', word: 'menu',      translation: 'menyu',    type: 'noun', level: 'A1', prop: 'menu',     pos: { x: -132, z: -42 }, example: 'Can I see the menu?', exampleTranslation: 'Menyuni ko\'rsam bo\'ladimi?' },
  { id: 'cafe_table',  zone: 'cafe', word: 'table',     translation: 'stol',     type: 'noun', level: 'A1', prop: 'table',    pos: { x: -106, z: -52 }, example: 'The table is by the window.', exampleTranslation: 'Stol deraza yonida.' },
  { id: 'cafe_waiter', zone: 'cafe', word: 'waiter',    translation: 'ofitsiant', type: 'noun', level: 'A1', prop: 'waiter',  pos: { x: -116, z: -70 }, example: 'The waiter brought the bill.', exampleTranslation: 'Ofitsiant hisobni olib keldi.' },
  { id: 'cafe_bill',   zone: 'cafe', word: 'bill',      translation: 'hisob / chek', type: 'noun', level: 'A1', prop: 'bill',  pos: { x: -98, z: -58 }, example: 'Could I have the bill, please?', exampleTranslation: 'Hisobni bersangiz bo\'ladimi?' },
  { id: 'cafe_bread',  zone: 'cafe', word: 'bread',     translation: 'non',      type: 'noun', level: 'A1', prop: 'bread',    pos: { x: -142, z: -50 }, example: 'The bread is fresh.', exampleTranslation: 'Non yangi.' },
  { id: 'cafe_cake',   zone: 'cafe', word: 'cake',      translation: 'tort / kek', type: 'noun', level: 'A1', prop: 'cake',   pos: { x: -126, z: -84 }, example: 'This cake is delicious.', exampleTranslation: 'Bu tort juda mazali.' },
  { id: 'cafe_juice',  zone: 'cafe', word: 'juice',     translation: 'sharbat',  type: 'noun', level: 'A1', prop: 'juice',    pos: { x: -92, z: -48 }, example: 'Orange juice, please.', exampleTranslation: 'Apelsin sharbati, iltimos.' },

  // ── BOZOR ──
  { id: 'market_apple',  zone: 'market', word: 'apple',   translation: 'olma',    type: 'noun', level: 'A1', prop: 'apple',   pos: { x: -22, z: -46 }, example: 'How much is this apple?', exampleTranslation: 'Bu olma qancha?' },
  { id: 'market_price',  zone: 'market', word: 'price',   translation: 'narx',    type: 'noun', level: 'A1', prop: 'sign',    pos: { x: 8,   z: -40 }, example: 'The price is too high.', exampleTranslation: 'Narx juda baland.' },
  { id: 'market_bargain', zone: 'market', word: 'bargain', translation: 'savdo / arzon narx', type: 'noun', level: 'B1', prop: 'coin', pos: { x: -14, z: -76 }, example: 'I got a great bargain.', exampleTranslation: 'Juda arzon oldim.' },
  { id: 'market_discount', zone: 'market', word: 'discount', translation: 'chegirma', type: 'noun', level: 'A2', prop: 'discount', pos: { x: 24, z: -52 }, example: 'Is there a discount today?', exampleTranslation: 'Bugun chegirma bormi?' },
  { id: 'market_banana', zone: 'market', word: 'banana',  translation: 'banan',   type: 'noun', level: 'A1', prop: 'banana',  pos: { x: -38, z: -60 }, example: 'Two bananas, please.', exampleTranslation: 'Ikkita banan, iltimos.' },
  { id: 'market_seller', zone: 'market', word: 'seller',  translation: 'sotuvchi', type: 'noun', level: 'A1', prop: 'seller',  pos: { x: 6,   z: -64 }, example: 'The seller is very friendly.', exampleTranslation: 'Sotuvchi juda mehribon.' },
  { id: 'market_basket', zone: 'market', word: 'basket',  translation: 'savat',   type: 'noun', level: 'A1', prop: 'basket',  pos: { x: 36,  z: -70 }, example: 'My basket is full.', exampleTranslation: 'Savatim to\'ldi.' },
  { id: 'market_cheese', zone: 'market', word: 'cheese',  translation: 'pishloq', type: 'noun', level: 'A1', prop: 'cheese',  pos: { x: -30, z: -86 }, example: 'I like cheese on bread.', exampleTranslation: 'Nonga pishloq yaxshi ko\'raman.' },

  // ── OFIS ──
  { id: 'office_meeting', zone: 'office', word: 'meeting', translation: 'yig\'ilish', type: 'noun', level: 'A2', prop: 'meeting', pos: { x: 132, z: -44 }, example: 'The meeting starts at nine.', exampleTranslation: 'Yig\'ilish soat 9 da boshlanadi.' },
  { id: 'office_deadline', zone: 'office', word: 'deadline', translation: 'muddat / oxirgi kun', type: 'noun', level: 'B1', prop: 'clock', pos: { x: 104, z: -50 }, example: 'The deadline is Friday.', exampleTranslation: 'Oxirgi muddat — juma.' },
  { id: 'office_colleague', zone: 'office', word: 'colleague', translation: 'hamkasab', type: 'noun', level: 'A2', prop: 'colleague', pos: { x: 148, z: -60 }, example: 'My colleague helped me.', exampleTranslation: 'Hamkasbim menga yordam berdi.' },
  { id: 'office_laptop', zone: 'office', word: 'laptop', translation: 'noutbuk', type: 'noun', level: 'A1', prop: 'laptop', pos: { x: 120, z: -84 }, example: 'I work on my laptop.', exampleTranslation: 'Noutbukda ishlayman.' },
  { id: 'office_report', zone: 'office', word: 'report', translation: 'hisobot', type: 'noun', level: 'A2', prop: 'report', pos: { x: 138, z: -78 }, example: 'Please send me the report.', exampleTranslation: 'Iltimos, hisobotni yuboring.' },
  { id: 'office_email', zone: 'office', word: 'email', translation: 'elektron pochta', type: 'noun', level: 'A1', prop: 'email', pos: { x: 96, z: -68 }, example: 'I will send an email.', exampleTranslation: 'Email yuboraman.' },
  { id: 'office_phone', zone: 'office', word: 'phone', translation: 'telefon', type: 'noun', level: 'A1', prop: 'phone', pos: { x: 112, z: -36 }, example: 'My phone is on the desk.', exampleTranslation: 'Telefonim stolda.' },
  { id: 'office_break', zone: 'office', word: 'break', translation: 'tanaffus', type: 'noun', level: 'A2', prop: 'coffee2', pos: { x: 160, z: -50 }, example: 'Let\'s take a coffee break.', exampleTranslation: 'Kofe tanaffusi qilaylik.' },

  // ── UY ──
  { id: 'home_kitchen', zone: 'home', word: 'kitchen', translation: 'oshxona', type: 'noun', level: 'A1', prop: 'kitchen', pos: { x: -132, z: 44 }, example: 'The kitchen is small.', exampleTranslation: 'Oshxona kichkina.' },
  { id: 'home_bedroom', zone: 'home', word: 'bedroom', translation: 'yotoqxona', type: 'noun', level: 'A1', prop: 'bed', pos: { x: -106, z: 50 }, example: 'My bedroom is upstairs.', exampleTranslation: 'Yotoqxonam tepada.' },
  { id: 'home_chore', zone: 'home', word: 'chore', translation: 'uy yumushi', type: 'noun', level: 'B1', prop: 'broom', pos: { x: -96, z: 34 }, example: 'I need to do some chores.', exampleTranslation: 'Uy yumushlarini qilishim kerak.' },
  { id: 'home_key', zone: 'home', word: 'key', translation: 'kalit', type: 'noun', level: 'A1', prop: 'key', pos: { x: -118, z: 30 }, example: 'Where is my key?', exampleTranslation: 'Kalitim qayerda?' },
  { id: 'home_sofa', zone: 'home', word: 'sofa', translation: 'divan', type: 'noun', level: 'A1', prop: 'sofa', pos: { x: -144, z: 62 }, example: 'The sofa is comfortable.', exampleTranslation: 'Divan qulay.' },
  { id: 'home_fridge', zone: 'home', word: 'fridge', translation: 'muzlatkich', type: 'noun', level: 'A1', prop: 'fridge', pos: { x: -152, z: 40 }, example: 'There is milk in the fridge.', exampleTranslation: 'Muzlatkichda sut bor.' },
  { id: 'home_neighbor', zone: 'home', word: 'neighbor', translation: 'qo\'shni', type: 'noun', level: 'A1', prop: 'neighbor', pos: { x: -112, z: 80 }, example: 'My neighbor is very kind.', exampleTranslation: 'Qo\'shnim juda mehribon.' },
  { id: 'home_plant', zone: 'home', word: 'plant', translation: 'o\'simlik', type: 'noun', level: 'A1', prop: 'plant', pos: { x: -86, z: 58 }, example: 'I water the plant every day.', exampleTranslation: 'O\'simlikni har kuni sug\'oraman.' },

  // ── MAKTAB ──
  { id: 'school_teacher', zone: 'school', word: 'teacher', translation: 'o\'qituvchi', type: 'noun', level: 'A1', prop: 'teacher', pos: { x: -8, z: 44 }, example: 'The teacher explains the lesson.', exampleTranslation: 'O\'qituvchi darsni tushuntiradi.' },
  { id: 'school_homework', zone: 'school', word: 'homework', translation: 'uy vazifasi', type: 'noun', level: 'A1', prop: 'homework', pos: { x: 18, z: 52 }, example: 'I finished my homework.', exampleTranslation: 'Uy vazifamni tugatdim.' },
  { id: 'school_classroom', zone: 'school', word: 'classroom', translation: 'sinf xonasi', type: 'noun', level: 'A1', prop: 'classroom', pos: { x: 30, z: 84 }, example: 'The classroom is bright.', exampleTranslation: 'Sinf xonasi yorug\'.' },
  { id: 'school_pencil', zone: 'school', word: 'pencil', translation: 'qalam', type: 'noun', level: 'A1', prop: 'pencil', pos: { x: -28, z: 60 }, example: 'I need a pencil.', exampleTranslation: 'Menga qalam kerak.' },
  { id: 'school_book', zone: 'school', word: 'book', translation: 'kitob', type: 'noun', level: 'A1', prop: 'book', pos: { x: -16, z: 76 }, example: 'This book is interesting.', exampleTranslation: 'Bu kitob qiziqarli.' },
  { id: 'school_board', zone: 'school', word: 'board', translation: 'doska', type: 'noun', level: 'A1', prop: 'board', pos: { x: 4, z: 40 }, example: 'Write it on the board.', exampleTranslation: 'Buni doskaga yozing.' },
  { id: 'school_question', zone: 'school', word: 'question', translation: 'savol', type: 'noun', level: 'A1', prop: 'question', pos: { x: 44, z: 56 }, example: 'May I ask a question?', exampleTranslation: 'Savol bersam bo\'ladimi?' },
  { id: 'school_lesson', zone: 'school', word: 'lesson', translation: 'dars', type: 'noun', level: 'A1', prop: 'lesson', pos: { x: -40, z: 44 }, example: 'The lesson starts at ten.', exampleTranslation: 'Dars soat 10 da boshlanadi.' },

  // ── AЭROPORT ──
  { id: 'airport_ticket', zone: 'airport', word: 'ticket', translation: 'chipta', type: 'noun', level: 'A1', prop: 'ticket', pos: { x: 148, z: 46 }, example: 'My ticket is in my bag.', exampleTranslation: 'Chiptam sumkada.' },
  { id: 'airport_gate', zone: 'airport', word: 'gate', translation: 'darvoza (uchish eshigi)', type: 'noun', level: 'A1', prop: 'gate', pos: { x: 128, z: 42 }, example: 'Where is gate B4?', exampleTranslation: 'B4 darvozasi qayerda?' },
  { id: 'airport_passport', zone: 'airport', word: 'passport', translation: 'pasport', type: 'noun', level: 'A1', prop: 'passport', pos: { x: 100, z: 52 }, example: 'May I see your passport?', exampleTranslation: 'Pasportingizni ko\'rsaysizmi?' },
  { id: 'airport_luggage', zone: 'airport', word: 'luggage', translation: 'yuk', type: 'noun', level: 'A2', prop: 'luggage', pos: { x: 140, z: 74 }, example: 'My luggage is heavy.', exampleTranslation: 'Yukim og\'ir.' },
  { id: 'airport_flight', zone: 'airport', word: 'flight', translation: 'reys / parvoz', type: 'noun', level: 'A2', prop: 'flight', pos: { x: 112, z: 84 }, example: 'The flight is delayed.', exampleTranslation: 'Reys kechikdi.' },
  { id: 'airport_boarding', zone: 'airport', word: 'boarding', translation: 'bortga chiqish', type: 'noun', level: 'B1', prop: 'boarding', pos: { x: 92, z: 76 }, example: 'Boarding starts at noon.', exampleTranslation: 'Bortga chiqish tushda boshlanadi.' },
  { id: 'airport_plane', zone: 'airport', word: 'plane', translation: 'samolyot', type: 'noun', level: 'A1', prop: 'plane', pos: { x: 160, z: 100 }, example: 'The plane takes off now.', exampleTranslation: 'Samolyot hozir uchadi.' },
  { id: 'airport_agent', zone: 'airport', word: 'agent', translation: 'agent / xizmatchi', type: 'noun', level: 'A1', prop: 'agent', pos: { x: 132, z: 40 }, example: 'The agent checked my bag.', exampleTranslation: 'Agent yukimni tekshirdi.' }
];

export const WORD_BY_ID = Object.fromEntries(WORDS.map(w => [w.id, w]));
export const WORDS_BY_ZONE = WORDS.reduce((acc, w) => {
  (acc[w.zone] = acc[w.zone] || []).push(w);
  return acc;
}, {});

// ───────────────────────────────────────────────────────────────────────────
// NPC PERSONALARI
// voice: 'male' | 'female'  (Azure TTS ovoz tanlash uchun)
// greeting — suhbat boshlanganda aytiladigan so'z (maqsad tilida)
// persona — AI uchun shaxs ta'rifi (inglizcha)
// ───────────────────────────────────────────────────────────────────────────
export const NPCS = [
  {
    id: 'cafe_marta', zone: 'cafe', name: 'Marta', role: 'Barista', gender: 'female',
    color: 0x22c55e, pos: { x: -124, z: -56 },
    greeting: 'Hello! Welcome to my café. What would you like to order?',
    persona: 'You are Marta, a friendly barista at a small café. You love coffee and talking about your drinks menu. You are patient and encouraging. When a customer makes a grammar mistake, gently correct it once in a short way, then continue the conversation. Keep answers short (2-4 sentences) and always end with a question.'
  },
  {
    id: 'market_ali', zone: 'market', name: 'Ali', role: 'Fruit seller', gender: 'male',
    color: 0xf59e0b, pos: { x: 4, z: -58 },
    greeting: 'Salam! Fresh fruit today! How much do you want to buy?',
    persona: 'You are Ali, a cheerful fruit seller at a busy market. You sell apples, bananas, cheese and more. You are playful and love bargaining. Correct the customer gently if they make a mistake. Keep answers short (2-4 sentences) and end with a question about what they want to buy.'
  },
  {
    id: 'office_sara', zone: 'office', name: 'Sara', role: 'Colleague', gender: 'female',
    color: 0x3b82f6, pos: { x: 118, z: -58 },
    greeting: 'Hi there! I\'m Sara. Are you new at the office? How can I help you?',
    persona: 'You are Sara, a friendly colleague working at an office. You often talk about meetings, deadlines and lunch breaks. Be professional but warm. Correct the learner gently. Keep answers short (2-4 sentences) and end with a question.'
  },
  {
    id: 'airport_karim', zone: 'airport', name: 'Karim', role: 'Check-in agent', gender: 'male',
    color: 0x06b6d4, pos: { x: 128, z: 46 },
    greeting: 'Good morning! Welcome to the airport. May I see your ticket and passport?',
    persona: 'You are Karim, a polite check-in agent at the airport. You talk about flights, gates, passports and luggage. Be professional, calm and helpful. Correct the learner gently if needed. Keep answers short (2-4 sentences) and end with a question.'
  },
  {
    id: 'home_grandpa', zone: 'home', name: 'Bob', role: 'Neighbor', gender: 'male',
    color: 0xec4899, pos: { x: -112, z: 72 },
    greeting: 'Oh, hello young friend! Welcome to the neighbourhood. How are you today?',
    persona: 'You are Bob, a kind elderly neighbor who lives in a quiet house. You love gardening and talking about daily life, chores and family. Be warm and grandfatherly. Correct the learner gently. Keep answers short (2-4 sentences) and end with a question.'
  },
  {
    id: 'school_nilufar', zone: 'school', name: 'Nilufar', role: 'Teacher', gender: 'female',
    color: 0xa855f7, pos: { x: -6, z: 48 },
    greeting: 'Welcome to class! I\'m teacher Nilufar. Let\'s practise English together. What did you learn today?',
    persona: 'You are Nilufar, an enthusiastic English teacher. You love explaining grammar in simple words and encouraging students. When the student makes a mistake, show the correct form and explain briefly. Keep answers short (2-4 sentences) and end with a question or a small task.'
  },
  {
    id: 'airport_lia', zone: 'airport', name: 'Lia', role: 'Traveller', gender: 'female',
    color: 0xf43f5e, pos: { x: 152, z: 62 },
    greeting: 'Hi! Are you going on a trip too? I\'m waiting for my flight.',
    persona: 'You are Lia, a friendly traveller waiting for a long flight. You talk about travel, countries, food and sightseeing. Be curious and relaxed. Correct the learner gently. Keep answers short (2-4 sentences) and end with a question.'
  },
  {
    id: 'market_dilya', zone: 'market', name: 'Dilya', role: 'Bread seller', gender: 'female',
    color: 0x34d399, pos: { x: -14, z: -80 },
    greeting: 'Good morning! Fresh bread, just out of the oven! Would you like some?',
    persona: 'You are Dilya, a friendly bread seller at the market. You sell fresh bread and cakes. You are kind and like chatting with customers. Correct the learner gently. Keep answers short (2-4 sentences) and end with a question.'
  }
];

export const NPC_BY_ID = Object.fromEntries(NPCS.map(n => [n.id, n]));
export const NPCS_BY_ZONE = NPCS.reduce((acc, n) => {
  (acc[n.zone] = acc[n.zone] || []).push(n);
  return acc;
}, {});

// ───────────────────────────────────────────────────────────────────────────
// QUESTLAR
// type: talk | words | phrase | arrive | zones
// ───────────────────────────────────────────────────────────────────────────
export const QUESTS = [
  { id: 'q_welcome', title: 'Shaharga xush kelibsiz', desc: 'Kafe zonasiga boring va atrofni o\'rganing.', type: 'arrive', zone: 'cafe', xp: 20, coins: 10 },
  { id: 'q_cafe_words', title: 'Kofeda lug\'at', desc: 'Kafe zonasida 3 ta so\'z o\'rganing (predmetlarga bosing).', type: 'words', zone: 'cafe', count: 3, xp: 30, coins: 15 },
  { id: 'q_cafe_talk', title: 'Barista bilan suhbat', desc: 'Marta bilan suhbatlashing (E tugmasi yoki ustiga bosing).', type: 'talk', npc: 'cafe_marta', turns: 1, xp: 25, coins: 10 },
  { id: 'q_cafe_order', title: 'Kofe buyurtma bering', desc: 'Marta bilan suhbatda: "I would like a coffee, please." deb ayting.', type: 'phrase', npc: 'cafe_marta', phrase: 'I would like a coffee', xp: 40, coins: 20 },
  { id: 'q_market_words', title: 'Bozorda lug\'at', desc: 'Bozorda 3 ta so\'z o\'rganing.', type: 'words', zone: 'market', count: 3, xp: 30, coins: 15 },
  { id: 'q_market_talk', title: 'Sotuvchi bilan suhbat', desc: 'Ali bilan suhbatlashing.', type: 'talk', npc: 'market_ali', turns: 1, xp: 25, coins: 10 },
  { id: 'q_market_price', title: 'Narx so\'rang', desc: 'Ali bilan suhbatda: "How much is this apple?" deb so\'rang.', type: 'phrase', npc: 'market_ali', phrase: 'How much is this apple', xp: 40, coins: 20 },
  { id: 'q_office_words', title: 'Ofisda lug\'at', desc: 'Ofisda 3 ta so\'z o\'rganing.', type: 'words', zone: 'office', count: 3, xp: 30, coins: 15 },
  { id: 'q_office_talk', title: 'Hamkasab bilan suhbat', desc: 'Sara bilan suhbatlashing.', type: 'talk', npc: 'office_sara', turns: 1, xp: 25, coins: 10 },
  { id: 'q_airport_words', title: 'Aэroportda lug\'at', desc: 'Aэroportda 3 ta so\'z o\'rganing.', type: 'words', zone: 'airport', count: 3, xp: 30, coins: 15 },
  { id: 'q_airport_talk', title: 'Agent bilan suhbat', desc: 'Karim bilan suhbatlashing.', type: 'talk', npc: 'airport_karim', turns: 1, xp: 25, coins: 10 },
  { id: 'q_airport_gate', title: 'Darvoza so\'rang', desc: 'Karim bilan suhbatda: "Where is my gate?" deb so\'rang.', type: 'phrase', npc: 'airport_karim', phrase: 'Where is my gate', xp: 40, coins: 20 },
  { id: 'q_home_words', title: 'Uyda lug\'at', desc: 'Uy zonasida 3 ta so\'z o\'rganing.', type: 'words', zone: 'home', count: 3, xp: 30, coins: 15 },
  { id: 'q_home_talk', title: 'Qo\'shni bilan suhbat', desc: 'Bob bilan suhbatlashing.', type: 'talk', npc: 'home_grandpa', turns: 1, xp: 25, coins: 10 },
  { id: 'q_school_words', title: 'Maktabda lug\'at', desc: 'Maktab zonasida 3 ta so\'z o\'rganing.', type: 'words', zone: 'school', count: 3, xp: 30, coins: 15 },
  { id: 'q_school_talk', title: 'O\'qituvchi bilan suhbat', desc: 'Nilufar bilan suhbatlashing.', type: 'talk', npc: 'school_nilufar', turns: 1, xp: 25, coins: 10 },
  { id: 'q_school_question', title: 'Savol so\'rang', desc: 'Nilufar bilan suhbatda: "Can you help me, please?" deb so\'rang.', type: 'phrase', npc: 'school_nilufar', phrase: 'Can you help me', xp: 40, coins: 20 },
  { id: 'q_explorer', title: 'Kashfiyotchi', desc: 'Har xil 3 ta zonaga tashrif buyuring.', type: 'zones', count: 3, xp: 50, coins: 30 }
];

export const QUEST_BY_ID = Object.fromEntries(QUESTS.map(q => [q.id, q]));

// ───────────────────────────────────────────────────────────────────────────
// DARAJA (LEVEL) EGRI CHIZIG'I
// ───────────────────────────────────────────────────────────────────────────
export function xpToNext(level) {
  return Math.round(120 * Math.pow(level, 1.45));
}

// ───────────────────────────────────────────────────────────────────────────
// SOZLAMALAR (boshlang'ich)
// targetLang — suhbat tili (Azure davlat kodlari)
// cefr — A1..C1
// ───────────────────────────────────────────────────────────────────────────
export const DEFAULT_SETTINGS = {
  cefr: 'A2',
  targetLang: 'en-US',
  nativeLang: 'uz',
  subtitles: true,
  sound: 0.6,
  quality: 'high',            // high | medium | low
  autoStop: true,             // ovozda jimlikni o'zi tugatish
  voice: 'female'             // NPC ovozi
};

export const TARGET_LANGS = [
  { id: 'en-US', label: 'English', flag: '🇬🇧' },
  { id: 'ru-RU', label: 'Русский', flag: '🇷🇺' },
  { id: 'es-ES', label: 'Español', flag: '🇪🇸' },
  { id: 'de-DE', label: 'Deutsch', flag: '🇩🇪' },
  { id: 'tr-TR', label: 'Türkçe', flag: '🇹🇷' }
];

export const CEFR_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1'];

export default {
  WORLD, ZONES, ZONE_BY_ID, zoneAt,
  CITIES, CITY_BY_ID, cityAt,
  WORDS, WORD_BY_ID, WORDS_BY_ZONE,
  NPCS, NPC_BY_ID, NPCS_BY_ZONE,
  QUESTS, QUEST_BY_ID,
  xpToNext, DEFAULT_SETTINGS, TARGET_LANGS, CEFR_LEVELS
};
