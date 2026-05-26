// =====================================================// English.js — LinguaVerse (FIXED VERSION - 100% corrected)
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
    apiKey: "AIzaSyArSlWIz3Z9NsUZowCiFj-snKccQfDnm5w",  // ← NOTO'G'RI!
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
const AI_PROXY = "https://gentle-hat-d9fa.akromovbehruz7.workers.dev";

// ══════════════════════════════════════════════════════════════
// CONFIG
// ══════════════════════════════════════════════════════════════
const TOKEN_CONFIG = {
    default_tokens: 1000,
    reset_hours: 5,
    ai_cost: 1,
    unit_cost: 2,
    purchase_packages: [
        { tokens: 500, price_uzs: 10000, label: "500 token", bonus: 0 },
        { tokens: 1200, price_uzs: 20000, label: "1200 token", bonus: 200 },
        { tokens: 3000, price_uzs: 45000, label: "3000 token", bonus: 500 },
        { tokens: 7000, price_uzs: 90000, label: "7000 token", bonus: 1000 },
    ]
};

// FIX #1: coin_mult added to all PLANS entries
const PLANS = {
    free: { name: "Free", icon: "🆓", price_uzs: 0, token_bonus: 1000, token_reset_mult: 1, ai_quality: "standard", xp_mult: 1, coin_mult: 1, features: ["1000 token/5soat", "Standart AI", "Asosiy mashqlar"] },
    pro: { name: "Pro", icon: "⭐", price_uzs: 29000, token_bonus: 3000, token_reset_mult: 2, ai_quality: "enhanced", xp_mult: 1.5, coin_mult: 1.3, features: ["3000 token/5soat", "Yaxshilangan AI", "Video tavsiyalar", "+50% XP"] },
    premium: { name: "Premium", icon: "💎", price_uzs: 59000, token_bonus: 8000, token_reset_mult: 3, ai_quality: "advanced", xp_mult: 2, coin_mult: 1.8, features: ["8000 token/5soat", "Ilg'or AI", "Ovozli suhbat", "+100% XP", "Leaderboard badge"] },
    ultimate: { name: "Ultimate", icon: "🚀", price_uzs: 99000, token_bonus: 999999, token_reset_mult: 999, ai_quality: "ultimate", xp_mult: 3, coin_mult: 2.5, features: ["Cheksiz tokenlar", "Eng yaxshi AI", "Barcha imkoniyatlar", "+200% XP", "ULTIMATE badge"] }
};

