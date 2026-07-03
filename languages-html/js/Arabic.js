// =====================================================
// Arabic.js — LinguaVerse (FULL Arabic Course)
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
    free: { name: "Free", icon: "🆓", price_uzs: 0, token_bonus: 1000, token_reset_mult: 1, ai_quality: "standard", xp_mult: 1, coin_mult: 1 },
    pro: { name: "Pro", icon: "⭐", price_uzs: 29000, token_bonus: 3000, token_reset_mult: 2, ai_quality: "enhanced", xp_mult: 1.5, coin_mult: 1.3 },
    premium: { name: "Premium", icon: "💎", price_uzs: 59000, token_bonus: 8000, token_reset_mult: 3, ai_quality: "advanced", xp_mult: 2, coin_mult: 1.8 },
    ultimate: { name: "Ultimate", icon: "🚀", price_uzs: 99000, token_bonus: 999999, token_reset_mult: 999, ai_quality: "ultimate", xp_mult: 3, coin_mult: 2.5 }
};

const RANKS = {
    none: { name: "Oddiy", icon: "⬜", color: "#888", token_bonus: 0, xp_mult: 1, coin_mult: 1 },
    silver: { name: "Silver", icon: "🥈", color: "#C0C0C0", token_bonus: 200, xp_mult: 1.3, coin_mult: 1.2 },
    gold: { name: "Gold", icon: "🥇", color: "#FFD700", token_bonus: 500, xp_mult: 1.8, coin_mult: 1.5 },
    diamond: { name: "Diamond", icon: "💎", color: "#B9F2FF", token_bonus: 1000, xp_mult: 2.5, coin_mult: 2 }
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
// ARABIC WORDS DATABASE (500+ so'z)
// ══════════════════════════════════════════════════════════════
const WDB = [
    // ═══ BEGINNER ═══
    { a: 'مرحباً', u: 'Salom', t: 'gap', l: 'beginner', ex: 'مرحباً، كيف حالك؟', eu: "Salom, qandaysiz?" },
    { a: 'وداعاً', u: 'Xayr', t: 'gap', l: 'beginner', ex: 'وداعاً، إلى اللقاء!', eu: "Xayr, ko'rishguncha!" },
    { a: 'شكراً', u: 'Rahmat', t: 'gap', l: 'beginner', ex: 'شكراً جزيلاً.', eu: "Katta rahmat." },
    { a: 'من فضلك', u: 'Iltimos', t: 'gap', l: 'beginner', ex: 'ساعدني من فضلك.', eu: "Iltimos, menga yordam ber." },
    { a: 'عفواً', u: 'Kechirasiz', t: 'gap', l: 'beginner', ex: 'عفواً، أنا متأخر.', eu: "Kechirasiz, kech qoldim." },
    { a: 'نعم', u: 'Ha', t: 'gap', l: 'beginner', ex: 'نعم، أنا أوافق.', eu: "Ha, men roziman." },
    { a: 'لا', u: "Yo'q", t: 'gap', l: 'beginner', ex: 'لا، لا أريد ذلك.', eu: "Yo'q, men buni xohlamayman." },
    { a: 'جيد', u: 'Yaxshi', t: 'sifat', l: 'beginner', ex: 'الجو جيد اليوم.', eu: "Bugun havo yaxshi." },
    { a: 'سيئ', u: 'Yomon', t: 'sifat', l: 'beginner', ex: 'هذا أمر سيئ.', eu: "Bu yomon holat." },
    { a: 'كبير', u: 'Katta', t: 'sifat', l: 'beginner', ex: 'هذا بيت كبير.', eu: "Bu katta uy." },
    { a: 'صغير', u: 'Kichik', t: 'sifat', l: 'beginner', ex: 'لدي قطة صغيرة.', eu: "Menda kichik mushuk bor." },
    { a: 'سعيد', u: 'Xursand', t: 'sifat', l: 'beginner', ex: 'أنا سعيد جداً اليوم.', eu: "Bugun juda xursandman." },
    { a: 'حزين', u: "Qayg'li", t: 'sifat', l: 'beginner', ex: 'هو يبدو حزيناً.', eu: "U qayg'li ko'rinadi." },
    { a: 'حار', u: 'Issiq', t: 'sifat', l: 'beginner', ex: 'الطقس حار جداً.', eu: "Havo juda issiq." },
    { a: 'بارد', u: 'Sovuq', t: 'sifat', l: 'beginner', ex: 'الماء بارد.', eu: "Suv sovuq." },
    { a: 'أحمر', u: 'Qizil', t: 'sifat', l: 'beginner', ex: 'التفاحة حمراء.', eu: "Olma qizil." },
    { a: 'أزرق', u: "Ko'k", t: 'sifat', l: 'beginner', ex: 'السماء زرقاء.', eu: "Osmon ko'k." },
    { a: 'أخضر', u: 'Yashil', t: 'sifat', l: 'beginner', ex: 'العشب أخضر.', eu: "O't yashil." },
    { a: 'أصفر', u: 'Sariq', t: 'sifat', l: 'beginner', ex: 'الشمس صفراء.', eu: "Quyosh sariq." },
    { a: 'أسود', u: 'Qora', t: 'sifat', l: 'beginner', ex: 'قطتي سوداء.', eu: "Mening mushugim qora." },
    { a: 'أبيض', u: 'Oq', t: 'sifat', l: 'beginner', ex: 'الثلج أبيض.', eu: "Qor oq." },
    { a: 'واحد', u: 'Bir', t: 'son', l: 'beginner', ex: 'لدي أخت واحدة.', eu: "Menda bir singil bor." },
    { a: 'اثنان', u: 'Ikki', t: 'son', l: 'beginner', ex: 'لدي قطتان.', eu: "Menda ikki mushuk bor." },
    { a: 'ثلاثة', u: 'Uch', t: 'son', l: 'beginner', ex: 'عندها ثلاثة كتب.', eu: "Uning uch kitobi bor." },
    { a: 'أربعة', u: "To'rt", t: 'son', l: 'beginner', ex: 'هناك أربعة فصول.', eu: "To'rtta fasl bor." },
    { a: 'خمسة', u: 'Besh', t: 'son', l: 'beginner', ex: 'لدي خمسة أصابع.', eu: "Menda besh barmoq bor." },
    { a: 'ستة', u: 'Olti', t: 'son', l: 'beginner', ex: 'الساعة السادسة.', eu: "Soat olti." },
    { a: 'سبعة', u: 'Yetti', t: 'son', l: 'beginner', ex: 'الأسبوع سبعة أيام.', eu: "Haftada yetti kun bor." },
    { a: 'ثمانية', u: 'Sakkiz', t: 'son', l: 'beginner', ex: 'لدي ثمانية أقلام.', eu: "Menda sakkiz qalam bor." },
    { a: 'تسعة', u: 'To\'qqiz', t: 'son', l: 'beginner', ex: 'الدرس في التاسعة.', eu: "Dars to'qqizda." },
    { a: 'عشرة', u: "O'n", t: 'son', l: 'beginner', ex: 'لدي عشرة دقائق.', eu: "O'n daqiqam bor." },
    { a: 'أم', u: 'Ona', t: 'ot', l: 'beginner', ex: 'أمي معلمة.', eu: "Onam o'qituvchi." },
    { a: 'أب', u: 'Ota', t: 'ot', l: 'beginner', ex: 'أبي يعمل بجد.', eu: "Otam qattiq ishlaydi." },
    { a: 'أخت', u: 'Singil/Opa', t: 'ot', l: 'beginner', ex: 'أختي عمرها عشر سنوات.', eu: "Singlim 10 yoshda." },
    { a: 'أخ', u: 'Aka/Uka', t: 'ot', l: 'beginner', ex: 'أخي يحب كرة القدم.', eu: "Akam futbolni yaxshi ko'radi." },
    { a: 'ماء', u: 'Suv', t: 'ot', l: 'beginner', ex: 'أعطني ماء من فضلك.', eu: "Iltimos, menga suv bering." },
    { a: 'طعام', u: 'Ovqat', t: 'ot', l: 'beginner', ex: 'الطعام لذيذ.', eu: "Ovqat mazali." },
    { a: 'تفاحة', u: 'Olma', t: 'ot', l: 'beginner', ex: 'آكل تفاحة كل يوم.', eu: "Men har kuni olma yeyman." },
    { a: 'خبز', u: 'Non', t: 'ot', l: 'beginner', ex: 'تخبز خبزاً طازجاً.', eu: "U yangi non yopadi." },
    { a: 'مدرسة', u: 'Maktab', t: 'ot', l: 'beginner', ex: 'أذهب إلى المدرسة كل يوم.', eu: "Men har kuni maktabga boraman." },
    { a: 'كتاب', u: 'Kitob', t: 'ot', l: 'beginner', ex: 'هذا كتاب مثير للاهتمام.', eu: "Bu qiziqarli kitob." },
    { a: 'كلب', u: 'It', t: 'ot', l: 'beginner', ex: 'لدي كلب ودود.', eu: "Menda mehribon it bor." },
    { a: 'قطة', u: 'Mushuk', t: 'ot', l: 'beginner', ex: 'القطة نائمة.', eu: "Mushuk uxlayapti." },
    { a: 'بيت', u: 'Uy', t: 'ot', l: 'beginner', ex: 'أسكن في بيت كبير.', eu: "Men katta uyda yashayman." },
    { a: 'سيارة', u: 'Avtomobil', t: 'ot', l: 'beginner', ex: 'لأبي سيارة حمراء.', eu: "Otamning qizil mashinasi bor." },
    { a: 'صديق', u: "Do'st", t: 'ot', l: 'beginner', ex: 'هو أفضل صديق لي.', eu: "U mening eng yaxshi do'stim." },
    { a: 'معلم', u: "O'qituvchi", t: 'ot', l: 'beginner', ex: 'معلمي طيب.', eu: "Mening o'qituvchim mehribon." },
    { a: 'طالب', u: "O'quvchi", t: 'ot', l: 'beginner', ex: 'هي طالبة جيدة.', eu: "U yaxshi o'quvchi." },
    { a: 'شمس', u: 'Quyosh', t: 'ot', l: 'beginner', ex: 'الشمس مشرقة.', eu: "Quyosh chiqyapti." },
    { a: 'قمر', u: 'Oy', t: 'ot', l: 'beginner', ex: 'القمر مضيء الليلة.', eu: "Bu kecha oy yorqin." },
    { a: 'زهرة', u: 'Gul', t: 'ot', l: 'beginner', ex: 'عندها زهور جميلة.', eu: "Uning chiroyli gullari bor." },
    { a: 'شجرة', u: 'Daraxt', t: 'ot', l: 'beginner', ex: 'الشجرة طويلة جداً.', eu: "Daraxt juda baland." },
    { a: 'طير', u: 'Qush', t: 'ot', l: 'beginner', ex: 'الطير يغرد.', eu: "Qush sayrAyapti." },
    { a: 'سمك', u: 'Baliq', t: 'ot', l: 'beginner', ex: 'أحب أكل السمك.', eu: "Men baliq yeyishni yaxshi ko'raman." },
    { a: 'يوم', u: 'Kun', t: 'ot', l: 'beginner', ex: 'يوم رائع!', eu: "Ajoyib kun!" },
    { a: 'ليل', u: 'Kecha', t: 'ot', l: 'beginner', ex: 'تصبح على خير.', eu: "Yaxshi kechalar." },
    { a: 'صباح', u: 'Ertalab', t: 'ot', l: 'beginner', ex: 'أستيقظ كل صباح.', eu: "Men har ertalab uyg'onaman." },
    { a: 'مساء', u: 'Kechqurun', t: 'ot', l: 'beginner', ex: 'نتمشى في المساء.', eu: "Kechqurun sayrga chiqamiz." },
    { a: 'وقت', u: 'Vaqt', t: 'ot', l: 'beginner', ex: 'كم الساعة الآن؟', eu: "Soat necha bo'ldi?" },
    { a: 'اسم', u: 'Ism', t: 'ot', l: 'beginner', ex: 'اسمي أحمد.', eu: "Mening ismim Ahmad." },
    { a: 'مدينة', u: 'Shahar', t: 'ot', l: 'beginner', ex: 'طشقند مدينة كبيرة.', eu: "Toshkent katta shahar." },
    { a: 'بلد', u: 'Mamlakat', t: 'ot', l: 'beginner', ex: 'أوزبكستان بلدي.', eu: "O'zbekiston mening mamlakatim." },
    { a: 'جديد', u: 'Yangi', t: 'sifat', l: 'beginner', ex: 'لدي هاتف جديد.', eu: "Mening yangi telefonim bor." },
    { a: 'قديم', u: 'Eski/Qari', t: 'sifat', l: 'beginner', ex: 'هذا مبنى قديم.', eu: "Bu eski bino." },
    { a: 'طويل', u: 'Baland/Uzun', t: 'sifat', l: 'beginner', ex: 'هو طويل جداً.', eu: "U juda baland bo'yli." },
    { a: 'قصير', u: 'Past/Qisqa', t: 'sifat', l: 'beginner', ex: 'الفتاة القصيرة ذكية.', eu: "Past bo'yli qiz aqlli." },
    { a: 'سريع', u: 'Tez', t: 'sifat', l: 'beginner', ex: 'السيارة سريعة جداً.', eu: "Mashina juda tez." },
    { a: 'بطيء', u: 'Sekin', t: 'sifat', l: 'beginner', ex: 'السلحفاة تتحرك ببطء.', eu: "Toshbaqa sekin yuradi." },
    { a: 'يحب', u: 'Sevmoq', t: 'fe\'l', l: 'beginner', ex: 'أحب عائلتي.', eu: "Men oilamni sevaman." },
    { a: 'يريد', u: 'Xohlamoq', t: 'fe\'l', l: 'beginner', ex: 'أريد الذهاب إلى البيت.', eu: "Men uyga ketmoqchiman." },
    { a: 'يعرف', u: 'Bilmoq', t: 'fe\'l', l: 'beginner', ex: 'هل تعرفها؟', eu: "Uni bilasizmi?" },
    { a: 'يأكل', u: 'Yemoq', t: 'fe\'l', l: 'beginner', ex: 'نأكل العشاء الساعة السابعة.', eu: "Biz soat 7 da kechki ovqat yeymiz." },
    { a: 'يشرب', u: 'Ichmoq', t: 'fe\'l', l: 'beginner', ex: 'يشرب القهوة.', eu: "U qahva ichadi." },
    { a: 'ينام', u: 'Uxlamoq', t: 'fe\'l', l: 'beginner', ex: 'الأطفال ينامون مبكراً.', eu: "Bolalar erta uxlashadi." },
    { a: 'يقرأ', u: "O'qimoq", t: 'fe\'l', l: 'beginner', ex: 'أحب قراءة الكتب.', eu: "Kitob o'qishni yaxshi ko'raman." },
    { a: 'يكتب', u: 'Yozmoq', t: 'fe\'l', l: 'beginner', ex: 'اكتب اسمك من فضلك.', eu: "Iltimos, ismingizni yozing." },
    { a: 'يمشي', u: 'Yurmoq', t: 'fe\'l', l: 'beginner', ex: 'أمشي إلى المدرسة.', eu: "Men maktabga yayov boraman." },
    { a: 'يتكلم', u: 'Gapirmoq', t: 'fe\'l', l: 'beginner', ex: 'تتكلم العربية بطلاقة.', eu: "U arabchani ravon gapiradi." },
    { a: 'يستمع', u: 'Eshitmoq', t: 'fe\'l', l: 'beginner', ex: 'استمع بانتباه.', eu: "Diqqat bilan eshiting." },
    { a: 'يلعب', u: "O'ynamoq", t: 'fe\'l', l: 'beginner', ex: 'يحب الأطفال اللعب.', eu: "Bolalar o'ynashni yaxshi ko'rishadi." },
    { a: 'يركض', u: 'Yugurmaq', t: 'fe\'l', l: 'beginner', ex: 'تركض كل صباح.', eu: "U har ertalab yuguradi." },
    { a: 'يذهب', u: 'Bormoq', t: 'fe\'l', l: 'beginner', ex: 'لنذهب إلى الحديقة.', eu: "Keling, parkka boramiz." },
    { a: 'يأتي', u: 'Kelmoq', t: 'fe\'l', l: 'beginner', ex: 'تعال إلى هنا من فضلك.', eu: "Iltimos, bu yerga keling." },
    { a: 'يعطي', u: 'Bermoq', t: 'fe\'l', l: 'beginner', ex: 'أعطني ذلك الكتاب.', eu: "Menga o'sha kitobni bering." },
    { a: 'يأخذ', u: 'Olmoq', t: 'fe\'l', l: 'beginner', ex: 'خذ هذه المظلة.', eu: "Bu soyabonni oling." },
    { a: 'يساعد', u: 'Yordam bermoq', t: 'fe\'l', l: 'beginner', ex: 'هل يمكنك مساعدتي؟', eu: "Menga yordam bera olasizmi?" },
    { a: 'يعمل', u: 'Ishlash', t: 'fe\'l', l: 'beginner', ex: 'أعمل كل يوم.', eu: "Men har kuni ishlayman." },
    { a: 'يدرس', u: "O'rganmoq", t: 'fe\'l', l: 'beginner', ex: 'أدرس العربية كل يوم.', eu: "Men har kuni arabcha o'rganaman." },
    { a: 'يفكر', u: "O'ylamoq", t: 'fe\'l', l: 'beginner', ex: 'أعتقد أنك على حق.', eu: "Menimcha siz to'g'risiz." },
    { a: 'حليب', u: 'Sut', t: 'ot', l: 'beginner', ex: 'الأطفال يشربون الحليب.', eu: "Bolalar sut ichadi." },
    { a: 'بيضة', u: 'Tuxum', t: 'ot', l: 'beginner', ex: 'آكل بيضتين في الفطور.', eu: "Nonushta uchun ikki tuxum yeyman." },
    { a: 'أرز', u: 'Guruch', t: 'ot', l: 'beginner', ex: 'الأرز طعامنا الرئيسي.', eu: "Guruch asosiy ovqatimiz." },
    { a: 'لحم', u: "Go'sht", t: 'ot', l: 'beginner', ex: 'هذا اللحم لذيذ.', eu: "Bu go'sht juda mazali." },
    { a: 'شاي', u: 'Choy', t: 'ot', l: 'beginner', ex: 'هيا نشرب الشاي.', eu: "Keling, choy ichamiz." },
    { a: 'قهوة', u: 'Qahva', t: 'ot', l: 'beginner', ex: 'أشرب قهوة كل صباح.', eu: "Men har ertalab qahva ichaman." },
    { a: 'برتقال', u: 'Apelsin', t: 'ot', l: 'beginner', ex: 'البرتقال حلو.', eu: "Apelsinlar shirin." },
    { a: 'موز', u: 'Banan', t: 'ot', l: 'beginner', ex: 'آكل موزة كل يوم.', eu: "Men har kuni banan yeyman." },
    { a: 'طاولة', u: 'Stol', t: 'ot', l: 'beginner', ex: 'الكتاب على الطاولة.', eu: "Kitob stolda." },
    { a: 'كرسي', u: 'Stul', t: 'ot', l: 'beginner', ex: 'اجلس على الكرسي.', eu: "Stulga o'tiring." },
    { a: 'قلم', u: 'Qalam/Ruchka', t: 'ot', l: 'beginner', ex: 'هل يمكنني استعارة قلمك؟', eu: "Qalamingizni olsam bo'ladimi?" },
    { a: 'حقيبة', u: 'Sumka', t: 'ot', l: 'beginner', ex: 'حقيبتي ثقيلة.', eu: "Sumkam og'ir." },
    { a: 'هاتف', u: 'Telefon', t: 'ot', l: 'beginner', ex: 'هاتفي جديد.', eu: "Telefonim yangi." },
    { a: 'نافذة', u: 'Deraza', t: 'ot', l: 'beginner', ex: 'افتح النافذة من فضلك.', eu: "Iltimos, derazani oching." },
    { a: 'باب', u: 'Eshik', t: 'ot', l: 'beginner', ex: 'أغلق الباب.', eu: "Eshikni yoping." },
    { a: 'طريق', u: "Yo'l", t: 'ot', l: 'beginner', ex: 'الطريق طويل.', eu: "Yo'l uzun." },
    { a: 'حديقة', u: 'Park/Bog\'', t: 'ot', l: 'beginner', ex: 'الأطفال يلعبون في الحديقة.', eu: "Bolalar parkda o'ynaydi." },
    { a: 'دكان', u: "Do'kon", t: 'ot', l: 'beginner', ex: 'هيا نذهب إلى الدكان.', eu: "Keling, do'konga boramiz." },
    { a: 'مال', u: 'Pul', t: 'ot', l: 'beginner', ex: 'هل معك مال؟', eu: "Pulingiz bormi?" },

    // ═══ ELEMENTARY ═══
    { a: 'غرفة نوم', u: 'Yotoqxona', t: 'ot', l: 'elementary', ex: 'غرفة نومي مريحة.', eu: "Yotoqxonam qulay." },
    { a: 'مطبخ', u: 'Oshxona', t: 'ot', l: 'elementary', ex: 'تطبخ في المطبخ.', eu: "U oshxonada ovqat pishiradi." },
    { a: 'حمام', u: 'Hammom', t: 'ot', l: 'elementary', ex: 'الحمام نظيف.', eu: "Hammom toza." },
    { a: 'طبيب', u: 'Shifokor', t: 'ot', l: 'elementary', ex: 'الطبيب فحص المريض.', eu: "Shifokor bemorni tekshirdi." },
    { a: 'مهندس', u: 'Muhandis', t: 'ot', l: 'elementary', ex: 'هو مهندس برمجيات.', eu: "U dasturiy ta'minot muhandisi." },
    { a: 'غالي', u: 'Qimmat', t: 'sifat', l: 'elementary', ex: 'هذا الهاتف غالي جداً.', eu: "Bu telefon juda qimmat." },
    { a: 'رخيص', u: 'Arzon', t: 'sifat', l: 'elementary', ex: 'هذه الأحذية رخيصة.', eu: "Bu poyabzallar arzon." },
    { a: 'جميل', u: "Go'zal", t: 'sifat', l: 'elementary', ex: 'يا له من يوم جميل!', eu: "Qanday go'zal kun!" },
    { a: 'مثير للاهتمام', u: 'Qiziqarli', t: 'sifat', l: 'elementary', ex: 'هذه قصة مثيرة للاهتمام.', eu: "Bu qiziqarli hikoya." },
    { a: 'صعب', u: 'Qiyin', t: 'sifat', l: 'elementary', ex: 'هذا الامتحان صعب جداً.', eu: "Bu imtihon juda qiyin." },
    { a: 'سهل', u: 'Oson', t: 'sifat', l: 'elementary', ex: 'هذا التمرين سهل.', eu: "Bu mashq oson." },
    { a: 'سفر', u: 'Sayohat', t: 'ot', l: 'elementary', ex: 'أحب السفر إلى الخارج.', eu: "Xorijga sayohat qilishni yaxshi ko'raman." },
    { a: 'موسيقى', u: 'Musiqa', t: 'ot', l: 'elementary', ex: 'أستمع إلى الموسيقى كل يوم.', eu: "Men har kuni musiqa eshitaman." },
    { a: 'طقس', u: 'Ob-havo', t: 'ot', l: 'elementary', ex: 'الطقس جميل اليوم.', eu: "Bugun ob-havo yaxshi." },
    { a: 'حاسوب', u: 'Kompyuter', t: 'ot', l: 'elementary', ex: 'أستخدم حاسوبي للعمل.', eu: "Men kompyuterni ish uchun ishlataman." },
    { a: 'مستشفى', u: 'Kasalxona', t: 'ot', l: 'elementary', ex: 'نقلوه إلى المستشفى.', eu: "Uni kasalxonaga olib ketishdi." },
    { a: 'مطعم', u: 'Restoran', t: 'ot', l: 'elementary', ex: 'نأكل في مطعم.', eu: "Biz restoranda ovqatlanamiz." },
    { a: 'مطار', u: 'Aeroport', t: 'ot', l: 'elementary', ex: 'المطار مزدحم جداً.', eu: "Aeroport juda gavjum." },
    { a: 'تذكرة', u: 'Chipta', t: 'ot', l: 'elementary', ex: 'اشتريت تذكرة قطار.', eu: "Men poyezd chiptasi sotib oldim." },
    { a: 'فندق', u: 'Mehmonxona', t: 'ot', l: 'elementary', ex: 'بقينا في فندق جميل.', eu: "Biz chiroyli mehmonxonada qoldik." },
    { a: 'قائمة طعام', u: 'Menyu', t: 'ot', l: 'elementary', ex: 'هل يمكنني رؤية القائمة؟', eu: "Menyuni ko'rsam bo'ladimi?" },
    { a: 'خصم', u: 'Chegirma', t: 'ot', l: 'elementary', ex: 'هناك خصم 20% اليوم.', eu: "Bugun 20% chegirma bor." },
    { a: 'موعد', u: 'Uchrashuv vaqti', t: 'ot', l: 'elementary', ex: 'لدي موعد مع الطبيب.', eu: "Shifokor bilan uchrashuv vaqtim bor." },
    { a: 'مكتبة', u: 'Kutubxona', t: 'ot', l: 'elementary', ex: 'أذهب إلى المكتبة كثيراً.', eu: "Men tez-tez kutubxonaga boraman." },
    { a: 'درس', u: 'Dars', t: 'ot', l: 'elementary', ex: 'يبدأ الدرس في التاسعة.', eu: "Dars soat 9 da boshlanadi." },
    { a: 'واجب', u: 'Uy vazifasi', t: 'ot', l: 'elementary', ex: 'أنجز واجبي كل مساء.', eu: "Men har kechqurun uy vazifamni bajaraman." },
    { a: 'صف', u: 'Sinf', t: 'ot', l: 'elementary', ex: 'صفنا فيه 25 طالباً.', eu: "Bizning sinfda 25 o'quvchi bor." },
    { a: 'امتحان', u: 'Imtihon', t: 'ot', l: 'elementary', ex: 'لدي امتحان غداً.', eu: "Ertaga imtihonÄ±m bor." },
    { a: 'علامة', u: 'Baho', t: 'ot', l: 'elementary', ex: 'حصلت على علامة جيدة.', eu: "U yaxshi baho oldi." },
    { a: 'كوكب', u: 'Sayyora', t: 'ot', l: 'elementary', ex: 'الأرض كوكبنا.', eu: "Yer bizning sayyoramiz." },
    { a: 'جبل', u: "Tog'", t: 'ot', l: 'elementary', ex: 'الجبل مرتفع جداً.', eu: "Tog' juda baland." },
    { a: 'نهر', u: 'Daryo', t: 'ot', l: 'elementary', ex: 'النهر جميل.', eu: "Daryo go'zal." },
    { a: 'بحر', u: 'Dengiz', t: 'ot', l: 'elementary', ex: 'أحب البحر.', eu: "Men dengizni yaxshi ko'raman." },
    { a: 'غابة', u: "O'rmon", t: 'ot', l: 'elementary', ex: 'الغابة مظلمة وهادئة.', eu: "O'rmon qorong'i va sokin." },
    { a: 'حيوان', u: 'Hayvon', t: 'ot', l: 'elementary', ex: 'حيواني المفضل هو الأسد.', eu: "Mening sevimli hayvon — sher." },
    { a: 'رياضة', u: 'Sport', t: 'ot', l: 'elementary', ex: 'الرياضة تحافظ على صحتك.', eu: "Sport sizni sog'lom saqlaydi." },
    { a: 'فريق', u: 'Jamoa', t: 'ot', l: 'elementary', ex: 'فريقنا فاز بالمباراة.', eu: "Bizning jamoamiz o'yinda g'olib keldi." },
    { a: 'قصة', u: 'Hikoya', t: 'ot', l: 'elementary', ex: 'أخبرني بقصة.', eu: "Menga hikoya aytib ber." },
    { a: 'حلم', u: 'Orzu/Tush', t: 'ot', l: 'elementary', ex: 'اتبع حلمك.', eu: "Orzuingiz ortidan yuring." },
    { a: 'يضحك', u: 'Kulmoq', t: 'fe\'l', l: 'elementary', ex: 'هي دائماً تجعلني أضحك.', eu: "U har doim meni kuldiradi." },
    { a: 'يبكي', u: "Yig'lamoq", t: 'fe\'l', l: 'elementary', ex: 'لا تبكِ، كل شيء على ما يرام.', eu: "Yig'lama, hammasi yaxshi bo'ladi." },
    { a: 'يوضح', u: 'Tushuntirmoq', t: 'fe\'l', l: 'elementary', ex: 'أوضح لي ذلك من فضلك.', eu: "Iltimos, buni menga tushuntiring." },
    { a: 'يوافق', u: 'Rozilik bildirmoq', t: 'fe\'l', l: 'elementary', ex: 'أوافق على فكرتك.', eu: "Men sizning g'oyangiz bilan roziman." },
    { a: 'يتذكر', u: 'Eslamoq', t: 'fe\'l', l: 'elementary', ex: 'أتذكر اسمك.', eu: "Ismingizni eslayman." },
    { a: 'ينسى', u: 'Unutmoq', t: 'fe\'l', l: 'elementary', ex: 'لا تنسَ مفاتيحك!', eu: "Kalitlaringizni unutmang!" },
    { a: 'يحسّن', u: 'Yaxshilamoq', t: 'fe\'l', l: 'elementary', ex: 'أريد تحسين عربيتي.', eu: "Arabiy tilimni yaxshilashni xohlayman." },
    { a: 'يستعد', u: 'Tayyorlamoq', t: 'fe\'l', l: 'elementary', ex: 'أستعد للامتحان.', eu: "Imtihonga tayyorlanayapman." },
    { a: 'يستمتع', u: 'Zavqlanmoq', t: 'fe\'l', l: 'elementary', ex: 'أستمتع بمشاهدة الأفلام.', eu: "Film ko'rishdan zavqlanaman." },
    { a: 'ينتهي', u: 'Tugatmoq', t: 'fe\'l', l: 'elementary', ex: 'هل انتهيت من عملك؟', eu: "Ishingizni tugatdingizmi?" },
    { a: 'يبدأ', u: 'Boshlash', t: 'fe\'l', l: 'elementary', ex: 'لنبدأ الدرس.', eu: "Keling, darsni boshlaylik." },
    { a: 'عادةً', u: 'Odatda', t: 'ravish', l: 'elementary', ex: 'أستيقظ عادةً في السابعة.', eu: "Men odatda soat 7 da uyg'onaman." },
    { a: 'أحياناً', u: "Ba'zan", t: 'ravish', l: 'elementary', ex: 'أحياناً تشاهد أفلاماً.', eu: "U ba'zan film ko'radi." },
    { a: 'أبداً', u: 'Hech qachon', t: 'ravish', l: 'elementary', ex: 'لا آكل الوجبات السريعة أبداً.', eu: "Men hech qachon tez ovqat yemayman." },
    { a: 'دائماً', u: 'Har doim', t: 'ravish', l: 'elementary', ex: 'هو دائماً في الوقت المحدد.', eu: "U har doim o'z vaqtida keladi." },
    { a: 'كثيراً', u: 'Tez-tez', t: 'ravish', l: 'elementary', ex: 'نتمشى كثيراً.', eu: "Biz tez-tez sayrga chiqamiz." },
    { a: 'فجأة', u: "To'satdan", t: 'ravish', l: 'elementary', ex: 'بدأ المطر فجأة.', eu: "To'satdan yomg'ir yog'a boshladi." },
    { a: 'أخيراً', u: 'Nihoyat', t: 'ravish', l: 'elementary', ex: 'وصلنا أخيراً.', eu: "Nihoyat kelIb yetdik." },

    // ═══ PRE-INTERMEDIATE ═══
    { a: 'ومع ذلك', u: 'Biroq, ammo', t: 'bog\'l.', l: 'pre-intermediate', ex: 'كان الجو بارداً، ومع ذلك خرجنا.', eu: "Havo sovuq edi, biroq biz chiqdik." },
    { a: 'بالرغم من', u: "Garchi...bo'lsa ham", t: 'bog\'l.', l: 'pre-intermediate', ex: 'بالرغم من المطر، لعبنا.', eu: "Garchi yomg'ir yog'sa ham, biz o'yndik." },
    { a: 'لذلك', u: 'Shuning uchun', t: 'ravish', l: 'pre-intermediate', ex: 'لذلك قررنا الذهاب.', eu: "Shuning uchun biz borishga qaror qildik." },
    { a: 'علاوةً على ذلك', u: 'Bundan tashqari', t: 'ravish', l: 'pre-intermediate', ex: 'علاوةً على ذلك، هي موهوبة.', eu: "Bundan tashqari, u iste'dodli." },
    { a: 'فرصة', u: 'Imkoniyat', t: 'ot', l: 'pre-intermediate', ex: 'هذه فرصة رائعة.', eu: "Bu ajoyib imkoniyat." },
    { a: 'بحث', u: 'Tadqiqot', t: 'ot', l: 'pre-intermediate', ex: 'يجري العلماء أبحاثاً.', eu: "Olimlar tadqiqot o'tkazadilar." },
    { a: 'موعد نهائي', u: 'Muddati', t: 'ot', l: 'pre-intermediate', ex: 'الموعد النهائي غداً.', eu: "Muddati ertaga." },
    { a: 'إنجاز', u: 'Yutuq', t: 'ot', l: 'pre-intermediate', ex: 'هذا إنجاز عظيم.', eu: "Bu katta yutuq." },
    { a: 'تحدٍّ', u: 'Muammo/Sinov', t: 'ot', l: 'pre-intermediate', ex: 'كل تحدٍّ يجعلك أقوى.', eu: "Har bir muammo sizni kuchliroq qiladi." },
    { a: 'واثق', u: 'Ishonchli', t: 'sifat', l: 'pre-intermediate', ex: 'كن واثقاً من نفسك.', eu: "O'zingizga ishoning." },
    { a: 'ناجح', u: 'Muvaffaqiyatli', t: 'sifat', l: 'pre-intermediate', ex: 'هي رجلة أعمال ناجحة.', eu: "U muvaffaqiyatli ish ayoli." },
    { a: 'مسؤول', u: "Mas'ul", t: 'sifat', l: 'pre-intermediate', ex: 'كن مسؤولاً عن أفعالك.', eu: "Harakatlaringiz uchun mas'ul bo'ling." },
    { a: 'بيئة', u: 'Atrof-muhit', t: 'ot', l: 'pre-intermediate', ex: 'يجب علينا حماية البيئة.', eu: "Biz atrof-muhitni himoya qilishimiz kerak." },
    { a: 'تكنولوجيا', u: 'Texnologiya', t: 'ot', l: 'pre-intermediate', ex: 'التكنولوجيا تغيّر حياتنا.', eu: "Texnologiya hayotimizni o'zgartiradi." },
    { a: 'مجتمع', u: 'Jamiyat', t: 'ot', l: 'pre-intermediate', ex: 'المجتمع يتغير بسرعة.', eu: "Jamiyat tez o'zgarmoqda." },
    { a: 'تعليم', u: "Ta'lim", t: 'ot', l: 'pre-intermediate', ex: 'التعليم مفتاح النجاح.', eu: "Ta'lim — muvaffaqiyat kaliti." },
    { a: 'مسيرة', u: 'Karyera', t: 'ot', l: 'pre-intermediate', ex: 'أريد مسيرة مهنية جيدة.', eu: "Men yaxshi karyera istayman." },
    { a: 'راتب', u: 'Maosh', t: 'ot', l: 'pre-intermediate', ex: 'راتبه مرتفع جداً.', eu: "Uning maoshi juda baland." },
    { a: 'زميل', u: 'Hamkasb', t: 'ot', l: 'pre-intermediate', ex: 'زميلي مفيد.', eu: "Hamkasabim yordamsevar." },
    { a: 'مقابلة', u: 'Suhbat/Intervyu', t: 'ot', l: 'pre-intermediate', ex: 'لدي مقابلة عمل غداً.', eu: "Ertaga ish uchun suhbatim bor." },
    { a: 'خبرة', u: 'Tajriba', t: 'ot', l: 'pre-intermediate', ex: 'الخبرة في العمل مهمة.', eu: "Ish tajribasi muhim." },
    { a: 'مهارات', u: "Ko'nikmalar", t: 'ot', l: 'pre-intermediate', ex: 'تحتاج مهارات تواصل جيدة.', eu: "Yaxshi muloqot ko'nikmalariga ega bo'lish kerak." },
    { a: 'يُدير', u: 'Boshqarmoq', t: 'fe\'l', l: 'pre-intermediate', ex: 'تدير فريقاً كبيراً.', eu: "U katta jamoani boshqaradi." },
    { a: 'يحلّ', u: 'Yechmoq', t: 'fe\'l', l: 'pre-intermediate', ex: 'علينا حلّ هذه المشكلة.', eu: "Biz bu muammoni yechishimiz kerak." },
    { a: 'يحقق', u: 'Erishmoq', t: 'fe\'l', l: 'pre-intermediate', ex: 'يمكنك تحقيق أهدافك.', eu: "Maqsadlaringizga erisha olasiz." },
    { a: 'يطور', u: 'Rivojlantirmoq', t: 'fe\'l', l: 'pre-intermediate', ex: 'نحتاج تطوير أفكار جديدة.', eu: "Biz yangi g'oyalarni rivojlantirishimiz kerak." },
    { a: 'يقترح', u: 'Taklif qilmoq', t: 'fe\'l', l: 'pre-intermediate', ex: 'أقترح أن نذهب الآن.', eu: "Endi ketishimizni taklif qilaman." },
    { a: 'يقارن', u: 'Solishtirmoq', t: 'fe\'l', l: 'pre-intermediate', ex: 'قارن بين هذين المنتجين.', eu: "Bu ikki mahsulotni solishtiring." },
    { a: 'تقرير', u: 'Hisobot', t: 'ot', l: 'pre-intermediate', ex: 'اكتب تقريراً عن ذلك.', eu: "Bu haqida hisobot yozing." },
    { a: 'مشروع', u: 'Loyiha', t: 'ot', l: 'pre-intermediate', ex: 'مشروعنا يُسلَّم يوم الجمعة.', eu: "Loyihamiz juma kuni topshirilishi kerak." },
    { a: 'ميزانية', u: 'Byudjet', t: 'ot', l: 'pre-intermediate', ex: 'ميزانيتنا محدودة.', eu: "Bizning cheklangan byudjetimiz bor." },
    { a: 'ربح', u: 'Foyda', t: 'ot', l: 'pre-intermediate', ex: 'حققت الشركة ربحاً.', eu: "Kompaniya foyda ko'rdi." },
    { a: 'عميل', u: 'Mijoz', t: 'ot', l: 'pre-intermediate', ex: 'العميل راضٍ.', eu: "Mijoz mamnun." },
    { a: 'عقد', u: 'Shartnoma', t: 'ot', l: 'pre-intermediate', ex: 'وقّع العقد.', eu: "Shartnomani imzolang." },
    { a: 'رغم', u: 'Qaramasdan', t: 'old ko\'.', l: 'pre-intermediate', ex: 'رغم المطر، لعبنا.', eu: "Yomg'irga qaramasdan, o'yndik." },
    { a: 'إلا إذا', u: "Agar...bo'lmasa", t: 'bog\'l.', l: 'pre-intermediate', ex: 'لن تنجح إلا إذا درست.', eu: "Agar o'qimasangiz, o'taolmaysiz." },

    // ═══ ADVANCED ═══
    { a: 'فروق دقيقة', u: 'Noziklik', t: 'ot', l: 'advanced', ex: 'الفروق الدقيقة في كلامها مهمة.', eu: "Uning so'zlarining nozikligi muhim edi." },
    { a: 'سيادة', u: 'Suverenitet', t: 'ot', l: 'advanced', ex: 'السيادة الوطنية أمر حيوي.', eu: "Milliy suverenitet muhimdir." },
    { a: 'فصاحة', u: 'Notiqlik', t: 'ot', l: 'advanced', ex: 'فصاحتها أذهلت الجميع.', eu: "Uning notiqligi hammani hayratda qoldirdi." },
    { a: 'نموذج', u: 'Paradigma', t: 'ot', l: 'advanced', ex: 'نموذج جديد يظهر.', eu: "Yangi paradigma paydo bo'lmoqda." },
    { a: 'ارتباط', u: 'Korrelyatsiya', t: 'ot', l: 'advanced', ex: 'الارتباط لا يعني السببية.', eu: "Korrelyatsiya sababiyatni anglatmaydi." },
    { a: 'تشريع', u: 'Qonunchilik', t: 'ot', l: 'advanced', ex: 'صدر تشريع جديد.', eu: "Yangi qonun qabul qilindi." },
    { a: 'يُخفّف', u: 'Yumshatmoq', t: 'fe\'l', l: 'advanced', ex: 'علينا تخفيف المخاطر.', eu: "Biz xavflarni yumshatishimiz kerak." },
    { a: 'غير مسبوق', u: "Misli ko'rilmagan", t: 'sifat', l: 'advanced', ex: 'هذا وضع غير مسبوق.', eu: "Bu misli ko'rilmagan holat." },
    { a: 'دقيق', u: 'Puxta', t: 'sifat', l: 'advanced', ex: 'هي دقيقة في عملها.', eu: "U ishida puxta." },
    { a: 'غامض', u: "Noaniq", t: 'sifat', l: 'advanced', ex: 'كان بيانه غامضاً.', eu: "Uning bayonoti noaniq edi." },
    { a: 'متسق', u: 'Izchil', t: 'sifat', l: 'advanced', ex: 'اكتب حجةً متسقة.', eu: "Izchil argument yozing." },
    { a: 'جوهري', u: 'Muhim, sezilarli', t: 'sifat', l: 'advanced', ex: 'هناك أدلة جوهرية.', eu: "Jiddiy dalillar mavjud." },
    { a: 'متأصّل', u: "O'ziga xos", t: 'sifat', l: 'advanced', ex: 'هناك مخاطر متأصّلة.', eu: "O'ziga xos xavflar mavjud." },
    { a: 'مثير للجدل', u: 'Bahsli', t: 'sifat', l: 'advanced', ex: 'هذا موضوع مثير للجدل.', eu: "Bu munozarali mavzu." },
    { a: 'براغماتي', u: 'Amaliy', t: 'sifat', l: 'advanced', ex: 'تعامل معه بطريقة براغماتية.', eu: "Bunga amaliy yondashing." },
    { a: 'محفّز', u: 'Katalizator', t: 'ot', l: 'advanced', ex: 'الاختراع كان محفّزاً للتغيير.', eu: "Ixtiro o'zgarish uchun katalizator bo'ldi." },
    { a: 'ديموغرافي', u: 'Demografik', t: 'sifat', l: 'advanced', ex: 'التغييرات الديموغرافية مهمة.', eu: "Demografik o'zgarishlar muhim." },
    { a: 'بنية تحتية', u: 'Infratuzilma', t: 'ot', l: 'advanced', ex: 'يجب الاستثمار في البنية التحتية.', eu: "Infratuzilmaga investitsiya qilishimiz kerak." },
    { a: 'فرضية', u: 'Faraz', t: 'ot', l: 'advanced', ex: 'اختبر فرضيتك.', eu: "Farazingizni sinab ko'ring." },
    { a: 'منهجية', u: 'Metodologiya', t: 'ot', l: 'advanced', ex: 'اشرح منهجيتك.', eu: "Metodologiyangizni tushuntiring." },
    { a: 'ظاهرة', u: 'Hodisa', t: 'ot', l: 'advanced', ex: 'هذه ظاهرة عالمية.', eu: "Bu global hodisa." },
    { a: 'انعكاسات', u: 'Oqibatlar', t: 'ot', l: 'advanced', ex: 'فكّر في الانعكاسات.', eu: "Oqibatlarni ko'rib chiqing." },
    { a: 'منظور', u: 'Nuqtai nazar', t: 'ot', l: 'advanced', ex: 'انظر من منظور مختلف.', eu: "Boshqa nuqtai nazarni ko'rib chiqing." },
    { a: 'إطار', u: 'Tizim/Struktura', t: 'ot', l: 'advanced', ex: 'نحتاج إطاراً واضحاً.', eu: "Bizga aniq tizim kerak." },
    { a: 'خطاب', u: 'Nutq/Ritorika', t: 'ot', l: 'advanced', ex: 'كان خطابه قوياً.', eu: "Uning nutqi kuchli edi." },
    { a: 'إجماع', u: 'Kelishuv', t: 'ot', l: 'advanced', ex: 'توصّلنا إلى إجماع.', eu: "Biz kelishuvga erishdik." },
    { a: 'يدعو إلى', u: 'Himoya qilmoq', t: 'fe\'l', l: 'advanced', ex: 'تدعو إلى حقوق الإنسان.', eu: "U inson huquqlarini himoya qiladi." },
    { a: 'يُيسّر', u: 'Osonlashtirmoq', t: 'fe\'l', l: 'advanced', ex: 'التكنولوجيا تيسّر التعلّم.', eu: "Texnologiya o'rganishni osonlashtiradi." },
    { a: 'يُعرب عن', u: 'Bayon etmoq', t: 'fe\'l', l: 'advanced', ex: 'هل يمكنك التعبير عن ذلك بالتفصيل؟', eu: "Bu haqida batafsil ayta olasizmi?" },
    { a: 'يعترف', u: 'Tan olmoq', t: 'fe\'l', l: 'advanced', ex: 'أعترف بخطئي.', eu: "Xatoimni tan olaman." },
    { a: 'يستمر', u: 'Davom ettirmoq', t: 'fe\'l', l: 'advanced', ex: 'يجب أن نستمر في جهودنا.', eu: "Biz kuchlarimizni davom ettirishimiz kerak." },
];

// ══════════════════════════════════════════════════════════════
// ARABIC UNITS DATA
// ══════════════════════════════════════════════════════════════
const UD_DATA = {
    beginner: [
        {
            id: 'ab0', emoji: '🔤', title: 'الحروف الهجائية', desc: "Arab alifbosini o'rganish (28 harf)",
            level: 'beginner',
            words: ['مرحباً', 'وداعاً', 'شكراً', 'من فضلك', 'عفواً', 'نعم', 'لا', 'جيد', 'سيئ', 'كبير'],
            xp: 40, coin: 15,
            grammar_rule: "Arab alifbosida 28 harf bor. Harflar o'ngdan chapga yoziladi. Harflar so'z boshida, o'rtasida va oxirida turli shaklga ega.",
            grammar_example: "أ - ب - ت - ث - ج - ح - خ - د - ذ - ر - ز - س - ش - ص - ض - ط - ظ - ع - غ - ف - ق - ك - ل - م - ن - ه - و - ي",
            reading_text: "اللغة العربية لغة جميلة. الأبجدية العربية تحتوي على 28 حرفاً. تُكتب العربية من اليمين إلى اليسار. هذه اللغة يتحدثها أكثر من 400 مليون شخص في العالم.",
            reading_qs: [
                { q: "Arabcha qancha harf bor?", opts: ["24", "26", "28", "30"], c: 2 },
                { q: "Arabcha qaysi tomonga yoziladi?", opts: ["Chapdan o'nga", "O'ngdan chapga", "Tepadan pastga", "Pastdan tepaga"], c: 1 },
                { q: "Nechta odam arabcha gapiradi?", opts: ["100 million", "200 million", "300 million", "400 million"], c: 3 }
            ]
        },
        {
            id: 'ab1', emoji: '👋', title: 'التحيات', desc: "Salomlashish va xayrlashish",
            level: 'beginner',
            words: ['مرحباً', 'وداعاً', 'شكراً', 'من فضلك', 'عفواً', 'نعم', 'لا', 'جيد', 'سعيد', 'حزين'],
            xp: 50, coin: 20,
            grammar_rule: "أنا = Men. أنت = Sen (erkak). أنتِ = Sen (ayol). هو = U (erkak). هي = U (ayol).",
            grammar_example: "أنا طالب. أنت معلم. هو طبيب. هي مهندسة.",
            reading_text: "اسمي سارة. أنا من أوزبكستان. كل صباح أقول 'مرحباً' لجيراني. حين أغادر أقول 'وداعاً'. دائماً أقول 'من فضلك' و'شكراً'. الناس يقولون إنني مهذبة جداً.",
            reading_qs: [
                { q: "Suting ismi nima?", opts: ["Layla", "Sarah", "Maryam", "Fatima"], c: 1 },
                { q: "U ketayotganda nima deydi?", opts: ["مرحباً", "شكراً", "وداعاً", "من فضلك"], c: 2 },
                { q: "U qanday odam?", opts: ["Kamtarin", "Xushmuomala", "Shoshqaloq", "Kamgap"], c: 1 }
            ]
        },
        {
            id: 'ab2', emoji: '🔢', title: 'الأرقام', desc: "Raqamlar 1-100",
            level: 'beginner',
            words: ['واحد', 'اثنان', 'ثلاثة', 'أربعة', 'خمسة', 'ستة', 'سبعة', 'ثمانية', 'تسعة', 'عشرة'],
            xp: 50, coin: 20,
            grammar_rule: "Arabcha raqamlar: واحد (1), اثنان (2), ثلاثة (3)... عشرة (10), عشرون (20), مائة (100).",
            grammar_example: "عندي ثلاثة كتب. الساعة الخامسة. في الفصل خمسة وعشرون طالباً.",
            reading_text: "لدى توم ثلاث قطط وكلبان. يطعمهم كل يوم أربع مرات. يقضي عشر دقائق مع كل حيوان. اشترى اثني عشر لعبة لقططه.",
            reading_qs: [
                { q: "Qancha mushuk bor?", opts: ["Ikki", "Uch", "To'rt", "Besh"], c: 1 },
                { q: "Kuniga necha marta ovqatlantiradi?", opts: ["Ikki", "Uch", "To'rt", "Besh"], c: 2 },
                { q: "Qancha o'yinchoq sotib oldi?", opts: ["O'n", "O'n ikki", "O'n besh", "Yigirma"], c: 1 }
            ]
        },
        {
            id: 'ab3', emoji: '🎨', title: 'الألوان', desc: "Arabcha ranglar",
            level: 'beginner',
            words: ['أحمر', 'أزرق', 'أخضر', 'أصفر', 'أسود', 'أبيض', 'كبير', 'صغير', 'جيد', 'جميل'],
            xp: 60, coin: 25,
            grammar_rule: "Arabchada sifatlar otdan keyin keladi: كتاب كبير (katta kitob), سيارة حمراء (qizil mashina).",
            grammar_example: "قلم أحمر · سيارة زرقاء · شجرة خضراء · شمس صفراء",
            reading_text: "قوس قزح يحتوي على سبعة ألوان: الأحمر والبرتقالي والأصفر والأخضر والأزرق والنيلي والبنفسجي. الأحمر لون النار. الأزرق لون السماء. الأخضر لون الأشجار.",
            reading_qs: [
                { q: "Kamalakda qancha rang bor?", opts: ["Besh", "Olti", "Yetti", "Sakkiz"], c: 2 },
                { q: "Osmonning rangi?", opts: ["Qizil", "Sariq", "Ko'k", "Yashil"], c: 2 },
                { q: "O't rangi?", opts: ["Ko'k", "Qizil", "Yashil", "Sariq"], c: 2 }
            ]
        },
        {
            id: 'ab4', emoji: '👨‍👩‍👧', title: 'العائلة', desc: "Oila a'zolari",
            level: 'beginner',
            words: ['أم', 'أب', 'أخت', 'أخ', 'ماء', 'طعام', 'بيت', 'سيارة', 'كلب', 'قطة'],
            xp: 60, coin: 25,
            grammar_rule: "Arabchada egalik qo'shimchalari: ي = mening, ك = sening, ه = uning (erkak), ها = uning (ayol).",
            grammar_example: "أمي معلمة. أبوك طبيب. كتابه جميل. بيتها كبير.",
            reading_text: "عائلتي تتكون من خمسة أفراد. أبي طبيب وأمي معلمة. لدي أخ واحد وأخت واحدة. يسكن أجدادي قريباً. نزورهم كل يوم أحد.",
            reading_qs: [
                { q: "Oilada nechta kishi bor?", opts: ["Uch", "To'rt", "Besh", "Olti"], c: 2 },
                { q: "Otasining kasbi?", opts: ["O'qituvchi", "Shifokor", "Muhandis", "Haydovchi"], c: 1 },
                { q: "Bobonikiga qachon borishadi?", opts: ["Shanba", "Yakshanba", "Dushanba", "Juma"], c: 1 }
            ]
        },
        {
            id: 'ab5', emoji: '🍎', title: 'الطعام والشراب', desc: "Ovqat va ichimliklar",
            level: 'beginner',
            words: ['ماء', 'طعام', 'تفاحة', 'خبز', 'حليب', 'بيضة', 'أرز', 'لحم', 'شاي', 'قهوة'],
            xp: 70, coin: 30,
            grammar_rule: "Arabchada sanab bo'ladigan otlar: تفاحة (bir olma), تفاحتان (ikki olma), ثلاث تفاحات (uch olma).",
            grammar_example: "أريد تفاحة وبعض الماء. تشرب الحليب كل صباح.",
            reading_text: "الفطور الصحي مهم. كثير من الناس يأكلون البيض والخبز في الصباح. الشاي والقهوة من المشروبات الشعبية. الحليب مفيد للأطفال. اشرب كمية كافية من الماء يومياً.",
            reading_qs: [
                { q: "Ertalabki ovqat haqida nima aytildi?", opts: ["U muhim emas", "U juda muhim", "U ixtiyoriy", "U zararli"], c: 1 },
                { q: "Bolalarga nima foydali?", opts: ["Qahva", "Choy", "Sut", "Sharbat"], c: 2 },
                { q: "Qaysi ovqat eslatildi?", opts: ["Guruch", "Sho'rva", "Tuxum va non", "Pizza"], c: 2 }
            ]
        },
    ],

    elementary: [
        {
            id: 'ae1', emoji: '🏡', title: 'المنزل والغرف', desc: "Uy va xonalar",
            level: 'elementary',
            words: ['غرفة نوم', 'مطبخ', 'حمام', 'طبيب', 'مهندس', 'غالي', 'رخيص', 'جميل', 'صعب', 'سهل'],
            xp: 80, coin: 35,
            grammar_rule: "يوجد / توجد = bor, mavjud. لا يوجد = yo'q. هناك = u yerda bor.",
            grammar_example: "يوجد صالون كبير. توجد ثلاث غرف نوم. هناك حديقة جميلة.",
            reading_text: "بيتي يتكون من ثلاثة طوابق. في الطابق الأرضي يوجد صالون كبير ومطبخ عصري. في الطابق الأول توجد ثلاث غرف نوم وحمامان. غرفتي لها نافذة كبيرة تطل على الحديقة.",
            reading_qs: [
                { q: "Nechta qavat bor?", opts: ["Ikki", "Uch", "To'rt", "Besh"], c: 1 },
                { q: "Yotoqxonalar qayerda?", opts: ["Birinchi qavatda", "Ikkinchi qavatda", "Bog'da", "Yer ostida"], c: 0 },
                { q: "Xonada nima bor?", opts: ["Televizor", "Katta deraza", "Hovuz", "Kamin"], c: 1 }
            ]
        },
        {
            id: 'ae2', emoji: '💼', title: 'المهن', desc: "Kasblar",
            level: 'elementary',
            words: ['طبيب', 'مهندس', 'معلم', 'طيار', 'محامٍ', 'ممرض', 'مدير', 'طاهٍ', 'شرطي', 'صحفي'],
            xp: 80, coin: 35,
            grammar_rule: "ماذا تعمل؟ = Nima ish qilasiz? أنا + ism kasb = Men + kasb.",
            grammar_example: "ماذا تعمل؟ أنا طبيب. هو يعمل مهندساً. هي معلمة.",
            reading_text: "هناك مهن كثيرة مختلفة. يعمل الأطباء والممرضون في المستشفيات. يُعلّم المعلمون الجيل القادم. يبني المهندسون الجسور. يطير الطيارون الطائرات. كل مهنة مهمة للمجتمع.",
            reading_qs: [
                { q: "Shiforkorlar qayerda ishlaydi?", opts: ["Maktabda", "Fabrikada", "Kasalxonada", "Ofisda"], c: 2 },
                { q: "Muhandislar nima quradi?", opts: ["Kitoblar", "Qo'shiqlar", "Ko'priklar", "Ovqat"], c: 2 },
                { q: "O'qituvchilar nima qiladi?", opts: ["Uchadi", "Ko'prik quradi", "Odamlarni o'qitadi", "Ovqat pishiradi"], c: 2 }
            ]
        },
        {
            id: 'ae3', emoji: '🛒', title: 'التسوق', desc: "Xarid qilish",
            level: 'elementary',
            words: ['غالي', 'رخيص', 'خصم', 'تذكرة', 'مطعم', 'فندق', 'قائمة طعام', 'موعد', 'تسوق', 'مبلغ'],
            xp: 90, coin: 40,
            grammar_rule: "بكم هذا؟ = Bu qancha turadi? يكلّف / يساوي = Turadi. هل يمكنني الدفع ببطاقة؟ = Karta bilan to'lasam bo'ladimi?",
            grammar_example: "بكم هذا القميص؟ يكلّف خمسة وعشرين ألف سوم. هل يمكنني الدفع ببطاقة؟ نعم، بالطبع.",
            reading_text: "التسوق نشاط يومي. السوبرماركت يبيع الطعام والمواد المنزلية. في متاجر التجزئة توجد الملابس والإلكترونيات. قبل الشراء تحقق دائماً من السعر. ابحث عن الخصومات لتوفير المال. احتفظ بوصل الشراء!",
            reading_qs: [
                { q: "Kiyim qayerda sotiladi?", opts: ["Supermarketda", "Do'konda", "Aptekada", "Non do'konida"], c: 1 },
                { q: "Nimani saqlash kerak?", opts: ["Sumkani", "Kviitansiyani", "Yorliqni", "Qutini"], c: 1 },
                { q: "Pul tejash uchun nima qilish kerak?", opts: ["Tez sotib olish", "Naqd to'lash", "Chegirmalarni izlash", "Ko'p borish"], c: 2 }
            ]
        },
    ],

    'pre-intermediate': [
        {
            id: 'ap1', emoji: '🔮', title: 'خطط المستقبل', desc: "Kelajak va rejalar",
            level: 'pre-intermediate',
            words: ['ومع ذلك', 'لذلك', 'فرصة', 'بحث', 'إنجاز', 'تحدٍّ', 'واثق', 'ناجح', 'مسؤول', 'بيئة'],
            xp: 130, coin: 60,
            grammar_rule: "المضارع + سوف/سـ = Kelajak zamon. سأذهب = Men boraman (kelajakda). سوف تدرس = U o'qiydi (kelajakda).",
            grammar_example: "سأتصل بك غداً. سوف تدرس الطب. سنسافر الصيف القادم.",
            reading_text: "التخطيط للمستقبل أمر ضروري. وضع أهداف واضحة يساعدك على تحقيق النجاح. الأهداف قصيرة المدى تستغرق أسابيع قليلة. الأهداف طويلة المدى تستغرق سنوات. المرونة مهمة بقدر التصميم.",
            reading_qs: [
                { q: "Qisqa muddatli maqsadlar qancha vaqt oladi?", opts: ["Yillar", "O'n yillar", "Bir necha hafta", "Umr bo'yi"], c: 2 },
                { q: "Qat'iyat bilan nima teng muhim?", opts: ["Pul", "Moslashuvchanlik", "Ta'lim", "Kuch"], c: 1 },
                { q: "Rejalashtirish nimaga yordam beradi?", opts: ["Do'st topish", "Shuhrat", "Muvaffaqiyat", "Sayohat"], c: 2 }
            ]
        },
        {
            id: 'ap2', emoji: '🎯', title: 'الفعل الماضي', desc: "O'tgan zamon",
            level: 'pre-intermediate',
            words: ['ومع ذلك', 'بالرغم من', 'لذلك', 'علاوةً على ذلك', 'فرصة', 'إنجاز', 'تحدٍّ', 'واثق', 'ناجح', 'مسؤول'],
            xp: 140, coin: 65,
            grammar_rule: "O'tgan zamon: ذهبَ (bordi), كتبَ (yozdi), قرأَ (o'qidi). Ko'plik: ذهبوا (borishdi), كتبوا (yozishdi).",
            grammar_example: "ذهبتُ إلى المدرسة. كتبتُ رسالةً. قرأنا كتاباً مثيراً. ذهبوا إلى السوق.",
            reading_text: "الفعل الماضي في اللغة العربية يدل على حدث وقع في الماضي. صيغة المفرد: فعَلَ. صيغة الجمع: فعَلوا. كلمات دالة على الماضي: أمس، قبل، في الماضي، منذ.",
            reading_qs: [
                { q: "O'tgan zamonda ko'plik qo'shimchasi qanday?", opts: ["-تُ", "-وا", "-نَ", "-تَ"], c: 1 },
                { q: "O'tgan zamonni ko'rsatuvchi so'z qaysi?", opts: ["غداً", "الآن", "أمس", "قريباً"], c: 2 },
                { q: "ذهبَ nimani anglatadi?", opts: ["Bormoqchi", "Bordi", "Borayapti", "Boradi"], c: 1 }
            ]
        },
    ],

    advanced: [
        {
            id: 'aa1', emoji: '🖊️', title: 'الكتابة الأكاديمية', desc: "Akademik yozuv",
            level: 'advanced',
            words: ['ومع ذلك', 'لذلك', 'علاوةً على ذلك', 'بالإضافة إلى ذلك', 'فروق دقيقة', 'فصاحة', 'غير مسبوق', 'جوهري', 'متسق', 'منهجية'],
            xp: 200, coin: 90,
            grammar_rule: "Ulanish vositalari: علاوةً على ذلك (bundan tashqari), ومع ذلك (biroq), لذلك (shuning uchun), بينما (holbuki).",
            grammar_example: "البيانات تدعم الفرضية. علاوةً على ذلك، الأبحاث السابقة تؤكد هذه النتائج.",
            reading_text: "الكتابة الأكاديمية تتطلب الدقة والتماسك المنطقي. كل حجة يجب أن تُدعم بأدلة. أدوات التماسك تربط الأفكار: 'علاوةً على ذلك' تضيف معلومات، 'ومع ذلك' تقدم تناقضاً. هيكل الفقرة يتبع: النقطة، الدليل، التفسير، الرابط.",
            reading_qs: [
                { q: "'علاوةً على ذلك' nimani bildiradi?", opts: ["Ziddiyat", "Natija", "Qo'shimcha ma'lumot", "Shart"], c: 2 },
                { q: "Har bir argument nimaga ega bo'lishi kerak?", opts: ["Hikoya", "Dalil", "Fikr", "Hazil"], c: 1 },
                { q: "'ومع ذلك' nimani bildiradi?", opts: ["Bundan tashqari", "Biroq", "Shuning uchun", "Chunki"], c: 1 }
            ]
        },
        {
            id: 'aa2', emoji: '📋', title: 'العربية التجارية', desc: "Biznes arabchasi",
            level: 'advanced',
            words: ['ميزانية', 'ربح', 'عميل', 'عقد', 'مشروع', 'تقرير', 'منظور', 'إطار', 'إجماع', 'يدعو إلى'],
            xp: 250, coin: 110,
            grammar_rule: "Formal uslub: يُرجى (Iltimos), نودّ إعلامكم (Sizni xabardor qilmoqchimiz), يُشار إلى أن (Shuni ta'kidlash kerakki).",
            grammar_example: "يُرجى مراجعة العقد. نودّ إعلامكم بأن الميزانية قد تم اعتمادها. يُشار إلى أن الأرباح ارتفعت.",
            reading_text: "اللغة العربية التجارية تختلف عن اللغة اليومية. تستخدم الرسائل الرسمية ألفاظاً محددة: 'نظراً لـ' (chunki), 'وفقاً لـ' (ga ko'ra). يجب أن تكون الرسائل التجارية مختصرة وواضحة ومحترمة.",
            reading_qs: [
                { q: "'نظراً لـ' nimani anglatadi?", opts: ["Ko'ra", "Bilan", "Chunki", "Va"], c: 2 },
                { q: "Biznes xati qanday bo'lishi kerak?", opts: ["Uzun va batafsil", "Qisqa, aniq va hurmat bilan", "Norasmiy", "Hazilomuz"], c: 1 },
                { q: "'وفقاً لـ' nimani anglatadi?", opts: ["Biroq", "Shuning uchun", "...ga ko'ra", "Va ham"], c: 2 }
            ]
        },
    ]
};

// ══════════════════════════════════════════════════════════════
// GRAMMAR QUESTIONS (Arabic specific)
// ══════════════════════════════════════════════════════════════
const GRAMMAR_QS = [
    { q: "أنا ___ طالب.", opts: ["هو", "هي", "أنا", "أنتَ"], ans: "أنا", exp: "1-shaxs: أنا = Men" },
    { q: "هو ___ في المدرسة.", opts: ["أنا", "يدرس", "أدرس", "تدرس"], ans: "يدرس", exp: "Erkak 3-shaxs: هو يدرس" },
    { q: "هي ___ عربية بطلاقة.", opts: ["يتكلم", "تتكلم", "أتكلم", "نتكلم"], ans: "تتكلم", exp: "Ayol 3-shaxs: هي تتكلم" },
    { q: "الكتاب ___ جديد.", opts: ["هو", "هي", "أنا", "نحن"], ans: "هو", exp: "Kitob (الكتاب) — erkak jins: هو جديد" },
    { q: "___ ذهبتَ أمس؟", opts: ["أين", "كيف", "متى", "لماذا"], ans: "أين", exp: "أين = Qayerga? Joy so'rash uchun" },
    { q: "لدي ___ كتب.", opts: ["ثلاثة", "ثلاث", "ثلاثٌ", "ثلاثي"], ans: "ثلاثة", exp: "Kitob (كتاب) erkak jins, son esa ayol shaklida: ثلاثة كتب" },
    { q: "الولد ___ سريعاً.", opts: ["يركض", "تركض", "أركض", "نركض"], ans: "يركض", exp: "Erkak 3-shaxs hozirgi zamon: يركض" },
    { q: "هذا البيت ___ جميلٌ.", opts: ["هي", "هو", "أنتَ", "أنا"], ans: "هو", exp: "Uy (البيت) erkak jins — الإسناد للمذكر" },
    { q: "نحن ___ العربية.", opts: ["يتعلم", "تتعلم", "نتعلم", "أتعلم"], ans: "نتعلم", exp: "Ko'plik 1-shaxs: نحن نتعلم" },
    { q: "هل ___ إلى المدرسة؟ — نعم.", opts: ["ذهبتَ", "ذهبتُ", "ذهبوا", "ذهبتِ"], ans: "ذهبتَ", exp: "2-shaxs erkak o'tgan zamon: أنتَ ذهبتَ" },
    { q: "أكبر مدينة في أوزبكستان هي ___.", opts: ["سمرقند", "طشقند", "بخارى", "أنديجان"], ans: "طشقند", exp: "O'zbekistonning poytaxti — Toshkent (طشقند)" },
    { q: "المفرد من 'كتب' هو ___.", opts: ["كتاب", "كتبٌ", "كتبة", "كاتب"], ans: "كتاب", exp: "كتاب (kitob) — ko'plik: كتب" },
    { q: "الجمع من 'طالب' هو ___.", opts: ["طالبة", "طلاب", "طالبان", "مطالب"], ans: "طلاب", exp: "طالب (o'quvchi) — ko'plik: طلاب" },
    { q: "كم + ___ يذهب عمر إلى المكتبة؟", opts: ["مرةً", "يوماً", "وقتاً", "مكاناً"], ans: "مرةً", exp: "كم مرة = Necha marta? — تكرار" },
    { q: "الجملة الصحيحة هي:", opts: ["أنا سعيدٌ كثيراً", "أنا كثيراً سعيد", "سعيدٌ أنا كثيراً", "كثيراً أنا سعيد"], ans: "أنا سعيدٌ كثيراً", exp: "Arabcha tartibi: Ega + kesim + hol" },
];

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
    u.lang = 'ar-SA'; u.rate = 0.82;
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
        const pillCount = Math.min(UMaxTokens, 10);
        const usedCount = Math.round(((UMaxTokens - UTokens) / UMaxTokens) * pillCount);
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

    const navXP = $id('navXP');
    const navCoin = $id('navCoin');
    if (navXP) navXP.textContent = UXP.toLocaleString();
    if (navCoin) navCoin.textContent = UCoin.toLocaleString();
}

