// =====================================================// German.js — LinguaVerse Deutsch (FIXED VERSION)
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
    apiKey: "AIzaSyDgVpIEd4Ojm4PEQHOme5yWp87P_xSb6E8",
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

const AI_PROXY = "https://gentle-hat-d9fa.akromovbehruz7.workers.dev";

// ══════════════════════════════════════════════════════════════
// TOKEN CONFIG
// ══════════════════════════════════════════════════════════════
const TOKEN_CONFIG = {
    default_tokens: 1000,
    reset_hours: 5,
    ai_cost: 1,
    unit_cost: 2,
};

const PLANS = {
    free: { name: "Free", icon: "🆓", token_bonus: 1000, token_reset_mult: 1, xp_mult: 1, coin_mult: 1 },
    pro: { name: "Pro", icon: "⭐", token_bonus: 3000, token_reset_mult: 2, xp_mult: 1.5, coin_mult: 1.3 },
    premium: { name: "Premium", icon: "💎", token_bonus: 8000, token_reset_mult: 3, xp_mult: 2, coin_mult: 1.8 },
    ultimate: { name: "Ultimate", icon: "🚀", token_bonus: 999999, token_reset_mult: 999, xp_mult: 3, coin_mult: 2.5 },
};

const RANKS = {
    none: { name: "Oddiy", icon: "⬜", color: "#888", token_bonus: 0, xp_mult: 1, coin_mult: 1 },
    silver: { name: "Silber", icon: "🥈", color: "#C0C0C0", token_bonus: 200, xp_mult: 1.3, coin_mult: 1.2 },
    gold: { name: "Gold", icon: "🥇", color: "#FFD700", token_bonus: 500, xp_mult: 1.8, coin_mult: 1.5 },
    diamond: { name: "Diamant", icon: "💎", color: "#B9F2FF", token_bonus: 1000, xp_mult: 2.5, coin_mult: 2 },
};

const PLAN_COLORS = { free: "#94a3b8", pro: "#d4a843", premium: "#e8c56a", ultimate: "#fbbf24" };
const PLAN_LABELS = { free: "Free", pro: "Pro", premium: "Premium", ultimate: "Ultimate" };

// ══════════════════════════════════════════════════════════════
// STATE
// ══════════════════════════════════════════════════════════════
let CU = null, UP = 'free', URank = 'none';
let UTokens = 1000, UMaxTokens = 1000, ULastReset = 0;
let UXP = 0, UCoin = 0;
let UProg = {};
let USk = { lesen: 0, schreiben: 0, sprechen: 0, hoeren: 0, grammatik: 0 };
let UStats = { unitsCompleted: 0, totalSessions: 0, streak: 0 };

let chatHist = [], chatMode = 'free';
let curLevel = 'beginner';
let curUnit = null, curLesson = null;
let lScore = 0, lTotal = 0;
let lexSel = {}, rSel = {}, woAns = [], lessonMics = {};
let mSel = { e: null, u: null, eEl: null, uEl: null };

let flashDeck = [], flashIdx = 0, flashCorrect = 0, flashWrong = 0;
let matchPairs = [], matchMatched = [], matchSel1 = null;
let typingDeck = [], typingIdx = 0;
let grammarScore2 = 0, grammarAnswered = false, curGrammarIdx = 0;

let wOff = 0, wFilt = 'all', wSrch = '';
let dictSent = '';

