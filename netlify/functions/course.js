// ═══════════════════════════════════════════════════════════════════════════
// course.js — AI VIDEO DARSLAR (B2 / C2, 8 til)
//
//   POST { action:'mine',   idToken }                       → sotib olingan kurslar + progress
//   POST { action:'lesson', idToken, lang, level, n }       → dars ssenariysi (slaydlar + nutq)
//   POST { action:'audio',  idToken, lang, level, n, scene }→ sahna ovozi (keshlangan mp3)
//   POST { action:'quiz',   idToken, lang, level, n, answers } → test SERVERDA tekshiriladi
//   GET  ?verify=<sertifikat ID>                            → sertifikatni ochiq tekshirish
//
// Qanday ishlaydi:
//   1. Dars birinchi marta ochilganda AI ustoz ssenariy yozadi (2 bosqich:
//      avval sahnalar, keyin test) va courseLessons/ ga saqlanadi. Keyingi
//      barcha xaridorlar o'sha tayyor darsni oladi — tez va arzon.
//   2. Har sahna ovozi ham bir marta yaratiladi va courseAudio/ da keshlanadi
//      (ElevenLabs har ko'rishda qayta pul olmaydi).
//   3. Test javoblari klientga yuborilmaydi — server tekshiradi. Shu sabab
//      sertifikatni "aldab" olib bo'lmaydi.
//   4. Yakuniy imtihondan 80%+ va darslarning 70%+ dan o'tilsa — server
//      sertifikat beradi (certificates/{id}, ochiq tekshiriladi).
// ═══════════════════════════════════════════════════════════════════════════

const syllabus = require('./_syllabus.js');
const crypto = require('crypto');
const learning = require('../../js/learning-language.js');
const fsdb = require('./_firestore.js');
const keys = require('./_keys.js');
const { think, extractJson } = require('./_brain.js');
const { verifyIdToken } = require('./_auth.js');
const { courseProduct, ultraActive, COURSE_LANGS } = require('./_plans.js');

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS'
};

// js/course-catalog.mjs dagi dars ro'yxati bilan bir xil (ESM bo'lgani uchun
// shu yerda o'qiymiz — ikki joyda yozilmasin).
let CATALOG = null;
async function catalog() {
  if (CATALOG) return CATALOG;
  const path = require('path');
  const { pathToFileURL } = require('url');
  const candidates = [
    path.join(__dirname, '..', '..', 'js', 'course-catalog.mjs'),
    path.join(process.cwd(), 'js', 'course-catalog.mjs')
  ];
  for (const p of candidates) {
    try { CATALOG = await import(pathToFileURL(p).href); return CATALOG; } catch {}
  }
  throw new Error('Kurs katalogi topilmadi');
}

const LANG_INFO = {
  english: { name: 'English', locale: 'en-GB', exam: 'IELTS' },
  russian: { name: 'Russian', locale: 'ru-RU', exam: 'TORFL' },
  spanish: { name: 'Spanish', locale: 'es-ES', exam: 'DELE' },
  german:  { name: 'German', locale: 'de-DE', exam: 'Goethe-Zertifikat' },
  turkish: { name: 'Turkish', locale: 'tr-TR', exam: 'TÖMER' },
  arabic:  { name: 'Modern Standard Arabic', locale: 'ar-SA', exam: 'ALPT' },
  korean:  { name: 'Korean', locale: 'ko-KR', exam: 'TOPIK' },
  chinese: { name: 'Mandarin Chinese', locale: 'zh-CN', exam: 'HSK' }
};

const EMOS = ['neutral', 'happy', 'proud', 'impressed', 'encouraging', 'thinking', 'stern', 'disappointed', 'surprised'];
const PASS_LESSON = 0.6;
const PASS_FINAL = 0.8;
const MIN_LESSONS_PASSED = 0.7;

// ───────────────────────────────────────────────────────────────────────────
// HUQUQ
// ───────────────────────────────────────────────────────────────────────────
async function access(uid, lang, level, n) {
  const product = courseProduct(lang, level);
  if (!product) throw httpErr(400, "Noto'g'ri kurs");
  const cat = await catalog();
  const lessons = cat.COURSE_LEVELS[level].lessons;
  const idx = Number(n);
  if (!Number.isInteger(idx) || idx < 0 || idx >= lessons.length) throw httpErr(400, "Noto'g'ri dars raqami");

  const user = await fsdb.getDoc(`users/${uid}`);
  const owned = user?.courses || {};
  // ULTRA rejasida hamma video kurslar ochiq (8 til, B2 + C2)
  const has = !!owned[product.key] || (level === 'b2' && !!owned[`${lang}_c2`]) || ultraActive(user);
  const isAdmin = !has && !!(await fsdb.getDoc(`admins/${uid}`).catch(() => null));
  if (!has && !isAdmin && idx >= cat.FREE_PREVIEW_LESSONS) {
    throw httpErr(402, `Bu dars ${product.name} kursida. Kursni sotib oling — birinchi dars bepul.`, { buy: { lang, level, price: product.price } });
  }
  return { product, lesson: lessons[idx], total: lessons.length, idx, owned: has || isAdmin, user };
}

function httpErr(status, message, extra = {}) {
  return Object.assign(new Error(message), { statusCode: status, extra });
}

// ───────────────────────────────────────────────────────────────────────────
// DARS YARATISH
// ───────────────────────────────────────────────────────────────────────────
// Har CEFR darajasi uchun ustoz nutqi va kontent murakkabligi
const CEFR_STYLE = {
  A1: 'Level A1 (absolute beginner): the teacher speaks VERY slowly in very short, simple sentences (max 8 words), repeats key words, uses only the most basic vocabulary. Board lines always carry an Uzbek gloss in brackets.',
  A2: 'Level A2 (elementary): slow, simple sentences, everyday vocabulary, one new idea at a time. Board lines carry Uzbek glosses in brackets.',
  B1: 'Level B1 (intermediate): clear, practical language at moderate speed; explain rules simply with many examples.',
  B2: 'Level B2 (IELTS 6–6.5): clear, practical, high-frequency structures; the teacher speaks clearly, slightly slower than native speed.',
  C1: 'Level C1 (IELTS 7–7.5): advanced academic and professional language, nuanced explanations, natural speed.',
  C2: 'Level C2 (IELTS 8–9): sophisticated, nuanced content; native-like idioms, register, rare structures; natural native speed.'
};
const CEFR_RATE = { A1: 0.85, A2: 0.88, B1: 0.92, B2: 0.95, C1: 1, C2: 1 };

