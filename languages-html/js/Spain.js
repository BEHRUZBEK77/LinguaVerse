// =====================================================
// Spanish.js — LinguaVerse (Español kursi — 100% to'liq)
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
let chatMode = 'libre';
let curLevel = 'principiante';
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
// WORDS DATABASE — ESPAÑOL
// ══════════════════════════════════════════════════════════════
const WDB = [
    // PRINCIPIANTE (A1)
    { e: 'hola', u: 'Salom', t: 'interjección', l: 'principiante', ex: '¡Hola! ¿Cómo estás?', eu: "Salom! Qandaysiz?" },
    { e: 'adiós', u: 'Xayr', t: 'interjección', l: 'principiante', ex: '¡Adiós, hasta mañana!', eu: "Xayr, ertaga ko'rishamiz!" },
    { e: 'gracias', u: 'Rahmat', t: 'interjección', l: 'principiante', ex: 'Gracias por tu ayuda.', eu: "Yordaming uchun rahmat." },
    { e: 'por favor', u: 'Iltimos', t: 'frase', l: 'principiante', ex: '¿Puedes ayudarme, por favor?', eu: "Iltimos, yordam bera olasanmi?" },
    { e: 'perdón', u: 'Kechirasiz', t: 'interjección', l: 'principiante', ex: 'Perdón por llegar tarde.', eu: "Kech qolganimdan kechirim so'rayman." },
    { e: 'sí', u: 'Ha', t: 'adverbio', l: 'principiante', ex: 'Sí, estoy de acuerdo.', eu: "Ha, roziman." },
    { e: 'no', u: "Yo'q", t: 'adverbio', l: 'principiante', ex: 'No, no creo.', eu: "Yo'q, menimcha bunday emas." },
    { e: 'bueno', u: 'Yaxshi', t: 'adjetivo', l: 'principiante', ex: '¡Buenos días a todos!', eu: "Hammaga xayrli tong!" },
    { e: 'malo', u: 'Yomon', t: 'adjetivo', l: 'principiante', ex: 'El tiempo está malo hoy.', eu: "Bugun havo yomon." },
    { e: 'grande', u: 'Katta', t: 'adjetivo', l: 'principiante', ex: 'Esta es una casa grande.', eu: "Bu katta uy." },
    { e: 'pequeño', u: 'Kichik', t: 'adjetivo', l: 'principiante', ex: 'Tengo un perro pequeño.', eu: "Menda kichik it bor." },
    { e: 'feliz', u: 'Xursand', t: 'adjetivo', l: 'principiante', ex: '¡Estoy muy feliz hoy!', eu: "Bugun juda xursandman!" },
    { e: 'triste', u: "Qayg'li", t: 'adjetivo', l: 'principiante', ex: 'Ella parece triste hoy.', eu: "U bugun qayg'li ko'rinadi." },
    { e: 'caliente', u: 'Issiq', t: 'adjetivo', l: 'principiante', ex: 'Hace mucho calor afuera.', eu: "Tashqarida juda issiq." },
    { e: 'frío', u: 'Sovuq', t: 'adjetivo', l: 'principiante', ex: 'El agua está fría.', eu: "Suv sovuq." },
    { e: 'rojo', u: 'Qizil', t: 'adjetivo', l: 'principiante', ex: 'Me gustan las manzanas rojas.', eu: "Men qizil olmalarni yaxshi ko'raman." },
    { e: 'azul', u: "Ko'k", t: 'adjetivo', l: 'principiante', ex: 'El cielo es azul.', eu: "Osmon ko'k." },
    { e: 'verde', u: 'Yashil', t: 'adjetivo', l: 'principiante', ex: 'La hierba es verde.', eu: "O't yashil." },
    { e: 'amarillo', u: 'Sariq', t: 'adjetivo', l: 'principiante', ex: 'El sol es amarillo.', eu: "Quyosh sariq." },
    { e: 'negro', u: 'Qora', t: 'adjetivo', l: 'principiante', ex: 'Mi gato es negro.', eu: "Mening mushugim qora." },
    { e: 'blanco', u: 'Oq', t: 'adjetivo', l: 'principiante', ex: 'La nieve es blanca.', eu: "Qor oq." },
    { e: 'uno', u: 'Bir', t: 'número', l: 'principiante', ex: 'Tengo una hermana.', eu: "Menda bir singil bor." },
    { e: 'dos', u: 'Ikki', t: 'número', l: 'principiante', ex: 'Tengo dos gatos.', eu: "Menda ikki mushuk bor." },
    { e: 'tres', u: 'Uch', t: 'número', l: 'principiante', ex: 'Ella tiene tres libros.', eu: "Uning uch kitobi bor." },
    { e: 'cuatro', u: "To'rt", t: 'número', l: 'principiante', ex: 'Hay cuatro estaciones.', eu: "To'rtta fasl bor." },
    { e: 'cinco', u: 'Besh', t: 'número', l: 'principiante', ex: 'Tengo cinco dedos.', eu: "Menda besh barmoq bor." },
    { e: 'madre', u: 'Ona', t: 'sustantivo', l: 'principiante', ex: 'Mi madre es profesora.', eu: "Onam o'qituvchi." },
    { e: 'padre', u: 'Ota', t: 'sustantivo', l: 'principiante', ex: 'Mi padre trabaja mucho.', eu: "Otam qattiq ishlaydi." },
    { e: 'hermana', u: 'Singil/Opa', t: 'sustantivo', l: 'principiante', ex: 'Mi hermana tiene 10 años.', eu: "Singlim 10 yoshda." },
    { e: 'hermano', u: 'Aka/Uka', t: 'sustantivo', l: 'principiante', ex: 'A mi hermano le gusta el fútbol.', eu: "Akam futbolni yaxshi ko'radi." },
    { e: 'agua', u: 'Suv', t: 'sustantivo', l: 'principiante', ex: 'Por favor, dame agua.', eu: "Iltimos, menga suv bering." },
    { e: 'comida', u: 'Ovqat', t: 'sustantivo', l: 'principiante', ex: 'La comida está deliciosa.', eu: "Ovqat mazali." },
    { e: 'manzana', u: 'Olma', t: 'sustantivo', l: 'principiante', ex: 'Como una manzana cada día.', eu: "Men har kuni olma yeyman." },
    { e: 'pan', u: 'Non', t: 'sustantivo', l: 'principiante', ex: 'Ella hace pan fresco.', eu: "U yangi non yopadi." },
    { e: 'escuela', u: 'Maktab', t: 'sustantivo', l: 'principiante', ex: 'Voy a la escuela cada día.', eu: "Men har kuni maktabga boraman." },
    { e: 'libro', u: 'Kitob', t: 'sustantivo', l: 'principiante', ex: 'Este es un libro interesante.', eu: "Bu qiziqarli kitob." },
    { e: 'perro', u: 'It', t: 'sustantivo', l: 'principiante', ex: 'Tengo un perro amigable.', eu: "Menda mehribon it bor." },
    { e: 'gato', u: 'Mushuk', t: 'sustantivo', l: 'principiante', ex: 'El gato está durmiendo.', eu: "Mushuk uxlayapti." },
    { e: 'casa', u: 'Uy', t: 'sustantivo', l: 'principiante', ex: 'Vivo en una casa grande.', eu: "Men katta uyda yashayman." },
    { e: 'coche', u: 'Avtomobil', t: 'sustantivo', l: 'principiante', ex: 'Mi padre tiene un coche rojo.', eu: "Otamning qizil mashinasi bor." },
    { e: 'correr', u: 'Yugurmaq', t: 'verbo', l: 'principiante', ex: 'Ella corre cada mañana.', eu: "U har ertalab yuguradi." },
    { e: 'comer', u: 'Yemoq', t: 'verbo', l: 'principiante', ex: 'Cenamos a las 7.', eu: "Biz soat 7 da kechki ovqat yeymiz." },
    { e: 'beber', u: 'Ichmoq', t: 'verbo', l: 'principiante', ex: 'Él bebe café.', eu: "U qahva ichadi." },
    { e: 'dormir', u: 'Uxlamoq', t: 'verbo', l: 'principiante', ex: 'Los niños duermen temprano.', eu: "Bolalar erta uxlashadi." },
    { e: 'leer', u: "O'qimoq", t: 'verbo', l: 'principiante', ex: 'Me encanta leer libros.', eu: "Kitob o'qishni yaxshi ko'raman." },
    { e: 'escribir', u: 'Yozmoq', t: 'verbo', l: 'principiante', ex: 'Por favor escribe tu nombre.', eu: "Iltimos, ismingizni yozing." },
    { e: 'caminar', u: 'Yurmoq', t: 'verbo', l: 'principiante', ex: 'Camino a la escuela.', eu: "Men maktabga yayov boraman." },
    { e: 'hablar', u: 'Gapirmoq', t: 'verbo', l: 'principiante', ex: 'Ella habla español bien.', eu: "U ispaniyachani yaxshi gapiradi." },
    { e: 'escuchar', u: 'Eshitmoq', t: 'verbo', l: 'principiante', ex: 'Por favor escucha con atención.', eu: "Iltimos, diqqat bilan eshiting." },
    { e: 'jugar', u: "O'ynamoq", t: 'verbo', l: 'principiante', ex: 'A los niños les encanta jugar.', eu: "Bolalar o'ynashni yaxshi ko'rishadi." },
    { e: 'lunes', u: 'Dushanba', t: 'sustantivo', l: 'principiante', ex: 'El lunes es el primer día de la semana.', eu: "Dushanba haftaning birinchi kuni." },
    { e: 'martes', u: 'Seshanba', t: 'sustantivo', l: 'principiante', ex: 'Tengo clase el martes.', eu: "Seshanba kuni darsim bor." },
    { e: 'miércoles', u: 'Chorshanba', t: 'sustantivo', l: 'principiante', ex: 'Nos reunimos cada miércoles.', eu: "Biz har chorshanba uchrashAmiz." },
    { e: 'jueves', u: 'Payshanba', t: 'sustantivo', l: 'principiante', ex: 'El jueves es mi día favorito.', eu: "Payshanba mening sevimli kunim." },
    { e: 'viernes', u: 'Juma', t: 'sustantivo', l: 'principiante', ex: 'El viernes terminamos pronto.', eu: "Juma kuni biz erta tugatamiz." },
    { e: 'sábado', u: 'Shanba', t: 'sustantivo', l: 'principiante', ex: 'Descanso el sábado.', eu: "Shanba kuni dam olaman." },
    { e: 'domingo', u: 'Yakshanba', t: 'sustantivo', l: 'principiante', ex: 'El domingo es día de descanso.', eu: "Yakshanba dam olish kuni." },
    { e: 'mañana', u: 'Ertalab', t: 'sustantivo', l: 'principiante', ex: 'Me despierto cada mañana.', eu: "Men har ertalab uyg'onaman." },
    { e: 'noche', u: 'Kecha/Kechqurun', t: 'sustantivo', l: 'principiante', ex: 'Buenas noches, duerme bien.', eu: "Yaxshi kechalar, yaxshi uxlang." },
    { e: 'día', u: 'Kun', t: 'sustantivo', l: 'principiante', ex: '¡Que tengas un buen día!', eu: "Yaxshi kun!" },
    { e: 'año', u: 'Yil', t: 'sustantivo', l: 'principiante', ex: 'Este año es especial.', eu: "Bu yil alohida." },
    { e: 'tiempo', u: 'Vaqt/Ob-havo', t: 'sustantivo', l: 'principiante', ex: '¿Qué hora es?', eu: "Soat necha bo'ldi?" },
    { e: 'nombre', u: 'Ism', t: 'sustantivo', l: 'principiante', ex: 'Mi nombre es Carlos.', eu: "Mening ismim Carlos." },
    { e: 'ciudad', u: 'Shahar', t: 'sustantivo', l: 'principiante', ex: 'Madrid es una gran ciudad.', eu: "Madrid katta shahar." },
    { e: 'país', u: 'Mamlakat', t: 'sustantivo', l: 'principiante', ex: 'España es mi país.', eu: "Ispaniya mening mamlakatim." },
    { e: 'sol', u: 'Quyosh', t: 'sustantivo', l: 'principiante', ex: 'El sol brilla hoy.', eu: "Bugun quyosh chiqyapti." },
    { e: 'flor', u: 'Gul', t: 'sustantivo', l: 'principiante', ex: 'Ella tiene flores hermosas.', eu: "Uning chiroyli gullari bor." },
    { e: 'árbol', u: 'Daraxt', t: 'sustantivo', l: 'principiante', ex: 'El árbol es muy alto.', eu: "Daraxt juda baland." },
    { e: 'pájaro', u: 'Qush', t: 'sustantivo', l: 'principiante', ex: 'El pájaro está cantando.', eu: "Qush sayrAyapti." },
    { e: 'pez', u: 'Baliq', t: 'sustantivo', l: 'principiante', ex: 'Me gusta comer pescado.', eu: "Men baliq yeyishni yaxshi ko'raman." },
    { e: 'nuevo', u: 'Yangi', t: 'adjetivo', l: 'principiante', ex: 'Tengo un teléfono nuevo.', eu: "Mening yangi telefonim bor." },
    { e: 'viejo', u: 'Eski/Qari', t: 'adjetivo', l: 'principiante', ex: 'Este es un edificio viejo.', eu: "Bu eski bino." },
    { e: 'alto', u: 'Baland/Uzun', t: 'adjetivo', l: 'principiante', ex: 'Él es muy alto.', eu: "U juda baland bo'yli." },
    { e: 'rápido', u: 'Tez', t: 'adjetivo', l: 'principiante', ex: 'El coche es muy rápido.', eu: "Mashina juda tez." },
    { e: 'lento', u: 'Sekin', t: 'adjetivo', l: 'principiante', ex: 'La tortuga se mueve lentamente.', eu: "Toshbaqa sekin yuradi." },
    { e: 'abierto', u: 'Ochiq', t: 'adjetivo', l: 'principiante', ex: 'La puerta está abierta.', eu: "Eshik ochiq." },
    { e: 'cerrado', u: 'Yopiq', t: 'adjetivo', l: 'principiante', ex: 'La tienda está cerrada.', eu: "Do'kon yopiq." },
    { e: 'amar', u: 'Sevmoq', t: 'verbo', l: 'principiante', ex: 'Amo a mi familia.', eu: "Men oilamni sevaman." },
    { e: 'querer', u: 'Xohlamoq/Sevmoq', t: 'verbo', l: 'principiante', ex: 'Quiero irme a casa.', eu: "Men uyga ketmoqchiman." },
    { e: 'saber', u: 'Bilmoq', t: 'verbo', l: 'principiante', ex: '¿La conoces?', eu: "Uni bilasizmi?" },
    { e: 'ver', u: "Ko'rmoq", t: 'verbo', l: 'principiante', ex: 'Puedo ver una montaña.', eu: "Men tog'ni ko'ra olaman." },
    { e: 'venir', u: 'Kelmoq', t: 'verbo', l: 'principiante', ex: 'Por favor ven aquí.', eu: "Iltimos, bu yerga keling." },
    { e: 'ir', u: 'Bormoq', t: 'verbo', l: 'principiante', ex: 'Vamos al parque.', eu: "Keling, parkka boramiz." },
    { e: 'dar', u: 'Bermoq', t: 'verbo', l: 'principiante', ex: 'Dame ese libro.', eu: "Menga o'sha kitobni bering." },
    { e: 'ayudar', u: 'Yordam bermoq', t: 'verbo', l: 'principiante', ex: '¿Puedes ayudarme?', eu: "Menga yordam bera olasizmi?" },
    { e: 'trabajar', u: 'Ishlash', t: 'verbo', l: 'principiante', ex: 'Trabajo todos los días.', eu: "Men har kuni ishlayman." },
    { e: 'estudiar', u: "O'qimoq/O'rganmoq", t: 'verbo', l: 'principiante', ex: 'Estudio español cada día.', eu: "Men har kuni ispan tilini o'rganaman." },
    { e: 'pensar', u: "O'ylamoq", t: 'verbo', l: 'principiante', ex: 'Creo que tienes razón.', eu: "Menimcha siz to'g'risiz." },
    { e: 'comprar', u: 'Sotib olmoq', t: 'verbo', l: 'principiante', ex: 'Quiero comprar un libro.', eu: "Kitob sotib olmoqchiman." },
    { e: 'leche', u: 'Sut', t: 'sustantivo', l: 'principiante', ex: 'Los niños beben leche.', eu: "Bolalar sut ichadi." },
    { e: 'huevo', u: 'Tuxum', t: 'sustantivo', l: 'principiante', ex: 'Como dos huevos en el desayuno.', eu: "Nonushta uchun ikki tuxum yeyman." },
    { e: 'arroz', u: 'Guruch', t: 'sustantivo', l: 'principiante', ex: 'El arroz es nuestra comida principal.', eu: "Guruch asosiy ovqatimiz." },
    { e: 'té', u: 'Choy', t: 'sustantivo', l: 'principiante', ex: 'Tomemos un té.', eu: "Keling, choy ichamiz." },
    { e: 'café', u: 'Qahva', t: 'sustantivo', l: 'principiante', ex: 'Bebo café cada mañana.', eu: "Men har ertalab qahva ichaman." },
    { e: 'amigo', u: "Do'st", t: 'sustantivo', l: 'principiante', ex: 'Él es mi mejor amigo.', eu: "U mening eng yaxshi do'stim." },
    { e: 'maestro', u: "O'qituvchi", t: 'sustantivo', l: 'principiante', ex: 'Mi maestro es amable.', eu: "Mening o'qituvchim mehribon." },
    { e: 'estudiante', u: "O'quvchi", t: 'sustantivo', l: 'principiante', ex: 'Ella es una buena estudiante.', eu: "U yaxshi o'quvchi." },
    // ELEMENTAL (A2)
    { e: 'dormitorio', u: 'Yotoqxona', t: 'sustantivo', l: 'elemental', ex: 'Mi dormitorio es acogedor.', eu: "Yotoqxonam qulay." },
    { e: 'cocina', u: 'Oshxona', t: 'sustantivo', l: 'elemental', ex: 'Ella cocina en la cocina.', eu: "U oshxonada ovqat pishiradi." },
    { e: 'médico', u: 'Shifokor', t: 'sustantivo', l: 'elemental', ex: 'El médico examinó al paciente.', eu: "Shifokor bemorni tekshirdi." },
    { e: 'ingeniero', u: 'Muhandis', t: 'sustantivo', l: 'elemental', ex: 'Él es ingeniero de software.', eu: "U dasturiy ta'minot muhandisi." },
    { e: 'caro', u: 'Qimmat', t: 'adjetivo', l: 'elemental', ex: 'Este teléfono es muy caro.', eu: "Bu telefon juda qimmat." },
    { e: 'barato', u: 'Arzon', t: 'adjetivo', l: 'elemental', ex: 'Estos zapatos son baratos.', eu: "Bu poyabzallar arzon." },
    { e: 'hermoso', u: "Go'zal", t: 'adjetivo', l: 'elemental', ex: '¡Qué día tan hermoso!', eu: "Qanday go'zal kun!" },
    { e: 'interesante', u: 'Qiziqarli', t: 'adjetivo', l: 'elemental', ex: 'Esta es una historia interesante.', eu: "Bu qiziqarli hikoya." },
    { e: 'difícil', u: 'Qiyin', t: 'adjetivo', l: 'elemental', ex: 'Este examen es muy difícil.', eu: "Bu imtihon juda qiyin." },
    { e: 'fácil', u: 'Oson', t: 'adjetivo', l: 'elemental', ex: 'Este ejercicio es fácil.', eu: "Bu mashq oson." },
    { e: 'viajar', u: 'Sayohat qilmoq', t: 'verbo', l: 'elemental', ex: 'Me encanta viajar al extranjero.', eu: "Xorijga sayohat qilishni yaxshi ko'raman." },
    { e: 'música', u: 'Musiqa', t: 'sustantivo', l: 'elemental', ex: 'Escucho música cada día.', eu: "Men har kuni musiqa eshitaman." },
    { e: 'clima', u: 'Ob-havo', t: 'sustantivo', l: 'elemental', ex: 'El clima está bueno hoy.', eu: "Bugun ob-havo yaxshi." },
    { e: 'ordenador', u: 'Kompyuter', t: 'sustantivo', l: 'elemental', ex: 'Uso mi ordenador para trabajar.', eu: "Men kompyuterni ish uchun ishlataman." },
    { e: 'hospital', u: 'Kasalxona', t: 'sustantivo', l: 'elemental', ex: 'Lo llevaron al hospital.', eu: "Uni kasalxonaga olib ketishdi." },
    { e: 'restaurante', u: 'Restoran', t: 'sustantivo', l: 'elemental', ex: 'Comemos en el restaurante.', eu: "Biz restoranda ovqatlanamiz." },
    { e: 'aeropuerto', u: 'Aeroport', t: 'sustantivo', l: 'elemental', ex: 'El aeropuerto está muy ocupado.', eu: "Aeroport juda gavjum." },
    { e: 'reunión', u: 'Uchrashuv', t: 'sustantivo', l: 'elemental', ex: 'Tengo una reunión a las 10.', eu: "Soat 10 da mening uchrashuv bor." },
    { e: 'compras', u: 'Xarid', t: 'sustantivo', l: 'elemental', ex: 'A ella le gustan las compras.', eu: "U xarid qilishni yaxshi ko'radi." },
    { e: 'billete', u: 'Chipta', t: 'sustantivo', l: 'elemental', ex: 'Compré un billete de tren.', eu: "Men poyezd chiptasi sotib oldim." },
    { e: 'hotel', u: 'Mehmonxona', t: 'sustantivo', l: 'elemental', ex: 'Nos alojamos en un buen hotel.', eu: "Biz chiroyli mehmonxonada qoldik." },
    { e: 'descuento', u: 'Chegirma', t: 'sustantivo', l: 'elemental', ex: 'Hay un 20% de descuento hoy.', eu: "Bugun 20% chegirma bor." },
    { e: 'ejercicio', u: 'Mashq', t: 'sustantivo', l: 'elemental', ex: 'El ejercicio es bueno para la salud.', eu: "Mashq sog'liq uchun foydali." },
    { e: 'biblioteca', u: 'Kutubxona', t: 'sustantivo', l: 'elemental', ex: 'Voy a la biblioteca a menudo.', eu: "Men tez-tez kutubxonaga boraman." },
    { e: 'asignatura', u: 'Fan', t: 'sustantivo', l: 'elemental', ex: 'Las matemáticas es mi asignatura favorita.', eu: "Matematika mening sevimli fanim." },
    { e: 'clase', u: 'Sinf/Dars', t: 'sustantivo', l: 'elemental', ex: 'La clase empieza a las 9.', eu: "Dars soat 9 da boshlanadi." },
    { e: 'deberes', u: 'Uy vazifasi', t: 'sustantivo', l: 'elemental', ex: 'Hago mis deberes cada tarde.', eu: "Men har kechqurun uy vazifamni bajaraman." },
    { e: 'examen', u: 'Imtihon', t: 'sustantivo', l: 'elemental', ex: 'Tengo un examen mañana.', eu: "Ertaga imtihonÄ±m bor." },
    { e: 'nota', u: 'Baho', t: 'sustantivo', l: 'elemental', ex: 'Ella sacó una buena nota.', eu: "U yaxshi baho oldi." },
    { e: 'montaña', u: "Tog'", t: 'sustantivo', l: 'elemental', ex: 'La montaña es muy alta.', eu: "Tog' juda baland." },
    { e: 'río', u: 'Daryo', t: 'sustantivo', l: 'elemental', ex: 'El río es hermoso.', eu: "Daryo go'zal." },
    { e: 'mar', u: 'Dengiz', t: 'sustantivo', l: 'elemental', ex: 'Me encanta el mar.', eu: "Men dengizni yaxshi ko'raman." },
    { e: 'bosque', u: "O'rmon", t: 'sustantivo', l: 'elemental', ex: 'El bosque está oscuro y tranquilo.', eu: "O'rmon qorong'i va sokin." },
    { e: 'deporte', u: 'Sport', t: 'sustantivo', l: 'elemental', ex: 'El deporte te mantiene sano.', eu: "Sport sizni sog'lom saqlaydi." },
    { e: 'equipo', u: 'Jamoa', t: 'sustantivo', l: 'elemental', ex: 'Nuestro equipo ganó el partido.', eu: "Bizning jamoamiz o'yinda g'olib keldi." },
    { e: 'historia', u: 'Hikoya/Tarix', t: 'sustantivo', l: 'elemental', ex: 'Cuéntame una historia.', eu: "Menga hikoya aytib ber." },
    { e: 'sueño', u: 'Orzu/Tush', t: 'sustantivo', l: 'elemental', ex: 'Sigue tu sueño.', eu: "Orzuingiz ortidan yuring." },
    { e: 'reír', u: 'Kulmoq', t: 'verbo', l: 'elemental', ex: 'Siempre me hace reír.', eu: "U har doim meni kuldiradi." },
    { e: 'llorar', u: "Yig'lamoq", t: 'verbo', l: 'elemental', ex: 'No llores, todo está bien.', eu: "Yig'lama, hammasi yaxshi bo'ladi." },
    { e: 'visitar', u: 'Tashrif buyurmoq', t: 'verbo', l: 'elemental', ex: 'Visitamos a nuestros abuelos a menudo.', eu: "Biz tez-tez bobomiznikiga boramiz." },
    { e: 'explicar', u: 'Tushuntirmoq', t: 'verbo', l: 'elemental', ex: 'Por favor explícame esto.', eu: "Iltimos, buni menga tushuntiring." },
    { e: 'recordar', u: 'Eslamoq', t: 'verbo', l: 'elemental', ex: 'Recuerdo tu nombre.', eu: "Ismingizni eslayman." },
    { e: 'olvidar', u: 'Unutmoq', t: 'verbo', l: 'elemental', ex: '¡No olvides tus llaves!', eu: "Kalitlaringizni unutmang!" },
    { e: 'mejorar', u: 'Yaxshilamoq', t: 'verbo', l: 'elemental', ex: 'Quiero mejorar mi español.', eu: "Ispan tilimni yaxshilashni xohlayman." },
    { e: 'preparar', u: 'Tayyorlamoq', t: 'verbo', l: 'elemental', ex: 'Me estoy preparando para el examen.', eu: "Imtihonga tayyorlanayapman." },
    { e: 'disfrutar', u: 'Zavqlanmoq', t: 'verbo', l: 'elemental', ex: 'Disfruto viendo películas.', eu: "Film ko'rishdan zavqlanaman." },
    { e: 'terminar', u: 'Tugatmoq', t: 'verbo', l: 'elemental', ex: '¿Has terminado tu trabajo?', eu: "Ishingizni tugatdingizmi?" },
    { e: 'empezar', u: 'Boshlash', t: 'verbo', l: 'elemental', ex: 'Empecemos la clase.', eu: "Keling, darsni boshlaylik." },
    { e: 'normalmente', u: 'Odatda', t: 'adverbio', l: 'elemental', ex: 'Normalmente me despierto a las 7.', eu: "Men odatda soat 7 da uyg'onaman." },
    { e: 'a veces', u: "Ba'zan", t: 'adverbio', l: 'elemental', ex: 'Ella a veces ve películas.', eu: "U ba'zan film ko'radi." },
    { e: 'nunca', u: 'Hech qachon', t: 'adverbio', l: 'elemental', ex: 'Nunca como comida rápida.', eu: "Men hech qachon tez ovqat yemayman." },
    { e: 'siempre', u: 'Har doim', t: 'adverbio', l: 'elemental', ex: 'Él siempre llega a tiempo.', eu: "U har doim o'z vaqtida keladi." },
    { e: 'finalmente', u: 'Nihoyat', t: 'adverbio', l: 'elemental', ex: 'Finalmente llegamos.', eu: "Nihoyat kelIb yetdik." },
    { e: 'de repente', u: "To'satdan", t: 'adverbio', l: 'elemental', ex: 'De repente empezó a llover.', eu: "To'satdan yomg'ir yog'a boshladi." },
    // INTERMEDIO (B1)
    { e: 'sin embargo', u: 'Biroq, ammo', t: 'conjunción', l: 'intermedio', ex: 'Hacía frío; sin embargo, salimos.', eu: "Havo sovuq edi, biroq biz chiqdik." },
    { e: 'aunque', u: "Garchi...bo'lsa ham", t: 'conjunción', l: 'intermedio', ex: 'Aunque llovió, jugamos.', eu: "Garchi yomg'ir yog'sa ham, o'yndik." },
    { e: 'por lo tanto', u: 'Shuning uchun', t: 'adverbio', l: 'intermedio', ex: 'Por lo tanto, decidimos ir.', eu: "Shuning uchun biz borishga qaror qildik." },
    { e: 'además', u: 'Bundan tashqari', t: 'adverbio', l: 'intermedio', ex: 'Además, ella es talentosa.', eu: "Bundan tashqari, u iste'dodli." },
    { e: 'oportunidad', u: 'Imkoniyat', t: 'sustantivo', l: 'intermedio', ex: 'Esta es una gran oportunidad.', eu: "Bu ajoyib imkoniyat." },
    { e: 'investigación', u: 'Tadqiqot', t: 'sustantivo', l: 'intermedio', ex: 'Los científicos hacen investigaciones.', eu: "Olimlar tadqiqot o'tkazadilar." },
    { e: 'plazo', u: 'Muddat', t: 'sustantivo', l: 'intermedio', ex: 'El plazo es mañana.', eu: "Muddati ertaga." },
    { e: 'logro', u: 'Yutuq', t: 'sustantivo', l: 'intermedio', ex: 'Es un gran logro.', eu: "Bu katta yutuq." },
    { e: 'desafío', u: 'Muammo/Sinov', t: 'sustantivo', l: 'intermedio', ex: 'Cada desafío te hace más fuerte.', eu: "Har bir muammo sizni kuchliroq qiladi." },
    { e: 'seguro', u: 'Ishonchli', t: 'adjetivo', l: 'intermedio', ex: 'Confía en ti mismo.', eu: "O'zingizga ishoning." },
    { e: 'exitoso', u: 'Muvaffaqiyatli', t: 'adjetivo', l: 'intermedio', ex: 'Ella es una empresaria exitosa.', eu: "U muvaffaqiyatli ish ayoli." },
    { e: 'responsable', u: "Mas'ul", t: 'adjetivo', l: 'intermedio', ex: 'Sé responsable de tus acciones.', eu: "Harakatlaringiz uchun mas'ul bo'ling." },
    { e: 'medio ambiente', u: 'Atrof-muhit', t: 'sustantivo', l: 'intermedio', ex: 'Debemos proteger el medio ambiente.', eu: "Biz atrof-muhitni himoya qilishimiz kerak." },
    { e: 'tecnología', u: 'Texnologiya', t: 'sustantivo', l: 'intermedio', ex: 'La tecnología cambia nuestras vidas.', eu: "Texnologiya hayotimizni o'zgartiradi." },
    { e: 'sociedad', u: 'Jamiyat', t: 'sustantivo', l: 'intermedio', ex: 'La sociedad cambia rápido.', eu: "Jamiyat tez o'zgarmoqda." },
    { e: 'educación', u: "Ta'lim", t: 'sustantivo', l: 'intermedio', ex: 'La educación es la clave del éxito.', eu: "Ta'lim muvaffaqiyat kaliti." },
    { e: 'carrera', u: 'Karyera', t: 'sustantivo', l: 'intermedio', ex: 'Quiero una buena carrera.', eu: "Men yaxshi karyera istayman." },
    { e: 'salario', u: 'Maosh', t: 'sustantivo', l: 'intermedio', ex: 'Su salario es muy alto.', eu: "Uning maoshi juda baland." },
    { e: 'colega', u: 'Hamkasb', t: 'sustantivo', l: 'intermedio', ex: 'Mi colega es muy útil.', eu: "Hamkasabim yordamsevar." },
    { e: 'entrevista', u: 'Suhbat/Intervyu', t: 'sustantivo', l: 'intermedio', ex: 'Tengo una entrevista de trabajo mañana.', eu: "Ertaga ish uchun suhbatim bor." },
    { e: 'experiencia', u: 'Tajriba', t: 'sustantivo', l: 'intermedio', ex: 'La experiencia laboral es importante.', eu: "Ish tajribasi muhim." },
    { e: 'habilidades', u: "Ko'nikmalar", t: 'sustantivo', l: 'intermedio', ex: 'Necesitas buenas habilidades de comunicación.', eu: "Yaxshi muloqot ko'nikmalariga ega bo'lish kerak." },
    { e: 'gestionar', u: 'Boshqarmoq', t: 'verbo', l: 'intermedio', ex: 'Ella gestiona un gran equipo.', eu: "U katta jamoani boshqaradi." },
    { e: 'resolver', u: 'Yechmoq', t: 'verbo', l: 'intermedio', ex: 'Necesitamos resolver este problema.', eu: "Biz bu muammoni yechishimiz kerak." },
    { e: 'lograr', u: 'Erishmoq', t: 'verbo', l: 'intermedio', ex: 'Puedes lograr tus metas.', eu: "Maqsadlaringizga erisha olasiz." },
    { e: 'desarrollar', u: 'Rivojlantirmoq', t: 'verbo', l: 'intermedio', ex: 'Necesitamos desarrollar nuevas ideas.', eu: "Biz yangi g'oyalarni rivojlantirishimiz kerak." },
    { e: 'aumentar', u: 'Oshirmoq', t: 'verbo', l: 'intermedio', ex: 'Los precios están aumentando.', eu: "Narxlar oshmoqda." },
    { e: 'reducir', u: 'Kamaytirmoq', t: 'verbo', l: 'intermedio', ex: 'Debemos reducir la contaminación.', eu: "Biz ifloslanishni kamaytirishimiz kerak." },
    { e: 'sugerir', u: 'Taklif qilmoq', t: 'verbo', l: 'intermedio', ex: 'Sugiero que nos vayamos ahora.', eu: "Endi ketishimizni taklif qilaman." },
    { e: 'comparar', u: 'Solishtirmoq', t: 'verbo', l: 'intermedio', ex: 'Compara estos dos productos.', eu: "Bu ikki mahsulotni solishtiring." },
    { e: 'informe', u: 'Hisobot', t: 'sustantivo', l: 'intermedio', ex: 'Escribe un informe sobre eso.', eu: "Bu haqida hisobot yozing." },
    { e: 'proyecto', u: 'Loyiha', t: 'sustantivo', l: 'intermedio', ex: 'Nuestro proyecto vence el viernes.', eu: "Loyihamiz juma kuni topshirilishi kerak." },
    { e: 'presupuesto', u: 'Byudjet', t: 'sustantivo', l: 'intermedio', ex: 'Tenemos un presupuesto limitado.', eu: "Bizning cheklangan byudjetimiz bor." },
    { e: 'beneficio', u: 'Foyda', t: 'sustantivo', l: 'intermedio', ex: 'La empresa obtuvo beneficios.', eu: "Kompaniya foyda ko'rdi." },
    { e: 'cliente', u: 'Mijoz', t: 'sustantivo', l: 'intermedio', ex: 'El cliente está satisfecho.', eu: "Mijoz mamnun." },
    { e: 'contrato', u: 'Shartnoma', t: 'sustantivo', l: 'intermedio', ex: 'Firma el contrato.', eu: "Shartnomani imzolang." },
    { e: 'a pesar de', u: 'Qaramasdan', t: 'preposición', l: 'intermedio', ex: 'A pesar de la lluvia, jugamos.', eu: "Yomg'irga qaramasdan, o'yndik." },
    { e: 'a menos que', u: "Agar...bo'lmasa", t: 'conjunción', l: 'intermedio', ex: 'A menos que estudies, no aprobarás.', eu: "Agar o'qimasangiz, o'taolmaysiz." },
    { e: 'mientras tanto', u: 'Shu orada', t: 'adverbio', l: 'intermedio', ex: 'Cociné; mientras tanto, él puso la mesa.', eu: "Men ovqat pishirdim; shu orada u dasturxon yozdi." },
    { e: 'a lo largo de', u: 'Davomida', t: 'preposición', l: 'intermedio', ex: 'A lo largo del año, trabajamos duro.', eu: "Yil davomida qattiq ishladik." },
    // AVANZADO (B2-C2)
    { e: 'matiz', u: 'Noziklik, soya', t: 'sustantivo', l: 'avanzado', ex: 'El matiz de sus palabras importaba.', eu: "Uning so'zlarining nozikligi muhim edi." },
    { e: 'soberanía', u: 'Suverenitet', t: 'sustantivo', l: 'avanzado', ex: 'La soberanía nacional es vital.', eu: "Milliy suverenitet muhimdir." },
    { e: 'elocuencia', u: 'Notiqlik', t: 'sustantivo', l: 'avanzado', ex: 'Su elocuencia impresionó a todos.', eu: "Uning notiqligi hammani hayratda qoldirdi." },
    { e: 'paradigma', u: 'Paradigma', t: 'sustantivo', l: 'avanzado', ex: 'Está emergiendo un nuevo paradigma.', eu: "Yangi paradigma paydo bo'lmoqda." },
    { e: 'correlación', u: 'Korrelyatsiya', t: 'sustantivo', l: 'avanzado', ex: 'La correlación no implica causalidad.', eu: "Korrelyatsiya sababiyatni anglatmaydi." },
    { e: 'legislación', u: 'Qonunchilik', t: 'sustantivo', l: 'avanzado', ex: 'Se aprobó una nueva legislación.', eu: "Yangi qonun qabul qilindi." },
    { e: 'mitigar', u: 'Yumshatmoq', t: 'verbo', l: 'avanzado', ex: 'Debemos mitigar los riesgos.', eu: "Biz xavflarni yumshatishimiz kerak." },
    { e: 'sin precedentes', u: "Misli ko'rilmagan", t: 'adjetivo', l: 'avanzado', ex: 'Esta es una situación sin precedentes.', eu: "Bu misli ko'rilmagan holat." },
    { e: 'meticuloso', u: 'Puxta, ehtiyotkor', t: 'adjetivo', l: 'avanzado', ex: 'Ella es meticulosa en su trabajo.', eu: "U ishida puxta." },
    { e: 'ambiguo', u: "Noaniq, ikki ma'noli", t: 'adjetivo', l: 'avanzado', ex: 'Su declaración fue ambigua.', eu: "Uning bayonoti noaniq edi." },
    { e: 'coherente', u: 'Izchil, mantiqiy', t: 'adjetivo', l: 'avanzado', ex: 'Escribe un argumento coherente.', eu: "Izchil argument yozing." },
    { e: 'sustancial', u: 'Muhim, sezilarli', t: 'adjetivo', l: 'avanzado', ex: 'Hay evidencia sustancial.', eu: "Jiddiy dalillar mavjud." },
    { e: 'inherente', u: "O'ziga xos, tabiiy", t: 'adjetivo', l: 'avanzado', ex: 'Hay riesgos inherentes.', eu: "O'ziga xos xavflar mavjud." },
    { e: 'predominante', u: 'Ustunlik qiluvchi', t: 'adjetivo', l: 'avanzado', ex: 'El español es el idioma predominante.', eu: "Ispan tili ustunlik qiluvchi til." },
    { e: 'convincente', u: 'Jozibali, qiziqarli', t: 'adjetivo', l: 'avanzado', ex: 'Ella dio un argumento convincente.', eu: "U jozibali argument keltirdi." },
    { e: 'polémico', u: 'Bahsli, munozarali', t: 'adjetivo', l: 'avanzado', ex: 'Es un tema polémico.', eu: "Bu munozarali mavzu." },
    { e: 'pragmático', u: 'Amaliy', t: 'adjetivo', l: 'avanzado', ex: 'Sé pragmático al respecto.', eu: "Bunga amaliy yondashing." },
    { e: 'catalizador', u: 'Katalizator', t: 'sustantivo', l: 'avanzado', ex: 'El invento fue un catalizador del cambio.', eu: "Ixtiro o'zgarish uchun katalizator bo'ldi." },
    { e: 'demográfico', u: 'Demografik', t: 'adjetivo/sustantivo', l: 'avanzado', ex: 'Los cambios demográficos son significativos.', eu: "Demografik o'zgarishlar muhim." },
    { e: 'infraestructura', u: 'Infratuzilma', t: 'sustantivo', l: 'avanzado', ex: 'Debemos invertir en infraestructura.', eu: "Infratuzilmaga investitsiya qilishimiz kerak." },
    { e: 'hipótesis', u: 'Faraz', t: 'sustantivo', l: 'avanzado', ex: 'Prueba tu hipótesis.', eu: "Farazingizni sinab ko'ring." },
    { e: 'metodología', u: 'Metodologiya', t: 'sustantivo', l: 'avanzado', ex: 'Explica tu metodología.', eu: "Metodologiyangizni tushuntiring." },
    { e: 'fenómeno', u: 'Hodisa', t: 'sustantivo', l: 'avanzado', ex: 'Este es un fenómeno global.', eu: "Bu global hodisa." },
    { e: 'implicaciones', u: 'Oqibatlar', t: 'sustantivo', l: 'avanzado', ex: 'Considera las implicaciones.', eu: "Oqibatlarni ko'rib chiqing." },
    { e: 'perspectiva', u: 'Nuqtai nazar', t: 'sustantivo', l: 'avanzado', ex: 'Considera una perspectiva diferente.', eu: "Boshqa nuqtai nazarni ko'rib chiqing." },
    { e: 'marco', u: 'Tizim/Struktura', t: 'sustantivo', l: 'avanzado', ex: 'Necesitamos un marco claro.', eu: "Bizga aniq tizim kerak." },
    { e: 'retórica', u: 'Ritorika', t: 'sustantivo', l: 'avanzado', ex: 'Su retórica era poderosa.', eu: "Uning ritorikasi kuchli edi." },
    { e: 'consenso', u: 'Kelishuv', t: 'sustantivo', l: 'avanzado', ex: 'Alcanzamos un consenso.', eu: "Biz kelishuvga erishdik." },
    { e: 'abogar', u: 'Himoya qilmoq', t: 'verbo', l: 'avanzado', ex: 'Ella aboga por los derechos humanos.', eu: "U inson huquqlarini himoya qiladi." },
    { e: 'constituir', u: 'Tashkil etmoq', t: 'verbo', l: 'avanzado', ex: 'Esto constituye una violación.', eu: "Bu qoidabuzarlik tashkil etadi." },
    { e: 'facilitar', u: 'Osonlashtirmoq', t: 'verbo', l: 'avanzado', ex: 'La tecnología facilita el aprendizaje.', eu: "Texnologiya o'rganishni osonlashtiradi." },
    { e: 'elaborar', u: 'Batafsil bayon etmoq', t: 'verbo', l: 'avanzado', ex: '¿Puedes elaborar sobre eso?', eu: "Bu haqida batafsil ayta olasizmi?" },
    { e: 'reconocer', u: 'Tan olmoq', t: 'verbo', l: 'avanzado', ex: 'Reconozco mi error.', eu: "Xatoimni tan olaman." },
    { e: 'sostener', u: 'Davom ettirmoq', t: 'verbo', l: 'avanzado', ex: 'Debemos sostener nuestros esfuerzos.', eu: "Biz kuchlarimizni davom ettirishimiz kerak." },
    { e: 'no obstante', u: 'Qaramasdan', t: 'preposición', l: 'avanzado', ex: 'No obstante las dificultades, tuvimos éxito.', eu: "Qiyinchiliklarga qaramasdan, muvaffaqiyat qozondik." },
    { e: 'plausible', u: "Ishonchli ko'rinadigan", t: 'adjetivo', l: 'avanzado', ex: 'Eso parece plausible.', eu: "Bu ishonchli ko'rinadi." },
];