const RANKS = {
    none: { name: "Oddiy", icon: "⬜", color: "#888", token_bonus: 0, xp_mult: 1, coin_mult: 1, price_coins: 0, xp_required: 0, badge_color: "#555", perks: [] },
    silver: { name: "Silver", icon: "🥈", color: "#C0C0C0", token_bonus: 200, xp_mult: 1.3, coin_mult: 1.2, price_coins: 500, xp_required: 0, badge_color: "#A8A8A8", perks: ["+200 token har resetda", "+30% XP", "+20% Coin"] },
    gold: { name: "Gold", icon: "🥇", color: "#FFD700", token_bonus: 500, xp_mult: 1.8, coin_mult: 1.5, price_coins: 1500, xp_required: 500, badge_color: "#E6B800", perks: ["+500 token har resetda", "+80% XP", "+50% Coin"] },
    diamond: { name: "Diamond", icon: "💎", color: "#B9F2FF", token_bonus: 1000, xp_mult: 2.5, coin_mult: 2, price_coins: 4000, xp_required: 2000, badge_color: "#00D4FF", perks: ["+1000 token har resetda", "+150% XP", "+100% Coin", "Leaderboard badge"] }
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
let UActiveTags = [], UOwnedRanks = [], UOwnedTags = [];
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
// WORDS DATABASE
// ══════════════════════════════════════════════════════════════
const WDB = [
    // BEGINNER
    { e: 'hello', u: 'Salom', t: 'interjection', l: 'beginner', ex: 'Hello, how are you?', eu: "Salom, qandaysiz?" },
    { e: 'goodbye', u: 'Xayr', t: 'interjection', l: 'beginner', ex: 'Goodbye, see you tomorrow!', eu: "Xayr, ertaga ko'rishamiz!" },
    { e: 'thank you', u: 'Rahmat', t: 'phrase', l: 'beginner', ex: 'Thank you for your help.', eu: "Yordamingiz uchun rahmat." },
    { e: 'please', u: 'Iltimos', t: 'adverb', l: 'beginner', ex: 'Can you help me, please?', eu: "Iltimos, yordam bera olasizmi?" },
    { e: 'sorry', u: 'Kechirasiz', t: 'interjection', l: 'beginner', ex: "I'm sorry for being late.", eu: "Kech qolganimdan kechirim so'rayman." },
    { e: 'yes', u: 'Ha', t: 'interjection', l: 'beginner', ex: 'Yes, I agree with you.', eu: "Ha, men siz bilan roziman." },
    { e: 'no', u: "Yo'q", t: 'interjection', l: 'beginner', ex: "No, I don't think so.", eu: "Yo'q, menimcha bunday emas." },
    { e: 'good', u: 'Yaxshi', t: 'adjective', l: 'beginner', ex: 'Good morning, everyone!', eu: "Hammaga xayrli tong!" },
    { e: 'bad', u: 'Yomon', t: 'adjective', l: 'beginner', ex: 'The weather is bad today.', eu: "Bugun havo yomon." },
    { e: 'big', u: 'Katta', t: 'adjective', l: 'beginner', ex: 'This is a big house.', eu: "Bu katta uy." },
    { e: 'small', u: 'Kichik', t: 'adjective', l: 'beginner', ex: 'I have a small dog.', eu: "Menda kichik it bor." },
    { e: 'happy', u: 'Xursand', t: 'adjective', l: 'beginner', ex: "I'm very happy today!", eu: "Bugun juda xursandman!" },
    { e: 'sad', u: "Qayg'li", t: 'adjective', l: 'beginner', ex: 'She looks sad today.', eu: "U bugun qayg'li ko'rinadi." },
    { e: 'hot', u: 'Issiq', t: 'adjective', l: 'beginner', ex: 'It is very hot outside.', eu: "Tashqarida juda issiq." },
    { e: 'cold', u: 'Sovuq', t: 'adjective', l: 'beginner', ex: 'The water is cold.', eu: "Suv sovuq." },
    { e: 'red', u: 'Qizil', t: 'adjective', l: 'beginner', ex: 'I like red apples.', eu: "Men qizil olmalarni yaxshi ko'raman." },
    { e: 'blue', u: "Ko'k", t: 'adjective', l: 'beginner', ex: 'The sky is blue.', eu: "Osmon ko'k." },
    { e: 'green', u: 'Yashil', t: 'adjective', l: 'beginner', ex: 'The grass is green.', eu: "O't yashil." },
    { e: 'yellow', u: 'Sariq', t: 'adjective', l: 'beginner', ex: 'The sun is yellow.', eu: "Quyosh sariq." },
    { e: 'black', u: 'Qora', t: 'adjective', l: 'beginner', ex: 'My cat is black.', eu: "Mening mushugim qora." },
    { e: 'white', u: 'Oq', t: 'adjective', l: 'beginner', ex: 'Snow is white.', eu: "Qor oq." },
    { e: 'one', u: 'Bir', t: 'number', l: 'beginner', ex: 'I have one sister.', eu: "Menda bir singil bor." },
    { e: 'two', u: 'Ikki', t: 'number', l: 'beginner', ex: 'I have two cats.', eu: "Menda ikki mushuk bor." },
    { e: 'three', u: 'Uch', t: 'number', l: 'beginner', ex: 'She has three books.', eu: "Uning uch kitobi bor." },
    { e: 'four', u: 'To\'rt', t: 'number', l: 'beginner', ex: 'There are four seasons.', eu: "To'rtta fasl bor." },
    { e: 'five', u: 'Besh', t: 'number', l: 'beginner', ex: 'I have five fingers.', eu: "Menda besh barmoq bor." },
    { e: 'mother', u: 'Ona', t: 'noun', l: 'beginner', ex: 'My mother is a teacher.', eu: "Onam o'qituvchi." },
    { e: 'father', u: 'Ota', t: 'noun', l: 'beginner', ex: 'My father works hard.', eu: "Otam qattiq ishlaydi." },
    { e: 'sister', u: 'Singil/Opa', t: 'noun', l: 'beginner', ex: 'My sister is 10 years old.', eu: "Singlim 10 yoshda." },
    { e: 'brother', u: 'Aka/Uka', t: 'noun', l: 'beginner', ex: 'My brother likes football.', eu: "Akam futbolni yaxshi ko'radi." },
    { e: 'water', u: 'Suv', t: 'noun', l: 'beginner', ex: 'Please give me some water.', eu: "Iltimos, menga suv bering." },
    { e: 'food', u: 'Ovqat', t: 'noun', l: 'beginner', ex: 'The food is delicious.', eu: "Ovqat mazali." },
    { e: 'apple', u: 'Olma', t: 'noun', l: 'beginner', ex: 'I eat an apple every day.', eu: "Men har kuni olma yeyman." },
    { e: 'bread', u: 'Non', t: 'noun', l: 'beginner', ex: 'She bakes fresh bread.', eu: "U yangi non yopadi." },
    { e: 'school', u: 'Maktab', t: 'noun', l: 'beginner', ex: 'I go to school every day.', eu: "Men har kuni maktabga boraman." },
    { e: 'book', u: 'Kitob', t: 'noun', l: 'beginner', ex: 'This is an interesting book.', eu: "Bu qiziqarli kitob." },
    { e: 'dog', u: 'It', t: 'noun', l: 'beginner', ex: 'I have a friendly dog.', eu: "Menda mehribon it bor." },
    { e: 'cat', u: 'Mushuk', t: 'noun', l: 'beginner', ex: 'The cat is sleeping.', eu: "Mushuk uxlayapti." },
    { e: 'house', u: 'Uy', t: 'noun', l: 'beginner', ex: 'I live in a big house.', eu: "Men katta uyda yashayman." },
    { e: 'car', u: 'Avtomobil', t: 'noun', l: 'beginner', ex: 'My father has a red car.', eu: "Otamning qizil mashinasi bor." },
    { e: 'run', u: 'Yugurmaq', t: 'verb', l: 'beginner', ex: 'She runs every morning.', eu: "U har ertalab yuguradi." },
    { e: 'eat', u: 'Yemoq', t: 'verb', l: 'beginner', ex: 'We eat dinner at 7.', eu: "Biz soat 7 da kechki ovqat yeymiz." },
    { e: 'drink', u: 'Ichmoq', t: 'verb', l: 'beginner', ex: 'He drinks coffee.', eu: "U qahva ichadi." },
    { e: 'sleep', u: 'Uxlamoq', t: 'verb', l: 'beginner', ex: 'Children sleep early.', eu: "Bolalar erta uxlashadi." },
    { e: 'read', u: "O'qimoq", t: 'verb', l: 'beginner', ex: 'I love to read books.', eu: "Kitob o'qishni yaxshi ko'raman." },
    { e: 'write', u: 'Yozmoq', t: 'verb', l: 'beginner', ex: 'Please write your name.', eu: "Iltimos, ismingizni yozing." },
    { e: 'walk', u: 'Yurmoq', t: 'verb', l: 'beginner', ex: 'I walk to school.', eu: "Men maktabga yayov boraman." },
    { e: 'speak', u: 'Gapirmoq', t: 'verb', l: 'beginner', ex: 'She speaks English well.', eu: "U inglizchani yaxshi gapiradi." },
    { e: 'listen', u: 'Eshitmoq', t: 'verb', l: 'beginner', ex: 'Please listen carefully.', eu: "Iltimos, diqqat bilan eshiting." },
    { e: 'play', u: "O'ynamoq", t: 'verb', l: 'beginner', ex: 'Children love to play.', eu: "Bolalar o'ynashni yaxshi ko'rishadi." },
    { e: 'Monday', u: 'Dushanba', t: 'noun', l: 'beginner', ex: 'Monday is the first day of the week.', eu: "Dushanba haftaning birinchi kuni." },
    { e: 'Tuesday', u: 'Seshanba', t: 'noun', l: 'beginner', ex: 'I have class on Tuesday.', eu: "Seshanba kuni darsim bor." },
    { e: 'Wednesday', u: 'Chorshanba', t: 'noun', l: 'beginner', ex: 'We meet every Wednesday.', eu: "Biz har chorshanba uchrashAmiz." },
    { e: 'Thursday', u: 'Payshanba', t: 'noun', l: 'beginner', ex: 'Thursday is my favourite day.', eu: "Payshanba mening sevimli kunim." },
    { e: 'Friday', u: 'Juma', t: 'noun', l: 'beginner', ex: 'We finish early on Friday.', eu: "Juma kuni biz erta tugatamiz." },
    { e: 'Saturday', u: 'Shanba', t: 'noun', l: 'beginner', ex: 'I rest on Saturday.', eu: "Shanba kuni dam olaman." },
    { e: 'Sunday', u: 'Yakshanba', t: 'noun', l: 'beginner', ex: 'Sunday is a day off.', eu: "Yakshanba dam olish kuni." },
    { e: 'morning', u: 'Ertalab', t: 'noun', l: 'beginner', ex: 'I wake up every morning.', eu: "Men har ertalab uyg'onaman." },
    { e: 'evening', u: 'Kechqurun', t: 'noun', l: 'beginner', ex: 'We walk in the evening.', eu: "Kechqurun yurish qilamiz." },
    { e: 'night', u: 'Kecha', t: 'noun', l: 'beginner', ex: 'Good night, sleep well.', eu: "Yaxshi kechalar, yaxshi uxlang." },
    { e: 'day', u: 'Kun', t: 'noun', l: 'beginner', ex: 'Have a great day!', eu: "Yaxshi kun!" },
    { e: 'year', u: 'Yil', t: 'noun', l: 'beginner', ex: 'This year is special.', eu: "Bu yil alohida." },
    { e: 'time', u: 'Vaqt', t: 'noun', l: 'beginner', ex: 'What time is it?', eu: "Soat necha bo'ldi?" },
    { e: 'name', u: 'Ism', t: 'noun', l: 'beginner', ex: 'My name is Ahmad.', eu: "Mening ismim Ahmad." },
    { e: 'city', u: 'Shahar', t: 'noun', l: 'beginner', ex: 'Tashkent is a big city.', eu: "Toshkent katta shahar." },
    { e: 'country', u: 'Mamlakat', t: 'noun', l: 'beginner', ex: 'Uzbekistan is my country.', eu: "O'zbekiston mening mamlakatim." },
    { e: 'sun', u: 'Quyosh', t: 'noun', l: 'beginner', ex: 'The sun is shining.', eu: "Quyosh chiqyapti." },
    { e: 'moon', u: 'Oy', t: 'noun', l: 'beginner', ex: 'The moon is bright tonight.', eu: "Bu kecha oy yorqin." },
    { e: 'flower', u: 'Gul', t: 'noun', l: 'beginner', ex: 'She has beautiful flowers.', eu: "Uning chiroyli gullari bor." },
    { e: 'tree', u: 'Daraxt', t: 'noun', l: 'beginner', ex: 'The tree is very tall.', eu: "Daraxt juda baland." },
    { e: 'bird', u: 'Qush', t: 'noun', l: 'beginner', ex: 'The bird is singing.', eu: "Qush sayrAyapti." },
    { e: 'fish', u: 'Baliq', t: 'noun', l: 'beginner', ex: 'I like eating fish.', eu: "Men baliq yeyishni yaxshi ko'raman." },
    { e: 'new', u: 'Yangi', t: 'adjective', l: 'beginner', ex: 'I have a new phone.', eu: "Mening yangi telefonim bor." },
    { e: 'old', u: 'Eski/Qari', t: 'adjective', l: 'beginner', ex: 'This is an old building.', eu: "Bu eski bino." },
    { e: 'tall', u: 'Baland/Uzun', t: 'adjective', l: 'beginner', ex: 'He is very tall.', eu: "U juda baland bo'yli." },
    { e: 'short', u: 'Past/Qisqa', t: 'adjective', l: 'beginner', ex: 'The short girl is clever.', eu: "Past bo'yli qiz aqlli." },
    { e: 'fast', u: 'Tez', t: 'adjective', l: 'beginner', ex: 'The car is very fast.', eu: "Mashina juda tez." },
    { e: 'slow', u: 'Sekin', t: 'adjective', l: 'beginner', ex: 'The turtle moves slowly.', eu: "Toshbaqa sekin yuradi." },
    { e: 'open', u: 'Ochiq', t: 'adjective', l: 'beginner', ex: 'The door is open.', eu: "Eshik ochiq." },
    { e: 'closed', u: 'Yopiq', t: 'adjective', l: 'beginner', ex: 'The shop is closed.', eu: "Do'kon yopiq." },
    { e: 'love', u: 'Sevmoq/Muhabbat', t: 'verb/noun', l: 'beginner', ex: 'I love my family.', eu: "Men oilamni sevaman." },
    { e: 'like', u: 'Yoqtirishmoq', t: 'verb', l: 'beginner', ex: 'I like chocolate.', eu: "Men shokoladni yoqtiraman." },
    { e: 'want', u: 'Xohlamoq', t: 'verb', l: 'beginner', ex: 'I want to go home.', eu: "Men uyga ketmoqchiman." },
    { e: 'need', u: 'Kerakmoq', t: 'verb', l: 'beginner', ex: 'I need your help.', eu: "Sizning yordamingiz kerak." },
    { e: 'know', u: 'Bilmoq', t: 'verb', l: 'beginner', ex: 'Do you know her?', eu: "Uni bilasizmi?" },
    { e: 'see', u: "Ko'rmoq", t: 'verb', l: 'beginner', ex: 'I can see a mountain.', eu: "Men tog'ni ko'ra olaman." },
    { e: 'come', u: 'Kelmoq', t: 'verb', l: 'beginner', ex: 'Please come here.', eu: "Iltimos, bu yerga keling." },
    { e: 'go', u: 'Bormoq', t: 'verb', l: 'beginner', ex: "Let's go to the park.", eu: "Keling, parkka boramiz." },
    { e: 'give', u: 'Bermoq', t: 'verb', l: 'beginner', ex: 'Give me that book.', eu: "Menga o'sha kitobni bering." },
    { e: 'take', u: 'Olmoq', t: 'verb', l: 'beginner', ex: 'Take this umbrella.', eu: "Bu soyabonni oling." },
    { e: 'help', u: 'Yordam bermoq', t: 'verb', l: 'beginner', ex: 'Can you help me?', eu: "Menga yordam bera olasizmi?" },
    { e: 'work', u: 'Ishlash', t: 'verb/noun', l: 'beginner', ex: 'I work every day.', eu: "Men har kuni ishlayman." },
    { e: 'study', u: "O'qimoq/O'rganmoq", t: 'verb', l: 'beginner', ex: 'I study English every day.', eu: "Men har kuni ingliz tilini o'rganaman." },
    { e: 'think', u: 'O\'ylamoq', t: 'verb', l: 'beginner', ex: 'I think you are right.', eu: "Menimcha siz to'g'risiz." },
    { e: 'say', u: 'Aytmoq', t: 'verb', l: 'beginner', ex: 'What did you say?', eu: "Nima dedingiz?" },
    { e: 'make', u: 'Qilmoq/Yasamoq', t: 'verb', l: 'beginner', ex: 'Let me make tea.', eu: "Keling, choy qilay." },
    { e: 'put', u: 'Qo\'ymoq', t: 'verb', l: 'beginner', ex: 'Put it on the table.', eu: "Uni stolga qo'ying." },
    { e: 'find', u: 'Topmoq', t: 'verb', l: 'beginner', ex: 'I cannot find my keys.', eu: "Kalitlarimni topolmayapman." },
    { e: 'buy', u: 'Sotib olmoq', t: 'verb', l: 'beginner', ex: 'I want to buy a book.', eu: "Kitob sotib olmoqchiman." },
    { e: 'milk', u: 'Sut', t: 'noun', l: 'beginner', ex: 'Children drink milk.', eu: "Bolalar sut ichadi." },
    { e: 'egg', u: 'Tuxum', t: 'noun', l: 'beginner', ex: 'I eat two eggs for breakfast.', eu: "Nonushta uchun ikki tuxum yeyman." },
    { e: 'rice', u: 'Guruch/Palov', t: 'noun', l: 'beginner', ex: 'Rice is our main food.', eu: "Guruch asosiy ovqatimiz." },
    { e: 'meat', u: 'Go\'sht', t: 'noun', l: 'beginner', ex: 'This meat is delicious.', eu: "Bu go'sht juda mazali." },
    { e: 'tea', u: 'Choy', t: 'noun', l: 'beginner', ex: "Let's have some tea.", eu: "Keling, choy ichamiz." },
    { e: 'coffee', u: 'Qahva', t: 'noun', l: 'beginner', ex: 'I drink coffee every morning.', eu: "Men har ertalab qahva ichaman." },
    { e: 'orange', u: 'Apelsin', t: 'noun', l: 'beginner', ex: 'Oranges are sweet.', eu: "Apelsinlar shirin." },
    { e: 'banana', u: 'Banan', t: 'noun', l: 'beginner', ex: 'I eat a banana every day.', eu: "Men har kuni banan yeyman." },
    { e: 'table', u: 'Stol', t: 'noun', l: 'beginner', ex: 'The book is on the table.', eu: "Kitob stolda." },
    { e: 'chair', u: 'Stul', t: 'noun', l: 'beginner', ex: 'Sit on the chair.', eu: "Stulga o'tiring." },
    { e: 'pen', u: 'Ruchka', t: 'noun', l: 'beginner', ex: 'Can I borrow your pen?', eu: "Ruchkangizni olsam bo'ladimi?" },
    { e: 'pencil', u: 'Qalam', t: 'noun', l: 'beginner', ex: 'Write with a pencil.', eu: "Qalam bilan yozing." },
    { e: 'bag', u: 'Sumka', t: 'noun', l: 'beginner', ex: 'My bag is heavy.', eu: "Sumkam og'ir." },
    { e: 'phone', u: 'Telefon', t: 'noun', l: 'beginner', ex: 'My phone is new.', eu: "Telefonim yangi." },
    { e: 'window', u: 'Deraza', t: 'noun', l: 'beginner', ex: 'Open the window please.', eu: "Iltimos, derazani oching." },
    { e: 'door', u: 'Eshik', t: 'noun', l: 'beginner', ex: 'Close the door.', eu: "Eshikni yoping." },
    { e: 'road', u: 'Yo\'l', t: 'noun', l: 'beginner', ex: 'The road is long.', eu: "Yo'l uzun." },
    { e: 'park', u: 'Park', t: 'noun', l: 'beginner', ex: 'Children play in the park.', eu: "Bolalar parkda o'ynaydi." },
    { e: 'shop', u: "Do'kon", t: 'noun', l: 'beginner', ex: "Let's go to the shop.", eu: "Keling, do'konga boramiz." },
    { e: 'money', u: 'Pul', t: 'noun', l: 'beginner', ex: 'Do you have money?', eu: "Pulingiz bormi?" },
    { e: 'friend', u: "Do'st", t: 'noun', l: 'beginner', ex: 'He is my best friend.', eu: "U mening eng yaxshi do'stim." },
    { e: 'teacher', u: "O'qituvchi", t: 'noun', l: 'beginner', ex: 'My teacher is kind.', eu: "Mening o'qituvchim mehribon." },
    { e: 'student', u: "O'quvchi", t: 'noun', l: 'beginner', ex: 'She is a good student.', eu: "U yaxshi o'quvchi." },
    // ELEMENTARY
    { e: 'bedroom', u: 'Yotoqxona', t: 'noun', l: 'elementary', ex: 'My bedroom is cozy.', eu: "Yotoqxonam qulay." },
    { e: 'kitchen', u: 'Oshxona', t: 'noun', l: 'elementary', ex: 'She cooks in the kitchen.', eu: "U oshxonada ovqat pishiradi." },
    { e: 'bathroom', u: 'Hammom', t: 'noun', l: 'elementary', ex: 'The bathroom is clean.', eu: "Hammom toza." },
    { e: 'garden', u: 'Bog\'', t: 'noun', l: 'elementary', ex: 'We grow vegetables in the garden.', eu: "Biz bog'da sabzavot etishtIramiz." },
    { e: 'doctor', u: 'Shifokor', t: 'noun', l: 'elementary', ex: 'The doctor examined the patient.', eu: "Shifokor bemorni tekshirdi." },
    { e: 'engineer', u: 'Muhandis', t: 'noun', l: 'elementary', ex: 'He is a software engineer.', eu: "U dasturiy ta'minot muhandisi." },
    { e: 'expensive', u: 'Qimmat', t: 'adjective', l: 'elementary', ex: 'This phone is very expensive.', eu: "Bu telefon juda qimmat." },
    { e: 'cheap', u: 'Arzon', t: 'adjective', l: 'elementary', ex: 'These shoes are cheap.', eu: "Bu poyabzallar arzon." },
    { e: 'beautiful', u: "Go'zal", t: 'adjective', l: 'elementary', ex: 'What a beautiful day!', eu: "Qanday go'zal kun!" },
    { e: 'interesting', u: 'Qiziqarli', t: 'adjective', l: 'elementary', ex: 'This is an interesting story.', eu: "Bu qiziqarli hikoya." },
    { e: 'difficult', u: 'Qiyin', t: 'adjective', l: 'elementary', ex: 'This exam is very difficult.', eu: "Bu imtihon juda qiyin." },
    { e: 'easy', u: 'Oson', t: 'adjective', l: 'elementary', ex: 'This exercise is easy.', eu: "Bu mashq oson." },
    { e: 'travel', u: 'Sayohat qilmoq', t: 'verb', l: 'elementary', ex: 'I love to travel abroad.', eu: "Xorijga sayohat qilishni yaxshi ko'raman." },
    { e: 'music', u: 'Musiqa', t: 'noun', l: 'elementary', ex: 'I listen to music every day.', eu: "Men har kuni musiqa eshitaman." },
    { e: 'weather', u: 'Ob-havo', t: 'noun', l: 'elementary', ex: 'The weather is nice today.', eu: "Bugun ob-havo yaxshi." },
    { e: 'computer', u: 'Kompyuter', t: 'noun', l: 'elementary', ex: 'I use my computer for work.', eu: "Men kompyuterni ish uchun ishlataman." },
    { e: 'hospital', u: 'Kasalxona', t: 'noun', l: 'elementary', ex: 'He was taken to hospital.', eu: "Uni kasalxonaga olib ketishdi." },
    { e: 'restaurant', u: 'Restoran', t: 'noun', l: 'elementary', ex: 'We eat at a restaurant.', eu: "Biz restoranda ovqatlanamiz." },
    { e: 'airport', u: 'Aeroport', t: 'noun', l: 'elementary', ex: 'The airport is very busy.', eu: "Aeroport juda gavjum." },
    { e: 'meeting', u: 'Uchrashuv', t: 'noun', l: 'elementary', ex: 'I have a meeting at 10.', eu: "Soat 10 da mening uchrashuv bor." },
    { e: 'shopping', u: 'Xarid', t: 'noun', l: 'elementary', ex: 'She likes shopping.', eu: "U xarid qilishni yaxshi ko'radi." },
    { e: 'ticket', u: 'Chipta', t: 'noun', l: 'elementary', ex: 'I bought a train ticket.', eu: "Men poyezd chiptasi sotib oldim." },
    { e: 'hotel', u: 'Mehmonxona', t: 'noun', l: 'elementary', ex: 'We stayed in a nice hotel.', eu: "Biz chiroyli mehmonxonada qoldik." },
    { e: 'menu', u: 'Menyu', t: 'noun', l: 'elementary', ex: 'Can I see the menu?', eu: "Menyuni ko'rsam bo'ladimi?" },
    { e: 'receipt', u: 'Kvitansiya', t: 'noun', l: 'elementary', ex: 'Keep your receipt.', eu: "Kvitansiyangizni saqlang." },
    { e: 'discount', u: 'Chegirma', t: 'noun', l: 'elementary', ex: 'There is a 20% discount today.', eu: "Bugun 20% chegirma bor." },
    { e: 'exercise', u: 'Mashq', t: 'noun', l: 'elementary', ex: 'Exercise is good for health.', eu: "Mashq sog'liq uchun foydali." },
    { e: 'appointment', u: 'Uchrashuv vaqti', t: 'noun', l: 'elementary', ex: 'I have a doctor appointment.', eu: "Shifokor bilan uchrashuv vaqtim bor." },
    { e: 'directions', u: 'Yo\'nalish/Ko\'rsatma', t: 'noun', l: 'elementary', ex: 'Can you give me directions?', eu: "Yo'l ko'rsata olasizmi?" },
    { e: 'library', u: 'Kutubxona', t: 'noun', l: 'elementary', ex: 'I go to the library often.', eu: "Men tez-tez kutubxonaga boraman." },
    { e: 'subject', u: 'Fan', t: 'noun', l: 'elementary', ex: 'Maths is my favourite subject.', eu: "Matematika mening sevimli fanim." },
    { e: 'lesson', u: 'Dars', t: 'noun', l: 'elementary', ex: 'The lesson starts at 9.', eu: "Dars soat 9 da boshlanadi." },
    { e: 'homework', u: 'Uy vazifasi', t: 'noun', l: 'elementary', ex: 'I do my homework every evening.', eu: "Men har kechqurun uy vazifamni bajaraman." },
    { e: 'class', u: 'Sinf', t: 'noun', l: 'elementary', ex: 'Our class has 25 students.', eu: "Bizning sinfda 25 o'quvchi bor." },
    { e: 'exam', u: 'Imtihon', t: 'noun', l: 'elementary', ex: 'I have an exam tomorrow.', eu: "Ertaga imtihonÄ±m bor." },
    { e: 'grade', u: 'Baho', t: 'noun', l: 'elementary', ex: 'She got a good grade.', eu: "U yaxshi baho oldi." },
    { e: 'planet', u: 'Sayyora', t: 'noun', l: 'elementary', ex: 'Earth is our planet.', eu: "Yer bizning sayyoramiz." },
    { e: 'mountain', u: "Tog'", t: 'noun', l: 'elementary', ex: 'The mountain is very high.', eu: "Tog' juda baland." },
    { e: 'river', u: 'Daryo', t: 'noun', l: 'elementary', ex: 'The river is beautiful.', eu: "Daryo go'zal." },
    { e: 'sea', u: 'Dengiz', t: 'noun', l: 'elementary', ex: 'I love the sea.', eu: "Men dengizni yaxshi ko'raman." },
    { e: 'forest', u: "O'rmon", t: 'noun', l: 'elementary', ex: 'The forest is dark and quiet.', eu: "O'rmon qorong'i va sokin." },
    { e: 'animal', u: 'Hayvon', t: 'noun', l: 'elementary', ex: 'My favourite animal is a lion.', eu: "Mening sevimli hayvon â€” sher." },
    { e: 'sport', u: 'Sport', t: 'noun', l: 'elementary', ex: 'Sport keeps you healthy.', eu: "Sport sizni sog'lom saqlaydi." },
    { e: 'team', u: 'Jamoa', t: 'noun', l: 'elementary', ex: 'Our team won the match.', eu: "Bizning jamoamiz o'yinda g'olib keldi." },
    { e: 'winner', u: "G'olib", t: 'noun', l: 'elementary', ex: 'She is the winner!', eu: "U g'olib!" },
    { e: 'story', u: 'Hikoya', t: 'noun', l: 'elementary', ex: 'Tell me a story.', eu: "Menga hikoya aytib ber." },
    { e: 'adventure', u: 'Sarguzasht', t: 'noun', l: 'elementary', ex: 'Life is an adventure.', eu: "Hayot â€” bu sarguzasht." },
    { e: 'dream', u: 'Orzu/Tush', t: 'noun', l: 'elementary', ex: "Follow your dream.", eu: "Orzuingiz ortidan yuring." },
    { e: 'laugh', u: 'Kulmoq', t: 'verb', l: 'elementary', ex: 'She always makes me laugh.', eu: "U har doim meni kuldiradi." },
    { e: 'cry', u: "Yig'lamoq", t: 'verb', l: 'elementary', ex: "Don't cry, everything is okay.", eu: "Yig'lama, hammasi yaxshi bo'ladi." },
    { e: 'visit', u: 'Tashrif buyurmoq', t: 'verb', l: 'elementary', ex: 'We visit our grandparents often.', eu: "Biz tez-tez bobomiznikiga boramiz." },
    { e: 'explain', u: 'Tushuntirmoq', t: 'verb', l: 'elementary', ex: 'Please explain this to me.', eu: "Iltimos, buni menga tushuntiring." },
    { e: 'describe', u: 'Tasvirlash', t: 'verb', l: 'elementary', ex: 'Can you describe the picture?', eu: "Rasmni tasvirlay olasizmi?" },
    { e: 'agree', u: 'Rozilik bildirmoq', t: 'verb', l: 'elementary', ex: 'I agree with your idea.', eu: "Men sizning g'oyangiz bilan roziman." },
    { e: 'disagree', u: 'Rozi bo\'lmaslik', t: 'verb', l: 'elementary', ex: 'I disagree with that.', eu: "Men bunga rozi emasman." },
    { e: 'choose', u: 'Tanlash', t: 'verb', l: 'elementary', ex: 'Please choose one answer.', eu: "Iltimos, bitta javob tanlang." },
    { e: 'remember', u: 'Eslamoq', t: 'verb', l: 'elementary', ex: 'I remember your name.', eu: "Ismingizni eslayman." },
    { e: 'forget', u: 'Unutmoq', t: 'verb', l: 'elementary', ex: "Don't forget your keys!", eu: "Kalitlaringizni unutmang!" },
    { e: 'improve', u: 'Yaxshilamoq', t: 'verb', l: 'elementary', ex: 'I want to improve my English.', eu: "Ingliz tilimni yaxshilashni xohlayman." },
    { e: 'prepare', u: 'Tayyorlamoq', t: 'verb', l: 'elementary', ex: 'I am preparing for the exam.', eu: "Imtihonga tayyorlanayapman." },
    { e: 'enjoy', u: 'Zavqlanmoq', t: 'verb', l: 'elementary', ex: 'I enjoy watching films.', eu: "Film ko'rishdan zavqlanaman." },
    { e: 'finish', u: 'Tugatmoq', t: 'verb', l: 'elementary', ex: 'Have you finished your work?', eu: "Ishingizni tugatdingizmi?" },
    { e: 'start', u: 'Boshlash', t: 'verb', l: 'elementary', ex: "Let's start the lesson.", eu: "Keling, darsni boshlaylik." },
    { e: 'usually', u: 'Odatda', t: 'adverb', l: 'elementary', ex: 'I usually wake up at 7.', eu: "Men odatda soat 7 da uyg'onaman." },
    { e: 'sometimes', u: 'Ba\'zan', t: 'adverb', l: 'elementary', ex: 'She sometimes watches films.', eu: "U ba'zan film ko'radi." },
    { e: 'never', u: 'Hech qachon', t: 'adverb', l: 'elementary', ex: 'I never eat fast food.', eu: "Men hech qachon tez ovqat yemayman." },
    { e: 'always', u: 'Har doim', t: 'adverb', l: 'elementary', ex: 'He is always on time.', eu: "U har doim o'z vaqtida keladi." },
    { e: 'often', u: 'Tez-tez', t: 'adverb', l: 'elementary', ex: 'We often go for walks.', eu: "Biz tez-tez sayrga chiqamiz." },
    { e: 'finally', u: 'Nihoyat', t: 'adverb', l: 'elementary', ex: 'We finally arrived.', eu: "Nihoyat kelIb yetdik." },
    { e: 'suddenly', u: 'To\'satdan', t: 'adverb', l: 'elementary', ex: 'It suddenly started raining.', eu: "To'satdan yomg'ir yog'a boshladi." },
    // PRE-INTERMEDIATE
    { e: 'however', u: 'Biroq, ammo', t: 'conjunction', l: 'pre-intermediate', ex: 'It was cold; however, we went out.', eu: "Havo sovuq edi, biroq biz chiqdik." },
    { e: 'although', u: "Garchi...bo'lsa ham", t: 'conjunction', l: 'pre-intermediate', ex: 'Although it rained, we played.', eu: "Garchi yomg'ir yog'sa ham, biz o'yndik." },
    { e: 'therefore', u: 'Shuning uchun', t: 'adverb', l: 'pre-intermediate', ex: 'Therefore, we decided to go.', eu: "Shuning uchun biz borishga qaror qildik." },
    { e: 'moreover', u: 'Bundan tashqari', t: 'adverb', l: 'pre-intermediate', ex: 'Moreover, she is talented.', eu: "Bundan tashqari, u iste'dodli." },
    { e: 'opportunity', u: 'Imkoniyat', t: 'noun', l: 'pre-intermediate', ex: 'This is a great opportunity.', eu: "Bu ajoyib imkoniyat." },
    { e: 'research', u: 'Tadqiqot', t: 'noun', l: 'pre-intermediate', ex: 'Scientists do research.', eu: "Olimlar tadqiqot o'tkazadilar." },
    { e: 'deadline', u: 'Muddati', t: 'noun', l: 'pre-intermediate', ex: 'The deadline is tomorrow.', eu: "Muddati ertaga." },
    { e: 'give up', u: 'Voz kechmoq', t: 'phrase', l: 'pre-intermediate', ex: "Don't give up on your dreams.", eu: "O'z orzularingizdan voz kechmang." },
    { e: 'look forward', u: 'Kutilish bilan qaramoq', t: 'phrase', l: 'pre-intermediate', ex: 'I look forward to meeting you.', eu: "Men siz bilan uchrashishni intiqlik bilan kutaman." },
    { e: 'achievement', u: 'Yutuq', t: 'noun', l: 'pre-intermediate', ex: 'That is a great achievement.', eu: "Bu katta yutuq." },
    { e: 'challenge', u: 'Muammo/Sinovqilish', t: 'noun', l: 'pre-intermediate', ex: 'Every challenge makes you stronger.', eu: "Har bir muammo sizni kuchliroq qiladi." },
    { e: 'confident', u: 'Ishonchli', t: 'adjective', l: 'pre-intermediate', ex: 'Be confident in yourself.', eu: "O'zingizga ishoning." },
    { e: 'successful', u: 'Muvaffaqiyatli', t: 'adjective', l: 'pre-intermediate', ex: 'She is a successful businesswoman.', eu: "U muvaffaqiyatli ish ayoli." },
    { e: 'responsible', u: 'Mas\'ul', t: 'adjective', l: 'pre-intermediate', ex: 'Be responsible for your actions.', eu: "Harakatlaringiz uchun mas'ul bo'ling." },
    { e: 'environment', u: 'Atrof-muhit', t: 'noun', l: 'pre-intermediate', ex: 'We must protect the environment.', eu: "Biz atrof-muhitni himoya qilishimiz kerak." },
    { e: 'technology', u: 'Texnologiya', t: 'noun', l: 'pre-intermediate', ex: 'Technology changes our lives.', eu: "Texnologiya hayotimizni o'zgartiradi." },
    { e: 'society', u: 'Jamiyat', t: 'noun', l: 'pre-intermediate', ex: 'Society is changing fast.', eu: "Jamiyat tez o'zgarmoqda." },
    { e: 'education', u: "Ta'lim", t: 'noun', l: 'pre-intermediate', ex: "Education is the key to success.", eu: "Ta'lim â€” muvaffaqiyat kaliti." },
    { e: 'career', u: 'Karyera', t: 'noun', l: 'pre-intermediate', ex: 'I want a good career.', eu: "Men yaxshi karyera istayman." },
    { e: 'salary', u: 'Maosh', t: 'noun', l: 'pre-intermediate', ex: 'His salary is very high.', eu: "Uning maoshi juda baland." },
    { e: 'colleague', u: 'Hamkasb', t: 'noun', l: 'pre-intermediate', ex: 'My colleague is helpful.', eu: "Hamkasabim yordamsevar." },
    { e: 'interview', u: 'Suhbat/Intervyu', t: 'noun', l: 'pre-intermediate', ex: 'I have a job interview tomorrow.', eu: "Ertaga ish uchun suhbatim bor." },
    { e: 'application', u: 'Ariza/Ilova', t: 'noun', l: 'pre-intermediate', ex: 'I submitted my application.', eu: "Arizamni topshirdim." },
    { e: 'experience', u: 'Tajriba', t: 'noun', l: 'pre-intermediate', ex: 'Work experience is important.', eu: "Ish tajribasi muhim." },
    { e: 'skills', u: 'Ko\'nikmalar', t: 'noun', l: 'pre-intermediate', ex: 'You need good communication skills.', eu: "Yaxshi muloqot ko'nikmalariga ega bo'lish kerak." },
    { e: 'manage', u: 'Boshqarmoq', t: 'verb', l: 'pre-intermediate', ex: 'She manages a large team.', eu: "U katta jamoani boshqaradi." },
    { e: 'solve', u: 'Yechmoq', t: 'verb', l: 'pre-intermediate', ex: 'We need to solve this problem.', eu: "Biz bu muammoni yechishimiz kerak." },
    { e: 'achieve', u: 'Erishmoq', t: 'verb', l: 'pre-intermediate', ex: 'You can achieve your goals.', eu: "Maqsadlaringizga erisha olasiz." },
    { e: 'develop', u: 'Rivojlantirmoq', t: 'verb', l: 'pre-intermediate', ex: 'We need to develop new ideas.', eu: "Biz yangi g'oyalarni rivojlantirishimiz kerak." },
    { e: 'increase', u: 'Oshirmoq', t: 'verb', l: 'pre-intermediate', ex: 'Prices are increasing.', eu: "Narxlar oshmoqda." },
    { e: 'reduce', u: 'Kamaytirmoq', t: 'verb', l: 'pre-intermediate', ex: 'We must reduce pollution.', eu: "Biz ifloslanishni kamaytirishimiz kerak." },
    { e: 'suggest', u: 'Taklif qilmoq', t: 'verb', l: 'pre-intermediate', ex: 'I suggest we go now.', eu: "Endi ketishimizni taklif qilaman." },
    { e: 'compare', u: 'Solishtirmoq', t: 'verb', l: 'pre-intermediate', ex: 'Compare these two products.', eu: "Bu ikki mahsulotni solishtiring." },
    { e: 'report', u: 'Hisobot', t: 'noun', l: 'pre-intermediate', ex: 'Write a report about it.', eu: "Bu haqida hisobot yozing." },
    { e: 'project', u: 'Loyiha', t: 'noun', l: 'pre-intermediate', ex: 'Our project is due Friday.', eu: "Loyihamiz juma kuni topshirilishi kerak." },
    { e: 'budget', u: 'Byudjet', t: 'noun', l: 'pre-intermediate', ex: 'We have a limited budget.', eu: "Bizning cheklangan byudjetimiz bor." },
    { e: 'profit', u: 'Foyda', t: 'noun', l: 'pre-intermediate', ex: 'The company made a profit.', eu: "Kompaniya foyda ko'rdi." },
    { e: 'client', u: 'Mijoz', t: 'noun', l: 'pre-intermediate', ex: 'The client is satisfied.', eu: "Mijoz mamnun." },
    { e: 'contract', u: 'Shartnoma', t: 'noun', l: 'pre-intermediate', ex: 'Sign the contract.', eu: "Shartnomani imzolang." },
    { e: 'despite', u: 'Qaramasdan', t: 'preposition', l: 'pre-intermediate', ex: 'Despite the rain, we played.', eu: "Yomg'irga qaramasdan, o'yndik." },
    { e: 'unless', u: 'Agar...bo\'lmasa', t: 'conjunction', l: 'pre-intermediate', ex: "Unless you study, you won't pass.", eu: "Agar o'qimasangiz, o'taolmaysiz." },
    { e: 'whereas', u: 'Holbuki', t: 'conjunction', l: 'pre-intermediate', ex: 'She is tall, whereas her sister is short.', eu: "U baland bo'yli, holbuki singlisi past." },
    { e: 'meanwhile', u: 'Shu orada', t: 'adverb', l: 'pre-intermediate', ex: 'I cooked; meanwhile, he set the table.', eu: "Men ovqat pishirdim; shu orada u dasturxon yozdi." },
    { e: 'throughout', u: 'Davomida', t: 'preposition', l: 'pre-intermediate', ex: 'Throughout the year, we worked hard.', eu: "Yil davomida qattiq ishladik." },
    // ADVANCED
    { e: 'nuance', u: 'Noziklik, soya', t: 'noun', l: 'advanced', ex: 'The nuance of her words mattered.', eu: "Uning so'zlarining nozikligi muhim edi." },
    { e: 'sovereignty', u: 'Suverenitet', t: 'noun', l: 'advanced', ex: 'National sovereignty is vital.', eu: "Milliy suverenitet muhimdir." },
    { e: 'eloquence', u: 'Notiqlik', t: 'noun', l: 'advanced', ex: 'Her eloquence impressed everyone.', eu: "Uning notiqligi hammani hayratda qoldirdi." },
    { e: 'paradigm', u: 'Paradigma', t: 'noun', l: 'advanced', ex: 'A new paradigm is emerging.', eu: "Yangi paradigma paydo bo'lmoqda." },
    { e: 'correlation', u: 'Korrelyatsiya', t: 'noun', l: 'advanced', ex: 'Correlation does not imply causation.', eu: "Korrelyatsiya sababiyatni anglatmaydi." },
    { e: 'legislation', u: 'Qonunchilik', t: 'noun', l: 'advanced', ex: 'New legislation was passed.', eu: "Yangi qonun qabul qilindi." },
    { e: 'mitigate', u: 'Yumshatmoq', t: 'verb', l: 'advanced', ex: 'We must mitigate the risks.', eu: "Biz xavflarni yumshatishimiz kerak." },
    { e: 'unprecedented', u: "Misli ko'rilmagan", t: 'adjective', l: 'advanced', ex: 'This is an unprecedented situation.', eu: "Bu misli ko'rilmagan holat." },
    { e: 'meticulous', u: 'Puxta, ehtiyotkor', t: 'adjective', l: 'advanced', ex: 'She is meticulous in her work.', eu: "U ishida puxta." },
    { e: 'ambiguous', u: 'Noaniq, ikki ma\'noli', t: 'adjective', l: 'advanced', ex: 'His statement was ambiguous.', eu: "Uning bayonoti noaniq edi." },
    { e: 'coherent', u: 'Izchil, mantiqiy', t: 'adjective', l: 'advanced', ex: 'Write a coherent argument.', eu: "Izchil argument yozing." },
    { e: 'substantial', u: 'Muhim, sezilarli', t: 'adjective', l: 'advanced', ex: 'There is substantial evidence.', eu: "Jiddiy dalillar mavjud." },
    { e: 'inherent', u: 'O\'ziga xos, tabiiy', t: 'adjective', l: 'advanced', ex: 'There are inherent risks.', eu: "O'ziga xos xavflar mavjud." },
    { e: 'predominant', u: 'Ustunlik qiluvchi', t: 'adjective', l: 'advanced', ex: 'English is the predominant language.', eu: "Ingliz tili ustunlik qiluvchi til." },
    { e: 'compelling', u: 'Jozibali, qiziqarli', t: 'adjective', l: 'advanced', ex: 'She made a compelling argument.', eu: "U jozibali argument keltirdi." },
    { e: 'controversial', u: 'Bahsli, munozarali', t: 'adjective', l: 'advanced', ex: 'It is a controversial topic.', eu: "Bu munozarali mavzu." },
    { e: 'pragmatic', u: 'Amaliy', t: 'adjective', l: 'advanced', ex: 'Be pragmatic about it.', eu: "Bunga amaliy yondashing." },
    { e: 'catalyst', u: 'Katalizator', t: 'noun', l: 'advanced', ex: 'The invention was a catalyst for change.', eu: "Ixtiro o'zgarish uchun katalizator bo'ldi." },
    { e: 'demographic', u: 'Demografik', t: 'adjective/noun', l: 'advanced', ex: 'Demographic changes are significant.', eu: "Demografik o'zgarishlar muhim." },
    { e: 'infrastructure', u: 'Infratuzilma', t: 'noun', l: 'advanced', ex: 'We must invest in infrastructure.', eu: "Infratuzilmaga investitsiya qilishimiz kerak." },
    { e: 'hypothesis', u: 'Faraz', t: 'noun', l: 'advanced', ex: 'Test your hypothesis.', eu: "Farazingizni sinab ko'ring." },
    { e: 'methodology', u: 'Metodologiya', t: 'noun', l: 'advanced', ex: 'Explain your methodology.', eu: "Metodologiyangizni tushuntiring." },
    { e: 'phenomenon', u: 'Hodisa', t: 'noun', l: 'advanced', ex: 'This is a global phenomenon.', eu: "Bu global hodisa." },
    { e: 'implications', u: 'Oqibatlar', t: 'noun', l: 'advanced', ex: 'Consider the implications.', eu: "Oqibatlarni ko'rib chiqing." },
    { e: 'perspective', u: 'Nuqtai nazar', t: 'noun', l: 'advanced', ex: 'Consider a different perspective.', eu: "Boshqa nuqtai nazarni ko'rib chiqing." },
    { e: 'framework', u: 'Tizim/Struktura', t: 'noun', l: 'advanced', ex: 'We need a clear framework.', eu: "Bizga aniq tizim kerak." },
    { e: 'rhetoric', u: 'Ritorika', t: 'noun', l: 'advanced', ex: 'His rhetoric was powerful.', eu: "Uning ritorikasi kuchli edi." },
    { e: 'scrutiny', u: 'Sinchkovlik bilan tekshirish', t: 'noun', l: 'advanced', ex: 'The plan faced scrutiny.', eu: "Reja sinchkovlik bilan tekshirildi." },
    { e: 'consensus', u: 'Kelishuv', t: 'noun', l: 'advanced', ex: 'We reached a consensus.', eu: "Biz kelishuvga erishdik." },
    { e: 'advocate', u: 'Himoya qilmoq', t: 'verb', l: 'advanced', ex: 'She advocates for human rights.', eu: "U inson huquqlarini himoya qiladi." },
    { e: 'constitute', u: 'Tashkil etmoq', t: 'verb', l: 'advanced', ex: 'This constitutes a violation.', eu: "Bu qoidabuzarlik tashkil etadi." },
    { e: 'facilitate', u: 'Osonlashtirmoq', t: 'verb', l: 'advanced', ex: 'Technology facilitates learning.', eu: "Texnologiya o'rganishni osonlashtiradi." },
    { e: 'scrutinise', u: 'Diqqat bilan tekshirmoq', t: 'verb', l: 'advanced', ex: 'We must scrutinise the data.', eu: "Biz ma'lumotlarni diqqat bilan tekshirishimiz kerak." },
    { e: 'elaborate', u: 'Batafsil bayon etmoq', t: 'verb', l: 'advanced', ex: 'Can you elaborate on that?', eu: "Bu haqida batafsil ayta olasizmi?" },
    { e: 'acknowledge', u: 'Tan olmoq', t: 'verb', l: 'advanced', ex: 'I acknowledge my mistake.', eu: "Xatoimni tan olaman." },
    { e: 'sustain', u: 'Davom ettirmoq', t: 'verb', l: 'advanced', ex: 'We must sustain our efforts.', eu: "Biz kuchlarimizni davom ettirishimiz kerak." },
    { e: 'notwithstanding', u: 'Qaramasdan', t: 'preposition', l: 'advanced', ex: 'Notwithstanding the difficulties, we succeeded.', eu: "Qiyinchiliklarga qaramasdan, muvaffaqiyat qozondik." },
    { e: 'albeit', u: 'Garchi', t: 'conjunction', l: 'advanced', ex: 'It was a good result, albeit unexpected.', eu: "Bu yaxshi natija edi, garchi kutilmagan bo'lsa ham." },
    { e: 'insofar', u: 'Darajada', t: 'conjunction', l: 'advanced', ex: 'Insofar as possible, we will help.', eu: "Imkon qadar yordam beramiz." },
    { e: 'forthcoming', u: 'Yaqinlashayotgan', t: 'adjective', l: 'advanced', ex: 'The forthcoming changes are significant.', eu: "Yaqinlashayotgan o'zgarishlar muhim." },
    { e: 'plausible', u: 'Ishonchli ko\'rinadigan', t: 'adjective', l: 'advanced', ex: 'That seems plausible.', eu: "Bu ishonchli ko'rinadi." },
];

// ══════════════════════════════════════════════════════════════
// UNITS DATA
// FIX #2: UD_DATA keys match curLevel values ('pre-intermediate')
// FIX #3: elementary e3 object syntax fully corrected (no .and &&)
// ══════════════════════════════════════════════════════════════
const UD_DATA = {
    beginner: [
        {
            id: 'b0', emoji: '🔤', title: 'Alphabet A-Z', desc: "Ingliz alifbosini o'rganish", level: 'beginner',
            words: ['alphabet', 'book', 'cat', 'dog', 'apple', 'red', 'happy', 'water', 'school', 'good'],
            xp: 40, coin: 15,
            grammar_rule: "Ingliz alifbosida 26 harf bor: 5 unli (A,E,I,O,U) va 21 undosh.",
            grammar_example: "A a, B b, C c, D d, E e ... Z z",
            reading_text: "The English alphabet has 26 letters. Five letters are vowels: A, E, I, O, U. The other 21 letters are consonants. Every word in English is made from these 26 letters. Children learn the alphabet at school.",
            reading_qs: [
                { q: "How many letters?", opts: ["24", "25", "26", "27"], c: 2 },
                { q: "How many vowels?", opts: ["3", "4", "5", "6"], c: 2 },
                { q: "What is the last letter?", opts: ["X", "Y", "Z", "W"], c: 2 }
            ]
        },
        {
            id: 'b1', emoji: '👋', title: 'Greetings', desc: "Salomlashish va xayrlashish", level: 'beginner',
            words: ['hello', 'goodbye', 'thank you', 'please', 'sorry', 'yes', 'no', 'good', 'bad', 'happy'],
            xp: 50, coin: 20,
            grammar_rule: "To be: I am, You are, He/She is — asosiy fe'l",
            grammar_example: "I am happy. You are my friend. He is a teacher.",
            reading_text: "My name is Sarah. I am from England. Every morning I say 'hello' to my neighbours. When I leave, I say 'goodbye'. I always say 'please' and 'thank you'. People say I am very polite.",
            reading_qs: [
                { q: "Where is Sarah from?", opts: ["America", "England", "France", "Germany"], c: 1 },
                { q: "What does Sarah say when she leaves?", opts: ["Hello", "Thank you", "Goodbye", "Please"], c: 2 },
                { q: "What is important to Sarah?", opts: ["Money", "Being polite", "Fame", "Strength"], c: 1 }
            ]
        },
        {
            id: 'b2', emoji: '🔢', title: 'Numbers', desc: "Raqamlar va hisoblash", level: 'beginner',
            words: ['one', 'two', 'three', 'apple', 'book', 'cat', 'dog', 'mother', 'father', 'school'],
            xp: 50, coin: 20,
            grammar_rule: "Numbers: one, two, three... Ordinal: first, second, third",
            grammar_example: "I have three books. She is the first student.",
            reading_text: "Tom has three cats and two dogs. Every day he feeds them four times. He spends about ten minutes with each animal. He bought twelve toys for his cats.",
            reading_qs: [
                { q: "How many cats?", opts: ["Two", "Three", "Four", "Five"], c: 1 },
                { q: "How many times daily?", opts: ["Two", "Three", "Four", "Five"], c: 2 },
                { q: "How many toys?", opts: ["Ten", "Twelve", "Fifteen", "Twenty"], c: 1 }
            ]
        },
        {
            id: 'b3', emoji: '🎨', title: 'Colors', desc: "Ingliz tilida ranglar", level: 'beginner',
            words: ['red', 'blue', 'green', 'yellow', 'black', 'white', 'happy', 'sad', 'hot', 'cold'],
            xp: 60, coin: 25,
            grammar_rule: "Adjectives before nouns: a red apple, the blue sky",
            grammar_example: "She has a red bag. I see blue birds. The green grass is soft.",
            reading_text: "The rainbow has seven colors: red, orange, yellow, green, blue, indigo and violet. Red is the color of fire. Blue is the color of the sky. Green is the color of trees.",
            reading_qs: [
                { q: "How many colors?", opts: ["Five", "Six", "Seven", "Eight"], c: 2 },
                { q: "Color of the sky?", opts: ["Red", "Yellow", "Green", "Blue"], c: 3 },
                { q: "Color of fire?", opts: ["Blue", "Red", "Green", "Yellow"], c: 1 }
            ]
        },
        {
            id: 'b4', emoji: '👨‍👩‍👧', title: 'Family', desc: "Oila a'zolari", level: 'beginner',
            words: ['mother', 'father', 'sister', 'brother', 'water', 'food', 'house', 'car', 'dog', 'cat'],
            xp: 60, coin: 25,
            grammar_rule: "Possessives: my, your, his, her + noun",
            grammar_example: "My mother is kind. Her father works hard. Their family is big.",
            reading_text: "My family has five members. My father is a doctor and my mother is a teacher. I have one brother and one sister. My grandparents live nearby. We visit them every Sunday.",
            reading_qs: [
                { q: "How many people?", opts: ["Three", "Four", "Five", "Six"], c: 2 },
                { q: "Father's job?", opts: ["Teacher", "Doctor", "Engineer", "Driver"], c: 1 },
                { q: "When do they visit grandparents?", opts: ["Saturday", "Sunday", "Monday", "Friday"], c: 1 }
            ]
        },
        {
            id: 'b5', emoji: '🍎', title: 'Food & Drinks', desc: "Ovqat va ichimliklar", level: 'beginner',
            words: ['apple', 'bread', 'water', 'eat', 'drink', 'sleep', 'read', 'write', 'walk', 'speak'],
            xp: 70, coin: 30,
            grammar_rule: "Countable vs uncountable: an apple, some water",
            grammar_example: "I want an apple and some water. She drinks milk every morning.",
            reading_text: "A healthy breakfast is important. Many people eat eggs and bread in the morning. Tea and coffee are popular drinks. Milk is good for children. Always drink enough water every day.",
            reading_qs: [
                { q: "What is important in the morning?", opts: ["Dinner", "Lunch", "Breakfast", "Snack"], c: 2 },
                { q: "What is good for children?", opts: ["Coffee", "Tea", "Milk", "Juice"], c: 2 },
                { q: "Which food is mentioned?", opts: ["Rice", "Soup", "Eggs and bread", "Pizza"], c: 2 }
            ]
        },
    ],

    elementary: [
        {
            id: 'e1', emoji: '🏡', title: 'House & Rooms', desc: "Uy va xonalar", level: 'elementary',
            words: ['doctor', 'teacher', 'engineer', 'expensive', 'cheap', 'beautiful', 'interesting', 'difficult', 'easy', 'travel'],
            xp: 80, coin: 35,
            grammar_rule: "There is / There are: There is a sofa. There are three bedrooms.",
            grammar_example: "There is a big kitchen. There are two bathrooms.",
            reading_text: "My house has three floors. On the ground floor, there is a large living room and a modern kitchen. On the first floor, there are three bedrooms and two bathrooms. My bedroom has a large window with a view of the garden.",
            reading_qs: [
                { q: "How many floors?", opts: ["Two", "Three", "Four", "Five"], c: 1 },
                { q: "Where are the bedrooms?", opts: ["Ground floor", "First floor", "Garden", "Basement"], c: 1 },
                { q: "What does the bedroom have?", opts: ["A TV", "A large window", "A pool", "A fireplace"], c: 1 }
            ]
        },
        {
            id: 'e2', emoji: '💼', title: 'Jobs', desc: "Kasblar", level: 'elementary',
            words: ['doctor', 'teacher', 'engineer', 'music', 'friend', 'weather', 'computer', 'travel', 'beautiful', 'interesting'],
            xp: 80, coin: 35,
            grammar_rule: "What do you do? I am a/an + job.",
            grammar_example: "What do you do? I am a nurse. He works as an engineer.",
            reading_text: "There are many different professions. Doctors and nurses work in hospitals. Teachers educate the next generation. Engineers build bridges. Pilots fly aeroplanes. Every job is important for society.",
            reading_qs: [
                { q: "Where do doctors work?", opts: ["Schools", "Factories", "Hospitals", "Offices"], c: 2 },
                { q: "What do engineers build?", opts: ["Books", "Songs", "Bridges", "Food"], c: 2 },
                { q: "What do teachers do?", opts: ["Fly planes", "Build bridges", "Educate people", "Cook food"], c: 2 }
            ]
        },
        // FIX #3: e3 syntax fully corrected — removed broken ".and &&" chain
        {
            id: 'e3', emoji: '🛒', title: 'Shopping', desc: "Xarid qilish", level: 'elementary',
            words: ['expensive', 'cheap', 'beautiful', 'difficult', 'easy', 'travel', 'music', 'friend', 'weather', 'computer'],
            xp: 90, coin: 40,
            grammar_rule: "How much is it? It costs... Can I pay by card?",
            grammar_example: "How much is this shirt? It costs £25. Can I pay by card? Yes, of course.",
            reading_text: "Shopping is a daily activity. Supermarkets sell food and household items. Department stores have clothes and electronics. Before buying, always check the price. Look for discounts and sales to save money. Keep your receipt!",
            reading_qs: [
                { q: "Where can you buy clothes?", opts: ["Supermarket", "Department store", "Pharmacy", "Bakery"], c: 1 },
                { q: "What should you keep?", opts: ["The bag", "The receipt", "The label", "The box"], c: 1 },
                { q: "What helps save money?", opts: ["Buying quickly", "Paying cash", "Looking for discounts", "Going often"], c: 2 }
            ]
        },
    ],

    // FIX #4: key changed from 'preintermediate' to 'pre-intermediate'
    // to match switchLevel('pre-intermediate') calls in the HTML
    'pre-intermediate': [
        {
            id: 'p1', emoji: '🔮', title: 'Future Plans', desc: "Kelajak zamonlari", level: 'pre-intermediate',
            words: ['however', 'although', 'therefore', 'moreover', 'opportunity', 'nuance', 'eloquence', 'mitigate', 'unprecedented', 'meticulous'],
            xp: 130, coin: 60,
            grammar_rule: "Will for predictions/decisions. Going to for plans.",
            grammar_example: "I will call you tomorrow. She is going to study medicine.",
            reading_text: "Planning for the future is essential. Setting clear goals helps you achieve success. Short-term goals take a few weeks. Long-term goals take years. Flexibility is just as important as determination.",
            reading_qs: [
                { q: "What do short-term goals take?", opts: ["Years", "Decades", "A few weeks", "A lifetime"], c: 2 },
                { q: "What is as important as determination?", opts: ["Money", "Flexibility", "Education", "Strength"], c: 1 },
                { q: "What does planning help achieve?", opts: ["Friends", "Fame", "Success", "Travel"], c: 2 }
            ]
        },
        {
            id: 'p2', emoji: '🎯', title: 'Present Perfect', desc: "Present Perfect zamon", level: 'pre-intermediate',
            words: ['however', 'although', 'therefore', 'moreover', 'opportunity', 'nuance', 'eloquence', 'mitigate', 'unprecedented', 'meticulous'],
            xp: 140, coin: 65,
            grammar_rule: "Have/Has + past participle. Ever/Never for life experience.",
            grammar_example: "Have you ever been to London? I have never tried sushi.",
            reading_text: "The present perfect connects the past and the present. It describes experiences and recent events. Common time expressions: ever, never, already, just, yet, recently, since and for.",
            reading_qs: [
                { q: "What does present perfect connect?", opts: ["Two futures", "Past and present", "Two pasts", "Present and future"], c: 1 },
                { q: "Which words show ongoing duration?", opts: ["Ever/never", "Just/already", "Since/for", "Yet/recently"], c: 2 },
                { q: "What is 'already' used with?", opts: ["Questions", "Negatives", "Completed actions", "Future plans"], c: 2 }
            ]
        },
    ],

    advanced: [
        {
            id: 'a1', emoji: '🖊️', title: 'Academic Writing', desc: "Akademik yozuv", level: 'advanced',
            words: ['moreover', 'however', 'therefore', 'nuance', 'eloquence', 'mitigate', 'unprecedented', 'meticulous', 'opportunity', 'although'],
            xp: 200, coin: 90,
            grammar_rule: "Cohesion devices: moreover (addition), however (contrast), therefore (cause).",
            grammar_example: "The data supports the hypothesis. Moreover, previous research corroborates these findings.",
            reading_text: "Academic writing demands precision and logical coherence. Every argument must be supported by evidence. Cohesion devices connect ideas: 'furthermore' adds information, 'however' introduces contrast. Paragraph structure follows PEEL: Point, Evidence, Explanation, Link.",
            reading_qs: [
                { q: "What does 'furthermore' signal?", opts: ["Contrast", "Result", "Additional info", "Condition"], c: 2 },
                { q: "What does PEEL stand for?", opts: ["Purpose,Evidence,Explain,Link", "Point,Evidence,Explain,Link", "Point,Example,Evaluation,Length", "Paragraph,Editing,Expression,Language"], c: 1 },
                { q: "What should every argument have?", opts: ["A story", "Evidence", "Opinions", "Humor"], c: 1 }
            ]
        },
        {
            id: 'a2', emoji: '📋', title: 'IELTS Writing', desc: "IELTS Yozuv", level: 'advanced',
            words: ['moreover', 'however', 'therefore', 'nuance', 'eloquence', 'mitigate', 'unprecedented', 'meticulous', 'opportunity', 'although'],
            xp: 250, coin: 110,
            grammar_rule: "Task 1: Describe data. Task 2: Argue a position with evidence.",
            grammar_example: "Overall, internet usage increased dramatically between 2000 and 2020.",
            reading_text: "IELTS Academic Writing Task 1 requires describing visual information: graphs, charts or tables. You have 20 minutes to write at least 150 words. Begin with an overview. Do not give opinions — simply describe what you see.",
            reading_qs: [
                { q: "How long should Task 1 be?", opts: ["100 words", "150 words minimum", "200 words", "250 words"], c: 1 },
                { q: "What is the overview?", opts: ["All data described", "Introduction", "Main trends without detail", "Your opinion"], c: 2 },
                { q: "Should you give opinions?", opts: ["Yes, always", "Sometimes", "Only in conclusion", "No, just describe"], c: 3 }
            ]
        },
    ]
};

// ══════════════════════════════════════════════════════════════
// GRAMMAR QUESTIONS
// ══════════════════════════════════════════════════════════════
const GRAMMAR_QS = [
    { q: "She ___ to school every day.", opts: ["go", "goes", "going", "gone"], ans: "goes", exp: "3-shaxs birlik: go → goes" },
    { q: "I ___ a student.", opts: ["am", "is", "are", "be"], ans: "am", exp: "1-shaxs birlik: I am" },
    { q: "They ___ my friends.", opts: ["is", "am", "are", "be"], ans: "are", exp: "Ko'plik: they are" },
    { q: "He ___ a book right now.", opts: ["read", "reads", "is reading", "reading"], ans: "is reading", exp: "Hozirgi davom zamon: is + V-ing" },
    { q: "I have ___ in Tashkent for 5 years.", opts: ["live", "lived", "living", "lives"], ans: "lived", exp: "Present Perfect: have + V3" },
    { q: "If I ___ rich, I would buy a mansion.", opts: ["am", "was", "were", "be"], ans: "were", exp: "2-shartli gap: If + were" },
    { q: "The report ___ written by the manager.", opts: ["is", "was", "were", "been"], ans: "was", exp: "O'tgan passiv: was + V3" },
    { q: "She is the ___ student in the class.", opts: ["more intelligent", "intelligenter", "most intelligent", "intelligent"], ans: "most intelligent", exp: "Superlative: the most + uzun sifat" },
    { q: "By tomorrow, I ___ finished the project.", opts: ["will", "will have", "have", "had"], ans: "will have", exp: "Kelajak mukammal: will have + V3" },
    { q: "___ she arrives, we will start dinner.", opts: ["Since", "While", "When", "During"], ans: "When", exp: "Vaqt gapi: When + hozirgi zamon" },
    { q: "He suggested that she ___ a doctor.", opts: ["see", "sees", "saw", "seeing"], ans: "see", exp: "Subjunctive: suggest + that + asos fe'l" },
    { q: "I ___ never been to London.", opts: ["have", "has", "had", "am"], ans: "have", exp: "Present Perfect + never: have + V3" },
    { q: "This is ___ umbrella.", opts: ["a", "an", "the", "—"], ans: "an", exp: "Unli tovush oldidan 'an': umbrella → an" },
    { q: "Not only ___ she sing well, but she also dances.", opts: ["can", "does", "did", "could"], ans: "does", exp: "Inversion after 'Not only': does + subject" },
    { q: "The harder you work, ___ you will achieve.", opts: ["more", "the more", "most", "the most"], ans: "the more", exp: "Double comparative: The harder... the more..." },
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
    u.lang = 'en-US'; u.rate = 0.85;
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
        <span style="font-size:0.8rem;color:#e8ecff;font-weight:600">${CU?.displayName || CU?.email || 'User'}</span>
        <span style="font-size:0.78rem;color:#f5c842">⭐ ${UXP.toLocaleString()}</span>
        <span style="font-size:0.78rem;color:#fbbf24">🪙 ${UCoin.toLocaleString()}</span>
    </div>`;
}

// ══════════════════════════════════════════════════════════════
// LEADERBOARD
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
                        : rank;
            const val = u[field] || 0;
            const planKey = (u.plan || 'free').toLowerCase();
            const pc = PLAN_COLORS[planKey] || '#94a3b8';
            const planLabel = PLAN_LABELS[planKey] || planKey.toUpperCase();
            const initial = (u.displayName || u.email || 'U').charAt(0).toUpperCase();
            html += `<div class="lb-row${isMe ? ' me' : ''}">
                <div class="lb-rank ${rankClass}">${rankIcon}</div>
                <div class="lb-avatar">${initial}</div>
                <div style="flex:1">
                    <div class="lb-name">${u.displayName || u.email || 'Foydalanuvchi'}${isMe ? ' <span style="color:#a78bfa;font-size:0.72rem">(siz)</span>' : ''}</div>
                    ${planKey !== 'free' ? `<span class="lb-plan" style="border-color:${pc}44;color:${pc}">${planLabel}</span>` : ''}
                </div>
                <div style="text-align:right">
                    <div class="lb-score"><i class="fa-solid ${icons[field] || 'fa-star'}" style="margin-right:4px;color:#a78bfa"></i>${val.toLocaleString()}</div>
                    <div class="lb-score-label">${labels[field] || field}</div>
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
        if (!r.ok) { const errText = await r.text(); return `❗ AI xatolik: ${r.status}.`; }
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
    ctx.closePath(); ctx.fillStyle = 'rgba(91,124,250,0.2)'; ctx.fill();
    ctx.strokeStyle = 'rgba(91,124,250,0.7)'; ctx.lineWidth = 2; ctx.stroke();
    angles.forEach((a, i) => {
        ctx.beginPath();
        ctx.arc(cx + r * skills[i] * Math.cos(a), cy + r * skills[i] * Math.sin(a), 4, 0, Math.PI * 2);
        ctx.fillStyle = '#5b7cfa'; ctx.fill();
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
          <div style="font-size:0.75rem;color:#a78bfa;margin-bottom:4px">Unit ${i + 1}</div>
          <div style="font-size:1.8rem;margin-bottom:8px">${unit.emoji}</div>
          <div style="font-weight:700;font-size:1rem;color:#e8ecff;margin-bottom:6px">${unit.title}</div>
          <div style="font-size:0.8rem;color:#666;margin-bottom:12px">${unit.desc}</div>
          <div style="display:flex;gap:8px;margin-bottom:10px">
            ${['A', 'B', 'C', 'D'].map(l => `<div style="width:24px;height:24px;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:0.7rem;font-weight:700;background:${UProg[unit.id + '_' + l] >= 100 ? 'rgba(52,211,153,0.2)' : 'rgba(255,255,255,0.05)'};border:1px solid ${UProg[unit.id + '_' + l] >= 100 ? '#34d399' : 'rgba(255,255,255,0.1)'};color:${UProg[unit.id + '_' + l] >= 100 ? '#34d399' : '#666'}">${l}</div>`).join('')}
          </div>
          <div style="height:3px;background:rgba(255,255,255,0.06);border-radius:100px;overflow:hidden;margin-bottom:8px">
            <div style="height:100%;width:${pct}%;background:linear-gradient(90deg,#5b7cfa,#a78bfa);border-radius:100px;transition:width 0.4s"></div>
          </div>
          <div style="font-size:0.76rem;display:flex;gap:10px">
            <span style="color:#f5c842">+${unit.xp} XP</span>
            <span style="color:#fbbf24">+${unit.coin} 🪙</span>
            ${isComp ? '<span style="color:#34d399">✅</span>' : ''}
          </div>`;
        card.onmouseover = () => { card.style.background = 'rgba(91,124,250,0.08)'; card.style.borderColor = 'rgba(91,124,250,0.3)'; };
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
    const lnames = { A: "📖 Grammatika & Lug'at", B: "🎧 Listening", C: "📖 Reading", D: "🎤 Speaking & Writing" };
    const lcolors = { A: '#4f6ef7', B: '#22d3ee', C: '#34d399', D: '#f472b6' };
    content.innerHTML = `
      <div style="text-align:center;padding-bottom:20px">
        <div style="font-size:3rem;margin-bottom:10px">${unit.emoji}</div>
        <h2 style="margin-bottom:8px">${unit.title}</h2>
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
        return `<div onclick="window.openLesson('${unit.id}','${k}')" style="padding:16px;border-radius:12px;background:${done ? 'rgba(52,211,153,0.08)' : 'rgba(255,255,255,0.03)'};border:1px solid ${done ? 'rgba(52,211,153,0.3)' : 'rgba(255,255,255,0.08)'};cursor:pointer;transition:all 0.2s" onmouseover="this.style.borderColor='${lcolors[k]}55'" onmouseout="this.style.borderColor='${done ? 'rgba(52,211,153,0.3)' : 'rgba(255,255,255,0.08)'}'">
                <div style="font-size:1.2rem;font-weight:800;color:${lcolors[k]};margin-bottom:4px">${k}</div>
                <div style="font-size:0.8rem;color:#e8ecff">${lnames[k]}</div>
                ${done ? `<div style="font-size:0.72rem;color:#34d399;margin-top:4px">✅ ${sc}%</div>` : '<div style="font-size:0.72rem;color:#666;margin-top:4px">▶ Boshlash</div>'}
            </div>`;
    }).join('')}
      </div>
      <div>
        <div style="font-size:0.78rem;color:#666;margin-bottom:8px">📝 So'zlar:</div>
        <div style="display:flex;flex-wrap:wrap;gap:6px">
          ${unit.words.map(w => `<span onclick="window.spk('${w.replace(/'/g, "\\'")}',event)" style="background:rgba(167,139,250,0.1);border:1px solid rgba(167,139,250,0.2);color:#c4b5fd;padding:4px 10px;border-radius:20px;font-size:0.76rem;cursor:pointer">${w} 🔊</span>`).join('')}
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
        <span style="margin-left:auto;font-size:0.72rem;color:#a78bfa;background:rgba(167,139,250,0.1);padding:3px 10px;border-radius:20px">${unit.level}</span>
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
        const wd = WDB.find(x => x.e === w) || { ex: `Use the word "${w}".`, eu: '', u: '' };
        const blank = wd.ex.replace(new RegExp('\\b' + w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i'), '_______');
        return `<div style="margin-bottom:14px;padding:14px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:12px">
          <div style="font-size:0.9rem;margin-bottom:4px">${i + 1}. ${blank}</div>
          <div style="font-size:0.75rem;color:#666;margin-bottom:8px;font-style:italic">${wd.eu}</div>
          <input id="gex${i}" data-ans="${w}" placeholder="Javobingiz..." style="width:100%;padding:8px 12px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:8px;color:#e8ecff;font-family:inherit;margin-bottom:8px;box-sizing:border-box">
          <div style="display:flex;gap:6px">
            <button onclick="window.chkFill(${i})" style="padding:6px 14px;border-radius:8px;background:rgba(52,211,153,0.1);border:1px solid rgba(52,211,153,0.3);color:#34d399;cursor:pointer;font-size:0.78rem;font-family:inherit">✓ Tekshir</button>
            <button onclick="window.aiExWord('${w.replace(/'/g, "\\'")}',event)" style="padding:6px 14px;border-radius:8px;background:rgba(167,139,250,0.1);border:1px solid rgba(167,139,250,0.25);color:#a78bfa;cursor:pointer;font-size:0.78rem;font-family:inherit">🤖 AI</button>
            <button onclick="window.spk('${w.replace(/'/g, "\\'")}',event)" style="padding:6px 14px;border-radius:8px;background:rgba(96,165,250,0.1);border:1px solid rgba(96,165,250,0.2);color:#60a5fa;cursor:pointer;font-size:0.78rem;font-family:inherit">🔊</button>
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
                <button onclick="window.spk('${w.replace(/'/g, "\\'")}',event)" style="background:none;border:none;cursor:pointer;font-size:1rem">🔊</button>
              </div>
              <div style="color:#a78bfa;font-size:0.82rem;margin-bottom:3px">${d.u}</div>
              <div style="color:#666;font-size:0.72rem;font-style:italic">"${d.ex}"</div>
            </div>`;
    }).join('')}
      </div>
    </div>
    <div style="margin-bottom:20px;padding:16px;background:rgba(91,124,250,0.06);border:1px solid rgba(91,124,250,0.15);border-radius:12px">
      <h3 style="margin-bottom:10px;color:#e8ecff">📝 Grammatika Qoidasi</h3>
      <div style="font-size:0.9rem;color:#c7d2fe;margin-bottom:8px">💡 ${unit.grammar_rule || ''}</div>
      <div style="font-size:0.85rem;color:#a78bfa;font-style:italic">✏️ ${unit.grammar_example || ''}</div>
      <button onclick="window.aiGrammarExplain('${unit.title}','${(unit.grammar_rule || '').replace(/'/g, "\\'")}')" style="margin-top:10px;padding:8px 16px;border-radius:8px;background:rgba(167,139,250,0.1);border:1px solid rgba(167,139,250,0.25);color:#a78bfa;cursor:pointer;font-size:0.78rem;font-family:inherit">🤖 AI batafsil tushuntirsin (1 token)</button>
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
        <div>${matchW.map((w, i) => `<div class="match-item eng" data-i="${i}" onclick="window.selMatch(this,'e',${i})" style="padding:10px 14px;border-radius:10px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);cursor:pointer;margin-bottom:6px;font-size:0.88rem;color:#e8ecff;transition:all 0.2s">${w}</div>`).join('')}</div>
        <div>${shuffUZ.map(u => `<div class="match-item uz" data-u="${u}" onclick="window.selMatch(this,'u','${u.replace(/'/g, "\\'")}')" style="padding:10px 14px;border-radius:10px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);cursor:pointer;margin-bottom:6px;font-size:0.88rem;color:#c4b5fd;transition:all 0.2s">${u}</div>`).join('')}</div>
      </div>
      <div id="matchFB" style="margin-top:8px;font-size:0.8rem"></div>
    </div>
    <button onclick="window.finLessonA('${unit.id}')" style="width:100%;padding:14px;border-radius:12px;background:linear-gradient(135deg,#5b7cfa,#a78bfa);border:none;color:#fff;font-size:0.95rem;font-weight:700;cursor:pointer;font-family:inherit">✅ Grammatika darsini yakunlash</button>`;
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
        el.style.background = 'rgba(91,124,250,0.2)'; el.style.borderColor = '#5b7cfa';
        mSel.e = val; mSel.eEl = el;
    } else {
        document.querySelectorAll('.match-item.uz').forEach(x => { x.style.borderColor = 'rgba(255,255,255,0.1)'; x.style.background = 'rgba(255,255,255,0.04)'; });
        el.style.background = 'rgba(167,139,250,0.2)'; el.style.borderColor = '#a78bfa';
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
    const r = await callAI(`"${title}" mavzusida "${rule}" grammatika qoidasini O'zbek tilida tushuntir. 3 ta misol keltir.`, 800);
    if (fb) fb.innerHTML = r.replace(/\n/g, '<br>');
};

