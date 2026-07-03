
// =====================================================
// Korean.js — LinguaVerse (Korean Course)
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
    free: { name: "Free", icon: "🆓", price_uzs: 0, token_bonus: 1000, token_reset_mult: 1, ai_quality: "standard", xp_mult: 1, coin_mult: 1, features: ["1000 token/5soat", "Standart AI", "Asosiy mashqlar"] },
    pro: { name: "Pro", icon: "⭐", price_uzs: 29000, token_bonus: 3000, token_reset_mult: 2, ai_quality: "enhanced", xp_mult: 1.5, coin_mult: 1.3, features: ["3000 token/5soat", "Yaxshilangan AI", "+50% XP"] },
    premium: { name: "Premium", icon: "💎", price_uzs: 59000, token_bonus: 8000, token_reset_mult: 3, ai_quality: "advanced", xp_mult: 2, coin_mult: 1.8, features: ["8000 token/5soat", "Ilg'or AI", "+100% XP"] },
    ultimate: { name: "Ultimate", icon: "🚀", price_uzs: 99000, token_bonus: 999999, token_reset_mult: 999, ai_quality: "ultimate", xp_mult: 3, coin_mult: 2.5, features: ["Cheksiz tokenlar", "Eng yaxshi AI", "+200% XP"] }
};

const RANKS = {
    none: { name: "Oddiy", icon: "⬜", color: "#888", token_bonus: 0, xp_mult: 1, coin_mult: 1 },
    silver: { name: "Silver", icon: "🥈", color: "#C0C0C0", token_bonus: 200, xp_mult: 1.3, coin_mult: 1.2 },
    gold: { name: "Gold", icon: "🥇", color: "#FFD700", token_bonus: 500, xp_mult: 1.8, coin_mult: 1.5 },
    diamond: { name: "Diamond", icon: "💎", color: "#B9F2FF", token_bonus: 1000, xp_mult: 2.5, coin_mult: 2 }
};

const PLAN_LIMITS = { free: 10, basic: 30, starter: 30, premium: 100, ultimate: 9999, vip: 9999 };
const PLAN_LABELS = { free: "Bepul", basic: "Basic", starter: "Starter", premium: "Premium", ultimate: "Ultimate", vip: "VIP" };
const PLAN_COLORS = { free: "#94a3b8", basic: "#60a5fa", starter: "#60a5fa", premium: "#a78bfa", ultimate: "#f5c842", vip: "#f5c842" };

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
let dictSent = '';

