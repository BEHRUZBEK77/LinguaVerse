import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
    getFirestore, doc, getDoc, setDoc, updateDoc,
    increment, serverTimestamp, arrayUnion, collection,
    addDoc, query, orderBy, limit, getDocs, deleteDoc
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ── FIREBASE ──
const FB = {
    apiKey: "AIzaSyDgVpIEd4Ojm4PEQHOme5yWp87P_xSb6E8",
    authDomain: "linguaverse-ebe09.firebaseapp.com",
    projectId: "linguaverse-ebe09",
    storageBucket: "linguaverse-ebe09.firebasestorage.app",
    messagingSenderId: "130625454868",
    appId: "1:130625454868:web:3f02871f64cb5f8af27801"
};
const app = initializeApp(FB);
const auth = getAuth(app);
const db = getFirestore(app);
const GEMINI = "https://gentle-hat-d9fa.akromovbehruz7.workers.dev";

// ── STATE ──
let CU = null, UP = 'free', UL = {}, UProg = {}, USk = { reading: 0, writing: 0, speaking: 0, listening: 0, grammar: 0 };
let curLevel = 'beginner', chatMode = 'free', chatHist = [], wOff = 0, wFilt = 'all', wSrch = '';
let recog = null, isRec = false, vcRec = false, upTimer = null;
let curUnit = null, curLesson = null, lScore = 0, lTotal = 0, lexSel = {}, rSel = {}, woAns = [];
let lessonMics = {};

// ── PLAN CONFIG ──
const PL = {
    free: { u: 2, ai: 5, rh: 4, xb: 1, cb: 1, voice: false },
    own: { u: 8, ai: 50, rh: 4, xb: 1, cb: 1, voice: false },
    team: { u: 20, ai: 200, rh: 4, xb: 2, cb: 1.5, voice: true },
    universal: { u: Infinity, ai: Infinity, rh: 0, xb: 3, cb: 2, voice: true }
};

// ── SO'ZLAR MA'LUMOTLAR BAZASI (500+ so'z) ──
const WDB = [
    // BEGINNER
    { e: 'привет', u: 'Salom', t: 'undov', l: 'beginner', ex: 'Привет, как дела?', eu: "Salom, qandaysiz?" },
    { e: 'здравствуйте', u: 'Assalomu alaykum (rasmiy)', t: 'ibora', l: 'beginner', ex: 'Здравствуйте, рад вас видеть!', eu: "Assalomu alaykum, sizni ko'rishdan xursandman!" },
    { e: 'пока', u: 'Xayr (norasmiy)', t: 'undov', l: 'beginner', ex: 'Пока, до завтра!', eu: "Xayr, ertaga ko'rishguncha!" },
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
    { e: 'любить', u: "Sevmoq / Yaxshi ko'rmoq", t: "fe'l", l: 'beginner', ex: 'Я люблю музыку.', eu: "Men musiqa sevaman." },
    { e: 'жить', u: 'Yashamoq', t: "fe'l", l: 'beginner', ex: 'Я живу в Ташкенте.', eu: "Men Toshkentda yashayman." },
    { e: 'утро', u: 'Ertalab', t: 'ot', l: 'beginner', ex: 'Доброе утро!', eu: "Xayrli tong!" },
    { e: 'день', u: 'Kun', t: 'ot', l: 'beginner', ex: 'Хорошего дня!', eu: "Yaxshi kun!" },
    { e: 'вечер', u: 'Kechqurun', t: 'ot', l: 'beginner', ex: 'Добрый вечер!', eu: "Xayrli kech!" },
    { e: 'ночь', u: 'Kecha', t: 'ot', l: 'beginner', ex: 'Спокойной ночи!', eu: "Yaxshi kechalar!" },
    // ELEMENTARY
    { e: 'врач', u: 'Shifokor', t: 'ot', l: 'elementary', ex: 'Врач осмотрел пациента.', eu: "Shifokor bemorni tekshirdi." },
    { e: 'учитель', u: "O'qituvchi", t: 'ot', l: 'elementary', ex: 'Мой учитель очень добрый.', eu: "Mening o'qituvchim juda mehribon." },
    { e: 'инженер', u: 'Muhandis', t: 'ot', l: 'elementary', ex: 'Он стал инженером.', eu: "U muhandis bo'ldi." },
    { e: 'работа', u: 'Ish', t: 'ot', l: 'elementary', ex: 'Я ищу работу.', eu: "Men ish qidirmoqdaman." },
    { e: 'магазин', u: "Do'kon", t: 'ot', l: 'elementary', ex: 'Магазин открыт.', eu: "Do'kon ochiq." },
    { e: 'автобус', u: 'Avtobus', t: 'ot', l: 'elementary', ex: 'Автобус опоздал.', eu: "Avtobus kechikdi." },
    { e: 'поезд', u: 'Poezd', t: 'ot', l: 'elementary', ex: 'Поезд в Москву.', eu: "Moskvaga poezd." },
    { e: 'самолёт', u: 'Samolyot', t: 'ot', l: 'elementary', ex: 'Самолёт летит высоко.', eu: "Samolyot baland uchmoqda." },
    { e: 'город', u: 'Shahar', t: 'ot', l: 'elementary', ex: 'Красивый город.', eu: "Chiroyli shahar." },
    { e: 'улица', u: "Ko'cha", t: 'ot', l: 'elementary', ex: 'Широкая улица.', eu: "Keng ko'cha." },
    { e: 'дружба', u: "Do'stlik", t: 'ot', l: 'intermediate', ex: 'Настоящая дружба редка.', eu: "Haqiqiy do'stlik kamyob." },
    { e: 'любовь', u: 'Muhabbat', t: 'ot', l: 'intermediate', ex: 'Любовь делает нас счастливыми.', eu: "Muhabbat bizni baxtli qiladi." },
    { e: 'счастье', u: 'Baxt', t: 'ot', l: 'intermediate', ex: 'Желаю вам счастья.', eu: "Sizga baxt tilayman." },
    { e: 'здоровье', u: "Sog'liq", t: 'ot', l: 'intermediate', ex: 'Береги здоровье.', eu: "Sog'ligingni asra." },
    { e: 'путешествие', u: 'Sayohat', t: 'ot', l: 'intermediate', ex: 'Путешествие по России.', eu: "Rossiya bo'ylab sayohat." },
    { e: 'образование', u: "Ta'lim", t: 'ot', l: 'upper-intermediate', ex: 'Высшее образование важно.', eu: "Oliy ta'lim muhim." },
    { e: 'культура', u: 'Madaniyat', t: 'ot', l: 'upper-intermediate', ex: 'Русская культура богата.', eu: "Rus madaniyati boy." },
    { e: 'ответственность', u: "Mas'uliyat", t: 'ot', l: 'advanced', ex: 'Взять ответственность.', eu: "Mas'uliyatni olish." },
    { e: 'достижение', u: "Yutuq", t: 'ot', l: 'advanced', ex: 'Великое достижение.', eu: "Ulug' yutuq." },
];