// ── 30 DAQIQALIK DARS ──
// Dars ~5 daqiqalik qismlardan (modul) yig'iladi: har qism = bitta AI so'rovi
// (Netlify taymautiga sig'adi). LESSON_MINUTES bilan o'zgartirish mumkin.
const LESSON_MINUTES = Math.max(5, Math.min(60, Number(process.env.LESSON_MINUTES) || 30));
const PART_MINUTES = 5;
const lessonParts = () => Math.max(1, Math.round(LESSON_MINUTES / PART_MINUTES));
const MAX_EXTRA_PARTS = 2;

/** Ovozli nutq davomiyligini taxminiy hisoblash (soniya) — TTS ~14 belgi/s */
function estimateSeconds(core, rate = 1) {
  return (core?.scenes || []).reduce((sum, s) =>
    sum + ((s.say_native || '').length + (s.say || '').length) / (14 * rate) + (s.say_native ? 2.7 : 1.35) + (s.practice_seconds || 0), 0);
}

/** k-qism (0 dan) nimaga bag'ishlanadi */
function partFocus(k, count, material) {
  const pts = material?.points || [];
  if (k === 0) return 'OPENING PART: hook and motivation, the measurable outcome, recap of prerequisite knowledge, and the core vocabulary of the lesson with pronunciation.';
  if (k >= count) return 'EXTRA PRACTICE PART: many new practice items with answers, a short realistic dialogue to listen to, and quick-fire review of everything taught. No new theory.';
  if (k === count - 1) return `FINAL PART: an extended realistic dialogue or listening text using everything taught, the most common mistakes of native-language speakers with corrections, a step-by-step summary, then the homework task${material?.task ? ` (${material.task})` : ''}.`;
  const middle = count - 2;                       // o'rta qismlar soni
  const point = pts.length ? pts[Math.floor((k - 1) * pts.length / Math.max(1, middle))] : null;
  const repeat = pts.length && middle > pts.length && Math.floor((k - 1) * pts.length / middle) === Math.floor((k - 2) * pts.length / middle);
  return point
    ? `TEACHING PART: teach in depth "${point}"${repeat ? ' — continue this point from the previous part with harder examples, contrasts and more guided practice' : ''}. Rule in the native language → many target-language examples → contrast with the native language → guided practice with answers.`
    : 'TEACHING PART: teach the next key point of the topic in depth with many examples and guided practice.';
}

function partPrompt(L, level, meta, idx, total, nativeLang, k, count, previous) {
  const nativeName = learning.languages[learning.normalize(nativeLang)].name;
  const cefr = meta.cefr || (level === 'c2' ? 'C2' : level === 'pro' ? 'P2' : 'B2');
  const material = syllabus.lessonMaterial(cefr, syllabus.indexInLevel(level, idx));
  return [
    corePrompt(L, level, meta, idx, total, nativeLang)
      .replace(/Structure the lesson as 10–12 focused SCENES[^\n]*/, '')
      .replace(/Output STRICT JSON only:.*$/, ''),
    `THIS IS PART ${k + 1} OF A ${LESSON_MINUTES}-MINUTE VIDEO LESSON. This part must contain about ${PART_MINUTES} minutes of narration: 6–8 scenes, each with a say_native explanation of 300–450 characters and a say of 150–320 characters (about 40–45 seconds of speech per scene); include at least 2 practice scenes with practice_seconds.`,
    `PART FOCUS: ${partFocus(k, count, material)}`,
    previous.length ? `Already covered in previous parts (do NOT repeat, continue naturally): ${previous.join(' | ')}` : '',
    k > 0 ? 'This part CONTINUES the same lesson: do not greet, do not welcome the learner again, do not restate the lesson goal and do not re-introduce material listed above.' : '',
    'ACCURACY: double-check every grammar, stress, phonetic and spelling claim before writing it (e.g. stress positions, IPA, irregular forms). If you are not certain a claim is true, leave it out. Never write placeholders such as [Your Name] or ___ in say/say_native (the teacher does not introduce himself by name). A native-speaker teacher will read say_native aloud on camera, so it must be natural, error-free spoken ' + nativeName + '.',
    k === 0
      ? 'Output STRICT JSON only: {"title":"","goal_uz":"","vocab":[],"scenes":[],"homework_uz":""}  (vocab: 10–14 items)'
      : 'Output STRICT JSON only: {"scenes":[],"homework_uz":""}  (homework_uz only in the FINAL part, otherwise "")'
  ].filter(Boolean).join('\n');
}