// ══════════════════════════════════════════════════════════════
// KOREAN WORDS DATABASE
// ══════════════════════════════════════════════════════════════
const WDB = [
    // ── BEGINNER ──
    { e: '안녕하세요', r: 'annyeonghaseyo', u: 'Salom (rasmiy)', t: 'interjection', l: 'beginner', ex: '안녕하세요, 만나서 반갑습니다.', eu: 'Salom, tanishganimdan xursandman.' },
    { e: '안녕히 가세요', r: 'annyeonghi gaseyo', u: 'Xayr (ketuvchiga)', t: 'phrase', l: 'beginner', ex: '안녕히 가세요!', eu: 'Xayr, eson boring!' },
    { e: '감사합니다', r: 'gamsahamnida', u: 'Rahmat', t: 'phrase', l: 'beginner', ex: '도와주셔서 감사합니다.', eu: 'Yordamingiz uchun rahmat.' },
    { e: '죄송합니다', r: 'joesonghamnida', u: 'Kechirasiz', t: 'phrase', l: 'beginner', ex: '늦어서 죄송합니다.', eu: 'Kech qolganimdan kechirim so\'raman.' },
    { e: '네', r: 'ne', u: 'Ha', t: 'interjection', l: 'beginner', ex: '네, 맞아요.', eu: 'Ha, to\'g\'ri.' },
    { e: '아니요', r: 'aniyo', u: 'Yo\'q', t: 'interjection', l: 'beginner', ex: '아니요, 그렇지 않아요.', eu: 'Yo\'q, bunday emas.' },
    { e: '이름', r: 'ireum', u: 'Ism', t: 'noun', l: 'beginner', ex: '제 이름은 민준이에요.', eu: 'Mening ismim Minjun.' },
    { e: '사람', r: 'saram', u: 'Odam/Inson', t: 'noun', l: 'beginner', ex: '저 사람은 누구예요?', eu: 'U kishi kim?' },
    { e: '친구', r: 'chingu', u: 'Do\'st', t: 'noun', l: 'beginner', ex: '그는 제 친구예요.', eu: 'U mening do\'stim.' },
    { e: '가족', r: 'gajok', u: 'Oila', t: 'noun', l: 'beginner', ex: '저는 가족을 사랑해요.', eu: 'Men oilamni sevaman.' },
    { e: '어머니', r: 'eomeoni', u: 'Ona', t: 'noun', l: 'beginner', ex: '어머니는 선생님이에요.', eu: 'Onam o\'qituvchi.' },
    { e: '아버지', r: 'abeoji', u: 'Ota', t: 'noun', l: 'beginner', ex: '아버지는 의사예요.', eu: 'Otam shifokor.' },
    { e: '물', r: 'mul', u: 'Suv', t: 'noun', l: 'beginner', ex: '물 한 잔 주세요.', eu: 'Bir stakan suv bering.' },
    { e: '밥', r: 'bap', u: 'Ovqat/Guruch', t: 'noun', l: 'beginner', ex: '밥을 먹었어요.', eu: 'Ovqat yedim.' },
    { e: '집', r: 'jip', u: 'Uy', t: 'noun', l: 'beginner', ex: '저는 큰 집에 살아요.', eu: 'Men katta uyda yashayman.' },
    { e: '학교', r: 'hakgyo', u: 'Maktab', t: 'noun', l: 'beginner', ex: '매일 학교에 가요.', eu: 'Har kuni maktabga boraman.' },
    { e: '선생님', r: 'seonsaengnim', u: 'O\'qituvchi', t: 'noun', l: 'beginner', ex: '선생님은 친절해요.', eu: 'O\'qituvchi mehribon.' },
    { e: '학생', r: 'haksaeng', u: 'O\'quvchi', t: 'noun', l: 'beginner', ex: '저는 학생이에요.', eu: 'Men o\'quvchiman.' },
    { e: '책', r: 'chaek', u: 'Kitob', t: 'noun', l: 'beginner', ex: '재미있는 책을 읽어요.', eu: 'Qiziqarli kitob o\'qiyaman.' },
    { e: '시간', r: 'sigan', u: 'Vaqt', t: 'noun', l: 'beginner', ex: '지금 몇 시예요?', eu: 'Hozir soat necha?' },
    { e: '오늘', r: 'oneul', u: 'Bugun', t: 'noun', l: 'beginner', ex: '오늘 날씨가 좋아요.', eu: 'Bugun havo yaxshi.' },
    { e: '내일', r: 'naeil', u: 'Ertaga', t: 'noun', l: 'beginner', ex: '내일 만나요.', eu: 'Ertaga ko\'rishamiz.' },
    { e: '어제', r: 'eoje', u: 'Kecha', t: 'noun', l: 'beginner', ex: '어제 뭐 했어요?', eu: 'Kecha nima qildingiz?' },
    { e: '크다', r: 'keuda', u: 'Katta', t: 'adjective', l: 'beginner', ex: '이 집은 정말 커요.', eu: 'Bu uy juda katta.' },
    { e: '작다', r: 'jakda', u: 'Kichkina', t: 'adjective', l: 'beginner', ex: '아이는 작아요.', eu: 'Bola kichkina.' },
    { e: '좋다', r: 'jota', u: 'Yaxshi', t: 'adjective', l: 'beginner', ex: '오늘 날씨가 좋아요.', eu: 'Bugun havo yaxshi.' },
    { e: '나쁘다', r: 'nappuda', u: 'Yomon', t: 'adjective', l: 'beginner', ex: '날씨가 나빠요.', eu: 'Havo yomon.' },
    { e: '예쁘다', r: 'yeppuda', u: 'Chiroyli', t: 'adjective', l: 'beginner', ex: '꽃이 예뻐요.', eu: 'Gul chiroyli.' },
    { e: '빠르다', r: 'pparuda', u: 'Tez', t: 'adjective', l: 'beginner', ex: '차가 빠르네요.', eu: 'Mashina tez ekan.' },
    { e: '먹다', r: 'meokda', u: 'Yemoq', t: 'verb', l: 'beginner', ex: '밥을 먹어요.', eu: 'Ovqat yeyaman.' },
    { e: '마시다', r: 'masida', u: 'Ichmoq', t: 'verb', l: 'beginner', ex: '물을 마셔요.', eu: 'Suv ichaman.' },
    { e: '자다', r: 'jada', u: 'Uxlamoq', t: 'verb', l: 'beginner', ex: '일찍 자요.', eu: 'Erta uxlayman.' },
    { e: '읽다', r: 'ikda', u: 'O\'qimoq', t: 'verb', l: 'beginner', ex: '책을 읽어요.', eu: 'Kitob o\'qiyaman.' },
    { e: '쓰다', r: 'seuda', u: 'Yozmoq', t: 'verb', l: 'beginner', ex: '편지를 써요.', eu: 'Xat yozaman.' },
    { e: '가다', r: 'gada', u: 'Bormoq', t: 'verb', l: 'beginner', ex: '학교에 가요.', eu: 'Maktabga boraman.' },
    { e: '오다', r: 'oda', u: 'Kelmoq', t: 'verb', l: 'beginner', ex: '집에 와요.', eu: 'Uyga kelaman.' },
    { e: '보다', r: 'boda', u: 'Ko\'rmoq', t: 'verb', l: 'beginner', ex: '영화를 봐요.', eu: 'Film ko\'raman.' },
    { e: '말하다', r: 'malhada', u: 'Gapirmoq', t: 'verb', l: 'beginner', ex: '한국어로 말해요.', eu: 'Koreyscha gapiryapman.' },
    { e: '듣다', r: 'deutda', u: 'Eshitmoq', t: 'verb', l: 'beginner', ex: '음악을 들어요.', eu: 'Musiqa eshitaman.' },
    { e: '하다', r: 'hada', u: 'Qilmoq', t: 'verb', l: 'beginner', ex: '공부를 해요.', eu: 'O\'qiyaman.' },
    { e: '사다', r: 'sada', u: 'Sotib olmoq', t: 'verb', l: 'beginner', ex: '옷을 사요.', eu: 'Kiyim sotib olaman.' },
    { e: '일', r: 'il', u: 'Bir', t: 'number', l: 'beginner', ex: '사과 하나 주세요.', eu: 'Bitta olma bering.' },
    { e: '이', r: 'i', u: 'Ikki', t: 'number', l: 'beginner', ex: '친구 두 명이에요.', eu: 'Ikki do\'stim bor.' },
    { e: '삼', r: 'sam', u: 'Uch', t: 'number', l: 'beginner', ex: '세 시에 만나요.', eu: 'Soat uchda uchrashaylik.' },
    { e: '빨간색', r: 'ppalgansaek', u: 'Qizil', t: 'noun', l: 'beginner', ex: '빨간 사과예요.', eu: 'Qizil olma.' },
    { e: '파란색', r: 'paransaek', u: 'Ko\'k', t: 'noun', l: 'beginner', ex: '하늘이 파래요.', eu: 'Osmon ko\'k.' },
    { e: '날씨', r: 'nalssi', u: 'Ob-havo', t: 'noun', l: 'beginner', ex: '오늘 날씨가 어때요?', eu: 'Bugun havo qanaqa?' },
    { e: '음식', r: 'eumsik', u: 'Taom', t: 'noun', l: 'beginner', ex: '한국 음식이 맛있어요.', eu: 'Koreys taomi mazali.' },
    { e: '김치', r: 'gimchi', u: 'Kimchi', t: 'noun', l: 'beginner', ex: '김치가 매워요.', eu: 'Kimchi achchiq.' },
    { e: '돈', r: 'don', u: 'Pul', t: 'noun', l: 'beginner', ex: '돈이 있어요?', eu: 'Pulingiz bormi?' },

    // ── ELEMENTARY ──
    { e: '공부하다', r: 'gongbuhada', u: 'O\'qimoq/Mashq qilmoq', t: 'verb', l: 'elementary', ex: '매일 한국어를 공부해요.', eu: 'Har kuni koreyscha o\'rganaman.' },
    { e: '여행하다', r: 'yeohaenghada', u: 'Sayohat qilmoq', t: 'verb', l: 'elementary', ex: '한국에 여행하고 싶어요.', eu: 'Koreyaga sayohat qilmoqchiman.' },
    { e: '운동하다', r: 'undonghhada', u: 'Sport qilmoq', t: 'verb', l: 'elementary', ex: '매일 아침 운동해요.', eu: 'Har ertalab sport qilaman.' },
    { e: '요리하다', r: 'yorihada', u: 'Oshpazlik qilmoq', t: 'verb', l: 'elementary', ex: '어머니가 요리해요.', eu: 'Onam oshpazlik qiladi.' },
    { e: '일하다', r: 'ilhada', u: 'Ishlash', t: 'verb', l: 'elementary', ex: '회사에서 일해요.', eu: 'Kompaniyada ishlayman.' },
    { e: '사랑하다', r: 'saranghada', u: 'Sevmoq', t: 'verb', l: 'elementary', ex: '가족을 사랑해요.', eu: 'Oilamni sevaman.' },
    { e: '병원', r: 'byeongwon', u: 'Kasalxona', t: 'noun', l: 'elementary', ex: '병원에 가야 해요.', eu: 'Kasalxonaga borishim kerak.' },
    { e: '식당', r: 'sikdang', u: 'Restoran', t: 'noun', l: 'elementary', ex: '식당에서 밥을 먹어요.', eu: 'Restoranda ovqatlanamiz.' },
    { e: '시장', r: 'sijang', u: 'Bozor', t: 'noun', l: 'elementary', ex: '시장에서 야채를 사요.', eu: 'Bozordan sabzavot sotib olaman.' },
    { e: '회사', r: 'hoesa', u: 'Kompaniya', t: 'noun', l: 'elementary', ex: '저는 큰 회사에 다녀요.', eu: 'Men katta kompaniyada ishlayman.' },
    { e: '지하철', r: 'jihacheol', u: 'Metro', t: 'noun', l: 'elementary', ex: '지하철을 타요.', eu: 'Metroga minaman.' },
    { e: '버스', r: 'beoseu', u: 'Avtobus', t: 'noun', l: 'elementary', ex: '버스를 기다려요.', eu: 'Avtobusni kutaman.' },
    { e: '비행기', r: 'bihaenggi', u: 'Samolyot', t: 'noun', l: 'elementary', ex: '비행기를 타고 여행해요.', eu: 'Samolyotda sayohat qilaman.' },
    { e: '전화', r: 'jeonhwa', u: 'Telefon', t: 'noun', l: 'elementary', ex: '전화해 줄게요.', eu: 'Qo\'ng\'iroq qilaman.' },
    { e: '컴퓨터', r: 'keompyuteo', u: 'Kompyuter', t: 'noun', l: 'elementary', ex: '컴퓨터로 일해요.', eu: 'Kompyuterda ishlayman.' },
    { e: '음악', r: 'eumak', u: 'Musiqa', t: 'noun', l: 'elementary', ex: '음악 듣는 게 좋아요.', eu: 'Musiqa eshitishni yaxshi ko\'raman.' },
    { e: '영화', r: 'yeonghwa', u: 'Film', t: 'noun', l: 'elementary', ex: '영화관에서 영화를 봐요.', eu: 'Kinoteatrda film ko\'raman.' },
    { e: '축구', r: 'chukgu', u: 'Futbol', t: 'noun', l: 'elementary', ex: '축구를 좋아해요.', eu: 'Futbolni yaxshi ko\'raman.' },
    { e: '비싸다', r: 'bissada', u: 'Qimmat', t: 'adjective', l: 'elementary', ex: '이 옷이 너무 비싸요.', eu: 'Bu kiyim juda qimmat.' },
    { e: '싸다', r: 'ssada', u: 'Arzon', t: 'adjective', l: 'elementary', ex: '이 음식은 싸요.', eu: 'Bu taom arzon.' },
    { e: '맛있다', r: 'masitda', u: 'Mazali', t: 'adjective', l: 'elementary', ex: '이 김치찌개가 맛있어요.', eu: 'Bu kimchi shurva mazali.' },
    { e: '어렵다', r: 'oryeopda', u: 'Qiyin', t: 'adjective', l: 'elementary', ex: '한국어가 조금 어려워요.', eu: 'Koreyscha biroz qiyin.' },
    { e: '쉽다', r: 'swipda', u: 'Oson', t: 'adjective', l: 'elementary', ex: '이 문제는 쉬워요.', eu: 'Bu masala oson.' },
    { e: '보통', r: 'botong', u: 'Odatda', t: 'adverb', l: 'elementary', ex: '보통 아침 7시에 일어나요.', eu: 'Odatda ertalab soat 7 da turaman.' },
    { e: '항상', r: 'hangsang', u: 'Doim', t: 'adverb', l: 'elementary', ex: '항상 열심히 공부해요.', eu: 'Doim qattiq o\'qiyman.' },
    { e: '가끔', r: 'gakkeum', u: 'Ba\'zan', t: 'adverb', l: 'elementary', ex: '가끔 영화를 봐요.', eu: 'Ba\'zan film ko\'raman.' },
    { e: '같이', r: 'gachi', u: 'Birga', t: 'adverb', l: 'elementary', ex: '같이 밥 먹어요.', eu: 'Birga ovqat yeylik.' },

    // ── PRE-INTERMEDIATE ──
    { e: '그러나', r: 'geureona', u: 'Ammo/Lekin', t: 'conjunction', l: 'pre-intermediate', ex: '열심히 했다. 그러나 결과가 안 좋았다.', eu: 'Qattiq harakat qildim. Ammo natija yaxshi bo\'lmadi.' },
    { e: '때문에', r: 'ddaemune', u: 'Sababli', t: 'particle', l: 'pre-intermediate', ex: '비 때문에 못 나갔어요.', eu: 'Yomg\'ir sababli chiqa olmadim.' },
    { e: '만약', r: 'manyak', u: 'Agar', t: 'conjunction', l: 'pre-intermediate', ex: '만약 비가 오면 집에 있을게요.', eu: 'Agar yomg\'ir yog\'sa uyda qolaman.' },
    { e: '아마도', r: 'amado', u: 'Ehtimol', t: 'adverb', l: 'pre-intermediate', ex: '아마도 내일 올 거예요.', eu: 'Ehtimol ertaga keladi.' },
    { e: '경험', r: 'gyeongheom', u: 'Tajriba', t: 'noun', l: 'pre-intermediate', ex: '경험이 중요해요.', eu: 'Tajriba muhim.' },
    { e: '기회', r: 'gihoe', u: 'Imkoniyat', t: 'noun', l: 'pre-intermediate', ex: '이번 기회를 놓치지 마세요.', eu: 'Bu imkoniyatni o\'tkazib yubormang.' },
    { e: '문화', r: 'munhwa', u: 'Madaniyat', t: 'noun', l: 'pre-intermediate', ex: '한국 문화가 궁금해요.', eu: 'Koreys madaniyati qiziq.' },
    { e: '사회', r: 'sahoe', u: 'Jamiyat', t: 'noun', l: 'pre-intermediate', ex: '현대 사회는 빠르게 변해요.', eu: 'Zamonaviy jamiyat tez o\'zgarmoqda.' },
    { e: '환경', r: 'hwangyeong', u: 'Muhit/Atrof', t: 'noun', l: 'pre-intermediate', ex: '환경을 보호해야 해요.', eu: 'Atrof-muhitni himoya qilish kerak.' },
    { e: '발전', r: 'baljeon', u: 'Rivojlanish', t: 'noun', l: 'pre-intermediate', ex: '기술이 빠르게 발전해요.', eu: 'Texnologiya tez rivojlanmoqda.' },
    { e: '문제', r: 'munje', u: 'Muammo', t: 'noun', l: 'pre-intermediate', ex: '이 문제를 해결해야 해요.', eu: 'Bu muammoni hal qilish kerak.' },
    { e: '해결하다', r: 'haegyeolhada', u: 'Hal qilmoq', t: 'verb', l: 'pre-intermediate', ex: '문제를 해결했어요.', eu: 'Muammoni hal qildim.' },
    { e: '비교하다', r: 'bigyohada', u: 'Solishtirmoq', t: 'verb', l: 'pre-intermediate', ex: '두 가지를 비교해요.', eu: 'Ikki narsani solishtiryapman.' },
    { e: '설명하다', r: 'seolmyeonghada', u: 'Tushuntirmoq', t: 'verb', l: 'pre-intermediate', ex: '이 규칙을 설명해 주세요.', eu: 'Iltimos, bu qoidani tushuntiring.' },
    { e: '개선하다', r: 'gaeseonhada', u: 'Yaxshilamoq', t: 'verb', l: 'pre-intermediate', ex: '실력을 개선하고 싶어요.', eu: 'Mahoratimni yaxshilashni xohlayman.' },
    { e: '자신감', r: 'jasinkam', u: 'Ishonch/Qat\'iyat', t: 'noun', l: 'pre-intermediate', ex: '자신감이 중요해요.', eu: 'Ishonch muhim.' },
    { e: '성공하다', r: 'seonggonghada', u: 'Muvaffaqiyat qozonmoq', t: 'verb', l: 'pre-intermediate', ex: '열심히 하면 성공할 수 있어요.', eu: 'Qattiq harakat qilsangiz muvaffaqiyatga erishasiz.' },

    // ── ADVANCED ──
    { e: '미묘하다', r: 'mimyohada', u: 'Nozik/Subtil', t: 'adjective', l: 'advanced', ex: '그 차이는 미묘해요.', eu: 'Bu farq juda nozik.' },
    { e: '주권', r: 'jugwon', u: 'Suverenitet', t: 'noun', l: 'advanced', ex: '국가 주권은 중요합니다.', eu: 'Davlat suvereniteti muhim.' },
    { e: '패러다임', r: 'paereodam', u: 'Paradigma', t: 'noun', l: 'advanced', ex: '새로운 패러다임이 필요해요.', eu: 'Yangi paradigma kerak.' },
    { e: '완화하다', r: 'wanhwahada', u: 'Yumshatmoq', t: 'verb', l: 'advanced', ex: '위험을 완화해야 해요.', eu: 'Xavfni yumshatish kerak.' },
    { e: '철저하다', r: 'cheoljeohadda', u: 'Puxta/Batafsil', t: 'adjective', l: 'advanced', ex: '철저하게 준비했어요.', eu: 'Puxta tayyorlandim.' },
    { e: '모호하다', r: 'mohohada', u: 'Noaniq', t: 'adjective', l: 'advanced', ex: '그 발언은 모호해요.', eu: 'Bu bayonot noaniq.' },
    { e: '일관성', r: 'ilgwanseong', u: 'Izchillik', t: 'noun', l: 'advanced', ex: '일관성 있게 행동하세요.', eu: 'Izchil harakat qiling.' },
    { e: '실질적', r: 'siljiljeok', u: 'Amaliy/Real', t: 'adjective', l: 'advanced', ex: '실질적인 방법이 필요해요.', eu: 'Amaliy usul kerak.' },
    { e: '촉진하다', r: 'chokjinhada', u: 'Tezlashtirmoq/Osonlashtirmoq', t: 'verb', l: 'advanced', ex: '발전을 촉진해야 해요.', eu: 'Rivojlanishni tezlashtirish kerak.' },
    { e: '현상', r: 'hyeonsang', u: 'Hodisa', t: 'noun', l: 'advanced', ex: '이것은 세계적인 현상이에요.', eu: 'Bu global hodisa.' },
    { e: '함의', r: 'hami', u: 'Oqibat/Ma\'no', t: 'noun', l: 'advanced', ex: '그 결정의 함의를 고려하세요.', eu: 'Bu qarorning oqibatlarini ko\'ring.' },
    { e: '구조', r: 'gujo', u: 'Tuzilma/Struktura', t: 'noun', l: 'advanced', ex: '명확한 구조가 필요해요.', eu: 'Aniq tuzilma kerak.' },
    { e: '비판적', r: 'bipanjeok', u: 'Tanqidiy', t: 'adjective', l: 'advanced', ex: '비판적으로 생각해야 해요.', eu: 'Tanqidiy fikrlash kerak.' },
    { e: '합의', r: 'habi', u: 'Kelishuv/Konsensus', t: 'noun', l: 'advanced', ex: '합의에 도달했어요.', eu: 'Kelishuvga erishdik.' },
    { e: '옹호하다', r: 'onghohada', u: 'Himoya qilmoq', t: 'verb', l: 'advanced', ex: '인권을 옹호해요.', eu: 'Inson huquqlarini himoya qilaman.' },
];

