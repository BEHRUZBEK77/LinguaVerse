// ═══════════════════════════════════════════════════════════════════════════
// ai.js — LinguaVerse AI ROUTER
//
// Klient faqat model NOMINI yuboradi (nova / pro / mega / proplus /
// premium / megaplus). Qaysi haqiqiy model ishlashini FAQAT shu server
// hal qiladi. Foydalanuvchi backend provayderni hech qachon ko'rmaydi.
//
// KALITLAR — ikkita manba:
//   1. Admin panel → data/api-keys.json  (_keys.js o'qiydi)
//   2. Netlify Environment Variables / .env (zaxira)
// Qo'llab-quvvatlanadigan provayderlar:
//   GEMINI_API_KEYS      = AIza...,AIza...   (vergul bilan, rotatsiya)
//   GROQ_API_KEY         = gsk_...
//   DEEPSEEK_API_KEY     = sk-...
//   OPENROUTER_API_KEY   = sk-or-...
//   CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID
//   AZURE_OPENAI_KEY + AZURE_OPENAI_RESOURCE (+ AZURE_OPENAI_DEPLOYMENT)
//
// DIQQAT: kalitlarni bu faylga YOZMANG. Kod GitHub'da ochiq turadi.
// ═══════════════════════════════════════════════════════════════════════════

const keys = require('./_keys.js');
const ratelimit = require('./_ratelimit.js');

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS'
};

// ───────────────────────────────────────────────────────────────────────────
// MODEL REGISTRY
// Har bir nom uchun fallback zanjiri: birinchisi ishlamasa keyingisi.
// Shu tufayli bitta provayder yiqilsa ham sayt to'xtamaydi.
// ───────────────────────────────────────────────────────────────────────────
const REGISTRY = {
  // ── NOVA — tez, arzon, kundalik savollar
  nova: {
    label: 'NOVA',
    temperature: 0.75,
    maxTokens: 1200,
    chain: [
      { provider: 'groq',      model: 'llama-3.3-70b-versatile' },
      { provider: 'deepseek',  model: 'deepseek-chat' },
      { provider: 'openrouter', model: 'deepseek/deepseek-chat-v3-0324' },
      { provider: 'gemini',    model: 'gemini-2.0-flash' },
      { provider: 'cloudflare', model: '@cf/meta/llama-3.3-70b-instruct-fp8-fast' }
    ]
  },

  // ── PRO — o'ylash rejimi (1-tarif)
  pro: {
    label: 'PRO',
    temperature: 0.6,
    maxTokens: 2600,
    thinking: 'medium',
    chain: [
      { provider: 'groq',      model: 'openai/gpt-oss-120b', reasoning: 'medium' },
      { provider: 'deepseek',  model: 'deepseek-reasoner' },
      { provider: 'gemini',    model: 'gemini-2.5-flash', thinkingBudget: 2048 },
      { provider: 'openrouter', model: 'deepseek/deepseek-chat-v3-0324' },
      { provider: 'groq',      model: 'llama-3.3-70b-versatile' }
    ]
  },

  // ── MEGA — NOVA'dan sezilarli kuchli (2-tarif)
  mega: {
    label: 'MEGA',
    temperature: 0.7,
    maxTokens: 2200,
    chain: [
      { provider: 'groq',      model: 'moonshotai/kimi-k2-instruct-0905' },
      { provider: 'openrouter', model: 'qwen/qwen-2.5-72b-instruct' },
      { provider: 'gemini',    model: 'gemini-2.5-flash', thinkingBudget: 0 },
      { provider: 'deepseek',  model: 'deepseek-chat' },
      { provider: 'groq',      model: 'openai/gpt-oss-120b' }
    ]
  },

  // ── PRO+ — chuqur o'ylash (2-tarif)
  proplus: {
    label: 'PRO+',
    temperature: 0.55,
    maxTokens: 4200,
    thinking: 'high',
    chain: [
      { provider: 'groq',      model: 'openai/gpt-oss-120b', reasoning: 'high' },
      { provider: 'deepseek',  model: 'deepseek-reasoner' },
      { provider: 'gemini',    model: 'gemini-2.5-flash', thinkingBudget: 8192 },
      { provider: 'openrouter', model: 'qwen/qwen-2.5-72b-instruct' },
      { provider: 'groq',      model: 'moonshotai/kimi-k2-instruct-0905' }
    ]
  },

  // ── PREMIUM — eng kuchli tezkor (3-tarif)
  premium: {
    label: 'PREMIUM',
    temperature: 0.65,
    maxTokens: 3200,
    chain: [
      { provider: 'gemini',    model: 'gemini-2.5-pro', thinkingBudget: 1024 },
      { provider: 'openrouter', model: 'openai/gpt-4o' },
      { provider: 'azure',     model: 'gpt-4o', deployment: null },
      { provider: 'groq',      model: 'moonshotai/kimi-k2-instruct-0905' },
      { provider: 'gemini',    model: 'gemini-2.5-flash' }
    ]
  },

  // ── MEGA+ — platformadagi eng zo'ri (3-tarif)
  megaplus: {
    label: 'MEGA+',
    temperature: 0.5,
    maxTokens: 8000,
    thinking: 'max',
    chain: [
      { provider: 'gemini',    model: 'gemini-2.5-pro', thinkingBudget: 16384 },
      { provider: 'deepseek',  model: 'deepseek-reasoner' },
      { provider: 'openrouter', model: 'anthropic/claude-3.5-sonnet' },
      { provider: 'groq',      model: 'openai/gpt-oss-120b', reasoning: 'high' },
      { provider: 'cloudflare', model: '@cf/meta/llama-4-scout-17b-16e-instruct' },
      { provider: 'groq',      model: 'moonshotai/kimi-k2-instruct-0905' }
    ]
  }
};

