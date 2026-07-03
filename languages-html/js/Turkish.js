// =====================================================
// Turkish.js — LinguaVerse (100% FIXED VERSION)
// =====================================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
    getFirestore, doc, getDoc, setDoc, updateDoc,
    increment, serverTimestamp, collection,
    query, orderBy, limit, getDocs
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

// ── GROQ WORKER PROXY ──
// Xavfsiz: AI so'rovlar endi ochiq worker emas, server funksiyasi orqali (kalit serverda)
const AI_PROXY = "/.netlify/functions/groq";
const NATIVE_LANG = ({ uz: "Uzbek", en: "English", ru: "Russian", es: "Spanish", de: "German", tr: "Turkish", ar: "Arabic", ko: "Korean", zh: "Chinese" })[localStorage.getItem('coach_native') || localStorage.getItem('lv_lang') || 'uz'] || "Uzbek";
const LANG_RULES = `\n\nIMPORTANT OVERRIDE: The student's native language is ${NATIVE_LANG}. Speak PRIMARILY in the language being taught on this page — practice must happen in the target language itself. Use ${NATIVE_LANG} ONLY for short translations and explanations of mistakes. NEVER reply fully in ${NATIVE_LANG}.\nQUALITY BAR: teach at professional exam-preparation level (IELTS/Goethe/DELE/TOPIK/HSK-equivalent): authentic natural language, precise corrections referencing grammar rules, exam-style feedback on fluency, vocabulary range and accuracy. Push the student slightly above their current level.`;


// ══════════════════════════════════════════════════════════════
// CONFIG
// ══════════════════════════════════════════════════════════════
const TOKEN_CONFIG = {
    default_tokens: 1000,
    reset_hours: 5,
    ai_cost: 1,
    unit_cost: 2,
};

const PLANS = {
    free:     { name: "Free",     icon: "🆓", price_uzs: 0,     token_bonus: 1000,   token_reset_mult: 1,   ai_quality: "standard", xp_mult: 1,   coin_mult: 1,   features: ["1000 token/5soat", "Standart AI"] },
    pro:      { name: "Pro",      icon: "⭐", price_uzs: 29000, token_bonus: 3000,   token_reset_mult: 2,   ai_quality: "enhanced", xp_mult: 1.5, coin_mult: 1.3, features: ["3000 token/5soat", "+50% XP"] },
    premium:  { name: "Premium",  icon: "💎", price_uzs: 59000, token_bonus: 8000,   token_reset_mult: 3,   ai_quality: "advanced", xp_mult: 2,   coin_mult: 1.8, features: ["8000 token/5soat", "+100% XP"] },
    ultimate: { name: "Ultimate", icon: "🚀", price_uzs: 99000, token_bonus: 999999, token_reset_mult: 999, ai_quality: "ultimate", xp_mult: 3,   coin_mult: 2.5, features: ["Cheksiz tokenlar", "+200% XP"] }
};

const RANKS = {
    none:    { name: "Oddiy",   icon: "⬜", color: "#888",    token_bonus: 0,    xp_mult: 1,   coin_mult: 1,   price_coins: 0 },
    silver:  { name: "Silver",  icon: "🥈", color: "#C0C0C0", token_bonus: 200,  xp_mult: 1.3, coin_mult: 1.2, price_coins: 500 },
    gold:    { name: "Gold",    icon: "🥇", color: "#FFD700", token_bonus: 500,  xp_mult: 1.8, coin_mult: 1.5, price_coins: 1500 },
    diamond: { name: "Diamond", icon: "💎", color: "#B9F2FF", token_bonus: 1000, xp_mult: 2.5, coin_mult: 2,   price_coins: 4000 }
};

const PLAN_COLORS = { free: "#94a3b8", basic: "#60a5fa", starter: "#60a5fa", premium: "#a78bfa", ultimate: "#f5c842", vip: "#f5c842" };
const PLAN_LABELS = { free: "Bepul", basic: "Basic", starter: "Starter", premium: "Premium", ultimate: "Ultimate", vip: "VIP" };

// ══════════════════════════════════════════════════════════════
// STATE
// ══════════════════════════════════════════════════════════════
let CU = null;
let UP = 'free';
let UTokens = 1000, UMaxTokens = 1000, ULastReset = 0;
let UXP = 0, UCoin = 0, URank = 'none';
let UProg = {};
let USk = { reading: 0, writing: 0, speaking: 0, listening: 0, grammar: 0 };
let UStats = { unitsCompleted: 0, totalSessions: 0, streak: 0, totalXP: 0, totalCoins: 0 };

let chatHist = [];
let chatMode = 'free';
let curLevel = 'beginner';
let curUnit = null;
let lScore = 0, lTotal = 0;
let lexSel = {}, rSel = {}, woAns = [], lessonMics = {};
let mSel = { e: null, u: null, eEl: null, uEl: null };

let flashDeck = [], flashIdx = 0, flashCorrect = 0, flashWrong = 0;
let quizScore = 0, curQuizWord = null, quizAnswered = false;
let matchPairs = [], matchMatched = [], matchSel1 = null;
let typingDeck = [], typingIdx = 0;
let grammarScore2 = 0, grammarAnswered = false, curGrammarIdx = 0;

let wOff = 0, wFilt = 'all', wSrch = '';
let dictSent = '';