// ══════════════════════════════════════════════════════════════
// UNITS DATA
// ══════════════════════════════════════════════════════════════
const UD_DATA = {
    beginner: [
        {
            id: 'kb0', emoji: '한', title: '한글 기초 (Hangul)', desc: "Koreys alifbosi — Hangul asoslari", level: 'beginner',
            words: ['안녕하세요', '감사합니다', '이름', '사람', '집', '학교', '오늘', '좋다', '먹다', '물'],
            xp: 50, coin: 20,
            grammar_rule: "Hangulda 14 undosh (자음) va 10 unli (모음) bor. Har bir bo'g'in blok shaklida yoziladi.",
            grammar_example: "가 = ᄀ + ᅡ | 나 = ᄂ + ᅡ | 다 = ᄃ + ᅡ",
            reading_text: "한국어는 한글로 써요. 한글은 1443년에 만들어졌어요. 자음이 14개, 모음이 10개 있어요. 한글은 배우기 쉬워요.",
            reading_qs: [
                { q: "한글은 언제 만들어졌어요?", opts: ["1343년", "1443년", "1543년", "1643년"], c: 1 },
                { q: "자음이 몇 개 있어요?", opts: ["10개", "12개", "14개", "16개"], c: 2 },
                { q: "한글은 배우기 어때요?", opts: ["아주 어려워요", "쉬워요", "불가능해요", "조금 어려워요"], c: 1 }
            ]
        },
        {
            id: 'kb1', emoji: '👋', title: '인사 (Greetings)', desc: "Salomlashish iboralari", level: 'beginner',
            words: ['안녕하세요', '안녕히 가세요', '감사합니다', '죄송합니다', '네', '아니요', '이름', '친구', '사람', '좋다'],
            xp: 50, coin: 20,
            grammar_rule: "~이에요/예요 = 'bo\'lmoq' (ism oxiriga qo\'shiladi). 이에요 — undosh keyin, 예요 — unli keyin.",
            grammar_example: "학생이에요 (Men o'quvchiman). 의사예요 (Shifokor).",
            reading_text: "안녕하세요! 제 이름은 민준이에요. 저는 한국 사람이에요. 친구를 만나면 인사해요. '안녕하세요'라고 말해요. 헤어질 때는 '안녕히 가세요'라고 해요.",
            reading_qs: [
                { q: "한국어 숫자는 몇 종류예요?", opts: ["한 종류", "두 종류", "세 종류", "네 종류"], c: 1 },
                { q: "시간을 말할 때 어떤 숫자를 써요?", opts: ["한자 숫자", "고유어 숫자", "둘 다", "안 써요"], c: 1 },
                { q: "돈을 말할 때 어떤 숫자를 써요?", opts: ["고유어 숫자", "한자 숫자", "둘 다", "안 써요"], c: 1 }
            ]
        },
        {
            id: 'kb2', emoji: '🔢', title: '숫자 (Numbers)', desc: "Koreys raqamlari — sino va native", level: 'beginner',
            words: ['일', '이', '삼', '시간', '오늘', '내일', '어제', '돈', '크다', '작다'],
            xp: 60, coin: 25,
            grammar_rule: "Ikki xil son tizimi: Sino-Koreys (일이삼...) — kun, pul, vaqt uchun. Native Koreys (하나둘셋...) — hisoblash uchun.",
            grammar_example: "일 (1), 이 (2), 삼 (3) | 하나 (1), 둘 (2), 셋 (3)",
            reading_text: "한국어에는 숫자가 두 종류 있어요. 한자에서 온 숫자와 고유어 숫자예요. 시간을 말할 때는 고유어 숫자를 써요. 돈을 말할 때는 한자 숫자를 써요.",
            reading_qs: [
                { q: "한국어 숫자는 몇 종류예요?", opts: ["한 종류", "두 종류", "세 종류", "네 종류"], c: 1 },
                { q: "시간을 말할 때 어떤 숫자를 써요?", opts: ["한자 숫자", "고유어 숫자", "둘 다", "안 써요"], c: 1 },
                { q: "돈을 말할 때 어떤 숫자를 써요?", opts: ["고유어 숫자", "한자 숫자", "둘 다", "안 써요"], c: 1 }
            ]
        },
        {
            id: 'kb3', emoji: '🍚', title: '음식 (Food)', desc: "Koreys taomlari va ichimliklar", level: 'beginner',
            words: ['밥', '물', '김치', '음식', '먹다', '마시다', '맛있다', '크다', '작다', '사다'],
            xp: 60, coin: 25,
            grammar_rule: "~을/를 = tushum kelishigi (object marker). 받침 bo\'lsa '을', bo\'lmasa '를'.",
            grammar_example: "밥을 먹어요 (Ovqat yeyaman). 물을 마셔요 (Suv ichaman).",
            reading_text: "한국 음식은 맛있어요. 김치는 한국의 대표 음식이에요. 밥과 국, 반찬을 같이 먹어요. 한국 사람들은 매운 음식을 좋아해요.",
            reading_qs: [
                { q: "한국의 대표 음식은 뭐예요?", opts: ["밥", "국", "김치", "반찬"], c: 2 },
                { q: "한국 사람들은 어떤 맛을 좋아해요?", opts: ["달콤한 맛", "신 맛", "매운 맛", "싱거운 맛"], c: 2 },
                { q: "한국 사람들은 밥과 함께 뭘 먹어요?", opts: ["밥만 먹어요", "국과 반찬", "빵", "파스타"], c: 1 }
            ]
        },
        {
            id: 'kb4', emoji: '👨‍👩‍👧', title: '가족 (Family)', desc: "Oila a\'zolarining nomlari", level: 'beginner',
            words: ['가족', '어머니', '아버지', '친구', '선생님', '학생', '사람', '이름', '좋다', '사랑하다'],
            xp: 60, coin: 25,
            grammar_rule: "~은/는 = mavzu ko'rsatkichi (topic marker). 받침 bo\'lsa '은', bo\'lmasa '는'.",
            grammar_example: "어머니는 선생님이에요. 아버지는 의사예요.",
            reading_text: "제 가족은 네 명이에요. 아버지, 어머니, 오빠, 그리고 저예요. 아버지는 회사원이에요. 어머니는 선생님이에요. 우리 가족은 사이가 좋아요.",
            reading_qs: [
                { q: "가족이 몇 명이에요?", opts: ["세 명", "네 명", "다섯 명", "여섯 명"], c: 1 },
                { q: "어머니는 무슨 일을 해요?", opts: ["의사", "회사원", "선생님", "간호사"], c: 2 },
                { q: "아버지는 뭐예요?", opts: ["회사원", "선생님", "의사", "학생"], c: 0 }
            ]
        },
        {
            id: 'kb5', emoji: '🏫', title: '학교 (School)', desc: "Maktab hayoti va darslar", level: 'beginner',
            words: ['학교', '선생님', '학생', '책', '쓰다', '읽다', '공부하다', '좋다', '시간', '오늘'],
            xp: 70, coin: 30,
            grammar_rule: "~에 가다 = 'ga bormoq'. Joylashuv + 에 + 가다/오다.",
            grammar_example: "학교에 가요 (Maktabga boraman). 집에 와요 (Uyga kelaman).",
            reading_text: "저는 학교에 매일 가요. 학교에서 한국어, 수학, 영어를 배워요. 선생님들이 친절해요. 친구들과 함께 점심을 먹어요. 공부하는 게 재미있어요.",
            reading_qs: [
                { q: "얼마나 자주 학교에 가요?", opts: ["가끔", "매주", "매일", "매달"], c: 2 },
                { q: "어떤 과목을 배워요?", opts: ["수학만", "한국어, 수학, 영어", "과학만", "역사만"], c: 1 },
                { q: "선생님들이 어때요?", opts: ["엄격해요", "지루해요", "친절해요", "바빠요"], c: 2 }
            ]
        },
    ],

    elementary: [
        {
            id: 'ke1', emoji: '🏙️', title: '도시 생활 (City Life)', desc: "Shahar hayoti va transport", level: 'elementary',
            words: ['지하철', '버스', '비행기', '병원', '식당', '시장', '회사', '전화', '컴퓨터', '일하다'],
            xp: 80, coin: 35,
            grammar_rule: "~을/를 타다 = '...ga minmoq'. Transport vositasi + 을/를 + 타다.",
            grammar_example: "지하철을 타요 (Metroga minaman). 버스를 타요 (Avtobusga minaman).",
            reading_text: "서울은 대한민국의 수도예요. 지하철이 매우 발달해 있어요. 버스도 많이 다녀요. 서울에는 맛있는 식당이 많아요. 쇼핑몰과 시장도 있어요.",
            reading_qs: [
                { q: "대한민국의 수도는 어디예요?", opts: ["부산", "서울", "인천", "대구"], c: 1 },
                { q: "서울에서 잘 발달한 것은 뭐예요?", opts: ["공항", "지하철", "트램", "자전거 도로"], c: 1 },
                { q: "서울에 뭐가 많아요?", opts: ["숲", "산", "식당", "농장"], c: 2 }
            ]
        },
        {
            id: 'ke2', emoji: '💼', title: '직업 (Jobs)', desc: "Kasb va ish hayoti", level: 'elementary',
            words: ['일하다', '회사', '선생님', '병원', '음악', '영화', '자신감', '성공하다', '비싸다', '맛있다'],
            xp: 80, coin: 35,
            grammar_rule: "~고 싶다 = 'xohlamoq'. Fe'l ildizi + 고 싶다.",
            grammar_example: "의사가 되고 싶어요 (Shifokor bo'lmoqchiman). 한국에 가고 싶어요.",
            reading_text: "한국에는 다양한 직업이 있어요. 의사, 선생님, 회사원, 요리사 등이 있어요. 요즘은 유튜버나 크리에이터도 인기 있는 직업이에요. 자신이 좋아하는 일을 하면 행복해요.",
            reading_qs: [
                { q: "요즘 인기 있는 직업은 뭐예요?", opts: ["농부", "유튜버/크리에이터", "군인", "어부"], c: 1 },
                { q: "언제 일이 행복해요?", opts: ["돈을 많이 벌 때", "좋아하는 일을 할 때", "쉴 때", "바쁠 때"], c: 1 },
                { q: "처음에 나온 직업은 뭐예요?", opts: ["선생님", "요리사", "의사", "회사원"], c: 2 }
            ]
        },
        {
            id: 'ke3', emoji: '🛒', title: '쇼핑 (Shopping)', desc: "Do\'kon va xarid qilish", level: 'elementary',
            words: ['시장', '비싸다', '싸다', '사다', '돈', '음식', '옷', '같이', '항상', '가끔'],
            xp: 90, coin: 40,
            grammar_rule: "~얼마예요? = 'Qancha?'. Narx so'rashda ishlatiladi.",
            grammar_example: "이거 얼마예요? (Bu qancha?) — 만 원이에요 (10,000 won).",
            reading_text: "한국에서 쇼핑하는 건 재미있어요. 명동은 유명한 쇼핑 거리예요. 옷, 화장품, 음식을 살 수 있어요. 시장에서는 더 싸게 살 수 있어요. 카드나 현금으로 계산해요.",
            reading_qs: [
                { q: "명동은 뭐로 유명해요?", opts: ["공원", "쇼핑", "박물관", "학교"], c: 1 },
                { q: "어디서 더 싸게 살 수 있어요?", opts: ["백화점", "온라인", "시장", "편의점"], c: 2 },
                { q: "어떻게 계산할 수 있어요?", opts: ["현금만", "카드만", "카드나 현금", "모바일만"], c: 2 }
            ]
        },
    ],

    'pre-intermediate': [
        {
            id: 'kp1', emoji: '📰', title: '미래 계획 (Future Plans)', desc: "Kelajak zamoni va rejalar", level: 'pre-intermediate',
            words: ['만약', '아마도', '기회', '발전', '성공하다', '자신감', '개선하다', '경험', '문화', '사회'],
            xp: 130, coin: 60,
            grammar_rule: "~(으)ㄹ 거예요 = kelajak niyat/taxmin. '~겠어요' rasmiy kelajak.",
            grammar_example: "내일 학교에 갈 거예요 (Ertaga maktabga boraman). 공부하겠어요 (O'qiyman).",
            reading_text: "미래를 위해 계획을 세우는 것은 중요해요. 단기 목표와 장기 목표가 있어요. 작은 목표부터 시작하면 성공하기 쉬워요. 포기하지 않는 것이 중요해요.",
            reading_qs: [
                { q: "미래를 위해 뭐가 중요해요?", opts: ["휴식", "계획 세우기", "여행", "돈"], c: 1 },
                { q: "뭐가 성공하기 더 쉬워요?", opts: ["큰 목표", "작은 목표부터", "장기 목표", "불분명한 목표"], c: 1 },
                { q: "가장 중요한 게 뭐예요?", opts: ["똑똑한 것", "돈 있는 것", "포기하지 않는 것", "빠르게 하는 것"], c: 2 }
            ]
        },
        {
            id: 'kp2', emoji: '🌐', title: '문화 비교 (Culture)', desc: "Madaniyat va jamiyat", level: 'pre-intermediate',
            words: ['문화', '사회', '환경', '문제', '해결하다', '설명하다', '비교하다', '그러나', '때문에', '경험'],
            xp: 140, coin: 65,
            grammar_rule: "~기 때문에 = 'sababli'. ~(으)므로 = rasmiy 'sababli'.",
            grammar_example: "바쁘기 때문에 못 왔어요 (Band bo'lgani uchun kela olmadim).",
            reading_text: "한국 문화는 독특해요. 어른을 존중하는 문화가 있어요. 밥을 먹을 때 어른이 먼저 드셔야 해요. 명절에는 가족이 모여요. 한국의 K-팝과 드라마는 세계적으로 인기예요.",
            reading_qs: [
                { q: "한국의 중요한 문화적 가치는 뭐예요?", opts: ["빠른 것", "어른 존중", "경쟁", "독립"], c: 1 },
                { q: "가족이 언제 모여요?", opts: ["매주", "명절에", "매일", "생일에만"], c: 1 },
                { q: "세계적으로 인기 있는 것은 뭐예요?", opts: ["한국 음식만", "K-팝과 드라마", "한국 스포츠", "한국 건물"], c: 1 }
            ]
        },
    ],

    advanced: [
        {
            id: 'ka1', emoji: '📝', title: '학술 글쓰기 (Academic)', desc: "Akademik yozuv uslubi", level: 'advanced',
            words: ['일관성', '실질적', '현상', '함의', '구조', '합의', '비판적', '옹호하다', '완화하다', '모호하다'],
            xp: 200, coin: 90,
            grammar_rule: "학술문체: ~이다 대신 ~이라고 할 수 있다. 수동: ~되다, ~지다.",
            grammar_example: "이 현상은 사회적 문제라고 할 수 있다 (Bu hodisa ijtimoiy muammo deyish mumkin).",
            reading_text: "학술적 글쓰기는 논리적이어야 해요. 주장을 뒷받침하는 증거가 있어야 해요. 논문에는 서론, 본론, 결론이 있어요. 객관적인 언어를 사용해야 해요.",
            reading_qs: [
                { q: "학술적 글쓰기는 어때야 해요?", opts: ["창의적", "논리적", "감정적", "간단한"], c: 1 },
                { q: "논문의 구성 요소는 뭐예요?", opts: ["시작과 끝", "서론, 본론, 결론", "제목과 본론", "질문과 답"], c: 1 },
                { q: "어떤 언어를 써야 해요?", opts: ["감정적", "일상적", "객관적", "시적"], c: 2 }
            ]
        },
        {
            id: 'ka2', emoji: '🎯', title: 'TOPIK 고급 (TOPIK Advanced)', desc: "TOPIK oliy daraja tayyorgarlik", level: 'advanced',
            words: ['주권', '패러다임', '촉진하다', '비판적', '현상', '합의', '옹호하다', '미묘하다', '철저하다', '구조'],
            xp: 250, coin: 110,
            grammar_rule: "TOPIK 쓰기: ~(으)ㄴ/는 반면에 (holbuki). ~에도 불구하고 (qaramasdan).",
            grammar_example: "경제가 성장한 반면에 환경 문제가 심각해졌다 (Iqtisodiyot o'sdi, holbuki ekologik muammo kuchaydi).",
            reading_text: "TOPIK 고급은 한국어 능력 시험의 최고 단계예요. 복잡한 문법과 어휘를 알아야 해요. 사회, 문화, 경제 등 다양한 주제를 다루어요. 쓰기 시험도 있어요.",
            reading_qs: [
                { q: "TOPIK 고급이 뭐예요?", opts: ["기초 단계", "중급 단계", "최고 단계", "초급 단계"], c: 2 },
                { q: "어떤 주제를 다뤄요?", opts: ["과학만", "사회, 문화, 경제", "역사만", "언어만"], c: 1 },
                { q: "어떤 시험이 있어요?", opts: ["말하기", "읽기만", "쓰기 시험", "듣기만"], c: 2 }
            ]
        },
    ]
};