// ══════════════════════════════════════════════════════════════
// LEADERBOARD — FIX: toLocaleString() for large numbers
// ══════════════════════════════════════════════════════════════
window.loadLBSection = async function (field, btn) {
    if (btn) {
        document.querySelectorAll('#leaderboard-section .ptab').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
    }
    const container = $id('lbSectionContent'); if (!container) return;
    container.innerHTML = `<div style="text-align:center;padding:30px;color:#666"><i class="fa-solid fa-spinner fa-spin" style="font-size:1.5rem;color:#a78bfa"></i><br>Yuklanmoqda...</div>`;
    try {
        const q = query(collection(_db, 'users'), orderBy(field, 'desc'), limit(20));
        const snap = await getDocs(q);
        const users = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        if (!users.length) { container.innerHTML = '<p style="text-align:center;color:#666">Hali hech kim yo\'q</p>'; return; }
        const labels = { xp: 'XP', coins: 'Coin', unitsCompleted: 'Unit' };
        const icons = { xp: 'fa-star', coins: 'fa-coins', unitsCompleted: 'fa-book' };
        let html = `<div style="margin-bottom:16px;display:flex;justify-content:space-between;align-items:center">
            <span style="color:#666;font-size:0.8rem"><i class="fa-solid ${icons[field] || 'fa-trophy'}" style="margin-right:4px;color:#a78bfa"></i>${labels[field] || field} reytingi</span>
            <span style="color:#666;font-size:0.78rem">${users.length} foydalanuvchi</span></div>`;
        users.forEach((u, i) => {
            const rank = i + 1;
            const isMe = u.id === CU?.uid;
            const rankClass = rank === 1 ? 'gold' : rank === 2 ? 'silver' : rank === 3 ? 'bronze' : '';
            const rankIcon = rank === 1
                ? '<i class="fa-solid fa-trophy" style="color:#f5c842"></i>'
                : rank === 2 ? '<i class="fa-solid fa-medal" style="color:#94a3b8"></i>'
                    : rank === 3 ? '<i class="fa-solid fa-medal" style="color:#cd7c4a"></i>'
                        : `<span style="font-size:0.85rem">${rank}</span>`;
            // FIX: toLocaleString() prevents overflow for large numbers
            const rawVal = u[field] || 0;
            const val = typeof rawVal === 'number' ? rawVal.toLocaleString('uz-UZ') : rawVal;
            const planKey = (u.plan || 'free').toLowerCase();
            const pc = PLAN_COLORS[planKey] || '#94a3b8';
            const planLabel = PLAN_LABELS[planKey] || planKey.toUpperCase();
            const initial = (u.displayName || u.email || 'U').charAt(0).toUpperCase();
            html += `<div class="lb-row${isMe ? ' me' : ''}" style="display:flex;align-items:center;gap:12px;padding:10px 14px;border-radius:14px;background:${isMe ? 'rgba(91,124,250,0.1)' : 'rgba(255,255,255,0.03)'};border:1px solid ${isMe ? 'rgba(91,124,250,0.28)' : 'rgba(255,255,255,0.06)'};margin-bottom:8px;transition:all 0.2s">
                <div style="width:32px;text-align:center;font-weight:800;color:${rank === 1 ? '#f5c842' : rank === 2 ? '#94a3b8' : rank === 3 ? '#cd7c4a' : '#a78bfa'}">${rankIcon}</div>
                <div style="width:36px;height:36px;border-radius:50%;background:linear-gradient(135deg,#5b7cfa,#a78bfa);display:flex;align-items:center;justify-content:center;font-weight:700;color:#fff;flex-shrink:0">${initial}</div>
                <div style="flex:1;min-width:0">
                    <div style="font-family:'Exo 2',sans-serif;font-weight:700;font-size:0.86rem;color:#e8ecff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${u.displayName || u.email || 'Foydalanuvchi'}${isMe ? ' <span style="color:#a78bfa;font-size:0.7rem">(siz)</span>' : ''}</div>
                    ${planKey !== 'free' ? `<span style="font-size:0.66rem;padding:1px 7px;border-radius:100px;background:${pc}22;border:1px solid ${pc}44;color:${pc}">${planLabel}</span>` : ''}
                </div>
                <div style="text-align:right;flex-shrink:0">
                    <div style="font-family:'Cinzel',serif;font-weight:700;font-size:0.88rem;color:#a78bfa;white-space:nowrap"><i class="fa-solid ${icons[field] || 'fa-star'}" style="margin-right:4px;color:#a78bfa"></i>${val}</div>
                    <div style="font-size:0.68rem;color:#555">${labels[field] || field}</div>
                </div>
            </div>`;
        });
        container.innerHTML = html;
    } catch (e) {
        container.innerHTML = `<div style="text-align:center;padding:30px;color:#ef4444"><i class="fa-solid fa-triangle-exclamation"></i> Xatolik: ${e.message}<br><button onclick="window.loadLBSection('${field}',null)" style="margin-top:12px;padding:8px 16px;border-radius:8px;background:#a78bfa22;border:1px solid #a78bfa44;color:#a78bfa;cursor:pointer">Qayta</button></div>`;
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
    ctx.closePath();
    ctx.fillStyle = 'rgba(232,180,56,0.18)'; ctx.fill();
    ctx.strokeStyle = 'rgba(232,180,56,0.8)'; ctx.lineWidth = 2; ctx.stroke();
    angles.forEach((a, i) => {
        ctx.beginPath();
        ctx.arc(cx + r * skills[i] * Math.cos(a), cy + r * skills[i] * Math.sin(a), 4, 0, Math.PI * 2);
        ctx.fillStyle = '#e8b438'; ctx.fill();
    });
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
          <div style="font-size:0.75rem;color:#e8b438;margin-bottom:4px">Unit ${i + 1}</div>
          <div style="font-size:1.8rem;margin-bottom:8px">${unit.emoji}</div>
          <div style="font-weight:700;font-size:1rem;color:#e8ecff;margin-bottom:6px;font-family:'Cinzel',serif">${unit.title}</div>
          <div style="font-size:0.8rem;color:#666;margin-bottom:12px">${unit.desc}</div>
          <div style="display:flex;gap:8px;margin-bottom:10px">
            ${['A', 'B', 'C', 'D'].map(l => `<div style="width:24px;height:24px;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:0.7rem;font-weight:700;background:${UProg[unit.id + '_' + l] >= 100 ? 'rgba(232,180,56,0.2)' : 'rgba(255,255,255,0.05)'};border:1px solid ${UProg[unit.id + '_' + l] >= 100 ? '#e8b438' : 'rgba(255,255,255,0.1)'};color:${UProg[unit.id + '_' + l] >= 100 ? '#e8b438' : '#666'}">${l}</div>`).join('')}
          </div>
          <div style="height:3px;background:rgba(255,255,255,0.06);border-radius:100px;overflow:hidden;margin-bottom:8px">
            <div style="height:100%;width:${pct}%;background:linear-gradient(90deg,#e8b438,#f5c842);border-radius:100px;transition:width 0.4s"></div>
          </div>
          <div style="font-size:0.76rem;display:flex;gap:10px">
            <span style="color:#f5c842">+${unit.xp} XP</span>
            <span style="color:#fbbf24">+${unit.coin} 🪙</span>
            ${isComp ? '<span style="color:#34d399">✅</span>' : ''}
          </div>`;
        card.onmouseover = () => { card.style.background = 'rgba(232,180,56,0.06)'; card.style.borderColor = 'rgba(232,180,56,0.3)'; };
        card.onmouseout = () => { card.style.background = ''; card.style.borderColor = ''; };
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
    const lcolors = { A: '#e8b438', B: '#22d3ee', C: '#34d399', D: '#f472b6' };
    content.innerHTML = `
      <div style="text-align:center;padding-bottom:20px">
        <div style="font-size:3rem;margin-bottom:10px">${unit.emoji}</div>
        <h2 style="margin-bottom:8px;font-family:'Cinzel',serif">${unit.title}</h2>
        <p style="color:#666">${unit.desc}</p>
        <div style="display:flex;gap:16px;justify-content:center;margin:16px 0;flex-wrap:wrap">
          <span style="color:#f5c842">⭐ +${unit.xp} XP</span>
          <span style="color:#fbbf24">🪙 +${unit.coin} Coin</span>
          <span style="color:#60a5fa">📚 ${unit.words.length} so'z</span>
          <span style="color:#a78bfa">🎫 2 token/dars</span>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:20px">
        ${['A', 'B', 'C', 'D'].map(k => {
        const done = UProg[`${unit.id}_${k}`] >= 100;
        const sc = UProg[`score_${unit.id}_${k}`] || 0;
        return `<div onclick="window.openLesson('${unit.id}','${k}')" style="padding:16px;border-radius:12px;background:${done ? 'rgba(232,180,56,0.08)' : 'rgba(255,255,255,0.03)'};border:1px solid ${done ? 'rgba(232,180,56,0.3)' : 'rgba(255,255,255,0.08)'};cursor:pointer;transition:all 0.2s" onmouseover="this.style.borderColor='${lcolors[k]}55'" onmouseout="this.style.borderColor='${done ? 'rgba(232,180,56,0.3)' : 'rgba(255,255,255,0.08)'}'">
                <div style="font-size:1.2rem;font-weight:800;color:${lcolors[k]};margin-bottom:4px">${k}</div>
                <div style="font-size:0.8rem;color:#e8ecff">${lnames[k]}</div>
                ${done ? `<div style="font-size:0.72rem;color:#34d399;margin-top:4px">✅ ${sc}%</div>` : '<div style="font-size:0.72rem;color:#666;margin-top:4px">▶ Boshlash</div>'}
            </div>`;
    }).join('')}
      </div>
      <div>
        <div style="font-size:0.78rem;color:#666;margin-bottom:8px">📝 So'zlar:</div>
        <div style="display:flex;flex-wrap:wrap;gap:6px">
          ${unit.words.map(w => `<span onclick="window.spk('${w.replace(/'/g, "\\'")}',event)" style="background:rgba(232,180,56,0.1);border:1px solid rgba(232,180,56,0.25);color:#e8b438;padding:4px 10px;border-radius:20px;font-size:0.76rem;cursor:pointer;direction:rtl">${w} 🔊</span>`).join('')}
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
        <span style="margin-left:auto;font-size:0.72rem;color:#e8b438;background:rgba(232,180,56,0.1);padding:3px 10px;border-radius:20px">${unit.level}</span>
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
        const wd = WDB.find(x => x.a === w) || { ex: `استخدم الكلمة "${w}".`, eu: '', u: '' };
        const blank = wd.ex.replace(w, '_______');
        return `<div style="margin-bottom:14px;padding:14px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:12px">
          <div style="font-size:0.9rem;margin-bottom:4px;direction:rtl">${i + 1}. ${blank}</div>
          <div style="font-size:0.75rem;color:#666;margin-bottom:8px;font-style:italic">${wd.eu}</div>
          <input id="gex${i}" data-ans="${w}" placeholder="Javobingiz (arabcha)..." dir="rtl" style="width:100%;padding:8px 12px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:8px;color:#e8ecff;font-family:inherit;margin-bottom:8px;box-sizing:border-box;font-size:1rem">
          <div style="display:flex;gap:6px">
            <button onclick="window.chkFill(${i})" style="padding:6px 14px;border-radius:8px;background:rgba(52,211,153,0.1);border:1px solid rgba(52,211,153,0.3);color:#34d399;cursor:pointer;font-size:0.78rem;font-family:inherit">✓ Tekshir</button>
            <button onclick="window.aiExWord('${w.replace(/'/g, "\\'")}',event)" style="padding:6px 14px;border-radius:8px;background:rgba(232,180,56,0.1);border:1px solid rgba(232,180,56,0.25);color:#e8b438;cursor:pointer;font-size:0.78rem;font-family:inherit">🤖 AI</button>
            <button onclick="window.spk('${w.replace(/'/g, "\\'")}',event)" style="padding:6px 14px;border-radius:8px;background:rgba(96,165,250,0.1);border:1px solid rgba(96,165,250,0.2);color:#60a5fa;cursor:pointer;font-size:0.78rem;font-family:inherit">🔊</button>
          </div>
          <div id="gexfb${i}" style="margin-top:6px;font-size:0.8rem"></div>
        </div>`;
    }).join('');

    const matchW = words.slice(0, 6);
    const shuffUZ = shuffle(matchW.map(w => { const d = WDB.find(x => x.a === w); return d ? d.u : w; }));

    return `
    <div style="margin-bottom:20px">
      <h3 style="margin-bottom:12px;color:#e8ecff">📚 So'zlar lug'ati</h3>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:10px">
        ${words.map(w => {
        const d = WDB.find(x => x.a === w) || { u: '', t: '', ex: '', eu: '' };
        return `<div style="padding:14px;border-radius:12px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06)">
              <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px">
                <button onclick="window.spk('${w.replace(/'/g, "\\'")}',event)" style="background:none;border:none;cursor:pointer;font-size:1rem">🔊</button>
                <span style="font-weight:700;font-size:1.1rem;color:#e8ecff;direction:rtl">${w}</span>
              </div>
              <div style="color:#e8b438;font-size:0.82rem;margin-bottom:3px;text-align:center">${d.u}</div>
              <div style="color:#666;font-size:0.72rem;font-style:italic;direction:rtl;text-align:right">"${d.ex}"</div>
            </div>`;
    }).join('')}
      </div>
    </div>
    <div style="margin-bottom:20px;padding:16px;background:rgba(232,180,56,0.06);border:1px solid rgba(232,180,56,0.15);border-radius:12px">
      <h3 style="margin-bottom:10px;color:#e8ecff">📝 Grammatika Qoidasi</h3>
      <div style="font-size:0.9rem;color:#e8b438;margin-bottom:8px">💡 ${unit.grammar_rule || ''}</div>
      <div style="font-size:0.85rem;color:#fbbf24;font-style:italic;direction:rtl">${unit.grammar_example || ''}</div>
      <button onclick="window.aiGrammarExplain('${unit.title}','${(unit.grammar_rule || '').replace(/'/g, "\\'")}')" style="margin-top:10px;padding:8px 16px;border-radius:8px;background:rgba(232,180,56,0.1);border:1px solid rgba(232,180,56,0.25);color:#e8b438;cursor:pointer;font-size:0.78rem;font-family:inherit">🤖 AI batafsil tushuntirsin (1 token)</button>
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
        <div>${matchW.map((w, i) => `<div class="match-item eng" data-i="${i}" onclick="window.selMatch(this,'e',${i})" style="padding:10px 14px;border-radius:10px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);cursor:pointer;margin-bottom:6px;font-size:1rem;color:#e8ecff;transition:all 0.2s;direction:rtl;text-align:right">${w}</div>`).join('')}</div>
        <div>${shuffUZ.map(u => `<div class="match-item uz" data-u="${u}" onclick="window.selMatch(this,'u','${u.replace(/'/g, "\\'")}')" style="padding:10px 14px;border-radius:10px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);cursor:pointer;margin-bottom:6px;font-size:0.88rem;color:#e8b438;transition:all 0.2s">${u}</div>`).join('')}</div>
      </div>
      <div id="matchFB" style="margin-top:8px;font-size:0.8rem"></div>
    </div>
    <button onclick="window.finLessonA('${unit.id}')" style="width:100%;padding:14px;border-radius:12px;background:linear-gradient(135deg,#e8b438,#f5c842);border:none;color:#000;font-size:0.95rem;font-weight:700;cursor:pointer;font-family:inherit">✅ Grammatika darsini yakunlash</button>`;
}

window.chkFill = function (i) {
    const inp = $id(`gex${i}`); const fb = $id(`gexfb${i}`);
    if (!inp || !fb) return;
    if (inp.value.trim() === inp.dataset.ans) {
        fb.innerHTML = `<span style="color:#34d399">✅ To'g'ri! "${inp.dataset.ans}"</span>`;
        inp.style.borderColor = '#34d399'; lScore++; awardXP(10, 'grammar');
    } else {
        fb.innerHTML = `<span style="color:#ef4444">❌ To'g'ri javob: <strong dir="rtl">${inp.dataset.ans}</strong></span>`;
        inp.style.borderColor = '#ef4444';
    }
    lTotal++;
};

window.selMatch = function (el, type, val) {
    if (type === 'e') {
        document.querySelectorAll('.match-item.eng').forEach(x => { x.style.borderColor = 'rgba(255,255,255,0.1)'; x.style.background = 'rgba(255,255,255,0.04)'; });
        el.style.background = 'rgba(232,180,56,0.2)'; el.style.borderColor = '#e8b438';
        mSel.e = val; mSel.eEl = el;
    } else {
        document.querySelectorAll('.match-item.uz').forEach(x => { x.style.borderColor = 'rgba(255,255,255,0.1)'; x.style.background = 'rgba(255,255,255,0.04)'; });
        el.style.background = 'rgba(232,180,56,0.15)'; el.style.borderColor = '#f5c842';
        mSel.u = val; mSel.uEl = el;
    }
    if (mSel.e !== null && mSel.u !== null) {
        const w = (curUnit?.words || [])[mSel.e];
        const wd = WDB.find(x => x.a === w);
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
    const r = await callAI(`"${title}" mavzusida "${rule}" arab tili grammatika qoidasini ${NATIVE_LANG} tilida (javob shu tilda bo'lsin) tushuntir. 3 ta arab tilidagi misol keltir.`, 800);
    if (fb) fb.innerHTML = r.replace(/\n/g, '<br>');
};