// ── UNITS MA'LUMOTLARI — HAR BIR DARAJADA 20 TA UNIT ──
const UNITS_DATA = {
    beginner: [
        { id: 'rb1', icon: '👋', title: 'Привет! Salom!', desc: "Salomlashish, tanishish, xayrlashish", words: ['привет', 'здравствуйте', 'пока', 'спасибо', 'пожалуйста'], grammar_rule: "Ruscha salomlashish: rasmiy (здравствуйте) va norasmiy (привет) farqi", grammar_example: "— Привет! — Привет! Как дела? — Хорошо, спасибо!", reading_text: "Меня зовут Алишер. Я из Ташкента. Я студент. Каждый день я говорю по-русски. Привет — это первое слово, которое я выучил. Спасибо и пожалуйста — очень важные слова.", reading_qs: [{ q: "Kim haqida yozilgan?", opts: ["Alisher", "Marina", "Ivan", "Olga"], c: 0 }], xp: 50, coin: 20 },
        { id: 'rb2', icon: '🔤', title: 'Alifbo', desc: "Rus alifbosi 33 harf", words: ['буква', 'звук', 'слово', 'алфавит', 'читать'], grammar_rule: "Rus alifbosida 33 harf: 10 unli, 21 undosh, ъ va ь belgilari", grammar_example: "А, Б, В, Г, Д, Е, Ё, Ж, З, И...", reading_text: "В русском языке 33 буквы. Это больше, чем в английском алфавите. Каждая буква имеет свой звук. Изучение букв — первый шаг в изучении русского языка.", reading_qs: [{ q: "Rus alifbosida nechta harf bor?", opts: ["26", "30", "33", "36"], c: 2 }], xp: 55, coin: 22 },
        { id: 'rb3', icon: '🔢', title: 'Raqamlar 1-10', desc: "1 dan 10 gacha ruscha", words: ['один', 'два', 'три', 'четыре', 'пять', 'шесть', 'семь', 'восемь', 'девять', 'десять'], grammar_rule: "Ruscha raqamlar: один (1), два (2), три (3)... Raqamlar otlar bilan kelishadi", grammar_example: "Один стол, два стула, три книги", reading_text: "У меня один брат и две сестры. В классе пятнадцать студентов. На столе три книги и четыре ручки. Я живу здесь пять лет.", reading_qs: [{ q: "Nechta aka-uka bor?", opts: ["Bir", "Ikki", "Uch", "To'rt"], c: 0 }], xp: 50, coin: 20 },
        { id: 'rb4', icon: '🔢', title: 'Raqamlar 11-20', desc: "11 dan 20 gacha ruscha", words: ['одиннадцать', 'двенадцать', 'тринадцать', 'четырнадцать', 'пятнадцать', 'шестнадцать', 'семнадцать', 'восемнадцать', 'девятнадцать', 'двадцать'], grammar_rule: "11-20 raqamlar -надцать qo'shimchasi bilan: один+надцать=одиннадцать", grammar_example: "Мне двенадцать лет. В году двенадцать месяцев.", reading_text: "Мне шестнадцать лет. Я учусь в одиннадцатом классе. В нашем классе двадцать студентов. Мой брат старше меня на три года, ему девятнадцать лет.", reading_qs: [{ q: "Necha yoshda bu odam?", opts: ["14", "15", "16", "17"], c: 2 }], xp: 55, coin: 22 },
        { id: 'rb5', icon: '👤', title: 'Men kim?', desc: "Ism, yosh, kimlar, qayer", words: ['меня зовут', 'мне лет', 'я из', 'живу', 'работаю'], grammar_rule: "Tanishish: Меня зовут... (Mening ismim...) Мне ... лет (Men ... yoshdaman)", grammar_example: "Меня зовут Камол. Мне 20 лет. Я из Ташкента.", reading_text: "Привет! Меня зовут Нилуфар. Мне двадцать два года. Я из Самарканда, но сейчас живу в Ташкенте. Я студентка университета. Мне нравится учить русский язык.", reading_qs: [{ q: "Nilufar qayerlik?", opts: ["Toshkent", "Samarqand", "Buxoro", "Namangan"], c: 1 }], xp: 60, coin: 25 },
        { id: 'rb6', icon: '🏠', title: 'Oila', desc: "Oila a'zolari rus tilida", words: ['мама', 'папа', 'брат', 'сестра', 'семья', 'бабушка', 'дедушка', 'муж', 'жена', 'дети'], grammar_rule: "Oila a'zolari: род (jins) bo'yicha turlanadi. Мой папа / Моя мама", grammar_example: "Моя семья большая. У меня есть мама, папа, брат и сестра.", reading_text: "Моя семья не очень большая. У меня есть мама, папа и младшая сестра. Бабушка и дедушка живут в деревне. Мы часто навещаем их. Мои родители очень добрые.", reading_qs: [{ q: "Oila qanchalik katta?", opts: ["Juda katta", "Katta emas", "O'rta", "Kichik"], c: 1 }], xp: 60, coin: 25 },
        { id: 'rb7', icon: '🎨', title: 'Ranglar', desc: "Asosiy ranglar ruscha", words: ['красный', 'синий', 'зелёный', 'белый', 'чёрный', 'жёлтый', 'оранжевый', 'розовый', 'коричневый', 'серый'], grammar_rule: "Ranglar — sifat. Ot bilan jinsi va soni bo'yicha kelishadi: красный дом / красная машина", grammar_example: "У меня красная машина и синий велосипед.", reading_text: "Флаг России белый, синий и красный. Флаг Узбекистана синий, белый и зелёный. Мне нравится зелёный цвет — это цвет природы. Мой любимый цвет — синий.", reading_qs: [{ q: "Muallifning sevimli rangi qaysi?", opts: ["Yashil", "Ko'k", "Qizil", "Oq"], c: 1 }], xp: 55, coin: 22 },
        { id: 'rb8', icon: '🍎', title: 'Oziq-ovqat', desc: "Keng tarqalgan oziq-ovqatlar", words: ['хлеб', 'вода', 'молоко', 'яблоко', 'мясо', 'рыба', 'яйцо', 'суп', 'салат', 'чай'], grammar_rule: "Овощи, фрукты — ko'plik: яблоки, помидоры. Я ем + что (Vinitelny padeж)", grammar_example: "Я ем хлеб и пью чай на завтрак.", reading_text: "На завтрак я обычно ем яйца и хлеб. Пью чай или кофе. На обед — суп и мясо с овощами. На ужин — лёгкая еда: салат или рыба. Я люблю русскую кухню!", reading_qs: [{ q: "Ertalabki nonushta nima?", opts: ["Go'sht va sho'rva", "Tuxum va non", "Baliq va salat", "Choy va qahva"], c: 1 }], xp: 65, coin: 26 },
        { id: 'rb9', icon: '📅', title: 'Kunlar va Oylar', desc: "Hafta kunlari, oylar", words: ['понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота', 'воскресенье', 'январь', 'февраль', 'март'], grammar_rule: "Hafta kunlari: в понедельник (dushanbada), во вторник (seshanbada). Предлог В + Предложный падеж", grammar_example: "В понедельник у меня урок русского языка.", reading_text: "Моя рабочая неделя начинается в понедельник. Во вторник и в четверг у меня занятия. В пятницу мы обычно отдыхаем. Суббота и воскресенье — выходные дни.", reading_qs: [{ q: "Dam olish kunlari qaysi?", opts: ["Dushanba-Juma", "Shanba-Yakshanba", "Chorshanba-Payshanba", "Seshanba-Juma"], c: 1 }], xp: 70, coin: 28 },
        { id: 'rb10', icon: '🌤️', title: 'Ob-havo', desc: "Ob-havo haqida gapirish", words: ['солнечно', 'дождь', 'холодно', 'жарко', 'ветер', 'снег', 'тепло', 'облачно', 'гроза', 'туман'], grammar_rule: "Ob-havo: безличные предложения: Холодно. Тепло. Идёт дождь. Идёт снег.", grammar_example: "Сегодня холодно и идёт снег. Завтра будет тепло.", reading_text: "Сегодня хорошая погода. Солнечно и тепло. Температура около двадцати градусов. Завтра обещают дождь. Мне нравится, когда светит солнце и нет ветра.", reading_qs: [{ q: "Bugungi ob-havo qanday?", opts: ["Yomg'irli va sovuq", "Qorli", "Quyoshli va iliq", "Bulutli"], c: 2 }], xp: 65, coin: 26 },
        { id: 'rb11', icon: '🏃', title: "Harakatlar - Fe'llar", desc: "Asosiy fe'llar ruscha", words: ['идти', 'есть', 'спать', 'читать', 'говорить', 'писать', 'работать', 'учиться', 'играть', 'слушать'], grammar_rule: "Rus fe'llari: I spryazheniye (-ать/-ять) va II spryazheniye (-ить/-еть). Я иду / Он идёт", grammar_example: "Я иду в школу. Он читает книгу. Мы говорим по-русски.", reading_text: "Каждый день я встаю в семь утра. Я завтракаю и иду на работу. На работе я говорю по-русски. Вечером я читаю книги или слушаю музыку. В выходные я играю в футбол.", reading_qs: [{ q: "Qachon futbol o'ynaydi?", opts: ["Har kuni", "Ertalab", "Dam olish kunlari", "Kechqurun"], c: 2 }], xp: 75, coin: 30 },
        { id: 'rb12', icon: '🕐', title: 'Vaqt', desc: "Ruscha vaqt aytish", words: ['час', 'минута', 'утро', 'день', 'вечер', 'ночь', 'сейчас', 'сегодня', 'завтра', 'вчера'], grammar_rule: "Вaqt: Сколько времени? → Сейчас три часа. В котором часу? → В три часа.", grammar_example: "Сейчас пять часов вечера. Урок начинается в девять утра.", reading_text: "Сейчас восемь часов утра. Я только что проснулся. Завтра у меня важная встреча в десять утра. Вчера я лёг спать очень поздно — в час ночи.", reading_qs: [{ q: "Qachon muhim uchrashuv?", opts: ["Kecha", "Bugun", "Ertaga", "Hozir"], c: 2 }], xp: 70, coin: 28 },
        { id: 'rb13', icon: '🏙️', title: 'Shahar', desc: "Joylashuvlar va yo'nalishlar", words: ['школа', 'больница', 'магазин', 'налево', 'направо', 'прямо', 'рынок', 'банк', 'аптека', 'парк'], grammar_rule: "Yo'nalish: налево (chapga), направо (o'ngga), прямо (to'g'ri). Где? = В, На + Предложный", grammar_example: "Идите прямо, потом налево. Банк — направо.", reading_text: "Извините, где находится аптека? — Идите прямо, потом поверните направо. Аптека рядом с банком. Если вы ищете рынок, идите налево от школы.", reading_qs: [{ q: "Apteka qaerda?", opts: ["Chapda", "Bankning yonida", "Maktab yonida", "Bozorning yonida"], c: 1 }], xp: 75, coin: 30 },
        { id: 'rb14', icon: '👕', title: 'Kiyimlar', desc: "Kiyim-kechak ruscha", words: ['рубашка', 'брюки', 'пальто', 'платье', 'шапка', 'куртка', 'обувь', 'носки', 'джинсы', 'свитер'], grammar_rule: "Kiyim so'zlari: надевать (kiydim) / носить (kiyib yurmoq). Что надеть? (nima kiyish kerak?)", grammar_example: "Сегодня холодно — надень куртку и шапку.", reading_text: "Сегодня я надел синие джинсы и белую рубашку. На улице холодно, поэтому я взял тёплое пальто. Мне нравится носить удобную одежду. В выходные я хожу в джинсах и свитере.", reading_qs: [{ q: "Bugun nima kiydi?", opts: ["Ko'ylak va shim", "Ko'k jins va oq ko'ylak", "Palto va shlyapa", "Sviter va shim"], c: 1 }], xp: 65, coin: 26 },
        { id: 'rb15', icon: '🐕', title: 'Hayvonlar', desc: "Uy va yovvoyi hayvonlar", words: ['собака', 'кошка', 'птица', 'рыба', 'слон', 'лев', 'медведь', 'лиса', 'волк', 'заяц'], grammar_rule: "Hayvonlar: одушевлённые существительные. Я вижу кошку (Vin. padeж = Rod. padeж dla oduш.)", grammar_example: "Я вижу собаку. У меня есть кот.", reading_text: "В России символ — медведь. Это большой и сильный зверь. В лесу живут волки, лисы и зайцы. Я люблю домашних животных — у меня есть собака и кошка.", reading_qs: [{ q: "Rossiyaning ramzi qaysi hayvon?", opts: ["Bo'ri", "Ayiq", "Tulki", "Quyon"], c: 1 }], xp: 60, coin: 24 },
        { id: 'rb16', icon: '📝', title: 'Oddiy Jumlalar', desc: "Birinchi jumlalarni tuzish", words: ['это', 'то', 'есть', 'нет', 'не', 'и', 'но', 'или', 'также', 'тоже'], grammar_rule: "Это (bu) va то (u/o'sha) farqi. Есть (bor) va нет (yo'q). Bog'lovchilar: и (va), но (lekin)", grammar_example: "Это книга. Это не ручка. У меня есть собака, но нет кошки.", reading_text: "Это мой стол. На столе есть книга и ручка. Там нет телефона, но есть компьютер. Это моя комната — маленькая, но уютная.", reading_qs: [{ q: "Xona qanday tavsiflanadi?", opts: ["Katta va chiroyli", "Kichik va qulay", "Eski va katta", "Yangi va katta"], c: 1 }], xp: 90, coin: 36 },
        { id: 'rb17', icon: '🔵', title: 'Sifatlar', desc: "Muhim sifatlar va ularning kelishishi", words: ['большой', 'маленький', 'красивый', 'старый', 'новый', 'хороший', 'плохой', 'молодой', 'умный', 'добрый'], grammar_rule: "Sifatlar ot bilan jins, son va kelishik bo'yicha kelishadi: новый (erkak), новая (urg'ochi), новое (o'rta)", grammar_example: "Новый дом, новая машина, новое платье, новые книги", reading_text: "Мой новый учитель очень хороший и добрый. У него большой и красивый кабинет. Он молодой, но очень умный специалист. Я рад, что у меня такой хороший учитель.", reading_qs: [{ q: "O'qituvchi qanday?", opts: ["Eski va qattiq", "Yaxshi va mehribon", "Yosh va yomon", "Aqlli va qo'pol"], c: 1 }], xp: 80, coin: 32 },
        { id: 'rb18', icon: '❓', title: 'Savollar', desc: "Asosiy savol so'zlari", words: ['кто', 'что', 'где', 'когда', 'почему', 'как', 'сколько', 'какой', 'чей', 'куда'], grammar_rule: "Savol so'zlari: Кто? (Kim?), Что? (Nima?), Где? (Qayerda?), Когда? (Qachon?), Почему? (Nima uchun?)", grammar_example: "— Где ты живёшь? — Я живу в Ташкенте. — Сколько тебе лет? — Мне 20 лет.", reading_text: "Когда начинается урок? — В девять часов. Где находится библиотека? — На третьем этаже. Сколько стоит этот учебник? — Пятьсот рублей. Почему вы изучаете русский? — Потому что это интересно!", reading_qs: [{ q: "Dars qachon boshlanadi?", opts: ["Soat sakkizda", "Soat to'qqizda", "Soat o'nda", "Soat o'n birda"], c: 1 }], xp: 85, coin: 34 },
        { id: 'rb19', icon: '🌍', title: 'Mamlakatlar', desc: "Mamlakatlar va millat ruscha", words: ['Россия', 'Узбекистан', 'Казахстан', 'Германия', 'Китай', 'русский', 'узбек', 'казах', 'немец', 'китаец'], grammar_rule: "Mamlakatlar: я из + Родительный падеж (men ... dan). Я из России / из Узбекистана", grammar_example: "— Откуда вы? — Я из Узбекистана. — А вы? — Я из России.", reading_text: "Я из Узбекистана. Моя страна красивая и богатая историей. Я изучаю русский язык, потому что Россия — большая и интересная страна. В России живут русские, татары и многие другие народы.", reading_qs: [{ q: "Muallif qaysi mamlakatdan?", opts: ["Rossiya", "Qozog'iston", "O'zbekiston", "Germaniya"], c: 2 }], xp: 70, coin: 28 },
        { id: 'rb20', icon: '🔄', title: 'Takrorlash', desc: "Beginner darajasi yakuniy takrorlash", words: ['привет', 'спасибо', 'да', 'нет', 'хорошо', 'один', 'мама', 'вода', 'идти', 'читать'], grammar_rule: "Jami takrorlash: salomlashish, raqamlar, oila, ranglar, fe'llar, savol so'zlari", grammar_example: "Привет! Меня зовут Акмал. Мне 18 лет. Я из Ташкента. Я учу русский язык.", reading_text: "Дорогой дневник! Сегодня я закончил первый уровень русского языка. Я очень рад! Я умею здороваться, считать до двадцати, говорить о семье и о погоде. Спасибо за этот урок!", reading_qs: [{ q: "U nima o'rganganini yozmoqda?", opts: ["Ingliz tili", "Rus tili", "Nemis tili", "Arab tili"], c: 1 }], xp: 100, coin: 40 },
    ],

    elementary: [
        { id: 're1', icon: '🏡', title: 'Uy va xonalar', desc: "Uy qismlari, mebel", words: ['спальня', 'кухня', 'ванная', 'гостиная', 'сад', 'стол', 'стул', 'шкаф', 'кровать', 'диван'], grammar_rule: "Mebel va xonalar: В спальне стоит кровать. В кухне есть стол. Предлог В/НА + Predlozhny", grammar_example: "В спальне стоит большая кровать. На кухне есть холодильник.", reading_text: "Наша квартира небольшая, но очень уютная. В ней три комнаты: гостиная, спальня и детская. Кухня светлая и просторная. В гостиной стоит большой диван и телевизор. Мне нравится наша квартира!", reading_qs: [{ q: "Kvartira nechta xonadan iborat?", opts: ["Ikki", "Uch", "To'rt", "Besh"], c: 1 }], xp: 80, coin: 32 },
        { id: 're2', icon: '💼', title: 'Kasblar', desc: "Eng ko'p ishlatiladigan kasblar", words: ['врач', 'учитель', 'инженер', 'повар', 'водитель', 'продавец', 'полицейский', 'программист', 'юрист', 'журналист'], grammar_rule: "Kasb: Кем работает? — Он работает врачом/учителем (Tvoritelniy padeж)", grammar_example: "Мой отец работает инженером. Моя мама — учитель.", reading_text: "В нашем городе много разных специалистов. Мой папа — инженер на заводе. Мама работает врачом в больнице. Мой брат — программист в IT-компании. Я хочу стать журналистом!", reading_qs: [{ q: "Kim programmachilik bilan shug'ullanadi?", opts: ["Ota", "Ona", "Aka", "Muallif"], c: 2 }], xp: 80, coin: 32 },
        { id: 're3', icon: '🛒', title: 'Xarid qilish', desc: "Do'konda suhbat", words: ['цена', 'дёшево', 'дорого', 'купить', 'продать', 'касса', 'чек', 'скидка', 'товар', 'выбор'], grammar_rule: "Do'konda: Сколько стоит? (Narxi qancha?) Я хочу купить... (Men ... sotib olmoqchiman)", grammar_example: "— Сколько стоит этот хлеб? — Пятьдесят рублей. — Хорошо, дайте, пожалуйста!", reading_text: "Сегодня я ходил в супермаркет. Я купил хлеб, молоко и яблоки. Хлеб стоил тридцать рублей, молоко — сорок. Яблоки были дешёвые — двадцать рублей за килограмм. Я заплатил на кассе девяносто рублей.", reading_qs: [{ q: "Jami qancha to'ladi?", opts: ["70 rubl", "80 rubl", "90 rubl", "100 rubl"], c: 2 }], xp: 90, coin: 36 },
        { id: 're4', icon: '🚂', title: 'Transport', desc: "Transport turlari va sayohat", words: ['автобус', 'поезд', 'самолёт', 'машина', 'метро', 'такси', 'велосипед', 'трамвай', 'билет', 'остановка'], grammar_rule: "Transport: Ехать на + Predlozhniy: на автобусе, на поезде, на самолёте. Лететь на самолёте.", grammar_example: "Я еду на работу на метро. Домой я иду пешком.", reading_text: "В Москве отличное метро. Оно быстрое, удобное и дешёвое. Я каждый день езжу на метро. Иногда я езжу на автобусе или трамвае. На длинные расстояния я предпочитаю поезд или самолёт.", reading_qs: [{ q: "U har kuni qaysi transportdan foydalanadi?", opts: ["Avtobus", "Metro", "Tramvay", "Samolyot"], c: 1 }], xp: 90, coin: 36 },
        { id: 're5', icon: '🏥', title: "Sog'liq", desc: "Tana qismlari, kasallik", words: ['голова', 'рука', 'нога', 'болит', 'лекарство', 'врач', 'больница', 'аптека', 'температура', 'кашель'], grammar_rule: "Og'riq: У меня болит голова (Mening boshim og'riyapti). Что болит? (Nima og'riyapti?)", grammar_example: "У меня болит горло и высокая температура. Мне нужно к врачу.", reading_text: "Вчера я плохо себя чувствовал. У меня болела голова и было высокая температура — тридцать восемь. Я вызвал врача на дом. Он осмотрел меня и выписал лекарства. Сегодня мне лучше.", reading_qs: [{ q: "Shifokor nima qildi?", opts: ["Kasalxonaga yotqizdi", "Dori yozib berdi", "Kasalxonaga yubormadi", "Hech nima qilmadi"], c: 1 }], xp: 100, coin: 40 },
        { id: 're6', icon: '📚', title: 'Maktab', desc: "Maktab, fanlar, ta'lim", words: ['математика', 'история', 'наука', 'библиотека', 'экзамен', 'урок', 'домашнее задание', 'оценка', 'класс', 'перемена'], grammar_rule: "Ta'lim: Я изучаю + нар.падеж (matematikani o'rganmoq). Сдать экзамен = imtihon topshirish", grammar_example: "Я изучаю математику и историю. Сегодня у нас экзамен по русскому языку.", reading_text: "Мой любимый предмет — математика. Мне нравится решать задачи. По истории у нас интересный учитель. Он рассказывает истории как детектив! Завтра контрольная работа по математике. Я готовился весь вечер.", reading_qs: [{ q: "Sevimli fani qaysi?", opts: ["Tarix", "Rus tili", "Matematika", "Biologiya"], c: 2 }], xp: 90, coin: 36 },
        { id: 're7', icon: '🎵', title: 'Hobbi', desc: "Bo'sh vaqt mashg'ulotlari", words: ['музыка', 'рисование', 'чтение', 'готовка', 'спорт', 'путешествие', 'фотография', 'танцы', 'кино', 'игры'], grammar_rule: "Hobbi: Я люблю + infinitiv. Моё хобби — + ot. В свободное время я люблю...", grammar_example: "В свободное время я люблю слушать музыку и читать книги.", reading_text: "У меня много хобби. Я люблю слушать музыку — особенно классику. По выходным я хожу в кино или читаю книги. Летом я люблю путешествовать. В прошлом году я был в Санкт-Петербурге — красивый город!", reading_qs: [{ q: "Yozi qayerga borgan?", opts: ["Moskva", "Sankt-Peterburg", "Kazan", "Novosibirsk"], c: 1 }], xp: 90, coin: 36 },
        { id: 're8', icon: '🍽️', title: 'Restoran', desc: "Ovqat buyurtma qilish", words: ['меню', 'заказ', 'официант', 'десерт', 'счёт', 'блюдо', 'вкусно', 'порция', 'напиток', 'чаевые'], grammar_rule: "Restorandа: Я хочу заказать... Принесите, пожалуйста... Счёт, пожалуйста (Hisobni bering)", grammar_example: "— Что вы желаете заказать? — Пожалуйста, борщ и котлету. — Что будете пить?", reading_text: "Вчера мы с друзьями ходили в ресторан. Мы заказали борщ, котлеты и салат. Всё было очень вкусно! Официант был вежливым и быстрым. В конце мы заказали десерт — мороженое. Счёт на всех составил тысячу рублей.", reading_qs: [{ q: "Desert nima edi?", opts: ["Tort", "Pishloq", "Muzqaymoq", "Shirin bulochka"], c: 2 }], xp: 100, coin: 40 },
        { id: 're9', icon: '⏰', title: 'Kundalik tartib', desc: "Har kungi harakatlar", words: ['просыпаться', 'завтрак', 'работа', 'обед', 'спать', 'одеваться', 'умываться', 'ужин', 'отдыхать', 'ложиться'], grammar_rule: "Kudalik: в + vaqt + infinitiv. Я просыпаюсь в семь. Потом я завтракаю. После этого...", grammar_example: "Я встаю в 7, завтракаю в 7:30, иду на работу в 8.", reading_text: "Мой обычный день начинается в шесть утра. Я встаю, умываюсь и одеваюсь. В половине седьмого я завтракаю. На работе я нахожусь с восьми до пяти. После работы я иду в спортзал или готовлю ужин. Ложусь спать в одиннадцать.", reading_qs: [{ q: "U qachon turadi?", opts: ["Soat beshda", "Soat oltida", "Soat yettida", "Soat sakkizda"], c: 1 }], xp: 95, coin: 38 },
        { id: 're10', icon: '🌿', title: 'Tabiat', desc: "Tabiat va atrof-muhit", words: ['гора', 'река', 'лес', 'море', 'природа', 'цветок', 'дерево', 'трава', 'небо', 'земля'], grammar_rule: "Tabiat: В лесу растут деревья. На горе лежит снег. Красивая природа России.", grammar_example: "В России очень красивая природа: леса, реки, горы и озёра.", reading_text: "Россия — огромная страна с разнообразной природой. На севере — тайга и тундра. На юге — горы и море. Самое глубокое озеро в мире — Байкал — находится в Сибири. Русская природа очень красива!", reading_qs: [{ q: "Dunyodagi eng chuqur ko'l qaysi?", opts: ["Kaspiy", "Orol", "Baykal", "Ladoga"], c: 2 }], xp: 95, coin: 38 },
        { id: 're11', icon: '📱', title: 'Texnologiya', desc: "Qurilmalar va raqamli hayot", words: ['телефон', 'компьютер', 'интернет', 'приложение', 'сообщение', 'сайт', 'пароль', 'видео', 'фото', 'зарядка'], grammar_rule: "Texnologiya fe'llari: скачивать (yuklamoq), отправлять (yubormoq), заряжать (quvvatlantirmoq)", grammar_example: "Я скачал приложение и отправил сообщение другу.", reading_text: "Сегодня без интернета невозможно представить жизнь. Я использую телефон для общения, работы и развлечений. Утром проверяю сообщения. Днём работаю на компьютере. Вечером смотрю видео или читаю новости.", reading_qs: [{ q: "Kechqurun nima qiladi?", opts: ["Ish qiladi", "Xabarlarni tekshiradi", "Video ko'radi yoki yangiliklar o'qiydi", "Telefon qiladi"], c: 2 }], xp: 100, coin: 40 },
        { id: 're12', icon: '💌', title: 'Tavsif', desc: "Odamlarni tasvirlash", words: ['высокий', 'добрый', 'умный', 'терпеливый', 'красивый', 'весёлый', 'серьёзный', 'смелый', 'честный', 'вежливый'], grammar_rule: "Odam tasviri: У него/неё + sifat. Он/Она очень + sifat. Внешность ва характер", grammar_example: "Мой друг высокий и спортивный. Она умная и добрая.", reading_text: "Моя лучшая подруга — Зарина. Она высокая и красивая. У неё длинные тёмные волосы и карие глаза. Зарина очень добрая и умная. Она всегда помогает другим. Её все любят, потому что она честная и весёлая.", reading_qs: [{ q: "Zarina qanday inson?", opts: ["Qo'pol va g'amgin", "Yaxshi va aqlli", "Baland bo'yli va yomon", "Sokin va uyatchan"], c: 1 }], xp: 100, coin: 40 },
        { id: 're13', icon: '🌍', title: 'Dunyo', desc: "Dunyo mamlakatlari, millat", words: ['Россия', 'Германия', 'Япония', 'Китай', 'Узбекистан', 'Франция', 'Америка', 'Турция', 'Индия', 'Бразилия'], grammar_rule: "Mamlakatlar: Где? → в России (Rossiyada). Откуда? → из России (Rossiyadan)", grammar_example: "Я живу в Узбекистане. Я родился в России. Я приехал из Германии.", reading_text: "На земле около двухсот стран. Самая большая страна — Россия. Самая населённая — Китай. Германия известна своими машинами, Япония — технологиями. Узбекистан — страна с древней историей и культурой.", reading_qs: [{ q: "Eng katta mamlakat qaysi?", opts: ["Xitoy", "Rossiya", "Amerika", "Braziliya"], c: 1 }], xp: 100, coin: 40 },
        { id: 're14', icon: '🎭', title: "Ko'ngil ochar", desc: "Kino, musiqa, sport", words: ['кино', 'концерт', 'стадион', 'актёр', 'чемпион', 'театр', 'цирк', 'музей', 'выставка', 'спектакль'], grammar_rule: "Ko'ngil ochar: Я хожу в + Vinitelny: в кино, в театр, на концерт, на стадион", grammar_example: "В пятницу мы идём в кино. В субботу — на концерт.", reading_text: "В прошлую субботу я ходил в театр. Там показывали спектакль по роману Достоевского. Это было очень интересно! Зал был полный. После спектакля мы пошли в кафе и обсуждали пьесу. Я очень люблю театр!", reading_qs: [{ q: "Shanba kuni qayerga borgan?", opts: ["Kino", "Teatr", "Stadion", "Sirk"], c: 1 }], xp: 105, coin: 42 },
        { id: 're15', icon: '📖', title: "O'tgan zamon", desc: "Прошедшее время — ruscha", words: ['пошёл', 'поел', 'увидел', 'играл', 'работал', 'читал', 'говорил', 'купил', 'написал', 'позвонил'], grammar_rule: "O'tgan zamon: глагол + -л (erkak), -ла (urg'ochi), -ло (o'rta), -ли (ko'plik). Я читал / Она читала", grammar_example: "Вчера я читал книгу. Она написала письмо. Мы смотрели фильм.", reading_text: "Вчера был интересный день. Утром я позвонил другу. Мы договорились и пошли в парк. Там мы играли в футбол и много разговаривали. Потом мы поели в кафе. Вечером я читал книгу и лёг спать в 11.", reading_qs: [{ q: "U kecha nima qildi?", opts: ["Televizor ko'rdi", "Do'sti bilan parkka bordi", "Uyda qoldi", "Kitob o'qidi"], c: 1 }], xp: 120, coin: 48 },
        { id: 're16', icon: '🗣️', title: 'Suhbat', desc: "Kundalik muloqot iboralari", words: ['конечно', 'наверное', 'возможно', 'кстати', 'например', 'значит', 'вообще', 'честно говоря', 'по-моему', 'на самом деле'], grammar_rule: "Muloqot iboralari: По-моему (menimcha), Честно говоря (rost aytganda), Кстати (aytgancha)", grammar_example: "По-моему, это правильно. Кстати, ты слышал новости? Честно говоря, я не знаю.", reading_text: "— Слушай, ты видел новый фильм? — Конечно! По-моему, это лучший фильм года. — Честно говоря, я ещё не смотрел. — Правда? Обязательно посмотри! — Кстати, там хорошие актёры? — Да, и музыка отличная!", reading_qs: [{ q: "Birinchi odam filmni tomosha qildimi?", opts: ["Ha", "Yo'q", "Bilmaydi", "Hali emas"], c: 0 }], xp: 110, coin: 44 },
        { id: 're17', icon: '📞', title: 'Telefon suhbati', desc: "Telefonda gaplashish ruscha", words: ['алло', 'звонить', 'перезвонить', 'оставить сообщение', 'занято', 'не отвечает', 'номер', 'связь', 'слышно', 'отключился'], grammar_rule: "Telefon: Позвоните мне! (Menga qo'ng'iroq qiling!) Я вам перезвоню. Алло, кто это?", grammar_example: "— Алло! — Здравствуйте, можно Ивана? — Его нет дома. — Передайте, что звонил Алишер.", reading_text: "— Алло, Нилуфар? — Да, это я. Алишер, это ты? — Привет! Как дела? — Хорошо, спасибо! Слушай, я звоню по поводу встречи. Ты свободна в субботу? — Да, конечно! Во сколько? — В три часа дня. Подходит? — Отлично, договорились!", reading_qs: [{ q: "Uchrashuv qachon?", opts: ["Juma, soat 3da", "Shanba, soat 3da", "Yakshanba, soat 3da", "Dushanba, soat 3da"], c: 1 }], xp: 110, coin: 44 },
        { id: 're18', icon: '💰', title: 'Pul va narxlar', desc: "Pul birliklari, narxlar, savdo", words: ['рубль', 'копейка', 'цена', 'стоить', 'платить', 'сдача', 'дорого', 'дёшево', 'скидка', 'бесплатно'], grammar_rule: "Narx: Сколько стоит? — X рублей. С вас + сумма. Сдача — qaytim pul.", grammar_example: "— Сколько стоит хлеб? — Тридцать рублей. — Вот пятьдесят. — Ваша сдача — двадцать.", reading_text: "В России деньги называются рубли и копейки. Один рубль = сто копеек. В супермаркете я купил продукты на пятьсот рублей. Кассир сказала: «С вас пятьсот двадцать рублей». Я дал шестьсот рублей и получил сдачу — восемьдесят рублей.", reading_qs: [{ q: "Qaytim pul qancha?", opts: ["60 rubl", "70 rubl", "80 rubl", "100 rubl"], c: 2 }], xp: 100, coin: 40 },
        { id: 're19', icon: '🏋️', title: 'Sport', desc: "Sport turlari ruscha", words: ['футбол', 'баскетбол', 'теннис', 'плавание', 'бег', 'тренировка', 'спортзал', 'команда', 'победа', 'чемпионат'], grammar_rule: "Sport: играть в + Vinitelny (futbol o'ynamoq). заниматься + Tvoritelniy (suzish bilan shug'ullanmoq)", grammar_example: "Я играю в футбол. Он занимается плаванием. Мы смотрим чемпионат.", reading_text: "Я занимаюсь спортом три раза в неделю. По понедельникам и средам я хожу в спортзал. По пятницам — плаваю в бассейне. В выходные играю в футбол с друзьями. Спорт помогает мне быть здоровым и энергичным!", reading_qs: [{ q: "Haftada necha marta sport qiladi?", opts: ["Ikki marta", "Uch marta", "To'rt marta", "Har kuni"], c: 1 }], xp: 100, coin: 40 },
        { id: 're20', icon: '🔄', title: 'Elementary takrorlash', desc: "Elementary darajasi yakuniy takrorlash", words: ['работать', 'учиться', 'жить', 'хотеть', 'мочь', 'идти', 'ехать', 'говорить', 'понимать', 'знать'], grammar_rule: "Jami: Настоящее время (hozirgi), Прошедшее время (o'tgan), turlanish, sifatlar", grammar_example: "Я работаю программистом. Вчера я ходил в магазин. Он умный и добрый.", reading_text: "Я закончил второй уровень русского языка — Elementary! За это время я научился многому: говорить о профессиях, покупать в магазине, описывать людей и рассказывать о прошлом. Я горжусь своим прогрессом и продолжаю учиться!", reading_qs: [{ q: "U nimaga g'urur his qilmoqda?", opts: ["Yangi ishga", "Rus tilini o'rganishda erishgan natijasiga", "Sayohati uchun", "Sport natijalariga"], c: 1 }], xp: 130, coin: 52 },
    ],

    'pre-intermediate': [
        { id: 'rp1', icon: '🔮', title: 'Kelajak rejalari', desc: "Будущее время — собираюсь, буду", words: ['буду', 'собираюсь', 'планирую', 'намерен', 'хочу стать', 'мечтаю', 'готовлюсь', 'надеюсь', 'стремлюсь', 'планы'], grammar_rule: "Kelajak zamon: Я буду + infinitiv. Я собираюсь + infinitiv. Я хочу + infinitiv (niyat bildirish)", grammar_example: "Я буду работать врачом. Я собираюсь поехать в Москву. Я хочу научиться петь.", reading_text: "В следующем году я планирую поехать в Москву. Я хочу посмотреть Красную площадь и Кремль. Я также собираюсь записаться на курсы русского языка. В будущем я мечтаю работать в международной компании.", reading_qs: [{ q: "U keyingi yil nima qilmoqchi?", opts: ["Sankt-Peterburgga bormoq", "Moskvaga bormoq", "Uyda qolmoq", "Chet elga ketmoq"], c: 1 }], xp: 130, coin: 52 },
        { id: 'rp2', icon: '🎯', title: "Fe'l turlari (Видовые пары)", desc: "Несовершенный / совершенный вид", words: ['делать', 'сделать', 'читать', 'прочитать', 'писать', 'написать', 'говорить', 'сказать', 'покупать', 'купить'], grammar_rule: "Fe'l turlari: НВ (несов.) = jarayon (qilmoqda), СВ (сов.) = tugallangan harakat (qildi, qildi va tugatdi)", grammar_example: "Я читал книгу (jarayon). Я прочитал книгу (tugatdim). Он писал — Он написал.", reading_text: "Вчера я делал домашнее задание три часа. Наконец я сделал всё и пошёл гулять. Я читал интересную книгу всю неделю. В пятницу я прочитал её до конца. Это был детектив — очень захватывающий!", reading_qs: [{ q: "U kitobni qachon tugatdi?", opts: ["Dushanba", "Chorshanba", "Juma", "Shanba"], c: 2 }], xp: 140, coin: 56 },
        { id: 'rp3', icon: '💡', title: 'Shartli gaplar', desc: "Условные предложения ruscha", words: ['если', 'бы', 'то', 'когда', 'хотя', 'несмотря на', 'при условии', 'в случае', 'допустим', 'предположим'], grammar_rule: "Shart gaplari: Если + hozirgi zamon → hozirgi/kelajak (real shart). Если бы + o'tgan → o'tgan/хотел бы (xayoliy)", grammar_example: "Если будет время, я приду. (real). Если бы у меня было время, я бы пришёл. (xayoliy)", reading_text: "Если я выучу русский язык хорошо, я смогу работать в России. Если бы у меня было много денег, я бы объехал весь мир. Если бы я родился в Москве, я бы говорил по-русски как носитель языка.", reading_qs: [{ q: "U rus tilini yaxshi o'rgansa nima qiloladi?", opts: ["Dunyoni aylanadi", "Rossiyada ishlayoladi", "Ko'p pul topadi", "Moskvaga ko'chadi"], c: 1 }], xp: 150, coin: 60 },
        { id: 'rp4', icon: '🗣️', title: 'Fikr bildirish', desc: "Fikrini ifoda etish, munozara", words: ['думаю', 'считаю', 'по-моему', 'на мой взгляд', 'кажется', 'уверен', 'сомневаюсь', 'согласен', 'не согласен', 'возражаю'], grammar_rule: "Fikr ifodalash: По-моему... На мой взгляд... Я думаю, что... Я уверен, что... Я сомневаюсь...", grammar_example: "По-моему, изучение языков очень полезно. Я думаю, что это правильно.", reading_text: "По-моему, изучение русского языка — это инвестиция в будущее. На мой взгляд, знание нескольких языков открывает много возможностей. Я уверен, что с хорошим знанием русского можно найти хорошую работу. Вы согласны?", reading_qs: [{ q: "Muallif rus tilini o'rganishni nima deb hisoblaydi?", opts: ["Vaqt yo'qotish", "Kelajakka sarmoya", "Qiyin mashqlar", "Kerak emas"], c: 1 }], xp: 130, coin: 52 },
        { id: 'rp5', icon: '📰', title: 'Yangiliklar', desc: "Yangiliklar o'qish, media", words: ['заголовок', 'журналист', 'трансляция', 'статья', 'интервью', 'репортаж', 'редакция', 'источник', 'факт', 'мнение'], grammar_rule: "Media leksikasi: Сообщается, что... По данным... По информации... Согласно источникам...", grammar_example: "По данным СМИ, сегодня в городе прошёл фестиваль. Журналист взял интервью у мэра.", reading_text: "Каждое утро я читаю новости в интернете. Мне нравятся статьи о науке и технологиях. Важно уметь отличать факты от мнений. Хороший журналист всегда проверяет источники информации перед публикацией.", reading_qs: [{ q: "U har kuni nima qiladi?", opts: ["Televizor ko'radi", "Gazeta sotib oladi", "Internetda yangiliklar o'qiydi", "Radio eshitadi"], c: 2 }], xp: 135, coin: 54 },
        { id: 'rp6', icon: '🏢', title: 'Biznes', desc: "Professional lug'at, ish muhiti", words: ['встреча', 'срок', 'проект', 'коллега', 'повышение', 'переговоры', 'договор', 'клиент', 'отчёт', 'презентация'], grammar_rule: "Biznes: Провести встречу (uchrashuv o'tkazmoq). Подписать договор (shartnoma imzolash).", grammar_example: "Завтра у нас переговоры с клиентом. Нужно подготовить презентацию и отчёт.", reading_text: "Сегодня у меня напряжённый рабочий день. Утром — встреча с коллегами по новому проекту. После обеда — переговоры с важным клиентом. Вечером нужно сдать отчёт руководителю. Работа требует много сил, но мне это нравится.", reading_qs: [{ q: "Tushdan keyin nima bor?", opts: ["Hisobot topshirish", "Hamkasblar bilan uchrashuv", "Muhim mijoz bilan muzokaralar", "Prezentatsiya"], c: 2 }], xp: 140, coin: 56 },
        { id: 'rp7', icon: '🧠', title: 'Idiomalar', desc: "Ruscha keng ishlatiladigan idiomalar", words: ['белая ворона', 'кот наплакал', 'рукой подать', 'ни свет ни заря', 'в двух словах', 'бить баклуши', 'водить за нос', 'зарубить на носу', 'как рыба в воде', 'поставить точку'], grammar_rule: "Idiomalar — so'zma-so'z tarjima qilib bo'lmaydi. Контекст orqali o'rganish kerak.", grammar_example: "Он — белая ворона в коллективе. Магазин — рукой подать. Встань ни свет ни заря!", reading_text: "Мой друг встаёт ни свет ни заря — в пять утра! До работы ему рукой подать — пять минут пешком. На работе он чувствует себя как рыба в воде. Его коллеги говорят, что он — белая ворона: всегда в хорошем настроении!", reading_qs: [{ q: "'Рукой подать' idiomasi nima ma'noda ishlatilgan?", opts: ["Uzoq masofada", "Yaqin masofada", "Qo'l bilan yetib bo'lmaydi", "Tez yetish mumkin"], c: 1 }], xp: 155, coin: 62 },
        { id: 'rp8', icon: '📜', title: 'Xat yozish', desc: "Rasmiy va norasmiy maktublar", words: ['Уважаемый', 'С уважением', 'Прилагаю', 'Относительно', 'Прошу', 'Сообщаю', 'Благодарю', 'Обращаюсь', 'Прошу рассмотреть', 'В ожидании'], grammar_rule: "Rasmiy xat: Уважаемый/ая + ismi/lavozimi. Murojaat: Прошу... Сообщаю... Xulosa: С уважением...", grammar_example: "Уважаемый Иван Иванович! Прошу рассмотреть мою заявку. С уважением, Алишер.", reading_text: "Уважаемый директор! Прилагаю своё резюме и прошу рассмотреть мою кандидатуру на должность менеджера. У меня есть пять лет опыта в этой сфере. Я уверен, что смогу принести пользу вашей компании. С уважением, Алишер Каримов.", reading_qs: [{ q: "Xat qanday maqsadda yozilgan?", opts: ["Rahmat bildirish uchun", "Ish so'rash uchun", "Taklif qilish uchun", "Uzr so'rash uchun"], c: 1 }], xp: 140, coin: 56 },
        { id: 'rp9', icon: '🧪', title: 'Fan va kashfiyot', desc: "Ilmiy lug'at ruscha", words: ['эксперимент', 'гипотеза', 'исследование', 'открытие', 'доказательство', 'теория', 'лаборатория', 'учёный', 'результат', 'анализ'], grammar_rule: "Ilmiy uslub: Учёные установили, что... Согласно исследованиям... В результате эксперимента...", grammar_example: "Учёные провели эксперимент и получили интересные результаты.", reading_text: "Русские учёные внесли огромный вклад в мировую науку. Менделеев создал периодическую таблицу элементов. Павлов изучал условные рефлексы. Гагарин первым полетел в космос. Российская наука и сегодня занимает ведущие позиции в мире.", reading_qs: [{ q: "Kim davriy jadval yaratdi?", opts: ["Pavlov", "Gagarin", "Mendeleev", "Lomonosov"], c: 2 }], xp: 145, coin: 58 },
        { id: 'rp10', icon: '🗺️', title: 'Sayohat', desc: "Sayohat va turizm ruscha", words: ['маршрут', 'жильё', 'достопримечательность', 'валюта', 'виза', 'паспорт', 'посольство', 'регистрация', 'бронирование', 'трансфер'], grammar_rule: "Sayohat: Забронировать гостиницу (mehmonxona band qilmoq). Оформить визу (viza olmoq).", grammar_example: "Мы забронировали гостиницу и оформили визу. Маршрут уже готов.", reading_text: "Мы планируем поехать в Санкт-Петербург. Я уже забронировал гостиницу и купил билеты на поезд. Маршрут составлен: Эрмитаж, Петергоф, Русский музей, Невский проспект. Главное — не забыть паспорт!", reading_qs: [{ q: "Qaysi shaharga sayohat rejasi bor?", opts: ["Moskva", "Kazan", "Sankt-Peterburg", "Novosibirsk"], c: 2 }], xp: 135, coin: 54 },
        { id: 'rp11', icon: '🎓', title: 'Akademik rus tili', desc: "Universitet, o'qish ko'nikmalari", words: ['диссертация', 'лекция', 'задание', 'семестр', 'степень', 'зачёт', 'кафедра', 'научный руководитель', 'публикация', 'конференция'], grammar_rule: "Akademik leksika: Защитить диссертацию (dissertatsiya himoya qilmoq). Сдать зачёт (test topshirmoq).", grammar_example: "В этом семестре у меня пять предметов. Нужно сдать три зачёта и два экзамена.", reading_text: "Я учусь на третьем курсе университета. В этом семестре у меня интересные дисциплины: история, экономика и иностранные языки. Мой научный руководитель помогает мне с курсовой работой. В мае я должен защитить проект.", reading_qs: [{ q: "Necha-chi kursda o'qiydi?", opts: ["Birinchi", "Ikkinchi", "Uchinchi", "To'rtinchi"], c: 2 }], xp: 155, coin: 62 },
        { id: 'rp12', icon: '🔗', title: 'Nisbiy gap', desc: "Который, которая, которое", words: ['который', 'которая', 'которое', 'которые', 'чей', 'чья', 'чьё', 'где', 'когда', 'куда'], grammar_rule: "Nisbiy olmosh который (qaysi, kim) — ot bilan jinsi va soni bo'yicha kelishadi: дом, который; женщина, которая", grammar_example: "Книга, которую я читаю, очень интересная. Друг, которому я позвонил, помог мне.", reading_text: "Это книга, которую написал Достоевский. Она рассказывает о людях, которые живут в бедности. Главный герой — студент, у которого нет денег, но есть большие мечты. Это роман, который я советую всем прочитать.", reading_qs: [{ q: "Bu kitobni kim yozgan?", opts: ["Tolstoy", "Pushkin", "Dostoevskiy", "Turgenev"], c: 2 }], xp: 155, coin: 62 },
        { id: 'rp13', icon: '📊', title: "Ma'lumot tavsifi", desc: "Grafik, statistika, raqamlar", words: ['увеличение', 'уменьшение', 'процент', 'тенденция', 'статистика', 'рост', 'снижение', 'показатель', 'данные', 'в среднем'], grammar_rule: "Statistika: Согласно данным... Доля составляет X%. Наблюдается рост/снижение. В среднем...", grammar_example: "Согласно статистике, 70% россиян пользуются интернетом. Наблюдается рост онлайн-покупок.", reading_text: "По данным статистики, около семидесяти процентов россиян ежедневно пользуются интернетом. Наблюдается постоянный рост онлайн-торговли. В среднем россиянин проводит в сети около четырёх часов в день. Эта тенденция продолжает усиливаться.", reading_qs: [{ q: "Rossiyaliklar internetda kuniga o'rtacha qancha vaqt o'tkazishadi?", opts: ["2 soat", "3 soat", "4 soat", "5 soat"], c: 2 }], xp: 145, coin: 58 },
        { id: 'rp14', icon: '🌐', title: 'Global muammolar', desc: "Jahon muammolari ruscha", words: ['изменение климата', 'загрязнение', 'бедность', 'неравенство', 'устойчивость', 'экология', 'переработка', 'возобновляемый', 'углерод', 'глобальный'], grammar_rule: "Global muammolar: Изменение климата угрожает... Необходимо решить проблему... Важно сохранить...", grammar_example: "Изменение климата — серьёзная глобальная проблема. Нам нужно беречь природу.", reading_text: "Изменение климата — одна из главных проблем современности. Глобальное потепление приводит к таянию ледников и повышению уровня моря. Каждый может помочь: экономить электричество, меньше использовать пластик, сажать деревья.", reading_qs: [{ q: "Global isish qanday oqibatlarga olib keladi?", opts: ["Ko'proq yomg'ir", "Muzliklarning erishi", "Havoning tozalanishi", "Daryolarning to'lishi"], c: 1 }], xp: 165, coin: 66 },
        { id: 'rp15', icon: '🤝', title: 'Muzokaralar', desc: "Biznes muzokaralari ruscha", words: ['предложить', 'компромисс', 'сделка', 'условия', 'соглашение', 'стороны', 'возражение', 'принять', 'отклонить', 'переговорщик'], grammar_rule: "Muzokaralar: Я предлагаю... (men taklif qilaman). Мы согласны при условии... (agar shartda rozi). Давайте найдём компромисс.", grammar_example: "Я предлагаю следующие условия: ... Мы готовы заключить сделку, если вы согласитесь на...", reading_text: "Переговоры длились три часа. Наша компания предложила снижение цены на десять процентов. Партнёры возразили — им нужно было пятнадцать процентов. В итоге мы нашли компромисс — двенадцать процентов скидки и продление контракта.", reading_qs: [{ q: "Natijada qancha chegirma kelishildi?", opts: ["10%", "12%", "15%", "20%"], c: 1 }], xp: 160, coin: 64 },
        { id: 'rp16', icon: '🎭', title: 'Rus adabiyoti', desc: "Rus klassik adabiyoti", words: ['роман', 'повесть', 'стихотворение', 'автор', 'герой', 'сюжет', 'глава', 'образ', 'тема', 'идея'], grammar_rule: "Adabiyot: В романе рассказывается о... Главный герой... Автор хочет сказать, что... Тема произведения...", grammar_example: "В романе «Война и мир» Толстой рассказывает о жизни русского общества.", reading_text: "Русская литература — одна из богатейших в мире. Пушкин, Толстой, Достоевский, Чехов — эти имена знают во всём мире. Роман «Преступление и наказание» Достоевского переведён на сотни языков. Читать русскую классику — значит познавать русскую душу.", reading_qs: [{ q: "'Jinoyat va jazo' kitobi kiming asari?", opts: ["Tolstoy", "Pushkin", "Dostoevskiy", "Chekhov"], c: 2 }], xp: 150, coin: 60 },
        { id: 'rp17', icon: '🏛️', title: 'Tarix va madaniyat', desc: "Rossiya tarixi va madaniyati", words: ['история', 'традиция', 'праздник', 'обычай', 'архитектура', 'наследие', 'музей', 'памятник', 'эпоха', 'цивилизация'], grammar_rule: "Tarix: В X веке... Во времена + Родительный. В эпоху Петра I Россия стала великой державой.", grammar_example: "В XVIII веке Пётр I провёл реформы. В XIX веке Россия победила Наполеона.", reading_text: "Россия имеет богатую историю. В X веке принялось христианство. В XVII веке династия Романовых правила страной. В XIX веке Россия стала великой европейской державой. В XX веке произошла революция. История России — это история великих побед и испытаний.", reading_qs: [{ q: "Rossiyada Xristianlik qachon qabul qilingan?", opts: ["VIII asrda", "IX asrda", "X asrda", "XI asrda"], c: 2 }], xp: 155, coin: 62 },
        { id: 'rp18', icon: '🍳', title: 'Rus oshxonasi', desc: "Ruscha taomlar va retseptlar", words: ['борщ', 'пельмени', 'блины', 'окрошка', 'щи', 'солянка', 'гречка', 'квас', 'сметана', 'квашеная капуста'], grammar_rule: "Retsept: Для приготовления нужно... Сначала нарежьте... Затем добавьте... Варите X минут...", grammar_example: "Для приготовления борща нужно: свёкла, картофель, капуста, мясо и томат.", reading_text: "Борщ — самый известный русский и украинский суп. Для его приготовления нужны свёкла, картофель, капуста и мясо. Сначала варится мясо. Затем добавляются овощи. Подаётся со сметаной. Попробуйте — это очень вкусно!", reading_qs: [{ q: "Borscht nima bilan beriladi?", opts: ["Yog' bilan", "Smetana bilan", "Yog'sizdan", "Non bilan"], c: 1 }], xp: 140, coin: 56 },
        { id: 'rp19', icon: '🔬', title: "Ilm-fan terminologiyasi", desc: "Ilmiy atamalar ruscha", words: ['молекула', 'атом', 'электрон', 'реакция', 'вещество', 'энергия', 'сила', 'масса', 'скорость', 'температура'], grammar_rule: "Ilmiy tavsif: Молекула состоит из атомов. Скорость измеряется в... Температура повышается при...", grammar_example: "Вода состоит из двух атомов водорода и одного кислорода. H₂O.", reading_text: "Физика и химия — основы естественных наук. Атом — мельчайшая частица вещества. Молекулы состоят из атомов. Энергия может преобразовываться из одного вида в другой. Эти знания помогают понять устройство нашего мира.", reading_qs: [{ q: "Atom nima?", opts: ["Molekuladan kichik bo'lmagan", "Moddaning eng kichik zarrachasi", "Energiya turi", "Kimyoviy reaksiya"], c: 1 }], xp: 145, coin: 58 },
        { id: 'rp20', icon: '🔄', title: 'Pre-Int takrorlash', desc: "Pre-Intermediate darajasi yakuniy", words: ['если', 'который', 'чтобы', 'хотя', 'несмотря', 'поскольку', 'следовательно', 'однако', 'тем не менее', 'в результате'], grammar_rule: "Jami takrorlash: Shart gaplar, nisbiy gaplar, bog'lovchilar, ilmiy uslub, biznes leksika", grammar_example: "Если бы я знал это раньше, я бы принял другое решение. Книга, которую я прочитал, изменила мою жизнь.", reading_text: "Я завершил уровень Pre-Intermediate! Теперь я умею строить сложные предложения, обсуждать деловые темы, понимать статьи и читать литературу. Мой русский язык значительно улучшился! Продолжаю учиться!", reading_qs: [{ q: "U endi nimani uddalay oladi?", opts: ["Faqat oddiy gaplar", "Murakkab gaplar va biznes mavzulari", "Faqat salomlashish", "Faqat savol berish"], c: 1 }], xp: 180, coin: 72 },
    ],

    advanced: [
        { id: 'ra1', icon: '🖊️', title: 'Akademik yozish', desc: "Esse, hisobot, dissertatsiya", words: ['более того', 'однако', 'следовательно', 'в заключение', 'таким образом', 'с одной стороны', 'с другой стороны', 'что касается', 'в частности', 'наряду с этим'], grammar_rule: "Akademik uslub: Passive voice, nominalizatsiya, murakkab sintaktik tuzilmalar", grammar_example: "Следовательно, можно сделать вывод о том, что... Более того, данные исследования подтверждают...", reading_text: "Академическое письмо требует чёткой структуры и логики. Введение формулирует проблему. В основной части приводятся аргументы и доказательства. В заключении делаются выводы. Важно использовать академическую лексику и избегать разговорных выражений.", reading_qs: [{ q: "Akademik yozuvning qanday strukturasi bor?", opts: ["Kirish, mazmun, xulosa", "Faqat mazmun", "Savol-javob", "Erkin shakl"], c: 0 }], xp: 200, coin: 80 },
        { id: 'ra2', icon: '🎤', title: "Nutq san'ati", desc: "Prezentatsiyalar va nutqlar", words: ['убеждать', 'уточнять', 'подчёркивать', 'разъяснять', 'заключать', 'риторика', 'аргументация', 'аудитория', 'тезис', 'вывод'], grammar_rule: "Nutq: Хотелось бы отметить... Позвольте обратить ваше внимание... Подводя итог, хочу сказать...", grammar_example: "Позвольте обратить ваше внимание на следующий факт: согласно нашим данным...", reading_text: "Умение убеждать — важнейший навык в современном мире. Хорошая речь должна иметь чёткую структуру, яркие примеры и логичные аргументы. Важно знать свою аудиторию и говорить на понятном ей языке. Практика и уверенность — ключ к успеху.", reading_qs: [{ q: "Yaxshi nutqning asosiy xususiyati?", opts: ["Uzoq davom etish", "Aniq tuzilma, yorqin misollar va mantiq", "Ko'p so'z ishlatish", "Faqat faktlar"], c: 1 }], xp: 200, coin: 80 },
        { id: 'ra3', icon: '📚', title: 'Adabiyot tahlili', desc: "Rus klassik adabiyoti va idiomalar", words: ['метафора', 'ирония', 'сатира', 'аналогия', 'символ', 'аллегория', 'гипербола', 'эпитет', 'сравнение', 'антитеза'], grammar_rule: "Adabiy tahlil: Автор использует метафору... Образ ... символизирует... Ирония проявляется в том...", grammar_example: "В этом стихотворении Пушкин использует метафору весны как символа возрождения.", reading_text: "«Евгений Онегин» Пушкина — роман в стихах, шедевр русской литературы. Онегин — типичный лишний человек: образованный, умный, но пустой внутри. Татьяна, напротив, — образ искренности и глубины. Через их судьбы автор исследует русский характер.", reading_qs: [{ q: "Onegin qanday tavsiflanadi?", opts: ["Oddiy va sodda", "Ta'limlangan, aqlli, lekin ichki bo'shliq", "Mehribon va samimiy", "Kuchli va dadil"], c: 1 }], xp: 200, coin: 80 },
        { id: 'ra4', icon: '⚖️', title: 'Huquq va etika', desc: "Yuridik va etik lug'at", words: ['законодательство', 'конституционный', 'прецедент', 'ответственность', 'поправка', 'юрисдикция', 'истец', 'ответчик', 'приговор', 'апелляция'], grammar_rule: "Yuridik uslub: В соответствии с законом... Согласно статье X... Лицо несёт ответственность за...", grammar_example: "Согласно статье 35 Конституции, каждый гражданин имеет право на частную собственность.", reading_text: "Конституция — основной закон государства. В ней закреплены права и свободы граждан. Согласно принципу презумпции невиновности, человек считается невиновным, пока его вина не доказана в суде. Соблюдение закона — обязанность каждого гражданина.", reading_qs: [{ q: "Begunohlik prezumpsiyasi nima degani?", opts: ["Har kim aybdor", "Inson aybli deb topilmaguncha begunoh hisoblanadi", "Sud har doim to'g'ri", "Advokat kerak emas"], c: 1 }], xp: 210, coin: 84 },
        { id: 'ra5', icon: '💹', title: 'Moliya va iqtisod', desc: "Iqtisodiy terminologiya", words: ['макроэкономика', 'портфель', 'деривативы', 'инфляция', 'капитал', 'ликвидность', 'дефицит', 'профицит', 'монетарный', 'фискальный'], grammar_rule: "Iqtisodiy uslub: Инфляция составляет X%. ВВП вырос на X%. Центральный банк снизил ставку до...", grammar_example: "Годовая инфляция составила 4,5%. ВВП страны вырос на 3,2% по сравнению с прошлым годом.", reading_text: "Экономика России — одна из крупнейших в мире. Основу составляют нефть и газ, но страна активно развивает другие отрасли: IT, сельское хозяйство, машиностроение. Центральный банк контролирует инфляцию с помощью монетарной политики.", reading_qs: [{ q: "Rossiya iqtisodining asosini nima tashkil etadi?", opts: ["Avtomobilsozlik", "Neft va gaz", "Elektronika", "To'qimachilik"], c: 1 }], xp: 220, coin: 88 },
        { id: 'ra6', icon: '🏛️', title: 'Siyosat va jamiyat', desc: "Siyosiy diskurs", words: ['суверенитет', 'парламент', 'референдум', 'идеология', 'управление', 'демократия', 'гражданское общество', 'правительство', 'оппозиция', 'легитимность'], grammar_rule: "Siyosiy uslub: Парламент принял закон о... Референдум показал, что... Правительство объявило...", grammar_example: "Парламент проголосовал за принятие нового закона об образовании. Оппозиция возразила.", reading_text: "Демократия — форма правления, при которой власть принадлежит народу. Парламент принимает законы. Правительство исполняет их. Судебная система обеспечивает справедливость. Гражданское общество контролирует власть. Это основы правового государства.", reading_qs: [{ q: "Demokratiyada kim hokimiyatga ega?", opts: ["Parlament", "Hukumat", "Xalq", "Sud"], c: 2 }], xp: 220, coin: 88 },
        { id: 'ra7', icon: '🔬', title: 'Tadqiqot metodologiyasi', desc: "Tanqidiy fikrlash, tadqiqot", words: ['корреляция', 'методология', 'качественный', 'количественный', 'парадигма', 'выборка', 'валидность', 'гипотеза', 'переменная', 'вывод'], grammar_rule: "Tadqiqot: Методология исследования включает... Выборка составила X человек. Результаты показывают...", grammar_example: "Исследование проводилось методом анкетирования среди 500 респондентов.", reading_text: "Научное исследование включает несколько этапов: формулировка проблемы, выдвижение гипотезы, сбор данных, анализ и выводы. Важно различать корреляцию и причинно-следственную связь. Качественные и количественные методы дополняют друг друга.", reading_qs: [{ q: "Tadqiqotning birinchi bosqichi qanday?", opts: ["Ma'lumot yig'ish", "Muammoni shakllantirish", "Tahlil", "Xulosa"], c: 1 }], xp: 220, coin: 88 },
        { id: 'ra8', icon: '🧩', title: 'Murakkab grammatika', desc: "Ilg'or grammatik qurilmalar", words: ['сослагательное', 'инверсия', 'причастный оборот', 'деепричастие', 'страдательный залог', 'номинализация', 'синтаксис', 'пунктуация', 'стилистика', 'фонетика'], grammar_rule: "Shart mayli (сослагательное): Если бы... Инверсия: Не только... но и... Пассив: был принят, будет сделано", grammar_example: "Не только профессора, но и студенты участвовали в конференции. Закон был принят единогласно.", reading_text: "Русский язык богат сложными грамматическими конструкциями. Причастные и деепричастные обороты делают речь более точной и выразительной. Страдательный залог используется в официальных и научных текстах. Владение этими структурами — признак высокого уровня языка.", reading_qs: [{ q: "Passiv nishon qayerda ko'proq ishlatiladi?", opts: ["So'zlashuv tilida", "Rasmiy va ilmiy matnlarda", "Badiiy adabiyotda", "Xatlarda"], c: 1 }], xp: 240, coin: 96 },
        { id: 'ra9', icon: '🌏', title: 'Madaniyatlararo', desc: "Madaniyatlararo muloqot", words: ['культурная чувствительность', 'стереотип', 'предвзятость', 'инклюзия', 'разнообразие', 'адаптация', 'интеграция', 'идентичность', 'толерантность', 'мультикультурализм'], grammar_rule: "Madaniyatlararo muloqot: Принято считать... В данной культуре... Важно учитывать культурный контекст...", grammar_example: "В России принято встречать гостей хлебом и солью. Это символ гостеприимства.", reading_text: "Россия — многонациональная страна. Здесь живут более двухсот народов: русские, татары, башкиры, чеченцы и многие другие. Каждый народ имеет свою культуру, язык и традиции. Взаимное уважение и толерантность — основа многонационального общества.", reading_qs: [{ q: "Rossiyada necha xalq yashaydi?", opts: ["100 dan ortiq", "150 dan ortiq", "200 dan ortiq", "Faqat bittasi"], c: 2 }], xp: 220, coin: 88 },
        { id: 'ra10', icon: '🎯', title: 'TORFL tayyorgarlik', desc: "TORFL/ТРКИ imtihon strategiyalari", words: ['перефразировать', 'обобщить', 'оценить', 'проанализировать', 'сравнить', 'интерпретировать', 'критически', 'аргументировать', 'синтезировать', 'обосновать'], grammar_rule: "TORFL strategiya: O'qish — umumiy fikrni tushunish. Yozish — aniq tuzilma. Gapirish — ravon va ravon", grammar_example: "В тексте говорится о... Автор утверждает, что... По моему мнению... Таким образом...", reading_text: "TORFL — это международный экзамен по русскому языку. Он проверяет четыре навыка: чтение, письмо, говорение и аудирование. Хорошая подготовка требует регулярной практики. Читайте русские тексты, смотрите фильмы, говорите с носителями языка!", reading_qs: [{ q: "TORFL qanday ko'nikmalarni tekshiradi?", opts: ["Faqat yozuv", "O'qish va yozuv", "To'rtta ko'nikma", "Faqat grammatika"], c: 2 }], xp: 300, coin: 120 },
        { id: 'ra11', icon: '📡', title: 'Media va texnologiya', desc: "Raqamli dunyo lug'ati", words: ['алгоритм', 'кибербезопасность', 'блокчейн', 'искусственный интеллект', 'автоматизация', 'машинное обучение', 'нейросеть', 'цифровизация', 'платформа', 'экосистема'], grammar_rule: "Texnologiya: ИИ позволяет... Алгоритм обрабатывает данные... Автоматизация приводит к... Цифровизация меняет...", grammar_example: "Искусственный интеллект уже применяется в медицине, транспорте и образовании.", reading_text: "Искусственный интеллект меняет все отрасли. В медицине ИИ помогает диагностировать болезни. В транспорте — управлять беспилотными автомобилями. В образовании — персонализировать обучение. Россия активно развивает технологии в этих областях.", reading_qs: [{ q: "AI tibbiyotda qanday yordam beradi?", opts: ["Dori tayyorlash", "Kasalliklarni tashxislash", "Jarrohlik qilish", "Dori yetkazib berish"], c: 1 }], xp: 240, coin: 96 },
        { id: 'ra12', icon: '🧬', title: 'Fan va tibbiyot', desc: "Ilmiy diskurs", words: ['геном', 'нейропластичность', 'эпидемиология', 'патоген', 'фармакология', 'иммунитет', 'метаболизм', 'генетика', 'вирус', 'вакцина'], grammar_rule: "Tibbiy uslub: Препарат применяется при... Симптомы включают... Лечение заключается в... Клинические испытания показали...", grammar_example: "Клинические испытания показали эффективность вакцины в 95% случаев.", reading_text: "Современная медицина достигла огромных успехов. Благодаря вакцинам удалось победить оспу и полиомиелит. Генетика позволяет предсказывать наследственные болезни. Нейронаука изучает мозг и сознание. Российские учёные активно участвуют в этих исследованиях.", reading_qs: [{ q: "Genetika nima imkonini beradi?", opts: ["Dori tayyorlash", "Irsiy kasalliklarni bashorat qilish", "Yuqumli kasalliklarni davolash", "Miya faoliyatini o'rganish"], c: 1 }], xp: 240, coin: 96 },
        { id: 'ra13', icon: '🎨', title: "San'at va tanqid", desc: "Estetik va tanqidiy lug'at", words: ['эстетика', 'авангард', 'постмодернизм', 'сюрреализм', 'кубизм', 'концептуализм', 'инсталляция', 'перформанс', 'галерея', 'куратор'], grammar_rule: "San'at tahlili: Художник передаёт... Произведение отражает... Стиль характеризуется... В картине прослеживается...", grammar_example: "В этой картине художник использует контраст света и тени для создания атмосферы тайны.", reading_text: "Русское искусство богато и разнообразно. Передвижники XIX века изображали реальную жизнь народа. Авангардисты начала XX века — Малевич, Кандинский — произвели революцию в мировом искусстве. Их работы хранятся в лучших музеях мира.", reading_qs: [{ q: "Peredvizhniklar nima haqida ish yaratishgan?", opts: ["Xayoliy dunyolar", "Xalq hayotining haqiqiy tasvirini", "Sof geometrik shakllar", "Diniy mavzular"], c: 1 }], xp: 220, coin: 88 },
        { id: 'ra14', icon: '🔭', title: 'Falsafa va mantiq', desc: "Falsafiy fikrlash", words: ['эпистемология', 'онтология', 'эмпиризм', 'силлогизм', 'заблуждение', 'диалектика', 'феноменология', 'экзистенциализм', 'прагматизм', 'рационализм'], grammar_rule: "Falsafiy uslub: С точки зрения... Следует отметить, что... Вопрос о... остаётся дискуссионным...", grammar_example: "С точки зрения экзистенциализма, человек сам создаёт смысл своей жизни.", reading_text: "Философия — «любовь к мудрости». Основные вопросы: что такое бытие, что такое знание, как жить правильно. Русская философия имеет свои особенности. Соловьёв, Бердяев, Флоренский искали русский путь в мировой мысли.", reading_qs: [{ q: "Falsafaning asosiy savoli nima?", opts: ["Faqat tarix", "Borliq, bilim va to'g'ri yashash", "Faqat matematika", "Faqat din"], c: 1 }], xp: 260, coin: 104 },
        { id: 'ra15', icon: '🏆', title: 'C2 — Mukammal rus tili', desc: "Ona tili darajasi ruscha", words: ['нюанс', 'красноречие', 'прагматика', 'коннотация', 'дискурс', 'интертекстуальность', 'полисемия', 'синонимия', 'паронимия', 'омонимия'], grammar_rule: "C2 darajasi: Barcha grammatik va leksik tuzilmalar mukammal. Nutq ravon, boy va aniq.", grammar_example: "Владение языком на уровне C2 означает способность свободно и точно выражать любую мысль.", reading_text: "Поздравляю! Вы достигли уровня C2 — наивысшего в изучении русского языка. На этом уровне вы понимаете практически всё, что читаете и слышите. Вы можете свободно, спонтанно и точно выражать свои мысли. Русский язык стал вашим вторым родным языком!", reading_qs: [{ q: "C2 darajasi nima degani?", opts: ["Boshlang'ich", "O'rta", "Yuqori", "Ona tilidagidek"], c: 3 }], xp: 400, coin: 160 },
        { id: 'ra16', icon: '✍️', title: 'Publitsistika', desc: "Gazetaxonlik uslubi va maqolalar", words: ['редакционная статья', 'колонка', 'репортаж', 'рецензия', 'фельетон', 'очерк', 'интервью', 'комментарий', 'обзор', 'аналитика'], grammar_rule: "Publitsistik uslub: Как сообщают источники... По имеющимся данным... Согласно официальной статистике...", grammar_example: "По имеющимся данным, число пользователей интернета в России превысило сто миллионов.", reading_text: "Публицистический стиль используется в газетах, журналах и интернет-изданиях. Он сочетает точность факта с выразительностью слова. Хорошая статья информирует, убеждает и вдохновляет читателя. Публицистика формирует общественное мнение.", reading_qs: [{ q: "Publitsistik uslub qayerda ishlatiladi?", opts: ["Ilmiy asarlarda", "Gazeta va jurnallarda", "Yuridik hujjatlarda", "Badiiy asarlarda"], c: 1 }], xp: 220, coin: 88 },
        { id: 'ra17', icon: '🌐', title: 'Diplomatiya tili', desc: "Xalqaro muloqot ruscha", words: ['дипломатия', 'переговоры', 'протокол', 'ратификация', 'декларация', 'коммюнике', 'саммит', 'делегация', 'соглашение', 'меморандум'], grammar_rule: "Diplomatik uslub: Стороны договорились о... В ходе переговоров было достигнуто соглашение... Меморандум подписан...", grammar_example: "В ходе переговоров стороны достигли принципиального соглашения по ключевым вопросам.", reading_text: "Дипломатический язык отличается точностью и взвешенностью формулировок. Каждое слово важно. Коммюнике и меморандумы отражают официальную позицию государств. Русский язык — один из шести официальных языков ООН.", reading_qs: [{ q: "Rus tili qanday xalqaro tashkilotning rasmiy tili?", opts: ["NATO", "Yevropa Ittifoqi", "BMT", "OECD"], c: 2 }], xp: 240, coin: 96 },
        { id: 'ra18', icon: '🧘', title: "Psixologiya tili", desc: "Psixologik terminologiya ruscha", words: ['психология', 'мотивация', 'когнитивный', 'поведение', 'личность', 'стресс', 'тревога', 'депрессия', 'самооценка', 'адаптация'], grammar_rule: "Psixologik uslub: Исследование показало, что... Поведение определяется... Личность формируется под влиянием...", grammar_example: "Когнитивная психология изучает процессы восприятия, памяти и мышления.", reading_text: "Психология — наука о душе и поведении человека. Когнитивная психология изучает мышление и память. Социальная — как люди влияют друг на друга. Клиническая — помогает людям с психическими расстройствами. Знание психологии помогает лучше понять себя и других.", reading_qs: [{ q: "Klinik psixologiya nima bilan shug'ullanadi?", opts: ["Xotira o'rganish", "Ijtimoiy ta'sir", "Ruhiy buzilishlarga yordam", "Bolalar psixologiyasi"], c: 2 }], xp: 230, coin: 92 },
        { id: 'ra19', icon: '🌱', title: 'Ekologiya va muhit', desc: "Atrof-muhit muammolari", words: ['экосистема', 'биоразнообразие', 'выброс', 'поглощение', 'возобновляемый', 'невозобновляемый', 'углеродный след', 'декарбонизация', 'устойчивость', 'парниковый'], grammar_rule: "Ekologiya: Выбросы CO₂ увеличились на... Для снижения парникового эффекта необходимо... Экосистема включает...", grammar_example: "Парниковые газы вызывают глобальное потепление. Для борьбы с этим нужна декарбонизация экономики.", reading_text: "Россия — страна с огромными природными ресурсами. Байкал содержит 20% пресной воды планеты. Сибирская тайга — лёгкие Земли. Но экологические проблемы существуют: промышленное загрязнение, вырубка лесов. Необходимо бережно относиться к природе.", reading_qs: [{ q: "Baykal nima bilan mashhur?", opts: ["Eng katta ko'l", "Planetaning chuchuk suvining 20%", "Eng chuqur tog'", "Eng katta o'rmon"], c: 1 }], xp: 240, coin: 96 },
        { id: 'ra20', icon: '🔄', title: 'Advanced takrorlash', desc: "Advanced darajasi yakuniy", words: ['красноречие', 'мастерство', 'совершенство', 'достижение', 'прогресс', 'развитие', 'успех', 'знание', 'мудрость', 'опыт'], grammar_rule: "Jami: Barcha grammatik tuzilmalar, uslublar, leksika — C1-C2 darajasida erkin qo'llash", grammar_example: "Поздравляю! Вы завершили полный курс русского языка. Ваши знания теперь на уровне C2.", reading_text: "Вы завершили полный курс русского языка! Это огромное достижение. Вы прошли путь от первых слов приветствия до сложнейших академических текстов. Теперь вы можете свободно общаться, читать классику, писать деловые письма и понимать нюансы языка. Русский язык — ваш!", reading_qs: [{ q: "Kurs tugagandan so'ng siz nima qila olasiz?", opts: ["Faqat salomlasha olasiz", "Erkin muloqot qilasiz va klassikani o'qiysiz", "Faqat yozasiz", "Faqat eshitasiz"], c: 1 }], xp: 400, coin: 160 },
    ],
};