// ══════════════════════════════════════════════════════════════
// WÖRTERBUCH (500+ Wörter)
// ══════════════════════════════════════════════════════════════
const WDB = [
    // A1 BEGINNER
    { de: 'Hallo', u: "Salom", t: 'Interjektion', l: 'beginner', ex: "Hallo, wie geht es dir?", eu: "Salom, qandaysan?" },
    { de: 'Tschüss', u: "Xayr", t: 'Interjektion', l: 'beginner', ex: "Tschüss, bis morgen!", eu: "Xayr, ertaga ko'rishamiz!" },
    { de: 'Danke', u: "Rahmat", t: 'Interjektion', l: 'beginner', ex: "Danke für deine Hilfe.", eu: "Yordaming uchun rahmat." },
    { de: 'Bitte', u: "Iltimos / Marhamat", t: 'Adverb', l: 'beginner', ex: "Kannst du mir bitte helfen?", eu: "Iltimos, menga yordam bera olasanmi?" },
    { de: 'Entschuldigung', u: "Kechirasiz", t: 'Interjektion', l: 'beginner', ex: "Entschuldigung, wo ist der Bahnhof?", eu: "Kechirasiz, vokzal qayerda?" },
    { de: 'Ja', u: "Ha", t: 'Interjektion', l: 'beginner', ex: "Ja, ich bin einverstanden.", eu: "Ha, men roziman." },
    { de: 'Nein', u: "Yo'q", t: 'Interjektion', l: 'beginner', ex: "Nein, das stimmt nicht.", eu: "Yo'q, bu to'g'ri emas." },
    { de: 'gut', u: "Yaxshi", t: 'Adjektiv', l: 'beginner', ex: "Guten Morgen, alle!", eu: "Hammaga xayrli tong!" },
    { de: 'schlecht', u: "Yomon", t: 'Adjektiv', l: 'beginner', ex: "Das Wetter ist heute schlecht.", eu: "Bugun ob-havo yomon." },
    { de: 'groß', u: "Katta", t: 'Adjektiv', l: 'beginner', ex: "Das ist ein großes Haus.", eu: "Bu katta uy." },
    { de: 'klein', u: "Kichik", t: 'Adjektiv', l: 'beginner', ex: "Ich habe einen kleinen Hund.", eu: "Menda kichik it bor." },
    { de: 'schön', u: "Chiroyli / Go'zal", t: 'Adjektiv', l: 'beginner', ex: "Was für ein schöner Tag!", eu: "Qanday chiroyli kun!" },
    { de: 'heiß', u: "Issiq", t: 'Adjektiv', l: 'beginner', ex: "Draußen ist es sehr heiß.", eu: "Tashqarida juda issiq." },
    { de: 'kalt', u: "Sovuq", t: 'Adjektiv', l: 'beginner', ex: "Das Wasser ist kalt.", eu: "Suv sovuq." },
    { de: 'rot', u: "Qizil", t: 'Adjektiv', l: 'beginner', ex: "Ich mag rote Äpfel.", eu: "Men qizil olmalarni yaxshi ko'raman." },
    { de: 'blau', u: "Ko'k", t: 'Adjektiv', l: 'beginner', ex: "Der Himmel ist blau.", eu: "Osmon ko'k." },
    { de: 'grün', u: "Yashil", t: 'Adjektiv', l: 'beginner', ex: "Das Gras ist grün.", eu: "O't yashil." },
    { de: 'gelb', u: "Sariq", t: 'Adjektiv', l: 'beginner', ex: "Die Sonne ist gelb.", eu: "Quyosh sariq." },
    { de: 'schwarz', u: "Qora", t: 'Adjektiv', l: 'beginner', ex: "Meine Katze ist schwarz.", eu: "Mening mushugim qora." },
    { de: 'weiß', u: "Oq", t: 'Adjektiv', l: 'beginner', ex: "Schnee ist weiß.", eu: "Qor oq." },
    { de: 'eins', u: "Bir", t: 'Zahl', l: 'beginner', ex: "Ich habe eine Schwester.", eu: "Menda bir singil bor." },
    { de: 'zwei', u: "Ikki", t: 'Zahl', l: 'beginner', ex: "Ich habe zwei Katzen.", eu: "Menda ikki mushuk bor." },
    { de: 'drei', u: "Uch", t: 'Zahl', l: 'beginner', ex: "Sie hat drei Bücher.", eu: "Uning uch kitobi bor." },
    { de: 'vier', u: "To'rt", t: 'Zahl', l: 'beginner', ex: "Es gibt vier Jahreszeiten.", eu: "To'rtta fasl bor." },
    { de: 'fünf', u: "Besh", t: 'Zahl', l: 'beginner', ex: "Ich habe fünf Finger.", eu: "Menda besh barmoq bor." },
    { de: 'die Mutter', u: "Ona", t: 'Nomen', l: 'beginner', ex: "Meine Mutter ist Lehrerin.", eu: "Onam o'qituvchi." },
    { de: 'der Vater', u: "Ota", t: 'Nomen', l: 'beginner', ex: "Mein Vater arbeitet hart.", eu: "Otam qattiq ishlaydi." },
    { de: 'die Schwester', u: "Singil / Opa", t: 'Nomen', l: 'beginner', ex: "Meine Schwester ist 10 Jahre alt.", eu: "Singlim 10 yoshda." },
    { de: 'der Bruder', u: "Aka / Uka", t: 'Nomen', l: 'beginner', ex: "Mein Bruder mag Fußball.", eu: "Akam futbolni yaxshi ko'radi." },
    { de: 'das Wasser', u: "Suv", t: 'Nomen', l: 'beginner', ex: "Bitte gib mir etwas Wasser.", eu: "Iltimos, menga suv bering." },
    { de: 'das Essen', u: "Ovqat", t: 'Nomen', l: 'beginner', ex: "Das Essen ist lecker.", eu: "Ovqat mazali." },
    { de: 'der Apfel', u: "Olma", t: 'Nomen', l: 'beginner', ex: "Ich esse jeden Tag einen Apfel.", eu: "Men har kuni olma yeyman." },
    { de: 'das Brot', u: "Non", t: 'Nomen', l: 'beginner', ex: "Sie bäckt frisches Brot.", eu: "U yangi non yopadi." },
    { de: 'die Schule', u: "Maktab", t: 'Nomen', l: 'beginner', ex: "Ich gehe jeden Tag in die Schule.", eu: "Men har kuni maktabga boraman." },
    { de: 'das Buch', u: "Kitob", t: 'Nomen', l: 'beginner', ex: "Das ist ein interessantes Buch.", eu: "Bu qiziqarli kitob." },
    { de: 'der Hund', u: "It", t: 'Nomen', l: 'beginner', ex: "Ich habe einen freundlichen Hund.", eu: "Menda mehribon it bor." },
    { de: 'die Katze', u: "Mushuk", t: 'Nomen', l: 'beginner', ex: "Die Katze schläft.", eu: "Mushuk uxlayapti." },
    { de: 'das Haus', u: "Uy", t: 'Nomen', l: 'beginner', ex: "Ich wohne in einem großen Haus.", eu: "Men katta uyda yashayman." },
    { de: 'das Auto', u: "Avtomobil", t: 'Nomen', l: 'beginner', ex: "Mein Vater hat ein rotes Auto.", eu: "Otamning qizil mashinasi bor." },
    { de: 'laufen', u: "Yugurmaq", t: 'Verb', l: 'beginner', ex: "Sie läuft jeden Morgen.", eu: "U har ertalab yuguradi." },
    { de: 'essen', u: "Yemoq", t: 'Verb', l: 'beginner', ex: "Wir essen um 7 Uhr zu Abend.", eu: "Biz soat 7 da kechki ovqat yeymiz." },
    { de: 'trinken', u: "Ichmoq", t: 'Verb', l: 'beginner', ex: "Er trinkt Kaffee.", eu: "U qahva ichadi." },
    { de: 'schlafen', u: "Uxlamoq", t: 'Verb', l: 'beginner', ex: "Kinder schlafen früh.", eu: "Bolalar erta uxlaydilar." },
    { de: 'lesen', u: "O'qimoq", t: 'Verb', l: 'beginner', ex: "Ich lese gerne Bücher.", eu: "Kitob o'qishni yaxshi ko'raman." },
    { de: 'schreiben', u: "Yozmoq", t: 'Verb', l: 'beginner', ex: "Bitte schreib deinen Namen.", eu: "Iltimos, ismingizni yozing." },
    { de: 'gehen', u: "Bormoq / Yurmoq", t: 'Verb', l: 'beginner', ex: "Ich gehe zur Schule.", eu: "Men maktabga boraman." },
    { de: 'sprechen', u: "Gapirmoq", t: 'Verb', l: 'beginner', ex: "Sie spricht gut Deutsch.", eu: "U nemischani yaxshi gapiradi." },
    { de: 'hören', u: "Eshitmoq", t: 'Verb', l: 'beginner', ex: "Bitte hör gut zu.", eu: "Iltimos, diqqat bilan eshiting." },
    { de: 'spielen', u: "O'ynamoq", t: 'Verb', l: 'beginner', ex: "Kinder lieben es zu spielen.", eu: "Bolalar o'ynashni yaxshi ko'rishadi." },
    { de: 'der Montag', u: "Dushanba", t: 'Nomen', l: 'beginner', ex: "Montag ist der erste Tag der Woche.", eu: "Dushanba haftaning birinchi kuni." },
    { de: 'der Dienstag', u: "Seshanba", t: 'Nomen', l: 'beginner', ex: "Am Dienstag habe ich Unterricht.", eu: "Seshanba kuni darsim bor." },
    { de: 'der Mittwoch', u: "Chorshanba", t: 'Nomen', l: 'beginner', ex: "Wir treffen uns jeden Mittwoch.", eu: "Biz har chorshanba uchrashAmiz." },
    { de: 'der Donnerstag', u: "Payshanba", t: 'Nomen', l: 'beginner', ex: "Donnerstag ist mein Lieblingstag.", eu: "Payshanba mening sevimli kunim." },
    { de: 'der Freitag', u: "Juma", t: 'Nomen', l: 'beginner', ex: "Freitags gehen wir früh.", eu: "Juma kuni biz erta tugatamiz." },
    { de: 'der Samstag', u: "Shanba", t: 'Nomen', l: 'beginner', ex: "Am Samstag ruhe ich mich aus.", eu: "Shanba kuni dam olaman." },
    { de: 'der Sonntag', u: "Yakshanba", t: 'Nomen', l: 'beginner', ex: "Sonntag ist ein freier Tag.", eu: "Yakshanba dam olish kuni." },
    { de: 'der Morgen', u: "Ertalab", t: 'Nomen', l: 'beginner', ex: "Jeden Morgen wache ich auf.", eu: "Men har ertalab uyg'onaman." },
    { de: 'der Abend', u: "Kechqurun", t: 'Nomen', l: 'beginner', ex: "Abends gehen wir spazieren.", eu: "Kechqurun sayrga chiqamiz." },
    { de: 'die Nacht', u: "Kecha", t: 'Nomen', l: 'beginner', ex: "Gute Nacht, schlaf gut.", eu: "Yaxshi kechalar, yaxshi uxlang." },
    { de: 'der Tag', u: "Kun", t: 'Nomen', l: 'beginner', ex: "Schönen Tag noch!", eu: "Yaxshi kun!" },
    { de: 'das Jahr', u: "Yil", t: 'Nomen', l: 'beginner', ex: "Dieses Jahr ist besonders.", eu: "Bu yil alohida." },
    { de: 'die Zeit', u: "Vaqt", t: 'Nomen', l: 'beginner', ex: "Wie viel Uhr ist es?", eu: "Soat necha bo'ldi?" },
    { de: 'der Name', u: "Ism", t: 'Nomen', l: 'beginner', ex: "Mein Name ist Ahmad.", eu: "Mening ismim Ahmad." },
    { de: 'die Stadt', u: "Shahar", t: 'Nomen', l: 'beginner', ex: "Taschkent ist eine große Stadt.", eu: "Toshkent katta shahar." },
    { de: 'das Land', u: "Mamlakat / Yer", t: 'Nomen', l: 'beginner', ex: "Usbekistan ist mein Land.", eu: "O'zbekiston mening mamlakatim." },
    { de: 'die Sonne', u: "Quyosh", t: 'Nomen', l: 'beginner', ex: "Die Sonne scheint.", eu: "Quyosh chiqyapti." },
    { de: 'der Mond', u: "Oy", t: 'Nomen', l: 'beginner', ex: "Der Mond ist heute hell.", eu: "Bu kecha oy yorqin." },
    { de: 'die Blume', u: "Gul", t: 'Nomen', l: 'beginner', ex: "Sie hat schöne Blumen.", eu: "Uning chiroyli gullari bor." },
    { de: 'der Baum', u: "Daraxt", t: 'Nomen', l: 'beginner', ex: "Der Baum ist sehr groß.", eu: "Daraxt juda baland." },
    { de: 'der Vogel', u: "Qush", t: 'Nomen', l: 'beginner', ex: "Der Vogel singt.", eu: "Qush sayrayapti." },
    { de: 'der Fisch', u: "Baliq", t: 'Nomen', l: 'beginner', ex: "Ich esse gerne Fisch.", eu: "Men baliq yeyishni yaxshi ko'raman." },
    { de: 'neu', u: "Yangi", t: 'Adjektiv', l: 'beginner', ex: "Ich habe ein neues Handy.", eu: "Mening yangi telefonim bor." },
    { de: 'alt', u: "Eski / Qari", t: 'Adjektiv', l: 'beginner', ex: "Das ist ein altes Gebäude.", eu: "Bu eski bino." },
    { de: 'schnell', u: "Tez", t: 'Adjektiv', l: 'beginner', ex: "Das Auto ist sehr schnell.", eu: "Mashina juda tez." },
    { de: 'langsam', u: "Sekin", t: 'Adjektiv', l: 'beginner', ex: "Die Schildkröte bewegt sich langsam.", eu: "Toshbaqa sekin yuradi." },
    { de: 'lieben', u: "Sevmoq", t: 'Verb', l: 'beginner', ex: "Ich liebe meine Familie.", eu: "Men oilamni sevaman." },
    { de: 'mögen', u: "Yoqtirmoq", t: 'Verb', l: 'beginner', ex: "Ich mag Schokolade.", eu: "Men shokoladni yoqtiraman." },
    { de: 'wollen', u: "Xohlamoq", t: 'Verb', l: 'beginner', ex: "Ich will nach Hause gehen.", eu: "Men uyga ketmoqchiman." },
    { de: 'brauchen', u: "Kerakmoq", t: 'Verb', l: 'beginner', ex: "Ich brauche deine Hilfe.", eu: "Sizning yordamingiz kerak." },
    { de: 'sehen', u: "Ko'rmoq", t: 'Verb', l: 'beginner', ex: "Ich kann einen Berg sehen.", eu: "Men tog'ni ko'ra olaman." },
    { de: 'kommen', u: "Kelmoq", t: 'Verb', l: 'beginner', ex: "Bitte komm hier her.", eu: "Iltimos, bu yerga keling." },
    { de: 'geben', u: "Bermoq", t: 'Verb', l: 'beginner', ex: "Gib mir das Buch.", eu: "Menga kitobni bering." },
    { de: 'nehmen', u: "Olmoq", t: 'Verb', l: 'beginner', ex: "Nimm diesen Regenschirm.", eu: "Bu soyabonni oling." },
    { de: 'helfen', u: "Yordam bermoq", t: 'Verb', l: 'beginner', ex: "Kannst du mir helfen?", eu: "Menga yordam bera olasizmi?" },
    { de: 'arbeiten', u: "Ishlash", t: 'Verb', l: 'beginner', ex: "Ich arbeite jeden Tag.", eu: "Men har kuni ishlayman." },
    { de: 'lernen', u: "O'rganmoq", t: 'Verb', l: 'beginner', ex: "Ich lerne jeden Tag Deutsch.", eu: "Men har kuni nemis tilini o'rganaman." },
    { de: 'denken', u: "O'ylamoq", t: 'Verb', l: 'beginner', ex: "Ich denke, du hast recht.", eu: "Menimcha siz to'g'risiz." },
    { de: 'sagen', u: "Aytmoq", t: 'Verb', l: 'beginner', ex: "Was hast du gesagt?", eu: "Nima dedingiz?" },
    { de: 'machen', u: "Qilmoq / Yasamoq", t: 'Verb', l: 'beginner', ex: "Lass mich Tee machen.", eu: "Keling, choy qilay." },
    { de: 'finden', u: "Topmoq", t: 'Verb', l: 'beginner', ex: "Ich kann meinen Schlüssel nicht finden.", eu: "Kalitimni topolmayapman." },
    { de: 'kaufen', u: "Sotib olmoq", t: 'Verb', l: 'beginner', ex: "Ich möchte ein Buch kaufen.", eu: "Kitob sotib olmoqchiman." },
    { de: 'die Milch', u: "Sut", t: 'Nomen', l: 'beginner', ex: "Kinder trinken Milch.", eu: "Bolalar sut ichadi." },
    { de: 'das Ei', u: "Tuxum", t: 'Nomen', l: 'beginner', ex: "Ich esse zwei Eier zum Frühstück.", eu: "Nonushta uchun ikki tuxum yeyman." },
    { de: 'der Reis', u: "Guruch", t: 'Nomen', l: 'beginner', ex: "Reis ist unser Hauptgericht.", eu: "Guruch asosiy ovqatimiz." },
    { de: 'das Fleisch', u: "Go'sht", t: 'Nomen', l: 'beginner', ex: "Dieses Fleisch ist lecker.", eu: "Bu go'sht juda mazali." },
    { de: 'der Tee', u: "Choy", t: 'Nomen', l: 'beginner', ex: "Trinken wir etwas Tee.", eu: "Keling, choy ichamiz." },
    { de: 'der Kaffee', u: "Qahva", t: 'Nomen', l: 'beginner', ex: "Jeden Morgen trinke ich Kaffee.", eu: "Men har ertalab qahva ichaman." },
    { de: 'die Orange', u: "Apelsin", t: 'Nomen', l: 'beginner', ex: "Orangen sind süß.", eu: "Apelsinlar shirin." },
    { de: 'die Banane', u: "Banan", t: 'Nomen', l: 'beginner', ex: "Ich esse jeden Tag eine Banane.", eu: "Men har kuni banan yeyman." },
    { de: 'der Tisch', u: "Stol", t: 'Nomen', l: 'beginner', ex: "Das Buch liegt auf dem Tisch.", eu: "Kitob stolda." },
    { de: 'der Stuhl', u: "Stul", t: 'Nomen', l: 'beginner', ex: "Sitz auf dem Stuhl.", eu: "Stulga o'tiring." },
    { de: 'der Stift', u: "Ruchka", t: 'Nomen', l: 'beginner', ex: "Kann ich deinen Stift leihen?", eu: "Ruchkangizni olsam bo'ladimi?" },
    { de: 'der Bleistift', u: "Qalam", t: 'Nomen', l: 'beginner', ex: "Schreib mit dem Bleistift.", eu: "Qalam bilan yozing." },
    { de: 'die Tasche', u: "Sumka", t: 'Nomen', l: 'beginner', ex: "Meine Tasche ist schwer.", eu: "Sumkam og'ir." },
    { de: 'das Handy', u: "Telefon", t: 'Nomen', l: 'beginner', ex: "Mein Handy ist neu.", eu: "Telefonim yangi." },
    { de: 'das Fenster', u: "Deraza", t: 'Nomen', l: 'beginner', ex: "Öffne bitte das Fenster.", eu: "Iltimos, derazani oching." },
    { de: 'die Tür', u: "Eshik", t: 'Nomen', l: 'beginner', ex: "Mach die Tür zu.", eu: "Eshikni yoping." },
    { de: 'die Straße', u: "Ko'cha / Yo'l", t: 'Nomen', l: 'beginner', ex: "Die Straße ist lang.", eu: "Ko'cha uzun." },
    { de: 'der Park', u: "Park", t: 'Nomen', l: 'beginner', ex: "Kinder spielen im Park.", eu: "Bolalar parkda o'ynaydi." },
    { de: 'das Geschäft', u: "Do'kon", t: 'Nomen', l: 'beginner', ex: "Gehen wir in das Geschäft.", eu: "Keling, do'konga boramiz." },
    { de: 'das Geld', u: "Pul", t: 'Nomen', l: 'beginner', ex: "Hast du Geld?", eu: "Pulingiz bormi?" },
    { de: 'der Freund', u: "Do'st", t: 'Nomen', l: 'beginner', ex: "Er ist mein bester Freund.", eu: "U mening eng yaxshi do'stim." },
    { de: 'der Lehrer', u: "O'qituvchi (erkak)", t: 'Nomen', l: 'beginner', ex: "Mein Lehrer ist nett.", eu: "Mening o'qituvchim mehribon." },
    { de: 'der Schüler', u: "O'quvchi (erkak)", t: 'Nomen', l: 'beginner', ex: "Er ist ein guter Schüler.", eu: "U yaxshi o'quvchi." },
    // A2 ELEMENTARY
    { de: 'das Schlafzimmer', u: "Yotoqxona", t: 'Nomen', l: 'elementary', ex: "Mein Schlafzimmer ist gemütlich.", eu: "Yotoqxonam qulay." },
    { de: 'die Küche', u: "Oshxona", t: 'Nomen', l: 'elementary', ex: "Sie kocht in der Küche.", eu: "U oshxonada ovqat pishiradi." },
    { de: 'das Badezimmer', u: "Hammom", t: 'Nomen', l: 'elementary', ex: "Das Badezimmer ist sauber.", eu: "Hammom toza." },
    { de: 'der Garten', u: "Bog'", t: 'Nomen', l: 'elementary', ex: "Wir bauen Gemüse im Garten an.", eu: "Biz bog'da sabzavot yetishtIramiz." },
    { de: 'der Arzt', u: "Shifokor", t: 'Nomen', l: 'elementary', ex: "Der Arzt untersuchte den Patienten.", eu: "Shifokor bemorni tekshirdi." },
    { de: 'der Ingenieur', u: "Muhandis", t: 'Nomen', l: 'elementary', ex: "Er ist Software-Ingenieur.", eu: "U dasturiy ta'minot muhandisi." },
    { de: 'teuer', u: "Qimmat", t: 'Adjektiv', l: 'elementary', ex: "Dieses Handy ist sehr teuer.", eu: "Bu telefon juda qimmat." },
    { de: 'günstig', u: "Arzon", t: 'Adjektiv', l: 'elementary', ex: "Diese Schuhe sind günstig.", eu: "Bu poyabzallar arzon." },
    { de: 'interessant', u: "Qiziqarli", t: 'Adjektiv', l: 'elementary', ex: "Das ist eine interessante Geschichte.", eu: "Bu qiziqarli hikoya." },
    { de: 'schwierig', u: "Qiyin", t: 'Adjektiv', l: 'elementary', ex: "Diese Prüfung ist sehr schwierig.", eu: "Bu imtihon juda qiyin." },
    { de: 'einfach', u: "Oson", t: 'Adjektiv', l: 'elementary', ex: "Diese Aufgabe ist einfach.", eu: "Bu mashq oson." },
    { de: 'reisen', u: "Sayohat qilmoq", t: 'Verb', l: 'elementary', ex: "Ich reise gerne ins Ausland.", eu: "Xorijga sayohat qilishni yaxshi ko'raman." },
    { de: 'die Musik', u: "Musiqa", t: 'Nomen', l: 'elementary', ex: "Ich höre jeden Tag Musik.", eu: "Men har kuni musiqa eshitaman." },
    { de: 'das Wetter', u: "Ob-havo", t: 'Nomen', l: 'elementary', ex: "Das Wetter ist heute schön.", eu: "Bugun ob-havo yaxshi." },
    { de: 'der Computer', u: "Kompyuter", t: 'Nomen', l: 'elementary', ex: "Ich benutze meinen Computer für die Arbeit.", eu: "Men kompyuterni ish uchun ishlataman." },
    { de: 'das Krankenhaus', u: "Kasalxona", t: 'Nomen', l: 'elementary', ex: "Er wurde ins Krankenhaus gebracht.", eu: "Uni kasalxonaga olib ketishdi." },
    { de: 'das Restaurant', u: "Restoran", t: 'Nomen', l: 'elementary', ex: "Wir essen im Restaurant.", eu: "Biz restoranda ovqatlanamiz." },
    { de: 'der Flughafen', u: "Aeroport", t: 'Nomen', l: 'elementary', ex: "Der Flughafen ist sehr belebt.", eu: "Aeroport juda gavjum." },
    { de: 'das Ticket', u: "Chipta", t: 'Nomen', l: 'elementary', ex: "Ich habe eine Zugkarte gekauft.", eu: "Men poyezd chiptasi sotib oldim." },
    { de: 'das Hotel', u: "Mehmonxona", t: 'Nomen', l: 'elementary', ex: "Wir wohnten in einem schönen Hotel.", eu: "Biz chiroyli mehmonxonada qoldik." },
    { de: 'die Speisekarte', u: "Menyu", t: 'Nomen', l: 'elementary', ex: "Darf ich die Speisekarte sehen?", eu: "Menyuni ko'rsam bo'ladimi?" },
    { de: 'der Rabatt', u: "Chegirma", t: 'Nomen', l: 'elementary', ex: "Heute gibt es 20% Rabatt.", eu: "Bugun 20% chegirma bor." },
    { de: 'die Hausaufgabe', u: "Uy vazifasi", t: 'Nomen', l: 'elementary', ex: "Ich mache jeden Abend meine Hausaufgaben.", eu: "Men har kechqurun uy vazifamni bajaraman." },
    { de: 'die Klasse', u: "Sinf", t: 'Nomen', l: 'elementary', ex: "In unserer Klasse sind 25 Schüler.", eu: "Bizning sinfda 25 o'quvchi bor." },
    { de: 'die Prüfung', u: "Imtihon", t: 'Nomen', l: 'elementary', ex: "Ich habe morgen eine Prüfung.", eu: "Ertaga imtihonÄ±m bor." },
    { de: 'die Note', u: "Baho", t: 'Nomen', l: 'elementary', ex: "Sie hat eine gute Note bekommen.", eu: "U yaxshi baho oldi." },
    { de: 'der Berg', u: "Tog'", t: 'Nomen', l: 'elementary', ex: "Der Berg ist sehr hoch.", eu: "Tog' juda baland." },
    { de: 'der Fluss', u: "Daryo", t: 'Nomen', l: 'elementary', ex: "Der Fluss ist schön.", eu: "Daryo go'zal." },
    { de: 'das Meer', u: "Dengiz", t: 'Nomen', l: 'elementary', ex: "Ich liebe das Meer.", eu: "Men dengizni yaxshi ko'raman." },
    { de: 'der Wald', u: "O'rmon", t: 'Nomen', l: 'elementary', ex: "Der Wald ist dunkel und ruhig.", eu: "O'rmon qorong'i va sokin." },
    { de: 'das Tier', u: "Hayvon", t: 'Nomen', l: 'elementary', ex: "Mein Lieblingstier ist ein Löwe.", eu: "Mening sevimli hayvoni — sher." },
    { de: 'der Sport', u: "Sport", t: 'Nomen', l: 'elementary', ex: "Sport hält dich gesund.", eu: "Sport sizni sog'lom saqlaydi." },
    { de: 'die Mannschaft', u: "Jamoa", t: 'Nomen', l: 'elementary', ex: "Unsere Mannschaft hat das Spiel gewonnen.", eu: "Bizning jamoamiz o'yinda g'olib keldi." },
    { de: 'erklären', u: "Tushuntirmoq", t: 'Verb', l: 'elementary', ex: "Bitte erklär mir das.", eu: "Iltimos, buni menga tushuntiring." },
    { de: 'sich verbessern', u: "Yaxshilamoq", t: 'Verb', l: 'elementary', ex: "Ich möchte mein Deutsch verbessern.", eu: "Nemis tilimni yaxshilashni xohlayman." },
    { de: 'vorbereiten', u: "Tayyorlamoq", t: 'Verb', l: 'elementary', ex: "Ich bereite mich auf die Prüfung vor.", eu: "Imtihonga tayyorlanayapman." },
    { de: 'genießen', u: "Zavqlanmoq", t: 'Verb', l: 'elementary', ex: "Ich genieße es, Filme zu schauen.", eu: "Film ko'rishdan zavqlanaman." },
    { de: 'beenden', u: "Tugatmoq", t: 'Verb', l: 'elementary', ex: "Hast du deine Arbeit beendet?", eu: "Ishingizni tugatdingizmi?" },
    { de: 'anfangen', u: "Boshlash", t: 'Verb', l: 'elementary', ex: "Fangen wir mit dem Unterricht an.", eu: "Keling, darsni boshlaylik." },
    { de: 'normalerweise', u: "Odatda", t: 'Adverb', l: 'elementary', ex: "Normalerweise wache ich um 7 Uhr auf.", eu: "Men odatda soat 7 da uyg'onaman." },
    { de: 'manchmal', u: "Ba'zan", t: 'Adverb', l: 'elementary', ex: "Sie schaut manchmal Filme.", eu: "U ba'zan film ko'radi." },
    { de: 'nie', u: "Hech qachon", t: 'Adverb', l: 'elementary', ex: "Ich esse nie Fast Food.", eu: "Men hech qachon tez ovqat yemayman." },
    { de: 'immer', u: "Har doim", t: 'Adverb', l: 'elementary', ex: "Er ist immer pünktlich.", eu: "U har doim o'z vaqtida keladi." },
    { de: 'oft', u: "Tez-tez", t: 'Adverb', l: 'elementary', ex: "Wir gehen oft spazieren.", eu: "Biz tez-tez sayrga chiqamiz." },
    { de: 'endlich', u: "Nihoyat", t: 'Adverb', l: 'elementary', ex: "Wir sind endlich angekommen.", eu: "Nihoyat kelib yetdik." },
    { de: 'plötzlich', u: "To'satdan", t: 'Adverb', l: 'elementary', ex: "Es hat plötzlich angefangen zu regnen.", eu: "To'satdan yomg'ir yog'a boshladi." },
    // B1 INTERMEDIATE
    { de: 'jedoch', u: "Biroq, ammo", t: 'Konjunktion', l: 'intermediate', ex: "Es war kalt; jedoch gingen wir hinaus.", eu: "Havo sovuq edi, biroq biz chiqdik." },
    { de: 'obwohl', u: "Garchi...bo'lsa ham", t: 'Konjunktion', l: 'intermediate', ex: "Obwohl es regnete, spielten wir.", eu: "Garchi yomg'ir yog'sa ham, biz o'yndik." },
    { de: 'deshalb', u: "Shuning uchun", t: 'Adverb', l: 'intermediate', ex: "Deshalb haben wir beschlossen zu gehen.", eu: "Shuning uchun biz borishga qaror qildik." },
    { de: 'außerdem', u: "Bundan tashqari", t: 'Adverb', l: 'intermediate', ex: "Außerdem ist sie talentiert.", eu: "Bundan tashqari, u iste'dodli." },
    { de: 'die Möglichkeit', u: "Imkoniyat", t: 'Nomen', l: 'intermediate', ex: "Das ist eine tolle Möglichkeit.", eu: "Bu ajoyib imkoniyat." },
    { de: 'die Forschung', u: "Tadqiqot", t: 'Nomen', l: 'intermediate', ex: "Wissenschaftler betreiben Forschung.", eu: "Olimlar tadqiqot o'tkazadilar." },
    { de: 'der Erfolg', u: "Muvaffaqiyat", t: 'Nomen', l: 'intermediate', ex: "Das ist ein großer Erfolg.", eu: "Bu katta yutuq." },
    { de: 'die Herausforderung', u: "Muammo / Sinov", t: 'Nomen', l: 'intermediate', ex: "Jede Herausforderung macht dich stärker.", eu: "Har bir muammo sizni kuchliroq qiladi." },
    { de: 'selbstbewusst', u: "Ishonchli", t: 'Adjektiv', l: 'intermediate', ex: "Sei selbstbewusst.", eu: "O'zingizga ishoning." },
    { de: 'erfolgreich', u: "Muvaffaqiyatli", t: 'Adjektiv', l: 'intermediate', ex: "Sie ist eine erfolgreiche Geschäftsfrau.", eu: "U muvaffaqiyatli ish ayoli." },
    { de: 'die Umwelt', u: "Atrof-muhit", t: 'Nomen', l: 'intermediate', ex: "Wir müssen die Umwelt schützen.", eu: "Biz atrof-muhitni himoya qilishimiz kerak." },
    { de: 'die Technologie', u: "Texnologiya", t: 'Nomen', l: 'intermediate', ex: "Technologie verändert unser Leben.", eu: "Texnologiya hayotimizni o'zgartiradi." },
    { de: 'die Gesellschaft', u: "Jamiyat", t: 'Nomen', l: 'intermediate', ex: "Die Gesellschaft verändert sich schnell.", eu: "Jamiyat tez o'zgarmoqda." },
    { de: 'die Bildung', u: "Ta'lim", t: 'Nomen', l: 'intermediate', ex: "Bildung ist der Schlüssel zum Erfolg.", eu: "Ta'lim — muvaffaqiyat kaliti." },
    { de: 'die Karriere', u: "Karyera", t: 'Nomen', l: 'intermediate', ex: "Ich möchte eine gute Karriere.", eu: "Men yaxshi karyera istayman." },
    { de: 'das Gehalt', u: "Maosh", t: 'Nomen', l: 'intermediate', ex: "Sein Gehalt ist sehr hoch.", eu: "Uning maoshi juda baland." },
    { de: 'der Kollege', u: "Hamkasb", t: 'Nomen', l: 'intermediate', ex: "Mein Kollege ist hilfsbereit.", eu: "Hamkasabim yordamsevar." },
    { de: 'die Erfahrung', u: "Tajriba", t: 'Nomen', l: 'intermediate', ex: "Berufserfahrung ist wichtig.", eu: "Ish tajribasi muhim." },
    { de: 'verwalten', u: "Boshqarmoq", t: 'Verb', l: 'intermediate', ex: "Sie verwaltet ein großes Team.", eu: "U katta jamoani boshqaradi." },
    { de: 'lösen', u: "Yechmoq", t: 'Verb', l: 'intermediate', ex: "Wir müssen dieses Problem lösen.", eu: "Biz bu muammoni yechishimiz kerak." },
    { de: 'erreichen', u: "Erishmoq", t: 'Verb', l: 'intermediate', ex: "Du kannst deine Ziele erreichen.", eu: "Maqsadlaringizga erisha olasiz." },
    { de: 'entwickeln', u: "Rivojlantirmoq", t: 'Verb', l: 'intermediate', ex: "Wir müssen neue Ideen entwickeln.", eu: "Biz yangi g'oyalarni rivojlantirishimiz kerak." },
    { de: 'vorschlagen', u: "Taklif qilmoq", t: 'Verb', l: 'intermediate', ex: "Ich schlage vor, jetzt zu gehen.", eu: "Endi ketishimizni taklif qilaman." },
    { de: 'vergleichen', u: "Solishtirmoq", t: 'Verb', l: 'intermediate', ex: "Vergleiche diese zwei Produkte.", eu: "Bu ikki mahsulotni solishtiring." },
    { de: 'der Bericht', u: "Hisobot", t: 'Nomen', l: 'intermediate', ex: "Schreib einen Bericht darüber.", eu: "Bu haqida hisobot yozing." },
    { de: 'der Vertrag', u: "Shartnoma", t: 'Nomen', l: 'intermediate', ex: "Unterschreibe den Vertrag.", eu: "Shartnomani imzolang." },
    { de: 'trotz', u: "Qaramasdan", t: 'Präposition', l: 'intermediate', ex: "Trotz des Regens spielten wir.", eu: "Yomg'irga qaramasdan, o'yndik." },
    { de: 'falls', u: "Agar...bo'lmasa", t: 'Konjunktion', l: 'intermediate', ex: "Falls du nicht lernst, wirst du nicht bestehen.", eu: "Agar o'qimasangiz, o'taolmaysiz." },
    { de: 'inzwischen', u: "Shu orada", t: 'Adverb', l: 'intermediate', ex: "Ich kochte; inzwischen deckte er den Tisch.", eu: "Men ovqat pishirdim; shu orada u dasturxon yozdi." },
    // B2 UPPER-INTERMEDIATE
    { de: 'die Nuance', u: "Noziklik, soya", t: 'Nomen', l: 'upperintermediate', ex: "Die Nuance ihrer Worte war wichtig.", eu: "Uning so'zlarining nozikligi muhim edi." },
    { de: 'die Souveränität', u: "Suverenitet", t: 'Nomen', l: 'upperintermediate', ex: "Nationale Souveränität ist wichtig.", eu: "Milliy suverenitet muhimdir." },
    { de: 'das Paradigma', u: "Paradigma", t: 'Nomen', l: 'upperintermediate', ex: "Ein neues Paradigma entsteht.", eu: "Yangi paradigma paydo bo'lmoqda." },
    { de: 'mildern', u: "Yumshatmoq", t: 'Verb', l: 'upperintermediate', ex: "Wir müssen die Risiken mildern.", eu: "Biz xavflarni yumshatishimiz kerak." },
    { de: 'beispiellos', u: "Misli ko'rilmagan", t: 'Adjektiv', l: 'upperintermediate', ex: "Das ist eine beispiellose Situation.", eu: "Bu misli ko'rilmagan holat." },
    { de: 'sorgfältig', u: "Puxta, ehtiyotkor", t: 'Adjektiv', l: 'upperintermediate', ex: "Sie ist bei ihrer Arbeit sorgfältig.", eu: "U ishida puxta." },
    { de: 'mehrdeutig', u: "Noaniq, ikki ma'noli", t: 'Adjektiv', l: 'upperintermediate', ex: "Seine Aussage war mehrdeutig.", eu: "Uning bayonoti noaniq edi." },
    { de: 'kohärent', u: "Izchil, mantiqiy", t: 'Adjektiv', l: 'upperintermediate', ex: "Schreib ein kohärentes Argument.", eu: "Izchil argument yozing." },
    { de: 'erheblich', u: "Muhim, sezilarli", t: 'Adjektiv', l: 'upperintermediate', ex: "Es gibt erhebliche Beweise.", eu: "Jiddiy dalillar mavjud." },
    { de: 'überzeugend', u: "Jozibali, qiziqarli", t: 'Adjektiv', l: 'upperintermediate', ex: "Sie machte ein überzeugendes Argument.", eu: "U jozibali argument keltirdi." },
    { de: 'umstritten', u: "Bahsli, munozarali", t: 'Adjektiv', l: 'upperintermediate', ex: "Das ist ein umstrittenes Thema.", eu: "Bu munozarali mavzu." },
    { de: 'die Infrastruktur', u: "Infratuzilma", t: 'Nomen', l: 'upperintermediate', ex: "Wir müssen in Infrastruktur investieren.", eu: "Infratuzilmaga investitsiya qilishimiz kerak." },
    { de: 'die Hypothese', u: "Faraz", t: 'Nomen', l: 'upperintermediate', ex: "Überprüfe deine Hypothese.", eu: "Farazingizni sinab ko'ring." },
    { de: 'das Phänomen', u: "Hodisa", t: 'Nomen', l: 'upperintermediate', ex: "Das ist ein globales Phänomen.", eu: "Bu global hodisa." },
    { de: 'die Perspektive', u: "Nuqtai nazar", t: 'Nomen', l: 'upperintermediate', ex: "Betrachte eine andere Perspektive.", eu: "Boshqa nuqtai nazarni ko'rib chiqing." },
    { de: 'einsetzen', u: "Himoya qilmoq / Ishlatmoq", t: 'Verb', l: 'upperintermediate', ex: "Sie setzt sich für Menschenrechte ein.", eu: "U inson huquqlarini himoya qiladi." },
    { de: 'erleichtern', u: "Osonlashtirmoq", t: 'Verb', l: 'upperintermediate', ex: "Technologie erleichtert das Lernen.", eu: "Texnologiya o'rganishni osonlashtiradi." },
    { de: 'anerkennen', u: "Tan olmoq", t: 'Verb', l: 'upperintermediate', ex: "Ich anerkenne meinen Fehler.", eu: "Xatoimni tan olaman." },
    // C1-C2 ADVANCED
    { de: 'die Rhetorik', u: "Ritorika", t: 'Nomen', l: 'advanced', ex: "Seine Rhetorik war wirkungsvoll.", eu: "Uning ritorikasi kuchli edi." },
    { de: 'der Konsens', u: "Kelishuv", t: 'Nomen', l: 'advanced', ex: "Wir haben einen Konsens erreicht.", eu: "Biz kelishuvga erishdik." },
    { de: 'die Implikationen', u: "Oqibatlar", t: 'Nomen', l: 'advanced', ex: "Bedenke die Implikationen.", eu: "Oqibatlarni ko'rib chiqing." },
    { de: 'pragmatisch', u: "Amaliy", t: 'Adjektiv', l: 'advanced', ex: "Sei pragmatisch dabei.", eu: "Bunga amaliy yondashing." },
    { de: 'inhärent', u: "O'ziga xos, tabiiy", t: 'Adjektiv', l: 'advanced', ex: "Es gibt inhärente Risiken.", eu: "O'ziga xos xavflar mavjud." },
    { de: 'vorherrschend', u: "Ustunlik qiluvchi", t: 'Adjektiv', l: 'advanced', ex: "Deutsch ist die vorherrschende Sprache.", eu: "Nemis tili ustunlik qiluvchi til." },
    { de: 'begründen', u: "Asoslash", t: 'Verb', l: 'advanced', ex: "Begründe deine Entscheidung.", eu: "Qaroringizni asoslang." },
    { de: 'analysieren', u: "Tahlil qilmoq", t: 'Verb', l: 'advanced', ex: "Wir müssen die Daten analysieren.", eu: "Biz ma'lumotlarni tahlil qilishimiz kerak." },
    { de: 'ausarbeiten', u: "Batafsil bayon etmoq", t: 'Verb', l: 'advanced', ex: "Kannst du das ausarbeiten?", eu: "Bu haqida batafsil ayta olasizmi?" },
    { de: 'wenngleich', u: "Garchi", t: 'Konjunktion', l: 'advanced', ex: "Es war ein gutes Ergebnis, wenngleich unerwartet.", eu: "Bu yaxshi natija edi, garchi kutilmagan bo'lsa ham." },
    { de: 'nichtsdestotrotz', u: "Shunga qaramasdan", t: 'Adverb', l: 'advanced', ex: "Nichtsdestotrotz haben wir Erfolg gehabt.", eu: "Shunga qaramasdan muvaffaqiyat qozondik." },
    { de: 'bevorstehend', u: "Yaqinlashayotgan", t: 'Adjektiv', l: 'advanced', ex: "Die bevorstehenden Änderungen sind bedeutsam.", eu: "Yaqinlashayotgan o'zgarishlar muhim." },
    { de: 'plausibel', u: "Ishonchli ko'rinadigan", t: 'Adjektiv', l: 'advanced', ex: "Das scheint plausibel.", eu: "Bu ishonchli ko'rinadi." },
];

