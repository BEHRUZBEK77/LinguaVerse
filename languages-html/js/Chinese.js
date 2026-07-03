// =====================================================
// Chinese.js — SpeakVerse (Xitoy tili kursi)
// English.js asosida qurilgan — 100% Xitoy tili
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
const NATIVE_LANG = ({ uz: "Uzbek", en: "English", ru: "Russian", es: "Spanish", de: "German", tr: "Turkish", ar: "Arabic", ko: "Korean", zh: "Chinese" })[localStorage.getItem('lv_lang') || 'uz'] || "Uzbek";
const LANG_RULES = `\n\nIMPORTANT OVERRIDE: The student's native language is ${NATIVE_LANG}. Speak PRIMARILY in the language being taught on this page — practice must happen in the target language itself. Use ${NATIVE_LANG} ONLY for short translations and explanations of mistakes. NEVER reply fully in ${NATIVE_LANG}.\nQUALITY BAR: teach at professional exam-preparation level (IELTS/Goethe/DELE/TOPIK/HSK-equivalent): authentic natural language, precise corrections referencing grammar rules, exam-style feedback on fluency, vocabulary range and accuracy. Push the student slightly above their current level.`;


// ══════════════════════════════════════════════════
// CONFIG
// ══════════════════════════════════════════════════
const TOKEN_CONFIG = {
    default_tokens: 1000,
    reset_hours: 5,
    ai_cost: 1,
    unit_cost: 2
};

const PLANS = {
    free: { name: "Free", icon: "🆓", token_bonus: 1000, token_reset_mult: 1, xp_mult: 1, coin_mult: 1 },
    pro: { name: "Pro", icon: "⭐", token_bonus: 3000, token_reset_mult: 2, xp_mult: 1.5, coin_mult: 1.3 },
    premium: { name: "Premium", icon: "💎", token_bonus: 8000, token_reset_mult: 3, xp_mult: 2, coin_mult: 1.8 },
    ultimate: { name: "Ultimate", icon: "🚀", token_bonus: 999999, token_reset_mult: 999, xp_mult: 3, coin_mult: 2.5 }
};

const RANKS = {
    none: { name: "Oddiy", icon: "⬜", color: "#888", token_bonus: 0, xp_mult: 1, coin_mult: 1 },
    silver: { name: "Silver", icon: "🥈", color: "#C0C0C0", token_bonus: 200, xp_mult: 1.3, coin_mult: 1.2 },
    gold: { name: "Gold", icon: "🥇", color: "#FFD700", token_bonus: 500, xp_mult: 1.8, coin_mult: 1.5 },
    diamond: { name: "Diamond", icon: "💎", color: "#B9F2FF", token_bonus: 1000, xp_mult: 2.5, coin_mult: 2 }
};

const PLAN_COLORS = { free: "#94a3b8", basic: "#60a5fa", starter: "#60a5fa", premium: "#a78bfa", ultimate: "#f5c842", vip: "#f5c842" };
const PLAN_LABELS = { free: "Bepul", basic: "Basic", starter: "Starter", premium: "Premium", ultimate: "Ultimate", vip: "VIP" };

// ══════════════════════════════════════════════════
// STATE
// ══════════════════════════════════════════════════
let CU = null;
let UP = 'free';
let UTokens = 1000, UMaxTokens = 1000, ULastReset = 0;
let UXP = 0, UCoin = 0, URank = 'none';
let UProg = {};
let USk = { reading: 0, writing: 0, speaking: 0, listening: 0, grammar: 0 };
let UStats = { unitsCompleted: 0, totalSessions: 0, streak: 0, totalXP: 0, totalCoins: 0 };

let chatHist = [];
let chatMode = 'free';
let curChatModeObj = null;
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