function corePrompt(L, level, meta, idx, total, nativeLang = 'uz') {
  const nativeName = learning.languages[learning.normalize(nativeLang)].name;
  const cefr = meta.cefr || (level === 'c2' ? 'C2' : level === 'pro' ? 'P2' : 'B2');
  return [
    `You are an elite ${L.name} teacher producing a professional VIDEO LESSON for ${nativeName}-speaking learners (CEFR ${cefr}, lesson ${idx + 1} of ${total} in the ${level.toUpperCase()} course).`,
    `Lesson topic (in Uzbek): "${meta.t}". Skill focus: ${meta.skill}. Teach it through the real grammar and usage of ${L.name} (adapt the topic to how ${L.name} actually works; e.g. cases, honorifics, tones, script).`,
    CEFR_STYLE[cefr].replace(/Uzbek/g, nativeName),
    `NATIVE LANGUAGE: ${nativeName}. All explanations, titles, translations and instructions must be in ${nativeName}. Keep the legacy JSON keys *_uz and uz, but write their VALUES in ${nativeName}.`,
    (() => {
      const m = syllabus.lessonMaterial(cefr, syllabus.indexInLevel(level, idx));
      const notes = syllabus.LANG_NOTES[Object.keys(LANG_INFO).find(k => LANG_INFO[k] === L)] || '';
      return m ? `MANDATORY LESSON MATERIAL (follow it exactly, do not drop any point): Outcome: ${m.goal} Must teach: ${m.points.map((p, i) => `(${i + 1}) ${p}`).join('; ')}. Final practice/homework task: ${m.task} Language specifics to apply where relevant: ${notes}` : '';
    })(),
    meta.skill === 'Imtihon' ? `This is a LEVEL EXAM lesson: review the most important points of the whole ${cefr} level and prepare the learner for the test.` : '',
    `Structure the lesson as 10–12 focused SCENES: learning objective → prerequisite recap → native-language explanation → target-language worked examples → pronunciation/listening → common mistakes of ${nativeName} speakers → guided practice with a pause → answer and explanation → independent practice → recap and homework. Cover the topic thoroughly, not just a motivational overview.`,
    'Each scene has:',
    '- "kind": intro|explain|example|mistake|practice|recap',
    `- "title": short scene title in ${nativeName}`,
    `- "board": 1–4 short lines shown on the screen (rules, formulas, key phrases) — in ${L.name}, may include short ${nativeName} glosses in brackets`,
    `- "examples": 0–3 objects {"t":"sentence in ${L.name}","uz":"${nativeName} translation"}`,
    `- "say": target-language model or practice speech in ${L.name}, 2–4 natural sentences, max 520 characters. For explanation scenes use concrete examples, not abstract jargon.`,
    `- "say_native": an actual TEACHING explanation in ${nativeName}, not merely a literal translation. Explain the rule, why it works, and when to use it. Max 700 characters. The video narrates this BEFORE the target-language model.`,
    `- "practice_seconds": 6–12 for a practice scene, otherwise 0; allow learners time to answer before the next scene gives the answer.`,
    `- "say_uz": faithful ${nativeName} translation of "say" (subtitles)`,
    `- "emotion": one of ${EMOS.join('|')} (teacher is strict but warm; use stern for common mistakes, impressed/proud when presenting an elegant structure, encouraging for practice)`,
    `Also return "title" (${nativeName}), "goal_uz" (a measurable learning outcome), "vocab": 8–10 items {"w":"word/phrase","uz":"meaning in ${nativeName}"}, "homework_uz" (a concrete speaking AND writing task with a success criterion).`,
    'Be accurate: every example must be grammatically perfect and natural. Never invent false grammar rules.',
    'Output STRICT JSON only: {"title":"","goal_uz":"","vocab":[],"scenes":[],"homework_uz":""}'
  ].join('\n');
}

function quizPrompt(L, level, meta, core, isFinal, nativeLang = 'uz') {
  const nativeName = learning.languages[learning.normalize(nativeLang)].name;
  isFinal = isFinal || meta.skill === 'Imtihon';
  const n = isFinal ? 15 : 10;
  return [
    `Write a ${n}-question multiple-choice test in ${L.name} for the lesson "${meta.t}" (CEFR ${meta.cefr || level.toUpperCase()}).`,
    isFinal
      ? `This is a LEVEL EXAM: cover grammar, vocabulary, register and reading comprehension across the whole ${meta.cefr || level.toUpperCase()} level, with matching difficulty.`
      : `Test exactly what the lesson taught. Lesson summary: ${core.goal_uz}. Key board lines: ${(core.scenes || []).filter((_, i, a) => i % Math.max(1, Math.ceil(a.length / 12)) === 0).flatMap(s => s.board || []).slice(0, 16).join(' | ')}`,
    `Each question: 4 options, exactly one correct, plausible distractors based on typical ${nativeName}-speaker mistakes. Explain why the correct answer works in ${nativeName} in why_uz.`,
    'Output STRICT JSON only: {"quiz":[{"q":"question","options":["","","",""],"answer":0,"why_uz":"short native-language explanation"}]}'
  ].join('\n');
}