// ───────────────────────────────────────────────────────────────────────────
// GROQ — UMUMIY ZAHIRA
//
// Har qanday model uchun oxirgi chora. Gemini kvotasi tugasa yoki provayder
// yiqilsa, so'rov shu zanjirga tushadi va foydalanuvchi javobsiz qolmaydi.
// ───────────────────────────────────────────────────────────────────────────
// MUHIM: bu yerda ilgari oxirgi chora sifatida noma'lum uchinchi-tomon
// "legacy" worker (gentle-hat-d9fa.akromovbehruz7.workers.dev) ishlatilgan.
// U bizniki emas edi va system-prompt/til-cheklovlarni (masalan "faqat
// shu tilda gapir" qoidasini) hurmat qilishi kafolatlanmagan — shu sabab
// foydalanuvchi tanlagan tildan boshqa tilda javob qaytishi mumkin edi.
// Endi zanjir to'liq bizning nazoratimizdagi provayderlar bilan tugaydi.
const GROQ_RESERVE = [
  { provider: 'groq', model: 'llama-3.3-70b-versatile' },
  { provider: 'groq', model: 'meta-llama/llama-4-maverick-17b-128e-instruct' },
  { provider: 'groq', model: 'llama-3.1-8b-instant' },
  { provider: 'cloudflare', model: '@cf/meta/llama-3.3-70b-instruct-fp8-fast' }
];

/** Provayder uchun kalit sozlangani aniqlaydi. */
function hasKeyFor(provider) {
  switch (provider) {
    case 'groq':       return !!keys.get('GROQ_API_KEY');
    case 'gemini':     return geminiKeys().length > 0;
    case 'deepseek':   return !!keys.get('DEEPSEEK_API_KEY');
    case 'openrouter': return !!keys.get('OPENROUTER_API_KEY');
    case 'cloudflare': return !!(keys.get('CLOUDFLARE_API_TOKEN') && keys.get('CLOUDFLARE_ACCOUNT_ID'));
    case 'azure':      return !!(keys.get('AZURE_OPENAI_KEY') && keys.get('AZURE_OPENAI_RESOURCE'));
    default:           return true;
  }
}

/** Xato kvota/limit tufaylimi? Shunda keyingi provayderga o'tish shart. */
function isQuotaError(msg) {
  const m = String(msg).toLowerCase();
  return m.includes('quota') || m.includes('rate limit') || m.includes('rate_limit')
      || m.includes('resource_exhausted') || m.includes('too many requests')
      || m.includes('429') || m.includes('exceeded') || m.includes('billing');
}

// ───────────────────────────────────────────────────────────────────────────
// GEMINI KALIT ROTATSIYASI
// Bir nechta kalit bo'lsa navbat bilan ishlatiladi — bitta kalitning
// kunlik kvotasi tugasa, keyingisiga o'tadi.
// ───────────────────────────────────────────────────────────────────────────
let geminiCursor = 0;