// ══════════════════════════════════════════════════
// SO'ZLAR MA'LUMOTLAR BAZASI (500+ so'z, xitoycha)
// ch = xitoycha (hanszi), py = pinyin, uz = o'zbek
// ══════════════════════════════════════════════════
const WDB = [
    // ─── BEGINNER ───
    { e: "你好", ch: "你好", py: "nǐ hǎo", uz: "Salom", t: "感叹词", l: "beginner", ex: "你好！很高兴认识你。", eu: "Salom! Sizni tanishganimdan xursandman." },
    { e: "再见", ch: "再见", py: "zài jiàn", uz: "Xayr", t: "感叹词", l: "beginner", ex: "再见，明天见！", eu: "Xayr, ertaga ko'rishamiz!" },
    { e: "谢谢", ch: "谢谢", py: "xiè xie", uz: "Rahmat", t: "词组", l: "beginner", ex: "谢谢你的帮助。", eu: "Yordamingiz uchun rahmat." },
    { e: "请", ch: "请", py: "qǐng", uz: "Iltimos", t: "副词", l: "beginner", ex: "请坐。", eu: "Iltimos o'tiring." },
    { e: "对不起", ch: "对不起", py: "duì bu qǐ", uz: "Kechirasiz", t: "词组", l: "beginner", ex: "对不起，我来晚了。", eu: "Kech qolganimdan kechirasiz." },
    { e: "是", ch: "是", py: "shì", uz: "Ha / Bu ... (dir)", t: "动词", l: "beginner", ex: "我是学生。", eu: "Men talabaman." },
    { e: "不", ch: "不", py: "bù", uz: "Yo'q / Emas", t: "副词", l: "beginner", ex: "我不吃肉。", eu: "Men go'sht yemayman." },
    { e: "好", ch: "好", py: "hǎo", uz: "Yaxshi", t: "形容词", l: "beginner", ex: "这个苹果很好。", eu: "Bu olma juda yaxshi." },
    { e: "大", ch: "大", py: "dà", uz: "Katta", t: "形容词", l: "beginner", ex: "这是一个大房子。", eu: "Bu katta uy." },
    { e: "小", ch: "小", py: "xiǎo", uz: "Kichik", t: "形容词", l: "beginner", ex: "我有一只小猫。", eu: "Menda kichik mushuk bor." },
    { e: "高兴", ch: "高兴", py: "gāo xìng", uz: "Xursand", t: "形容词", l: "beginner", ex: "我今天很高兴！", eu: "Bugun juda xursandman!" },
    { e: "热", ch: "热", py: "rè", uz: "Issiq", t: "形容词", l: "beginner", ex: "今天天气很热。", eu: "Bugun havo juda issiq." },
    { e: "冷", ch: "冷", py: "lěng", uz: "Sovuq", t: "形容词", l: "beginner", ex: "水很冷。", eu: "Suv sovuq." },
    { e: "红色", ch: "红色", py: "hóng sè", uz: "Qizil rang", t: "名词", l: "beginner", ex: "我喜欢红色的苹果。", eu: "Qizil olmalarni yaxshi ko'raman." },
    { e: "蓝色", ch: "蓝色", py: "lán sè", uz: "Ko'k rang", t: "名词", l: "beginner", ex: "天空是蓝色的。", eu: "Osmon ko'k." },
    { e: "绿色", ch: "绿色", py: "lǜ sè", uz: "Yashil rang", t: "名词", l: "beginner", ex: "草是绿色的。", eu: "O't yashil." },
    { e: "黄色", ch: "黄色", py: "huáng sè", uz: "Sariq rang", t: "名词", l: "beginner", ex: "太阳是黄色的。", eu: "Quyosh sariq." },
    { e: "黑色", ch: "黑色", py: "hēi sè", uz: "Qora rang", t: "名词", l: "beginner", ex: "我的猫是黑色的。", eu: "Mening mushugim qora." },
    { e: "白色", ch: "白色", py: "bái sè", uz: "Oq rang", t: "名词", l: "beginner", ex: "雪是白色的。", eu: "Qor oq." },
    { e: "一", ch: "一", py: "yī", uz: "Bir", t: "数词", l: "beginner", ex: "我有一个妹妹。", eu: "Menda bir singil bor." },
    { e: "二", ch: "二", py: "èr", uz: "Ikki", t: "数词", l: "beginner", ex: "我有两只猫。", eu: "Menda ikki mushuk bor." },
    { e: "三", ch: "三", py: "sān", uz: "Uch", t: "数词", l: "beginner", ex: "她有三本书。", eu: "Uning uch kitobi bor." },
    { e: "四", ch: "四", py: "sì", uz: "To'rt", t: "数词", l: "beginner", ex: "一年有四个季节。", eu: "Bir yilda to'rtta fasl bor." },
    { e: "五", ch: "五", py: "wǔ", uz: "Besh", t: "数词", l: "beginner", ex: "我有五根手指。", eu: "Menda besh barmoq bor." },
    { e: "妈妈", ch: "妈妈", py: "māma", uz: "Ona", t: "名词", l: "beginner", ex: "我妈妈是老师。", eu: "Onam o'qituvchi." },
    { e: "爸爸", ch: "爸爸", py: "bàba", uz: "Ota", t: "名词", l: "beginner", ex: "爸爸努力工作。", eu: "Otam qattiq ishlaydi." },
    { e: "妹妹", ch: "妹妹", py: "mèimei", uz: "Singil", t: "名词", l: "beginner", ex: "我妹妹十岁了。", eu: "Singlim 10 yoshda." },
    { e: "哥哥", ch: "哥哥", py: "gēge", uz: "Aka", t: "名词", l: "beginner", ex: "我哥哥喜欢足球。", eu: "Akam futbolni yaxshi ko'radi." },
    { e: "水", ch: "水", py: "shuǐ", uz: "Suv", t: "名词", l: "beginner", ex: "请给我一杯水。", eu: "Iltimos, menga bir stakan suv bering." },
    { e: "饭", ch: "饭", py: "fàn", uz: "Ovqat / Guruch", t: "名词", l: "beginner", ex: "我们一起吃饭吧。", eu: "Keling birga ovqatlanalSak." },
    { e: "苹果", ch: "苹果", py: "píngguǒ", uz: "Olma", t: "名词", l: "beginner", ex: "我每天吃一个苹果。", eu: "Men har kuni bitta olma yeyman." },
    { e: "面包", ch: "面包", py: "miànbāo", uz: "Non", t: "名词", l: "beginner", ex: "她烤了新鲜的面包。", eu: "U yangi non yopdi." },
    { e: "学校", ch: "学校", py: "xuéxiào", uz: "Maktab", t: "名词", l: "beginner", ex: "我每天去学校。", eu: "Men har kuni maktabga boraman." },
    { e: "书", ch: "书", py: "shū", uz: "Kitob", t: "名词", l: "beginner", ex: "这是一本有趣的书。", eu: "Bu qiziqarli kitob." },
    { e: "狗", ch: "狗", py: "gǒu", uz: "It", t: "名词", l: "beginner", ex: "我有一只友善的狗。", eu: "Menda mehribon it bor." },
    { e: "猫", ch: "猫", py: "māo", uz: "Mushuk", t: "名词", l: "beginner", ex: "猫在睡觉。", eu: "Mushuk uxlayapti." },
    { e: "家", ch: "家", py: "jiā", uz: "Uy / Oila", t: "名词", l: "beginner", ex: "我住在一个大家里。", eu: "Men katta uyda yashayman." },
    { e: "车", ch: "车", py: "chē", uz: "Avtomobil", t: "名词", l: "beginner", ex: "爸爸有一辆红色的车。", eu: "Otamning qizil mashinasi bor." },
    { e: "跑步", ch: "跑步", py: "pǎo bù", uz: "Yugurmaq", t: "动词", l: "beginner", ex: "她每天早上跑步。", eu: "U har ertalab yuguradi." },
    { e: "吃", ch: "吃", py: "chī", uz: "Yemoq", t: "动词", l: "beginner", ex: "我们七点吃晚饭。", eu: "Biz soat 7 da kechki ovqat yeymiz." },
    { e: "喝", ch: "喝", py: "hē", uz: "Ichmoq", t: "动词", l: "beginner", ex: "他喝咖啡。", eu: "U qahva ichadi." },
    { e: "睡觉", ch: "睡觉", py: "shuì jiào", uz: "Uxlamoq", t: "动词", l: "beginner", ex: "孩子们早睡。", eu: "Bolalar erta uxlashadi." },
    { e: "读书", ch: "读书", py: "dú shū", uz: "O'qimoq", t: "动词", l: "beginner", ex: "我喜欢读书。", eu: "Kitob o'qishni yaxshi ko'raman." },
    { e: "写字", ch: "写字", py: "xiě zì", uz: "Yozmoq", t: "动词", l: "beginner", ex: "请写下你的名字。", eu: "Iltimos, ismingizni yozing." },
    { e: "走路", ch: "走路", py: "zǒu lù", uz: "Yurmoq", t: "动词", l: "beginner", ex: "我走路去学校。", eu: "Men maktabga yayov boraman." },
    { e: "说话", ch: "说话", py: "shuō huà", uz: "Gapirmoq", t: "动词", l: "beginner", ex: "她说普通话很好。", eu: "U mandarin tilini yaxshi gapiradi." },
    { e: "听", ch: "听", py: "tīng", uz: "Eshitmoq", t: "动词", l: "beginner", ex: "请认真听。", eu: "Iltimos, diqqat bilan eshiting." },
    { e: "玩", ch: "玩", py: "wán", uz: "O'ynamoq", t: "动词", l: "beginner", ex: "孩子们喜欢玩。", eu: "Bolalar o'ynashni yaxshi ko'rishadi." },
    { e: "星期一", ch: "星期一", py: "xīngqī yī", uz: "Dushanba", t: "名词", l: "beginner", ex: "星期一是一周的第一天。", eu: "Dushanba haftaning birinchi kuni." },
    { e: "星期二", ch: "星期二", py: "xīngqī èr", uz: "Seshanba", t: "名词", l: "beginner", ex: "我星期二有课。", eu: "Seshanba kuni darsim bor." },
    { e: "星期三", ch: "星期三", py: "xīngqī sān", uz: "Chorshanba", t: "名词", l: "beginner", ex: "我们每周三见面。", eu: "Biz har chorshanba uchrAshamiz." },
    { e: "早上", ch: "早上", py: "zǎoshang", uz: "Ertalab", t: "名词", l: "beginner", ex: "我每天早上起床。", eu: "Men har ertalab uyg'onaman." },
    { e: "晚上", ch: "晚上", py: "wǎnshang", uz: "Kechqurun", t: "名词", l: "beginner", ex: "晚上我们去散步。", eu: "Kechqurun yurish qilamiz." },
    { e: "名字", ch: "名字", py: "míngzi", uz: "Ism", t: "名词", l: "beginner", ex: "我叫李明。", eu: "Mening ismim Li Min." },
    { e: "城市", ch: "城市", py: "chéngshì", uz: "Shahar", t: "名词", l: "beginner", ex: "北京是一个大城市。", eu: "Pekin katta shahar." },
    { e: "国家", ch: "国家", py: "guójiā", uz: "Mamlakat", t: "名词", l: "beginner", ex: "中国是一个伟大的国家。", eu: "Xitoy buyuk mamlakat." },
    { e: "太阳", ch: "太阳", py: "tàiyáng", uz: "Quyosh", t: "名词", l: "beginner", ex: "太阳在发光。", eu: "Quyosh chiqyapti." },
    { e: "月亮", ch: "月亮", py: "yuèliang", uz: "Oy", t: "名词", l: "beginner", ex: "今晚月亮很亮。", eu: "Bu kecha oy yorqin." },
    { e: "花", ch: "花", py: "huā", uz: "Gul", t: "名词", l: "beginner", ex: "她有漂亮的花。", eu: "Uning chiroyli gullari bor." },
    { e: "树", ch: "树", py: "shù", uz: "Daraxt", t: "名词", l: "beginner", ex: "那棵树很高。", eu: "U daraxt juda baland." },
    { e: "鸟", ch: "鸟", py: "niǎo", uz: "Qush", t: "名词", l: "beginner", ex: "鸟在唱歌。", eu: "Qush sayrAyapti." },
    { e: "鱼", ch: "鱼", py: "yú", uz: "Baliq", t: "名词", l: "beginner", ex: "我喜欢吃鱼。", eu: "Men baliq yeyishni yaxshi ko'raman." },
    { e: "新", ch: "新", py: "xīn", uz: "Yangi", t: "形容词", l: "beginner", ex: "我有一部新手机。", eu: "Mening yangi telefonim bor." },
    { e: "快", ch: "快", py: "kuài", uz: "Tez", t: "形容词", l: "beginner", ex: "这辆车很快。", eu: "Bu mashina juda tez." },
    { e: "慢", ch: "慢", py: "màn", uz: "Sekin", t: "形容词", l: "beginner", ex: "乌龟走得很慢。", eu: "Toshbaqa sekin yuradi." },
    { e: "爱", ch: "爱", py: "ài", uz: "Sevmoq / Muhabbat", t: "动词", l: "beginner", ex: "我爱我的家人。", eu: "Men oilamni sevaman." },
    { e: "喜欢", ch: "喜欢", py: "xǐhuān", uz: "Yoqtirishmoq", t: "动词", l: "beginner", ex: "我喜欢巧克力。", eu: "Men shokoladni yoqtiraman." },
    { e: "想", ch: "想", py: "xiǎng", uz: "Xohlamoq / O'ylash", t: "动词", l: "beginner", ex: "我想回家。", eu: "Men uyga ketmoqchiman." },
    { e: "知道", ch: "知道", py: "zhīdào", uz: "Bilmoq", t: "动词", l: "beginner", ex: "你认识她吗？", eu: "Uni tanisizmi?" },
    { e: "看", ch: "看", py: "kàn", uz: "Ko'rmoq", t: "动词", l: "beginner", ex: "我能看到山。", eu: "Men tog'ni ko'ra olaman." },
    { e: "来", ch: "来", py: "lái", uz: "Kelmoq", t: "动词", l: "beginner", ex: "请过来。", eu: "Iltimos, bu yerga keling." },
    { e: "去", ch: "去", py: "qù", uz: "Bormoq", t: "动词", l: "beginner", ex: "我们去公园吧。", eu: "Keling, parkka boramiz." },
    { e: "给", ch: "给", py: "gěi", uz: "Bermoq", t: "动词", l: "beginner", ex: "把那本书给我。", eu: "Menga o'sha kitobni bering." },
    { e: "买", ch: "买", py: "mǎi", uz: "Sotib olmoq", t: "动词", l: "beginner", ex: "我想买一本书。", eu: "Kitob sotib olmoqchiman." },
    { e: "帮助", ch: "帮助", py: "bāngzhù", uz: "Yordam bermoq", t: "动词", l: "beginner", ex: "你能帮我吗？", eu: "Menga yordam bera olasizmi?" },
    { e: "工作", ch: "工作", py: "gōngzuò", uz: "Ishlash", t: "动词", l: "beginner", ex: "我每天工作。", eu: "Men har kuni ishlayman." },
    { e: "学习", ch: "学习", py: "xuéxí", uz: "O'qimoq / O'rganish", t: "动词", l: "beginner", ex: "我每天学习中文。", eu: "Men har kuni xitoy tilini o'rganaman." },
    { e: "牛奶", ch: "牛奶", py: "niúnǎi", uz: "Sut", t: "名词", l: "beginner", ex: "孩子们喝牛奶。", eu: "Bolalar sut ichadi." },
    { e: "鸡蛋", ch: "鸡蛋", py: "jīdàn", uz: "Tuxum", t: "名词", l: "beginner", ex: "早餐我吃两个鸡蛋。", eu: "Nonushta uchun ikki tuxum yeyman." },
    { e: "茶", ch: "茶", py: "chá", uz: "Choy", t: "名词", l: "beginner", ex: "我们喝点茶吧。", eu: "Keling, choy ichamiz." },
    { e: "咖啡", ch: "咖啡", py: "kāfēi", uz: "Qahva", t: "名词", l: "beginner", ex: "我每天早上喝咖啡。", eu: "Men har ertalab qahva ichaman." },
    { e: "桌子", ch: "桌子", py: "zhuōzi", uz: "Stol", t: "名词", l: "beginner", ex: "书在桌子上。", eu: "Kitob stolda." },
    { e: "椅子", ch: "椅子", py: "yǐzi", uz: "Stul", t: "名词", l: "beginner", ex: "请坐在椅子上。", eu: "Stulga o'tiring." },
    { e: "笔", ch: "笔", py: "bǐ", uz: "Qalam / Ruchka", t: "名词", l: "beginner", ex: "用笔写字。", eu: "Qalam bilan yozing." },
    { e: "包", ch: "包", py: "bāo", uz: "Sumka", t: "名词", l: "beginner", ex: "我的包很重。", eu: "Sumkam og'ir." },
    { e: "手机", ch: "手机", py: "shǒujī", uz: "Telefon", t: "名词", l: "beginner", ex: "我的手机是新的。", eu: "Telefonim yangi." },
    { e: "窗户", ch: "窗户", py: "chuānghu", uz: "Deraza", t: "名词", l: "beginner", ex: "请开窗户。", eu: "Iltimos, derazani oching." },
    { e: "门", ch: "门", py: "mén", uz: "Eshik", t: "名词", l: "beginner", ex: "关上门。", eu: "Eshikni yoping." },
    { e: "路", ch: "路", py: "lù", uz: "Yo'l", t: "名词", l: "beginner", ex: "这条路很长。", eu: "Bu yo'l uzun." },
    { e: "公园", ch: "公园", py: "gōngyuán", uz: "Park", t: "名词", l: "beginner", ex: "孩子们在公园玩。", eu: "Bolalar parkda o'ynaydi." },
    { e: "商店", ch: "商店", py: "shāngdiàn", uz: "Do'kon", t: "名词", l: "beginner", ex: "我们去商店吧。", eu: "Keling, do'konga boramiz." },
    { e: "钱", ch: "钱", py: "qián", uz: "Pul", t: "名词", l: "beginner", ex: "你有钱吗？", eu: "Pulingiz bormi?" },
    { e: "朋友", ch: "朋友", py: "péngyǒu", uz: "Do'st", t: "名词", l: "beginner", ex: "他是我最好的朋友。", eu: "U mening eng yaxshi do'stim." },
    { e: "老师", ch: "老师", py: "lǎoshī", uz: "O'qituvchi", t: "名词", l: "beginner", ex: "我的老师很亲切。", eu: "Mening o'qituvchim mehribon." },
    { e: "学生", ch: "学生", py: "xuésheng", uz: "O'quvchi", t: "名词", l: "beginner", ex: "她是一个好学生。", eu: "U yaxshi o'quvchi." },

    // ─── ELEMENTARY ───
    { e: "卧室", ch: "卧室", py: "wòshì", uz: "Yotoqxona", t: "名词", l: "elementary", ex: "我的卧室很舒适。", eu: "Yotoqxonam qulay." },
    { e: "厨房", ch: "厨房", py: "chúfáng", uz: "Oshxona", t: "名词", l: "elementary", ex: "她在厨房做饭。", eu: "U oshxonada ovqat pishiradi." },
    { e: "浴室", ch: "浴室", py: "yùshì", uz: "Hammom", t: "名词", l: "elementary", ex: "浴室很干净。", eu: "Hammom toza." },
    { e: "花园", ch: "花园", py: "huāyuán", uz: "Bog'", t: "名词", l: "elementary", ex: "我们在花园种蔬菜。", eu: "Biz bog'da sabzavot etishtIramiz." },
    { e: "医生", ch: "医生", py: "yīshēng", uz: "Shifokor", t: "名词", l: "elementary", ex: "医生检查了病人。", eu: "Shifokor bemorni tekshirdi." },
    { e: "工程师", ch: "工程师", py: "gōngchéngshī", uz: "Muhandis", t: "名词", l: "elementary", ex: "他是一名软件工程师。", eu: "U dasturiy ta'minot muhandisi." },
    { e: "贵", ch: "贵", py: "guì", uz: "Qimmat", t: "形容词", l: "elementary", ex: "这部手机非常贵。", eu: "Bu telefon juda qimmat." },
    { e: "便宜", ch: "便宜", py: "piányí", uz: "Arzon", t: "形容词", l: "elementary", ex: "这双鞋很便宜。", eu: "Bu poyabzallar arzon." },
    { e: "漂亮", ch: "漂亮", py: "piàoliang", uz: "Go'zal", t: "形容词", l: "elementary", ex: "今天天气真漂亮！", eu: "Qanday go'zal kun!" },
    { e: "有趣", ch: "有趣", py: "yǒuqù", uz: "Qiziqarli", t: "形容词", l: "elementary", ex: "这是一个有趣的故事。", eu: "Bu qiziqarli hikoya." },
    { e: "难", ch: "难", py: "nán", uz: "Qiyin", t: "形容词", l: "elementary", ex: "这次考试很难。", eu: "Bu imtihon juda qiyin." },
    { e: "容易", ch: "容易", py: "róngyì", uz: "Oson", t: "形容词", l: "elementary", ex: "这道题很容易。", eu: "Bu mashq oson." },
    { e: "旅行", ch: "旅行", py: "lǚxíng", uz: "Sayohat qilmoq", t: "动词", l: "elementary", ex: "我喜欢去国外旅行。", eu: "Xorijga sayohat qilishni yaxshi ko'raman." },
    { e: "音乐", ch: "音乐", py: "yīnyuè", uz: "Musiqa", t: "名词", l: "elementary", ex: "我每天听音乐。", eu: "Men har kuni musiqa eshitaman." },
    { e: "天气", ch: "天气", py: "tiānqì", uz: "Ob-havo", t: "名词", l: "elementary", ex: "今天天气很好。", eu: "Bugun ob-havo yaxshi." },
    { e: "电脑", ch: "电脑", py: "diànnǎo", uz: "Kompyuter", t: "名词", l: "elementary", ex: "我用电脑工作。", eu: "Men kompyuterni ish uchun ishlataman." },
    { e: "医院", ch: "医院", py: "yīyuàn", uz: "Kasalxona", t: "名词", l: "elementary", ex: "他被送往医院。", eu: "Uni kasalxonaga olib ketishdi." },
    { e: "饭馆", ch: "饭馆", py: "fànguǎn", uz: "Restoran", t: "名词", l: "elementary", ex: "我们在饭馆吃饭。", eu: "Biz restoranda ovqatlanamiz." },
    { e: "机场", ch: "机场", py: "jīchǎng", uz: "Aeroport", t: "名词", l: "elementary", ex: "机场非常繁忙。", eu: "Aeroport juda gavjum." },
    { e: "会议", ch: "会议", py: "huìyì", uz: "Uchrashuv / Yig'ilish", t: "名词", l: "elementary", ex: "我十点有个会议。", eu: "Soat 10 da mening yig'ilish bor." },
    { e: "购物", ch: "购物", py: "gòuwù", uz: "Xarid", t: "名词", l: "elementary", ex: "她喜欢购物。", eu: "U xarid qilishni yaxshi ko'radi." },
    { e: "票", ch: "票", py: "piào", uz: "Chipta", t: "名词", l: "elementary", ex: "我买了一张火车票。", eu: "Men poyezd chiptasi sotib oldim." },
    { e: "宾馆", ch: "宾馆", py: "bīnguǎn", uz: "Mehmonxona", t: "名词", l: "elementary", ex: "我们住在一家好宾馆里。", eu: "Biz yaxshi mehmonxonada qoldik." },
    { e: "菜单", ch: "菜单", py: "càidān", uz: "Menyu", t: "名词", l: "elementary", ex: "我可以看菜单吗？", eu: "Menyuni ko'rsam bo'ladimi?" },
    { e: "折扣", ch: "折扣", py: "zhékòu", uz: "Chegirma", t: "名词", l: "elementary", ex: "今天有九折优惠。", eu: "Bugun 10% chegirma bor." },
    { e: "锻炼", ch: "锻炼", py: "duànliàn", uz: "Mashq qilmoq", t: "动词", l: "elementary", ex: "锻炼对健康有好处。", eu: "Mashq sog'liq uchun foydali." },
    { e: "图书馆", ch: "图书馆", py: "túshūguǎn", uz: "Kutubxona", t: "名词", l: "elementary", ex: "我经常去图书馆。", eu: "Men tez-tez kutubxonaga boraman." },
    { e: "科目", ch: "科目", py: "kēmù", uz: "Fan", t: "名词", l: "elementary", ex: "数学是我最喜欢的科目。", eu: "Matematika mening sevimli fanim." },
    { e: "课", ch: "课", py: "kè", uz: "Dars", t: "名词", l: "elementary", ex: "课从九点开始。", eu: "Dars soat 9 da boshlanadi." },
    { e: "作业", ch: "作业", py: "zuòyè", uz: "Uy vazifasi", t: "名词", l: "elementary", ex: "我每天晚上做作业。", eu: "Men har kechqurun uy vazifamni bajaraman." },
    { e: "考试", ch: "考试", py: "kǎoshì", uz: "Imtihon", t: "名词", l: "elementary", ex: "我明天有考试。", eu: "Ertaga imtihonım bor." },
    { e: "成绩", ch: "成绩", py: "chéngjì", uz: "Baho / Natija", t: "名词", l: "elementary", ex: "她的成绩很好。", eu: "Uning baholari yaxshi." },
    { e: "地球", ch: "地球", py: "dìqiú", uz: "Yer sayyorasi", t: "名词", l: "elementary", ex: "地球是我们的星球。", eu: "Yer bizning sayyoramiz." },
    { e: "山", ch: "山", py: "shān", uz: "Tog'", t: "名词", l: "elementary", ex: "那座山很高。", eu: "U tog' juda baland." },
    { e: "河流", ch: "河流", py: "hé liú", uz: "Daryo", t: "名词", l: "elementary", ex: "河流很美丽。", eu: "Daryo go'zal." },
    { e: "大海", ch: "大海", py: "dà hǎi", uz: "Dengiz", t: "名词", l: "elementary", ex: "我喜欢大海。", eu: "Men dengizni yaxshi ko'raman." },
    { e: "森林", ch: "森林", py: "sēnlín", uz: "O'rmon", t: "名词", l: "elementary", ex: "森林幽暗而宁静。", eu: "O'rmon qorong'i va sokin." },
    { e: "运动", ch: "运动", py: "yùndòng", uz: "Sport", t: "名词", l: "elementary", ex: "运动让你保持健康。", eu: "Sport sizni sog'lom saqlaydi." },
    { e: "团队", ch: "团队", py: "tuánduì", uz: "Jamoa", t: "名词", l: "elementary", ex: "我们的团队赢了比赛。", eu: "Bizning jamoamiz o'yinda g'olib keldi." },
    { e: "故事", ch: "故事", py: "gùshi", uz: "Hikoya", t: "名词", l: "elementary", ex: "给我讲个故事。", eu: "Menga hikoya aytib ber." },
    { e: "梦想", ch: "梦想", py: "mèngxiǎng", uz: "Orzu", t: "名词", l: "elementary", ex: "追随你的梦想。", eu: "Orzuingiz ortidan yuring." },
    { e: "笑", ch: "笑", py: "xiào", uz: "Kulmoq", t: "动词", l: "elementary", ex: "她总是让我笑。", eu: "U har doim meni kuldiradi." },
    { e: "哭", ch: "哭", py: "kū", uz: "Yig'lamoq", t: "动词", l: "elementary", ex: "别哭，一切都会好的。", eu: "Yig'lama, hammasi yaxshi bo'ladi." },
    { e: "参观", ch: "参观", py: "cānguān", uz: "Tashrif buyurmoq", t: "动词", l: "elementary", ex: "我们经常拜访祖父母。", eu: "Biz tez-tez bobomiznikiga boramiz." },
    { e: "解释", ch: "解释", py: "jiěshì", uz: "Tushuntirmoq", t: "动词", l: "elementary", ex: "请给我解释一下。", eu: "Iltimos, buni menga tushuntiring." },
    { e: "同意", ch: "同意", py: "tóngyì", uz: "Rozilik bildirmoq", t: "动词", l: "elementary", ex: "我同意你的看法。", eu: "Men sizning fikringiz bilan roziman." },
    { e: "记住", ch: "记住", py: "jì zhù", uz: "Eslamoq", t: "动词", l: "elementary", ex: "我记住了你的名字。", eu: "Ismingizni eslayman." },
    { e: "忘记", ch: "忘记", py: "wàngjì", uz: "Unutmoq", t: "动词", l: "elementary", ex: "别忘了你的钥匙！", eu: "Kalitlaringizni unutmang!" },
    { e: "提高", ch: "提高", py: "tígāo", uz: "Yaxshilamoq", t: "动词", l: "elementary", ex: "我想提高我的中文水平。", eu: "Xitoy tilimni yaxshilashni xohlayman." },
    { e: "准备", ch: "准备", py: "zhǔnbèi", uz: "Tayyorlamoq", t: "动词", l: "elementary", ex: "我在为考试做准备。", eu: "Imtihonga tayyorlanayapman." },
    { e: "享受", ch: "享受", py: "xiǎngshòu", uz: "Zavqlanmoq", t: "动词", l: "elementary", ex: "我喜欢看电影。", eu: "Film ko'rishdan zavqlanaman." },
    { e: "通常", ch: "通常", py: "tōngcháng", uz: "Odatda", t: "副词", l: "elementary", ex: "我通常七点起床。", eu: "Men odatda soat 7 da uyg'onaman." },
    { e: "有时候", ch: "有时候", py: "yǒushíhòu", uz: "Ba'zan", t: "副词", l: "elementary", ex: "她有时候看电影。", eu: "U ba'zan film ko'radi." },
    { e: "从不", ch: "从不", py: "cóng bù", uz: "Hech qachon", t: "副词", l: "elementary", ex: "我从不吃快餐。", eu: "Men hech qachon tez ovqat yemayman." },
    { e: "总是", ch: "总是", py: "zǒng shì", uz: "Har doim", t: "副词", l: "elementary", ex: "他总是准时到达。", eu: "U har doim o'z vaqtida keladi." },
    { e: "经常", ch: "经常", py: "jīngcháng", uz: "Tez-tez", t: "副词", l: "elementary", ex: "我们经常去散步。", eu: "Biz tez-tez sayrga chiqamiz." },

    // ─── PRE-INTERMEDIATE ───
    { e: "然而", ch: "然而", py: "rán'ér", uz: "Biroq / Ammo", t: "连词", l: "pre-intermediate", ex: "天气很冷，然而我们出去了。", eu: "Havo sovuq edi, biroq biz chiqdik." },
    { e: "虽然", ch: "虽然", py: "suīrán", uz: "Garchi ... bo'lsa ham", t: "连词", l: "pre-intermediate", ex: "虽然下雨了，我们还是玩了。", eu: "Garchi yomg'ir yog'sa ham, biz o'yndik." },
    { e: "因此", ch: "因此", py: "yīncǐ", uz: "Shuning uchun", t: "副词", l: "pre-intermediate", ex: "因此，我们决定去了。", eu: "Shuning uchun biz borishga qaror qildik." },
    { e: "而且", ch: "而且", py: "érqiě", uz: "Bundan tashqari", t: "连词", l: "pre-intermediate", ex: "而且，她很有才华。", eu: "Bundan tashqari, u iste'dodli." },
    { e: "机会", ch: "机会", py: "jīhuì", uz: "Imkoniyat", t: "名词", l: "pre-intermediate", ex: "这是一个很好的机会。", eu: "Bu ajoyib imkoniyat." },
    { e: "研究", ch: "研究", py: "yánjiū", uz: "Tadqiqot", t: "名词", l: "pre-intermediate", ex: "科学家做研究。", eu: "Olimlar tadqiqot o'tkazadilar." },
    { e: "截止日期", ch: "截止日期", py: "jiézhǐ rìqī", uz: "Muddati", t: "名词", l: "pre-intermediate", ex: "截止日期是明天。", eu: "Muddati ertaga." },
    { e: "放弃", ch: "放弃", py: "fàngqì", uz: "Voz kechmoq", t: "动词", l: "pre-intermediate", ex: "不要放弃你的梦想。", eu: "O'z orzularingizdan voz kechmang." },
    { e: "成就", ch: "成就", py: "chéngjiù", uz: "Yutuq", t: "名词", l: "pre-intermediate", ex: "这是一个巨大的成就。", eu: "Bu katta yutuq." },
    { e: "挑战", ch: "挑战", py: "tiǎozhàn", uz: "Muammo / Sinovqilish", t: "名词", l: "pre-intermediate", ex: "每一个挑战让你更强大。", eu: "Har bir muammo sizni kuchliroq qiladi." },
    { e: "自信", ch: "自信", py: "zìxìn", uz: "Ishonchli", t: "形容词", l: "pre-intermediate", ex: "对自己充满自信。", eu: "O'zingizga ishoning." },
    { e: "成功", ch: "成功", py: "chénggōng", uz: "Muvaffaqiyatli", t: "形容词/动词", l: "pre-intermediate", ex: "她是一个成功的商人。", eu: "U muvaffaqiyatli ish ayoli." },
    { e: "负责任", ch: "负责任", py: "fù zérèn", uz: "Mas'ul", t: "词组", l: "pre-intermediate", ex: "为自己的行为负责任。", eu: "Harakatlaringiz uchun mas'ul bo'ling." },
    { e: "环境", ch: "环境", py: "huánjìng", uz: "Atrof-muhit", t: "名词", l: "pre-intermediate", ex: "我们必须保护环境。", eu: "Biz atrof-muhitni himoya qilishimiz kerak." },
    { e: "技术", ch: "技术", py: "jìshù", uz: "Texnologiya", t: "名词", l: "pre-intermediate", ex: "技术改变了我们的生活。", eu: "Texnologiya hayotimizni o'zgartiradi." },
    { e: "社会", ch: "社会", py: "shèhuì", uz: "Jamiyat", t: "名词", l: "pre-intermediate", ex: "社会在快速变化。", eu: "Jamiyat tez o'zgarmoqda." },
    { e: "教育", ch: "教育", py: "jiàoyù", uz: "Ta'lim", t: "名词", l: "pre-intermediate", ex: "教育是成功的钥匙。", eu: "Ta'lim — muvaffaqiyat kaliti." },
    { e: "职业", ch: "职业", py: "zhíyè", uz: "Karyera", t: "名词", l: "pre-intermediate", ex: "我想要一份好工作。", eu: "Men yaxshi karyera istayman." },
    { e: "工资", ch: "工资", py: "gōngzī", uz: "Maosh", t: "名词", l: "pre-intermediate", ex: "他的工资很高。", eu: "Uning maoshi juda baland." },
    { e: "同事", ch: "同事", py: "tóngshì", uz: "Hamkasb", t: "名词", l: "pre-intermediate", ex: "我的同事很乐于助人。", eu: "Hamkasabim yordamsevar." },
    { e: "面试", ch: "面试", py: "miànshì", uz: "Intervyu / Suhbat", t: "名词", l: "pre-intermediate", ex: "我明天有求职面试。", eu: "Ertaga ish uchun suhbatim bor." },
    { e: "经验", ch: "经验", py: "jīngyàn", uz: "Tajriba", t: "名词", l: "pre-intermediate", ex: "工作经验很重要。", eu: "Ish tajribasi muhim." },
    { e: "技能", ch: "技能", py: "jìnéng", uz: "Ko'nikmalar", t: "名词", l: "pre-intermediate", ex: "你需要良好的沟通技能。", eu: "Yaxshi muloqot ko'nikmalariga ega bo'lish kerak." },
    { e: "管理", ch: "管理", py: "guǎnlǐ", uz: "Boshqarmoq", t: "动词", l: "pre-intermediate", ex: "她管理一个大团队。", eu: "U katta jamoani boshqaradi." },
    { e: "解决", ch: "解决", py: "jiějué", uz: "Yechmoq", t: "动词", l: "pre-intermediate", ex: "我们需要解决这个问题。", eu: "Biz bu muammoni yechishimiz kerak." },
    { e: "实现", ch: "实现", py: "shíxiàn", uz: "Erishmoq", t: "动词", l: "pre-intermediate", ex: "你可以实现你的目标。", eu: "Maqsadlaringizga erisha olasiz." },
    { e: "发展", ch: "发展", py: "fāzhǎn", uz: "Rivojlantirmoq", t: "动词", l: "pre-intermediate", ex: "我们需要开发新的想法。", eu: "Biz yangi g'oyalarni rivojlantirishimiz kerak." },
    { e: "增加", ch: "增加", py: "zēngjiā", uz: "Oshirmoq", t: "动词", l: "pre-intermediate", ex: "物价在上涨。", eu: "Narxlar oshmoqda." },
    { e: "减少", ch: "减少", py: "jiǎnshǎo", uz: "Kamaytirmoq", t: "动词", l: "pre-intermediate", ex: "我们必须减少污染。", eu: "Biz ifloslanishni kamaytirishimiz kerak." },
    { e: "建议", ch: "建议", py: "jiànyì", uz: "Taklif qilmoq", t: "动词", l: "pre-intermediate", ex: "我建议我们现在就走。", eu: "Endi ketishimizni taklif qilaman." },

    // ─── ADVANCED ───
    { e: "细微差别", ch: "细微差别", py: "xìwēi chābié", uz: "Noziklik / Soya", t: "名词", l: "advanced", ex: "她的话语中的细微差别很重要。", eu: "Uning so'zlarining nozikligi muhim edi." },
    { e: "主权", ch: "主权", py: "zhǔquán", uz: "Suverenitet", t: "名词", l: "advanced", ex: "国家主权至关重要。", eu: "Milliy suverenitet muhimdir." },
    { e: "雄辩", ch: "雄辩", py: "xióngbiàn", uz: "Notiqlik", t: "名词", l: "advanced", ex: "她的口才令所有人印象深刻。", eu: "Uning notiqligi hammani hayratda qoldirdi." },
    { e: "范式", ch: "范式", py: "fànshì", uz: "Paradigma", t: "名词", l: "advanced", ex: "一种新的范式正在兴起。", eu: "Yangi paradigma paydo bo'lmoqda." },
    { e: "相关性", ch: "相关性", py: "xiāngguān xìng", uz: "Korrelyatsiya", t: "名词", l: "advanced", ex: "相关性不意味着因果关系。", eu: "Korrelyatsiya sababiyatni anglatmaydi." },
    { e: "立法", ch: "立法", py: "lìfǎ", uz: "Qonunchilik", t: "名词", l: "advanced", ex: "通过了新的立法。", eu: "Yangi qonun qabul qilindi." },
    { e: "减轻", ch: "减轻", py: "jiǎnqīng", uz: "Yumshatmoq", t: "动词", l: "advanced", ex: "我们必须减轻风险。", eu: "Biz xavflarni yumshatishimiz kerak." },
    { e: "史无前例", ch: "史无前例", py: "shǐ wú qiánlì", uz: "Misli ko'rilmagan", t: "成语", l: "advanced", ex: "这是一种史无前例的情况。", eu: "Bu misli ko'rilmagan holat." },
    { e: "一丝不苟", ch: "一丝不苟", py: "yī sī bù gǒu", uz: "Puxta / Ehtiyotkor", t: "成语", l: "advanced", ex: "她的工作一丝不苟。", eu: "U ishida puxta." },
    { e: "模糊", ch: "模糊", py: "móhú", uz: "Noaniq", t: "形容词", l: "advanced", ex: "他的陈述很模糊。", eu: "Uning bayonoti noaniq edi." },
    { e: "连贯", ch: "连贯", py: "liánguàn", uz: "Izchil / Mantiqiy", t: "形容词", l: "advanced", ex: "写一个连贯的论点。", eu: "Izchil argument yozing." },
    { e: "实质性", ch: "实质性", py: "shízhì xìng", uz: "Muhim / Sezilarli", t: "形容词", l: "advanced", ex: "有实质性的证据。", eu: "Jiddiy dalillar mavjud." },
    { e: "固有", ch: "固有", py: "gùyǒu", uz: "O'ziga xos / Tabiiy", t: "形容词", l: "advanced", ex: "存在固有的风险。", eu: "O'ziga xos xavflar mavjud." },
    { e: "催化剂", ch: "催化剂", py: "cuīhuàjì", uz: "Katalizator", t: "名词", l: "advanced", ex: "这项发明成为变革的催化剂。", eu: "Ixtiro o'zgarish uchun katalizator bo'ldi." },
    { e: "人口统计", ch: "人口统计", py: "rénkǒu tǒngjì", uz: "Demografik", t: "名词", l: "advanced", ex: "人口结构的变化是重大的。", eu: "Demografik o'zgarishlar muhim." },
    { e: "基础设施", ch: "基础设施", py: "jīchǔ shèshī", uz: "Infratuzilma", t: "名词", l: "advanced", ex: "我们必须投资基础设施。", eu: "Infratuzilmaga investitsiya qilishimiz kerak." },
    { e: "假说", ch: "假说", py: "jiǎshuō", uz: "Faraz", t: "名词", l: "advanced", ex: "检验你的假说。", eu: "Farazingizni sinab ko'ring." },
    { e: "方法论", ch: "方法论", py: "fāngfǎ lùn", uz: "Metodologiya", t: "名词", l: "advanced", ex: "解释你的方法论。", eu: "Metodologiyangizni tushuntiring." },
    { e: "现象", ch: "现象", py: "xiànxiàng", uz: "Hodisa", t: "名词", l: "advanced", ex: "这是一种全球现象。", eu: "Bu global hodisa." },
    { e: "含义", ch: "含义", py: "hányì", uz: "Oqibatlar / Ma'no", t: "名词", l: "advanced", ex: "考虑其含义。", eu: "Oqibatlarni ko'rib chiqing." },
    { e: "视角", ch: "视角", py: "shìjiǎo", uz: "Nuqtai nazar", t: "名词", l: "advanced", ex: "考虑一个不同的视角。", eu: "Boshqa nuqtai nazarni ko'rib chiqing." },
    { e: "框架", ch: "框架", py: "kuàngjià", uz: "Tizim / Struktura", t: "名词", l: "advanced", ex: "我们需要一个清晰的框架。", eu: "Bizga aniq tizim kerak." },
    { e: "修辞", ch: "修辞", py: "xiūcí", uz: "Ritorika", t: "名词", l: "advanced", ex: "他的修辞很有力量。", eu: "Uning ritorikasi kuchli edi." },
    { e: "审视", ch: "审视", py: "shěnshì", uz: "Sinchkovlik bilan tekshirish", t: "动词", l: "advanced", ex: "这个计划受到了审视。", eu: "Reja sinchkovlik bilan tekshirildi." },
    { e: "共识", ch: "共识", py: "gòngshí", uz: "Kelishuv", t: "名词", l: "advanced", ex: "我们达成了共识。", eu: "Biz kelishuvga erishdik." },
    { e: "倡导", ch: "倡导", py: "chàngdǎo", uz: "Himoya qilmoq", t: "动词", l: "advanced", ex: "她倡导人权。", eu: "U inson huquqlarini himoya qiladi." },
    { e: "阐述", ch: "阐述", py: "chǎnshù", uz: "Batafsil bayon etmoq", t: "动词", l: "advanced", ex: "你能详细说明一下吗？", eu: "Bu haqida batafsil ayta olasizmi?" },
    { e: "承认", ch: "承认", py: "chéngrèn", uz: "Tan olmoq", t: "动词", l: "advanced", ex: "我承认我的错误。", eu: "Xatoimni tan olaman." },
    { e: "可信的", ch: "可信的", py: "kě xìn de", uz: "Ishonchli ko'rinadigan", t: "形容词", l: "advanced", ex: "这似乎是可信的。", eu: "Bu ishonchli ko'rinadi." },
];