window.aiExWord = async function (word, e) {
    if (e) e.stopPropagation();
    const ok = await spendTokens(TOKEN_CONFIG.ai_cost, `"${word}" AI izoh`); if (!ok) return;
    const fb = $id('vocabAIFB') || $id('wordAIFB');
    if (fb) fb.innerHTML = `🤖 "${word}" tahlil qilmoqda...`;
    const r = await callAI(`"${word}" arabcha so'zini ${NATIVE_LANG} tilida (javob shu tilda bo'lsin): 1) Ma'nosi 2) 3 misol 3) Eslatma`, 600);
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
        <button onclick="window.playDict('${unit.id}','normal')" style="padding:8px 16px;border-radius:8px;background:rgba(232,180,56,0.1);border:1px solid rgba(232,180,56,0.2);color:#e8b438;cursor:pointer;font-size:0.82rem;font-family:inherit">▶ Eshitish</button>
        <button onclick="window.playDict('${unit.id}','slow')" style="padding:8px 16px;border-radius:8px;background:rgba(96,165,250,0.1);border:1px solid rgba(96,165,250,0.2);color:#60a5fa;cursor:pointer;font-size:0.82rem;font-family:inherit">🐌 Sekin</button>
      </div>
      <textarea id="dictIn" placeholder="Eshitgangizni arabcha yozing..." dir="rtl" style="width:100%;height:80px;padding:10px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:8px;color:#e8ecff;font-family:inherit;resize:none;box-sizing:border-box;font-size:1rem"></textarea>
      <div style="display:flex;gap:6px;margin-top:8px">
        <button onclick="window.chkDict()" style="padding:7px 14px;border-radius:8px;background:rgba(52,211,153,0.1);border:1px solid rgba(52,211,153,0.3);color:#34d399;cursor:pointer;font-size:0.78rem;font-family:inherit">✓ Tekshir</button>
        <button onclick="window.aiChkDict()" style="padding:7px 14px;border-radius:8px;background:rgba(232,180,56,0.1);border:1px solid rgba(232,180,56,0.25);color:#e8b438;cursor:pointer;font-size:0.78rem;font-family:inherit">🤖 AI tahlil (1 token)</button>
      </div>
      <div id="dictFB" style="margin-top:8px;font-size:0.8rem"></div>
    </div>
    <button onclick="window.finLessonB('${unit.id}')" style="width:100%;padding:14px;border-radius:12px;background:linear-gradient(135deg,#22d3ee,#e8b438);border:none;color:#000;font-size:0.95rem;font-weight:700;cursor:pointer;font-family:inherit">✅ Listening yakunlash</button>`;
}

function genListenExs(unit) {
    const w = unit.words;
    return [
        { text: `اليوم نتحدث عن ${unit.title}. كلمة "${w[0]}" مهمة جداً في اللغة العربية.`, q: `Bu matn asosan nima haqida?`, opts: [unit.title, 'Sport', 'Ovqat', 'Sayohat'], c: 0, tip: `"اليوم نتحدث عن..."` },
        { text: `مرحباً! اسمي فاطمة. اليوم سأعلمكم عن ${w[0]}. أولاً، لنتحدث عن "${w[0]}". هل أنتم مستعدون؟`, q: `Fatima birinchi nima haqida o'rgatadi?`, opts: [`${w[2] || w[0]}`, `${w[0]}`, `${w[1] || w[0]}`, 'Hamma narsa'], c: 1, tip: `"أولاً، لنتحدث عن..."` },
        { text: `${unit.title} موضوع رائع. إذا أردت تحسين عربيتك، تدرّب كل يوم. مع الممارسة يصبح الأمر سهلاً.`, q: `Mashq bilan nima osonlashadi?`, opts: [`${w[0]}`, `${w[1] || w[0]}`, 'Arabcha', 'Hech narsa'], c: 2, tip: `"...مع الممارسة يصبح الأمر سهلاً"` }
    ];
}