// ══════════════════════════════════════════════════════════════
// TURKISH WORDS DATABASE (500+)
// ══════════════════════════════════════════════════════════════
const WDB = [
    // ─── BEGINNER ───
    { e: 'merhaba',    u: 'Salom',           t: 'interjection', l: 'beginner', ex: 'Merhaba, nasılsın?',                 eu: 'Salom, qandaysan?' },
    { e: 'güle güle',  u: 'Xayr',            t: 'interjection', l: 'beginner', ex: 'Güle güle, yarın görüşürüz!',        eu: 'Xayr, ertaga ko\'rishamiz!' },
    { e: 'teşekkür',   u: 'Rahmat',          t: 'noun',         l: 'beginner', ex: 'Teşekkür ederim, çok güzelsiniz.',   eu: 'Rahmat, siz juda mehribonsiz.' },
    { e: 'lütfen',     u: 'Iltimos',         t: 'adverb',       l: 'beginner', ex: 'Lütfen bana yardım eder misin?',     eu: 'Iltimos, menga yordam berasizmi?' },
    { e: 'özür',       u: 'Kechirim',        t: 'noun',         l: 'beginner', ex: 'Özür dilerim, geç kaldım.',          eu: 'Kechirim so\'rayman, kechikdim.' },
    { e: 'evet',       u: 'Ha',              t: 'interjection', l: 'beginner', ex: 'Evet, sizi anlıyorum.',              eu: 'Ha, sizni tushunaman.' },
    { e: 'hayır',      u: 'Yo\'q',           t: 'interjection', l: 'beginner', ex: 'Hayır, bunu istemiyorum.',           eu: 'Yo\'q, buni xohlamayman.' },
    { e: 'iyi',        u: 'Yaxshi',          t: 'adjective',    l: 'beginner', ex: 'İyi günler, herkese!',               eu: 'Hammaga yaxshi kunlar!' },
    { e: 'kötü',       u: 'Yomon',           t: 'adjective',    l: 'beginner', ex: 'Bugün hava kötü.',                   eu: 'Bugun havo yomon.' },
    { e: 'büyük',      u: 'Katta',           t: 'adjective',    l: 'beginner', ex: 'Bu büyük bir ev.',                   eu: 'Bu katta uy.' },
    { e: 'küçük',      u: 'Kichik',          t: 'adjective',    l: 'beginner', ex: 'Küçük bir köpeğim var.',             eu: 'Kichik itim bor.' },
    { e: 'mutlu',      u: 'Xursand',         t: 'adjective',    l: 'beginner', ex: 'Bugün çok mutluyum!',               eu: 'Bugun juda xursandman!' },
    { e: 'üzgün',      u: 'Qayg\'li',        t: 'adjective',    l: 'beginner', ex: 'Neden üzgünsün?',                   eu: 'Nega qayg\'lisiz?' },
    { e: 'sıcak',      u: 'Issiq',           t: 'adjective',    l: 'beginner', ex: 'Dışarısı çok sıcak.',               eu: 'Tashqarida juda issiq.' },
    { e: 'soğuk',      u: 'Sovuq',           t: 'adjective',    l: 'beginner', ex: 'Su soğuk.',                         eu: 'Suv sovuq.' },
    { e: 'kırmızı',    u: 'Qizil',           t: 'adjective',    l: 'beginner', ex: 'Kırmızı elmaları seviyorum.',        eu: 'Qizil olmalarni yaxshi ko\'raman.' },
    { e: 'mavi',       u: 'Ko\'k',           t: 'adjective',    l: 'beginner', ex: 'Gökyüzü mavidir.',                  eu: 'Osmon ko\'k.' },
    { e: 'yeşil',      u: 'Yashil',          t: 'adjective',    l: 'beginner', ex: 'Çimen yeşildir.',                   eu: 'O\'t yashil.' },
    { e: 'sarı',       u: 'Sariq',           t: 'adjective',    l: 'beginner', ex: 'Güneş sarıdır.',                    eu: 'Quyosh sariq.' },
    { e: 'siyah',      u: 'Qora',            t: 'adjective',    l: 'beginner', ex: 'Kedim siyah.',                      eu: 'Mushugim qora.' },
    { e: 'beyaz',      u: 'Oq',              t: 'adjective',    l: 'beginner', ex: 'Kar beyazdır.',                     eu: 'Qor oq.' },
    { e: 'bir',        u: 'Bir',             t: 'number',       l: 'beginner', ex: 'Bir kardeşim var.',                  eu: 'Bir singlim bor.' },
    { e: 'iki',        u: 'Ikki',            t: 'number',       l: 'beginner', ex: 'İki kedim var.',                    eu: 'Ikki mushugim bor.' },
    { e: 'üç',         u: 'Uch',             t: 'number',       l: 'beginner', ex: 'Üç kitabı var.',                    eu: 'Uch kitobi bor.' },
    { e: 'dört',       u: 'To\'rt',          t: 'number',       l: 'beginner', ex: 'Dört mevsim var.',                  eu: 'To\'rt fasl bor.' },
    { e: 'beş',        u: 'Besh',            t: 'number',       l: 'beginner', ex: 'Beş parmağım var.',                 eu: 'Besh barmoqim bor.' },
    { e: 'anne',       u: 'Ona',             t: 'noun',         l: 'beginner', ex: 'Annem öğretmen.',                   eu: 'Onam o\'qituvchi.' },
    { e: 'baba',       u: 'Ota',             t: 'noun',         l: 'beginner', ex: 'Babam çok çalışıyor.',              eu: 'Otam qattiq ishlaydi.' },
    { e: 'kız kardeş', u: 'Singil/Opa',      t: 'noun',         l: 'beginner', ex: 'Kız kardeşim 10 yaşında.',          eu: 'Singlim 10 yoshda.' },
    { e: 'erkek kardeş',u:'Aka/Uka',         t: 'noun',         l: 'beginner', ex: 'Erkek kardeşim futbolu seviyor.',   eu: 'Akam futbolni yaxshi ko\'radi.' },
    { e: 'su',         u: 'Suv',             t: 'noun',         l: 'beginner', ex: 'Lütfen bana su ver.',               eu: 'Iltimos menga suv ber.' },
    { e: 'yemek',      u: 'Ovqat',           t: 'noun',         l: 'beginner', ex: 'Yemek lezzetli.',                   eu: 'Ovqat mazali.' },
    { e: 'elma',       u: 'Olma',            t: 'noun',         l: 'beginner', ex: 'Her gün bir elma yerim.',           eu: 'Har kuni bir olma yeyman.' },
    { e: 'ekmek',      u: 'Non',             t: 'noun',         l: 'beginner', ex: 'Taze ekmek pişiriyor.',             eu: 'Yangi non yopadi.' },
    { e: 'okul',       u: 'Maktab',          t: 'noun',         l: 'beginner', ex: 'Her gün okula gidiyorum.',          eu: 'Har kuni maktabga boraman.' },
    { e: 'kitap',      u: 'Kitob',           t: 'noun',         l: 'beginner', ex: 'Bu ilginç bir kitap.',              eu: 'Bu qiziqarli kitob.' },
    { e: 'köpek',      u: 'It',              t: 'noun',         l: 'beginner', ex: 'Arkadaş canlısı bir köpeğim var.',  eu: 'Mehribon itim bor.' },
    { e: 'kedi',       u: 'Mushuk',          t: 'noun',         l: 'beginner', ex: 'Kedi uyuyor.',                      eu: 'Mushuk uxlayapti.' },
    { e: 'ev',         u: 'Uy',              t: 'noun',         l: 'beginner', ex: 'Büyük bir evde yaşıyorum.',         eu: 'Katta uyda yashayman.' },
    { e: 'araba',      u: 'Avtomobil',       t: 'noun',         l: 'beginner', ex: 'Babamın kırmızı arabası var.',      eu: 'Otamning qizil mashinasi bor.' },
    { e: 'koşmak',     u: 'Yugurmoq',        t: 'verb',         l: 'beginner', ex: 'Her sabah koşuyor.',               eu: 'Har ertalab yuguradi.' },
    { e: 'yemek yemek',u: 'Yemoq',           t: 'verb',         l: 'beginner', ex: 'Akşam yemeğini 7\'de yeriz.',      eu: 'Kechki ovqatni soat 7 da yeymiz.' },
    { e: 'içmek',      u: 'Ichmoq',          t: 'verb',         l: 'beginner', ex: 'Kahve içiyor.',                     eu: 'Qahva ichadi.' },
    { e: 'uyumak',     u: 'Uxlamoq',         t: 'verb',         l: 'beginner', ex: 'Çocuklar erken uyuyor.',            eu: 'Bolalar erta uxlashadi.' },
    { e: 'okumak',     u: 'O\'qimoq',        t: 'verb',         l: 'beginner', ex: 'Kitap okumayı seviyorum.',          eu: 'Kitob o\'qishni yaxshi ko\'raman.' },
    { e: 'yazmak',     u: 'Yozmoq',          t: 'verb',         l: 'beginner', ex: 'Lütfen adınızı yazın.',             eu: 'Iltimos, ismingizni yozing.' },
    { e: 'yürümek',    u: 'Yurmoq',          t: 'verb',         l: 'beginner', ex: 'Okula yürüyerek gidiyorum.',        eu: 'Maktabga piyoda boraman.' },
    { e: 'konuşmak',   u: 'Gapirmoq',        t: 'verb',         l: 'beginner', ex: 'Türkçeyi iyi konuşuyor.',           eu: 'Turkchaini yaxshi gapiradi.' },
    { e: 'dinlemek',   u: 'Eshitmoq',        t: 'verb',         l: 'beginner', ex: 'Lütfen dikkatlice dinleyin.',       eu: 'Iltimos, diqqat bilan eshiting.' },
    { e: 'oynamak',    u: 'O\'ynamoq',       t: 'verb',         l: 'beginner', ex: 'Çocuklar oynamayı seviyor.',       eu: 'Bolalar o\'ynashni yaxshi ko\'radi.' },
    { e: 'pazartesi',  u: 'Dushanba',        t: 'noun',         l: 'beginner', ex: 'Pazartesi haftanın ilk günü.',     eu: 'Dushanba haftaning birinchi kuni.' },
    { e: 'salı',       u: 'Seshanba',        t: 'noun',         l: 'beginner', ex: 'Salı günü dersim var.',            eu: 'Seshanba kuni darsim bor.' },
    { e: 'çarşamba',   u: 'Chorshanba',      t: 'noun',         l: 'beginner', ex: 'Her çarşamba buluşuruz.',          eu: 'Har chorshanba uchrashAmiz.' },
    { e: 'perşembe',   u: 'Payshanba',       t: 'noun',         l: 'beginner', ex: 'Perşembe en sevdiğim gün.',        eu: 'Payshanba sevimli kunim.' },
    { e: 'cuma',       u: 'Juma',            t: 'noun',         l: 'beginner', ex: 'Cuma günü erken bitiririz.',       eu: 'Juma kuni erta tugatamiz.' },
    { e: 'cumartesi',  u: 'Shanba',          t: 'noun',         l: 'beginner', ex: 'Cumartesi dinlenirim.',             eu: 'Shanba kuni dam olaman.' },
    { e: 'pazar',      u: 'Yakshanba',       t: 'noun',         l: 'beginner', ex: 'Pazar tatil günüdür.',             eu: 'Yakshanba dam olish kuni.' },
    { e: 'sabah',      u: 'Ertalab',         t: 'noun',         l: 'beginner', ex: 'Her sabah uyanıyorum.',            eu: 'Har ertalab uyg\'onaman.' },
    { e: 'akşam',      u: 'Kechqurun',       t: 'noun',         l: 'beginner', ex: 'Akşam yürüyüş yaparız.',          eu: 'Kechqurun yurish qilamiz.' },
    { e: 'gece',       u: 'Kecha',           t: 'noun',         l: 'beginner', ex: 'İyi geceler, iyi uyuyun.',        eu: 'Yaxshi kechalar, yaxshi uxlang.' },
    { e: 'gün',        u: 'Kun',             t: 'noun',         l: 'beginner', ex: 'Güzel bir gün geçirin!',          eu: 'Yaxshi kun o\'tkazing!' },
    { e: 'yıl',        u: 'Yil',             t: 'noun',         l: 'beginner', ex: 'Bu yıl özel.',                    eu: 'Bu yil alohida.' },
    { e: 'zaman',      u: 'Vaqt',            t: 'noun',         l: 'beginner', ex: 'Saat kaç?',                       eu: 'Soat necha bo\'ldi?' },
    { e: 'isim',       u: 'Ism',             t: 'noun',         l: 'beginner', ex: 'Benim adım Ali.',                  eu: 'Mening ismim Ali.' },
    { e: 'şehir',      u: 'Shahar',          t: 'noun',         l: 'beginner', ex: 'İstanbul büyük bir şehir.',       eu: 'Istanbul katta shahar.' },
    { e: 'ülke',       u: 'Mamlakat',        t: 'noun',         l: 'beginner', ex: 'Türkiye benim ülkem.',             eu: 'Turkiya mening mamlakatim.' },
    { e: 'güneş',      u: 'Quyosh',          t: 'noun',         l: 'beginner', ex: 'Güneş parlıyor.',                  eu: 'Quyosh chiqyapti.' },
    { e: 'ay',         u: 'Oy',              t: 'noun',         l: 'beginner', ex: 'Bu gece ay parlak.',              eu: 'Bu kecha oy yorqin.' },
    { e: 'çiçek',      u: 'Gul',             t: 'noun',         l: 'beginner', ex: 'Güzel çiçekleri var.',            eu: 'Chiroyli gullari bor.' },
    { e: 'ağaç',       u: 'Daraxt',          t: 'noun',         l: 'beginner', ex: 'Ağaç çok uzun.',                  eu: 'Daraxt juda baland.' },
    { e: 'kuş',        u: 'Qush',            t: 'noun',         l: 'beginner', ex: 'Kuş şarkı söylüyor.',             eu: 'Qush sayrAyapti.' },
    { e: 'balık',      u: 'Baliq',           t: 'noun',         l: 'beginner', ex: 'Balık yemeyi seviyorum.',         eu: 'Baliq yeyishni yaxshi ko\'raman.' },
    { e: 'yeni',       u: 'Yangi',           t: 'adjective',    l: 'beginner', ex: 'Yeni bir telefonum var.',         eu: 'Yangi telefonim bor.' },
    { e: 'eski',       u: 'Eski',            t: 'adjective',    l: 'beginner', ex: 'Bu eski bir bina.',              eu: 'Bu eski bino.' },
    { e: 'uzun',       u: 'Uzun/Baland',     t: 'adjective',    l: 'beginner', ex: 'O çok uzun boylu.',              eu: 'U juda baland bo\'yli.' },
    { e: 'kısa',       u: 'Qisqa/Past',      t: 'adjective',    l: 'beginner', ex: 'Kısa saçlı kız zeki.',          eu: 'Qisqa sochli qiz aqlli.' },
    { e: 'hızlı',      u: 'Tez',             t: 'adjective',    l: 'beginner', ex: 'Araba çok hızlı.',               eu: 'Mashina juda tez.' },
    { e: 'yavaş',      u: 'Sekin',           t: 'adjective',    l: 'beginner', ex: 'Kaplumbağa yavaş yürür.',       eu: 'Toshbaqa sekin yuradi.' },
    { e: 'açık',       u: 'Ochiq',           t: 'adjective',    l: 'beginner', ex: 'Kapı açık.',                     eu: 'Eshik ochiq.' },
    { e: 'kapalı',     u: 'Yopiq',           t: 'adjective',    l: 'beginner', ex: 'Dükkan kapalı.',                 eu: 'Do\'kon yopiq.' },
    { e: 'sevmek',     u: 'Sevmoq',          t: 'verb',         l: 'beginner', ex: 'Ailemi seviyorum.',               eu: 'Oilamni sevaman.' },
    { e: 'beğenmek',   u: 'Yoqtirmoq',       t: 'verb',         l: 'beginner', ex: 'Çikolatayı beğeniyorum.',        eu: 'Shokoladni yoqtiraman.' },
    { e: 'istemek',    u: 'Xohlamoq',        t: 'verb',         l: 'beginner', ex: 'Eve gitmek istiyorum.',           eu: 'Uyga ketmoqchiman.' },
    { e: 'gelmek',     u: 'Kelmoq',          t: 'verb',         l: 'beginner', ex: 'Lütfen buraya gelin.',            eu: 'Iltimos, bu yerga keling.' },
    { e: 'gitmek',     u: 'Bormoq',          t: 'verb',         l: 'beginner', ex: 'Parka gidelim.',                  eu: 'Parkka boramiz.' },
    { e: 'vermek',     u: 'Bermoq',          t: 'verb',         l: 'beginner', ex: 'Bana o kitabı ver.',             eu: 'Menga o\'sha kitobni ber.' },
    { e: 'almak',      u: 'Olmoq',           t: 'verb',         l: 'beginner', ex: 'Bu şemsiyeyi al.',               eu: 'Bu soyabonni ol.' },
    { e: 'yardım',     u: 'Yordam',          t: 'noun/verb',    l: 'beginner', ex: 'Bana yardım eder misin?',        eu: 'Menga yordam bera olasizmi?' },
    { e: 'çalışmak',   u: 'Ishlash',         t: 'verb',         l: 'beginner', ex: 'Her gün çalışıyorum.',           eu: 'Har kuni ishlayman.' },
    { e: 'öğrenmek',   u: 'O\'rganmoq',      t: 'verb',         l: 'beginner', ex: 'Her gün Türkçe öğreniyorum.',   eu: 'Har kuni Turkcha o\'rganaman.' },
    { e: 'düşünmek',   u: 'O\'ylamoq',       t: 'verb',         l: 'beginner', ex: 'Haklı olduğunu düşünüyorum.',   eu: 'Siz to\'g\'ri deb o\'ylayman.' },
    { e: 'söylemek',   u: 'Aytmoq',          t: 'verb',         l: 'beginner', ex: 'Ne dediniz?',                    eu: 'Nima dedingiz?' },
    { e: 'bulmak',     u: 'Topmoq',          t: 'verb',         l: 'beginner', ex: 'Anahtarımı bulamıyorum.',        eu: 'Kalitimni topolmayapman.' },
    { e: 'satın almak',u: 'Sotib olmoq',     t: 'verb',         l: 'beginner', ex: 'Kitap satın almak istiyorum.',   eu: 'Kitob sotib olmoqchiman.' },
    { e: 'süt',        u: 'Sut',             t: 'noun',         l: 'beginner', ex: 'Çocuklar süt içiyor.',           eu: 'Bolalar sut ichadi.' },
    { e: 'yumurta',    u: 'Tuxum',           t: 'noun',         l: 'beginner', ex: 'Kahvaltıda iki yumurta yerim.',  eu: 'Nonushtada ikki tuxum yeyman.' },
    { e: 'pirinç',     u: 'Guruch',          t: 'noun',         l: 'beginner', ex: 'Pirinç bizim ana yemeğimiz.',    eu: 'Guruch asosiy ovqatimiz.' },
    { e: 'et',         u: 'Go\'sht',         t: 'noun',         l: 'beginner', ex: 'Bu et çok lezzetli.',            eu: 'Bu go\'sht juda mazali.' },
    { e: 'çay',        u: 'Choy',            t: 'noun',         l: 'beginner', ex: 'Çay içelim.',                    eu: 'Choy ichamiz.' },
    { e: 'kahve',      u: 'Qahva',           t: 'noun',         l: 'beginner', ex: 'Her sabah kahve içiyorum.',      eu: 'Har ertalab qahva ichaman.' },
    { e: 'portakal',   u: 'Apelsin',         t: 'noun',         l: 'beginner', ex: 'Portakallar tatlı.',             eu: 'Apelsinlar shirin.' },
    { e: 'muz',        u: 'Banan',           t: 'noun',         l: 'beginner', ex: 'Her gün bir muz yerim.',         eu: 'Har kuni banan yeyman.' },
    { e: 'masa',       u: 'Stol',            t: 'noun',         l: 'beginner', ex: 'Kitap masanın üstünde.',         eu: 'Kitob stolda.' },
    { e: 'sandalye',   u: 'Stul',            t: 'noun',         l: 'beginner', ex: 'Sandalyeye oturun.',             eu: 'Stulga o\'tiring.' },
    { e: 'kalem',      u: 'Ruchka/Qalam',    t: 'noun',         l: 'beginner', ex: 'Kaleminizi ödünç alabilir miyim?', eu: 'Qalaminizni olsam bo\'ladimi?' },
    { e: 'çanta',      u: 'Sumka',           t: 'noun',         l: 'beginner', ex: 'Çantam ağır.',                   eu: 'Sumkam og\'ir.' },
    { e: 'telefon',    u: 'Telefon',         t: 'noun',         l: 'beginner', ex: 'Telefonum yeni.',                eu: 'Telefonim yangi.' },
    { e: 'pencere',    u: 'Deraza',          t: 'noun',         l: 'beginner', ex: 'Lütfen pencereyi açın.',         eu: 'Iltimos, derazani oching.' },
    { e: 'kapı',       u: 'Eshik',           t: 'noun',         l: 'beginner', ex: 'Kapıyı kapat.',                  eu: 'Eshikni yop.' },
    { e: 'yol',        u: 'Yo\'l',           t: 'noun',         l: 'beginner', ex: 'Yol uzun.',                      eu: 'Yo\'l uzun.' },
    { e: 'park',       u: 'Park',            t: 'noun',         l: 'beginner', ex: 'Çocuklar parkta oynuyor.',       eu: 'Bolalar parkda o\'ynaydi.' },
    { e: 'dükkan',     u: 'Do\'kon',         t: 'noun',         l: 'beginner', ex: 'Dükkana gidelim.',               eu: 'Do\'konga boramiz.' },
    { e: 'para',       u: 'Pul',             t: 'noun',         l: 'beginner', ex: 'Paranız var mı?',                eu: 'Pulingiz bormi?' },
    { e: 'arkadaş',    u: 'Do\'st',          t: 'noun',         l: 'beginner', ex: 'O benim en iyi arkadaşım.',     eu: 'U mening eng yaxshi do\'stim.' },
    { e: 'öğretmen',   u: 'O\'qituvchi',     t: 'noun',         l: 'beginner', ex: 'Öğretmenim çok iyi.',           eu: 'O\'qituvchim juda yaxshi.' },
    { e: 'öğrenci',    u: 'O\'quvchi',       t: 'noun',         l: 'beginner', ex: 'O iyi bir öğrenci.',             eu: 'U yaxshi o\'quvchi.' },

    // ─── ELEMENTARY ───
    { e: 'yatak odası',u: 'Yotoqxona',       t: 'noun',         l: 'elementary', ex: 'Yatak odam çok rahat.',         eu: 'Yotoqxonam qulay.' },
    { e: 'mutfak',     u: 'Oshxona',         t: 'noun',         l: 'elementary', ex: 'Mutfakta yemek pişiriyor.',     eu: 'Oshxonada ovqat pishiradi.' },
    { e: 'banyo',      u: 'Hammom',          t: 'noun',         l: 'elementary', ex: 'Banyo temiz.',                  eu: 'Hammom toza.' },
    { e: 'bahçe',      u: 'Bog\'',           t: 'noun',         l: 'elementary', ex: 'Bahçede sebze yetiştiriyoruz.', eu: 'Bog\'da sabzavot etishtIramiz.' },
    { e: 'doktor',     u: 'Shifokor',        t: 'noun',         l: 'elementary', ex: 'Doktor hastayı muayene etti.',  eu: 'Shifokor bemorni tekshirdi.' },
    { e: 'mühendis',   u: 'Muhandis',        t: 'noun',         l: 'elementary', ex: 'O bir yazılım mühendisi.',     eu: 'U dasturiy ta\'minot muhandisi.' },
    { e: 'pahalı',     u: 'Qimmat',          t: 'adjective',    l: 'elementary', ex: 'Bu telefon çok pahalı.',       eu: 'Bu telefon juda qimmat.' },
    { e: 'ucuz',       u: 'Arzon',           t: 'adjective',    l: 'elementary', ex: 'Bu ayakkabılar ucuz.',         eu: 'Bu poyabzallar arzon.' },
    { e: 'güzel',      u: 'Go\'zal',         t: 'adjective',    l: 'elementary', ex: 'Ne güzel bir gün!',            eu: 'Qanday go\'zal kun!' },
    { e: 'ilginç',     u: 'Qiziqarli',       t: 'adjective',    l: 'elementary', ex: 'Bu ilginç bir hikaye.',        eu: 'Bu qiziqarli hikoya.' },
    { e: 'zor',        u: 'Qiyin',           t: 'adjective',    l: 'elementary', ex: 'Bu sınav çok zor.',            eu: 'Bu imtihon juda qiyin.' },
    { e: 'kolay',      u: 'Oson',            t: 'adjective',    l: 'elementary', ex: 'Bu egzersiz kolay.',           eu: 'Bu mashq oson.' },
    { e: 'seyahat',    u: 'Sayohat',         t: 'noun',         l: 'elementary', ex: 'Yurt dışına seyahat etmeyi seviyorum.', eu: 'Xorijga sayohat qilishni yaxshi ko\'raman.' },
    { e: 'müzik',      u: 'Musiqa',          t: 'noun',         l: 'elementary', ex: 'Her gün müzik dinliyorum.',    eu: 'Har kuni musiqa eshitaman.' },
    { e: 'hava durumu',u: 'Ob-havo',         t: 'noun',         l: 'elementary', ex: 'Hava durumu bugün güzel.',     eu: 'Bugun ob-havo yaxshi.' },
    { e: 'bilgisayar', u: 'Kompyuter',       t: 'noun',         l: 'elementary', ex: 'İş için bilgisayar kullanıyorum.', eu: 'Ish uchun kompyuter ishlataman.' },
    { e: 'hastane',    u: 'Kasalxona',       t: 'noun',         l: 'elementary', ex: 'Hastaneye götürüldü.',         eu: 'Kasalxonaga olib ketildi.' },
    { e: 'restoran',   u: 'Restoran',        t: 'noun',         l: 'elementary', ex: 'Bir restoranda yemek yiyoruz.', eu: 'Restoranda ovqatlanamiz.' },
    { e: 'havalimanı', u: 'Aeroport',        t: 'noun',         l: 'elementary', ex: 'Havalimanı çok kalabalık.',    eu: 'Aeroport juda gavjum.' },
    { e: 'toplantı',   u: 'Uchrashuv',       t: 'noun',         l: 'elementary', ex: 'Saat 10\'da toplantım var.',   eu: 'Soat 10 da uchrashuv bor.' },
    { e: 'alışveriş',  u: 'Xarid',           t: 'noun',         l: 'elementary', ex: 'Alışveriş yapmayı seviyor.',   eu: 'Xarid qilishni yaxshi ko\'radi.' },
    { e: 'bilet',      u: 'Chipta',          t: 'noun',         l: 'elementary', ex: 'Tren bileti satın aldım.',      eu: 'Poyezd chiptasi sotib oldim.' },
    { e: 'otel',       u: 'Mehmonxona',      t: 'noun',         l: 'elementary', ex: 'Güzel bir otelde kaldık.',     eu: 'Chiroyli mehmonxonada qoldik.' },
    { e: 'menü',       u: 'Menyu',           t: 'noun',         l: 'elementary', ex: 'Menüyü görebilir miyim?',      eu: 'Menyuni ko\'rsam bo\'ladimi?' },
    { e: 'fiyat',      u: 'Narx',            t: 'noun',         l: 'elementary', ex: 'Fiyatı çok yüksek.',           eu: 'Narxi juda baland.' },
    { e: 'indirim',    u: 'Chegirma',        t: 'noun',         l: 'elementary', ex: 'Bugün yüzde 20 indirim var.',  eu: 'Bugun 20% chegirma bor.' },
    { e: 'egzersiz',   u: 'Mashq',           t: 'noun',         l: 'elementary', ex: 'Egzersiz sağlık için iyidir.', eu: 'Mashq sog\'liq uchun foydali.' },
    { e: 'kütüphane',  u: 'Kutubxona',       t: 'noun',         l: 'elementary', ex: 'Sık sık kütüphaneye gidiyorum.', eu: 'Tez-tez kutubxonaga boraman.' },
    { e: 'ders',       u: 'Dars',            t: 'noun',         l: 'elementary', ex: 'Ders saat 9\'da başlıyor.',    eu: 'Dars soat 9 da boshlanadi.' },
    { e: 'ödev',       u: 'Uy vazifasi',     t: 'noun',         l: 'elementary', ex: 'Her akşam ödevimi yapıyorum.', eu: 'Har kechqurun uy vazifamni bajaraman.' },
    { e: 'sınıf',      u: 'Sinf',            t: 'noun',         l: 'elementary', ex: 'Sınıfımızda 25 öğrenci var.', eu: 'Sinfimizda 25 o\'quvchi bor.' },
    { e: 'sınav',      u: 'Imtihon',         t: 'noun',         l: 'elementary', ex: 'Yarın sınavım var.',           eu: 'Ertaga imtihon bor.' },
    { e: 'not',        u: 'Baho',            t: 'noun',         l: 'elementary', ex: 'İyi bir not aldı.',            eu: 'Yaxshi baho oldi.' },
    { e: 'dağ',        u: 'Tog\'',           t: 'noun',         l: 'elementary', ex: 'Dağ çok yüksek.',             eu: 'Tog\' juda baland.' },
    { e: 'nehir',      u: 'Daryo',           t: 'noun',         l: 'elementary', ex: 'Nehir güzel.',                 eu: 'Daryo go\'zal.' },
    { e: 'deniz',      u: 'Dengiz',          t: 'noun',         l: 'elementary', ex: 'Denizi seviyorum.',            eu: 'Dengizni yaxshi ko\'raman.' },
    { e: 'orman',      u: 'O\'rmon',         t: 'noun',         l: 'elementary', ex: 'Orman karanlık ve sessiz.',    eu: 'O\'rmon qorong\'i va sokin.' },
    { e: 'hayvan',     u: 'Hayvon',          t: 'noun',         l: 'elementary', ex: 'En sevdiğim hayvan aslan.',    eu: 'Sevimli hayvon — sher.' },
    { e: 'spor',       u: 'Sport',           t: 'noun',         l: 'elementary', ex: 'Spor sizi sağlıklı tutar.',   eu: 'Sport sizni sog\'lom saqlaydi.' },
    { e: 'takım',      u: 'Jamoa',           t: 'noun',         l: 'elementary', ex: 'Takımımız maçı kazandı.',     eu: 'Jamoamiz o\'yinda g\'olib keldi.' },
    { e: 'hikaye',     u: 'Hikoya',          t: 'noun',         l: 'elementary', ex: 'Bana bir hikaye anlat.',       eu: 'Menga hikoya aytib ber.' },
    { e: 'rüya',       u: 'Orzu/Tush',       t: 'noun',         l: 'elementary', ex: 'Hayallerinin peşinden git.',   eu: 'Orzuingiz ortidan yuring.' },
    { e: 'gülmek',     u: 'Kulmoq',          t: 'verb',         l: 'elementary', ex: 'Her zaman beni güldürüyor.',  eu: 'U har doim meni kuldiradi.' },
    { e: 'ağlamak',    u: 'Yig\'lamoq',      t: 'verb',         l: 'elementary', ex: 'Ağlama, her şey yolunda.',    eu: 'Yig\'lama, hammasi yaxshi bo\'ladi.' },
    { e: 'ziyaret',    u: 'Tashrif',         t: 'noun',         l: 'elementary', ex: 'Büyükbabamı sık sık ziyaret ediyoruz.', eu: 'Tez-tez bobomiznikiga boramiz.' },
    { e: 'açıklamak',  u: 'Tushuntirmoq',    t: 'verb',         l: 'elementary', ex: 'Lütfen bunu bana açıklayın.', eu: 'Iltimos, buni menga tushuntiring.' },
    { e: 'katılmak',   u: 'Qo\'shilmoq',     t: 'verb',         l: 'elementary', ex: 'Fikrinize katılıyorum.',       eu: 'Fikringiz bilan roziman.' },
    { e: 'seçmek',     u: 'Tanlash',         t: 'verb',         l: 'elementary', ex: 'Lütfen bir cevap seçin.',      eu: 'Iltimos, bitta javob tanlang.' },
    { e: 'hatırlamak', u: 'Eslamoq',         t: 'verb',         l: 'elementary', ex: 'Adınızı hatırlıyorum.',       eu: 'Ismingizni eslayman.' },
    { e: 'unutmak',    u: 'Unutmoq',         t: 'verb',         l: 'elementary', ex: 'Anahtarlarını unutma!',        eu: 'Kalitlarini unutma!' },
    { e: 'geliştirmek',u: 'Yaxshilamoq',     t: 'verb',         l: 'elementary', ex: 'Türkçemi geliştirmek istiyorum.', eu: 'Turkchamni yaxshilashni xohlayman.' },
    { e: 'hazırlamak', u: 'Tayyorlamoq',     t: 'verb',         l: 'elementary', ex: 'Sınava hazırlanıyorum.',      eu: 'Imtihonga tayyorlanayapman.' },
    { e: 'eğlenmek',   u: 'Zavqlanmoq',      t: 'verb',         l: 'elementary', ex: 'Film izlemekten eğleniyorum.', eu: 'Film ko\'rishdan zavqlanaman.' },
    { e: 'bitirmek',   u: 'Tugatmoq',        t: 'verb',         l: 'elementary', ex: 'İşini bitirdin mi?',          eu: 'Ishingni tugatdingmi?' },
    { e: 'başlamak',   u: 'Boshlash',        t: 'verb',         l: 'elementary', ex: 'Derse başlayalım.',           eu: 'Darsni boshlaylik.' },
    { e: 'genellikle', u: 'Odatda',          t: 'adverb',       l: 'elementary', ex: 'Genellikle saat 7\'de uyanıyorum.', eu: 'Odatda soat 7 da uyg\'onaman.' },
    { e: 'bazen',      u: 'Ba\'zan',         t: 'adverb',       l: 'elementary', ex: 'Bazen film izliyor.',          eu: 'Ba\'zan film ko\'radi.' },
    { e: 'asla',       u: 'Hech qachon',     t: 'adverb',       l: 'elementary', ex: 'Asla fast food yemem.',       eu: 'Hech qachon tez ovqat yemayman.' },
    { e: 'her zaman',  u: 'Har doim',        t: 'adverb',       l: 'elementary', ex: 'Her zaman zamanında geliyor.', eu: 'U har doim o\'z vaqtida keladi.' },
    { e: 'sık sık',    u: 'Tez-tez',         t: 'adverb',       l: 'elementary', ex: 'Sık sık yürüyüşe çıkıyoruz.', eu: 'Biz tez-tez sayrga chiqamiz.' },
    { e: 'sonunda',    u: 'Nihoyat',         t: 'adverb',       l: 'elementary', ex: 'Sonunda geldik.',              eu: 'Nihoyat keldik.' },
    { e: 'aniden',     u: 'To\'satdan',      t: 'adverb',       l: 'elementary', ex: 'Aniden yağmur yağmaya başladı.', eu: 'To\'satdan yomg\'ir yog\'a boshladi.' },

    // ─── PRE-INTERMEDIATE ───
    { e: 'ancak',      u: 'Biroq, ammo',     t: 'conjunction',  l: 'pre-intermediate', ex: 'Hava soğuktu; ancak dışarı çıktık.', eu: 'Havo sovuq edi, biroq biz chiqdik.' },
    { e: 'her ne kadar',u:'Garchi',          t: 'conjunction',  l: 'pre-intermediate', ex: 'Her ne kadar yağmur yağsa da oynadık.', eu: 'Garchi yomg\'ir yog\'sa ham o\'yndik.' },
    { e: 'bu nedenle', u: 'Shuning uchun',   t: 'adverb',       l: 'pre-intermediate', ex: 'Bu nedenle gitmeye karar verdik.', eu: 'Shuning uchun borishga qaror qildik.' },
    { e: 'ayrıca',     u: 'Bundan tashqari', t: 'adverb',       l: 'pre-intermediate', ex: 'Ayrıca, o yetenekli.',           eu: 'Bundan tashqari, u iste\'dodli.' },
    { e: 'fırsat',     u: 'Imkoniyat',       t: 'noun',         l: 'pre-intermediate', ex: 'Bu harika bir fırsat.',         eu: 'Bu ajoyib imkoniyat.' },
    { e: 'araştırma',  u: 'Tadqiqot',        t: 'noun',         l: 'pre-intermediate', ex: 'Bilim insanları araştırma yapıyor.', eu: 'Olimlar tadqiqot o\'tkazadi.' },
    { e: 'son tarih',  u: 'Muddat',          t: 'noun',         l: 'pre-intermediate', ex: 'Son tarih yarın.',              eu: 'Muddati ertaga.' },
    { e: 'vazgeçmek',  u: 'Voz kechmoq',     t: 'verb',         l: 'pre-intermediate', ex: 'Hayallerinden vazgeçme.',      eu: 'Orzularingizdan voz kechmang.' },
    { e: 'başarı',     u: 'Muvaffaqiyat',    t: 'noun',         l: 'pre-intermediate', ex: 'Bu büyük bir başarı.',         eu: 'Bu katta muvaffaqiyat.' },
    { e: 'meydan okumak',u:'Muammo',         t: 'noun',         l: 'pre-intermediate', ex: 'Her meydan okuma sizi güçlendirir.', eu: 'Har bir muammo sizni kuchliroq qiladi.' },
    { e: 'güvenli',    u: 'Ishonchli',       t: 'adjective',    l: 'pre-intermediate', ex: 'Kendinize güvenin.',           eu: 'O\'zingizga ishoning.' },
    { e: 'başarılı',   u: 'Muvaffaqiyatli',  t: 'adjective',    l: 'pre-intermediate', ex: 'O başarılı bir iş kadını.',   eu: 'U muvaffaqiyatli ish ayoli.' },
    { e: 'sorumlu',    u: 'Mas\'ul',         t: 'adjective',    l: 'pre-intermediate', ex: 'Eylemlerinizden sorumlu olun.', eu: 'Harakatlaringiz uchun mas\'ul bo\'ling.' },
    { e: 'çevre',      u: 'Atrof-muhit',     t: 'noun',         l: 'pre-intermediate', ex: 'Çevreyi korumak zorundayız.',  eu: 'Atrof-muhitni himoya qilishimiz kerak.' },
    { e: 'teknoloji',  u: 'Texnologiya',     t: 'noun',         l: 'pre-intermediate', ex: 'Teknoloji hayatımızı değiştiriyor.', eu: 'Texnologiya hayotimizni o\'zgartiradi.' },
    { e: 'toplum',     u: 'Jamiyat',         t: 'noun',         l: 'pre-intermediate', ex: 'Toplum hızla değişiyor.',     eu: 'Jamiyat tez o\'zgarmoqda.' },
    { e: 'eğitim',     u: 'Ta\'lim',         t: 'noun',         l: 'pre-intermediate', ex: 'Eğitim başarının anahtarı.',  eu: 'Ta\'lim — muvaffaqiyat kaliti.' },
    { e: 'kariyer',    u: 'Karyera',         t: 'noun',         l: 'pre-intermediate', ex: 'İyi bir kariyer istiyorum.',  eu: 'Yaxshi karyera istayman.' },
    { e: 'maaş',       u: 'Maosh',           t: 'noun',         l: 'pre-intermediate', ex: 'Maaşı çok yüksek.',          eu: 'Maoshi juda baland.' },
    { e: 'iş arkadaşı',u: 'Hamkasb',         t: 'noun',         l: 'pre-intermediate', ex: 'İş arkadaşım yardımsever.',  eu: 'Hamkasabim yordamsevar.' },
    { e: 'mülakat',    u: 'Suhbat',          t: 'noun',         l: 'pre-intermediate', ex: 'Yarın iş mülakatım var.',     eu: 'Ertaga ish uchun suhbat bor.' },
    { e: 'deneyim',    u: 'Tajriba',         t: 'noun',         l: 'pre-intermediate', ex: 'İş deneyimi önemlidir.',     eu: 'Ish tajribasi muhim.' },
    { e: 'beceriler',  u: 'Ko\'nikmalar',    t: 'noun',         l: 'pre-intermediate', ex: 'İyi iletişim becerilerine ihtiyacınız var.', eu: 'Yaxshi muloqot ko\'nikmalariga ega bo\'lish kerak.' },
    { e: 'yönetmek',   u: 'Boshqarmoq',      t: 'verb',         l: 'pre-intermediate', ex: 'Büyük bir ekip yönetiyor.',  eu: 'Katta jamoani boshqaradi.' },
    { e: 'çözmek',     u: 'Yechmoq',         t: 'verb',         l: 'pre-intermediate', ex: 'Bu sorunu çözmemiz gerekiyor.', eu: 'Bu muammoni yechishimiz kerak.' },
    { e: 'başarmak',   u: 'Erishmoq',        t: 'verb',         l: 'pre-intermediate', ex: 'Hedeflerine ulaşabilirsiniz.', eu: 'Maqsadlaringizga erisha olasiz.' },
    { e: 'geliştirmek',u: 'Rivojlantirmoq',  t: 'verb',         l: 'pre-intermediate', ex: 'Yeni fikirler geliştirmemiz gerekiyor.', eu: 'Yangi g\'oyalarni rivojlantirishimiz kerak.' },
    { e: 'artırmak',   u: 'Oshirmoq',        t: 'verb',         l: 'pre-intermediate', ex: 'Fiyatlar artıyor.',          eu: 'Narxlar oshmoqda.' },
    { e: 'azaltmak',   u: 'Kamaytirmoq',     t: 'verb',         l: 'pre-intermediate', ex: 'Kirliliği azaltmak zorundayız.', eu: 'Ifloslanishni kamaytirishimiz kerak.' },
    { e: 'önermek',    u: 'Taklif qilmoq',   t: 'verb',         l: 'pre-intermediate', ex: 'Şimdi gitmemizi öneriyorum.', eu: 'Endi ketishimizni taklif qilaman.' },
    { e: 'karşılaştırmak',u:'Solishtirmoq',  t: 'verb',         l: 'pre-intermediate', ex: 'Bu iki ürünü karşılaştırın.', eu: 'Bu ikki mahsulotni solishtiring.' },
    { e: 'rapor',      u: 'Hisobot',         t: 'noun',         l: 'pre-intermediate', ex: 'Bunun hakkında bir rapor yazın.', eu: 'Bu haqida hisobot yozing.' },
    { e: 'proje',      u: 'Loyiha',          t: 'noun',         l: 'pre-intermediate', ex: 'Projemiz Cuma günü teslim.', eu: 'Loyihamiz juma kuni topshirilishi kerak.' },
    { e: 'müşteri',    u: 'Mijoz',           t: 'noun',         l: 'pre-intermediate', ex: 'Müşteri memnun.',            eu: 'Mijoz mamnun.' },
    { e: 'sözleşme',   u: 'Shartnoma',       t: 'noun',         l: 'pre-intermediate', ex: 'Sözleşmeyi imzalayın.',      eu: 'Shartnomani imzolang.' },

    // ─── ADVANCED ───
    { e: 'nüans',      u: 'Noziklik',        t: 'noun',         l: 'advanced', ex: 'Sözlerinin nüansı önemliydi.',      eu: 'So\'zlarining nozikligi muhim edi.' },
    { e: 'egemenlik',  u: 'Suverenitet',     t: 'noun',         l: 'advanced', ex: 'Ulusal egemenlik hayatidir.',       eu: 'Milliy suverenitet muhimdir.' },
    { e: 'belagat',    u: 'Notiqlik',        t: 'noun',         l: 'advanced', ex: 'Belagati herkesi etkiledi.',        eu: 'Notiqligi hammani hayratda qoldirdi.' },
    { e: 'paradigma',  u: 'Paradigma',       t: 'noun',         l: 'advanced', ex: 'Yeni bir paradigma ortaya çıkıyor.', eu: 'Yangi paradigma paydo bo\'lmoqda.' },
    { e: 'korelasyon', u: 'Korrelyatsiya',   t: 'noun',         l: 'advanced', ex: 'Korelasyon nedensellik ima etmez.', eu: 'Korrelyatsiya sababiyatni anglatmaydi.' },
    { e: 'mevzuat',    u: 'Qonunchilik',     t: 'noun',         l: 'advanced', ex: 'Yeni mevzuat kabul edildi.',        eu: 'Yangi qonun qabul qilindi.' },
    { e: 'hafifletmek',u: 'Yumshatmoq',      t: 'verb',         l: 'advanced', ex: 'Riskleri hafifletmeliyiz.',         eu: 'Xavflarni yumshatishimiz kerak.' },
    { e: 'emsalsiz',   u: 'Misli ko\'rilmagan', t: 'adjective', l: 'advanced', ex: 'Bu emsalsiz bir durum.',           eu: 'Bu misli ko\'rilmagan holat.' },
    { e: 'titiz',      u: 'Puxta',           t: 'adjective',    l: 'advanced', ex: 'İşinde çok titiz.',                eu: 'Ishida puxta.' },
    { e: 'belirsiz',   u: 'Noaniq',          t: 'adjective',    l: 'advanced', ex: 'İfadesi belirsizdi.',              eu: 'Bayonoti noaniq edi.' },
    { e: 'tutarlı',    u: 'Izchil',          t: 'adjective',    l: 'advanced', ex: 'Tutarlı bir argüman yazın.',       eu: 'Izchil argument yozing.' },
    { e: 'önemli',     u: 'Muhim, sezilarli',t: 'adjective',    l: 'advanced', ex: 'Önemli kanıtlar var.',             eu: 'Jiddiy dalillar mavjud.' },
    { e: 'katalizör',  u: 'Katalizator',     t: 'noun',         l: 'advanced', ex: 'İcad, değişim için bir katalizör oldu.', eu: 'Ixtiro o\'zgarish uchun katalizator bo\'ldi.' },
    { e: 'demografik', u: 'Demografik',      t: 'adjective',    l: 'advanced', ex: 'Demografik değişimler önemlidir.', eu: 'Demografik o\'zgarishlar muhim.' },
    { e: 'altyapı',    u: 'Infratuzilma',    t: 'noun',         l: 'advanced', ex: 'Altyapıya yatırım yapmalıyız.',   eu: 'Infratuzilmaga investitsiya kerak.' },
    { e: 'hipotez',    u: 'Faraz',           t: 'noun',         l: 'advanced', ex: 'Hipotezinizi test edin.',          eu: 'Farazingizni sinab ko\'ring.' },
    { e: 'metodoloji', u: 'Metodologiya',    t: 'noun',         l: 'advanced', ex: 'Metodolojinizi açıklayın.',        eu: 'Metodologiyangizni tushuntiring.' },
    { e: 'olgu',       u: 'Hodisa',          t: 'noun',         l: 'advanced', ex: 'Bu küresel bir olgu.',             eu: 'Bu global hodisa.' },
    { e: 'ima',        u: 'Oqibatlar',       t: 'noun',         l: 'advanced', ex: 'İmaları göz önünde bulundurun.',  eu: 'Oqibatlarni ko\'rib chiqing.' },
    { e: 'bakış açısı',u: 'Nuqtai nazar',    t: 'noun',         l: 'advanced', ex: 'Farklı bir bakış açısı düşünün.', eu: 'Boshqa nuqtai nazarni ko\'rib chiqing.' },
    { e: 'çerçeve',    u: 'Tizim/Struktura', t: 'noun',         l: 'advanced', ex: 'Net bir çerçeveye ihtiyacımız var.', eu: 'Aniq tizim kerak.' },
    { e: 'söylem',     u: 'Ritorika',        t: 'noun',         l: 'advanced', ex: 'Söylemi güçlüydü.',               eu: 'Ritorikasi kuchli edi.' },
    { e: 'savunuculuk',u: 'Himoya qilish',   t: 'verb',         l: 'advanced', ex: 'İnsan haklarını savunuyor.',       eu: 'Inson huquqlarini himoya qiladi.' },
    { e: 'oluşturmak', u: 'Tashkil etmoq',   t: 'verb',         l: 'advanced', ex: 'Bu bir ihlal oluşturuyor.',       eu: 'Bu qoidabuzarlik tashkil etadi.' },
    { e: 'kolaylaştırmak',u:'Osonlashtirmoq',t: 'verb',         l: 'advanced', ex: 'Teknoloji öğrenmeyi kolaylaştırıyor.', eu: 'Texnologiya o\'rganishni osonlashtiradi.' },
    { e: 'geliştirmek',u: 'Rivojlantirmoq',  t: 'verb',         l: 'advanced', ex: 'Veri üzerinde çalışmalıyız.',     eu: 'Ma\'lumotlarda ishlamoq kerak.' },
    { e: 'kabul etmek',u: 'Tan olmoq',       t: 'verb',         l: 'advanced', ex: 'Hatamı kabul ediyorum.',          eu: 'Xatoimni tan olaman.' },
    { e: 'sürdürmek',  u: 'Davom ettirmoq',  t: 'verb',         l: 'advanced', ex: 'Çabalarımızı sürdürmeliyiz.',     eu: 'Kuchlarimizni davom ettirishimiz kerak.' },
];