// ── HELPER FUNCTIONS ──
const plan = () => PL[UP] || PL.free;
const canUnit = () => UP === 'universal' || ((UL.units_used_today || 0) < plan().u);
const canAI = () => UP === 'universal' || ((UL.ai_used_today || 0) < plan().ai);
const chkReset = () => {
    if (UP === 'universal') return;
    const rms = (plan().rh || 4) * 3600000;
    if (Date.now() - (UL.last_reset || 0) >= rms) {
        UL.units_used_today = 0;
        UL.ai_used_today = 0;
        UL.last_reset = Date.now();
        saveLimits();
    }
};
async function saveLimits() {
    if (!CU) return;
    try { await updateDoc(doc(db, 'users', CU.uid), { limits: UL }); } catch (e) { }
}

// ── FIREBASE FUNCTIONS ──
async function saveChatMessage(role, text, mode) {
    if (!CU) return;
    try {
        const chatRef = collection(db, 'users', CU.uid, 'chatHistory');
        await addDoc(chatRef, { role, text, mode: mode || chatMode, timestamp: serverTimestamp(), createdAt: Date.now() });
    } catch (e) { console.error('Chat save error:', e); }
}

async function loadChatHistory(limitCount = 30) {
    if (!CU) return [];
    try {
        const chatRef = collection(db, 'users', CU.uid, 'chatHistory');
        const q = query(chatRef, orderBy('createdAt', 'desc'), limit(limitCount));
        const snap = await getDocs(q);
        const msgs = [];
        snap.forEach(d => msgs.unshift({ id: d.id, ...d.data() }));
        return msgs;
    } catch (e) { return []; }
}