// ══════════════════════════════════════════════════
// UNITS MA'LUMOTLARI
// ══════════════════════════════════════════════════
const UD_DATA = {
    beginner: [
        {
            id: 'cb0', emoji: '🔤', title: '拼音入门 (Pinyin)', desc: "Xitoy pinyin alifbosini o'rganish",
            level: 'beginner', words: ['你好', '再见', '谢谢', '请', '对不起', '是', '不', '好', '大', '小'],
            xp: 40, coin: 15,
            grammar_rule: "拼音是中文的罗马化系统。它有声母(b,p,m,f...)、韵母(a,o,e,i,u,ü)和声调(1-4声+轻声)。",
            grammar_example: "mā(妈) māo(猫) mǎi(买) màn(慢) — 4 ta ton farqli ma'no.",
            reading_text: "拼音是学习中文的基础。中文有四个声调：第一声（平），第二声（升），第三声（降升），第四声（降）。每个声调代表不同的意思。例如：māo（猫）是猫，mǎo是一种没有意思的声音。学好拼音，你就能读任何中文词了。",
            reading_qs: [
                { q: "中文有几个声调？", opts: ["三个", "四个", "五个", "六个"], c: 1 },
                { q: "第一声是什么样的？", opts: ["升调", "降调", "平调", "降升调"], c: 2 },
                { q: "拼音是学什么的基础？", opts: ["英语", "日语", "中文", "韩语"], c: 2 }
            ]
        },
        {
            id: 'cb1', emoji: '👋', title: '问候 (Greetings)', desc: "Salomlashish va xayrlashish",
            level: 'beginner', words: ['你好', '再见', '谢谢', '请', '对不起', '是', '不', '好', '高兴', '妈妈'],
            xp: 50, coin: 20,
            grammar_rule: "你好 = Salom. 你 = siz/sen, 好 = yaxshi. 我是... = Men ... man. 你叫什么名字？ = Ismingiz nima?",
            grammar_example: "你好！我叫李明。你叫什么名字？— Salom! Mening ismim Li Min. Sizning ismingiz nima?",
            reading_text: "我叫王芳，我来自北京。每天早上我都会对邻居说「你好」。离开时，我说「再见」。我总是说「请」和「谢谢」。我的朋友们说我非常有礼貌。中国人见面时通常互相问好。",
            reading_qs: [
                { q: "王芳来自哪里？", opts: ["上海", "北京", "广州", "深圳"], c: 1 },
                { q: "离开时说什么？", opts: ["你好", "谢谢", "再见", "请"], c: 2 },
                { q: "王芳的朋友认为她怎么样？", opts: ["很聪明", "非常有礼貌", "很有钱", "很高"], c: 1 }
            ]
        },
        {
            id: 'cb2', emoji: '🔢', title: '数字 (Numbers)', desc: "Xitoy raqamlari",
            level: 'beginner', words: ['一', '二', '三', '四', '五', '水', '书', '学校', '朋友', '家'],
            xp: 50, coin: 20,
            grammar_rule: "汉字数字: 一(1) 二(2) 三(3) 四(4) 五(5) 六(6) 七(7) 八(8) 九(9) 十(10)。十一=11, 二十=20.",
            grammar_example: "我有三只猫。她二十岁了。今天是八月十五号。",
            reading_text: "汤姆有三只猫和两只狗。他每天喂它们四次。他和每只动物花大约十分钟。他为他的猫买了十二个玩具。数字在中文中非常重要。四(sì)在中国被认为是不吉利的数字，因为它的发音接近「死」(sǐ)。",
            reading_qs: [
                { q: "汤姆有几只猫？", opts: ["两只", "三只", "四只", "五只"], c: 1 },
                { q: "他每天喂几次？", opts: ["两次", "三次", "四次", "五次"], c: 2 },
                { q: "哪个数字被认为不吉利？", opts: ["三", "四", "七", "八"], c: 1 }
            ]
        },
        {
            id: 'cb3', emoji: '🎨', title: '颜色 (Colors)', desc: "Xitoy tilida ranglar",
            level: 'beginner', words: ['红色', '蓝色', '绿色', '黄色', '黑色', '白色', '热', '冷', '大', '小'],
            xp: 60, coin: 25,
            grammar_rule: "颜色+的+名词: 红色的苹果 (qizil olma). 很+形容词: 天空很蓝 (Osmon juda ko'k).",
            grammar_example: "她有一个红色的包。我看到了蓝色的鸟。绿色的草地很软。",
            reading_text: "彩虹有七种颜色：红、橙、黄、绿、蓝、靛和紫。红色是火的颜色，在中国代表喜庆和好运。蓝色是天空的颜色。绿色是树木的颜色，代表生命和希望。在中国文化中，颜色有特殊的意义。白色在中国传统上与悲伤有关。",
            reading_qs: [
                { q: "彩虹有几种颜色？", opts: ["五种", "六种", "七种", "八种"], c: 2 },
                { q: "在中国，红色代表什么？", opts: ["悲伤", "危险", "喜庆", "平静"], c: 2 },
                { q: "白色在中国传统上与什么有关？", opts: ["喜悦", "悲伤", "好运", "财富"], c: 1 }
            ]
        },
        {
            id: 'cb4', emoji: '👨‍👩‍👧', title: '家人 (Family)', desc: "Oila a'zolari",
            level: 'beginner', words: ['妈妈', '爸爸', '妹妹', '哥哥', '水', '饭', '家', '车', '狗', '猫'],
            xp: 60, coin: 25,
            grammar_rule: "我的 + 家人 = mening (oila a'zom). 爷爷=bobo, 奶奶=buvi, 叔叔=amaki, 阿姨=xola.",
            grammar_example: "我的妈妈很善良。我爸爸每天工作。我们的家很大。",
            reading_text: "我的家有五个人。我爸爸是医生，我妈妈是老师。我有一个哥哥和一个妹妹。我的祖父母住在附近。我们每个周日去看望他们。在中国，家庭非常重要。孩子们尊重父母和老人。这叫做「孝道」，是中国传统文化的核心价值观。",
            reading_qs: [
                { q: "这个家有几个人？", opts: ["三个", "四个", "五个", "六个"], c: 2 },
                { q: "爸爸的职业是什么？", opts: ["老师", "医生", "工程师", "司机"], c: 1 },
                { q: "他们何时去看祖父母？", opts: ["星期六", "星期日", "星期一", "星期五"], c: 1 }
            ]
        },
        {
            id: 'cb5', emoji: '🍜', title: '食物饮料 (Food)', desc: "Xitoy yemliklari va ichimliklar",
            level: 'beginner', words: ['饭', '苹果', '面包', '水', '喝', '吃', '牛奶', '鸡蛋', '茶', '咖啡'],
            xp: 70, coin: 30,
            grammar_rule: "我要 / 我想要 = Men ... xohlayman. 一碗=bir kosa, 一杯=bir stakan, 一盘=bir tarelka.",
            grammar_example: "我要一碗米饭。她喝一杯茶。我们吃一盘饺子。",
            reading_text: "中国饮食文化非常丰富。中国人的早餐通常有粥、包子或面条。饺子是节日食品，代表财富。茶在中国有几千年的历史，是最受欢迎的饮料。中国有八大菜系，包括粤菜、川菜和北京菜。每天喝足够的水对健康非常重要。",
            reading_qs: [
                { q: "中国人的早餐有什么？", opts: ["汉堡", "粥和包子", "三明治", "薯条"], c: 1 },
                { q: "饺子代表什么？", opts: ["健康", "幸福", "财富", "长寿"], c: 2 },
                { q: "茶在中国有多少年历史？", opts: ["100年", "500年", "1000年", "几千年"], c: 3 }
            ]
        },
    ],

    elementary: [
        {
            id: 'ce1', emoji: '🏡', title: '家和房间 (House)', desc: "Uy va xonalar",
            level: 'elementary', words: ['卧室', '厨房', '浴室', '花园', '医生', '贵', '便宜', '漂亮', '有趣', '难'],
            xp: 80, coin: 35,
            grammar_rule: "有 = bor. 没有 = yo'q. 在 = ... da / ... bor. 在哪儿？ = Qayerda?",
            grammar_example: "客厅里有一张沙发。有三个卧室。浴室在哪儿？ — 在二楼。",
            reading_text: "我的家有三层楼。一楼有一个宽敞的客厅和一个现代化的厨房。二楼有三个卧室和两个浴室。我的卧室有一扇大窗户，可以看到花园。我家的装饰结合了现代和传统中国风格，挂着漂亮的中国画。",
            reading_qs: [
                { q: "家有几层楼？", opts: ["两层", "三层", "四层", "五层"], c: 1 },
                { q: "卧室在哪里？", opts: ["一楼", "二楼", "花园里", "地下室"], c: 1 },
                { q: "卧室有什么？", opts: ["电视", "大窗户", "游泳池", "壁炉"], c: 1 }
            ]
        },
        {
            id: 'ce2', emoji: '💼', title: '职业 (Jobs)', desc: "Kasblar",
            level: 'elementary', words: ['医生', '工程师', '老师', '学生', '音乐', '朋友', '天气', '电脑', '旅行', '漂亮'],
            xp: 80, coin: 35,
            grammar_rule: "我是 + 职业 = Men ... man. 他/她在哪里工作？ 他在医院工作。",
            grammar_example: "你是做什么的？我是护士。他当工程师。她在学校教书。",
            reading_text: "中国有很多不同的职业。医生和护士在医院工作。老师教育下一代。工程师建造桥梁和建筑。飞行员驾驶飞机。在中国，「高考」是进入大学的重要考试，影响很多人的职业选择。每种职业对社会都很重要。",
            reading_qs: [
                { q: "医生在哪里工作？", opts: ["学校", "工厂", "医院", "办公室"], c: 2 },
                { q: "什么是高考？", opts: ["一种运动", "大学入学考试", "工作面试", "驾驶考试"], c: 1 },
                { q: "老师做什么？", opts: ["飞飞机", "建桥梁", "教育人", "做饭"], c: 2 }
            ]
        },
        {
            id: 'ce3', emoji: '🛒', title: '购物 (Shopping)', desc: "Xarid qilish",
            level: 'elementary', words: ['贵', '便宜', '购物', '票', '折扣', '菜单', '有趣', '难', '容易', '旅行'],
            xp: 90, coin: 40,
            grammar_rule: "多少钱？= Qancha? 太贵了 = Juda qimmat. 打折吗？= Chegirma bormi? 我要买... = Sotib olmoqchiman...",
            grammar_example: "这件衬衫多少钱？二十五块。太贵了！能便宜一点吗？打九折。",
            reading_text: "购物是日常生活的一部分。超市出售食品和日用品。百货公司有衣服和电子产品。购物前要检查价格。在中国，网上购物非常流行，淘宝和京东是最大的购物网站。很多中国人在双十一（11月11日）购物，因为当天有很多折扣。保留好您的收据！",
            reading_qs: [
                { q: "在哪里可以买衣服？", opts: ["超市", "百货公司", "药店", "面包店"], c: 1 },
                { q: "双十一是哪一天？", opts: ["10月10日", "11月11日", "12月12日", "1月1日"], c: 1 },
                { q: "什么能省钱？", opts: ["快速购买", "现金支付", "寻找折扣", "经常去"], c: 2 }
            ]
        },
    ],

    'pre-intermediate': [
        {
            id: 'cp1', emoji: '🔮', title: '将来计划 (Future Plans)', desc: "Kelajak rejalari",
            level: 'pre-intermediate', words: ['然而', '虽然', '因此', '而且', '机会', '挑战', '成功', '放弃', '实现', '发展'],
            xp: 130, coin: 60,
            grammar_rule: "将 / 要 / 打算 / 会 — kelajak uchun. 我打算去北京 = Men Pekinга bormoqni rejalashtiraman. 我会努力的 = Men qattiq harakat qilaman.",
            grammar_example: "我明年打算去中国留学。他要成为一名医生。她将来会成功的。",
            reading_text: "规划未来非常重要。设定明确的目标有助于你取得成功。短期目标需要几周的时间。长期目标需要多年努力。灵活性与坚定性同样重要。在中国，很多年轻人梦想去一线城市工作，比如北京、上海或深圳。",
            reading_qs: [
                { q: "短期目标需要多少时间？", opts: ["几年", "几十年", "几周", "一辈子"], c: 2 },
                { q: "什么与坚定性同样重要？", opts: ["金钱", "灵活性", "教育", "力量"], c: 1 },
                { q: "中国的一线城市举了哪些例子？", opts: ["成都和杭州", "北京、上海、深圳", "西安和重庆", "广州和武汉"], c: 1 }
            ]
        },
        {
            id: 'cp2', emoji: '🎯', title: '是非句 (Yes/No Questions)', desc: "Xitoy tilida savol gaplari",
            level: 'pre-intermediate', words: ['然而', '虽然', '因此', '而且', '机会', '挑战', '成功', '放弃', '实现', '发展'],
            xp: 140, coin: 65,
            grammar_rule: "吗 — savollar uchun: 你吃饭了吗？ 是...还是... — muqobil savol. V + 没 + V — tekshirish: 你吃没吃？",
            grammar_example: "你是学生吗？你去不去？你吃饭了吗？他来了没有？",
            reading_text: "普通话（普通话）是中国的官方语言。它基于北方方言，特别是北京话。然而，中国有很多方言，如粤语、闽南语和上海话。虽然方言不同，书面中文是统一的。因此，所有中国人都能读同样的文字，即使口语有所不同。",
            reading_qs: [
                { q: "普通话是基于哪里的方言？", opts: ["上海", "广州", "北京", "成都"], c: 2 },
                { q: "哪些方言被提到了？", opts: ["只有粤语", "粤语、闽南语、上海话", "只有上海话", "只有闽南语"], c: 1 },
                { q: "书面中文怎么样？", opts: ["各地不同", "是统一的", "非常难", "已经消失了"], c: 1 }
            ]
        },
    ],

    advanced: [
        {
            id: 'ca1', emoji: '🖊️', title: '学术写作 (Academic Writing)', desc: "Akademik yozuv",
            level: 'advanced', words: ['然而', '而且', '因此', '细微差别', '雄辩', '减轻', '史无前例', '一丝不苟', '机会', '虽然'],
            xp: 200, coin: 90,
            grammar_rule: "承接词: 首先(birinchidan), 其次(ikkinchidan), 最后(nihoyat), 然而(biroq), 因此(shuning uchun), 总之(xulosa qilib aytganda).",
            grammar_example: "研究表明，气候变化正在加速。此外，前人的研究证实了这些发现。",
            reading_text: "学术写作需要精确性和逻辑连贯性。每个论点都必须有证据支撑。连接词连接想法：「而且」添加信息，「然而」引入对比。段落结构遵循「总-分-总」模式：先提出主题句，然后展开论述，最后总结。在中国学术界，引用经典文献被认为是增加论文权威性的重要方式。",
            reading_qs: [
                { q: "「而且」表示什么？", opts: ["对比", "结果", "附加信息", "条件"], c: 2 },
                { q: "「总-分-总」是什么模式？", opts: ["一种结束方式", "段落结构", "一种引用方式", "标题格式"], c: 1 },
                { q: "每个论点需要什么？", opts: ["一个故事", "证据", "意见", "幽默"], c: 1 }
            ]
        },
        {
            id: 'ca2', emoji: '📋', title: 'HSK写作 (HSK Writing)', desc: "HSK yozuv darsi",
            level: 'advanced', words: ['然而', '而且', '因此', '细微差别', '雄辩', '减轻', '史无前例', '一丝不苟', '机会', '虽然'],
            xp: 250, coin: 110,
            grammar_rule: "HSK 5-6: 复杂句式, 被动句(被 + V), 把字句(把 + O + V), 使兼句(使/让/叫/令 + ...).",
            grammar_example: "总体而言，中国互联网用户数量在2000至2020年间急剧增加。",
            reading_text: "HSK（汉语水平考试）是中国最重要的中文水平测试。写作部分要求考生写一篇文章，阐述自己的观点。你需要在规定时间内写出至少150个汉字。先写总体概述，再展开论述。写作要客观，逻辑清晰，有充分的论据支持。",
            reading_qs: [
                { q: "HSK写作要写多少汉字？", opts: ["100字", "至少150字", "200字", "250字"], c: 1 },
                { q: "什么是总体概述？", opts: ["所有数据描述", "引言", "主要趋势不含细节", "你的意见"], c: 2 },
                { q: "写作应该怎样？", opts: ["主观的", "有争议的", "客观有逻辑的", "非正式的"], c: 2 }
            ]
        },
    ]
};