// ══════════════════════════════════════════════════════════════
// GRAMMAR QUESTIONS (Turkish grammar)
// ══════════════════════════════════════════════════════════════
const GRAMMAR_QS = [
    { q: "Ben her gün okul___ gidiyorum.", opts: ["a", "da", "de", "dan"], ans: "a", exp: "Yönelme hâli: okul + a = okula (maktabga)" },
    { q: "O bir öğretmen___.", opts: ["dir", "da", "den", "dır"], ans: "dir", exp: "Ek-fiil: O bir öğretmendir (U o\'qituvchi)" },
    { q: "Biz şehir___ geliyoruz.", opts: ["e", "de", "den", "a"], ans: "den", exp: "Çıkma hâli: şehir + den (shahardan)" },
    { q: "Sen Türkçe ___ konuşuyorsun.", opts: ["iyi", "iyice", "iyiyi", "iyin"], ans: "iyi", exp: "Sıfat fiil olarak: iyi konuşmak" },
    { q: "Onlar İstanbul'___ yaşıyor.", opts: ["a", "da", "den", "e"], ans: "da", exp: "Bulunma hâli: İstanbul'da (Istanbulda)" },
    { q: "Ben kitap oku___.", opts: ["yorum", "rım", "dum", "acağım"], ans: "yorum", exp: "Şimdiki zaman (geniş): oku + yorum" },
    { q: "O dün okul___ gitmedi.", opts: ["a", "da", "den", "e"], ans: "a", exp: "Yönelme hâli: okul + a" },
    { q: "Çocuklar park___ oynuyor.", opts: ["a", "ta", "tan", "e"], ans: "ta", exp: "Bulunma hâli: park + ta (parkda)" },
    { q: "Ben yarın İstanbul'___ gideceğim.", opts: ["a", "da", "den", "ta"], ans: "a", exp: "Yönelme hâli: İstanbul + a" },
    { q: "Bu kitap çok ___.", opts: ["ilginçtir", "ilginçdir", "ilginçtır", "ilginçdır"], ans: "ilginçtir", exp: "Ek-fiil ekleme: ilginç + tir" },
    { q: "___ adın ne?", opts: ["Senin", "Seni", "Sende", "Senden"], ans: "Senin", exp: "İyelik: Senin adın (Sening isming)" },
    { q: "Benim bir kardeş___ var.", opts: ["im", "ım", "üm", "um"], ans: "im", exp: "İyelik eki: kardeş + im (singlim)" },
    { q: "O kitabı oku___ istiyor.", opts: ["mayı", "mak", "maktan", "maya"], ans: "mak", exp: "Mastar: oku + mak (o\'qimoq)" },
    { q: "Ben eve gel___ zaman uyudum.", opts: ["diğimde", "diğimde", "dikimde", "duğumda"], ans: "diğimde", exp: "Zaman zarf-fiil eki: gel + diğimde" },
    { q: "Senin Türkçen benim___ daha iyi.", opts: ["den", "dan", "de", "da"], ans: "den", exp: "Karşılaştırma: benden daha iyi" },
];