// ══════════════════════════════════════════════════════════════
// UNITS DATA — ESPAÑOL
// ══════════════════════════════════════════════════════════════
const UD_DATA = {
    principiante: [
        {
            id: 'p0', emoji: '🔤', title: 'El Alfabeto', desc: "Ispan alifbosini o'rganish", level: 'principiante',
            words: ['hola', 'libro', 'gato', 'perro', 'manzana', 'rojo', 'feliz', 'agua', 'escuela', 'bueno'],
            xp: 40, coin: 15,
            grammar_rule: "Ispan alifbosida 27 harf bor. Unlilar: A, E, I, O, U. Ñ — ispancha maxsus harf.",
            grammar_example: "A a, B b, C c... Ñ ñ... Z z. Misol: España, mañana, niño",
            reading_text: "El alfabeto español tiene 27 letras. Las vocales son A, E, I, O, U. La letra especial del español es la Ñ, que no existe en inglés. Las palabras en español se pronuncian como se escriben. Estudiar el alfabeto es el primer paso para aprender español.",
            reading_qs: [
                { q: "¿Cuántas letras tiene el alfabeto?", opts: ["25", "26", "27", "28"], c: 2 },
                { q: "¿Cuántas vocales hay?", opts: ["3", "4", "5", "6"], c: 2 },
                { q: "¿Cuál es la letra especial del español?", opts: ["Q", "Ñ", "W", "X"], c: 1 }
            ]
        },
        {
            id: 'p1', emoji: '👋', title: 'Saludos', desc: "Salomlashish va tanishish", level: 'principiante',
            words: ['hola', 'adiós', 'gracias', 'por favor', 'perdón', 'sí', 'no', 'bueno', 'malo', 'feliz'],
            xp: 50, coin: 20,
            grammar_rule: "Ser: Yo soy, Tú eres, Él/Ella es — asosiy fe'l",
            grammar_example: "Yo soy María. Tú eres mi amigo. Él es maestro.",
            reading_text: "Me llamo Sofía. Soy de España. Cada mañana digo '¡Hola!' a mis vecinos. Cuando me voy, digo '¡Adiós!'. Siempre digo 'por favor' y 'gracias'. La gente dice que soy muy educada.",
            reading_qs: [
                { q: "¿De dónde es Sofía?", opts: ["México", "España", "Francia", "Perú"], c: 1 },
                { q: "¿Qué dice cuando se va?", opts: ["Hola", "Gracias", "Adiós", "Por favor"], c: 2 },
                { q: "¿Qué es importante para Sofía?", opts: ["El dinero", "Ser educada", "La fama", "La fuerza"], c: 1 }
            ]
        },
        {
            id: 'p2', emoji: '🔢', title: 'Los Números', desc: "Raqamlar va sanash", level: 'principiante',
            words: ['uno', 'dos', 'tres', 'manzana', 'libro', 'gato', 'perro', 'madre', 'padre', 'escuela'],
            xp: 50, coin: 20,
            grammar_rule: "Números: uno, dos, tres... Ordinales: primero, segundo, tercero",
            grammar_example: "Tengo tres libros. Ella es la primera estudiante.",
            reading_text: "Tomás tiene tres gatos y dos perros. Cada día los alimenta cuatro veces. Pasa unos diez minutos con cada animal. Compró doce juguetes para sus gatos. A él le encantan sus mascotas.",
            reading_qs: [
                { q: "¿Cuántos gatos tiene?", opts: ["Dos", "Tres", "Cuatro", "Cinco"], c: 1 },
                { q: "¿Cuántas veces al día los alimenta?", opts: ["Dos", "Tres", "Cuatro", "Cinco"], c: 2 },
                { q: "¿Cuántos juguetes compró?", opts: ["Diez", "Doce", "Quince", "Veinte"], c: 1 }
            ]
        },
        {
            id: 'p3', emoji: '🎨', title: 'Los Colores', desc: "Ispan tilida ranglar", level: 'principiante',
            words: ['rojo', 'azul', 'verde', 'amarillo', 'negro', 'blanco', 'feliz', 'triste', 'caliente', 'frío'],
            xp: 60, coin: 25,
            grammar_rule: "Los adjetivos concuerdan con el sustantivo: un libro rojo, una casa roja",
            grammar_example: "Tiene una bolsa roja. Veo pájaros azules. La hierba verde es suave.",
            reading_text: "El arcoíris tiene siete colores: rojo, naranja, amarillo, verde, azul, añil y violeta. El rojo es el color del fuego. El azul es el color del cielo. El verde es el color de los árboles y la naturaleza.",
            reading_qs: [
                { q: "¿Cuántos colores tiene el arcoíris?", opts: ["Cinco", "Seis", "Siete", "Ocho"], c: 2 },
                { q: "¿De qué color es el cielo?", opts: ["Rojo", "Amarillo", "Verde", "Azul"], c: 3 },
                { q: "¿De qué color es el fuego?", opts: ["Azul", "Rojo", "Verde", "Amarillo"], c: 1 }
            ]
        },
        {
            id: 'p4', emoji: '👨‍👩‍👧', title: 'La Familia', desc: "Oila a'zolari", level: 'principiante',
            words: ['madre', 'padre', 'hermana', 'hermano', 'agua', 'comida', 'casa', 'coche', 'perro', 'gato'],
            xp: 60, coin: 25,
            grammar_rule: "Posesivos: mi, tu, su, nuestro + sustantivo",
            grammar_example: "Mi madre es amable. Su padre trabaja mucho. Nuestra familia es grande.",
            reading_text: "Mi familia tiene cinco miembros. Mi padre es médico y mi madre es maestra. Tengo un hermano y una hermana. Mis abuelos viven cerca. Los visitamos cada domingo.",
            reading_qs: [
                { q: "¿Cuántos miembros?", opts: ["Tres", "Cuatro", "Cinco", "Seis"], c: 2 },
                { q: "¿Qué hace el padre?", opts: ["Maestro", "Médico", "Ingeniero", "Conductor"], c: 1 },
                { q: "¿Cuándo visitan a los abuelos?", opts: ["Sábado", "Domingo", "Lunes", "Viernes"], c: 1 }
            ]
        },
        {
            id: 'p5', emoji: '🍎', title: 'Comida y Bebida', desc: "Taom va ichimliklar", level: 'principiante',
            words: ['manzana', 'pan', 'agua', 'comer', 'beber', 'dormir', 'leer', 'escribir', 'caminar', 'hablar'],
            xp: 70, coin: 30,
            grammar_rule: "Artículos: un/una (noaniq), el/la (aniq). Misol: un pan, el agua",
            grammar_example: "Quiero una manzana y un poco de agua. Ella bebe leche cada mañana.",
            reading_text: "Un desayuno saludable es importante. Muchas personas comen huevos y pan por la mañana. El té y el café son bebidas populares. La leche es buena para los niños. Siempre hay que beber suficiente agua cada día.",
            reading_qs: [
                { q: "¿Qué es importante por la mañana?", opts: ["La cena", "El almuerzo", "El desayuno", "El aperitivo"], c: 2 },
                { q: "¿Qué es bueno para los niños?", opts: ["El café", "El té", "La leche", "El jugo"], c: 2 },
                { q: "¿Qué comida se menciona?", opts: ["Arroz", "Sopa", "Huevos y pan", "Pizza"], c: 2 }
            ]
        },
    ],

    elemental: [
        {
            id: 'e1', emoji: '🏡', title: 'La Casa', desc: "Uy va xonalar", level: 'elemental',
            words: ['médico', 'maestro', 'ingeniero', 'caro', 'barato', 'hermoso', 'interesante', 'difícil', 'fácil', 'viajar'],
            xp: 80, coin: 35,
            grammar_rule: "Hay + sustantivo: Hay un sofá. Hay tres dormitorios.",
            grammar_example: "Hay una cocina grande. Hay dos baños en mi casa.",
            reading_text: "Mi casa tiene tres plantas. En la planta baja hay un gran salón y una cocina moderna. En el primer piso hay tres dormitorios y dos baños. Mi dormitorio tiene una gran ventana con vista al jardín.",
            reading_qs: [
                { q: "¿Cuántas plantas?", opts: ["Dos", "Tres", "Cuatro", "Cinco"], c: 1 },
                { q: "¿Dónde están los dormitorios?", opts: ["Planta baja", "Primer piso", "Jardín", "Sótano"], c: 1 },
                { q: "¿Qué tiene el dormitorio?", opts: ["Una tele", "Una ventana grande", "Una piscina", "Una chimenea"], c: 1 }
            ]
        },
        {
            id: 'e2', emoji: '💼', title: 'Las Profesiones', desc: "Kasblar", level: 'elemental',
            words: ['médico', 'maestro', 'ingeniero', 'música', 'amigo', 'clima', 'ordenador', 'viajar', 'hermoso', 'interesante'],
            xp: 80, coin: 35,
            grammar_rule: "¿A qué te dedicas? Soy + profesión.",
            grammar_example: "¿A qué te dedicas? Soy enfermero. Él trabaja como ingeniero.",
            reading_text: "Hay muchas profesiones diferentes. Los médicos y las enfermeras trabajan en hospitales. Los maestros educan a la próxima generación. Los ingenieros construyen puentes. Los pilotos vuelan aviones. Cada trabajo es importante para la sociedad.",
            reading_qs: [
                { q: "¿Dónde trabajan los médicos?", opts: ["Escuelas", "Fábricas", "Hospitales", "Oficinas"], c: 2 },
                { q: "¿Qué construyen los ingenieros?", opts: ["Libros", "Canciones", "Puentes", "Comida"], c: 2 },
                { q: "¿Qué hacen los maestros?", opts: ["Vuelan aviones", "Construyen puentes", "Educan personas", "Cocinan comida"], c: 2 }
            ]
        },
        {
            id: 'e3', emoji: '🛒', title: 'De Compras', desc: "Xarid qilish", level: 'elemental',
            words: ['caro', 'barato', 'hermoso', 'difícil', 'fácil', 'viajar', 'música', 'amigo', 'clima', 'ordenador'],
            xp: 90, coin: 40,
            grammar_rule: "¿Cuánto cuesta? Cuesta... ¿Puedo pagar con tarjeta?",
            grammar_example: "¿Cuánto cuesta esta camisa? Cuesta 25 euros. ¿Puedo pagar con tarjeta? Sí, por supuesto.",
            reading_text: "Las compras son una actividad cotidiana. Los supermercados venden alimentos y artículos del hogar. Los grandes almacenes tienen ropa y electrónica. Antes de comprar, comprueba siempre el precio. Busca descuentos y ofertas para ahorrar dinero. ¡Guarda tu ticket!",
            reading_qs: [
                { q: "¿Dónde puedes comprar ropa?", opts: ["Supermercado", "Grandes almacenes", "Farmacia", "Panadería"], c: 1 },
                { q: "¿Qué debes guardar?", opts: ["La bolsa", "El ticket", "La etiqueta", "La caja"], c: 1 },
                { q: "¿Qué ayuda a ahorrar?", opts: ["Comprar rápido", "Pagar en efectivo", "Buscar descuentos", "Ir a menudo"], c: 2 }
            ]
        },
    ],

    intermedio: [
        {
            id: 'i1', emoji: '🔮', title: 'Planes Futuros', desc: "Kelajak zamonlari", level: 'intermedio',
            words: ['sin embargo', 'aunque', 'por lo tanto', 'además', 'oportunidad', 'matiz', 'elocuencia', 'mitigar', 'sin precedentes', 'meticuloso'],
            xp: 130, coin: 60,
            grammar_rule: "Futuro simple: hablaré, comerás, vivirá. Ir a + infinitivo para planes.",
            grammar_example: "Te llamaré mañana. Ella va a estudiar medicina.",
            reading_text: "Planificar el futuro es esencial. Establecer metas claras te ayuda a conseguir el éxito. Las metas a corto plazo llevan semanas. Las metas a largo plazo llevan años. La flexibilidad es tan importante como la determinación.",
            reading_qs: [
                { q: "¿Cuánto tardan las metas a corto plazo?", opts: ["Años", "Décadas", "Unas semanas", "Toda la vida"], c: 2 },
                { q: "¿Qué es tan importante como la determinación?", opts: ["El dinero", "La flexibilidad", "La educación", "La fuerza"], c: 1 },
                { q: "¿Qué ayuda a conseguir el éxito?", opts: ["Los amigos", "La fama", "El éxito", "El viaje"], c: 2 }
            ]
        },
        {
            id: 'i2', emoji: '🎯', title: 'El Subjuntivo', desc: "Subjuntivo zamonining asoslari", level: 'intermedio',
            words: ['sin embargo', 'aunque', 'por lo tanto', 'además', 'oportunidad', 'matiz', 'elocuencia', 'mitigar', 'sin precedentes', 'meticuloso'],
            xp: 140, coin: 65,
            grammar_rule: "Subjuntivo presente: que yo hable, que tú comas, que él viva. Istak, shubha, his-tuyg'ular.",
            grammar_example: "Espero que vengas. Es importante que estudies. No creo que llueva.",
            reading_text: "El subjuntivo es un modo verbal que expresa subjetividad: deseos, emociones, dudas y recomendaciones. Se usa con expresiones como 'espero que', 'quiero que', 'es posible que'. Es uno de los aspectos más importantes del español avanzado.",
            reading_qs: [
                { q: "¿Qué expresa el subjuntivo?", opts: ["Solo hechos", "Subjetividad", "Solo preguntas", "Solo negaciones"], c: 1 },
                { q: "¿Con qué expresión se usa?", opts: ["Sé que...", "Veo que...", "Espero que...", "Digo que..."], c: 2 },
                { q: "¿Qué tipo de aspecto es del español?", opts: ["Básico", "Opcional", "Importante", "Anticuado"], c: 2 }
            ]
        },
    ],

    avanzado: [
        {
            id: 'a1', emoji: '🖊️', title: 'Escritura Académica', desc: "Akademik yozuv", level: 'avanzado',
            words: ['además', 'sin embargo', 'por lo tanto', 'matiz', 'elocuencia', 'mitigar', 'sin precedentes', 'meticuloso', 'oportunidad', 'aunque'],
            xp: 200, coin: 90,
            grammar_rule: "Conectores: además (qo'shish), sin embargo (ziddiyat), por lo tanto (sabab).",
            grammar_example: "Los datos apoyan la hipótesis. Además, investigaciones anteriores corroboran estos hallazgos.",
            reading_text: "La escritura académica exige precisión y coherencia lógica. Cada argumento debe estar respaldado por evidencia. Los conectores unen ideas: 'además' añade información, 'sin embargo' introduce contraste. La estructura del párrafo sigue IDEA: Idea, Desarrollo, Evidencia, Análisis.",
            reading_qs: [
                { q: "¿Qué señala 'además'?", opts: ["Contraste", "Resultado", "Información adicional", "Condición"], c: 2 },
                { q: "¿Qué significa IDEA?", opts: ["Idea,Datos,Ejemplo,Argumento", "Idea,Desarrollo,Evidencia,Análisis", "Inicio,Debate,Evaluación,Acción", "Interés,Descripción,Espacio,Análisis"], c: 1 },
                { q: "¿Qué debe tener cada argumento?", opts: ["Una historia", "Evidencia", "Opiniones", "Humor"], c: 1 }
            ]
        },
        {
            id: 'a2', emoji: '📋', title: 'DELE / SIELE', desc: "DELE/SIELE imtihon tayyorligi", level: 'avanzado',
            words: ['además', 'sin embargo', 'por lo tanto', 'matiz', 'elocuencia', 'mitigar', 'sin precedentes', 'meticuloso', 'oportunidad', 'aunque'],
            xp: 250, coin: 110,
            grammar_rule: "Tarea 1: Describe datos. Tarea 2: Argumenta una posición con evidencia.",
            grammar_example: "En general, el uso de internet aumentó drásticamente entre 2000 y 2020.",
            reading_text: "El DELE es el diploma oficial de español como lengua extranjera. La prueba de escritura tiene dos tareas: describir datos visuales y escribir un texto de opinión. Es fundamental usar conectores, vocabulario variado y estructuras complejas para obtener una nota alta.",
            reading_qs: [
                { q: "¿Qué es el DELE?", opts: ["Un libro", "Un diploma oficial", "Una app", "Un curso"], c: 1 },
                { q: "¿Cuántas tareas de escritura hay?", opts: ["Una", "Dos", "Tres", "Cuatro"], c: 1 },
                { q: "¿Qué se necesita para nota alta?", opts: ["Solo vocabulario", "Solo gramática", "Conectores y estructuras complejas", "Solo longitud"], c: 2 }
            ]
        },
    ]
};

