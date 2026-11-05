// ═══════════════════════════════════════════════════════════════════════════
// _brain.js — AI USTOZ "MIYASI" uchun tezkor va chuqur zanjirlar
//
// ai.js dagi provayderlardan foydalanadi, lekin ustoz uchun maxsus sozlangan:
//   fast — jonli suhbat (1–3 soniya): reasoning past, javob darhol.
//   deep — baholash va dars yaratish: kuchli modellar, chuqur fikrlash.
// Har bir urinish o'z taymautiga ega, umumiy muddat (deadline) Netlify
// funksiya chegarasidan oshmaydi. Bitta provayder ishlamasa — keyingisi.
// ═══════════════════════════════════════════════════════════════════════════

const ai = require('./ai.js');

const CHAINS = {
  fast: [
    { provider: 'groq', model: 'openai/gpt-oss-120b', reasoning: 'low' },
    { provider: 'gemini', model: 'gemini-2.5-flash', thinkingBudget: 0 },
    { provider: 'deepseek', model: 'deepseek-chat' },
    { provider: 'openrouter', model: 'deepseek/deepseek-chat-v3-0324' },
    { provider: 'groq', model: 'meta-llama/llama-4-maverick-17b-128e-instruct' },
    { provider: 'cloudflare', model: '@cf/meta/llama-3.3-70b-instruct-fp8-fast' }
  ],
  // Dars yaratish: sifatli, lekin bir urinishda tugashi kerak
  write: [
    { provider: 'groq', model: 'openai/gpt-oss-120b', reasoning: 'medium' },
    { provider: 'gemini', model: 'gemini-2.5-flash', thinkingBudget: 1024 },
    { provider: 'deepseek', model: 'deepseek-chat' },
    { provider: 'openrouter', model: 'deepseek/deepseek-chat-v3-0324' },
    { provider: 'groq', model: 'openai/gpt-oss-120b', reasoning: 'low' }
  ],
  // Baholash (Netlify funksiya taymauti 10s bo'lsa): tez, lekin kuchli
  examA: [
    { provider: 'gemini', model: 'gemini-2.5-flash', thinkingBudget: 2048 },
    { provider: 'groq', model: 'openai/gpt-oss-120b', reasoning: 'low' },
    { provider: 'deepseek', model: 'deepseek-chat' }
  ],
  examB: [
    { provider: 'groq', model: 'openai/gpt-oss-120b', reasoning: 'medium' },
    { provider: 'openrouter', model: 'deepseek/deepseek-chat-v3-0324' },
    { provider: 'gemini', model: 'gemini-2.5-flash', thinkingBudget: 0 }
  ],
  // Baholash (taymaut 26s ga oshirilgan bo'lsa): eng kuchli modellar
  deepA: [
    { provider: 'gemini', model: 'gemini-2.5-pro', thinkingBudget: 4096 },
    { provider: 'openrouter', model: 'anthropic/claude-3.5-sonnet' },
    { provider: 'groq', model: 'openai/gpt-oss-120b', reasoning: 'high' },
    { provider: 'gemini', model: 'gemini-2.5-flash', thinkingBudget: 2048 }
  ],
  deepB: [
    { provider: 'groq', model: 'openai/gpt-oss-120b', reasoning: 'high' },
    { provider: 'deepseek', model: 'deepseek-reasoner' },
    { provider: 'openrouter', model: 'openai/gpt-4o' },
    { provider: 'gemini', model: 'gemini-2.5-flash', thinkingBudget: 2048 }
  ]
};

function withTimeout(promise, ms, label) {
  let t;
  return Promise.race([
    promise.finally(() => clearTimeout(t)),
    new Promise((_, rej) => { t = setTimeout(() => rej(new Error(`${label}: ${ms}ms taymaut`)), ms); })
  ]);
}

/**
 * @param {'fast'|'write'|'deepA'|'deepB'} tier
 * @param {Array<{role,content}>} messages
 * @param {{temperature?:number,maxTokens?:number,deadlineMs?:number,perCallMs?:number}} cfg
 * @returns {Promise<{text:string, backend:string}>}
 */
async function think(tier, messages, cfg = {}, deps = {}) {
  const providers = deps.providers || ai.PROVIDERS;
  const hasKey = deps.hasKeyFor || ai.hasKeyFor;
  const chain = CHAINS[tier] || CHAINS.fast;
  const started = Date.now();
  const deadline = cfg.deadlineMs || 9000;
  const errors = [];

  for (const spec of chain) {
    const fn = providers[spec.provider];
    if (!fn || !hasKey(spec.provider)) { errors.push(`${spec.provider}: kalit yo'q`); continue; }
    const left = deadline - (Date.now() - started);
    if (left < 1500) break;
    try {
      const r = await withTimeout(
        fn(spec, messages, { temperature: cfg.temperature ?? 0.7, maxTokens: cfg.maxTokens ?? 1200 }),
        Math.min(left, cfg.perCallMs || left),
        `${spec.provider}:${spec.model}`
      );
      return { text: r.text, backend: r.backend };
    } catch (e) {
      errors.push(`${spec.provider}:${spec.model} — ${e.message}`);
    }
  }
  const err = new Error("AI hozir javob bera olmayapti. Bir ozdan so'ng qayta urinib ko'ring.");
  err.detail = errors;
  console.error('[brain]', tier, errors.join(' | '));
  throw err;
}

/** Model javobidan birinchi JSON obyektni ajratadi (``` va izohlarga chidamli). */
function extractJson(text) {
  const s = String(text || '').replace(/```(?:json)?/gi, '');
  const start = s.indexOf('{');
  if (start < 0) return null;
  let depth = 0, inStr = false, esc = false;
  for (let i = start; i < s.length; i++) {
    const c = s[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === '\\') esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') inStr = true;
    else if (c === '{') depth++;
    else if (c === '}' && --depth === 0) {
      try { return JSON.parse(s.slice(start, i + 1)); } catch { return null; }
    }
  }
  return null;
}

module.exports = { think, extractJson, CHAINS };