// ══════════════════════════════════════════════════════════════
// UNITS DATA
// ══════════════════════════════════════════════════════════════
const UD_DATA = {
    beginner: [
        {
            id: 'tb0', emoji: '🔤', title: 'Türk Alfabesi', desc: "Türk alifbosini o'rganish", level: 'beginner',
            words: ['merhaba', 'güle güle', 'teşekkür', 'lütfen', 'özür', 'evet', 'hayır', 'iyi', 'kötü', 'büyük'],
            xp: 40, coin: 15,
            grammar_rule: "Türk alifbesida 29 harf bor. Maxsus harflar: Ç, Ğ, İ, Ö, Ş, Ü",
            grammar_example: "A a, B b, C c, Ç ç, D d, E e, F f, G g, Ğ ğ, H h, I ı, İ i, J j, K k, L l, M m, N n, O o, Ö ö, P p, R r, S s, Ş ş, T t, U u, Ü ü, V v, Y y, Z z",
            reading_text: "Türk alfabesi 29 harften oluşur. Beş sesli harf vardır: a, e, ı, i, o, ö, u, ü. Türkçe, sondan eklemeli bir dildir. Her kelime, ekler eklenerek türetilir.",
            reading_qs: [
                { q: "Türk alfabesinde kaç harf var?", opts: ["26", "28", "29", "30"], c: 2 },
                { q: "Türkçe nasıl bir dildir?", opts: ["Öne eklemeli", "Sondan eklemeli", "Hiç ek yok", "İzole dil"], c: 1 },
                { q: "Hangi özel harf Türkçeye özgüdür?", opts: ["B", "C", "Ğ", "D"], c: 2 }
            ]
        },
        {
            id: 'tb1', emoji: '👋', title: 'Salomlashish', desc: "Salomlashish va xayrlashish", level: 'beginner',
            words: ['merhaba', 'güle güle', 'teşekkür', 'lütfen', 'özür', 'evet', 'hayır', 'iyi', 'kötü', 'mutlu'],
            xp: 50, coin: 20,
            grammar_rule: "To be (to olmak): Ben + -im, Sen + -sin, O + -dır/dir",
            grammar_example: "Ben mutluyum. Sen öğrencisin. O öğretmendir.",
            reading_text: "Benim adım Sara. Ben İngiltere'denim. Her sabah komşularıma 'merhaba' derim. Ayrılırken 'güle güle' derim. Her zaman 'lütfen' ve 'teşekkür ederim' derim.",
            reading_qs: [
                { q: "Sara nerelidir?", opts: ["Türkiye", "İngiltere", "Fransa", "Almanya"], c: 1 },
                { q: "Ayrılırken ne der?", opts: ["Merhaba", "Teşekkür", "Güle güle", "Lütfen"], c: 2 },
                { q: "Sara için ne önemlidir?", opts: ["Para", "Nezaket", "Şöhret", "Güç"], c: 1 }
            ]
        },
        {
            id: 'tb2', emoji: '🔢', title: 'Sayılar', desc: "Raqamlar va hisoblash", level: 'beginner',
            words: ['bir', 'iki', 'üç', 'dört', 'beş', 'elma', 'kitap', 'kedi', 'köpek', 'anne'],
            xp: 50, coin: 20,
            grammar_rule: "Sayılar: bir, iki, üç, dört, beş, altı, yedi, sekiz, dokuz, on",
            grammar_example: "Üç kedim var. O birinci öğrencidir. Beş tane elma aldım.",
            reading_text: "Ali'nin üç kedisi ve iki köpeği var. Her gün onları dört kez besliyor. Her hayvanla yaklaşık on dakika geçiriyor. Kedileri için on iki oyuncak satın aldı.",
            reading_qs: [
                { q: "Kaç kedisi var?", opts: ["İki", "Üç", "Dört", "Beş"], c: 1 },
                { q: "Günde kaç kez besliyor?", opts: ["İki", "Üç", "Dört", "Beş"], c: 2 },
                { q: "Kaç oyuncak aldı?", opts: ["On", "On iki", "On beş", "Yirmi"], c: 1 }
            ]
        },
        {
            id: 'tb3', emoji: '🎨', title: 'Renkler', desc: "Turk tilida ranglar", level: 'beginner',
            words: ['kırmızı', 'mavi', 'yeşil', 'sarı', 'siyah', 'beyaz', 'mutlu', 'üzgün', 'sıcak', 'soğuk'],
            xp: 60, coin: 25,
            grammar_rule: "Sıfatlar isimden önce gelir: kırmızı elma, mavi gökyüzü",
            grammar_example: "Kırmızı bir çantam var. Mavi kuşlar görüyorum. Yeşil çimen yumuşak.",
            reading_text: "Gökkuşağının yedi rengi vardır: kırmızı, turuncu, sarı, yeşil, mavi, indigo ve mor. Kırmızı, ateşin rengidir. Mavi, gökyüzünün rengidir. Yeşil, ağaçların rengidir.",
            reading_qs: [
                { q: "Kaç renk var?", opts: ["Beş", "Altı", "Yedi", "Sekiz"], c: 2 },
                { q: "Gökyüzünün rengi?", opts: ["Kırmızı", "Sarı", "Yeşil", "Mavi"], c: 3 },
                { q: "Ateşin rengi?", opts: ["Mavi", "Kırmızı", "Yeşil", "Sarı"], c: 1 }
            ]
        },
        {
            id: 'tb4', emoji: '👨‍👩‍👧', title: 'Aile', desc: "Oila a'zolari", level: 'beginner',
            words: ['anne', 'baba', 'kız kardeş', 'erkek kardeş', 'su', 'yemek', 'ev', 'araba', 'köpek', 'kedi'],
            xp: 60, coin: 25,
            grammar_rule: "İyelik ekleri: benim, senin, onun + isim + ek",
            grammar_example: "Benim annem kibar. Onun babası çok çalışıyor. Onların ailesi büyük.",
            reading_text: "Benim ailem beş kişilik. Babam doktor, annem öğretmen. Bir erkek kardeşim ve bir kız kardeşim var. Büyükbabam ve büyükannem yakında oturuyor. Her pazar onları ziyaret ediyoruz.",
            reading_qs: [
                { q: "Kaç kişilik aile?", opts: ["Üç", "Dört", "Beş", "Altı"], c: 2 },
                { q: "Babasının mesleği?", opts: ["Öğretmen", "Doktor", "Mühendis", "Şoför"], c: 1 },
                { q: "Ne zaman ziyaret ediyor?", opts: ["Cumartesi", "Pazar", "Pazartesi", "Cuma"], c: 1 }
            ]
        },
        {
            id: 'tb5', emoji: '🍎', title: 'Yemek ve İçecekler', desc: "Ovqat va ichimliklar", level: 'beginner',
            words: ['elma', 'ekmek', 'su', 'yemek yemek', 'içmek', 'uyumak', 'okumak', 'yazmak', 'yürümek', 'konuşmak'],
            xp: 70, coin: 30,
            grammar_rule: "Sayılabilir/sayılamaz: bir elma, biraz su",
            grammar_example: "Bir elma ve biraz su istiyorum. O her sabah süt içiyor.",
            reading_text: "Sağlıklı bir kahvaltı önemlidir. Birçok insan sabah yumurta ve ekmek yer. Çay ve kahve popüler içeceklerdir. Süt çocuklar için iyidir. Her gün yeterince su için.",
            reading_qs: [
                { q: "Sabah ne yiyorlar?", opts: ["Akşam yemeği", "Öğle yemeği", "Kahvaltı", "Atıştırmalık"], c: 2 },
                { q: "Çocuklar için ne iyidir?", opts: ["Kahve", "Çay", "Süt", "Meyve suyu"], c: 2 },
                { q: "Hangi yiyecek bahsedilmektedir?", opts: ["Pirinç", "Çorba", "Yumurta ve ekmek", "Pizza"], c: 2 }
            ]
        },
    ],

    elementary: [
        {
            id: 'te1', emoji: '🏡', title: 'Ev ve Odalar', desc: "Uy va xonalar", level: 'elementary',
            words: ['yatak odası', 'mutfak', 'banyo', 'bahçe', 'doktor', 'mühendis', 'pahalı', 'ucuz', 'güzel', 'ilginç'],
            xp: 80, coin: 35,
            grammar_rule: "Var/Yok: Bir kanepe var. Üç yatak odası var.",
            grammar_example: "Büyük bir mutfak var. İki banyo var.",
            reading_text: "Evim üç katlı. Zemin katta geniş bir oturma odası ve modern bir mutfak var. Birinci katta üç yatak odası ve iki banyo var. Yatak odam bahçeye bakan büyük bir pencereye sahip.",
            reading_qs: [
                { q: "Ev kaç katlı?", opts: ["İki", "Üç", "Dört", "Beş"], c: 1 },
                { q: "Yatak odaları nerede?", opts: ["Zemin kat", "Birinci kat", "Bahçe", "Bodrum"], c: 1 },
                { q: "Yatak odası ne gösteriyor?", opts: ["TV", "Büyük pencere", "Havuz", "Şömine"], c: 1 }
            ]
        },
        {
            id: 'te2', emoji: '💼', title: 'Meslekler', desc: "Kasblar", level: 'elementary',
            words: ['doktor', 'öğretmen', 'mühendis', 'müzik', 'arkadaş', 'hava durumu', 'bilgisayar', 'seyahat', 'güzel', 'ilginç'],
            xp: 80, coin: 35,
            grammar_rule: "Ne iş yapıyorsunuz? Ben bir/bir + meslek + im/ım/üm/um.",
            grammar_example: "Ne iş yapıyorsunuz? Ben bir hemşireyim. Mühendis olarak çalışıyor.",
            reading_text: "Pek çok farklı meslek vardır. Doktorlar ve hemşireler hastanelerde çalışır. Öğretmenler yeni nesli eğitir. Mühendisler köprüler inşa eder. Her meslek toplum için önemlidir.",
            reading_qs: [
                { q: "Doktorlar nerede çalışır?", opts: ["Okullarda", "Fabrikalarda", "Hastanelerde", "Ofislerde"], c: 2 },
                { q: "Mühendisler ne yapar?", opts: ["Kitap", "Şarkı", "Köprü", "Yemek"], c: 2 },
                { q: "Öğretmenler ne yapar?", opts: ["Uçak sürer", "Köprü yapar", "İnsanları eğitir", "Yemek pişirir"], c: 2 }
            ]
        },
        {
            id: 'te3', emoji: '🛒', title: 'Alışveriş', desc: "Xarid qilish", level: 'elementary',
            words: ['pahalı', 'ucuz', 'güzel', 'zor', 'kolay', 'seyahat', 'müzik', 'arkadaş', 'hava durumu', 'bilgisayar'],
            xp: 90, coin: 40,
            grammar_rule: "Fiyat sormak: Bu ne kadar? ... liraya satılıyor. Kartla ödeyebilir miyim?",
            grammar_example: "Bu gömlek ne kadar? 250 liraya satılıyor. Kartla ödeyebilir miyim? Evet, tabii.",
            reading_text: "Alışveriş günlük bir aktivitedir. Süpermarketler yiyecek ve ev eşyası satar. Mağazalar kıyafet ve elektronik ürün satar. Satın almadan önce her zaman fiyatı kontrol edin. Tasarruf etmek için indirim ve satışları arayın.",
            reading_qs: [
                { q: "Kıyafet nerede alınır?", opts: ["Süpermarket", "Mağaza", "Eczane", "Fırın"], c: 1 },
                { q: "Tasarruf için ne yapmak gerekir?", opts: ["Hızlı almak", "Nakit ödemek", "İndirim aramak", "Sık gitmek"], c: 2 },
                { q: "Satın almadan önce ne kontrol edilmeli?", opts: ["Renk", "Boyut", "Fiyat", "Marka"], c: 2 }
            ]
        },
    ],

    'pre-intermediate': [
        {
            id: 'tp1', emoji: '🔮', title: 'Gelecek Planları', desc: "Kelajak zamonlari", level: 'pre-intermediate',
            words: ['ancak', 'her ne kadar', 'bu nedenle', 'ayrıca', 'fırsat', 'araştırma', 'son tarih', 'başarı', 'güvenli', 'başarılı'],
            xp: 130, coin: 60,
            grammar_rule: "Gelecek zaman: -acak/-ecek eki. Niyet: istiyorum + mastar.",
            grammar_example: "Yarın sizi arayacağım. O tıp okumak istiyor.",
            reading_text: "Gelecek için plan yapmak çok önemlidir. Net hedefler koymak başarı elde etmenize yardımcı olur. Kısa vadeli hedefler birkaç hafta sürer. Uzun vadeli hedefler yıllar alır. Esneklik, kararlılık kadar önemlidir.",
            reading_qs: [
                { q: "Kısa vadeli hedefler ne kadar sürer?", opts: ["Yıllar", "On yıllar", "Birkaç hafta", "Bir ömür"], c: 2 },
                { q: "Kararlılık kadar önemli olan nedir?", opts: ["Para", "Esneklik", "Eğitim", "Güç"], c: 1 },
                { q: "Plan yapmanın amacı nedir?", opts: ["Arkadaş", "Şöhret", "Başarı", "Seyahat"], c: 2 }
            ]
        },
        {
            id: 'tp2', emoji: '🎯', title: 'Geçmiş Zaman', desc: "O\'tgan zamon (-di/-dı)", level: 'pre-intermediate',
            words: ['ancak', 'her ne kadar', 'bu nedenle', 'ayrıca', 'fırsat', 'araştırma', 'başarı', 'güvenli', 'başarılı', 'sorumlu'],
            xp: 140, coin: 65,
            grammar_rule: "-di/-dı/-du/-dü/-ti/-tı/-tu/-tü eki geçmiş zamanı ifade eder.",
            grammar_example: "Dün okula gittim. O kitabı okudu. Biz kahve içtik.",
            reading_text: "Türkçede geçmiş zaman iki şekilde ifade edilir: Görülen geçmiş zaman (-di) ve öğrenilen geçmiş zaman (-miş). 'Dün gittim' (gözlemledim) ile 'Gitmiş' (duyduğuma göre) arasındaki fark önemlidir.",
            reading_qs: [
                { q: "Türkçede kaç tür geçmiş zaman var?", opts: ["Bir", "İki", "Üç", "Dört"], c: 1 },
                { q: "'-di' eki neyi ifade eder?", opts: ["Duyulan geçmiş", "Görülen geçmiş", "Gelecek", "Şimdiki"], c: 1 },
                { q: "'-miş' eki ne zaman kullanılır?", opts: ["Gözlemlediğimizde", "Duyduğumuzda", "Planlarken", "İstekte"], c: 1 }
            ]
        },
    ],

    advanced: [
        {
            id: 'ta1', emoji: '🖊️', title: 'Akademik Yazı', desc: "Akademik yozuv", level: 'advanced',
            words: ['ayrıca', 'ancak', 'bu nedenle', 'nüans', 'belagat', 'hafifletmek', 'emsalsiz', 'titiz', 'fırsat', 'her ne kadar'],
            xp: 200, coin: 90,
            grammar_rule: "Bağlayıcı ifadeler: ayrıca (ek), ancak (karşıtlık), bu nedenle (sebep).",
            grammar_example: "Veriler hipotezi destekliyor. Ayrıca, önceki araştırmalar bu bulguları doğruluyor.",
            reading_text: "Akademik yazı kesinlik ve mantıksal tutarlılık gerektirir. Her argüman kanıtla desteklenmelidir. Bağlayıcı ifadeler fikirleri birbirine bağlar: 'ayrıca' bilgi ekler, 'ancak' karşıtlık getirir. Paragraf yapısı GKABağ'ı izler: Görüş, Kanıt, Açıklama, Bağlantı.",
            reading_qs: [
                { q: "'Ayrıca' ne anlama gelir?", opts: ["Karşıtlık", "Sonuç", "Ek bilgi", "Koşul"], c: 2 },
                { q: "Her argüman ne içermeli?", opts: ["Hikaye", "Kanıt", "Görüş", "Mizah"], c: 1 },
                { q: "Akademik yazıda ne gerekir?", opts: ["Yaratıcılık", "Duygusallık", "Kesinlik", "Hız"], c: 2 }
            ]
        },
        {
            id: 'ta2', emoji: '📋', title: 'İleri Türkçe', desc: "Ilg\'or Turkcha", level: 'advanced',
            words: ['ayrıca', 'ancak', 'bu nedenle', 'nüans', 'belagat', 'hafifletmek', 'emsalsiz', 'titiz', 'fırsat', 'her ne kadar'],
            xp: 250, coin: 110,
            grammar_rule: "Koşul cümleleri: Eğer ... -rsa/-rse, ... -r/-ar/-er. Şart: Eğer gidersen, görürsün.",
            grammar_example: "Eğer çok çalışırsanız, başarılı olursunuz. Eğer Türkçe öğrenirsem, Türkiye'ye gideceğim.",
            reading_text: "Türkçede koşul cümleleri dört türdedir. Gerçek koşul, olası durumlar için kullanılır. Varsayımsal koşul, gerçek olmayan durumlar için kullanılır. Her tür, farklı fiil zamanları gerektirir.",
            reading_qs: [
                { q: "Türkçede kaç tür koşul var?", opts: ["İki", "Üç", "Dört", "Beş"], c: 2 },
                { q: "Gerçek koşul ne için kullanılır?", opts: ["İmkansız durumlar", "Olası durumlar", "Geçmiş olaylar", "Dilekler"], c: 1 },
                { q: "Koşul cümlelerinde ne gerekir?", opts: ["Sadece isim", "Farklı fiil zamanları", "Sıfatlar", "Zarflar"], c: 1 }
            ]
        },
    ]
};

// ══════════════════════════════════════════════════════════════
// UTILS
// ══════════════════════════════════════════════════════════════
function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

window.speakWord = function (word, e) {
    if (e) e.stopPropagation();
    const u = new SpeechSynthesisUtterance(word);
    u.lang = 'tr-TR'; u.rate = 0.85;
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
};
window.spk = window.speakWord;

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
// TOKEN HELPERS
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
        showToast('⚡ Tokenlar yangilandi!', 'success');
    }
}

