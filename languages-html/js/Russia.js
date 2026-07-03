// =====================================================// Russian.js — LinguaVerse (Русский язык — полная версия)
// Firebase + Token система (1 токен за каждый символ в чате)
// =====================================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
    getFirestore, doc, getDoc, setDoc, updateDoc,
    increment, serverTimestamp, arrayUnion, collection,
    addDoc, query, orderBy, limit, getDocs, onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const $id = id => document.getElementById(id);

// ── FIREBASE ──
const FB_CONFIG = {
    apiKey: "AIzaSyArSlWIz3Z9NsUZowCiFj-snKccQfDnm5w",
    authDomain: "linguaverse-ebe09.firebaseapp.com",
    projectId: "linguaverse-ebe09",
    storageBucket: "linguaverse-ebe09.firebasestorage.app",
    messagingSenderId: "130625454868",
    appId: "1:130625454868:web:3f02871f64cb5f8af27801"
};

let _app, _auth, _db;
try {
    const { getApp } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js");
    _app = getApp();
} catch {
    _app = initializeApp(FB_CONFIG);
}
_auth = getAuth(_app);
_db = getFirestore(_app);

// ── AI PROXY ──
// Xavfsiz: AI so'rovlar endi ochiq worker emas, server funksiyasi orqali (kalit serverda)
const AI_PROXY = "/.netlify/functions/groq";
const NATIVE_LANG = ({ uz: "Uzbek", en: "English", ru: "Russian", es: "Spanish", de: "German", tr: "Turkish", ar: "Arabic", ko: "Korean", zh: "Chinese" })[localStorage.getItem('coach_native') || localStorage.getItem('lv_lang') || 'uz'] || "Uzbek";
const LANG_RULES = `\n\nIMPORTANT OVERRIDE: The student's native language is ${NATIVE_LANG}. Speak PRIMARILY in the language being taught on this page — practice must happen in the target language itself. Use ${NATIVE_LANG} ONLY for short translations and explanations of mistakes. NEVER reply fully in ${NATIVE_LANG}.\nQUALITY BAR: teach at professional exam-preparation level (IELTS/Goethe/DELE/TOPIK/HSK-equivalent): authentic natural language, precise corrections referencing grammar rules, exam-style feedback on fluency, vocabulary range and accuracy. Push the student slightly above their current level.`;


// ══════════════════════════════════════════════════════════════
// КОНФИГ ТОКЕНОВ
// ══════════════════════════════════════════════════════════════
const TOKEN_CONFIG = {
    default_tokens: 1000,
    reset_hours: 5,
    ai_cost: 1,           // токен за каждый символ в чате (считается ниже)
    unit_cost: 2,
    purchase_packages: [
        { tokens: 500, price_uzs: 10000, label: "500 токенов", bonus: 0 },
        { tokens: 1200, price_uzs: 20000, label: "1200 токенов", bonus: 200 },
        { tokens: 3000, price_uzs: 45000, label: "3000 токенов", bonus: 500 },
        { tokens: 7000, price_uzs: 90000, label: "7000 токенов", bonus: 1000 },
    ]
};

const PLANS = {
    free: { name: "Бесплатно", icon: "🆓", price_uzs: 0, token_bonus: 1000, token_reset_mult: 1, xp_mult: 1, coin_mult: 1, features: ["1000 токенов/5ч", "Стандартный AI", "Базовые упражнения"] },
    pro: { name: "Про", icon: "⭐", price_uzs: 29000, token_bonus: 3000, token_reset_mult: 2, xp_mult: 1.5, coin_mult: 1.3, features: ["3000 токенов/5ч", "Улучшенный AI", "+50% XP"] },
    premium: { name: "Премиум", icon: "💎", price_uzs: 59000, token_bonus: 8000, token_reset_mult: 3, xp_mult: 2, coin_mult: 1.8, features: ["8000 токенов/5ч", "Продвинутый AI", "+100% XP"] },
    ultimate: { name: "Ультимат", icon: "🚀", price_uzs: 99000, token_bonus: 999999, token_reset_mult: 999, xp_mult: 3, coin_mult: 2.5, features: ["Безлимит токенов", "Лучший AI", "+200% XP"] }
};

const RANKS = {
    none: { name: "Обычный", icon: "⬜", color: "#888", token_bonus: 0, xp_mult: 1, coin_mult: 1, price_coins: 0, xp_required: 0 },
    silver: { name: "Серебро", icon: "🥈", color: "#C0C0C0", token_bonus: 200, xp_mult: 1.3, coin_mult: 1.2, price_coins: 500, xp_required: 0 },
    gold: { name: "Золото", icon: "🥇", color: "#FFD700", token_bonus: 500, xp_mult: 1.8, coin_mult: 1.5, price_coins: 1500, xp_required: 500 },
    diamond: { name: "Алмаз", icon: "💎", color: "#B9F2FF", token_bonus: 1000, xp_mult: 2.5, coin_mult: 2, price_coins: 4000, xp_required: 2000 }
};

const PLAN_COLORS = { free: "#94a3b8", basic: "#60a5fa", starter: "#60a5fa", premium: "#a78bfa", ultimate: "#f5c842", vip: "#f5c842" };
const PLAN_LABELS = { free: "Бесплатно", basic: "Базовый", starter: "Стартер", premium: "Премиум", ultimate: "Ультимат", vip: "VIP" };

// ══════════════════════════════════════════════════════════════
// СОСТОЯНИЕ
// ══════════════════════════════════════════════════════════════
let CU = null;
let UP = 'free';
let UTokens = 1000, UMaxTokens = 1000, ULastReset = 0;
let UXP = 0, UCoin = 0, URank = 'none';
let UOwnedRanks = [], UOwnedTags = [], UActiveTags = [];
let UProg = {};
let USk = { reading: 0, writing: 0, speaking: 0, listening: 0, grammar: 0 };
let UStats = { unitsCompleted: 0, totalSessions: 0, streak: 0, totalXP: 0, totalCoins: 0 };

let chatHist = [];
let chatMode = 'free';
let curLevel = 'beginner';
let curUnit = null;
let curLesson = null;
let lScore = 0, lTotal = 0;
let lexSel = {}, rSel = {}, woAns = [], lessonMics = {};
let mSel = { e: null, u: null, eEl: null, uEl: null };

let flashDeck = [], flashIdx = 0, flashCorrect = 0, flashWrong = 0;
let quizScore = 0, curQuizWord = null, quizAnswered = false;
let matchPairs = [], matchMatched = [], matchSel1 = null;
let typingDeck = [], typingIdx = 0;
let grammarScore2 = 0, grammarAnswered = false, curGrammarIdx = 0;

let wOff = 0, wFilt = 'all', wSrch = '';
let lbUnsubscribe = null;
let dictSent = '';