// ══════════════════════════════════════════════════
// GRAMMATIKA SAVOLLARI (xitoy tilida)
// ══════════════════════════════════════════════════
const GRAMMAR_QS = [
    { q: "她 ___ 每天去学校。", opts: ["都", "也", "还", "很"], ans: "都", exp: "都 = har doim, hammasi; takror harakatlar uchun." },
    { q: "我 ___ 学生。", opts: ["是", "有", "在", "好"], ans: "是", exp: "我是学生 — Men talabaman. 是 = to be." },
    { q: "他们 ___ 我的朋友。", opts: ["是", "有", "在", "做"], ans: "是", exp: "他们是我的朋友 — Ular mening do'stlarim." },
    { q: "我现在 ___ 吃饭。", opts: ["在", "是", "有", "很"], ans: "在", exp: "在 + V = hozir qilmoqda (davom). 我在吃饭 = Men ovqat yeyapman." },
    { q: "我 ___ 在北京住了五年。", opts: ["就", "已经", "才", "都"], ans: "已经", exp: "已经 = allaqachon. Present Perfect uchun ishlatiladi." },
    { q: "如果我 ___ 钱，我就买那本书。", opts: ["有", "是", "在", "做"], ans: "有", exp: "有 = bor. Shartli gap: 如果...就... = Agar...bo'lsa..." },
    { q: "这份报告 ___ 经理写的。", opts: ["被", "把", "让", "给"], ans: "被", exp: "被字句 — passiv: 被 + bajaruvchi + V. Bu hisobot menejer tomonidan yozildi." },
    { q: "她是班上 ___ 聪明的学生。", opts: ["更", "很", "最", "比较"], ans: "最", exp: "Superlativ: 最 + sifat = eng ... 最聪明 = eng aqlli." },
    { q: "到明天，我 ___ 完成这个项目了。", opts: ["会", "要", "将会", "就"], ans: "将会", exp: "将会 + V + 了 = kelajak mukammal — ... qilgan bo'ladi." },
    { q: "___ 她到来，我们就开始吃饭。", opts: ["因为", "虽然", "一旦", "但是"], ans: "一旦", exp: "一旦 = ... bo'lgach / Cuanto. Vaqt bog'lovchisi." },
    { q: "他建议她 ___ 看医生。", opts: ["去", "要去", "去过", "去了"], ans: "去", exp: "建议 + 她 + V (asos fe'l). Subjunctive o'xshash ishlat." },
    { q: "我 ___ 没去过英国。", opts: ["一直", "从来", "已经", "还"], ans: "从来", exp: "从来没 + V + 过 = hech qachon ... qilmagan. 从来没去过 = Hech qachon bormagan." },
    { q: "这是 ___ 雨伞。", opts: ["一把", "一个", "一张", "一条"], ans: "一把", exp: "量词: 雨伞用「把」. Soyabon uchun 把 ishlatiladi." },
    { q: "不仅她唱得好，___ 跳舞也很好。", opts: ["而且", "但是", "所以", "因为"], ans: "而且", exp: "不仅...而且... = nafaqat ... balki ham ... Parallel bog'lovchi." },
    { q: "越努力，___ 你会取得成就。", opts: ["越多", "更多", "最多", "很多"], ans: "越多", exp: "越...越... = qancha ... shuncha ... Ikki karra qiyoslov." },
];

// ══════════════════════════════════════════════════
// UTILS
// ══════════════════════════════════════════════════
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
    u.lang = 'zh-CN'; u.rate = 0.8;
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

// ══════════════════════════════════════════════════
// TOKEN HELPERS
// ══════════════════════════════════════════════════
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

// ══════════════════════════════════════════════════
// TOKEN EMPTY MODAL
// ══════════════════════════════════════════════════
function showTokenEmptyModal(reason) {
    const modal = $id('upgradeModal'); if (!modal) return;
    const textEl = $id('upgradeModalText'); const timerEl = $id('upgradeTimer');
    if (textEl) textEl.innerHTML = `🎫 Tokenlar tugadi!<br><span style="font-size:0.8rem;color:#666">${reason || 'Davom etish uchun token kerak'}</span>`;
    if (timerEl) {
        const upd = () => { timerEl.textContent = `⏱ Yangilanish: ${getTokenTimeLeft()}`; };
        upd(); const timer = setInterval(() => { upd(); if (UTokens > 0) clearInterval(timer); }, 1000);
    }
    modal.classList.add('active');
}
window.closeUpgradeModal = function (e) {
    if (e && e.target !== $id('upgradeModal')) return;
    $id('upgradeModal')?.classList.remove('active');
};

// ══════════════════════════════════════════════════
// FIREBASE LOAD / SAVE
// ══════════════════════════════════════════════════
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
            UXP = d.xp || 0; UCoin = d.coins || 0; URank = d.rank || 'none';
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
            UTokens = TOKEN_CONFIG.default_tokens; UMaxTokens = TOKEN_CONFIG.default_tokens; ULastReset = Date.now();
        }
        checkTokenReset();
    } catch (e) { console.error('loadUserData error:', e); }
}

async function updateUserField(fields) {
    if (!CU) return;
    try { await updateDoc(doc(_db, 'users', CU.uid), { ...fields, lastActive: serverTimestamp() }); }
    catch (e) { console.warn(e); }
}

// ══════════════════════════════════════════════════
// XP & COIN
// ══════════════════════════════════════════════════
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
    const xpEl = $id('xpDisplay'); if (xpEl) xpEl.textContent = UXP;
    renderTokenBar(); drawRadar();
    const navUInfo = $id('navUserInfo'); const planBadge = $id('planBadgeNav');
    const plan = (UP || 'free').toLowerCase();
    const color = PLAN_COLORS[plan] || '#94a3b8';
    if (planBadge) planBadge.innerHTML = `<span style="padding:3px 10px;border-radius:12px;background:${color}22;border:1px solid ${color}55;color:${color};font-size:0.72rem;font-weight:700">${(PLAN_LABELS[plan] || plan).toUpperCase()}</span>`;
    if (navUInfo) navUInfo.innerHTML = `<div style="display:flex;align-items:center;gap:8px">
        <span style="font-size:0.8rem;color:#e8ecff;font-weight:600">${CU?.displayName || CU?.email || 'User'}</span>
        <span style="font-size:0.78rem;color:#f5c842">⭐ ${UXP.toLocaleString()}</span>
        <span style="font-size:0.78rem;color:#fbbf24">🪙 ${UCoin.toLocaleString()}</span>
    </div>`;
    const navXP = $id('navXP'); if (navXP) navXP.textContent = UXP.toLocaleString();
    const navCoin = $id('navCoin'); if (navCoin) navCoin.textContent = UCoin.toLocaleString();
    // Drawer sync
    const dXP = $id('drawerXP'); const dCoin = $id('drawerCoin');
    if (dXP) dXP.textContent = UXP.toLocaleString();
    if (dCoin) dCoin.textContent = UCoin.toLocaleString();
    const dName = $id('drawerUserName');
    if (dName) dName.textContent = CU?.displayName || CU?.email || 'Mehmon';
}