window.aiExWord = async function (word, e) {
    if (e) e.stopPropagation();
    const ok = await spendTokens(TOKEN_CONFIG.ai_cost, `"${word}" AI izoh`); if (!ok) return;
    const fb = $id('vocabAIFB') || $id('wordAIFB');
    if (fb) fb.innerHTML = `🤖 "${word}" tahlil qilmoqda...`;
    const r = await callAI(`"${word}" inglizcha so'zini O'zbek tilida: 1) Ma'nosi 2) 3 misol 3) Eslatma`, 600);
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
        <button onclick="window.playDict('${unit.id}','slow')" style="padding:8px 16px;border-radius:8px;background:rgba(167,139,250,0.1);border:1px solid rgba(167,139,250,0.2);color:#a78bfa;cursor:pointer;font-size:0.82rem;font-family:inherit">🐌 Sekin</button>
      </div>
      <textarea id="dictIn" placeholder="Eshitgangizni yozing..." style="width:100%;height:80px;padding:10px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:8px;color:#e8ecff;font-family:inherit;resize:none;box-sizing:border-box"></textarea>
      <div style="display:flex;gap:6px;margin-top:8px">
        <button onclick="window.chkDict()" style="padding:7px 14px;border-radius:8px;background:rgba(52,211,153,0.1);border:1px solid rgba(52,211,153,0.3);color:#34d399;cursor:pointer;font-size:0.78rem;font-family:inherit">✓ Tekshir</button>
        <button onclick="window.aiChkDict()" style="padding:7px 14px;border-radius:8px;background:rgba(167,139,250,0.1);border:1px solid rgba(167,139,250,0.25);color:#a78bfa;cursor:pointer;font-size:0.78rem;font-family:inherit">🤖 AI tahlil (1 token)</button>
      </div>
      <div id="dictFB" style="margin-top:8px;font-size:0.8rem"></div>
    </div>
    <button onclick="window.finLessonB('${unit.id}')" style="width:100%;padding:14px;border-radius:12px;background:linear-gradient(135deg,#22d3ee,#5b7cfa);border:none;color:#fff;font-size:0.95rem;font-weight:700;cursor:pointer;font-family:inherit">✅ Listening yakunlash</button>`;
}

function genListenExs(unit) {
    const w = unit.words;
    return [
        { text: `Today we are talking about ${unit.title.toLowerCase()}. The word "${w[0]}" is very important in English.`, q: `What is the text mainly about?`, opts: [unit.title, 'Sports', 'Cooking', 'Travel'], c: 0, tip: `"Today we are talking about..."` },
        { text: `Hello! My name is Emma. Today I will teach you about ${w[0]} and ${w[1] || w[0]}. First, let us look at "${w[0]}". Are you ready?`, q: `What will Emma teach about first?`, opts: [`${w[2] || w[0]}`, `${w[0]}`, `${w[1] || w[0]}`, 'Everything at once'], c: 1, tip: `"First, let us look at..."` },
        { text: `${unit.title} is a fascinating topic. If you want to improve your English, you must practice every day. With practice it becomes easy.`, q: `What becomes easy with practice?`, opts: [`${w[0]}`, `${w[1] || w[0]}`, 'Everything', 'Nothing'], c: 2, tip: `"...with practice it becomes easy"` }
    ];
}

function renderLex(exs, idx) {
    const ex = exs[idx];
    if (!ex) return '<div style="text-align:center;padding:20px;color:#34d399">🎉 Barcha listening mashqlari tugadi!</div>';
    return `<div style="padding:16px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:12px">
      <div style="font-size:0.75rem;color:#a78bfa;margin-bottom:8px">Savol ${idx + 1}/${exs.length}</div>
      <div style="display:flex;gap:8px;margin-bottom:12px">
        <button onclick="window.playLex(${idx},'normal')" style="padding:8px 16px;border-radius:8px;background:rgba(96,165,250,0.1);border:1px solid rgba(96,165,250,0.2);color:#60a5fa;cursor:pointer;font-size:0.82rem;font-family:inherit">▶ Tinglash</button>
        <button onclick="window.playLex(${idx},'slow')" style="padding:8px 16px;border-radius:8px;background:rgba(167,139,250,0.1);border:1px solid rgba(167,139,250,0.2);color:#a78bfa;cursor:pointer;font-size:0.82rem;font-family:inherit">🐌 Sekin</button>
      </div>
      <div id="ltxt${idx}" style="display:none;padding:10px;background:rgba(255,255,255,0.04);border-radius:8px;font-size:0.82rem;color:#e8ecff;margin-bottom:10px;font-style:italic">${ex.text}</div>
      <div style="font-weight:600;margin-bottom:10px">${ex.q}</div>
      <div>${ex.opts.map((o, oi) => `<div class="lex-opt" data-qi="${idx}" data-oi="${oi}" onclick="window.selLex(this,${idx},${oi})" style="padding:10px 14px;border-radius:8px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);cursor:pointer;margin-bottom:6px;font-size:0.88rem;transition:all 0.2s">${String.fromCharCode(65 + oi)}. ${o}</div>`).join('')}</div>
      <div style="font-size:0.75rem;color:#666;margin-bottom:10px">💡 ${ex.tip}</div>
      <div style="display:flex;gap:6px">
        <button onclick="window.chkLex(${idx},${ex.c})" style="padding:7px 14px;border-radius:8px;background:rgba(52,211,153,0.1);border:1px solid rgba(52,211,153,0.3);color:#34d399;cursor:pointer;font-size:0.78rem;font-family:inherit">✓ Tekshir</button>
        ${idx + 1 < exs.length ? `<button onclick="window.nextLex(${idx + 1})" id="lexnxt${idx}" style="display:none;padding:7px 14px;border-radius:8px;background:rgba(96,165,250,0.1);border:1px solid rgba(96,165,250,0.2);color:#60a5fa;cursor:pointer;font-size:0.78rem;font-family:inherit">→ Keyingi</button>` : ''}
      </div>
      <div id="lexfb${idx}" style="margin-top:8px;font-size:0.8rem"></div>
    </div>`;
}

window.playLex = function (idx, speed) {
    const exs = window.__listenExs || []; if (!exs[idx]) return;
    const u = new SpeechSynthesisUtterance(exs[idx].text);
    u.lang = 'en-US'; u.rate = speed === 'slow' ? 0.55 : 0.82;
    speechSynthesis.cancel(); speechSynthesis.speak(u);
};
window.selLex = function (el, qi, oi) {
    document.querySelectorAll(`.lex-opt[data-qi="${qi}"]`).forEach(o => { o.style.background = 'rgba(255,255,255,0.04)'; o.style.borderColor = 'rgba(255,255,255,0.08)'; });
    el.style.background = 'rgba(91,124,250,0.15)'; el.style.borderColor = '#5b7cfa';
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
    const wd = WDB.find(x => x.e === unit.words[0]);
    dictSent = wd ? wd.ex : `The ${unit.words[0]} is very important.`;
    const u2 = new SpeechSynthesisUtterance(dictSent);
    u2.lang = 'en-US'; u2.rate = speed === 'slow' ? 0.5 : 0.82;
    speechSynthesis.cancel(); speechSynthesis.speak(u2);
};
window.chkDict = function () {
    const inp = $id('dictIn'); const fb = $id('dictFB');
    if (!inp || !fb || !dictSent) { if (fb) fb.innerHTML = '<span style="color:#f5c842">⚠️ Avval audio tinglang!</span>'; return; }
    const cw = dictSent.toLowerCase().replace(/[.,!?]/g, '').split(' ');
    const uw = inp.value.trim().toLowerCase().replace(/[.,!?]/g, '').split(' ');
    let mc = 0;
    const hl = cw.map(w => {
        if (uw.includes(w)) { mc++; return `<span style="color:#34d399;font-weight:600">${w}</span>`; }
        return `<span style="color:#ef4444">${w}</span>`;
    }).join(' ');
    const pct = Math.round((mc / cw.length) * 100);
    fb.innerHTML = `<div><strong>To'g'ri:</strong> ${hl}</div><div style="margin-top:6px"><strong>Siz:</strong> ${inp.value}</div><div style="font-size:0.9rem;font-weight:700;margin-top:6px;color:${pct >= 70 ? '#34d399' : '#ef4444'}">${pct}%</div>`;
    if (pct >= 70) { lScore++; awardXP(20, 'listening'); }
    lTotal++;
};
window.aiChkDict = async function () {
    const ok = await spendTokens(TOKEN_CONFIG.ai_cost, 'AI diktant tahlil'); if (!ok) return;
    const inp = $id('dictIn'); const fb = $id('dictFB');
    if (!inp?.value.trim()) { if (fb) fb.innerHTML = '<span style="color:#f5c842">Avval yozing!</span>'; return; }
    fb.innerHTML = '🤖 AI tahlil qilmoqda...';
    const r = await callAI(`Diktant tahlili O'zbek tilida:\nAsl: "${dictSent}"\nO'quvchi: "${inp.value.trim()}"\n1) Xatolari 2) Ball: /10 3) Maslahat`, 600);
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
        <div style="font-weight:700;font-size:1rem;margin-bottom:10px;color:#e8ecff">${unit.title}</div>
        <div id="rdbody" style="font-size:0.88rem;line-height:1.7;color:#c7d2fe">${unit.reading_text || ''}</div>
        <div style="display:flex;gap:6px;margin-top:12px">
          <button onclick="window.rdAloud()" style="padding:7px 14px;border-radius:8px;background:rgba(96,165,250,0.1);border:1px solid rgba(96,165,250,0.2);color:#60a5fa;cursor:pointer;font-size:0.78rem;font-family:inherit">🔊 Tinglash</button>
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
        const d = WDB.find(x => x.e === w) || { u: w };
        return `<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
          <span style="color:#a78bfa;font-size:0.85rem;min-width:80px">${d.u}</span>
          <input id="whi${i}" data-ans="${w}" placeholder="inglizcha..." style="flex:1;padding:8px 12px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:8px;color:#e8ecff;font-family:inherit">
          <button onclick="window.chkWH(${i})" style="padding:7px 12px;border-radius:8px;background:rgba(52,211,153,0.1);border:1px solid rgba(52,211,153,0.3);color:#34d399;cursor:pointer;font-size:0.78rem;font-family:inherit">✓</button>
          <button onclick="window.spk('${w.replace(/'/g, "\\'")}',event)" style="padding:7px 12px;border-radius:8px;background:rgba(96,165,250,0.1);border:1px solid rgba(96,165,250,0.2);color:#60a5fa;cursor:pointer;font-size:0.78rem;font-family:inherit">🔊</button>
          <span id="whfb${i}" style="font-size:0.8rem;min-width:30px"></span>
        </div>`;
    }).join('')}
    </div>
    <button onclick="window.finLessonC('${unit.id}')" style="width:100%;padding:14px;border-radius:12px;background:linear-gradient(135deg,#34d399,#22d3ee);border:none;color:#fff;font-size:0.95rem;font-weight:700;cursor:pointer;font-family:inherit">✅ Reading yakunlash</button>`;
}