// ══════════════════════════════════════════════════════════════
// БАЗА СЛОВ (500+ слов — русский ↔ узбекский)
// ══════════════════════════════════════════════════════════════
const WDB = [
    // BEGINNER
    { e: 'привет', u: 'Salom', t: 'undov', l: 'beginner', ex: 'Привет, как дела?', eu: "Salom, qandaysiz?" },
    { e: 'здравствуйте', u: 'Assalomu alaykum', t: 'ibora', l: 'beginner', ex: 'Здравствуйте, рад вас видеть!', eu: "Assalomu alaykum, sizni ko'rishdan xursandman!" },
    { e: 'пока', u: 'Xayr', t: 'undov', l: 'beginner', ex: 'Пока, до завтра!', eu: "Xayr, ertaga ko'rishguncha!" },
    { e: 'спасибо', u: 'Rahmat', t: 'undov', l: 'beginner', ex: 'Спасибо за помощь.', eu: "Yordam uchun rahmat." },
    { e: 'пожалуйста', u: 'Iltimos / Rica qilaman', t: 'undov', l: 'beginner', ex: 'Дайте мне воды, пожалуйста.', eu: "Iltimos, menga suv bering." },
    { e: 'да', u: 'Ha', t: 'ravish', l: 'beginner', ex: 'Да, я понимаю.', eu: "Ha, tushundim." },
    { e: 'нет', u: "Yo'q", t: 'ravish', l: 'beginner', ex: 'Нет, я не знаю.', eu: "Yo'q, bilmayman." },
    { e: 'хорошо', u: 'Yaxshi', t: 'sifat', l: 'beginner', ex: 'Хорошо, договорились!', eu: "Yaxshi, kelishildi!" },
    { e: 'плохо', u: 'Yomon', t: 'sifat', l: 'beginner', ex: 'Сегодня я плохо себя чувствую.', eu: "Bugun o'zimni yomon his qilyapman." },
    { e: 'большой', u: 'Katta', t: 'sifat', l: 'beginner', ex: 'Это большой дом.', eu: "Bu katta uy." },
    { e: 'маленький', u: 'Kichik', t: 'sifat', l: 'beginner', ex: 'У меня маленькая собака.', eu: "Menda kichkina it bor." },
    { e: 'красный', u: 'Qizil', t: 'sifat', l: 'beginner', ex: 'Мне нравятся красные яблоки.', eu: "Men qizil olmalarni yaxshi ko'raman." },
    { e: 'синий', u: "Ko'k", t: 'sifat', l: 'beginner', ex: 'Небо синее.', eu: "Osmon ko'k." },
    { e: 'зелёный', u: 'Yashil', t: 'sifat', l: 'beginner', ex: 'Трава зелёная.', eu: "O't yashil." },
    { e: 'белый', u: 'Oq', t: 'sifat', l: 'beginner', ex: 'Снег белый.', eu: "Qor oq." },
    { e: 'чёрный', u: 'Qora', t: 'sifat', l: 'beginner', ex: 'У неё чёрные волосы.', eu: "Uning qora sochlari bor." },
    { e: 'один', u: 'Bir', t: 'son', l: 'beginner', ex: 'У меня одна сестра.', eu: "Menda bitta singil bor." },
    { e: 'два', u: 'Ikki', t: 'son', l: 'beginner', ex: 'У меня два кота.', eu: "Menda ikki mushuk bor." },
    { e: 'три', u: 'Uch', t: 'son', l: 'beginner', ex: 'У неё три книги.', eu: "Uning uch kitobi bor." },
    { e: 'четыре', u: "To'rt", t: 'son', l: 'beginner', ex: 'В доме четыре комнаты.', eu: "Uyda to'rt xona bor." },
    { e: 'пять', u: 'Besh', t: 'son', l: 'beginner', ex: 'Мне пять лет.', eu: "Men besh yoshdaman." },
    { e: 'мама', u: 'Ona', t: 'ot', l: 'beginner', ex: 'Моя мама — учитель.', eu: "Onam o'qituvchi." },
    { e: 'папа', u: 'Ota', t: 'ot', l: 'beginner', ex: 'Папа работает много.', eu: "Dadam ko'p ishlaydi." },
    { e: 'брат', u: 'Aka / Uka', t: 'ot', l: 'beginner', ex: 'Мой брат любит футбол.', eu: "Akam futbolni yaxshi ko'radi." },
    { e: 'сестра', u: 'Opa / Singil', t: 'ot', l: 'beginner', ex: 'Моей сестре 10 лет.', eu: "Singlim 10 yoshda." },
    { e: 'вода', u: 'Suv', t: 'ot', l: 'beginner', ex: 'Дайте мне воды.', eu: "Menga suv bering." },
    { e: 'хлеб', u: 'Non', t: 'ot', l: 'beginner', ex: 'Она печёт свежий хлеб.', eu: "U yangi non yopadi." },
    { e: 'молоко', u: 'Sut', t: 'ot', l: 'beginner', ex: 'Я пью молоко каждый день.', eu: "Men har kuni sut ichaman." },
    { e: 'яблоко', u: 'Olma', t: 'ot', l: 'beginner', ex: 'Я ем яблоко каждый день.', eu: "Men har kuni olma yeyman." },
    { e: 'школа', u: 'Maktab', t: 'ot', l: 'beginner', ex: 'Я хожу в школу каждый день.', eu: "Men har kuni maktabga boraman." },
    { e: 'книга', u: 'Kitob', t: 'ot', l: 'beginner', ex: 'Это интересная книга.', eu: "Bu qiziqarli kitob." },
    { e: 'собака', u: 'It', t: 'ot', l: 'beginner', ex: 'У меня добрая собака.', eu: "Menda mehribon it bor." },
    { e: 'кошка', u: 'Mushuk', t: 'ot', l: 'beginner', ex: 'Кошка спит.', eu: "Mushuk uxlayapti." },
    { e: 'понедельник', u: 'Dushanba', t: 'ot', l: 'beginner', ex: 'В понедельник у меня урок.', eu: "Dushanbada darsim bor." },
    { e: 'вторник', u: 'Seshanba', t: 'ot', l: 'beginner', ex: 'Во вторник мы встречаемся.', eu: "Seshanbada uchrashAmiz." },
    { e: 'среда', u: 'Chorshanba', t: 'ot', l: 'beginner', ex: 'Среда — середина недели.', eu: "Chorshanba — haftaning o'rtasi." },
    { e: 'четверг', u: 'Payshanba', t: 'ot', l: 'beginner', ex: 'В четверг у меня экзамен.', eu: "Payshanbada imtihon bor." },
    { e: 'пятница', u: 'Juma', t: 'ot', l: 'beginner', ex: 'В пятницу мы отдыхаем.', eu: "Juma kuni dam olamiz." },
    { e: 'суббота', u: 'Shanba', t: 'ot', l: 'beginner', ex: 'В субботу я отдыхаю.', eu: "Shanba kuni dam olaman." },
    { e: 'воскресенье', u: 'Yakshanba', t: 'ot', l: 'beginner', ex: 'Воскресенье — выходной день.', eu: "Yakshanba — dam olish kuni." },
    { e: 'утро', u: 'Ertalab', t: 'ot', l: 'beginner', ex: 'Доброе утро!', eu: "Xayrli tong!" },
    { e: 'день', u: 'Kun', t: 'ot', l: 'beginner', ex: 'Хорошего дня!', eu: "Yaxshi kun!" },
    { e: 'вечер', u: 'Kechqurun', t: 'ot', l: 'beginner', ex: 'Добрый вечер!', eu: "Xayrli kech!" },
    { e: 'ночь', u: 'Kecha', t: 'ot', l: 'beginner', ex: 'Спокойной ночи!', eu: "Yaxshi kechalar!" },
    { e: 'идти', u: 'Yurmoq / Bormoq', t: "fe'l", l: 'beginner', ex: 'Я иду в школу.', eu: "Men maktabga borayapman." },
    { e: 'есть', u: 'Yemoq', t: "fe'l", l: 'beginner', ex: 'Мы едим ужин в 7.', eu: "Biz soat 7 da kechki ovqat yeymiz." },
    { e: 'пить', u: 'Ichmoq', t: "fe'l", l: 'beginner', ex: 'Он пьёт кофе.', eu: "U qahva ichadi." },
    { e: 'спать', u: 'Uxlamoq', t: "fe'l", l: 'beginner', ex: 'Дети спят рано.', eu: "Bolalar erta uxlashadi." },
    { e: 'читать', u: "O'qimoq", t: "fe'l", l: 'beginner', ex: 'Я люблю читать книги.', eu: "Kitob o'qishni yaxshi ko'raman." },
    { e: 'писать', u: 'Yozmoq', t: "fe'l", l: 'beginner', ex: 'Напишите своё имя.', eu: "Ismingizni yozing." },
    { e: 'слушать', u: 'Eshitmoq', t: "fe'l", l: 'beginner', ex: 'Слушайте внимательно.', eu: "Diqqat bilan eshiting." },
    { e: 'говорить', u: 'Gapirmoq', t: "fe'l", l: 'beginner', ex: 'Он хорошо говорит по-русски.', eu: "U ruscha yaxshi gapiradi." },
    { e: 'знать', u: 'Bilmoq', t: "fe'l", l: 'beginner', ex: 'Я знаю ответ.', eu: "Men javobni bilaman." },
    { e: 'видеть', u: "Ko'rmoq", t: "fe'l", l: 'beginner', ex: 'Я вижу тебя.', eu: "Men seni ko'ryapman." },
    { e: 'хотеть', u: 'Xohlamoq', t: "fe'l", l: 'beginner', ex: 'Я хочу есть.', eu: "Men yemoqchi." },
    { e: 'любить', u: "Sevmoq", t: "fe'l", l: 'beginner', ex: 'Я люблю музыку.', eu: "Men musiqa sevaman." },
    { e: 'жить', u: 'Yashamoq', t: "fe'l", l: 'beginner', ex: 'Я живу в Ташкенте.', eu: "Men Toshkentda yashayman." },
    { e: 'работать', u: 'Ishlash', t: "fe'l", l: 'beginner', ex: 'Я работаю каждый день.', eu: "Men har kuni ishlayman." },
    { e: 'учиться', u: "O'rganmoq", t: "fe'l", l: 'beginner', ex: 'Он учится в университете.', eu: "U universitetda o'qiydi." },
    { e: 'играть', u: "O'ynamoq", t: "fe'l", l: 'beginner', ex: 'Дети любят играть.', eu: "Bolalar o'ynashni yaxshi ko'rishadi." },
    { e: 'имя', u: 'Ism', t: 'ot', l: 'beginner', ex: 'Как ваше имя?', eu: "Ismingiz nima?" },
    { e: 'город', u: 'Shahar', t: 'ot', l: 'beginner', ex: 'Ташкент — красивый город.', eu: "Toshkent chiroyli shahar." },
    { e: 'страна', u: 'Mamlakat', t: 'ot', l: 'beginner', ex: 'Узбекистан — моя страна.', eu: "O'zbekiston mening mamlakatim." },
    { e: 'дом', u: 'Uy', t: 'ot', l: 'beginner', ex: 'Мой дом большой.', eu: "Mening uyim katta." },
    { e: 'машина', u: 'Mashina', t: 'ot', l: 'beginner', ex: 'У папы красная машина.', eu: "Dadamning qizil mashinasi bor." },
    { e: 'деньги', u: 'Pul', t: 'ot', l: 'beginner', ex: 'У тебя есть деньги?', eu: "Puling bormi?" },
    { e: 'друг', u: "Do'st", t: 'ot', l: 'beginner', ex: 'Он мой лучший друг.', eu: "U mening eng yaxshi do'stim." },
    { e: 'учитель', u: "O'qituvchi", t: 'ot', l: 'beginner', ex: 'Мой учитель добрый.', eu: "Mening o'qituvchim mehribon." },
    { e: 'студент', u: "Talaba", t: 'ot', l: 'beginner', ex: 'Она хорошая студентка.', eu: "U yaxshi talaba." },
    { e: 'солнце', u: 'Quyosh', t: 'ot', l: 'beginner', ex: 'Сегодня светит солнце.', eu: "Bugun quyosh chiqyapti." },
    { e: 'снег', u: 'Qor', t: 'ot', l: 'beginner', ex: 'Зимой идёт снег.', eu: "Qishda qor yog'adi." },
    { e: 'дождь', u: "Yomg'ir", t: 'ot', l: 'beginner', ex: 'Сегодня идёт дождь.', eu: "Bugun yomg'ir yog'yapti." },
    { e: 'цветок', u: 'Gul', t: 'ot', l: 'beginner', ex: 'У неё красивые цветы.', eu: "Uning chiroyli gullari bor." },
    { e: 'дерево', u: 'Daraxt', t: 'ot', l: 'beginner', ex: 'Дерево очень высокое.', eu: "Daraxt juda baland." },
    { e: 'птица', u: 'Qush', t: 'ot', l: 'beginner', ex: 'Птица поёт.', eu: "Qush sayrayapti." },
    { e: 'рыба', u: 'Baliq', t: 'ot', l: 'beginner', ex: 'Мне нравится есть рыбу.', eu: "Men baliq yeyishni yaxshi ko'raman." },
    // ELEMENTARY
    { e: 'спальня', u: 'Yotoqxona', t: 'ot', l: 'elementary', ex: 'Моя спальня уютная.', eu: "Yotoqxonam qulay." },
    { e: 'кухня', u: 'Oshxona', t: 'ot', l: 'elementary', ex: 'Она готовит на кухне.', eu: "U oshxonada ovqat pishiradi." },
    { e: 'ванная', u: 'Hammom', t: 'ot', l: 'elementary', ex: 'Ванная чистая.', eu: "Hammom toza." },
    { e: 'врач', u: 'Shifokor', t: 'ot', l: 'elementary', ex: 'Врач осмотрел пациента.', eu: "Shifokor bemorni tekshirdi." },
    { e: 'инженер', u: 'Muhandis', t: 'ot', l: 'elementary', ex: 'Он стал инженером.', eu: "U muhandis bo'ldi." },
    { e: 'дорогой', u: 'Qimmat', t: 'sifat', l: 'elementary', ex: 'Этот телефон очень дорогой.', eu: "Bu telefon juda qimmat." },
    { e: 'дешёвый', u: 'Arzon', t: 'sifat', l: 'elementary', ex: 'Эти туфли дешёвые.', eu: "Bu poyabzallar arzon." },
    { e: 'красивый', u: "Go'zal", t: 'sifat', l: 'elementary', ex: 'Какой красивый день!', eu: "Qanday go'zal kun!" },
    { e: 'интересный', u: 'Qiziqarli', t: 'sifat', l: 'elementary', ex: 'Это интересная история.', eu: "Bu qiziqarli hikoya." },
    { e: 'трудный', u: 'Qiyin', t: 'sifat', l: 'elementary', ex: 'Этот экзамен очень трудный.', eu: "Bu imtihon juda qiyin." },
    { e: 'лёгкий', u: 'Oson', t: 'sifat', l: 'elementary', ex: 'Это упражнение лёгкое.', eu: "Bu mashq oson." },
    { e: 'путешествовать', u: 'Sayohat qilmoq', t: "fe'l", l: 'elementary', ex: 'Я люблю путешествовать.', eu: "Men sayohat qilishni yaxshi ko'raman." },
    { e: 'музыка', u: 'Musiqa', t: 'ot', l: 'elementary', ex: 'Я слушаю музыку каждый день.', eu: "Men har kuni musiqa eshitaman." },
    { e: 'погода', u: 'Ob-havo', t: 'ot', l: 'elementary', ex: 'Сегодня хорошая погода.', eu: "Bugun ob-havo yaxshi." },
    { e: 'компьютер', u: 'Kompyuter', t: 'ot', l: 'elementary', ex: 'Я использую компьютер.', eu: "Men kompyuterni ishlataman." },
    { e: 'больница', u: 'Kasalxona', t: 'ot', l: 'elementary', ex: 'Его отвезли в больницу.', eu: "Uni kasalxonaga olib ketishdi." },
    { e: 'ресторан', u: 'Restoran', t: 'ot', l: 'elementary', ex: 'Мы едим в ресторане.', eu: "Biz restoranda ovqatlanamiz." },
    { e: 'аэропорт', u: 'Aeroport', t: 'ot', l: 'elementary', ex: 'Аэропорт очень большой.', eu: "Aeroport juda katta." },
    { e: 'встреча', u: 'Uchrashuv', t: 'ot', l: 'elementary', ex: 'У меня встреча в 10.', eu: "Soat 10 da mening uchrashuv bor." },
    { e: 'покупки', u: 'Xarid', t: 'ot', l: 'elementary', ex: 'Она любит делать покупки.', eu: "U xarid qilishni yaxshi ko'radi." },
    { e: 'билет', u: 'Chipta', t: 'ot', l: 'elementary', ex: 'Я купил билет на поезд.', eu: "Men poyezd chiptasi sotib oldim." },
    { e: 'гостиница', u: 'Mehmonxona', t: 'ot', l: 'elementary', ex: 'Мы остановились в гостинице.', eu: "Biz mehmonxonada qoldik." },
    { e: 'меню', u: 'Menyu', t: 'ot', l: 'elementary', ex: 'Можно посмотреть меню?', eu: "Menyuni ko'rsam bo'ladimi?" },
    { e: 'скидка', u: 'Chegirma', t: 'ot', l: 'elementary', ex: 'Сегодня скидка 20%.', eu: "Bugun 20% chegirma bor." },
    { e: 'урок', u: 'Dars', t: 'ot', l: 'elementary', ex: 'Урок начинается в 9.', eu: "Dars soat 9 da boshlanadi." },
    { e: 'домашнее задание', u: 'Uy vazifasi', t: 'ot', l: 'elementary', ex: 'Я делаю домашнее задание.', eu: "Men uy vazifamni bajaraman." },
    { e: 'экзамен', u: 'Imtihon', t: 'ot', l: 'elementary', ex: 'Завтра у меня экзамен.', eu: "Ertaga imtihonÄ±m bor." },
    { e: 'оценка', u: 'Baho', t: 'ot', l: 'elementary', ex: 'Она получила хорошую оценку.', eu: "U yaxshi baho oldi." },
    { e: 'гора', u: "Tog'", t: 'ot', l: 'elementary', ex: 'Гора очень высокая.', eu: "Tog' juda baland." },
    { e: 'река', u: 'Daryo', t: 'ot', l: 'elementary', ex: 'Река красивая.', eu: "Daryo go'zal." },
    { e: 'море', u: 'Dengiz', t: 'ot', l: 'elementary', ex: 'Я люблю море.', eu: "Men dengizni yaxshi ko'raman." },
    { e: 'лес', u: "O'rmon", t: 'ot', l: 'elementary', ex: 'Лес тёмный и тихий.', eu: "O'rmon qorong'i va sokin." },
    { e: 'животное', u: 'Hayvon', t: 'ot', l: 'elementary', ex: 'Мой любимый зверь — лев.', eu: "Mening sevimli hayvon — sher." },
    { e: 'команда', u: 'Jamoa', t: 'ot', l: 'elementary', ex: 'Наша команда победила.', eu: "Bizning jamoamiz g'olib keldi." },
    { e: 'история', u: 'Hikoya / Tarix', t: 'ot', l: 'elementary', ex: 'Расскажи мне историю.', eu: "Menga hikoya aytib ber." },
    { e: 'смеяться', u: 'Kulmoq', t: "fe'l", l: 'elementary', ex: 'Она всегда меня смешит.', eu: "U har doim meni kuldiradi." },
    { e: 'плакать', u: "Yig'lamoq", t: "fe'l", l: 'elementary', ex: 'Не плачь, всё будет хорошо.', eu: "Yig'lama, hammasi yaxshi bo'ladi." },
    { e: 'объяснять', u: 'Tushuntirmoq', t: "fe'l", l: 'elementary', ex: 'Пожалуйста, объясни мне.', eu: "Iltimos, buni menga tushuntiring." },
    { e: 'соглашаться', u: 'Rozilik bildirmoq', t: "fe'l", l: 'elementary', ex: 'Я согласен с тобой.', eu: "Men siz bilan roziman." },
    { e: 'помнить', u: 'Eslamoq', t: "fe'l", l: 'elementary', ex: 'Я помню твоё имя.', eu: "Ismingizni eslayman." },
    { e: 'забывать', u: 'Unutmoq', t: "fe'l", l: 'elementary', ex: 'Не забудь ключи!', eu: "Kalitlaringizni unutmang!" },
    { e: 'обычно', u: 'Odatda', t: 'ravish', l: 'elementary', ex: 'Я обычно встаю в 7.', eu: "Men odatda soat 7 da uyg'onaman." },
    { e: 'иногда', u: "Ba'zan", t: 'ravish', l: 'elementary', ex: 'Она иногда смотрит фильмы.', eu: "U ba'zan film ko'radi." },
    { e: 'никогда', u: 'Hech qachon', t: 'ravish', l: 'elementary', ex: 'Я никогда не ем фастфуд.', eu: "Men hech qachon tez ovqat yemayman." },
    { e: 'всегда', u: 'Har doim', t: 'ravish', l: 'elementary', ex: 'Он всегда вовремя.', eu: "U har doim o'z vaqtida keladi." },
    { e: 'часто', u: 'Tez-tez', t: 'ravish', l: 'elementary', ex: 'Мы часто ходим гулять.', eu: "Biz tez-tez sayrga chiqamiz." },
    // PRE-INTERMEDIATE
    { e: 'однако', u: 'Biroq, ammo', t: 'bog.', l: 'pre-intermediate', ex: 'Было холодно, однако мы вышли.', eu: "Havo sovuq edi, biroq biz chiqdik." },
    { e: 'хотя', u: "Garchi...bo'lsa ham", t: 'bog.', l: 'pre-intermediate', ex: 'Хотя дождь шёл, мы играли.', eu: "Garchi yomg'ir yog'sa ham, o'yndik." },
    { e: 'поэтому', u: 'Shuning uchun', t: 'ravish', l: 'pre-intermediate', ex: 'Поэтому мы решили идти.', eu: "Shuning uchun borishga qaror qildik." },
    { e: 'более того', u: 'Bundan tashqari', t: 'ravish', l: 'pre-intermediate', ex: 'Более того, она талантлива.', eu: "Bundan tashqari, u iste'dodli." },
    { e: 'возможность', u: 'Imkoniyat', t: 'ot', l: 'pre-intermediate', ex: 'Это отличная возможность.', eu: "Bu ajoyib imkoniyat." },
    { e: 'исследование', u: 'Tadqiqot', t: 'ot', l: 'pre-intermediate', ex: 'Учёные проводят исследование.', eu: "Olimlar tadqiqot o'tkazadi." },
    { e: 'срок', u: 'Muddat', t: 'ot', l: 'pre-intermediate', ex: 'Срок сдачи — завтра.', eu: "Topshirish muddati ertaga." },
    { e: 'достижение', u: 'Yutuq', t: 'ot', l: 'pre-intermediate', ex: 'Это большое достижение.', eu: "Bu katta yutuq." },
    { e: 'уверенный', u: 'Ishonchli', t: 'sifat', l: 'pre-intermediate', ex: 'Будь уверен в себе.', eu: "O'zingizga ishoning." },
    { e: 'успешный', u: 'Muvaffaqiyatli', t: 'sifat', l: 'pre-intermediate', ex: 'Она успешная предпринимательница.', eu: "U muvaffaqiyatli ish ayoli." },
    { e: 'окружающая среда', u: 'Atrof-muhit', t: 'ot', l: 'pre-intermediate', ex: 'Надо защищать окружающую среду.', eu: "Atrof-muhitni himoya qilish kerak." },
    { e: 'технология', u: 'Texnologiya', t: 'ot', l: 'pre-intermediate', ex: 'Технологии меняют нашу жизнь.', eu: "Texnologiya hayotimizni o'zgartiradi." },
    { e: 'общество', u: 'Jamiyat', t: 'ot', l: 'pre-intermediate', ex: 'Общество быстро меняется.', eu: "Jamiyat tez o'zgarmoqda." },
    { e: 'образование', u: "Ta'lim", t: 'ot', l: 'pre-intermediate', ex: 'Образование — ключ к успеху.', eu: "Ta'lim — muvaffaqiyat kaliti." },
    { e: 'карьера', u: 'Karyera', t: 'ot', l: 'pre-intermediate', ex: 'Я хочу хорошую карьеру.', eu: "Men yaxshi karyera istayman." },
    { e: 'зарплата', u: 'Maosh', t: 'ot', l: 'pre-intermediate', ex: 'Его зарплата очень высокая.', eu: "Uning maoshi juda baland." },
    { e: 'коллега', u: 'Hamkasb', t: 'ot', l: 'pre-intermediate', ex: 'Мой коллега помогает мне.', eu: "Hamkasabim menga yordam beradi." },
    { e: 'собеседование', u: "Ish uchun suhbat", t: 'ot', l: 'pre-intermediate', ex: 'Завтра у меня собеседование.', eu: "Ertaga ish uchun suhbatim bor." },
    { e: 'опыт', u: 'Tajriba', t: 'ot', l: 'pre-intermediate', ex: 'Опыт работы важен.', eu: "Ish tajribasi muhim." },
    { e: 'навыки', u: "Ko'nikmalar", t: 'ot', l: 'pre-intermediate', ex: 'Вам нужны навыки общения.', eu: "Yaxshi muloqot ko'nikmalariga ega bo'lish kerak." },
    { e: 'управлять', u: 'Boshqarmoq', t: "fe'l", l: 'pre-intermediate', ex: 'Она управляет большой командой.', eu: "U katta jamoani boshqaradi." },
    { e: 'решать', u: 'Yechmoq', t: "fe'l", l: 'pre-intermediate', ex: 'Нам нужно решить эту проблему.', eu: "Biz bu muammoni yechishimiz kerak." },
    { e: 'достигать', u: 'Erishmoq', t: "fe'l", l: 'pre-intermediate', ex: 'Ты можешь достичь своих целей.', eu: "Maqsadlaringizga erisha olasiz." },
    { e: 'несмотря на', u: 'Qaramasdan', t: 'predl.', l: 'pre-intermediate', ex: 'Несмотря на дождь, мы играли.', eu: "Yomg'irga qaramasdan, o'yndik." },
    { e: 'если только', u: "Agar...bo'lmasa", t: 'bog.', l: 'pre-intermediate', ex: 'Если только не будешь учиться, не сдашь.', eu: "Agar o'qimasangiz, o'taolmaysiz." },
    { e: 'тем временем', u: 'Shu orada', t: 'ravish', l: 'pre-intermediate', ex: 'Тем временем он накрыл стол.', eu: "Shu orada u dasturxon yozdi." },
    // ADVANCED
    { e: 'нюанс', u: 'Noziklik', t: 'ot', l: 'advanced', ex: 'Нюанс её слов имел значение.', eu: "Uning so'zlarining nozikligi muhim edi." },
    { e: 'суверенитет', u: 'Suverenitet', t: 'ot', l: 'advanced', ex: 'Национальный суверенитет важен.', eu: "Milliy suverenitet muhimdir." },
    { e: 'красноречие', u: 'Notiqlik', t: 'ot', l: 'advanced', ex: 'Её красноречие впечатлило всех.', eu: "Uning notiqligi hammani hayratda qoldirdi." },
    { e: 'парадигма', u: 'Paradigma', t: 'ot', l: 'advanced', ex: 'Новая парадигма возникает.', eu: "Yangi paradigma paydo bo'lmoqda." },
    { e: 'корреляция', u: 'Korrelyatsiya', t: 'ot', l: 'advanced', ex: 'Корреляция не означает причинность.', eu: "Korrelyatsiya sababiyatni anglatmaydi." },
    { e: 'законодательство', u: 'Qonunchilik', t: 'ot', l: 'advanced', ex: 'Принят новый закон.', eu: "Yangi qonun qabul qilindi." },
    { e: 'смягчать', u: 'Yumshatmoq', t: "fe'l", l: 'advanced', ex: 'Нужно смягчить риски.', eu: "Biz xavflarni yumshatishimiz kerak." },
    { e: 'беспрецедентный', u: "Misli ko'rilmagan", t: 'sifat', l: 'advanced', ex: 'Это беспрецедентная ситуация.', eu: "Bu misli ko'rilmagan holat." },
    { e: 'педантичный', u: 'Puxta, ehtiyotkor', t: 'sifat', l: 'advanced', ex: 'Она педантична в работе.', eu: "U ishida puxta." },
    { e: 'неоднозначный', u: "Noaniq, ikki ma'noli", t: 'sifat', l: 'advanced', ex: 'Его заявление было неоднозначным.', eu: "Uning bayonoti noaniq edi." },
    { e: 'логичный', u: 'Izchil, mantiqiy', t: 'sifat', l: 'advanced', ex: 'Напишите логичный аргумент.', eu: "Izchil argument yozing." },
    { e: 'существенный', u: 'Muhim, sezilarli', t: 'sifat', l: 'advanced', ex: 'Есть существенные доказательства.', eu: "Jiddiy dalillar mavjud." },
    { e: 'катализатор', u: 'Katalizator', t: 'ot', l: 'advanced', ex: 'Изобретение стало катализатором перемен.', eu: "Ixtiro o'zgarish uchun katalizator bo'ldi." },
    { e: 'инфраструктура', u: 'Infratuzilma', t: 'ot', l: 'advanced', ex: 'Надо вложить в инфраструктуру.', eu: "Infratuzilmaga investitsiya qilish kerak." },
    { e: 'гипотеза', u: 'Faraz', t: 'ot', l: 'advanced', ex: 'Проверьте свою гипотезу.', eu: "Farazingizni sinab ko'ring." },
    { e: 'методология', u: 'Metodologiya', t: 'ot', l: 'advanced', ex: 'Объясните свою методологию.', eu: "Metodologiyangizni tushuntiring." },
    { e: 'феномен', u: 'Hodisa', t: 'ot', l: 'advanced', ex: 'Это глобальный феномен.', eu: "Bu global hodisa." },
    { e: 'перспектива', u: 'Nuqtai nazar', t: 'ot', l: 'advanced', ex: 'Рассмотрите иную перспективу.', eu: "Boshqa nuqtai nazarni ko'rib chiqing." },
    { e: 'риторика', u: 'Ritorika', t: 'ot', l: 'advanced', ex: 'Его риторика была мощной.', eu: "Uning ritorikasi kuchli edi." },
    { e: 'консенсус', u: 'Kelishuv', t: 'ot', l: 'advanced', ex: 'Мы достигли консенсуса.', eu: "Biz kelishuvga erishdik." },
    { e: 'отстаивать', u: 'Himoya qilmoq', t: "fe'l", l: 'advanced', ex: 'Она отстаивает права человека.', eu: "U inson huquqlarini himoya qiladi." },
    { e: 'облегчать', u: 'Osonlashtirmoq', t: "fe'l", l: 'advanced', ex: 'Технологии облегчают обучение.', eu: "Texnologiya o'rganishni osonlashtiradi." },
    { e: 'признавать', u: 'Tan olmoq', t: "fe'l", l: 'advanced', ex: 'Я признаю свою ошибку.', eu: "Xatoimni tan olaman." },
    { e: 'несмотря на это', u: 'Qaramasdan', t: 'predl.', l: 'advanced', ex: 'Несмотря на трудности, мы добились успеха.', eu: "Qiyinchiliklarga qaramasdan, muvaffaqiyat qozondik." },
    { e: 'правдоподобный', u: "Ishonchli ko'rinadigan", t: 'sifat', l: 'advanced', ex: 'Это звучит правдоподобно.', eu: "Bu ishonchli ko'rinadi." },
];