function renderLex(exs, idx) {
    const ex = exs[idx];
    if (!ex) return '<div style="text-align:center;padding:20px;color:#34d399">🎉 Barcha listening mashqlari tugadi!</div>';
    return `<div style="padding:16px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:12px">
      <div style="font-size:0.75rem;color:#e8b438;margin-bottom:8px">Savol ${idx + 1}/${exs.length}</div>
      <div style="display:flex;gap:8px;margin-bottom:12px">
        <button onclick="window.playLex(${idx},'normal')" style="padding:8px 16px;border-radius:8px;background:rgba(232,180,56,0.1);border:1px solid rgba(232,180,56,0.2);color:#e8b438;cursor:pointer;font-size:0.82rem;font-family:inherit">▶ Tinglash</button>
        <button onclick="window.playLex(${idx},'slow')" style="padding:8px 16px;border-radius:8px;background:rgba(96,165,250,0.1);border:1px solid rgba(96,165,250,0.2);color:#60a5fa;cursor:pointer;font-size:0.82rem;font-family:inherit">🐌 Sekin</button>
      </div>
      <div id="ltxt${idx}" style="display:none;padding:10px;background:rgba(255,255,255,0.04);border-radius:8px;font-size:1rem;color:#e8ecff;margin-bottom:10px;font-style:italic;direction:rtl;text-align:right">${ex.text}</div>
      <div style="font-weight:600;margin-bottom:10px">${ex.q}</div>
      <div>${ex.opts.map((o, oi) => `<div class="lex-opt" data-qi="${idx}" data-oi="${oi}" onclick="window.selLex(this,${idx},${oi})" style="padding:10px 14px;border-radius:8px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);cursor:pointer;margin-bottom:6px;font-size:0.88rem;transition:all 0.2s">${String.fromCharCode(65 + oi)}. ${o}</div>`).join('')}</div>
      <div style="font-size:0.75rem;color:#666;margin-bottom:10px">💡 ${ex.tip}</div>
      <div style="display:flex;gap:6px">
        <button onclick="window.chkLex(${idx},${ex.c})" style="padding:7px 14px;border-radius:8px;background:rgba(52,211,153,0.1);border:1px solid rgba(52,211,153,0.3);color:#34d399;cursor:pointer;font-size:0.78rem;font-family:inherit">✓ Tekshir</button>
        ${idx + 1 < exs.length ? `<button onclick="window.nextLex(${idx + 1})" id="lexnxt${idx}" style="display:none;padding:7px 14px;border-radius:8px;background:rgba(232,180,56,0.1);border:1px solid rgba(232,180,56,0.2);color:#e8b438;cursor:pointer;font-size:0.78rem;font-family:inherit">→ Keyingi</button>` : ''}
      </div>
      <div id="lexfb${idx}" style="margin-top:8px;font-size:0.8rem"></div>
    </div>`;
}