// ══════════════════════════════════════════════════════════════
// GRAMMAR QUESTIONS — ESPAÑOL
// ══════════════════════════════════════════════════════════════
const GRAMMAR_QS = [
    { q: "Ella ___ a la escuela cada día.", opts: ["van", "vas", "va", "vamos"], ans: "va", exp: "3-shaxs birlik: ir → va" },
    { q: "Yo ___ estudiante.", opts: ["soy", "eres", "es", "somos"], ans: "soy", exp: "1-shaxs birlik: yo soy" },
    { q: "Ellos ___ mis amigos.", opts: ["es", "soy", "son", "eres"], ans: "son", exp: "Ko'plik: ellos son" },
    { q: "Él ___ un libro ahora mismo.", opts: ["lee", "lees", "está leyendo", "leyendo"], ans: "está leyendo", exp: "Hozirgi davom zamon: estar + gerundio" },
    { q: "Yo ___ en Madrid por 5 años.", opts: ["vivo", "he vivido", "viviendo", "vivía"], ans: "he vivido", exp: "Pretérito perfecto: haber + participio" },
    { q: "Si yo ___ rico, compraría una mansión.", opts: ["soy", "era", "fuera", "sea"], ans: "fuera", exp: "Condicional: Si + imperfecto subjuntivo" },
    { q: "El informe ___ escrito por el director.", opts: ["es", "fue", "era", "será"], ans: "fue", exp: "Pasiva: fue + participio" },
    { q: "Ella es la ___ estudiante de la clase.", opts: ["más inteligente", "muy inteligente", "la más inteligente", "inteligentísima"], ans: "la más inteligente", exp: "Superlativo relativo: la más + adjetivo" },
    { q: "Para mañana, yo ___ terminado el proyecto.", opts: ["habré", "habría", "he", "había"], ans: "habré", exp: "Futuro perfecto: habré + participio" },
    { q: "___ ella llegue, empezaremos a cenar.", opts: ["Desde que", "Mientras", "Cuando", "Durante"], ans: "Cuando", exp: "Temporal: cuando + subjuntivo" },
    { q: "Él sugirió que ella ___ al médico.", opts: ["vaya", "va", "fue", "yendo"], ans: "vaya", exp: "Subjuntivo: sugerir + que + subjuntivo" },
    { q: "Yo ___ nunca estado en París.", opts: ["he", "has", "había", "estoy"], ans: "he", exp: "Pretérito perfecto + nunca: he + participio" },
    { q: "Es ___ honor conocerte.", opts: ["un", "una", "el", "la"], ans: "un", exp: "'Honor' es masculino: un honor" },
    { q: "No solo ___ bien, sino que también baila.", opts: ["canta", "cantar", "cantando", "cante"], ans: "canta", exp: "No solo... sino que también: verbo conjugado" },
    { q: "Cuanto más trabajas, ___ logras.", opts: ["más", "el más", "mucho", "tan"], ans: "más", exp: "Correlativo comparativo: cuanto más... más..." },
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
    u.lang = 'es-ES'; u.rate = 0.85;
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
        <span style="font-size:0.8rem;color:#fff5f0;font-weight:600">${CU?.displayName || CU?.email || 'User'}</span>
        <span style="font-size:0.78rem;color:#f0a500">⭐ ${UXP.toLocaleString()}</span>
        <span style="font-size:0.78rem;color:#f0a500">🪙 ${UCoin.toLocaleString()}</span>
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
    container.innerHTML = `<div style="text-align:center;padding:30px;color:#666"><i class="fa-solid fa-spinner fa-spin" style="font-size:1.5rem;color:#d4456a"></i><br>Yuklanmoqda...</div>`;
    try {
        const q = query(collection(_db, 'users'), orderBy(field, 'desc'), limit(20));
        const snap = await getDocs(q);
        const users = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        if (!users.length) { container.innerHTML = '<p style="text-align:center;color:#666">Hali hech kim yo\'q</p>'; return; }
        const labels = { xp: 'XP', coins: 'Coin', unitsCompleted: 'Unit' };
        const icons = { xp: 'fa-star', coins: 'fa-coins', unitsCompleted: 'fa-book' };
        let html = `<div style="margin-bottom:16px;display:flex;justify-content:space-between;align-items:center">
            <span style="color:#666;font-size:0.8rem"><i class="fa-solid ${icons[field] || 'fa-trophy'}" style="margin-right:4px;color:#d4456a"></i>${labels[field] || field} reytingi</span>
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
                    <div class="lb-name">${u.displayName || u.email || 'Foydalanuvchi'}${isMe ? ' <span style="color:#d4456a;font-size:0.72rem">(siz)</span>' : ''}</div>
                    ${planKey !== 'free' ? `<span class="lb-plan" style="border-color:${pc}44;color:${pc}">${planLabel}</span>` : ''}
                </div>
                <div style="text-align:right">
                    <div class="lb-score"><i class="fa-solid ${icons[field] || 'fa-star'}" style="margin-right:4px;color:#f0a500"></i>${val.toLocaleString()}</div>
                    <div style="font-size:0.68rem;color:#666">${labels[field] || field}</div>
                </div>
            </div>`;
        });
        container.innerHTML = html;
    } catch (e) {
        container.innerHTML = `<div style="text-align:center;padding:30px;color:#ef4444"><i class="fa-solid fa-triangle-exclamation"></i> Xatolik: ${e.message}<br><button onclick="window.loadLBSection('${field}',null)" style="margin-top:12px;padding:8px 16px;border-radius:8px;background:#d4456a22;border:1px solid #d4456a44;color:#d4456a;cursor:pointer">Qayta</button></div>`;
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
        if (!r.ok) { return `❗ AI xatolik: ${r.status}.`; }
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
    ctx.closePath(); ctx.fillStyle = 'rgba(212,69,106,0.2)'; ctx.fill();
    ctx.strokeStyle = 'rgba(212,69,106,0.7)'; ctx.lineWidth = 2; ctx.stroke();
    angles.forEach((a, i) => {
        ctx.beginPath();
        ctx.arc(cx + r * skills[i] * Math.cos(a), cy + r * skills[i] * Math.sin(a), 4, 0, Math.PI * 2);
        ctx.fillStyle = '#d4456a'; ctx.fill();
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
          <div style="font-size:0.75rem;color:#f0a500;margin-bottom:4px">Unidad ${i + 1}</div>
          <div style="font-size:1.8rem;margin-bottom:8px">${unit.emoji}</div>
          <div style="font-weight:700;font-size:1rem;color:#fff5f0;margin-bottom:6px">${unit.title}</div>
          <div style="font-size:0.8rem;color:#666;margin-bottom:12px">${unit.desc}</div>
          <div style="display:flex;gap:8px;margin-bottom:10px">
            ${['A', 'B', 'C', 'D'].map(l => `<div style="width:24px;height:24px;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:0.7rem;font-weight:700;background:${UProg[unit.id + '_' + l] >= 100 ? 'rgba(46,204,113,0.2)' : 'rgba(255,255,255,0.05)'};border:1px solid ${UProg[unit.id + '_' + l] >= 100 ? '#2ecc71' : 'rgba(255,255,255,0.1)'};color:${UProg[unit.id + '_' + l] >= 100 ? '#2ecc71' : '#666'}">${l}</div>`).join('')}
          </div>
          <div style="height:3px;background:rgba(255,255,255,0.06);border-radius:100px;overflow:hidden;margin-bottom:8px">
            <div style="height:100%;width:${pct}%;background:linear-gradient(90deg,#d4456a,#f0a500);border-radius:100px;transition:width 0.4s"></div>
          </div>
          <div style="font-size:0.76rem;display:flex;gap:10px">
            <span style="color:#f0a500">+${unit.xp} XP</span>
            <span style="color:#f0a500">+${unit.coin} 🪙</span>
            ${isComp ? '<span style="color:#2ecc71">✅</span>' : ''}
          </div>`;
        card.onmouseover = () => { card.style.background = 'rgba(212,69,106,0.08)'; card.style.borderColor = 'rgba(212,69,106,0.3)'; };
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
    const lnames = { A: "📖 Gramática & Vocabulario", B: "🎧 Comprensión Auditiva", C: "📖 Lectura", D: "🎤 Expresión Oral & Escrita" };
    const lcolors = { A: '#d4456a', B: '#22d3ee', C: '#2ecc71', D: '#f0a500' };
    content.innerHTML = `
      <div style="text-align:center;padding-bottom:20px">
        <div style="font-size:3rem;margin-bottom:10px">${unit.emoji}</div>
        <h2 style="margin-bottom:8px;color:#fff5f0">${unit.title}</h2>
        <p style="color:#666">${unit.desc}</p>
        <div style="display:flex;gap:16px;justify-content:center;margin:16px 0;flex-wrap:wrap">
          <span style="color:#f0a500">⭐ +${unit.xp} XP</span>
          <span style="color:#f0a500">🪙 +${unit.coin} Moneda</span>
          <span style="color:#60a5fa">📚 ${unit.words.length} palabras</span>
          <span style="color:#d4456a">🎫 2 token/lección</span>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:20px">
        ${['A', 'B', 'C', 'D'].map(k => {
        const done = UProg[`${unit.id}_${k}`] >= 100;
        const sc = UProg[`score_${unit.id}_${k}`] || 0;
        return `<div onclick="window.openLesson('${unit.id}','${k}')" style="padding:16px;border-radius:12px;background:${done ? 'rgba(46,204,113,0.08)' : 'rgba(255,255,255,0.03)'};border:1px solid ${done ? 'rgba(46,204,113,0.3)' : 'rgba(255,255,255,0.08)'};cursor:pointer;transition:all 0.2s" onmouseover="this.style.borderColor='${lcolors[k]}55'" onmouseout="this.style.borderColor='${done ? 'rgba(46,204,113,0.3)' : 'rgba(255,255,255,0.08)'}'">
                <div style="font-size:1.2rem;font-weight:800;color:${lcolors[k]};margin-bottom:4px">${k}</div>
                <div style="font-size:0.8rem;color:#fff5f0">${lnames[k]}</div>
                ${done ? `<div style="font-size:0.72rem;color:#2ecc71;margin-top:4px">✅ ${sc}%</div>` : '<div style="font-size:0.72rem;color:#666;margin-top:4px">▶ Comenzar</div>'}
            </div>`;
    }).join('')}
      </div>
      <div>
        <div style="font-size:0.78rem;color:#666;margin-bottom:8px">📝 Palabras:</div>
        <div style="display:flex;flex-wrap:wrap;gap:6px">
          ${unit.words.map(w => `<span onclick="window.spk('${w.replace(/'/g, "\\'")}',event)" style="background:rgba(212,69,106,0.1);border:1px solid rgba(212,69,106,0.2);color:#f0a500;padding:4px 10px;border-radius:20px;font-size:0.76rem;cursor:pointer">${w} 🔊</span>`).join('')}
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
    const lnames = { A: "📖 Gramática & Vocabulario", B: "🎧 Comprensión Auditiva", C: "📖 Lectura", D: "🎤 Expresión Oral & Escrita" };
    content.innerHTML = `<div>
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px;padding-bottom:12px;border-bottom:1px solid rgba(255,255,255,0.08)">
        <button onclick="window.openUnit(window.__curUnit)" style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);color:#fff5f0;padding:6px 12px;border-radius:8px;cursor:pointer;font-size:0.8rem;font-family:inherit">← Volver</button>
        <div style="font-weight:700;color:#fff5f0">${unit.emoji} ${unit.title} — ${lnames[lk]}</div>
        <span style="margin-left:auto;font-size:0.72rem;color:#f0a500;background:rgba(240,165,0,0.1);padding:3px 10px;border-radius:20px">${unit.level}</span>
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
        const wd = WDB.find(x => x.e === w) || { ex: `Usa la palabra "${w}".`, eu: '', u: '' };
        const blank = wd.ex.replace(new RegExp('\\b' + w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i'), '_______');
        return `<div style="margin-bottom:14px;padding:14px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:12px">
          <div style="font-size:0.9rem;margin-bottom:4px">${i + 1}. ${blank}</div>
          <div style="font-size:0.75rem;color:#666;margin-bottom:8px;font-style:italic">${wd.eu}</div>
          <input id="gex${i}" data-ans="${w}" placeholder="Tu respuesta..." style="width:100%;padding:8px 12px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:8px;color:#fff5f0;font-family:inherit;margin-bottom:8px;box-sizing:border-box">
          <div style="display:flex;gap:6px">
            <button onclick="window.chkFill(${i})" style="padding:6px 14px;border-radius:8px;background:rgba(46,204,113,0.1);border:1px solid rgba(46,204,113,0.3);color:#2ecc71;cursor:pointer;font-size:0.78rem;font-family:inherit">✓ Comprobar</button>
            <button onclick="window.aiExWord('${w.replace(/'/g, "\\'")}',event)" style="padding:6px 14px;border-radius:8px;background:rgba(240,165,0,0.1);border:1px solid rgba(240,165,0,0.25);color:#f0a500;cursor:pointer;font-size:0.78rem;font-family:inherit">🤖 AI</button>
            <button onclick="window.spk('${w.replace(/'/g, "\\'")}',event)" style="padding:6px 14px;border-radius:8px;background:rgba(212,69,106,0.1);border:1px solid rgba(212,69,106,0.2);color:#d4456a;cursor:pointer;font-size:0.78rem;font-family:inherit">🔊</button>
          </div>
          <div id="gexfb${i}" style="margin-top:6px;font-size:0.8rem"></div>
        </div>`;
    }).join('');

    const matchW = words.slice(0, 6);
    const shuffUZ = shuffle(matchW.map(w => { const d = WDB.find(x => x.e === w); return d ? d.u : w; }));

    return `
    <div style="margin-bottom:20px">
      <h3 style="margin-bottom:12px;color:#fff5f0">📚 Vocabulario</h3>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:10px">
        ${words.map(w => {
        const d = WDB.find(x => x.e === w) || { u: '', t: '', ex: '', eu: '' };
        return `<div style="padding:14px;border-radius:12px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06)">
              <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px">
                <span style="font-weight:700;font-size:1rem;color:#fff5f0">${w}</span>
                <button onclick="window.spk('${w.replace(/'/g, "\\'")}',event)" style="background:none;border:none;cursor:pointer;font-size:1rem">🔊</button>
              </div>
              <div style="color:#f0a500;font-size:0.82rem;margin-bottom:3px">${d.u}</div>
              <div style="color:#666;font-size:0.72rem;font-style:italic">"${d.ex}"</div>
            </div>`;
    }).join('')}
      </div>
    </div>
    <div style="margin-bottom:20px;padding:16px;background:rgba(212,69,106,0.06);border:1px solid rgba(212,69,106,0.15);border-radius:12px">
      <h3 style="margin-bottom:10px;color:#fff5f0">📝 Regla Gramatical</h3>
      <div style="font-size:0.9rem;color:#ffd4de;margin-bottom:8px">💡 ${unit.grammar_rule || ''}</div>
      <div style="font-size:0.85rem;color:#f0a500;font-style:italic">✏️ ${unit.grammar_example || ''}</div>
      <button onclick="window.aiGrammarExplain('${unit.title}','${(unit.grammar_rule || '').replace(/'/g, "\\'")}')" style="margin-top:10px;padding:8px 16px;border-radius:8px;background:rgba(240,165,0,0.1);border:1px solid rgba(240,165,0,0.25);color:#f0a500;cursor:pointer;font-size:0.78rem;font-family:inherit">🤖 AI batafsil tushuntirsin (1 token)</button>
      <div id="gramRuleFB" style="margin-top:8px;font-size:0.8rem"></div>
    </div>
    <div style="margin-bottom:20px">
      <h3 style="margin-bottom:12px;color:#fff5f0">✏️ Ejercicios de Relleno</h3>
      ${fills}
      <div id="vocabAIFB" style="font-size:0.8rem"></div>
    </div>
    <div style="margin-bottom:20px">
      <h3 style="margin-bottom:12px;color:#fff5f0">🧩 Ejercicio de Emparejamiento</h3>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        <div>${matchW.map((w, i) => `<div class="match-item eng" data-i="${i}" onclick="window.selMatch(this,'e',${i})" style="padding:10px 14px;border-radius:10px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);cursor:pointer;margin-bottom:6px;font-size:0.88rem;color:#fff5f0;transition:all 0.2s">${w}</div>`).join('')}</div>
        <div>${shuffUZ.map(u => `<div class="match-item uz" data-u="${u}" onclick="window.selMatch(this,'u','${u.replace(/'/g, "\\'")}')" style="padding:10px 14px;border-radius:10px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);cursor:pointer;margin-bottom:6px;font-size:0.88rem;color:#f0a500;transition:all 0.2s">${u}</div>`).join('')}</div>
      </div>
      <div id="matchFB" style="margin-top:8px;font-size:0.8rem"></div>
    </div>
    <button onclick="window.finLessonA('${unit.id}')" style="width:100%;padding:14px;border-radius:12px;background:linear-gradient(135deg,#d4456a,#f0a500);border:none;color:#fff;font-size:0.95rem;font-weight:700;cursor:pointer;font-family:inherit">✅ Gramática leccioni yakunlash</button>`;
}

window.chkFill = function (i) {
    const inp = $id(`gex${i}`); const fb = $id(`gexfb${i}`);
    if (!inp || !fb) return;
    if (inp.value.trim().toLowerCase() === inp.dataset.ans.toLowerCase()) {
        fb.innerHTML = `<span style="color:#2ecc71">✅ ¡Correcto! "${inp.dataset.ans}"</span>`;
        inp.style.borderColor = '#2ecc71'; lScore++; awardXP(10, 'grammar');
    } else {
        fb.innerHTML = `<span style="color:#ef4444">❌ Respuesta correcta: <strong>${inp.dataset.ans}</strong></span>`;
        inp.style.borderColor = '#ef4444';
    }
    lTotal++;
};

window.selMatch = function (el, type, val) {
    if (type === 'e') {
        document.querySelectorAll('.match-item.eng').forEach(x => { x.style.borderColor = 'rgba(255,255,255,0.1)'; x.style.background = 'rgba(255,255,255,0.04)'; });
        el.style.background = 'rgba(212,69,106,0.2)'; el.style.borderColor = '#d4456a';
        mSel.e = val; mSel.eEl = el;
    } else {
        document.querySelectorAll('.match-item.uz').forEach(x => { x.style.borderColor = 'rgba(255,255,255,0.1)'; x.style.background = 'rgba(255,255,255,0.04)'; });
        el.style.background = 'rgba(240,165,0,0.2)'; el.style.borderColor = '#f0a500';
        mSel.u = val; mSel.uEl = el;
    }
    if (mSel.e !== null && mSel.u !== null) {
        const w = (curUnit?.words || [])[mSel.e];
        const wd = WDB.find(x => x.e === w);
        if (wd && wd.u === mSel.u) {
            mSel.eEl.style.background = 'rgba(46,204,113,0.15)'; mSel.eEl.style.borderColor = '#2ecc71';
            mSel.uEl.style.background = 'rgba(46,204,113,0.15)'; mSel.uEl.style.borderColor = '#2ecc71';
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
    const ok = await spendTokens(TOKEN_CONFIG.ai_cost, 'AI gramática izoh'); if (!ok) return;
    const fb = $id('gramRuleFB'); if (fb) fb.innerHTML = '🤖 AI tahlil qilmoqda...';
    const r = await callAI(`"${title}" mavzusida "${rule}" ispan tili grammatika qoidasini O'zbek tilida tushuntir. 3 ta misol keltir.`, 800);
    if (fb) fb.innerHTML = r.replace(/\n/g, '<br>');
};