// ══════════════════════════════════════════════════════════════
// ДАННЫЕ ЮНИТОВ
// ══════════════════════════════════════════════════════════════
const UD_DATA = {
    beginner: [
        {
            id: 'rb1', emoji: '👋', title: 'Привет! Знакомство', desc: 'Приветствие, прощание, вежливые слова', level: 'beginner',
            words: ['привет', 'здравствуйте', 'пока', 'спасибо', 'пожалуйста', 'да', 'нет', 'хорошо', 'плохо', 'имя'],
            xp: 50, coin: 20,
            grammar_rule: 'Меня зовут... (Mening ismim...) | Мне ... лет (Men ... yoshdaman) | Я из... (Men ...dan)',
            grammar_example: 'Меня зовут Алишер. Мне 20 лет. Я из Ташкента. Рад познакомиться!',
            reading_text: 'Меня зовут Нилуфар. Я из Ташкента. Мне двадцать два года. Я студентка университета. Я изучаю русский язык. Мне нравится учить новые слова каждый день. Привет всем!',
            reading_qs: [
                { q: 'Откуда Нилуфар?', opts: ['Москва', 'Ташкент', 'Самарканд', 'Бухара'], c: 1 },
                { q: 'Сколько ей лет?', opts: ['20', '21', '22', '23'], c: 2 },
                { q: 'Что она изучает?', opts: ['Математику', 'Русский язык', 'Историю', 'Физику'], c: 1 }
            ]
        },
        {
            id: 'rb2', emoji: '🔢', title: 'Числа 1–20', desc: 'Цифры, счёт, количество', level: 'beginner',
            words: ['один', 'два', 'три', 'четыре', 'пять', 'школа', 'книга', 'мама', 'папа', 'дом'],
            xp: 50, coin: 20,
            grammar_rule: 'Числа в русском: один (1), два (2), три (3)... Числа согласуются с существительными по роду.',
            grammar_example: 'Один стол, два стула, три книги, четыре окна, пять студентов.',
            reading_text: 'У меня один брат и две сестры. В классе пятнадцать студентов. На столе три книги и четыре ручки. Я живу здесь уже пять лет. Сегодня первый день весны.',
            reading_qs: [
                { q: 'Сколько у него братьев?', opts: ['Один', 'Два', 'Три', 'Четыре'], c: 0 },
                { q: 'Сколько студентов в классе?', opts: ['10', '12', '15', '20'], c: 2 },
                { q: 'Сколько книг на столе?', opts: ['Два', 'Три', 'Четыре', 'Пять'], c: 1 }
            ]
        },
        {
            id: 'rb3', emoji: '🎨', title: 'Цвета и прилагательные', desc: 'Основные цвета и описания', level: 'beginner',
            words: ['красный', 'синий', 'зелёный', 'белый', 'чёрный', 'большой', 'маленький', 'красивый', 'хорошо', 'плохо'],
            xp: 60, coin: 25,
            grammar_rule: 'Прилагательные в русском согласуются с существительными по роду: красный дом (м.р.) / красная машина (ж.р.) / красное платье (ср.р.)',
            grammar_example: 'Красный дом. Синяя машина. Зелёное дерево. Белые цветы.',
            reading_text: 'Радуга имеет семь цветов: красный, оранжевый, жёлтый, зелёный, синий, голубой и фиолетовый. Красный — цвет огня. Синий — цвет неба. Зелёный — цвет деревьев. Белый — цвет снега.',
            reading_qs: [
                { q: 'Сколько цветов у радуги?', opts: ['Пять', 'Шесть', 'Семь', 'Восемь'], c: 2 },
                { q: 'Цвет неба?', opts: ['Красный', 'Жёлтый', 'Зелёный', 'Синий'], c: 3 },
                { q: 'Цвет снега?', opts: ['Синий', 'Красный', 'Белый', 'Зелёный'], c: 2 }
            ]
        },
        {
            id: 'rb4', emoji: '👨‍👩‍👧', title: 'Семья', desc: 'Члены семьи по-русски', level: 'beginner',
            words: ['мама', 'папа', 'брат', 'сестра', 'собака', 'кошка', 'дом', 'машина', 'книга', 'школа'],
            xp: 60, coin: 25,
            grammar_rule: 'Притяжательные местоимения: мой (м.р.), моя (ж.р.), моё (ср.р.), мои (мн.ч.) | Мой папа, моя мама, моё имя, мои книги.',
            grammar_example: 'Мой папа — врач. Моя мама — учительница. Моё имя — Камол. Мои книги интересные.',
            reading_text: 'В моей семье пять человек. Папа работает врачом, мама — учительница. У меня есть брат и сестра. Бабушка и дедушка живут рядом. Мы навещаем их каждое воскресенье.',
            reading_qs: [
                { q: 'Сколько человек в семье?', opts: ['Три', 'Четыре', 'Пять', 'Шесть'], c: 2 },
                { q: 'Кем работает папа?', opts: ['Учитель', 'Врач', 'Инженер', 'Водитель'], c: 1 },
                { q: 'Когда навещают бабушку?', opts: ['В субботу', 'В воскресенье', 'В понедельник', 'В пятницу'], c: 1 }
            ]
        },
        {
            id: 'rb5', emoji: '🍎', title: 'Еда и напитки', desc: 'Продукты, блюда, напитки', level: 'beginner',
            words: ['яблоко', 'хлеб', 'молоко', 'есть', 'пить', 'любить', 'хотеть', 'вода', 'дом', 'утро'],
            xp: 70, coin: 30,
            grammar_rule: 'Исчисляемые и неисчисляемые: яблоко / яблоки (мн.ч.), вода (не считается). Я ем яблоко. Я пью воду.',
            grammar_example: 'Я ем яблоко и пью молоко. Она хочет хлеб и воду.',
            reading_text: 'Здоровый завтрак очень важен. Многие люди едят яйца и хлеб по утрам. Чай и кофе — популярные напитки. Молоко полезно для детей. Пейте достаточно воды каждый день.',
            reading_qs: [
                { q: 'Что важно по утрам?', opts: ['Ужин', 'Обед', 'Завтрак', 'Перекус'], c: 2 },
                { q: 'Что полезно для детей?', opts: ['Кофе', 'Чай', 'Молоко', 'Сок'], c: 2 },
                { q: 'Какая еда упоминается?', opts: ['Рис', 'Суп', 'Яйца и хлеб', 'Пицца'], c: 2 }
            ]
        },
        {
            id: 'rb6', emoji: '⏰', title: 'Дни недели и время', desc: 'Дни, месяцы, время суток', level: 'beginner',
            words: ['понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота', 'воскресенье', 'утро', 'вечер', 'ночь'],
            xp: 65, coin: 26,
            grammar_rule: 'В + день недели: в понедельник, во вторник. Части суток: утром, днём, вечером, ночью.',
            grammar_example: 'В понедельник у меня урок русского. Утром я завтракаю. Вечером читаю книги.',
            reading_text: 'Моя рабочая неделя начинается в понедельник. Во вторник и четверг у меня занятия. В пятницу мы обычно отдыхаем. Суббота и воскресенье — выходные дни. Я люблю воскресное утро!',
            reading_qs: [
                { q: 'Когда выходные дни?', opts: ['Пн-Вт', 'Сб-Вс', 'Ср-Чт', 'Вт-Пт'], c: 1 },
                { q: 'Когда у него занятия?', opts: ['Пн и Ср', 'Вт и Чт', 'Ср и Пт', 'Пн и Пт'], c: 1 },
                { q: 'Что он любит?', opts: ['Вечер пятницы', 'Утро воскресенья', 'Ночь субботы', 'День понедельника'], c: 1 }
            ]
        },
    ],

    elementary: [
        {
            id: 're1', emoji: '🏡', title: 'Дом и комнаты', desc: 'Части дома, мебель', level: 'elementary',
            words: ['спальня', 'кухня', 'ванная', 'врач', 'инженер', 'дорогой', 'дешёвый', 'красивый', 'интересный', 'трудный'],
            xp: 80, coin: 35,
            grammar_rule: 'В + комната (предложный падеж): в спальне, на кухне, в ванной. Есть / нет + существительное.',
            grammar_example: 'В спальне стоит кровать. На кухне есть холодильник. В гостиной нет телевизора.',
            reading_text: 'Наша квартира небольшая, но очень уютная. В ней три комнаты: гостиная, спальня и детская. Кухня светлая. В гостиной стоит большой диван и телевизор. Мне нравится наш дом!',
            reading_qs: [
                { q: 'Сколько комнат в квартире?', opts: ['Два', 'Три', 'Четыре', 'Пять'], c: 1 },
                { q: 'Где стоит диван?', opts: ['Спальня', 'Кухня', 'Гостиная', 'Ванная'], c: 2 },
                { q: 'Какая квартира?', opts: ['Большая и шумная', 'Маленькая, но уютная', 'Старая и тёмная', 'Новая и большая'], c: 1 }
            ]
        },
        {
            id: 're2', emoji: '💼', title: 'Профессии', desc: 'Самые популярные профессии', level: 'elementary',
            words: ['врач', 'учитель', 'инженер', 'музыка', 'друг', 'погода', 'компьютер', 'путешествовать', 'красивый', 'интересный'],
            xp: 80, coin: 35,
            grammar_rule: 'Кем работает? — Он работает врачом/учителем (творительный падеж). Кто ты по профессии?',
            grammar_example: 'Мой отец работает инженером. Моя мама — учительница. Я хочу стать врачом.',
            reading_text: 'В нашем городе много специалистов. Папа — инженер на заводе. Мама работает врачом в больнице. Мой брат — программист в IT-компании. Я хочу стать журналистом!',
            reading_qs: [
                { q: 'Кем работает папа?', opts: ['Врач', 'Инженер', 'Учитель', 'Программист'], c: 1 },
                { q: 'Где работает мама?', opts: ['Завод', 'Школа', 'Больница', 'Офис'], c: 2 },
                { q: 'Кем хочет стать автор?', opts: ['Инженером', 'Врачом', 'Журналистом', 'Программистом'], c: 2 }
            ]
        },
        {
            id: 're3', emoji: '🛒', title: 'Покупки', desc: 'В магазине, цены, торговля', level: 'elementary',
            words: ['дорогой', 'дешёвый', 'красивый', 'трудный', 'лёгкий', 'путешествовать', 'музыка', 'друг', 'погода', 'компьютер'],
            xp: 90, coin: 40,
            grammar_rule: 'Сколько стоит? — It costs... Я хочу купить... — I want to buy... Дайте, пожалуйста... — Please give me...',
            grammar_example: '— Сколько стоит этот хлеб? — Тридцать рублей. — Хорошо, дайте, пожалуйста!',
            reading_text: 'Сегодня я ходил в супермаркет. Я купил хлеб, молоко и яблоки. Хлеб стоил тридцать рублей. Молоко — сорок. Яблоки были дешёвые — двадцать рублей за килограмм. Всего девяносто рублей.',
            reading_qs: [
                { q: 'Куда ходил автор?', opts: ['Рынок', 'Аптека', 'Супермаркет', 'Ресторан'], c: 2 },
                { q: 'Сколько стоит молоко?', opts: ['20 р.', '30 р.', '40 р.', '50 р.'], c: 2 },
                { q: 'Сколько всего?', opts: ['70 р.', '80 р.', '90 р.', '100 р.'], c: 2 }
            ]
        },
    ],

    'pre-intermediate': [
        {
            id: 'rp1', emoji: '🔮', title: 'Планы на будущее', desc: 'Будущее время, цели, намерения', level: 'pre-intermediate',
            words: ['однако', 'хотя', 'поэтому', 'более того', 'возможность', 'достижение', 'уверенный', 'успешный', 'карьера', 'опыт'],
            xp: 130, coin: 60,
            grammar_rule: 'Будущее время: буду + инфинитив (буду работать). Собираюсь + инфинитив (собираюсь поехать). Хочу + инфинитив.',
            grammar_example: 'Я буду работать врачом. Я собираюсь поехать в Москву. Я хочу научиться петь.',
            reading_text: 'В следующем году я планирую поехать в Москву. Я хочу посмотреть Красную площадь и Кремль. Я также собираюсь записаться на курсы русского языка. В будущем я мечтаю работать в международной компании.',
            reading_qs: [
                { q: 'Куда планирует поехать?', opts: ['Санкт-Петербург', 'Москву', 'Казань', 'Сочи'], c: 1 },
                { q: 'На что хочет записаться?', opts: ['Спорт', 'Музыка', 'Курсы русского', 'Рисование'], c: 2 },
                { q: 'О чём он мечтает?', opts: ['Путешествия', 'Работа в международной компании', 'Учёба', 'Семья'], c: 1 }
            ]
        },
        {
            id: 'rp2', emoji: '🎯', title: 'Виды глаголов (НСВ/СВ)', desc: 'Несовершенный и совершенный вид', level: 'pre-intermediate',
            words: ['однако', 'хотя', 'поэтому', 'более того', 'возможность', 'достижение', 'опыт', 'навыки', 'карьера', 'зарплата'],
            xp: 140, coin: 65,
            grammar_rule: 'НСВ (несов.вид) = процесс, повторяемость: читал, читает. СВ (сов.вид) = завершённость: прочитал, прочитает.',
            grammar_example: 'Я читал книгу (процесс). Я прочитал книгу (завершил). Он писал — Он написал.',
            reading_text: 'Вчера я делал домашнее задание три часа. Наконец я сделал всё и пошёл гулять. Я читал интересную книгу всю неделю. В пятницу я прочитал её до конца. Это был детектив!',
            reading_qs: [
                { q: 'Когда закончил домашнее задание?', opts: ['Утром', 'Через час', 'В конце концов', 'Никогда'], c: 2 },
                { q: 'Когда дочитал книгу?', opts: ['В понедельник', 'В среду', 'В пятницу', 'В субботу'], c: 2 },
                { q: 'Какой жанр книги?', opts: ['Роман', 'Поэзия', 'Детектив', 'Биография'], c: 2 }
            ]
        },
    ],

    advanced: [
        {
            id: 'ra1', emoji: '🖊️', title: 'Академическое письмо', desc: 'Эссе, отчёты, структура', level: 'advanced',
            words: ['более того', 'однако', 'поэтому', 'нюанс', 'красноречие', 'смягчать', 'беспрецедентный', 'педантичный', 'возможность', 'хотя'],
            xp: 200, coin: 90,
            grammar_rule: 'Средства связи: более того (кроме того), однако (но), поэтому (следовательно), несмотря на это (хотя). Структура: тезис → аргумент → вывод.',
            grammar_example: 'Данные подтверждают гипотезу. Более того, предыдущие исследования согласуются с этими выводами.',
            reading_text: 'Академическое письмо требует точности и логичности. Каждый аргумент должен быть подкреплён доказательствами. Средства связи соединяют идеи: «более того» добавляет информацию, «однако» вводит контраст. Структура абзаца: тезис, доказательство, пояснение, вывод.',
            reading_qs: [
                { q: 'Что вводит «однако»?', opts: ['Дополнение', 'Контраст', 'Результат', 'Пример'], c: 1 },
                { q: 'Из чего состоит структура абзаца?', opts: ['Вопрос-ответ', 'Тезис-доказательство-пояснение-вывод', 'Только факты', 'Мнение и вывод'], c: 1 },
                { q: 'На что должен опираться каждый аргумент?', opts: ['Мнение', 'Доказательства', 'Вопросы', 'Цитаты'], c: 1 }
            ]
        },
        {
            id: 'ra2', emoji: '📋', title: 'ТРКИ / ТОРФЛ подготовка', desc: 'Стратегии экзамена по русскому', level: 'advanced',
            words: ['более того', 'однако', 'поэтому', 'нюанс', 'красноречие', 'смягчать', 'беспрецедентный', 'педантичный', 'возможность', 'хотя'],
            xp: 250, coin: 110,
            grammar_rule: 'ТРКИ: Задание 1 — описание данных. Задание 2 — аргументированное эссе. Полезные фразы: «в тексте говорится о...», «автор утверждает, что...»',
            grammar_example: 'В целом, использование интернета резко возросло с 2000 по 2020 год.',
            reading_text: 'ТРКИ — международный экзамен по русскому языку. Он проверяет четыре навыка: чтение, письмо, говорение и аудирование. Хорошая подготовка требует регулярной практики. Читайте русские тексты, смотрите фильмы, говорите с носителями языка!',
            reading_qs: [
                { q: 'Сколько навыков проверяет ТРКИ?', opts: ['2', '3', '4', '5'], c: 2 },
                { q: 'Что нужно для подготовки?', opts: ['Только учебник', 'Регулярная практика', 'Один день занятий', 'Только грамматика'], c: 1 },
                { q: 'Что советует текст?', opts: ['Смотреть английские фильмы', 'Читать русские тексты и говорить с носителями', 'Только читать', 'Только слушать'], c: 1 }
            ]
        },
    ]
};

// ══════════════════════════════════════════════════════════════
// ГРАММАТИЧЕСКИЕ ЗАДАНИЯ
// ══════════════════════════════════════════════════════════════
const GRAMMAR_QS = [
    { q: "Она ___ в школу каждый день.", opts: ["идти", "идёт", "идут", "иду"], ans: "идёт", exp: "3-е лицо ед.ч.: она идёт" },
    { q: "Я ___ студент.", opts: ["am", "есть", "—", "быть"], ans: "—", exp: "В русском настоящем времени глагол «быть» обычно опускается: Я студент." },
    { q: "Они ___ мои друзья.", opts: ["есть", "—", "быть", "имеют"], ans: "—", exp: "Множественное число: Они мои друзья (глагол опускается)." },
    { q: "Он ___ книгу прямо сейчас.", opts: ["читает", "читал", "прочитал", "читать"], ans: "читает", exp: "Настоящее время: он читает (несовершенный вид, процесс)." },
    { q: "Я ___ в Ташкенте уже 5 лет.", opts: ["живу", "жил", "буду жить", "жить"], ans: "живу", exp: "Настоящее + уже = живу (продолжается до сих пор)." },
    { q: "Если бы у меня ___ время, я бы пришёл.", opts: ["есть", "было", "будет", "был"], ans: "было", exp: "Сослагательное наклонение: если бы + прошедшее время." },
    { q: "Отчёт ___ написан директором.", opts: ["есть", "был", "будет", "был бы"], ans: "был", exp: "Пассивный залог в прошедшем времени: был + краткое причастие." },
    { q: "Она — ___ студентка в группе.", opts: ["самая умная", "умнее", "более умная", "умно"], ans: "самая умная", exp: "Превосходная степень: самый/самая + прилагательное." },
    { q: "К завтрашнему утру я ___ работу.", opts: ["закончу", "буду заканчивать", "закончил", "заканчиваю"], ans: "закончу", exp: "СВ будущее время: закончу (к определённому моменту)." },
    { q: "___ она придёт, мы начнём ужин.", opts: ["Так как", "Пока", "Когда", "Во время"], ans: "Когда", exp: "Временной союз: Когда + настоящее время = будущее значение." },
    { q: "Он предложил, чтобы она ___ к врачу.", opts: ["пойти", "пошла", "идёт", "пойдёт"], ans: "пошла", exp: "Косвенное наклонение после «чтобы»: предложил, чтобы + пошла." },
    { q: "Я никогда не ___ в Лондоне.", opts: ["был", "бывал", "есть", "быть"], ans: "бывал", exp: "«Никогда» + бывал = опыт (многократность)." },
    { q: "Это ___ зонт.", opts: ["а", "—", "один", "какой-то"], ans: "—", exp: "В русском нет артиклей (а/an/the). Просто: Это зонт." },
    { q: "Не только она поёт, но и ___.", opts: ["танцует", "танцевать", "танцуя", "танец"], ans: "танцует", exp: "Не только... но и... — оба глагола в одной форме." },
    { q: "Чем больше работаешь, ___ достигаешь.", opts: ["больше", "тем больше", "много", "самое большое"], ans: "тем больше", exp: "Двойное сравнение: чем + сравн.степень... тем + сравн.степень." },
];

