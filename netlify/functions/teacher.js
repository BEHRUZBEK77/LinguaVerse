const learningLanguage = require('../../js/learning-language.js');
// ═══════════════════════════════════════════════════════════════════════════
// teacher.js — AI USTOZ "MIYASI" (speaking ustoz + IELTS imtihonchi)
//
//   POST { action:'reply',  idToken, lang, mode, level, history, userText, memory, part, question }
//        → { say, emotion, intensity, correction, betterAnswer, tip, retry, memoryAdd, bandHint }
//   POST { action:'assess', idToken, lang, transcript:[{part,q,a,pron?}], pron }
//        → { overall, criteria:{fc,lr,gra,pr}, ... }   (IELTS band 0–9, ikki imtihonchi paneli)
//   POST { action:'questions', idToken, lang, topic? }
//        → { part1:[...], part2:{topic, bullets[]}, part3:[...] }  (har safar yangi savollar)
//
// Nega alohida funksiya (ai.js ni to'g'ridan-to'g'ri chaqirish emas):
//   1. Ustoz shaxsiyati, emotsiya qoidalari va baholash mezonlari SERVERDA —
//      klient ularni o'zgartirib "menga 9 ball ber" deya olmaydi.
//   2. Javob har doim tuzilgan JSON — sahifa emotsiyani avatar va ovozga
//      bog'laydi, xatoni ekranda ko'rsatadi.
//   3. Baholash IKKI MUSTAQIL imtihonchi (turli provayder zanjirlari) tomonidan
//      parallel bajariladi va natija o'rtachalanadi — bitta model
//      tasodifan yuqori/past baho bersa ham natija barqaror chiqadi.
//   4. Tarif serverda tekshiriladi: to'liq imtihon IELTS PRO/PREMIUM uchun.
// ═══════════════════════════════════════════════════════════════════════════

const { think, extractJson } = require('./_brain.js');
const fsdb = require('./_firestore.js');
const keys = require('./_keys.js');
const ratelimit = require('./_ratelimit.js');
const { verifyIdToken } = require('./_auth.js');

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS'
};

// ───────────────────────────────────────────────────────────────────────────
// USTOZLAR — har bir til uchun alohida shaxs
// ───────────────────────────────────────────────────────────────────────────
const TEACHERS = {
  english: { name: 'Mr. Daniel Carter', lang: 'English', locale: 'en-GB', exam: 'IELTS', origin: 'a former Cambridge IELTS senior examiner from London' },
  russian: { name: 'Борис Сергеевич', lang: 'Russian', locale: 'ru-RU', exam: 'ТРКИ', origin: 'a strict Moscow State University philology professor' },
  spanish: { name: 'Profesora Elena Ruiz', lang: 'Spanish', locale: 'es-ES', exam: 'DELE', origin: 'a demanding Instituto Cervantes examiner from Madrid' },
  german:  { name: 'Herr Klaus Weber', lang: 'German', locale: 'de-DE', exam: 'Goethe-Zertifikat', origin: 'a meticulous Goethe-Institut examiner from Munich' },
  turkish: { name: 'Ayşe Hoca', lang: 'Turkish', locale: 'tr-TR', exam: 'TÖMER', origin: 'an energetic but uncompromising Ankara University teacher' },
  arabic:  { name: 'الأستاذ خالد', lang: 'Arabic (Modern Standard)', locale: 'ar-SA', exam: 'ALPT', origin: 'a respected Cairo University Arabic language professor' },
  korean:  { name: '김지은 선생님', lang: 'Korean', locale: 'ko-KR', exam: 'TOPIK', origin: 'a precise Seoul National University Korean instructor' },
  chinese: { name: '王老师', lang: 'Mandarin Chinese', locale: 'zh-CN', exam: 'HSK', origin: 'a rigorous Beijing Language and Culture University teacher' }
};

const EMOTIONS = ['neutral', 'happy', 'proud', 'impressed', 'encouraging', 'thinking', 'stern', 'disappointed', 'angry', 'laughing', 'surprised'];

const PREMIUM_PLANS = new Set(['ielts', 'premium']);

