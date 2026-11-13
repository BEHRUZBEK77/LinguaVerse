// ═══════════════════════════════════════════════════════════════════════════
// vocab.js — LUG'AT (8 til × 40 000 so'z) va so'z mashqi (SRS)
//
//   POST { action:'define', idToken, lang, words:[...] }  → { defs: { so'z: {...} } }
//        So'z ro'yxati statik (/vocab). Ma'no, talaffuz, misol AI bilan bir
//        marta yoziladi va vocabDefs/ da hamma uchun keshlanadi.
//   POST { action:'progress-get',  idToken, lang }        → { cards }
//   POST { action:'progress-save', idToken, lang, cards } → { ok }
//        cards: { "<o'rin>": [ease×100, interval_kun, keyingi_kun, takror] }
// ═══════════════════════════════════════════════════════════════════════════
const crypto = require('crypto');
const fsdb = require('./_firestore.js');
const keys = require('./_keys.js');
const { think, extractJson } = require('./_brain.js');
const { verifyIdToken } = require('./_auth.js');
const { checkRateLimit } = require('./_ratelimit.js');

const LANGS = {
  english: { name: 'English', tr: 'IPA' },
  russian: { name: 'Russian', tr: 'IPA (with stress)' },
  turkish: { name: 'Turkish', tr: 'IPA' },
  german:  { name: 'German', tr: 'IPA' },
  spanish: { name: 'Spanish', tr: 'IPA' },
  arabic:  { name: 'Arabic (Modern Standard)', tr: 'Latin transliteration with vowels' },
  chinese: { name: 'Chinese (Mandarin, simplified)', tr: 'pinyin with tone marks' },
  korean:  { name: 'Korean', tr: 'Revised Romanization' },
};
const WORD_RE = /^[\p{L}\p{M}'’-]{1,30}$/u;
const MAX_WORDS = 12;          // bitta so'rovda
const AI_PER_HOUR = 40;        // foydalanuvchi: soatiga 40 AI chaqiruv (≈480 yangi so'z)
const AI_PER_DAY_ALL = 4000;   // butun sayt: kuniga
const MAX_CARDS = 8000;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};
function json(statusCode, body) {
  return { statusCode, headers: { ...CORS, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, body: JSON.stringify(body) };
}
function httpErr(code, msg) { const e = new Error(msg); e.statusCode = code; return e; }

function checkLang(lang) {
  if (!Object.hasOwn(LANGS, lang)) throw httpErr(400, "Noma'lum til");
  return LANGS[lang];
}
const defId = (lang, w) => `vocabDefs/${lang}_${crypto.createHash('sha256').update(w).digest('hex').slice(0, 20)}`;
const str = (v, n) => (typeof v === 'string' ? v.trim().slice(0, n) : '');

function cleanDef(x) {
  if (!x || typeof x !== 'object') return null;
  const d = { form: str(x.form, 60), lemma: str(x.lemma, 60), pos: str(x.pos, 30), uz: str(x.uz, 160),
    tr: str(x.tr, 80), ex: str(x.ex, 200), exUz: str(x.exUz, 220) };
  return d.uz ? d : null;
}

async function aiDefine(L, words) {
  const r = await think('fast', [
    { role: 'system', content:
`You are a careful bilingual lexicographer writing a ${L.name}–Uzbek learner's dictionary. Uzbek is written in Latin script (oʻ, gʻ, sh, ch, ng; use ʻ and ʼ).
For EACH input word return one item. Return ONLY JSON: {"items":[{"w":"<word exactly as given>","form":"correct dictionary spelling${L.name === 'German' ? ' (nouns capitalised with article, e.g. das Haus)' : ''}","lemma":"base form if the word is inflected, else empty","pos":"one of: ot, fe'l, sifat, ravish, olmosh, son, ko'makchi, bog'lovchi, yuklama, undov, ism (atoqli)","uz":"1-3 short Uzbek meanings, comma separated","tr":"pronunciation in ${L.tr}","ex":"one short natural ${L.name} example sentence (max 12 words) using the word","exUz":"Uzbek translation of the example"}]}
Be accurate; never invent meanings. If the word is a name or a fragment, say so in "uz".` },
    { role: 'user', content: JSON.stringify(words) }
  ], { temperature: 0.2, maxTokens: 2200, deadlineMs: 20000 });
  const j = extractJson(r.text);
  return Array.isArray(j?.items) ? j.items : [];
}

async function define(uid, body) {
  const lang = String(body.lang || '');
  const L = checkLang(lang);
  const words = [...new Set((Array.isArray(body.words) ? body.words : []).map(w => String(w || '').normalize('NFC').trim()))]
    .filter(w => WORD_RE.test(w)).slice(0, MAX_WORDS);
  if (!words.length) throw httpErr(400, "So'z yo'q");

  const any = await checkRateLimit(`vocabreq:${uid}`, { windowMs: 3600_000, max: 600 });
  if (!any.ok && !any.unavailable) throw httpErr(429, "Juda ko'p so'rov — birozdan so'ng.");
  const defs = {};
  const cached = await Promise.all(words.map(w => fsdb.getDoc(defId(lang, w)).catch(() => null)));
  const missing = [];
  words.forEach((w, i) => { const d = cleanDef(cached[i]); if (d) defs[w] = d; else missing.push(w); });
  if (!missing.length) return { defs };

  const [mine, all] = await Promise.all([
    checkRateLimit(`vocab:${uid}`, { windowMs: 3600_000, max: AI_PER_HOUR }),
    checkRateLimit('vocab:all', { windowMs: 86400_000, max: AI_PER_DAY_ALL }),
  ]);
  if (mine.unavailable || all.unavailable) throw httpErr(503, 'Xizmat vaqtincha mavjud emas.');
  if (!mine.ok || !all.ok) return { defs, limited: true };

  const items = await aiDefine(L, missing);
  const want = new Set(missing);
  await Promise.all(items.map(async (it) => {
    const w = String(it?.w || '').normalize('NFC').trim();
    const d = cleanDef(it);
    if (!want.has(w) || !d) return;
    want.delete(w);
    defs[w] = d;
    await fsdb.setDoc(defId(lang, w), { ...d, w, lang, createdAt: new Date() }).catch(() => {});
  }));
  return { defs };
}

function cleanCards(cards) {
  if (!cards || typeof cards !== 'object' || Array.isArray(cards)) throw httpErr(400, "Noto'g'ri ma'lumot");
  const out = {};
  let n = 0;
  for (const [k, v] of Object.entries(cards)) {
    if (!/^\d{1,5}$/.test(k) || +k >= 40000 || !Array.isArray(v) || v.length !== 4) continue;
    const [e, iv, due, reps] = v.map(x => Math.round(Number(x)));
    if (![e, iv, due, reps].every(Number.isFinite)) continue;
    out[k] = [Math.min(400, Math.max(130, e)), Math.min(3650, Math.max(0, iv)), Math.min(200000, Math.max(0, due)), Math.min(999, Math.max(0, reps))];
    if (++n >= MAX_CARDS) break;
  }
  return out;
}

async function progressGet(uid, body) {
  checkLang(String(body.lang || ''));
  const doc = await fsdb.getDoc(`vocabProgress/${uid}_${body.lang}`).catch(() => null);
  return { cards: doc?.cards ? JSON.parse(doc.cards) : {}, updatedAt: doc?.updatedAt || null };
}
async function progressSave(uid, body) {
  checkLang(String(body.lang || ''));
  const rl = await checkRateLimit(`vocabsave:${uid}`, { windowMs: 3600_000, max: 120 });
  if (!rl.ok) throw httpErr(429, "Juda ko'p saqlash — birozdan so'ng.");
  const cards = cleanCards(body.cards);
  await fsdb.setDoc(`vocabProgress/${uid}_${body.lang}`, { uid, lang: body.lang, cards: JSON.stringify(cards), count: Object.keys(cards).length, updatedAt: new Date() });
  return { ok: true, count: Object.keys(cards).length };
}

exports.handler = async function (event) {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' };
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method Not Allowed' });
  let body;
  try { body = JSON.parse(event.body || '{}'); } catch { return json(400, { error: "Noto'g'ri JSON" }); }
  let auth;
  try { auth = await verifyIdToken(body.idToken); }
  catch { return json(401, { error: 'Lug‘atdan foydalanish uchun tizimga kiring.' }); }
  await keys.refreshFromFirestore().catch(() => {});
  try {
    switch (body.action) {
      case 'define':        return json(200, await define(auth.uid, body));
      case 'progress-get':  return json(200, await progressGet(auth.uid, body));
      case 'progress-save': return json(200, await progressSave(auth.uid, body));
      default: return json(400, { error: "Noma'lum action" });
    }
  } catch (e) {
    console.error('[vocab]', body.action, e.message);
    return json(e.statusCode || 502, { error: e.statusCode ? e.message : 'Xatolik, qayta urinib ko‘ring.' });
  }
};
module.exports.cleanCards = cleanCards;
module.exports.cleanDef = cleanDef;
module.exports.LANGS = LANGS;