// ══════════════════════════════════════════════════════════════
// УТИЛИТЫ
// ══════════════════════════════════════════════════════════════
function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

// ══════════════════════════════════════════════════════════════
// TTS — РУССКИЙ ГОЛОС
// ══════════════════════════════════════════════════════════════
window.speakWord = function (word, e) {
    if (e) e.stopPropagation();
    const u = new SpeechSynthesisUtterance(word);
    u.lang = 'ru-RU';
    u.rate = 0.85;
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
};
window.spk = window.speakWord;

// ══════════════════════════════════════════════════════════════
// УВЕДОМЛЕНИЯ
// ══════════════════════════════════════════════════════════════
window.showToast = function (msg, type = 'info') {
    const t = $id('toast'); if (!t) return;
    t.innerHTML = msg; t.className = `toast ${type} show`;
    setTimeout(() => t.classList.remove('show'), 3500);
};
function showToast(msg, type = 'info') { window.showToast(msg, type); }
function showXPPop(txt) {
    const e = $id('xpPopup'); if (!e) return;
    e.textContent = txt; e.classList.add('show');
    setTimeout(() => e.classList.remove('show'), 2500);
}

// ══════════════════════════════════════════════════════════════
// ТОКЕНЫ
// ══════════════════════════════════════════════════════════════
function getPlan() { return PLANS[UP] || PLANS.free; }
function getRank() { return RANKS[URank] || RANKS.none; }
function calcMaxTokens() { return getPlan().token_bonus + getRank().token_bonus; }

function checkTokenReset() {
    const resetMs = TOKEN_CONFIG.reset_hours * 3600000;
    const now = Date.now();
    if (now - ULastReset >= resetMs) {
        const newMax = calcMaxTokens();
        UTokens = newMax; UMaxTokens = newMax; ULastReset = now;
        saveTokenState(); renderTokenBar();
        showToast('⚡ Токены обновлены!', 'success');
    }
}

async function spendTokens(amount, reason) {
    if (UP === 'ultimate') return true;
    checkTokenReset();
    if (UTokens < amount) { showTokenEmptyModal(reason); return false; }
    UTokens -= amount;
    await saveTokenState(); renderTokenBar(); return true;
}

// 1 токен за каждый введённый символ в чате
window.chatInputKeyHandler = async function (e) {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        window.sendChatMessage();
        return;
    }
    // Только видимые символы (не стрелки, не backspace и т.д.)
    if (e.key.length === 1 && UP !== 'ultimate') {
        if (UTokens <= 0) {
            showTokenEmptyModal('Токены закончились — нельзя вводить текст');
            e.preventDefault();
            return;
        }
        UTokens = Math.max(0, UTokens - 1);
        await saveTokenState();
        renderTokenBar();
    }
};

async function saveTokenState() {
    if (!CU) return;
    try {
        await updateDoc(doc(_db, 'users', CU.uid), {
            tokens: UTokens, maxTokens: UMaxTokens,
            lastTokenReset: ULastReset, lastActive: serverTimestamp()
        });
    } catch (e) { console.warn(e); }
}

function getTokenTimeLeft() {
    const resetMs = TOKEN_CONFIG.reset_hours * 3600000;
    const diff = Math.max(0, (ULastReset + resetMs) - Date.now());
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function renderTokenBar() {
    const el = $id('aiLimitInfo'); if (!el) return;
    const pct = UP === 'ultimate' ? 100 : Math.round((UTokens / Math.max(1, UMaxTokens)) * 100);
    const color = pct > 50 ? '#34d399' : pct > 20 ? '#f4c74a' : '#f87171';
    const plan = getPlan(); const rank = getRank();
    el.innerHTML = `
        <div style="margin-bottom:8px;font-size:0.76rem;font-weight:700;color:#aaa">${rank.icon} ${rank.name} · ${plan.icon} ${plan.name}</div>
        <div style="font-size:0.72rem;color:#888;margin-bottom:4px">🎫 Токены: <strong style="color:${color}">${UP === 'ultimate' ? '∞' : UTokens}</strong>/${UP === 'ultimate' ? '∞' : UMaxTokens}</div>
        <div style="height:4px;background:rgba(255,255,255,0.07);border-radius:100px;overflow:hidden;margin-bottom:6px">
            <div style="height:100%;width:${pct}%;background:${color};border-radius:100px;transition:width 0.4s ease"></div>
        </div>
        ${UP !== 'ultimate' ? `<div style="font-size:0.68rem;color:#888;margin-bottom:6px">⏱ Обновление: <strong>${getTokenTimeLeft()}</strong></div>` : ''}`;

    const limitText = $id('limitText');
    const limitPills = $id('limitPills');
    const limitReset = $id('limitReset');

    if (UP === 'ultimate') {
        if (limitText) limitText.innerHTML = `<i class="fa-solid fa-infinity" style="margin-right:4px;color:#f5c842"></i>Безлимитные токены`;
        if (limitPills) limitPills.innerHTML = '';
        if (limitReset) limitReset.textContent = '';
    } else {
        if (limitText) limitText.innerHTML = `Токены: <b style="color:${UTokens > 5 ? '#34d399' : '#ef4444'}">${UTokens}</b> / ${UMaxTokens} (1 токен = 1 символ)`;
        const pillCount = Math.min(UMaxTokens, 10);
        const usedCount = Math.round(((UMaxTokens - UTokens) / UMaxTokens) * pillCount);
        let pills = '';
        for (let i = 0; i < pillCount; i++) pills += `<div class="lpill ${i < usedCount ? 'used' : 'ok'}"></div>`;
        if (limitPills) limitPills.innerHTML = pills;
        if (limitReset) limitReset.textContent = `${getTokenTimeLeft()} до обновления`;
    }
}

setInterval(() => { checkTokenReset(); renderTokenBar(); }, 10000);

// ══════════════════════════════════════════════════════════════
// МОДАЛЬНОЕ ОКНО — ТОКЕНЫ ЗАКОНЧИЛИСЬ
// ══════════════════════════════════════════════════════════════
function showTokenEmptyModal(reason) {
    const modal = $id('upgradeModal'); if (!modal) return;
    const textEl = $id('upgradeModalText');
    const timerEl = $id('upgradeTimer');
    if (textEl) textEl.innerHTML = `🎫 Токены закончились!<br><span style="font-size:0.8rem;color:#666">${reason || 'Нужны токены для продолжения'}</span>`;
    if (timerEl) {
        const upd = () => { timerEl.textContent = `⏱ Обновление: ${getTokenTimeLeft()}`; };
        upd();
        const timer = setInterval(() => { upd(); if (UTokens > 0) clearInterval(timer); }, 1000);
    }
    modal.classList.add('active');
}

window.closeUpgradeModal = function (e) {
    if (e && e.target !== $id('upgradeModal')) return;
    $id('upgradeModal')?.classList.remove('active');
};

// ══════════════════════════════════════════════════════════════
// FIREBASE — ЗАГРУЗКА / СОХРАНЕНИЕ
// ══════════════════════════════════════════════════════════════
async function loadUserData() {
    if (!CU) return;
    try {
        const snap = await getDoc(doc(_db, 'users', CU.uid));
        if (snap.exists()) {
            const d = snap.data();
            UP = d.plan || 'free';
            UTokens = d.tokens !== undefined ? d.tokens : calcMaxTokens();
            UMaxTokens = d.maxTokens || calcMaxTokens();
            ULastReset = d.lastTokenReset || Date.now();
            UXP = d.xp || 0;
            UCoin = d.coins || 0;
            URank = d.rank || 'none';
            UActiveTags = d.activeTags || [];
            UOwnedRanks = d.ownedRanks || [];
            UOwnedTags = d.ownedTags || [];
            UProg = d.progress || {};
            USk = d.skills || { reading: 0, writing: 0, speaking: 0, listening: 0, grammar: 0 };
            UStats = d.stats || { unitsCompleted: 0, totalSessions: 0, streak: 0, totalXP: 0, totalCoins: 0 };
        } else {
            const newData = {
                email: CU.email, displayName: CU.displayName || CU.email.split('@')[0],
                plan: 'free', tokens: TOKEN_CONFIG.default_tokens, maxTokens: TOKEN_CONFIG.default_tokens,
                lastTokenReset: Date.now(), xp: 0, totalXP: 0, coins: 0, totalCoins: 0,
                rank: 'none', activeTags: [], ownedRanks: ['none'], ownedTags: [],
                progress: {}, skills: { reading: 0, writing: 0, speaking: 0, listening: 0, grammar: 0 },
                stats: { unitsCompleted: 0, totalSessions: 0, streak: 0, totalXP: 0, totalCoins: 0 },
                createdAt: serverTimestamp()
            };
            await setDoc(doc(_db, 'users', CU.uid), newData);
            UTokens = TOKEN_CONFIG.default_tokens;
            UMaxTokens = TOKEN_CONFIG.default_tokens;
            ULastReset = Date.now();
        }
        checkTokenReset();
    } catch (e) { console.error('loadUserData error:', e); }
}

async function updateUserField(fields) {
    if (!CU) return;
    try { await updateDoc(doc(_db, 'users', CU.uid), { ...fields, lastActive: serverTimestamp() }); }
    catch (e) { console.warn(e); }
}

// ══════════════════════════════════════════════════════════════
// XP И МОНЕТЫ
// ══════════════════════════════════════════════════════════════
async function awardXP(base, skill) {
    const plan = getPlan(); const rank = getRank();
    const total = Math.round(base * plan.xp_mult * rank.xp_mult);
    UXP += total;
    USk[skill] = Math.min(100, (USk[skill] || 0) + 2);
    const coinFromXP = Math.floor(UXP / 100) - Math.floor((UXP - total) / 100);
    if (coinFromXP > 0) { UCoin += coinFromXP; showToast(`🪙 +${coinFromXP} монет (бонус XP)`, 'info'); }
    const updates = { xp: increment(total), totalXP: increment(total), [`skills.${skill}`]: USk[skill] };
    if (coinFromXP > 0) { updates.coins = increment(coinFromXP); updates.totalCoins = increment(coinFromXP); }
    await updateUserField(updates);
    updateDisplays(); showXPPop(`+${total} XP`);
}

function updateDisplays() {
    const xpEl = $id('xpDisplay');
    const coinEl = $id('coinDisplay');
    const rankEl = $id('rankDisplay');
    const tokenEl = $id('tokenDisplay');
    if (xpEl) xpEl.textContent = UXP;
    if (coinEl) coinEl.textContent = UCoin;
    if (rankEl) { const r = getRank(); rankEl.innerHTML = `<span style="color:${r.color}">${r.icon} ${r.name}</span>`; }
    if (tokenEl) tokenEl.textContent = UP === 'ultimate' ? '∞' : UTokens;
    renderTokenBar(); drawRadar();

    const navUInfo = $id('navUserInfo');
    const planBadge = $id('planBadgeNav');
    const plan = (UP || 'free').toLowerCase();
    const color = PLAN_COLORS[plan] || '#94a3b8';
    if (planBadge) planBadge.innerHTML = `<span style="padding:3px 10px;border-radius:12px;background:${color}22;border:1px solid ${color}55;color:${color};font-size:0.72rem;font-weight:700">${(PLAN_LABELS[plan] || plan).toUpperCase()}</span>`;
    if (navUInfo) navUInfo.innerHTML = `<div style="display:flex;align-items:center;gap:8px">
        <span style="font-size:0.8rem;color:#e8ecff;font-weight:600">${CU?.displayName || CU?.email || 'Пользователь'}</span>
        <span style="font-size:0.78rem;color:#f5c842">⭐ ${UXP.toLocaleString()}</span>
        <span style="font-size:0.78rem;color:#fbbf24">🪙 ${UCoin.toLocaleString()}</span>
    </div>`;

    // Синхронизация дравера
    const dXP = $id('drawerXP'); const dCoin = $id('drawerCoin'); const dName = $id('drawerUserName');
    if (dXP) dXP.textContent = UXP.toLocaleString();
    if (dCoin) dCoin.textContent = UCoin.toLocaleString();
    if (dName) dName.textContent = CU?.displayName || CU?.email || 'Пользователь';
}

// ══════════════════════════════════════════════════════════════
// ЛИДЕРБОРД
// ══════════════════════════════════════════════════════════════
window.loadLBSection = async function (field, btn) {
    if (btn) {
        document.querySelectorAll('#leaderboard-section .ptab').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
    }
    const container = $id('lbSectionContent'); if (!container) return;
    container.innerHTML = `<div style="text-align:center;padding:30px;color:#666"><i class="fa-solid fa-spinner fa-spin" style="font-size:1.5rem;color:#c0392b"></i><br>Загрузка...</div>`;
    try {
        const q = query(collection(_db, 'users'), orderBy(field, 'desc'), limit(20));
        const snap = await getDocs(q);
        const users = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        if (!users.length) { container.innerHTML = '<p style="text-align:center;color:#666">Пока никого нет</p>'; return; }
        const labels = { xp: 'XP', coins: 'Монеты', unitsCompleted: 'Юниты' };
        const icons = { xp: 'fa-star', coins: 'fa-coins', unitsCompleted: 'fa-book' };
        let html = `<div style="margin-bottom:16px;display:flex;justify-content:space-between;align-items:center">
            <span style="color:#666;font-size:0.8rem"><i class="fa-solid ${icons[field] || 'fa-trophy'}" style="margin-right:4px;color:#c0392b"></i>Рейтинг: ${labels[field] || field}</span>
            <span style="color:#666;font-size:0.78rem">${users.length} пользователей</span></div>`;
        users.forEach((u, i) => {
            const rank = i + 1;
            const isMe = u.id === CU?.uid;
            const rankClass = rank === 1 ? 'gold' : rank === 2 ? 'silver' : rank === 3 ? 'bronze' : '';
            const rankIcon = rank === 1
                ? '<i class="fa-solid fa-trophy" style="color:#f5c842"></i>'
                : rank === 2 ? '<i class="fa-solid fa-medal" style="color:#94a3b8"></i>'
                    : rank === 3 ? '<i class="fa-solid fa-medal" style="color:#cd7c4a"></i>'
                        : rank;
            const val = u[field] || 0;
            const planKey = (u.plan || 'free').toLowerCase();
            const pc = PLAN_COLORS[planKey] || '#94a3b8';
            const planLabel = PLAN_LABELS[planKey] || planKey.toUpperCase();
            const initial = (u.displayName || u.email || 'П').charAt(0).toUpperCase();
            html += `<div class="lb-row${isMe ? ' me' : ''}">
                <div class="lb-rank ${rankClass}">${rankIcon}</div>
                <div class="lb-avatar">${initial}</div>
                <div style="flex:1">
                    <div class="lb-name">${u.displayName || u.email || 'Пользователь'}${isMe ? ' <span style="color:#c0392b;font-size:0.72rem">(вы)</span>' : ''}</div>
                    ${planKey !== 'free' ? `<span class="lb-plan" style="border-color:${pc}44;color:${pc}">${planLabel}</span>` : ''}
                </div>
                <div style="text-align:right">
                    <div class="lb-score"><i class="fa-solid ${icons[field] || 'fa-star'}" style="margin-right:4px;color:#c0392b"></i>${val.toLocaleString()}</div>
                    <div class="lb-score-label">${labels[field] || field}</div>
                </div>
            </div>`;
        });
        container.innerHTML = html;
    } catch (e) {
        container.innerHTML = `<div style="text-align:center;padding:30px;color:#ef4444"><i class="fa-solid fa-triangle-exclamation"></i> Ошибка: ${e.message}<br><button onclick="window.loadLBSection('${field}',null)" style="margin-top:12px;padding:8px 16px;border-radius:8px;background:#c0392b22;border:1px solid #c0392b44;color:#c0392b;cursor:pointer">Повторить</button></div>`;
    }
};

// ══════════════════════════════════════════════════════════════
// AI — PROXY
// ══════════════════════════════════════════════════════════════
async function callAI(prompt, maxTok = 1000) {
    try {
        const r = await fetch(AI_PROXY, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ role: 'user', parts: [{ text: prompt }] }],
                generationConfig: { temperature: 0.7, maxOutputTokens: maxTok }
            })
        });
        if (!r.ok) { return `❗ Ошибка AI: ${r.status}.`; }
        const d = await r.json();
        return d.candidates?.[0]?.content?.parts?.[0]?.text || 'Ошибка получения ответа.';
    } catch (e) { return '❗ Ошибка подключения к AI.'; }
}

// ══════════════════════════════════════════════════════════════
// РАДАР НАВЫКОВ
// ══════════════════════════════════════════════════════════════
function drawRadar() {
    const canvas = $id('radarCanvas'); if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const cx = 110, cy = 110, r = 80;
    const skills = [USk.reading / 100, USk.writing / 100, USk.speaking / 100, USk.listening / 100, USk.grammar / 100].map(v => Math.max(0.05, v));
    const angles = Array.from({ length: 5 }, (_, i) => -Math.PI / 2 + i * Math.PI * 2 / 5);
    ctx.clearRect(0, 0, 220, 220);
    for (let i = 1; i <= 4; i++) {
        ctx.beginPath();
        angles.forEach((a, j) => {
            const x = cx + r * (i / 4) * Math.cos(a), y = cy + r * (i / 4) * Math.sin(a);
            j ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
        });
        ctx.closePath(); ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.stroke();
    }
    angles.forEach(a => {
        ctx.beginPath(); ctx.moveTo(cx, cy);
        ctx.lineTo(cx + r * Math.cos(a), cy + r * Math.sin(a));
        ctx.strokeStyle = 'rgba(255,255,255,0.1)'; ctx.stroke();
    });
    ctx.beginPath();
    angles.forEach((a, i) => {
        const x = cx + r * skills[i] * Math.cos(a), y = cy + r * skills[i] * Math.sin(a);
        i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    });
    ctx.closePath(); ctx.fillStyle = 'rgba(192,57,43,0.2)'; ctx.fill();
    ctx.strokeStyle = 'rgba(192,57,43,0.7)'; ctx.lineWidth = 2; ctx.stroke();
    angles.forEach((a, i) => {
        ctx.beginPath();
        ctx.arc(cx + r * skills[i] * Math.cos(a), cy + r * skills[i] * Math.sin(a), 4, 0, Math.PI * 2);
        ctx.fillStyle = '#c0392b'; ctx.fill();
    });
}

// ══════════════════════════════════════════════════════════════
// ЮНИТЫ
// ══════════════════════════════════════════════════════════════
window.switchLevel = function (level, el) {
    curLevel = level;
    document.querySelectorAll('.level-tab').forEach(t => t.classList.toggle('active', el ? t === el : t.dataset.level === level));
    renderUnits();
};