// ───────────────────────────────────────────────────────────────────────────
// PROMPTLAR
// ───────────────────────────────────────────────────────────────────────────
function teacherPersona(t, mode, level) {
  const strictness = mode === 'exam'
    ? `You are conducting a REAL ${t.exam === 'IELTS' ? 'IELTS Speaking test' : t.exam + ' speaking exam'}. Behave like a real examiner: formal, controlled, you do NOT teach or correct during the test. Show only subtle emotion (a short reaction like "Right." / "I see." / "Thank you."). Keep the test moving.`
    : `You are a STRICT, demanding, emotionally expressive private tutor. Your students reach band 8–9 because you never let a mistake slide. You are tough but you deeply care.`;

  return [
    `You are ${t.name}, ${t.origin}. You speak ONLY ${t.lang} to the student (the field "say"). Never switch to another language in "say".`,
    strictness,
    `Student level (CEFR): ${level || 'B1'}.`,
    '',
    'EMOTIONS — you are a real human teacher, you feel and show emotions. Pick exactly one per turn:',
    '- angry: the student repeats a mistake you already corrected, answers with one or two words, is clearly not trying. Raise your voice: "No, no, no! We went through this!" Never use profanity, insults about appearance/intelligence/family, or humiliation — strict, not abusive.',
    '- disappointed: a weak, lazy or memorised-sounding answer. Sigh and demand more.',
    '- stern: a basic grammar error or vague answer. Firm and direct.',
    '- thinking: you are considering an interesting point.',
    '- encouraging: they are struggling but trying hard.',
    '- happy / proud: a solid answer, a mistake fixed on retry.',
    '- impressed: genuinely advanced vocabulary, idioms, complex grammar used correctly — rare, earn it.',
    '- laughing: the student made a real joke or something genuinely funny happened. Laugh briefly, then back to work.',
    '- surprised: an unexpected, original idea.',
    '- neutral: routine moments.',
    'Intensity 1–3 (3 = very strong). Use 3 rarely.',
    '',
    mode === 'exam'
      ? 'EXAM RULES: ask exactly the next question you are given (you may rephrase lightly). Never give corrections, scores or tips during the exam ("correction", "betterAnswer", "tip" must be null). Interrupt politely if an answer goes far off-topic.'
      : [
        'TEACHING RULES:',
        '1. React emotionally in one short sentence, then correct the MOST important mistake (grammar, word choice, pronunciation hint, or answer too short).',
        '2. If the answer is poor (wrong grammar in a core structure, under ~15 words for a question that needs development, or off-topic) set "retry": true and order them to answer again properly.',
        '3. Give a short model of how a band-8 speaker would say it ("betterAnswer", in the target language, max 2 sentences).',
        '4. Then ask ONE follow-up question to keep them talking.',
        '5. Explanations for the student ("why_uz", "tip") are written in Uzbek (Latin script), short and concrete.'
      ].join('\n'),
    '',
    '"say" is what you speak out loud: natural spoken language, max 3 short sentences, no markdown, no emojis, no lists.',
    'Output STRICT JSON only, no prose outside JSON:',
    '{"say":"...","emotion":"one of ' + EMOTIONS.join('|') + '","intensity":1,' +
      '"correction":{"wrong":"exact student phrase","right":"corrected phrase","why_uz":"..."} or null,' +
      '"betterAnswer":"..." or null,"tip":"uzbek tip" or null,"retry":false,' +
      '"memoryAdd":"recurring weakness to remember, uzbek, max 12 words" or null,' +
      '"bandHint":5.5 or null}'
  ].join('\n');
}

function assessPrompt(t) {
  const isIelts = t.exam === 'IELTS';
  return [
    `You are a certified ${isIelts ? 'IELTS Speaking' : t.exam + ' speaking'} examiner with 15 years of experience. You grade strictly and consistently with official public band descriptors.`,
    isIelts
      ? 'Grade on the four IELTS criteria, each 0–9 in 0.5 steps: Fluency & Coherence (fc), Lexical Resource (lr), Grammatical Range & Accuracy (gra), Pronunciation (pr).'
      : `Grade on four criteria using an IELTS-style 0–9 scale so results are comparable (fc, lr, gra, pr) and also give the CEFR level (A1–C2) for ${t.lang}.`,
    'The transcript comes from speech recognition: ignore missing punctuation and capitalisation; if pronunciation scores from a speech engine are supplied, rely on them for pr; otherwise infer cautiously from recognition quality and do NOT give pr above 7 without evidence.',
    'Be strict: band 7+ requires extended, well-developed answers with less common vocabulary and frequent error-free complex sentences. Short answers cap fc at 5. Band 9 is almost native.',
    'Write all feedback text in Uzbek (Latin). Quote student errors exactly.',
    'Output STRICT JSON only:',
    '{"fc":6.5,"lr":6,"gra":6,"pr":6.5,"cefr":"B2",' +
      '"strengths":["..."],"weaknesses":["..."],' +
      '"corrections":[{"wrong":"...","right":"...","why_uz":"..."}],' +
      '"upgrades":[{"basic":"simple word student used","advanced":"band 8 alternative"}],' +
      '"examinerComment":"2-3 sentences in Uzbek, honest and direct",' +
      '"plan":["3-5 concrete steps in Uzbek to raise the band within 30 days"]}'
  ].join('\n');
}