// ══════════════════════════════════════════════════════════════
// UNITS DATA
// ══════════════════════════════════════════════════════════════
const UD_DATA = {
    beginner: [
        {
            id: 'b0', emoji: '🔤', title: 'Das Alphabet', desc: "Nemis alifbosini o'rganish", level: 'A1',
            words: ['Hallo', 'gut', 'schön', 'groß', 'klein', 'rot', 'blau', 'der Name', 'die Zeit', 'eins'],
            xp: 40, coin: 15,
            grammar_rule: "Deutsch hat 26 Buchstaben + 3 Umlaute: ä, ö, ü und ß.",
            grammar_example: "A a, B b, C c ... Z z. Ä ä, Ö ö, Ü ü, ß",
            reading_text: "Das deutsche Alphabet hat 26 Buchstaben. Es gibt auch drei Umlaute: Ä, Ö, Ü und das ß. Kinder lernen das Alphabet in der Schule. Jedes Wort wird mit diesen Buchstaben geschrieben. Deutsch ist eine wichtige Sprache in Europa.",
            reading_qs: [
                { q: "Wie viele Buchstaben hat das Alphabet?", opts: ["24", "25", "26", "27"], c: 2 },
                { q: "Wie heißen die Umlaute?", opts: ["â,ê,î", "ä,ö,ü", "à,è,ì", "á,é,í"], c: 1 },
                { q: "Wo lernen Kinder das Alphabet?", opts: ["Zuhause", "Im Park", "In der Schule", "Im Kino"], c: 2 }
            ]
        },
        {
            id: 'b1', emoji: '👋', title: 'Begrüßungen', desc: "Salomlashish va xayrlashish", level: 'A1',
            words: ['Hallo', 'Tschüss', 'Danke', 'Bitte', 'Entschuldigung', 'Ja', 'Nein', 'gut', 'schön', 'der Name'],
            xp: 50, coin: 20,
            grammar_rule: "Sein (bo'lmoq): ich bin, du bist, er/sie/es ist, wir sind, ihr seid, sie sind",
            grammar_example: "Ich bin glücklich. Du bist mein Freund. Er ist Lehrer.",
            reading_text: "Mein Name ist Sarah. Ich komme aus Deutschland. Jeden Morgen sage ich 'Hallo' zu meinen Nachbarn. Wenn ich gehe, sage ich 'Tschüss'. Ich sage immer 'Bitte' und 'Danke'. Die Leute sagen, ich bin sehr höflich.",
            reading_qs: [
                { q: "Woher kommt Sarah?", opts: ["Amerika", "England", "Deutschland", "Frankreich"], c: 2 },
                { q: "Was sagt Sarah beim Abschied?", opts: ["Hallo", "Danke", "Tschüss", "Bitte"], c: 2 },
                { q: "Was ist Sarah wichtig?", opts: ["Geld", "Höflichkeit", "Ruhm", "Stärke"], c: 1 }
            ]
        },
        {
            id: 'b2', emoji: '🔢', title: 'Zahlen', desc: "Raqamlar va hisoblash", level: 'A1',
            words: ['eins', 'zwei', 'drei', 'vier', 'fünf', 'der Apfel', 'das Buch', 'die Katze', 'der Hund', 'die Schule'],
            xp: 50, coin: 20,
            grammar_rule: "Kardinalzahlen: eins, zwei, drei... Ordinalzahlen: erste, zweite, dritte",
            grammar_example: "Ich habe drei Bücher. Sie ist die erste Schülerin.",
            reading_text: "Tom hat drei Katzen und zwei Hunde. Jeden Tag füttert er sie vier Mal. Er verbringt etwa zehn Minuten mit jedem Tier. Er hat zwölf Spielzeuge für seine Katzen gekauft.",
            reading_qs: [
                { q: "Wie viele Katzen hat Tom?", opts: ["Zwei", "Drei", "Vier", "Fünf"], c: 1 },
                { q: "Wie oft täglich füttert er?", opts: ["Zwei", "Drei", "Vier", "Fünf"], c: 2 },
                { q: "Wie viele Spielzeuge?", opts: ["Zehn", "Zwölf", "Fünfzehn", "Zwanzig"], c: 1 }
            ]
        },
        {
            id: 'b3', emoji: '🎨', title: 'Farben', desc: "Nemis tilida ranglar", level: 'A1',
            words: ['rot', 'blau', 'grün', 'gelb', 'schwarz', 'weiß', 'heiß', 'kalt', 'schön', 'groß'],
            xp: 60, coin: 25,
            grammar_rule: "Adjektive stehen vor dem Nomen: ein roter Apfel, der blaue Himmel",
            grammar_example: "Sie hat eine rote Tasche. Ich sehe blaue Vögel. Das grüne Gras ist weich.",
            reading_text: "Der Regenbogen hat sieben Farben: rot, orange, gelb, grün, blau, indigo und violett. Rot ist die Farbe des Feuers. Blau ist die Farbe des Himmels. Grün ist die Farbe der Bäume.",
            reading_qs: [
                { q: "Wie viele Farben hat der Regenbogen?", opts: ["Fünf", "Sechs", "Sieben", "Acht"], c: 2 },
                { q: "Farbe des Himmels?", opts: ["Rot", "Gelb", "Grün", "Blau"], c: 3 },
                { q: "Farbe des Feuers?", opts: ["Blau", "Rot", "Grün", "Gelb"], c: 1 }
            ]
        },
        {
            id: 'b4', emoji: '👨‍👩‍👧', title: 'Die Familie', desc: "Oila a'zolari", level: 'A1',
            words: ['die Mutter', 'der Vater', 'die Schwester', 'der Bruder', 'das Wasser', 'das Essen', 'das Haus', 'das Auto', 'der Hund', 'die Katze'],
            xp: 60, coin: 25,
            grammar_rule: "Possessivartikel: mein, dein, sein, ihr + Nomen",
            grammar_example: "Meine Mutter ist nett. Ihr Vater arbeitet viel. Ihre Familie ist groß.",
            reading_text: "Meine Familie hat fünf Mitglieder. Mein Vater ist Arzt und meine Mutter ist Lehrerin. Ich habe einen Bruder und eine Schwester. Meine Großeltern wohnen in der Nähe. Jeden Sonntag besuchen wir sie.",
            reading_qs: [
                { q: "Wie viele Personen?", opts: ["Drei", "Vier", "Fünf", "Sechs"], c: 2 },
                { q: "Beruf des Vaters?", opts: ["Lehrer", "Arzt", "Ingenieur", "Fahrer"], c: 1 },
                { q: "Wann besuchen sie die Großeltern?", opts: ["Samstag", "Sonntag", "Montag", "Freitag"], c: 1 }
            ]
        },
        {
            id: 'b5', emoji: '🍎', title: 'Essen und Trinken', desc: "Ovqat va ichimliklar", level: 'A1',
            words: ['der Apfel', 'das Brot', 'das Wasser', 'essen', 'trinken', 'schlafen', 'lesen', 'schreiben', 'gehen', 'sprechen'],
            xp: 70, coin: 30,
            grammar_rule: "Zählbare und unzählbare Nomen: ein Apfel, etwas Wasser",
            grammar_example: "Ich möchte einen Apfel und etwas Wasser. Sie trinkt jeden Morgen Milch.",
            reading_text: "Ein gesundes Frühstück ist wichtig. Viele Menschen essen morgens Eier und Brot. Tee und Kaffee sind beliebte Getränke. Milch ist gut für Kinder. Trinke immer genug Wasser täglich.",
            reading_qs: [
                { q: "Was ist morgens wichtig?", opts: ["Abendessen", "Mittagessen", "Frühstück", "Snack"], c: 2 },
                { q: "Was ist gut für Kinder?", opts: ["Kaffee", "Tee", "Milch", "Saft"], c: 2 },
                { q: "Welches Essen wird genannt?", opts: ["Reis", "Suppe", "Eier und Brot", "Pizza"], c: 2 }
            ]
        },
        {
            id: 'b6', emoji: '🏠', title: 'Das Zuhause', desc: "Uy va xonalar", level: 'A1',
            words: ['das Haus', 'das Fenster', 'die Tür', 'der Tisch', 'der Stuhl', 'das Buch', 'der Stift', 'der Bleistift', 'die Tasche', 'das Handy'],
            xp: 70, coin: 30,
            grammar_rule: "Definitartikel: der (maskulin), die (feminin), das (neutrum)",
            grammar_example: "Der Tisch ist groß. Die Tür ist offen. Das Fenster ist sauber.",
            reading_text: "Unser Haus hat drei Zimmer. Im Wohnzimmer steht ein großer Tisch mit sechs Stühlen. Das Schlafzimmer hat zwei Fenster. Die Küche ist modern und sauber. Wir lieben unser Zuhause.",
            reading_qs: [
                { q: "Wie viele Zimmer?", opts: ["Zwei", "Drei", "Vier", "Fünf"], c: 1 },
                { q: "Wo steht der große Tisch?", opts: ["Schlafzimmer", "Küche", "Wohnzimmer", "Bad"], c: 2 },
                { q: "Wie ist die Küche?", opts: ["Alt", "Klein", "Modern und sauber", "Dunkel"], c: 2 }
            ]
        },
        {
            id: 'b7', emoji: '🌤', title: 'Das Wetter', desc: "Ob-havo", level: 'A1',
            words: ['heiß', 'kalt', 'schön', 'gut', 'der Tag', 'der Morgen', 'der Abend', 'die Sonne', 'der Mond', 'die Zeit'],
            xp: 70, coin: 30,
            grammar_rule: "Wie ist das Wetter? Es ist heiß / kalt / schön / bewölkt.",
            grammar_example: "Heute ist es sehr heiß. Morgen wird es kalt sein. Das Wetter ist schön.",
            reading_text: "Das Wetter in Deutschland wechselt oft. Im Sommer ist es warm und sonnig. Im Winter ist es kalt und es schneit. Im Frühling regnet es manchmal. Der Herbst ist bunt und kühl. Deutsche sprechen viel über das Wetter.",
            reading_qs: [
                { q: "Wann ist es warm?", opts: ["Winter", "Herbst", "Sommer", "Frühling"], c: 2 },
                { q: "Was passiert im Winter?", opts: ["Es regnet", "Es schneit", "Es ist heiß", "Es ist bunt"], c: 1 },
                { q: "Worüber sprechen Deutsche viel?", opts: ["Sport", "Politik", "Essen", "Wetter"], c: 3 }
            ]
        },
        {
            id: 'b8', emoji: '🐾', title: 'Tiere', desc: "Hayvonlar", level: 'A1',
            words: ['der Hund', 'die Katze', 'der Vogel', 'der Fisch', 'laufen', 'spielen', 'lieben', 'mögen', 'sehen', 'kommen'],
            xp: 75, coin: 32,
            grammar_rule: "Akkusativ: Ich sehe den Hund. Ich habe eine Katze.",
            grammar_example: "Ich habe einen Hund. Er mag die Katze. Wir sehen den Vogel.",
            reading_text: "In Deutschland haben viele Familien Haustiere. Der Hund ist das beliebteste Haustier. Hunde brauchen viel Bewegung und Liebe. Katzen sind unabhängiger. Vögel und Fische sind auch beliebte Haustiere. Tiere machen das Leben schöner.",
            reading_qs: [
                { q: "Was ist das beliebteste Haustier?", opts: ["Katze", "Vogel", "Hund", "Fisch"], c: 2 },
                { q: "Was brauchen Hunde?", opts: ["Nur Essen", "Bewegung und Liebe", "Nur Wasser", "Nur Spielzeug"], c: 1 },
                { q: "Wie sind Katzen?", opts: ["Abhängig", "Faul", "Unabhängiger", "Laut"], c: 2 }
            ]
        },
        {
            id: 'b9', emoji: '🗺', title: 'Ortsangaben', desc: "Yo'l so'rash", level: 'A1',
            words: ['die Straße', 'der Park', 'das Geschäft', 'gehen', 'kommen', 'sehen', 'finden', 'sagen', 'geben', 'das Geld'],
            xp: 75, coin: 32,
            grammar_rule: "Wo ist...? Wie komme ich zu...? Gehen Sie geradeaus / links / rechts.",
            grammar_example: "Wo ist die Schule? Gehen Sie geradeaus, dann links.",
            reading_text: "Berlin ist eine große Stadt. Es gibt viele Parks und Museen. Die Straßen sind breit. Man kann mit der U-Bahn oder dem Bus fahren. Die Stadt ist sehr belebt. Touristen fragen oft nach dem Weg.",
            reading_qs: [
                { q: "Was gibt es viel in Berlin?", opts: ["Berge", "Parks und Museen", "Strände", "Wüsten"], c: 1 },
                { q: "Womit kann man fahren?", opts: ["Nur Auto", "U-Bahn oder Bus", "Nur Fahrrad", "Schiff"], c: 1 },
                { q: "Wer fragt oft nach dem Weg?", opts: ["Einheimische", "Kinder", "Touristen", "Lehrer"], c: 2 }
            ]
        },
        {
            id: 'b10', emoji: '💰', title: 'Einkaufen', desc: "Do'konda xarid qilish", level: 'A1',
            words: ['das Geld', 'das Geschäft', 'kaufen', 'nehmen', 'geben', 'wollen', 'mögen', 'neu', 'alt', 'der Apfel'],
            xp: 80, coin: 35,
            grammar_rule: "Wie viel kostet das? Das kostet... Euro. Kann ich mit Karte zahlen?",
            grammar_example: "Wie viel kostet dieser Apfel? Er kostet 50 Cent. Ich möchte drei Äpfel kaufen.",
            reading_text: "Einkaufen macht Spaß! Im Supermarkt gibt es alles: Essen, Getränke und Haushaltswaren. Manchmal gibt es Rabatte und Sonderangebote. Man kann mit Karte oder bar zahlen. Vergiss nicht, den Kassenbon zu behalten!",
            reading_qs: [
                { q: "Was gibt es im Supermarkt?", opts: ["Nur Essen", "Essen, Getränke und mehr", "Nur Kleidung", "Nur Bücher"], c: 1 },
                { q: "Was soll man behalten?", opts: ["Die Tüte", "Den Kassenbon", "Das Etikett", "Die Verpackung"], c: 1 },
                { q: "Womit kann man zahlen?", opts: ["Nur Karte", "Nur Bar", "Karte oder Bar", "Nur Münzen"], c: 2 }
            ]
        },
        {
            id: 'b11', emoji: '📅', title: 'Tagesablauf', desc: "Kundalik kun tartib", level: 'A1',
            words: ['der Morgen', 'der Abend', 'die Nacht', 'der Tag', 'essen', 'trinken', 'schlafen', 'lesen', 'laufen', 'arbeiten'],
            xp: 75, coin: 32,
            grammar_rule: "Uhrzeiten: Es ist 8 Uhr. Um halb neun. Um Viertel vor zehn.",
            grammar_example: "Ich stehe um 7 Uhr auf. Um 8 Uhr frühstücke ich. Um 9 Uhr gehe ich zur Arbeit.",
            reading_text: "Mein Alltag beginnt um 7 Uhr morgens. Zuerst frühstücke ich. Dann gehe ich zur Schule. Nachmittags mache ich Hausaufgaben. Abends esse ich mit der Familie. Um 22 Uhr schlafe ich ein.",
            reading_qs: [
                { q: "Wann beginnt der Alltag?", opts: ["6 Uhr", "7 Uhr", "8 Uhr", "9 Uhr"], c: 1 },
                { q: "Was kommt nach dem Frühstück?", opts: ["Schlafen", "Zur Schule gehen", "Fernsehen", "Sport"], c: 1 },
                { q: "Wann schläft die Person ein?", opts: ["20 Uhr", "21 Uhr", "22 Uhr", "23 Uhr"], c: 2 }
            ]
        },
        {
            id: 'b12', emoji: '🧍', title: 'Personenbeschreibung', desc: "Odamni tasvirlash", level: 'A1',
            words: ['groß', 'klein', 'schön', 'alt', 'neu', 'schnell', 'langsam', 'gut', 'schlecht', 'heiß'],
            xp: 80, coin: 35,
            grammar_rule: "Adjektive beschreiben Nomen. Er ist groß. Sie hat blaue Augen.",
            grammar_example: "Er ist groß und hat braune Haare. Sie ist klein und hat blaue Augen.",
            reading_text: "Meine Freundin heißt Lisa. Sie ist groß und hat lange braune Haare. Ihre Augen sind grün. Sie ist immer freundlich und hilfsbereit. Lisa ist 25 Jahre alt. Sie arbeitet als Lehrerin.",
            reading_qs: [
                { q: "Wie sind Lisas Haare?", opts: ["Kurz und blond", "Lang und braun", "Kurz und rot", "Lang und schwarz"], c: 1 },
                { q: "Wie sind ihre Augen?", opts: ["Blau", "Braun", "Grün", "Schwarz"], c: 2 },
                { q: "Was macht Lisa?", opts: ["Ärztin", "Lehrerin", "Ingenieurin", "Studentin"], c: 1 }
            ]
        },
    ],

    elementary: [
        {
            id: 'e0', emoji: '🏡', title: 'Wohnen', desc: "Uy va xonalar", level: 'A2',
            words: ['das Schlafzimmer', 'die Küche', 'das Badezimmer', 'der Garten', 'der Arzt', 'der Lehrer', 'teuer', 'günstig', 'schön', 'interessant'],
            xp: 80, coin: 35,
            grammar_rule: "Es gibt / Es gibt nicht: Es gibt ein Sofa. Es gibt drei Schlafzimmer.",
            grammar_example: "Es gibt eine große Küche. Es gibt zwei Badezimmer.",
            reading_text: "Mein Haus hat drei Stockwerke. Im Erdgeschoss gibt es ein großes Wohnzimmer und eine moderne Küche. Im ersten Stock gibt es drei Schlafzimmer und zwei Badezimmer. Mein Schlafzimmer hat ein großes Fenster mit Blick auf den Garten.",
            reading_qs: [
                { q: "Wie viele Stockwerke?", opts: ["Zwei", "Drei", "Vier", "Fünf"], c: 1 },
                { q: "Wo sind die Schlafzimmer?", opts: ["Erdgeschoss", "Erster Stock", "Garten", "Keller"], c: 1 },
                { q: "Was hat das Schlafzimmer?", opts: ["Einen Fernseher", "Ein großes Fenster", "Einen Pool", "Einen Kamin"], c: 1 }
            ]
        },
        {
            id: 'e1', emoji: '💼', title: 'Berufe', desc: "Kasblar", level: 'A2',
            words: ['der Arzt', 'der Lehrer', 'der Ingenieur', 'die Musik', 'der Freund', 'das Wetter', 'der Computer', 'reisen', 'schön', 'interessant'],
            xp: 80, coin: 35,
            grammar_rule: "Was machst du beruflich? Ich bin Arzt/Lehrerin/Ingenieur.",
            grammar_example: "Was machst du? Ich bin Krankenpfleger. Er arbeitet als Ingenieur.",
            reading_text: "Es gibt viele verschiedene Berufe. Ärzte und Krankenschwestern arbeiten in Krankenhäusern. Lehrer bilden die nächste Generation aus. Ingenieure bauen Brücken. Piloten fliegen Flugzeuge. Jeder Beruf ist wichtig für die Gesellschaft.",
            reading_qs: [
                { q: "Wo arbeiten Ärzte?", opts: ["Schulen", "Fabriken", "Krankenhäuser", "Büros"], c: 2 },
                { q: "Was bauen Ingenieure?", opts: ["Bücher", "Lieder", "Brücken", "Essen"], c: 2 },
                { q: "Was machen Lehrer?", opts: ["Fliegen", "Brücken bauen", "Menschen ausbilden", "Kochen"], c: 2 }
            ]
        },
        {
            id: 'e2', emoji: '🛒', title: 'Einkaufen', desc: "Xarid qilish", level: 'A2',
            words: ['teuer', 'günstig', 'schön', 'schwierig', 'einfach', 'reisen', 'die Musik', 'der Freund', 'das Wetter', 'der Computer'],
            xp: 90, coin: 40,
            grammar_rule: "Wie viel kostet das? Es kostet... Kann ich mit Karte zahlen?",
            grammar_example: "Wie viel kostet dieses Hemd? Es kostet 25 Euro. Kann ich mit Karte zahlen?",
            reading_text: "Einkaufen ist alltäglich. Supermärkte verkaufen Lebensmittel und Haushaltswaren. Kaufhäuser haben Kleidung und Elektronik. Vor dem Kauf immer den Preis prüfen. Nach Rabatten und Angeboten Ausschau halten um zu sparen.",
            reading_qs: [
                { q: "Wo kann man Kleidung kaufen?", opts: ["Supermarkt", "Kaufhaus", "Apotheke", "Bäckerei"], c: 1 },
                { q: "Was soll man behalten?", opts: ["Die Tüte", "Den Kassenbon", "Das Etikett", "Die Box"], c: 1 },
                { q: "Was hilft Geld zu sparen?", opts: ["Schnell kaufen", "Bar zahlen", "Rabatte suchen", "Oft gehen"], c: 2 }
            ]
        },
        {
            id: 'e3', emoji: '🚆', title: 'Reisen', desc: "Sayohat", level: 'A2',
            words: ['das Ticket', 'das Hotel', 'der Flughafen', 'reisen', 'das Wetter', 'interessant', 'der Freund', 'der Computer', 'schön', 'endlich'],
            xp: 90, coin: 40,
            grammar_rule: "Modalverben: Ich muss das Ticket kaufen. Du kannst mit dem Zug fahren.",
            grammar_example: "Wir müssen früh aufstehen. Kann ich eine Fahrkarte kaufen?",
            reading_text: "Reisen macht Spaß! Zuerst kauft man ein Ticket. Dann bucht man ein Hotel. Am Flughafen gibt es viele Kontrollen. Im Zug kann man bequem reisen. Vergiss deinen Reisepass nicht! Auf Reisen lernt man viele neue Kulturen kennen.",
            reading_qs: [
                { q: "Was kauft man zuerst?", opts: ["Hotel", "Ticket", "Koffer", "Reisepass"], c: 1 },
                { q: "Was darf man nicht vergessen?", opts: ["Handy", "Kamera", "Reisepass", "Geld"], c: 2 },
                { q: "Was lernt man auf Reisen?", opts: ["Kochen", "Neue Kulturen", "Schwimmen", "Autofahren"], c: 1 }
            ]
        },
        {
            id: 'e4', emoji: '🍽', title: 'Im Restaurant', desc: "Restoranda", level: 'A2',
            words: ['das Restaurant', 'die Speisekarte', 'der Tisch', 'essen', 'trinken', 'teuer', 'günstig', 'schön', 'manchmal', 'oft'],
            xp: 85, coin: 37,
            grammar_rule: "Ich hätte gerne... / Ich möchte... / Bringen Sie mir bitte...",
            grammar_example: "Ich hätte gerne ein Schnitzel. Können Sie mir die Rechnung bringen?",
            reading_text: "Im Restaurant gibt es viele Köstlichkeiten. Zuerst bekommt man die Speisekarte. Dann bestellt man sein Essen. Der Kellner bringt das Essen. Am Ende bittet man um die Rechnung. In Deutschland gibt man oft Trinkgeld.",
            reading_qs: [
                { q: "Was bekommt man zuerst?", opts: ["Das Essen", "Die Rechnung", "Die Speisekarte", "Wasser"], c: 2 },
                { q: "Was gibt man in Deutschland oft?", opts: ["Blumen", "Trinkgeld", "Geschenke", "Bücher"], c: 1 },
                { q: "Was bringt der Kellner?", opts: ["Nur Wasser", "Das Essen", "Die Speisekarte", "Trinkgeld"], c: 1 }
            ]
        },
        {
            id: 'e5', emoji: '🏥', title: 'Beim Arzt', desc: "Shifokorda", level: 'A2',
            words: ['der Arzt', 'das Krankenhaus', 'heiß', 'kalt', 'gut', 'schlecht', 'trinken', 'schlafen', 'gehen', 'helfen'],
            xp: 85, coin: 37,
            grammar_rule: "Was fehlt Ihnen? Mir tut der Kopf weh. Ich habe Fieber.",
            grammar_example: "Ich habe Kopfschmerzen. Mir ist schlecht. Ich habe seit drei Tagen Fieber.",
            reading_text: "Beim Arzt muss man warten. Zuerst meldet man sich an. Dann erklärt man dem Arzt die Beschwerden. Der Arzt untersucht den Patienten. Er schreibt ein Rezept. Die Apotheke gibt die Medikamente.",
            reading_qs: [
                { q: "Was macht man zuerst?", opts: ["Bezahlen", "Anmelden", "Warten", "Essen"], c: 1 },
                { q: "Was schreibt der Arzt?", opts: ["Einen Brief", "Ein Buch", "Ein Rezept", "Eine Liste"], c: 2 },
                { q: "Wo bekommt man Medikamente?", opts: ["Supermarkt", "Arzt", "Apotheke", "Schule"], c: 2 }
            ]
        },
        {
            id: 'e6', emoji: '📞', title: 'Kommunikation', desc: "Telefon va muloqot", level: 'A2',
            words: ['das Handy', 'sprechen', 'hören', 'sagen', 'schreiben', 'erklären', 'helfen', 'schön', 'interessant', 'gut'],
            xp: 85, coin: 37,
            grammar_rule: "Trennbare Verben: anrufen (ich rufe an), aufmachen (ich mache auf)",
            grammar_example: "Ich rufe dich morgen an. Machst du bitte die Tür auf?",
            reading_text: "Kommunikation ist sehr wichtig. Wir kommunizieren täglich per Telefon, E-Mail und persönlich. Das Handy ist heute unverzichtbar. Man kann Nachrichten schreiben oder anrufen. Wichtig ist, klar und höflich zu sprechen.",
            reading_qs: [
                { q: "Wie kommunizieren wir täglich?", opts: ["Nur per Brief", "Telefon, E-Mail und persönlich", "Nur persönlich", "Nur per Handy"], c: 1 },
                { q: "Was ist heute unverzichtbar?", opts: ["Auto", "Computer", "Handy", "Fernsehen"], c: 2 },
                { q: "Was ist beim Sprechen wichtig?", opts: ["Laut sein", "Klar und höflich", "Schnell reden", "Viel reden"], c: 1 }
            ]
        },
        {
            id: 'e7', emoji: '🎮', title: 'Hobbys und Freizeit', desc: "Hobbylar va dam olish", level: 'A2',
            words: ['spielen', 'laufen', 'lesen', 'hören', 'reisen', 'die Musik', 'der Sport', 'schön', 'interessant', 'lieben'],
            xp: 85, coin: 37,
            grammar_rule: "Was machst du in deiner Freizeit? Ich spiele gerne... / Ich lese oft...",
            grammar_example: "In meiner Freizeit spiele ich Fußball. Ich höre gerne Musik. Manchmal lese ich Bücher.",
            reading_text: "Freizeit ist wichtig für die Erholung. Viele Deutsche treiben Sport. Joggen, Radfahren und Schwimmen sind beliebt. Andere lesen Bücher oder hören Musik. Reisen ist auch ein beliebtes Hobby. Am Wochenende trifft man oft Freunde.",
            reading_qs: [
                { q: "Wofür ist Freizeit wichtig?", opts: ["Arbeit", "Erholung", "Lernen", "Kochen"], c: 1 },
                { q: "Was ist ein beliebter Sport?", opts: ["Schlafen", "Joggen", "Essen", "Arbeiten"], c: 1 },
                { q: "Wann trifft man oft Freunde?", opts: ["Montag", "Dienstag", "Am Wochenende", "Täglich"], c: 2 }
            ]
        },
        {
            id: 'e8', emoji: '🏫', title: 'Schule und Studium', desc: "Maktab va ta'lim", level: 'A2',
            words: ['die Schule', 'lernen', 'lesen', 'schreiben', 'die Hausaufgabe', 'die Klasse', 'die Prüfung', 'die Note', 'der Lehrer', 'der Schüler'],
            xp: 90, coin: 40,
            grammar_rule: "Perfekt (o'tgan zamon): Ich habe gelernt. Er hat geschrieben. Wir haben gelesen.",
            grammar_example: "Ich habe heute viel gelernt. Sie hat die Prüfung bestanden. Wir haben Hausaufgaben gemacht.",
            reading_text: "Die Schule ist sehr wichtig. In Deutschland geht man sechs Jahre in die Grundschule. Dann kommt das Gymnasium oder die Realschule. Das Abitur öffnet die Tür zur Universität. Bildung ist kostenlos in Deutschland.",
            reading_qs: [
                { q: "Wie lange dauert die Grundschule?", opts: ["4 Jahre", "5 Jahre", "6 Jahre", "8 Jahre"], c: 2 },
                { q: "Was öffnet die Tür zur Universität?", opts: ["Realschule", "Grundschule", "Abitur", "Note"], c: 2 },
                { q: "Wie ist Bildung in Deutschland?", opts: ["Sehr teuer", "Teuer", "Kostenlos", "Halbwegs teuer"], c: 2 }
            ]
        },
        {
            id: 'e9', emoji: '🌍', title: 'Geografie', desc: "Geografiya", level: 'A2',
            words: ['der Berg', 'der Fluss', 'das Meer', 'der Wald', 'die Stadt', 'das Land', 'groß', 'schön', 'reisen', 'sehen'],
            xp: 85, coin: 37,
            grammar_rule: "Deutschland liegt in Mitteleuropa. Berlin ist die Hauptstadt.",
            grammar_example: "Deutschland grenzt an Frankreich, Polen und die Schweiz. Die größte Stadt ist Berlin.",
            reading_text: "Deutschland liegt in Mitteleuropa. Es hat 83 Millionen Einwohner. Die Hauptstadt ist Berlin. Es gibt viele schöne Landschaften: Berge, Wälder, Flüsse und Seen. Der Rhein ist ein wichtiger Fluss. Die Alpen liegen im Süden.",
            reading_qs: [
                { q: "Wo liegt Deutschland?", opts: ["Westeuropa", "Osteuropa", "Mitteleuropa", "Nordeuropa"], c: 2 },
                { q: "Was ist die Hauptstadt?", opts: ["München", "Hamburg", "Frankfurt", "Berlin"], c: 3 },
                { q: "Wo liegen die Alpen?", opts: ["Im Norden", "Im Osten", "Im Westen", "Im Süden"], c: 3 }
            ]
        },
        {
            id: 'e10', emoji: '👔', title: 'Kleidung und Mode', desc: "Kiyim va moda", level: 'A2',
            words: ['schön', 'groß', 'klein', 'teuer', 'günstig', 'kaufen', 'mögen', 'sehen', 'nehmen', 'alt'],
            xp: 85, coin: 37,
            grammar_rule: "Was trägst du gerne? Ich trage lieber... Die Größe S/M/L/XL.",
            grammar_example: "Ich trage gerne blaue Jeans. Diese Jacke ist zu klein. Haben Sie Größe M?",
            reading_text: "Mode ist in Deutschland sehr wichtig. Viele Menschen kaufen gerne neue Kleidung. Im Sommer trägt man leichte Kleidung. Im Winter braucht man warme Jacken. Markenshops und Secondhandläden sind beide beliebt.",
            reading_qs: [
                { q: "Was trägt man im Sommer?", opts: ["Warme Jacken", "Leichte Kleidung", "Mäntel", "Stiefel"], c: 1 },
                { q: "Was ist auch beliebt?", opts: ["Nur Markenshops", "Nur Secondhand", "Beide", "Keine"], c: 2 },
                { q: "Was braucht man im Winter?", opts: ["T-Shirts", "Sandalen", "Warme Jacken", "Shorts"], c: 2 }
            ]
        },
        {
            id: 'e11', emoji: '🎄', title: 'Feste und Feiertage', desc: "Bayramlar", level: 'A2',
            words: ['schön', 'lieben', 'essen', 'trinken', 'der Freund', 'gut', 'groß', 'der Tag', 'oft', 'immer'],
            xp: 90, coin: 40,
            grammar_rule: "Weihnachten ist am 25. Dezember. Ostern feiert man im Frühling.",
            grammar_example: "An Weihnachten gibt man Geschenke. Zu Ostern suchen Kinder Eier.",
            reading_text: "Deutschland hat viele Feste. Weihnachten ist das größte Fest. An Silvester feiert man das neue Jahr. Das Oktoberfest in München ist weltberühmt. Karneval ist besonders in Köln beliebt. An diesen Tagen sind die Menschen fröhlich.",
            reading_qs: [
                { q: "Was ist das größte Fest?", opts: ["Ostern", "Silvester", "Weihnachten", "Oktoberfest"], c: 2 },
                { q: "Wo ist das Oktoberfest?", opts: ["Berlin", "Hamburg", "München", "Frankfurt"], c: 2 },
                { q: "Wo ist Karneval besonders beliebt?", opts: ["München", "Köln", "Hamburg", "Berlin"], c: 1 }
            ]
        },
        {
            id: 'e12', emoji: '💪', title: 'Gesundheit und Sport', desc: "Salomatlik va sport", level: 'A2',
            words: ['der Sport', 'laufen', 'spielen', 'trinken', 'schlafen', 'gut', 'der Arzt', 'das Krankenhaus', 'lieben', 'oft'],
            xp: 90, coin: 40,
            grammar_rule: "Imperativ: Trink viel Wasser! Schlaf gut! Mach Sport!",
            grammar_example: "Trink täglich zwei Liter Wasser. Schlaf mindestens acht Stunden. Mach regelmäßig Sport.",
            reading_text: "Gesundheit ist sehr wichtig. Man soll täglich Sport treiben. Gesundes Essen und viel Wasser trinken ist wichtig. Schlafen Sie mindestens acht Stunden. Rauchen ist schlecht für die Gesundheit. Ein gesunder Lebensstil macht glücklich.",
            reading_qs: [
                { q: "Was soll man täglich machen?", opts: ["Nur schlafen", "Sport treiben", "Nur essen", "Nur lernen"], c: 1 },
                { q: "Wie viele Stunden schlafen?", opts: ["Sechs", "Sieben", "Acht", "Neun"], c: 2 },
                { q: "Was ist schlecht für die Gesundheit?", opts: ["Sport", "Wasser", "Rauchen", "Schlafen"], c: 2 }
            ]
        },
    ],

    intermediate: [
        {
            id: 'i0', emoji: '🔮', title: 'Zukunftspläne', desc: "Kelajak zamonlari", level: 'B1',
            words: ['jedoch', 'obwohl', 'deshalb', 'außerdem', 'die Möglichkeit', 'die Forschung', 'aufgeben', 'der Erfolg', 'die Herausforderung', 'entwickeln'],
            xp: 130, coin: 60,
            grammar_rule: "Futur I: werden + Infinitiv. Ich werde kommen. Sie wird arbeiten.",
            grammar_example: "Ich werde dich morgen anrufen. Sie wird Medizin studieren. Wir werden reisen.",
            reading_text: "Planung für die Zukunft ist wichtig. Klare Ziele helfen beim Erreichen von Erfolg. Kurzfristige Ziele dauern einige Wochen. Langfristige Ziele dauern Jahre. Flexibilität ist genauso wichtig wie Entschlossenheit.",
            reading_qs: [
                { q: "Was dauert kurzfristige Ziele?", opts: ["Jahre", "Jahrzehnte", "Einige Wochen", "Ein Leben"], c: 2 },
                { q: "Was ist genauso wichtig wie Entschlossenheit?", opts: ["Geld", "Flexibilität", "Bildung", "Stärke"], c: 1 },
                { q: "Was hilft Erfolg zu erreichen?", opts: ["Freunde", "Ruhm", "Klare Ziele", "Reisen"], c: 2 }
            ]
        },
        {
            id: 'i1', emoji: '🎯', title: 'Perfekt', desc: "Perfekt zaman", level: 'B1',
            words: ['jedoch', 'obwohl', 'deshalb', 'außerdem', 'die Möglichkeit', 'die Forschung', 'aufgeben', 'der Erfolg', 'die Herausforderung', 'erreichen'],
            xp: 140, coin: 65,
            grammar_rule: "Perfekt: haben/sein + Partizip II. Regelmäßig: ge-...-t. Unregelmäßig: ge-...-en",
            grammar_example: "Ich habe gelernt. Er ist gegangen. Wir haben gegessen. Sie ist gekommen.",
            reading_text: "Das Perfekt verbindet Vergangenheit und Gegenwart. Es beschreibt Erfahrungen und kürzliche Ereignisse. Häufige Zeitausdrücke: schon, noch nicht, bereits, gerade, gestern, letzte Woche.",
            reading_qs: [
                { q: "Was verbindet das Perfekt?", opts: ["Zwei Zukünfte", "Vergangenheit und Gegenwart", "Zwei Vergangenheiten", "Gegenwart und Zukunft"], c: 1 },
                { q: "Mit welchem Verb bildet man Bewegungsverben?", opts: ["haben", "sein", "werden", "können"], c: 1 },
                { q: "Welches Wort zeigt abgeschlossene Handlungen?", opts: ["Nie", "Immer", "Schon", "Manchmal"], c: 2 }
            ]
        },
        {
            id: 'i2', emoji: '🗣', title: 'Kommunikation im Beruf', desc: "Ishda muloqot", level: 'B1',
            words: ['der Kollege', 'die Erfahrung', 'verwalten', 'lösen', 'erreichen', 'entwickeln', 'vorschlagen', 'vergleichen', 'der Bericht', 'der Vertrag'],
            xp: 135, coin: 62,
            grammar_rule: "Konjunktiv II für höfliche Anfragen: Könnten Sie...? Würden Sie...? Ich hätte gerne...",
            grammar_example: "Könnten Sie mir helfen? Würden Sie das bitte erklären? Ich hätte gerne einen Termin.",
            reading_text: "Im Beruf ist gute Kommunikation entscheidend. Man sollte klar und professionell sprechen. Meetings beginnen pünktlich. E-Mails werden höflich formuliert. Feedback sollte konstruktiv sein. Teamarbeit ist sehr wichtig.",
            reading_qs: [
                { q: "Wann beginnen Meetings?", opts: ["Unpünktlich", "Pünktlich", "Spät", "Früh"], c: 1 },
                { q: "Wie sollen E-Mails formuliert sein?", opts: ["Kurz", "Lang", "Höflich", "Laut"], c: 2 },
                { q: "Wie soll Feedback sein?", opts: ["Negativ", "Konstruktiv", "Lang", "Laut"], c: 1 }
            ]
        },
        {
            id: 'i3', emoji: '🌱', title: 'Umwelt und Natur', desc: "Atrof-muhit", level: 'B1',
            words: ['die Umwelt', 'die Technologie', 'die Gesellschaft', 'der Berg', 'der Fluss', 'das Meer', 'der Wald', 'schön', 'groß', 'die Möglichkeit'],
            xp: 135, coin: 62,
            grammar_rule: "Passiv: Das Wasser wird verschmutzt. Die Wälder werden zerstört.",
            grammar_example: "Plastik wird überall gefunden. Energie wird gespart. Abfall wird recycelt.",
            reading_text: "Der Klimawandel ist ein großes Problem. Die Temperaturen steigen weltweit. Wälder werden abgeholzt. Ozeane werden durch Plastikmüll verschmutzt. Erneuerbare Energien sind die Lösung. Jeder kann etwas für die Umwelt tun.",
            reading_qs: [
                { q: "Was ist ein großes globales Problem?", opts: ["Hunger", "Klimawandel", "Lärm", "Verkehr"], c: 1 },
                { q: "Was ist die Lösung?", opts: ["Mehr Öl", "Atomkraft", "Erneuerbare Energien", "Mehr Autos"], c: 2 },
                { q: "Was wird durch Plastikmüll verschmutzt?", opts: ["Luft", "Wälder", "Ozeane", "Berge"], c: 2 }
            ]
        },
        {
            id: 'i4', emoji: '💻', title: 'Digitale Welt', desc: "Digital dunyo", level: 'B1',
            words: ['die Technologie', 'der Computer', 'das Handy', 'entwickeln', 'lösen', 'erreichen', 'die Möglichkeit', 'außerdem', 'deshalb', 'jedoch'],
            xp: 140, coin: 65,
            grammar_rule: "Relativsätze: Das ist das Programm, das ich benutze. Die App, die ich heruntergeladen habe.",
            grammar_example: "Das ist das Handy, das ich gekauft habe. Die Webseite, die ich oft besuche, ist informativ.",
            reading_text: "Die Digitalisierung verändert unser Leben. Künstliche Intelligenz wird immer wichtiger. Datenschutz ist ein zentrales Thema. Soziale Medien verbinden Menschen weltweit. Online-Einkaufen spart Zeit. Die Digitale Revolution hat erst begonnen.",
            reading_qs: [
                { q: "Was verändert unser Leben?", opts: ["Sport", "Digitalisierung", "Essen", "Schlafen"], c: 1 },
                { q: "Was ist ein zentrales Thema?", opts: ["Mode", "Musik", "Datenschutz", "Sport"], c: 2 },
                { q: "Was verbindet Menschen weltweit?", opts: ["Telefon", "Briefe", "Soziale Medien", "Radio"], c: 2 }
            ]
        },
        {
            id: 'i5', emoji: '🏛', title: 'Geschichte Deutschlands', desc: "Germaniya tarixi", level: 'B1',
            words: ['jedoch', 'obwohl', 'deshalb', 'außerdem', 'die Möglichkeit', 'erreichen', 'entwickeln', 'der Erfolg', 'die Herausforderung', 'die Gesellschaft'],
            xp: 140, coin: 65,
            grammar_rule: "Präteritum (resmi o'tgan zamon): ich war, du warst, er hatte, wir gingen",
            grammar_example: "Deutschland war einmal geteilt. Die Mauer fiel 1989. Die Wiedervereinigung war ein historischer Moment.",
            reading_text: "Deutschland hat eine reiche Geschichte. Nach dem Zweiten Weltkrieg wurde Deutschland geteilt. Es gab die DDR im Osten und die BRD im Westen. 1989 fiel die Berliner Mauer. 1990 kam die Wiedervereinigung. Heute ist Deutschland eine starke Demokratie.",
            reading_qs: [
                { q: "Wann fiel die Berliner Mauer?", opts: ["1985", "1989", "1991", "1990"], c: 1 },
                { q: "Was war die DDR?", opts: ["Westdeutschland", "Ostdeutschland", "Süddeutschland", "Norddeutschland"], c: 1 },
                { q: "Was ist Deutschland heute?", opts: ["Eine Monarchie", "Eine Diktatur", "Eine starke Demokratie", "Ein Kaiserreich"], c: 2 }
            ]
        },
    ],

    upperintermediate: [
        {
            id: 'u0', emoji: '🖊', title: 'Wissenschaftliches Schreiben', desc: "Ilmiy yozuv", level: 'B2',
            words: ['die Nuance', 'die Souveränität', 'das Paradigma', 'mildern', 'beispiellos', 'sorgfältig', 'mehrdeutig', 'kohärent', 'erheblich', 'überzeugend'],
            xp: 190, coin: 85,
            grammar_rule: "Kohäsionsmittel: außerdem (Ergänzung), jedoch (Kontrast), deshalb (Ursache).",
            grammar_example: "Die Daten bestätigen die Hypothese. Außerdem untermauern frühere Studien diese Ergebnisse.",
            reading_text: "Wissenschaftliches Schreiben erfordert Präzision und logische Kohärenz. Jedes Argument muss durch Beweise gestützt werden. Kohäsionsmittel verbinden Ideen. Absatzstruktur folgt PEEL: Punkt, Beweis, Erklärung, Verbindung.",
            reading_qs: [
                { q: "Was signalisiert 'außerdem'?", opts: ["Kontrast", "Ergebnis", "Zusätzliche Information", "Bedingung"], c: 2 },
                { q: "Was muss jedes Argument haben?", opts: ["Eine Geschichte", "Beweise", "Meinungen", "Humor"], c: 1 },
                { q: "Was erfordert wissenschaftliches Schreiben?", opts: ["Kreativität", "Präzision", "Humor", "Kürze"], c: 1 }
            ]
        },
        {
            id: 'u1', emoji: '⚖', title: 'Recht und Gesetz', desc: "Huquq va qonun", level: 'B2',
            words: ['mildern', 'die Perspektive', 'einsetzen', 'erleichtern', 'anerkennen', 'kohärent', 'erheblich', 'umstritten', 'überzeugend', 'beispiellos'],
            xp: 200, coin: 90,
            grammar_rule: "Nominalisierung: entscheiden → die Entscheidung, entwickeln → die Entwicklung",
            grammar_example: "Die Entscheidung des Gerichts war eindeutig. Die Entwicklung neuer Gesetze dauert lange.",
            reading_text: "Das deutsche Rechtssystem basiert auf dem Grundgesetz. Bürger haben Grundrechte und Pflichten. Gerichte entscheiden über Streitigkeiten. Das Bundesverfassungsgericht ist das höchste Gericht. Gesetze werden im Bundestag beschlossen.",
            reading_qs: [
                { q: "Worauf basiert das deutsche Rechtssystem?", opts: ["Der Verfassung", "Dem Grundgesetz", "Der Bibel", "Dem König"], c: 1 },
                { q: "Was ist das höchste Gericht?", opts: ["Amtsgericht", "Landgericht", "Bundesverfassungsgericht", "Oberlandesgericht"], c: 2 },
                { q: "Wo werden Gesetze beschlossen?", opts: ["Im Bundesrat", "Im Bundestag", "Im Kanzleramt", "Im Ministerium"], c: 1 }
            ]
        },
        {
            id: 'u2', emoji: '📊', title: 'Wirtschaft und Finanzen', desc: "Iqtisodiyot va moliya", level: 'B2',
            words: ['der Erfolg', 'verwalten', 'lösen', 'erreichen', 'entwickeln', 'die Gesellschaft', 'die Technologie', 'die Bildung', 'umstritten', 'kohärent'],
            xp: 200, coin: 90,
            grammar_rule: "Zweiteilige Konnektoren: sowohl...als auch, weder...noch, entweder...oder",
            grammar_example: "Sowohl die Kosten als auch die Qualität sind wichtig. Weder Steuern noch Zinsen wurden erhöht.",
            reading_text: "Die deutsche Wirtschaft ist eine der stärksten der Welt. Export ist sehr wichtig für Deutschland. Bekannte Marken sind BMW, Volkswagen und Siemens. Der Euro ist die Währung. Inflation und Deflation beeinflussen die Wirtschaft. Digitalisierung verändert viele Branchen.",
            reading_qs: [
                { q: "Was ist sehr wichtig für Deutschland?", opts: ["Import", "Export", "Tourismus", "Landwirtschaft"], c: 1 },
                { q: "Was ist die Währung?", opts: ["D-Mark", "Pfund", "Euro", "Dollar"], c: 2 },
                { q: "Was verändert viele Branchen?", opts: ["Sport", "Digitalisierung", "Mode", "Kunst"], c: 1 }
            ]
        },
    ],

    advanced: [
        {
            id: 'a0', emoji: '📝', title: 'Akademisches Schreiben', desc: "Akademik yozuv", level: 'C1-C2',
            words: ['die Rhetorik', 'der Konsens', 'die Implikationen', 'pragmatisch', 'inhärent', 'vorherrschend', 'begründen', 'analysieren', 'ausarbeiten', 'wenngleich'],
            xp: 250, coin: 110,
            grammar_rule: "Kohäsion: darüber hinaus (addition), nichtsdestotrotz (contrast), infolgedessen (cause).",
            grammar_example: "Die Daten stützen die Hypothese. Darüber hinaus bekräftigen frühere Studien diese Erkenntnisse.",
            reading_text: "Akademisches Schreiben auf C1-C2 Niveau erfordert höchste sprachliche Präzision. Argumente müssen klar strukturiert und belegt sein. Stilmittel wie Nominalisierung und Passiv sind typisch. Quellen müssen korrekt zitiert werden. Kritisches Denken ist unerlässlich.",
            reading_qs: [
                { q: "Was erfordert akademisches Schreiben?", opts: ["Humor", "Kreativität", "Sprachliche Präzision", "Kürze"], c: 2 },
                { q: "Was ist typisch für akademischen Stil?", opts: ["Umgangssprache", "Nominalisierung und Passiv", "Dialekt", "Abkürzungen"], c: 1 },
                { q: "Was muss korrekt sein?", opts: ["Schrift", "Quellenangaben", "Länge", "Schriftart"], c: 1 }
            ]
        },
        {
            id: 'a1', emoji: '🎓', title: 'Goethe-Prüfung Vorbereitung', desc: "Goethe imtihoniga tayyorlik", level: 'C1-C2',
            words: ['die Rhetorik', 'begründen', 'analysieren', 'ausarbeiten', 'wenngleich', 'nichtsdestotrotz', 'bevorstehend', 'plausibel', 'inhärent', 'pragmatisch'],
            xp: 280, coin: 125,
            grammar_rule: "Goethe C2: Textsorten beherrschen, Stil anpassen, komplexe Strukturen verwenden.",
            grammar_example: "Infolge der steigenden Nachfrage wurde die Produktion erhöht. Dies hat weitreichende Implikationen.",
            reading_text: "Das Goethe-Zertifikat ist weltweit anerkannt. C2 ist die höchste Stufe. Es testet Hören, Lesen, Schreiben und Sprechen. Die Vorbereitung erfordert viel Übung. Authentische Materialien helfen beim Üben. Regelmäßiges Lesen von Zeitungen ist empfehlenswert.",
            reading_qs: [
                { q: "Was ist das Goethe-Zertifikat?", opts: ["Schulzeugnis", "Weltweit anerkanntes Sprachzertifikat", "Berufszeugnis", "Reisepass"], c: 1 },
                { q: "Was testet die Prüfung?", opts: ["Nur Lesen", "Nur Schreiben", "Alle vier Fertigkeiten", "Nur Sprechen"], c: 2 },
                { q: "Was ist empfehlenswert?", opts: ["Nur Bücher lesen", "Zeitungen lesen", "Nur Wörter lernen", "Nur Grammatik"], c: 1 }
            ]
        },
    ]
};