function renderUnits() {
    const grid = $id('unitsGrid'); if (!grid) return;
    const units = UD_DATA[curLevel] || [];
    grid.innerHTML = '';
    units.forEach((unit, i) => {
        const done = ['A', 'B', 'C', 'D'].filter(l => UProg[`${unit.id}_${l}`] >= 100).length;
        const pct = Math.round((done / 4) * 100);
        const isComp = pct === 100;
        const card = document.createElement('div');
        card.className = `unit-card${isComp ? ' completed' : ''}`;
        card.innerHTML = `
          <div style="font-size:0.75rem;color:#c0392b;margin-bottom:4px;font-weight:700">Юнит ${i + 1}</div>
          <div style="font-size:1.8rem;margin-bottom:8px">${unit.emoji}</div>
          <div style="font-weight:700;font-size:1rem;color:#e8ecff;margin-bottom:6px">${unit.title}</div>
          <div style="font-size:0.8rem;color:#666;margin-bottom:12px">${unit.desc}</div>
          <div style="display:flex;gap:8px;margin-bottom:10px">
            ${['A', 'B', 'C', 'D'].map(l => `<div style="width:24px;height:24px;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:0.7rem;font-weight:700;background:${UProg[unit.id + '_' + l] >= 100 ? 'rgba(52,211,153,0.2)' : 'rgba(255,255,255,0.05)'};border:1px solid ${UProg[unit.id + '_' + l] >= 100 ? '#34d399' : 'rgba(255,255,255,0.1)'};color:${UProg[unit.id + '_' + l] >= 100 ? '#34d399' : '#666'}">${l}</div>`).join('')}
          </div>
          <div style="height:3px;background:rgba(255,255,255,0.06);border-radius:100px;overflow:hidden;margin-bottom:8px">
            <div style="height:100%;width:${pct}%;background:linear-gradient(90deg,#c0392b,#f39c12);border-radius:100px;transition:width 0.4s"></div>
          </div>
          <div style="font-size:0.76rem;display:flex;gap:10px">
            <span style="color:#f5c842">+${unit.xp} XP</span>
            <span style="color:#fbbf24">+${unit.coin} 🪙</span>
            ${isComp ? '<span style="color:#34d399">✅</span>' : ''}
          </div>`;
        card.onmouseover = () => { card.style.background = 'rgba(192,57,43,0.08)'; card.style.borderColor = 'rgba(192,57,43,0.3)'; };
        card.onmouseout = () => { card.style.background = 'rgba(255,255,255,0.03)'; card.style.borderColor = 'rgba(255,255,255,0.08)'; };
        card.onclick = () => openUnit(unit);
        grid.appendChild(card);
    });
}