async function savePracticeResult(type, score, total, details = {}) {
    if (!CU) return;
    try {
        const practiceRef = collection(db, 'users', CU.uid, 'practiceHistory');
        const pct = total > 0 ? Math.round((score / total) * 100) : 0;
        await addDoc(practiceRef, { type, score, total, percentage: pct, details, timestamp: serverTimestamp(), createdAt: Date.now() });
        const skillInc = Math.max(1, Math.round(pct / 20));
        await updateDoc(doc(db, 'users', CU.uid), {
            [`skills.${type}`]: Math.min(100, (USk[type] || 0) + skillInc),
            [`practiceStats.${type}.count`]: increment(1),
            [`practiceStats.${type}.totalScore`]: increment(pct),
            lastActive: serverTimestamp()
        });
        USk[type] = Math.min(100, (USk[type] || 0) + skillInc);
        drawRadar();
    } catch (e) { console.error('Practice save error:', e); }
}

async function saveLessonCompletion(unitId, lessonKey, score, total, xpEarned, coinEarned) {
    if (!CU) return;
    const pct = total > 0 ? Math.round((score / total) * 100) : 0;
    try {
        const lessonRef = collection(db, 'users', CU.uid, 'lessonHistory');
        await addDoc(lessonRef, { unitId, lessonKey, score, total, percentage: pct, xpEarned, coinEarned, timestamp: serverTimestamp(), createdAt: Date.now() });
        await updateDoc(doc(db, 'users', CU.uid), {
            xp: increment(xpEarned), coins: increment(coinEarned),
            [`progress.${unitId}_${lessonKey}`]: 100,
            [`scores.${unitId}_${lessonKey}`]: pct,
            [`scoreHistory.${unitId}_${lessonKey}`]: arrayUnion({ score: pct, date: Date.now() }),
            lastActive: serverTimestamp()
        });
        UProg[`${unitId}_${lessonKey}`] = 100;
        UProg[`score_${unitId}_${lessonKey}`] = pct;
        showToast(`✅ Natija saqlandi! ${xpEarned} XP`, 'success');
    } catch (e) { console.error('Lesson save error:', e); }
}

// ── GEMINI AI ──
async function callAI(prompt, maxTok = 1000) {
    try {
        const r = await fetch(GEMINI, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: { temperature: 0.7, maxOutputTokens: maxTok } })
        });
        const d = await r.json();
        return d.candidates?.[0]?.content?.parts?.[0]?.text || 'Javob olishda xatolik.';
    } catch (e) { return '❗ AI bilan boglanishda xatolik.'; }
}

async function callAIChat(hist, sysP) {
    try {
        const msgs = [{ role: 'user', parts: [{ text: sysP }] }, ...hist.slice(1)];
        const r = await fetch(GEMINI, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: msgs, generationConfig: { temperature: 0.8, maxOutputTokens: UP === 'universal' ? 1500 : 800 } })
        });
        const d = await r.json();
        return d.candidates?.[0]?.content?.parts?.[0]?.text || 'Javob olishda xatolik.';
    } catch (e) { return '❗ AI bilan boglanishda xatolik.'; }
}

async function loadUD() {
    try {
        const ref = doc(db, 'users', CU.uid);
        const snap = await getDoc(ref);
        if (snap.exists()) {
            const d = snap.data();
            UP = d.plan || 'free';
            UL = d.limits || {};
            UProg = d.progress || {};
            USk = d.skills || { reading: 0, writing: 0, speaking: 0, listening: 0, grammar: 0 };
            if (!UL.units_used_today) UL.units_used_today = 0;
            if (!UL.ai_used_today) UL.ai_used_today = 0;
            if (!UL.last_reset) UL.last_reset = Date.now();
        } else {
            UP = 'free'; UL = { units_used_today: 0, ai_used_today: 0, last_reset: Date.now() }; UProg = {};
            USk = { reading: 0, writing: 0, speaking: 0, listening: 0, grammar: 0 };
            await setDoc(ref, { email: CU.email, displayName: CU.displayName || CU.email.split('@')[0], plan: 'free', xp: 0, coins: 0, streak: 0, limits: UL, progress: {}, skills: USk, practiceStats: {}, createdAt: serverTimestamp() });
        }
        chkReset();
    } catch (e) { console.error(e); }
}

function renderNav() {
    const plabs = { free: 'Free 🌱', own: 'Own 💎', team: 'Team 👥', universal: 'Universal 🚀' };
    const pn = document.getElementById('planBadgeNav');
    if (pn) { pn.textContent = plabs[UP] || 'Free'; pn.className = `plan-badge-nav ${UP}`; }
}

function renderLimitBar() {
    const lt = document.getElementById('limitText'), lp = document.getElementById('limitPills'), lr = document.getElementById('limitReset');
    if (!lt) return;
    if (UP === 'universal') { lt.textContent = '🚀 Universal — Cheksiz!'; if (lp) lp.innerHTML = '<span class="limit-pill ok">∞ Cheksiz</span>'; if (lr) lr.textContent = ''; return; }
    const p = plan();
    const ul = Math.max(0, p.u - (UL.units_used_today || 0));
    const al = Math.max(0, p.ai - (UL.ai_used_today || 0));
    const rt = new Date((UL.last_reset || Date.now()) + (p.rh || 4) * 3600000);
    const diff = Math.max(0, rt.getTime() - Date.now());
    const h = Math.floor(diff / 3600000), m = Math.floor((diff % 3600000) / 60000), s = Math.floor((diff % 60000) / 1000);
    lt.textContent = `${UP.toUpperCase()} —`;
    if (lp) lp.innerHTML = `<span class="limit-pill ${ul > 0 ? 'ok' : 'out'}">📚 ${ul}/${p.u}</span><span class="limit-pill ${al > 2 ? 'ok' : al > 0 ? 'warn' : 'out'}">🤖 ${al}/${p.ai === Infinity ? '∞' : p.ai}</span>`;
    if (lr) lr.textContent = diff > 0 ? `⏱ ${h}s ${m}d ${s}s` : '';
    const ai = document.getElementById('aiLimitInfo');
    if (ai) ai.innerHTML = `AI: ${al}/${p.ai === Infinity ? '∞' : p.ai} | Tikl: ${p.rh}h`;
}
setInterval(renderLimitBar, 1000);