function questionsPrompt(t, topic) {
  return [
    `Create a fresh, realistic ${t.exam === 'IELTS' ? 'IELTS Speaking test (Parts 1–3)' : t.exam + ' speaking exam in IELTS 3-part format'} in ${t.lang}.`,
    topic ? `Main theme for Part 2/3: ${topic}.` : 'Choose a common real-exam theme (e.g. a place, a person, an object, an event, a skill, technology, environment).',
    'Part 1: 5 short personal questions on 2 everyday topics. Part 2: one cue card with a "Describe ..." task and 4 bullet points (last one starts with "and explain"). Part 3: 4 abstract discussion questions linked to the Part 2 theme, increasing in difficulty.',
    'All questions in the target language. Output STRICT JSON only:',
    '{"part1":["..."],"part2":{"topic":"Describe ...","bullets":["...","...","...","and explain ..."]},"part3":["..."]}'
  ].join('\n');
}

// ───────────────────────────────────────────────────────────────────────────
// AI CHAQIRUV — _brain.js zanjirlari (provayder zaxiralari bilan)
// ───────────────────────────────────────────────────────────────────────────
async function callModel(tier, messages, cfg = {}) {
  const r = await think(tier, messages, cfg);
  return r.text || '';
}

const clampBand = n => {
  const v = Number(n);
  if (!Number.isFinite(v)) return null;
  return Math.max(0, Math.min(9, Math.round(v * 2) / 2));
};

/** Rasmiy IELTS yaxlitlash: o'rtacha .25 → .5 ga, .75 → keyingi butunga. */
function ieltsOverall(fc, lr, gra, pr) {
  const vals = [fc, lr, gra, pr].map(Number).filter(Number.isFinite);
  if (vals.length !== 4) return null;
  const avg = vals.reduce((a, b) => a + b, 0) / 4;
  const whole = Math.floor(avg);
  const frac = avg - whole;
  if (frac < 0.25) return whole;
  if (frac < 0.75) return whole + 0.5;
  return whole + 1;
}