// ══════════════════════════════════════════════════
// LEADERBOARD — Ko'p foydalanuvchi uchun optimallashtirilgan
// orderBy + limit(50) — index muammosi yo'q
// ══════════════════════════════════════════════════
window.loadLBSection = async function (field, btn) {
    if (btn) {
        document.querySelectorAll('#leaderboard-section .ptab').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
    }
    const container = $id('lbSectionContent'); if (!container) return;
    container.innerHTML = `<div style="text-align:center;padding:30px;color:#666">
        <i class="fa-solid fa-spinner fa-spin" style="font-size:1.5rem;color:#a78bfa"></i>
        <br><span style="font-family:'Exo 2',sans-serif;font-size:0.82rem;color:#888;margin-top:8px;display:block">Yuklanmoqda...</span>
    </div>`;

    // Ko'p foydalanuvchilar uchun: compound index muammosini hal qilish
    // Faqat mavjud field bo'yicha sort qilamiz, limit 50 bilan
    const validFields = ['xp', 'coins', 'totalXP', 'totalCoins'];
    const sortField = validFields.includes(field) ? field : 'xp';

    try {
        // Firestore index talab qilmaydigan oddiy query
        const q = query(
            collection(_db, 'users'),
            orderBy(sortField, 'desc'),
            limit(50)
        );
        const snap = await getDocs(q);
        const users = snap.docs.map(d => ({ id: d.id, ...d.data() }));

        // stats.unitsCompleted uchun client-side sort
        let filteredUsers = users;
        if (field === 'unitsCompleted') {
            filteredUsers = [...users].sort((a, b) => {
                const av = a.stats?.unitsCompleted || 0;
                const bv = b.stats?.unitsCompleted || 0;
                return bv - av;
            });
        }

        if (!filteredUsers.length) {
            container.innerHTML = '<p style="text-align:center;color:#666;padding:30px">Hali hech kim yo\'q</p>';
            return;
        }

        const labels = { xp: 'XP', coins: 'Coin', totalXP: 'Jami XP', totalCoins: 'Jami Coin', unitsCompleted: 'Unit' };
        const icons = { xp: 'fa-star', coins: 'fa-coins', totalXP: 'fa-star', totalCoins: 'fa-coins', unitsCompleted: 'fa-book' };
        const icon = icons[field] || 'fa-star';
        const label = labels[field] || field;

        let html = `<div style="margin-bottom:16px;display:flex;justify-content:space-between;align-items:center">
            <span style="color:#666;font-size:0.8rem"><i class="fa-solid ${icon}" style="margin-right:4px;color:#a78bfa"></i>${label} reytingi</span>
            <span style="color:#666;font-size:0.78rem">${filteredUsers.length} foydalanuvchi</span>
        </div>`;

        filteredUsers.slice(0, 30).forEach((u, i) => {
            const rank = i + 1;
            const isMe = u.id === CU?.uid;
            const rankClass = rank === 1 ? 'gold' : rank === 2 ? 'silver' : rank === 3 ? 'bronze' : '';
            const rankIcon = rank === 1
                ? '<i class="fa-solid fa-trophy" style="color:#f5c842"></i>'
                : rank === 2 ? '<i class="fa-solid fa-medal" style="color:#94a3b8"></i>'
                    : rank === 3 ? '<i class="fa-solid fa-medal" style="color:#cd7c4a"></i>'
                        : rank;

            // field qiymati olish (stats ichidagi ham bo'lishi mumkin)
            let val = 0;
            if (field === 'unitsCompleted') val = u.stats?.unitsCompleted || 0;
            else val = u[field] || 0;

            const planKey = (u.plan || 'free').toLowerCase();
            const pc = PLAN_COLORS[planKey] || '#94a3b8';
            const planLabel = PLAN_LABELS[planKey] || planKey.toUpperCase();
            const initial = (u.displayName || u.email || 'U').charAt(0).toUpperCase();

            // Avatar rangi — rank bo'yicha
            const avatarGrad = rank === 1 ? 'linear-gradient(135deg,#f5c842,#e8a800)'
                : rank === 2 ? 'linear-gradient(135deg,#94a3b8,#64748b)'
                    : rank === 3 ? 'linear-gradient(135deg,#cd7c4a,#92400e)'
                        : 'linear-gradient(135deg,#5b7cfa,#a78bfa)';

            html += `<div class="lb-row${isMe ? ' me' : ''}" style="${isMe ? 'background:rgba(91,124,250,0.1);border-color:rgba(91,124,250,0.28);' : ''}">
                <div class="lb-rank ${rankClass}" style="width:36px;text-align:center;font-weight:800">${rankIcon}</div>
                <div style="width:38px;height:38px;border-radius:50%;background:${avatarGrad};display:flex;align-items:center;justify-content:center;font-weight:700;color:#fff;flex-shrink:0;font-size:1rem">${initial}</div>
                <div style="flex:1;min-width:0">
                    <div style="font-weight:700;font-size:0.88rem;color:#e8ecff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
                        ${u.displayName || u.email || 'Foydalanuvchi'}
                        ${isMe ? ' <span style="color:#a78bfa;font-size:0.72rem">(siz)</span>' : ''}
                    </div>
                    ${planKey !== 'free' ? `<span style="font-size:0.68rem;padding:2px 8px;border-radius:100px;background:${pc}22;border:1px solid ${pc}44;color:${pc}">${planLabel}</span>` : ''}
                </div>
                <div style="text-align:right;flex-shrink:0">
                    <div style="font-weight:700;font-size:0.95rem;color:#a78bfa">
                        <i class="fa-solid ${icon}" style="margin-right:4px;font-size:0.8rem"></i>${val.toLocaleString()}
                    </div>
                    <div style="font-size:0.65rem;color:#555">${label}</div>
                </div>
            </div>`;
        });

        // Agar men ro'yxatda yo'q bo'lsam, oxirida ko'rsatish
        if (CU) {
            const myIdx = filteredUsers.findIndex(u => u.id === CU.uid);
            if (myIdx > 29) {
                const me = filteredUsers[myIdx];
                let myVal = field === 'unitsCompleted' ? me.stats?.unitsCompleted || 0 : me[field] || 0;
                html += `<div style="text-align:center;color:#666;font-size:0.78rem;padding:8px">...</div>
                <div class="lb-row me" style="background:rgba(91,124,250,0.1);border-color:rgba(91,124,250,0.28)">
                    <div class="lb-rank" style="width:36px;text-align:center;font-weight:800;color:#a78bfa">${myIdx + 1}</div>
                    <div style="width:38px;height:38px;border-radius:50%;background:linear-gradient(135deg,#5b7cfa,#a78bfa);display:flex;align-items:center;justify-content:center;font-weight:700;color:#fff;flex-shrink:0">${(me.displayName || me.email || 'U').charAt(0).toUpperCase()}</div>
                    <div style="flex:1"><div style="font-weight:700;font-size:0.88rem;color:#e8ecff">${me.displayName || me.email} <span style="color:#a78bfa;font-size:0.72rem">(siz)</span></div></div>
                    <div style="text-align:right"><div style="font-weight:700;color:#a78bfa"><i class="fa-solid ${icon}" style="margin-right:4px;font-size:0.8rem"></i>${myVal.toLocaleString()}</div></div>
                </div>`;
            }
        }

        container.innerHTML = html;
    } catch (e) {
        // Index xatosi bo'lsa, fallback — xp bo'yicha yukla
        if (e.code === 'failed-precondition' || e.message?.includes('index')) {
            container.innerHTML = `<div style="text-align:center;padding:20px;color:#f5c842;font-size:0.82rem">
                ⚠️ Bu maydon uchun Firestore index yo'q. XP bo'yicha yuklanmoqda...
            </div>`;
            setTimeout(() => window.loadLBSection('xp', null), 1500);
        } else {
            container.innerHTML = `<div style="text-align:center;padding:30px;color:#ef4444">
                <i class="fa-solid fa-triangle-exclamation"></i> Xatolik: ${e.message}
                <br><button onclick="window.loadLBSection('xp',null)" style="margin-top:12px;padding:8px 16px;border-radius:8px;background:#a78bfa22;border:1px solid #a78bfa44;color:#a78bfa;cursor:pointer;font-family:inherit">Qayta urinish</button>
            </div>`;
        }
    }
};

// ══════════════════════════════════════════════════
// AI — PROXY
// ══════════════════════════════════════════════════
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
    } catch (e) { return "❗ AI bilan bog'lanishda xatolik."; }
}

// ══════════════════════════════════════════════════
// RADAR CHART
// ══════════════════════════════════════════════════
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
    ctx.closePath(); ctx.fillStyle = 'rgba(220,38,38,0.2)'; ctx.fill();
    ctx.strokeStyle = 'rgba(220,38,38,0.7)'; ctx.lineWidth = 2; ctx.stroke();
    angles.forEach((a, i) => { ctx.beginPath(); ctx.arc(cx + r * skills[i] * Math.cos(a), cy + r * skills[i] * Math.sin(a), 4, 0, Math.PI * 2); ctx.fillStyle = '#ef4444'; ctx.fill(); });
}

// ══════════════════════════════════════════════════
// UNITS
// ══════════════════════════════════════════════════
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
        grid.innerHTML = `<div style="text-align:center;padding:40px;color:#666;grid-column:1/-1">
            <i class="fa-solid fa-book-open" style="font-size:2rem;color:#a78bfa;display:block;margin-bottom:12px"></i>
            <span style="font-family:'Exo 2',sans-serif;font-size:0.82rem">Tez kunda qo'shiladi...</span>
        </div>`; return;
    }
    units.forEach((unit, i) => {
        const done = ['A', 'B', 'C', 'D'].filter(l => UProg[`${unit.id}_${l}`] >= 100).length;
        const pct = Math.round((done / 4) * 100);
        const isComp = pct === 100;
        const card = document.createElement('div');
        card.className = `unit-card${isComp ? ' completed' : ''}`;
        card.innerHTML = `
          <div style="font-size:0.75rem;color:#ef4444;margin-bottom:4px">Unit ${i + 1}</div>
          <div style="font-size:1.8rem;margin-bottom:8px">${unit.emoji}</div>
          <div style="font-weight:700;font-size:1rem;color:#e8ecff;margin-bottom:4px">${unit.title}</div>
          <div style="font-size:0.78rem;color:#666;margin-bottom:10px">${unit.desc}</div>
          <div style="display:flex;gap:6px;margin-bottom:8px">
            ${['A', 'B', 'C', 'D'].map(l => `<div style="width:22px;height:22px;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:0.65rem;font-weight:700;background:${UProg[unit.id + '_' + l] >= 100 ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.05)'};border:1px solid ${UProg[unit.id + '_' + l] >= 100 ? '#ef4444' : 'rgba(255,255,255,0.1)'};color:${UProg[unit.id + '_' + l] >= 100 ? '#ef4444' : '#666'}">${l}</div>`).join('')}
          </div>
          <div style="height:3px;background:rgba(255,255,255,0.06);border-radius:100px;overflow:hidden;margin-bottom:8px">
            <div style="height:100%;width:${pct}%;background:linear-gradient(90deg,#ef4444,#f97316);border-radius:100px;transition:width 0.4s"></div>
          </div>
          <div style="font-size:0.76rem;display:flex;gap:10px">
            <span style="color:#f5c842">+${unit.xp} XP</span>
            <span style="color:#fbbf24">+${unit.coin} 🪙</span>
            ${isComp ? '<span style="color:#34d399">✅</span>' : ''}
          </div>`;
        card.onmouseover = () => { card.style.background = 'rgba(239,68,68,0.06)'; card.style.borderColor = 'rgba(239,68,68,0.3)'; };
        card.onmouseout = () => { card.style.background = ''; card.style.borderColor = ''; };
        card.onclick = () => openUnit(unit);
        grid.appendChild(card);
    });
}

window.openUnit = function (unit) {
    curUnit = unit;
    const modal = $id('unitModal'); const content = $id('modalContent');
    if (!modal || !content) return;
    const lnames = { A: "📖 Grammatika & Lug'at", B: "🎧 Listening", C: "📖 Reading", D: "🎤 Speaking & Writing" };
    const lcolors = { A: '#ef4444', B: '#22d3ee', C: '#34d399', D: '#f472b6' };
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
        return `<div onclick="window.openLesson('${unit.id}','${k}')" style="padding:16px;border-radius:12px;background:${done ? 'rgba(239,68,68,0.08)' : 'rgba(255,255,255,0.03)'};border:1px solid ${done ? 'rgba(239,68,68,0.3)' : 'rgba(255,255,255,0.08)'};cursor:pointer;transition:all 0.2s" onmouseover="this.style.borderColor='${lcolors[k]}55'" onmouseout="this.style.borderColor='${done ? 'rgba(239,68,68,0.3)' : 'rgba(255,255,255,0.08)'}'">
                <div style="font-size:1.2rem;font-weight:800;color:${lcolors[k]};margin-bottom:4px">${k}</div>
                <div style="font-size:0.8rem;color:#e8ecff">${lnames[k]}</div>
                ${done ? `<div style="font-size:0.72rem;color:#34d399;margin-top:4px">✅ ${sc}%</div>` : '<div style="font-size:0.72rem;color:#666;margin-top:4px">▶ Boshlash</div>'}
            </div>`;
    }).join('')}
      </div>
      <div>
        <div style="font-size:0.78rem;color:#666;margin-bottom:8px">📝 So'zlar (汉字):</div>
        <div style="display:flex;flex-wrap:wrap;gap:6px">
          ${unit.words.map(w => {
        const wd = WDB.find(x => x.e === w);
        const py = wd ? wd.py : '';
        return `<div onclick="window.spk('${w}',event)" style="background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.2);color:#fca5a5;padding:4px 10px;border-radius:20px;font-size:0.82rem;cursor:pointer;text-align:center">
                <div>${w}</div><div style="font-size:0.6rem;color:#ef4444">${py}</div>
            </div>`;
    }).join('')}
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
    curUnit = unit; lScore = 0; lTotal = 0; lexSel = {}; rSel = {}; woAns = []; lessonMics = {};
    showLessonModal(unit, lessonKey);
};