function geminiKeys() {
  const raw = keys.get('GEMINI_API_KEYS') || keys.get('GEMINI_API_KEY') || '';
  return raw.split(',').map(k => k.trim()).filter(Boolean);
}

function nextGeminiKey() {
  const keys = geminiKeys();
  if (!keys.length) return null;
  const key = keys[geminiCursor % keys.length];
  geminiCursor++;
  return key;
}

// ───────────────────────────────────────────────────────────────────────────
// PROVAYDERLAR
// ───────────────────────────────────────────────────────────────────────────

async function callGroq(spec, messages, cfg) {
  const key = keys.get('GROQ_API_KEY');
  if (!key) throw new Error("GROQ_API_KEY yo'q");

  const body = {
    model: spec.model,
    messages,
    temperature: cfg.temperature,
    max_tokens: cfg.maxTokens
  };
  if (spec.reasoning) body.reasoning_effort = spec.reasoning;

  const resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  const data = await resp.json();
  if (!resp.ok) throw new Error(data?.error?.message || `Groq HTTP ${resp.status}`);

  const msg = data.choices?.[0]?.message;
  const text = msg?.content || '';
  if (!text.trim()) throw new Error("Groq bo'sh javob qaytardi");

  return { text, thinking: msg?.reasoning || null, backend: `groq:${spec.model}` };
}

async function callGemini(spec, messages, cfg) {
  const key = nextGeminiKey();
  if (!key) throw new Error("GEMINI_API_KEYS yo'q");

  const systemParts = messages.filter(m => m.role === 'system').map(m => m.content).join('\n\n');
  const contents = messages
    .filter(m => m.role !== 'system')
    .map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }]
    }))
    .filter(c => c.parts[0].text.trim());

  if (!contents.length) throw new Error("Bo'sh suhbat");

  const body = {
    contents,
    generationConfig: {
      temperature: cfg.temperature,
      maxOutputTokens: cfg.maxTokens
    },
    safetySettings: [
      'HARM_CATEGORY_HARASSMENT', 'HARM_CATEGORY_HATE_SPEECH',
      'HARM_CATEGORY_SEXUALLY_EXPLICIT', 'HARM_CATEGORY_DANGEROUS_CONTENT'
    ].map(category => ({ category, threshold: 'BLOCK_ONLY_HIGH' }))
  };

  if (systemParts) body.systemInstruction = { parts: [{ text: systemParts }] };
  if (spec.thinkingBudget !== undefined) {
    body.generationConfig.thinkingConfig = { thinkingBudget: spec.thinkingBudget };
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${spec.model}:generateContent?key=${key}`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  const data = await resp.json();
  if (!resp.ok) throw new Error(data?.error?.message || `Gemini HTTP ${resp.status}`);

  const cand = data.candidates?.[0];
  if (cand?.finishReason === 'SAFETY') throw new Error("Gemini xavfsizlik filtri to'sdi");

  const text = (cand?.content?.parts || []).map(p => p.text || '').join('').trim();
  if (!text) throw new Error("Gemini bo'sh javob qaytardi");

  return { text, thinking: null, backend: `gemini:${spec.model}` };
}

// ───────────────────────────────────────────────────────────────────────────
// DEEPSEEK — OpenAI format (deepseek-chat / deepseek-reasoner)
// ───────────────────────────────────────────────────────────────────────────
async function callDeepSeek(spec, messages, cfg) {
  const key = keys.get('DEEPSEEK_API_KEY');
  if (!key) throw new Error("DEEPSEEK_API_KEY yo'q");

  const body = {
    model: spec.model,
    messages,
    temperature: cfg.temperature,
    max_tokens: cfg.maxTokens,
    stream: false
  };

  const resp = await fetch('https://api.deepseek.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  const data = await resp.json();
  if (!resp.ok) throw new Error(data?.error?.message || `DeepSeek HTTP ${resp.status}`);

  const msg = data.choices?.[0]?.message;
  const text = msg?.content || '';
  if (!text.trim()) throw new Error("DeepSeek bo'sh javob qaytardi");

  return { text, thinking: msg?.reasoning_content || null, backend: `deepseek:${spec.model}` };
}

// ───────────────────────────────────────────────────────────────────────────
// OPENROUTER — ko'p modeldan bir API (OpenAI format)
// ───────────────────────────────────────────────────────────────────────────
async function callOpenRouter(spec, messages, cfg) {
  const key = keys.get('OPENROUTER_API_KEY');
  if (!key) throw new Error("OPENROUTER_API_KEY yo'q");

  const body = {
    model: spec.model,
    messages,
    temperature: cfg.temperature,
    max_tokens: cfg.maxTokens
  };
  if (spec.reasoning) body.reasoning_effort = spec.reasoning;

  const resp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://linguaverse.uz',
      'X-Title': 'LinguaVerse'
    },
    body: JSON.stringify(body)
  });

  const data = await resp.json();
  if (!resp.ok) throw new Error(data?.error?.message || `OpenRouter HTTP ${resp.status}`);

  const msg = data.choices?.[0]?.message;
  const text = msg?.content || '';
  if (!text.trim()) throw new Error("OpenRouter bo'sh javob qaytardi");

  return { text, thinking: msg?.reasoning || null, backend: `openrouter:${spec.model}` };
}

// ───────────────────────────────────────────────────────────────────────────
// CLOUDFLARE WORKERS AI — OpenAI moslashuvchan endpoint
// Account ID + API Token kerak (admin panelda kiritiladi)
// ───────────────────────────────────────────────────────────────────────────
async function callCloudflare(spec, messages, cfg) {
  const token = keys.get('CLOUDFLARE_API_TOKEN');
  const account = keys.get('CLOUDFLARE_ACCOUNT_ID');
  if (!token || !account) throw new Error("CLOUDFLARE_API_TOKEN/ACCOUNT_ID yo'q");

  const body = {
    model: spec.model,
    messages,
    temperature: cfg.temperature,
    max_tokens: cfg.maxTokens
  };

  const url = `https://api.cloudflare.com/client/v4/accounts/${account}/ai/v1/chat/completions`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  const data = await resp.json();
  if (!resp.ok) {
    const detail = Array.isArray(data?.errors)
      ? data.errors.map(e => e.message).join('; ')
      : (data?.error?.message || `Cloudflare HTTP ${resp.status}`);
    throw new Error(detail);
  }

  const msg = data.choices?.[0]?.message;
  const text = msg?.content || '';
  if (!text.trim()) throw new Error("Cloudflare bo'sh javob qaytardi");

  return { text, thinking: msg?.reasoning || null, backend: `cloudflare:${spec.model}` };
}