async function spendTokens(amount, reason) {
    if (UP === 'ultimate') return true;
    checkTokenReset();
    if (UTokens < amount) { showTokenEmptyModal(reason); return false; }
    UTokens -= amount;
    await saveTokenState(); renderTokenBar(); return true;
}

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
        <div style="font-size:0.72rem;color:#888;margin-bottom:4px">🎫 Token: <strong style="color:${color}">${UP === 'ultimate' ? '∞' : UTokens}</strong>/${UP === 'ultimate' ? '∞' : UMaxTokens}</div>
        <div style="height:4px;background:rgba(255,255,255,0.07);border-radius:100px;overflow:hidden;margin-bottom:6px">
            <div style="height:100%;width:${pct}%;background:${color};border-radius:100px;transition:width 0.4s ease"></div>
        </div>
        ${UP !== 'ultimate' ? `<div style="font-size:0.68rem;color:#888;margin-bottom:6px">⏱ Yangilanish: <strong>${getTokenTimeLeft()}</strong></div>` : ''}`;

    const limitText = $id('limitText');
    const limitPills = $id('limitPills');
    const limitReset = $id('limitReset');

    if (UP === 'ultimate') {
        if (limitText) limitText.innerHTML = `<i class="fa-solid fa-infinity" style="margin-right:4px;color:#f5c842"></i>Cheksiz AI xabar`;
        if (limitPills) limitPills.innerHTML = '';
        if (limitReset) limitReset.textContent = '';
    } else {
        if (limitText) limitText.innerHTML = `AI xabar: <b style="color:${UTokens > 5 ? '#34d399' : '#ef4444'}">${UTokens}</b> / ${UMaxTokens} qoldi`;
        // FIX: leaderboard sonlar ko'pligi muammosi — faqat 10 ta pill
        const pillCount = 10;
        const usedCount = Math.round(((UMaxTokens - UTokens) / Math.max(1, UMaxTokens)) * pillCount);
        let pills = '';
        for (let i = 0; i < pillCount; i++) pills += `<div class="lpill ${i < usedCount ? 'used' : 'ok'}"></div>`;
        if (limitPills) limitPills.innerHTML = pills;
        if (limitReset) limitReset.textContent = `${getTokenTimeLeft()} da yangilanadi`;
    }
}

setInterval(() => { checkTokenReset(); renderTokenBar(); }, 10000);

// ══════════════════════════════════════════════════════════════
// TOKEN EMPTY MODAL
// ══════════════════════════════════════════════════════════════
function showTokenEmptyModal(reason) {
    const modal = $id('upgradeModal'); if (!modal) return;
    const textEl = $id('upgradeModalText');
    const timerEl = $id('upgradeTimer');
    if (textEl) textEl.innerHTML = `🎫 Tokenlar tugadi!<br><span style="font-size:0.8rem;color:#666">${reason || 'Davom etish uchun token kerak'}</span>`;
    if (timerEl) {
        const upd = () => { timerEl.textContent = `⏱ Yangilanish: ${getTokenTimeLeft()}`; };
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
// FIREBASE LOAD / SAVE
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
// XP & COIN
// ══════════════════════════════════════════════════════════════
async function awardXP(base, skill) {
    const plan = getPlan(); const rank = getRank();
    const total = Math.round(base * plan.xp_mult * rank.xp_mult);
    UXP += total;
    USk[skill] = Math.min(100, (USk[skill] || 0) + 2);
    const coinFromXP = Math.floor(UXP / 100) - Math.floor((UXP - total) / 100);
    if (coinFromXP > 0) { UCoin += coinFromXP; showToast(`🪙 +${coinFromXP} coin (XP bonus)`, 'info'); }
    const updates = { xp: increment(total), totalXP: increment(total), [`skills.${skill}`]: USk[skill] };
    if (coinFromXP > 0) { updates.coins = increment(coinFromXP); updates.totalCoins = increment(coinFromXP); }
    await updateUserField(updates);
    updateDisplays(); showXPPop(`+${total} XP`);
}

function updateDisplays() {
    const xpEl = $id('xpDisplay');
    if (xpEl) xpEl.textContent = UXP.toLocaleString();
    renderTokenBar(); drawRadar();

    const navUInfo = $id('navUserInfo');
    const planBadge = $id('planBadgeNav');
    const plan = (UP || 'free').toLowerCase();
    const color = PLAN_COLORS[plan] || '#94a3b8';
    if (planBadge) planBadge.innerHTML = `<span style="padding:3px 10px;border-radius:12px;background:${color}22;border:1px solid ${color}55;color:${color};font-size:0.72rem;font-weight:700">${(PLAN_LABELS[plan] || plan).toUpperCase()}</span>`;
    if (navUInfo) navUInfo.innerHTML = `<div style="display:flex;align-items:center;gap:8px">
        <span style="font-size:0.8rem;color:#e8ecff;font-weight:600">${CU?.displayName || CU?.email || 'User'}</span>
        <span style="font-size:0.78rem;color:#f5c842">⭐ ${UXP.toLocaleString()}</span>
        <span style="font-size:0.78rem;color:#fbbf24">🪙 ${UCoin.toLocaleString()}</span>
    </div>`;

    // sync drawer
    const dXP = $id('drawerXP'); const dCoin = $id('drawerCoin');
    if (dXP) dXP.textContent = UXP.toLocaleString();
    if (dCoin) dCoin.textContent = UCoin.toLocaleString();
    const navXP = $id('navXP'); if (navXP) navXP.textContent = UXP.toLocaleString();
    const navCoin = $id('navCoin'); if (navCoin) navCoin.textContent = UCoin.toLocaleString();
}

// ══════════════════════════════════════════════════════════════
// LEADERBOARD — FIX: use Number() to avoid Firestore large int issues
// ══════════════════════════════════════════════════════════════
window.loadLBSection = async function (field, btn) {
    if (btn) {
        document.querySelectorAll('#leaderboard-section .ptab').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
    }
    const container = $id('lbSectionContent'); if (!container) return;
    container.innerHTML = `<div style="text-align:center;padding:30px;color:#666"><i class="fa-solid fa-spinner fa-spin" style="font-size:1.5rem;color:#e05a14"></i><br>Yuklanmoqda...</div>`;
    try {
        const q = query(collection(_db, 'users'), orderBy(field, 'desc'), limit(20));
        const snap = await getDocs(q);
        const users = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        if (!users.length) { container.innerHTML = '<p style="text-align:center;color:#666">Hali hech kim yo\'q</p>'; return; }
        const labels = { xp: 'XP', coins: 'Coin', unitsCompleted: 'Unit' };
        const icons  = { xp: 'fa-star', coins: 'fa-coins', unitsCompleted: 'fa-book' };
        let html = `<div style="margin-bottom:16px;display:flex;justify-content:space-between;align-items:center">
            <span style="color:#666;font-size:0.8rem"><i class="fa-solid ${icons[field]||'fa-trophy'}" style="margin-right:4px;color:#e05a14"></i>${labels[field]||field} reytingi</span>
            <span style="color:#666;font-size:0.78rem">${users.length} foydalanuvchi</span></div>`;
        users.forEach((u, i) => {
            const rank = i + 1;
            const isMe = u.id === CU?.uid;
            const rankClass = rank === 1 ? 'gold' : rank === 2 ? 'silver' : rank === 3 ? 'bronze' : '';
            const rankIcon = rank === 1
                ? '<i class="fa-solid fa-trophy" style="color:#f5c842"></i>'
                : rank === 2 ? '<i class="fa-solid fa-medal" style="color:#94a3b8"></i>'
                : rank === 3 ? '<i class="fa-solid fa-medal" style="color:#cd7c4a"></i>'
                : rank;
            // FIX: convert to Number to handle large Firestore values properly
            const rawVal = u[field];
            const val = (rawVal !== undefined && rawVal !== null) ? Number(rawVal) : 0;
            const displayVal = isNaN(val) ? 0 : Math.round(val);
            const planKey = (u.plan || 'free').toLowerCase();
            const pc = PLAN_COLORS[planKey] || '#94a3b8';
            const planLabel = PLAN_LABELS[planKey] || planKey.toUpperCase();
            const initial = (u.displayName || u.email || 'U').charAt(0).toUpperCase();
            html += `<div class="lb-row${isMe ? ' me' : ''}">
                <div class="lb-rank ${rankClass}">${rankIcon}</div>
                <div class="lb-avatar">${initial}</div>
                <div style="flex:1">
                    <div class="lb-name">${u.displayName || u.email || 'Foydalanuvchi'}${isMe ? ' <span style="color:#e05a14;font-size:0.72rem">(siz)</span>' : ''}</div>
                    ${planKey !== 'free' ? `<span class="lb-plan" style="border-color:${pc}44;color:${pc}">${planLabel}</span>` : ''}
                </div>
                <div style="text-align:right">
                    <div class="lb-score"><i class="fa-solid ${icons[field]||'fa-star'}" style="margin-right:4px;color:#e05a14"></i>${displayVal.toLocaleString()}</div>
                </div>
            </div>`;
        });
        container.innerHTML = html;
    } catch (e) {
        container.innerHTML = `<div style="text-align:center;padding:30px;color:#ef4444"><i class="fa-solid fa-triangle-exclamation"></i> Xatolik: ${e.message}<br>
        <button onclick="window.loadLBSection('${field}',null)" style="margin-top:12px;padding:8px 16px;border-radius:8px;background:#e05a1422;border:1px solid #e05a1444;color:#e05a14;cursor:pointer">Qayta</button></div>`;
    }
};

// ══════════════════════════════════════════════════════════════
// AI — GROQ WORKER
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
        if (!r.ok) return `❗ AI xatolik: ${r.status}.`;
        const d = await r.json();
        return d.candidates?.[0]?.content?.parts?.[0]?.text || 'Javob olishda xatolik.';
    } catch (e) { return '❗ AI bilan bog\'lanishda xatolik.'; }
}

// ══════════════════════════════════════════════════════════════
// RADAR CHART
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
        angles.forEach((a, j) => { const x = cx + r * (i / 4) * Math.cos(a), y = cy + r * (i / 4) * Math.sin(a); j ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
        ctx.closePath(); ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.stroke();
    }
    angles.forEach(a => { ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + r * Math.cos(a), cy + r * Math.sin(a)); ctx.strokeStyle = 'rgba(255,255,255,0.1)'; ctx.stroke(); });
    ctx.beginPath();
    angles.forEach((a, i) => { const x = cx + r * skills[i] * Math.cos(a), y = cy + r * skills[i] * Math.sin(a); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
    ctx.closePath(); ctx.fillStyle = 'rgba(224,90,20,0.2)'; ctx.fill();
    ctx.strokeStyle = 'rgba(224,90,20,0.7)'; ctx.lineWidth = 2; ctx.stroke();
    angles.forEach((a, i) => { ctx.beginPath(); ctx.arc(cx + r * skills[i] * Math.cos(a), cy + r * skills[i] * Math.sin(a), 4, 0, Math.PI * 2); ctx.fillStyle = '#e05a14'; ctx.fill(); });
}

// ══════════════════════════════════════════════════════════════
// UNITS
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
          <div style="font-size:0.75rem;color:#e05a14;margin-bottom:4px">Unit ${i + 1}</div>
          <div style="font-size:1.8rem;margin-bottom:8px">${unit.emoji}</div>
          <div style="font-weight:700;font-size:1rem;color:#e8ecff;margin-bottom:6px">${unit.title}</div>
          <div style="font-size:0.8rem;color:#666;margin-bottom:12px">${unit.desc}</div>
          <div style="display:flex;gap:8px;margin-bottom:10px">
            ${['A','B','C','D'].map(l=>`<div style="width:24px;height:24px;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:0.7rem;font-weight:700;background:${UProg[unit.id+'_'+l]>=100?'rgba(52,211,153,0.2)':'rgba(255,255,255,0.05)'};border:1px solid ${UProg[unit.id+'_'+l]>=100?'#34d399':'rgba(255,255,255,0.1)'};color:${UProg[unit.id+'_'+l]>=100?'#34d399':'#666'}">${l}</div>`).join('')}
          </div>
          <div style="height:3px;background:rgba(255,255,255,0.06);border-radius:100px;overflow:hidden;margin-bottom:8px">
            <div style="height:100%;width:${pct}%;background:linear-gradient(90deg,#e05a14,#f09944);border-radius:100px;transition:width 0.4s"></div>
          </div>
          <div style="font-size:0.76rem;display:flex;gap:10px">
            <span style="color:#f5c842">+${unit.xp} XP</span>
            <span style="color:#fbbf24">+${unit.coin} 🪙</span>
            ${isComp ? '<span style="color:#34d399">✅</span>' : ''}
          </div>`;
        card.onclick = () => openUnit(unit);
        grid.appendChild(card);
    });
}

window.openUnit = function (unit) {
    curUnit = unit;
    const modal = $id('unitModal');
    const content = $id('modalContent');
    if (!modal || !content) return;
    const lnames = { A: "📖 Grammatika & Lug'at", B: "🎧 Listening", C: "📖 Reading", D: "🎤 Speaking & Writing" };
    const lcolors = { A: '#e05a14', B: '#22d3ee', C: '#34d399', D: '#f472b6' };
    content.innerHTML = `
      <div style="text-align:center;padding-bottom:20px">
        <div style="font-size:3rem;margin-bottom:10px">${unit.emoji}</div>
        <h2 style="margin-bottom:8px">${unit.title}</h2>
        <p style="color:#666">${unit.desc}</p>
        <div style="display:flex;gap:16px;justify-content:center;margin:16px 0;flex-wrap:wrap">
          <span style="color:#f5c842">⭐ +${unit.xp} XP</span>
          <span style="color:#fbbf24">🪙 +${unit.coin} Coin</span>
          <span style="color:#60a5fa">📚 ${unit.words.length} so'z</span>
          <span style="color:#e05a14">🎫 2 token/dars</span>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:20px">
        ${['A','B','C','D'].map(k=>{
            const done = UProg[`${unit.id}_${k}`] >= 100;
            const sc = UProg[`score_${unit.id}_${k}`] || 0;
            return `<div onclick="window.openLesson('${unit.id}','${k}')" style="padding:16px;border-radius:12px;background:${done?'rgba(52,211,153,0.08)':'rgba(255,255,255,0.03)'};border:1px solid ${done?'rgba(52,211,153,0.3)':'rgba(255,255,255,0.08)'};cursor:pointer;transition:all 0.2s">
                <div style="font-size:1.2rem;font-weight:800;color:${lcolors[k]};margin-bottom:4px">${k}</div>
                <div style="font-size:0.8rem;color:#e8ecff">${lnames[k]}</div>
                ${done?`<div style="font-size:0.72rem;color:#34d399;margin-top:4px">✅ ${sc}%</div>`:'<div style="font-size:0.72rem;color:#666;margin-top:4px">▶ Boshlash</div>'}
            </div>`;
        }).join('')}
      </div>
      <div>
        <div style="font-size:0.78rem;color:#666;margin-bottom:8px">📝 So'zlar:</div>
        <div style="display:flex;flex-wrap:wrap;gap:6px">
          ${unit.words.map(w=>`<span onclick="window.spk('${w.replace(/'/g,"\\'")}',event)" style="background:rgba(224,90,20,0.1);border:1px solid rgba(224,90,20,0.2);color:#f09944;padding:4px 10px;border-radius:20px;font-size:0.76rem;cursor:pointer">${w} 🔊</span>`).join('')}
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
    if (!alreadyDone) { const ok = await spendTokens(TOKEN_CONFIG.unit_cost, `${unit.title} darsi`); if (!ok) return; }
    curUnit = unit; lScore = 0; lTotal = 0;
    lexSel = {}; rSel = {}; woAns = []; lessonMics = {};
    showLessonModal(unit, lessonKey);
};

function showLessonModal(unit, lk) {
    const modal = $id('unitModal');
    const content = $id('modalContent');
    if (!modal || !content) return;
    const lnames = { A: "📖 Grammatika & Lug'at", B: "🎧 Listening", C: "📖 Reading", D: "🎤 Speaking & Writing" };
    content.innerHTML = `<div>
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px;padding-bottom:12px;border-bottom:1px solid rgba(255,255,255,0.08)">
        <button onclick="window.openUnit(window.__curUnit)" style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);color:#e8ecff;padding:6px 12px;border-radius:8px;cursor:pointer;font-size:0.8rem;font-family:inherit">← Orqaga</button>
        <div style="font-weight:700">${unit.emoji} ${unit.title} — ${lnames[lk]}</div>
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

// ─── LESSON A ───
function lessonA(unit) {
    const words = unit.words.slice(0, 12);
    const fills = words.slice(0, 4).map((w, i) => {
        const wd = WDB.find(x => x.e === w) || { ex: `"${w}" kelimesini kullanın.`, eu: '', u: '' };
        const blank = wd.ex.replace(new RegExp(w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'), '_______');
        return `<div style="margin-bottom:14px;padding:14px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:12px">
          <div style="font-size:0.9rem;margin-bottom:4px">${i + 1}. ${blank}</div>
          <div style="font-size:0.75rem;color:#666;margin-bottom:8px;font-style:italic">${wd.eu}</div>
          <input id="gex${i}" data-ans="${w}" placeholder="Javobingiz..." style="width:100%;padding:8px 12px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:8px;color:#e8ecff;font-family:inherit;margin-bottom:8px;box-sizing:border-box">
          <div style="display:flex;gap:6px">
            <button onclick="window.chkFill(${i})" style="padding:6px 14px;border-radius:8px;background:rgba(52,211,153,0.1);border:1px solid rgba(52,211,153,0.3);color:#34d399;cursor:pointer;font-size:0.78rem;font-family:inherit">✓ Tekshir</button>
            <button onclick="window.aiExWord('${w.replace(/'/g,"\\'")}',event)" style="padding:6px 14px;border-radius:8px;background:rgba(224,90,20,0.1);border:1px solid rgba(224,90,20,0.25);color:#f09944;cursor:pointer;font-size:0.78rem;font-family:inherit">🤖 AI</button>
            <button onclick="window.spk('${w.replace(/'/g,"\\'")}',event)" style="padding:6px 14px;border-radius:8px;background:rgba(96,165,250,0.1);border:1px solid rgba(96,165,250,0.2);color:#60a5fa;cursor:pointer;font-size:0.78rem;font-family:inherit">🔊</button>
          </div>
          <div id="gexfb${i}" style="margin-top:6px;font-size:0.8rem"></div>
        </div>`;
    }).join('');

    const matchW = words.slice(0, 6);
    const shuffUZ = shuffle(matchW.map(w => { const d = WDB.find(x => x.e === w); return d ? d.u : w; }));

    return `
    <div style="margin-bottom:20px">
      <h3 style="margin-bottom:12px;color:#e8ecff">📚 So'zlar lug'ati</h3>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:10px">
        ${words.map(w => {
            const d = WDB.find(x => x.e === w) || { u: '', t: '', ex: '', eu: '' };
            return `<div style="padding:14px;border-radius:12px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06)">
              <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px">
                <span style="font-weight:700;font-size:1rem;color:#e8ecff">${w}</span>
                <button onclick="window.spk('${w.replace(/'/g,"\\'")}',event)" style="background:none;border:none;cursor:pointer;font-size:1rem">🔊</button>
              </div>
              <div style="color:#f09944;font-size:0.82rem;margin-bottom:3px">${d.u}</div>
              <div style="color:#666;font-size:0.72rem;font-style:italic">"${d.ex}"</div>
            </div>`;
        }).join('')}
      </div>
    </div>
    <div style="margin-bottom:20px;padding:16px;background:rgba(224,90,20,0.06);border:1px solid rgba(224,90,20,0.15);border-radius:12px">
      <h3 style="margin-bottom:10px;color:#e8ecff">📝 Grammatika Qoidasi</h3>
      <div style="font-size:0.9rem;color:#fbd38d;margin-bottom:8px">💡 ${unit.grammar_rule || ''}</div>
      <div style="font-size:0.85rem;color:#f09944;font-style:italic">✏️ ${unit.grammar_example || ''}</div>
      <button onclick="window.aiGrammarExplain('${unit.title}','${(unit.grammar_rule||'').replace(/'/g,"\\'")}')}" style="margin-top:10px;padding:8px 16px;border-radius:8px;background:rgba(224,90,20,0.1);border:1px solid rgba(224,90,20,0.25);color:#f09944;cursor:pointer;font-size:0.78rem;font-family:inherit">🤖 AI batafsil tushuntirsin (1 token)</button>
      <div id="gramRuleFB" style="margin-top:8px;font-size:0.8rem"></div>
    </div>
    <div style="margin-bottom:20px">
      <h3 style="margin-bottom:12px;color:#e8ecff">✏️ To'ldirish Mashqlari</h3>
      ${fills}
      <div id="vocabAIFB" style="font-size:0.8rem"></div>
    </div>
    <div style="margin-bottom:20px">
      <h3 style="margin-bottom:12px;color:#e8ecff">🧩 Juftlash Mashqi</h3>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        <div>${matchW.map((w,i)=>`<div class="match-item eng" data-i="${i}" onclick="window.selMatch(this,'e',${i})" style="padding:10px 14px;border-radius:10px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);cursor:pointer;margin-bottom:6px;font-size:0.88rem;color:#e8ecff;transition:all 0.2s">${w}</div>`).join('')}</div>
        <div>${shuffUZ.map(u=>`<div class="match-item uz" data-u="${u}" onclick="window.selMatch(this,'u','${u.replace(/'/g,"\\'")}')}" style="padding:10px 14px;border-radius:10px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);cursor:pointer;margin-bottom:6px;font-size:0.88rem;color:#fbd38d;transition:all 0.2s">${u}</div>`).join('')}</div>
      </div>
      <div id="matchFB" style="margin-top:8px;font-size:0.8rem"></div>
    </div>
    <button onclick="window.finLessonA('${unit.id}')" style="width:100%;padding:14px;border-radius:12px;background:linear-gradient(135deg,#e05a14,#f09944);border:none;color:#fff;font-size:0.95rem;font-weight:700;cursor:pointer;font-family:inherit">✅ Grammatika darsini yakunlash</button>`;
}

window.chkFill = function (i) {
    const inp = $id(`gex${i}`); const fb = $id(`gexfb${i}`);
    if (!inp || !fb) return;
    if (inp.value.trim().toLowerCase() === inp.dataset.ans.toLowerCase()) {
        fb.innerHTML = `<span style="color:#34d399">✅ To'g'ri! "${inp.dataset.ans}"</span>`;
        inp.style.borderColor = '#34d399'; lScore++; awardXP(10, 'grammar');
    } else {
        fb.innerHTML = `<span style="color:#ef4444">❌ To'g'ri javob: <strong>${inp.dataset.ans}</strong></span>`;
        inp.style.borderColor = '#ef4444';
    }
    lTotal++;
};

window.selMatch = function (el, type, val) {
    if (type === 'e') {
        document.querySelectorAll('.match-item.eng').forEach(x => { x.style.borderColor = 'rgba(255,255,255,0.1)'; x.style.background = 'rgba(255,255,255,0.04)'; });
        el.style.background = 'rgba(224,90,20,0.2)'; el.style.borderColor = '#e05a14';
        mSel.e = val; mSel.eEl = el;
    } else {
        document.querySelectorAll('.match-item.uz').forEach(x => { x.style.borderColor = 'rgba(255,255,255,0.1)'; x.style.background = 'rgba(255,255,255,0.04)'; });
        el.style.background = 'rgba(240,153,68,0.2)'; el.style.borderColor = '#f09944';
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
    const ok = await spendTokens(TOKEN_CONFIG.ai_cost, 'AI grammatika izoh'); if (!ok) return;
    const fb = $id('gramRuleFB'); if (fb) fb.innerHTML = '🤖 AI tahlil qilmoqda...';
    const r = await callAI(`"${title}" mavzusida "${rule}" Turk grammatika qoidasini ${NATIVE_LANG} tilida (javob shu tilda bo'lsin) tushuntir. 3 ta misol keltir.`, 800);
    if (fb) fb.innerHTML = r.replace(/\n/g, '<br>');
};