function cleanCore(raw) {
  const j = raw || {};
  const scenes = (Array.isArray(j.scenes) ? j.scenes : []).slice(0, 14).map(s => ({
    kind: String(s.kind || 'explain').slice(0, 12),
    title: String(s.title || '').slice(0, 90),
    board: (Array.isArray(s.board) ? s.board : []).slice(0, 4).map(x => String(x).slice(0, 160)),
    examples: (Array.isArray(s.examples) ? s.examples : []).slice(0, 3).map(e => ({ t: String(e.t || '').slice(0, 200), uz: String(e.uz || '').slice(0, 200) })),
    say: String(s.say || '').replace(/[*_#`]/g, '').slice(0, 520),
    say_uz: String(s.say_uz || '').slice(0, 700),
    say_native: String(s.say_native || '').replace(/[*_#`]/g, '').slice(0, 900),
    practice_seconds: s.kind === 'practice' ? Math.max(6, Math.min(20, Number(s.practice_seconds) || 8)) : 0,
    emotion: EMOS.includes(s.emotion) ? s.emotion : 'neutral'
  })).filter(s => s.say);
  if (scenes.length < 4) return null;
  return {
    title: String(j.title || '').slice(0, 120),
    goal_uz: String(j.goal_uz || '').slice(0, 300),
    vocab: (Array.isArray(j.vocab) ? j.vocab : []).slice(0, 10).map(v => ({ w: String(v.w || '').slice(0, 80), uz: String(v.uz || '').slice(0, 120) })),
    homework_uz: String(j.homework_uz || '').slice(0, 500),
    scenes
  };
}

function cleanQuiz(raw) {
  const list = (Array.isArray(raw?.quiz) ? raw.quiz : []).map(q => ({
    q: String(q.q || '').slice(0, 300),
    options: (Array.isArray(q.options) ? q.options : []).slice(0, 4).map(o => String(o).slice(0, 160)),
    answer: Number(q.answer),
    why_uz: String(q.why_uz || '').slice(0, 300)
  })).filter(q => q.q && q.options.length === 4 && Number.isInteger(q.answer) && q.answer >= 0 && q.answer < 4);
  return list.length >= 4 ? list : null;
}

// v2 — 150 darslik katalog (CATALOG_VERSION); eski 20/24 darslik keshi aralashmaydi
const lessonPath = (lang, level, idx, nativeLang = 'uz') => `courseLessons/v4_${learning.normalize(nativeLang)}_${lang}_${level}_${idx}`;

/**
 * Darsni bir qadam oldinga tayyorlaydi (huquq tekshiruvisiz — chaqiruvchi
 * tekshiradi). Har chaqiruvda ko'pi bilan BITTA AI so'rovi — Netlify
 * taymautiga sig'adi. MP4 renderi ham shundan foydalanadi (deadline uzunroq).
 * @returns {Promise<{doc:object, step:'core'|'quiz'|'ready'|'partial'}>}
 */
async function ensureLessonStep(lang, level, idx, meta, total, opts = {}) {
  const L = LANG_INFO[lang];
  const nativeLang = learning.normalize(opts.nativeLang);
  const path = lessonPath(lang, level, idx, nativeLang);
  let doc = await fsdb.getDoc(path);
  const isFinal = idx === total - 1;
  const deadlineMs = opts.deadlineMs || 20000;

  // 1-bosqich: sahnalar — 30 daqiqalik dars ~5 daqiqalik qismlar bilan,
  // har chaqiruvda BITTA qism (taymautga sig'adi). Qism tayyor bo'lgach
  // o'quvchi darsni ko'ra boshlaydi, qolganlari ketma-ket qo'shiladi.
  const count = doc?.partsTotal || lessonParts();
  const done = doc?.core ? (doc.partsDone ?? count) : 0;
  const extra = doc?.extraParts || 0;
  const cur = doc?.core ? JSON.parse(doc.core) : null;
  const short = cur && done >= count + extra && extra < MAX_EXTRA_PARTS && estimateSeconds(cur, CEFR_RATE[meta.cefr] || 1) < LESSON_MINUTES * 60 * 0.85;
  const manual = doc?.authored === 'manual';                  // qo'lda yozilgan darsga AI qism qo'shilmaydi
  if (!manual && (!doc?.core || done < count + extra || short)) {
    const k = short ? count + extra : done;
    const previous = (cur?.scenes || []).map(sc => sc.title).filter(Boolean).slice(-40);
    const r = await think(opts.tier || 'write', [
      { role: 'system', content: partPrompt(L, level, meta, idx, total, nativeLang, k, count, previous) },
      { role: 'user', content: `Create part ${k + 1} now.` }
    ], { temperature: 0.6, maxTokens: 7600, deadlineMs });
    const part = cleanCore(extractJson(r.text));
    if (!part || part.scenes.length < 5 || part.scenes.some(sc => !sc.say_native || !sc.say_uz) || (k === 0 && (!part.goal_uz || part.vocab.length < 6))) {
      const why = !part ? `JSON o'qilmadi (${r.backend}, ${String(r.text || '').length} belgi, oxiri: ${String(r.text || '').slice(-80)})`
        : `${r.backend}: sahna ${part.scenes.length}, say_native/say_uz yo'q ${part.scenes.filter(sc => !sc.say_native || !sc.say_uz).length}, goal ${!!part.goal_uz}, vocab ${part.vocab.length}`;
      throw Object.assign(httpErr(502, "Dars tayyorlanmadi, qayta urinib ko'ring"), { detail: [`qism ${k + 1}: ${why}`] });
    }
    const merged = cur
      ? { ...cur, scenes: [...cur.scenes, ...part.scenes], homework_uz: part.homework_uz || cur.homework_uz }
      : part;
    const patch = { core: JSON.stringify(merged), partsTotal: count, partsDone: Math.max(done, Math.min(k + 1, count)), extraParts: k >= count ? extra + 1 : extra, estSeconds: Math.round(estimateSeconds(merged, CEFR_RATE[meta.cefr] || 1)) };
    doc = doc?.core ? { ...doc, ...patch } : { ...patch, lang, level, nativeLang, n: idx, createdAt: new Date(), backend: r.backend };
    await fsdb.setDoc(path, doc);
    return { doc, step: 'core' };
  }

  // 2-bosqich: test (alohida chaqiruv — har biri funksiya taymautiga sig'adi)
  if (!doc.quiz) {
    const core = JSON.parse(doc.core);
    try {
      const r = await think(opts.tier || 'write', [
        { role: 'system', content: quizPrompt(L, level, meta, core, isFinal, nativeLang) },
        { role: 'user', content: 'Create the test now.' }
      ], { temperature: 0.4, maxTokens: isFinal ? 4200 : 3000, deadlineMs });
      const quiz = cleanQuiz(extractJson(r.text));
      if (quiz) {
        doc.quiz = JSON.stringify(quiz);
        await fsdb.setDoc(path, { quiz: doc.quiz });
        return { doc, step: 'quiz' };
      }
    } catch (e) {
      console.warn('[course] test hali tayyor emas:', e.message);
    }
    return { doc, step: 'partial' };
  }
  return { doc, step: 'ready' };
}

/** Render skripti uchun: sahnalar va test to'liq tayyor bo'lguncha. */
async function ensureLesson(lang, level, idx, nativeLang = 'uz', opts = {}) {
  if (!LANG_INFO[lang] || !['b2', 'c2', 'pro'].includes(level)) throw httpErr(400, 'Invalid course');
  const cat = await catalog();
  const lessons = cat.COURSE_LEVELS[level].lessons;
  if (!Number.isInteger(idx) || !lessons[idx]) throw httpErr(400, 'Invalid lesson');
  let res;
  for (let i = 0; i < lessonParts() + MAX_EXTRA_PARTS + 3; i++) {
    res = await ensureLessonStep(lang, level, idx, lessons[idx], lessons.length, { deadlineMs: 60000, nativeLang, tier: opts.tier });
    if (res.step === 'ready') break;
  }
  return { core: JSON.parse(res.doc.core), doc: res.doc, meta: lessons[idx], total: lessons.length, locale: LANG_INFO[lang].locale };
}

async function getLesson(uid, body) {
  const { lang, level } = body;
  const a = await access(uid, lang, level, body.n);
  const nativeLang = learning.normalize(body.nativeLang || a.user?.nativeLang);
  const { doc, step } = await ensureLessonStep(lang, level, a.idx, a.lesson, a.total, { nativeLang });
  if (step === 'core') return shape(doc, a, 'partial');
  // VIDEO NAVBATI: MP4 faqat kimdir ochgan darslar uchun yasaladi (bepul limit
  // keraksiz videolarga sarflanmaydi). Ko'p ochilgan dars navbatda oldinda.
  if (doc.quiz && !doc.videoPath && a.lesson.core) {   // MP4 faqat 60 ta asosiy darsga
    await fsdb.setDoc(lessonPath(lang, level, a.idx, nativeLang), { videoWanted: true, videoDemand: (doc.videoDemand || 0) + 1, videoWantedAt: doc.videoWantedAt || new Date() })
      .then(() => { doc.videoWanted = true; })
      .catch(e => console.warn('[course] video navbati:', e.message));
    const started = await autoVideo(lang, level, a.idx, nativeLang, doc).catch(e => { console.warn('[course] avto-video:', e.message); return null; });
    if (started === 'started') doc.videoDispatchedAt = new Date();
  }
  return shape(doc, a, doc.quiz ? 'ready' : 'partial');
}

/** Klientga: test JAVOBLARISIZ. */
function shape(doc, a, status) {
  const core = JSON.parse(doc.core);
  const quiz = doc.quiz ? JSON.parse(doc.quiz).map(q => ({ q: q.q, options: q.options })) : null;
  // Haqiqiy MP4 video tayyor bo'lsa — 3 soatlik imzolangan havola
  let videoUrl = null;
  if (doc.videoPath) {
    try { videoUrl = require('./_storage.js').signedUrl(doc.videoPath, 3 * 3600); }
    catch (e) { console.warn('[course] video havolasi:', e.message); }
  }
  return {
    status,
    n: a.idx, total: a.total, owned: a.owned,
    meta: a.lesson,
    locale: LANG_INFO[doc.lang]?.locale,
    videoUrl,
    nativeLang: doc.nativeLang || 'uz',
    videoStatus: videoUrl ? 'ready' : (doc.videoRenderingAt || doc.videoWanted || (doc.videoDispatchedAt instanceof Date && Date.now() - doc.videoDispatchedAt.getTime() < AUTO_VIDEO_RETRY_MS)) ? 'rendering' : 'pending',
    videoChapters: videoUrl ? (doc.videoChapters || []) : [],
    videoCaptions: videoUrl ? (doc.videoCaptions || []) : [],
    videoDuration: doc.videoDuration || null,
    parts: { done: doc.partsDone ?? null, total: doc.partsTotal ?? null, estSeconds: doc.estSeconds || null },
    lesson: { ...core, quiz }
  };
}

// ───────────────────────────────────────────────────────────────────────────
// SAHNA OVOZI (kesh bilan)
// ───────────────────────────────────────────────────────────────────────────
async function sceneAudio(uid, body) {
  const a = await access(uid, body.lang, body.level, body.n);
  const si = Number(body.scene);
  const doc = await fsdb.getDoc(lessonPath(body.lang, body.level, a.idx, body.nativeLang || a.user?.nativeLang));
  if (!doc?.core) throw httpErr(404, 'Dars hali tayyor emas');
  const scene = JSON.parse(doc.core).scenes[si];
  if (!scene) throw httpErr(400, "Noto'g'ri sahna");

  const nativeLang = learning.normalize(body.nativeLang || a.user?.nativeLang);
  const isNative = body.track === 'native';
  const text = isNative ? (scene.say_native || scene.say_uz) : scene.say;
  const locale = isNative ? learning.languages[nativeLang].locale : LANG_INFO[body.lang].locale;
  const hash = crypto.createHash('sha1').update(text + '|' + locale + '|' + CEFR_RATE[a.lesson.cefr] + '|' + scene.emotion + '|' + (keys.get('ELEVENLABS_MODEL') || '')).digest('hex').slice(0, 16);
  const cachePath = `courseAudio/v3_${nativeLang}_${body.lang}_${body.level}_${a.idx}_${si}_${hash}`;
  const cached = await fsdb.getDoc(cachePath).catch(() => null);
  if (cached?.audio) return { audio: cached.audio, mime: cached.mime || 'audio/mpeg', cached: true };

  // Oylik bepul limit tugagan bo'lsa — brauzer ovoziga o'tiladi (klient o'zi qiladi)
  const budget = await require('./_ttsBudget.js').reserve(text.length).catch(() => ({ ok: true }));
  if (!budget.ok) throw httpErr(429, "Bu oy uchun bepul ovoz limiti tugadi — brauzer ovozi ishlatiladi");
  const speech = require('./azure-speech.js');
  const r = await speech.synthesizeConfigured({ text, lang: locale, emotion: scene.emotion, rate: CEFR_RATE[a.lesson.cefr] || 1 }, process.env.LESSON_VOICE === 'azure' ? { elevenLabsKey: '' } : {});
  // Firestore hujjati 1MB gacha — katta audio keshlanmaydi, lekin baribir qaytariladi
  if (r.audio && r.audio.length < 900_000) {
    await fsdb.setDoc(cachePath, { audio: r.audio, mime: r.mime, provider: r.provider || 'azure', createdAt: new Date() })
      .catch(e => console.warn('[course] audio keshlanmadi:', e.message));
  }
  return { audio: r.audio, mime: r.mime, cached: false };
}

// ───────────────────────────────────────────────────────────────────────────
// TEST VA SERTIFIKAT
// ───────────────────────────────────────────────────────────────────────────
const progressPath = (uid, key) => `users/${uid}/courseProgress/${key}`;

async function gradeQuiz(uid, email, name, body) {
  const a = await access(uid, body.lang, body.level, body.n);
  const doc = await fsdb.getDoc(lessonPath(body.lang, body.level, a.idx, body.nativeLang || a.user?.nativeLang));
  if (!doc?.quiz) throw httpErr(409, 'Test hali tayyor emas');
  const quiz = JSON.parse(doc.quiz);
  const answers = Array.isArray(body.answers) ? body.answers : [];

  let correct = 0;
  const review = quiz.map((q, i) => {
    const ok = Number.isInteger(answers[i]) && answers[i] === q.answer;
    if (ok) correct++;
    return { ok, answer: q.answer, why_uz: q.why_uz };
  });
  const score = correct / quiz.length;
  const isFinal = a.idx === a.total - 1;
  const passed = score >= (isFinal ? PASS_FINAL : PASS_LESSON);

  const key = a.product.key;
  const prog = (await fsdb.getDoc(progressPath(uid, key))) || {};
  const lessons = { ...(prog.lessons || {}) };
  const prev = lessons[a.idx];
  if (!prev || score > (prev.score || 0)) lessons[a.idx] = { score: Math.round(score * 100) / 100, passed, at: new Date() };
  const passedCount = Object.values(lessons).filter(x => x.passed).length;

  let certificate = prog.certificateId || null;
  if (isFinal && passed && a.owned && !certificate && passedCount >= Math.ceil(a.total * MIN_LESSONS_PASSED)) {
    certificate = 'LV-' + a.product.level.toUpperCase() + '-' + crypto.randomBytes(4).toString('hex').toUpperCase();
    await fsdb.addDoc('certificates', {
      certId: certificate, uid, name: name || email || "O'quvchi",
      course: a.product.name, lang: body.lang, level: a.product.level.toUpperCase(),
      finalScore: Math.round(score * 100), lessonsPassed: passedCount, lessonsTotal: a.total,
      issuedAt: new Date()
    }, certificate);
    await fsdb.addDoc(`users/${uid}/events`, { event: 'certificate_issued', certificate, course: key, at: new Date() });
  }

  await fsdb.setDoc(progressPath(uid, key), {
    lessons, passedCount, total: a.total, updatedAt: new Date(),
    ...(certificate ? { certificateId: certificate } : {})
  });

  const needMore = isFinal && passed && !certificate
    ? `Sertifikat uchun kamida ${Math.ceil(a.total * MIN_LESSONS_PASSED)} ta darsdan o'tish kerak (hozir ${passedCount}).`
    : null;

  return { score: Math.round(score * 100), correct, total: quiz.length, passed, review, passedCount, certificate, needMore };
}

// ───────────────────────────────────────────────────────────────────────────
// VIDEO FABRIKA (admin)
// ───────────────────────────────────────────────────────────────────────────
async function requireAdmin(uid) {
  const a = await fsdb.getDoc(`admins/${uid}`).catch(() => null);
  if (!a) throw httpErr(403, "Admin huquqi yo'q");
}

async function factoryStatus(uid, body = {}) {
  await requireAdmin(uid);
  const cat = await catalog();
  const st = (await fsdb.getDoc(`videoFactory/v3_${learning.normalize(body.nativeLang)}`).catch(() => null)) || {};
  const nativeTarget = learning.languages[learning.normalize(body.nativeLang)].target;
  const rows = cat.COURSE_LANGS.filter(l=>l.id!==nativeTarget).map(l => {
    const b2 = st.done?.[`${l.id}_b2`] || 0, c2 = st.done?.[`${l.id}_c2`] || 0;
    const levels = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].map(c => ({ cefr: c, done: st.cefr?.[`${l.id}_${c}`] || 0, total: [...cat.COURSE_LEVELS.b2.lessons, ...cat.COURSE_LEVELS.c2.lessons].filter(x => x.cefr === c && x.core).length }));
    return { lang: l.id, name: l.name, flag: l.flag, b2, c2, levels, done: b2 + c2, total: cat.CORE_LESSONS_PER_LANGUAGE };
  });
  const iso = d => d instanceof Date ? d.toISOString() : null;
  const budget = await require('./_ttsBudget.js').status().catch(() => null);
  const queue = await fsdb.queryList('courseLessons', [{ field: 'videoWanted', op: 'EQUAL', value: true }, { field: 'nativeLang', op: 'EQUAL', value: learning.normalize(body.nativeLang) }], null, 200).catch(() => []);
  return {
    budget, queued: queue.filter(d => !d.videoPath).length, storage: require('./_storage.js').provider(),
    rows,
    done: rows.reduce((a, r) => a + r.done, 0),
    total: rows.reduce((a, r) => a + r.total, 0),
    lastRunAt: iso(st.lastRunAt), updatedAt: iso(st.updatedAt),
    lastError: st.lastError || null, lastErrorAt: iso(st.lastErrorAt),
    githubConfigured: !!(process.env.GITHUB_TOKEN && process.env.GITHUB_REPO),
    elevenLabs: !!keys.get('ELEVENLABS_API_KEY')
  };
}

// Admin: bitta til bo'yicha barcha darslar va ularning MP4 videolari (admin panel → Video darslar)
async function adminVideos(uid, body = {}) {
  await requireAdmin(uid);
  const native = learning.normalize(body.nativeLang);
  const lang = String(body.lang || 'english');
  const docs = await fsdb.queryList('courseLessons', [
    { field: 'nativeLang', op: 'EQUAL', value: native },
    { field: 'lang', op: 'EQUAL', value: lang }
  ], null, 400).catch(() => []);
  const storage = require('./_storage.js');
  const CEFR = { b2: ['A1', 'A2', 'B1', 'B2'], c2: ['C1', 'C2'], pro: ['P1', 'P2'] };
  const lessons = docs.filter(d => CEFR[d.level] && Number.isInteger(Number(d.n))).map(d => {
    const n = Number(d.n);
    let title = '';
    try { title = JSON.parse(d.core || '{}').title || ''; } catch {}
    const id = `${CEFR[d.level][Math.floor(n / 25)]}-${String(n % 25 + 1).padStart(2, '0')}`;
    return {
      id, level: d.level, n, title,
      minutes: d.videoDuration ? Math.round(d.videoDuration / 60) : d.estSeconds ? Math.round(d.estSeconds / 60) : null,
      video: d.videoPath ? storage.signedUrl(d.videoPath) : null,
      videoAt: d.videoUpdatedAt instanceof Date ? d.videoUpdatedAt.toISOString() : null,
      error: d.videoError || null
    };
  }).sort((x, y) => x.id.localeCompare(y.id));
  return { lang, total: 200, lessons, withVideo: lessons.filter(l => l.video).length };
}

// ───────────────────────────────────────────────────────────────────────────
// YOUTUBE DARSLAR — 60 ta asosiy darsdan tashqari 90 tasida AI YouTube'dan
// shu mavzu bo'yicha eng yaxshi video darslarni topadi: biri o'quvchining
// ona tilida tushuntiradi, biri o'rganilayotgan tilning o'zida.
// Natija 30 kun keshlanadi (YouTube API bepul kvotasi: kuniga ~50 ta dars).
// Kalit: admin panel → YOUTUBE_API_KEY (Google Cloud, bepul).
// ───────────────────────────────────────────────────────────────────────────
const YT_TTL_MS = 30 * 24 * 3600_000;
const ytPath = (lang, level, idx, nativeLang) => `courseYoutube/v1_${learning.normalize(nativeLang)}_${lang}_${level}_${idx}`;

async function ytSearch(q, relevanceLanguage, apiKey) {
  const url = new URL('https://www.googleapis.com/youtube/v3/search');
  url.search = new URLSearchParams({ part: 'snippet', type: 'video', maxResults: '6', order: 'relevance', safeSearch: 'strict',
    videoEmbeddable: 'true', relevanceLanguage, q: q.slice(0, 180), key: apiKey }).toString();
  const r = await fetch(url, { signal: AbortSignal.timeout(7000) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d?.error?.message || `YouTube HTTP ${r.status}`);
  return (d.items || []).filter(it => /^[A-Za-z0-9_-]{11}$/.test(it?.id?.videoId || '')).map(it => ({
    id: it.id.videoId,
    title: String(it.snippet?.title || '').replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&').slice(0, 200),
    channel: String(it.snippet?.channelTitle || '').slice(0, 100)
  }));
}

async function youtubeLessons(uid, body) {
  const a = await access(uid, body.lang, body.level, body.n);
  const nativeLang = learning.normalize(body.nativeLang || a.user?.nativeLang);
  const L = LANG_INFO[body.lang];
  const nativeName = learning.languages[nativeLang].name;
  const fallbackQ = `${L.name} ${a.lesson.cefr} ${a.lesson.t}`;
  const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(fallbackQ)}`;
  const path = ytPath(body.lang, body.level, a.idx, nativeLang);
  const cached = await fsdb.getDoc(path).catch(() => null);
  if (cached?.videos?.length && cached.fetchedAt instanceof Date && Date.now() - cached.fetchedAt.getTime() < YT_TTL_MS) {
    return { configured: true, videos: cached.videos, searchUrl };
  }
  await keys.refreshFromFirestore();
  const apiKey = keys.get('YOUTUBE_API_KEY');
  if (!apiKey) return { configured: false, videos: cached?.videos || [], searchUrl };

  // AI qidiruv so'rovlarini yozadi: mavzuni ona tilida va o'rganilayotgan tilda
  const cefr = a.lesson.cefr;
  const material = syllabus.lessonMaterial(cefr, syllabus.indexInLevel(body.level, a.idx));
  let queries = { native: `${L.name} ${cefr} ${a.lesson.t} dars`, target: `${L.name} ${cefr} ${material?.points?.[0] || a.lesson.t} lesson` };
  try {
    const r = await think('fast', [
      { role: 'system', content: `You write YouTube search queries that find the best free video LESSONS for language learners. Return ONLY JSON {"native":"...","target":"..."}. "native": a query in ${nativeName} for a lesson that teaches this ${L.name} topic explained in ${nativeName}. "target": a query in ${L.name} (as natives would title such a lesson) for CEFR ${cefr} learners. Each under 70 characters, no quotes or hashtags.` },
      { role: 'user', content: JSON.stringify({ topic_uz: a.lesson.t, skill: a.lesson.skill, cefr, focus: material?.points?.slice(0, 2) }) }
    ], { temperature: 0.2, maxTokens: 200, deadlineMs: 6000 });
    const j = extractJson(r.text);
    if (typeof j?.native === 'string' && j.native.trim()) queries.native = j.native.trim();
    if (typeof j?.target === 'string' && j.target.trim()) queries.target = j.target.trim();
  } catch (e) { console.warn('[course] YouTube so\'rovi AI siz:', e.message); }

  const targetCode = (L.locale || 'en').split('-')[0];
  const [nativeVids, targetVids] = await Promise.all([
    nativeLang === 'uz' || learning.languages[nativeLang].target !== body.lang ? ytSearch(queries.native, nativeLang, apiKey).catch(() => []) : [],
    ytSearch(queries.target, targetCode, apiKey).catch(() => [])
  ]);
  const seen = new Set();
  const pick = (list, n, tag) => list.filter(v => !seen.has(v.id) && seen.add(v.id)).slice(0, n).map(v => ({ ...v, tag }));
  const videos = [...pick(nativeVids, 2, 'native'), ...pick(targetVids, 2, 'target')];
  if (videos.length) await fsdb.setDoc(path, { videos, queries, fetchedAt: new Date(), lang: body.lang, level: body.level, n: a.idx, nativeLang }).catch(() => {});
  return { configured: true, videos, searchUrl };
}

/** GitHub "Video fabrika" workflow'ini chaqirish (admin tugmasi va avto-video uchun umumiy). */
async function dispatchFactory(inputs) {
  const token = process.env.GITHUB_TOKEN, repo = process.env.GITHUB_REPO;
  if (!token || !repo) throw httpErr(400, "Netlify'da GITHUB_TOKEN va GITHUB_REPO sozlanmagan (README ga qarang).");
  const r = await fetch(`https://api.github.com/repos/${repo}/actions/workflows/render-videos.yml/dispatches`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'User-Agent': 'LinguaVerse' },
    body: JSON.stringify({ ref: process.env.GITHUB_BRANCH || 'main', inputs }),
    signal: AbortSignal.timeout(6000)
  });
  if (r.status !== 204) throw httpErr(502, 'GitHub ishga tushirmadi: ' + (await r.text()).slice(0, 200));
}

const AUTO_VIDEO_RETRY_MS = 3 * 3600_000;
/**
 * AVTO-VIDEO: o'quvchi darsni ochishi bilan shu BITTA darsning MP4 i
 * yasala boshlaydi (GitHub'da, ~30–50 daqiqa). Shu orada interaktiv dars
 * ishlaydi. Takror bosishlar yangi ish ochmaydi (3 soatlik qulf), bepul
 * oylik ovoz limiti yetmasa — dars navbatda qoladi, keyingi oy yasaladi.
 */
async function autoVideo(lang, level, idx, nativeLang, doc) {
  if (process.env.AUTO_VIDEO === 'off' || !process.env.GITHUB_TOKEN || !process.env.GITHUB_REPO) return null;
  const recent = d => d instanceof Date && Date.now() - d.getTime() < AUTO_VIDEO_RETRY_MS;
  if (doc.videoPath || recent(doc.videoRenderingAt) || recent(doc.videoDispatchedAt)) return null;
  const chars = JSON.parse(doc.core).scenes.reduce((a, sc) => a + (sc.say || '').length + (sc.say_native || '').length, 0);
  const b = await require('./_ttsBudget.js').status().catch(() => null);
  if (b && !b.unlimited && b.used + chars > b.limit) return 'budget';
  await fsdb.setDoc(lessonPath(lang, level, idx, nativeLang), { videoDispatchedAt: new Date() });
  await dispatchFactory({ native: nativeLang, langs: lang, lesson: `${lang}:${level}:${idx}`, batch: '1', mode: 'demand' });
  return 'started';
}

/** GitHub Actions'dagi "Video fabrika" workflow'ini darhol ishga tushiradi. */
async function factoryRun(uid, body) {
  await requireAdmin(uid);
  await dispatchFactory({ native: learning.normalize(body.nativeLang), langs: String(body.langs || 'all').replace(/[^a-z,]/g, '') || 'all', batch: String(Math.min(30, Math.max(1, Number(body.batch) || 4))) });
  return { ok: true };
}

async function mine(uid) {
  const user = await fsdb.getDoc(`users/${uid}`);
  const owned = { ...(user?.courses || {}) };
  if (ultraActive(user)) for (const l of Object.keys(COURSE_LANGS)) { owned[`${l}_b2`] = true; owned[`${l}_c2`] = true; }
  const keysOwned = Object.keys(owned);
  const progress = {};
  for (const k of new Set([...keysOwned, ...keysOwned.filter(k => k.endsWith('_c2')).map(k => k.replace('_c2', '_b2'))])) {
    const p = await fsdb.getDoc(progressPath(uid, k)).catch(() => null);
    if (p) progress[k] = { passedCount: p.passedCount || 0, total: p.total || 0, certificateId: p.certificateId || null, lessons: Object.fromEntries(Object.entries(p.lessons || {}).map(([i, v]) => [i, { score: v.score, passed: v.passed }])) };
  }
  return { owned: keysOwned, progress, plan: user?.plan || 'free' };
}

// ───────────────────────────────────────────────────────────────────────────
// HANDLER
// ───────────────────────────────────────────────────────────────────────────
exports.handler = async function (event) {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' };
  await keys.refreshFromFirestore().catch(() => {});

  if (event.httpMethod === 'GET') {
    const id = (event.queryStringParameters || {}).verify;
    if (id) {
      const c = await fsdb.getDoc(`certificates/${String(id).replace(/[^A-Z0-9-]/gi, '')}`).catch(() => null);
      if (!c) return json(404, { valid: false });
      return json(200, { valid: true, certId: c.certId, name: c.name, course: c.course, level: c.level, finalScore: c.finalScore, issuedAt: c.issuedAt instanceof Date ? c.issuedAt.toISOString() : null });
    }
    return json(200, { ok: true });
  }
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method Not Allowed' });

  let body;
  try { body = JSON.parse(event.body || '{}'); } catch { return json(400, { error: "Noto'g'ri JSON" }); }

  let auth;
  try { auth = await verifyIdToken(body.idToken); }
  catch { return json(401, { error: 'Darslarni ko‘rish uchun tizimga kiring.' }); }

  try {
    switch (body.action) {
      case 'mine':   return json(200, await mine(auth.uid));
      case 'lesson': return json(200, await getLesson(auth.uid, body));
      case 'audio':  return json(200, await sceneAudio(auth.uid, body));
      case 'youtube': return json(200, await youtubeLessons(auth.uid, body));
      case 'quiz':   return json(200, await gradeQuiz(auth.uid, auth.email, auth.name, body));
      case 'factory-status': return json(200, await factoryStatus(auth.uid, body));
      case 'factory-run':    return json(200, await factoryRun(auth.uid, body));
      case 'admin-videos':   return json(200, await adminVideos(auth.uid, body));
      default:       return json(400, { error: "Noma'lum action: " + body.action });
    }
  } catch (e) {
    console.error('[course]', body.action, e.message);
    return json(e.statusCode || 502, { error: e.message, ...(e.extra || {}) });
  }
};

function json(statusCode, body) {
  return { statusCode, headers: { ...CORS, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, body: JSON.stringify(body) };
}

module.exports.cleanCore = cleanCore;
module.exports.cleanQuiz = cleanQuiz;
module.exports.catalog = catalog;
module.exports.ensureLesson = ensureLesson;
module.exports.lessonPath = lessonPath;
module.exports.CEFR_RATE = CEFR_RATE;
module.exports.LANG_INFO = LANG_INFO;

module.exports.corePrompt = corePrompt;
module.exports.partPrompt = partPrompt;
module.exports.estimateSeconds = estimateSeconds;
module.exports.ensureLessonStep = ensureLessonStep;
module.exports.LESSON_MINUTES = LESSON_MINUTES;
module.exports.autoVideo = autoVideo;
module.exports.youtubeLessons = youtubeLessons;
module.exports.quizPrompt = quizPrompt;
module.exports.shape = shape;