window.openUnit = function (unit) {
    curUnit = unit;
    const modal = $id('unitModal');
    const content = $id('modalContent');
    if (!modal || !content) return;
    const lnames = { A: "📖 Грамматика и словарь", B: "🎧 Аудирование", C: "📖 Чтение", D: "🎤 Говорение и письмо" };
    const lcolors = { A: '#c0392b', B: '#2980b9', C: '#27ae60', D: '#8e44ad' };
    content.innerHTML = `
      <div style="text-align:center;padding-bottom:20px">
        <div style="font-size:3rem;margin-bottom:10px">${unit.emoji}</div>
        <h2 style="margin-bottom:8px;font-family:'Playfair Display',serif">${unit.title}</h2>
        <p style="color:#666">${unit.desc}</p>
        <div style="display:flex;gap:16px;justify-content:center;margin:16px 0;flex-wrap:wrap">
          <span style="color:#f5c842">⭐ +${unit.xp} XP</span>
          <span style="color:#fbbf24">🪙 +${unit.coin} монет</span>
          <span style="color:#60a5fa">📚 ${unit.words.length} слов</span>
          <span style="color:#c0392b">🎫 2 токена/урок</span>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:20px">
        ${['A', 'B', 'C', 'D'].map(k => {
        const done = UProg[`${unit.id}_${k}`] >= 100;
        const sc = UProg[`score_${unit.id}_${k}`] || 0;
        return `<div onclick="window.openLesson('${unit.id}','${k}')" style="padding:16px;border-radius:12px;background:${done ? 'rgba(52,211,153,0.08)' : 'rgba(255,255,255,0.03)'};border:1px solid ${done ? 'rgba(52,211,153,0.3)' : 'rgba(255,255,255,0.08)'};cursor:pointer;transition:all 0.2s" onmouseover="this.style.borderColor='${lcolors[k]}55'" onmouseout="this.style.borderColor='${done ? 'rgba(52,211,153,0.3)' : 'rgba(255,255,255,0.08)'}'">
                <div style="font-size:1.2rem;font-weight:800;color:${lcolors[k]};margin-bottom:4px">${k}</div>
                <div style="font-size:0.8rem;color:#e8ecff">${lnames[k]}</div>
                ${done ? `<div style="font-size:0.72rem;color:#34d399;margin-top:4px">✅ ${sc}%</div>` : '<div style="font-size:0.72rem;color:#666;margin-top:4px">▶ Начать</div>'}
            </div>`;
    }).join('')}
      </div>
      <div>
        <div style="font-size:0.78rem;color:#666;margin-bottom:8px">📝 Слова:</div>
        <div style="display:flex;flex-wrap:wrap;gap:6px">
          ${unit.words.map(w => `<span onclick="window.spk('${w.replace(/'/g, "\\'")}',event)" style="background:rgba(192,57,43,0.1);border:1px solid rgba(192,57,43,0.2);color:#e88;padding:4px 10px;border-radius:20px;font-size:0.76rem;cursor:pointer">${w} 🔊</span>`).join('')}
        </div>
      </div>`;
    modal.classList.add('active');
    window.__curUnit = unit;
};

window.openLesson = async function (unitId, lessonKey) {
    let unit = null;
    for (const lvl of Object.values(UD_DATA)) { const f = lvl.find(u => u.id === unitId); if (f) { unit = f; break; } }
    if (!unit) return;
    const alreadyDone = UProg[`${unitId}_${lessonKey}`] >= 100;
    if (!alreadyDone) { const ok = await spendTokens(TOKEN_CONFIG.unit_cost, `Урок: ${unit.title}`); if (!ok) return; }
    curUnit = unit; curLesson = lessonKey; lScore = 0; lTotal = 0;
    lexSel = {}; rSel = {}; woAns = []; lessonMics = {};
    showLessonModal(unit, lessonKey);
};

function showLessonModal(unit, lk) {
    const modal = $id('unitModal');
    const content = $id('modalContent');
    if (!modal || !content) return;
    const lnames = { A: "📖 Грамматика и словарь", B: "🎧 Аудирование", C: "📖 Чтение", D: "🎤 Говорение и письмо" };
    content.innerHTML = `<div>
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px;padding-bottom:12px;border-bottom:1px solid rgba(255,255,255,0.08)">
        <button onclick="window.openUnit(window.__curUnit)" style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);color:#e8ecff;padding:6px 12px;border-radius:8px;cursor:pointer;font-size:0.8rem;font-family:inherit">← Назад</button>
        <div style="font-weight:700">${unit.emoji} ${unit.title} — ${lnames[lk]}</div>
        <span style="margin-left:auto;font-size:0.72rem;color:#c0392b;background:rgba(192,57,43,0.1);padding:3px 10px;border-radius:20px">${unit.level}</span>
      </div>
      <div id="lessonBody">${getLessonHTML(unit, lk)}</div>
    </div>`;
    modal.classList.add('active');
    if (lk === 'D') woAns = [];
}

function getLessonHTML(unit, lk) {
    if (lk === 'A') return lessonA(unit);
    if (lk === 'B') return lessonB(unit);
    if (lk === 'C') return lessonC(unit);
    if (lk === 'D') return lessonD(unit);
    return '';
}

// ─── УРОК A: Грамматика и словарь ───
function lessonA(unit) {
    const words = unit.words.slice(0, 12);
    const fills = words.slice(0, 4).map((w, i) => {
        const wd = WDB.find(x => x.e === w) || { ex: `Используйте слово "${w}".`, eu: '', u: '' };
        const blank = wd.ex.replace(new RegExp('\\b' + w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i'), '_______');
        return `<div style="margin-bottom:14px;padding:14px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:12px">
          <div style="font-size:0.9rem;margin-bottom:4px">${i + 1}. ${blank}</div>
          <div style="font-size:0.75rem;color:#666;margin-bottom:8px;font-style:italic">${wd.eu}</div>
          <input id="gex${i}" data-ans="${w}" placeholder="Ваш ответ..." style="width:100%;padding:8px 12px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:8px;color:#e8ecff;font-family:inherit;margin-bottom:8px;box-sizing:border-box">
          <div style="display:flex;gap:6px">
            <button onclick="window.chkFill(${i})" style="padding:6px 14px;border-radius:8px;background:rgba(52,211,153,0.1);border:1px solid rgba(52,211,153,0.3);color:#34d399;cursor:pointer;font-size:0.78rem;font-family:inherit">✓ Проверить</button>
            <button onclick="window.aiExWord('${w.replace(/'/g, "\\'")}',event)" style="padding:6px 14px;border-radius:8px;background:rgba(192,57,43,0.1);border:1px solid rgba(192,57,43,0.25);color:#e88;cursor:pointer;font-size:0.78rem;font-family:inherit">🤖 AI объяснит</button>
            <button onclick="window.spk('${w.replace(/'/g, "\\'")}',event)" style="padding:6px 14px;border-radius:8px;background:rgba(41,128,185,0.1);border:1px solid rgba(41,128,185,0.2);color:#60a5fa;cursor:pointer;font-size:0.78rem;font-family:inherit">🔊</button>
          </div>
          <div id="gexfb${i}" style="margin-top:6px;font-size:0.8rem"></div>
        </div>`;
    }).join('');

    const matchW = words.slice(0, 6);
    const shuffUZ = shuffle(matchW.map(w => { const d = WDB.find(x => x.e === w); return d ? d.u : w; }));

    return `
    <div style="margin-bottom:20px">
      <h3 style="margin-bottom:12px;color:#e8ecff;font-family:'Playfair Display',serif">📚 Словарь урока</h3>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:10px">
        ${words.map(w => {
        const d = WDB.find(x => x.e === w) || { u: '', t: '', ex: '', eu: '' };
        return `<div style="padding:14px;border-radius:12px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06)">
              <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px">
                <span style="font-weight:700;font-size:1rem;color:#e8ecff">${w}</span>
                <button onclick="window.spk('${w.replace(/'/g, "\\'")}',event)" style="background:none;border:none;cursor:pointer;font-size:1rem">🔊</button>
              </div>
              <div style="color:#c0392b;font-size:0.82rem;margin-bottom:3px">${d.u}</div>
              <div style="color:#666;font-size:0.72rem;font-style:italic">"${d.ex}"</div>
            </div>`;
    }).join('')}
      </div>
    </div>
    <div style="margin-bottom:20px;padding:16px;background:rgba(192,57,43,0.06);border:1px solid rgba(192,57,43,0.15);border-radius:12px">
      <h3 style="margin-bottom:10px;color:#e8ecff;font-family:'Playfair Display',serif">📝 Правило грамматики</h3>
      <div style="font-size:0.9rem;color:#fdd;margin-bottom:8px">💡 ${unit.grammar_rule || ''}</div>
      <div style="font-size:0.85rem;color:#e88;font-style:italic">✏️ ${unit.grammar_example || ''}</div>
      <button onclick="window.aiGrammarExplain('${unit.title}','${(unit.grammar_rule || '').replace(/'/g, "\\'")}')" style="margin-top:10px;padding:8px 16px;border-radius:8px;background:rgba(192,57,43,0.1);border:1px solid rgba(192,57,43,0.25);color:#e88;cursor:pointer;font-size:0.78rem;font-family:inherit">🤖 AI объяснит подробнее (1 токен)</button>
      <div id="gramRuleFB" style="margin-top:8px;font-size:0.8rem"></div>
    </div>
    <div style="margin-bottom:20px">
      <h3 style="margin-bottom:12px;color:#e8ecff;font-family:'Playfair Display',serif">✏️ Упражнения на заполнение</h3>
      ${fills}
      <div id="vocabAIFB" style="font-size:0.8rem"></div>
    </div>
    <div style="margin-bottom:20px">
      <h3 style="margin-bottom:12px;color:#e8ecff;font-family:'Playfair Display',serif">🧩 Упражнение на соответствие</h3>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        <div>${matchW.map((w, i) => `<div class="match-item eng" data-i="${i}" onclick="window.selMatch(this,'e',${i})" style="padding:10px 14px;border-radius:10px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);cursor:pointer;margin-bottom:6px;font-size:0.88rem;color:#e8ecff;transition:all 0.2s">${w}</div>`).join('')}</div>
        <div>${shuffUZ.map(u => `<div class="match-item uz" data-u="${u}" onclick="window.selMatch(this,'u','${u.replace(/'/g, "\\'")}')" style="padding:10px 14px;border-radius:10px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);cursor:pointer;margin-bottom:6px;font-size:0.88rem;color:#e88;transition:all 0.2s">${u}</div>`).join('')}</div>
      </div>
      <div id="matchFB" style="margin-top:8px;font-size:0.8rem"></div>
    </div>
    <button onclick="window.finLessonA('${unit.id}')" style="width:100%;padding:14px;border-radius:12px;background:linear-gradient(135deg,#c0392b,#f39c12);border:none;color:#fff;font-size:0.95rem;font-weight:700;cursor:pointer;font-family:inherit">✅ Завершить урок грамматики</button>`;
}

window.chkFill = function (i) {
    const inp = $id(`gex${i}`); const fb = $id(`gexfb${i}`);
    if (!inp || !fb) return;
    if (inp.value.trim().toLowerCase() === inp.dataset.ans.toLowerCase()) {
        fb.innerHTML = `<span style="color:#34d399">✅ Правильно! "${inp.dataset.ans}"</span>`;
        inp.style.borderColor = '#34d399'; lScore++; awardXP(10, 'grammar');
    } else {
        fb.innerHTML = `<span style="color:#ef4444">❌ Правильный ответ: <strong>${inp.dataset.ans}</strong></span>`;
        inp.style.borderColor = '#ef4444';
    }
    lTotal++;
};

window.selMatch = function (el, type, val) {
    if (type === 'e') {
        document.querySelectorAll('.match-item.eng').forEach(x => { x.style.borderColor = 'rgba(255,255,255,0.1)'; x.style.background = 'rgba(255,255,255,0.04)'; });
        el.style.background = 'rgba(192,57,43,0.2)'; el.style.borderColor = '#c0392b';
        mSel.e = val; mSel.eEl = el;
    } else {
        document.querySelectorAll('.match-item.uz').forEach(x => { x.style.borderColor = 'rgba(255,255,255,0.1)'; x.style.background = 'rgba(255,255,255,0.04)'; });
        el.style.background = 'rgba(192,57,43,0.15)'; el.style.borderColor = '#c0392b';
        mSel.u = val; mSel.uEl = el;
    }
    if (mSel.e !== null && mSel.u !== null) {
        const w = (curUnit?.words || [])[mSel.e];
        const wd = WDB.find(x => x.e === w);
        if (wd && wd.u === mSel.u) {
            mSel.eEl.style.background = 'rgba(52,211,153,0.15)'; mSel.eEl.style.borderColor = '#34d399';
            mSel.uEl.style.background = 'rgba(52,211,153,0.15)'; mSel.uEl.style.borderColor = '#34d399';
            awardXP(5, 'grammar'); showToast(`✅ "${w}" = "${mSel.u}"!`, 'success');
        } else {
            mSel.eEl.style.background = 'rgba(239,68,68,0.15)'; mSel.eEl.style.borderColor = '#ef4444';
            mSel.uEl.style.background = 'rgba(239,68,68,0.15)'; mSel.uEl.style.borderColor = '#ef4444';
            setTimeout(() => {
                if (mSel.eEl) { mSel.eEl.style.background = 'rgba(255,255,255,0.04)'; mSel.eEl.style.borderColor = 'rgba(255,255,255,0.1)'; }
                if (mSel.uEl) { mSel.uEl.style.background = 'rgba(255,255,255,0.04)'; mSel.uEl.style.borderColor = 'rgba(255,255,255,0.1)'; }
            }, 700);
        }
        mSel = { e: null, u: null, eEl: null, uEl: null };
    }
};

window.aiGrammarExplain = async function (title, rule) {
    const ok = await spendTokens(TOKEN_CONFIG.ai_cost, 'AI объяснение грамматики'); if (!ok) return;
    const fb = $id('gramRuleFB'); if (fb) fb.innerHTML = '🤖 AI анализирует...';
    const r = await callAI(`Объясни правило русской грамматики на узбекском языке: "${rule}" (тема урока: "${title}"). Приведи 3 примера с переводом на узбекский. Будь понятным и кратким.`, 800);
    if (fb) fb.innerHTML = r.replace(/\n/g, '<br>');
};

window.aiExWord = async function (word, e) {
    if (e) e.stopPropagation();
    const ok = await spendTokens(TOKEN_CONFIG.ai_cost, `AI объяснение: "${word}"`); if (!ok) return;
    const fb = $id('vocabAIFB') || $id('wordAIFB');
    if (fb) fb.innerHTML = `🤖 Анализирую слово "${word}"...`;
    const r = await callAI(`Объясни русское слово "${word}" на узбекском языке: 1) Значение 2) 3 примера предложений (с переводом) 3) Советы по запоминанию`, 600);
    if (fb) fb.innerHTML = r.replace(/\n/g, '<br>');
};

window.finLessonA = async function (uid) { await finLesson(uid, 'A', 'grammar', lScore, lTotal || 4); };

// ─── УРОК B: Аудирование ───
function lessonB(unit) {
    const exs = genListenExs(unit);
    window.__listenExs = exs;
    return `
    <div style="margin-bottom:20px">
      <h3 style="margin-bottom:12px;color:#e8ecff;font-family:'Playfair Display',serif">🎧 Упражнение на аудирование</h3>
      <div id="lexCont">${renderLex(exs, 0)}</div>
    </div>
    <div style="margin-bottom:20px;padding:16px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:12px">
      <h3 style="margin-bottom:12px;color:#e8ecff;font-family:'Playfair Display',serif">✍️ Диктант</h3>
      <div style="display:flex;gap:8px;margin-bottom:12px">
        <button onclick="window.playDict('${unit.id}','normal')" style="padding:8px 16px;border-radius:8px;background:rgba(41,128,185,0.1);border:1px solid rgba(41,128,185,0.2);color:#60a5fa;cursor:pointer;font-size:0.82rem;font-family:inherit">▶ Слушать</button>
        <button onclick="window.playDict('${unit.id}','slow')" style="padding:8px 16px;border-radius:8px;background:rgba(142,68,173,0.1);border:1px solid rgba(142,68,173,0.2);color:#a78bfa;cursor:pointer;font-size:0.82rem;font-family:inherit">🐌 Медленно</button>
      </div>
      <textarea id="dictIn" placeholder="Напишите то, что услышали..." style="width:100%;height:80px;padding:10px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:8px;color:#e8ecff;font-family:inherit;resize:none;box-sizing:border-box"></textarea>
      <div style="display:flex;gap:6px;margin-top:8px">
        <button onclick="window.chkDict()" style="padding:7px 14px;border-radius:8px;background:rgba(52,211,153,0.1);border:1px solid rgba(52,211,153,0.3);color:#34d399;cursor:pointer;font-size:0.78rem;font-family:inherit">✓ Проверить</button>
        <button onclick="window.aiChkDict()" style="padding:7px 14px;border-radius:8px;background:rgba(192,57,43,0.1);border:1px solid rgba(192,57,43,0.25);color:#e88;cursor:pointer;font-size:0.78rem;font-family:inherit">🤖 AI анализ (1 токен)</button>
      </div>
      <div id="dictFB" style="margin-top:8px;font-size:0.8rem"></div>
    </div>
    <button onclick="window.finLessonB('${unit.id}')" style="width:100%;padding:14px;border-radius:12px;background:linear-gradient(135deg,#2980b9,#1abc9c);border:none;color:#fff;font-size:0.95rem;font-weight:700;cursor:pointer;font-family:inherit">✅ Завершить аудирование</button>`;
}

function genListenExs(unit) {
    const w = unit.words;
    return [
        { text: `Сегодня мы говорим о теме "${unit.title}". Слово "${w[0]}" очень важное в русском языке. Оно часто используется в повседневной речи.`, q: `О чём идёт речь в тексте?`, opts: [unit.title, 'Спорт', 'Природа', 'История'], c: 0, tip: `"Сегодня мы говорим о теме..."` },
        { text: `Здравствуйте! Меня зовут Иван. Сегодня я расскажу о словах "${w[0]}" и "${w[1] || w[0]}". Сначала рассмотрим "${w[0]}". Готовы?`, q: `О каком слове Иван расскажет первым?`, opts: [`${w[2] || w[0]}`, `${w[0]}`, `${w[1] || w[0]}`, `Обо всём сразу`], c: 1, tip: `"Сначала рассмотрим..."` },
        { text: `Русский язык — это интересно! Слово "${w[0]}" встречается очень часто. С практикой всё становится легче.`, q: `Что становится легче с практикой?`, opts: [`Всё`, `Ничего`, `${w[0]}`, `Только грамматика`], c: 0, tip: `"...с практикой всё становится легче"` }
    ];
}

function renderLex(exs, idx) {
    const ex = exs[idx];
    if (!ex) return '<div style="text-align:center;padding:20px;color:#34d399">🎉 Все упражнения на аудирование выполнены!</div>';
    return `<div style="padding:16px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:12px">
      <div style="font-size:0.75rem;color:#c0392b;margin-bottom:8px">Вопрос ${idx + 1}/${exs.length}</div>
      <div style="display:flex;gap:8px;margin-bottom:12px">
        <button onclick="window.playLex(${idx},'normal')" style="padding:8px 16px;border-radius:8px;background:rgba(41,128,185,0.1);border:1px solid rgba(41,128,185,0.2);color:#60a5fa;cursor:pointer;font-size:0.82rem;font-family:inherit">▶ Слушать</button>
        <button onclick="window.playLex(${idx},'slow')" style="padding:8px 16px;border-radius:8px;background:rgba(142,68,173,0.1);border:1px solid rgba(142,68,173,0.2);color:#a78bfa;cursor:pointer;font-size:0.82rem;font-family:inherit">🐌 Медленно</button>
      </div>
      <div id="ltxt${idx}" style="display:none;padding:10px;background:rgba(255,255,255,0.04);border-radius:8px;font-size:0.82rem;color:#e8ecff;margin-bottom:10px;font-style:italic">${ex.text}</div>
      <div style="font-weight:600;margin-bottom:10px">${ex.q}</div>
      <div>${ex.opts.map((o, oi) => `<div class="lex-opt" data-qi="${idx}" data-oi="${oi}" onclick="window.selLex(this,${idx},${oi})" style="padding:10px 14px;border-radius:8px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);cursor:pointer;margin-bottom:6px;font-size:0.88rem;transition:all 0.2s">${String.fromCharCode(65 + oi)}. ${o}</div>`).join('')}</div>
      <div style="font-size:0.75rem;color:#666;margin-bottom:10px">💡 ${ex.tip}</div>
      <div style="display:flex;gap:6px">
        <button onclick="window.chkLex(${idx},${ex.c})" style="padding:7px 14px;border-radius:8px;background:rgba(52,211,153,0.1);border:1px solid rgba(52,211,153,0.3);color:#34d399;cursor:pointer;font-size:0.78rem;font-family:inherit">✓ Проверить</button>
        ${idx + 1 < exs.length ? `<button onclick="window.nextLex(${idx + 1})" id="lexnxt${idx}" style="display:none;padding:7px 14px;border-radius:8px;background:rgba(41,128,185,0.1);border:1px solid rgba(41,128,185,0.2);color:#60a5fa;cursor:pointer;font-size:0.78rem;font-family:inherit">→ Следующий</button>` : ''}
      </div>
      <div id="lexfb${idx}" style="margin-top:8px;font-size:0.8rem"></div>
    </div>`;
}

window.playLex = function (idx, speed) {
    const exs = window.__listenExs || []; if (!exs[idx]) return;
    const u = new SpeechSynthesisUtterance(exs[idx].text);
    u.lang = 'ru-RU'; u.rate = speed === 'slow' ? 0.55 : 0.82;
    speechSynthesis.cancel(); speechSynthesis.speak(u);
};
window.selLex = function (el, qi, oi) {
    document.querySelectorAll(`.lex-opt[data-qi="${qi}"]`).forEach(o => { o.style.background = 'rgba(255,255,255,0.04)'; o.style.borderColor = 'rgba(255,255,255,0.08)'; });
    el.style.background = 'rgba(192,57,43,0.15)'; el.style.borderColor = '#c0392b';
    lexSel[qi] = oi;
};
window.chkLex = function (idx, correct) {
    const fb = $id(`lexfb${idx}`);
    const sel = lexSel[idx];
    if (sel === undefined) { if (fb) fb.innerHTML = '<span style="color:#f5c842">⚠️ Выберите ответ!</span>'; return; }
    document.querySelectorAll(`.lex-opt[data-qi="${idx}"]`).forEach((o, i) => {
        if (i === correct) { o.style.background = 'rgba(52,211,153,0.2)'; o.style.borderColor = '#34d399'; }
        else if (i === sel && sel !== correct) { o.style.background = 'rgba(239,68,68,0.2)'; o.style.borderColor = '#ef4444'; }
    });
    const txEl = $id(`ltxt${idx}`); if (txEl) txEl.style.display = 'block';
    if (sel === correct) { if (fb) fb.innerHTML = '<span style="color:#34d399">✅ Правильно!</span>'; lScore++; awardXP(15, 'listening'); }
    else { if (fb) fb.innerHTML = `<span style="color:#ef4444">❌ Правильный: <strong>${String.fromCharCode(65 + correct)}</strong></span>`; }
    lTotal++;
    const nxt = $id(`lexnxt${idx}`); if (nxt) nxt.style.display = 'inline-flex';
};
window.nextLex = function (idx) {
    const exs = window.__listenExs || [];
    const cont = $id('lexCont'); if (cont) cont.innerHTML = renderLex(exs, idx);
};
window.playDict = function (uid, speed) {
    let unit = null;
    for (const lvl of Object.values(UD_DATA)) { const f = lvl.find(u => u.id === uid); if (f) { unit = f; break; } }
    if (!unit) return;
    const wd = WDB.find(x => x.e === unit.words[0]);
    dictSent = wd ? wd.ex : `Слово "${unit.words[0]}" важное.`;
    const u2 = new SpeechSynthesisUtterance(dictSent);
    u2.lang = 'ru-RU'; u2.rate = speed === 'slow' ? 0.5 : 0.82;
    speechSynthesis.cancel(); speechSynthesis.speak(u2);
};
window.chkDict = function () {
    const inp = $id('dictIn'); const fb = $id('dictFB');
    if (!inp || !fb || !dictSent) { if (fb) fb.innerHTML = '<span style="color:#f5c842">⚠️ Сначала послушайте аудио!</span>'; return; }
    const cw = dictSent.toLowerCase().replace(/[.,!?]/g, '').split(' ');
    const uw = inp.value.trim().toLowerCase().replace(/[.,!?]/g, '').split(' ');
    let mc = 0;
    const hl = cw.map(w => {
        if (uw.includes(w)) { mc++; return `<span style="color:#34d399;font-weight:600">${w}</span>`; }
        return `<span style="color:#ef4444">${w}</span>`;
    }).join(' ');
    const pct = Math.round((mc / cw.length) * 100);
    fb.innerHTML = `<div><strong>Правильный текст:</strong> ${hl}</div><div style="margin-top:6px"><strong>Ваш текст:</strong> ${inp.value}</div><div style="font-size:0.9rem;font-weight:700;margin-top:6px;color:${pct >= 70 ? '#34d399' : '#ef4444'}">${pct}%</div>`;
    if (pct >= 70) { lScore++; awardXP(20, 'listening'); }
    lTotal++;
};
window.aiChkDict = async function () {
    const ok = await spendTokens(TOKEN_CONFIG.ai_cost, 'AI анализ диктанта'); if (!ok) return;
    const inp = $id('dictIn'); const fb = $id('dictFB');
    if (!inp?.value.trim()) { if (fb) fb.innerHTML = '<span style="color:#f5c842">Сначала напишите!</span>'; return; }
    fb.innerHTML = '🤖 AI анализирует...';
    const r = await callAI(`Анализ диктанта на узбекском языке:\nОригинал: "${dictSent}"\nУченик написал: "${inp.value.trim()}"\n1) Ошибки 2) Балл: /10 3) Советы по улучшению`, 600);
    fb.innerHTML = r.replace(/\n/g, '<br>');
};
window.finLessonB = async function (uid) { await finLesson(uid, 'B', 'listening', lScore, lTotal || 3); };

// ─── УРОК C: Чтение ───
function lessonC(unit) {
    const qs = unit.reading_qs || [];
    const wh = unit.words.slice(0, 5);
    return `
    <div style="margin-bottom:20px">
      <h3 style="margin-bottom:12px;color:#e8ecff;font-family:'Playfair Display',serif">📖 Чтение текста</h3>
      <div style="padding:16px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:12px">
        <div style="font-weight:700;font-size:1rem;margin-bottom:10px;color:#e8ecff;font-family:'Playfair Display',serif">${unit.title}</div>
        <div id="rdbody" style="font-size:0.88rem;line-height:1.7;color:#fdd">${unit.reading_text || ''}</div>
        <div style="display:flex;gap:6px;margin-top:12px">
          <button onclick="window.rdAloud()" style="padding:7px 14px;border-radius:8px;background:rgba(41,128,185,0.1);border:1px solid rgba(41,128,185,0.2);color:#60a5fa;cursor:pointer;font-size:0.78rem;font-family:inherit">🔊 Слушать</button>
        </div>
      </div>
    </div>
    <div style="margin-bottom:20px">
      <h3 style="margin-bottom:12px;color:#e8ecff;font-family:'Playfair Display',serif">❓ Вопросы по тексту</h3>
      ${qs.map((q, qi) => `<div style="margin-bottom:14px;padding:14px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:12px">
        <div style="font-weight:600;margin-bottom:10px">${qi + 1}. ${q.q}</div>
        <div>${q.opts.map((o, oi) => `<div class="rq-opt" data-qi="${qi}" data-oi="${oi}" onclick="window.selRQ(this,${qi},${oi})" style="padding:10px 14px;border-radius:8px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);cursor:pointer;margin-bottom:6px;font-size:0.88rem;transition:all 0.2s">${String.fromCharCode(65 + oi)}. ${o}</div>`).join('')}</div>
        <div id="rqfb${qi}" style="margin-top:6px;font-size:0.8rem"></div>
      </div>`).join('')}
      <button onclick="window.chkAllRQ(${JSON.stringify(qs.map(q => q.c))})" style="padding:8px 16px;border-radius:8px;background:rgba(52,211,153,0.1);border:1px solid rgba(52,211,153,0.3);color:#34d399;cursor:pointer;font-size:0.82rem;font-family:inherit;margin-top:8px">✓ Проверить всё</button>
      <div id="rdTotFB" style="margin-top:8px;font-size:0.8rem"></div>
    </div>
    <div style="margin-bottom:20px">
      <h3 style="margin-bottom:12px;color:#e8ecff;font-family:'Playfair Display',serif">🔤 Написание слов</h3>
      ${wh.map((w, i) => {
        const d = WDB.find(x => x.e === w) || { u: w };
        return `<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
          <span style="color:#c0392b;font-size:0.85rem;min-width:100px">${d.u}</span>
          <input id="whi${i}" data-ans="${w}" placeholder="по-русски..." style="flex:1;padding:8px 12px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:8px;color:#e8ecff;font-family:inherit">
          <button onclick="window.chkWH(${i})" style="padding:7px 12px;border-radius:8px;background:rgba(52,211,153,0.1);border:1px solid rgba(52,211,153,0.3);color:#34d399;cursor:pointer;font-size:0.78rem;font-family:inherit">✓</button>
          <button onclick="window.spk('${w.replace(/'/g, "\\'")}',event)" style="padding:7px 12px;border-radius:8px;background:rgba(41,128,185,0.1);border:1px solid rgba(41,128,185,0.2);color:#60a5fa;cursor:pointer;font-size:0.78rem;font-family:inherit">🔊</button>
          <span id="whfb${i}" style="font-size:0.8rem;min-width:30px"></span>
        </div>`;
    }).join('')}
    </div>
    <button onclick="window.finLessonC('${unit.id}')" style="width:100%;padding:14px;border-radius:12px;background:linear-gradient(135deg,#27ae60,#1abc9c);border:none;color:#fff;font-size:0.95rem;font-weight:700;cursor:pointer;font-family:inherit">✅ Завершить чтение</button>`;
}

window.rdAloud = function () {
    const b = $id('rdbody'); if (!b) return;
    const u = new SpeechSynthesisUtterance(b.textContent);
    u.lang = 'ru-RU'; u.rate = 0.82;
    speechSynthesis.cancel(); speechSynthesis.speak(u);
};
window.selRQ = function (el, qi, oi) {
    document.querySelectorAll(`.rq-opt[data-qi="${qi}"]`).forEach(o => { o.style.background = 'rgba(255,255,255,0.04)'; o.style.borderColor = 'rgba(255,255,255,0.08)'; });
    el.style.background = 'rgba(192,57,43,0.15)'; el.style.borderColor = '#c0392b';
    rSel[qi] = oi;
};
window.chkAllRQ = function (answers) {
    let score = 0;
    answers.forEach((correct, qi) => {
        const sel = rSel[qi]; const fb = $id(`rqfb${qi}`);
        if (sel === undefined) { if (fb) fb.innerHTML = '<span style="color:#f5c842">⚠️ Выберите ответ!</span>'; return; }
        document.querySelectorAll(`.rq-opt[data-qi="${qi}"]`).forEach((o, i) => {
            if (i === correct) { o.style.background = 'rgba(52,211,153,0.2)'; o.style.borderColor = '#34d399'; }
            else if (i === sel && sel !== correct) { o.style.background = 'rgba(239,68,68,0.2)'; o.style.borderColor = '#ef4444'; }
        });
        if (sel === correct) { score++; if (fb) fb.innerHTML = '<span style="color:#34d399">✅ Правильно!</span>'; }
        else { if (fb) fb.innerHTML = `<span style="color:#ef4444">❌ Правильный: ${String.fromCharCode(65 + correct)}</span>`; }
    });
    lScore += score; lTotal += answers.length;
    awardXP(score * 15, 'reading');
    const fb = $id('rdTotFB');
    if (fb) fb.innerHTML = `<span style="color:${score === answers.length ? '#34d399' : '#f5c842'}">Итого: ${score}/${answers.length}</span>`;
};
window.chkWH = function (i) {
    const inp = $id(`whi${i}`); const fb = $id(`whfb${i}`); if (!inp || !fb) return;
    if (inp.value.trim().toLowerCase() === inp.dataset.ans.toLowerCase()) {
        fb.innerHTML = '✅'; inp.style.borderColor = '#34d399'; awardXP(8, 'writing');
    } else { fb.innerHTML = '❌'; inp.style.borderColor = '#ef4444'; }
};
window.finLessonC = async function (uid) { await finLesson(uid, 'C', 'reading', lScore, lTotal || 6); };

// ─── УРОК D: Говорение и письмо ───
function lessonD(unit) {
    const topics = unit.words.slice(0, 3);
    const woSent = (WDB.find(x => x.e === unit.words[0])?.ex) || `Я использую слово ${unit.words[0]} каждый день.`;
    window.__woCorrect = woSent;
    return `
    <div style="margin-bottom:20px">
      <h3 style="margin-bottom:12px;color:#e8ecff;font-family:'Playfair Display',serif">🎤 Упражнения на говорение</h3>
      ${topics.map((w, i) => {
        const d = WDB.find(x => x.e === w) || { u: '', ex: '' };
        return `<div style="margin-bottom:14px;padding:14px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:12px">
          <div style="font-weight:600;margin-bottom:4px">${i + 1}. Составьте предложение со словом "${w}":</div>
          <div style="font-size:0.78rem;color:#666;margin-bottom:10px">Перевод: ${d.u} · Пример: ${d.ex}</div>
          <div style="display:flex;gap:6px;margin-bottom:8px">
            <button id="mbtn${i}" onclick="window.togMic(${i})" style="padding:8px 16px;border-radius:8px;background:rgba(192,57,43,0.1);border:1px solid rgba(192,57,43,0.25);color:#e88;cursor:pointer;font-size:0.82rem;font-family:inherit">🎤 Говорить</button>
            <button onclick="window.spk('${w.replace(/'/g, "\\'")}',event)" style="padding:8px 12px;border-radius:8px;background:rgba(41,128,185,0.1);border:1px solid rgba(41,128,185,0.2);color:#60a5fa;cursor:pointer;font-size:0.82rem;font-family:inherit">🔊</button>
          </div>
          <div id="mst${i}" style="font-size:0.75rem;color:#666"></div>
          <div id="mtr${i}" style="padding:8px;font-size:0.88rem;color:#fdd;min-height:24px;border-radius:6px"></div>
          <div style="display:flex;gap:6px;margin-top:8px">
            <button onclick="window.aiSpk(${i},'${w}')" style="padding:6px 14px;border-radius:8px;background:rgba(192,57,43,0.1);border:1px solid rgba(192,57,43,0.25);color:#e88;cursor:pointer;font-size:0.78rem;font-family:inherit">🤖 AI оценит (1 токен)</button>
            <button onclick="window.markDone(${i})" style="padding:6px 14px;border-radius:8px;background:rgba(52,211,153,0.1);border:1px solid rgba(52,211,153,0.3);color:#34d399;cursor:pointer;font-size:0.78rem;font-family:inherit">✅ Выполнено</button>
          </div>
          <div id="sfb${i}" style="margin-top:8px;font-size:0.82rem"></div>
        </div>`;
    }).join('')}
    </div>
    <div style="margin-bottom:20px">
      <h3 style="margin-bottom:12px;color:#e8ecff;font-family:'Playfair Display',serif">✍️ Письменное упражнение</h3>
      <div style="padding:14px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:12px">
        <div style="font-size:0.85rem;color:#aaa;margin-bottom:8px">Тема: напишите текст о "${unit.title}" (40+ слов).</div>
        <textarea id="dta" placeholder="Пишите здесь..." oninput="window.updWC()" style="width:100%;height:100px;padding:10px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:8px;color:#e8ecff;font-family:inherit;resize:none;box-sizing:border-box"></textarea>
        <div style="display:flex;gap:10px;font-size:0.75rem;color:#666;margin:6px 0"><span id="dwc">0 слов</span><span id="dcc">0 симв.</span><span id="dst" style="color:#f87171">Мин. 40 слов</span></div>
        <div style="display:flex;gap:6px">
          <button onclick="window.aiWrit('${unit.title}','${unit.words.slice(0, 5).join(',')}')" style="padding:7px 14px;border-radius:8px;background:rgba(192,57,43,0.1);border:1px solid rgba(192,57,43,0.25);color:#e88;cursor:pointer;font-size:0.78rem;font-family:inherit">🤖 AI проверит (1 токен)</button>
          <button onclick="window.selfChk(40)" style="padding:7px 14px;border-radius:8px;background:rgba(41,128,185,0.1);border:1px solid rgba(41,128,185,0.2);color:#60a5fa;cursor:pointer;font-size:0.78rem;font-family:inherit">📊 Подсчёт слов</button>
        </div>
        <div id="wfb" style="margin-top:8px;font-size:0.8rem"></div>
      </div>
    </div>
    <div style="margin-bottom:20px">
      <h3 style="margin-bottom:12px;color:#e8ecff;font-family:'Playfair Display',serif">🔀 Порядок слов</h3>
      <div id="woChips" style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px">
        ${shuffle(woSent.split(' ')).map(w => `<div class="wo-chip" data-w="${w}" onclick="window.selChip(this)" style="background:rgba(192,57,43,0.1);border:1px solid rgba(192,57,43,0.2);color:#e88;padding:6px 12px;border-radius:20px;cursor:pointer;font-size:0.85rem">${w}</div>`).join('')}
      </div>
      <div id="woAnsDiv" style="min-height:40px;padding:10px;background:rgba(255,255,255,0.03);border:1px dashed rgba(255,255,255,0.1);border-radius:8px;display:flex;flex-wrap:wrap;gap:6px;font-size:0.88rem;color:#666;margin-bottom:8px"><span>Нажмите сюда...</span></div>
      <div style="display:flex;gap:6px">
        <button onclick="window.chkWO()" style="padding:7px 14px;border-radius:8px;background:rgba(52,211,153,0.1);border:1px solid rgba(52,211,153,0.3);color:#34d399;cursor:pointer;font-size:0.78rem;font-family:inherit">✓ Проверить</button>
        <button onclick="window.rstWO()" style="padding:7px 14px;border-radius:8px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);color:#e8ecff;cursor:pointer;font-size:0.78rem;font-family:inherit">🔄 Сбросить</button>
        <button onclick="window.spk('${woSent.replace(/'/g, "\\'")}',event)" style="padding:7px 14px;border-radius:8px;background:rgba(41,128,185,0.1);border:1px solid rgba(41,128,185,0.2);color:#60a5fa;cursor:pointer;font-size:0.78rem;font-family:inherit">🔊</button>
      </div>
      <div id="wofb" style="margin-top:8px;font-size:0.8rem"></div>
    </div>
    <button onclick="window.finLessonD('${unit.id}')" style="width:100%;padding:14px;border-radius:12px;background:linear-gradient(135deg,#8e44ad,#c0392b);border:none;color:#fff;font-size:0.95rem;font-weight:700;cursor:pointer;font-family:inherit">✅ Завершить говорение и письмо</button>`;
}

window.selChip = function (el) {
    if (el.classList.contains('used')) return;
    el.classList.add('used'); el.style.opacity = '0.3';
    woAns.push(el.dataset.w);
    const d = $id('woAnsDiv');
    if (d) d.innerHTML = woAns.map((w, i) => `<span onclick="window.rmChip(${i})" style="background:rgba(192,57,43,0.15);border:1px solid rgba(192,57,43,0.3);border-radius:20px;padding:6px 12px;cursor:pointer;font-size:0.85rem">${w}</span>`).join('') || '<span style="color:#666">Нажмите сюда...</span>';
};
window.rmChip = function (idx) {
    const w = woAns[idx]; woAns.splice(idx, 1);
    document.querySelectorAll('.wo-chip').forEach(c => { if (c.dataset.w === w && c.classList.contains('used')) { c.classList.remove('used'); c.style.opacity = '1'; return; } });
    const d = $id('woAnsDiv');
    if (d) d.innerHTML = woAns.map((w, i) => `<span onclick="window.rmChip(${i})" style="background:rgba(192,57,43,0.15);border:1px solid rgba(192,57,43,0.3);border-radius:20px;padding:6px 12px;cursor:pointer;font-size:0.85rem">${w}</span>`).join('') || '<span style="color:#666">Нажмите сюда...</span>';
};
window.rstWO = function () {
    woAns = [];
    document.querySelectorAll('.wo-chip').forEach(c => { c.classList.remove('used'); c.style.opacity = '1'; });
    const d = $id('woAnsDiv'); if (d) d.innerHTML = '<span style="color:#666">Нажмите сюда...</span>';
};
window.chkWO = function () {
    const fb = $id('wofb');
    if (!woAns.length) { if (fb) fb.innerHTML = '<span style="color:#f5c842">⚠️ Расставьте слова!</span>'; return; }
    if (woAns.join(' ').toLowerCase() === (window.__woCorrect || '').toLowerCase()) {
        if (fb) fb.innerHTML = '<span style="color:#34d399">🏆 Отлично!</span>';
        awardXP(15, 'writing'); lScore++;
    } else { if (fb) fb.innerHTML = `<span style="color:#ef4444">❌ Правильно: <em>${window.__woCorrect}</em></span>`; }
    lTotal++;
};
window.togMic = function (idx) {
    const btn = $id(`mbtn${idx}`); const st = $id(`mst${idx}`); const tr = $id(`mtr${idx}`);
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
        if (tr) tr.innerHTML = `<textarea style="width:100%;padding:8px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:8px;color:#e8ecff;font-family:inherit" id="man${idx}" placeholder="Нет микрофона — напишите здесь..."></textarea>`;
        if (st) st.textContent = '⌨️ Текстовый ввод'; return;
    }
    if (lessonMics[idx]) { try { lessonMics[idx].stop(); } catch (e) { } lessonMics[idx] = null; if (btn) btn.innerHTML = '🎤 Говорить'; return; }
    const rec = new SR(); rec.lang = 'ru-RU'; rec.continuous = true; rec.interimResults = true;
    rec.onresult = e => { let t = ''; for (let i = e.resultIndex; i < e.results.length; i++) t += e.results[i][0].transcript; if (tr && tr.tagName !== 'TEXTAREA') tr.textContent = t; };
    rec.onerror = e => {
        if (btn) btn.innerHTML = '🎤 Говорить'; lessonMics[idx] = null;
        if (e.error === 'not-allowed' && tr) tr.innerHTML = `<textarea style="width:100%;padding:8px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:8px;color:#e8ecff;font-family:inherit" id="man${idx}" placeholder="Напишите здесь..."></textarea>`;
    };
    rec.onend = () => { if (btn) btn.innerHTML = '🎤 Говорить'; if (st) st.innerHTML = '✅ Записано'; lessonMics[idx] = null; };
    try {
        rec.start(); lessonMics[idx] = rec;
        if (btn) btn.innerHTML = '⏹ Остановить';
        if (st) st.innerHTML = '🔴 Запись...';
    } catch (e) {
        if (tr) tr.innerHTML = `<textarea style="width:100%;padding:8px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:8px;color:#e8ecff;font-family:inherit" id="man${idx}" placeholder="Напишите здесь..."></textarea>`;
    }
};
window.aiSpk = async function (idx, topic) {
    const ok = await spendTokens(TOKEN_CONFIG.ai_cost, 'AI оценка говорения'); if (!ok) return;
    const tr = $id(`mtr${idx}`); const man = $id(`man${idx}`); const fb = $id(`sfb${idx}`);
    let text = '';
    if (tr) text = tr.tagName === 'TEXTAREA' ? tr.value.trim() : tr.textContent.trim();
    if (!text && man) text = man.value.trim();
    if (!text) { if (fb) fb.innerHTML = '<span style="color:#f5c842">⚠️ Сначала скажите что-нибудь!</span>'; return; }
    if (fb) fb.innerHTML = '🤖 AI оценивает...';
    const r = await callAI(`Оценка говорения по-русски. Тема: "${topic}". Ученик сказал: "${text}".\nНа узбекском: 1) ✅ Что хорошо 2) ❌ Ошибки 3) 🔄 Исправленный вариант 4) ⭐ /10`, 700);
    if (fb) fb.innerHTML = r.replace(/\n/g, '<br>');
    lScore++; lTotal++; awardXP(20, 'speaking');
};
window.markDone = function (idx) { lScore++; lTotal++; awardXP(10, 'speaking'); showToast('✅ Выполнено!', 'success'); };
window.updWC = function () {
    const ta = $id('dta'); if (!ta) return;
    const w = ta.value.trim() ? ta.value.trim().split(/\s+/).length : 0;
    const wc = $id('dwc'); const cc = $id('dcc'); const st = $id('dst');
    if (wc) wc.textContent = w + " слов";
    if (cc) cc.textContent = ta.value.length + ' симв.';
    if (st) { st.textContent = w >= 40 ? '✅ Достаточно' : `Мин. 40 (${w}/40)`; st.style.color = w >= 40 ? '#34d399' : '#f87171'; }
};
window.selfChk = function (min) {
    const ta = $id('dta'); const fb = $id('wfb'); if (!ta || !fb) return;
    const w = ta.value.trim() ? ta.value.trim().split(/\s+/).length : 0;
    if (w >= min) { fb.innerHTML = `<span style="color:#34d399">✅ ${w} слов!</span>`; lScore++; awardXP(15, 'writing'); }
    else { fb.innerHTML = `<span style="color:#f87171">⚠️ Не хватает ${min - w} слов!</span>`; }
    lTotal++;
};
window.aiWrit = async function (title, words) {
    const ok = await spendTokens(TOKEN_CONFIG.ai_cost, 'AI проверка письма'); if (!ok) return;
    const ta = $id('dta'); const fb = $id('wfb');
    if (!ta?.value.trim()) { if (fb) fb.innerHTML = '<span style="color:#f5c842">Сначала напишите!</span>'; return; }
    fb.innerHTML = '🤖 Проверяю...';
    const r = await callAI(`Проверка письма. Тема: "${title}" (слова: ${words}).\nТекст: "${ta.value.trim()}"\nНа узбекском: 1) Грамматика 2) Стиль 3) Исправленный вариант 4) Балл ТРКИ: /9`, 800);
    fb.innerHTML = r.replace(/\n/g, '<br>'); awardXP(20, 'writing');
};
window.finLessonD = async function (uid) { await finLesson(uid, 'D', 'speaking', lScore, lTotal || 3); };

// ─── ЗАВЕРШЕНИЕ УРОКА ───
async function finLesson(uid, lk, skill, sc, tot) {
    if (!CU) return;
    const pct = tot > 0 ? Math.round((sc / tot) * 100) : 70;
    let unit = null;
    for (const lvl of Object.values(UD_DATA)) { const f = lvl.find(u => u.id === uid); if (f) { unit = f; break; } }
    if (!unit) return;
    const plan = getPlan(); const rank = getRank();
    const xpE = Math.round((unit.xp / 4) * plan.xp_mult * rank.xp_mult * (pct / 100));
    const coinE = Math.round((unit.coin / 4) * plan.coin_mult * rank.coin_mult * (pct / 100));
    await saveLessonCompletion(uid, lk, sc, tot, xpE, coinE);
    renderUnits();
    showResult(lk, pct, xpE, coinE, unit, uid);
}

async function saveLessonCompletion(unitId, lessonKey, score, total, xpEarned, coinEarned) {
    const pct = total > 0 ? Math.round((score / total) * 100) : 70;
    UProg[`${unitId}_${lessonKey}`] = 100;
    const allDone = ['A', 'B', 'C', 'D'].every(l => UProg[`${unitId}_${l}`] >= 100);
    if (!CU) {
        UXP += xpEarned; UCoin += coinEarned;
        updateDisplays(); renderUnits();
        showToast(`✅ +${xpEarned} XP +${coinEarned} 🪙`, 'success');
        return;
    }
    try {
        const updates = {
            xp: increment(xpEarned), coins: increment(coinEarned),
            totalXP: increment(xpEarned), totalCoins: increment(coinEarned),
            [`progress.${unitId}_${lessonKey}`]: 100,
            [`scores.${unitId}_${lessonKey}`]: pct,
            'stats.totalSessions': increment(1)
        };
        if (allDone) {
            updates['stats.unitsCompleted'] = increment(1);
            updates.xp = increment(xpEarned + 50);
            updates.coins = increment(coinEarned + 10);
            updates.totalXP = increment(xpEarned + 50);
            updates.totalCoins = increment(coinEarned + 10);
            UStats.unitsCompleted = (UStats.unitsCompleted || 0) + 1;
            showToast(`🎉 Юнит пройден! +50 XP +10 🪙 бонус!`, 'success');
        }
        await updateUserField(updates);
        UXP += xpEarned + (allDone ? 50 : 0);
        UCoin += coinEarned + (allDone ? 10 : 0);
        updateDisplays();
        showToast(`✅ +${xpEarned} XP +${coinEarned} 🪙 сохранено!`, 'success');
    } catch (e) { console.error(e); }
}

function showResult(lk, pct, xp, coin, unit, uid) {
    const lnames = { A: "Грамматика", B: 'Аудирование', C: 'Чтение', D: 'Говорение' };
    const nxt = { A: 'B', B: 'C', C: 'D', D: null };
    const content = $id('modalContent'); if (!content) return;
    const circleColor = pct >= 80 ? '#34d399' : pct >= 60 ? '#f5c842' : '#ef4444';
    content.innerHTML = `<div style="text-align:center;padding:20px">
      <div style="width:120px;height:120px;border-radius:50%;background:${circleColor}22;border:3px solid ${circleColor};display:flex;flex-direction:column;align-items:center;justify-content:center;margin:0 auto 20px">
        <div style="font-size:1.8rem;font-weight:800;color:${circleColor}">${pct}%</div>
        <div style="font-size:0.72rem;color:${circleColor}">${lnames[lk]}</div>
      </div>
      <div style="display:flex;gap:16px;justify-content:center;margin:16px 0">
        <div style="padding:12px 20px;border-radius:12px;background:rgba(192,57,43,0.1);border:1px solid rgba(192,57,43,0.2)"><div style="font-size:0.7rem;color:#666">XP</div><div style="font-weight:700;color:#c0392b">+${xp}</div></div>
        <div style="padding:12px 20px;border-radius:12px;background:rgba(245,200,66,0.1);border:1px solid rgba(245,200,66,0.2)"><div style="font-size:0.7rem;color:#666">Монеты</div><div style="font-weight:700;color:#f5c842">+${coin}</div></div>
      </div>
      <div style="font-size:1.2rem;margin-bottom:20px">${pct >= 80 ? '🏆 Отлично!' : pct >= 60 ? '✅ Хорошо!' : '💪 Попробуйте ещё раз!'}</div>
      <div style="display:flex;flex-direction:column;gap:8px">
        ${nxt[lk] ? `<button onclick="window.openLesson('${uid}','${nxt[lk]}')" style="padding:12px;border-radius:12px;background:linear-gradient(135deg,#c0392b,#f39c12);border:none;color:#fff;font-size:0.9rem;font-weight:700;cursor:pointer;font-family:inherit">→ Следующий: ${lnames[nxt[lk]]}</button>` : `<div style="padding:14px;border-radius:12px;background:rgba(52,211,153,0.1);border:1px solid rgba(52,211,153,0.25);color:#34d399;font-weight:700">🎉 Юнит полностью пройден!</div>`}
        <button onclick="document.getElementById('unitModal').classList.remove('active');renderUnits()" style="padding:12px;border-radius:12px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);color:#e8ecff;cursor:pointer;font-size:0.9rem;font-family:inherit">🏠 К юнитам</button>
      </div>
    </div>`;
    showXPPop(`+${xp} XP`);
    const modal = $id('unitModal'); if (modal) modal.classList.add('active');
}

// ══════════════════════════════════════════════════════════════
// СЛОВАРЬ
// ══════════════════════════════════════════════════════════════
function renderWords(reset = true) {
    if (reset) wOff = 0;
    const grid = $id('wordsGrid'); if (!grid) return;
    const filt = WDB.filter(w => {
        const ms = !wSrch || w.e.toLowerCase().includes(wSrch) || w.u.toLowerCase().includes(wSrch);
        const ml = wFilt === 'all' || w.l === wFilt;
        return ms && ml;
    });
    const slice = filt.slice(0, wOff + 30);
    if (reset) grid.innerHTML = '';
    slice.slice(wOff).forEach(w => {
        const card = document.createElement('div');
        card.style.cssText = 'padding:16px;border-radius:14px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);cursor:pointer;transition:all 0.2s';
        card.innerHTML = `<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px">
          <div style="font-weight:700;font-size:1.05rem;color:#e8ecff;font-family:'Playfair Display',serif">${w.e}</div>
          <button onclick="window.spk('${w.e.replace(/'/g, "\\'")}',event)" style="background:none;border:none;cursor:pointer;font-size:1rem">🔊</button>
        </div>
        <div style="font-size:0.82rem;color:#c0392b;margin-bottom:6px">${w.u}</div>
        <div style="display:flex;gap:6px;font-size:0.68rem">
          <span style="background:rgba(255,255,255,0.05);padding:2px 8px;border-radius:8px;color:#666">${w.t}</span>
          <span style="background:rgba(255,255,255,0.05);padding:2px 8px;border-radius:8px;color:#666">${w.l}</span>
        </div>`;
        card.onmouseover = () => { card.style.background = 'rgba(192,57,43,0.08)'; card.style.borderColor = 'rgba(192,57,43,0.25)'; };
        card.onmouseout = () => { card.style.background = 'rgba(255,255,255,0.03)'; card.style.borderColor = 'rgba(255,255,255,0.08)'; };
        card.onclick = e => { if (e.target.closest('button')) return; openWModal(w); };
        grid.appendChild(card);
    });
    wOff = slice.length;
    const btn = $id('loadMoreBtn'); if (btn) btn.style.display = wOff >= filt.length ? 'none' : 'block';
}

window.filterWords = function () { wSrch = ($id('wordSearch')?.value.toLowerCase() || ''); renderWords(true); };
window.filterByLevel = function (level, el) { wFilt = level; document.querySelectorAll('.wf-tab').forEach(t => t.classList.remove('active')); if (el) el.classList.add('active'); renderWords(true); };
window.loadMoreWords = function () { renderWords(false); };

function openWModal(w) {
    const m = $id('wordModal'); const c = $id('wordModalContent'); if (!m || !c) return;
    c.innerHTML = `<div style="text-align:center;padding:20px">
      <div style="font-size:2.5rem;font-weight:800;color:#e8ecff;margin-bottom:8px;font-family:'Playfair Display',serif">${w.e}</div>
      <div style="font-size:1.1rem;color:#c0392b;margin-bottom:12px">${w.u}</div>
      <div style="font-size:0.82rem;color:#666;margin:0 0 4px;font-style:italic">${w.t}</div>
      <div style="padding:12px;background:rgba(255,255,255,0.04);border-radius:10px;margin-bottom:16px;font-size:0.85rem;color:#fdd;font-style:italic">"${w.ex}"</div>
      <div style="color:#e88;font-size:0.82rem;margin-bottom:16px">${w.eu}</div>
      <div style="display:flex;gap:8px;justify-content:center">
        <button onclick="window.spk('${w.e.replace(/'/g, "\\'")}',event)" style="padding:8px 20px;border-radius:10px;background:rgba(41,128,185,0.15);border:1px solid rgba(41,128,185,0.3);color:#60a5fa;cursor:pointer;font-family:inherit">🔊 Произношение</button>
        <button onclick="window.aiExWord('${w.e.replace(/'/g, "\\'")}',event)" style="padding:8px 20px;border-radius:10px;background:rgba(192,57,43,0.1);border:1px solid rgba(192,57,43,0.25);color:#e88;cursor:pointer;font-family:inherit">🤖 AI объяснит (1 токен)</button>
      </div>
      <div id="wordAIFB" style="margin-top:12px;font-size:0.82rem"></div>
    </div>`;
    m.classList.add('active');
}
window.closeWordModal = function (e) { if (!e || e.target === $id('wordModal')) $id('wordModal')?.classList.remove('active'); };

// ══════════════════════════════════════════════════════════════
// ПРАКТИКА — ФЛЭШКАРТОЧКИ
// ══════════════════════════════════════════════════════════════
window.switchPractice = function (panel, el) {
    document.querySelectorAll('.practice-panel').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.practice-tabs .ptab').forEach(b => b.classList.remove('active'));
    const p = $id('panel-' + panel); if (p) p.classList.add('active');
    if (el) el.classList.add('active');
};

function initFlashcards() { flashDeck = shuffle([...WDB]).slice(0, 20); flashIdx = 0; flashCorrect = 0; flashWrong = 0; showFlash(); }
function showFlash() {
    if (flashIdx >= flashDeck.length) {
        const fw = $id('flashWord'); const fu = $id('flashUz');
        if (fw) fw.textContent = '🎉 Конец!';
        if (fu) fu.textContent = `Правильно: ${flashCorrect}, Неправильно: ${flashWrong}`; return;
    }
    const w = flashDeck[flashIdx];
    const fc = $id('flashcard'); if (fc) fc.classList.remove('flipped');
    const fw = $id('flashWord'); if (fw) fw.textContent = w.e;
    const fu = $id('flashUz'); if (fu) fu.textContent = w.u;
    const fe = $id('flashEx'); if (fe) fe.textContent = w.ex || '';
    const fp = $id('flashProgress'); if (fp) fp.textContent = (flashIdx + 1) + ' / ' + flashDeck.length;
    const fb = $id('flashBar'); if (fb) fb.style.width = Math.round((flashIdx / flashDeck.length) * 100) + '%';
}
window.flipCard = function () { const fc = $id('flashcard'); if (fc) fc.classList.toggle('flipped'); if (flashIdx < flashDeck.length) window.speakWord(flashDeck[flashIdx].e); };
window.flashResult = function (result) { if (result === 'correct') { flashCorrect++; awardXP(5, 'grammar'); } else flashWrong++; flashIdx++; showFlash(); };
window.nextFlash = function () { flashIdx++; showFlash(); };

// ── Тест ──
function initQuiz() { quizScore = 0; const el = $id('quizScore'); if (el) el.textContent = 0; showQuizWord(); }
function showQuizWord() {
    quizAnswered = false;
    const pool = shuffle([...WDB]); curQuizWord = pool[0];
    const opts = shuffle([curQuizWord, ...pool.slice(1, 4)]);
    const type = Math.random() > 0.5 ? 'ru2uz' : 'uz2ru';
    const qEl = $id('quizQ'); if (qEl) qEl.textContent = type === 'ru2uz' ? `"${curQuizWord.e}" = ?` : `"${curQuizWord.u}" = ?`;
    const optsEl = $id('quizOptions');
    if (optsEl) optsEl.innerHTML = opts.map(o => `<button class="quiz-opt" onclick="window.checkQuizOpt(this,'${o.e.replace(/'/g, "\\'")}','${type}')" style="width:100%;margin-bottom:8px;padding:12px;border-radius:10px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);color:#e8ecff;cursor:pointer;text-align:left;font-family:inherit;font-size:0.9rem;transition:all 0.2s">${type === 'ru2uz' ? o.u : o.e}</button>`).join('');
    const fb = $id('quizFeedback'); if (fb) fb.innerHTML = '';
}
window.checkQuizOpt = function (btn, chosen, type) {
    if (quizAnswered) return; quizAnswered = true;
    document.querySelectorAll('.quiz-opt').forEach(b => {
        const bVal = b.textContent.trim();
        if (type === 'ru2uz' ? bVal === curQuizWord.u : bVal === curQuizWord.e) { b.style.background = 'rgba(52,211,153,0.2)'; b.style.borderColor = '#34d399'; }
        else if (b === btn) { b.style.background = 'rgba(239,68,68,0.2)'; b.style.borderColor = '#ef4444'; }
    });
    const fb = $id('quizFeedback');
    if (chosen === curQuizWord.e) { quizScore++; const el = $id('quizScore'); if (el) el.textContent = quizScore; awardXP(10, 'grammar'); if (fb) fb.innerHTML = '<span style="color:#34d399">✅ Правильно!</span>'; }
    else { if (fb) fb.innerHTML = `<span style="color:#ef4444">❌ Правильно: ${type === 'ru2uz' ? curQuizWord.u : curQuizWord.e}</span>`; }
    window.speakWord(curQuizWord.e);
};
window.nextQuiz = function () { showQuizWord(); };