window.rdAloud = function () {
    const b = $id('rdbody'); if (!b) return;
    const u = new SpeechSynthesisUtterance(b.textContent);
    u.lang = 'en-US'; u.rate = 0.82;
    speechSynthesis.cancel(); speechSynthesis.speak(u);
};
window.selRQ = function (el, qi, oi) {
    document.querySelectorAll(`.rq-opt[data-qi="${qi}"]`).forEach(o => { o.style.background = 'rgba(255,255,255,0.04)'; o.style.borderColor = 'rgba(255,255,255,0.08)'; });
    el.style.background = 'rgba(91,124,250,0.15)'; el.style.borderColor = '#5b7cfa';
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
    if (inp.value.trim().toLowerCase() === inp.dataset.ans.toLowerCase()) {
        fb.innerHTML = '✅'; inp.style.borderColor = '#34d399'; awardXP(8, 'writing');
    } else { fb.innerHTML = '❌'; inp.style.borderColor = '#ef4444'; }
};
window.finLessonC = async function (uid) { await finLesson(uid, 'C', 'reading', lScore, lTotal || 6); };

// ─── LESSON D ───
function lessonD(unit) {
    const topics = unit.words.slice(0, 3);
    const woSent = (WDB.find(x => x.e === unit.words[0])?.ex) || `I use ${unit.words[0]} every day.`;
    window.__woCorrect = woSent;
    return `
    <div style="margin-bottom:20px">
      <h3 style="margin-bottom:12px;color:#e8ecff">🎤 Speaking Mashqi</h3>
      ${topics.map((w, i) => {
        const d = WDB.find(x => x.e === w) || { u: '', ex: '' };
        return `<div style="margin-bottom:14px;padding:14px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:12px">
          <div style="font-weight:600;margin-bottom:4px">${i + 1}. "${w}" so'zini ishlatib gaping:</div>
          <div style="font-size:0.78rem;color:#666;margin-bottom:10px">O'zbek: ${d.u} · Misol: ${d.ex}</div>
          <div style="display:flex;gap:6px;margin-bottom:8px">
            <button id="mbtn${i}" onclick="window.togMic(${i})" style="padding:8px 16px;border-radius:8px;background:rgba(244,114,182,0.1);border:1px solid rgba(244,114,182,0.25);color:#f472b6;cursor:pointer;font-size:0.82rem;font-family:inherit">🎤 Gapirish</button>
            <button onclick="window.spk('${w.replace(/'/g, "\\'")}',event)" style="padding:8px 12px;border-radius:8px;background:rgba(96,165,250,0.1);border:1px solid rgba(96,165,250,0.2);color:#60a5fa;cursor:pointer;font-size:0.82rem;font-family:inherit">🔊</button>
          </div>
          <div id="mst${i}" style="font-size:0.75rem;color:#666"></div>
          <div id="mtr${i}" style="padding:8px;font-size:0.88rem;color:#c4b5fd;min-height:24px;border-radius:6px"></div>
          <div style="display:flex;gap:6px;margin-top:8px">
            <button onclick="window.aiSpk(${i},'${w}')" style="padding:6px 14px;border-radius:8px;background:rgba(167,139,250,0.1);border:1px solid rgba(167,139,250,0.25);color:#a78bfa;cursor:pointer;font-size:0.78rem;font-family:inherit">🤖 AI baholash (1 token)</button>
            <button onclick="window.markDone(${i})" style="padding:6px 14px;border-radius:8px;background:rgba(52,211,153,0.1);border:1px solid rgba(52,211,153,0.3);color:#34d399;cursor:pointer;font-size:0.78rem;font-family:inherit">✅ Bajarildi</button>
          </div>
          <div id="sfb${i}" style="margin-top:8px;font-size:0.82rem"></div>
        </div>`;
    }).join('')}
    </div>
    <div style="margin-bottom:20px">
      <h3 style="margin-bottom:12px;color:#e8ecff">✍️ Writing Mashqi</h3>
      <div style="padding:14px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:12px">
        <div style="font-size:0.85rem;color:#aaa;margin-bottom:8px">Mavzu: "${unit.title}" haqida 40+ so'zli matn yozing.</div>
        <textarea id="dta" placeholder="Bu yerda yozing..." oninput="window.updWC()" style="width:100%;height:100px;padding:10px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:8px;color:#e8ecff;font-family:inherit;resize:none;box-sizing:border-box"></textarea>
        <div style="display:flex;gap:10px;font-size:0.75rem;color:#666;margin:6px 0"><span id="dwc">0 so'z</span><span id="dcc">0 belgi</span><span id="dst" style="color:#f87171">Min 40 so'z</span></div>
        <div style="display:flex;gap:6px">
          <button onclick="window.aiWrit('${unit.title}','${unit.words.slice(0, 5).join(',')}')" style="padding:7px 14px;border-radius:8px;background:rgba(167,139,250,0.1);border:1px solid rgba(167,139,250,0.25);color:#a78bfa;cursor:pointer;font-size:0.78rem;font-family:inherit">🤖 AI (1 token)</button>
          <button onclick="window.selfChk(40)" style="padding:7px 14px;border-radius:8px;background:rgba(96,165,250,0.1);border:1px solid rgba(96,165,250,0.2);color:#60a5fa;cursor:pointer;font-size:0.78rem;font-family:inherit">📊 So'z soni</button>
        </div>
        <div id="wfb" style="margin-top:8px;font-size:0.8rem"></div>
      </div>
    </div>
    <div style="margin-bottom:20px">
      <h3 style="margin-bottom:12px;color:#e8ecff">🔀 So'z Tartibi</h3>
      <div id="woChips" style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px">
        ${shuffle(woSent.split(' ')).map(w => `<div class="wo-chip" data-w="${w}" onclick="window.selChip(this)">${w}</div>`).join('')}
      </div>
      <div id="woAnsDiv" style="min-height:40px;padding:10px;background:rgba(255,255,255,0.03);border:1px dashed rgba(255,255,255,0.1);border-radius:8px;display:flex;flex-wrap:wrap;gap:6px;font-size:0.88rem;color:#666;margin-bottom:8px"><span>Bu yerga bosing...</span></div>
      <div style="display:flex;gap:6px">
        <button onclick="window.chkWO()" style="padding:7px 14px;border-radius:8px;background:rgba(52,211,153,0.1);border:1px solid rgba(52,211,153,0.3);color:#34d399;cursor:pointer;font-size:0.78rem;font-family:inherit">✓ Tekshir</button>
        <button onclick="window.rstWO()" style="padding:7px 14px;border-radius:8px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);color:#e8ecff;cursor:pointer;font-size:0.78rem;font-family:inherit">🔄 Qayta</button>
        <button onclick="window.spk('${woSent.replace(/'/g, "\\'")}',event)" style="padding:7px 14px;border-radius:8px;background:rgba(96,165,250,0.1);border:1px solid rgba(96,165,250,0.2);color:#60a5fa;cursor:pointer;font-size:0.78rem;font-family:inherit">🔊</button>
      </div>
      <div id="wofb" style="margin-top:8px;font-size:0.8rem"></div>
    </div>
    <button onclick="window.finLessonD('${unit.id}')" style="width:100%;padding:14px;border-radius:12px;background:linear-gradient(135deg,#f472b6,#a78bfa);border:none;color:#fff;font-size:0.95rem;font-weight:700;cursor:pointer;font-family:inherit">✅ Speaking & Writing yakunlash</button>`;
}