window.playLex = function (idx, speed) {
    const exs = window.__listenExs || []; if (!exs[idx]) return;
    const u = new SpeechSynthesisUtterance(exs[idx].text);
    u.lang = 'ar-SA'; u.rate = speed === 'slow' ? 0.55 : 0.8;
    speechSynthesis.cancel(); speechSynthesis.speak(u);
};
window.selLex = function (el, qi, oi) {
    document.querySelectorAll(`.lex-opt[data-qi="${qi}"]`).forEach(o => { o.style.background = 'rgba(255,255,255,0.04)'; o.style.borderColor = 'rgba(255,255,255,0.08)'; });
    el.style.background = 'rgba(232,180,56,0.15)'; el.style.borderColor = '#e8b438';
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
    else { if (fb) fb.innerHTML = `<span style="color:#ef4444">❌ To'g'ri: <strong>${String.fromCharCode(65 + correct)}</strong></span>`; }
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
    const wd = WDB.find(x => x.a === unit.words[0]);
    dictSent = wd ? wd.ex : `${unit.words[0]} مهم جداً.`;
    const u2 = new SpeechSynthesisUtterance(dictSent);
    u2.lang = 'ar-SA'; u2.rate = speed === 'slow' ? 0.5 : 0.8;
    speechSynthesis.cancel(); speechSynthesis.speak(u2);
};
window.chkDict = function () {
    const inp = $id('dictIn'); const fb = $id('dictFB');
    if (!inp || !fb || !dictSent) { if (fb) fb.innerHTML = '<span style="color:#f5c842">⚠️ Avval audio tinglang!</span>'; return; }
    const userTrimmed = inp.value.trim();
    const correct = dictSent.trim();
    const pct = userTrimmed === correct ? 100 : Math.round((userTrimmed.length / correct.length) * 80);
    fb.innerHTML = `<div><strong>To'g'ri:</strong> <span dir="rtl">${correct}</span></div><div style="margin-top:6px"><strong>Siz:</strong> <span dir="rtl">${userTrimmed}</span></div><div style="font-size:0.9rem;font-weight:700;margin-top:6px;color:${pct >= 70 ? '#34d399' : '#ef4444'}">${pct}%</div>`;
    if (pct >= 70) { lScore++; awardXP(20, 'listening'); }
    lTotal++;
};
window.aiChkDict = async function () {
    const ok = await spendTokens(TOKEN_CONFIG.ai_cost, 'AI diktant tahlil'); if (!ok) return;
    const inp = $id('dictIn'); const fb = $id('dictFB');
    if (!inp?.value.trim()) { if (fb) fb.innerHTML = '<span style="color:#f5c842">Avval yozing!</span>'; return; }
    fb.innerHTML = '🤖 AI tahlil qilmoqda...';
    const r = await callAI(`Arabcha diktant tahlili ${NATIVE_LANG} tilida (javob shu tilda bo'lsin):\nAsl: "${dictSent}"\nO'quvchi: "${inp.value.trim()}"\n1) Xatolari 2) Ball: /10 3) Maslahat`, 600);
    fb.innerHTML = r.replace(/\n/g, '<br>');
};
window.finLessonB = async function (uid) { await finLesson(uid, 'B', 'listening', lScore, lTotal || 3); };