// ── Соответствие ──
function initMatch() {
    const pool = shuffle([...WDB]).slice(0, 5);
    matchPairs = pool; matchMatched = []; matchSel1 = null;
    const items = shuffle([...pool.map(w => ({ id: w.e, text: w.e, type: 'ru' })), ...pool.map(w => ({ id: w.e, text: w.u, type: 'uz' }))]);
    const grid = $id('matchGrid');
    if (grid) grid.innerHTML = items.map(item => `<div class="match-item" data-id="${item.id}" data-type="${item.type}" onclick="window.selectMatch2(this)" style="padding:12px;border-radius:10px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);color:#e8ecff;cursor:pointer;font-family:inherit;transition:all 0.2s;font-size:0.88rem">${item.text}</div>`).join('');
    const fb = $id('matchFeedback'); if (fb) fb.innerHTML = '';
}
window.startMatch = initMatch;
window.selectMatch2 = function (el) {
    if (el.classList.contains('matched')) return;
    if (!matchSel1) {
        matchSel1 = el; el.style.background = 'rgba(192,57,43,0.2)'; el.style.borderColor = '#c0392b';
    } else {
        if (matchSel1 === el) { el.style.background = 'rgba(255,255,255,0.04)'; el.style.borderColor = 'rgba(255,255,255,0.1)'; matchSel1 = null; return; }
        if (matchSel1.dataset.type === el.dataset.type) {
            matchSel1.style.background = 'rgba(255,255,255,0.04)'; matchSel1.style.borderColor = 'rgba(255,255,255,0.1)';
            matchSel1 = el; el.style.background = 'rgba(192,57,43,0.2)'; el.style.borderColor = '#c0392b'; return;
        }
        if (matchSel1.dataset.id === el.dataset.id) {
            matchSel1.style.background = 'rgba(52,211,153,0.15)'; matchSel1.style.borderColor = '#34d399'; matchSel1.classList.add('matched');
            el.style.background = 'rgba(52,211,153,0.15)'; el.style.borderColor = '#34d399'; el.classList.add('matched');
            matchMatched.push(el.dataset.id); matchSel1 = null; awardXP(15, 'grammar');
            if (matchMatched.length === matchPairs.length) { const fb = $id('matchFeedback'); if (fb) fb.innerHTML = '<span style="color:#34d399">🎉 Все пары найдены!</span>'; }
        } else {
            const s = matchSel1; matchSel1 = null;
            s.style.background = 'rgba(239,68,68,0.15)'; s.style.borderColor = '#ef4444';
            el.style.background = 'rgba(239,68,68,0.15)'; el.style.borderColor = '#ef4444';
            setTimeout(() => {
                s.style.background = 'rgba(255,255,255,0.04)'; s.style.borderColor = 'rgba(255,255,255,0.1)';
                el.style.background = 'rgba(255,255,255,0.04)'; el.style.borderColor = 'rgba(255,255,255,0.1)';
            }, 800);
        }
    }
};