function showLessonModal(unit, lk) {
    const modal = $id('unitModal'); const content = $id('modalContent');
    if (!modal || !content) return;
    const lnames = { A: "📖 Grammatika & Lug'at", B: "🎧 Listening", C: "📖 Reading", D: "🎤 Speaking & Writing" };
    content.innerHTML = `<div>
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px;padding-bottom:12px;border-bottom:1px solid rgba(255,255,255,0.08)">
        <button onclick="window.openUnit(window.__curUnit)" style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);color:#e8ecff;padding:6px 12px;border-radius:8px;cursor:pointer;font-size:0.8rem;font-family:inherit">← Orqaga</button>
        <div style="font-weight:700">${unit.emoji} ${unit.title} — ${lnames[lk]}</div>
        <span style="margin-left:auto;font-size:0.72rem;color:#ef4444;background:rgba(239,68,68,0.1);padding:3px 10px;border-radius:20px">${unit.level}</span>
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

// ─── LESSON A ─── Grammatika & Lug'at
function lessonA(unit) {
    const words = unit.words.slice(0, 12);
    const fills = words.slice(0, 4).map((w, i) => {
        const wd = WDB.find(x => x.e === w) || { ex: `用"${w}"造句。`, eu: '', u: '', py: '' };
        const blank = wd.ex.replace(new RegExp(w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), '_______');
        return `<div style="margin-bottom:14px;padding:14px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:12px">
          <div style="font-size:0.9rem;margin-bottom:4px">${i + 1}. ${blank}</div>
          <div style="font-size:0.75rem;color:#666;margin-bottom:8px;font-style:italic">${wd.eu}</div>
          <input id="gex${i}" data-ans="${w}" placeholder="Javobingiz (汉字)..." style="width:100%;padding:8px 12px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:8px;color:#e8ecff;font-family:inherit;margin-bottom:8px;box-sizing:border-box">
          <div style="display:flex;gap:6px">
            <button onclick="window.chkFill(${i})" style="padding:6px 14px;border-radius:8px;background:rgba(52,211,153,0.1);border:1px solid rgba(52,211,153,0.3);color:#34d399;cursor:pointer;font-size:0.78rem;font-family:inherit">✓ Tekshir</button>
            <button onclick="window.aiExWord('${w}',event)" style="padding:6px 14px;border-radius:8px;background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.2);color:#ef4444;cursor:pointer;font-size:0.78rem;font-family:inherit">🤖 AI</button>
            <button onclick="window.spk('${w}',event)" style="padding:6px 14px;border-radius:8px;background:rgba(96,165,250,0.1);border:1px solid rgba(96,165,250,0.2);color:#60a5fa;cursor:pointer;font-size:0.78rem;font-family:inherit">🔊</button>
          </div>
          <div id="gexfb${i}" style="margin-top:6px;font-size:0.8rem"></div>
        </div>`;
    }).join('');

    const matchW = words.slice(0, 6);
    const shuffUZ = shuffle(matchW.map(w => { const d = WDB.find(x => x.e === w); return d ? d.uz : w; }));

    return `
    <div style="margin-bottom:20px">
      <h3 style="margin-bottom:12px;color:#e8ecff">📚 汉字 Lug'at</h3>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:10px">
        ${words.map(w => {
        const d = WDB.find(x => x.e === w) || { uz: '', t: '', ex: '', py: '' };
        return `<div style="padding:14px;border-radius:12px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06)">
              <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:2px">
                <span style="font-weight:700;font-size:1.3rem;color:#e8ecff">${w}</span>
                <button onclick="window.spk('${w}',event)" style="background:none;border:none;cursor:pointer;font-size:1rem">🔊</button>
              </div>
              <div style="color:#ef4444;font-size:0.78rem;margin-bottom:2px">${d.py}</div>
              <div style="color:#a78bfa;font-size:0.8rem;margin-bottom:3px">${d.uz}</div>
              <div style="color:#666;font-size:0.7rem;font-style:italic">"${d.ex}"</div>
            </div>`;
    }).join('')}
      </div>
    </div>
    <div style="margin-bottom:20px;padding:16px;background:rgba(239,68,68,0.05);border:1px solid rgba(239,68,68,0.15);border-radius:12px">
      <h3 style="margin-bottom:10px;color:#e8ecff">📝 Grammatika Qoidasi</h3>
      <div style="font-size:0.9rem;color:#fca5a5;margin-bottom:8px">💡 ${unit.grammar_rule || ''}</div>
      <div style="font-size:0.85rem;color:#ef4444;font-style:italic">✏️ ${unit.grammar_example || ''}</div>
      <button onclick="window.aiGrammarExplain('${unit.title.replace(/'/g, "\\'")}','${(unit.grammar_rule || '').replace(/'/g, "\\'")}',event)" style="margin-top:10px;padding:8px 16px;border-radius:8px;background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.2);color:#ef4444;cursor:pointer;font-size:0.78rem;font-family:inherit">🤖 AI batafsil tushuntirsin (1 token)</button>
      <div id="gramRuleFB" style="margin-top:8px;font-size:0.8rem"></div>
    </div>
    <div style="margin-bottom:20px">
      <h3 style="margin-bottom:12px;color:#e8ecff">✏️ To'ldirish Mashqlari</h3>
      ${fills}
      <div id="vocabAIFB" style="font-size:0.8rem"></div>
    </div>
    <div style="margin-bottom:20px">
      <h3 style="margin-bottom:12px;color:#e8ecff">🧩 Juftlash (汉字 ↔ O'zbek)</h3>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        <div>${matchW.map((w, i) => `<div class="match-item eng" data-i="${i}" onclick="window.selMatch(this,'e',${i})" style="padding:10px 14px;border-radius:10px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);cursor:pointer;margin-bottom:6px;font-size:1rem;color:#e8ecff;transition:all 0.2s;text-align:center">${w}</div>`).join('')}</div>
        <div>${shuffUZ.map(u => `<div class="match-item uz" data-u="${u}" onclick="window.selMatch(this,'u','${u.replace(/'/g, "\\'")}')" style="padding:10px 14px;border-radius:10px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);cursor:pointer;margin-bottom:6px;font-size:0.82rem;color:#c4b5fd;transition:all 0.2s">${u}</div>`).join('')}</div>
      </div>
      <div id="matchFB" style="margin-top:8px;font-size:0.8rem"></div>
    </div>
    <button onclick="window.finLessonA('${unit.id}')" style="width:100%;padding:14px;border-radius:12px;background:linear-gradient(135deg,#ef4444,#f97316);border:none;color:#fff;font-size:0.95rem;font-weight:700;cursor:pointer;font-family:inherit">✅ Grammatika darsini yakunlash</button>`;
}

window.chkFill = function (i) {
    const inp = $id(`gex${i}`); const fb = $id(`gexfb${i}`); if (!inp || !fb) return;
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
        document.querySelectorAll('.match-item.eng').forEach(x => { x.style.background = 'rgba(255,255,255,0.04)'; x.style.borderColor = 'rgba(255,255,255,0.1)'; });
        el.style.background = 'rgba(239,68,68,0.2)'; el.style.borderColor = '#ef4444';
        mSel.e = val; mSel.eEl = el;
    } else {
        document.querySelectorAll('.match-item.uz').forEach(x => { x.style.background = 'rgba(255,255,255,0.04)'; x.style.borderColor = 'rgba(255,255,255,0.1)'; });
        el.style.background = 'rgba(167,139,250,0.2)'; el.style.borderColor = '#a78bfa';
        mSel.u = val; mSel.uEl = el;
    }
    if (mSel.e !== null && mSel.u !== null) {
        const w = (curUnit?.words || [])[mSel.e];
        const wd = WDB.find(x => x.e === w);
        if (wd && wd.uz === mSel.u) {
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

window.aiGrammarExplain = async function (title, rule, e) {
    if (e) e.stopPropagation();
    const ok = await spendTokens(TOKEN_CONFIG.ai_cost, 'AI grammatika izoh'); if (!ok) return;
    const fb = $id('gramRuleFB'); if (fb) fb.innerHTML = '🤖 AI tahlil qilmoqda...';
    const r = await callAI(`"${title}" mavzusida "${rule}" xitoy tili grammatika qoidasini ${NATIVE_LANG} tilida (javob shu tilda bo'lsin) tushuntir. 3 ta misol xitoycha va o'zbekcha keltir.`, 800);
    if (fb) fb.innerHTML = r.replace(/\n/g, '<br>');
};

window.aiExWord = async function (word, e) {
    if (e) e.stopPropagation();
    const ok = await spendTokens(TOKEN_CONFIG.ai_cost, `"${word}" AI izoh`); if (!ok) return;
    const fb = $id('vocabAIFB') || $id('wordAIFB');
    if (fb) fb.innerHTML = `🤖 "${word}" tahlil qilmoqda...`;
    const wd = WDB.find(x => x.e === word);
    const py = wd ? wd.py : '';
    const r = await callAI(`Xitoy so'zi "${word}" (pinyin: ${py}) haqida ${NATIVE_LANG} tilida (javob shu tilda bo'lsin): 1) Ma'nosi 2) 3 ta misol jumla (xitoycha + o'zbekcha) 3) Eslatma va qo'shimcha ma'lumot`, 600);
    if (fb) fb.innerHTML = r.replace(/\n/g, '<br>');
};

window.finLessonA = async function (uid) { await finLesson(uid, 'A', 'grammar', lScore, lTotal || 4); };

// ─── LESSON B ─── Listening
function lessonB(unit) {
    const exs = genListenExs(unit);
    window.__listenExs = exs;
    return `
    <div style="margin-bottom:20px">
      <h3 style="margin-bottom:12px;color:#e8ecff">🎧 Listening Mashqi</h3>
      <div id="lexCont">${renderLex(exs, 0)}</div>
    </div>
    <div style="margin-bottom:20px;padding:16px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:12px">
      <h3 style="margin-bottom:12px;color:#e8ecff">✍️ Diktant (听写)</h3>
      <div style="font-size:0.78rem;color:#666;margin-bottom:10px">Audio tinglang va xitoycha yozing</div>
      <div style="display:flex;gap:8px;margin-bottom:12px">
        <button onclick="window.playDict('${unit.id}','normal')" style="padding:8px 16px;border-radius:8px;background:rgba(96,165,250,0.1);border:1px solid rgba(96,165,250,0.2);color:#60a5fa;cursor:pointer;font-size:0.82rem;font-family:inherit">▶ Tinglash</button>
        <button onclick="window.playDict('${unit.id}','slow')" style="padding:8px 16px;border-radius:8px;background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.2);color:#ef4444;cursor:pointer;font-size:0.82rem;font-family:inherit">🐌 Sekin</button>
      </div>
      <textarea id="dictIn" placeholder="Eshitgangizni yozing (汉字)..." style="width:100%;height:80px;padding:10px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:8px;color:#e8ecff;font-family:inherit;resize:none;box-sizing:border-box"></textarea>
      <div style="display:flex;gap:6px;margin-top:8px">
        <button onclick="window.chkDict()" style="padding:7px 14px;border-radius:8px;background:rgba(52,211,153,0.1);border:1px solid rgba(52,211,153,0.3);color:#34d399;cursor:pointer;font-size:0.78rem;font-family:inherit">✓ Tekshir</button>
        <button onclick="window.aiChkDict()" style="padding:7px 14px;border-radius:8px;background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.2);color:#ef4444;cursor:pointer;font-size:0.78rem;font-family:inherit">🤖 AI tahlil (1 token)</button>
      </div>
      <div id="dictFB" style="margin-top:8px;font-size:0.8rem"></div>
    </div>
    <button onclick="window.finLessonB('${unit.id}')" style="width:100%;padding:14px;border-radius:12px;background:linear-gradient(135deg,#22d3ee,#ef4444);border:none;color:#fff;font-size:0.95rem;font-weight:700;cursor:pointer;font-family:inherit">✅ Listening yakunlash</button>`;
}

function genListenExs(unit) {
    const w = unit.words;
    const wd0 = WDB.find(x => x.e === w[0]) || { uz: w[0] };
    const wd1 = WDB.find(x => x.e === w[1]) || { uz: w[1] || w[0] };
    return [
        { text: `今天我们来学习${unit.title.split('(')[0].trim()}。"${w[0]}"这个词非常重要。`, q: `这段话主要是关于什么的？`, opts: [unit.title.split('(')[0], '运动', '烹饪', '旅行'], c: 0, tip: `"今天我们来学习..."` },
        { text: `你好！我叫小明。今天我来教你${w[0]}和${w[1] || w[0]}。首先，让我们看看"${w[0]}"。准备好了吗？`, q: `小明首先要教什么？`, opts: [`${w[2] || w[0]}`, `${w[0]}`, `${w[1] || w[0]}`, '什么都有'], c: 1, tip: `"首先，让我们看看..."` },
        { text: `${unit.title.split('(')[0].trim()}是一个很有趣的话题。如果你想提高你的中文，你每天都要练习。通过练习，一切都会变得容易。`, q: `通过练习，什么会变得容易？`, opts: [`${w[0]}`, `${wd0.uz}`, '一切', '什么都不会'], c: 2, tip: `"通过练习，一切都会变得容易"` }
    ];
}

function renderLex(exs, idx) {
    const ex = exs[idx];
    if (!ex) return '<div style="text-align:center;padding:20px;color:#34d399">🎉 Barcha listening mashqlari tugadi!</div>';
    return `<div style="padding:16px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:12px">
      <div style="font-size:0.75rem;color:#ef4444;margin-bottom:8px">Savol ${idx + 1}/${exs.length}</div>
      <div style="display:flex;gap:8px;margin-bottom:12px">
        <button onclick="window.playLex(${idx},'normal')" style="padding:8px 16px;border-radius:8px;background:rgba(96,165,250,0.1);border:1px solid rgba(96,165,250,0.2);color:#60a5fa;cursor:pointer;font-size:0.82rem;font-family:inherit">▶ Tinglash</button>
        <button onclick="window.playLex(${idx},'slow')" style="padding:8px 16px;border-radius:8px;background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.2);color:#ef4444;cursor:pointer;font-size:0.82rem;font-family:inherit">🐌 Sekin</button>
      </div>
      <div id="ltxt${idx}" style="display:none;padding:10px;background:rgba(255,255,255,0.04);border-radius:8px;font-size:0.9rem;color:#e8ecff;margin-bottom:10px;font-style:italic">${ex.text}</div>
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
    u.lang = 'zh-CN'; u.rate = speed === 'slow' ? 0.5 : 0.8;
    speechSynthesis.cancel(); speechSynthesis.speak(u);
};
window.selLex = function (el, qi, oi) {
    document.querySelectorAll(`.lex-opt[data-qi="${qi}"]`).forEach(o => { o.style.background = 'rgba(255,255,255,0.04)'; o.style.borderColor = 'rgba(255,255,255,0.08)'; });
    el.style.background = 'rgba(239,68,68,0.15)'; el.style.borderColor = '#ef4444';
    lexSel[qi] = oi;
};
window.chkLex = function (idx, correct) {
    const fb = $id(`lexfb${idx}`); const sel = lexSel[idx];
    if (sel === undefined) { if (fb) fb.innerHTML = '<span style="color:#f5c842">⚠️ Javob tanlang!</span>'; return; }
    document.querySelectorAll(`.lex-opt[data-qi="${idx}"]`).forEach((o, i) => {
        if (i === correct) { o.style.background = 'rgba(52,211,153,0.2)'; o.style.borderColor = '#34d399'; }
        else if (i === sel && sel !== correct) { o.style.background = 'rgba(239,68,68,0.2)'; o.style.borderColor = '#ef4444'; }
    });
    const txEl = $id(`ltxt${idx}`); if (txEl) txEl.style.display = 'block';
    if (sel === correct) { if (fb) fb.innerHTML = "<span style='color:#34d399'>✅ To'g'ri!</span>"; lScore++; awardXP(15, 'listening'); }
    else { if (fb) fb.innerHTML = `<span style="color:#ef4444">❌ To'g'ri: <strong>${String.fromCharCode(65 + correct)}</strong></span>`; }
    lTotal++;
    const nxt = $id(`lexnxt${idx}`); if (nxt) nxt.style.display = 'inline-flex';
};
window.nextLex = function (idx) { const exs = window.__listenExs || []; const cont = $id('lexCont'); if (cont) cont.innerHTML = renderLex(exs, idx); };

window.playDict = function (uid, speed) {
    let unit = null;
    for (const lvl of Object.values(UD_DATA)) { const f = lvl.find(u => u.id === uid); if (f) { unit = f; break; } }
    if (!unit) return;
    const wd = WDB.find(x => x.e === unit.words[0]);
    dictSent = wd ? wd.ex : `${unit.words[0]}很重要。`;
    const u2 = new SpeechSynthesisUtterance(dictSent);
    u2.lang = 'zh-CN'; u2.rate = speed === 'slow' ? 0.45 : 0.8;
    speechSynthesis.cancel(); speechSynthesis.speak(u2);
};

window.chkDict = function () {
    const inp = $id('dictIn'); const fb = $id('dictFB');
    if (!inp || !fb || !dictSent) { if (fb) fb.innerHTML = '<span style="color:#f5c842">⚠️ Avval audio tinglang!</span>'; return; }
    const correct = dictSent.replace(/[。，！？]/g, '');
    const user = inp.value.trim().replace(/[。，！？]/g, '');
    let mc = 0;
    const chars = correct.split('');
    const userChars = user.split('');
    const hl = chars.map(c => {
        if (userChars.includes(c)) { mc++; return `<span style="color:#34d399;font-weight:600">${c}</span>`; }
        return `<span style="color:#ef4444">${c}</span>`;
    }).join('');
    const pct = Math.round((mc / Math.max(chars.length, 1)) * 100);
    fb.innerHTML = `<div><strong>To'g'ri:</strong> ${hl}</div><div style="margin-top:6px"><strong>Siz:</strong> ${inp.value}</div><div style="font-size:0.9rem;font-weight:700;margin-top:6px;color:${pct >= 70 ? '#34d399' : '#ef4444'}">${pct}%</div>`;
    if (pct >= 70) { lScore++; awardXP(20, 'listening'); }
    lTotal++;
};

window.aiChkDict = async function () {
    const ok = await spendTokens(TOKEN_CONFIG.ai_cost, 'AI diktant tahlil'); if (!ok) return;
    const inp = $id('dictIn'); const fb = $id('dictFB');
    if (!inp?.value.trim()) { if (fb) fb.innerHTML = '<span style="color:#f5c842">Avval yozing!</span>'; return; }
    fb.innerHTML = '🤖 AI tahlil qilmoqda...';
    const r = await callAI(`Xitoy tili diktant tahlili (${NATIVE_LANG} tilida (javob shu tilda bo'lsin)):\nAsl: "${dictSent}"\nO'quvchi: "${inp.value.trim()}"\n1) Xatolari 2) Ball: /10 3) Maslahat`, 600);
    if (fb) fb.innerHTML = r.replace(/\n/g, '<br>');
};

window.finLessonB = async function (uid) { await finLesson(uid, 'B', 'listening', lScore, lTotal || 3); };