// ── INIT ──
async function initAll() {
    initNavScroll();
    switchLevel('beginner');
    renderWords();
    drawRadar();
    initWritingCounter();
    renderPractice();
    await loadAndRenderChatHistory();
}

function initNavScroll() {
    window.addEventListener('scroll', () => { document.getElementById('navbar')?.classList.toggle('scrolled', window.scrollY > 30); });
}

// ── LEVEL & UNITS ──
window.switchLevel = function (level) {
    curLevel = level;
    document.querySelectorAll('.level-tab').forEach(t => t.classList.toggle('active', t.dataset.level === level));
    renderUnits();
};

function renderUnits() {
    const grid = document.getElementById('unitsGrid');
    const units = UNITS_DATA[curLevel] || [];
    if (!grid) return;
    grid.innerHTML = '';
    units.forEach((unit, i) => {
        const done = ['A', 'B', 'C', 'D'].filter(l => UProg[`${unit.id}_${l}`] >= 100).length;
        const pct = Math.round((done / 4) * 100);
        const isComp = pct === 100;
        const card = document.createElement('div');
        card.className = `unit-card${isComp ? ' completed' : ''}`;
        card.innerHTML = `
      <div class="unit-num">Unit ${i + 1}</div>
      <div class="unit-emoji">${unit.icon}</div>
      <div class="unit-title">${unit.title}</div>
      <div class="unit-desc">${unit.desc}</div>
      <div class="unit-lessons-mini">
        ${['A', 'B', 'C', 'D'].map(l => `<div class="unit-lesson-dot ${UProg[unit.id + '_' + l] >= 100 ? 'done' : ''}">${l}</div>`).join('')}
      </div>
      <div class="unit-progress-bar-wrap"><div class="unit-progress-bar" style="width:${pct}%"></div></div>
      <div class="unit-xp">+${unit.xp} XP · +${unit.coin} 🪙</div>
      ${isComp ? '<div class="unit-complete-badge">✅</div>' : ''}
    `;
        card.onclick = () => openUnit(unit);
        grid.appendChild(card);
    });
}

window.openUnit = function (unit) {
    if (!canUnit()) { showUpgradeModal('Bugungi unit limitingiz tugadi!'); return; }
    curUnit = unit;
    const modal = document.getElementById('unitModal');
    const content = document.getElementById('modalContent');
    if (!modal || !content) return;
    const lnames = { A: "📖 Grammatika & Lug'at", B: "🎧 Listening", C: "📖 Reading", D: "🎤 Speaking & Writing" };
    const lcolors = { A: '#4f6ef7', B: '#22d3ee', C: '#34d399', D: '#f472b6' };
    content.innerHTML = `
    <div class="unit-modal-header">
      <div class="unit-modal-emoji">${unit.icon}</div>
      <div class="unit-modal-title">${unit.title}</div>
      <div class="unit-modal-desc">${unit.desc}</div>
      <div class="unit-modal-meta">
        <span>⭐ +${unit.xp} XP</span><span>🪙 +${unit.coin} Coin</span><span>📚 ${unit.words.length} so'z</span>
      </div>
    </div>
    <div class="unit-lessons-grid">
      ${['A', 'B', 'C', 'D'].map(k => {
        const done = UProg[`${unit.id}_${k}`] >= 100;
        const sc = UProg[`score_${unit.id}_${k}`] || 0;
        return `<div class="lesson-card ${done ? 'done' : ''}" onclick="openLesson('${unit.id}','${k}')">
          <div class="lesson-badge" style="background:${lcolors[k]}22;border-color:${lcolors[k]}55;color:${lcolors[k]}">${k}</div>
          <div class="lesson-card-title" style="color:${lcolors[k]}">${lnames[k]}</div>
          ${done ? `<div class="lesson-score">${sc}%</div>` : ''}
          <div class="lesson-start">${done ? '🔄 Qayta' : '▶ Boshlash'}</div>
        </div>`;
    }).join('')}
    </div>
    <div class="unit-words-preview">
      <div class="uwp-title">📝 So'zlar (${unit.words.length} ta):</div>
      <div class="uwp-words">${unit.words.map(w => `<span class="uwp-word" onclick="spk('${w.replace(/'/g, "\\'")}')">${w} 🔊</span>`).join('')}</div>
    </div>
  `;
    modal.classList.add('open');
};

window.openLesson = function (unitId, lessonKey) {
    let unit = null;
    for (const lvl of Object.values(UNITS_DATA)) { const f = lvl.find(u => u.id === unitId); if (f) { unit = f; break; } }
    if (!unit) return;
    curUnit = unit; curLesson = lessonKey; lScore = 0; lTotal = 0; lexSel = {}; rSel = {}; woAns = []; lessonMics = {};
    UL.units_used_today = (UL.units_used_today || 0) + 1; saveLimits();
    document.getElementById('unitModal')?.classList.remove('open');
    showLessonModal(unit, lessonKey);
};

function showLessonModal(unit, lk) {
    const modal = document.getElementById('unitModal');
    const content = document.getElementById('modalContent');
    if (!modal || !content) return;
    const lnames = { A: "📖 Grammatika & Lug'at", B: "🎧 Listening", C: "📖 Reading", D: "🎤 Speaking & Writing" };
    content.innerHTML = `<div class="lesson-modal-wrap">
    <div class="lesson-modal-header">
      <div class="lm-back" onclick="openUnit(window.__curUnit)">← Orqaga</div>
      <div class="lm-title">${unit.icon} ${unit.title} — ${lnames[lk]}</div>
      <div class="lm-level">${unit.level || curLevel}</div>
    </div>
    <div id="lessonBody">${getLessonHTML(unit, lk)}</div>
  </div>`;
    window.__curUnit = unit;
    modal.classList.add('open');
    if (lk === 'D') initWOChips();
}

function getLessonHTML(unit, lk) {
    if (lk === 'A') return lessonA(unit);
    if (lk === 'B') return lessonB(unit);
    if (lk === 'C') return lessonC(unit);
    if (lk === 'D') return lessonD(unit);
    return '';
}

// ════════════════════════════════════════
// LESSON A: GRAMMATIKA & LUG'AT
// ════════════════════════════════════════
function lessonA(unit) {
    const words = unit.words.slice(0, 12);
    const rule = unit.grammar_rule || '';
    const ex = unit.grammar_example || '';
    const fills = words.slice(0, 4).map((w, i) => {
        const wd = WDB.find(x => x.e === w) || { ex: `Используйте слово "${w}" в предложении.`, eu: '', u: '' };
        const blank = wd.ex.replace(new RegExp(w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), '_______');
        return `<div class="gex-item">
      <div class="gex-q">${i + 1}. ${blank}</div>
      <div class="gex-uz">${wd.eu}</div>
      <input class="gex-input" id="gex${i}" data-ans="${w}" placeholder="Ruscha javobingiz...">
      <div class="gex-row">
        <button class="btn-sm btn-check" onclick="chkFill(${i})">✓ Tekshir</button>
        <button class="btn-sm btn-ai" onclick="aiExWord('${w.replace(/'/g, "\\'")}')">🤖 AI</button>
        <button class="btn-sm btn-sound" onclick="spk('${w.replace(/'/g, "\\'")}')">🔊</button>
      </div>
      <div class="gex-fb" id="gexfb${i}"></div>
    </div>`;
    }).join('');
    const matchW = words.slice(0, 6);
    const matchUZ = matchW.map(w => { const d = WDB.find(x => x.e === w); return d ? d.u : w; });
    const shuffUZ = [...matchUZ].sort(() => Math.random() - 0.5);
    const matchHTML = `<div class="match-wrap">
    <div class="match-col">${matchW.map((w, i) => `<div class="match-item eng" data-i="${i}" onclick="selMatch(this,'e',${i})">${w} 🔊</div>`).join('')}</div>
    <div class="match-col">${shuffUZ.map((u, i) => `<div class="match-item uz" data-u="${u}" onclick="selMatch(this,'u','${u.replace(/'/g, "\\'")}')">${u}</div>`).join('')}</div>
  </div><div id="matchFB" class="gex-fb"></div>`;
    return `
  <div class="ls-section">
    <h3 class="ls-title">📚 Ruscha So'zlar Lug'ati (${unit.words.length} ta)</h3>
    <div class="vocab-grid">
      ${words.map(w => {
        const d = WDB.find(x => x.e === w) || { u: '', t: '', ex: '', eu: '' };
        return `<div class="vocab-card">
          <div class="vocab-top"><span class="vocab-eng">${w}</span><button class="btn-sound-sm" onclick="spk('${w.replace(/'/g, "\\'")}')">🔊</button></div>
          <div class="vocab-uz">${d.u}</div>
          <div class="vocab-type">${d.t}</div>
          <div class="vocab-ex">"${d.ex}"</div>
          <div class="vocab-exuz">${d.eu}</div>
        </div>`;
    }).join('')}
    </div>
  </div>
  <div class="ls-section">
    <h3 class="ls-title">📝 Grammatika Qoidasi</h3>
    <div class="grammar-rule-box">
      <div class="grb-rule">💡 ${rule}</div>
      <div class="grb-example">✏️ ${ex}</div>
      <button class="btn-ai-full" onclick="aiGrammarExplain('${unit.title.replace(/'/g, "\\'")}','${rule.replace(/'/g, "\\'")}')">🤖 AI batafsil tushuntirsin</button>
      <div class="grb-fb" id="gramRuleFB"></div>
    </div>
  </div>
  <div class="ls-section">
    <h3 class="ls-title">✏️ To'ldirish Mashqlari</h3>
    ${fills}
    <div class="gex-fb" id="vocabAIFB"></div>
  </div>
  <div class="ls-section">
    <h3 class="ls-title">🧩 Juftlash Mashqi</h3>
    <p class="ls-hint">Ruscha so'zni uzbcha tarjimasiga ulang:</p>
    ${matchHTML}
  </div>
  <button class="btn-complete" onclick="finLessonA('${unit.id}')">✅ Grammatika darsini yakunlash</button>
  `;
}

window.chkFill = function (i) {
    const inp = document.getElementById(`gex${i}`);
    const fb = document.getElementById(`gexfb${i}`);
    if (!inp || !fb) return;
    const ans = inp.dataset.ans.toLowerCase();
    const usr = inp.value.trim().toLowerCase();
    if (usr === ans) {
        fb.className = 'gex-fb correct'; fb.innerHTML = `✅ To'g'ri! "${inp.dataset.ans}" — ajoyib!`;
        inp.style.borderColor = '#34d399'; lScore++; awardXP(10, 'grammar');
    } else {
        fb.className = 'gex-fb wrong'; fb.innerHTML = `❌ Noto'g'ri. To'g'ri javob: <strong>${inp.dataset.ans}</strong>`;
        inp.style.borderColor = '#f87171';
    }
    lTotal++;
};

let mSel = { e: null, u: null, eEl: null, uEl: null };
window.selMatch = function (el, type, val) {
    if (type === 'e') {
        document.querySelectorAll('.match-item.eng').forEach(x => x.classList.remove('selected'));
        el.classList.add('selected'); mSel.e = val; mSel.eEl = el;
    } else {
        document.querySelectorAll('.match-item.uz').forEach(x => x.classList.remove('selected'));
        el.classList.add('selected'); mSel.u = val; mSel.uEl = el;
    }
    if (mSel.e !== null && mSel.u !== null) {
        const unit = curUnit;
        const words = unit.words.slice(0, 6);
        const w = words[mSel.e];
        const wd = WDB.find(x => x.e === w);
        if (wd && wd.u === mSel.u) {
            mSel.eEl?.classList.add('match-ok'); mSel.uEl?.classList.add('match-ok');
            awardXP(5, 'grammar'); showToast(`✅ "${w}" = "${mSel.u}"!`, 'success');
        } else {
            mSel.eEl?.classList.add('match-no'); mSel.uEl?.classList.add('match-no');
            setTimeout(() => { mSel.eEl?.classList.remove('match-no', 'selected'); mSel.uEl?.classList.remove('match-no', 'selected'); }, 700);
        }
        mSel = { e: null, u: null, eEl: null, uEl: null };
    }
};

window.aiGrammarExplain = async function (title, rule) {
    if (!canAI()) { showUpgradeModal('AI limit tugadi!'); return; }
    const fb = document.getElementById('gramRuleFB');
    if (fb) { fb.className = 'gex-fb info'; fb.innerHTML = '🤖 AI tahlil qilmoqda...'; }
    UL.ai_used_today++; saveLimits();
    const r = await callAI(`"${title}" mavzusida ruscha grammatika qoidasini O'zbek tilida tushuntir: "${rule}". 3 ta ruscha misol keltir. Ruscha misollarga o'zbekcha tarjima ham qo'sh. Sodda va aniq bo'lsin.`, 800);
    if (fb) { fb.className = 'gex-fb info show'; fb.innerHTML = r.replace(/\n/g, '<br>'); }
};

window.aiExWord = async function (word) {
    if (!canAI()) { showUpgradeModal('AI limit tugadi!'); return; }
    const fb = document.getElementById('vocabAIFB');
    if (fb) { fb.className = 'gex-fb info'; fb.innerHTML = `🤖 "${word}" ruscha so'zini tahlil qilmoqda...`; }
    UL.ai_used_today++; saveLimits();
    const r = await callAI(`"${word}" ruscha so'zini O'zbek tilida tushuntir: 1) Ma'nosi 2) Uch xil ruscha misol jumla (o'zbekcha tarjima bilan) 3) Rus tilida qanday qo'llanadi 4) Esda qolish uchun maslahat`, 600);
    if (fb) { fb.className = 'gex-fb info show'; fb.innerHTML = r.replace(/\n/g, '<br>'); }
};

window.finLessonA = async function (uid) { await finLesson(uid, 'A', 'grammar', lScore, lTotal || 4); };

// ════════════════════════════════════════
// LESSON B: LISTENING (RUSCHA)
// ════════════════════════════════════════
function lessonB(unit) {
    const exs = genListenExs(unit);
    window.__listenExs = exs;
    return `
  <div class="ls-section">
    <h3 class="ls-title">🎧 Ruscha Listening Mashqi</h3>
    <p class="ls-hint">Audio tugmani bosing, ruscha diqqat bilan eshiting va savolga javob bering</p>
    <div id="lexCont">${renderLex(exs, 0)}</div>
  </div>
  <div class="ls-section">
    <h3 class="ls-title">✍️ Ruscha Diktant</h3>
    <p class="ls-hint">Ruscha gapni eshiting va to'liq yozing:</p>
    <div class="dict-controls">
      <button class="btn-play" onclick="playDict('${unit.id}','normal')">▶ Ruscha Eshitish</button>
      <button class="btn-play btn-slow" onclick="playDict('${unit.id}','slow')">🐌 Sekin</button>
    </div>
    <div class="dict-wave" id="dwave"><span></span><span></span><span></span><span></span><span></span></div>
    <textarea class="dict-input" id="dictIn" placeholder="Eshitgan ruscha gapingizni yozing..."></textarea>
    <div class="dict-actions">
      <button class="btn-sm btn-check" onclick="chkDict()">✓ Tekshir</button>
      <button class="btn-sm btn-ai" onclick="aiChkDict()">🤖 AI tahlil</button>
    </div>
    <div class="gex-fb" id="dictFB"></div>
  </div>
  <button class="btn-complete" onclick="finLessonB('${unit.id}')">✅ Listening yakunlash</button>
  `;
}

// RUSCHA LISTENING MATNLARI
function genListenExs(unit) {
    const w = unit.words;
    return [
        {
            text: `Сегодня мы говорим о теме "${unit.title}". Слово "${w[0]}" очень важное в русском языке. Это слово часто используется в повседневной речи. Также важно слово "${w[1] || w[0]}", которое связано с темой "${unit.desc}".`,
            q: `О чём идёт речь в тексте?`,
            opts: [unit.title, `Спорт`, `Природа`, `История`],
            c: 0,
            tip: `"Сегодня мы говорим о теме..."`
        },
        {
            text: `Здравствуйте! Меня зовут Иван. Сегодня я расскажу вам о словах "${w[0]}", "${w[1] || w[0]}" и "${w[2] || w[0]}". Эти слова относятся к теме "${unit.title}". Сначала рассмотрим слово "${w[0]}". Потом потренируемся с примерами. Готовы?`,
            q: `О каком слове Иван расскажет сначала?`,
            opts: [`${w[2] || w[0]}`, `${w[0]}`, `${w[1] || w[0]}`, `Обо всём сразу`],
            c: 1,
            tip: `"Сначала рассмотрим слово..."`
        },
        {
            text: `${unit.title} — интересная тема. Если вы хотите улучшить русский язык, нужно знать слово "${w[0]}" и "${w[1] || w[0]}". Многие студенты считают "${w[2] || w[0]}" трудным сначала, но с практикой всё становится легче.`,
            q: `Что становится легче с практикой?`,
            opts: [`${w[0]}`, `${w[1] || w[0]}`, `${w[2] || w[0]}`, `${w[3] || w[0]}`],
            c: 2,
            tip: `"...с практикой всё становится легче"`
        }
    ];
}

function renderLex(exs, idx) {
    const ex = exs[idx];
    if (!ex) return '<div class="lex-done">🎉 Barcha listening mashqlari tugadi!</div>';
    return `<div class="lex-card">
    <div class="lex-num">Savol ${idx + 1}/${exs.length}</div>
    <div class="lex-controls">
      <button class="btn-play" onclick="playLex(${idx},'normal')">▶ Ruscha Tinglash</button>
      <button class="btn-play btn-slow" onclick="playLex(${idx},'slow')">🐌 Sekin</button>
    </div>
    <div class="lex-wave" id="lwave${idx}"><span></span><span></span><span></span><span></span><span></span></div>
    <div class="lex-transcript" id="ltxt${idx}" style="display:none">${ex.text}</div>
    <div class="lex-q">${ex.q}</div>
    <div class="lex-opts">
      ${ex.opts.map((o, oi) => `<div class="lex-opt" data-qi="${idx}" data-oi="${oi}" onclick="selLex(this,${idx},${oi})">${String.fromCharCode(65 + oi)}. ${o}</div>`).join('')}
    </div>
    <div class="lex-tip">💡 Maslahat: ${ex.tip}</div>
    <div class="lex-actions">
      <button class="btn-sm btn-check" onclick="chkLex(${idx},${ex.c})">✓ Tekshir</button>
      ${idx + 1 < exs.length ? `<button class="btn-sm btn-next" onclick="nextLex(${idx + 1})" id="lexnxt${idx}" style="display:none">→ Keyingi</button>` : ''}
    </div>
    <div class="gex-fb" id="lexfb${idx}"></div>
  </div>`;
}

// ✅ RUSCHA TTS — ru-RU
window.playLex = function (idx, speed) {
    const exs = window.__listenExs || [];
    if (!exs[idx]) return;
    const wv = document.getElementById(`lwave${idx}`);
    if (wv) wv.classList.remove('paused');
    const u = new SpeechSynthesisUtterance(exs[idx].text);
    u.lang = 'ru-RU'; u.rate = speed === 'slow' ? 0.55 : 0.82;
    u.onend = () => { if (wv) wv.classList.add('paused'); };
    speechSynthesis.cancel(); speechSynthesis.speak(u);
};

window.selLex = function (el, qi, oi) {
    document.querySelectorAll(`.lex-opt[data-qi="${qi}"]`).forEach(o => o.classList.remove('selected'));
    el.classList.add('selected'); lexSel[qi] = oi;
};

window.chkLex = function (idx, correct) {
    const fb = document.getElementById(`lexfb${idx}`);
    const sel = lexSel[idx];
    if (sel === undefined) { if (fb) { fb.className = 'gex-fb wrong'; fb.innerHTML = '⚠️ Javob tanlang!'; } return; }
    document.querySelectorAll(`.lex-opt[data-qi="${idx}"]`).forEach((o, i) => {
        if (i === correct) o.classList.add('lex-correct');
        else if (i === sel && sel !== correct) o.classList.add('lex-wrong');
    });
    const txEl = document.getElementById(`ltxt${idx}`);
    if (txEl) txEl.style.display = 'block';
    if (sel === correct) {
        if (fb) { fb.className = 'gex-fb correct'; fb.innerHTML = "✅ To'g'ri! Ajoyib tinglovchisiz!"; }
        lScore++; awardXP(15, 'listening');
    } else {
        if (fb) { fb.className = 'gex-fb wrong'; fb.innerHTML = `❌ Noto'g'ri. To'g'ri: <strong>${String.fromCharCode(65 + correct)}</strong>`; }
    }
    lTotal++;
    const nxt = document.getElementById(`lexnxt${idx}`);
    if (nxt) nxt.style.display = 'inline-flex';
};

window.nextLex = function (idx) {
    const exs = window.__listenExs || [];
    const cont = document.getElementById('lexCont');
    if (cont) cont.innerHTML = renderLex(exs, idx);
};

let dictSent = '';
window.playDict = function (uid, speed) {
    let unit = null;
    for (const lvl of Object.values(UNITS_DATA)) { const f = lvl.find(u => u.id === uid); if (f) { unit = f; break; } }
    if (!unit) return;
    const w = unit.words[0];
    const wd = WDB.find(x => x.e === w);
    // ✅ RUSCHA MISOL JUMLA
    dictSent = wd ? wd.ex : `Слово "${w}" очень важное в русском языке.`;
    const wv = document.getElementById('dwave');
    if (wv) wv.classList.remove('paused');
    const u = new SpeechSynthesisUtterance(dictSent);
    // ✅ RUSCHA OVOZ
    u.lang = 'ru-RU'; u.rate = speed === 'slow' ? 0.5 : 0.82;
    u.onend = () => { if (wv) wv.classList.add('paused'); };
    speechSynthesis.cancel(); speechSynthesis.speak(u);
};

window.chkDict = function () {
    const inp = document.getElementById('dictIn');
    const fb = document.getElementById('dictFB');
    if (!inp || !fb) return;
    if (!dictSent) { fb.className = 'gex-fb wrong'; fb.innerHTML = '⚠️ Avval ruscha audio tinglang!'; return; }
    const usr = inp.value.trim();
    if (!usr) { fb.className = 'gex-fb wrong'; fb.innerHTML = '⚠️ Avval yozing!'; return; }
    const cw = dictSent.toLowerCase().replace(/[.,!?]/g, '').split(' ');
    const uw = usr.toLowerCase().replace(/[.,!?]/g, '').split(' ');
    let mc = 0;
    const hl = cw.map(w => { if (uw.includes(w)) { mc++; return `<span class="dc">${w}</span>`; } return `<span class="dw">${w}</span>`; }).join(' ');
    const pct = Math.round((mc / cw.length) * 100);
    fb.className = 'gex-fb info show';
    fb.innerHTML = `<div><strong>To'g'ri ruscha jumla:</strong> ${hl}</div><div style="margin-top:6px"><strong>Sizniki:</strong> ${usr}</div><div class="dict-score">To'g'rilik: ${pct}%</div>`;
    if (pct >= 70) { lScore++; awardXP(20, 'listening'); }
    lTotal++;
};