// ══════════════════════════════════════════════════════════════
// GRAMMAR QUESTIONS (Korean)
// ══════════════════════════════════════════════════════════════
const GRAMMAR_QS = [
    { q: "저는 학생___.", opts: ["이에요", "예요", "에요", "야"], ans: "이에요", exp: "'학생' undosh bilan tugaydi → 이에요" },
    { q: "어머니___ 선생님이에요.", opts: ["은", "는", "이", "가"], ans: "는", exp: "'어머니' unli bilan tugaydi → 는 (topic marker)" },
    { q: "밥___ 먹어요.", opts: ["이", "가", "을", "를"], ans: "을", exp: "'밥' undosh bilan tugaydi → 을 (object marker)" },
    { q: "학교___ 가요.", opts: ["을", "를", "이", "에"], ans: "에", exp: "Joylashuv + 에 + borish fe'li" },
    { q: "한국어를 공부___ 싶어요.", opts: ["하고", "하기", "하게", "하는"], ans: "하고", exp: "~고 싶다 = xohlamoq: fe'l + 고 싶다" },
    { q: "내일 서울에 갈 ___.", opts: ["거예요", "고요", "지요", "나요"], ans: "거예요", exp: "Kelajak: ~(으)ㄹ 거예요" },
    { q: "비가 오___ 우산을 가져가요.", opts: ["면", "지만", "고", "서"], ans: "면", exp: "Shart: ~면 = 'agar...'" },
    { q: "피곤___ 일찍 자요.", opts: ["하기 때문에", "하고", "하지만", "하면서"], ans: "하기 때문에", exp: "Sabab: ~기 때문에 = 'sababli'" },
    { q: "저___ 한국 사람이에요.", opts: ["은", "는", "이", "가"], ans: "는", exp: "'저' unli bilan tugaydi → 는" },
    { q: "음악을 들___ 좋아해요.", opts: ["어서", "으면", "는 걸", "기를"], ans: "는 걸", exp: "~는 것을/걸 좋아하다 = qilishni yaxshi ko'rmoq" },
    { q: "이 책은 재미있___ 쉬워요.", opts: ["고", "지만", "어서", "면서"], ans: "고", exp: "Ketma-ket sifatlar: ~고 = 'va'" },
    { q: "지금 뭐 ___?", opts: ["해요", "했어요", "할 거예요", "하세요"], ans: "해요", exp: "Hozirgi zamon oddiy: ~아요/어요" },
    { q: "어제 친구를 ___.", opts: ["만나요", "만날 거예요", "만났어요", "만나겠어요"], ans: "만났어요", exp: "O'tgan zamon: ~았/었어요" },
    { q: "더 열심히 공부___ 하세요.", opts: ["를", "가", "해야", "하고"], ans: "해야", exp: "Majburiyat: ~야 하다 = 'kerak'" },
    { q: "한국어가 어렵___ 재미있어요.", opts: ["고", "지만", "서", "면"], ans: "지만", exp: "Qarama-qarshilik: ~지만 = 'ammo/lekin'" },
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

// Korean TTS via SpeechSynthesis
window.speakWord = function (word, e) {
    if (e) e.stopPropagation();
    const u = new SpeechSynthesisUtterance(word);
    u.lang = 'ko-KR'; u.rate = 0.85;
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
            UProg = d.korProgress || {};
            USk = d.korSkills || { reading: 0, writing: 0, speaking: 0, listening: 0, grammar: 0 };
            UStats = d.stats || { unitsCompleted: 0, totalSessions: 0, streak: 0, totalXP: 0, totalCoins: 0 };
        } else {
            const newData = {
                email: CU.email, displayName: CU.displayName || CU.email.split('@')[0],
                plan: 'free', tokens: TOKEN_CONFIG.default_tokens, maxTokens: TOKEN_CONFIG.default_tokens,
                lastTokenReset: Date.now(), xp: 0, totalXP: 0, coins: 0, totalCoins: 0,
                rank: 'none', korProgress: {}, korSkills: { reading: 0, writing: 0, speaking: 0, listening: 0, grammar: 0 },
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
    if (coinFromXP > 0) { UCoin += coinFromXP; }
    const updates = { xp: increment(total), totalXP: increment(total), [`korSkills.${skill}`]: USk[skill] };
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
        <span style="font-size:0.78rem;color:#ef4444">⭐ ${UXP.toLocaleString()}</span>
        <span style="font-size:0.78rem;color:#fbbf24">🪙 ${UCoin.toLocaleString()}</span>
    </div>`;
}

// ══════════════════════════════════════════════════════════════
// LEADERBOARD — FIXED: no overflow, compact numbers
// ══════════════════════════════════════════════════════════════
function fmtNum(n) {
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
    if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
    return String(n);
}

window.loadLBSection = async function (field, btn) {
    if (btn) {
        document.querySelectorAll('#leaderboard-section .ptab').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
    }
    const container = $id('lbSectionContent'); if (!container) return;
    container.innerHTML = `<div style="text-align:center;padding:30px;color:#666"><i class="fa-solid fa-spinner fa-spin" style="font-size:1.5rem;color:#e74c3c"></i><br>Yuklanmoqda...</div>`;
    try {
        const q = query(collection(_db, 'users'), orderBy(field, 'desc'), limit(20));
        const snap = await getDocs(q);
        const users = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        if (!users.length) { container.innerHTML = '<p style="text-align:center;color:#666">Hali hech kim yo\'q</p>'; return; }

        const labels = { xp: 'XP', coins: 'Coin', unitsCompleted: 'Unit' };
        const icons = { xp: 'fa-star', coins: 'fa-coins', unitsCompleted: 'fa-book' };

        let html = `<div style="margin-bottom:16px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
            <span style="color:#888;font-size:0.8rem"><i class="fa-solid ${icons[field] || 'fa-trophy'}" style="margin-right:4px;color:#e74c3c"></i>${labels[field] || field} reytingi</span>
            <span style="color:#888;font-size:0.78rem">${users.length} nafar</span></div>`;

        users.forEach((u, i) => {
            const rank = i + 1;
            const isMe = u.id === CU?.uid;
            const rankClass = rank === 1 ? 'gold' : rank === 2 ? 'silver' : rank === 3 ? 'bronze' : '';
            const rankIcon = rank === 1
                ? '<i class="fa-solid fa-trophy" style="color:#f5c842;font-size:1rem"></i>'
                : rank === 2 ? '<i class="fa-solid fa-medal" style="color:#94a3b8;font-size:1rem"></i>'
                    : rank === 3 ? '<i class="fa-solid fa-medal" style="color:#cd7c4a;font-size:1rem"></i>'
                        : `<span style="font-size:0.82rem;font-weight:800;color:#555">${rank}</span>`;

            const rawVal = u[field] || 0;
            const val = fmtNum(rawVal);
            const planKey = (u.plan || 'free').toLowerCase();
            const pc = PLAN_COLORS[planKey] || '#94a3b8';
            const planLabel = PLAN_LABELS[planKey] || planKey.toUpperCase();
            const displayName = (u.displayName || u.email || 'Foydalanuvchi').slice(0, 18);
            const initial = displayName.charAt(0).toUpperCase();

            html += `<div style="display:flex;align-items:center;gap:10px;padding:10px 14px;border-radius:14px;background:${isMe ? 'rgba(231,76,60,0.08)' : 'rgba(255,255,255,0.03)'};border:1px solid ${isMe ? 'rgba(231,76,60,0.25)' : 'rgba(255,255,255,0.06)'};margin-bottom:7px;transition:all 0.2s;overflow:hidden">
                <div style="width:32px;text-align:center;flex-shrink:0">${rankIcon}</div>
                <div style="width:34px;height:34px;border-radius:50%;background:linear-gradient(135deg,#e74c3c,#c0392b);display:flex;align-items:center;justify-content:center;font-weight:700;color:#fff;font-size:0.9rem;flex-shrink:0">${initial}</div>
                <div style="flex:1;min-width:0;overflow:hidden">
                    <div style="font-weight:700;font-size:0.85rem;color:#e8ecff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${displayName}${isMe ? ' <span style="color:#e74c3c;font-size:0.7rem">(siz)</span>' : ''}</div>
                    ${planKey !== 'free' ? `<span style="font-size:0.62rem;padding:1px 6px;border-radius:8px;border:1px solid ${pc}44;color:${pc}">${planLabel}</span>` : ''}
                </div>
                <div style="text-align:right;flex-shrink:0">
                    <div style="font-weight:800;font-size:0.92rem;color:#e74c3c"><i class="fa-solid ${icons[field] || 'fa-star'}" style="margin-right:3px;font-size:0.75rem"></i>${val}</div>
                    <div style="font-size:0.62rem;color:#666">${labels[field] || field}</div>
                </div>
            </div>`;
        });
        container.innerHTML = html;
    } catch (e) {
        container.innerHTML = `<div style="text-align:center;padding:30px;color:#ef4444"><i class="fa-solid fa-triangle-exclamation"></i> Xatolik: ${e.message}<br>
        <button onclick="window.loadLBSection('${field}',null)" style="margin-top:12px;padding:8px 16px;border-radius:8px;background:#e74c3c22;border:1px solid #e74c3c44;color:#e74c3c;cursor:pointer">Qayta urinish</button></div>`;
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
    ctx.closePath(); ctx.fillStyle = 'rgba(231,76,60,0.2)'; ctx.fill();
    ctx.strokeStyle = 'rgba(231,76,60,0.8)'; ctx.lineWidth = 2; ctx.stroke();
    angles.forEach((a, i) => { ctx.beginPath(); ctx.arc(cx + r * skills[i] * Math.cos(a), cy + r * skills[i] * Math.sin(a), 4, 0, Math.PI * 2); ctx.fillStyle = '#e74c3c'; ctx.fill(); });
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
          <div style="font-size:0.75rem;color:#e74c3c;margin-bottom:4px;font-family:'Exo 2',sans-serif;font-weight:800;letter-spacing:.08em">UNIT ${i + 1}</div>
          <div style="font-size:1.8rem;margin-bottom:8px">${unit.emoji}</div>
          <div style="font-weight:700;font-size:0.95rem;color:#e8ecff;margin-bottom:4px">${unit.title}</div>
          <div style="font-size:0.78rem;color:#666;margin-bottom:12px">${unit.desc}</div>
          <div style="display:flex;gap:6px;margin-bottom:10px">
            ${['A', 'B', 'C', 'D'].map(l => `<div style="width:24px;height:24px;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:0.68rem;font-weight:800;background:${UProg[unit.id + '_' + l] >= 100 ? 'rgba(231,76,60,0.2)' : 'rgba(255,255,255,0.05)'};border:1px solid ${UProg[unit.id + '_' + l] >= 100 ? '#e74c3c' : 'rgba(255,255,255,0.1)'};color:${UProg[unit.id + '_' + l] >= 100 ? '#e74c3c' : '#666'}">${l}</div>`).join('')}
          </div>
          <div style="height:3px;background:rgba(255,255,255,0.06);border-radius:100px;overflow:hidden;margin-bottom:8px">
            <div style="height:100%;width:${pct}%;background:linear-gradient(90deg,#e74c3c,#c0392b);border-radius:100px;transition:width 0.4s"></div>
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
    const lcolors = { A: '#e74c3c', B: '#22d3ee', C: '#34d399', D: '#f472b6' };
    content.innerHTML = `
      <div style="text-align:center;padding-bottom:20px">
        <div style="font-size:3rem;margin-bottom:10px">${unit.emoji}</div>
        <h2 style="margin-bottom:8px;font-family:'Cinzel',serif">${unit.title}</h2>
        <p style="color:#666">${unit.desc}</p>
        <div style="display:flex;gap:16px;justify-content:center;margin:16px 0;flex-wrap:wrap">
          <span style="color:#f5c842">⭐ +${unit.xp} XP</span>
          <span style="color:#fbbf24">🪙 +${unit.coin} Coin</span>
          <span style="color:#60a5fa">📚 ${unit.words.length} so'z</span>
          <span style="color:#e74c3c">🎫 2 token/dars</span>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:20px">
        ${['A', 'B', 'C', 'D'].map(k => {
        const done = UProg[`${unit.id}_${k}`] >= 100;
        return `<div onclick="window.openLesson('${unit.id}','${k}')" style="padding:16px;border-radius:12px;background:${done ? 'rgba(231,76,60,0.08)' : 'rgba(255,255,255,0.03)'};border:1px solid ${done ? 'rgba(231,76,60,0.3)' : 'rgba(255,255,255,0.08)'};cursor:pointer;transition:all 0.2s">
                <div style="font-size:1.2rem;font-weight:800;color:${lcolors[k]};margin-bottom:4px">${k}</div>
                <div style="font-size:0.8rem;color:#e8ecff">${lnames[k]}</div>
                ${done ? '<div style="font-size:0.72rem;color:#34d399;margin-top:4px">✅ Bajarildi</div>' : '<div style="font-size:0.72rem;color:#666;margin-top:4px">▶ Boshlash</div>'}
            </div>`;
    }).join('')}
      </div>
      <div>
        <div style="font-size:0.78rem;color:#666;margin-bottom:8px">📝 So'zlar:</div>
        <div style="display:flex;flex-wrap:wrap;gap:6px">
          ${unit.words.map(w => `<span onclick="window.spk('${w.replace(/'/g, "\\'")}',event)" style="background:rgba(231,76,60,0.1);border:1px solid rgba(231,76,60,0.2);color:#ff6b6b;padding:4px 10px;border-radius:20px;font-size:0.76rem;cursor:pointer">${w} 🔊</span>`).join('')}
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
    curUnit = unit; curLesson = lessonKey; lScore = 0; lTotal = 0;
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
        const wd = WDB.find(x => x.e === w) || { ex: `${w}을/를 사용하세요.`, eu: '', u: '', r: '' };
        return `<div style="margin-bottom:14px;padding:14px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:12px">
          <div style="font-size:0.9rem;margin-bottom:2px">${i + 1}. 빈칸을 채우세요: <em style="color:#e74c3c">${wd.u}</em> (${wd.r})</div>
          <div style="font-size:0.75rem;color:#666;margin-bottom:8px;font-style:italic">${wd.eu}</div>
          <input id="gex${i}" data-ans="${w}" placeholder="Koreys so'zini yozing..." style="width:100%;padding:8px 12px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:8px;color:#e8ecff;font-family:inherit;margin-bottom:8px;box-sizing:border-box">
          <div style="display:flex;gap:6px">
            <button onclick="window.chkFill(${i})" style="padding:6px 14px;border-radius:8px;background:rgba(231,76,60,0.1);border:1px solid rgba(231,76,60,0.3);color:#e74c3c;cursor:pointer;font-size:0.78rem;font-family:inherit">✓ Tekshir</button>
            <button onclick="window.spk('${w.replace(/'/g, "\\'")}',event)" style="padding:6px 14px;border-radius:8px;background:rgba(96,165,250,0.1);border:1px solid rgba(96,165,250,0.2);color:#60a5fa;cursor:pointer;font-size:0.78rem;font-family:inherit">🔊</button>
          </div>
          <div id="gexfb${i}" style="margin-top:6px;font-size:0.8rem"></div>
        </div>`;
    }).join('');

    const matchW = words.slice(0, 6);
    const shuffUZ = shuffle(matchW.map(w => { const d = WDB.find(x => x.e === w); return d ? d.u : w; }));

    return `
    <div style="margin-bottom:20px">
      <h3 style="margin-bottom:12px;color:#e8ecff">📚 So'zlar va Romanizatsiya</h3>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:10px">
        ${words.map(w => {
        const d = WDB.find(x => x.e === w) || { u: '', r: '', t: '', ex: '', eu: '' };
        return `<div style="padding:14px;border-radius:12px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06)">
              <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px">
                <span style="font-weight:700;font-size:1rem;color:#e8ecff">${w}</span>
                <button onclick="window.spk('${w.replace(/'/g, "\\'")}',event)" style="background:none;border:none;cursor:pointer;font-size:1rem">🔊</button>
              </div>
              <div style="color:#e74c3c;font-size:0.76rem;margin-bottom:2px;font-style:italic">${d.r}</div>
              <div style="color:#a78bfa;font-size:0.82rem;margin-bottom:3px">${d.u}</div>
              <div style="color:#666;font-size:0.72rem;font-style:italic">"${d.ex}"</div>
            </div>`;
    }).join('')}
      </div>
    </div>
    <div style="margin-bottom:20px;padding:16px;background:rgba(231,76,60,0.06);border:1px solid rgba(231,76,60,0.15);border-radius:12px">
      <h3 style="margin-bottom:10px;color:#e8ecff">📝 Grammatika Qoidasi</h3>
      <div style="font-size:0.9rem;color:#ffb3b3;margin-bottom:8px">💡 ${unit.grammar_rule || ''}</div>
      <div style="font-size:0.85rem;color:#e74c3c;font-style:italic">✏️ ${unit.grammar_example || ''}</div>
      <button onclick="window.aiGrammarExplain('${unit.title}','${(unit.grammar_rule || '').replace(/'/g, "\\'")}')" style="margin-top:10px;padding:8px 16px;border-radius:8px;background:rgba(231,76,60,0.1);border:1px solid rgba(231,76,60,0.25);color:#e74c3c;cursor:pointer;font-size:0.78rem;font-family:inherit">🤖 AI batafsil (1 token)</button>
      <div id="gramRuleFB" style="margin-top:8px;font-size:0.8rem"></div>
    </div>
    <div style="margin-bottom:20px">
      <h3 style="margin-bottom:12px;color:#e8ecff">✏️ To'ldirish Mashqlari</h3>
      ${fills}
    </div>
    <div style="margin-bottom:20px">
      <h3 style="margin-bottom:12px;color:#e8ecff">🧩 Juftlash Mashqi</h3>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        <div>${matchW.map((w, i) => `<div class="match-item eng" data-i="${i}" onclick="window.selMatch(this,'e',${i})" style="padding:10px 14px;border-radius:10px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);cursor:pointer;margin-bottom:6px;font-size:0.88rem;color:#e8ecff;transition:all 0.2s">${w}</div>`).join('')}</div>
        <div>${shuffUZ.map(u => `<div class="match-item uz" data-u="${u}" onclick="window.selMatch(this,'u','${u.replace(/'/g, "\\'")}')" style="padding:10px 14px;border-radius:10px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);cursor:pointer;margin-bottom:6px;font-size:0.88rem;color:#ffb3b3;transition:all 0.2s">${u}</div>`).join('')}</div>
      </div>
      <div id="matchFB" style="margin-top:8px;font-size:0.8rem"></div>
    </div>
    <button onclick="window.finLessonA('${unit.id}')" style="width:100%;padding:14px;border-radius:12px;background:linear-gradient(135deg,#e74c3c,#c0392b);border:none;color:#fff;font-size:0.95rem;font-weight:700;cursor:pointer;font-family:inherit">✅ Grammatika darsini yakunlash</button>`;
}

window.chkFill = function (i) {
    const inp = $id(`gex${i}`); const fb = $id(`gexfb${i}`);
    if (!inp || !fb) return;
    if (inp.value.trim() === inp.dataset.ans) {
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
        el.style.background = 'rgba(231,76,60,0.2)'; el.style.borderColor = '#e74c3c';
        mSel.e = val; mSel.eEl = el;
    } else {
        document.querySelectorAll('.match-item.uz').forEach(x => { x.style.borderColor = 'rgba(255,255,255,0.1)'; x.style.background = 'rgba(255,255,255,0.04)'; });
        el.style.background = 'rgba(231,76,60,0.2)'; el.style.borderColor = '#e74c3c';
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
    const r = await callAI(`Koreys tili. "${title}" mavzusida "${rule}" grammatika qoidasini ${NATIVE_LANG} tilida (javob shu tilda bo'lsin) tushuntir. 3 ta misol keltir.`, 800);
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
        <button onclick="window.playDict('${unit.id}','normal')" style="padding:8px 16px;border-radius:8px;background:rgba(231,76,60,0.1);border:1px solid rgba(231,76,60,0.2);color:#e74c3c;cursor:pointer;font-size:0.82rem;font-family:inherit">▶ Eshitish</button>
        <button onclick="window.playDict('${unit.id}','slow')" style="padding:8px 16px;border-radius:8px;background:rgba(167,139,250,0.1);border:1px solid rgba(167,139,250,0.2);color:#a78bfa;cursor:pointer;font-size:0.82rem;font-family:inherit">🐌 Sekin</button>
      </div>
      <textarea id="dictIn" placeholder="Eshitgangizni yozing..." style="width:100%;height:80px;padding:10px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:8px;color:#e8ecff;font-family:inherit;resize:none;box-sizing:border-box"></textarea>
      <div style="display:flex;gap:6px;margin-top:8px">
        <button onclick="window.chkDict()" style="padding:7px 14px;border-radius:8px;background:rgba(52,211,153,0.1);border:1px solid rgba(52,211,153,0.3);color:#34d399;cursor:pointer;font-size:0.78rem;font-family:inherit">✓ Tekshir</button>
      </div>
      <div id="dictFB" style="margin-top:8px;font-size:0.8rem"></div>
    </div>
    <button onclick="window.finLessonB('${unit.id}')" style="width:100%;padding:14px;border-radius:12px;background:linear-gradient(135deg,#22d3ee,#e74c3c);border:none;color:#fff;font-size:0.95rem;font-weight:700;cursor:pointer;font-family:inherit">✅ Listening yakunlash</button>`;
}

function genListenExs(unit) {
    const w = unit.words;
    return [
        {
            text: `오늘은 ${unit.title}에 대해 배워요. "${w[0]}"은/는 중요한 표현이에요.`,
            q: `오늘 무엇에 대해 배워요?`,
            opts: [unit.title.split(' ')[0], '스포츠', '숫자', '색깔'],
            c: 0,
            tip: `"오늘은 ...에 대해 배워요"`
        },
        {
            text: `안녕하세요! 저는 ${w[0]}을/를 좋아해요. 그리고 ${w[1] || w[0]}도 알아요. 준비됐어요?`,
            q: `말하는 사람이 뭘 좋아해요?`,
            opts: [`${w[2] || w[0]}`, `${w[0]}`, '아무것도 없어요', '다 좋아해요'],
            c: 1,
            tip: `"저는 ...을/를 좋아해요"`
        },
        {
            text: `한국어를 열심히 공부하면 잘 할 수 있어요. 매일 연습하는 것이 중요해요. 화이팅!`,
            q: `한국어를 위해 뭐가 중요해요?`,
            opts: ['재능', '돈', '매일 연습', '운'],
            c: 2,
            tip: `"매일 연습하는 것이 중요해요"`
        }
    ];
}

function renderLex(exs, idx) {
    const ex = exs[idx];
    if (!ex) return '<div style="text-align:center;padding:20px;color:#34d399">🎉 Barcha listening mashqlari tugadi!</div>';
    return `<div style="padding:16px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:12px">
      <div style="font-size:0.75rem;color:#e74c3c;margin-bottom:8px">Savol ${idx + 1}/${exs.length}</div>
      <div style="display:flex;gap:8px;margin-bottom:12px">
        <button onclick="window.playLex(${idx},'normal')" style="padding:8px 16px;border-radius:8px;background:rgba(231,76,60,0.1);border:1px solid rgba(231,76,60,0.2);color:#e74c3c;cursor:pointer;font-size:0.82rem;font-family:inherit">▶ Tinglash</button>
        <button onclick="window.playLex(${idx},'slow')" style="padding:8px 16px;border-radius:8px;background:rgba(167,139,250,0.1);border:1px solid rgba(167,139,250,0.2);color:#a78bfa;cursor:pointer;font-size:0.82rem;font-family:inherit">🐌 Sekin</button>
      </div>
      <div id="ltxt${idx}" style="display:none;padding:10px;background:rgba(255,255,255,0.04);border-radius:8px;font-size:0.82rem;color:#e8ecff;margin-bottom:10px">${ex.text}</div>
      <div style="font-weight:600;margin-bottom:10px">${ex.q}</div>
      <div>${ex.opts.map((o, oi) => `<div class="lex-opt" data-qi="${idx}" data-oi="${oi}" onclick="window.selLex(this,${idx},${oi})" style="padding:10px 14px;border-radius:8px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);cursor:pointer;margin-bottom:6px;font-size:0.88rem;transition:all 0.2s">${String.fromCharCode(65 + oi)}. ${o}</div>`).join('')}</div>
      <div style="font-size:0.75rem;color:#666;margin-bottom:10px">💡 ${ex.tip}</div>
      <div style="display:flex;gap:6px">
        <button onclick="window.chkLex(${idx},${ex.c})" style="padding:7px 14px;border-radius:8px;background:rgba(52,211,153,0.1);border:1px solid rgba(52,211,153,0.3);color:#34d399;cursor:pointer;font-size:0.78rem;font-family:inherit">✓ Tekshir</button>
        ${idx + 1 < exs.length ? `<button onclick="window.nextLex(${idx + 1})" id="lexnxt${idx}" style="display:none;padding:7px 14px;border-radius:8px;background:rgba(231,76,60,0.1);border:1px solid rgba(231,76,60,0.2);color:#e74c3c;cursor:pointer;font-size:0.78rem;font-family:inherit">→ Keyingi</button>` : ''}
      </div>
      <div id="lexfb${idx}" style="margin-top:8px;font-size:0.8rem"></div>
    </div>`;
}

window.playLex = function (idx, speed) {
    const exs = window.__listenExs || []; if (!exs[idx]) return;
    const u = new SpeechSynthesisUtterance(exs[idx].text);
    u.lang = 'ko-KR'; u.rate = speed === 'slow' ? 0.55 : 0.82;
    speechSynthesis.cancel(); speechSynthesis.speak(u);
};
window.selLex = function (el, qi, oi) {
    document.querySelectorAll(`.lex-opt[data-qi="${qi}"]`).forEach(o => { o.style.background = 'rgba(255,255,255,0.04)'; o.style.borderColor = 'rgba(255,255,255,0.08)'; });
    el.style.background = 'rgba(231,76,60,0.15)'; el.style.borderColor = '#e74c3c';
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
    if (sel === correct) { if (fb) fb.innerHTML = "<span style='color:#34d399'>✅ To'g'ri!</span>"; lScore++; awardXP(15, 'listening'); }
    else { if (fb) fb.innerHTML = `<span style='color:#ef4444'>❌ To'g'ri: <strong>${String.fromCharCode(65 + correct)}</strong></span>`; }
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
    dictSent = wd ? wd.ex : `${unit.words[0]}은/는 중요해요.`;
    const u2 = new SpeechSynthesisUtterance(dictSent);
    u2.lang = 'ko-KR'; u2.rate = speed === 'slow' ? 0.5 : 0.82;
    speechSynthesis.cancel(); speechSynthesis.speak(u2);
};
window.chkDict = function () {
    const inp = $id('dictIn'); const fb = $id('dictFB');
    if (!inp || !fb || !dictSent) { if (fb) fb.innerHTML = '<span style="color:#f5c842">⚠️ Avval audio tinglang!</span>'; return; }
    const cw = dictSent.split('');
    const uw = inp.value.trim().split('');
    let mc = 0;
    cw.forEach(c => { if (uw.includes(c)) mc++; });
    const pct = Math.round((mc / cw.length) * 100);
    fb.innerHTML = `<div><strong>To'g'ri:</strong> ${dictSent}</div><div style="margin-top:6px"><strong>Siz:</strong> ${inp.value}</div><div style="font-size:0.9rem;font-weight:700;margin-top:6px;color:${pct >= 70 ? '#34d399' : '#ef4444'}">${pct}%</div>`;
    if (pct >= 70) { lScore++; awardXP(20, 'listening'); }
    lTotal++;
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
        <div style="font-weight:700;font-size:1rem;margin-bottom:10px;color:#e8ecff">${unit.title}</div>
        <div id="rdbody" style="font-size:0.9rem;line-height:1.9;color:#c7d2fe">${unit.reading_text || ''}</div>
        <button onclick="window.rdAloud()" style="margin-top:12px;padding:7px 14px;border-radius:8px;background:rgba(231,76,60,0.1);border:1px solid rgba(231,76,60,0.2);color:#e74c3c;cursor:pointer;font-size:0.78rem;font-family:inherit">🔊 Koreyscha Tinglash</button>
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
        const d = WDB.find(x => x.e === w) || { u: w };
        return `<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;flex-wrap:wrap">
          <span style="color:#e74c3c;font-size:0.85rem;min-width:100px">${d.u}</span>
          <input id="whi${i}" data-ans="${w}" placeholder="Koreys harflari bilan..." style="flex:1;min-width:120px;padding:8px 12px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:8px;color:#e8ecff;font-family:inherit">
          <button onclick="window.chkWH(${i})" style="padding:7px 12px;border-radius:8px;background:rgba(52,211,153,0.1);border:1px solid rgba(52,211,153,0.3);color:#34d399;cursor:pointer;font-size:0.78rem;font-family:inherit">✓</button>
          <button onclick="window.spk('${w.replace(/'/g, "\\'")}',event)" style="padding:7px 12px;border-radius:8px;background:rgba(231,76,60,0.1);border:1px solid rgba(231,76,60,0.2);color:#e74c3c;cursor:pointer;font-size:0.78rem;font-family:inherit">🔊</button>
          <span id="whfb${i}" style="font-size:0.8rem;min-width:30px"></span>
        </div>`;
    }).join('')}
    </div>
    <button onclick="window.finLessonC('${unit.id}')" style="width:100%;padding:14px;border-radius:12px;background:linear-gradient(135deg,#34d399,#22d3ee);border:none;color:#fff;font-size:0.95rem;font-weight:700;cursor:pointer;font-family:inherit">✅ Reading yakunlash</button>`;
}