window.aiExWord = async function (word, e) {
    if (e) e.stopPropagation();
    const ok = await spendTokens(TOKEN_CONFIG.ai_cost, `"${word}" AI izoh`); if (!ok) return;
    const fb = $id('vocabAIFB') || $id('wordAIFB');
    if (fb) fb.innerHTML = `🤖 "${word}" tahlil qilmoqda...`;
    const r = await callAI(`"${word}" ispancha so'zini O'zbek tilida: 1) Ma'nosi 2) 3 misol 3) Eslatma`, 600);
    if (fb) fb.innerHTML = r.replace(/\n/g, '<br>');
};

window.finLessonA = async function (uid) { await finLesson(uid, 'A', 'grammar', lScore, lTotal || 4); };

// ─── LESSON B ───
function lessonB(unit) {
    const exs = genListenExs(unit);
    window.__listenExs = exs;
    return `
    <div style="margin-bottom:20px">
      <h3 style="margin-bottom:12px;color:#fff5f0">🎧 Comprensión Auditiva</h3>
      <div id="lexCont">${renderLex(exs, 0)}</div>
    </div>
    <div style="margin-bottom:20px;padding:16px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:12px">
      <h3 style="margin-bottom:12px;color:#fff5f0">✍️ Dictado</h3>
      <div style="display:flex;gap:8px;margin-bottom:12px">
        <button onclick="window.playDict('${unit.id}','normal')" style="padding:8px 16px;border-radius:8px;background:rgba(212,69,106,0.1);border:1px solid rgba(212,69,106,0.2);color:#d4456a;cursor:pointer;font-size:0.82rem;font-family:inherit">▶ Escuchar</button>
        <button onclick="window.playDict('${unit.id}','slow')" style="padding:8px 16px;border-radius:8px;background:rgba(240,165,0,0.1);border:1px solid rgba(240,165,0,0.2);color:#f0a500;cursor:pointer;font-size:0.82rem;font-family:inherit">🐌 Lento</button>
      </div>
      <textarea id="dictIn" placeholder="Escribe lo que escuches..." style="width:100%;height:80px;padding:10px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:8px;color:#fff5f0;font-family:inherit;resize:none;box-sizing:border-box"></textarea>
      <div style="display:flex;gap:6px;margin-top:8px">
        <button onclick="window.chkDict()" style="padding:7px 14px;border-radius:8px;background:rgba(46,204,113,0.1);border:1px solid rgba(46,204,113,0.3);color:#2ecc71;cursor:pointer;font-size:0.78rem;font-family:inherit">✓ Comprobar</button>
        <button onclick="window.aiChkDict()" style="padding:7px 14px;border-radius:8px;background:rgba(240,165,0,0.1);border:1px solid rgba(240,165,0,0.25);color:#f0a500;cursor:pointer;font-size:0.78rem;font-family:inherit">🤖 AI tahlil (1 token)</button>
      </div>
      <div id="dictFB" style="margin-top:8px;font-size:0.8rem"></div>
    </div>
    <button onclick="window.finLessonB('${unit.id}')" style="width:100%;padding:14px;border-radius:12px;background:linear-gradient(135deg,#22d3ee,#d4456a);border:none;color:#fff;font-size:0.95rem;font-weight:700;cursor:pointer;font-family:inherit">✅ Comprensión auditiva yakunlash</button>`;
}