window.aiChkDict = async function () {
    if (!canAI()) { showUpgradeModal('AI limit tugadi!'); return; }
    const inp = document.getElementById('dictIn');
    const fb = document.getElementById('dictFB');
    if (!inp?.value.trim()) { if (fb) { fb.className = 'gex-fb wrong'; fb.innerHTML = 'Avval yozing!'; } return; }
    fb.className = 'gex-fb info'; fb.innerHTML = '🤖 AI tahlil qilmoqda...';
    UL.ai_used_today++; saveLimits();
    const r = await callAI(`Ruscha diktant natijasini O'zbek tilida tahlil qil:\nAsl ruscha matn: "${dictSent}"\nO'quvchi yozdi: "${inp.value.trim()}"\n1) Imlo xatolari\n2) Tushirib qoldirilgan so'zlar\n3) Ball: /10\n4) Ruscha yozishni yaxshilash bo'yicha maslahat`, 700);
    fb.className = 'gex-fb info show'; fb.innerHTML = r.replace(/\n/g, '<br>');
};

window.finLessonB = async function (uid) { await finLesson(uid, 'B', 'listening', lScore, lTotal || 3); };

// ════════════════════════════════════════
// LESSON C: READING (RUSCHA)
// ════════════════════════════════════════
function lessonC(unit) {
    const rt = unit.reading_text || `${unit.title} — rus tilining muhim mavzusi.`;
    const qs = unit.reading_qs || [{ q: 'Matn nima haqida?', opts: [unit.title, 'Sport', 'Taom', 'Ob-havo'], c: 0 }];
    const wh = unit.words.slice(0, 5);
    return `
  <div class="ls-section">
    <h3 class="ls-title">📖 Ruscha Matn O'qish</h3>
    <div class="reading-card">
      <div class="reading-title">${unit.title}</div>
      <div class="reading-body" id="rdbody">${rt}</div>
      <div class="reading-actions">
        <button class="btn-sm btn-play" onclick="rdAloud()">🔊 Ruscha Tinglash</button>
        <button class="btn-sm btn-check" onclick="hlVocab('${unit.id}')">🖊 So'zlarni ajratish</button>
      </div>
    </div>
  </div>
  <div class="ls-section">
    <h3 class="ls-title">❓ Tushunish Savollari</h3>
    ${qs.map((q, qi) => `<div class="rq-card">
      <div class="rq-q">${qi + 1}. ${q.q}</div>
      <div class="rq-opts">
        ${q.opts.map((o, oi) => `<div class="rq-opt" data-qi="${qi}" data-oi="${oi}" onclick="selRQ(this,${qi},${oi})">${String.fromCharCode(65 + oi)}. ${o}</div>`).join('')}
      </div>
      <div class="gex-fb" id="rqfb${qi}"></div>
    </div>`).join('')}
    <div class="rd-actions">
      <button class="btn-sm btn-check" onclick="chkAllRQ(${JSON.stringify(qs.map(q => q.c))})">✓ Hammasini tekshir</button>
      <button class="btn-sm btn-ai" onclick="aiRdHelp('${unit.title.replace(/'/g, "\\'")}')">🤖 AI tushuntirsin</button>
    </div>
    <div class="gex-fb" id="rdTotFB"></div>
  </div>
  <div class="ls-section">
    <h3 class="ls-title">🔤 Ruscha So'z Yozish</h3>
    ${wh.map((w, i) => {
        const d = WDB.find(x => x.e === w) || { u: w };
        return `<div class="wh-row"><span class="wh-uz">${d.u} →</span><input class="wh-inp" id="whi${i}" data-ans="${w}" placeholder="ruscha..."><button class="wh-btn" onclick="chkWH(${i})">✓</button><button class="wh-btn" onclick="spk('${w.replace(/'/g, "\\'")}')">🔊</button><span class="wh-fb" id="whfb${i}"></span></div>`;
    }).join('')}
  </div>
  <button class="btn-complete" onclick="finLessonC('${unit.id}')">✅ Reading yakunlash</button>
  `;
}

// ✅ RUSCHA TTS o'qish
window.rdAloud = function () {
    const b = document.getElementById('rdbody');
    if (!b) return;
    const u = new SpeechSynthesisUtterance(b.textContent);
    u.lang = 'ru-RU'; u.rate = 0.82; speechSynthesis.cancel(); speechSynthesis.speak(u);
};

window.hlVocab = function (uid) {
    let unit = null;
    for (const lvl of Object.values(UNITS_DATA)) { const f = lvl.find(u => u.id === uid); if (f) { unit = f; break; } }
    if (!unit) return;
    const b = document.getElementById('rdbody'); if (!b) return;
    let html = b.innerHTML;
    unit.words.forEach(w => {
        const re = new RegExp(`(${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
        html = html.replace(re, `<mark class="vocab-hl">$1</mark>`);
    });
    b.innerHTML = html;
};

window.selRQ = function (el, qi, oi) {
    document.querySelectorAll(`.rq-opt[data-qi="${qi}"]`).forEach(o => o.classList.remove('selected'));
    el.classList.add('selected'); rSel[qi] = oi;
};

window.chkAllRQ = function (corrects) {
    let ok = 0;
    corrects.forEach((ca, qi) => {
        const fb = document.getElementById(`rqfb${qi}`);
        const sel = rSel[qi];
        document.querySelectorAll(`.rq-opt[data-qi="${qi}"]`).forEach((o, i) => {
            if (i === ca) o.classList.add('rq-correct');
            else if (sel !== undefined && i === sel && i !== ca) o.classList.add('rq-wrong');
        });
        if (sel === ca) { ok++; if (fb) { fb.className = 'gex-fb correct'; fb.innerHTML = "✅ To'g'ri!"; } }
        else if (sel !== undefined && fb) { fb.className = 'gex-fb wrong'; fb.innerHTML = `❌ To'g'ri: <strong>${String.fromCharCode(65 + ca)}</strong>`; }
    });
    lScore += ok; lTotal += corrects.length;
    const pct = Math.round((ok / corrects.length) * 100);
    const tf = document.getElementById('rdTotFB');
    if (tf) { tf.className = `gex-fb ${pct >= 60 ? 'correct' : 'wrong'} show`; tf.innerHTML = `${pct >= 60 ? '🏆' : '💪'} ${ok}/${corrects.length} — ${pct}%`; }
    if (pct >= 60) awardXP(25, 'reading');
};

window.aiRdHelp = async function (title) {
    if (!canAI()) { showUpgradeModal('AI limit tugadi!'); return; }
    const fb = document.getElementById('rdTotFB');
    if (fb) { fb.className = 'gex-fb info'; fb.innerHTML = '🤖 AI tahlil qilmoqda...'; }
    UL.ai_used_today++; saveLimits();
    const r = await callAI(`Ruscha "${title}" mavzusidagi o'qish matni bo'yicha O'zbek tilida yordam ber: 1) Asosiy fikrlar 2) Muhim ruscha so'zlar va ularning ma'nosi 3) Matnni tushunish bo'yicha maslahat`, 600);
    if (fb) { fb.className = 'gex-fb info show'; fb.innerHTML = r.replace(/\n/g, '<br>'); }
};

window.chkWH = function (i) {
    const inp = document.getElementById(`whi${i}`);
    const fb = document.getElementById(`whfb${i}`);
    if (!inp || !fb) return;
    if (inp.value.trim().toLowerCase() === inp.dataset.ans.toLowerCase()) {
        fb.className = 'whfb ok'; fb.innerHTML = '✅'; inp.style.borderColor = '#34d399'; awardXP(5, 'reading');
    } else {
        fb.className = 'whfb no'; fb.innerHTML = `❌ ${inp.dataset.ans}`; inp.style.borderColor = '#f87171';
    }
};

window.finLessonC = async function (uid) { await finLesson(uid, 'C', 'reading', lScore, lTotal || 3); };

// ════════════════════════════════════════
// LESSON D: SPEAKING & WRITING (RUSCHA)
// ════════════════════════════════════════
function lessonD(unit) {
    const topics = [
        `${unit.title} haqida ruscha 3-4 jumla gapiring`,
        `"${unit.words[0]}" ruscha so'zini ishlatib jumla ayting`,
        `${unit.desc} ni o'z so'zlaringiz bilan ruscha tushuntiring`
    ];
    const wp = `"${unit.title}" mavzusida 40-60 so'zlik ruscha paragraf yozing. Quyidagi so'zlardan kamida 3 tasini ishlating: ${unit.words.slice(0, 5).join(', ')}`;
    const wd = WDB.find(x => x.e === unit.words[0]);
    const woSent = wd ? wd.ex : `Слово "${unit.words[0]}" очень важное.`;
    const woWords = woSent.split(' ');
    const woShuf = [...woWords].sort(() => Math.random() - 0.5);
    window.__woCorrect = woSent;
    return `
  <div class="ls-section">
    <h3 class="ls-title">🎤 Ruscha Speaking Mashqlari</h3>
    ${topics.map((t, i) => `<div class="stc" id="stc${i}">
      <div class="stc-header"><div class="stc-num">${i + 1}</div><div class="stc-topic">${t}</div></div>
      <div class="stc-hint">💡 Misol so'z: "${unit.words[i] || unit.words[0]}"</div>
      <div class="stc-mic">
        <button class="btn-mic" id="mbtn${i}" onclick="togMic(${i})">🎤 Ruscha Gapirish</button>
        <div class="stc-status" id="mst${i}">Mikrofon tayyor</div>
      </div>
      <div class="stc-transcript" id="mtr${i}"></div>
      <div class="stc-actions">
        <button class="btn-sm btn-ai" onclick="aiSpk(${i},'${t.replace(/'/g, "\\'")}')">🤖 AI baholash</button>
        <button class="btn-sm btn-check" onclick="markDone(${i})">✅ Bajarildim</button>
      </div>
      <div class="gex-fb" id="sfb${i}"></div>
    </div>`).join('')}
  </div>
  <div class="ls-section">
    <h3 class="ls-title">✍️ Ruscha Writing Mashqi</h3>
    <div class="wp-card">${wp}</div>
    <div class="wstats"><span id="dwc">0 so'z</span><span id="dcc">0 belgi</span><span id="dst" class="wst-warn">Min 40 so'z</span></div>
    <textarea class="writing-ta" id="dta" placeholder="Bu yerda ruscha yozing..." oninput="updWC()"></textarea>
    <div class="wa-row">
      <button class="btn-sm btn-ai" onclick="aiWrit('${unit.title.replace(/'/g, "\\'")}','${unit.words.slice(0, 5).join(',')}')">🤖 AI tekshirsin</button>
      <button class="btn-sm btn-check" onclick="selfChk(40)">📊 So'z soni</button>
    </div>
    <div class="gex-fb" id="wfb"></div>
  </div>
  <div class="ls-section">
    <h3 class="ls-title">🔀 Ruscha So'z Tartibi</h3>
    <p class="ls-hint">Ruscha so'zlarni bosib to'g'ri jumla tuzing:</p>
    <div class="wo-chips" id="woChips">
      ${woShuf.map(w => `<div class="wo-chip" data-w="${w}" onclick="selChip(this)">${w}</div>`).join('')}
    </div>
    <div class="wo-ans" id="woAnsDiv"><span class="wo-ph">Bu yerga bosing...</span></div>
    <div class="wa-row">
      <button class="btn-sm btn-check" onclick="chkWO()">✓ Tekshir</button>
      <button class="btn-sm" onclick="rstWO()">🔄 Qayta</button>
      <button class="btn-sm btn-sound" onclick="spk('${woSent.replace(/'/g, "\\'")}')">🔊 Ruscha Eshit</button>
    </div>
    <div class="gex-fb" id="wofb"></div>
  </div>
  <button class="btn-complete" onclick="finLessonD('${unit.id}')">✅ Speaking & Writing yakunlash</button>
  `;
}

window.initWOChips = function () { woAns = []; };

window.selChip = function (el) {
    if (el.classList.contains('used')) return;
    el.classList.add('used'); woAns.push(el.dataset.w);
    const d = document.getElementById('woAnsDiv');
    if (d) d.innerHTML = woAns.map((w, i) => `<span class="wo-aw" onclick="rmChip(${i})">${w}</span>`).join(' ');
};

window.rmChip = function (idx) {
    const w = woAns[idx]; woAns.splice(idx, 1);
    document.querySelectorAll('.wo-chip').forEach(c => { if (c.dataset.w === w && c.classList.contains('used')) { c.classList.remove('used'); } });
    const d = document.getElementById('woAnsDiv');
    if (d) { if (!woAns.length) { d.innerHTML = '<span class="wo-ph">Bu yerga bosing...</span>'; } else { d.innerHTML = woAns.map((w, i) => `<span class="wo-aw" onclick="rmChip(${i})">${w}</span>`).join(' '); } }
};

window.rstWO = function () { woAns = []; document.querySelectorAll('.wo-chip').forEach(c => c.classList.remove('used')); const d = document.getElementById('woAnsDiv'); if (d) d.innerHTML = '<span class="wo-ph">Bu yerga bosing...</span>'; };

window.chkWO = function () {
    const fb = document.getElementById('wofb'); const correct = window.__woCorrect || '';
    if (!woAns.length) { if (fb) { fb.className = 'gex-fb wrong'; fb.innerHTML = "⚠️ Avval so'zlarni tartibga qo'ying!"; } return; }
    const usr = woAns.join(' ');
    if (usr.toLowerCase() === correct.toLowerCase()) {
        if (fb) { fb.className = 'gex-fb correct'; fb.innerHTML = "🏆 Mukammal! To'g'ri ruscha jumla!"; } awardXP(15, 'writing'); lScore++;
    } else {
        if (fb) { fb.className = 'gex-fb wrong'; fb.innerHTML = `❌ Noto'g'ri. To'g'ri ruscha: <em>${correct}</em>`; }
    }
    lTotal++;
};

// ✅ RUSCHA SPEECH RECOGNITION — ru-RU
window.togMic = function (idx) {
    const btn = document.getElementById(`mbtn${idx}`);
    const st = document.getElementById(`mst${idx}`);
    const tr = document.getElementById(`mtr${idx}`);
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
        if (tr) tr.innerHTML = `<textarea class="man-inp" id="man${idx}" placeholder="Mikrofon yo'q — ruscha bu yerga yozing..."></textarea>`;
        if (st) st.textContent = '⌨️ Yozma kiritish'; return;
    }
    if (lessonMics[idx]) { try { lessonMics[idx].stop(); } catch (e) { } lessonMics[idx] = null; if (btn) { btn.classList.remove('rec'); btn.innerHTML = '🎤 Ruscha Gapirish'; } return; }
    const rec = new SR();
    rec.lang = 'ru-RU'; // ✅ RUSCHA
    rec.continuous = true; rec.interimResults = true;
    rec.onresult = e => { let t = ''; for (let i = e.resultIndex; i < e.results.length; i++) t += e.results[i][0].transcript; if (tr && tr.tagName !== 'TEXTAREA') tr.textContent = t; };
    rec.onerror = e => {
        if (e.error === 'not-allowed') { if (st) st.innerHTML = "🚫 Mikrofon ruxsat yo'q"; if (tr) tr.innerHTML = `<textarea class="man-inp" id="man${idx}" placeholder="Bu yerga ruscha yozing..."></textarea>`; }
        else { if (st) st.textContent = 'Xatolik — qayta urining'; }
        if (btn) { btn.classList.remove('rec'); btn.innerHTML = '🎤 Ruscha Gapirish'; } lessonMics[idx] = null;
    };
    rec.onend = () => { if (btn) { btn.classList.remove('rec'); btn.innerHTML = '🎤 Ruscha Gapirish'; } if (st) st.innerHTML = '✅ Yozib olindi'; lessonMics[idx] = null; };
    try { rec.start(); lessonMics[idx] = rec; if (btn) { btn.classList.add('rec'); btn.innerHTML = "⏹ To'xtatish"; } if (st) st.innerHTML = '🔴 Ruscha yozmoqda...'; }
    catch (e) { if (st) st.textContent = 'Mikrofon xatolik'; if (tr) tr.innerHTML = `<textarea class="man-inp" id="man${idx}" placeholder="Bu yerga ruscha yozing..."></textarea>`; }
};

window.aiSpk = async function (idx, topic) {
    if (!canAI()) { showUpgradeModal('AI limit tugadi!'); return; }
    const tr = document.getElementById(`mtr${idx}`);
    const man = document.getElementById(`man${idx}`);
    const fb = document.getElementById(`sfb${idx}`);
    let text = '';
    if (tr) { text = tr.tagName === 'TEXTAREA' ? tr.value.trim() : tr.textContent.trim(); }
    if (!text && man) text = man.value.trim();
    if (!text) { if (fb) { fb.className = 'gex-fb wrong'; fb.innerHTML = '⚠️ Avval ruscha gapiring yoki yozing!'; } return; }
    if (fb) { fb.className = 'gex-fb info'; fb.innerHTML = '🤖 AI baholayapti...'; }
    UL.ai_used_today++; saveLimits();
    const r = await callAI(`Ruscha speaking baholash. Mavzu: "${topic}". O'quvchi ruscha gapirdi: "${text}". O'zbek tilida:\n1. ✅ Yaxshi tomonlari\n2. ❌ Grammatika xatoliklari\n3. 💡 Yaxshilash tavsiyalari\n4. 🗣️ Tuzatilgan ruscha variant\n5. ⭐ Ball: /10`, 700);
    if (fb) { fb.className = 'gex-fb info show'; fb.innerHTML = r.replace(/\n/g, '<br>'); }
    lScore++; lTotal++; awardXP(20, 'speaking');
};

window.markDone = function (idx) {
    const c = document.getElementById(`stc${idx}`); if (c) c.classList.add('done');
    lScore++; lTotal++; awardXP(10, 'speaking'); showToast('✅ Bajarildi!', 'success');
};

window.updWC = function () {
    const ta = document.getElementById('dta'); if (!ta) return;
    const t = ta.value.trim(); const w = t ? t.split(/\s+/).length : 0;
    const wc = document.getElementById('dwc'); const cc = document.getElementById('dcc'); const st = document.getElementById('dst');
    if (wc) wc.textContent = w + " so'z";
    if (cc) cc.textContent = t.length + ' belgi';
    if (st) { if (w >= 40) { st.textContent = '✅ Yetarli'; st.className = 'wst-ok'; } else { st.textContent = `Min 40 so'z (${w}/40)`; st.className = 'wst-warn'; } }
};

window.selfChk = function (min) {
    const ta = document.getElementById('dta'); const fb = document.getElementById('wfb');
    if (!ta || !fb) return;
    const w = ta.value.trim() ? ta.value.trim().split(/\s+/).length : 0;
    if (w >= min) { fb.className = 'gex-fb correct'; fb.innerHTML = `✅ ${w} ruscha so'z yozdingiz!`; lScore++; awardXP(15, 'writing'); }
    else { fb.className = 'gex-fb wrong'; fb.innerHTML = `⚠️ Hali ${min - w} so'z kam. Davom eting!`; }
    lTotal++;
};

window.aiWrit = async function (title, words) {
    if (!canAI()) { showUpgradeModal('AI limit tugadi!'); return; }
    const ta = document.getElementById('dta'); const fb = document.getElementById('wfb');
    if (!ta?.value.trim()) { if (fb) { fb.className = 'gex-fb wrong'; fb.innerHTML = 'Avval ruscha yozing!'; } return; }
    fb.className = 'gex-fb info'; fb.innerHTML = '🤖 AI tekshirmoqda...';
    UL.ai_used_today++; saveLimits();
    const r = await callAI(`Ruscha yozuvni tekshir. Mavzu: "${title}" (kerakli ruscha so'zlar: ${words}).\nMatn: "${ta.value.trim()}"\nO'zbek tilida:\n1. ✅ Grammatika xatoliklari\n2. 📝 Uslub va tuzilish\n3. 🔄 Tuzatilgan ruscha variant\n4. ⭐ Ruscha yozuv bali: /10`, 800);
    fb.className = 'gex-fb info show'; fb.innerHTML = r.replace(/\n/g, '<br>'); awardXP(20, 'writing');
};

window.finLessonD = async function (uid) { await finLesson(uid, 'D', 'speaking', lScore, lTotal || 3); };

// ── DARS YAKUNLASH ──
async function finLesson(uid, lk, skill, sc, tot) {
    if (!CU) return;
    const pct = tot > 0 ? Math.round((sc / tot) * 100) : 70;
    let unit = null; for (const lvl of Object.values(UNITS_DATA)) { const f = lvl.find(u => u.id === uid); if (f) { unit = f; break; } }
    if (!unit) return;
    const xpB = plan().xb || 1, coinB = plan().cb || 1;
    const xpE = Math.round((unit.xp / 4) * xpB * (pct / 100));
    const coinE = Math.round((unit.coin / 4) * coinB * (pct / 100));
    await saveLessonCompletion(uid, lk, sc, tot, xpE, coinE);
    await savePracticeResult(skill, sc, tot, { unitId: uid, lessonKey: lk, unitTitle: unit.title });
    USk[skill] = Math.min(100, (USk[skill] || 0) + Math.round(pct / 15));
    drawRadar(); renderUnits();
    showResult(lk, pct, xpE, coinE, unit, uid);
}

