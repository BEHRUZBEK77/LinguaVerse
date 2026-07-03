// ═══════════════════════════════════════════════════════════
// GROQ AI PROXY — eng kuchli modellar, fallback zanjiri bilan
// API kalit faqat serverda (GROQ_API_KEY). Klientga hech qachon chiqmaydi.
// Gemini-format ({contents}) va OpenAI-format ({messages}) ikkalasini qabul qiladi.
// ═══════════════════════════════════════════════════════════

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

// Eng og'ir → yengilroq fallback zanjiri (Groq'dagi eng zo'r modellar)
const MODEL_CHAIN = [
  'moonshotai/kimi-k2-instruct-0905',
  'openai/gpt-oss-120b',
  'llama-3.3-70b-versatile',
  'meta-llama/llama-4-maverick-17b-128e-instruct'
];

// GROQ_API_KEY yo'q bo'lsa yoki Groq ishlamasa — eski ishlaydigan worker zaxira
const LEGACY_WORKER = 'https://gentle-hat-d9fa.akromovbehruz7.workers.dev';

async function callLegacyWorker(messages, temperature, max_tokens) {
  // OpenAI messages → Gemini contents formatiga o'giramiz
  const sys = messages.filter(m => m.role === 'system').map(m => m.content).join('\n');
  const contents = [];
  if (sys) contents.push({ role: 'user', parts: [{ text: sys }] });
  for (const m of messages) {
    if (m.role === 'system') continue;
    contents.push({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] });
  }
  const resp = await fetch(LEGACY_WORKER, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents, generationConfig: { temperature, maxOutputTokens: max_tokens } })
  });
  if (!resp.ok) throw new Error(`worker ${resp.status}`);
  const d = await resp.json();
  const text = d.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('worker empty response');
  return text;
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

  let payload;
  try { payload = JSON.parse(event.body || '{}'); }
  catch { return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Invalid JSON' }) }; }

  const isGeminiFormat = Array.isArray(payload.contents);
  let messages = isGeminiFormat ? geminiToMessages(payload.contents) : (payload.messages || []);
  if (!messages.length) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'No messages' }) };

  const gc = payload.generationConfig || {};
  const temperature = payload.temperature ?? gc.temperature ?? 0.7;
  const max_tokens = Math.min(payload.max_tokens ?? gc.maxOutputTokens ?? 2000, 8000);

  const respond = (text, model) => {
    const body = isGeminiFormat
      ? { candidates: [{ content: { parts: [{ text }] } }], model }
      : { choices: [{ message: { role: 'assistant', content: text } }], model };
    return { statusCode: 200, headers: { ...CORS, 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
  };

  let lastErr = null;
  const hasKey = !!process.env.GROQ_API_KEY;

  if (hasKey) {
    for (const model of MODEL_CHAIN) {
      try {
        const resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ model, messages, temperature, max_tokens })
        });
        const data = await resp.json();
        if (!resp.ok) {
          lastErr = `${model}: ${data?.error?.message || 'HTTP ' + resp.status}`;
          console.error('Groq model failed:', lastErr);
          continue;
        }
        return respond(data.choices?.[0]?.message?.content || '', model);
      } catch (e) { lastErr = `${model}: ${e.message}`; console.error('Groq fetch error:', lastErr); }
    }
  } else {
    lastErr = 'GROQ_API_KEY is not set in Netlify environment variables';
    console.error(lastErr);
  }

  // Groq ishlamadi — eski worker orqali javob berishga urinamiz (sayt to'xtamasin)
  try {
    const text = await callLegacyWorker(messages, temperature, max_tokens);
    return respond(text, 'legacy-worker');
  } catch (e) {
    console.error('Legacy worker also failed:', e.message);
  }

  return {
    statusCode: 502,
    headers: { ...CORS, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      error: 'AI service unavailable',
      detail: hasKey ? 'upstream_failed' : 'missing_api_key'
    })
  };
};