function genListenExs(unit) {
    const w = unit.words;
    return [
        { text: `Hoy hablamos de ${unit.title.toLowerCase()}. La palabra "${w[0]}" es muy importante en español.`, q: `¿De qué trata principalmente el texto?`, opts: [unit.title, 'Deportes', 'Cocina', 'Viajes'], c: 0, tip: `"Hoy hablamos de..."` },
        { text: `¡Hola! Me llamo Sofía. Hoy les voy a enseñar sobre ${w[0]} y ${w[1] || w[0]}. Primero, vamos a ver "${w[0]}". ¿Están listos?`, q: `¿Sobre qué enseñará Sofía primero?`, opts: [`${w[2] || w[0]}`, `${w[0]}`, `${w[1] || w[0]}`, 'Todo a la vez'], c: 1, tip: `"Primero, vamos a ver..."` },
        { text: `${unit.title} es un tema fascinante. Si quieres mejorar tu español, debes practicar cada día. Con práctica todo se hace más fácil.`, q: `¿Qué se hace más fácil con la práctica?`, opts: [`${w[0]}`, `${w[1] || w[0]}`, 'Todo', 'Nada'], c: 2, tip: `"...con práctica todo se hace más fácil"` }
    ];
}

function renderLex(exs, idx) {
    const ex = exs[idx];
    if (!ex) return '<div style="text-align:center;padding:20px;color:#2ecc71">🎉 ¡Todos los ejercicios completados!</div>';
    return `<div style="padding:16px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:12px">
      <div style="font-size:0.75rem;color:#f0a500;margin-bottom:8px">Pregunta ${idx + 1}/${exs.length}</div>
      <div style="display:flex;gap:8px;margin-bottom:12px">
        <button onclick="window.playLex(${idx},'normal')" style="padding:8px 16px;border-radius:8px;background:rgba(212,69,106,0.1);border:1px solid rgba(212,69,106,0.2);color:#d4456a;cursor:pointer;font-size:0.82rem;font-family:inherit">▶ Escuchar</button>
        <button onclick="window.playLex(${idx},'slow')" style="padding:8px 16px;border-radius:8px;background:rgba(240,165,0,0.1);border:1px solid rgba(240,165,0,0.2);color:#f0a500;cursor:pointer;font-size:0.82rem;font-family:inherit">🐌 Lento</button>
      </div>
      <div id="ltxt${idx}" style="display:none;padding:10px;background:rgba(255,255,255,0.04);border-radius:8px;font-size:0.82rem;color:#fff5f0;margin-bottom:10px;font-style:italic">${ex.text}</div>
      <div style="font-weight:600;margin-bottom:10px;color:#fff5f0">${ex.q}</div>
      <div>${ex.opts.map((o, oi) => `<div class="lex-opt" data-qi="${idx}" data-oi="${oi}" onclick="window.selLex(this,${idx},${oi})" style="padding:10px 14px;border-radius:8px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);cursor:pointer;margin-bottom:6px;font-size:0.88rem;transition:all 0.2s;color:#fff5f0">${String.fromCharCode(65 + oi)}. ${o}</div>`).join('')}</div>
      <div style="font-size:0.75rem;color:#666;margin-bottom:10px">💡 ${ex.tip}</div>
      <div style="display:flex;gap:6px">
        <button onclick="window.chkLex(${idx},${ex.c})" style="padding:7px 14px;border-radius:8px;background:rgba(46,204,113,0.1);border:1px solid rgba(46,204,113,0.3);color:#2ecc71;cursor:pointer;font-size:0.78rem;font-family:inherit">✓ Comprobar</button>
        ${idx + 1 < exs.length ? `<button onclick="window.nextLex(${idx + 1})" id="lexnxt${idx}" style="display:none;padding:7px 14px;border-radius:8px;background:rgba(212,69,106,0.1);border:1px solid rgba(212,69,106,0.2);color:#d4456a;cursor:pointer;font-size:0.78rem;font-family:inherit">→ Siguiente</button>` : ''}
      </div>
      <div id="lexfb${idx}" style="margin-top:8px;font-size:0.8rem"></div>
    </div>`;
}