function showResult(lk, pct, xp, coin, unit, uid) {
    const lnames = { A: "Grammatika & Lug'at", B: 'Listening', C: 'Reading', D: 'Speaking & Writing' };
    const nxt = { A: 'B', B: 'C', C: 'D', D: null };
    const content = document.getElementById('modalContent');
    if (!content) return;
    content.innerHTML = `<div class="result-wrap">
    <div class="result-circle ${pct >= 80 ? 'great' : pct >= 60 ? 'good' : 'ok'}">
      <div class="rc-pct">${pct}%</div>
      <div class="rc-lbl">${lnames[lk]}</div>
    </div>
    <div class="result-rewards">
      <div class="rr-item">⭐ +${xp} XP</div>
      <div class="rr-item">🪙 +${coin} Coin</div>
    </div>
    <div class="result-msg">${pct >= 80 ? '🏆 Mukammal! Siz ustasiz!' : pct >= 60 ? '✅ Yaxshi! Davom eting!' : "💪 Harakat qilib ko'ring!"}</div>
    <div class="result-actions">
      ${nxt[lk] ? `<button class="btn-complete" onclick="openLesson('${uid}','${nxt[lk]}')">→ Keyingi: ${lnames[nxt[lk]]}</button>` : `<div class="unit-done-msg">🎉 Unit to'liq bajarildi!</div>`}
      <button class="btn-back" onclick="document.getElementById('unitModal').classList.remove('open');renderUnits()">🏠 Unitlarga qaytish</button>
    </div>
  </div>`;
    showXPPop(`+${xp} XP +${coin} 🪙`);
}

// ── SO'ZLAR ──
function renderWords(reset = true) {
    if (reset) wOff = 0;
    const grid = document.getElementById('wordsGrid'); if (!grid) return;
    const filt = getFiltered();
    const slice = filt.slice(0, wOff + 30);
    if (reset) grid.innerHTML = '';
    slice.slice(wOff).forEach(w => {
        const card = document.createElement('div'); card.className = 'word-card';
        card.innerHTML = `<div class="wc-top"><div class="wc-eng">${w.e}</div><button onclick="spk('${w.e.replace(/'/g, "\\'")}',event)" class="wc-snd">🔊</button></div><div class="wc-uz">${w.u}</div><div class="wc-meta"><span>${w.t}</span><span>${w.l}</span></div>`;
        card.onclick = e => { if (e.target.closest('.wc-snd')) return; openWModal(w); };
        grid.appendChild(card);
    });
    wOff = slice.length;
    const btn = document.getElementById('loadMoreBtn'); if (btn) btn.style.display = wOff >= filt.length ? 'none' : 'block';
}

function getFiltered() { return WDB.filter(w => { const ms = !wSrch || w.e.toLowerCase().includes(wSrch) || w.u.toLowerCase().includes(wSrch); const ml = wFilt === 'all' || w.l === wFilt; return ms && ml; }); }

window.filterWords = function () { wSrch = document.getElementById('wordSearch')?.value.toLowerCase() || ''; renderWords(true); };
window.filterByLevel = function (level, el) { wFilt = level; document.querySelectorAll('.wf-tab').forEach(t => t.classList.remove('active')); el.classList.add('active'); renderWords(true); };
window.loadMoreWords = function () { renderWords(false); };

window.openWModal = function (w) {
    const m = document.getElementById('wordModal'); const c = document.getElementById('wordModalContent'); if (!m || !c) return;
    c.innerHTML = `<div class="wm-eng">${w.e}</div><div class="wm-uz">${w.u}</div><div class="wm-meta">${w.t} · ${w.l}</div>
    <div class="wm-ex"><div>"${w.ex}"</div><div class="wm-exuz">${w.eu}</div></div>
    <div class="wm-actions">
      <button class="btn-sm btn-play" onclick="spk('${w.e.replace(/'/g, "\\'")}')">🔊 Ruscha Talaffuz</button>
      <button class="btn-sm btn-ai" onclick="aiExWord('${w.e.replace(/'/g, "\\'")}')">🤖 AI tushuntir</button>
    </div>
    <div class="gex-fb" id="wordAIFB"></div>`;
    m.classList.add('open');
};

window.closeWordModal = function (e) { if (!e || e.target === document.getElementById('wordModal')) document.getElementById('wordModal')?.classList.remove('open'); };

// ════════════════════════════════════════
// AMALIYOT BO'LIMI
// ════════════════════════════════════════
function renderPractice() { initPracticeListening(); }

// ── AMALIYOT LISTENING — RUSCHA ──
const PLEx = [
    { text: "Доброе утро! Сегодня в Москве солнечная погода. Температура около плюс двадцати градусов. Рекомендую надеть лёгкую одежду. Хорошего вам дня!", q: "Какая погода сегодня в Москве?", opts: ["Холодная и дождливая", "Солнечная и тёплая", "Облачная и ветреная", "Снежная"], c: 1 },
    { text: "Здравствуйте! Говорит Московская городская библиотека. Мы работаем с понедельника по пятницу с девяти до восемнадцати, в субботу с десяти до шестнадцати. В воскресенье мы закрыты. Добро пожаловать!", q: "Когда библиотека закрыта?", opts: ["В понедельник", "В субботу", "В воскресенье", "В пятницу"], c: 2 },
    { text: "Внимание, пассажиры! Поезд до Санкт-Петербурга отправляется с третьей платформы в пятнадцать часов тридцать минут. Просьба приготовить билеты. Спасибо за внимание.", q: "С какой платформы отправляется поезд?", opts: ["Первая", "Вторая", "Третья", "Четвёртая"], c: 2 },
    { text: "Алло! Я звоню по поводу вакансии. У меня пять лет опыта в сфере IT. Я говорю на трёх языках: русском, узбекском и английском. Хотел бы обсудить эту должность подробнее.", q: "Сколько лет опыта у звонящего?", opts: ["Три", "Четыре", "Пять", "Шесть"], c: 2 },
    { text: "Добро пожаловать в поликлинику! Если у вас срочный вопрос, нажмите один. Для записи к врачу нажмите два. Для получения результатов анализов нажмите три. Для связи с врачом оставайтесь на линии.", q: "Что нужно нажать для записи к врачу?", opts: ["1", "2", "3", "Оставаться на линии"], c: 1 }
];
let plIdx = 0;

function initPracticeListening() {
    const ex = PLEx[plIdx % PLEx.length];
    const listeningQ = document.getElementById('listeningQ');
    if (listeningQ) {
        listeningQ.innerHTML = `<div class="lex-q">${ex.q}</div><div class="lex-opts">
      ${ex.opts.map((o, i) => `<div class="lex-opt plex" data-i="${i}" onclick="selPLex(this,${i})">${String.fromCharCode(65 + i)}. ${o}</div>`).join('')}
    </div>`;
    }
    const as = document.getElementById('audioSentence'); if (as) as.textContent = ex.text;
    window.__plCurrent = ex; window.__plSelected = -1;
}

// ✅ RUSCHA AUDIO
window.toggleAudio = function () {
    const ex = window.__plCurrent; if (!ex) return;
    const wave = document.getElementById('audioWave'); const btn = document.getElementById('playBtn');
    if (wave) wave.classList.remove('paused'); if (btn) btn.textContent = "⏸ To'xtatish";
    const u = new SpeechSynthesisUtterance(ex.text);
    u.lang = 'ru-RU'; // ✅ RUSCHA
    u.rate = 0.82;
    u.onend = () => { if (wave) wave.classList.add('paused'); if (btn) btn.textContent = '▶ Ruscha Tinglash'; };
    speechSynthesis.cancel(); speechSynthesis.speak(u);
};

window.selPLex = function (el, i) {
    document.querySelectorAll('.plex').forEach(o => o.classList.remove('selected'));
    el.classList.add('selected'); window.__plSelected = i;
};

window.checkListening = async function () {
    const fb = document.getElementById('listeningFeedback'); const ex = window.__plCurrent;
    if (!ex || !fb) return;
    const sel = window.__plSelected;
    if (sel < 0) { fb.className = 'feedback-box error show'; fb.innerHTML = '⚠️ Javob tanlang!'; return; }
    document.querySelectorAll('.plex').forEach((o, i) => { if (i === ex.c) o.classList.add('lex-correct'); else if (i === sel && sel !== ex.c) o.classList.add('lex-wrong'); });
    const correct = sel === ex.c;
    if (correct) {
        fb.className = 'feedback-box success show'; fb.innerHTML = "✅ To'g'ri! Ajoyib!";
        awardXP(10, 'listening');
        await savePracticeResult('listening', 1, 1, { question: ex.q, correct: true, type: 'practice_panel' });
    } else {
        fb.className = 'feedback-box error show'; fb.innerHTML = `❌ To'g'ri: <strong>${String.fromCharCode(65 + ex.c)}</strong>`;
        await savePracticeResult('listening', 0, 1, { question: ex.q, correct: false, type: 'practice_panel' });
    }
    const as = document.getElementById('audioTextHidden'); if (as) as.style.display = 'block';
};

window.nextListening = function () { plIdx++; initPracticeListening(); const fb = document.getElementById('listeningFeedback'); if (fb) { fb.className = 'feedback-box'; fb.innerHTML = ''; } };

// ── AMALIYOT SPEAKING — RUSCHA MAVZULAR ──
const PSTopics = [
    { topic: "Kundalik hayotingizni ruscha tasvirlab bering", ex: "Каждое утро я просыпаюсь в семь и завтракаю..." },
    { topic: "Sevimli ruscha taomingiz haqida gapiring", ex: "Мне очень нравится борщ, потому что..." },
    { topic: "O'z shahringizni ruscha tasvirlab bering", ex: "Я из Ташкента. Это большой красивый город..." },
    { topic: "Hobbiingiz haqida ruscha gapiring", ex: "В свободное время я люблю читать книги и слушать музыку..." },
    { topic: "Oilingizni ruscha tasvirlab bering", ex: "Моя семья небольшая. У меня есть мама, папа и сестра..." },
    { topic: "Kelajak rejalaringizni ruscha aytib bering", ex: "В будущем я хочу стать программистом и путешествовать..." },
];
let psIdx = 0;

window.switchPractice = function (type) {
    document.querySelectorAll('.ptab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.practice-panel').forEach(p => p.classList.remove('active'));
    document.querySelector(`.ptab[onclick*="${type}"]`)?.classList.add('active');
    const panel = document.getElementById(`panel-${type}`);
    if (panel) { panel.classList.add('active'); }
    if (type === 'speaking') initPracticeSpeaking();
    if (type === 'grammar') initPracticeGrammar();
    if (type === 'reading') initPracticeReading();
    if (type === 'writing') initPracticeWriting();
    if (type === 'postcard') initPracticePostcard();
};

function initPracticeSpeaking() {
    const t = PSTopics[psIdx % PSTopics.length];
    const st = document.getElementById('speakTopic'); const se = document.getElementById('speakExample');
    if (st) st.innerHTML = `<strong>📌 Ruscha Mavzu:</strong> ${t.topic}`;
    if (se) se.innerHTML = `<em>💡 Misol bosh (ruscha): "${t.ex}"</em>`;
    const ms = document.getElementById('micStatus'); if (ms) ms.textContent = 'Mikrofon tayyor';
    const tr = document.getElementById('transcriptBox'); if (tr) tr.innerHTML = '';
    window.__psTopic = t;
}

// ✅ RUSCHA SPEECH RECOGNITION — toggleMic
window.toggleMic = function () {
    const btn = document.getElementById('micBtn'); const st = document.getElementById('micStatus'); const tr = document.getElementById('transcriptBox');
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { if (st) st.innerHTML = "⌨️ Mikrofon yo'q — quyida ruscha yozing"; if (tr) tr.innerHTML = '<textarea class="man-inp" id="psManIn" placeholder="Bu yerga ruscha yozing..."></textarea>'; return; }
    if (isRec && recog) { try { recog.stop(); } catch (e) { } recog = null; isRec = false; if (btn) { btn.querySelector('.mic-icon').textContent = '🎤'; document.getElementById('micBtnText').textContent = 'Ruscha Gapirish boshlash'; } return; }
    const rec = new SR();
    rec.lang = 'ru-RU'; // ✅ RUSCHA
    rec.continuous = true; rec.interimResults = true;
    rec.onresult = e => { let t = ''; for (let i = e.resultIndex; i < e.results.length; i++) t += e.results[i][0].transcript; if (tr) tr.textContent = t; };
    rec.onerror = e => { isRec = false; recog = null; if (st) st.textContent = e.error === 'not-allowed' ? '🚫 Ruxsat berilmagan' : 'Xatolik'; if (btn) { btn.querySelector('.mic-icon').textContent = '🎤'; document.getElementById('micBtnText').textContent = 'Ruscha Gapirish boshlash'; } };
    rec.onend = () => { isRec = false; recog = null; if (st) st.innerHTML = '✅ Yozib olindi'; if (btn) { btn.querySelector('.mic-icon').textContent = '🎤'; document.getElementById('micBtnText').textContent = 'Ruscha Gapirish boshlash'; } };
    try { rec.start(); recog = rec; isRec = true; if (btn) { btn.querySelector('.mic-icon').textContent = '⏹'; document.getElementById('micBtnText').textContent = "To'xtatish"; } if (st) st.innerHTML = '🔴 Ruscha yozmoqda...'; }
    catch (e) { if (st) st.textContent = 'Mikrofon xatolik'; if (tr) tr.innerHTML = '<textarea class="man-inp" id="psManIn" placeholder="Bu yerga ruscha yozing..."></textarea>'; }
};

window.analyzeSpeaking = async function () {
    if (!canAI()) { showUpgradeModal('AI limit tugadi!'); return; }
    const tr = document.getElementById('transcriptBox'); const man = document.getElementById('psManIn');
    const fb = document.getElementById('speakingFeedback');
    let text = '';
    if (tr) text = tr.tagName === 'TEXTAREA' ? tr.value.trim() : tr.textContent.trim();
    if (!text && man) text = man.value.trim();
    if (!text) { if (fb) { fb.className = 'feedback-box error show'; fb.innerHTML = '⚠️ Avval ruscha gapiring yoki yozing!'; } return; }
    if (fb) { fb.className = 'feedback-box info show'; fb.innerHTML = '🤖 AI baholayapti...'; }
    UL.ai_used_today++; saveLimits();
    const t = window.__psTopic || { topic: 'Umumiy mavzu' };
    const r = await callAI(`Ruscha speaking baholash. Mavzu: "${t.topic}". O'quvchi ruscha gapirdi: "${text}".\nO'zbek tilida rus tili mezonlari bo'yicha:\n1. 🗣️ Ravonlik (/10)\n2. 📚 Leksik boylik (/10)\n3. 📝 Grammatik to'g'rilik (/10)\n4. 🎵 Talaffuz (/10)\n5. 💬 Umumiy ball: /10\n6. 🔄 Tuzatilgan ruscha variant`, 900);
    if (fb) { fb.className = 'feedback-box info show'; fb.innerHTML = r.replace(/\n/g, '<br>'); }
    awardXP(20, 'speaking');
    await savePracticeResult('speaking', 1, 1, { topic: t.topic, text, type: 'practice_panel', aiResponse: r.substring(0, 200) });
};

window.nextSpeaking = function () { psIdx++; initPracticeSpeaking(); const fb = document.getElementById('speakingFeedback'); if (fb) { fb.className = 'feedback-box'; fb.innerHTML = ''; } };

// ── AMALIYOT READING — RUSCHA MATNLAR ──
const PRTexts = [
    {
        title: "Россия — самая большая страна мира",
        text: "Россия занимает одну восьмую часть суши нашей планеты. Её площадь составляет более семнадцати миллионов квадратных километров. Страна расположена в двух частях света: Европе и Азии. В России живут более ста сорока миллионов человек. Москва — столица и самый большой город страны. Официальный язык — русский. Россия богата природными ресурсами: нефтью, газом, лесами и реками.",
        qs: [
            { q: "Qanday qismni Rossiya egallaydi?", opts: ["1/4 qism", "1/6 qism", "1/8 qism", "1/10 qism"], c: 2 },
            { q: "Rossiyaning rasmiy tili qaysi?", opts: ["Inglizcha", "Nemischa", "Ruscha", "Frantsuzcha"], c: 2 },
            { q: "Qaysi resurslar tilga olingan?", opts: ["Oltin va kumush", "Neft, gaz, o'rmon va daryolar", "Ko'mir va temir", "Olmoslar"], c: 1 }
        ]
    },
    {
        title: "Русский язык в мире",
        text: "Русский язык — один из шести официальных языков ООН. На нём говорят около трёхсот миллионов человек по всему миру. Русский язык — один из самых распространённых языков в интернете. Он входит в десятку самых изучаемых языков мира. Знание русского языка открывает возможности для работы, образования и путешествий в странах СНГ и России.",
        qs: [
            { q: "Rus tili nechta odamga xizmat qiladi?", opts: ["100 million", "200 million", "300 million", "400 million"], c: 2 },
            { q: "Rus tili qaysi tashkilotning rasmiy tili?", opts: ["NATO", "YeI", "BMT", "OECD"], c: 2 },
            { q: "Rus tilini bilish nimani beradi?", opts: ["Faqat turizm imkoniyatlarini", "Ish, ta'lim va sayohat imkoniyatlarini", "Faqat internet foydalanish", "Faqat sport"], c: 1 }
        ]
    },
    {
        title: "Байкал — жемчужина Сибири",
        text: "Байкал — самое глубокое озеро на планете Земля. Его глубина достигает тысячи шестисот метров. Байкал содержит около двадцати процентов всей пресной воды Земли. В озере обитает уникальная нерпа — пресноводный тюлень. Байкал внесён в список объектов Всемирного наследия ЮНЕСКО. Каждый год сюда приезжают миллионы туристов со всего мира.",
        qs: [
            { q: "Baykal nima bilan mashxur?", opts: ["Eng katta ko'l", "Eng chuqur ko'l", "Eng shirin ko'l", "Eng issiq ko'l"], c: 1 },
            { q: "Baykal dunyo chuchuk suvining necha foizini tutadi?", opts: ["10%", "15%", "20%", "25%"], c: 2 },
            { q: "Qanday noyob hayvon Baykalda yashaydi?", opts: ["Qutb ayig'i", "Chuchuk suv tyuleni (nerpa)", "Silovsi", "Qo'ng'iroqli bo'ri"], c: 1 }
        ]
    },
];
let prIdx = 0;

function initPracticeReading() {
    const rd = PRTexts[prIdx % PRTexts.length];
    const tb = document.getElementById('readingTextBox'); const rq = document.getElementById('readingQuestions');
    if (!tb || !rq) return;
    tb.innerHTML = `<h3>${rd.title}</h3><p>${rd.text}</p>`;
    rq.innerHTML = rd.qs.map((q, qi) => `<div class="rq-card">
    <div class="rq-q">${qi + 1}. ${q.q}</div>
    <div class="rq-opts">${q.opts.map((o, oi) => `<div class="rq-opt" data-qi="${qi}" data-oi="${oi}" onclick="selPRQ(this,${qi},${oi})">${String.fromCharCode(65 + oi)}. ${o}</div>`).join('')}</div>
    <div class="gex-fb" id="prqfb${qi}"></div>
  </div>`).join('');
    window.__prCurrent = rd; window.__prSel = {};
}

window.selPRQ = function (el, qi, oi) {
    document.querySelectorAll(`.rq-opt[data-qi="${qi}"]`).forEach(o => o.classList.remove('selected'));
    el.classList.add('selected'); if (!window.__prSel) window.__prSel = {}; window.__prSel[qi] = oi;
};

window.checkReading = async function () {
    const rd = window.__prCurrent; if (!rd) return;
    const fb = document.getElementById('readingFeedback'); let ok = 0;
    rd.qs.forEach((q, qi) => {
        const qfb = document.getElementById(`prqfb${qi}`); const sel = window.__prSel?.[qi];
        document.querySelectorAll(`.rq-opt[data-qi="${qi}"]`).forEach((o, i) => { if (i === q.c) o.classList.add('rq-correct'); else if (sel !== undefined && i === sel && i !== q.c) o.classList.add('rq-wrong'); });
        if (sel === q.c) { ok++; if (qfb) { qfb.className = 'gex-fb correct'; qfb.innerHTML = "✅ To'g'ri!"; } }
        else if (sel !== undefined && qfb) { qfb.className = 'gex-fb wrong'; qfb.innerHTML = `❌ To'g'ri: <strong>${String.fromCharCode(65 + q.c)}</strong>`; }
    });
    if (fb) { const pct = Math.round((ok / rd.qs.length) * 100); fb.className = `feedback-box ${pct >= 60 ? 'success' : 'error'} show`; fb.innerHTML = `${pct >= 60 ? '🏆' : '💪'} ${ok}/${rd.qs.length} — ${pct}%`; }
    if (ok >= 2) awardXP(20, 'reading');
    await savePracticeResult('reading', ok, rd.qs.length, { title: rd.title, type: 'practice_panel' });
};

window.nextReading = function () { prIdx++; initPracticeReading(); const fb = document.getElementById('readingFeedback'); if (fb) { fb.className = 'feedback-box'; fb.innerHTML = ''; } };

// ── AMALIYOT WRITING — RUSCHA TOPSHIRIQLAR ──
const PWPrompts = [
    "Sevimli shahringizni ruscha tasvirlab bering. U qanday? Qanday joylari bor?",
    "Sizningcha, ijtimoiy tarmoqlar jamiyatga ijobiy yoki salbiy ta'sir ko'rsatadimi? Ruscha yozing.",
    "Yodda qolgan bir sayohatingizni ruscha tasvirlab bering.",
    "Ba'zilar bolalar ko'proq o'qishi kerak deb hisoblaydi. Siz qanday fikrdasiz? Ruscha yozing.",
    "Tarixdagi eng muhim kashfiyotni ruscha tushuntiring va nima uchun muhimligini yozing.",
];
let pwIdx = 0;

function initPracticeWriting() {
    const wp = document.getElementById('writingPrompt'); if (!wp) return;
    wp.innerHTML = `<strong>📌 Ruscha Yozuv Mavzusi:</strong> ${PWPrompts[pwIdx % PWPrompts.length]}`;
    window.__pwPrompt = PWPrompts[pwIdx % PWPrompts.length];
}

window.analyzeWriting = async function () {
    if (!canAI()) { showUpgradeModal('AI limit tugadi!'); return; }
    const ta = document.getElementById('writingTextarea'); const fb = document.getElementById('writingFeedback');
    if (!ta?.value.trim()) { if (fb) { fb.className = 'feedback-box error show'; fb.innerHTML = 'Avval ruscha yozing!'; } return; }
    fb.className = 'feedback-box info show'; fb.innerHTML = '🤖 AI tekshirmoqda...';
    UL.ai_used_today++; saveLimits();
    const r = await callAI(`Ruscha yozuvni tekshir. Mavzu: "${window.__pwPrompt || 'Umumiy'}"\nMatn: "${ta.value.trim()}"\nO'zbek tilida:\n1. ✅ Grammatika xatoliklari\n2. 📝 Tuzilish\n3. 📚 Leksik resurs\n4. 🔄 Tuzatilgan ruscha variant\n5. ⭐ Ruscha yozuv bali: /10`, 900);
    fb.className = 'feedback-box info show'; fb.innerHTML = r.replace(/\n/g, '<br>'); awardXP(25, 'writing');
    const wc = ta.value.trim().split(/\s+/).length;
    await savePracticeResult('writing', wc >= 80 ? 1 : 0, 1, { prompt: window.__pwPrompt, wordCount: wc, type: 'practice_panel' });
};