// ─── LESSON C ───
function lessonC(unit) {
    const qs = unit.reading_qs || [];
    const wh = unit.words.slice(0, 5);
    return `
    <div style="margin-bottom:20px">
      <h3 style="margin-bottom:12px;color:#e8ecff">📖 Matn o'qish</h3>
      <div style="padding:16px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:12px">
        <div style="font-weight:700;font-size:1rem;margin-bottom:10px;color:#e8ecff;direction:rtl;text-align:right">${unit.title}</div>
        <div id="rdbody" style="font-size:0.95rem;line-height:2;color:#c7d2fe;direction:rtl;text-align:right">${unit.reading_text || ''}</div>
        <div style="display:flex;gap:6px;margin-top:12px">
          <button onclick="window.rdAloud()" style="padding:7px 14px;border-radius:8px;background:rgba(232,180,56,0.1);border:1px solid rgba(232,180,56,0.2);color:#e8b438;cursor:pointer;font-size:0.78rem;font-family:inherit">🔊 Tinglash</button>
        </div>
      </div>
    </div>
    <div style="margin-bottom:20px">
      <h3 style="margin-bottom:12px;color:#e8ecff">❓ Savolar</h3>
      ${qs.map((q, qi) => `<div style="margin-bottom:14px;padding:14px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:12px">
        <div style="font-weight:600;margin-bottom:10px">${qi + 1}. ${q.q}</div>
        <div>${q.opts.map((o, oi) => `<div class="rq-opt" data-qi="${qi}" data-oi="${oi}" onclick="window.selRQ(this,${qi},${oi})" style="padding:10px 14px;border-radius:8px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);cursor:pointer;margin-bottom:6px;font-size:0.88rem;transition:all 0.2s">${String.fromCharCode(65 + oi)}. ${o}</div>`).join('')}</div>
        <div id="rqfb${qi}" style="margin-top:6px;font-size:0.8rem"></div>
      </div>`).join('')}
      <button onclick="window.chkAllRQ(${JSON.stringify(qs.map(q => q.c))})" style="padding:8px 16px;border-radius:8px;background:rgba(52,211,153,0.1);border:1px solid rgba(52,211,153,0.3);color:#34d399;cursor:pointer;font-size:0.82rem;font-family:inherit;margin-top:8px">✓ Hammasini tekshir</button>
      <div id="rdTotFB" style="margin-top:8px;font-size:0.8rem"></div>
    </div>
    <div style="margin-bottom:20px">
      <h3 style="margin-bottom:12px;color:#e8ecff">🔤 So'z yozish</h3>
      ${wh.map((w, i) => {
        const d = WDB.find(x => x.a === w) || { u: w };
        return `<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
          <span style="color:#e8b438;font-size:0.85rem;min-width:100px">${d.u}</span>
          <input id="whi${i}" data-ans="${w}" placeholder="arabcha..." dir="rtl" style="flex:1;padding:8px 12px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:8px;color:#e8ecff;font-family:inherit;font-size:1rem">
          <button onclick="window.chkWH(${i})" style="padding:7px 12px;border-radius:8px;background:rgba(52,211,153,0.1);border:1px solid rgba(52,211,153,0.3);color:#34d399;cursor:pointer;font-size:0.78rem;font-family:inherit">✓</button>
          <button onclick="window.spk('${w.replace(/'/g, "\\'")}',event)" style="padding:7px 12px;border-radius:8px;background:rgba(232,180,56,0.1);border:1px solid rgba(232,180,56,0.2);color:#e8b438;cursor:pointer;font-size:0.78rem;font-family:inherit">🔊</button>
          <span id="whfb${i}" style="font-size:0.8rem;min-width:30px"></span>
        </div>`;
    }).join('')}
    </div>
    <button onclick="window.finLessonC('${unit.id}')" style="width:100%;padding:14px;border-radius:12px;background:linear-gradient(135deg,#34d399,#22d3ee);border:none;color:#000;font-size:0.95rem;font-weight:700;cursor:pointer;font-family:inherit">✅ Reading yakunlash</button>`;
}

window.rdAloud = function () {
    const b = $id('rdbody'); if (!b) return;
    const u = new SpeechSynthesisUtterance(b.textContent);
    u.lang = 'ar-SA'; u.rate = 0.8;
    speechSynthesis.cancel(); speechSynthesis.speak(u);
};
window.selRQ = function (el, qi, oi) {
    document.querySelectorAll(`.rq-opt[data-qi="${qi}"]`).forEach(o => { o.style.background = 'rgba(255,255,255,0.04)'; o.style.borderColor = 'rgba(255,255,255,0.08)'; });
    el.style.background = 'rgba(232,180,56,0.15)'; el.style.borderColor = '#e8b438';
    rSel[qi] = oi;
};
window.chkAllRQ = function (answers) {
    let score = 0;
    answers.forEach((correct, qi) => {
        const sel = rSel[qi]; const fb = $id(`rqfb${qi}`);
        if (sel === undefined) { if (fb) fb.innerHTML = '<span style="color:#f5c842">⚠️ Javob tanlang!</span>'; return; }
        document.querySelectorAll(`.rq-opt[data-qi="${qi}"]`).forEach((o, i) => {
            if (i === correct) { o.style.background = 'rgba(52,211,153,0.2)'; o.style.borderColor = '#34d399'; }
            else if (i === sel && sel !== correct) { o.style.background = 'rgba(239,68,68,0.2)'; o.style.borderColor = '#ef4444'; }
        });
        if (sel === correct) { score++; if (fb) fb.innerHTML = '<span style="color:#34d399">✅ To\'g\'ri!</span>'; }
        else { if (fb) fb.innerHTML = `<span style="color:#ef4444">❌ To'g'ri: ${String.fromCharCode(65 + correct)}</span>`; }
    });
    lScore += score; lTotal += answers.length;
    awardXP(score * 15, 'reading');
    const fb = $id('rdTotFB');
    if (fb) fb.innerHTML = `<span style="color:${score === answers.length ? '#34d399' : '#f5c842'}">Jami: ${score}/${answers.length}</span>`;
};
window.chkWH = function (i) {
    const inp = $id(`whi${i}`); const fb = $id(`whfb${i}`); if (!inp || !fb) return;
    if (inp.value.trim() === inp.dataset.ans) {
        fb.innerHTML = '✅'; inp.style.borderColor = '#34d399'; awardXP(8, 'writing');
    } else { fb.innerHTML = '❌'; inp.style.borderColor = '#ef4444'; }
};
window.finLessonC = async function (uid) { await finLesson(uid, 'C', 'reading', lScore, lTotal || 6); };