window.playLex = function (idx, speed) {
    const exs = window.__listenExs || []; if (!exs[idx]) return;
    const u = new SpeechSynthesisUtterance(exs[idx].text);
    u.lang = 'es-ES'; u.rate = speed === 'slow' ? 0.55 : 0.82;
    speechSynthesis.cancel(); speechSynthesis.speak(u);
};
window.selLex = function (el, qi, oi) {
    document.querySelectorAll(`.lex-opt[data-qi="${qi}"]`).forEach(o => { o.style.background = 'rgba(255,255,255,0.04)'; o.style.borderColor = 'rgba(255,255,255,0.08)'; });
    el.style.background = 'rgba(212,69,106,0.15)'; el.style.borderColor = '#d4456a';
    lexSel[qi] = oi;
};
window.chkLex = function (idx, correct) {
    const fb = $id(`lexfb${idx}`);
    const sel = lexSel[idx];
    if (sel === undefined) { if (fb) fb.innerHTML = '<span style="color:#f5c842">⚠️ Selecciona una respuesta!</span>'; return; }
    document.querySelectorAll(`.lex-opt[data-qi="${idx}"]`).forEach((o, i) => {
        if (i === correct) { o.style.background = 'rgba(46,204,113,0.2)'; o.style.borderColor = '#2ecc71'; }
        else if (i === sel && sel !== correct) { o.style.background = 'rgba(239,68,68,0.2)'; o.style.borderColor = '#ef4444'; }
    });
    const txEl = $id(`ltxt${idx}`); if (txEl) txEl.style.display = 'block';
    if (sel === correct) { if (fb) fb.innerHTML = '<span style="color:#2ecc71">✅ ¡Correcto!</span>'; lScore++; awardXP(15, 'listening'); }
    else { if (fb) fb.innerHTML = `<span style="color:#ef4444">❌ Correcto: <strong>${String.fromCharCode(65 + correct)}</strong></span>`; }
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
    dictSent = wd ? wd.ex : `El ${unit.words[0]} es muy importante.`;
    const u2 = new SpeechSynthesisUtterance(dictSent);
    u2.lang = 'es-ES'; u2.rate = speed === 'slow' ? 0.5 : 0.82;
    speechSynthesis.cancel(); speechSynthesis.speak(u2);
};
window.chkDict = function () {
    const inp = $id('dictIn'); const fb = $id('dictFB');
    if (!inp || !fb || !dictSent) { if (fb) fb.innerHTML = '<span style="color:#f5c842">⚠️ ¡Primero escucha el audio!</span>'; return; }
    const cw = dictSent.toLowerCase().replace(/[.,!?¡¿]/g, '').split(' ');
    const uw = inp.value.trim().toLowerCase().replace(/[.,!?¡¿]/g, '').split(' ');
    let mc = 0;
    const hl = cw.map(w => {
        if (uw.includes(w)) { mc++; return `<span style="color:#2ecc71;font-weight:600">${w}</span>`; }
        return `<span style="color:#ef4444">${w}</span>`;
    }).join(' ');
    const pct = Math.round((mc / cw.length) * 100);
    fb.innerHTML = `<div><strong>Correcto:</strong> ${hl}</div><div style="margin-top:6px"><strong>Tú:</strong> ${inp.value}</div><div style="font-size:0.9rem;font-weight:700;margin-top:6px;color:${pct >= 70 ? '#2ecc71' : '#ef4444'}">${pct}%</div>`;
    if (pct >= 70) { lScore++; awardXP(20, 'listening'); }
    lTotal++;
};
window.aiChkDict = async function () {
    const ok = await spendTokens(TOKEN_CONFIG.ai_cost, 'AI dictado tahlil'); if (!ok) return;
    const inp = $id('dictIn'); const fb = $id('dictFB');
    if (!inp?.value.trim()) { if (fb) fb.innerHTML = '<span style="color:#f5c842">Primero escribe!</span>'; return; }
    fb.innerHTML = '🤖 AI tahlil qilmoqda...';
    const r = await callAI(`Dictado tahlili O'zbek tilida:\nAsl: "${dictSent}"\nO'quvchi: "${inp.value.trim()}"\n1) Xatolari 2) Ball: /10 3) Maslahat`, 600);
    fb.innerHTML = r.replace(/\n/g, '<br>');
};
window.finLessonB = async function (uid) { await finLesson(uid, 'B', 'listening', lScore, lTotal || 3); };

// ─── LESSON C ───
function lessonC(unit) {
    const qs = unit.reading_qs || [];
    const wh = unit.words.slice(0, 5);
    return `
    <div style="margin-bottom:20px">
      <h3 style="margin-bottom:12px;color:#fff5f0">📖 Lectura</h3>
      <div style="padding:16px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:12px">
        <div style="font-weight:700;font-size:1rem;margin-bottom:10px;color:#fff5f0">${unit.title}</div>
        <div id="rdbody" style="font-size:0.88rem;line-height:1.7;color:#ffd4de">${unit.reading_text || ''}</div>
        <div style="display:flex;gap:6px;margin-top:12px">
          <button onclick="window.rdAloud()" style="padding:7px 14px;border-radius:8px;background:rgba(212,69,106,0.1);border:1px solid rgba(212,69,106,0.2);color:#d4456a;cursor:pointer;font-size:0.78rem;font-family:inherit">🔊 Escuchar</button>
        </div>
      </div>
    </div>
    <div style="margin-bottom:20px">
      <h3 style="margin-bottom:12px;color:#fff5f0">❓ Preguntas de Comprensión</h3>
      ${qs.map((q, qi) => `<div style="margin-bottom:14px;padding:14px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:12px">
        <div style="font-weight:600;margin-bottom:10px;color:#fff5f0">${qi + 1}. ${q.q}</div>
        <div>${q.opts.map((o, oi) => `<div class="rq-opt" data-qi="${qi}" data-oi="${oi}" onclick="window.selRQ(this,${qi},${oi})" style="padding:10px 14px;border-radius:8px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);cursor:pointer;margin-bottom:6px;font-size:0.88rem;transition:all 0.2s;color:#fff5f0">${String.fromCharCode(65 + oi)}. ${o}</div>`).join('')}</div>
        <div id="rqfb${qi}" style="margin-top:6px;font-size:0.8rem"></div>
      </div>`).join('')}
      <button onclick="window.chkAllRQ(${JSON.stringify(qs.map(q => q.c))})" style="padding:8px 16px;border-radius:8px;background:rgba(46,204,113,0.1);border:1px solid rgba(46,204,113,0.3);color:#2ecc71;cursor:pointer;font-size:0.82rem;font-family:inherit;margin-top:8px">✓ Comprobar todo</button>
      <div id="rdTotFB" style="margin-top:8px;font-size:0.8rem"></div>
    </div>
    <div style="margin-bottom:20px">
      <h3 style="margin-bottom:12px;color:#fff5f0">🔤 Escritura de palabras</h3>
      ${wh.map((w, i) => {
        const d = WDB.find(x => x.e === w) || { u: w };
        return `<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
          <span style="color:#f0a500;font-size:0.85rem;min-width:80px">${d.u}</span>
          <input id="whi${i}" data-ans="${w}" placeholder="en español..." style="flex:1;padding:8px 12px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:8px;color:#fff5f0;font-family:inherit">
          <button onclick="window.chkWH(${i})" style="padding:7px 12px;border-radius:8px;background:rgba(46,204,113,0.1);border:1px solid rgba(46,204,113,0.3);color:#2ecc71;cursor:pointer;font-size:0.78rem;font-family:inherit">✓</button>
          <button onclick="window.spk('${w.replace(/'/g, "\\'")}',event)" style="padding:7px 12px;border-radius:8px;background:rgba(212,69,106,0.1);border:1px solid rgba(212,69,106,0.2);color:#d4456a;cursor:pointer;font-size:0.78rem;font-family:inherit">🔊</button>
          <span id="whfb${i}" style="font-size:0.8rem;min-width:30px"></span>
        </div>`;
    }).join('')}
    </div>
    <button onclick="window.finLessonC('${unit.id}')" style="width:100%;padding:14px;border-radius:12px;background:linear-gradient(135deg,#2ecc71,#22d3ee);border:none;color:#fff;font-size:0.95rem;font-weight:700;cursor:pointer;font-family:inherit">✅ Lectura yakunlash</button>`;
}