window.rdAloud = function () {
    const b = $id('rdbody'); if (!b) return;
    const u = new SpeechSynthesisUtterance(b.textContent);
    u.lang = 'ko-KR'; u.rate = 0.82;
    speechSynthesis.cancel(); speechSynthesis.speak(u);
};
window.selRQ = function (el, qi, oi) {
    document.querySelectorAll(`.rq-opt[data-qi="${qi}"]`).forEach(o => { o.style.background = 'rgba(255,255,255,0.04)'; o.style.borderColor = 'rgba(255,255,255,0.08)'; });
    el.style.background = 'rgba(231,76,60,0.15)'; el.style.borderColor = '#e74c3c';
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
        if (sel === correct) { score++; if (fb) fb.innerHTML = "<span style='color:#34d399'>✅ To'g'ri!</span>"; }
        else { if (fb) fb.innerHTML = `<span style='color:#ef4444'>❌ To'g'ri: ${String.fromCharCode(65 + correct)}</span>`; }
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
    const woSent = (WDB.find(x => x.e === unit.words[0])?.ex) || `${unit.words[0]}을/를 사용해요.`;
    window.__woCorrect = woSent;
    return `
    <div style="margin-bottom:20px">
      <h3 style="margin-bottom:12px;color:#e8ecff">🎤 Speaking Mashqi</h3>
      ${topics.map((w, i) => {
        const d = WDB.find(x => x.e === w) || { u: '', r: '', ex: '' };
        return `<div style="margin-bottom:14px;padding:14px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:12px">
          <div style="font-weight:600;margin-bottom:4px">${i + 1}. "${w}" (${d.r}) so'zini ishlatib gaping:</div>
          <div style="font-size:0.78rem;color:#666;margin-bottom:10px">O'zbek: ${d.u}</div>
          <div style="display:flex;gap:6px;margin-bottom:8px">
            <button id="mbtn${i}" onclick="window.togMic(${i})" style="padding:8px 16px;border-radius:8px;background:rgba(231,76,60,0.1);border:1px solid rgba(231,76,60,0.25);color:#e74c3c;cursor:pointer;font-size:0.82rem;font-family:inherit">🎤 Gapirish</button>
            <button onclick="window.spk('${w.replace(/'/g, "\\'")}',event)" style="padding:8px 12px;border-radius:8px;background:rgba(96,165,250,0.1);border:1px solid rgba(96,165,250,0.2);color:#60a5fa;cursor:pointer;font-size:0.82rem;font-family:inherit">🔊</button>
          </div>
          <div id="mst${i}" style="font-size:0.75rem;color:#666"></div>
          <div id="mtr${i}" style="padding:8px;font-size:0.88rem;color:#ffb3b3;min-height:24px;border-radius:6px"></div>
          <div style="display:flex;gap:6px;margin-top:8px">
            <button onclick="window.aiSpk(${i},'${w}')" style="padding:6px 14px;border-radius:8px;background:rgba(231,76,60,0.1);border:1px solid rgba(231,76,60,0.25);color:#e74c3c;cursor:pointer;font-size:0.78rem;font-family:inherit">🤖 AI baholash (1 token)</button>
            <button onclick="window.markDone(${i})" style="padding:6px 14px;border-radius:8px;background:rgba(52,211,153,0.1);border:1px solid rgba(52,211,153,0.3);color:#34d399;cursor:pointer;font-size:0.78rem;font-family:inherit">✅ Bajarildi</button>
          </div>
          <div id="sfb${i}" style="margin-top:8px;font-size:0.82rem"></div>
        </div>`;
    }).join('')}
    </div>
    <div style="margin-bottom:20px">
      <h3 style="margin-bottom:12px;color:#e8ecff">✍️ Writing Mashqi</h3>
      <div style="padding:14px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:12px">
        <div style="font-size:0.85rem;color:#aaa;margin-bottom:8px">Mavzu: "${unit.title}" haqida koreyscha 30+ so'zli matn yozing.</div>
        <textarea id="dta" placeholder="여기에 한국어로 쓰세요..." oninput="window.updWC()" style="width:100%;height:100px;padding:10px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:8px;color:#e8ecff;font-family:inherit;resize:none;box-sizing:border-box"></textarea>
        <div style="display:flex;gap:10px;font-size:0.75rem;color:#666;margin:6px 0"><span id="dwc">0 so'z</span><span id="dcc">0 belgi</span><span id="dst" style="color:#f87171">Min 30 so'z</span></div>
        <div style="display:flex;gap:6px">
          <button onclick="window.aiWrit('${unit.title}')" style="padding:7px 14px;border-radius:8px;background:rgba(231,76,60,0.1);border:1px solid rgba(231,76,60,0.25);color:#e74c3c;cursor:pointer;font-size:0.78rem;font-family:inherit">🤖 AI tekshir (1 token)</button>
          <button onclick="window.selfChk(30)" style="padding:7px 14px;border-radius:8px;background:rgba(96,165,250,0.1);border:1px solid rgba(96,165,250,0.2);color:#60a5fa;cursor:pointer;font-size:0.78rem;font-family:inherit">📊 So'z soni</button>
        </div>
        <div id="wfb" style="margin-top:8px;font-size:0.8rem"></div>
      </div>
    </div>
    <div style="margin-bottom:20px">
      <h3 style="margin-bottom:12px;color:#e8ecff">🔀 So'z Tartibi</h3>
      <div id="woChips" style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px">
        ${shuffle(woSent.split(' ')).map(w => `<div class="wo-chip" data-w="${w}" onclick="window.selChip(this)" style="padding:6px 12px;border-radius:20px;background:rgba(231,76,60,0.1);border:1px solid rgba(231,76,60,0.25);color:#ffb3b3;cursor:pointer;font-size:0.85rem">${w}</div>`).join('')}
      </div>
      <div id="woAnsDiv" style="min-height:40px;padding:10px;background:rgba(255,255,255,0.03);border:1px dashed rgba(255,255,255,0.1);border-radius:8px;display:flex;flex-wrap:wrap;gap:6px;font-size:0.88rem;color:#666;margin-bottom:8px"><span>Bu yerga bosing...</span></div>
      <div style="display:flex;gap:6px">
        <button onclick="window.chkWO()" style="padding:7px 14px;border-radius:8px;background:rgba(52,211,153,0.1);border:1px solid rgba(52,211,153,0.3);color:#34d399;cursor:pointer;font-size:0.78rem;font-family:inherit">✓ Tekshir</button>
        <button onclick="window.rstWO()" style="padding:7px 14px;border-radius:8px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);color:#e8ecff;cursor:pointer;font-size:0.78rem;font-family:inherit">🔄 Qayta</button>
        <button onclick="window.spk('${woSent.replace(/'/g, "\\'")}',event)" style="padding:7px 14px;border-radius:8px;background:rgba(231,76,60,0.1);border:1px solid rgba(231,76,60,0.2);color:#e74c3c;cursor:pointer;font-size:0.78rem;font-family:inherit">🔊</button>
      </div>
      <div id="wofb" style="margin-top:8px;font-size:0.8rem"></div>
    </div>
    <button onclick="window.finLessonD('${unit.id}')" style="width:100%;padding:14px;border-radius:12px;background:linear-gradient(135deg,#e74c3c,#a78bfa);border:none;color:#fff;font-size:0.95rem;font-weight:700;cursor:pointer;font-family:inherit">✅ Speaking & Writing yakunlash</button>`;
}