// ─── LESSON D ───
function lessonD(unit) {
    const topics = unit.words.slice(0, 3);
    const woSent = (WDB.find(x => x.a === unit.words[0])?.ex) || `أستخدم ${unit.words[0]} كل يوم.`;
    window.__woCorrect = woSent;
    return `
    <div style="margin-bottom:20px">
      <h3 style="margin-bottom:12px;color:#e8ecff">🎤 Speaking Mashqi</h3>
      ${topics.map((w, i) => {
        const d = WDB.find(x => x.a === w) || { u: '', ex: '' };
        return `<div style="margin-bottom:14px;padding:14px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:12px">
          <div style="font-weight:600;margin-bottom:4px">${i + 1}. "<span dir="rtl">${w}</span>" so'zini ishlatib gaping:</div>
          <div style="font-size:0.78rem;color:#666;margin-bottom:10px">O'zbek: ${d.u} · Misol: <span dir="rtl">${d.ex}</span></div>
          <div style="display:flex;gap:6px;margin-bottom:8px">
            <button id="mbtn${i}" onclick="window.togMic(${i})" style="padding:8px 16px;border-radius:8px;background:rgba(244,114,182,0.1);border:1px solid rgba(244,114,182,0.25);color:#f472b6;cursor:pointer;font-size:0.82rem;font-family:inherit">🎤 Gapirish</button>
            <button onclick="window.spk('${w.replace(/'/g, "\\'")}',event)" style="padding:8px 12px;border-radius:8px;background:rgba(232,180,56,0.1);border:1px solid rgba(232,180,56,0.2);color:#e8b438;cursor:pointer;font-size:0.82rem;font-family:inherit">🔊</button>
          </div>
          <div id="mst${i}" style="font-size:0.75rem;color:#666"></div>
          <div id="mtr${i}" style="padding:8px;font-size:0.88rem;color:#e8b438;min-height:24px;border-radius:6px;direction:rtl;text-align:right"></div>
          <div style="display:flex;gap:6px;margin-top:8px">
            <button onclick="window.aiSpk(${i},'${w.replace(/'/g, "\\'")}')" style="padding:6px 14px;border-radius:8px;background:rgba(232,180,56,0.1);border:1px solid rgba(232,180,56,0.25);color:#e8b438;cursor:pointer;font-size:0.78rem;font-family:inherit">🤖 AI baholash (1 token)</button>
            <button onclick="window.markDone(${i})" style="padding:6px 14px;border-radius:8px;background:rgba(52,211,153,0.1);border:1px solid rgba(52,211,153,0.3);color:#34d399;cursor:pointer;font-size:0.78rem;font-family:inherit">✅ Bajarildi</button>
          </div>
          <div id="sfb${i}" style="margin-top:8px;font-size:0.82rem"></div>
        </div>`;
    }).join('')}
    </div>
    <div style="margin-bottom:20px">
      <h3 style="margin-bottom:12px;color:#e8ecff">✍️ Writing Mashqi</h3>
      <div style="padding:14px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:12px">
        <div style="font-size:0.85rem;color:#aaa;margin-bottom:8px">Mavzu: "<span dir="rtl">${unit.title}</span>" haqida 30+ so'zli arabcha matn yozing.</div>
        <textarea id="dta" placeholder="Bu yerda arabcha yozing..." dir="rtl" oninput="window.updWC()" style="width:100%;height:100px;padding:10px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:8px;color:#e8ecff;font-family:inherit;resize:none;box-sizing:border-box;font-size:1rem"></textarea>
        <div style="display:flex;gap:10px;font-size:0.75rem;color:#666;margin:6px 0"><span id="dwc">0 so'z</span><span id="dst" style="color:#f87171">Min 30 so'z</span></div>
        <div style="display:flex;gap:6px">
          <button onclick="window.aiWrit('${unit.title.replace(/'/g, "\\'")}','${unit.words.slice(0, 5).join(",")}')" style="padding:7px 14px;border-radius:8px;background:rgba(232,180,56,0.1);border:1px solid rgba(232,180,56,0.25);color:#e8b438;cursor:pointer;font-size:0.78rem;font-family:inherit">🤖 AI (1 token)</button>
          <button onclick="window.selfChk(30)" style="padding:7px 14px;border-radius:8px;background:rgba(96,165,250,0.1);border:1px solid rgba(96,165,250,0.2);color:#60a5fa;cursor:pointer;font-size:0.78rem;font-family:inherit">📊 So'z soni</button>
        </div>
        <div id="wfb" style="margin-top:8px;font-size:0.8rem"></div>
      </div>
    </div>
    <div style="margin-bottom:20px">
      <h3 style="margin-bottom:12px;color:#e8ecff">🔀 So'z Tartibi</h3>
      <div id="woChips" style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px">
        ${shuffle(woSent.split(' ')).map(w => `<div class="wo-chip" data-w="${w}" onclick="window.selChip(this)" style="background:rgba(232,180,56,0.1);border:1px solid rgba(232,180,56,0.25);color:#e8b438;padding:6px 12px;border-radius:20px;cursor:pointer;font-size:0.95rem;direction:rtl">${w}</div>`).join('')}
      </div>
      <div id="woAnsDiv" style="min-height:40px;padding:10px;background:rgba(255,255,255,0.03);border:1px dashed rgba(255,255,255,0.1);border-radius:8px;display:flex;flex-wrap:wrap;gap:6px;font-size:0.88rem;color:#666;margin-bottom:8px;direction:rtl"><span>Bu yerga bosing...</span></div>
      <div style="display:flex;gap:6px">
        <button onclick="window.chkWO()" style="padding:7px 14px;border-radius:8px;background:rgba(52,211,153,0.1);border:1px solid rgba(52,211,153,0.3);color:#34d399;cursor:pointer;font-size:0.78rem;font-family:inherit">✓ Tekshir</button>
        <button onclick="window.rstWO()" style="padding:7px 14px;border-radius:8px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);color:#e8ecff;cursor:pointer;font-size:0.78rem;font-family:inherit">🔄 Qayta</button>
        <button onclick="window.spk('${woSent.replace(/'/g, "\\'")}',event)" style="padding:7px 14px;border-radius:8px;background:rgba(232,180,56,0.1);border:1px solid rgba(232,180,56,0.2);color:#e8b438;cursor:pointer;font-size:0.78rem;font-family:inherit">🔊</button>
      </div>
      <div id="wofb" style="margin-top:8px;font-size:0.8rem"></div>
    </div>
    <button onclick="window.finLessonD('${unit.id}')" style="width:100%;padding:14px;border-radius:12px;background:linear-gradient(135deg,#f472b6,#e8b438);border:none;color:#000;font-size:0.95rem;font-weight:700;cursor:pointer;font-family:inherit">✅ Speaking & Writing yakunlash</button>`;
}

window.selChip = function (el) {
    if (el.classList.contains('used')) return;
    el.classList.add('used'); el.style.opacity = '0.3';
    woAns.push(el.dataset.w);
    const d = $id('woAnsDiv');
    if (d) d.innerHTML = woAns.map((w, i) => `<span onclick="window.rmChip(${i})" style="background:rgba(232,180,56,0.15);border:1px solid rgba(232,180,56,0.3);border-radius:20px;padding:6px 12px;cursor:pointer;font-size:0.9rem;direction:rtl">${w}</span>`).join('') || '<span style="color:#666">Bu yerga bosing...</span>';
};
window.rmChip = function (idx) {
    const w = woAns[idx]; woAns.splice(idx, 1);
    document.querySelectorAll('.wo-chip').forEach(c => { if (c.dataset.w === w && c.classList.contains('used')) { c.classList.remove('used'); c.style.opacity = '1'; return; } });
    const d = $id('woAnsDiv');
    if (d) d.innerHTML = woAns.map((w, i) => `<span onclick="window.rmChip(${i})" style="background:rgba(232,180,56,0.15);border:1px solid rgba(232,180,56,0.3);border-radius:20px;padding:6px 12px;cursor:pointer;font-size:0.9rem;direction:rtl">${w}</span>`).join('') || '<span style="color:#666">Bu yerga bosing...</span>';
};
window.rstWO = function () {
    woAns = [];
    document.querySelectorAll('.wo-chip').forEach(c => { c.classList.remove('used'); c.style.opacity = '1'; });
    const d = $id('woAnsDiv'); if (d) d.innerHTML = '<span style="color:#666">Bu yerga bosing...</span>';
};
window.chkWO = function () {
    const fb = $id('wofb');
    if (!woAns.length) { if (fb) fb.innerHTML = '<span style="color:#f5c842">⚠️ So\'zlarni tartibga qo\'ying!</span>'; return; }
    if (woAns.join(' ') === (window.__woCorrect || '')) {
        if (fb) fb.innerHTML = '<span style="color:#34d399">🏆 Mukammal!</span>';
        awardXP(15, 'writing'); lScore++;
    } else { if (fb) fb.innerHTML = `<span style="color:#ef4444">❌ To'g'ri: <em dir="rtl">${window.__woCorrect}</em></span>`; }
    lTotal++;
};
window.togMic = function (idx) {
    const btn = $id(`mbtn${idx}`); const st = $id(`mst${idx}`); const tr = $id(`mtr${idx}`);
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
        if (tr) tr.innerHTML = `<textarea dir="rtl" style="width:100%;padding:8px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:8px;color:#e8ecff;font-family:inherit;font-size:1rem" id="man${idx}" placeholder="Arabcha yozing..."></textarea>`;
        if (st) st.textContent = '⌨️ Yozma kiritish'; return;
    }
    if (lessonMics[idx]) { try { lessonMics[idx].stop(); } catch (e) { } lessonMics[idx] = null; if (btn) btn.innerHTML = '🎤 Gapirish'; return; }
    const rec = new SR(); rec.lang = 'ar-SA'; rec.continuous = true; rec.interimResults = true;
    rec.onresult = e => { let t = ''; for (let i = e.resultIndex; i < e.results.length; i++) t += e.results[i][0].transcript; if (tr && tr.tagName !== 'TEXTAREA') tr.textContent = t; };
    rec.onerror = e => { if (btn) btn.innerHTML = '🎤 Gapirish'; lessonMics[idx] = null; };
    rec.onend = () => { if (btn) btn.innerHTML = '🎤 Gapirish'; if (st) st.innerHTML = '✅ Yozib olindi'; lessonMics[idx] = null; };
    try {
        rec.start(); lessonMics[idx] = rec;
        if (btn) btn.innerHTML = '⏹ To\'xtatish';
        if (st) st.innerHTML = '🔴 Yozmoqda...';
    } catch (e) {
        if (tr) tr.innerHTML = `<textarea dir="rtl" style="width:100%;padding:8px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:8px;color:#e8ecff;font-family:inherit;font-size:1rem" id="man${idx}" placeholder="Arabcha yozing..."></textarea>`;
    }
};
window.aiSpk = async function (idx, topic) {
    const ok = await spendTokens(TOKEN_CONFIG.ai_cost, 'AI speaking baholash'); if (!ok) return;
    const tr = $id(`mtr${idx}`); const man = $id(`man${idx}`); const fb = $id(`sfb${idx}`);
    let text = '';
    if (tr) text = tr.tagName === 'TEXTAREA' ? tr.value.trim() : tr.textContent.trim();
    if (!text && man) text = man.value.trim();
    if (!text) { if (fb) fb.innerHTML = '<span style="color:#f5c842">⚠️ Avval gapiring!</span>'; return; }
    if (fb) fb.innerHTML = '🤖 Baholayapti...';
    const r = await callAI(`Arabcha speaking baholash. Mavzu: "${topic}". O'quvchi: "${text}".\n${NATIVE_LANG} tilida (javob shu tilda bo'lsin): 1) ✅ Yaxshi tomonlar 2) ❌ Xatoliklar 3) 🔄 Tuzatilgan variant 4) ⭐ /10`, 700);
    if (fb) fb.innerHTML = r.replace(/\n/g, '<br>');
    lScore++; lTotal++; awardXP(20, 'speaking');
};
window.markDone = function (idx) { lScore++; lTotal++; awardXP(10, 'speaking'); showToast('✅ Bajarildi!', 'success'); };
window.updWC = function () {
    const ta = $id('dta'); if (!ta) return;
    const w = ta.value.trim() ? ta.value.trim().split(/\s+/).length : 0;
    const wc = $id('dwc'); const st = $id('dst');
    if (wc) wc.textContent = w + " so'z";
    if (st) { st.textContent = w >= 30 ? '✅ Yetarli' : `Min 30 (${w}/30)`; st.style.color = w >= 30 ? '#34d399' : '#f87171'; }
};
window.selfChk = function (min) {
    const ta = $id('dta'); const fb = $id('wfb'); if (!ta || !fb) return;
    const w = ta.value.trim() ? ta.value.trim().split(/\s+/).length : 0;
    if (w >= min) { fb.innerHTML = `<span style="color:#34d399">✅ ${w} so'z!</span>`; lScore++; awardXP(15, 'writing'); }
    else { fb.innerHTML = `<span style="color:#f87171">⚠️ ${min - w} so'z kam!</span>`; }
    lTotal++;
};
window.aiWrit = async function (title, words) {
    const ok = await spendTokens(TOKEN_CONFIG.ai_cost, 'AI writing'); if (!ok) return;
    const ta = $id('dta'); const fb = $id('wfb');
    if (!ta?.value.trim()) { if (fb) fb.innerHTML = '<span style="color:#f5c842">Avval yozing!</span>'; return; }
    fb.innerHTML = '🤖 Tekshirmoqda...';
    const r = await callAI(`Arabcha writing tekshirish. Mavzu: "${title}" (so'zlar: ${words}).\nMatn: "${ta.value.trim()}"\n${NATIVE_LANG} tilida (javob shu tilda bo'lsin): 1) Grammatika 2) Uslub 3) Tuzatilgan variant 4) Baho: /10`, 800);
    fb.innerHTML = r.replace(/\n/g, '<br>'); awardXP(20, 'writing');
};
window.finLessonD = async function (uid) { await finLesson(uid, 'D', 'speaking', lScore, lTotal || 3); };

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
    const lnames = { A: "Grammatika", B: 'Listening', C: 'Reading', D: 'Speaking' };
    const nxt = { A: 'B', B: 'C', C: 'D', D: null };
    const content = $id('modalContent'); if (!content) return;
    const circleColor = pct >= 80 ? '#34d399' : pct >= 60 ? '#f5c842' : '#ef4444';
    content.innerHTML = `<div style="text-align:center;padding:20px">
      <div style="width:120px;height:120px;border-radius:50%;background:${circleColor}22;border:3px solid ${circleColor};display:flex;flex-direction:column;align-items:center;justify-content:center;margin:0 auto 20px">
        <div style="font-size:1.8rem;font-weight:800;color:${circleColor}">${pct}%</div>
        <div style="font-size:0.72rem;color:${circleColor}">${lnames[lk]}</div>
      </div>
      <div style="display:flex;gap:16px;justify-content:center;margin:16px 0">
        <div style="padding:12px 20px;border-radius:12px;background:rgba(232,180,56,0.1);border:1px solid rgba(232,180,56,0.2)"><div style="font-size:0.7rem;color:#666">XP</div><div style="font-weight:700;color:#e8b438">+${xp}</div></div>
        <div style="padding:12px 20px;border-radius:12px;background:rgba(245,200,66,0.1);border:1px solid rgba(245,200,66,0.2)"><div style="font-size:0.7rem;color:#666">Coin</div><div style="font-weight:700;color:#f5c842">+${coin}</div></div>
      </div>
      <div style="font-size:1.2rem;margin-bottom:20px">${pct >= 80 ? '🏆 Mukammal!' : pct >= 60 ? '✅ Yaxshi!' : '💪 Qayta urining!'}</div>
      <div style="display:flex;flex-direction:column;gap:8px">
        ${nxt[lk] ? `<button onclick="window.openLesson('${uid}','${nxt[lk]}')" style="padding:12px;border-radius:12px;background:linear-gradient(135deg,#e8b438,#f5c842);border:none;color:#000;font-size:0.9rem;font-weight:700;cursor:pointer;font-family:inherit">→ Keyingi: ${lnames[nxt[lk]]}</button>` : `<div style="padding:14px;border-radius:12px;background:rgba(52,211,153,0.1);border:1px solid rgba(52,211,153,0.25);color:#34d399;font-weight:700">🎉 Unit to'liq bajarildi!</div>`}
        <button onclick="document.getElementById('unitModal').classList.remove('active');renderUnits()" style="padding:12px;border-radius:12px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);color:#e8ecff;cursor:pointer;font-size:0.9rem;font-family:inherit">🏠 Unitlarga qaytish</button>
      </div>
    </div>`;
    showXPPop(`+${xp} XP`);
    const modal = $id('unitModal'); if (modal) modal.classList.add('active');
}

// ══════════════════════════════════════════════════════════════
// WORDS
// ══════════════════════════════════════════════════════════════
function renderWords(reset = true) {
    if (reset) wOff = 0;
    const grid = $id('wordsGrid'); if (!grid) return;
    const filt = WDB.filter(w => {
        const ms = !wSrch || w.a.includes(wSrch) || w.u.toLowerCase().includes(wSrch.toLowerCase());
        const ml = wFilt === 'all' || w.l === wFilt;
        return ms && ml;
    });
    const slice = filt.slice(0, wOff + 30);
    if (reset) grid.innerHTML = '';
    slice.slice(wOff).forEach(w => {
        const card = document.createElement('div');
        card.style.cssText = 'padding:16px;border-radius:14px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);cursor:pointer;transition:all 0.2s';
        card.innerHTML = `<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px">
          <button onclick="window.spk('${w.a.replace(/'/g, "\\'")}',event)" style="background:none;border:none;cursor:pointer;font-size:1rem">🔊</button>
          <div style="font-weight:700;font-size:1.15rem;color:#e8ecff;direction:rtl">${w.a}</div>
        </div>
        <div style="font-size:0.82rem;color:#e8b438;margin-bottom:6px;text-align:center">${w.u}</div>
        <div style="display:flex;gap:6px;font-size:0.68rem;justify-content:center">
          <span style="background:rgba(255,255,255,0.05);padding:2px 8px;border-radius:8px;color:#666">${w.t}</span>
          <span style="background:rgba(255,255,255,0.05);padding:2px 8px;border-radius:8px;color:#666">${w.l}</span>
        </div>`;
        card.onmouseover = () => { card.style.background = 'rgba(232,180,56,0.08)'; card.style.borderColor = 'rgba(232,180,56,0.25)'; };
        card.onmouseout = () => { card.style.background = 'rgba(255,255,255,0.03)'; card.style.borderColor = 'rgba(255,255,255,0.08)'; };
        card.onclick = e => { if (e.target.closest('button')) return; openWModal(w); };
        grid.appendChild(card);
    });
    wOff = slice.length;
    const btn = $id('loadMoreBtn'); if (btn) btn.style.display = wOff >= filt.length ? 'none' : 'block';
}

window.filterWords = function () { wSrch = ($id('wordSearch')?.value || ''); renderWords(true); };
window.filterByLevel = function (level, el) { wFilt = level; document.querySelectorAll('.wf-tab').forEach(t => t.classList.remove('active')); if (el) el.classList.add('active'); renderWords(true); };
window.loadMoreWords = function () { renderWords(false); };

function openWModal(w) {
    const m = $id('wordModal'); const c = $id('wordModalContent'); if (!m || !c) return;
    c.innerHTML = `<div style="text-align:center;padding:20px">
      <div style="font-size:2.5rem;font-weight:800;color:#e8ecff;margin-bottom:8px;direction:rtl">${w.a}</div>
      <div style="font-size:1.1rem;color:#e8b438;margin-bottom:12px">${w.u}</div>
      <div style="font-size:0.82rem;color:#666;margin:0 0 4px">${w.t} · ${w.l}</div>
      <div style="padding:12px;background:rgba(255,255,255,0.04);border-radius:10px;margin-bottom:8px;font-size:0.95rem;color:#c7d2fe;direction:rtl;text-align:right">"${w.ex}"</div>
      <div style="color:#666;font-size:0.82rem;margin-bottom:16px;font-style:italic">${w.eu}</div>
      <div style="display:flex;gap:8px;justify-content:center">
        <button onclick="window.spk('${w.a.replace(/'/g, "\\'")}',event)" style="padding:8px 20px;border-radius:10px;background:rgba(232,180,56,0.15);border:1px solid rgba(232,180,56,0.3);color:#e8b438;cursor:pointer;font-family:inherit">🔊 Talaffuz</button>
        <button onclick="window.aiExWord('${w.a.replace(/'/g, "\\'")}',event)" style="padding:8px 20px;border-radius:10px;background:rgba(167,139,250,0.1);border:1px solid rgba(167,139,250,0.25);color:#a78bfa;cursor:pointer;font-family:inherit">🤖 AI (1 token)</button>
      </div>
      <div id="wordAIFB" style="margin-top:12px;font-size:0.82rem"></div>
    </div>`;
    m.classList.add('active');
}
window.closeWordModal = function (e) { if (!e || e.target === $id('wordModal')) $id('wordModal')?.classList.remove('active'); };

// ══════════════════════════════════════════════════════════════
// PRACTICE
// ══════════════════════════════════════════════════════════════
window.switchPractice = function (panel, el) {
    document.querySelectorAll('.practice-panel').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.ptab').forEach(b => b.classList.remove('active'));
    const p = $id('panel-' + panel); if (p) p.classList.add('active');
    if (el) el.classList.add('active');
};

// ── Flashcard ──
function initFlashcards() { flashDeck = shuffle([...WDB]).slice(0, 20); flashIdx = 0; flashCorrect = 0; flashWrong = 0; showFlash(); }
function showFlash() {
    if (flashIdx >= flashDeck.length) {
        const fw = $id('flashWord'); const fu = $id('flashUz');
        if (fw) fw.textContent = '🎉 Tugadi!';
        if (fu) fu.textContent = `To'g'ri: ${flashCorrect}, Noto'g'ri: ${flashWrong}`; return;
    }
    const w = flashDeck[flashIdx];
    const fc = $id('flashcard'); if (fc) fc.classList.remove('flipped');
    const fw = $id('flashWord'); if (fw) { fw.textContent = w.a; fw.style.direction = 'rtl'; }
    const fu = $id('flashUz'); if (fu) fu.textContent = w.u;
    const fe = $id('flashEx'); if (fe) { fe.textContent = w.ex || ''; fe.style.direction = 'rtl'; }
    const fp = $id('flashProgress'); if (fp) fp.textContent = (flashIdx + 1) + ' / ' + flashDeck.length;
    const fb = $id('flashBar'); if (fb) fb.style.width = Math.round((flashIdx / flashDeck.length) * 100) + '%';
}
window.flipCard = function () { const fc = $id('flashcard'); if (fc) fc.classList.toggle('flipped'); if (flashIdx < flashDeck.length) window.speakWord(flashDeck[flashIdx].a); };
window.flashResult = function (result) { if (result === 'correct') { flashCorrect++; awardXP(5, 'grammar'); } else flashWrong++; flashIdx++; showFlash(); };
window.nextFlash = function () { flashIdx++; showFlash(); };

// ── Quiz ──
function initQuiz() { quizScore = 0; const el = $id('quizScore'); if (el) el.textContent = 0; showQuizWord(); }
function showQuizWord() {
    quizAnswered = false;
    const pool = shuffle([...WDB]); curQuizWord = pool[0];
    const opts = shuffle([curQuizWord, ...pool.slice(1, 4)]);
    const type = Math.random() > 0.5 ? 'ar2uz' : 'uz2ar';
    const qEl = $id('quizQ');
    if (qEl) qEl.innerHTML = type === 'ar2uz'
        ? `<span dir="rtl">"${curQuizWord.a}"</span> = ?`
        : `"${curQuizWord.u}" = ?`;
    const optsEl = $id('quizOptions');
    if (optsEl) optsEl.innerHTML = opts.map(o => `<button class="quiz-opt" onclick="window.checkQuizOpt(this,'${o.a.replace(/'/g, "\\'")}','${type}')" style="width:100%;margin-bottom:8px;padding:12px;border-radius:10px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);color:#e8ecff;cursor:pointer;text-align:${type === 'ar2uz' ? 'center' : 'right'};font-family:inherit;font-size:0.9rem;transition:all 0.2s;direction:${type === 'ar2uz' ? 'ltr' : 'rtl'}">${type === 'ar2uz' ? o.u : o.a}</button>`).join('');
    const fb = $id('quizFeedback'); if (fb) fb.innerHTML = '';
}
window.checkQuizOpt = function (btn, chosen, type) {
    if (quizAnswered) return; quizAnswered = true;
    document.querySelectorAll('.quiz-opt').forEach(b => {
        const bVal = b.textContent.trim();
        if (type === 'ar2uz' ? bVal === curQuizWord.u : bVal === curQuizWord.a) { b.style.background = 'rgba(52,211,153,0.2)'; b.style.borderColor = '#34d399'; }
        else if (b === btn) { b.style.background = 'rgba(239,68,68,0.2)'; b.style.borderColor = '#ef4444'; }
    });
    const fb = $id('quizFeedback');
    if (chosen === curQuizWord.a) { quizScore++; const el = $id('quizScore'); if (el) el.textContent = quizScore; awardXP(10, 'grammar'); if (fb) fb.innerHTML = '<span style="color:#34d399">✅ To\'g\'ri!</span>'; }
    else { if (fb) fb.innerHTML = `<span style="color:#ef4444">❌ To'g'ri: <span dir="rtl">${curQuizWord.a}</span> = ${curQuizWord.u}</span>`; }
    window.speakWord(curQuizWord.a);
};
window.nextQuiz = function () { showQuizWord(); };