// ───────────────────────────────────────────────────────────────────────────
// AZURE OPENAI — deployment nomi bilan (Azure Portal'dan olinadi)
// ───────────────────────────────────────────────────────────────────────────
async function callAzure(spec, messages, cfg) {
  const key = keys.get('AZURE_OPENAI_KEY');
  const resource = keys.get('AZURE_OPENAI_RESOURCE');
  if (!key || !resource) throw new Error("AZURE_OPENAI_KEY/RESOURCE yo'q");

  const deployment = spec.deployment || keys.get('AZURE_OPENAI_DEPLOYMENT') || 'gpt-4o';
  const apiVersion = spec.apiVersion || '2024-06-01';

  const body = {
    messages,
    temperature: cfg.temperature,
    max_tokens: cfg.maxTokens
  };

  const url = `https://${resource}.openai.azure.com/openai/deployments/${deployment}/chat/completions?api-version=${apiVersion}`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'api-key': key, 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  const data = await resp.json();
  if (!resp.ok) throw new Error(data?.error?.message || `Azure HTTP ${resp.status}`);

  const msg = data.choices?.[0]?.message;
  const text = msg?.content || '';
  if (!text.trim()) throw new Error("Azure bo'sh javob qaytardi");

  return { text, thinking: msg?.reasoning_content || null, backend: `azure:${deployment}` };
}

const PROVIDERS = {
  groq: callGroq,
  gemini: callGemini,
  deepseek: callDeepSeek,
  openrouter: callOpenRouter,
  cloudflare: callCloudflare,
  azure: callAzure
};

// Provayder testi uchun model tanlovi
const TEST_MODELS = {
  groq: 'llama-3.3-70b-versatile',
  gemini: 'gemini-2.0-flash',
  deepseek: 'deepseek-chat',
  openrouter: 'deepseek/deepseek-chat-v3-0324',
  cloudflare: '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
  azure: 'gpt-4o'
};

