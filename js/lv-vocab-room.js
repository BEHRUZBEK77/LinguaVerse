// ═══════════════════════════════════════════════════════════════════════════
// lv-vocab-room.js — AI LUG'AT XONASI + GLOBAL MAKON
//
// Foydalanuvchi oddiy til bilan so'raydi:
//   "sayohat mavzusida 20 ta so'z qo'sh"
//   "B2 daraja uchun biznes lug'ati kerak"
//   "restoranda ishlatiladigan iboralar"
//
// AI so'zlarni yaratadi, ular Firestore'ga saqlanadi va darhol mashq
// qilish mumkin (flashcard, test, yozish). Har bir generatsiyada AI oldingi
// so'zlarni takrorlamaslikka va darajani (A1–C2) tasodifiy aralashtirishga
// undaladi — shu bois bir xil so'z/unit/flashcard qayta-qayta chiqmaydi.
//
// Unit yaratish ham shu yerda: bir nechta so'zdan to'liq dars quriladi
// (lug'at + grammatika + mashqlar). Flashcard alohida to'plam sifatida
// yaratiladi (old/orqa tomonli tez takrorlash uchun).
//
// GLOBAL MAKON: istalgan to'plam/unit/flashcard bitta tugma bilan
// "🌍 Global"ga ulashiladi — netlify/functions/community.js orqali barcha
// foydalanuvchilar ko'radigan umumiy makonga tushadi (dublikatlar avtomatik
// filtrlanadi). Boshqalarning ulashganlarini "📥 O'zimga olish" bilan öz
// to'plamiga import qilish mumkin.
//
// O'rnatish: sahifaga <div id="lvVocabRoom"></div> qo'ying va
//   <script type="module" src="../js/lv-vocab-room.js"></script>
// ═══════════════════════════════════════════════════════════════════════════

