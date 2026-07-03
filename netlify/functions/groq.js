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

  let lastErr = null;
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
      if (!resp.ok) { lastErr = data?.error?.message || `HTTP ${resp.status}`; continue; }
      const text = data.choices?.[0]?.message?.content || '';

      // Klient qaysi formatda so'ragan bo'lsa, o'sha formatda qaytaramiz
      const body = isGeminiFormat
        ? { candidates: [{ content: { parts: [{ text }] } }], model }
        : { ...data, model };
      return { statusCode: 200, headers: { ...CORS, 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
    } catch (e) { lastErr = e.message; }
  }

  // Ichki xatolik tafsilotlarini klientga oshkor qilmaymiz
  console.error('Groq proxy error:', lastErr);
  return { statusCode: 502, headers: CORS, body: JSON.stringify({ error: 'AI service unavailable' }) };
};