window.aiExWord = async function (word, e) {
    if (e) e.stopPropagation();
    const ok = await spendTokens(TOKEN_CONFIG.ai_cost, `"${word}" AI izoh`); if (!ok) return;
    const fb = $id('vocabAIFB') || $id('wordAIFB');
    if (fb) fb.innerHTML = `🤖 "${word}" tahlil qilmoqda...`;
    const r = await callAI(`"${word}" Turkcha so'zini ${NATIVE_LANG} tilida (javob shu tilda bo'lsin): 1) Ma'nosi 2) 3 misol 3) Grammatika eslatma`, 600);
    if (fb) fb.innerHTML = r.replace(/\n/g, '<br>');
};

window.finLessonA = async function (uid) { await finLesson(uid, 'A', 'grammar', lScore, lTotal || 4); };

// ─── LESSON B ───
function lessonB(unit) {
    const exs = genListenExs(unit);
    window.__listenExs = exs;
    return `
    <div style="margin-bottom:20px">
      <h3 style="margin-bottom:12px;color:#e8ecff">🎧 Listening Mashqi</h3>
      <div id="lexCont">${renderLex(exs, 0)}</div>
    </div>
    <div style="margin-bottom:20px;padding:16px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:12px">
      <h3 style="margin-bottom:12px;color:#e8ecff">✍️ Diktant</h3>
      <div style="display:flex;gap:8px;margin-bottom:12px">
        <button onclick="window.playDict('${unit.id}','normal')" style="padding:8px 16px;border-radius:8px;background:rgba(96,165,250,0.1);border:1px solid rgba(96,165,250,0.2);color:#60a5fa;cursor:pointer;font-size:0.82rem;font-family:inherit">▶ Eshitish</button>
        <button onclick="window.playDict('${unit.id}','slow')" style="padding:8px 16px;border-radius:8px;background:rgba(224,90,20,0.1);border:1px solid rgba(224,90,20,0.2);color:#f09944;cursor:pointer;font-size:0.82rem;font-family:inherit">🐌 Sekin</button>
      </div>
      <textarea id="dictIn" placeholder="Eshitgangizni yozing..." style="width:100%;height:80px;padding:10px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:8px;color:#e8ecff;font-family:inherit;resize:none;box-sizing:border-box"></textarea>
      <div style="display:flex;gap:6px;margin-top:8px">
        <button onclick="window.chkDict()" style="padding:7px 14px;border-radius:8px;background:rgba(52,211,153,0.1);border:1px solid rgba(52,211,153,0.3);color:#34d399;cursor:pointer;font-size:0.78rem;font-family:inherit">✓ Tekshir</button>
        <button onclick="window.aiChkDict()" style="padding:7px 14px;border-radius:8px;background:rgba(224,90,20,0.1);border:1px solid rgba(224,90,20,0.25);color:#f09944;cursor:pointer;font-size:0.78rem;font-family:inherit">🤖 AI tahlil (1 token)</button>
      </div>
      <div id="dictFB" style="margin-top:8px;font-size:0.8rem"></div>
    </div>
    <button onclick="window.finLessonB('${unit.id}')" style="width:100%;padding:14px;border-radius:12px;background:linear-gradient(135deg,#22d3ee,#e05a14);border:none;color:#fff;font-size:0.95rem;font-weight:700;cursor:pointer;font-family:inherit">✅ Listening yakunlash</button>`;
}

function genListenExs(unit) {
    const w = unit.words;
    return [
        { text: `Bugün ${unit.title.toLowerCase()} hakkında konuşuyoruz. "${w[0]}" kelimesi Türkçede çok önemlidir.`, q: `Metin esas neden bahsedior?`, opts: [unit.title, 'Spor', 'Yemek', 'Seyahat'], c: 0, tip: `"Bugün ... hakkında konuşuyoruz"` },
        { text: `Merhaba! Benim adım Ayşe. Bugün size ${w[0]} ve ${w[1]||w[0]} hakkında öğreteceğim. Hazır mısınız?`, q: `Ayşe ne hakkında öğretecek?`, opts: [`${w[2]||w[0]}`, `${w[0]}`, `${w[1]||w[0]}`, 'Her şey birden'], c: 1, tip: `"Bugün size ... öğreteceğim"` },
        { text: `${unit.title} büyüleyici bir konudur. Türkçenizi geliştirmek istiyorsanız, her gün pratik yapmalısınız.`, q: `Türkçeyi geliştirmek için ne yapmalısınız?`, opts: ['Kitap almak', 'Her gün pratik', 'Ders almak', 'TV izlemek'], c: 1, tip: `"her gün pratik yapmalısınız"` }
    ];
}

function renderLex(exs, idx) {
    const ex = exs[idx];
    if (!ex) return '<div style="text-align:center;padding:20px;color:#34d399">🎉 Barcha listening mashqlari tugadi!</div>';
    return `<div style="padding:16px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:12px">
      <div style="font-size:0.75rem;color:#f09944;margin-bottom:8px">Savol ${idx+1}/${exs.length}</div>
      <div style="display:flex;gap:8px;margin-bottom:12px">
        <button onclick="window.playLex(${idx},'normal')" style="padding:8px 16px;border-radius:8px;background:rgba(96,165,250,0.1);border:1px solid rgba(96,165,250,0.2);color:#60a5fa;cursor:pointer;font-size:0.82rem;font-family:inherit">▶ Tinglash</button>
        <button onclick="window.playLex(${idx},'slow')" style="padding:8px 16px;border-radius:8px;background:rgba(224,90,20,0.1);border:1px solid rgba(224,90,20,0.2);color:#f09944;cursor:pointer;font-size:0.82rem;font-family:inherit">🐌 Sekin</button>
      </div>
      <div id="ltxt${idx}" style="display:none;padding:10px;background:rgba(255,255,255,0.04);border-radius:8px;font-size:0.82rem;color:#e8ecff;margin-bottom:10px;font-style:italic">${ex.text}</div>
      <div style="font-weight:600;margin-bottom:10px">${ex.q}</div>
      <div>${ex.opts.map((o,oi)=>`<div class="lex-opt" data-qi="${idx}" data-oi="${oi}" onclick="window.selLex(this,${idx},${oi})" style="padding:10px 14px;border-radius:8px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);cursor:pointer;margin-bottom:6px;font-size:0.88rem;transition:all 0.2s">${String.fromCharCode(65+oi)}. ${o}</div>`).join('')}</div>
      <div style="font-size:0.75rem;color:#666;margin-bottom:10px">💡 ${ex.tip}</div>
      <div style="display:flex;gap:6px">
        <button onclick="window.chkLex(${idx},${ex.c})" style="padding:7px 14px;border-radius:8px;background:rgba(52,211,153,0.1);border:1px solid rgba(52,211,153,0.3);color:#34d399;cursor:pointer;font-size:0.78rem;font-family:inherit">✓ Tekshir</button>
        ${idx+1<exs.length?`<button onclick="window.nextLex(${idx+1})" id="lexnxt${idx}" style="display:none;padding:7px 14px;border-radius:8px;background:rgba(96,165,250,0.1);border:1px solid rgba(96,165,250,0.2);color:#60a5fa;cursor:pointer;font-size:0.78rem;font-family:inherit">→ Keyingi</button>`:''}
      </div>
      <div id="lexfb${idx}" style="margin-top:8px;font-size:0.8rem"></div>
    </div>`;
}

window.playLex = function (idx, speed) {
    const exs = window.__listenExs || []; if (!exs[idx]) return;
    const u = new SpeechSynthesisUtterance(exs[idx].text);
    u.lang = 'tr-TR'; u.rate = speed === 'slow' ? 0.55 : 0.82;
    speechSynthesis.cancel(); speechSynthesis.speak(u);
};
window.selLex = function (el, qi, oi) {
    document.querySelectorAll(`.lex-opt[data-qi="${qi}"]`).forEach(o => { o.style.background = 'rgba(255,255,255,0.04)'; o.style.borderColor = 'rgba(255,255,255,0.08)'; });
    el.style.background = 'rgba(224,90,20,0.15)'; el.style.borderColor = '#e05a14';
    lexSel[qi] = oi;
};
window.chkLex = function (idx, correct) {
    const fb = $id(`lexfb${idx}`);
    const sel = lexSel[idx];
    if (sel === undefined) { if (fb) fb.innerHTML = '<span style="color:#f5c842">⚠️ Javob tanlang!</span>'; return; }
    document.querySelectorAll(`.lex-opt[data-qi="${idx}"]`).forEach((o, i) => {
        if (i === correct) { o.style.background = 'rgba(52,211,153,0.2)'; o.style.borderColor = '#34d399'; }
        else if (i === sel && sel !== correct) { o.style.background = 'rgba(239,68,68,0.2)'; o.style.borderColor = '#ef4444'; }
    });
    const txEl = $id(`ltxt${idx}`); if (txEl) txEl.style.display = 'block';
    if (sel === correct) { if (fb) fb.innerHTML = '<span style="color:#34d399">✅ To\'g\'ri!</span>'; lScore++; awardXP(15, 'listening'); }
    else { if (fb) fb.innerHTML = `<span style="color:#ef4444">❌ To'g'ri: <strong>${String.fromCharCode(65+correct)}</strong></span>`; }
    lTotal++;
    const nxt = $id(`lexnxt${idx}`); if (nxt) nxt.style.display = 'inline-flex';
};
window.nextLex = function (idx) { const exs = window.__listenExs || []; const cont = $id('lexCont'); if (cont) cont.innerHTML = renderLex(exs, idx); };
window.playDict = function (uid, speed) {
    let unit = null;
    for (const lvl of Object.values(UD_DATA)) { const f = lvl.find(u => u.id === uid); if (f) { unit = f; break; } }
    if (!unit) return;
    const wd = WDB.find(x => x.e === unit.words[0]);
    dictSent = wd ? wd.ex : `"${unit.words[0]}" kelimesi çok önemlidir.`;
    const u2 = new SpeechSynthesisUtterance(dictSent);
    u2.lang = 'tr-TR'; u2.rate = speed === 'slow' ? 0.5 : 0.82;
    speechSynthesis.cancel(); speechSynthesis.speak(u2);
};
window.chkDict = function () {
    const inp = $id('dictIn'); const fb = $id('dictFB');
    if (!inp || !fb || !dictSent) { if (fb) fb.innerHTML = '<span style="color:#f5c842">⚠️ Avval audio tinglang!</span>'; return; }
    const cw = dictSent.toLowerCase().replace(/[.,!?]/g,'').split(' ');
    const uw = inp.value.trim().toLowerCase().replace(/[.,!?]/g,'').split(' ');
    let mc = 0;
    const hl = cw.map(w => { if (uw.includes(w)) { mc++; return `<span style="color:#34d399;font-weight:600">${w}</span>`; } return `<span style="color:#ef4444">${w}</span>`; }).join(' ');
    const pct = Math.round((mc/cw.length)*100);
    fb.innerHTML = `<div><strong>To'g'ri:</strong> ${hl}</div><div style="margin-top:6px"><strong>Siz:</strong> ${inp.value}</div><div style="font-size:0.9rem;font-weight:700;margin-top:6px;color:${pct>=70?'#34d399':'#ef4444'}">${pct}%</div>`;
    if (pct>=70) { lScore++; awardXP(20,'listening'); } lTotal++;
};
window.aiChkDict = async function () {
    const ok = await spendTokens(TOKEN_CONFIG.ai_cost,'AI diktant tahlil'); if(!ok) return;
    const inp = $id('dictIn'); const fb = $id('dictFB');
    if (!inp?.value.trim()) { if(fb) fb.innerHTML='<span style="color:#f5c842">Avval yozing!</span>'; return; }
    fb.innerHTML='🤖 AI tahlil qilmoqda...';
    const r = await callAI(`Diktant tahlili ${NATIVE_LANG} tilida (javob shu tilda bo'lsin):\nAsl: "${dictSent}"\nO'quvchi: "${inp.value.trim()}"\n1) Xatolari 2) Ball: /10 3) Maslahat`,600);
    fb.innerHTML = r.replace(/\n/g,'<br>');
};
window.finLessonB = async function (uid) { await finLesson(uid,'B','listening',lScore,lTotal||3); };

// ─── LESSON C ───
function lessonC(unit) {
    const qs = unit.reading_qs || [];
    const wh = unit.words.slice(0,5);
    return `
    <div style="margin-bottom:20px">
      <h3 style="margin-bottom:12px;color:#e8ecff">📖 Matn o'qish</h3>
      <div style="padding:16px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:12px">
        <div style="font-weight:700;font-size:1rem;margin-bottom:10px;color:#e8ecff">${unit.title}</div>
        <div id="rdbody" style="font-size:0.88rem;line-height:1.7;color:#fbd38d">${unit.reading_text||''}</div>
        <button onclick="window.rdAloud()" style="margin-top:12px;padding:7px 14px;border-radius:8px;background:rgba(96,165,250,0.1);border:1px solid rgba(96,165,250,0.2);color:#60a5fa;cursor:pointer;font-size:0.78rem;font-family:inherit">🔊 Tinglash</button>
      </div>
    </div>
    <div style="margin-bottom:20px">
      <h3 style="margin-bottom:12px;color:#e8ecff">❓ Savolar</h3>
      ${qs.map((q,qi)=>`<div style="margin-bottom:14px;padding:14px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:12px">
        <div style="font-weight:600;margin-bottom:10px">${qi+1}. ${q.q}</div>
        <div>${q.opts.map((o,oi)=>`<div class="rq-opt" data-qi="${qi}" data-oi="${oi}" onclick="window.selRQ(this,${qi},${oi})" style="padding:10px 14px;border-radius:8px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);cursor:pointer;margin-bottom:6px;font-size:0.88rem;transition:all 0.2s">${String.fromCharCode(65+oi)}. ${o}</div>`).join('')}</div>
        <div id="rqfb${qi}" style="margin-top:6px;font-size:0.8rem"></div>
      </div>`).join('')}
      <button onclick="window.chkAllRQ(${JSON.stringify(qs.map(q=>q.c))})" style="padding:8px 16px;border-radius:8px;background:rgba(52,211,153,0.1);border:1px solid rgba(52,211,153,0.3);color:#34d399;cursor:pointer;font-size:0.82rem;font-family:inherit;margin-top:8px">✓ Hammasini tekshir</button>
      <div id="rdTotFB" style="margin-top:8px;font-size:0.8rem"></div>
    </div>
    <div style="margin-bottom:20px">
      <h3 style="margin-bottom:12px;color:#e8ecff">🔤 So'z yozish</h3>
      ${wh.map((w,i)=>{
        const d = WDB.find(x=>x.e===w)||{u:w};
        return `<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
          <span style="color:#f09944;font-size:0.85rem;min-width:80px">${d.u}</span>
          <input id="whi${i}" data-ans="${w}" placeholder="Turkcha..." style="flex:1;padding:8px 12px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:8px;color:#e8ecff;font-family:inherit">
          <button onclick="window.chkWH(${i})" style="padding:7px 12px;border-radius:8px;background:rgba(52,211,153,0.1);border:1px solid rgba(52,211,153,0.3);color:#34d399;cursor:pointer;font-size:0.78rem;font-family:inherit">✓</button>
          <button onclick="window.spk('${w.replace(/'/g,"\\'")}',event)" style="padding:7px 12px;border-radius:8px;background:rgba(96,165,250,0.1);border:1px solid rgba(96,165,250,0.2);color:#60a5fa;cursor:pointer;font-size:0.78rem;font-family:inherit">🔊</button>
          <span id="whfb${i}" style="font-size:0.8rem;min-width:30px"></span>
        </div>`;
      }).join('')}
    </div>
    <button onclick="window.finLessonC('${unit.id}')" style="width:100%;padding:14px;border-radius:12px;background:linear-gradient(135deg,#34d399,#22d3ee);border:none;color:#fff;font-size:0.95rem;font-weight:700;cursor:pointer;font-family:inherit">✅ Reading yakunlash</button>`;
}