import { LV, db, url } from './lv-core.js';
import { currentLang } from './lv-i18n.js';
import {
  doc, setDoc, addDoc, collection, getDocs, deleteDoc,
  query, orderBy, limit as fbLimit, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const lang = currentLang();
const COMMUNITY_URL = url('.netlify/functions/community');

// ═══════════════════════════════════════════════════════════════════════════
// TILLAR
// ═══════════════════════════════════════════════════════════════════════════
const TARGETS = {
  english: { name: 'English',  tts: 'en-US' },
  russian: { name: 'Russian',  tts: 'ru-RU' },
  german:  { name: 'German',   tts: 'de-DE' },
  spanish: { name: 'Spanish',  tts: 'es-ES' },
  turkish: { name: 'Turkish',  tts: 'tr-TR' },
  arabic:  { name: 'Arabic',   tts: 'ar-SA' },
  korean:  { name: 'Korean',   tts: 'ko-KR' },
  chinese: { name: 'Chinese',  tts: 'zh-CN' }
};

const NATIVE_NAME = {
  uz: 'Uzbek', ru: 'Russian', en: 'English',
  tr: 'Turkish', de: 'German', ar: 'Arabic'
};

const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

/** Sahifa manzilidan qaysi til o'rganilayotganini aniqlaydi. */
function detectTarget() {
  const p = location.pathname.toLowerCase();
  for (const id of Object.keys(TARGETS)) {
    if (p.includes(id) || (id === 'russian' && p.includes('russia'))
                       || (id === 'spanish' && p.includes('spain'))) return id;
  }
  return localStorage.getItem('lv_target') || 'english';
}

// ═══════════════════════════════════════════════════════════════════════════
// USLUB
// ═══════════════════════════════════════════════════════════════════════════
const CSS = `
#lvVocabRoom { margin:20px 0; font-family:'DM Sans',system-ui,sans-serif; }
#lvVocabRoom .vr-card { background:rgba(11,15,30,.7); border:1px solid rgba(255,255,255,.08); border-radius:16px; padding:18px; }
#lvVocabRoom .vr-h { display:flex; align-items:center; gap:9px; font-size:.95rem; font-weight:800; margin-bottom:6px; color:#e8ecff; }
#lvVocabRoom .vr-h i { color:#4f6ef7; }
#lvVocabRoom .vr-h small { margin-left:auto; font-size:.72rem; color:#7580a8; font-weight:500; }
#lvVocabRoom .vr-sub { font-size:.8rem; color:#7580a8; margin-bottom:14px; line-height:1.5; }

#lvVocabRoom .vr-tabs { display:flex; gap:6px; margin-bottom:14px; flex-wrap:wrap; }
#lvVocabRoom .vr-tab { padding:8px 15px; border-radius:10px; border:1px solid rgba(255,255,255,.08); background:rgba(255,255,255,.03); color:#7580a8; font-family:inherit; font-weight:700; font-size:.8rem; cursor:pointer; transition:all .15s; }
#lvVocabRoom .vr-tab:hover { color:#e8ecff; }
#lvVocabRoom .vr-tab.active { background:#4f6ef7; color:#fff; border-color:#4f6ef7; }
#lvVocabRoom .vr-pane { display:none; }
#lvVocabRoom .vr-pane.active { display:block; }

#lvVocabRoom .vr-ask { display:flex; gap:8px; flex-wrap:wrap; }
#lvVocabRoom .vr-in { flex:1; min-width:220px; background:rgba(255,255,255,.04); border:1.5px solid rgba(255,255,255,.1); border-radius:11px; padding:12px 15px; color:#e8ecff; font-family:inherit; font-size:.88rem; outline:none; transition:border-color .15s; }
#lvVocabRoom .vr-in:focus { border-color:#4f6ef7; }
#lvVocabRoom .vr-in::placeholder { color:#5a6389; }
#lvVocabRoom .vr-btn { padding:12px 20px; border-radius:11px; border:none; background:#4f6ef7; color:#fff; font-family:inherit; font-weight:700; font-size:.85rem; cursor:pointer; white-space:nowrap; transition:background .15s, opacity .15s; }
#lvVocabRoom .vr-btn:hover:not(:disabled) { background:#5f7bff; }
#lvVocabRoom .vr-btn:disabled { opacity:.55; cursor:not-allowed; }
#lvVocabRoom .vr-btn.ghost { background:transparent; border:1.5px solid rgba(255,255,255,.15); color:#e8ecff; }
#lvVocabRoom .vr-btn.ghost:hover { border-color:#4f6ef7; color:#93a9ff; }
#lvVocabRoom .vr-btn.sm { padding:7px 12px; font-size:.72rem; border-radius:8px; }

#lvVocabRoom .vr-chips { display:flex; gap:7px; flex-wrap:wrap; margin-top:11px; }
#lvVocabRoom .vr-chip { padding:6px 13px; border-radius:100px; background:rgba(255,255,255,.04); border:1px solid rgba(255,255,255,.08); color:#7580a8; font-size:.75rem; font-weight:600; cursor:pointer; transition:all .15s; font-family:inherit; }
#lvVocabRoom .vr-chip:hover { border-color:#4f6ef7; color:#93a9ff; }
#lvVocabRoom .vr-chip.on { background:#4f6ef7; color:#fff; border-color:#4f6ef7; }

#lvVocabRoom .vr-msg { margin-top:12px; padding:11px 14px; border-radius:11px; font-size:.82rem; line-height:1.5; display:none; }
#lvVocabRoom .vr-msg.show { display:block; }
#lvVocabRoom .vr-msg.ok { background:rgba(52,211,153,.1); border:1px solid rgba(52,211,153,.3); color:#6ee7b7; }
#lvVocabRoom .vr-msg.err { background:rgba(248,113,113,.1); border:1px solid rgba(248,113,113,.3); color:#fca5a5; }
#lvVocabRoom .vr-msg.info { background:rgba(79,110,247,.1); border:1px solid rgba(79,110,247,.3); color:#93a9ff; }

/* So'zlar / flashcard ro'yxati */
#lvVocabRoom .vr-sets { display:grid; gap:10px; margin-top:16px; }
#lvVocabRoom .vr-set { background:rgba(255,255,255,.03); border:1px solid rgba(255,255,255,.07); border-radius:13px; overflow:hidden; }
#lvVocabRoom .vr-st { display:flex; align-items:center; gap:11px; padding:13px 15px; cursor:pointer; transition:background .15s; }
#lvVocabRoom .vr-st:hover { background:rgba(255,255,255,.03); }
#lvVocabRoom .vr-si { width:36px; height:36px; border-radius:10px; display:grid; place-items:center; background:rgba(79,110,247,.14); color:#4f6ef7; font-size:.95rem; flex-shrink:0; }
#lvVocabRoom .vr-sn { font-weight:700; font-size:.87rem; }
#lvVocabRoom .vr-sm { font-size:.72rem; color:#7580a8; margin-top:2px; }
#lvVocabRoom .vr-sx { margin-left:auto; display:flex; gap:6px; align-items:center; }
#lvVocabRoom .vr-ic { width:30px; height:30px; border-radius:8px; border:1px solid rgba(255,255,255,.1); background:transparent; color:#7580a8; cursor:pointer; font-size:.75rem; transition:all .15s; }
#lvVocabRoom .vr-ic:hover { color:#e8ecff; border-color:rgba(255,255,255,.3); }
#lvVocabRoom .vr-ic.del:hover { color:#f87171; border-color:#f87171; }
#lvVocabRoom .vr-ic.share:hover { color:#6ee7b7; border-color:#6ee7b7; }

#lvVocabRoom .vr-words { display:none; padding:0 15px 14px; }
#lvVocabRoom .vr-set.open .vr-words { display:block; }
#lvVocabRoom .vr-w { display:flex; align-items:flex-start; gap:11px; padding:9px 0; border-top:1px solid rgba(255,255,255,.05); }
#lvVocabRoom .vr-wt { flex:1; min-width:0; }
#lvVocabRoom .vr-ww { font-weight:700; font-size:.86rem; }
#lvVocabRoom .vr-wtr { font-size:.79rem; color:#93a9ff; margin-top:1px; }
#lvVocabRoom .vr-wex { font-size:.73rem; color:#7580a8; margin-top:4px; font-style:italic; line-height:1.45; }
#lvVocabRoom .vr-wl { font-size:.62rem; padding:2px 7px; border-radius:20px; background:rgba(255,255,255,.06); color:#7580a8; font-weight:700; flex-shrink:0; }
#lvVocabRoom .vr-play { width:28px; height:28px; border-radius:7px; border:1px solid rgba(255,255,255,.1); background:transparent; color:#7580a8; cursor:pointer; font-size:.72rem; flex-shrink:0; }
#lvVocabRoom .vr-play:hover { color:#4f6ef7; border-color:#4f6ef7; }

/* Flashcard flip */
#lvVocabRoom .vr-fc-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(150px,1fr)); gap:10px; padding:0 15px 14px; }
#lvVocabRoom .vr-fc { perspective:800px; height:110px; cursor:pointer; }
#lvVocabRoom .vr-fc-in { position:relative; width:100%; height:100%; transition:transform .5s; transform-style:preserve-3d; }
#lvVocabRoom .vr-fc.flip .vr-fc-in { transform:rotateY(180deg); }
#lvVocabRoom .vr-fc-f, #lvVocabRoom .vr-fc-b { position:absolute; inset:0; backface-visibility:hidden; border-radius:11px; display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center; padding:8px; border:1px solid rgba(255,255,255,.08); }
#lvVocabRoom .vr-fc-f { background:rgba(79,110,247,.1); }
#lvVocabRoom .vr-fc-b { background:rgba(52,211,153,.08); transform:rotateY(180deg); }
#lvVocabRoom .vr-fc-emoji { font-size:1.4rem; margin-bottom:4px; }
#lvVocabRoom .vr-fc-word { font-weight:800; font-size:.85rem; }
#lvVocabRoom .vr-fc-ex { font-size:.65rem; color:#7580a8; margin-top:4px; font-style:italic; }

/* Global makon kartalari */
#lvVocabRoom .vr-glevels { display:flex; gap:6px; flex-wrap:wrap; margin-bottom:12px; }
#lvVocabRoom .vr-gauthor { font-size:.68rem; color:#5a6389; }

#lvVocabRoom .vr-empty { text-align:center; color:#7580a8; font-size:.82rem; padding:26px 14px; }
#lvVocabRoom .vr-spin { display:inline-block; width:13px; height:13px; border:2px solid rgba(255,255,255,.3); border-top-color:#fff; border-radius:50%; animation:vrSpin .7s linear infinite; vertical-align:-2px; margin-right:6px; }
@keyframes vrSpin { to { transform:rotate(360deg); } }
`;

// ═══════════════════════════════════════════════════════════════════════════
// HOLAT
// ═══════════════════════════════════════════════════════════════════════════
let sets = [];
let decks = [];      // flashcard to'plamlari
let globalItems = []; // joriy ochiq tabdagi global ro'yxat
let activeTab = 'vocab'; // vocab | flashcard | global
let globalLevel = '';    // global tabdagi daraja filtri
let busy = false;
const target = detectTarget();

const $ = (sel, root = document) => root.querySelector(sel);

function msg(text, type = 'info') {
  const el = document.getElementById('vrMsg');
  if (!el) return;
  el.className = 'vr-msg show ' + type;
  el.innerHTML = text;
  if (type === 'ok') setTimeout(() => el.classList.remove('show'), 6000);
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// ═══════════════════════════════════════════════════════════════════════════
// DARAJA ARALASHTIRISH — bir xil daraja/so'z qayta-qayta chiqmasligi uchun
// ═══════════════════════════════════════════════════════════════════════════

/** So'rovda aniq daraja ko'rsatilgan bo'lsa o'shani, aks holda userning
 *  darajasi atrofida (bir bosqich past/teng/yuqori) tasodifiy tanlaydi —
 *  shu bilan har safar biroz boshqacha qiyinlikda lug'at chiqadi. */
function pickLevel(baseLevel, request) {
  const explicit = request.match(/\b(A1|A2|B1|B2|C1|C2)\b/i);
  if (explicit) return explicit[1].toUpperCase();

  const idx = Math.max(0, LEVELS.indexOf(baseLevel));
  const pool = [idx - 1, idx, idx, idx, idx + 1].filter(i => i >= 0 && i < LEVELS.length);
  return LEVELS[pool[Math.floor(Math.random() * pool.length)]];
}

/** So'nggi to'plamlardagi so'zlarni yig'ib, AI'ga "buларни takrorlama"
 *  deb beriladigan ro'yxat tuzadi. */
function recentWords(limitN = 120) {
  const words = [];
  for (const s of sets) {
    for (const w of (s.words || [])) {
      if (w.word) words.push(w.word);
      if (words.length >= limitN) return words;
    }
  }
  return words;
}

function randomAngle() {
  const angles = [
    'everyday conversation', 'formal/professional context', 'travel and tourism',
    'idiomatic expressions', 'academic or written style', 'informal spoken slang-adjacent (still appropriate)',
    'emotions and relationships', 'work and business', 'food and daily life', 'technology and modern life'
  ];
  return angles[Math.floor(Math.random() * angles.length)];
}

// ═══════════════════════════════════════════════════════════════════════════
// AI DAN SO'Z SO'RASH
// ═══════════════════════════════════════════════════════════════════════════

/** Foydalanuvchi so'rovidan nechta so'z kerakligini topadi. */
function askedCount(text) {
  const m = text.match(/(\d+)\s*(?:ta|dona|words?|so'z|слов)?/i);
  const n = m ? parseInt(m[1], 10) : 12;
  return Math.min(30, Math.max(3, n));   // 3–30 oralig'ida
}

async function generateWords(request) {
  const snap = LV.snapshot();
  const t = TARGETS[target] || TARGETS.english;
  const native = NATIVE_NAME[snap.profile?.nativeLang || lang] || 'Uzbek';
  const baseLevel = snap.profile?.level || 'A2';
  const level = pickLevel(baseLevel, request);
  const count = askedCount(request);
  const avoid = recentWords();
  const angle = randomAngle();

  const prompt =
`The student is learning ${t.name}. Their native language is ${native}. Target level for THIS set: ${level}.

Their request: "${request}"

Generate exactly ${count} vocabulary items that satisfy this request, focused on level ${level}
and leaning toward this angle/register: ${angle} (only if it fits the request naturally).
Return STRICT JSON only, no markdown, no commentary:
{"title":"short set name in ${native}","words":[
  {"word":"the ${t.name} word","translation":"meaning in ${native}","type":"noun|verb|adjective|adverb|phrase","level":"A1|A2|B1|B2|C1|C2","example":"natural full sentence in ${t.name}","exampleTranslation":"that sentence in ${native}"}
]}

Rules:
- Words must be genuinely useful and appropriate for level ${level}.
- Examples must be natural sentences a native speaker would actually say.
- Do not repeat words within this set.
- Do NOT use any of these already-known words: ${avoid.length ? avoid.slice(0, 100).join(', ') : '(none yet)'}.
- Vary difficulty naturally within the set — not every word needs to be exactly the same sub-level.
- Translations must be accurate, not literal word-for-word.`;

  const res = await LV.ai(LV.bestModel(false), [{ role: 'user', content: prompt }], {
    task: 'vocab',
    target,
    maxTokens: 3000,
    temperature: 0.85
  });

  if (!res.ok) throw new Error(res.message || 'AI javob bermadi');

  // JSON ni ajratib olamiz — AI ba'zan ```json bilan o'raydi
  let raw = res.text.trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '');

  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start < 0 || end < 0) throw new Error('AI JSON qaytarmadi');
  raw = raw.slice(start, end + 1);

  let data;
  try { data = JSON.parse(raw); }
  catch { throw new Error("AI javobi noto'g'ri shaklda — qayta urinib ko'ring"); }

  const words = (data.words || []).filter(w => w.word && w.translation);
  if (!words.length) throw new Error("AI so'z qaytarmadi");

  return { title: data.title || request.slice(0, 40), words, level };
}

// ═══════════════════════════════════════════════════════════════════════════
// FLASHCARD YARATISH
// ═══════════════════════════════════════════════════════════════════════════
async function generateFlashcards(request) {
  const snap = LV.snapshot();
  const t = TARGETS[target] || TARGETS.english;
  const native = NATIVE_NAME[snap.profile?.nativeLang || lang] || 'Uzbek';
  const baseLevel = snap.profile?.level || 'A2';
  const level = pickLevel(baseLevel, request);
  const count = askedCount(request);
  const avoidFromSets = recentWords(80);
  const avoidFromDecks = [];
  for (const d of decks) for (const c of (d.cards || [])) if (c.front) avoidFromDecks.push(c.front);
  const avoid = [...avoidFromSets, ...avoidFromDecks.slice(0, 80)];
  const angle = randomAngle();

  const prompt =
`Create ${count} flashcards (front/back) for a student learning ${t.name}. Native language: ${native}.
Target level: ${level}. Request: "${request}". Register/angle: ${angle} (only if it fits naturally).

Return STRICT JSON only, no markdown:
{"title":"short deck name in ${native}","level":"${level}","cards":[
  {"front":"word or short phrase in ${t.name}","back":"meaning in ${native}","emoji":"one single emoji that visually represents it","example":"short natural example sentence in ${t.name}"}
]}

Rules:
- Cards must be short, punchy, ideal for spaced-repetition drilling (not full sentences on the front).
- Do not repeat any of these already-known items: ${avoid.length ? avoid.slice(0, 100).join(', ') : '(none yet)'}.
- Pick a genuinely fitting emoji for each card — never reuse the same emoji twice in this deck if avoidable.
- Keep translations accurate and natural.`;

  const res = await LV.ai(LV.bestModel(false), [{ role: 'user', content: prompt }], {
    task: 'vocab',
    target,
    maxTokens: 2200,
    temperature: 0.9
  });

  if (!res.ok) throw new Error(res.message || 'AI javob bermadi');

  let raw = res.text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  const s = raw.indexOf('{'), e = raw.lastIndexOf('}');
  if (s < 0) throw new Error('AI JSON qaytarmadi');

  let data;
  try { data = JSON.parse(raw.slice(s, e + 1)); }
  catch { throw new Error("AI javobi noto'g'ri shaklda — qayta urinib ko'ring"); }

  const cards = (data.cards || []).filter(c => c.front && c.back);
  if (!cards.length) throw new Error("AI flashcard qaytarmadi");

  return { title: data.title || request.slice(0, 40), level: data.level || level, cards };
}

// ═══════════════════════════════════════════════════════════════════════════
// FIRESTORE — LUG'AT TO'PLAMLARI
// ═══════════════════════════════════════════════════════════════════════════
async function saveSet(title, words, request, level) {
  const snap = LV.snapshot();
  if (!snap.signedIn) throw new Error('auth');

  const ref = await addDoc(collection(db, 'users', snap.uid, 'vocabulary'), {
    title,
    request: request || '',
    target,
    level: level || null,
    words,
    count: words.length,
    source: 'ai',
    createdAt: serverTimestamp()
  });
  return ref.id;
}

async function loadSets() {
  const snap = LV.snapshot();
  if (!snap.signedIn) return [];
  try {
    const qs = await getDocs(query(
      collection(db, 'users', snap.uid, 'vocabulary'),
      orderBy('createdAt', 'desc'),
      fbLimit(50)
    ));
    const out = [];
    qs.forEach(d => out.push({ id: d.id, ...d.data() }));
    return out.filter(s => !s.target || s.target === target);
  } catch (e) {
    console.warn('[vocab] ro\'yxat o\'qilmadi:', e.code || e.message);
    return [];
  }
}

async function deleteSet(id) {
  const snap = LV.snapshot();
  if (!snap.signedIn) return;
  await deleteDoc(doc(db, 'users', snap.uid, 'vocabulary', id));
}

// ═══════════════════════════════════════════════════════════════════════════
// FIRESTORE — FLASHCARD TO'PLAMLARI
// ═══════════════════════════════════════════════════════════════════════════
async function saveDeck(title, level, cards, request) {
  const snap = LV.snapshot();
  if (!snap.signedIn) throw new Error('auth');

  const ref = await addDoc(collection(db, 'users', snap.uid, 'flashcards'), {
    title,
    level: level || null,
    request: request || '',
    target,
    cards,
    count: cards.length,
    source: 'ai',
    createdAt: serverTimestamp()
  });
  return ref.id;
}

async function loadDecks() {
  const snap = LV.snapshot();
  if (!snap.signedIn) return [];
  try {
    const qs = await getDocs(query(
      collection(db, 'users', snap.uid, 'flashcards'),
      orderBy('createdAt', 'desc'),
      fbLimit(50)
    ));
    const out = [];
    qs.forEach(d => out.push({ id: d.id, ...d.data() }));
    return out.filter(s => !s.target || s.target === target);
  } catch (e) {
    console.warn('[flashcards] ro\'yxat o\'qilmadi:', e.code || e.message);
    return [];
  }
}

async function deleteDeck(id) {
  const snap = LV.snapshot();
  if (!snap.signedIn) return;
  await deleteDoc(doc(db, 'users', snap.uid, 'flashcards', id));
}

// ═══════════════════════════════════════════════════════════════════════════
// UNIT YARATISH — to'plamdan to'liq dars
// ═══════════════════════════════════════════════════════════════════════════
async function buildUnit(set) {
  const snap = LV.snapshot();
  const t = TARGETS[target] || TARGETS.english;
  const native = NATIVE_NAME[snap.profile?.nativeLang || lang] || 'Uzbek';

  const wordList = set.words.map(w => `${w.word} — ${w.translation}`).join('\n');

  const prompt =
`Build a complete micro-lesson in ${t.name} using EXACTLY these words:

${wordList}

Explanations go in ${native}. Return STRICT JSON only:
{"title":"lesson title in ${native}",
 "objective":"what the student will be able to do after this lesson, in ${native}",
 "grammar":{"rule":"one grammar point these words naturally teach","explanation":"clear explanation in ${native}","examples":["3 example sentences in ${t.name}"]},
 "exercises":[
   {"type":"fill","question":"sentence with ___ gap","answer":"the missing word","hint":"hint in ${native}"},
   {"type":"choice","question":"question in ${t.name}","options":["a","b","c"],"answer":"correct option"},
   {"type":"translate","question":"sentence in ${native}","answer":"translation in ${t.name}"}
 ]}

Include at least 6 exercises mixing all three types. Every exercise must use one of the words above.`;

  const res = await LV.ai(LV.bestModel(true), [{ role: 'user', content: prompt }], {
    task: 'lesson',
    target,
    maxTokens: 4000,
    temperature: 0.5
  });

  if (!res.ok) throw new Error(res.message || 'AI javob bermadi');

  let raw = res.text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  const s = raw.indexOf('{'), e = raw.lastIndexOf('}');
  if (s < 0) throw new Error('AI JSON qaytarmadi');

  const unit = JSON.parse(raw.slice(s, e + 1));

  const snap2 = LV.snapshot();
  const ref = await addDoc(collection(db, 'users', snap2.uid, 'lessons'), {
    ...unit,
    target,
    fromSet: set.id,
    words: set.words,
    source: 'ai',
    createdAt: serverTimestamp()
  });

  return { id: ref.id, ...unit, words: set.words };
}

// ═══════════════════════════════════════════════════════════════════════════
// GLOBAL MAKON — netlify/functions/community.js bilan gaplashish
// ═══════════════════════════════════════════════════════════════════════════
async function communityCall(body) {
  const r = await fetch(COMMUNITY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);
  return data;
}

async function submitToCommunity(kind, item, level) {
  const snap = LV.snapshot();
  if (!snap.signedIn) throw new Error('auth');
  const idToken = await snap.user.getIdToken();

  const data = await communityCall({
    action: 'submit', kind, target, level,
    idToken,
    authorName: snap.profile?.displayName || snap.user.displayName || '',
    item
  });
  if (!data.ok) throw new Error(data.error || "Ulashilmadi");
  return data;
}

async function listCommunity(kind, level) {
  const data = await communityCall({ action: 'list', kind, target, level: level || undefined });
  if (!data.ok) throw new Error(data.error || "Yuklanmadi");
  return data.items || [];
}

// ═══════════════════════════════════════════════════════════════════════════
// UI — UMUMIY QOBIQ
// ═══════════════════════════════════════════════════════════════════════════
const SAMPLES = [
  "sayohat uchun 15 ta so'z",
  "restoranda ishlatiladigan iboralar",
  "biznes uchrashuvi lug'ati",
  "kundalik salomlashish",
  "imtihonda kerak bo'ladigan 20 ta so'z"
];

function renderShell(root) {
  root.innerHTML = `
    <div class="vr-card">
      <div class="vr-h">
        <i class="fa-solid fa-book-bookmark"></i> AI Lug'at xonasi
        <small>${(TARGETS[target] || TARGETS.english).name}</small>
      </div>
      <div class="vr-sub">
        Oddiy so'z bilan so'rang — AI so'zlarni tanlab, tarjima va misollar bilan
        saqlaydi (har safar boshqacha daraja va mavzu bilan). Flashcard yarating
        yoki 🌍 Global makonda boshqalar ulashgan lug'at/flashcardlarni ko'ring.
      </div>

      <div class="vr-tabs">
        <button class="vr-tab active" data-tab="vocab"><i class="fa-solid fa-layer-group"></i> So'z to'plamlari</button>
        <button class="vr-tab" data-tab="flashcard"><i class="fa-solid fa-clone"></i> Flashcardlar</button>
        <button class="vr-tab" data-tab="global"><i class="fa-solid fa-earth-asia"></i> 🌍 Global</button>
      </div>

      <!-- SO'Z TO'PLAMLARI -->
      <div class="vr-pane active" id="vrPaneVocab">
        <div class="vr-ask">
          <input class="vr-in" id="vrInput" placeholder="Masalan: sayohat mavzusida 15 ta so'z qo'sh"
                 onkeydown="if(event.key==='Enter')document.getElementById('vrGo').click()">
          <button class="vr-btn" id="vrGo"><i class="fa-solid fa-wand-magic-sparkles"></i> Yaratish</button>
        </div>
        <div class="vr-chips" id="vrChips">
          ${SAMPLES.map(s => `<button class="vr-chip" data-s="${s}">${s}</button>`).join('')}
        </div>
        <div class="vr-sets" id="vrSets"></div>
      </div>

      <!-- FLASHCARDLAR -->
      <div class="vr-pane" id="vrPaneFlash">
        <div class="vr-ask">
          <input class="vr-in" id="vrFcInput" placeholder="Masalan: hayvonlar mavzusida 10 ta flashcard"
                 onkeydown="if(event.key==='Enter')document.getElementById('vrFcGo').click()">
          <button class="vr-btn" id="vrFcGo"><i class="fa-solid fa-wand-magic-sparkles"></i> Yaratish</button>
        </div>
        <div class="vr-sets" id="vrDecks"></div>
      </div>

      <!-- GLOBAL MAKON -->
      <div class="vr-pane" id="vrPaneGlobal">
        <div class="vr-tabs" id="vrGlobalKind">
          <button class="vr-tab active" data-gkind="vocab">So'z to'plamlari</button>
          <button class="vr-tab" data-gkind="unit">Unitlar</button>
          <button class="vr-tab" data-gkind="flashcard">Flashcardlar</button>
        </div>
        <div class="vr-glevels" id="vrGlevels">
          <button class="vr-chip on" data-lvl="">Hammasi</button>
          ${LEVELS.map(l => `<button class="vr-chip" data-lvl="${l}">${l}</button>`).join('')}
        </div>
        <div class="vr-sets" id="vrGlobalList"></div>
      </div>

      <div class="vr-msg" id="vrMsg"></div>
    </div>`;

  $('#vrGo', root).onclick = () => handleAsk(root);
  root.querySelectorAll('[data-s]').forEach(b => {
    b.onclick = () => { $('#vrInput', root).value = b.dataset.s; handleAsk(root); };
  });

  $('#vrFcGo', root).onclick = () => handleFlashAsk(root);

  root.querySelectorAll('.vr-tabs > .vr-tab[data-tab]').forEach(b => {
    b.onclick = () => switchTab(root, b.dataset.tab);
  });

  root.querySelectorAll('[data-gkind]').forEach(b => {
    b.onclick = () => {
      root.querySelectorAll('[data-gkind]').forEach(x => x.classList.remove('active'));
      b.classList.add('active');
      loadAndRenderGlobal(root, b.dataset.gkind);
    };
  });

  root.querySelectorAll('#vrGlevels [data-lvl]').forEach(b => {
    b.onclick = () => {
      root.querySelectorAll('#vrGlevels [data-lvl]').forEach(x => x.classList.remove('on'));
      b.classList.add('on');
      globalLevel = b.dataset.lvl;
      const activeKind = root.querySelector('[data-gkind].active')?.dataset.gkind || 'vocab';
      loadAndRenderGlobal(root, activeKind);
    };
  });
}

function switchTab(root, tab) {
  activeTab = tab;
  root.querySelectorAll('.vr-tabs > .vr-tab[data-tab]').forEach(b =>
    b.classList.toggle('active', b.dataset.tab === tab));
  $('#vrPaneVocab', root).classList.toggle('active', tab === 'vocab');
  $('#vrPaneFlash', root).classList.toggle('active', tab === 'flashcard');
  $('#vrPaneGlobal', root).classList.toggle('active', tab === 'global');

  if (tab === 'global' && !globalItems.length) {
    loadAndRenderGlobal(root, 'vocab');
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// UI — SO'Z TO'PLAMLARI RO'YXATI
// ═══════════════════════════════════════════════════════════════════════════
function renderSets(root) {
  const box = $('#vrSets', root);
  if (!box) return;

  if (!sets.length) {
    box.innerHTML = `<div class="vr-empty">
      <i class="fa-solid fa-inbox" style="font-size:1.6rem;opacity:.4;display:block;margin-bottom:8px"></i>
      Hali lug'at to'plami yo'q. Yuqoridan so'rang.
    </div>`;
    return;
  }

  box.innerHTML = sets.map(s => `
    <div class="vr-set" data-id="${s.id}">
      <div class="vr-st" data-toggle="${s.id}">
        <div class="vr-si"><i class="fa-solid fa-layer-group"></i></div>
        <div>
          <div class="vr-sn">${esc(s.title)}</div>
          <div class="vr-sm">${s.count || s.words?.length || 0} ta so'z${s.level ? ' · ' + esc(s.level) : ''}${s.source === 'ai' ? ' · AI' : ''}</div>
        </div>
        <div class="vr-sx">
          <button class="vr-ic share" data-share="${s.id}" title="🌍 Global makonga ulashish">
            <i class="fa-solid fa-earth-asia"></i></button>
          <button class="vr-ic" data-unit="${s.id}" title="Bu to'plamdan dars yaratish">
            <i class="fa-solid fa-graduation-cap"></i></button>
          <button class="vr-ic del" data-del="${s.id}" title="O'chirish">
            <i class="fa-solid fa-trash"></i></button>
        </div>
      </div>
      <div class="vr-words">
        ${(s.words || []).map(w => `
          <div class="vr-w">
            <button class="vr-play" data-say="${esc(w.word)}" title="Eshitish">
              <i class="fa-solid fa-volume-high"></i></button>
            <div class="vr-wt">
              <div class="vr-ww">${esc(w.word)}</div>
              <div class="vr-wtr">${esc(w.translation)}</div>
              ${w.example ? `<div class="vr-wex">${esc(w.example)}${
                w.exampleTranslation ? ' — ' + esc(w.exampleTranslation) : ''}</div>` : ''}
            </div>
            ${w.level ? `<span class="vr-wl">${esc(w.level)}</span>` : ''}
          </div>`).join('')}
      </div>
    </div>`).join('');

  // Ochish/yopish
  box.querySelectorAll('[data-toggle]').forEach(el => {
    el.onclick = e => {
      if (e.target.closest('button[data-unit], button[data-del], button[data-share]')) return;
      el.parentElement.classList.toggle('open');
    };
  });

  box.querySelectorAll('[data-say]').forEach(b => {
    b.onclick = async e => {
      e.stopPropagation();
      try {
        const { Voice } = await import('./lv-speech.js');
        Voice.speak(b.dataset.say, (TARGETS[target] || TARGETS.english).tts);
      } catch { /* ovoz ishlamasa jim o'tamiz */ }
    };
  });

  box.querySelectorAll('[data-del]').forEach(b => {
    b.onclick = async e => {
      e.stopPropagation();
      if (!confirm("Bu to'plamni o'chirasizmi?")) return;
      try {
        await deleteSet(b.dataset.del);
        sets = sets.filter(s => s.id !== b.dataset.del);
        renderSets(root);
        msg("To'plam o'chirildi", 'ok');
      } catch (e2) {
        msg("O'chirilmadi: " + (e2.code || e2.message), 'err');
      }
    };
  });

  box.querySelectorAll('[data-unit]').forEach(b => {
    b.onclick = e => { e.stopPropagation(); handleUnit(root, b.dataset.unit, b); };
  });

  box.querySelectorAll('[data-share]').forEach(b => {
    b.onclick = e => { e.stopPropagation(); handleShareVocab(root, b.dataset.share, b); };
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// UI — FLASHCARD TO'PLAMLARI
// ═══════════════════════════════════════════════════════════════════════════
function renderDecks(root) {
  const box = $('#vrDecks', root);
  if (!box) return;

  if (!decks.length) {
    box.innerHTML = `<div class="vr-empty">
      <i class="fa-solid fa-clone" style="font-size:1.6rem;opacity:.4;display:block;margin-bottom:8px"></i>
      Hali flashcard to'plami yo'q. Yuqoridan so'rang.
    </div>`;
    return;
  }

  box.innerHTML = decks.map(d => `
    <div class="vr-set" data-id="${d.id}">
      <div class="vr-st" data-toggle="${d.id}">
        <div class="vr-si"><i class="fa-solid fa-clone"></i></div>
        <div>
          <div class="vr-sn">${esc(d.title)}</div>
          <div class="vr-sm">${d.count || d.cards?.length || 0} ta karta${d.level ? ' · ' + esc(d.level) : ''}</div>
        </div>
        <div class="vr-sx">
          <button class="vr-ic share" data-fshare="${d.id}" title="🌍 Global makonga ulashish">
            <i class="fa-solid fa-earth-asia"></i></button>
          <button class="vr-ic del" data-fdel="${d.id}" title="O'chirish">
            <i class="fa-solid fa-trash"></i></button>
        </div>
      </div>
      <div class="vr-words">
        <div class="vr-fc-grid">
          ${(d.cards || []).map(c => flashcardHtml(c)).join('')}
        </div>
      </div>
    </div>`).join('');

  box.querySelectorAll('[data-toggle]').forEach(el => {
    el.onclick = e => {
      if (e.target.closest('button[data-fdel], button[data-fshare]')) return;
      el.parentElement.classList.toggle('open');
    };
  });

  box.querySelectorAll('.vr-fc').forEach(el => {
    el.onclick = () => el.classList.toggle('flip');
  });

  box.querySelectorAll('[data-fdel]').forEach(b => {
    b.onclick = async e => {
      e.stopPropagation();
      if (!confirm("Bu flashcard to'plamini o'chirasizmi?")) return;
      try {
        await deleteDeck(b.dataset.fdel);
        decks = decks.filter(d => d.id !== b.dataset.fdel);
        renderDecks(root);
        msg("To'plam o'chirildi", 'ok');
      } catch (e2) {
        msg("O'chirilmadi: " + (e2.code || e2.message), 'err');
      }
    };
  });

  box.querySelectorAll('[data-fshare]').forEach(b => {
    b.onclick = e => { e.stopPropagation(); handleShareFlashcards(root, b.dataset.fshare, b); };
  });
}

function flashcardHtml(c) {
  return `
    <div class="vr-fc">
      <div class="vr-fc-in">
        <div class="vr-fc-f">
          <div class="vr-fc-emoji">${esc(c.emoji || '📇')}</div>
          <div class="vr-fc-word">${esc(c.front)}</div>
        </div>
        <div class="vr-fc-b">
          <div class="vr-fc-word">${esc(c.back)}</div>
          ${c.example ? `<div class="vr-fc-ex">${esc(c.example)}</div>` : ''}
        </div>
      </div>
    </div>`;
}

// ═══════════════════════════════════════════════════════════════════════════
// UI — GLOBAL MAKON
// ═══════════════════════════════════════════════════════════════════════════
async function loadAndRenderGlobal(root, kind) {
  const box = $('#vrGlobalList', root);
  box.innerHTML = `<div class="vr-empty"><span class="vr-spin"></span> Yuklanmoqda...</div>`;
  try {
    globalItems = await listCommunity(kind, globalLevel);
    renderGlobal(root, kind);
  } catch (e) {
    box.innerHTML = `<div class="vr-empty">Yuklanmadi: ${esc(e.message)}</div>`;
  }
}

function renderGlobal(root, kind) {
  const box = $('#vrGlobalList', root);
  if (!globalItems.length) {
    box.innerHTML = `<div class="vr-empty">
      <i class="fa-solid fa-earth-asia" style="font-size:1.6rem;opacity:.4;display:block;margin-bottom:8px"></i>
      Bu bo'limda hali hech kim ulashmagan. Birinchi bo'ling!
    </div>`;
    return;
  }

  box.innerHTML = globalItems.map(it => {
    const count = kind === 'flashcard' ? (it.cards?.length || 0)
                : kind === 'unit' ? (it.exercises?.length || 0) + ' mashq'
                : (it.words?.length || 0);
    const label = kind === 'unit' ? count : `${count} ta`;
    return `
    <div class="vr-set" data-gid="${it.id}">
      <div class="vr-st" data-gtoggle="${it.id}">
        <div class="vr-si"><i class="fa-solid ${kind === 'flashcard' ? 'fa-clone' : kind === 'unit' ? 'fa-graduation-cap' : 'fa-layer-group'}"></i></div>
        <div>
          <div class="vr-sn">${esc(it.title)}</div>
          <div class="vr-sm">${label}${it.level ? ' · ' + esc(it.level) : ''} <span class="vr-gauthor">· ${esc(it.authorName || "O'quvchi")}</span></div>
        </div>
        <div class="vr-sx">
          <button class="vr-btn sm" data-import="${it.id}" data-kind="${kind}">
            <i class="fa-solid fa-download"></i> O'zimga olish</button>
        </div>
      </div>
      <div class="vr-words">
        ${kind === 'flashcard' ? `<div class="vr-fc-grid">${(it.cards || []).map(flashcardHtml).join('')}</div>` : ''}
        ${kind === 'vocab' ? (it.words || []).map(w => `
          <div class="vr-w">
            <div class="vr-wt">
              <div class="vr-ww">${esc(w.word)}</div>
              <div class="vr-wtr">${esc(w.translation)}</div>
              ${w.example ? `<div class="vr-wex">${esc(w.example)}</div>` : ''}
            </div>
            ${w.level ? `<span class="vr-wl">${esc(w.level)}</span>` : ''}
          </div>`).join('') : ''}
        ${kind === 'unit' ? `
          ${it.objective ? `<div class="vr-wex" style="padding:9px 0">${esc(it.objective)}</div>` : ''}
          ${(it.words || []).map(w => `
          <div class="vr-w">
            <div class="vr-wt"><div class="vr-ww">${esc(w.word)}</div><div class="vr-wtr">${esc(w.translation)}</div></div>
          </div>`).join('')}` : ''}
      </div>
    </div>`;
  }).join('');

  box.querySelectorAll('[data-gtoggle]').forEach(el => {
    el.onclick = e => {
      if (e.target.closest('button[data-import]')) return;
      el.parentElement.classList.toggle('open');
    };
  });

  box.querySelectorAll('[data-import]').forEach(b => {
    b.onclick = async e => {
      e.stopPropagation();
      await handleImport(root, b.dataset.kind, b.dataset.import, b);
    };
  });
}

async function handleImport(root, kind, id, btn) {
  const snap = await LV.ready();
  if (!snap.signedIn) { msg('Import qilish uchun tizimga kiring.', 'err'); return; }

  const it = globalItems.find(x => x.id === id);
  if (!it) return;

  const old = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<span class="vr-spin"></span>';

  try {
    if (kind === 'vocab') {
      const newId = await saveSet(it.title + ' (global)', it.words, '', it.level);
      sets.unshift({ id: newId, title: it.title + ' (global)', words: it.words, count: it.words.length, source: 'ai', level: it.level, target });
      if (activeTab === 'vocab') renderSets(root);
    } else if (kind === 'flashcard') {
      const newId = await saveDeck(it.title + ' (global)', it.level, it.cards, '');
      decks.unshift({ id: newId, title: it.title + ' (global)', level: it.level, cards: it.cards, count: it.cards.length, target });
      if (activeTab === 'flashcard') renderDecks(root);
    } else if (kind === 'unit') {
      const snap2 = LV.snapshot();
      await addDoc(collection(db, 'users', snap2.uid, 'lessons'), {
        ...it, target, source: 'ai-community', createdAt: serverTimestamp()
      });
    }

    try {
      const idToken = await snap.user.getIdToken();
      await communityCall({ action: 'save_count', kind, id, idToken });
    } catch { /* hisoblagich muhim emas */ }

    msg("O'zingizga qo'shildi ✅", 'ok');
  } catch (e) {
    msg("Import qilinmadi: " + e.message, 'err');
  } finally {
    btn.disabled = false;
    btn.innerHTML = old;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// HANDLERS
// ═══════════════════════════════════════════════════════════════════════════
async function handleAsk(root) {
  if (busy) return;

  const input = $('#vrInput', root);
  const request = input.value.trim();
  if (!request) { input.focus(); return; }

  const snap = await LV.ready();
  if (!snap.signedIn) {
    msg('Lug\'at saqlash uchun <a href="../auth/login.html" style="color:#93a9ff">tizimga kiring</a>.', 'err');
    return;
  }

  const gate = await LV.can('vocab_ai');
  if (!gate.ok) {
    msg(gate.message + (gate.action
      ? ` <a href="${gate.action.href}" style="color:#93a9ff">${gate.action.label}</a>` : ''), 'err');
    return;
  }

  busy = true;
  const btn = $('#vrGo', root);
  btn.disabled = true;
  btn.innerHTML = '<span class="vr-spin"></span>AI ishlayapti...';
  msg('AI so\'zlarni tanlayapti — bu bir necha soniya oladi...', 'info');

  try {
    const { title, words, level } = await generateWords(request);
    await LV.consume('vocab_ai', 1);

    const id = await saveSet(title, words, request, level);
    sets.unshift({ id, title, words, count: words.length, source: 'ai', level, target });

    renderSets(root);
    input.value = '';
    msg(`<b>${words.length} ta so'z</b> qo'shildi: "${esc(title)}" (${esc(level)}). Ochib ko'ring, dars yarating yoki 🌍 ulashing.`, 'ok');

    const el = root.querySelector(`[data-id="${id}"]`);
    if (el) el.classList.add('open');

  } catch (e) {
    console.error('[vocab]', e);
    msg(e.message === 'auth'
      ? 'Sessiya tugagan. Qaytadan kiring.'
      : 'Yaratilmadi: ' + e.message, 'err');
  } finally {
    busy = false;
    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> Yaratish';
  }
}

async function handleFlashAsk(root) {
  if (busy) return;

  const input = $('#vrFcInput', root);
  const request = input.value.trim();
  if (!request) { input.focus(); return; }

  const snap = await LV.ready();
  if (!snap.signedIn) {
    msg('Flashcard saqlash uchun <a href="../auth/login.html" style="color:#93a9ff">tizimga kiring</a>.', 'err');
    return;
  }

  const gate = await LV.can('vocab_ai');
  if (!gate.ok) {
    msg(gate.message + (gate.action
      ? ` <a href="${gate.action.href}" style="color:#93a9ff">${gate.action.label}</a>` : ''), 'err');
    return;
  }

  busy = true;
  const btn = $('#vrFcGo', root);
  btn.disabled = true;
  btn.innerHTML = '<span class="vr-spin"></span>AI ishlayapti...';
  msg('AI flashcardlarni tayyorlayapti...', 'info');

  try {
    const { title, level, cards } = await generateFlashcards(request);
    await LV.consume('vocab_ai', 1);

    const id = await saveDeck(title, level, cards, request);
    decks.unshift({ id, title, level, cards, count: cards.length, target });

    renderDecks(root);
    input.value = '';
    msg(`<b>${cards.length} ta flashcard</b> tayyor: "${esc(title)}" (${esc(level)}). Bosib ag'daring yoki 🌍 ulashing.`, 'ok');

    const el = root.querySelector(`[data-id="${id}"]`);
    if (el) el.classList.add('open');

  } catch (e) {
    console.error('[flashcards]', e);
    msg(e.message === 'auth'
      ? 'Sessiya tugagan. Qaytadan kiring.'
      : 'Yaratilmadi: ' + e.message, 'err');
  } finally {
    busy = false;
    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> Yaratish';
  }
}

async function handleUnit(root, setId, btn) {
  if (busy) return;

  const set = sets.find(s => s.id === setId);
  if (!set || !set.words?.length) return;

  const gate = await LV.can('lesson');
  if (!gate.ok) {
    msg(gate.message + (gate.action
      ? ` <a href="${gate.action.href}" style="color:#93a9ff">${gate.action.label}</a>` : ''), 'err');
    return;
  }

  busy = true;
  const old = btn.innerHTML;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
  msg('AI dars yaratyapti — grammatika va mashqlar bilan...', 'info');

  try {
    const unit = await buildUnit(set);
    await LV.consume('lesson', 1);
    lastBuiltUnit = unit;

    msg(`<b>Dars tayyor:</b> "${esc(unit.title)}" — ${unit.exercises?.length || 0} ta mashq. ` +
        `<a href="profile.html" style="color:#93a9ff">Profilda ko'ring</a> · ` +
        `<a href="#" id="vrShareUnit" style="color:#6ee7b7">🌍 Global makonga ulashish</a>`, 'ok');

    const shareLink = document.getElementById('vrShareUnit');
    if (shareLink) shareLink.onclick = async (e) => {
      e.preventDefault();
      try {
        const res = await submitToCommunity('unit', lastBuiltUnit, set.level || 'A2');
        msg(res.duplicate ? "Bu dars allaqachon Global makonda bor 🌍" : "🌍 Dars Global makonga ulashildi!", 'ok');
      } catch (err) {
        msg("Ulashilmadi: " + err.message, 'err');
      }
    };

  } catch (e) {
    console.error('[vocab] unit:', e);
    msg('Dars yaratilmadi: ' + e.message, 'err');
  } finally {
    busy = false;
    btn.innerHTML = old;
  }
}

let lastBuiltUnit = null;

async function handleShareVocab(root, setId, btn) {
  const set = sets.find(s => s.id === setId);
  if (!set) return;

  const old = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<span class="vr-spin"></span>';

  try {
    const res = await submitToCommunity('vocab', { title: set.title, words: set.words }, set.level || 'A2');
    msg(res.duplicate
      ? "Bu to'plam allaqachon Global makonda bor 🌍"
      : "🌍 Global makonga ulashildi! Endi hamma ko'ra oladi.", 'ok');
  } catch (e) {
    msg("Ulashilmadi: " + e.message, 'err');
  } finally {
    btn.disabled = false;
    btn.innerHTML = old;
  }
}

async function handleShareFlashcards(root, deckId, btn) {
  const deck = decks.find(d => d.id === deckId);
  if (!deck) return;

  const old = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<span class="vr-spin"></span>';

  try {
    const res = await submitToCommunity('flashcard', { title: deck.title, level: deck.level, cards: deck.cards }, deck.level || 'A2');
    msg(res.duplicate
      ? "Bu flashcard to'plami allaqachon Global makonda bor 🌍"
      : "🌍 Global makonga ulashildi! Endi hamma ko'ra oladi.", 'ok');
  } catch (e) {
    msg("Ulashilmadi: " + e.message, 'err');
  } finally {
    btn.disabled = false;
    btn.innerHTML = old;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// O'RNATISH
// ═══════════════════════════════════════════════════════════════════════════
(async () => {
  const root = document.getElementById('lvVocabRoom');
  if (!root) return;

  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);

  renderShell(root);

  await LV.ready();
  sets = await loadSets();
  decks = await loadDecks();
  renderSets(root);
  renderDecks(root);

  console.log(`[vocab] lug'at xonasi tayyor — ${sets.length} to'plam, ${decks.length} flashcard deck (${target})`);
})();

export { generateWords, generateFlashcards, buildUnit, loadSets, loadDecks, submitToCommunity, listCommunity };