window.selChip = function (el) {
    if (el.classList.contains('used')) return;
    el.classList.add('used'); el.style.opacity = '0.3';
    woAns.push(el.dataset.w);
    const d = $id('woAnsDiv');
    if (d) d.innerHTML = woAns.map((w, i) => `<span onclick="window.rmChip(${i})" style="background:rgba(231,76,60,0.15);border:1px solid rgba(231,76,60,0.3);border-radius:20px;padding:6px 12px;cursor:pointer;font-size:0.85rem">${w}</span>`).join('') || '<span style="color:#666">Bu yerga bosing...</span>';
};
window.rmChip = function (idx) {
    const w = woAns[idx]; woAns.splice(idx, 1);
    document.querySelectorAll('.wo-chip').forEach(c => { if (c.dataset.w === w && c.classList.contains('used')) { c.classList.remove('used'); c.style.opacity = '1'; return; } });
    const d = $id('woAnsDiv');
    if (d) d.innerHTML = woAns.map((w, i) => `<span onclick="window.rmChip(${i})" style="background:rgba(231,76,60,0.15);border:1px solid rgba(231,76,60,0.3);border-radius:20px;padding:6px 12px;cursor:pointer;font-size:0.85rem">${w}</span>`).join('') || '<span style="color:#666">Bu yerga bosing...</span>';
};
window.rstWO = function () {
    woAns = [];
    document.querySelectorAll('.wo-chip').forEach(c => { c.classList.remove('used'); c.style.opacity = '1'; });
    const d = $id('woAnsDiv'); if (d) d.innerHTML = '<span style="color:#666">Bu yerga bosing...</span>';
};
window.chkWO = function () {
    const fb = $id('wofb');
    if (!woAns.length) { if (fb) fb.innerHTML = "<span style='color:#f5c842'>⚠️ So'zlarni tartibga qo'ying!</span>"; return; }
    if (woAns.join(' ') === window.__woCorrect) {
        if (fb) fb.innerHTML = "<span style='color:#34d399'>🏆 Mukammal!</span>";
        awardXP(15, 'writing'); lScore++;
    } else { if (fb) fb.innerHTML = `<span style='color:#ef4444'>❌ To'g'ri: <em>${window.__woCorrect}</em></span>`; }
    lTotal++;
};
window.togMic = function (idx) {
    const btn = $id(`mbtn${idx}`); const st = $id(`mst${idx}`); const tr = $id(`mtr${idx}`);
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
        if (tr) tr.innerHTML = `<textarea style="width:100%;padding:8px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:8px;color:#e8ecff;font-family:inherit" id="man${idx}" placeholder="한국어로 쓰세요..."></textarea>`;
        if (st) st.textContent = '⌨️ Yozma kiritish'; return;
    }
    if (lessonMics[idx]) { try { lessonMics[idx].stop(); } catch (e) { } lessonMics[idx] = null; if (btn) btn.innerHTML = '🎤 Gapirish'; return; }
    const rec = new SR(); rec.lang = 'ko-KR'; rec.continuous = true; rec.interimResults = true;
    rec.onresult = e => { let t = ''; for (let i = e.resultIndex; i < e.results.length; i++) t += e.results[i][0].transcript; if (tr && tr.tagName !== 'TEXTAREA') tr.textContent = t; };
    rec.onerror = e => { if (btn) btn.innerHTML = '🎤 Gapirish'; lessonMics[idx] = null; if (e.error === 'not-allowed' && tr) tr.innerHTML = `<textarea style="width:100%;padding:8px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:8px;color:#e8ecff;font-family:inherit" id="man${idx}" placeholder="한국어로 쓰세요..."></textarea>`; };
    rec.onend = () => { if (btn) btn.innerHTML = '🎤 Gapirish'; if (st) st.innerHTML = '✅ Yozib olindi'; lessonMics[idx] = null; };
    try { rec.start(); lessonMics[idx] = rec; if (btn) btn.innerHTML = "⏹ To'xtatish"; if (st) st.innerHTML = '🔴 Yozmoqda...'; }
    catch (e) { if (tr) tr.innerHTML = `<textarea style="width:100%;padding:8px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:8px;color:#e8ecff;font-family:inherit" id="man${idx}" placeholder="한국어로 쓰세요..."></textarea>`; }
};
window.aiSpk = async function (idx, topic) {
    const ok = await spendTokens(TOKEN_CONFIG.ai_cost, 'AI speaking baholash'); if (!ok) return;
    const tr = $id(`mtr${idx}`); const man = $id(`man${idx}`); const fb = $id(`sfb${idx}`);
    let text = '';
    if (tr) text = tr.tagName === 'TEXTAREA' ? tr.value.trim() : tr.textContent.trim();
    if (!text && man) text = man.value.trim();
    if (!text) { if (fb) fb.innerHTML = "<span style='color:#f5c842'>⚠️ Avval gapiring!</span>"; return; }
    if (fb) fb.innerHTML = '🤖 Baholayapti...';
    const r = await callAI(`Koreys tili speaking baholash. Mavzu: "${topic}". O'quvchi: "${text}".\n${NATIVE_LANG} tilida (javob shu tilda bo'lsin): 1) ✅ Yaxshi tomonlar 2) ❌ Xatoliklar 3) 🔄 Tuzatilgan variant 4) ⭐ /10`, 700);
    if (fb) fb.innerHTML = r.replace(/\n/g, '<br>');
    lScore++; lTotal++; awardXP(20, 'speaking');
};
window.markDone = function (idx) { lScore++; lTotal++; awardXP(10, 'speaking'); showToast('✅ Bajarildi!', 'success'); };
window.updWC = function () {
    const ta = $id('dta'); if (!ta) return;
    const w = ta.value.trim() ? ta.value.trim().split(/\s+/).length : 0;
    const wc = $id('dwc'); const cc = $id('dcc'); const st = $id('dst');
    if (wc) wc.textContent = w + " so'z";
    if (cc) cc.textContent = ta.value.length + ' belgi';
    if (st) { st.textContent = w >= 30 ? '✅ Yetarli' : `Min 30 (${w}/30)`; st.style.color = w >= 30 ? '#34d399' : '#f87171'; }
};
window.selfChk = function (min) {
    const ta = $id('dta'); const fb = $id('wfb'); if (!ta || !fb) return;
    const w = ta.value.trim() ? ta.value.trim().split(/\s+/).length : 0;
    if (w >= min) { fb.innerHTML = `<span style="color:#34d399">✅ ${w} so'z!</span>`; lScore++; awardXP(15, 'writing'); }
    else { fb.innerHTML = `<span style="color:#f87171">⚠️ ${min - w} so'z kam!</span>`; }
    lTotal++;
};
window.aiWrit = async function (title) {
    const ok = await spendTokens(TOKEN_CONFIG.ai_cost, 'AI writing'); if (!ok) return;
    const ta = $id('dta'); const fb = $id('wfb');
    if (!ta?.value.trim()) { if (fb) fb.innerHTML = '<span style="color:#f5c842">Avval yozing!</span>'; return; }
    fb.innerHTML = '🤖 Tekshirmoqda...';
    const r = await callAI(`Koreys tili writing tekshirish. Mavzu: "${title}".\nMatn: "${ta.value.trim()}"\n${NATIVE_LANG} tilida (javob shu tilda bo'lsin): 1) Grammatika 2) Uslub 3) Tuzatilgan variant 4) TOPIK bali: /6`, 800);
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
    if (!CU) { UXP += xpEarned; UCoin += coinEarned; updateDisplays(); renderUnits(); showToast(`✅ +${xpEarned} XP +${coinEarned} 🪙`, 'success'); return; }
    try {
        const updates = {
            xp: increment(xpEarned), coins: increment(coinEarned),
            totalXP: increment(xpEarned), totalCoins: increment(coinEarned),
            [`korProgress.${unitId}_${lessonKey}`]: 100,
            'stats.totalSessions': increment(1)
        };
        if (allDone) {
            updates['stats.unitsCompleted'] = increment(1);
            updates.xp = increment(xpEarned + 50);
            updates.coins = increment(coinEarned + 10);
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
    const lnames = { A: 'Grammatika', B: 'Listening', C: 'Reading', D: 'Speaking' };
    const nxt = { A: 'B', B: 'C', C: 'D', D: null };
    const content = $id('modalContent'); if (!content) return;
    const circleColor = pct >= 80 ? '#34d399' : pct >= 60 ? '#f5c842' : '#ef4444';
    content.innerHTML = `<div style="text-align:center;padding:20px">
      <div style="width:120px;height:120px;border-radius:50%;background:${circleColor}22;border:3px solid ${circleColor};display:flex;flex-direction:column;align-items:center;justify-content:center;margin:0 auto 20px">
        <div style="font-size:1.8rem;font-weight:800;color:${circleColor}">${pct}%</div>
        <div style="font-size:0.72rem;color:${circleColor}">${lnames[lk]}</div>
      </div>
      <div style="display:flex;gap:16px;justify-content:center;margin:16px 0">
        <div style="padding:12px 20px;border-radius:12px;background:rgba(167,139,250,0.1);border:1px solid rgba(167,139,250,0.2)"><div style="font-size:0.7rem;color:#666">XP</div><div style="font-weight:700;color:#a78bfa">+${xp}</div></div>
        <div style="padding:12px 20px;border-radius:12px;background:rgba(245,200,66,0.1);border:1px solid rgba(245,200,66,0.2)"><div style="font-size:0.7rem;color:#666">Coin</div><div style="font-weight:700;color:#f5c842">+${coin}</div></div>
      </div>
      <div style="font-size:1.2rem;margin-bottom:20px">${pct >= 80 ? '🏆 Mukammal!' : pct >= 60 ? '✅ Yaxshi!' : '💪 Qayta urining!'}</div>
      <div style="display:flex;flex-direction:column;gap:8px">
        ${nxt[lk] ? `<button onclick="window.openLesson('${uid}','${nxt[lk]}')" style="padding:12px;border-radius:12px;background:linear-gradient(135deg,#e74c3c,#c0392b);border:none;color:#fff;font-size:0.9rem;font-weight:700;cursor:pointer;font-family:inherit">→ Keyingi: ${lnames[nxt[lk]]}</button>` : `<div style="padding:14px;border-radius:12px;background:rgba(52,211,153,0.1);border:1px solid rgba(52,211,153,0.25);color:#34d399;font-weight:700">🎉 Unit to'liq bajarildi!</div>`}
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
        const ms = !wSrch || w.e.toLowerCase().includes(wSrch) || w.u.toLowerCase().includes(wSrch) || w.r.toLowerCase().includes(wSrch);
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
          <button onclick="window.spk('${w.e.replace(/'/g, "\\'")}',event)" style="background:none;border:none;cursor:pointer;font-size:1rem">🔊</button>
        </div>
        <div style="color:#e74c3c;font-size:0.76rem;margin-bottom:3px;font-style:italic">${w.r}</div>
        <div style="font-size:0.82rem;color:#a78bfa;margin-bottom:6px">${w.u}</div>
        <div style="display:flex;gap:6px;font-size:0.68rem">
          <span style="background:rgba(255,255,255,0.05);padding:2px 8px;border-radius:8px;color:#666">${w.t}</span>
          <span style="background:rgba(255,255,255,0.05);padding:2px 8px;border-radius:8px;color:#666">${w.l}</span>
        </div>`;
        card.onmouseover = () => { card.style.background = 'rgba(231,76,60,0.08)'; card.style.borderColor = 'rgba(231,76,60,0.25)'; };
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
      <div style="font-size:2.2rem;font-weight:800;color:#e8ecff;margin-bottom:4px">${w.e}</div>
      <div style="font-size:0.95rem;color:#e74c3c;margin-bottom:4px;font-style:italic">${w.r}</div>
      <div style="font-size:1.1rem;color:#a78bfa;margin-bottom:12px">${w.u}</div>
      <div style="font-size:0.82rem;color:#666;margin:0 0 4px">${w.t}</div>
      <div style="padding:12px;background:rgba(255,255,255,0.04);border-radius:10px;margin-bottom:16px;font-size:0.88rem;color:#c7d2fe">"${w.ex}"</div>
      <div style="color:#a78bfa;font-size:0.82rem;margin-bottom:16px">${w.eu}</div>
      <div style="display:flex;gap:8px;justify-content:center">
        <button onclick="window.spk('${w.e.replace(/'/g, "\\'")}',event)" style="padding:8px 20px;border-radius:10px;background:rgba(231,76,60,0.15);border:1px solid rgba(231,76,60,0.3);color:#ff6b6b;cursor:pointer;font-family:inherit">🔊 Tinglash</button>
      </div>
    </div>`;
    m.classList.add('active');
}
window.closeWordModal = function (e) { if (!e || e.target === $id('wordModal')) $id('wordModal')?.classList.remove('active'); };

// ══════════════════════════════════════════════════════════════
// PRACTICE
// ══════════════════════════════════════════════════════════════
window.switchPractice = function (panel, el) {
    document.querySelectorAll('.practice-panel').forEach(p => p.classList.remove('active'));
    const p = $id('panel-' + panel); if (p) p.classList.add('active');
    if (el) { document.querySelectorAll('.ptab').forEach(b => b.classList.remove('active')); el.classList.add('active'); }
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
    const fw = $id('flashWord'); if (fw) fw.textContent = w.e;
    const fu = $id('flashUz'); if (fu) fu.textContent = w.u;
    const frm = $id('flashRom'); if (frm) frm.textContent = w.r;
    const fe = $id('flashEx'); if (fe) fe.textContent = w.ex || '';
    const fp = $id('flashProgress'); if (fp) fp.textContent = (flashIdx + 1) + ' / ' + flashDeck.length;
    const fb = $id('flashBar'); if (fb) fb.style.width = Math.round((flashIdx / flashDeck.length) * 100) + '%';
}
window.flipCard = function () { const fc = $id('flashcard'); if (fc) fc.classList.toggle('flipped'); if (flashIdx < flashDeck.length) window.speakWord(flashDeck[flashIdx].e); };
window.flashResult = function (result) { if (result === 'correct') { flashCorrect++; awardXP(5, 'grammar'); } else flashWrong++; flashIdx++; showFlash(); };
window.nextFlash = function () { flashIdx++; showFlash(); };

// ── Quiz ──
function initQuiz() { quizScore = 0; const el = $id('quizScore'); if (el) el.textContent = 0; showQuizWord(); }
function showQuizWord() {
    quizAnswered = false;
    const pool = shuffle([...WDB]); curQuizWord = pool[0];
    const opts = shuffle([curQuizWord, ...pool.slice(1, 4)]);
    const type = Math.random() > 0.5 ? 'ko2uz' : 'uz2ko';
    const qEl = $id('quizQ'); if (qEl) qEl.textContent = type === 'ko2uz' ? `"${curQuizWord.e}" = ?` : `"${curQuizWord.u}" = ?`;
    const optsEl = $id('quizOptions');
    if (optsEl) optsEl.innerHTML = opts.map(o => `<button class="quiz-opt" onclick="window.checkQuizOpt(this,'${o.e.replace(/'/g, "\\'")}','${type}')" style="width:100%;margin-bottom:8px;padding:12px;border-radius:10px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);color:#e8ecff;cursor:pointer;text-align:left;font-family:inherit;font-size:0.9rem;transition:all 0.2s">${type === 'ko2uz' ? o.u : o.e}</button>`).join('');
    const fb = $id('quizFeedback'); if (fb) fb.innerHTML = '';
}
window.checkQuizOpt = function (btn, chosen, type) {
    if (quizAnswered) return; quizAnswered = true;
    document.querySelectorAll('.quiz-opt').forEach(b => {
        const bVal = b.textContent.trim();
        if (type === 'ko2uz' ? bVal === curQuizWord.u : bVal === curQuizWord.e) { b.style.background = 'rgba(52,211,153,0.2)'; b.style.borderColor = '#34d399'; }
        else if (b === btn) { b.style.background = 'rgba(239,68,68,0.2)'; b.style.borderColor = '#ef4444'; }
    });
    const fb = $id('quizFeedback');
    if (chosen === curQuizWord.e) { quizScore++; const el = $id('quizScore'); if (el) el.textContent = quizScore; awardXP(10, 'grammar'); if (fb) fb.innerHTML = "<span style='color:#34d399'>✅ To'g'ri!</span>"; }
    else { if (fb) fb.innerHTML = `<span style='color:#ef4444'>❌ To'g'ri: ${type === 'ko2uz' ? curQuizWord.u : curQuizWord.e}</span>`; }
    window.speakWord(curQuizWord.e);
};
window.nextQuiz = function () { showQuizWord(); };

// ── Match ──
function initMatch() {
    const pool = shuffle([...WDB]).slice(0, 5);
    matchPairs = pool; matchMatched = []; matchSel1 = null;
    const items = shuffle([...pool.map(w => ({ id: w.e, text: w.e, type: 'ko' })), ...pool.map(w => ({ id: w.e, text: w.u, type: 'uz' }))]);
    const grid = $id('matchGrid');
    if (grid) grid.innerHTML = items.map(item => `<div class="match-item" data-id="${item.id}" data-type="${item.type}" onclick="window.selectMatch2(this)" style="padding:12px;border-radius:10px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);color:#e8ecff;cursor:pointer;font-family:inherit;transition:all 0.2s;font-size:0.88rem">${item.text}</div>`).join('');
    const fb = $id('matchFeedback'); if (fb) fb.innerHTML = '';
}
window.startMatch = initMatch;
window.selectMatch2 = function (el) {
    if (el.classList.contains('matched')) return;
    if (!matchSel1) {
        matchSel1 = el; el.style.background = 'rgba(231,76,60,0.2)'; el.style.borderColor = '#e74c3c';
    } else {
        if (matchSel1 === el) { el.style.background = 'rgba(255,255,255,0.04)'; el.style.borderColor = 'rgba(255,255,255,0.1)'; matchSel1 = null; return; }
        if (matchSel1.dataset.type === el.dataset.type) { matchSel1.style.background = 'rgba(255,255,255,0.04)'; matchSel1.style.borderColor = 'rgba(255,255,255,0.1)'; matchSel1 = el; el.style.background = 'rgba(231,76,60,0.2)'; el.style.borderColor = '#e74c3c'; return; }
        if (matchSel1.dataset.id === el.dataset.id) {
            matchSel1.style.background = 'rgba(52,211,153,0.15)'; matchSel1.style.borderColor = '#34d399'; matchSel1.classList.add('matched');
            el.style.background = 'rgba(52,211,153,0.15)'; el.style.borderColor = '#34d399'; el.classList.add('matched');
            matchMatched.push(el.dataset.id); matchSel1 = null; awardXP(15, 'grammar');
            if (matchMatched.length === matchPairs.length) { const fb = $id('matchFeedback'); if (fb) fb.innerHTML = "<span style='color:#34d399'>🎉 Barcha juftliklar!</span>"; }
        } else {
            const s = matchSel1; matchSel1 = null;
            s.style.background = 'rgba(239,68,68,0.15)'; s.style.borderColor = '#ef4444';
            el.style.background = 'rgba(239,68,68,0.15)'; el.style.borderColor = '#ef4444';
            setTimeout(() => { s.style.background = 'rgba(255,255,255,0.04)'; s.style.borderColor = 'rgba(255,255,255,0.1)'; el.style.background = 'rgba(255,255,255,0.04)'; el.style.borderColor = 'rgba(255,255,255,0.1)'; }, 800);
        }
    }
};

// ── Typing ──
function initTyping() { typingDeck = shuffle([...WDB]); typingIdx = 0; showTypingWord(); }
function showTypingWord() {
    const w = typingDeck[typingIdx % typingDeck.length];
    const tw = $id('typingWord'); if (tw) tw.textContent = w.u;
    const th = $id('typingHint'); if (th) th.textContent = 'Romanizatsiya: ' + w.r;
    const ti = $id('typingInput'); if (ti) { ti.value = ''; ti.style.borderColor = ''; }
    const tf = $id('typingFeedback'); if (tf) tf.innerHTML = '';
}
window.checkTyping = function () {
    const w = typingDeck[typingIdx % typingDeck.length];
    const val = $id('typingInput')?.value.trim() || '';
    const fb = $id('typingFeedback'); const inp = $id('typingInput');
    if (val === w.e) {
        if (fb) fb.innerHTML = "<span style='color:#34d399'>✅ To'g'ri!</span>";
        if (inp) inp.style.borderColor = '#34d399';
        awardXP(8, 'grammar'); setTimeout(() => { typingIdx++; showTypingWord(); }, 800);
    } else if (val.length >= w.e.length) {
        if (fb) fb.innerHTML = `<span style='color:#ef4444'>❌ To'g'ri: ${w.e}</span>`;
        if (inp) inp.style.borderColor = '#ef4444';
    }
};
window.nextTyping = function () { typingIdx++; showTypingWord(); };

// ── Grammar Practice ──
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
        if (fb) fb.innerHTML = `<div style="color:#34d399;padding:10px;border-radius:10px;background:rgba(52,211,153,0.1)">✅ To'g'ri! ${exp}</div>`;
        grammarScore2++; const el = $id('grammarScore'); if (el) el.textContent = grammarScore2; awardXP(12, 'grammar');
    } else {
        if (fb) fb.innerHTML = `<div style="color:#ef4444;padding:10px;border-radius:10px;background:rgba(239,68,68,0.1)">❌ Noto'g'ri. To'g'ri: <b>${ans}</b>. ${exp}</div>`;
    }
};
window.nextGrammarEx = function () { curGrammarIdx++; showGrammarQ(); };

