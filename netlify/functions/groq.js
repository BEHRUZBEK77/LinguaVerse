// ═══════════════════════════════════════════════════════════════════════════
// groq.js — ESKI/QISQA AI PROXY (orqaga moslik uchun saqlanadi)
//
// TARIX: bu funksiya ilgari FAQAT Groq'ga bog'langan edi — bitta provayder,
// zaifroq zanjir. Buni to'g'ridan-to'g'ri chaqiradigan sahifalar (speaking-coach
// va barcha til sahifalari: English.js, Arabic.js, Korean.js va h.k.) shu
// sabab Groq butunlay yiqilsa yoki javob sifati past bo'lsa (masalan tanlangan
// tildan boshqa tilda javob qaytsa) himoyasiz qolardi.
//
// ENDI: bu funksiya ai.js dagi TO'LIQ ko'p-provayderli zanjirni (Groq →
// DeepSeek → OpenRouter → Gemini → Cloudflare, sozlangan kalitlarga qarab)
// ichida ishlatadi — front-end kod (URL, so'rov/javob shakli) o'zgarmaydi,
// faqat orqa tomon ancha ishonchli bo'ladi.
//
// Gemini-format ({contents}) va OpenAI-format ({messages}) ikkalasini
// qabul qiladi va SO'RALGAN FORMATDA javob beradi — chaqiruvchi kodlar
// hech narsa o'zgartirmasdan ishlashda davom etadi.
// ═══════════════════════════════════════════════════════════════════════════

const keys = require('./_keys.js');
const ratelimit = require('./_ratelimit.js');
const ai = require('./ai.js');

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

// Ushbu endpoint uchun provayder/model zanjiri — tez va arzon modellardan
// boshlab, kerak bo'lsa kuchliroq/boshqa provayderga o'tadi.
//
// DIQQAT — Netlify Functions standart taymauti (~10s, tarifga qarab):
// zanjir ketma-ket urinadi, shuning uchun uni juda uzun qilib bo'lmaydi —
// aks holda bir nechta muvaffaqiyatsiz urinish (har biri 2-3s) yig'ilib,
// funksiya vaqti tugashidan oldin foydalanuvchiga hech qanday javob
// (hatto xato ham) yetib bormay qoladi. Shu sabab 4 ta bosqichda,
// turli provayderlardan tanlangan — bitta provayder butunlay yiqilsa ham
// himoya bor, lekin zanjir juda uzun emas.
const CHAIN = [
  { provider: 'groq',       model: 'moonshotai/kimi-k2-instruct-0905' },
  { provider: 'groq',       model: 'llama-3.3-70b-versatile' },
  { provider: 'gemini',     model: 'gemini-2.0-flash' },
  { provider: 'deepseek',   model: 'deepseek-chat' }
];

// Har bir provayder urinishi uchun maksimal kutish vaqti — birontasi
// osilib qolsa (tarmoq muammosi va h.k.), zanjir shu bo'g'inda abadiy
// to'xtab qolmasin, keyingi provayderga o'tsin.
const PER_CALL_TIMEOUT_MS = 8000;

function withTimeout(promise, ms, label) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label}: timeout (${ms}ms)`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

function geminiToMessages(contents) {
  return (contents || []).map(c => ({
    role: c.role === 'model' ? 'assistant' : 'user',
    content: (c.parts || []).map(p => p.text || '').join('\n')
  })).filter(m => m.content.trim());
}

exports.handler = async function (event) {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: CORS, body: 'Method Not Allowed' };

  // Bu endpoint ko'plab til sahifalari tomonidan to'g'ridan-to'g'ri
  // chaqiriladi va hali auth talab qilmaydi — shuning uchun IP bo'yicha
  // tezlik chekloviga olindi (pullik balansni himoya qilish uchun).
  const rl = await ratelimit.checkRateLimit(`groq:${ratelimit.clientIp(event)}`, { windowMs: 60_000, max: 25 });
  if (!rl.ok) {
    return { statusCode: 429, headers: CORS, body: JSON.stringify({ error: "Juda ko'p so'rov. Biroz kuting." }) };
  }

  let payload;
  try { payload = JSON.parse(event.body || '{}'); }
  catch { return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Invalid JSON' }) }; }

  const isGeminiFormat = Array.isArray(payload.contents);
  let messages = isGeminiFormat ? geminiToMessages(payload.contents) : (payload.messages || []);
  if (!messages.length) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'No messages' }) };

  const gc = payload.generationConfig || {};
  const temperature = payload.temperature ?? gc.temperature ?? 0.7;
  const maxTokens = Math.min(payload.max_tokens ?? payload.maxTokens ?? gc.maxOutputTokens ?? 2000, 8000);

  const respond = (text, model) => {
    const body = isGeminiFormat
      ? { candidates: [{ content: { parts: [{ text }] } }], model }
      : { choices: [{ message: { role: 'assistant', content: text } }], model };
    return { statusCode: 200, headers: { ...CORS, 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
  };

  const cfg = { temperature, maxTokens };
  const errors = [];
  let quotaHit = false;
  const groqConfigured = !!keys.get('GROQ_API_KEY');

  for (const spec of CHAIN) {
    const fn = ai.PROVIDERS[spec.provider];
    if (!fn) continue;
    if (!ai.hasKeyFor(spec.provider)) {
      errors.push(`${spec.provider}:${spec.model} — kalit sozlanmagan`);
      continue;
    }
    try {
      const result = await withTimeout(fn(spec, messages, cfg), PER_CALL_TIMEOUT_MS, `${spec.provider}:${spec.model}`);
      return respond(result.text, result.backend || `${spec.provider}:${spec.model}`);
    } catch (e) {
      const msg = `${spec.provider}:${spec.model} — ${e.message}`;
      errors.push(msg);
      if (ai.isQuotaError(e.message)) {
        quotaHit = true;
        console.warn("[groq-proxy] kvota tugadi, keyingisiga o'tamiz:", msg);
      } else {
        console.error('[groq-proxy] bo\'g\'in ishlamadi:', msg);
      }
    }
  }

  console.error('[groq-proxy] butun zanjir ishlamadi:', errors.join(' | '));
  return {
    statusCode: 502,
    headers: { ...CORS, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      error: quotaHit
        ? "AI xizmatining kunlik kvotasi tugadi. Bir ozdan keyin urinib ko'ring."
        : 'AI service unavailable',
      detail: groqConfigured ? 'upstream_failed' : 'missing_api_key',
      quotaExhausted: quotaHit,
      lastError: errors[errors.length - 1] || undefined
    })
  };
};