// ─── LESSON C ─── Reading
function lessonC(unit) {
    const qs = unit.reading_qs || [];
    const wh = unit.words.slice(0, 5);
    return `
    <div style="margin-bottom:20px">
      <h3 style="margin-bottom:12px;color:#e8ecff">📖 Matn o'qish (阅读)</h3>
      <div style="padding:16px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:12px">
        <div style="font-weight:700;font-size:1rem;margin-bottom:10px;color:#e8ecff">${unit.title}</div>
        <div id="rdbody" style="font-size:0.92rem;line-height:1.9;color:#c7d2fe">${unit.reading_text || ''}</div>
        <div style="display:flex;gap:6px;margin-top:12px">
          <button onclick="window.rdAloud()" style="padding:7px 14px;border-radius:8px;background:rgba(96,165,250,0.1);border:1px solid rgba(96,165,250,0.2);color:#60a5fa;cursor:pointer;font-size:0.78rem;font-family:inherit">🔊 Tinglash (中文)</button>
        </div>
      </div>
    </div>
    <div style="margin-bottom:20px">
      <h3 style="margin-bottom:12px;color:#e8ecff">❓ Savolar (问题)</h3>
      ${qs.map((q, qi) => `<div style="margin-bottom:14px;padding:14px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:12px">
        <div style="font-weight:600;margin-bottom:10px">${qi + 1}. ${q.q}</div>
        <div>${q.opts.map((o, oi) => `<div class="rq-opt" data-qi="${qi}" data-oi="${oi}" onclick="window.selRQ(this,${qi},${oi})" style="padding:10px 14px;border-radius:8px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);cursor:pointer;margin-bottom:6px;font-size:0.88rem;transition:all 0.2s">${String.fromCharCode(65 + oi)}. ${o}</div>`).join('')}</div>
        <div id="rqfb${qi}" style="margin-top:6px;font-size:0.8rem"></div>
      </div>`).join('')}
      <button onclick="window.chkAllRQ(${JSON.stringify(qs.map(q => q.c))})" style="padding:8px 16px;border-radius:8px;background:rgba(52,211,153,0.1);border:1px solid rgba(52,211,153,0.3);color:#34d399;cursor:pointer;font-size:0.82rem;font-family:inherit;margin-top:8px">✓ Hammasini tekshir</button>
      <div id="rdTotFB" style="margin-top:8px;font-size:0.8rem"></div>
    </div>
    <div style="margin-bottom:20px">
      <h3 style="margin-bottom:12px;color:#e8ecff">🔤 Pinyin yozish</h3>
      ${wh.map((w, i) => {
        const d = WDB.find(x => x.e === w) || { uz: w, py: '' };
        return `<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;flex-wrap:wrap">
          <span style="color:#ef4444;font-size:1rem;min-width:40px">${w}</span>
          <span style="color:#a78bfa;font-size:0.82rem;min-width:80px">${d.uz}</span>
          <input id="whi${i}" data-ans="${d.py}" placeholder="pinyin..." style="flex:1;min-width:120px;padding:8px 12px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:8px;color:#e8ecff;font-family:inherit">
          <button onclick="window.chkWH(${i})" style="padding:7px 12px;border-radius:8px;background:rgba(52,211,153,0.1);border:1px solid rgba(52,211,153,0.3);color:#34d399;cursor:pointer;font-size:0.78rem;font-family:inherit">✓</button>
          <button onclick="window.spk('${w}',event)" style="padding:7px 12px;border-radius:8px;background:rgba(96,165,250,0.1);border:1px solid rgba(96,165,250,0.2);color:#60a5fa;cursor:pointer;font-size:0.78rem;font-family:inherit">🔊</button>
          <span id="whfb${i}" style="font-size:0.8rem;min-width:30px"></span>
        </div>`;
    }).join('')}
    </div>
    <button onclick="window.finLessonC('${unit.id}')" style="width:100%;padding:14px;border-radius:12px;background:linear-gradient(135deg,#34d399,#22d3ee);border:none;color:#fff;font-size:0.95rem;font-weight:700;cursor:pointer;font-family:inherit">✅ Reading yakunlash</button>`;
}

window.rdAloud = function () {
    const b = $id('rdbody'); if (!b) return;
    const u = new SpeechSynthesisUtterance(b.textContent);
    u.lang = 'zh-CN'; u.rate = 0.8;
    speechSynthesis.cancel(); speechSynthesis.speak(u);
};
window.selRQ = function (el, qi, oi) {
    document.querySelectorAll(`.rq-opt[data-qi="${qi}"]`).forEach(o => { o.style.background = 'rgba(255,255,255,0.04)'; o.style.borderColor = 'rgba(255,255,255,0.08)'; });
    el.style.background = 'rgba(239,68,68,0.15)'; el.style.borderColor = '#ef4444';
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
        else { if (fb) fb.innerHTML = `<span style="color:#ef4444">❌ To'g'ri: ${String.fromCharCode(65 + correct)}</span>`; }
    });
    lScore += score; lTotal += answers.length;
    awardXP(score * 15, 'reading');
    const fb = $id('rdTotFB');
    if (fb) fb.innerHTML = `<span style="color:${score === answers.length ? '#34d399' : '#f5c842'}">Jami: ${score}/${answers.length}</span>`;
};
window.chkWH = function (i) {
    const inp = $id(`whi${i}`); const fb = $id(`whfb${i}`); if (!inp || !fb) return;
    // Pinyin tekshirish — ton belgilarisiz ham qabul qilinadi
    const userAns = inp.value.trim().toLowerCase().replace(/[āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ]/g, c =>
        'aaaaeeeeiiiioooouvvvv'['āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ'.indexOf(c)] || c);
    const correct = (inp.dataset.ans || '').toLowerCase().replace(/[āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ]/g, c =>
        'aaaaeeeeiiiioooouvvvv'['āáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ'.indexOf(c)] || c).replace(/\s/g, '');
    const userNoSpace = userAns.replace(/\s/g, '');
    if (userNoSpace === correct || inp.value.trim().toLowerCase() === inp.dataset.ans.toLowerCase()) {
        fb.innerHTML = '✅'; inp.style.borderColor = '#34d399'; awardXP(8, 'reading');
    } else { fb.innerHTML = `❌ <span style="color:#666;font-size:0.7rem">${inp.dataset.ans}</span>`; inp.style.borderColor = '#ef4444'; }
};
window.finLessonC = async function (uid) { await finLesson(uid, 'C', 'reading', lScore, lTotal || 6); };

// ─── LESSON D ─── Speaking & Writing
function lessonD(unit) {
    const topics = unit.words.slice(0, 3);
    const woSent = (WDB.find(x => x.e === unit.words[0])?.ex) || `我每天用${unit.words[0]}。`;
    window.__woCorrect = woSent;
    return `
    <div style="margin-bottom:20px">
      <h3 style="margin-bottom:12px;color:#e8ecff">🎤 Speaking (口语)</h3>
      ${topics.map((w, i) => {
        const d = WDB.find(x => x.e === w) || { uz: '', ex: '', py: '' };
        return `<div style="margin-bottom:14px;padding:14px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:12px">
          <div style="font-weight:600;margin-bottom:4px">${i + 1}. "${w}" so'zini ishlatib gaping:</div>
          <div style="font-size:0.78rem;color:#ef4444;margin-bottom:2px">${d.py}</div>
          <div style="font-size:0.78rem;color:#666;margin-bottom:10px">O'zbek: ${d.uz} · Misol: ${d.ex}</div>
          <div style="display:flex;gap:6px;margin-bottom:8px">
            <button id="mbtn${i}" onclick="window.togMic(${i})" style="padding:8px 16px;border-radius:8px;background:rgba(244,114,182,0.1);border:1px solid rgba(244,114,182,0.25);color:#f472b6;cursor:pointer;font-size:0.82rem;font-family:inherit">🎤 Gapirish</button>
            <button onclick="window.spk('${w}',event)" style="padding:8px 12px;border-radius:8px;background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.2);color:#ef4444;cursor:pointer;font-size:0.82rem;font-family:inherit">🔊</button>
          </div>
          <div id="mst${i}" style="font-size:0.75rem;color:#666"></div>
          <div id="mtr${i}" style="padding:8px;font-size:0.88rem;color:#c4b5fd;min-height:24px;border-radius:6px"></div>
          <div style="display:flex;gap:6px;margin-top:8px">
            <button onclick="window.aiSpk(${i},'${w}')" style="padding:6px 14px;border-radius:8px;background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.2);color:#ef4444;cursor:pointer;font-size:0.78rem;font-family:inherit">🤖 AI baholash (1 token)</button>
            <button onclick="window.markDone(${i})" style="padding:6px 14px;border-radius:8px;background:rgba(52,211,153,0.1);border:1px solid rgba(52,211,153,0.3);color:#34d399;cursor:pointer;font-size:0.78rem;font-family:inherit">✅ Bajarildi</button>
          </div>
          <div id="sfb${i}" style="margin-top:8px;font-size:0.82rem"></div>
        </div>`;
    }).join('')}
    </div>
    <div style="margin-bottom:20px">
      <h3 style="margin-bottom:12px;color:#e8ecff">✍️ Writing (写作)</h3>
      <div style="padding:14px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:12px">
        <div style="font-size:0.85rem;color:#aaa;margin-bottom:8px">Mavzu: "${unit.title.split('(')[0].trim()}" haqida 40+ belgilik matn yozing.</div>
        <textarea id="dta" placeholder="这里写作..." oninput="window.updWC()" style="width:100%;height:100px;padding:10px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:8px;color:#e8ecff;font-family:inherit;resize:none;box-sizing:border-box"></textarea>
        <div style="display:flex;gap:10px;font-size:0.75rem;color:#666;margin:6px 0"><span id="dwc">0 belgi</span><span id="dst" style="color:#f87171">Min 40 belgi</span></div>
        <div style="display:flex;gap:6px">
          <button onclick="window.aiWrit('${unit.title.replace(/'/g, "\\'")}','${unit.words.slice(0, 5).join(',')}')" style="padding:7px 14px;border-radius:8px;background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.2);color:#ef4444;cursor:pointer;font-size:0.78rem;font-family:inherit">🤖 AI (1 token)</button>
          <button onclick="window.selfChk(40)" style="padding:7px 14px;border-radius:8px;background:rgba(96,165,250,0.1);border:1px solid rgba(96,165,250,0.2);color:#60a5fa;cursor:pointer;font-size:0.78rem;font-family:inherit">📊 Belgi soni</button>
        </div>
        <div id="wfb" style="margin-top:8px;font-size:0.8rem"></div>
      </div>
    </div>
    <div style="margin-bottom:20px">
      <h3 style="margin-bottom:12px;color:#e8ecff">🔀 Jumla tartibi (排列句子)</h3>
      <div id="woChips" style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px">
        ${shuffle(woSent.split('')).filter(c => c.trim()).map(w => `<div class="wo-chip" data-w="${w}" onclick="window.selChip(this)" style="padding:8px 12px;border-radius:10px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);cursor:pointer;font-size:1.1rem;transition:all 0.2s">${w}</div>`).join('')}
      </div>
      <div id="woAnsDiv" style="min-height:44px;padding:10px;background:rgba(255,255,255,0.03);border:1px dashed rgba(255,255,255,0.1);border-radius:8px;display:flex;flex-wrap:wrap;gap:4px;font-size:0.9rem;color:#666;margin-bottom:8px"><span>Bu yerga bosing...</span></div>
      <div style="display:flex;gap:6px">
        <button onclick="window.chkWO()" style="padding:7px 14px;border-radius:8px;background:rgba(52,211,153,0.1);border:1px solid rgba(52,211,153,0.3);color:#34d399;cursor:pointer;font-size:0.78rem;font-family:inherit">✓ Tekshir</button>
        <button onclick="window.rstWO()" style="padding:7px 14px;border-radius:8px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);color:#e8ecff;cursor:pointer;font-size:0.78rem;font-family:inherit">🔄 Qayta</button>
        <button onclick="window.spk('${woSent}',event)" style="padding:7px 14px;border-radius:8px;background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.2);color:#ef4444;cursor:pointer;font-size:0.78rem;font-family:inherit">🔊</button>
      </div>
      <div id="wofb" style="margin-top:8px;font-size:0.8rem"></div>
    </div>
    <button onclick="window.finLessonD('${unit.id}')" style="width:100%;padding:14px;border-radius:12px;background:linear-gradient(135deg,#f472b6,#ef4444);border:none;color:#fff;font-size:0.95rem;font-weight:700;cursor:pointer;font-family:inherit">✅ Speaking & Writing yakunlash</button>`;
}

window.selChip = function (el) {
    if (el.classList.contains('used')) return;
    el.classList.add('used'); el.style.opacity = '0.3';
    woAns.push(el.dataset.w);
    const d = $id('woAnsDiv');
    if (d) d.innerHTML = woAns.map((w, i) => `<span onclick="window.rmChip(${i})" style="background:rgba(239,68,68,0.15);border:1px solid rgba(239,68,68,0.3);border-radius:20px;padding:6px 10px;cursor:pointer;font-size:0.95rem">${w}</span>`).join('') || '<span style="color:#666">Bu yerga bosing...</span>';
};
window.rmChip = function (idx) {
    const w = woAns[idx]; woAns.splice(idx, 1);
    document.querySelectorAll('.wo-chip').forEach(c => { if (c.dataset.w === w && c.classList.contains('used')) { c.classList.remove('used'); c.style.opacity = '1'; return; } });
    const d = $id('woAnsDiv');
    if (d) d.innerHTML = woAns.map((w, i) => `<span onclick="window.rmChip(${i})" style="background:rgba(239,68,68,0.15);border:1px solid rgba(239,68,68,0.3);border-radius:20px;padding:6px 10px;cursor:pointer;font-size:0.95rem">${w}</span>`).join('') || '<span style="color:#666">Bu yerga bosing...</span>';
};
window.rstWO = function () {
    woAns = [];
    document.querySelectorAll('.wo-chip').forEach(c => { c.classList.remove('used'); c.style.opacity = '1'; });
    const d = $id('woAnsDiv'); if (d) d.innerHTML = '<span style="color:#666">Bu yerga bosing...</span>';
};
window.chkWO = function () {
    const fb = $id('wofb');
    if (!woAns.length) { if (fb) fb.innerHTML = '<span style="color:#f5c842">⚠️ Belgilarni tartibga qo\'ying!</span>'; return; }
    if (woAns.join('') === window.__woCorrect) {
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
    const rec = new SR(); rec.lang = 'zh-CN'; rec.continuous = true; rec.interimResults = true;
    rec.onresult = e => { let t = ''; for (let i = e.resultIndex; i < e.results.length; i++) t += e.results[i][0].transcript; if (tr && tr.tagName !== 'TEXTAREA') tr.textContent = t; };
    rec.onerror = e => {
        if (btn) btn.innerHTML = '🎤 Gapirish'; lessonMics[idx] = null;
        if (e.error === 'not-allowed' && tr) tr.innerHTML = `<textarea style="width:100%;padding:8px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:8px;color:#e8ecff;font-family:inherit" id="man${idx}" placeholder="Yozing..."></textarea>`;
    };
    rec.onend = () => { if (btn) btn.innerHTML = '🎤 Gapirish'; if (st) st.innerHTML = '✅ Yozib olindi'; lessonMics[idx] = null; };
    try { rec.start(); lessonMics[idx] = rec; if (btn) btn.innerHTML = "⏹ To'xtatish"; if (st) st.innerHTML = '🔴 Yozmoqda...'; }
    catch (e) { if (tr) tr.innerHTML = `<textarea style="width:100%;padding:8px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:8px;color:#e8ecff;font-family:inherit" id="man${idx}" placeholder="Yozing..."></textarea>`; }
};
window.aiSpk = async function (idx, topic) {
    const ok = await spendTokens(TOKEN_CONFIG.ai_cost, 'AI speaking baholash'); if (!ok) return;
    const tr = $id(`mtr${idx}`); const man = $id(`man${idx}`); const fb = $id(`sfb${idx}`);
    let text = '';
    if (tr) text = tr.tagName === 'TEXTAREA' ? tr.value.trim() : tr.textContent.trim();
    if (!text && man) text = man.value.trim();
    if (!text) { if (fb) fb.innerHTML = '<span style="color:#f5c842">⚠️ Avval gapiring!</span>'; return; }
    if (fb) fb.innerHTML = '🤖 Baholayapti...';
    const r = await callAI(`Xitoy tili speaking baholash. Mavzu: "${topic}". O'quvchi: "${text}".\n${NATIVE_LANG} tilida (javob shu tilda bo'lsin): 1) ✅ Yaxshi tomonlar 2) ❌ Xatoliklar 3) 🔄 Tuzatilgan variant 4) ⭐ /10`, 700);
    if (fb) fb.innerHTML = r.replace(/\n/g, '<br>'); lScore++; lTotal++; awardXP(20, 'speaking');
};
window.markDone = function (idx) { lScore++; lTotal++; awardXP(10, 'speaking'); showToast('✅ Bajarildi!', 'success'); };
window.updWC = function () {
    const ta = $id('dta'); if (!ta) return;
    const len = ta.value.replace(/\s/g, '').length;
    const wc = $id('dwc'); const st = $id('dst');
    if (wc) wc.textContent = len + ' belgi';
    if (st) { st.textContent = len >= 40 ? '✅ Yetarli' : `Min 40 (${len}/40)`; st.style.color = len >= 40 ? '#34d399' : '#f87171'; }
};
window.selfChk = function (min) {
    const ta = $id('dta'); const fb = $id('wfb'); if (!ta || !fb) return;
    const len = ta.value.replace(/\s/g, '').length;
    if (len >= min) { fb.innerHTML = `<span style="color:#34d399">✅ ${len} belgi!</span>`; lScore++; awardXP(15, 'writing'); }
    else { fb.innerHTML = `<span style="color:#f87171">⚠️ ${min - len} belgi kam!</span>`; }
    lTotal++;
};
window.aiWrit = async function (title, words) {
    const ok = await spendTokens(TOKEN_CONFIG.ai_cost, 'AI writing'); if (!ok) return;
    const ta = $id('dta'); const fb = $id('wfb');
    if (!ta?.value.trim()) { if (fb) fb.innerHTML = '<span style="color:#f5c842">Avval yozing!</span>'; return; }
    fb.innerHTML = '🤖 Tekshirmoqda...';
    const r = await callAI(`Xitoy tili writing tekshirish. Mavzu: "${title}" (so'zlar: ${words}).\nMatn: "${ta.value.trim()}"\n${NATIVE_LANG} tilida (javob shu tilda bo'lsin): 1) Grammatika 2) Uslub 3) Tuzatilgan variant 4) HSK bali: /6`, 800);
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
            [`progress.${unitId}_${lessonKey}`]: 100,
            [`scores.${unitId}_${lessonKey}`]: pct,
            'stats.totalSessions': increment(1)
        };
        if (allDone) {
            updates['stats.unitsCompleted'] = increment(1);
            updates.xp = increment(xpEarned + 50); updates.coins = increment(coinEarned + 10);
            updates.totalXP = increment(xpEarned + 50); updates.totalCoins = increment(coinEarned + 10);
            UStats.unitsCompleted = (UStats.unitsCompleted || 0) + 1;
            showToast(`🎉 Unit to'liq! +50 XP +10 🪙 bonus!`, 'success');
        }
        await updateUserField(updates);
        UXP += xpEarned + (allDone ? 50 : 0); UCoin += coinEarned + (allDone ? 10 : 0);
        updateDisplays(); showToast(`✅ +${xpEarned} XP +${coinEarned} 🪙 saqlandi!`, 'success');
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
        <div style="padding:12px 20px;border-radius:12px;background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.2)"><div style="font-size:0.7rem;color:#666">XP</div><div style="font-weight:700;color:#ef4444">+${xp}</div></div>
        <div style="padding:12px 20px;border-radius:12px;background:rgba(245,200,66,0.1);border:1px solid rgba(245,200,66,0.2)"><div style="font-size:0.7rem;color:#666">Coin</div><div style="font-weight:700;color:#f5c842">+${coin}</div></div>
      </div>
      <div style="font-size:1.2rem;margin-bottom:20px">${pct >= 80 ? '🏆 太棒了! Mukammal!' : pct >= 60 ? '✅ 很好! Yaxshi!' : '💪 再试一次! Qayta urining!'}</div>
      <div style="display:flex;flex-direction:column;gap:8px">
        ${nxt[lk] ? `<button onclick="window.openLesson('${uid}','${nxt[lk]}')" style="padding:12px;border-radius:12px;background:linear-gradient(135deg,#ef4444,#f97316);border:none;color:#fff;font-size:0.9rem;font-weight:700;cursor:pointer;font-family:inherit">→ Keyingi: ${lnames[nxt[lk]]}</button>` : `<div style="padding:14px;border-radius:12px;background:rgba(52,211,153,0.1);border:1px solid rgba(52,211,153,0.25);color:#34d399;font-weight:700">🎉 Unit to'liq bajarildi!</div>`}
        <button onclick="document.getElementById('unitModal').classList.remove('active');renderUnits()" style="padding:12px;border-radius:12px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);color:#e8ecff;cursor:pointer;font-size:0.9rem;font-family:inherit">🏠 Unitlarga qaytish</button>
      </div>
    </div>`;
    showXPPop(`+${xp} XP`);
    const modal = $id('unitModal'); if (modal) modal.classList.add('active');
}

// ══════════════════════════════════════════════════
// WORDS
// ══════════════════════════════════════════════════
function renderWords(reset = true) {
    if (reset) wOff = 0;
    const grid = $id('wordsGrid'); if (!grid) return;
    const filt = WDB.filter(w => {
        const ms = !wSrch || w.e.includes(wSrch) || w.uz.toLowerCase().includes(wSrch) || w.py.toLowerCase().includes(wSrch);
        const ml = wFilt === 'all' || w.l === wFilt;
        return ms && ml;
    });
    const slice = filt.slice(0, wOff + 30);
    if (reset) grid.innerHTML = '';
    slice.slice(wOff).forEach(w => {
        const card = document.createElement('div');
        card.style.cssText = 'padding:16px;border-radius:14px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);cursor:pointer;transition:all 0.2s';
        card.innerHTML = `<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:2px">
          <div style="font-weight:700;font-size:1.4rem;color:#e8ecff">${w.e}</div>
          <button onclick="window.spk('${w.e}',event)" style="background:none;border:none;cursor:pointer;font-size:1rem">🔊</button>
        </div>
        <div style="font-size:0.78rem;color:#ef4444;margin-bottom:3px">${w.py}</div>
        <div style="font-size:0.82rem;color:#a78bfa;margin-bottom:6px">${w.uz}</div>
        <div style="display:flex;gap:6px;font-size:0.68rem">
          <span style="background:rgba(255,255,255,0.05);padding:2px 8px;border-radius:8px;color:#666">${w.t}</span>
          <span style="background:rgba(255,255,255,0.05);padding:2px 8px;border-radius:8px;color:#666">${w.l}</span>
        </div>`;
        card.onmouseover = () => { card.style.background = 'rgba(239,68,68,0.08)'; card.style.borderColor = 'rgba(239,68,68,0.25)'; };
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
      <div style="font-size:3rem;font-weight:700;color:#e8ecff;margin-bottom:4px">${w.e}</div>
      <div style="font-size:1rem;color:#ef4444;margin-bottom:4px">${w.py}</div>
      <div style="font-size:1.1rem;color:#a78bfa;margin-bottom:12px">${w.uz}</div>
      <div style="font-size:0.82rem;color:#666;margin:0 0 4px">${w.t}</div>
      <div style="padding:12px;background:rgba(255,255,255,0.04);border-radius:10px;margin-bottom:12px;font-size:0.9rem;color:#c7d2fe">"${w.ex}"</div>
      <div style="color:#a78bfa;font-size:0.82rem;margin-bottom:16px">${w.eu}</div>
      <div style="display:flex;gap:8px;justify-content:center">
        <button onclick="window.spk('${w.e}',event)" style="padding:8px 20px;border-radius:10px;background:rgba(239,68,68,0.15);border:1px solid rgba(239,68,68,0.3);color:#fca5a5;cursor:pointer;font-family:inherit">🔊 Talaffuz</button>
        <button onclick="window.aiExWord('${w.e}',event)" style="padding:8px 20px;border-radius:10px;background:rgba(167,139,250,0.1);border:1px solid rgba(167,139,250,0.25);color:#a78bfa;cursor:pointer;font-family:inherit">🤖 AI (1 token)</button>
      </div>
      <div id="wordAIFB" style="margin-top:12px;font-size:0.82rem"></div>
    </div>`;
    m.classList.add('active');
}
window.closeWordModal = function (e) { if (!e || e.target === $id('wordModal')) $id('wordModal')?.classList.remove('active'); };