// ── Match ──
function initMatch() {
    const pool = shuffle([...WDB]).slice(0, 5);
    matchPairs = pool; matchMatched = []; matchSel1 = null;
    const items = shuffle([...pool.map(w => ({ id: w.a, text: w.a, type: 'ar', dir: 'rtl' })), ...pool.map(w => ({ id: w.a, text: w.u, type: 'uz', dir: 'ltr' }))]);
    const grid = $id('matchGrid');
    if (grid) grid.innerHTML = items.map(item => `<div class="match-item" data-id="${item.id}" data-type="${item.type}" onclick="window.selectMatch2(this)" style="padding:12px;border-radius:10px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);color:#e8ecff;cursor:pointer;font-family:inherit;transition:all 0.2s;font-size:${item.type === 'ar' ? '1rem' : '0.85rem'};direction:${item.dir};text-align:${item.dir === 'rtl' ? 'right' : 'left'}">${item.text}</div>`).join('');
    const fb = $id('matchFeedback'); if (fb) fb.innerHTML = '';
}
window.startMatch = initMatch;
window.selectMatch2 = function (el) {
    if (el.classList.contains('matched')) return;
    if (!matchSel1) {
        matchSel1 = el; el.style.background = 'rgba(232,180,56,0.2)'; el.style.borderColor = '#e8b438';
    } else {
        if (matchSel1 === el) { el.style.background = 'rgba(255,255,255,0.04)'; el.style.borderColor = 'rgba(255,255,255,0.1)'; matchSel1 = null; return; }
        if (matchSel1.dataset.type === el.dataset.type) {
            matchSel1.style.background = 'rgba(255,255,255,0.04)'; matchSel1.style.borderColor = 'rgba(255,255,255,0.1)';
            matchSel1 = el; el.style.background = 'rgba(232,180,56,0.2)'; el.style.borderColor = '#e8b438'; return;
        }
        if (matchSel1.dataset.id === el.dataset.id) {
            matchSel1.style.background = 'rgba(52,211,153,0.15)'; matchSel1.style.borderColor = '#34d399'; matchSel1.classList.add('matched');
            el.style.background = 'rgba(52,211,153,0.15)'; el.style.borderColor = '#34d399'; el.classList.add('matched');
            matchMatched.push(el.dataset.id); matchSel1 = null; awardXP(15, 'grammar');
            if (matchMatched.length === matchPairs.length) { const fb = $id('matchFeedback'); if (fb) fb.innerHTML = '<span style="color:#34d399">🎉 Barcha juftliklar!</span>'; }
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

// ── Typing ──
function initTyping() { typingDeck = shuffle([...WDB]); typingIdx = 0; showTypingWord(); }
function showTypingWord() {
    const w = typingDeck[typingIdx % typingDeck.length];
    const tw = $id('typingWord'); if (tw) { tw.textContent = w.a; tw.style.direction = 'rtl'; }
    const th = $id('typingHint'); if (th) th.textContent = "O'zbek: " + w.u;
    const ti = $id('typingInput'); if (ti) { ti.value = ''; ti.style.borderColor = ''; ti.setAttribute('dir', 'rtl'); ti.placeholder = 'Arabcha yozing...'; }
    const tf = $id('typingFeedback'); if (tf) tf.innerHTML = '';
}
window.checkTyping = function () {
    const w = typingDeck[typingIdx % typingDeck.length];
    const val = $id('typingInput')?.value.trim() || '';
    const fb = $id('typingFeedback'); const inp = $id('typingInput');
    if (val === w.a) {
        if (fb) fb.innerHTML = '<span style="color:#34d399">✅ To\'g\'ri!</span>';
        if (inp) inp.style.borderColor = '#34d399';
        awardXP(8, 'grammar'); setTimeout(() => { typingIdx++; showTypingWord(); }, 800);
    } else if (val.length >= w.a.length) {
        if (fb) fb.innerHTML = `<span style="color:#ef4444">❌ To'g'ri: <span dir="rtl">${w.a}</span></span>`;
        if (inp) inp.style.borderColor = '#ef4444';
    }
};
window.nextTyping = function () { typingIdx++; showTypingWord(); };

// ── Grammar Practice ──
function initGrammar() { curGrammarIdx = 0; showGrammarQ(); }
function showGrammarQ() {
    grammarAnswered = false;
    const q = GRAMMAR_QS[curGrammarIdx % GRAMMAR_QS.length];
    const qBox = $id('grammarQBox'); if (qBox) { qBox.innerHTML = `<span dir="rtl">${q.q}</span>`; }
    const optsEl = $id('grammarOptions');
    if (optsEl) optsEl.innerHTML = q.opts.map(o => `<button onclick="window.checkGrammar('${o.replace(/'/g, "\\'")}','${q.ans.replace(/'/g, "\\'")}','${q.exp.replace(/'/g, "\\'")}')" style="margin:4px;padding:10px 18px;border-radius:10px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);color:#e8ecff;cursor:pointer;font-family:inherit;transition:all 0.2s;direction:rtl;font-size:0.95rem">${o}</button>`).join('');
    const fb = $id('grammarFeedback'); if (fb) fb.innerHTML = '';
}
window.checkGrammar = function (chosen, ans, exp) {
    if (grammarAnswered) return; grammarAnswered = true;
    const fb = $id('grammarFeedback');
    document.querySelectorAll('#grammarOptions button').forEach(b => {
        if (b.textContent.trim() === ans) { b.style.background = 'rgba(52,211,153,0.2)'; b.style.borderColor = '#34d399'; }
        else if (b.textContent.trim() === chosen && chosen !== ans) { b.style.background = 'rgba(239,68,68,0.2)'; b.style.borderColor = '#ef4444'; }
    });
    if (chosen === ans) {
        if (fb) fb.innerHTML = `<div style="color:#34d399;padding:10px;border-radius:10px;background:rgba(52,211,153,0.1)">✅ To'g'ri! ${exp}</div>`;
        grammarScore2++; const el = $id('grammarScore'); if (el) el.textContent = grammarScore2; awardXP(12, 'grammar');
    } else {
        if (fb) fb.innerHTML = `<div style="color:#ef4444;padding:10px;border-radius:10px;background:rgba(239,68,68,0.1)">❌ To'g'ri javob: <span dir="rtl"><b>${ans}</b></span>. ${exp}</div>`;
    }
};
window.nextGrammarEx = function () { curGrammarIdx++; showGrammarQ(); };

// ══════════════════════════════════════════════════════════════
// AI CHAT
// ══════════════════════════════════════════════════════════════
const CHAT_MODES = {
    free: { label: 'Erkin suhbat', sys: 'You are a friendly Arabic language learning assistant for Uzbek speakers. Chat naturally in Arabic and Uzbek, helping the user practice Arabic. Keep responses concise (2-4 sentences). If the user writes in Uzbek, respond in both Uzbek and Arabic. Always add Arabic script with Uzbek translation.' },
    teacher: { label: "O'qituvchi", sys: "You are an Arabic teacher for Uzbek-speaking students. Explain Arabic grammar rules clearly in simple Uzbek, give examples in both Arabic and Latin transliteration, and encourage the student. Focus on Modern Standard Arabic (MSA)." },
    grammar: { label: 'Grammatika', sys: "You are an Arabic grammar checker for Uzbek learners. When the user sends Arabic text, identify all grammar errors, explain each in simple Uzbek, show the corrected version. Format: '❌ Xato → ✅ To'g'ri: ... 📚 Qoida: ...'" },
    translate: { label: 'Tarjimon', sys: 'You are a professional Arabic-Uzbek translator. Translate accurately. Also explain any expressions. Show both Arabic (with diacritics if possible) and Uzbek.' },
    quran: { label: "Qur'on arabchasi", sys: "You are a Quran Arabic teacher for Uzbek students. Help them understand Classical/Quranic Arabic. Explain root words (جذر), patterns (وزن), and meanings. Always provide Uzbek translations." }
};

let curChatMode = CHAT_MODES.free;

window.setChatMode = function (mode, el) {
    document.querySelectorAll('.chat-mode-btn').forEach(b => b.classList.remove('active'));
    if (el) el.classList.add('active');
    chatMode = mode;
    curChatMode = CHAT_MODES[mode] || CHAT_MODES.free;
    appendChat('assistant', `Rejim: <b>${curChatMode.label}</b>. ${mode === 'free' ? 'مرحباً! Erkin suhbatlashaylik!' :
            mode === 'teacher' ? "Nima o'rganmoqchisiz?" :
                mode === 'grammar' ? 'Arabcha matn yuboring — grammatikani tekshiraman!' :
                    mode === 'translate' ? 'Nima tarjima qilaylik?' :
                        "Qur'on arabchasini o'rganamiz!"
        }`, false);
};

window.insertQuickPhrase = function (p) { const inp = $id('chatInput'); if (inp) { inp.value = p; inp.focus(); } };
window.handleChatKey = function (e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); window.sendChatMessage(); } };

window.sendChatMessage = async function () {
    const inp = $id('chatInput'); if (!inp) return;
    const text = inp.value.trim(); if (!text) return;
    if (UTokens <= 0 && UP !== 'ultimate') { showTokenEmptyModal('AI chat uchun token kerak'); return; }
    inp.value = '';
    appendChat('user', text, true);
    chatHist.push({ role: 'user', parts: [{ text }] });
    const typingId = 'typing_' + Date.now();
    appendChat('assistant', '<span>Yozmoqda...</span>', false, typingId);
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
                generationConfig: { temperature: 0.8, maxOutputTokens: UP === 'ultimate' ? 2000 : 1000 }
            })
        });
        const tb = $id(typingId); if (tb) tb.remove();
        if (!resp.ok) { appendChat('assistant', `❗ AI xatolik: ${resp.status}`, false); return; }
        const d = await resp.json();
        const reply = d.candidates?.[0]?.content?.parts?.[0]?.text || 'Uzr, javob berishda xatolik yuz berdi.';
        appendChat('assistant', reply, true);
        chatHist.push({ role: 'model', parts: [{ text: reply }] });
        if (UTokens > 0 && UP !== 'ultimate') { UTokens--; await saveTokenState(); renderTokenBar(); }
        awardXP(5, 'speaking');
    } catch (e) {
        const tb = $id(typingId); if (tb) tb.remove();
        appendChat('assistant', `❗ Xatolik: ${e.message || 'tarmoq muammosi'}`, false);
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
      <div class="chat-bubble" style="direction:${isAI ? 'ltr' : 'ltr'}">${html}</div>`;
    c.appendChild(div);
    c.scrollTop = c.scrollHeight;
}

window.clearChatHistory = async function () {
    if (!confirm('Chat tarixini tozalashni istaysizmi?')) return;
    chatHist = [];
    const c = $id('chatMessages');
    if (c) c.innerHTML = `<div class="chat-msg ai-msg"><div class="chat-avatar"><i class="fa-solid fa-robot"></i></div><div class="chat-bubble">مرحباً! Chat tarixi tozalandi. Yangi suhbatni boshlaylik! 😊</div></div>`;
    showToast('Chat tarixi tozalandi', 'success');
};

// ══════════════════════════════════════════════════════════════
// VIDEO
// ══════════════════════════════════════════════════════════════
window.findYoutubeVideos = function () {
    const grid = $id('videosGrid'); if (!grid) return;
    const videos = [
        { title: "Arabic for Beginners — Full Course", channel: 'ArabicPod101', id: 'UzJFi4Hxgcg' },
        { title: "Learn Arabic in 30 Minutes", channel: 'Madinah Arabic', id: 'HB0MJmGqrIU' },
        { title: "Arabic Alphabet for Beginners", channel: 'Arabic Dude', id: 'g25ANtM9Mhk' },
        { title: "500 Arabic Words & Phrases", channel: 'LanguageTransfer', id: 'sTANio_2E0Q' },
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
// MODAL CLOSE
// ══════════════════════════════════════════════════════════════
window.closeModal = function () { $id('unitModal')?.classList.remove('active'); };
window.closeUnitModal = function (e) { if (e.target === $id('unitModal')) window.closeModal(); };

// ══════════════════════════════════════════════════════════════
// AUTH & INIT
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
    setTimeout(() => window.loadLBSection('xp', $id('lb-xp-btn')), 800);
});