window.selChip = function (el) {
    if (el.classList.contains('used')) return;
    el.classList.add('used'); el.style.opacity = '0.3';
    woAns.push(el.dataset.w);
    const d = $id('woAnsDiv');
    if (d) d.innerHTML = woAns.map((w, i) => `<span onclick="window.rmChip(${i})" style="background:rgba(91,124,250,0.15);border:1px solid rgba(91,124,250,0.3);border-radius:20px;padding:6px 12px;cursor:pointer;font-size:0.85rem">${w}</span>`).join('') || '<span style="color:#666">Bu yerga bosing...</span>';
};
window.rmChip = function (idx) {
    const w = woAns[idx]; woAns.splice(idx, 1);
    document.querySelectorAll('.wo-chip').forEach(c => { if (c.dataset.w === w && c.classList.contains('used')) { c.classList.remove('used'); c.style.opacity = '1'; return; } });
    const d = $id('woAnsDiv');
    if (d) d.innerHTML = woAns.map((w, i) => `<span onclick="window.rmChip(${i})" style="background:rgba(91,124,250,0.15);border:1px solid rgba(91,124,250,0.3);border-radius:20px;padding:6px 12px;cursor:pointer;font-size:0.85rem">${w}</span>`).join('') || '<span style="color:#666">Bu yerga bosing...</span>';
};
window.rstWO = function () {
    woAns = [];
    document.querySelectorAll('.wo-chip').forEach(c => { c.classList.remove('used'); c.style.opacity = '1'; });
    const d = $id('woAnsDiv'); if (d) d.innerHTML = '<span style="color:#666">Bu yerga bosing...</span>';
};
window.chkWO = function () {
    const fb = $id('wofb');
    if (!woAns.length) { if (fb) fb.innerHTML = '<span style="color:#f5c842">⚠️ So\'zlarni tartibga qo\'ying!</span>'; return; }
    if (woAns.join(' ').toLowerCase() === (window.__woCorrect || '').toLowerCase()) {
        if (fb) fb.innerHTML = '<span style="color:#34d399">🏆 Mukammal!</span>';
        awardXP(15, 'writing'); lScore++;
    } else { if (fb) fb.innerHTML = `<span style="color:#ef4444">❌ To'g'ri: <em>${window.__woCorrect}</em></span>`; }
    lTotal++;
};
window.togMic = function (idx) {
    const btn = $id(`mbtn${idx}`); const st = $id(`mst${idx}`); const tr = $id(`mtr${idx}`);
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
        if (tr) tr.innerHTML = `<textarea style="width:100%;padding:8px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:8px;color:#e8ecff;font-family:inherit" id="man${idx}" placeholder="Yozing..."></textarea>`;
        if (st) st.textContent = '⌨️ Yozma kiritish'; return;
    }
    if (lessonMics[idx]) { try { lessonMics[idx].stop(); } catch (e) { } lessonMics[idx] = null; if (btn) btn.innerHTML = '🎤 Gapirish'; return; }
    const rec = new SR(); rec.lang = 'en-US'; rec.continuous = true; rec.interimResults = true;
    rec.onresult = e => { let t = ''; for (let i = e.resultIndex; i < e.results.length; i++) t += e.results[i][0].transcript; if (tr && tr.tagName !== 'TEXTAREA') tr.textContent = t; };
    rec.onerror = e => {
        if (btn) btn.innerHTML = '🎤 Gapirish'; lessonMics[idx] = null;
        if (e.error === 'not-allowed' && tr) tr.innerHTML = `<textarea style="width:100%;padding:8px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:8px;color:#e8ecff;font-family:inherit" id="man${idx}" placeholder="Yozing..."></textarea>`;
    };
    rec.onend = () => { if (btn) btn.innerHTML = '🎤 Gapirish'; if (st) st.innerHTML = '✅ Yozib olindi'; lessonMics[idx] = null; };
    try {
        rec.start(); lessonMics[idx] = rec;
        if (btn) btn.innerHTML = '⏹ To\'xtatish';
        if (st) st.innerHTML = '🔴 Yozmoqda...';
    } catch (e) {
        if (tr) tr.innerHTML = `<textarea style="width:100%;padding:8px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:8px;color:#e8ecff;font-family:inherit" id="man${idx}" placeholder="Yozing..."></textarea>`;
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
    const r = await callAI(`Speaking baholash. Mavzu: "${topic}". O'quvchi: "${text}".\nO'zbek tilida: 1) ✅ Yaxshi tomonlar 2) ❌ Xatoliklar 3) 🔄 Tuzatilgan variant 4) ⭐ /10`, 700);
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
    if (st) { st.textContent = w >= 40 ? '✅ Yetarli' : `Min 40 (${w}/40)`; st.style.color = w >= 40 ? '#34d399' : '#f87171'; }
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
    const r = await callAI(`Writing tekshirish. Mavzu: "${title}" (so'zlar: ${words}).\nMatn: "${ta.value.trim()}"\nO'zbek tilida: 1) Grammatika 2) Uslub 3) Tuzatilgan variant 4) IELTS bali: /9`, 800);
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

// FIX #5: allDone check — set progress first, then check all 4 lessons
async function saveLessonCompletion(unitId, lessonKey, score, total, xpEarned, coinEarned) {
    const pct = total > 0 ? Math.round((score / total) * 100) : 70;

    // Set current lesson as done BEFORE checking allDone
    UProg[`${unitId}_${lessonKey}`] = 100;

    // Now check if ALL 4 lessons are done
    const allDone = ['A', 'B', 'C', 'D'].every(l => UProg[`${unitId}_${l}`] >= 100);

    if (!CU) {
        UXP += xpEarned;
        UCoin += coinEarned;
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
        <div style="padding:12px 20px;border-radius:12px;background:rgba(167,139,250,0.1);border:1px solid rgba(167,139,250,0.2)"><div style="font-size:0.7rem;color:#666">XP</div><div style="font-weight:700;color:#a78bfa">+${xp}</div></div>
        <div style="padding:12px 20px;border-radius:12px;background:rgba(245,200,66,0.1);border:1px solid rgba(245,200,66,0.2)"><div style="font-size:0.7rem;color:#666">Coin</div><div style="font-weight:700;color:#f5c842">+${coin}</div></div>
      </div>
      <div style="font-size:1.2rem;margin-bottom:20px">${pct >= 80 ? '🏆 Mukammal!' : pct >= 60 ? '✅ Yaxshi!' : '💪 Qayta urining!'}</div>
      <div style="display:flex;flex-direction:column;gap:8px">
        ${nxt[lk] ? `<button onclick="window.openLesson('${uid}','${nxt[lk]}')" style="padding:12px;border-radius:12px;background:linear-gradient(135deg,#5b7cfa,#a78bfa);border:none;color:#fff;font-size:0.9rem;font-weight:700;cursor:pointer;font-family:inherit">→ Keyingi: ${lnames[nxt[lk]]}</button>` : `<div style="padding:14px;border-radius:12px;background:rgba(52,211,153,0.1);border:1px solid rgba(52,211,153,0.25);color:#34d399;font-weight:700">🎉 Unit to'liq bajarildi!</div>`}
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
          <button onclick="window.spk('${w.e.replace(/'/g, "\\'")}',event)" style="background:none;border:none;cursor:pointer;font-size:1rem">🔊</button>
        </div>
        <div style="font-size:0.82rem;color:#a78bfa;margin-bottom:6px">${w.u}</div>
        <div style="display:flex;gap:6px;font-size:0.68rem">
          <span style="background:rgba(255,255,255,0.05);padding:2px 8px;border-radius:8px;color:#666">${w.t}</span>
          <span style="background:rgba(255,255,255,0.05);padding:2px 8px;border-radius:8px;color:#666">${w.l}</span>
        </div>`;
        card.onmouseover = () => { card.style.background = 'rgba(167,139,250,0.08)'; card.style.borderColor = 'rgba(167,139,250,0.25)'; };
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
      <div style="font-size:2.5rem;font-weight:800;color:#e8ecff;margin-bottom:8px">${w.e}</div>
      <div style="font-size:1.1rem;color:#a78bfa;margin-bottom:12px">${w.u}</div>
      <div style="font-size:0.82rem;color:#666;margin:0 0 4px;font-style:italic">${w.t}</div>
      <div style="padding:12px;background:rgba(255,255,255,0.04);border-radius:10px;margin-bottom:16px;font-size:0.85rem;color:#c7d2fe;font-style:italic">"${w.ex}"</div>
      <div style="color:#a78bfa;font-size:0.82rem;margin-bottom:16px">${w.eu}</div>
      <div style="display:flex;gap:8px;justify-content:center">
        <button onclick="window.spk('${w.e.replace(/'/g, "\\'")}',event)" style="padding:8px 20px;border-radius:10px;background:rgba(91,124,250,0.15);border:1px solid rgba(91,124,250,0.3);color:#93c5fd;cursor:pointer;font-family:inherit">🔊 Talaffuz</button>
        <button onclick="window.aiExWord('${w.e.replace(/'/g, "\\'")}',event)" style="padding:8px 20px;border-radius:10px;background:rgba(167,139,250,0.1);border:1px solid rgba(167,139,250,0.25);color:#a78bfa;cursor:pointer;font-family:inherit">🤖 AI (1 token)</button>
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
    document.querySelectorAll('.practice-tabs .ptab').forEach(b => b.classList.remove('active'));
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
    const fw = $id('flashWord'); if (fw) fw.textContent = w.e;
    const fu = $id('flashUz'); if (fu) fu.textContent = w.u;
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
    const type = Math.random() > 0.5 ? 'en2uz' : 'uz2en';
    const qEl = $id('quizQ'); if (qEl) qEl.textContent = type === 'en2uz' ? `"${curQuizWord.e}" = ?` : `"${curQuizWord.u}" = ?`;
    const optsEl = $id('quizOptions');
    if (optsEl) optsEl.innerHTML = opts.map(o => `<button class="quiz-opt" onclick="window.checkQuizOpt(this,'${o.e.replace(/'/g, "\\'")}','${type}')" style="width:100%;margin-bottom:8px;padding:12px;border-radius:10px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);color:#e8ecff;cursor:pointer;text-align:left;font-family:inherit;font-size:0.9rem;transition:all 0.2s">${type === 'en2uz' ? o.u : o.e}</button>`).join('');
    const fb = $id('quizFeedback'); if (fb) fb.innerHTML = '';
}
window.checkQuizOpt = function (btn, chosen, type) {
    if (quizAnswered) return; quizAnswered = true;
    document.querySelectorAll('.quiz-opt').forEach(b => {
        const bVal = b.textContent.trim();
        if (type === 'en2uz' ? bVal === curQuizWord.u : bVal === curQuizWord.e) { b.style.background = 'rgba(52,211,153,0.2)'; b.style.borderColor = '#34d399'; }
        else if (b === btn) { b.style.background = 'rgba(239,68,68,0.2)'; b.style.borderColor = '#ef4444'; }
    });
    const fb = $id('quizFeedback');
    if (chosen === curQuizWord.e) { quizScore++; const el = $id('quizScore'); if (el) el.textContent = quizScore; awardXP(10, 'grammar'); if (fb) fb.innerHTML = '<span style="color:#34d399">✅ To\'g\'ri!</span>'; }
    else { if (fb) fb.innerHTML = `<span style="color:#ef4444">❌ To'g'ri: ${type === 'en2uz' ? curQuizWord.u : curQuizWord.e}</span>`; }
    window.speakWord(curQuizWord.e);
};
window.nextQuiz = function () { showQuizWord(); };