// ══════════════════════════════════════════════════
// PRACTICE
// ══════════════════════════════════════════════════
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
    const fw = $id('flashWord'); if (fw) fw.textContent = w.e;
    // Pinyin
    const pyEl = $id('flashPy'); if (pyEl) pyEl.textContent = w.py;
    const fu = $id('flashUz'); if (fu) fu.textContent = w.uz;
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
    const type = Math.random() > 0.5 ? 'ch2uz' : 'uz2ch';
    const qEl = $id('quizQ');
    if (qEl) qEl.innerHTML = type === 'ch2uz'
        ? `<span style="font-size:1.5rem">${curQuizWord.e}</span> <span style="font-size:0.85rem;color:#ef4444">(${curQuizWord.py})</span> = ?`
        : `"${curQuizWord.uz}" — xitoycha nima?`;
    const optsEl = $id('quizOptions');
    if (optsEl) optsEl.innerHTML = opts.map(o => `<button class="quiz-opt" onclick="window.checkQuizOpt(this,'${o.e.replace(/'/g, "\\'")}','${type}')" style="width:100%;margin-bottom:8px;padding:12px;border-radius:10px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);color:#e8ecff;cursor:pointer;text-align:left;font-family:inherit;font-size:0.9rem;transition:all 0.2s">${type === 'ch2uz' ? o.uz : `<span style="font-size:1.1rem">${o.e}</span> (${o.py})`}</button>`).join('');
    const fb = $id('quizFeedback'); if (fb) fb.innerHTML = '';
}
window.checkQuizOpt = function (btn, chosen, type) {
    if (quizAnswered) return; quizAnswered = true;
    document.querySelectorAll('.quiz-opt').forEach(b => {
        const bTxt = b.textContent.trim();
        const isCorrect = type === 'ch2uz' ? bTxt === curQuizWord.uz : bTxt.includes(curQuizWord.e);
        if (isCorrect) { b.style.background = 'rgba(52,211,153,0.2)'; b.style.borderColor = '#34d399'; }
        else if (b === btn) { b.style.background = 'rgba(239,68,68,0.2)'; b.style.borderColor = '#ef4444'; }
    });
    const fb = $id('quizFeedback');
    if (chosen === curQuizWord.e) { quizScore++; const el = $id('quizScore'); if (el) el.textContent = quizScore; awardXP(10, 'grammar'); if (fb) fb.innerHTML = `<span style="color:#34d399">✅ To'g'ri! ${curQuizWord.e} (${curQuizWord.py}) = ${curQuizWord.uz}</span>`; }
    else { if (fb) fb.innerHTML = `<span style="color:#ef4444">❌ To'g'ri: ${curQuizWord.e} (${curQuizWord.py}) = ${curQuizWord.uz}</span>`; }
    window.speakWord(curQuizWord.e);
};
window.nextQuiz = function () { showQuizWord(); };

// ── Match ──
function initMatch() {
    const pool = shuffle([...WDB]).slice(0, 5);
    matchPairs = pool; matchMatched = []; matchSel1 = null;
    const items = shuffle([...pool.map(w => ({ id: w.e, text: w.e, type: 'ch' })), ...pool.map(w => ({ id: w.e, text: w.uz, type: 'uz' }))]);
    const grid = $id('matchGrid');
    if (grid) grid.innerHTML = items.map(item => `<div class="match-item" data-id="${item.id}" data-type="${item.type}" onclick="window.selectMatch2(this)" style="padding:12px;border-radius:10px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);color:#e8ecff;cursor:pointer;font-family:inherit;transition:all 0.2s;font-size:${item.type === 'ch' ? '1.1rem' : '0.82rem'};text-align:${item.type === 'ch' ? 'center' : 'left'}">${item.text}</div>`).join('');
    const fb = $id('matchFeedback'); if (fb) fb.innerHTML = '';
}
window.startMatch = initMatch;
window.selectMatch2 = function (el) {
    if (el.classList.contains('matched')) return;
    if (!matchSel1) {
        matchSel1 = el; el.style.background = 'rgba(239,68,68,0.2)'; el.style.borderColor = '#ef4444';
    } else {
        if (matchSel1 === el) { el.style.background = 'rgba(255,255,255,0.04)'; el.style.borderColor = 'rgba(255,255,255,0.1)'; matchSel1 = null; return; }
        if (matchSel1.dataset.type === el.dataset.type) {
            matchSel1.style.background = 'rgba(255,255,255,0.04)'; matchSel1.style.borderColor = 'rgba(255,255,255,0.1)';
            matchSel1 = el; el.style.background = 'rgba(239,68,68,0.2)'; el.style.borderColor = '#ef4444'; return;
        }
        if (matchSel1.dataset.id === el.dataset.id) {
            matchSel1.style.background = 'rgba(52,211,153,0.15)'; matchSel1.style.borderColor = '#34d399'; matchSel1.classList.add('matched');
            el.style.background = 'rgba(52,211,153,0.15)'; el.style.borderColor = '#34d399'; el.classList.add('matched');
            matchMatched.push(el.dataset.id); matchSel1 = null; awardXP(15, 'grammar');
            if (matchMatched.length === matchPairs.length) { const fb = $id('matchFeedback'); if (fb) fb.innerHTML = '<span style="color:#34d399">🎉 Barcha juftliklar! 棒极了!</span>'; }
        } else {
            const s = matchSel1; matchSel1 = null;
            s.style.background = 'rgba(239,68,68,0.15)'; s.style.borderColor = '#ef4444';
            el.style.background = 'rgba(239,68,68,0.15)'; el.style.borderColor = '#ef4444';
            setTimeout(() => { s.style.background = 'rgba(255,255,255,0.04)'; s.style.borderColor = 'rgba(255,255,255,0.1)'; el.style.background = 'rgba(255,255,255,0.04)'; el.style.borderColor = 'rgba(255,255,255,0.1)'; }, 800);
        }
    }
};

// ── Typing — Pinyin yozish ──
function initTyping() { typingDeck = shuffle([...WDB]); typingIdx = 0; showTypingWord(); }
function showTypingWord() {
    const w = typingDeck[typingIdx % typingDeck.length];
    const tw = $id('typingWord'); if (tw) tw.innerHTML = `${w.e} <span style="font-size:0.9rem;color:#ef4444">(${w.py})</span>`;
    const th = $id('typingHint'); if (th) th.textContent = "O'zbek: " + w.uz;
    const ti = $id('typingInput'); if (ti) { ti.value = ''; ti.style.borderColor = ''; ti.placeholder = "汉字 yozing..."; }
    const tf = $id('typingFeedback'); if (tf) tf.innerHTML = '';
}
window.checkTyping = function () {
    const w = typingDeck[typingIdx % typingDeck.length];
    const val = $id('typingInput')?.value.trim() || '';
    const fb = $id('typingFeedback'); const inp = $id('typingInput');
    if (val === w.e) {
        if (fb) fb.innerHTML = `<span style="color:#34d399">✅ To'g'ri! ${w.e} (${w.py})</span>`;
        if (inp) inp.style.borderColor = '#34d399';
        awardXP(8, 'writing'); setTimeout(() => { typingIdx++; showTypingWord(); }, 800);
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
        if (fb) fb.innerHTML = `<div style="color:#ef4444;padding:10px;border-radius:10px;background:rgba(239,68,68,0.1)">❌ Noto'g'ri. To'g'ri: <b>${ans}</b>. ${exp}</div>`;
    }
};
window.nextGrammarEx = function () { curGrammarIdx++; showGrammarQ(); };

// ══════════════════════════════════════════════════
// AI CHAT
// ══════════════════════════════════════════════════
const CHAT_MODES = {
    free: { label: 'Erkin suhbat', sys: '你是一位友好的中文学习助手，专为乌兹别克语母语者设计。用中文和乌兹别克语交流，帮助用户练习中文。回复简洁（2-4句）。如果用户用乌兹别克语写作，用乌兹别克语和中文回复。' },
    teacher: { label: "O'qituvchi", sys: '你是一位专为乌兹别克语学生设计的中文老师。用简单的乌兹别克语或中文清楚地解释语法规则，举例说明，并鼓励学生。要有耐心和教育意义。回复简洁明了。' },
    grammar: { label: 'Grammatika', sys: "你是乌兹别克学习者的中文语法检查器。当用户发送文本时，识别所有语法错误，用简单的乌兹别克语解释每个错误，显示更正版本，并给出规则解释。格式：'❌ Xato → ✅ To'g'ri: ... 📚 Qoida: ...'" },
    translate: { label: 'Tarjimon', sys: '你是一位专业的中文-乌兹别克语翻译。准确自然地翻译。也要解释任何成语或表达。翻译中文→乌兹别克语或乌兹别克语→中文时，清楚地显示两个版本。' },
    hsk: { label: 'HSK', sys: '你是专为乌兹别克学生设计的HSK备考教练。帮助阅读、写作、听力和口语任务。提供答案反馈，建议改进，解释HSK评分标准。要鼓励且精确。' }
};

curChatModeObj = CHAT_MODES.free;

window.setChatMode = function (mode, el) {
    document.querySelectorAll('.chat-mode-btn').forEach(b => b.classList.remove('active'));
    if (el) el.classList.add('active');
    chatMode = mode; curChatModeObj = CHAT_MODES[mode] || CHAT_MODES.free;
    appendChat('assistant', `Rejim: <b>${curChatModeObj.label}</b>. ${mode === 'free' ? '自由交流！ Erkin suhbatlashaylik!' :
            mode === 'teacher' ? '你想学什么？ Nima o\'rganmoqchisiz?' :
                mode === 'grammar' ? '发送文本，我来检查语法！ Matn yuboring!' :
                    mode === 'translate' ? '翻译什么？ Nima tarjima qilaylik?' :
                        'HSK savolingizni yuboring! 请问HSK问题！'}`, false);
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
    appendChat('assistant', '<span class="typing">正在输入...</span>', false, typingId);
    const sendBtn = $id('chatSendBtn'); if (sendBtn) sendBtn.disabled = true;
    try {
        const resp = await fetch(AI_PROXY, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [
                    { role: 'user', parts: [{ text: curChatModeObj.sys + LANG_RULES }] },
                    ...chatHist.slice(-10)
                ],
                generationConfig: { temperature: 0.8, maxOutputTokens: UP === 'ultimate' ? 2000 : UP === 'premium' ? 1500 : 1000 }
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
    } finally { if (sendBtn) sendBtn.disabled = false; }
};

function appendChat(role, html, save = false, id = null) {
    const c = $id('chatMessages'); if (!c) return;
    const isAI = role === 'assistant';
    const div = document.createElement('div');
    div.className = `chat-msg ${isAI ? 'ai-msg' : 'user-msg'}`;
    if (id) div.id = id;
    div.innerHTML = `<div class="chat-avatar">${isAI ? '🈶' : '<i class="fa-solid fa-user"></i>'}</div>
      <div class="chat-bubble">${html}</div>`;
    c.appendChild(div); c.scrollTop = c.scrollHeight;
}

window.clearChatHistory = async function () {
    if (!confirm('Chat tarixini tozalashni istaysizmi？')) return;
    chatHist = [];
    const c = $id('chatMessages');
    if (c) c.innerHTML = `<div class="chat-msg ai-msg"><div class="chat-avatar">🈶</div><div class="chat-bubble">你好！Chat tarixi tozalandi. 开始新的对话！😊</div></div>`;
    showToast('Chat tarixi tozalandi', 'success');
};

// ══════════════════════════════════════════════════
// VIDEO
// ══════════════════════════════════════════════════
window.findYoutubeVideos = function () {
    const grid = $id('videosGrid'); if (!grid) return;
    const videos = [
        { title: 'Learn Mandarin Chinese for Beginners', channel: 'ChineseClass101', id: 'q34TfXNoBjk' },
        { title: 'Chinese in 3 Hours — Full Course', channel: 'Learn Chinese with Emma', id: 'Z5jM5YR0Z4E' },
        { title: '1000 Basic Chinese Words', channel: 'Mandarin Corner', id: '4eeAp5KWVUA' },
        { title: 'HSK 1 Full Vocabulary', channel: 'LingLing Chinese', id: 'RqJsxTOaqOI' },
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

// ══════════════════════════════════════════════════
// AUTH & INIT
// ══════════════════════════════════════════════════
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