window.rdAloud = function () {
    const b = $id('rdbody'); if (!b) return;
    const u = new SpeechSynthesisUtterance(b.textContent);
    u.lang = 'tr-TR'; u.rate = 0.82;
    speechSynthesis.cancel(); speechSynthesis.speak(u);
};
window.selRQ = function (el, qi, oi) {
    document.querySelectorAll(`.rq-opt[data-qi="${qi}"]`).forEach(o => { o.style.background='rgba(255,255,255,0.04)'; o.style.borderColor='rgba(255,255,255,0.08)'; });
    el.style.background='rgba(224,90,20,0.15)'; el.style.borderColor='#e05a14';
    rSel[qi] = oi;
};
window.chkAllRQ = function (answers) {
    let score = 0;
    answers.forEach((correct,qi) => {
        const sel = rSel[qi]; const fb = $id(`rqfb${qi}`);
        if (sel === undefined) { if(fb) fb.innerHTML='<span style="color:#f5c842">⚠️ Javob tanlang!</span>'; return; }
        document.querySelectorAll(`.rq-opt[data-qi="${qi}"]`).forEach((o,i)=>{
            if(i===correct){o.style.background='rgba(52,211,153,0.2)';o.style.borderColor='#34d399';}
            else if(i===sel&&sel!==correct){o.style.background='rgba(239,68,68,0.2)';o.style.borderColor='#ef4444';}
        });
        if(sel===correct){score++;if(fb)fb.innerHTML='<span style="color:#34d399">✅ To\'g\'ri!</span>';}
        else{if(fb)fb.innerHTML=`<span style="color:#ef4444">❌ To'g'ri: ${String.fromCharCode(65+correct)}</span>`;}
    });
    lScore+=score; lTotal+=answers.length; awardXP(score*15,'reading');
    const fb=$id('rdTotFB');
    if(fb) fb.innerHTML=`<span style="color:${score===answers.length?'#34d399':'#f5c842'}">Jami: ${score}/${answers.length}</span>`;
};
window.chkWH = function (i) {
    const inp=$id(`whi${i}`); const fb=$id(`whfb${i}`); if(!inp||!fb) return;
    if(inp.value.trim().toLowerCase()===inp.dataset.ans.toLowerCase()){fb.innerHTML='✅';inp.style.borderColor='#34d399';awardXP(8,'writing');}
    else{fb.innerHTML='❌';inp.style.borderColor='#ef4444';}
};
window.finLessonC = async function (uid) { await finLesson(uid,'C','reading',lScore,lTotal||6); };

// ─── LESSON D ───
function lessonD(unit) {
    const topics = unit.words.slice(0,3);
    const woSent = (WDB.find(x=>x.e===unit.words[0])?.ex) || `"${unit.words[0]}" kelimesini her gün kullanıyorum.`;
    window.__woCorrect = woSent;
    return `
    <div style="margin-bottom:20px">
      <h3 style="margin-bottom:12px;color:#e8ecff">🎤 Speaking Mashqi</h3>
      ${topics.map((w,i)=>{
        const d=WDB.find(x=>x.e===w)||{u:'',ex:''};
        return `<div style="margin-bottom:14px;padding:14px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:12px">
          <div style="font-weight:600;margin-bottom:4px">${i+1}. "${w}" so'zini ishlatib gaping:</div>
          <div style="font-size:0.78rem;color:#666;margin-bottom:10px">O'zbek: ${d.u} · Misol: ${d.ex}</div>
          <div style="display:flex;gap:6px;margin-bottom:8px">
            <button id="mbtn${i}" onclick="window.togMic(${i})" style="padding:8px 16px;border-radius:8px;background:rgba(244,114,182,0.1);border:1px solid rgba(244,114,182,0.25);color:#f472b6;cursor:pointer;font-size:0.82rem;font-family:inherit">🎤 Gapirish</button>
            <button onclick="window.spk('${w.replace(/'/g,"\\'")}',event)" style="padding:8px 12px;border-radius:8px;background:rgba(96,165,250,0.1);border:1px solid rgba(96,165,250,0.2);color:#60a5fa;cursor:pointer;font-size:0.82rem;font-family:inherit">🔊</button>
          </div>
          <div id="mst${i}" style="font-size:0.75rem;color:#666"></div>
          <div id="mtr${i}" style="padding:8px;font-size:0.88rem;color:#fbd38d;min-height:24px;border-radius:6px"></div>
          <div style="display:flex;gap:6px;margin-top:8px">
            <button onclick="window.aiSpk(${i},'${w}')" style="padding:6px 14px;border-radius:8px;background:rgba(224,90,20,0.1);border:1px solid rgba(224,90,20,0.25);color:#f09944;cursor:pointer;font-size:0.78rem;font-family:inherit">🤖 AI baholash (1 token)</button>
            <button onclick="window.markDone(${i})" style="padding:6px 14px;border-radius:8px;background:rgba(52,211,153,0.1);border:1px solid rgba(52,211,153,0.3);color:#34d399;cursor:pointer;font-size:0.78rem;font-family:inherit">✅ Bajarildi</button>
          </div>
          <div id="sfb${i}" style="margin-top:8px;font-size:0.82rem"></div>
        </div>`;
      }).join('')}
    </div>
    <div style="margin-bottom:20px">
      <h3 style="margin-bottom:12px;color:#e8ecff">✍️ Writing Mashqi</h3>
      <div style="padding:14px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:12px">
        <div style="font-size:0.85rem;color:#aaa;margin-bottom:8px">Mavzu: "${unit.title}" haqida 40+ so'zli matn yozing (Turkcha).</div>
        <textarea id="dta" placeholder="Bu yerda yozing..." oninput="window.updWC()" style="width:100%;height:100px;padding:10px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:8px;color:#e8ecff;font-family:inherit;resize:none;box-sizing:border-box"></textarea>
        <div style="display:flex;gap:10px;font-size:0.75rem;color:#666;margin:6px 0"><span id="dwc">0 so'z</span><span id="dcc">0 belgi</span><span id="dst" style="color:#f87171">Min 40 so'z</span></div>
        <div style="display:flex;gap:6px">
          <button onclick="window.aiWrit('${unit.title}','${unit.words.slice(0,5).join(',')}')" style="padding:7px 14px;border-radius:8px;background:rgba(224,90,20,0.1);border:1px solid rgba(224,90,20,0.25);color:#f09944;cursor:pointer;font-size:0.78rem;font-family:inherit">🤖 AI (1 token)</button>
          <button onclick="window.selfChk(40)" style="padding:7px 14px;border-radius:8px;background:rgba(96,165,250,0.1);border:1px solid rgba(96,165,250,0.2);color:#60a5fa;cursor:pointer;font-size:0.78rem;font-family:inherit">📊 So'z soni</button>
        </div>
        <div id="wfb" style="margin-top:8px;font-size:0.8rem"></div>
      </div>
    </div>
    <div style="margin-bottom:20px">
      <h3 style="margin-bottom:12px;color:#e8ecff">🔀 So'z Tartibi</h3>
      <div id="woChips" style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px">
        ${shuffle(woSent.split(' ')).map(w=>`<div class="wo-chip" data-w="${w}" onclick="window.selChip(this)" style="background:rgba(224,90,20,0.1);border:1px solid rgba(224,90,20,0.2);color:#f09944;padding:6px 12px;border-radius:20px;cursor:pointer;font-size:0.85rem">${w}</div>`).join('')}
      </div>
      <div id="woAnsDiv" style="min-height:40px;padding:10px;background:rgba(255,255,255,0.03);border:1px dashed rgba(255,255,255,0.1);border-radius:8px;display:flex;flex-wrap:wrap;gap:6px;font-size:0.88rem;color:#666;margin-bottom:8px"><span>Bu yerga bosing...</span></div>
      <div style="display:flex;gap:6px">
        <button onclick="window.chkWO()" style="padding:7px 14px;border-radius:8px;background:rgba(52,211,153,0.1);border:1px solid rgba(52,211,153,0.3);color:#34d399;cursor:pointer;font-size:0.78rem;font-family:inherit">✓ Tekshir</button>
        <button onclick="window.rstWO()" style="padding:7px 14px;border-radius:8px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);color:#e8ecff;cursor:pointer;font-size:0.78rem;font-family:inherit">🔄 Qayta</button>
        <button onclick="window.spk('${woSent.replace(/'/g,"\\'")}',event)" style="padding:7px 14px;border-radius:8px;background:rgba(96,165,250,0.1);border:1px solid rgba(96,165,250,0.2);color:#60a5fa;cursor:pointer;font-size:0.78rem;font-family:inherit">🔊</button>
      </div>
      <div id="wofb" style="margin-top:8px;font-size:0.8rem"></div>
    </div>
    <button onclick="window.finLessonD('${unit.id}')" style="width:100%;padding:14px;border-radius:12px;background:linear-gradient(135deg,#f472b6,#e05a14);border:none;color:#fff;font-size:0.95rem;font-weight:700;cursor:pointer;font-family:inherit">✅ Speaking & Writing yakunlash</button>`;
}

window.selChip = function (el) {
    if (el.classList.contains('used')) return;
    el.classList.add('used'); el.style.opacity='0.3';
    woAns.push(el.dataset.w);
    const d=$id('woAnsDiv');
    if(d) d.innerHTML=woAns.map((w,i)=>`<span onclick="window.rmChip(${i})" style="background:rgba(224,90,20,0.15);border:1px solid rgba(224,90,20,0.3);border-radius:20px;padding:6px 12px;cursor:pointer;font-size:0.85rem">${w}</span>`).join('')||'<span style="color:#666">Bu yerga bosing...</span>';
};
window.rmChip = function (idx) {
    const w=woAns[idx]; woAns.splice(idx,1);
    document.querySelectorAll('.wo-chip').forEach(c=>{if(c.dataset.w===w&&c.classList.contains('used')){c.classList.remove('used');c.style.opacity='1';return;}});
    const d=$id('woAnsDiv');
    if(d) d.innerHTML=woAns.map((w,i)=>`<span onclick="window.rmChip(${i})" style="background:rgba(224,90,20,0.15);border:1px solid rgba(224,90,20,0.3);border-radius:20px;padding:6px 12px;cursor:pointer;font-size:0.85rem">${w}</span>`).join('')||'<span style="color:#666">Bu yerga bosing...</span>';
};
window.rstWO = function () {
    woAns=[];
    document.querySelectorAll('.wo-chip').forEach(c=>{c.classList.remove('used');c.style.opacity='1';});
    const d=$id('woAnsDiv'); if(d) d.innerHTML='<span style="color:#666">Bu yerga bosing...</span>';
};
window.chkWO = function () {
    const fb=$id('wofb');
    if(!woAns.length){if(fb)fb.innerHTML='<span style="color:#f5c842">⚠️ So\'zlarni tartibga qo\'ying!</span>';return;}
    if(woAns.join(' ').toLowerCase()===(window.__woCorrect||'').toLowerCase()){
        if(fb)fb.innerHTML='<span style="color:#34d399">🏆 Mukammal!</span>';
        awardXP(15,'writing'); lScore++;
    } else {if(fb)fb.innerHTML=`<span style="color:#ef4444">❌ To'g'ri: <em>${window.__woCorrect}</em></span>`;}
    lTotal++;
};
window.togMic = function (idx) {
    const btn=$id(`mbtn${idx}`); const st=$id(`mst${idx}`); const tr=$id(`mtr${idx}`);
    const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
    if(!SR){if(tr)tr.innerHTML=`<textarea style="width:100%;padding:8px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:8px;color:#e8ecff;font-family:inherit" id="man${idx}" placeholder="Yozing..."></textarea>`;if(st)st.textContent='⌨️ Yozma kiritish';return;}
    if(lessonMics[idx]){try{lessonMics[idx].stop();}catch(e){}lessonMics[idx]=null;if(btn)btn.innerHTML='🎤 Gapirish';return;}
    const rec=new SR();rec.lang='tr-TR';rec.continuous=true;rec.interimResults=true;
    rec.onresult=e=>{let t='';for(let i=e.resultIndex;i<e.results.length;i++)t+=e.results[i][0].transcript;if(tr&&tr.tagName!=='TEXTAREA')tr.textContent=t;};
    rec.onerror=e=>{if(btn)btn.innerHTML='🎤 Gapirish';lessonMics[idx]=null;if(e.error==='not-allowed'&&tr)tr.innerHTML=`<textarea style="width:100%;padding:8px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:8px;color:#e8ecff;font-family:inherit" id="man${idx}" placeholder="Yozing..."></textarea>`;};
    rec.onend=()=>{if(btn)btn.innerHTML='🎤 Gapirish';if(st)st.innerHTML='✅ Yozib olindi';lessonMics[idx]=null;};
    try{rec.start();lessonMics[idx]=rec;if(btn)btn.innerHTML='⏹ To\'xtatish';if(st)st.innerHTML='🔴 Yozmoqda...';}
    catch(e){if(tr)tr.innerHTML=`<textarea style="width:100%;padding:8px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:8px;color:#e8ecff;font-family:inherit" id="man${idx}" placeholder="Yozing..."></textarea>`;}
};
window.aiSpk = async function (idx, topic) {
    const ok=await spendTokens(TOKEN_CONFIG.ai_cost,'AI speaking baholash');if(!ok)return;
    const tr=$id(`mtr${idx}`);const man=$id(`man${idx}`);const fb=$id(`sfb${idx}`);
    let text='';
    if(tr)text=tr.tagName==='TEXTAREA'?tr.value.trim():tr.textContent.trim();
    if(!text&&man)text=man.value.trim();
    if(!text){if(fb)fb.innerHTML='<span style="color:#f5c842">⚠️ Avval gapiring!</span>';return;}
    if(fb)fb.innerHTML='🤖 Baholayapti...';
    const r=await callAI(`Speaking baholash. Mavzu: "${topic}" (Turkcha). O'quvchi: "${text}".\n${NATIVE_LANG} tilida (javob shu tilda bo'lsin): 1) ✅ Yaxshi 2) ❌ Xatolar 3) 🔄 Tuzatilgan 4) ⭐ /10`,700);
    if(fb)fb.innerHTML=r.replace(/\n/g,'<br>');
    lScore++;lTotal++;awardXP(20,'speaking');
};
window.markDone = function (idx) { lScore++;lTotal++;awardXP(10,'speaking');showToast('✅ Bajarildi!','success'); };
window.updWC = function () {
    const ta=$id('dta');if(!ta)return;
    const w=ta.value.trim()?ta.value.trim().split(/\s+/).length:0;
    const wc=$id('dwc');const cc=$id('dcc');const st=$id('dst');
    if(wc)wc.textContent=w+" so'z";
    if(cc)cc.textContent=ta.value.length+' belgi';
    if(st){st.textContent=w>=40?'✅ Yetarli':`Min 40 (${w}/40)`;st.style.color=w>=40?'#34d399':'#f87171';}
};
window.selfChk = function (min) {
    const ta=$id('dta');const fb=$id('wfb');if(!ta||!fb)return;
    const w=ta.value.trim()?ta.value.trim().split(/\s+/).length:0;
    if(w>=min){fb.innerHTML=`<span style="color:#34d399">✅ ${w} so'z!</span>`;lScore++;awardXP(15,'writing');}
    else{fb.innerHTML=`<span style="color:#f87171">⚠️ ${min-w} so'z kam!</span>`;}
    lTotal++;
};
window.aiWrit = async function (title, words) {
    const ok=await spendTokens(TOKEN_CONFIG.ai_cost,'AI writing');if(!ok)return;
    const ta=$id('dta');const fb=$id('wfb');
    if(!ta?.value.trim()){if(fb)fb.innerHTML='<span style="color:#f5c842">Avval yozing!</span>';return;}
    fb.innerHTML='🤖 Tekshirmoqda...';
    const r=await callAI(`Turkcha writing tekshirish. Mavzu: "${title}" (so'zlar: ${words}).\nMatn: "${ta.value.trim()}"\n${NATIVE_LANG} tilida (javob shu tilda bo'lsin): 1) Grammatika 2) Uslub 3) Tuzatilgan variant`,800);
    fb.innerHTML=r.replace(/\n/g,'<br>');awardXP(20,'writing');
};
window.finLessonD = async function (uid) { await finLesson(uid,'D','speaking',lScore,lTotal||3); };

// ─── FINISH LESSON ───
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
    const allDone = ['A','B','C','D'].every(l => UProg[`${unitId}_${l}`] >= 100);
    if (!CU) { UXP+=xpEarned; UCoin+=coinEarned; updateDisplays(); return; }
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
            showToast(`🎉 Unit to'liq! +50 XP +10 🪙 bonus!`, 'success');
        }
        await updateUserField(updates);
        UXP += xpEarned + (allDone ? 50 : 0);
        UCoin += coinEarned + (allDone ? 10 : 0);
        updateDisplays();
        showToast(`✅ +${xpEarned} XP +${coinEarned} 🪙 saqlandi!`, 'success');
    } catch (e) { console.error(e); }
}

function showResult(lk, pct, xp, coin, unit, uid) {
    const lnames = { A:'Grammatika', B:'Listening', C:'Reading', D:'Speaking' };
    const nxt = { A:'B', B:'C', C:'D', D:null };
    const content = $id('modalContent'); if (!content) return;
    const circleColor = pct>=80?'#34d399':pct>=60?'#f5c842':'#ef4444';
    content.innerHTML = `<div style="text-align:center;padding:20px">
      <div style="width:120px;height:120px;border-radius:50%;background:${circleColor}22;border:3px solid ${circleColor};display:flex;flex-direction:column;align-items:center;justify-content:center;margin:0 auto 20px">
        <div style="font-size:1.8rem;font-weight:800;color:${circleColor}">${pct}%</div>
        <div style="font-size:0.72rem;color:${circleColor}">${lnames[lk]}</div>
      </div>
      <div style="display:flex;gap:16px;justify-content:center;margin:16px 0">
        <div style="padding:12px 20px;border-radius:12px;background:rgba(240,153,68,0.1);border:1px solid rgba(240,153,68,0.2)"><div style="font-size:0.7rem;color:#666">XP</div><div style="font-weight:700;color:#f09944">+${xp}</div></div>
        <div style="padding:12px 20px;border-radius:12px;background:rgba(245,200,66,0.1);border:1px solid rgba(245,200,66,0.2)"><div style="font-size:0.7rem;color:#666">Coin</div><div style="font-weight:700;color:#f5c842">+${coin}</div></div>
      </div>
      <div style="font-size:1.2rem;margin-bottom:20px">${pct>=80?'🏆 Mukammal!':pct>=60?'✅ Yaxshi!':'💪 Qayta urining!'}</div>
      <div style="display:flex;flex-direction:column;gap:8px">
        ${nxt[lk]?`<button onclick="window.openLesson('${uid}','${nxt[lk]}')" style="padding:12px;border-radius:12px;background:linear-gradient(135deg,#e05a14,#f09944);border:none;color:#fff;font-size:0.9rem;font-weight:700;cursor:pointer;font-family:inherit">→ Keyingi: ${lnames[nxt[lk]]}</button>`:`<div style="padding:14px;border-radius:12px;background:rgba(52,211,153,0.1);border:1px solid rgba(52,211,153,0.25);color:#34d399;font-weight:700">🎉 Unit to'liq bajarildi!</div>`}
        <button onclick="document.getElementById('unitModal').classList.remove('active');renderUnits()" style="padding:12px;border-radius:12px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);color:#e8ecff;cursor:pointer;font-size:0.9rem;font-family:inherit">🏠 Unitlarga qaytish</button>
      </div>
    </div>`;
    showXPPop(`+${xp} XP`);
    $id('unitModal')?.classList.add('active');
}

// ══════════════════════════════════════════════════════════════
// WORDS
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
          <div style="font-weight:700;font-size:1.05rem;color:#e8ecff">${w.e}</div>
          <button onclick="window.spk('${w.e.replace(/'/g,"\\'")}',event)" style="background:none;border:none;cursor:pointer;font-size:1rem">🔊</button>
        </div>
        <div style="font-size:0.82rem;color:#f09944;margin-bottom:6px">${w.u}</div>
        <div style="display:flex;gap:6px;font-size:0.68rem">
          <span style="background:rgba(255,255,255,0.05);padding:2px 8px;border-radius:8px;color:#666">${w.t}</span>
          <span style="background:rgba(255,255,255,0.05);padding:2px 8px;border-radius:8px;color:#666">${w.l}</span>
        </div>`;
        card.onmouseover = () => { card.style.background='rgba(224,90,20,0.08)'; card.style.borderColor='rgba(224,90,20,0.25)'; };
        card.onmouseout  = () => { card.style.background='rgba(255,255,255,0.03)'; card.style.borderColor='rgba(255,255,255,0.08)'; };
        card.onclick = e => { if (e.target.closest('button')) return; openWModal(w); };
        grid.appendChild(card);
    });
    wOff = slice.length;
    const btn = $id('loadMoreBtn'); if (btn) btn.style.display = wOff >= filt.length ? 'none' : 'block';
}

