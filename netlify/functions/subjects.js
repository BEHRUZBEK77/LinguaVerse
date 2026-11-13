// ═══════════════════════════════════════════════════════════════════════════
// subjects.js — MAKTAB FANLARI (1–11-sinf): matn dars + test + AI ustoz
//
//   POST { action:'lesson',   idToken, subject, grade, n }          → dars (test javoblarisiz)
//   POST { action:'quiz',     idToken, subject, grade, n, answers }  → serverda tekshiriladi
//   POST { action:'ask',      idToken, subject, grade, n, question } → AI ustoz javobi
//   POST { action:'progress', idToken }                              → { "<fan>_<sinf>_<n>": ball }
//   POST { action:'report',   idToken, subject, grade, n, text }     → xato xabari (adminga)
//   admin: 'admin-reports' | 'admin-report-done' {id} | 'admin-regenerate' {subject,grade,n}
//
// Mavzular ro'yxati statik (subjects/catalog.json). Dars matni birinchi ochilganda
// AI bilan yoziladi va subjectLessons/ da hamma uchun saqlanadi (birinchi yozuv qoladi).
// Har mavzuning dastlabki FREE_TOPICS tasi bepul, qolgani faol obunada.
// ═══════════════════════════════════════════════════════════════════════════
const fsdb = require('./_firestore.js');
const keys = require('./_keys.js');
const { think, extractJson } = require('./_brain.js');
const authLib = require('./_auth.js');
const { checkRateLimit } = require('./_ratelimit.js');
const { effectivePlan, withServerPerks } = require('./_video-entitlements.js');
const catalog = require('../../subjects/catalog.json');

const FREE_TOPICS = 3;
const GEN_PER_HOUR = 20, GEN_PER_DAY_ALL = 1500;
const QUIZ_PER_HOUR = 10;
const ASK_PER_DAY = { free: 10, paid: 150 };
const SUBJECTS = Object.fromEntries(catalog.subjects.map(s => [s.id, s]));