// ───────────────────────────────────────────────────────────────────────────
// HANDLER
// ───────────────────────────────────────────────────────────────────────────
exports.handler = async function (event) {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' };

  // Sog'liq tekshiruvi — sozlamalar to'g'rimi, brauzerdan ochib ko'rish mumkin
  if (event.httpMethod === 'GET') {
    // Provayder jonli testi: /.netlify/functions/ai?test=groq
    const testProvider = (event.queryStringParameters || {}).test;
    if (testProvider) {
      const fn = PROVIDERS[testProvider];
      if (!fn) return json(400, { error: `Noma'lum provayder: ${testProvider}` });
      if (!hasKeyFor(testProvider)) {
        return json(200, { ok: false, configured: false, error: 'kalit sozlanmagan' });
      }
      const spec = {
        model: TEST_MODELS[testProvider] || 'llama-3.3-70b-versatile',
        deployment: keys.get('AZURE_OPENAI_DEPLOYMENT')
      };
      try {
        const t0 = Date.now();
        const r = await fn(spec, [
          { role: 'system', content: 'Javobingizni eng ko\'pi bilan 3 so\'z bilan bering.' },
          { role: 'user', content: '1+1 nechchi?' }
        ], { temperature: 0, maxTokens: 64 });
        return json(200, { ok: true, configured: true, backend: r.backend, ms: Date.now() - t0, reply: r.text.slice(0, 120) });
      } catch (e) {
        return json(200, { ok: false, configured: true, error: e.message });
      }
    }

    return json(200, {
      ok: true,
      models: Object.keys(REGISTRY),
      providers: {
        groq:       { configured: hasKeyFor('groq') },
        gemini:     { configured: hasKeyFor('gemini'), keyCount: geminiKeys().length },
        deepseek:   { configured: hasKeyFor('deepseek') },
        openrouter: { configured: hasKeyFor('openrouter') },
        cloudflare: { configured: hasKeyFor('cloudflare') },
        azure:      { configured: hasKeyFor('azure') }
      }
    });
  }

  if (event.httpMethod !== 'POST') {
    return json(405, { error: 'Method Not Allowed' });
  }

  // ── TEZLIK CHEKLOVI (IP bo'yicha) ───────────────────────────────────────
  // Bu endpoint hali Firebase ID-token talab qilmaydi (juda ko'p sahifa uni
  // shunday chaqiradi), shuning uchun eng muhim himoya — bitta IP daqiqasiga
  // cheksiz AI so'rov yubora olmasin (aks holda provayder balansi bir necha
  // daqiqada tugab qolishi mumkin).
  const rl = await ratelimit.checkRateLimit(`ai:${ratelimit.clientIp(event)}`, { windowMs: 60_000, max: 20 });
  if (!rl.ok) {
    return json(429, { error: "Juda ko'p so'rov yuborildi. Biroz kuting va qayta urinib ko'ring.", retryAfterMs: rl.retryAfterMs });
  }

  let payload;
  try { payload = JSON.parse(event.body || '{}'); }
  catch { return json(400, { error: "Noto'g'ri JSON" }); }

  // ── ESKI FORMATNI QO'LLAB-QUVVATLASH ──────────────────────────────────
  // Til sahifalari Gemini shaklida yuboradi: { contents:[{role,parts:[{text}]}] }
  // Ularni tahrirlash o'rniga shu yerda o'giramiz — javob ham o'sha shaklda
  // qaytariladi, shuning uchun chaqiruv joylari o'zgarmaydi.
  const isLegacy = Array.isArray(payload.contents);

  if (isLegacy) {
    payload.messages = payload.contents.map(c => ({
      role: c.role === 'model' ? 'assistant' : 'user',
      content: (c.parts || []).map(p => p.text || '').join('\n')
    })).filter(m => m.content.trim());

    const gc = payload.generationConfig || {};
    if (gc.temperature != null) payload.temperature = gc.temperature;
    if (gc.maxOutputTokens != null) payload.maxTokens = gc.maxOutputTokens;
  }

  const modelId = String(payload.model || 'nova').toLowerCase();
  const entry = REGISTRY[modelId];
  if (!entry) return json(400, { error: `Noma'lum model: ${modelId}` });

  const messages = Array.isArray(payload.messages) ? payload.messages : [];
  if (!messages.length) return json(400, { error: "Xabarlar yo'q" });

  // Suhbat tarixini cheklaymiz — juda uzun kontekst sekin va qimmat
  const system = messages.filter(m => m.role === 'system');
  const turns = messages.filter(m => m.role !== 'system').slice(-24);
  const finalMessages = [...system, ...turns];

  const cfg = {
    temperature: clamp(payload.temperature ?? entry.temperature, 0, 2),
    maxTokens: clamp(payload.maxTokens ?? entry.maxTokens, 64, 8192)
  };

  const errors = [];
  let quotaHit = false;

  // Model zanjiri + oxirida GROQ ZAHIRASI. Takrorlanadiganlarni olib tashlaymiz.
  const seen = new Set();
  const chain = [...entry.chain, ...GROQ_RESERVE].filter(s => {
    const k = s.provider + ':' + s.model;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  for (let i = 0; i < chain.length; i++) {
    const spec = chain[i];
    const fn = PROVIDERS[spec.provider];
    if (!fn) continue;

    // Kalit sozlanmagan bo'lsa bu bo'g'inni o'tkazib yuboramiz
    if (!hasKeyFor(spec.provider)) {
      errors.push(`${spec.provider}:${spec.model} — kalit sozlanmagan`);
      continue;
    }

    try {
      const result = await withTimeout(fn(spec, finalMessages, cfg), PER_CALL_TIMEOUT_MS, `${spec.provider}:${spec.model}`);
      const isReserve = i >= entry.chain.length;

      if (isReserve) {
        console.warn(`[ai] ${modelId}: ZAHIRA ishlatildi (${result.backend}). Sabab: ${errors.join(' | ')}`);
      }

      // Eski format bilan so'ralgan bo'lsa — o'sha shaklda qaytaramiz
      if (isLegacy) {
        return json(200, {
          candidates: [{ content: { parts: [{ text: result.text }] } }],
          model: modelId,
          backend: result.backend,
          reserve: isReserve
        });
      }

      return json(200, {
        text: result.text,
        thinking: result.thinking,
        model: modelId,
        modelName: entry.label,
        backend: result.backend,
        fallbackDepth: i,
        reserve: isReserve
      });

    } catch (e) {
      const msg = `${spec.provider}:${spec.model} — ${e.message}`;
      errors.push(msg);
      if (isQuotaError(e.message)) {
        quotaHit = true;
        console.warn("[ai] kvota tugadi, keyingisiga o'tamiz:", msg);
      } else {
        console.error("[ai] bo'g'in ishlamadi:", msg);
      }
    }
  }

  console.error('[ai] butun zanjir + zahira ishlamadi:', errors.join(' | '));
  return json(502, {
    error: quotaHit
      ? "AI xizmatining kunlik kvotasi tugadi. Bir ozdan keyin urinib ko'ring."
      : "AI hozir javob bera olmayapti. Bir ozdan keyin urinib ko'ring.",
    quotaExhausted: quotaHit,
    detail: errors
  });
};

// Har bir provayder urinishi uchun maksimal kutish vaqti. Netlify Functions
// standart taymauti (~10-26s, tarifga qarab) bor — bitta bo'g'in osilib
// qolsa (tarmoq muammosi, provayder javob bermay qolishi) butun zanjir
// funksiya taymautigacha to'xtab, foydalanuvchi hatto xato xabarini ham
// olmasligi mumkin. Shu sabab har bir urinish alohida chegaralanadi.
const PER_CALL_TIMEOUT_MS = 8000;

function withTimeout(promise, ms, label) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label}: timeout (${ms}ms)`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

function clamp(n, lo, hi) {
  const v = Number(n);
  return Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : lo;
}

function json(statusCode, body) {
  return {
    statusCode,
    headers: { ...CORS, 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  };
}

// Boshqa funksiyalar (masalan groq.js) uchun ochiq qilib beriladi — shu orqali
// eski/qisqa endpointlar ham xuddi shu ko'p-provayderli zanjirdan foydalana oladi,
// kodni takrorlamasdan.
module.exports.PROVIDERS = PROVIDERS;
module.exports.hasKeyFor = hasKeyFor;
module.exports.isQuotaError = isQuotaError;