window.filterWords   = function () { wSrch = ($id('wordSearch')?.value.toLowerCase()||''); renderWords(true); };
window.filterByLevel = function (level, el) { wFilt=level; document.querySelectorAll('.wf-tab').forEach(t=>t.classList.remove('active')); if(el)el.classList.add('active'); renderWords(true); };
window.loadMoreWords = function () { renderWords(false); };

function openWModal(w) {
    const m=$id('wordModal'); const c=$id('wordModalContent'); if(!m||!c) return;
    c.innerHTML=`<div style="text-align:center;padding:20px">
      <div style="font-size:2.5rem;font-weight:800;color:#e8ecff;margin-bottom:8px">${w.e}</div>
      <div style="font-size:1.1rem;color:#f09944;margin-bottom:12px">${w.u}</div>
      <div style="font-size:0.82rem;color:#666;margin:0 0 4px;font-style:italic">${w.t}</div>
      <div style="padding:12px;background:rgba(255,255,255,0.04);border-radius:10px;margin-bottom:16px;font-size:0.85rem;color:#fbd38d;font-style:italic">"${w.ex}"</div>
      <div style="color:#f09944;font-size:0.82rem;margin-bottom:16px">${w.eu}</div>
      <div style="display:flex;gap:8px;justify-content:center">
        <button onclick="window.spk('${w.e.replace(/'/g,"\\'")}',event)" style="padding:8px 20px;border-radius:10px;background:rgba(224,90,20,0.15);border:1px solid rgba(224,90,20,0.3);color:#f09944;cursor:pointer;font-family:inherit">🔊 Talaffuz</button>
        <button onclick="window.aiExWord('${w.e.replace(/'/g,"\\'")}',event)" style="padding:8px 20px;border-radius:10px;background:rgba(240,153,68,0.1);border:1px solid rgba(240,153,68,0.25);color:#f09944;cursor:pointer;font-family:inherit">🤖 AI (1 token)</button>
      </div>
      <div id="wordAIFB" style="margin-top:12px;font-size:0.82rem"></div>
    </div>`;
    m.classList.add('active');
}
window.closeWordModal = function (e) { if(!e||e.target===$id('wordModal')) $id('wordModal')?.classList.remove('active'); };

// ══════════════════════════════════════════════════════════════
// PRACTICE
// ══════════════════════════════════════════════════════════════
window.switchPractice = function (panel, el) {
    document.querySelectorAll('.practice-panel').forEach(p=>p.classList.remove('active'));
    document.querySelectorAll('.ptab').forEach(b=>b.classList.remove('active'));
    const p=$id('panel-'+panel); if(p) p.classList.add('active');
    if(el) el.classList.add('active');
};

function initFlashcards() { flashDeck=shuffle([...WDB]).slice(0,20); flashIdx=0; flashCorrect=0; flashWrong=0; showFlash(); }
function showFlash() {
    if (flashIdx>=flashDeck.length) {
        const fw=$id('flashWord'); const fu=$id('flashUz');
        if(fw)fw.textContent='🎉 Tugadi!';
        if(fu)fu.textContent=`To'g'ri: ${flashCorrect}, Noto'g'ri: ${flashWrong}`; return;
    }
    const w=flashDeck[flashIdx];
    const fc=$id('flashcard'); if(fc)fc.classList.remove('flipped');
    const fw=$id('flashWord'); if(fw)fw.textContent=w.e;
    const fu=$id('flashUz'); if(fu)fu.textContent=w.u;
    const fe=$id('flashEx'); if(fe)fe.textContent=w.ex||'';
    const fp=$id('flashProgress'); if(fp)fp.textContent=(flashIdx+1)+' / '+flashDeck.length;
    const fb=$id('flashBar'); if(fb)fb.style.width=Math.round((flashIdx/flashDeck.length)*100)+'%';
}
window.flipCard   = function () { const fc=$id('flashcard'); if(fc)fc.classList.toggle('flipped'); if(flashIdx<flashDeck.length)window.speakWord(flashDeck[flashIdx].e); };
window.flashResult= function (result) { if(result==='correct'){flashCorrect++;awardXP(5,'grammar');}else flashWrong++; flashIdx++; showFlash(); };
window.nextFlash  = function () { flashIdx++; showFlash(); };

function initQuiz() { quizScore=0; const el=$id('quizScore'); if(el)el.textContent=0; showQuizWord(); }
function showQuizWord() {
    quizAnswered=false;
    const pool=shuffle([...WDB]); curQuizWord=pool[0];
    const opts=shuffle([curQuizWord,...pool.slice(1,4)]);
    const type=Math.random()>0.5?'tr2uz':'uz2tr';
    const qEl=$id('quizQ'); if(qEl)qEl.textContent=type==='tr2uz'?`"${curQuizWord.e}" = ?`:`"${curQuizWord.u}" = ?`;
    const optsEl=$id('quizOptions');
    if(optsEl)optsEl.innerHTML=opts.map(o=>`<button class="quiz-opt" onclick="window.checkQuizOpt(this,'${o.e.replace(/'/g,"\\'")}','${type}')" style="width:100%;margin-bottom:8px;padding:12px;border-radius:10px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);color:#e8ecff;cursor:pointer;text-align:left;font-family:inherit;font-size:0.9rem;transition:all 0.2s">${type==='tr2uz'?o.u:o.e}</button>`).join('');
    const fb=$id('quizFeedback'); if(fb)fb.innerHTML='';
}
window.checkQuizOpt = function (btn, chosen, type) {
    if(quizAnswered) return; quizAnswered=true;
    document.querySelectorAll('.quiz-opt').forEach(b=>{
        const bVal=b.textContent.trim();
        if(type==='tr2uz'?bVal===curQuizWord.u:bVal===curQuizWord.e){b.style.background='rgba(52,211,153,0.2)';b.style.borderColor='#34d399';}
        else if(b===btn){b.style.background='rgba(239,68,68,0.2)';b.style.borderColor='#ef4444';}
    });
    const fb=$id('quizFeedback');
    if(chosen===curQuizWord.e){quizScore++;const el=$id('quizScore');if(el)el.textContent=quizScore;awardXP(10,'grammar');if(fb)fb.innerHTML='<span style="color:#34d399">✅ To\'g\'ri!</span>';}
    else{if(fb)fb.innerHTML=`<span style="color:#ef4444">❌ To'g'ri: ${type==='tr2uz'?curQuizWord.u:curQuizWord.e}</span>`;}
    window.speakWord(curQuizWord.e);
};
window.nextQuiz = function () { showQuizWord(); };

function initMatch() {
    const pool=shuffle([...WDB]).slice(0,5);
    matchPairs=pool; matchMatched=[]; matchSel1=null;
    const items=shuffle([...pool.map(w=>({id:w.e,text:w.e,type:'tr'})),...pool.map(w=>({id:w.e,text:w.u,type:'uz'}))]);
    const grid=$id('matchGrid');
    if(grid)grid.innerHTML=items.map(item=>`<div class="match-item" data-id="${item.id}" data-type="${item.type}" onclick="window.selectMatch2(this)" style="padding:12px;border-radius:10px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);color:#e8ecff;cursor:pointer;font-family:inherit;transition:all 0.2s;font-size:0.88rem">${item.text}</div>`).join('');
    const fb=$id('matchFeedback'); if(fb)fb.innerHTML='';
}
window.startMatch=initMatch;
window.selectMatch2 = function (el) {
    if(el.classList.contains('matched')) return;
    if(!matchSel1){matchSel1=el;el.style.background='rgba(224,90,20,0.2)';el.style.borderColor='#e05a14';}
    else {
        if(matchSel1===el){el.style.background='rgba(255,255,255,0.04)';el.style.borderColor='rgba(255,255,255,0.1)';matchSel1=null;return;}
        if(matchSel1.dataset.type===el.dataset.type){matchSel1.style.background='rgba(255,255,255,0.04)';matchSel1.style.borderColor='rgba(255,255,255,0.1)';matchSel1=el;el.style.background='rgba(224,90,20,0.2)';el.style.borderColor='#e05a14';return;}
        if(matchSel1.dataset.id===el.dataset.id){
            matchSel1.style.background='rgba(52,211,153,0.15)';matchSel1.style.borderColor='#34d399';matchSel1.classList.add('matched');
            el.style.background='rgba(52,211,153,0.15)';el.style.borderColor='#34d399';el.classList.add('matched');
            matchMatched.push(el.dataset.id);matchSel1=null;awardXP(15,'grammar');
            if(matchMatched.length===matchPairs.length){const fb=$id('matchFeedback');if(fb)fb.innerHTML='<span style="color:#34d399">🎉 Barcha juftliklar!</span>';}
        } else {
            const s=matchSel1;matchSel1=null;
            s.style.background='rgba(239,68,68,0.15)';s.style.borderColor='#ef4444';
            el.style.background='rgba(239,68,68,0.15)';el.style.borderColor='#ef4444';
            setTimeout(()=>{s.style.background='rgba(255,255,255,0.04)';s.style.borderColor='rgba(255,255,255,0.1)';el.style.background='rgba(255,255,255,0.04)';el.style.borderColor='rgba(255,255,255,0.1)';},800);
        }
    }
};

function initTyping() { typingDeck=shuffle([...WDB]); typingIdx=0; showTypingWord(); }
function showTypingWord() {
    const w=typingDeck[typingIdx%typingDeck.length];
    const tw=$id('typingWord'); if(tw)tw.textContent=w.e;
    const th=$id('typingHint'); if(th)th.textContent="O'zbek: "+w.u;
    const ti=$id('typingInput'); if(ti){ti.value='';ti.style.borderColor='';}
    const tf=$id('typingFeedback'); if(tf)tf.innerHTML='';
}
window.checkTyping = function () {
    const w=typingDeck[typingIdx%typingDeck.length];
    const val=$id('typingInput')?.value.trim().toLowerCase()||'';
    const fb=$id('typingFeedback'); const inp=$id('typingInput');
    if(val===w.e.toLowerCase()){
        if(fb)fb.innerHTML='<span style="color:#34d399">✅ To\'g\'ri!</span>';
        if(inp)inp.style.borderColor='#34d399';
        awardXP(8,'grammar'); setTimeout(()=>{typingIdx++;showTypingWord();},800);
    } else if(val.length>=w.e.length){
        if(fb)fb.innerHTML=`<span style="color:#ef4444">❌ To'g'ri: ${w.e}</span>`;
        if(inp)inp.style.borderColor='#ef4444';
    }
};
window.nextTyping = function () { typingIdx++; showTypingWord(); };

function initGrammar() { curGrammarIdx=0; showGrammarQ(); }
function showGrammarQ() {
    grammarAnswered=false;
    const q=GRAMMAR_QS[curGrammarIdx%GRAMMAR_QS.length];
    const qBox=$id('grammarQBox'); if(qBox)qBox.textContent=q.q;
    const optsEl=$id('grammarOptions');
    if(optsEl)optsEl.innerHTML=q.opts.map(o=>`<button onclick="window.checkGrammar('${o.replace(/'/g,"\\'")}','${q.ans.replace(/'/g,"\\'")}','${q.exp.replace(/'/g,"\\'")}')" style="margin:4px;padding:10px 18px;border-radius:10px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);color:#e8ecff;cursor:pointer;font-family:inherit;transition:all 0.2s">${o}</button>`).join('');
    const fb=$id('grammarFeedback'); if(fb)fb.innerHTML='';
}
window.checkGrammar = function (chosen, ans, exp) {
    if(grammarAnswered) return; grammarAnswered=true;
    const fb=$id('grammarFeedback');
    document.querySelectorAll('#grammarOptions button').forEach(b=>{
        if(b.textContent===ans){b.style.background='rgba(52,211,153,0.2)';b.style.borderColor='#34d399';}
        else if(b.textContent===chosen&&chosen!==ans){b.style.background='rgba(239,68,68,0.2)';b.style.borderColor='#ef4444';}
    });
    if(chosen===ans){
        if(fb)fb.innerHTML=`<div style="color:#34d399;padding:10px;border-radius:10px;background:rgba(52,211,153,0.1)">✅ To'g'ri! ${exp}</div>`;
        grammarScore2++;const el=$id('grammarScore');if(el)el.textContent=grammarScore2;awardXP(12,'grammar');
    } else {
        if(fb)fb.innerHTML=`<div style="color:#ef4444;padding:10px;border-radius:10px;background:rgba(239,68,68,0.1)">❌ Noto'g'ri. To'g'ri: <b>${ans}</b>. ${exp}</div>`;
    }
};
window.nextGrammarEx = function () { curGrammarIdx++; showGrammarQ(); };

// ══════════════════════════════════════════════════════════════
// AI CHAT
// ══════════════════════════════════════════════════════════════
const CHAT_MODES = {
    free:      { label:'Erkin suhbat',   sys:'You are a friendly Turkish language learning assistant for Uzbek speakers. Chat in Turkish and Uzbek, helping practice Turkish. Keep responses concise (2-4 sentences).' },
    teacher:   { label:'O\'qituvchi',    sys:'You are a Turkish teacher for Uzbek-speaking students. Explain Turkish grammar clearly in Uzbek or Turkish, give examples, and encourage the student.' },
    grammar:   { label:'Grammatika',     sys:'You are a Turkish grammar checker for Uzbek learners. Identify grammar errors, explain in Uzbek, show the corrected version and the rule. Format: ❌ Xato → ✅ To\'g\'ri: ... 📚 Qoida: ...' },
    translate: { label:'Tarjimon',       sys:'You are a Turkish-Uzbek translator. Translate accurately. Also explain idioms. Show both versions clearly.' },
    ielts:     { label:'TÖMER/YÖKDİL',  sys:'You are a Turkish language proficiency coach. Help with reading, writing, listening, and speaking. Provide feedback and explain scoring criteria.' }
};
let curChatMode = CHAT_MODES.free;

window.setChatMode = function (mode, el) {
    document.querySelectorAll('.chat-mode-btn').forEach(b=>b.classList.remove('active'));
    if(el) el.classList.add('active');
    chatMode=mode; curChatMode=CHAT_MODES[mode]||CHAT_MODES.free;
    appendChat('assistant',`Rejim: <b>${curChatMode.label}</b>. ${mode==='free'?'Erkin suhbatlashaylik!':mode==='teacher'?"Nima o'rganmoqchisiz?":mode==='grammar'?'Matn yuboring — grammatikani tekshiraman!':mode==='translate'?'Nima tarjima qilaylik?':'TÖMER savolingizni yuboring!'}`,false);
};
window.insertQuickPhrase = function (p) { const inp=$id('chatInput'); if(inp){inp.value=p;inp.focus();} };
window.handleChatKey = function (e) { if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();window.sendChatMessage();} };

window.sendChatMessage = async function () {
    const inp=$id('chatInput'); if(!inp) return;
    const text=inp.value.trim(); if(!text) return;
    if(UTokens<=0&&UP!=='ultimate'){showTokenEmptyModal('AI chat uchun token kerak');return;}
    inp.value='';
    appendChat('user',text,true);
    chatHist.push({role:'user',parts:[{text}]});
    const typingId='typing_'+Date.now();
    appendChat('assistant','<span class="typing">Yozmoqda...</span>',false,typingId);
    const sendBtn=$id('chatSendBtn'); if(sendBtn)sendBtn.disabled=true;
    try {
        const resp=await fetch(AI_PROXY,{method:'POST',headers:{'Content-Type':'application/json'},
            body:JSON.stringify({contents:[{role:'user',parts:[{text:curChatMode.sys+LANG_RULES}]},...chatHist.slice(-10)],generationConfig:{temperature:0.8,maxOutputTokens:1000}})});
        const tb=$id(typingId); if(tb)tb.remove();
        if(!resp.ok){appendChat('assistant',`❗ AI xatolik: ${resp.status}`,false);return;}
        const d=await resp.json();
        const reply=d.candidates?.[0]?.content?.parts?.[0]?.text||'Uzr, javob berishda xatolik.';
        appendChat('assistant',reply,true);
        chatHist.push({role:'model',parts:[{text:reply}]});
        if(UTokens>0&&UP!=='ultimate'){UTokens--;await saveTokenState();renderTokenBar();}
        awardXP(5,'speaking');
    } catch(e) {
        const tb=$id(typingId); if(tb)tb.remove();
        appendChat('assistant',`❗ Xatolik: ${e.message||'tarmoq muammosi'}`,false);
    } finally { if(sendBtn)sendBtn.disabled=false; }
};

function appendChat(role, html, save=false, id=null) {
    const c=$id('chatMessages'); if(!c) return;
    const isAI=role==='assistant';
    const div=document.createElement('div');
    div.className=`chat-msg ${isAI?'ai-msg':'user-msg'}`;
    if(id) div.id=id;
    div.innerHTML=`<div class="chat-avatar">${isAI?'<i class="fa-solid fa-robot"></i>':'<i class="fa-solid fa-user"></i>'}</div><div class="chat-bubble">${html}</div>`;
    c.appendChild(div); c.scrollTop=c.scrollHeight;
}

window.clearChatHistory = async function () {
    if(!confirm('Chat tarixini tozalashni istaysizmi?')) return;
    chatHist=[];
    const c=$id('chatMessages');
    if(c) c.innerHTML=`<div class="chat-msg ai-msg"><div class="chat-avatar"><i class="fa-solid fa-robot"></i></div><div class="chat-bubble">Merhaba! Chat tarixi temizlendi. Yeni konuşmaya başlayalım! 😊</div></div>`;
    showToast('Chat tarixi tozalandi','success');
};

// ══════════════════════════════════════════════════════════════
// VIDEO
// ══════════════════════════════════════════════════════════════
window.findYoutubeVideos = function () {
    const grid=$id('videosGrid'); if(!grid) return;
    const videos=[
        {title:'Türkçe A1 - Tam Ders',        channel:'TürkçeKurs', id:'dQw4w9WgXcQ'},
        {title:'Türkçe Öğrenin - 100 Kelime', channel:'TurkishClass101', id:'eVTXPUF4Oz4'},
        {title:'Türkçe Gramer Dersleri',       channel:'TürkçeGramer',   id:'3JZ_D3ELwOQ'},
        {title:'Günlük Türkçe Konuşma',        channel:'DailyTurkish',   id:'2Vv-BfVoq4g'},
    ];
    grid.innerHTML=videos.map(v=>`<div style="border-radius:14px;overflow:hidden;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08)">
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
// MODALS
// ══════════════════════════════════════════════════════════════
window.closeModal    = function () { $id('unitModal')?.classList.remove('active'); };
window.closeUnitModal= function (e) { if(e.target===$id('unitModal')) window.closeModal(); };

// ══════════════════════════════════════════════════════════════
// AUTH & INIT
// ══════════════════════════════════════════════════════════════
onAuthStateChanged(_auth, async (user) => {
    if (!user) { window.location.href='../auth/login.html'; return; }
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
    setTimeout(()=>window.loadLBSection('xp',$id('lb-xp-btn')),800);
});