const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const json = (statusCode, body) => ({ statusCode, headers: { ...CORS, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, body: JSON.stringify(body) });
function httpErr(code, msg, extra) { const e = new Error(msg); e.statusCode = code; e.extra = extra; return e; }
const str = (v, n) => (typeof v === 'string' ? v.trim().slice(0, n) : '');

function topicOf(body) {
  const s = Object.hasOwn(SUBJECTS, body.subject) ? SUBJECTS[body.subject] : null;
  const g = String(body.grade || '');
  const list = s && Object.hasOwn(s.grades, g) ? s.grades[g] : null;
  const n = Number(body.n);
  if (!list || !Number.isInteger(n) || n < 0 || n >= list.length) throw httpErr(400, 'Mavzu topilmadi');
  return { s, g, n, topic: list[n], id: `${s.id}_${g}_${n}`, total: list.length };
}

async function account(uid) {
  const [user, admin] = await Promise.all([
    fsdb.getDoc(`users/${uid}`).catch(() => null),
    fsdb.getDoc(`admins/${uid}`).catch(() => null),
  ]);
  const plan = effectivePlan(await withServerPerks(fsdb, uid, user));
  return { paid: plan !== 'free' || !!admin, admin: !!admin };
}
function requireAccess(t, acc) {
  if (t.n < FREE_TOPICS || acc.paid) return;
  throw httpErr(402, "Bu dars obuna bilan ochiladi. Har sinfning dastlabki 3 ta darsi bepul.", { locked: true });
}

// ── Dars yozish ─────────────────────────────────────────────
function cleanLesson(j, t) {
  if (!j || typeof j !== 'object') return null;
  const sections = (Array.isArray(j.sections) ? j.sections : []).slice(0, 8).map(x => ({
    h: str(x?.h, 120),
    p: (Array.isArray(x?.p) ? x.p : [x?.p]).map(v => str(v, 1600)).filter(Boolean).slice(0, 6),
    list: (Array.isArray(x?.list) ? x.list : []).map(v => str(v, 300)).filter(Boolean).slice(0, 10),
  })).filter(x => x.h && (x.p.length || x.list.length));
  const quiz = (Array.isArray(j.quiz) ? j.quiz : []).map(q => ({
    q: str(q?.q, 400), o: (Array.isArray(q?.o) ? q.o : []).map(v => str(v, 200)).slice(0, 4),
    a: Number(q?.a), e: str(q?.e, 500),
  })).filter(q => q.q && q.o.length === 4 && q.o.every(Boolean) && Number.isInteger(q.a) && q.a >= 0 && q.a < 4).slice(0, 10);
  if (sections.length < 2 || quiz.length < 5) return null;
  return {
    lesson: {
      title: str(j.title, 160) || t.topic.t,
      intro: str(j.intro, 800),
      sections,
      examples: (Array.isArray(j.examples) ? j.examples : []).map(x => ({ q: str(x?.q, 600), a: str(x?.a, 1200) })).filter(x => x.q && x.a).slice(0, 5),
      summary: (Array.isArray(j.summary) ? j.summary : []).map(v => str(v, 300)).filter(Boolean).slice(0, 8),
    },
    quiz,
  };
}

async function writeLesson(t) {
  const prompt =
`Sen Oʻzbekistondagi tajribali maktab oʻqituvchisisan. ${t.g}-sinf oʻquvchisi uchun "${t.s.name}" fanidan bitta dars yoz.
Mavzu: "${t.topic.t}". Darsda albatta yoritilsin: ${(t.topic.k || []).join('; ')}.
Talablar:
- Faqat oʻzbek tilida, lotin yozuvida (oʻ, gʻ, ʼ). ${t.g}-sinf yoshiga mos, sodda va aniq tilda.
- Faktlar 100% toʻgʻri boʻlsin; ishonchsiz raqam, sana yoki ism yozma. Formulalarni Unicode bilan yoz (x², √, ·, →, H₂O), LaTeX va markdown ishlatma.
- 3–6 boʻlim: har birida qisqa paragraflar va kerak boʻlsa roʻyxat. Hayotiy misollar keltir.
- Agar fan masala yechishni talab qilsa, 2–4 ta yechilgan misol (savol va bosqichma-bosqich yechim).
- Oxirida 4–6 ta qisqa xulosa va 8 ta test savoli (4 ta variant, bittasi toʻgʻri, javob indeksi 0–3, qisqa izoh). Toʻgʻri javoblar turli oʻrinlarda boʻlsin.
Faqat JSON qaytar:
{"title":"...","intro":"2–3 gap","sections":[{"h":"sarlavha","p":["paragraf"],"list":["band"]}],"examples":[{"q":"masala","a":"yechim"}],"summary":["..."],"quiz":[{"q":"savol","o":["A","B","C","D"],"a":0,"e":"izoh"}]}`;
  for (let attempt = 0; attempt < 2; attempt++) {
    const r = await think('write', [{ role: 'user', content: prompt }], { temperature: 0.3, maxTokens: 7000, deadlineMs: 70000, perCallMs: 60000 });
    const out = cleanLesson(extractJson(r.text), t);
    if (out) return out;
  }
  throw httpErr(502, "Darsni yozib bo'lmadi, birozdan so'ng qayta urinib ko'ring.");
}

async function getLessonDoc(t, uid, create) {
  const path = `subjectLessons/${t.id}`;
  let doc = await fsdb.getDoc(path).catch(() => null);
  if (doc?.lesson) return doc;
  if (!create) return null;
  const [mine, all] = await Promise.all([
    checkRateLimit(`subjgen:${uid}`, { windowMs: 3600_000, max: GEN_PER_HOUR }),
    checkRateLimit('subjgen:all', { windowMs: 86400_000, max: GEN_PER_DAY_ALL }),
  ]);
  if (mine.unavailable || all.unavailable) throw httpErr(503, 'Xizmat vaqtincha mavjud emas.');
  if (!mine.ok || !all.ok) throw httpErr(429, "Yangi darslar limiti tugadi — birozdan so'ng qayta urinib ko'ring.");
  const out = await writeLesson(t);
  const data = { lesson: JSON.stringify(out.lesson), quiz: JSON.stringify(out.quiz), subject: t.s.id, grade: t.g, n: t.n, topic: t.topic.t, createdAt: new Date(), v: 1 };
  try { await fsdb.addDoc('subjectLessons', data, t.id); return data; }
  catch (e) {
    // boshqa so'rov oldinroq yozib qo'ygan bo'lsa — o'shani olamiz (test javoblari mos bo'lishi uchun)
    doc = await fsdb.getDoc(path).catch(() => null);
    if (doc?.lesson) return doc;
    throw e;
  }
}

async function lesson(uid, body) {
  const t = topicOf(body);
  requireAccess(t, await account(uid));
  const doc = await getLessonDoc(t, uid, true);
  const quiz = JSON.parse(doc.quiz).map(q => ({ q: q.q, o: q.o }));
  return { id: t.id, subject: t.s.name, grade: t.g, n: t.n, total: t.total, topic: t.topic.t, ...JSON.parse(doc.lesson), quiz };
}

async function quiz(uid, body) {
  const t = topicOf(body);
  requireAccess(t, await account(uid));
  const rl = await checkRateLimit(`subjquiz:${uid}:${t.id}`, { windowMs: 3600_000, max: QUIZ_PER_HOUR });
  if (rl.unavailable) throw httpErr(503, 'Xizmat vaqtincha mavjud emas.');
  if (!rl.ok) throw httpErr(429, "Bu test uchun urinishlar tugadi — bir soatdan so'ng.");
  const doc = await getLessonDoc(t, uid, false);
  if (!doc) throw httpErr(409, 'Avval darsni oching');
  const qs = JSON.parse(doc.quiz);
  const ans = Array.isArray(body.answers) ? body.answers : [];
  const result = qs.map((q, i) => ({ ok: Number(ans[i]) === q.a, a: q.a, e: q.e }));
  const correct = result.filter(r => r.ok).length;
  const score = Math.round(correct / qs.length * 100);
  await fsdb.transact(`subjectProgress/${uid}`, (cur) => {
    const map = cur?.scores ? JSON.parse(cur.scores) : {};
    if (!(map[t.id] >= score)) map[t.id] = score;
    return { uid, scores: JSON.stringify(map), updatedAt: new Date() };
  }).catch((e) => console.warn('[subjects] progress', e.message));
  return { score, correct, total: qs.length, result };
}

async function ask(uid, body) {
  const t = topicOf(body);
  const acc = await account(uid);
  requireAccess(t, acc);
  const question = str(body.question, 800);
  if (question.length < 2) throw httpErr(400, 'Savol yozing');
  const rl = await checkRateLimit(`subjask:${uid}`, { windowMs: 86400_000, max: acc.paid ? ASK_PER_DAY.paid : ASK_PER_DAY.free });
  if (rl.unavailable) throw httpErr(503, 'Xizmat vaqtincha mavjud emas.');
  if (!rl.ok) throw httpErr(429, acc.paid ? "Bugungi savollar limiti tugadi." : "Bugungi 10 ta bepul savol tugadi. Obuna bilan ko'proq so'rash mumkin.");
  const doc = await getLessonDoc(t, uid, false);
  const L = doc ? JSON.parse(doc.lesson) : null;
  const ctx = L ? [L.intro, ...L.sections.map(s => s.h + ': ' + s.p.join(' ') + ' ' + s.list.join('; '))].join('\n').slice(0, 6000) : '';
  const history = (Array.isArray(body.history) ? body.history : []).slice(-6)
    .map(m => ({ role: m?.role === 'assistant' ? 'assistant' : 'user', content: str(m?.content, 1200) })).filter(m => m.content);
  const r = await think('fast', [
    { role: 'system', content: `Sen ${t.g}-sinf oʻquvchisiga "${t.s.name}" fanidan "${t.topic.t}" mavzusini tushuntiruvchi mehribon AI ustozsan. Faqat oʻzbek tilida (lotin) javob ber, sodda va aniq, 120 soʻzdan oshmasin. Uy vazifasini shunchaki yechib berma — yoʻl-yoʻriq ber va oʻquvchini oʻylashga undab, kerak boʻlsa bosqichma-bosqich tushuntir. Formulalarni Unicode bilan yoz, markdown ishlatma. Mavzu va oʻqishga aloqasiz savollarga muloyimlik bilan darsga qaytishni taklif qil. Ishonchsiz boʻlsang, buni ayt.\nDars matni:\n${ctx}` },
    ...history,
    { role: 'user', content: question },
  ], { temperature: 0.4, maxTokens: 700, deadlineMs: 20000 });
  return { answer: str(r.text, 3000) };
}

// ── Xato xabarlari va admin: noto'g'ri AI darsni qayta yozdirish ──
async function report(uid, body) {
  const t = topicOf(body);
  const text = str(String(body.text || '').replace(/[\u0000-\u001f\u007f]/g, ' '), 800);
  if (text.length < 5) throw httpErr(400, 'Xatoni qisqacha yozing (kamida 5 belgi)');
  const rl = await checkRateLimit(`subjreport:${uid}`, { windowMs: 3600_000, max: 8 });
  if (!rl.ok) throw httpErr(429, "Juda ko'p xabar — bir soatdan keyin urinib ko'ring");
  await fsdb.addDoc('subjectReports', { uid, lessonId: t.id, subject: t.s.id, grade: t.g, n: t.n, topic: t.topic.t, text, status: 'new', createdAt: new Date(), createdMs: Date.now() });
  return { ok: true };
}
async function requireAdmin(uid) {
  if (!(await fsdb.getDoc(`admins/${uid}`).catch(() => null))) throw httpErr(403, "Admin huquqi yo'q");
}
async function adminReports(uid) {
  await requireAdmin(uid);
  const rows = await fsdb.queryList('subjectReports', [{ field: 'status', op: 'EQUAL', value: 'new' }], 'createdMs', 300).catch(() => []);
  return { rows: rows.map(r => ({ id: r.id, lessonId: r.lessonId, subject: r.subject, grade: r.grade, n: r.n, topic: r.topic, text: r.text, at: r.createdAt })) };
}
async function adminReportDone(uid, body) {
  await requireAdmin(uid);
  const id = String(body.id || '').slice(0, 80);
  if (!/^[A-Za-z0-9_-]+$/.test(id)) throw httpErr(400, 'id kerak');
  await fsdb.setDoc(`subjectReports/${id}`, { status: 'done', doneAt: new Date(), doneBy: uid });
  return { ok: true };
}
async function adminRegenerate(uid, body) {
  await requireAdmin(uid);
  const t = topicOf(body);
  await fsdb.deleteDoc(`subjectLessons/${t.id}`);   // keyingi ochilishda yangidan yoziladi
  return { ok: true, id: t.id };
}

async function progress(uid) {
  const doc = await fsdb.getDoc(`subjectProgress/${uid}`).catch(() => null);
  return { scores: doc?.scores ? JSON.parse(doc.scores) : {}, free: FREE_TOPICS, paid: (await account(uid)).paid };
}

exports.handler = async function (event) {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' };
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method Not Allowed' });
  let body;
  try { body = JSON.parse(event.body || '{}'); } catch { return json(400, { error: "Noto'g'ri JSON" }); }
  let auth;
  try { auth = await authLib.verifyIdToken(body.idToken); }
  catch { return json(401, { error: 'Darslarni ochish uchun tizimga kiring.' }); }
  await keys.refreshFromFirestore().catch(() => {});
  try {
    switch (body.action) {
      case 'lesson':   return json(200, await lesson(auth.uid, body));
      case 'quiz':     return json(200, await quiz(auth.uid, body));
      case 'ask':      return json(200, await ask(auth.uid, body));
      case 'progress': return json(200, await progress(auth.uid));
      case 'report':   return json(200, await report(auth.uid, body));
      case 'admin-reports':     return json(200, await adminReports(auth.uid));
      case 'admin-report-done': return json(200, await adminReportDone(auth.uid, body));
      case 'admin-regenerate':  return json(200, await adminRegenerate(auth.uid, body));
      default: return json(400, { error: "Noma'lum action" });
    }
  } catch (e) {
    console.error('[subjects]', body.action, e.message);
    return json(e.statusCode || 502, { error: e.statusCode ? e.message : 'Xatolik, qayta urinib ko‘ring.', ...(e.extra || {}) });
  }
};
module.exports.cleanLesson = cleanLesson;
module.exports.topicOf = topicOf;
module.exports.FREE_TOPICS = FREE_TOPICS;