// ── Match ──
function initMatch() {
    const pool = shuffle([...WDB]).slice(0, 5);
    matchPairs = pool; matchMatched = []; matchSel1 = null;
    const items = shuffle([...pool.map(w => ({ id: w.e, text: w.e, type: 'en' })), ...pool.map(w => ({ id: w.e, text: w.u, type: 'uz' }))]);
    const grid = $id('matchGrid');
    if (grid) grid.innerHTML = items.map(item => `<div class="match-item" data-id="${item.id}" data-type="${item.type}" onclick="window.selectMatch2(this)" style="padding:12px;border-radius:10px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);color:#e8ecff;cursor:pointer;font-family:inherit;transition:all 0.2s;font-size:0.88rem">${item.text}</div>`).join('');
    const fb = $id('matchFeedback'); if (fb) fb.innerHTML = '';
}
window.startMatch = initMatch;
window.selectMatch2 = function (el) {
    if (el.classList.contains('matched')) return;
    if (!matchSel1) {
        matchSel1 = el; el.style.background = 'rgba(91,124,250,0.2)'; el.style.borderColor = '#5b7cfa';
    } else {
        if (matchSel1 === el) { el.style.background = 'rgba(255,255,255,0.04)'; el.style.borderColor = 'rgba(255,255,255,0.1)'; matchSel1 = null; return; }
        if (matchSel1.dataset.type === el.dataset.type) {
            matchSel1.style.background = 'rgba(255,255,255,0.04)'; matchSel1.style.borderColor = 'rgba(255,255,255,0.1)';
            matchSel1 = el; el.style.background = 'rgba(91,124,250,0.2)'; el.style.borderColor = '#5b7cfa'; return;
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
    const tw = $id('typingWord'); if (tw) tw.textContent = w.e;
    const th = $id('typingHint'); if (th) th.textContent = "O'zbek: " + w.u;
    const ti = $id('typingInput'); if (ti) { ti.value = ''; ti.style.borderColor = ''; }
    const tf = $id('typingFeedback'); if (tf) tf.innerHTML = '';
}
window.checkTyping = function () {
    const w = typingDeck[typingIdx % typingDeck.length];
    const val = $id('typingInput')?.value.trim().toLowerCase() || '';
    const fb = $id('typingFeedback'); const inp = $id('typingInput');
    if (val === w.e.toLowerCase()) {
        if (fb) fb.innerHTML = '<span style="color:#34d399">✅ To\'g\'ri!</span>';
        if (inp) inp.style.borderColor = '#34d399';
        awardXP(8, 'grammar'); setTimeout(() => { typingIdx++; showTypingWord(); }, 800);
    } else if (val.length >= w.e.length) {
        if (fb) fb.innerHTML = `<span style="color:#ef4444">❌ To'g'ri: ${w.e}</span>`;
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
        if (fb) fb.innerHTML = `<div style="color:#ef4444;padding:10px;border-radius:10px;background:rgba(239,68,68,0.1)">❌ Noto'g'ri. To'g'ri javob: <b>${ans}</b>. ${exp}</div>`;
    }
};
window.nextGrammarEx = function () { curGrammarIdx++; showGrammarQ(); };

// ══════════════════════════════════════════════════════════════
// AI CHAT
// ══════════════════════════════════════════════════════════════
const CHAT_MODES = {
    free: { label: 'Erkin suhbat', sys: 'You are a friendly English language learning assistant for Uzbek speakers. Chat naturally in English and Uzbek, helping the user practice English. Keep responses concise (2-4 sentences). If the user writes in Uzbek, respond in both Uzbek and English.' },
    teacher: { label: "O'qituvchi", sys: "You are an English teacher for Uzbek-speaking students. Explain grammar rules clearly in simple Uzbek or English, give examples, and encourage the student. Be patient and educational. Keep responses focused and clear." },
    grammar: { label: 'Grammatika', sys: "You are an English grammar checker for Uzbek learners. When the user sends text, identify all grammar errors, explain each error in simple Uzbek, show the corrected version, and give a rule explanation. Format: '❌ Xato → ✅ To'g'ri: ... 📚 Qoida: ...'" },
    translate: { label: 'Tarjimon', sys: 'You are a professional English-Uzbek translator. Translate accurately and naturally. Also explain any idioms or expressions. When translating English→Uzbek or Uzbek→English, show both versions clearly.' },
    ielts: { label: 'IELTS', sys: 'You are an IELTS preparation coach for Uzbek students. Help with reading, writing, listening, and speaking tasks. Provide feedback on answers, suggest improvements, and explain band score criteria. Be encouraging and precise.' }
};

let curChatMode = CHAT_MODES.free;

window.setChatMode = function (mode, el) {
    document.querySelectorAll('.chat-mode-btn').forEach(b => b.classList.remove('active'));
    if (el) el.classList.add('active');
    chatMode = mode;
    curChatMode = CHAT_MODES[mode] || CHAT_MODES.free;
    appendChat('assistant', `Rejim: <b>${curChatMode.label}</b>. ${mode === 'free' ? 'Erkin suhbatlashaylik!' :
        mode === 'teacher' ? "Nima o'rganmoqchisiz?" :
            mode === 'grammar' ? 'Matn yuboring — grammatikani tekshiraman!' :
                mode === 'translate' ? 'Nima tarjima qilaylik?' :
                    'IELTS savolingizni yuboring!'}`, false);
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
    appendChat('assistant', '<span class="typing">Yozmoqda...</span>', false, typingId);
    const sendBtn = $id('chatSendBtn'); if (sendBtn) sendBtn.disabled = true;
    try {
        const resp = await fetch(AI_PROXY, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [
                    { role: 'user', parts: [{ text: curChatMode.sys }] },
                    ...chatHist.slice(-10)
                ],
                generationConfig: {
                    temperature: 0.8,
                    maxOutputTokens: UP === 'ultimate' ? 2000 : UP === 'premium' ? 1500 : 1000
                }
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
      <div class="chat-bubble">${html}</div>`;
    c.appendChild(div);
    c.scrollTop = c.scrollHeight;
}

window.clearChatHistory = async function () {
    if (!confirm('Chat tarixini tozalashni istaysizmi?')) return;
    chatHist = [];
    const c = $id('chatMessages');
    if (c) c.innerHTML = `<div class="chat-msg ai-msg"><div class="chat-avatar"><i class="fa-solid fa-robot"></i></div><div class="chat-bubble">Salom! Chat tarixi tozalandi. Yangi suhbatni boshlaylik! 😊</div></div>`;
    showToast('Chat tarixi tozalandi', 'success');
};

// ══════════════════════════════════════════════════════════════
// MISC
// ══════════════════════════════════════════════════════════════
window.findYoutubeVideos = function () {
    const grid = $id('videosGrid'); if (!grid) return;
    const videos = [
        { title: 'English for Beginners — Full Course', channel: 'EnglishClass101', id: 'sTANio_2E0Q' },
        { title: 'Learn English in 30 Minutes', channel: 'English Addict', id: 'X_9m-4rXSmo' },
        { title: '500 English Phrases', channel: 'Linguamarina', id: 'X9_Vr0DKOSM' },
        { title: 'IELTS Speaking — Band 9', channel: 'IELTS Advantage', id: 'x8D_SLFliAI' },
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