// ══════════════════════════════════════════════════════════════
// AI CHAT
// ══════════════════════════════════════════════════════════════
const CHAT_MODES = {
    free: { label: 'Erkin suhbat', sys: 'You are a friendly Korean language learning assistant for Uzbek speakers. Chat in Korean and Uzbek. Keep responses concise (2-4 sentences). Help practice Korean expressions.' },
    teacher: { label: "O'qituvchi", sys: "You are a Korean teacher for Uzbek-speaking students. Explain Korean grammar rules clearly in Uzbek with examples. Use Hangul with romanization always." },
    grammar: { label: 'Grammatika', sys: "You are a Korean grammar checker. When the user sends Korean text, identify errors, explain in Uzbek: '❌ Xato → ✅ To'g'ri: ... 📚 Qoida: ...'" },
    translate: { label: 'Tarjimon', sys: 'You are a Korean-Uzbek translator. Translate accurately. Show Hangul, romanization, and Uzbek meaning.' },
    topik: { label: 'TOPIK', sys: 'You are a TOPIK exam coach for Uzbek students. Help with TOPIK reading, writing, listening practice. Give feedback and explain scoring criteria.' }
};

let curChatMode = CHAT_MODES.free;

window.setChatMode = function (mode, el) {
    document.querySelectorAll('.chat-mode-btn').forEach(b => b.classList.remove('active'));
    if (el) el.classList.add('active');
    chatMode = mode; curChatMode = CHAT_MODES[mode] || CHAT_MODES.free;
    appendChat('assistant', `Rejim: <b>${curChatMode.label}</b>. ${mode === 'free' ? '한국어로 이야기해요!' : mode === 'teacher' ? '무엇을 배우고 싶어요?' : mode === 'grammar' ? 'Matn yuboring — tekshiraman!' : mode === 'translate' ? 'Nima tarjima qilaylik?' : 'TOPIK savolingizni yuboring!'}`, false);
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
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ role: 'user', parts: [{ text: curChatMode.sys + LANG_RULES }] }, ...chatHist.slice(-10)],
                generationConfig: { temperature: 0.8, maxOutputTokens: UP === 'ultimate' ? 2000 : 1000 }
            })
        });
        const tb = $id(typingId); if (tb) tb.remove();
        if (!resp.ok) { appendChat('assistant', `❗ AI xatolik: ${resp.status}`, false); return; }
        const d = await resp.json();
        const reply = d.candidates?.[0]?.content?.parts?.[0]?.text || 'Uzr, javob berishda xatolik.';
        appendChat('assistant', reply, true);
        chatHist.push({ role: 'model', parts: [{ text: reply }] });
        if (UTokens > 0 && UP !== 'ultimate') { UTokens--; await saveTokenState(); renderTokenBar(); }
        awardXP(5, 'speaking');
    } catch (e) {
        const tb = $id(typingId); if (tb) tb.remove();
        appendChat('assistant', `❗ Xatolik: ${e.message || 'tarmoq muammosi'}`, false);
    } finally { if (sendBtn) sendBtn.disabled = false; }
};

