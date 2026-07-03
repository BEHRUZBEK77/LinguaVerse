// ═══════════════════════════════════════════════════════════
// GROQ WHISPER STT — nutqni matnga o'girish (whisper-large-v3)
// Klient base64 audio yuboradi: { audio: "data:audio/webm;base64,...", language: "en" }
// ═══════════════════════════════════════════════════════════

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

exports.handler = async function (event) {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: CORS, body: 'Method Not Allowed' };

  if (!process.env.GROQ_API_KEY) {
    console.error('GROQ_API_KEY is not set');
    return { statusCode: 502, headers: CORS, body: JSON.stringify({ error: 'STT unavailable', detail: 'missing_api_key' }) };
  }

  try {
    const { audio, language } = JSON.parse(event.body || '{}');
    if (!audio) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'No audio' }) };

    const m = audio.match(/^data:(audio\/[\w.+-]+);base64,(.+)$/s);
    if (!m) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Bad audio format' }) };
    const mime = m[1];
    const buf = Buffer.from(m[2], 'base64');
    if (buf.length > 8 * 1024 * 1024) return { statusCode: 413, headers: CORS, body: JSON.stringify({ error: 'Audio too large' }) };

    const ext = mime.includes('webm') ? 'webm' : mime.includes('ogg') ? 'ogg' : mime.includes('wav') ? 'wav' : 'mp4';
    const form = new FormData();
    form.append('file', new Blob([buf], { type: mime }), `audio.${ext}`);
    form.append('model', 'whisper-large-v3');
    if (language) form.append('language', language);
    form.append('response_format', 'json');
    form.append('temperature', '0');

    const resp = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${process.env.GROQ_API_KEY}` },
      body: form
    });
    const data = await resp.json();
    if (!resp.ok) {
      console.error('Whisper error:', data);
      return { statusCode: 502, headers: CORS, body: JSON.stringify({ error: 'STT unavailable' }) };
    }
    return {
      statusCode: 200,
      headers: { ...CORS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: data.text || '' })
    };
  } catch (e) {
    console.error('Whisper proxy error:', e.message);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: 'STT failed' }) };
  }
};