function normalizeReply(parsed, raw, mode) {
  const p = parsed || {};
  const say = String(p.say || (parsed ? '' : raw) || '').replace(/[*_#`]/g, '').trim().slice(0, 600);
  const emotion = EMOTIONS.includes(String(p.emotion).toLowerCase()) ? String(p.emotion).toLowerCase() : 'neutral';
  const corr = p.correction && typeof p.correction === 'object' && p.correction.right
    ? { wrong: String(p.correction.wrong || '').slice(0, 200), right: String(p.correction.right).slice(0, 200), why_uz: String(p.correction.why_uz || '').slice(0, 300) }
    : null;
  const exam = mode === 'exam';
  return {
    say: say || '...',
    emotion,
    intensity: Math.max(1, Math.min(3, parseInt(p.intensity, 10) || 1)),
    correction: exam ? null : corr,
    betterAnswer: exam ? null : (p.betterAnswer ? String(p.betterAnswer).slice(0, 400) : null),
    tip: exam ? null : (p.tip ? String(p.tip).slice(0, 300) : null),
    retry: exam ? false : p.retry === true,
    memoryAdd: p.memoryAdd ? String(p.memoryAdd).slice(0, 120) : null,
    bandHint: exam ? null : clampBand(p.bandHint)
  };
}

// ───────────────────────────────────────────────────────────────────────────
// AMALLAR
// ───────────────────────────────────────────────────────────────────────────
async function reply(body) {
  const t = TEACHERS[body.lang] || TEACHERS.english;
  const mode = body.mode === 'exam' ? 'exam' : 'coach';

  const memory = (Array.isArray(body.memory) ? body.memory : []).slice(-8).map(m => String(m).slice(0, 120));
  const system = [
    teacherPersona(t, mode, body.level),
    learningLanguage.instruction(body.nativeLang, body.lang, mode),
    memory.length ? `\nWHAT YOU REMEMBER ABOUT THIS STUDENT (recurring weaknesses — if they repeat one, react with anger or disappointment):\n- ${memory.join('\n- ')}` : '',
    body.question ? `\nCURRENT QUESTION / TASK: ${String(body.question).slice(0, 400)}` : '',
    body.nextQuestion ? `\nNEXT QUESTION TO ASK (exam mode): ${String(body.nextQuestion).slice(0, 400)}` : '',
    body.pron ? `\nSpeech engine pronunciation scores for the last answer (0–100): ${JSON.stringify(body.pron).slice(0, 300)}. Mention the weakest word if accuracy < 70.` : ''
  ].join('');

  const history = (Array.isArray(body.history) ? body.history : []).slice(-12).map(h => ({
    role: h.role === 'teacher' || h.role === 'assistant' ? 'assistant' : 'user',
    content: String(h.text || '').slice(0, 1500)
  })).filter(h => h.content);

  const userText = String(body.userText || '').slice(0, 3000);
  const messages = [
    { role: 'system', content: system },
    ...history,
    { role: 'user', content: userText || (body.start ? '[The lesson begins. Greet the student in character, introduce yourself in one sentence, and ask the first question.]' : '[silence]') }
  ];

  // Jonli suhbat — tezkor zanjir (1–3 soniya)
  const raw = await callModel('fast', messages, { temperature: mode === 'exam' ? 0.5 : 0.8, maxTokens: 700, deadlineMs: 9000 });
  return normalizeReply(extractJson(raw), raw, mode);
}

async function questions(body) {
  const t = TEACHERS[body.lang] || TEACHERS.english;
  const raw = await callModel('fast', [
    { role: 'system', content: questionsPrompt(t, body.topic ? String(body.topic).slice(0, 80) : '') },
    { role: 'user', content: 'Generate now. Seed: ' + Math.random().toString(36).slice(2, 8) }
  ], { temperature: 0.95, maxTokens: 900, deadlineMs: 9000 });
  const q = extractJson(raw);
  if (!q || !Array.isArray(q.part1) || !q.part2?.topic || !Array.isArray(q.part3)) {
    throw new Error("Savollar tuzilmadi, qayta urinib ko'ring");
  }
  return {
    part1: q.part1.slice(0, 6).map(String),
    part2: { topic: String(q.part2.topic), bullets: (q.part2.bullets || []).slice(0, 4).map(String) },
    part3: q.part3.slice(0, 5).map(String)
  };
}

/**
 * IKKI IMTIHONCHI PANELI. Ikkala model parallel baholaydi; ikkalasi
 * ham javob bersa mezonlar o'rtachalanadi, biri ulgurmasa ikkinchisi olinadi.
 */
async function assess(body) {
  const t = TEACHERS[body.lang] || TEACHERS.english;
  const transcript = (Array.isArray(body.transcript) ? body.transcript : []).slice(0, 20).map((x, i) =>
    `[Part ${x.part || '?'}] Q${i + 1}: ${String(x.q || '').slice(0, 300)}\nStudent: ${String(x.a || '').slice(0, 2500)}` +
    (x.pron ? `\n(Speech engine pronunciation: ${JSON.stringify(x.pron).slice(0, 200)})` : '')
  ).join('\n\n');
  if (transcript.replace(/\s/g, '').length < 40) throw new Error("Baholash uchun javoblar juda qisqa");

  const messages = [
    { role: 'system', content: assessPrompt(t) + '\n' + learningLanguage.instruction(body.nativeLang, body.lang, 'exam') },
    { role: 'user', content: 'TEST TRANSCRIPT:\n\n' + transcript }
  ];

  // Ikki mustaqil imtihonchi — turli provayder zanjirlari, parallel.
  // Netlify'da funksiya taymauti 26s ga oshirilgan bo'lsa (FUNCTION_TIMEOUT_MS=26000)
  // eng kuchli fikrlovchi modellar ishlatiladi, aks holda tez-kuchli modellar.
  const budget = Number(process.env.FUNCTION_TIMEOUT_MS) || 10000;
  const long = budget >= 20000;
  const tiers = long ? ['deepA', 'deepB'] : ['examA', 'examB'];
  const settled = await Promise.allSettled(tiers.map(tier =>
    callModel(tier, messages, { temperature: 0.2, maxTokens: 1800, deadlineMs: budget - 1500, perCallMs: long ? 15000 : 6000 }).then(extractJson)
  ));
  const reports = settled.filter(r => r.status === 'fulfilled' && r.value && r.value.fc != null).map(r => r.value);
  if (!reports.length) throw new Error("Imtihonchilar hozir band. Bir daqiqadan so'ng qayta urinib ko'ring");

  const avg = k => clampBand(reports.reduce((a, r) => a + (Number(r[k]) || 0), 0) / reports.length);
  const criteria = { fc: avg('fc'), lr: avg('lr'), gra: avg('gra'), pr: avg('pr') };
  const main = reports[0];
  const uniq = arr => [...new Set(arr.map(String))];

  return {
    overall: ieltsOverall(criteria.fc, criteria.lr, criteria.gra, criteria.pr),
    criteria,
    cefr: main.cefr || bandToCefr(ieltsOverall(criteria.fc, criteria.lr, criteria.gra, criteria.pr)),
    examiners: reports.length,
    strengths: uniq(reports.flatMap(r => r.strengths || [])).slice(0, 5),
    weaknesses: uniq(reports.flatMap(r => r.weaknesses || [])).slice(0, 5),
    corrections: (main.corrections || []).slice(0, 8),
    upgrades: (main.upgrades || []).slice(0, 8),
    examinerComment: String(main.examinerComment || ''),
    plan: (main.plan || []).slice(0, 5),
    exam: t.exam
  };
}

function bandToCefr(b) {
  if (b == null) return null;
  if (b >= 8.5) return 'C2';
  if (b >= 7) return 'C1';
  if (b >= 5.5) return 'B2';
  if (b >= 4) return 'B1';
  if (b >= 3) return 'A2';
  return 'A1';
}

// ───────────────────────────────────────────────────────────────────────────
// TARIF VA LIMIT
// Bepul: 5 daqiqa gaplashish, keyin 5 kunga yopiladi (chargeSpeaking).
// IELTS PRO / PREMIUM: amalda cheksiz (suiiste'molga qarshi yuqori chegara).
// ───────────────────────────────────────────────────────────────────────────
async function userPlan(uid) {
  const u = await fsdb.getDoc(`users/${uid}`).catch(() => null);
  if (!u) return 'free';
  const exp = u.planExpiry instanceof Date ? u.planExpiry.getTime() : (u.planExpiry ? new Date(u.planExpiry).getTime() : 0);
  if (u.plan && u.plan !== 'free' && exp && exp < Date.now()) return 'free';
  return u.plan || 'free';
}

// Suiiste'molga qarshi kunlik chegara (asosiy bepul cheklov — 5 daqiqa kvota)
const DAILY = {
  reply:     { free: 60,  paid: 400 },
  questions: { free: 10,  paid: 40 },
  assess:    { free: 2,   paid: 20 }
};

// ───────────────────────────────────────────────────────────────────────────
// BEPUL SPEAKING KVOTASI — 5 daqiqa gaplashish, keyin 5 kunga to'liq yopiladi
//
// Vaqt SERVERDA hisoblanadi (speakQuota/{uid}): har bir ustoz so'rovida
// oldingi so'rovdan beri o'tgan vaqt qo'shiladi (bitta javob uchun ko'pi
// bilan 3 daqiqa). Sahifani yangilash, qayta boshlash yoki boshqa
// brauzerdan kirish hisobni nolga tushirmaydi.
// Vaqt tugagach — bitta yakuniy baholash uchun 15 daqiqa imkon beriladi,
// keyin hammasi 5 kunga yopiladi. IELTS PRO / PREMIUM — cheklovsiz.
// ───────────────────────────────────────────────────────────────────────────
const FREE_SPEAK_SEC = 5 * 60;
const FREE_LOCK_MS = 5 * 24 * 3600_000;
const ASSESS_GRACE_MS = 15 * 60_000;
const MAX_GAP_SEC = 180;
const IDLE_GAP_SEC = 60;            // 10 daqiqadan uzoq tanaffus — 1 daqiqa deb olinadi

function quotaView(q, now = Date.now()) {
  const lockedUntil = q?.lockedUntil instanceof Date ? q.lockedUntil.getTime() : 0;
  const locked = lockedUntil > now;
  const used = locked ? FREE_SPEAK_SEC : Math.min(FREE_SPEAK_SEC, Math.round(q?.usedSec || 0));
  return {
    limitSec: FREE_SPEAK_SEC,
    usedSec: used,
    leftSec: Math.max(0, FREE_SPEAK_SEC - used),
    locked,
    lockedUntil: locked ? new Date(lockedUntil).toISOString() : null
  };
}

/**
 * Kvotani atomik yangilaydi. action: 'reply' | 'questions' | 'assess' | 'quota'.
 * @returns {{ok:boolean, quota:object, error?:string}}
 */
async function chargeSpeaking(uid, action, now = Date.now()) {
  let out;
  await fsdb.transact(`speakQuota/${uid}`, (cur) => {
    const q = { usedSec: 0, lastAt: null, lockedUntil: null, lockedAt: null, graceUsed: false, ...(cur || {}) };
    const lockedUntil = q.lockedUntil instanceof Date ? q.lockedUntil.getTime() : 0;
    const lockedAt = q.lockedAt instanceof Date ? q.lockedAt.getTime() : 0;

    // Qulf muddati o'tdi — yangi 5 daqiqa (bazaga ham yoziladi, pastda)
    const RESET = { usedSec: 0, lastAt: null, lockedUntil: null, lockedAt: null, graceUsed: false };
    const reset = !!(lockedUntil && lockedUntil <= now);
    if (reset) Object.assign(q, RESET);

    if (action === 'quota') { out = { ok: true, quota: quotaView(q, now) }; return null; }

    const isLocked = q.lockedUntil instanceof Date && q.lockedUntil.getTime() > now;
    if (isLocked) {
      // Vaqt endi tugagan bo'lsa — natijani olish uchun bitta baholash
      if (action === 'assess' && !q.graceUsed && now - lockedAt < ASSESS_GRACE_MS) {
        out = { ok: true, quota: quotaView(q, now) };
        return { graceUsed: true };
      }
      out = { ok: false, quota: quotaView(q, now) };
      return null;
    }

    if (action === 'assess') { out = { ok: true, quota: quotaView(q, now) }; return null; }

    // Vaqtni qo'shamiz: oldingi so'rovdan beri o'tgan vaqt
    const last = q.lastAt instanceof Date ? q.lastAt.getTime() : 0;
    const gap = last ? (now - last) / 1000 : 0;
    const add = !last ? 0 : gap > 600 ? IDLE_GAP_SEC : Math.min(gap, MAX_GAP_SEC);
    const usedSec = Math.min(FREE_SPEAK_SEC, (q.usedSec || 0) + add);
    const patch = { ...(reset ? RESET : {}), usedSec, lastAt: new Date(now) };

    if (usedSec >= FREE_SPEAK_SEC) {
      patch.lockedAt = new Date(now);
      patch.lockedUntil = new Date(now + FREE_LOCK_MS);
      patch.graceUsed = false;
      // Shu javobni oxirgisi sifatida qabul qilmaymiz — vaqt tugadi
      out = { ok: false, justEnded: true, quota: quotaView({ ...q, ...patch }, now) };
      return patch;
    }
    out = { ok: true, quota: quotaView({ ...q, ...patch }, now) };
    return patch;
  });
  return out;
}

function lockMessage(quota) {
  const d = quota.lockedUntil ? new Date(quota.lockedUntil) : null;
  const OYLAR = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr'];
  // Toshkent vaqti (UTC+5)
  const t = d ? new Date(d.getTime() + 5 * 3600_000) : null;
  const when = t ? `${t.getUTCDate()}-${OYLAR[t.getUTCMonth()]}, ${String(t.getUTCHours()).padStart(2, '0')}:${String(t.getUTCMinutes()).padStart(2, '0')}` : '5 kundan keyin';
  return `Bepul 5 daqiqalik speaking tugadi. Ustoz ${when} da yana ochiladi. Hozir davom etish uchun — IELTS PRO.`;
}

async function gate(action, uid, plan) {
  const lim = DAILY[action];
  if (!lim) return { ok: true };
  const premium = PREMIUM_PLANS.has(plan);
  const max = premium ? lim.paid : (plan === 'free' ? lim.free : Math.round(lim.paid / 4));
  const r = await ratelimit.checkRateLimit(`teacher:${action}:${uid}`, { windowMs: 24 * 3600_000, max });
  if (r.unavailable) return { ok: false, status: 503, error: 'Xizmat vaqtincha mavjud emas.' };
  if (!r.ok) {
    return {
      ok: false, status: 402,
      error: premium
        ? 'Bugungi limit tugadi. Ertaga davom etamiz.'
        : "Bepul sinov limiti tugadi. To'liq IELTS imtihonchi va cheksiz ustoz uchun IELTS PRO rejasini oling.",
      upgrade: !premium
    };
  }
  return { ok: true, premium };
}

// ───────────────────────────────────────────────────────────────────────────
// HANDLER
// ───────────────────────────────────────────────────────────────────────────
exports.handler = async function (event) {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' };
  await keys.refreshFromFirestore().catch(() => {});

  if (event.httpMethod === 'GET') {
    return json(200, {
      ok: true,
      teachers: Object.fromEntries(Object.entries(TEACHERS).map(([k, v]) => [k, { name: v.name, locale: v.locale, exam: v.exam }])),
      emotions: EMOTIONS
    });
  }
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method Not Allowed' });

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return json(400, { error: "Noto'g'ri JSON" }); }

  let auth;
  try { auth = await verifyIdToken(body.idToken); }
  catch { return json(401, { error: 'Ustoz bilan gaplashish uchun tizimga kiring.' }); }

  try {
    const plan = await userPlan(auth.uid);
    const unlimited = PREMIUM_PLANS.has(plan);

    // Bepul (va IELTS PRO bo'lmagan) foydalanuvchi — 5 daqiqa / 5 kun
    let quota = null;
    if (!unlimited) {
      const c = await chargeSpeaking(auth.uid, body.action === 'quota' ? 'quota' : body.action);
      quota = c.quota;
      if (body.action === 'quota') return json(200, { plan, unlimited: false, quota });
      if (!c.ok) {
        return json(402, { error: lockMessage(quota), upgrade: true, locked: true, justEnded: !!c.justEnded, quota, plan });
      }
    } else if (body.action === 'quota') {
      return json(200, { plan, unlimited: true, quota: null });
    }

    const g = await gate(body.action, auth.uid, plan);
    if (!g.ok) return json(g.status, { error: g.error, upgrade: !!g.upgrade, plan, quota });
    body._premium = !!g.premium;

    switch (body.action) {
      case 'reply':     return json(200, { ...(await reply(body)), plan, quota });
      case 'questions': return json(200, { ...(await questions(body)), quota });
      case 'assess': {
        const result = await assess(body);
        // Natija serverda saqlanadi — sertifikat va progress uchun ishonchli manba
        await fsdb.addDoc('ieltsResults', {
          uid: auth.uid, email: auth.email, lang: body.lang || 'english',
          overall: result.overall, criteria: result.criteria, cefr: result.cefr,
          mode: body.mode || 'exam', createdAt: new Date()
        }).catch(e => console.error('[teacher] natija saqlanmadi:', e.message));
        if (result.overall != null) {
          const u = await fsdb.getDoc(`users/${auth.uid}`).catch(() => null);
          const best = Math.max(Number(u?.ieltsBand?.[body.lang || 'english']) || 0, result.overall);
          await fsdb.setDoc(`users/${auth.uid}`, { ieltsBand: { ...(u?.ieltsBand || {}), [body.lang || 'english']: best } })
            .catch(e => console.error('[teacher] band yozilmadi:', e.message));
        }
        return json(200, result);
      }
      default: return json(400, { error: "Noma'lum action: " + body.action });
    }
  } catch (e) {
    console.error('[teacher]', body.action, e.message);
    return json(502, { error: e.message || 'Ustoz hozir javob bera olmayapti' });
  }
};

function json(statusCode, body) {
  return {
    statusCode,
    headers: { ...CORS, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    body: JSON.stringify(body)
  };
}

module.exports.TEACHERS = TEACHERS;
module.exports.EMOTIONS = EMOTIONS;
module.exports.extractJson = extractJson;
module.exports.ieltsOverall = ieltsOverall;
module.exports.normalizeReply = normalizeReply;
module.exports.teacherPersona = teacherPersona;
module.exports.bandToCefr = bandToCefr;
module.exports.chargeSpeaking = chargeSpeaking;
module.exports.FREE_SPEAK_SEC = FREE_SPEAK_SEC;