window.nextWriting = function () {
    pwIdx++; initPracticeWriting();
    const ta = document.getElementById('writingTextarea'); if (ta) ta.value = '';
    const fb = document.getElementById('writingFeedback'); if (fb) { fb.className = 'feedback-box'; fb.innerHTML = ''; }
    const wc = document.getElementById('wordCount'); if (wc) wc.textContent = "0 so'z";
};

// ── AMALIYOT GRAMMATIKA — RUSCHA ──
const PGEx = [
    { q: "Она ___ в школу каждый день.", opts: ["идти", "идёт", "идут", "иду"], c: 1, exp: "Она → 3-shaxs birlik → идёт (II spryazheniye)" },
    { q: "Я ___ в Ташкенте уже пять лет.", opts: ["живу", "живёт", "живём", "живут"], c: 0, exp: "Я → 1-shaxs birlik → живу" },
    { q: "Вчера он ___ интересную книгу.", opts: ["читал", "читает", "будет читать", "читать"], c: 0, exp: "Вчера = o'tgan zamon → читал (erkak, birlik)" },
    { q: "Если бы у меня ___ время, я бы пришёл.", opts: ["есть", "было", "будет", "был"], c: 1, exp: "Сослагательное наклонение (xayoliy shart): было bы" },
    { q: "Книга, ___ я читаю, очень интересная.", opts: ["которая", "которого", "которую", "который"], c: 2, exp: "Книга (urg'ochi jins) + Vinitelny = которую" },
    { q: "Мне нравится ___ музыку.", opts: ["слушать", "слушаю", "слушал", "слушает"], c: 0, exp: "Нравится + infinitiv: нравится слушать" },
    { q: "Завтра мы ___ в кино.", opts: ["идём", "пойдём", "шли", "идут"], c: 1, exp: "Завтра = kelajak → пойдём (совершенный вид, 1-shaxs ko'plik)" },
    { q: "Этот дом ___ в прошлом году.", opts: ["строил", "построили", "строят", "построит"], c: 1, exp: "Passiv ma'no: дом построили (ular qurdi) — o'tgan zamon" },
    { q: "Она говорит ___ русски очень хорошо.", opts: ["в", "на", "по", "за"], c: 2, exp: "Говорить по-русски — предлог по + язык" },
    { q: "У меня ___ новая машина.", opts: ["есть", "иметь", "имею", "быть"], c: 0, exp: "Egalik: У меня есть + ot (rod.padeж uchun emas, bu hozirgi zamon)" },
];
let pgIdx = 0;

function initPracticeGrammar() {
    const ex = PGEx[pgIdx % PGEx.length];
    const qbox = document.getElementById('grammarQBox'); const opts = document.getElementById('grammarOptions'); const expl = document.getElementById('grammarExplanation');
    if (!qbox || !opts) return;
    qbox.innerHTML = `<div class="gq-q">${ex.q}</div>`;
    opts.innerHTML = ex.opts.map((o, i) => `<div class="gq-opt" data-i="${i}" onclick="selGQ(this,${i})">${String.fromCharCode(65 + i)}. ${o}</div>`).join('');
    if (expl) { expl.className = 'grammar-explanation'; expl.innerHTML = ''; }
    window.__pgCurrent = ex; window.__pgSel = -1;
}

window.selGQ = function (el, i) {
    document.querySelectorAll('.gq-opt').forEach(o => o.classList.remove('selected'));
    el.classList.add('selected'); window.__pgSel = i;
};

window.checkGrammar = async function () {
    const ex = window.__pgCurrent; if (!ex) return;
    const fb = document.getElementById('grammarFeedback'); const expl = document.getElementById('grammarExplanation');
    const sel = window.__pgSel;
    if (sel < 0) { if (fb) { fb.className = 'feedback-box error show'; fb.innerHTML = '⚠️ Javob tanlang!'; } return; }
    document.querySelectorAll('.gq-opt').forEach((o, i) => { if (i === ex.c) o.classList.add('gq-correct'); else if (i === sel && sel !== ex.c) o.classList.add('gq-wrong'); });
    const correct = sel === ex.c;
    if (correct) {
        if (fb) { fb.className = 'feedback-box success show'; fb.innerHTML = "✅ To'g'ri! Ruscha grammatika ustasiz!"; }
        if (expl) { expl.className = 'grammar-explanation show'; expl.innerHTML = `💡 Izoh: ${ex.exp}`; }
        awardXP(15, 'grammar');
    } else {
        if (fb) { fb.className = 'feedback-box error show'; fb.innerHTML = `❌ Noto'g'ri. To'g'ri: <strong>${String.fromCharCode(65 + ex.c)}</strong>`; }
        if (expl) { expl.className = 'grammar-explanation show'; expl.innerHTML = `💡 Izoh: ${ex.exp}`; }
    }
    await savePracticeResult('grammar', correct ? 1 : 0, 1, { question: ex.q, correct, type: 'practice_panel' });
};

window.nextGrammar = function () { pgIdx++; initPracticeGrammar(); const fb = document.getElementById('grammarFeedback'); if (fb) { fb.className = 'feedback-box'; fb.innerHTML = ''; } };

// ── AMALIYOT POSTCARD — RUSCHA ──
let pcTopic = 'travel';
function initPracticePostcard() {
    const el = document.getElementById('postcardImageArea');
    if (el) el.innerHTML = '<span>📸 Rasm joyi</span>';
}

window.selectPostcardTopic = function (t) {
    pcTopic = t;
    document.querySelectorAll('.ptopic-btn').forEach(b => b.classList.remove('active'));
    event.target.classList.add('active');
    const ta = document.getElementById('postcardText'); if (ta) ta.value = '';
};

// ✅ RUSCHA POSTCARD YOZISH
window.aiWritePostcard = async function () {
    if (!canAI()) { showUpgradeModal('AI limit tugadi!'); return; }
    const fb = document.getElementById('postcardFeedback');
    if (fb) { fb.className = 'feedback-box info show'; fb.innerHTML = '🤖 AI ruscha yozmoqda...'; }
    UL.ai_used_today++; saveLimits();
    const topics = { travel: "Sayohat", holiday: "Bayram", birthday: "Tug'ilgan kun", friendship: "Do'stlik" };
    const r = await callAI(`Ruscha postcard yoz. Mavzu: "${topics[pcTopic] || pcTopic}". 80-100 so'z. Samimiy, ijodiy va to'g'ri ruscha grammatikada yoz. Oxirida imzo qo'y. Faqat ruscha yoz!`, 400);
    const ta = document.getElementById('postcardText'); if (ta) ta.value = r;
    if (fb) { fb.className = 'feedback-box success show'; fb.innerHTML = '✅ AI ruscha postcard yozdi! Tahrirlashingiz mumkin.'; }
};

// ✅ RUSCHA POSTCARD TEKSHIRISH
window.aiCheckPostcard = async function () {
    if (!canAI()) { showUpgradeModal('AI limit tugadi!'); return; }
    const ta = document.getElementById('postcardText'); const fb = document.getElementById('postcardFeedback');
    if (!ta?.value.trim()) { if (fb) { fb.className = 'feedback-box error show'; fb.innerHTML = 'Avval ruscha postcard yozing!'; } return; }
    fb.className = 'feedback-box info show'; fb.innerHTML = '🤖 AI ruscha tekshirmoqda...';
    UL.ai_used_today++; saveLimits();
    const r = await callAI(`Ruscha postcard matnini tekshir: "${ta.value.trim()}". O'zbek tilida: 1) Grammatika xatoliklari 2) Uslub 3) Tuzatilgan ruscha variant 4) Ball /10`, 600);
    fb.className = 'feedback-box info show'; fb.innerHTML = r.replace(/\n/g, '<br>');
    await savePracticeResult('writing', 1, 1, { type: 'postcard', topic: pcTopic });
};

// ── YOUTUBE VIDEOLAR ──
window.findYoutubeVideos = async function () {
    if (!canAI()) { showUpgradeModal('AI limit tugadi!'); return; }
    const grid = document.getElementById('videosGrid');
    if (grid) grid.innerHTML = '<div class="video-placeholder"><p>🤖 Ruscha videolar qidirilmoqda...</p></div>';
    UL.ai_used_today++; saveLimits();
    const weakSk = Object.entries(USk).sort((a, b) => a[1] - b[1])[0][0];
    const cnt = UP === 'universal' ? 9 : UP === 'team' ? 6 : 4;
    const r = await callAI(`Suggest ${cnt} YouTube Russian language learning videos for level: ${curLevel}, weak skill: ${weakSk}. Respond ONLY as JSON array: [{"title":"Video Title","channel":"Channel Name","skill":"skill","query":"youtube search query","emoji":"🎯","description":"2 sentence Uzbek description"}]. Use channels: Russian with Max, RussianPod101, Ru-Land Club, Russian Language Club, Learn Russian with Alfia.`, 800);
    try {
        const clean = r.replace(/```json|```/g, '').trim();
        const vids = JSON.parse(clean);
        if (grid) grid.innerHTML = vids.map(v => `<div class="video-card" onclick="window.open('https://www.youtube.com/results?search_query=${encodeURIComponent(v.query)}','_blank')">
      <div class="video-thumb">${v.emoji}</div>
      <div class="video-info">
        <div class="video-title">${v.title}</div>
        <div class="video-channel">▶ ${v.channel}</div>
        <div class="video-desc">${v.description}</div>
        <div class="video-tags"><span>${v.skill}</span><span>${curLevel}</span></div>
      </div>
    </div>`).join('');
    } catch (e) { if (grid) grid.innerHTML = '<div class="video-placeholder"><p>❌ Videolar topilmadi. Qayta urining.</p></div>'; }
};

// ════════════════════════════════════════
// AI CHAT
// ════════════════════════════════════════
async function loadAndRenderChatHistory() {
    const msgs = document.getElementById('chatMessages');
    if (!msgs) return;
    msgs.innerHTML = '<div class="chat-msg ai-msg"><div class="chat-avatar">🤖</div><div class="chat-bubble typing"><span></span><span></span><span></span></div></div>';
    try {
        const history = await loadChatHistory(20);
        msgs.innerHTML = '';
        if (history.length === 0) {
            addChatMsg('ai', "Salom! Men sizning <strong>rus tili</strong> o'qituvchingizman 🎓\n\nHozir <strong>Erkin suhbat</strong> rejimidamiz.\nRuscha yozish, grammatika, tarjima yoki erkin suhbat — hammasi mumkin! 😊");
        } else {
            history.forEach(m => { addChatMsgRaw(m.role, m.text); });
            chatHist = history.slice(-10).map(m => ({
                role: m.role === 'ai' ? 'model' : 'user',
                parts: [{ text: m.text }]
            }));
            addChatMsg('ai', `✅ Oldingi suhbatingiz yuklandi (${history.length} xabar). Davom etamizmi?`);
        }
    } catch (e) {
        msgs.innerHTML = '';
        addChatMsg('ai', "Salom! Men sizning rus tili o'qituvchingizman 🎓\nNima haqida suhbatlashamiz? 😊");
    }
}

window._setChatMode = function (mode, el) {
    chatMode = mode;
    document.querySelectorAll('.chat-mode-btn').forEach(b => b.classList.remove('active'));
    el.classList.add('active');
    const msgs = {
        free: "Salom! Erkin suhbat rejimi. Ruscha yoki o'zbekcha yozing! 😊",
        teacher: "Salom! Men sizning rus tili o'qituvchingizman. Nima o'rganmoqchisiz? 👨‍🏫",
        grammar: "Ruscha grammatika rejimi! Ruscha jumla yozing — xatoliklarni tuzataman. ✏️",
        translate: "Tarjimon rejimi. O'zbekcha ↔ Ruscha. 🌐",
        ielts: "TORFL/Rus tili imtihon tayyorlik rejimi! Yozuv, gapirish, tinglash, o'qish — hammasi bo'yicha yordam beraman. 📋"
    };
    const text = msgs[mode] || 'Salom!';
    addChatMsg('ai', text);
    saveChatMessage('ai', text, mode);
};

window._handleChatKey = function (e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); window._sendChatMessage(); } };

window._sendChatMessage = async function () {
    if (!canAI()) { showUpgradeModal('AI chat limiti tugadi!'); return; }
    const inp = document.getElementById('chatInput'); const text = inp?.value.trim(); if (!text) return;
    inp.value = '';
    addChatMsg('user', text);
    await saveChatMessage('user', text, chatMode);
    const tid = addTyping(); UL.ai_used_today++; saveLimits(); renderLimitBar();
    chatHist.push({ role: 'user', parts: [{ text }] });
    const sysPs = {
        free: `Siz O'zbek tilida so'zlashadigan o'quvchilar uchun do'stona rus tili o'qituvchisisiz. Tushuntirishlarda o'zbek tilidan foydalaning, misollarda ruscha. Joriy daraja: ${curLevel}. Qo'llab-quvvatlang va amaliy bo'ling.`,
        teacher: `Siz O'zbek talabalari uchun mutaxassis rus tili o'qituvchisisiz. Misollar, qoidalar va mashqlar bilan tizimli o'rgating. Daraja: ${curLevel}.`,
        grammar: `Siz ruscha grammatika mutaxassisisiz. Ruscha matn berilganda BARCHA xatoliklarni toping, har birini o'zbek tilida tushuntiring, tuzatma va aniq qoida bering.`,
        translate: `Siz tarjimonsiz. O'zbek tili va rus tili o'rtasida tarjima qiling. Nuanslarni, kollokatsiyalarni va madaniy izohlarni ham tushuntiring.`,
        ielts: `Siz TORFL va rus tili imtihoni bo'yicha mutaxassississiz. To'rtta ko'nikma bo'yicha yordam bering. Yozma ishlarni rasmiy TORFL mezonlari bo'yicha baholang.`
    };
    try {
        const res = await callAIChat(chatHist, (sysPs[chatMode] || sysPs.free) + '\nFoydalanuvchi xabari: ' + text);
        rmTyping(tid);
        addChatMsg('ai', res);
        await saveChatMessage('ai', res, chatMode);
        chatHist.push({ role: 'model', parts: [{ text: res }] });
        if (chatHist.length > 20) chatHist = chatHist.slice(-20);
    } catch (e) { rmTyping(tid); addChatMsg('ai', '❗ Xatolik yuz berdi. Qayta urining.'); }
};

window._insertQuickPhrase = function (p) { const i = document.getElementById('chatInput'); if (i) { i.value = p; i.focus(); } };

// ✅ RUSCHA VOICE CHAT — ru-RU
window._startVoiceChat = function () {
    const btn = document.getElementById('voiceChatBtn');
    if (UP === 'free' || UP === 'own') { showToast('🎤 Ovozli chat Team va Universal rejasida!', 'error'); return; }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { showToast('Mikrofon bu brauzerda ishlamaydi', 'error'); return; }
    if (!vcRec) {
        const rec = new SR();
        rec.lang = 'ru-RU'; // ✅ RUSCHA
        rec.interimResults = false;
        rec.onresult = e => { const t = e.results[0][0].transcript; const i = document.getElementById('chatInput'); if (i) i.value = t; window._sendChatMessage(); };
        rec.onerror = () => { vcRec = false; btn?.classList.remove('active'); };
        rec.onend = () => { vcRec = false; btn?.classList.remove('active'); };
        try { rec.start(); vcRec = true; btn?.classList.add('active'); showToast('🎤 Ruscha gapiring...', 'info'); }
        catch (e) { showToast('Mikrofon ishlamadi', 'error'); }
    } else { vcRec = false; btn?.classList.remove('active'); }
};

window.clearChatHistory = async function () {
    if (!CU) return;
    if (!confirm("Suhbat tarixini o'chirmoqchimisiz?")) return;
    try {
        const chatRef = collection(db, 'users', CU.uid, 'chatHistory');
        const q = query(chatRef, orderBy('createdAt'));
        const snap = await getDocs(q);
        const deletions = snap.docs.map(d => deleteDoc(doc(db, 'users', CU.uid, 'chatHistory', d.id)));
        await Promise.all(deletions);
        chatHist = [];
        const msgs = document.getElementById('chatMessages');
        if (msgs) msgs.innerHTML = '';
        addChatMsg('ai', "Suhbat tarixi tozalandi! Yangi rus tili darsini boshlaylik 😊");
        showToast("✅ Suhbat tarixi o'chirildi", 'success');
    } catch (e) {
        showToast('❌ Xatolik yuz berdi', 'error');
    }
};

function addChatMsg(role, text) {
    const msgs = document.getElementById('chatMessages'); if (!msgs) return;
    const div = document.createElement('div'); div.className = `chat-msg ${role}-msg`;
    const init = (CU?.displayName || CU?.email || 'U').charAt(0).toUpperCase();
    div.innerHTML = `<div class="chat-avatar">${role === 'ai' ? '🤖' : init}</div><div class="chat-bubble">${text.replace(/\n/g, '<br>').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')}</div>`;
    msgs.appendChild(div); msgs.scrollTop = msgs.scrollHeight;
}

function addChatMsgRaw(role, text) {
    const msgs = document.getElementById('chatMessages'); if (!msgs) return;
    const div = document.createElement('div'); div.className = `chat-msg ${role}-msg`;
    const init = (CU?.displayName || CU?.email || 'U').charAt(0).toUpperCase();
    div.innerHTML = `<div class="chat-avatar">${role === 'ai' ? '🤖' : init}</div><div class="chat-bubble">${text.replace(/\n/g, '<br>').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')}</div>`;
    msgs.appendChild(div); msgs.scrollTop = msgs.scrollHeight;
}

function addTyping() {
    const msgs = document.getElementById('chatMessages'); if (!msgs) return '';
    const id = 'typ' + Date.now(); const div = document.createElement('div'); div.className = 'chat-msg ai-msg'; div.id = id;
    div.innerHTML = '<div class="chat-avatar">🤖</div><div class="chat-bubble typing"><span></span><span></span><span></span></div>';
    msgs.appendChild(div); msgs.scrollTop = msgs.scrollHeight; return id;
}
function rmTyping(id) { document.getElementById(id)?.remove(); }

// ── RADAR GRAFIGI ──
function drawRadar() {
    const canvas = document.getElementById('radarCanvas'); if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const cx = 110, cy = 110, r = 85;
    const skills = ['reading', 'writing', 'speaking', 'listening', 'grammar'];
    const vals = skills.map(s => (USk[s] || 0) / 100);
    const angs = skills.map((_, i) => (i * 2 * Math.PI / 5) - Math.PI / 2);
    ctx.clearRect(0, 0, 220, 220);
    [.2, .4, .6, .8, 1].forEach(p => { ctx.beginPath(); angs.forEach((a, i) => { const x = cx + r * p * Math.cos(a), y = cy + r * p * Math.sin(a); i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); }); ctx.closePath(); ctx.strokeStyle = 'rgba(255,255,255,0.07)'; ctx.lineWidth = 1; ctx.stroke(); });
    angs.forEach(a => { ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + r * Math.cos(a), cy + r * Math.sin(a)); ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.stroke(); });
    ctx.beginPath(); angs.forEach((a, i) => { const x = cx + r * vals[i] * Math.cos(a), y = cy + r * vals[i] * Math.sin(a); i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); }); ctx.closePath();
    ctx.fillStyle = 'rgba(79,110,247,0.25)'; ctx.fill(); ctx.strokeStyle = '#4f6ef7'; ctx.lineWidth = 2; ctx.stroke();
    angs.forEach((a, i) => { const x = cx + r * vals[i] * Math.cos(a), y = cy + r * vals[i] * Math.sin(a); ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.fillStyle = '#4f6ef7'; ctx.fill(); });
}

// ── XP ──
async function awardXP(amt, skill) {
    const b = plan().xb || 1; const tot = Math.round(amt * b); if (!CU) return;
    try {
        USk[skill] = Math.min(100, (USk[skill] || 0) + 2);
        await updateDoc(doc(db, 'users', CU.uid), {
            xp: increment(tot),
            [`skills.${skill}`]: USk[skill],
            lastActive: serverTimestamp()
        });
        drawRadar(); showXPPop(`+${tot} XP`);
    } catch (e) { }
}

// ── UTILS ──
// ✅ RUSCHA TTS — spk funksiyasi
window.spk = function (word, e) {
    if (e) e.stopPropagation();
    const u = new SpeechSynthesisUtterance(word);
    u.lang = 'ru-RU'; // ✅ RUSCHA OVOZ
    u.rate = 0.85;
    speechSynthesis.speak(u);
};
window.speakWord = window.spk;

window.showToast = function (msg, type = 'info') { const t = document.getElementById('toast'); if (!t) return; t.innerHTML = msg; t.className = `toast ${type} show`; setTimeout(() => t.classList.remove('show'), 3000); };
function showXPPop(txt) { const e = document.getElementById('xpPopup'); if (!e) return; e.textContent = txt; e.classList.add('show'); setTimeout(() => e.classList.remove('show'), 2500); }

window.showUpgradeModal = function (txt) {
    const el = document.getElementById('upgradeModalText'); if (el) el.textContent = txt;
    const rt = UP !== 'universal' ? new Date((UL.last_reset || Date.now()) + (plan().rh || 4) * 3600000) : null;
    const te = document.getElementById('upgradeTimer');
    if (rt && te) { if (upTimer) clearInterval(upTimer); upTimer = setInterval(() => { const d = Math.max(0, rt.getTime() - Date.now()); const h = Math.floor(d / 3600000), m = Math.floor((d % 3600000) / 60000), s = Math.floor((d % 60000) / 1000); te.textContent = `⏱ ${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`; if (d === 0) clearInterval(upTimer); }, 1000); }
    document.getElementById('upgradeModal')?.classList.add('open');
};

window.closeUpgradeModal = function (e) { if (e && e.target !== document.getElementById('upgradeModal')) return; if (upTimer) clearInterval(upTimer); document.getElementById('upgradeModal')?.classList.remove('open'); };
window.closeModal = function () { document.getElementById('unitModal')?.classList.remove('open'); };
window.closeUnitModal = function (e) { if (e.target.id === 'unitModal') closeModal(); };

function initWritingCounter() {
    const ta = document.getElementById('writingTextarea'); if (!ta) return;
    ta.addEventListener('input', () => {
        const t = ta.value.trim(); const w = t ? t.split(/\s+/).length : 0;
        const wc = document.getElementById('wordCount'); const cc = document.getElementById('charCount');
        if (wc) wc.textContent = w + " so'z";
        if (cc) cc.textContent = ta.value.length + ' belgi';
    });
}

// ── FIREBASE AUTH ──
onAuthStateChanged(auth, async (user) => {
    CU = user;
    if (user) {
        await loadUD();
        renderNav();
        renderLimitBar();
        await initAll();
    } else {
        renderNav();
        renderLimitBar();
        await initAll();
    }
});