// ══════════════════════════════════════════════════════════════
// GRAMMATIK FRAGEN
// ══════════════════════════════════════════════════════════════
const GRAMMAR_QS = [
    { q: "Sie ___ jeden Tag in die Schule.", opts: ["gehen", "geht", "gehst", "gehe"], ans: "geht", exp: "3. Person Singular → geht" },
    { q: "Ich ___ schon fünf Jahre in Berlin.", opts: ["wohne", "wohnt", "wohnst", "wohnen"], ans: "wohne", exp: "1. Person Singular → wohne" },
    { q: "Der Hund ___ sehr schnell.", opts: ["läufst", "läuft", "laufen", "laufe"], ans: "läuft", exp: "Er/Sie/Es → läuft (Umlaut!)" },
    { q: "Wir ___ gestern ins Kino gegangen.", opts: ["haben", "sein", "sind", "hatten"], ans: "sind", exp: "Bewegungsverb gehen → Perfekt mit 'sein'" },
    { q: "Das ist ___ Buch meines Vaters.", opts: ["der", "die", "das", "den"], ans: "das", exp: "Buch = Neutrum → das Buch" },
    { q: "Ich kaufe ___ neuen Computer.", opts: ["ein", "eine", "einen", "einem"], ans: "einen", exp: "Computer = Maskulinum, Akkusativ → einen" },
    { q: "Er kommt ___ Deutschland.", opts: ["von", "aus", "in", "nach"], ans: "aus", exp: "Herkunft → aus + Land (ohne Artikel)" },
    { q: "Das Buch ___ von Goethe geschrieben.", opts: ["hat", "haben", "wurde", "werden"], ans: "wurde", exp: "Vorgangspassiv Präteritum → wurde + Partizip II" },
    { q: "Er ist ___ groß als sein Bruder.", opts: ["mehr", "größer", "am größten", "so"], ans: "größer", exp: "Komparativ → größer (Umlaut!)" },
    { q: "Wenn ich Zeit ___, gehe ich spazieren.", opts: ["hätte", "habe", "hat", "haben"], ans: "habe", exp: "Realer Konditionalsatz → Indikativ Präsens: habe" },
    { q: "___ dem Regen spielten wir Fußball.", opts: ["Trotzdem", "Trotz", "Wegen", "Dank"], ans: "Trotz", exp: "Trotz + Genitiv: Trotz des Regens" },
    { q: "Sie hat das Buch ___.", opts: ["gelesen", "lesen", "las", "liest"], ans: "gelesen", exp: "Perfekt → hat + Partizip II (gelesen)" },
    { q: "Das ist ___ interessanteste Buch.", opts: ["der", "die", "das", "den"], ans: "das", exp: "Superlativ mit Neutrum: das interessanteste" },
    { q: "Ich ___ nach Berlin fahren.", opts: ["muss", "musst", "müssen", "müsst"], ans: "muss", exp: "Modalverb müssen, 1. Person Singular → muss" },
    { q: "Er hat mir ___ Buch gegeben.", opts: ["ein", "eine", "einen", "dem"], ans: "ein", exp: "Dativobjekt + Akkusativobjekt → ein Buch (Akk.)" },
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
    u.lang = 'de-DE'; u.rate = 0.85;
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
        await updateDoc(doc(_db, 'users_de', CU.uid), {
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
    const aiInfo = $id('aiLimitInfo');
    if (aiInfo) {
        const pct = UP === 'ultimate' ? 100 : Math.round((UTokens / Math.max(1, UMaxTokens)) * 100);
        const color = pct > 50 ? '#2ec27e' : pct > 20 ? '#d4a843' : '#e05252';
        const plan = getPlan(); const rank = getRank();
        aiInfo.innerHTML = `
      <div style="margin-bottom:8px;font-size:.76rem;font-weight:700;color:#8fa8c8">${rank.icon} ${rank.name} · ${plan.icon} ${plan.name}</div>
      <div style="font-size:.72rem;color:#3d5a78;margin-bottom:4px">🎫 Token: <strong style="color:${color}">${UP === 'ultimate' ? '∞' : UTokens}</strong>/${UP === 'ultimate' ? '∞' : UMaxTokens}</div>
      <div style="height:4px;background:rgba(212,168,67,.08);border-radius:100px;overflow:hidden;margin-bottom:6px">
        <div style="height:100%;width:${pct}%;background:${color};border-radius:100px;transition:width .4s"></div>
      </div>
      ${UP !== 'ultimate' ? `<div style="font-size:.68rem;color:#3d5a78;margin-bottom:6px">⏱ Yangilanish: <strong>${getTokenTimeLeft()}</strong></div>` : ''}`;
    }

    const limitText = $id('limitText');
    const limitPills = $id('limitPills');
    const limitReset = $id('limitReset');

    if (UP === 'ultimate') {
        if (limitText) limitText.innerHTML = `<i class="fa-solid fa-infinity" style="margin-right:4px;color:var(--gold)"></i>Cheksiz Token`;
        if (limitPills) limitPills.innerHTML = '';
        if (limitReset) limitReset.textContent = '';
    } else {
        if (limitText) limitText.innerHTML = `KI Token: <b style="color:${UTokens > 5 ? '#2ec27e' : '#e05252'}">${UTokens}</b> / ${UMaxTokens} qoldi`;
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
// UPGRADE MODAL
// ══════════════════════════════════════════════════════════════
function showTokenEmptyModal(reason) {
    const modal = $id('upgradeModal'); if (!modal) return;
    const textEl = $id('upgradeModalText');
    const timerEl = $id('upgradeTimer');
    if (textEl) textEl.innerHTML = `🎫 Tokenlar tugadi!<br><span style="font-size:.8rem;color:#3d5a78">${reason || 'Davom etish uchun token kerak'}</span>`;
    if (timerEl) {
        const upd = () => { timerEl.textContent = `⏱ Yangilanish: ${getTokenTimeLeft()}`; };
        upd();
        const timer = setInterval(() => { upd(); if (UTokens > 0) clearInterval(timer); }, 1000);
    }
    modal.classList.add('active');
}

window.closeUpgradeModal = function () {
    const modal = $id('upgradeModal');
    if (modal) modal.classList.remove('active');
};

window.closeUnitModal = function () {
    const modal = $id('unitModal');
    if (modal) modal.classList.remove('active');
};

window.closeWordDetail = function () {
    const modal = $id('wordDetailModal');
    if (modal) modal.classList.remove('active');
};

// ══════════════════════════════════════════════════════════════
// FIREBASE LOAD / SAVE
// ══════════════════════════════════════════════════════════════
async function loadUserData() {
    if (!CU) return;
    try {
        const snap = await getDoc(doc(_db, 'users_de', CU.uid));
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
            USk = d.skills || { lesen: 0, schreiben: 0, sprechen: 0, hoeren: 0, grammatik: 0 };
            UStats = d.stats || { unitsCompleted: 0, totalSessions: 0, streak: 0 };
        } else {
            UP = 'free';
            UTokens = TOKEN_CONFIG.default_tokens;
            UMaxTokens = TOKEN_CONFIG.default_tokens;
            ULastReset = Date.now();
            const newData = {
                email: CU.email,
                displayName: CU.displayName || CU.email.split('@')[0],
                plan: 'free',
                tokens: UTokens,
                maxTokens: UMaxTokens,
                lastTokenReset: ULastReset,
                xp: 0, coins: 0, rank: 'none',
                progress: {},
                skills: { lesen: 0, schreiben: 0, sprechen: 0, hoeren: 0, grammatik: 0 },
                stats: { unitsCompleted: 0, totalSessions: 0, streak: 0 },
                createdAt: serverTimestamp()
            };
            await setDoc(doc(_db, 'users_de', CU.uid), newData);
        }
        checkTokenReset();
    } catch (e) { console.error('loadUserData error:', e); }
}

async function updateUserField(fields) {
    if (!CU) return;
    try { await updateDoc(doc(_db, 'users_de', CU.uid), { ...fields, lastActive: serverTimestamp() }); }
    catch (e) { console.warn(e); }
}

// ══════════════════════════════════════════════════════════════
// XP & COIN — FIXED updateDisplays
// ══════════════════════════════════════════════════════════════
async function awardXP(base, skill) {
    const plan = getPlan(); const rank = getRank();
    const total = Math.round(base * plan.xp_mult * rank.xp_mult);
    UXP += total;
    USk[skill] = Math.min(100, (USk[skill] || 0) + 2);
    const updates = { xp: increment(total), [`skills.${skill}`]: USk[skill] };
    await updateUserField(updates);
    updateDisplays(); showXPPop(`+${total} XP`);
}

// ─── TUZATILGAN updateDisplays ───
function updateDisplays() {
    // XP
    const xpEl = $id('xpDisplay');
    const navXP = $id('navXP');
    if (xpEl) xpEl.textContent = UXP;
    if (navXP) navXP.textContent = UXP;

    // COIN — FIXED (avval yo'q edi)
    const navCoin = $id('navCoin');
    if (navCoin) navCoin.textContent = UCoin;

    // Drawer stats — FIXED (avval yo'q edi)
    const drawerUserName = $id('drawerUserName');
    const drawerXP = $id('drawerXP');
    const drawerCoin = $id('drawerCoin');
    if (drawerUserName) drawerUserName.textContent = CU?.displayName || CU?.email || 'Foydalanuvchi';
    if (drawerXP) drawerXP.textContent = UXP;
    if (drawerCoin) drawerCoin.textContent = UCoin;

    // Plan badge
    const planBadge = $id('planBadgeNav');
    const plan = (UP || 'free').toLowerCase();
    const color = PLAN_COLORS[plan] || '#94a3b8';
    if (planBadge) planBadge.innerHTML = `<span style="padding:3px 10px;border-radius:12px;background:${color}22;border:1px solid ${color}55;color:${color};font-size:.72rem;font-weight:700">${(PLAN_LABELS[plan] || plan).toUpperCase()}</span>`;

    // Nav user info — FIXED (avval to'liq emas edi)
    const navUInfo = $id('navUserInfo');
    if (navUInfo) navUInfo.innerHTML = `
        <div style="display:flex;align-items:center;gap:8px">
            <span style="font-size:.8rem;color:#f0f4ff;font-weight:600">${CU?.displayName || CU?.email || 'User'}</span>
            <span style="font-size:.78rem;color:#e8c56a">⭐ ${UXP.toLocaleString()}</span>
            <span style="font-size:.78rem;color:#fbbf24">🪙 ${UCoin.toLocaleString()}</span>
        </div>`;

    renderTokenBar();
    drawRadar();
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
    container.innerHTML = `<div style="text-align:center;padding:30px;color:var(--text3)">
        <i class="fa-solid fa-spinner fa-spin" style="font-size:1.5rem;color:var(--accent);display:block;margin-bottom:12px"></i>
        Yuklanmoqda...
    </div>`;
    try {
        const q = query(collection(_db, 'users_de'), orderBy(field, 'desc'), limit(20));
        const snap = await getDocs(q);
        const users = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        if (!users.length) { container.innerHTML = '<p style="text-align:center;color:var(--text3)">Hali hech kim yo\'q</p>'; return; }
        const labels = { xp: 'XP', coins: 'Coin', unitsCompleted: 'Unit' };
        const icons = { xp: 'fa-star', coins: 'fa-coins', unitsCompleted: 'fa-book' };
        let html = '';
        users.forEach((u, i) => {
            const rank = i + 1;
            const isMe = u.id === CU?.uid;
            const rankIcon = rank === 1 ? '<i class="fa-solid fa-trophy" style="color:var(--gold)"></i>' :
                rank === 2 ? '<i class="fa-solid fa-medal" style="color:#94a3b8"></i>' :
                    rank === 3 ? '<i class="fa-solid fa-medal" style="color:#cd7c4a"></i>' : rank;
            const val = u[field] || 0;
            const init = (u.displayName || u.email || 'U').charAt(0).toUpperCase();
            html += `<div class="lb-row${isMe ? ' me' : ''}">
                <div class="lb-rank">${rankIcon}</div>
                <div class="lb-avatar">${init}</div>
                <div class="lb-name">${u.displayName || u.email || 'Foydalanuvchi'}${isMe ? ' <span style="color:var(--accent);font-size:.72rem">(siz)</span>' : ''}</div>
                <div class="lb-score"><i class="fa-solid ${icons[field] || 'fa-star'}" style="margin-right:4px;color:var(--accent)"></i>${val.toLocaleString()}</div>
            </div>`;
        });
        container.innerHTML = html;
    } catch (e) {
        container.innerHTML = `<div style="text-align:center;padding:30px;color:var(--red)">Xatolik: ${e.message}</div>`;
    }
};

// ══════════════════════════════════════════════════════════════
// AI
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
        const d = await r.json();
        return d.candidates?.[0]?.content?.parts?.[0]?.text || 'Javob olishda xatolik.';
    } catch (e) { return '❗ KI bilan bog\'lanishda xatolik.'; }
}

// ══════════════════════════════════════════════════════════════
// RADAR
// ══════════════════════════════════════════════════════════════
function drawRadar() {
    const canvas = $id('radarCanvas'); if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const cx = 110, cy = 110, r = 80;
    const skills = [
        USk.lesen / 100, USk.schreiben / 100, USk.sprechen / 100,
        USk.hoeren / 100, USk.grammatik / 100
    ].map(v => Math.max(0.05, v));
    const angles = Array.from({ length: 5 }, (_, i) => -Math.PI / 2 + i * Math.PI * 2 / 5);
    ctx.clearRect(0, 0, 220, 220);
    for (let i = 1; i <= 4; i++) {
        ctx.beginPath();
        angles.forEach((a, j) => {
            const x = cx + r * (i / 4) * Math.cos(a), y = cy + r * (i / 4) * Math.sin(a);
            j ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
        });
        ctx.closePath(); ctx.strokeStyle = 'rgba(212,168,67,0.1)'; ctx.stroke();
    }
    angles.forEach(a => {
        ctx.beginPath(); ctx.moveTo(cx, cy);
        ctx.lineTo(cx + r * Math.cos(a), cy + r * Math.sin(a));
        ctx.strokeStyle = 'rgba(212,168,67,0.12)'; ctx.stroke();
    });
    ctx.beginPath();
    angles.forEach((a, i) => {
        const x = cx + r * skills[i] * Math.cos(a), y = cy + r * skills[i] * Math.sin(a);
        i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    });
    ctx.closePath(); ctx.fillStyle = 'rgba(212,168,67,0.18)'; ctx.fill();
    ctx.strokeStyle = 'rgba(212,168,67,0.8)'; ctx.lineWidth = 2; ctx.stroke();
    angles.forEach((a, i) => {
        ctx.beginPath();
        ctx.arc(cx + r * skills[i] * Math.cos(a), cy + r * skills[i] * Math.sin(a), 4, 0, Math.PI * 2);
        ctx.fillStyle = '#d4a843'; ctx.fill();
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
    if (!units.length) {
        grid.innerHTML = '<div style="color:var(--text3);font-size:.9rem;padding:32px 0;text-align:center;grid-column:1/-1">Bu daraja uchun unitlar hali qo\'shilmagan.</div>';
        return;
    }
    units.forEach((unit, i) => {
        const done = ['A', 'B', 'C', 'D'].filter(l => UProg[`${unit.id}_${l}`] >= 100).length;
        const pct = Math.round((done / 4) * 100);
        const isComp = pct === 100;
        const card = document.createElement('div');
        card.className = `unit-card${isComp ? ' completed' : ''}`;
        card.innerHTML = `
      <div class="unit-card-body">
        <div style="font-size:.72rem;color:var(--accent);font-family:var(--font-head);font-weight:800;text-transform:uppercase;letter-spacing:.1em">Unit ${i + 1} · ${unit.level}</div>
        <div style="font-size:1.8rem;margin:4px 0">${unit.emoji}</div>
        <div style="font-weight:700;font-size:.95rem;color:var(--text);font-family:var(--font-display);letter-spacing:.02em;margin-bottom:4px">${unit.title}</div>
        <div style="font-size:.75rem;color:var(--text3);flex:1">${unit.desc}</div>
        <div style="display:flex;gap:5px;margin:6px 0">
          ${['A', 'B', 'C', 'D'].map(l => `<div style="width:22px;height:22px;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:.58rem;font-weight:800;background:${UProg[unit.id + '_' + l] >= 100 ? 'rgba(46,194,126,.2)' : 'rgba(212,168,67,.06)'};border:1px solid ${UProg[unit.id + '_' + l] >= 100 ? 'rgba(46,194,126,.4)' : 'rgba(212,168,67,.12)'};color:${UProg[unit.id + '_' + l] >= 100 ? '#2ec27e' : '#3d5a78'}">${l}</div>`).join('')}
        </div>
        <div style="height:2px;background:rgba(212,168,67,.08);border-radius:100px;overflow:hidden;margin:4px 0">
          <div style="height:100%;width:${pct}%;background:linear-gradient(90deg,var(--accent),var(--gold));border-radius:100px;transition:width .5s"></div>
        </div>
        <div style="display:flex;gap:10px;font-size:.65rem;font-family:var(--font-head);font-weight:700">
          <span style="color:var(--gold)">+${unit.xp} XP</span>
          <span style="color:var(--amber)">+${unit.coin} 🪙</span>
          ${isComp ? '<span style="color:var(--green)">✅</span>' : ''}
        </div>
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
    const lnames = { A: "📖 Grammatik & Wortschatz", B: "🎧 Hören", C: "📖 Lesen", D: "🎤 Sprechen & Schreiben" };
    const lcolors = { A: '#d4a843', B: '#38bdf8', C: '#2ec27e', D: '#c084fc' };
    content.innerHTML = `
    <div style="text-align:center;padding-bottom:20px">
      <div style="font-size:3rem;margin-bottom:10px">${unit.emoji}</div>
      <h2 style="font-family:var(--font-display);margin-bottom:8px">${unit.title}</h2>
      <p style="color:var(--text2)">${unit.desc}</p>
      <div style="display:flex;gap:16px;justify-content:center;margin:16px 0;flex-wrap:wrap">
        <span style="color:var(--gold)">⭐ +${unit.xp} XP</span>
        <span style="color:var(--amber)">🪙 +${unit.coin} Coin</span>
        <span style="color:var(--steel)">📚 ${unit.words.length} Wörter</span>
        <span style="color:var(--accent)">🎫 2 Token/Dars</span>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:20px">
      ${['A', 'B', 'C', 'D'].map(k => {
        const done = UProg[`${unit.id}_${k}`] >= 100;
        const sc = UProg[`score_${unit.id}_${k}`] || 0;
        return `<div onclick="window.openLesson('${unit.id}','${k}')" style="padding:16px;border-radius:12px;background:${done ? 'rgba(46,194,126,.06)' : 'rgba(212,168,67,.04)'};border:1px solid ${done ? 'rgba(46,194,126,.25)' : 'rgba(212,168,67,.1)'};cursor:pointer;transition:all .2s;text-align:center">
          <div style="font-size:1.2rem;font-weight:800;color:${lcolors[k]};margin-bottom:4px">${k}</div>
          <div style="font-size:.8rem;color:var(--text)">${lnames[k]}</div>
          ${done ? `<div style="font-size:.72rem;color:var(--green);margin-top:4px">✅ ${sc}%</div>` : '<div style="font-size:.72rem;color:var(--text3);margin-top:4px">▶ Boshlash</div>'}
        </div>`;
    }).join('')}
    </div>
    <div>
      <div style="font-size:.78rem;color:var(--text3);margin-bottom:8px">📝 Wörter:</div>
      <div style="display:flex;flex-wrap:wrap;gap:6px">
        ${unit.words.map(w => `<span onclick="window.spk('${w.replace(/'/g, "\\'")}',event)"
          style="background:rgba(212,168,67,.08);border:1px solid rgba(212,168,67,.18);
          color:var(--accent);padding:4px 10px;border-radius:20px;font-size:.75rem;
          cursor:pointer;transition:all .2s"
          onmouseover="this.style.background='rgba(212,168,67,.18)'"
          onmouseout="this.style.background='rgba(212,168,67,.08)'">${w} 🔊</span>`).join('')}
      </div>
    </div>`;
    modal.classList.add('active');
};

// ══════════════════════════════════════════════════════════════
// LESSON OPEN
// ══════════════════════════════════════════════════════════════
window.openLesson = async function (unitId, lessonKey) {
    const allUnits = Object.values(UD_DATA).flat();
    const unit = allUnits.find(u => u.id === unitId);
    if (!unit) return;

    const ok = await spendTokens(TOKEN_CONFIG.unit_cost, `"${unit.title}" darsini ochish`);
    if (!ok) return;

    curUnit = unit;
    curLesson = lessonKey;
    lScore = 0; lTotal = 0;
    lexSel = {}; rSel = {}; woAns = []; lessonMics = {};

    const modal = $id('unitModal');
    const content = $id('modalContent');
    if (!modal || !content) return;

    const lessonTitles = {
        A: '📖 Grammatik & Wortschatz',
        B: '🎧 Hören & Verstehen',
        C: '📖 Lesen & Verstehen',
        D: '🎤 Sprechen & Schreiben'
    };

    content.innerHTML = `
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px">
      <button onclick="window.openUnit(curUnit)" style="background:rgba(212,168,67,.1);border:1px solid rgba(212,168,67,.2);color:var(--accent);padding:6px 14px;border-radius:8px;cursor:pointer;font-size:.8rem">← Ortga</button>
      <div>
        <div style="font-weight:700;font-family:var(--font-display)">${unit.title} — Dars ${lessonKey}</div>
        <div style="font-size:.75rem;color:var(--text3)">${lessonTitles[lessonKey]}</div>
      </div>
    </div>
    <div id="lessonBody"></div>`;

    const body = $id('lessonBody');
    if (lessonKey === 'A') renderLessonA(unit, body);
    else if (lessonKey === 'B') renderLessonB(unit, body);
    else if (lessonKey === 'C') renderLessonC(unit, body);
    else if (lessonKey === 'D') renderLessonD(unit, body);
};

// ══════════════════════════════════════════════════════════════
// LESSON A — Grammatik & Wortschatz
// ══════════════════════════════════════════════════════════════
function renderLessonA(unit, body) {
    const words = unit.words.map(w => WDB.find(e => e.de === w)).filter(Boolean);
    lTotal = words.length + 3;

    let html = `
    <div style="background:rgba(212,168,67,.06);border:1px solid rgba(212,168,67,.15);border-radius:12px;padding:16px;margin-bottom:20px">
      <div style="font-size:.72rem;color:var(--accent);font-weight:800;text-transform:uppercase;margin-bottom:8px">📐 Grammatik Qoidasi</div>
      <div style="font-weight:700;color:var(--text);margin-bottom:6px">${unit.grammar_rule}</div>
      <div style="font-size:.82rem;color:var(--text2);font-style:italic;border-left:2px solid var(--accent);padding-left:10px">${unit.grammar_example}</div>
    </div>
    <div style="font-size:.8rem;color:var(--text3);margin-bottom:12px">🔤 So'z boyligi — har bir so'zni o'rganing:</div>
    <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:20px">`;

    words.forEach((w, i) => {
        html += `
      <div id="lexCard_${i}" style="background:rgba(255,255,255,.02);border:1px solid rgba(212,168,67,.1);border-radius:10px;padding:12px;display:flex;align-items:center;gap:12px;transition:all .3s">
        <div style="flex:1">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:3px">
            <span style="font-weight:700;color:var(--text);font-size:.95rem">${w.de}</span>
            <span onclick="window.spk('${w.de.replace(/'/g, "\\'")}',event)" style="cursor:pointer;color:var(--accent);font-size:.8rem">🔊</span>
            <span style="font-size:.65rem;color:var(--text3);background:rgba(212,168,67,.08);padding:1px 6px;border-radius:10px">${w.t}</span>
          </div>
          <div style="font-size:.78rem;color:var(--text2)">${w.u}</div>
          <div style="font-size:.72rem;color:var(--text3);font-style:italic;margin-top:3px">${w.ex}</div>
          <div style="font-size:.68rem;color:var(--steel);margin-top:1px">${w.eu}</div>
        </div>
        <div id="lexBtn_${i}" onclick="window.markLex(${i})" style="width:32px;height:32px;border-radius:50%;background:rgba(212,168,67,.08);border:1px solid rgba(212,168,67,.2);cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:.85rem;transition:all .3s">✓</div>
      </div>`;
    });

    html += `</div>
    <div style="font-size:.8rem;color:var(--text3);margin-bottom:12px">🧩 Grammatik mashqlari:</div>
    <div id="grammarExs"></div>`;

    body.innerHTML = html;
    renderGrammarExercises(unit, $id('grammarExs'));
}

window.markLex = function (i) {
    if (lexSel[i]) return;
    lexSel[i] = true;
    lScore++;
    const card = $id(`lexCard_${i}`);
    const btn = $id(`lexBtn_${i}`);
    if (card) card.style.borderColor = 'rgba(46,194,126,.4)';
    if (btn) { btn.textContent = '✅'; btn.style.background = 'rgba(46,194,126,.15)'; }
    checkLessonADone();
};

function renderGrammarExercises(unit, container) {
    if (!container) return;
    const qs = shuffle(GRAMMAR_QS).slice(0, 3);
    let html = '<div style="display:flex;flex-direction:column;gap:12px">';
    qs.forEach((q, qi) => {
        html += `
      <div id="gEx_${qi}" style="background:rgba(255,255,255,.02);border:1px solid rgba(212,168,67,.1);border-radius:10px;padding:14px">
        <div style="font-weight:600;color:var(--text);margin-bottom:10px;font-size:.88rem">${q.q}</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px">
          ${q.opts.map((o, oi) => `
            <button id="gExOpt_${qi}_${oi}" onclick="window.answerGramEx(${qi},${oi},'${q.ans.replace(/'/g, "\\'")}','${q.exp.replace(/'/g, "\\'")}')"
              style="background:rgba(212,168,67,.06);border:1px solid rgba(212,168,67,.15);color:var(--text);padding:8px;border-radius:8px;cursor:pointer;font-size:.8rem;text-align:left;transition:all .2s;font-family:var(--font-head)">
              ${o}
            </button>`).join('')}
        </div>
        <div id="gExExp_${qi}" style="display:none;font-size:.72rem;color:var(--green);margin-top:8px;padding:6px;background:rgba(46,194,126,.06);border-radius:6px"></div>
      </div>`;
    });
    html += '</div>';
    container.innerHTML = html;
    container._qs = qs;
}

window.answerGramEx = function (qi, oi, ans, exp) {
    const container = $id('grammarExs');
    if (!container || !container._qs) return;
    const q = container._qs[qi];
    if (q._answered) return;
    const chosen = q.opts[oi];
    const correct = chosen === ans;

    q.opts.forEach((_, i) => {
        const btn = $id(`gExOpt_${qi}_${i}`);
        if (!btn) return;
        btn.disabled = true;
        if (q.opts[i] === ans) {
            btn.style.background = 'rgba(46,194,126,.2)';
            btn.style.borderColor = 'rgba(46,194,126,.5)';
            btn.style.color = '#2ec27e';
        } else if (i === oi && !correct) {
            btn.style.background = 'rgba(224,82,82,.15)';
            btn.style.borderColor = 'rgba(224,82,82,.4)';
            btn.style.color = '#e05252';
        }
    });

    q._answered = true;
    if (correct) { lScore++; showXPPop('+3 XP'); }
    const expEl = $id(`gExExp_${qi}`);
    if (expEl) { expEl.style.display = 'block'; expEl.textContent = `💡 ${exp}`; }
    checkLessonADone();
};

function checkLessonADone() {
    const lexDone = Object.keys(lexSel).length >= (curUnit?.words?.length || 0);
    const container = $id('grammarExs');
    const gramDone = container?._qs ? container._qs.filter(q => q._answered).length >= 3 : false;
    if (lexDone && gramDone) {
        setTimeout(() => finishLesson('A', 'lesen'), 400);
    }
}

// ══════════════════════════════════════════════════════════════
// LESSON B — Hören & Verstehen
// ══════════════════════════════════════════════════════════════
function renderLessonB(unit, body) {
    const words = unit.words.map(w => WDB.find(e => e.de === w)).filter(Boolean);
    lTotal = words.length;

    const pairs = shuffle(words).slice(0, Math.min(8, words.length));
    const deWords = shuffle(pairs.map(p => p.de));
    const uzWords = shuffle(pairs.map(p => p.u));

    body.innerHTML = `
    <div style="margin-bottom:20px">
      <div style="font-size:.82rem;color:var(--text2);margin-bottom:8px;line-height:1.5">
        🎧 Nemischa so'zlarni tinglang va o'zbek tarjimasini toping.
      </div>
    </div>
    <div id="matchArea" style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px">
      <div>
        <div style="font-size:.72rem;color:var(--text3);font-weight:700;text-transform:uppercase;margin-bottom:8px">🇩🇪 Deutsch</div>
        <div id="deCol" style="display:flex;flex-direction:column;gap:6px"></div>
      </div>
      <div>
        <div style="font-size:.72rem;color:var(--text3);font-weight:700;text-transform:uppercase;margin-bottom:8px">🇺🇿 O'zbek</div>
        <div id="uzCol" style="display:flex;flex-direction:column;gap:6px"></div>
      </div>
    </div>
    <div id="matchScore" style="text-align:center;font-size:.8rem;color:var(--text3)">0 / ${pairs.length} juftlashtirildi</div>`;

    matchPairs = pairs;
    matchMatched = [];
    mSel = { e: null, u: null, eEl: null, uEl: null };

    const deCol = $id('deCol');
    const uzCol = $id('uzCol');

    deWords.forEach(w => {
        const btn = document.createElement('button');
        btn.dataset.de = w;
        btn.innerHTML = `<span onclick="window.spk('${w.replace(/'/g, "\\'")}',event);event.stopPropagation()" style="margin-right:4px;font-size:.8rem">🔊</span>${w}`;
        btn.style.cssText = `width:100%;background:rgba(212,168,67,.06);border:1px solid rgba(212,168,67,.15);color:var(--text);padding:8px 10px;border-radius:8px;cursor:pointer;font-size:.8rem;text-align:left;transition:all .2s;font-family:var(--font-head)`;
        btn.onclick = () => selectMatchB('de', w, btn);
        deCol.appendChild(btn);
    });

    uzWords.forEach(w => {
        const btn = document.createElement('button');
        btn.dataset.uz = w;
        btn.textContent = w;
        btn.style.cssText = `width:100%;background:rgba(56,189,248,.06);border:1px solid rgba(56,189,248,.15);color:var(--text);padding:8px 10px;border-radius:8px;cursor:pointer;font-size:.8rem;text-align:left;transition:all .2s;font-family:var(--font-head)`;
        btn.onclick = () => selectMatchB('uz', w, btn);
        uzCol.appendChild(btn);
    });
}

function selectMatchB(type, val, el) {
    if (el.disabled) return;
    if (type === 'de') {
        if (mSel.eEl) mSel.eEl.style.outline = '';
        mSel.e = val; mSel.eEl = el;
        el.style.outline = '2px solid var(--accent)';
    } else {
        if (mSel.uEl) mSel.uEl.style.outline = '';
        mSel.u = val; mSel.uEl = el;
        el.style.outline = '2px solid #38bdf8';
    }

    if (mSel.e && mSel.u) {
        const pair = matchPairs.find(p => p.de === mSel.e);
        const correct = pair && pair.u === mSel.u;
        if (correct) {
            [mSel.eEl, mSel.uEl].forEach(b => {
                b.style.background = 'rgba(46,194,126,.2)';
                b.style.borderColor = 'rgba(46,194,126,.5)';
                b.style.color = '#2ec27e';
                b.style.outline = '';
                b.disabled = true;
            });
            matchMatched.push(mSel.e);
            lScore++;
            showXPPop('+5 XP');
            const scoreEl = $id('matchScore');
            if (scoreEl) scoreEl.textContent = `${matchMatched.length} / ${matchPairs.length} juftlashtirildi`;
            if (matchMatched.length >= matchPairs.length) {
                setTimeout(() => finishLesson('B', 'hoeren'), 500);
            }
        } else {
            [mSel.eEl, mSel.uEl].forEach(b => {
                b.style.background = 'rgba(224,82,82,.1)';
                b.style.borderColor = 'rgba(224,82,82,.3)';
                b.style.outline = '';
            });
            setTimeout(() => {
                [mSel.eEl, mSel.uEl].forEach(b => {
                    b.style.background = b.dataset.de ? 'rgba(212,168,67,.06)' : 'rgba(56,189,248,.06)';
                    b.style.borderColor = b.dataset.de ? 'rgba(212,168,67,.15)' : 'rgba(56,189,248,.15)';
                });
                mSel = { e: null, u: null, eEl: null, uEl: null };
            }, 700);
            return;
        }
        mSel = { e: null, u: null, eEl: null, uEl: null };
    }
}

// ══════════════════════════════════════════════════════════════
// LESSON C — Lesen & Verstehen
// ══════════════════════════════════════════════════════════════
function renderLessonC(unit, body) {
    lTotal = unit.reading_qs.length;
    rSel = {};

    body.innerHTML = `
    <div style="background:rgba(56,189,248,.05);border:1px solid rgba(56,189,248,.15);border-radius:12px;padding:16px;margin-bottom:20px;line-height:1.7;font-size:.87rem;color:var(--text2)">
      <div style="font-size:.7rem;color:#38bdf8;font-weight:800;text-transform:uppercase;margin-bottom:10px">📖 Matn</div>
      ${unit.reading_text}
    </div>
    <div style="font-size:.8rem;color:var(--text3);margin-bottom:12px">❓ Savollarga javob bering:</div>
    <div id="readQs" style="display:flex;flex-direction:column;gap:14px"></div>`;

    const container = $id('readQs');
    unit.reading_qs.forEach((q, qi) => {
        const div = document.createElement('div');
        div.style.cssText = `background:rgba(255,255,255,.02);border:1px solid rgba(212,168,67,.1);border-radius:10px;padding:14px`;
        div.innerHTML = `
      <div style="font-weight:600;color:var(--text);margin-bottom:10px;font-size:.88rem">${qi + 1}. ${q.q}</div>
      <div style="display:flex;flex-direction:column;gap:6px">
        ${q.opts.map((o, oi) => `
          <button id="rOpt_${qi}_${oi}" onclick="window.answerRead(${qi},${oi},${q.c})"
            style="background:rgba(212,168,67,.05);border:1px solid rgba(212,168,67,.12);color:var(--text);padding:9px 12px;border-radius:8px;cursor:pointer;font-size:.82rem;text-align:left;transition:all .2s;font-family:var(--font-head)">
            ${String.fromCharCode(65 + oi)}) ${o}
          </button>`).join('')}
      </div>
      <div id="rExp_${qi}" style="display:none;margin-top:8px;font-size:.72rem;border-radius:6px;padding:5px 8px"></div>`;
        container.appendChild(div);
    });
}

window.answerRead = function (qi, oi, correct) {
    if (rSel[qi] !== undefined) return;
    rSel[qi] = oi;
    const isCorrect = oi === correct;
    const q = curUnit.reading_qs[qi];

    q.opts.forEach((_, i) => {
        const btn = $id(`rOpt_${qi}_${i}`);
        if (!btn) return;
        btn.disabled = true;
        if (i === correct) {
            btn.style.background = 'rgba(46,194,126,.2)';
            btn.style.borderColor = 'rgba(46,194,126,.5)';
            btn.style.color = '#2ec27e';
        } else if (i === oi) {
            btn.style.background = 'rgba(224,82,82,.15)';
            btn.style.borderColor = 'rgba(224,82,82,.4)';
            btn.style.color = '#e05252';
        }
    });

    if (isCorrect) { lScore++; showXPPop('+8 XP'); }
    const expEl = $id(`rExp_${qi}`);
    if (expEl) {
        expEl.style.display = 'block';
        expEl.textContent = isCorrect ? '✅ To\'g\'ri!' : `❌ To\'g\'ri javob: ${q.opts[correct]}`;
        expEl.style.color = isCorrect ? '#2ec27e' : '#e05252';
    }

    if (Object.keys(rSel).length >= curUnit.reading_qs.length) {
        setTimeout(() => finishLesson('C', 'lesen'), 500);
    }
};

// ══════════════════════════════════════════════════════════════
// LESSON D — Sprechen & Schreiben
// ══════════════════════════════════════════════════════════════
function renderLessonD(unit, body) {
    const words = unit.words.map(w => WDB.find(e => e.de === w)).filter(Boolean);
    const selected = shuffle(words).slice(0, Math.min(5, words.length));
    lTotal = selected.length;
    woAns = new Array(selected.length).fill('');

    body.innerHTML = `
    <div style="font-size:.82rem;color:var(--text2);margin-bottom:16px;line-height:1.5">
      ✍️ Quyidagi so'zlarni nemischa yozing.
    </div>
    <div id="writeArea" style="display:flex;flex-direction:column;gap:14px"></div>
    <button id="checkWriteBtn" onclick="window.checkWriting()" style="margin-top:20px;width:100%;padding:12px;background:linear-gradient(135deg,var(--accent),var(--gold));border:none;color:#0a0e1a;font-weight:800;border-radius:10px;cursor:pointer;font-size:.9rem;font-family:var(--font-head)">
      ✅ Tekshirish
    </button>`;

    const area = $id('writeArea');
    selected.forEach((w, i) => {
        const div = document.createElement('div');
        div.style.cssText = `background:rgba(255,255,255,.02);border:1px solid rgba(212,168,67,.1);border-radius:10px;padding:14px`;
        div.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
        <div style="font-size:.82rem;color:var(--text2)">${w.u} <span style="color:var(--text3);font-size:.72rem">(${w.t})</span></div>
        <div style="font-size:.72rem;color:var(--text3)">${w.eu}</div>
      </div>
      <input id="writeInp_${i}" type="text" placeholder="Nemischa yozing..."
        style="width:100%;background:rgba(212,168,67,.05);border:1px solid rgba(212,168,67,.18);color:var(--text);padding:9px 12px;border-radius:8px;font-size:.88rem;outline:none;box-sizing:border-box;font-family:var(--font-head)"
        oninput="woAns[${i}]=this.value">
      <div id="writeFb_${i}" style="display:none;margin-top:6px;font-size:.72rem;border-radius:6px;padding:5px 8px"></div>`;
        area.appendChild(div);
        div._word = w;
    });

    area._words = selected;
}

window.checkWriting = function () {
    const area = $id('writeArea');
    if (!area || !area._words) return;
    lScore = 0;

    area._words.forEach((w, i) => {
        const inp = $id(`writeInp_${i}`);
        const fb = $id(`writeFb_${i}`);
        if (!inp || !fb) return;
        inp.disabled = true;

        const typed = (inp.value || '').trim();
        const correct = w.de.toLowerCase().trim();
        const given = typed.toLowerCase();
        const isCorrect = given === correct;

        if (isCorrect) {
            lScore++;
            inp.style.borderColor = 'rgba(46,194,126,.5)';
            inp.style.background = 'rgba(46,194,126,.08)';
            fb.style.display = 'block';
            fb.style.background = 'rgba(46,194,126,.08)';
            fb.style.color = '#2ec27e';
            fb.textContent = '✅ Bravoo! To\'g\'ri!';
        } else {
            inp.style.borderColor = 'rgba(224,82,82,.4)';
            inp.style.background = 'rgba(224,82,82,.06)';
            fb.style.display = 'block';
            fb.style.background = 'rgba(224,82,82,.06)';
            fb.style.color = '#e05252';
            fb.textContent = `❌ To\'g\'ri: "${w.de}"`;
        }
    });

    const btn = $id('checkWriteBtn');
    if (btn) btn.style.display = 'none';

    setTimeout(() => finishLesson('D', 'schreiben'), 800);
};

// ══════════════════════════════════════════════════════════════
// FINISH LESSON
// ══════════════════════════════════════════════════════════════
async function finishLesson(key, skill) {
    if (!curUnit) return;
    const pct = lTotal > 0 ? Math.round((lScore / lTotal) * 100) : 100;
    const progKey = `${curUnit.id}_${key}`;
    const scoreKey = `score_${curUnit.id}_${key}`;
    const passed = pct >= 60;

    UProg[progKey] = passed ? 100 : Math.max(UProg[progKey] || 0, pct);
    UProg[scoreKey] = pct;

    await updateUserField({
        [`progress.${progKey}`]: UProg[progKey],
        [`progress.${scoreKey}`]: pct,
    });

    if (passed) {
        await awardXP(curUnit.xp, skill);
        UCoin += curUnit.coin;
        await updateUserField({ coins: increment(curUnit.coin) });
        UStats.unitsCompleted = (UStats.unitsCompleted || 0) + 1;
        await updateUserField({ 'stats.unitsCompleted': increment(1) });
    }

    const allDone = ['A', 'B', 'C', 'D'].every(l => UProg[`${curUnit.id}_${l}`] >= 100);

    const body = $id('lessonBody');
    if (!body) return;
    body.innerHTML = `
    <div style="text-align:center;padding:30px 10px">
      <div style="font-size:3.5rem;margin-bottom:16px">${passed ? '🎉' : '💪'}</div>
      <div style="font-size:1.3rem;font-weight:800;font-family:var(--font-display);color:var(--text);margin-bottom:8px">
        ${passed ? 'Ajoyib natija!' : 'Yaxshi urinish!'}
      </div>
      <div style="font-size:2rem;font-weight:900;color:${passed ? '#2ec27e' : 'var(--accent)'};font-family:var(--font-head);margin-bottom:8px">
        ${pct}%
      </div>
      <div style="font-size:.82rem;color:var(--text3);margin-bottom:20px">
        ${lScore} / ${lTotal} to\'g\'ri javob
      </div>
      ${passed ? `
      <div style="display:flex;justify-content:center;gap:16px;margin-bottom:20px;flex-wrap:wrap">
        <div style="background:rgba(46,194,126,.1);border:1px solid rgba(46,194,126,.25);border-radius:10px;padding:10px 18px">
          <div style="font-size:.68rem;color:#2ec27e;font-weight:700">XP QOZONILDI</div>
          <div style="font-size:1.1rem;font-weight:800;color:#2ec27e">+${Math.round(curUnit.xp * getPlan().xp_mult * getRank().xp_mult)}</div>
        </div>
        <div style="background:rgba(251,191,36,.1);border:1px solid rgba(251,191,36,.25);border-radius:10px;padding:10px 18px">
          <div style="font-size:.68rem;color:var(--gold);font-weight:700">COIN QOZONILDI</div>
          <div style="font-size:1.1rem;font-weight:800;color:var(--gold)">+${curUnit.coin}</div>
        </div>
      </div>` : `
      <div style="font-size:.8rem;color:var(--text3);margin-bottom:20px">O\'tish uchun 60% kerak. Qayta urinib ko\'ring!</div>`}
      ${allDone ? '<div style="background:rgba(212,168,67,.1);border:1px solid rgba(212,168,67,.3);border-radius:10px;padding:10px;margin-bottom:16px;font-size:.82rem;color:var(--gold)">🏆 Bu unit to\'liq yakunlandi!</div>' : ''}
      <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap">
        ${!passed ? `<button onclick="window.openLesson('${curUnit.id}','${key}')" style="padding:10px 20px;background:rgba(212,168,67,.1);border:1px solid rgba(212,168,67,.25);color:var(--accent);border-radius:8px;cursor:pointer;font-weight:700;font-family:var(--font-head)">🔄 Qayta</button>` : ''}
        <button onclick="window.openUnit(curUnit)" style="padding:10px 20px;background:linear-gradient(135deg,var(--accent),var(--gold));border:none;color:#0a0e1a;border-radius:8px;cursor:pointer;font-weight:800;font-family:var(--font-head)">← Unit ga qaytish</button>
      </div>
    </div>`;

    renderUnits();
    updateDisplays();
}

// ══════════════════════════════════════════════════════════════
// DICTIONARY (Wörterbuch)
// ══════════════════════════════════════════════════════════════
window.renderDict = function () {
    wOff = 0;
    applyDictFilter();
};

function applyDictFilter() {
    let words = [...WDB];
    if (wFilt !== 'all') words = words.filter(w => w.l === wFilt);
    if (wSrch) {
        const s = wSrch.toLowerCase();
        words = words.filter(w =>
            w.de.toLowerCase().includes(s) ||
            w.u.toLowerCase().includes(s) ||
            w.ex.toLowerCase().includes(s)
        );
    }
    renderDictPage(words);
}

function renderDictPage(words) {
    const grid = $id('dictGrid');
    const counter = $id('dictCounter');
    if (!grid) return;
    if (counter) counter.textContent = `${words.length} so'z`;

    const page = words.slice(wOff, wOff + 40);
    const levelColors = {
        beginner: '#2ec27e', elementary: '#38bdf8',
        intermediate: '#d4a843', upperintermediate: '#c084fc', advanced: '#e05252'
    };
    const levelNames = {
        beginner: 'A1', elementary: 'A2',
        intermediate: 'B1', upperintermediate: 'B2', advanced: 'C1+'
    };

    grid.innerHTML = page.map(w => `
    <div class="dict-card" onclick="window.showWordDetail('${w.de.replace(/'/g, "\\'")}')">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px">
        <div style="display:flex;align-items:center;gap:6px">
          <span style="font-weight:800;font-size:.95rem;color:var(--text)">${w.de}</span>
          <span onclick="window.spk('${w.de.replace(/'/g, "\\'")}',event)" style="font-size:.8rem;cursor:pointer;color:var(--accent)">🔊</span>
        </div>
        <span style="font-size:.6rem;padding:2px 7px;border-radius:10px;font-weight:700;background:${levelColors[w.l]}22;color:${levelColors[w.l]};border:1px solid ${levelColors[w.l]}44">${levelNames[w.l] || w.l}</span>
      </div>
      <div style="font-size:.78rem;color:var(--text2);margin-bottom:4px">${w.u}</div>
      <div style="font-size:.68rem;color:var(--text3);background:rgba(212,168,67,.04);border-radius:6px;padding:4px 6px;font-style:italic">${w.ex}</div>
    </div>`).join('');

    const total = words.length;
    const hasMore = wOff + 40 < total;
    const hasPrev = wOff > 0;
    const pagDiv = $id('dictPag');
    if (pagDiv) {
        pagDiv.innerHTML = `
      <div style="display:flex;gap:10px;justify-content:center;align-items:center;margin-top:16px">
        ${hasPrev ? `<button onclick="wOff-=40;applyDictFilter()" style="padding:6px 16px;background:rgba(212,168,67,.1);border:1px solid rgba(212,168,67,.2);color:var(--accent);border-radius:8px;cursor:pointer;font-size:.8rem;font-family:var(--font-head)">← Oldingi</button>` : ''}
        <span style="font-size:.75rem;color:var(--text3)">${wOff + 1}–${Math.min(wOff + 40, total)} / ${total}</span>
        ${hasMore ? `<button onclick="wOff+=40;applyDictFilter()" style="padding:6px 16px;background:rgba(212,168,67,.1);border:1px solid rgba(212,168,67,.2);color:var(--accent);border-radius:8px;cursor:pointer;font-size:.8rem;font-family:var(--font-head)">Keyingi →</button>` : ''}
      </div>`;
    }
}

window.showWordDetail = function (de) {
    const w = WDB.find(x => x.de === de);
    if (!w) return;
    const modal = $id('wordDetailModal');
    if (!modal) { showToast(`${w.de} — ${w.u}`, 'info'); return; }
    $id('wdDe').textContent = w.de;
    $id('wdUz').textContent = w.u;
    $id('wdType').textContent = w.t;
    $id('wdEx').textContent = w.ex;
    $id('wdEu').textContent = w.eu;
    modal.classList.add('active');
    window.spk(w.de);
};

window.filterDict = function (level, btn) {
    wFilt = level;
    document.querySelectorAll('.dict-filter-btn').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    wOff = 0;
    applyDictFilter();
};

window.searchDict = function (val) {
    wSrch = val;
    wOff = 0;
    applyDictFilter();
};

// ══════════════════════════════════════════════════════════════
// AI CHAT — FIXED (chatBox → chatMessages)
// ══════════════════════════════════════════════════════════════
window.sendChat = async function () {
    const inp = $id('chatInput');
    if (!inp) return;
    const msg = inp.value.trim();
    if (!msg) return;

    const ok = await spendTokens(TOKEN_CONFIG.ai_cost, 'AI suhbat');
    if (!ok) return;

    inp.value = '';
    chatHist.push({ role: 'user', content: msg });
    renderChatMessages();

    const sysPrompt = chatMode === 'grammar'
        ? 'Du bist ein Deutschlehrer. Erkläre Grammatikregeln auf Usbekisch und Deutsch. Antworte kurz und klar.'
        : chatMode === 'translate'
            ? 'Du bist ein Übersetzer Deutsch-Usbekisch. Übersetze präzise und erkläre kurz.'
            : 'Du bist ein freundlicher Deutschlehrer. Hilf dem Benutzer, Deutsch zu lernen. Antworte auf Usbekisch und Deutsch.';

    const histForAI = chatHist.slice(-10).map(m => `${m.role === 'user' ? 'Benutzer' : 'Assistent'}: ${m.content}`).join('\n');
    const fullPrompt = `${sysPrompt}\n\n${histForAI}`;

    const reply = await callAI(fullPrompt);
    chatHist.push({ role: 'assistant', content: reply });
    renderChatMessages();
    await awardXP(3, 'sprechen');
};

// FIXED: 'chatBox' → 'chatMessages'
function renderChatMessagesw() {
    const box = $id('chatMessages');
    if (!box) return;
    box.innerHTML = chatHist.map(m => `
    <div style="display:flex;${m.role === 'user' ? 'justify-content:flex-end' : ''};margin-bottom:12px">
      <div style="max-width:80%;padding:10px 14px;border-radius:${m.role === 'user' ? '14px 14px 4px 14px' : '14px 14px 14px 4px'};background:${m.role === 'user' ? 'linear-gradient(135deg,var(--accent),var(--gold))' : 'rgba(255,255,255,.04)'};color:${m.role === 'user' ? '#0a0e1a' : 'var(--text)'};font-size:.84rem;line-height:1.6;border:${m.role === 'user' ? 'none' : '1px solid rgba(212,168,67,.12)'}">
        ${m.content.replace(/\n/g, '<br>')}
      </div>
    </div>`).join('');
    box.scrollTop = box.scrollHeight;
}

window.setChatMode = function (mode, btn) {
    chatMode = mode;
    document.querySelectorAll('.chat-mode-btn').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
};

window.clearChat = function () {
    chatHist = [];
    renderChatMessages();
};

// ══════════════════════════════════════════════════════════════
// AUTH STATE — FIXED (to'liq updateDisplays chaqiriladi)
// German.js ni shu bilan almashtiring:
onAuthStateChanged(_auth, async (user) => {

    if (!user) { window.location.href = '../auth/login.html'; return; }

    if (!user) { window.location.href = '../index.html'; return; }
    CU = user;
    await loadUserData();
    updateDisplays();
    renderTokenBar();
    renderUnits();
    window.renderDict();
    initFlashcards();
    initQuiz();
    initMatch();
    initTyping();
    initGrammar();
    drawRadar();

    const chatInput = $id('chatInput');
    if (chatInput) {
        chatInput.addEventListener('keydown', e => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                window.sendChat();
            }
        });
    }

    setTimeout(() => window.loadLBSection('xp', $id('lb-xp-btn')), 800);
});  // ← TO'G'RI YOPILGAN
// ══════════════════════════════════════════════════════════════
// LOGOUT
// ══════════════════════════════════════════════════════════════
window.logOut = async function () {
    try {
        const { signOut } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js");
        await signOut(_auth);
        showToast('Chiqildi ✓', 'info');
        setTimeout(() => { window.location.href = '../index.html'; }, 1000);
    } catch (e) {
        console.error('Logout error:', e);
    }
};

// ══════════════════════════════════════════════════════════════
// MODAL BACKDROP CLOSE
// ══════════════════════════════════════════════════════════════
document.addEventListener('click', e => {
    if (e.target.id === 'unitModal') window.closeUnitModal();
    if (e.target.id === 'upgradeModal') window.closeUpgradeModal();
    if (e.target.id === 'wordDetailModal') window.closeWordDetail();
});

// Chat Enter key
document.addEventListener('DOMContentLoaded', () => {
    const ci = $id('chatInput');
    if (ci) {
        ci.addEventListener('keydown', e => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                window.sendChat();
            }
        });
    }
});

console.log('✅ German.js FIXED VERSION yuklandi — barcha muammolar hal qilindi.');