window.rdAloud = function () {
    const b = $id('rdbody'); if (!b) return;
    const u = new SpeechSynthesisUtterance(b.textContent);
    u.lang = 'es-ES'; u.rate = 0.82;
    speechSynthesis.cancel(); speechSynthesis.speak(u);
};
window.selRQ = function (el, qi, oi) {
    document.querySelectorAll(`.rq-opt[data-qi="${qi}"]`).forEach(o => { o.style.background = 'rgba(255,255,255,0.04)'; o.style.borderColor = 'rgba(255,255,255,0.08)'; });
    el.style.background = 'rgba(212,69,106,0.15)'; el.style.borderColor = '#d4456a';
    rSel[qi] = oi;
};
window.chkAllRQ = function (answers) {
    let score = 0;
    answers.forEach((correct, qi) => {
        const sel = rSel[qi]; const fb = $id(`rqfb${qi}`);
        if (sel === undefined) { if (fb) fb.innerHTML = '<span style="color:#f5c842">⚠️ Selecciona una respuesta!</span>'; return; }
        document.querySelectorAll(`.rq-opt[data-qi="${qi}"]`).forEach((o, i) => {
            if (i === correct) { o.style.background = 'rgba(46,204,113,0.2)'; o.style.borderColor = '#2ecc71'; }
            else if (i === sel && sel !== correct) { o.style.background = 'rgba(239,68,68,0.2)'; o.style.borderColor = '#ef4444'; }
        });
        if (sel === correct) { score++; if (fb) fb.innerHTML = '<span style="color:#2ecc71">✅ ¡Correcto!</span>'; }
        else { if (fb) fb.innerHTML = `<span style="color:#ef4444">❌ Correcto: ${String.fromCharCode(65 + correct)}</span>`; }
    });
    lScore += score; lTotal += answers.length;
    awardXP(score * 15, 'reading');
    const fb = $id('rdTotFB');
    if (fb) fb.innerHTML = `<span style="color:${score === answers.length ? '#2ecc71' : '#f5c842'}">Total: ${score}/${answers.length}</span>`;
};
window.chkWH = function (i) {
    const inp = $id(`whi${i}`); const fb = $id(`whfb${i}`); if (!inp || !fb) return;
    if (inp.value.trim().toLowerCase() === inp.dataset.ans.toLowerCase()) {
        fb.innerHTML = '✅'; inp.style.borderColor = '#2ecc71'; awardXP(8, 'writing');
    } else { fb.innerHTML = '❌'; inp.style.borderColor = '#ef4444'; }
};
window.finLessonC = async function (uid) { await finLesson(uid, 'C', 'reading', lScore, lTotal || 6); };

// ─── LESSON D ───
function lessonD(unit) {
    const topics = unit.words.slice(0, 3);
    const woSent = (WDB.find(x => x.e === unit.words[0])?.ex) || `Uso ${unit.words[0]} cada día.`;
    window.__woCorrect = woSent;
    return `
    <div style="margin-bottom:20px">
      <h3 style="margin-bottom:12px;color:#fff5f0">🎤 Expresión Oral</h3>
      ${topics.map((w, i) => {
        const d = WDB.find(x => x.e === w) || { u: '', ex: '' };
        return `<div style="margin-bottom:14px;padding:14px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:12px">
          <div style="font-weight:600;margin-bottom:4px;color:#fff5f0">${i + 1}. Usa la palabra "${w}" en una oración:</div>
          <div style="font-size:0.78rem;color:#666;margin-bottom:10px">Uzbek: ${d.u} · Ejemplo: ${d.ex}</div>
          <div style="display:flex;gap:6px;margin-bottom:8px">
            <button id="mbtn${i}" onclick="window.togMic(${i})" style="padding:8px 16px;border-radius:8px;background:rgba(212,69,106,0.1);border:1px solid rgba(212,69,106,0.25);color:#d4456a;cursor:pointer;font-size:0.82rem;font-family:inherit">🎤 Hablar</button>
            <button onclick="window.spk('${w.replace(/'/g, "\\'")}',event)" style="padding:8px 12px;border-radius:8px;background:rgba(240,165,0,0.1);border:1px solid rgba(240,165,0,0.2);color:#f0a500;cursor:pointer;font-size:0.82rem;font-family:inherit">🔊</button>
          </div>
          <div id="mst${i}" style="font-size:0.75rem;color:#666"></div>
          <div id="mtr${i}" style="padding:8px;font-size:0.88rem;color:#ffd4de;min-height:24px;border-radius:6px"></div>
          <div style="display:flex;gap:6px;margin-top:8px">
            <button onclick="window.aiSpk(${i},'${w}')" style="padding:6px 14px;border-radius:8px;background:rgba(240,165,0,0.1);border:1px solid rgba(240,165,0,0.25);color:#f0a500;cursor:pointer;font-size:0.78rem;font-family:inherit">🤖 AI baholash (1 token)</button>
            <button onclick="window.markDone(${i})" style="padding:6px 14px;border-radius:8px;background:rgba(46,204,113,0.1);border:1px solid rgba(46,204,113,0.3);color:#2ecc71;cursor:pointer;font-size:0.78rem;font-family:inherit">✅ Completado</button>
          </div>
          <div id="sfb${i}" style="margin-top:8px;font-size:0.82rem"></div>
        </div>`;
    }).join('')}
    </div>
    <div style="margin-bottom:20px">
      <h3 style="margin-bottom:12px;color:#fff5f0">✍️ Expresión Escrita</h3>
      <div style="padding:14px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:12px">
        <div style="font-size:0.85rem;color:#aaa;margin-bottom:8px">Tema: Escribe un texto de 40+ palabras sobre "${unit.title}".</div>
        <textarea id="dta" placeholder="Escribe aquí..." oninput="window.updWC()" style="width:100%;height:100px;padding:10px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:8px;color:#fff5f0;font-family:inherit;resize:none;box-sizing:border-box"></textarea>
        <div style="display:flex;gap:10px;font-size:0.75rem;color:#666;margin:6px 0"><span id="dwc">0 palabras</span><span id="dcc">0 caracteres</span><span id="dst" style="color:#f87171">Mín 40 palabras</span></div>
        <div style="display:flex;gap:6px">
          <button onclick="window.aiWrit('${unit.title}','${unit.words.slice(0, 5).join(',')}')" style="padding:7px 14px;border-radius:8px;background:rgba(240,165,0,0.1);border:1px solid rgba(240,165,0,0.25);color:#f0a500;cursor:pointer;font-size:0.78rem;font-family:inherit">🤖 AI (1 token)</button>
          <button onclick="window.selfChk(40)" style="padding:7px 14px;border-radius:8px;background:rgba(212,69,106,0.1);border:1px solid rgba(212,69,106,0.2);color:#d4456a;cursor:pointer;font-size:0.78rem;font-family:inherit">📊 Contar palabras</button>
        </div>
        <div id="wfb" style="margin-top:8px;font-size:0.8rem"></div>
      </div>
    </div>
    <div style="margin-bottom:20px">
      <h3 style="margin-bottom:12px;color:#fff5f0">🔀 Ordenar Palabras</h3>
      <div id="woChips" style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px">
        ${shuffle(woSent.split(' ')).map(w => `<div class="wo-chip" data-w="${w}" onclick="window.selChip(this)" style="background:rgba(212,69,106,0.1);border:1px solid rgba(212,69,106,0.2);border-radius:20px;padding:6px 12px;cursor:pointer;font-size:0.85rem;color:#d4456a">${w}</div>`).join('')}
      </div>
      <div id="woAnsDiv" style="min-height:40px;padding:10px;background:rgba(255,255,255,0.03);border:1px dashed rgba(255,255,255,0.1);border-radius:8px;display:flex;flex-wrap:wrap;gap:6px;font-size:0.88rem;color:#666;margin-bottom:8px"><span>Haz clic aquí...</span></div>
      <div style="display:flex;gap:6px">
        <button onclick="window.chkWO()" style="padding:7px 14px;border-radius:8px;background:rgba(46,204,113,0.1);border:1px solid rgba(46,204,113,0.3);color:#2ecc71;cursor:pointer;font-size:0.78rem;font-family:inherit">✓ Comprobar</button>
        <button onclick="window.rstWO()" style="padding:7px 14px;border-radius:8px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);color:#fff5f0;cursor:pointer;font-size:0.78rem;font-family:inherit">🔄 Reiniciar</button>
        <button onclick="window.spk('${woSent.replace(/'/g, "\\'")}',event)" style="padding:7px 14px;border-radius:8px;background:rgba(212,69,106,0.1);border:1px solid rgba(212,69,106,0.2);color:#d4456a;cursor:pointer;font-size:0.78rem;font-family:inherit">🔊</button>
      </div>
      <div id="wofb" style="margin-top:8px;font-size:0.8rem"></div>
    </div>
    <button onclick="window.finLessonD('${unit.id}')" style="width:100%;padding:14px;border-radius:12px;background:linear-gradient(135deg,#d4456a,#f0a500);border:none;color:#fff;font-size:0.95rem;font-weight:700;cursor:pointer;font-family:inherit">✅ Expresión oral & escrita yakunlash</button>`;
}

window.selChip = function (el) {
    if (el.classList.contains('used')) return;
    el.classList.add('used'); el.style.opacity = '0.3';
    woAns.push(el.dataset.w);
    const d = $id('woAnsDiv');
    if (d) d.innerHTML = woAns.map((w, i) => `<span onclick="window.rmChip(${i})" style="background:rgba(212,69,106,0.15);border:1px solid rgba(212,69,106,0.3);border-radius:20px;padding:6px 12px;cursor:pointer;font-size:0.85rem;color:#d4456a">${w}</span>`).join('') || '<span style="color:#666">Haz clic aquí...</span>';
};
window.rmChip = function (idx) {
    const w = woAns[idx]; woAns.splice(idx, 1);
    document.querySelectorAll('.wo-chip').forEach(c => { if (c.dataset.w === w && c.classList.contains('used')) { c.classList.remove('used'); c.style.opacity = '1'; return; } });
    const d = $id('woAnsDiv');
    if (d) d.innerHTML = woAns.map((w, i) => `<span onclick="window.rmChip(${i})" style="background:rgba(212,69,106,0.15);border:1px solid rgba(212,69,106,0.3);border-radius:20px;padding:6px 12px;cursor:pointer;font-size:0.85rem;color:#d4456a">${w}</span>`).join('') || '<span style="color:#666">Haz clic aquí...</span>';
};
window.rstWO = function () {
    woAns = [];
    document.querySelectorAll('.wo-chip').forEach(c => { c.classList.remove('used'); c.style.opacity = '1'; });
    const d = $id('woAnsDiv'); if (d) d.innerHTML = '<span style="color:#666">Haz clic aquí...</span>';
};
window.chkWO = function () {
    const fb = $id('wofb');
    if (!woAns.length) { if (fb) fb.innerHTML = '<span style="color:#f5c842">⚠️ ¡Ordena las palabras!</span>'; return; }
    if (woAns.join(' ').toLowerCase() === (window.__woCorrect || '').toLowerCase()) {
        if (fb) fb.innerHTML = '<span style="color:#2ecc71">🏆 ¡Perfecto!</span>';
        awardXP(15, 'writing'); lScore++;
    } else { if (fb) fb.innerHTML = `<span style="color:#ef4444">❌ Correcto: <em>${window.__woCorrect}</em></span>`; }
    lTotal++;
};
window.togMic = function (idx) {
    const btn = $id(`mbtn${idx}`); const st = $id(`mst${idx}`); const tr = $id(`mtr${idx}`);
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
        if (tr) tr.innerHTML = `<textarea style="width:100%;padding:8px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:8px;color:#fff5f0;font-family:inherit" id="man${idx}" placeholder="Escribe aquí..."></textarea>`;
        if (st) st.textContent = '⌨️ Entrada escrita'; return;
    }
    if (lessonMics[idx]) { try { lessonMics[idx].stop(); } catch (e) { } lessonMics[idx] = null; if (btn) btn.innerHTML = '🎤 Hablar'; return; }
    const rec = new SR(); rec.lang = 'es-ES'; rec.continuous = true; rec.interimResults = true;
    rec.onresult = e => { let t = ''; for (let i = e.resultIndex; i < e.results.length; i++) t += e.results[i][0].transcript; if (tr && tr.tagName !== 'TEXTAREA') tr.textContent = t; };
    rec.onerror = e => {
        if (btn) btn.innerHTML = '🎤 Hablar'; lessonMics[idx] = null;
        if (e.error === 'not-allowed' && tr) tr.innerHTML = `<textarea style="width:100%;padding:8px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:8px;color:#fff5f0;font-family:inherit" id="man${idx}" placeholder="Escribe aquí..."></textarea>`;
    };
    rec.onend = () => { if (btn) btn.innerHTML = '🎤 Hablar'; if (st) st.innerHTML = '✅ Grabado'; lessonMics[idx] = null; };
    try {
        rec.start(); lessonMics[idx] = rec;
        if (btn) btn.innerHTML = '⏹ Parar';
        if (st) st.innerHTML = '🔴 Grabando...';
    } catch (e) {
        if (tr) tr.innerHTML = `<textarea style="width:100%;padding:8px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:8px;color:#fff5f0;font-family:inherit" id="man${idx}" placeholder="Escribe aquí..."></textarea>`;
    }
};
window.aiSpk = async function (idx, topic) {
    const ok = await spendTokens(TOKEN_CONFIG.ai_cost, 'AI speaking baholash'); if (!ok) return;
    const tr = $id(`mtr${idx}`); const man = $id(`man${idx}`); const fb = $id(`sfb${idx}`);
    let text = '';
    if (tr) text = tr.tagName === 'TEXTAREA' ? tr.value.trim() : tr.textContent.trim();
    if (!text && man) text = man.value.trim();
    if (!text) { if (fb) fb.innerHTML = '<span style="color:#f5c842">⚠️ ¡Primero habla!</span>'; return; }
    if (fb) fb.innerHTML = '🤖 Evaluando...';
    const r = await callAI(`Speaking baholash ispancha. Mavzu: "${topic}". O'quvchi: "${text}".\nO'zbek tilida: 1) ✅ Yaxshi tomonlar 2) ❌ Xatoliklar 3) 🔄 Tuzatilgan variant 4) ⭐ /10`, 700);
    if (fb) fb.innerHTML = r.replace(/\n/g, '<br>');
    lScore++; lTotal++; awardXP(20, 'speaking');
};
window.markDone = function (idx) { lScore++; lTotal++; awardXP(10, 'speaking'); showToast('✅ ¡Completado!', 'success'); };
window.updWC = function () {
    const ta = $id('dta'); if (!ta) return;
    const w = ta.value.trim() ? ta.value.trim().split(/\s+/).length : 0;
    const wc = $id('dwc'); const cc = $id('dcc'); const st = $id('dst');
    if (wc) wc.textContent = w + " palabras";
    if (cc) cc.textContent = ta.value.length + ' caracteres';
    if (st) { st.textContent = w >= 40 ? '✅ Suficiente' : `Mín 40 (${w}/40)`; st.style.color = w >= 40 ? '#2ecc71' : '#f87171'; }
};
window.selfChk = function (min) {
    const ta = $id('dta'); const fb = $id('wfb'); if (!ta || !fb) return;
    const w = ta.value.trim() ? ta.value.trim().split(/\s+/).length : 0;
    if (w >= min) { fb.innerHTML = `<span style="color:#2ecc71">✅ ${w} palabras!</span>`; lScore++; awardXP(15, 'writing'); }
    else { fb.innerHTML = `<span style="color:#f87171">⚠️ Faltan ${min - w} palabras!</span>`; }
    lTotal++;
};
window.aiWrit = async function (title, words) {
    const ok = await spendTokens(TOKEN_CONFIG.ai_cost, 'AI writing'); if (!ok) return;
    const ta = $id('dta'); const fb = $id('wfb');
    if (!ta?.value.trim()) { if (fb) fb.innerHTML = '<span style="color:#f5c842">¡Primero escribe!</span>'; return; }
    fb.innerHTML = '🤖 Comprobando...';
    const r = await callAI(`Writing tekshirish ispancha. Mavzu: "${title}" (so'zlar: ${words}).\nMatn: "${ta.value.trim()}"\nO'zbek tilida: 1) Grammatika 2) Uslub 3) Tuzatilgan variant 4) DELE bali: /9`, 800);
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
            showToast(`🎉 Unidad completada! +50 XP +10 🪙 bonus!`, 'success');
        }
        await updateUserField(updates);
        UXP += xpEarned + (allDone ? 50 : 0);
        UCoin += coinEarned + (allDone ? 10 : 0);
        updateDisplays();
        showToast(`✅ +${xpEarned} XP +${coinEarned} 🪙 guardado!`, 'success');
    } catch (e) { console.error(e); }
}

