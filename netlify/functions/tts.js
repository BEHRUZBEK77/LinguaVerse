// ═══════════════════════════════════════════════════════════
// TTS PROXY — matnni ovozga o'girish
// O'zbekcha: Azure Speech (uz-UZ-SardorNeural — haqiqiy o'zbek ovozi!)
// Boshqa tillar: Google Cloud TTS
// Kalitlar faqat serverda: AZURE_SPEECH_KEY/AZURE_SPEECH_REGION, GOOGLE_TTS_KEYS
// ═══════════════════════════════════════════════════════════

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

// Azure'da mavjud, biz ishlatadigan ovozlar (limitni asrash uchun faqat o'zbekcha)
const AZURE_VOICES = {
  'uz-UZ': 'uz-UZ-SardorNeural'
};

function xmlEscape(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

let lastAzureError = null;
async function azureTTS(text, lang, rate) {
  const key = process.env.AZURE_SPEECH_KEY;
  const region = (process.env.AZURE_SPEECH_REGION || 'eastus').trim().toLowerCase().replace(/\s+/g, '');
  const voice = AZURE_VOICES[lang];
  if (!key) { lastAzureError = 'AZURE_SPEECH_KEY not set'; return null; }
  if (!voice) { lastAzureError = 'no azure voice for ' + lang; return null; }

  // speakingRate (0.65..1) → prosody foizi (-35%..0%)
  const pct = Math.round((rate - 1) * 100);
  const ssml = `<speak version='1.0' xml:lang='${lang}'><voice name='${voice}'><prosody rate='${pct}%'>${xmlEscape(text)}</prosody></voice></speak>`;

  try {
    const resp = await fetch(`https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`, {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': key.trim(),
        'Content-Type': 'application/ssml+xml',
        'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3'
      },
      body: ssml
    });
    if (!resp.ok) {
      lastAzureError = `HTTP ${resp.status}: ${(await resp.text().catch(() => '')).slice(0, 200)}`;
      console.error('Azure TTS failed:', lastAzureError);
      return null;
    }
    const buf = Buffer.from(await resp.arrayBuffer());
    if (!buf.length) { lastAzureError = 'empty audio'; return null; }
    lastAzureError = null;
    return buf.toString('base64');
  } catch (e) {
    lastAzureError = e.message;
    console.error('Azure TTS error:', e.message);
    return null;
  }
}

async function googleTTS(body) {
  if (!process.env.GOOGLE_TTS_KEYS) return null;
  const TTS_KEYS = process.env.GOOGLE_TTS_KEYS.split(',').map(k => k.trim()).filter(Boolean);
  if (!TTS_KEYS.length) return null;
  const key = TTS_KEYS[Math.floor(Math.random() * TTS_KEYS.length)];
  const resp = await fetch(`https://texttospeech.googleapis.com/v1/text:synthesize?key=${key}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const data = await resp.json();
  if (!resp.ok || !data.audioContent) {
    console.error('Google TTS failed:', data?.error?.message || resp.status);
    return null;
  }
  return data.audioContent;
}

exports.handler = async function (event) {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' };

  // Diagnostika: brauzerda ochib tekshirish mumkin
  //   /.netlify/functions/tts            → sozlamalar holati
  //   /.netlify/functions/tts?test=uz    → Azure'ga jonli test so'rov
  if (event.httpMethod === 'GET') {
    const region = (process.env.AZURE_SPEECH_REGION || '(not set)');
    const status = {
      ok: true,
      azure: { keySet: !!process.env.AZURE_SPEECH_KEY, region },
      google: { keySet: !!process.env.GOOGLE_TTS_KEYS }
    };
    if (event.queryStringParameters?.test === 'uz') {
      const audio = await azureTTS("Salom! Men Sardor. O'zbekcha ovoz ishlayapti!", 'uz-UZ', 0.95);
      status.azureTest = audio ? 'SUCCESS ✅ (' + Math.round(audio.length * 0.75 / 1024) + ' KB audio)' : 'FAILED ❌';
      if (!audio) status.azureError = lastAzureError;
    }
    return {
      statusCode: 200,
      headers: { ...CORS, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
      body: JSON.stringify(status, null, 2)
    };
  }

  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: CORS, body: 'Method Not Allowed' };

  try {
    const body = JSON.parse(event.body || '{}');
    const text = body.input?.text || '';
    const lang = body.voice?.languageCode || 'en-US';
    const rate = body.audioConfig?.speakingRate ?? 0.95;
    if (!text) return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'No text' }) };

    // 1) Azure — o'zbekcha uchun haqiqiy neyro-ovoz
    let audioContent = await azureTTS(text, lang, rate);
    let provider = 'azure';

    // 2) Google — qolgan barcha tillar (yoki Azure ishlamasa)
    if (!audioContent) {
      audioContent = await googleTTS(body);
      provider = 'google';
    }

    if (audioContent) {
      return {
        statusCode: 200,
        headers: { ...CORS, 'Content-Type': 'application/json' },
        body: JSON.stringify({ audioContent, provider })
      };
    }
    return { statusCode: 502, headers: CORS, body: JSON.stringify({ error: 'TTS unavailable' }) };
  } catch (error) {
    console.error('TTS proxy error:', error.message);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: 'TTS failed' }) };
  }
};