// ── Ввод ──
function initTyping() { typingDeck = shuffle([...WDB]); typingIdx = 0; showTypingWord(); }
function showTypingWord() {
    const w = typingDeck[typingIdx % typingDeck.length];
    const tw = $id('typingWord'); if (tw) tw.textContent = w.e;
    const th = $id('typingHint'); if (th) th.textContent = "Перевод: " + w.u;
    const ti = $id('typingInput'); if (ti) { ti.value = ''; ti.style.borderColor = ''; }
    const tf = $id('typingFeedback'); if (tf) tf.innerHTML = '';
}
window.checkTyping = function () {
    const w = typingDeck[typingIdx % typingDeck.length];
    const val = $id('typingInput')?.value.trim().toLowerCase() || '';
    const fb = $id('typingFeedback'); const inp = $id('typingInput');
    if (val === w.e.toLowerCase()) {
        if (fb) fb.innerHTML = '<span style="color:#34d399">✅ Правильно!</span>';
        if (inp) inp.style.borderColor = '#34d399';
        awardXP(8, 'grammar'); setTimeout(() => { typingIdx++; showTypingWord(); }, 800);
    } else if (val.length >= w.e.length) {
        if (fb) fb.innerHTML = `<span style="color:#ef4444">❌ Правильно: ${w.e}</span>`;
        if (inp) inp.style.borderColor = '#ef4444';
    }
};
window.nextTyping = function () { typingIdx++; showTypingWord(); };

// ── Грамматика ──
function initGrammar() { curGrammarIdx = 0; showGrammarQ(); }
function showGrammarQ() {
    grammarAnswered = false;
    const q = GRAMMAR_QS[curGrammarIdx % GRAMMAR_QS.length];
    const qBox = $id('grammarQBox'); if (qBox) qBox.textContent = q.q;
    const optsEl = $id('grammarOptions');
    if (optsEl) optsEl.innerHTML = q.opts.map(o => `<button onclick="window.checkGrammar('${o.replace(/'/g, "\\'")}','${q.ans.replace(/'/g, "\\'")}','${q.exp.replace(/'/g, "\\'")}')" style="margin:4px;padding:10px 18px;border-radius:10px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);color:#e8ecff;cursor:pointer;font-family:inherit;transition:all 0.2s">${o}</button>`).join('');
    const fb = $id('grammarFeedback'); if (fb) fb.innerHTML = '';
}
window.checkGrammar = function (chosen, ans, exp) {
    if (grammarAnswered) return; grammarAnswered = true;
    const fb = $id('grammarFeedback');
    document.querySelectorAll('#grammarOptions button').forEach(b => {
        if (b.textContent === ans) { b.style.background = 'rgba(52,211,153,0.2)'; b.style.borderColor = '#34d399'; }
        else if (b.textContent === chosen && chosen !== ans) { b.style.background = 'rgba(239,68,68,0.2)'; b.style.borderColor = '#ef4444'; }
    });
    if (chosen === ans) {
        if (fb) fb.innerHTML = `<div style="color:#34d399;padding:10px;border-radius:10px;background:rgba(52,211,153,0.1)">✅ Правильно! ${exp}</div>`;
        grammarScore2++; const el = $id('grammarScore'); if (el) el.textContent = grammarScore2; awardXP(12, 'grammar');
    } else {
        if (fb) fb.innerHTML = `<div style="color:#ef4444;padding:10px;border-radius:10px;background:rgba(239,68,68,0.1)">❌ Неправильно. Правильный ответ: <b>${ans}</b>. ${exp}</div>`;
    }
};
window.nextGrammarEx = function () { curGrammarIdx++; showGrammarQ(); };

// ══════════════════════════════════════════════════════════════
// AI ЧАТ — токен за каждый символ
// ══════════════════════════════════════════════════════════════
const CHAT_MODES = {
    free: { label: 'Свободный чат', sys: 'Вы — дружелюбный репетитор по русскому языку для узбекоязычных студентов. Общайтесь на русском и узбекском, помогайте изучать русский. Ответы краткие (2-4 предложения). Если пользователь пишет по-узбекски, отвечайте на обоих языках.' },
    teacher: { label: 'Учитель', sys: 'Вы — учитель русского языка для узбекских студентов. Объясняйте грамматику по-узбекски, приводите примеры, поощряйте. Будьте терпеливы и систематичны.' },
    grammar: { label: 'Грамматика', sys: 'Вы — проверщик русской грамматики. Когда пользователь присылает текст, найдите все ошибки, объясните каждую по-узбекски, покажите исправленный вариант. Формат: «❌ Ошибка → ✅ Правильно: ... 📚 Правило: ...»' },
    translate: { label: 'Переводчик', sys: 'Вы — профессиональный переводчик русского и узбекского языков. Переводите точно и естественно. Объясняйте идиомы и выражения.' },
    torfl: { label: 'ТРКИ/ТОРФЛ', sys: 'Вы — тренер по подготовке к ТРКИ для узбекских студентов. Помогайте с чтением, письмом, аудированием и говорением. Давайте обратную связь по критериям ТРКИ. Будьте точны и поощряйте.' }
};

let curChatMode = CHAT_MODES.free;

window.setChatMode = function (mode, el) {
    document.querySelectorAll('.chat-mode-btn').forEach(b => b.classList.remove('active'));
    if (el) el.classList.add('active');
    chatMode = mode;
    curChatMode = CHAT_MODES[mode] || CHAT_MODES.free;
    appendChat('assistant', `Режим: <b>${curChatMode.label}</b>. ${mode === 'free' ? 'Давайте пообщаемся!' :
        mode === 'teacher' ? 'Что хотите изучить?' :
            mode === 'grammar' ? 'Пришлите текст — проверю грамматику!' :
                mode === 'translate' ? 'Что переведём?' :
                    'Задайте вопрос по ТРКИ!'}`, false);
};

window.insertQuickPhrase = function (p) { const inp = $id('chatInput'); if (inp) { inp.value = p; inp.focus(); } };
window.handleChatKey = function (e) {
    // 1 токен за символ обрабатывается через chatInputKeyHandler
    window.chatInputKeyHandler(e);
};

window.sendChatMessage = async function () {
    const inp = $id('chatInput'); if (!inp) return;
    const text = inp.value.trim(); if (!text) return;
    if (UTokens <= 0 && UP !== 'ultimate') { showTokenEmptyModal('Нужны токены для AI чата'); return; }
    inp.value = '';
    appendChat('user', text, true);
    chatHist.push({ role: 'user', parts: [{ text }] });
    const typingId = 'typing_' + Date.now();
    appendChat('assistant', '<span class="typing">Печатаю...</span>', false, typingId);
    const sendBtn = $id('chatSendBtn'); if (sendBtn) sendBtn.disabled = true;
    try {
        const resp = await fetch(AI_PROXY, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [
                    { role: 'user', parts: [{ text: curChatMode.sys + LANG_RULES }] },
                    ...chatHist.slice(-10)
                ],
                generationConfig: {
                    temperature: 0.8,
                    maxOutputTokens: UP === 'ultimate' ? 2000 : UP === 'premium' ? 1500 : 1000
                }
            })
        });
        const tb = $id(typingId); if (tb) tb.remove();
        if (!resp.ok) { appendChat('assistant', `❗ Ошибка AI: ${resp.status}`, false); return; }
        const d = await resp.json();
        const reply = d.candidates?.[0]?.content?.parts?.[0]?.text || 'Извините, не удалось получить ответ.';
        appendChat('assistant', reply, true);
        chatHist.push({ role: 'model', parts: [{ text: reply }] });
        awardXP(5, 'speaking');
    } catch (e) {
        const tb = $id(typingId); if (tb) tb.remove();
        appendChat('assistant', `❗ Ошибка: ${e.message || 'сетевая проблема'}`, false);
    } finally {
        if (sendBtn) sendBtn.disabled = false;
    }
};

function appendChat(role, html, save = false, id = null) {
    const c = $id('chatMessages'); if (!c) return;
    const isAI = role === 'assistant';
    const div = document.createElement('div');
    div.className = `chat-msg ${isAI ? 'ai-msg' : 'user-msg'}`;
    if (id) div.id = id;
    div.innerHTML = `
      <div class="chat-avatar">${isAI ? '<i class="fa-solid fa-robot"></i>' : '<i class="fa-solid fa-user"></i>'}</div>
      <div class="chat-bubble">${html}</div>`;
    c.appendChild(div);
    c.scrollTop = c.scrollHeight;
}

window.clearChatHistory = async function () {
    if (!confirm('Очистить историю чата?')) return;
    chatHist = [];
    const c = $id('chatMessages');
    if (c) c.innerHTML = `<div class="chat-msg ai-msg"><div class="chat-avatar"><i class="fa-solid fa-robot"></i></div><div class="chat-bubble">Привет! История очищена. Начнём сначала! 😊</div></div>`;
    showToast('История чата очищена', 'success');
};

// ══════════════════════════════════════════════════════════════
// ВИДЕО
// ══════════════════════════════════════════════════════════════
window.findYoutubeVideos = function () {
    const grid = $id('videosGrid'); if (!grid) return;
    const videos = [
        { title: 'Русский язык для начинающих', channel: 'Russian with Max', id: 'sTANio_2E0Q' },
        { title: 'Грамматика русского языка', channel: 'RussianPod101', id: 'X_9m-4rXSmo' },
        { title: '500 русских фраз', channel: 'Russian Language Club', id: 'X9_Vr0DKOSM' },
        { title: 'Подготовка к ТРКИ', channel: 'Learn Russian', id: 'x8D_SLFliAI' },
    ];
    grid.innerHTML = videos.map(v => `<div style="border-radius:14px;overflow:hidden;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08)">
        <a href="https://www.youtube.com/watch?v=${v.id}" target="_blank" style="display:block">
          <img src="https://img.youtube.com/vi/${v.id}/mqdefault.jpg" style="width:100%;height:160px;object-fit:cover" alt="${v.title}">
          <div style="padding:12px">
            <div style="font-weight:600;font-size:0.85rem;color:#e8ecff;margin-bottom:4px">${v.title}</div>
            <div style="font-size:0.75rem;color:#666"><i class="fa-brands fa-youtube" style="color:#ef4444;margin-right:4px"></i>${v.channel}</div>
          </div>
        </a>
    </div>`).join('');
};

// ══════════════════════════════════════════════════════════════
// ЗАКРЫТИЕ МОДАЛЬНЫХ ОКОН
// ══════════════════════════════════════════════════════════════
window.closeModal = function () { $id('unitModal')?.classList.remove('active'); };
window.closeUnitModal = function (e) { if (e.target === $id('unitModal')) window.closeModal(); };

// ══════════════════════════════════════════════════════════════
// АВТОРИЗАЦИЯ И ИНИЦИАЛИЗАЦИЯ
// ══════════════════════════════════════════════════════════════
onAuthStateChanged(_auth, async (user) => {
    if (!user) { window.location.href = '../auth/login.html'; return; }
    CU = user;
    await loadUserData();
    updateDisplays();
    renderTokenBar();
    renderUnits();
    renderWords();
    initFlashcards();
    initQuiz();
    initMatch();
    initTyping();
    initGrammar();
    drawRadar();

    // Привязываем обработчик токена к полю чата
    const chatInput = $id('chatInput');
    if (chatInput) {
        chatInput.addEventListener('keydown', window.chatInputKeyHandler);
    }

    setTimeout(() => window.loadLBSection('xp', $id('lb-xp-btn')), 800);
});