function showResult(lk, pct, xp, coin, unit, uid) {
    const lnames = { A: "Gramática", B: 'Comprensión Auditiva', C: 'Lectura', D: 'Expresión Oral' };
    const nxt = { A: 'B', B: 'C', C: 'D', D: null };
    const content = $id('modalContent'); if (!content) return;
    const circleColor = pct >= 80 ? '#2ecc71' : pct >= 60 ? '#f0a500' : '#ef4444';
    content.innerHTML = `<div style="text-align:center;padding:20px">
      <div style="width:120px;height:120px;border-radius:50%;background:${circleColor}22;border:3px solid ${circleColor};display:flex;flex-direction:column;align-items:center;justify-content:center;margin:0 auto 20px">
        <div style="font-size:1.8rem;font-weight:800;color:${circleColor}">${pct}%</div>
        <div style="font-size:0.72rem;color:${circleColor}">${lnames[lk]}</div>
      </div>
      <div style="display:flex;gap:16px;justify-content:center;margin:16px 0">
        <div style="padding:12px 20px;border-radius:12px;background:rgba(240,165,0,0.1);border:1px solid rgba(240,165,0,0.2)"><div style="font-size:0.7rem;color:#666">XP</div><div style="font-weight:700;color:#f0a500">+${xp}</div></div>
        <div style="padding:12px 20px;border-radius:12px;background:rgba(212,69,106,0.1);border:1px solid rgba(212,69,106,0.2)"><div style="font-size:0.7rem;color:#666">Moneda</div><div style="font-weight:700;color:#d4456a">+${coin}</div></div>
      </div>
      <div style="font-size:1.2rem;margin-bottom:20px">${pct >= 80 ? '🏆 ¡Perfecto!' : pct >= 60 ? '✅ ¡Muy bien!' : '💪 ¡Inténtalo de nuevo!'}</div>
      <div style="display:flex;flex-direction:column;gap:8px">
        ${nxt[lk] ? `<button onclick="window.openLesson('${uid}','${nxt[lk]}')" style="padding:12px;border-radius:12px;background:linear-gradient(135deg,#d4456a,#f0a500);border:none;color:#fff;font-size:0.9rem;font-weight:700;cursor:pointer;font-family:inherit">→ Siguiente: ${lnames[nxt[lk]]}</button>` : `<div style="padding:14px;border-radius:12px;background:rgba(46,204,113,0.1);border:1px solid rgba(46,204,113,0.25);color:#2ecc71;font-weight:700">🎉 ¡Unidad completada!</div>`}
        <button onclick="document.getElementById('unitModal').classList.remove('active');renderUnits()" style="padding:12px;border-radius:12px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);color:#fff5f0;cursor:pointer;font-size:0.9rem;font-family:inherit">🏠 Volver a unidades</button>
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
          <div style="font-weight:700;font-size:1.05rem;color:#fff5f0">${w.e}</div>
          <button onclick="window.spk('${w.e.replace(/'/g, "\\'")}',event)" style="background:none;border:none;cursor:pointer;font-size:1rem">🔊</button>
        </div>
        <div style="font-size:0.82rem;color:#f0a500;margin-bottom:6px">${w.u}</div>
        <div style="display:flex;gap:6px;font-size:0.68rem">
          <span style="background:rgba(255,255,255,0.05);padding:2px 8px;border-radius:8px;color:#666">${w.t}</span>
          <span style="background:rgba(255,255,255,0.05);padding:2px 8px;border-radius:8px;color:#666">${w.l}</span>
        </div>`;
        card.onmouseover = () => { card.style.background = 'rgba(240,165,0,0.08)'; card.style.borderColor = 'rgba(240,165,0,0.25)'; };
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
      <div style="font-size:2.5rem;font-weight:800;color:#fff5f0;margin-bottom:8px">${w.e}</div>
      <div style="font-size:1.1rem;color:#f0a500;margin-bottom:12px">${w.u}</div>
      <div style="font-size:0.82rem;color:#666;margin:0 0 4px;font-style:italic">${w.t}</div>
      <div style="padding:12px;background:rgba(255,255,255,0.04);border-radius:10px;margin-bottom:16px;font-size:0.85rem;color:#ffd4de;font-style:italic">"${w.ex}"</div>
      <div style="color:#f0a500;font-size:0.82rem;margin-bottom:16px">${w.eu}</div>
      <div style="display:flex;gap:8px;justify-content:center">
        <button onclick="window.spk('${w.e.replace(/'/g, "\\'")}',event)" style="padding:8px 20px;border-radius:10px;background:rgba(212,69,106,0.15);border:1px solid rgba(212,69,106,0.3);color:#d4456a;cursor:pointer;font-family:inherit">🔊 Pronunciar</button>
        <button onclick="window.aiExWord('${w.e.replace(/'/g, "\\'")}',event)" style="padding:8px 20px;border-radius:10px;background:rgba(240,165,0,0.1);border:1px solid rgba(240,165,0,0.25);color:#f0a500;cursor:pointer;font-family:inherit">🤖 AI (1 token)</button>
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
    document.querySelectorAll('.practice-tabs .ptab, .ptabs .ptab').forEach(b => b.classList.remove('active'));
    const p = $id('panel-' + panel); if (p) p.classList.add('active');
    if (el) el.classList.add('active');
};

// ── Flashcard ──
function initFlashcards() { flashDeck = shuffle([...WDB]).slice(0, 20); flashIdx = 0; flashCorrect = 0; flashWrong = 0; showFlash(); }
function showFlash() {
    if (flashIdx >= flashDeck.length) {
        const fw = $id('flashWord'); const fu = $id('flashUz');
        if (fw) fw.textContent = '🎉 ¡Terminado!';
        if (fu) fu.textContent = `Correcto: ${flashCorrect}, Incorrecto: ${flashWrong}`; return;
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
    const type = Math.random() > 0.5 ? 'es2uz' : 'uz2es';
    const qEl = $id('quizQ'); if (qEl) qEl.textContent = type === 'es2uz' ? `"${curQuizWord.e}" = ?` : `"${curQuizWord.u}" = ?`;
    const optsEl = $id('quizOptions');
    if (optsEl) optsEl.innerHTML = opts.map(o => `<button class="quiz-opt" onclick="window.checkQuizOpt(this,'${o.e.replace(/'/g, "\\'")}','${type}')" style="width:100%;margin-bottom:8px;padding:12px;border-radius:10px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);color:#fff5f0;cursor:pointer;text-align:left;font-family:inherit;font-size:0.9rem;transition:all 0.2s">${type === 'es2uz' ? o.u : o.e}</button>`).join('');
    const fb = $id('quizFeedback'); if (fb) fb.innerHTML = '';
}
window.checkQuizOpt = function (btn, chosen, type) {
    if (quizAnswered) return; quizAnswered = true;
    document.querySelectorAll('.quiz-opt').forEach(b => {
        const bVal = b.textContent.trim();
        if (type === 'es2uz' ? bVal === curQuizWord.u : bVal === curQuizWord.e) { b.style.background = 'rgba(46,204,113,0.2)'; b.style.borderColor = '#2ecc71'; }
        else if (b === btn) { b.style.background = 'rgba(239,68,68,0.2)'; b.style.borderColor = '#ef4444'; }
    });
    const fb = $id('quizFeedback');
    if (chosen === curQuizWord.e) { quizScore++; const el = $id('quizScore'); if (el) el.textContent = quizScore; awardXP(10, 'grammar'); if (fb) fb.innerHTML = '<span style="color:#2ecc71">✅ ¡Correcto!</span>'; }
    else { if (fb) fb.innerHTML = `<span style="color:#ef4444">❌ Correcto: ${type === 'es2uz' ? curQuizWord.u : curQuizWord.e}</span>`; }
    window.speakWord(curQuizWord.e);
};
window.nextQuiz = function () { showQuizWord(); };

// ── Match ──
function initMatch() {
    const pool = shuffle([...WDB]).slice(0, 5);
    matchPairs = pool; matchMatched = []; matchSel1 = null;
    const items = shuffle([...pool.map(w => ({ id: w.e, text: w.e, type: 'es' })), ...pool.map(w => ({ id: w.e, text: w.u, type: 'uz' }))]);
    const grid = $id('matchGrid');
    if (grid) grid.innerHTML = items.map(item => `<div class="match-item" data-id="${item.id}" data-type="${item.type}" onclick="window.selectMatch2(this)" style="padding:12px;border-radius:10px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);color:#fff5f0;cursor:pointer;font-family:inherit;transition:all 0.2s;font-size:0.88rem">${item.text}</div>`).join('');
    const fb = $id('matchFeedback'); if (fb) fb.innerHTML = '';
}
window.startMatch = initMatch;
window.selectMatch2 = function (el) {
    if (el.classList.contains('matched')) return;
    if (!matchSel1) {
        matchSel1 = el; el.style.background = 'rgba(212,69,106,0.2)'; el.style.borderColor = '#d4456a';
    } else {
        if (matchSel1 === el) { el.style.background = 'rgba(255,255,255,0.04)'; el.style.borderColor = 'rgba(255,255,255,0.1)'; matchSel1 = null; return; }
        if (matchSel1.dataset.type === el.dataset.type) {
            matchSel1.style.background = 'rgba(255,255,255,0.04)'; matchSel1.style.borderColor = 'rgba(255,255,255,0.1)';
            matchSel1 = el; el.style.background = 'rgba(212,69,106,0.2)'; el.style.borderColor = '#d4456a'; return;
        }
        if (matchSel1.dataset.id === el.dataset.id) {
            matchSel1.style.background = 'rgba(46,204,113,0.15)'; matchSel1.style.borderColor = '#2ecc71'; matchSel1.classList.add('matched');
            el.style.background = 'rgba(46,204,113,0.15)'; el.style.borderColor = '#2ecc71'; el.classList.add('matched');
            matchMatched.push(el.dataset.id); matchSel1 = null; awardXP(15, 'grammar');
            if (matchMatched.length === matchPairs.length) { const fb = $id('matchFeedback'); if (fb) fb.innerHTML = '<span style="color:#2ecc71">🎉 ¡Todos los pares!</span>'; }
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
        if (fb) fb.innerHTML = '<span style="color:#2ecc71">✅ ¡Correcto!</span>';
        if (inp) inp.style.borderColor = '#2ecc71';
        awardXP(8, 'grammar'); setTimeout(() => { typingIdx++; showTypingWord(); }, 800);
    } else if (val.length >= w.e.length) {
        if (fb) fb.innerHTML = `<span style="color:#ef4444">❌ Correcto: ${w.e}</span>`;
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
    if (optsEl) optsEl.innerHTML = q.opts.map(o => `<button onclick="window.checkGrammar('${o.replace(/'/g, "\\'")}','${q.ans.replace(/'/g, "\\'")}','${q.exp.replace(/'/g, "\\'")}')" style="margin:4px;padding:10px 18px;border-radius:10px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);color:#fff5f0;cursor:pointer;font-family:inherit;transition:all 0.2s">${o}</button>`).join('');
    const fb = $id('grammarFeedback'); if (fb) fb.innerHTML = '';
}
window.checkGrammar = function (chosen, ans, exp) {
    if (grammarAnswered) return; grammarAnswered = true;
    const fb = $id('grammarFeedback');
    document.querySelectorAll('#grammarOptions button').forEach(b => {
        if (b.textContent === ans) { b.style.background = 'rgba(46,204,113,0.2)'; b.style.borderColor = '#2ecc71'; }
        else if (b.textContent === chosen && chosen !== ans) { b.style.background = 'rgba(239,68,68,0.2)'; b.style.borderColor = '#ef4444'; }
    });
    if (chosen === ans) {
        if (fb) fb.innerHTML = `<div style="color:#2ecc71;padding:10px;border-radius:10px;background:rgba(46,204,113,0.1)">✅ ¡Correcto! ${exp}</div>`;
        grammarScore2++; const el = $id('grammarScore'); if (el) el.textContent = grammarScore2; awardXP(12, 'grammar');
    } else {
        if (fb) fb.innerHTML = `<div style="color:#ef4444;padding:10px;border-radius:10px;background:rgba(239,68,68,0.1)">❌ Incorrecto. Correcto: <b>${ans}</b>. ${exp}</div>`;
    }
};
window.nextGrammarEx = function () { curGrammarIdx++; showGrammarQ(); };

// ══════════════════════════════════════════════════════════════
// AI CHAT — ESPAÑOL
// ══════════════════════════════════════════════════════════════
const CHAT_MODES = {
    libre: { label: 'Erkin suhbat', sys: 'Eres un asistente amigable de español para hablantes de uzbeko. Habla de forma natural en español y uzbeko, ayudando al usuario a practicar. Mantén respuestas concisas (2-4 frases). Si el usuario escribe en uzbeko, responde en uzbeko y español.' },
    profesor: { label: 'Profe', sys: 'Eres un profesor de español para estudiantes uzbekos. Explica las reglas gramaticales en uzbeko o español simple, da ejemplos y anima al estudiante. Sé paciente y educativo.' },
    gramatica: { label: 'Gramática', sys: "Eres un corrector de gramática española para aprendices uzbekos. Identifica errores, explica en uzbeko simple, muestra la versión corregida y da la regla. Formato: '❌ Error → ✅ Correcto: ... 📚 Regla: ...'" },
    traduccion: { label: 'Tarjimon', sys: 'Eres un traductor profesional español-uzbeko. Traduce con precisión y naturalidad. Explica modismos y expresiones. Muestra ambas versiones claramente.' },
    dele: { label: 'DELE', sys: 'Eres un preparador para el examen DELE para estudiantes uzbekos. Ayuda con lectura, escritura, comprensión auditiva y expresión oral. Da retroalimentación sobre las respuestas y explica los criterios de puntuación. Sé motivador y preciso.' }
};

let curChatMode = CHAT_MODES.libre;

window.setChatMode = function (mode, el) {
    document.querySelectorAll('.chat-mode-btn').forEach(b => b.classList.remove('active'));
    if (el) el.classList.add('active');
    chatMode = mode;
    curChatMode = CHAT_MODES[mode] || CHAT_MODES.libre;
    appendChat('assistant', `Modo: <b>${curChatMode.label}</b>. ${mode === 'libre' ? '¡Hablemos!' :
        mode === 'profesor' ? '¿Qué quieres aprender?' :
            mode === 'gramatica' ? '¡Envíame un texto para revisar la gramática!' :
                mode === 'traduccion' ? '¿Qué quieres traducir?' :
                    '¡Envíame tu pregunta sobre el DELE!'}`, false);
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
    appendChat('assistant', '<span class="typing-anim">Escribiendo...</span>', false, typingId);
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
        const reply = d.candidates?.[0]?.content?.parts?.[0]?.text || 'Lo siento, hubo un error al responder.';
        appendChat('assistant', reply, true);
        chatHist.push({ role: 'model', parts: [{ text: reply }] });
        if (UTokens > 0 && UP !== 'ultimate') { UTokens--; await saveTokenState(); renderTokenBar(); }
        awardXP(5, 'speaking');
    } catch (e) {
        const tb = $id(typingId); if (tb) tb.remove();
        appendChat('assistant', `❗ Error: ${e.message || 'problema de red'}`, false);
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
    if (!confirm('¿Quieres borrar el historial del chat?')) return;
    chatHist = [];
    const c = $id('chatMessages');
    if (c) c.innerHTML = `<div class="chat-msg ai-msg"><div class="chat-avatar"><i class="fa-solid fa-robot"></i></div><div class="chat-bubble">¡Hola! Historial borrado. ¡Empecemos una nueva conversación! 😊</div></div>`;
    showToast('Chat tarixi tozalandi', 'success');
};

// ══════════════════════════════════════════════════════════════
// MISC
// ══════════════════════════════════════════════════════════════
window.findYoutubeVideos = function () {
    const grid = $id('videosGrid'); if (!grid) return;
    const videos = [
        { title: 'Español para Principiantes — Curso Completo', channel: 'SpanishPod101', id: 'H6LJHXS8M_o' },
        { title: 'Aprende Español en 30 Minutos', channel: 'Easy Spanish', id: 'oKJhIXJMsNs' },
        { title: '500 Frases en Español', channel: 'Dreaming Spanish', id: 'CYgXC48pqFc' },
        { title: 'DELE B2 — Preparación', channel: 'DELE Prep', id: 'oaD6hYJvM5s' },
    ];
    grid.innerHTML = videos.map(v => `<div style="border-radius:14px;overflow:hidden;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08)">
        <a href="https://www.youtube.com/watch?v=${v.id}" target="_blank" style="display:block">
          <img src="https://img.youtube.com/vi/${v.id}/mqdefault.jpg" style="width:100%;height:160px;object-fit:cover" alt="${v.title}">
          <div style="padding:12px">
            <div style="font-weight:600;font-size:0.85rem;color:#fff5f0;margin-bottom:4px">${v.title}</div>
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