function appendChat(role, html, save = false, id = null) {
    const c = $id('chatMessages'); if (!c) return;
    const isAI = role === 'assistant';
    const div = document.createElement('div');
    div.className = `chat-msg ${isAI ? 'ai-msg' : 'user-msg'}`;
    if (id) div.id = id;
    div.innerHTML = `<div class="chat-avatar">${isAI ? '<i class="fa-solid fa-robot"></i>' : '<i class="fa-solid fa-user"></i>'}</div><div class="chat-bubble">${html}</div>`;
    c.appendChild(div); c.scrollTop = c.scrollHeight;
}

window.clearChatHistory = async function () {
    if (!confirm('Chat tarixini tozalashni istaysizmi?')) return;
    chatHist = [];
    const c = $id('chatMessages');
    if (c) c.innerHTML = `<div class="chat-msg ai-msg"><div class="chat-avatar"><i class="fa-solid fa-robot"></i></div><div class="chat-bubble">안녕하세요! Chat tarixi tozalandi. 한국어를 같이 배워요! 😊</div></div>`;
    showToast('Chat tarixi tozalandi', 'success');
};

// ══════════════════════════════════════════════════════════════
// VIDEO
// ══════════════════════════════════════════════════════════════
window.findYoutubeVideos = function () {
    const grid = $id('videosGrid'); if (!grid) return;
    const videos = [
        { title: 'Korean for Beginners — FULL Course', channel: 'Learn Korean with Go! Billy Korean', id: 'yeRVoNE_dUw' },
        { title: 'Learn Korean in 30 Minutes', channel: 'KoreanClass101', id: 'nWKUBNVxApo' },
        { title: 'TOPIK Writing — Band 6 Tips', channel: 'Korean Unnie', id: 'gB12FGV3xk4' },
        { title: '500 Korean Words for Beginners', channel: 'TalkToMeInKorean', id: 'MZ7PGN1C7KE' },
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
// MODALS
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