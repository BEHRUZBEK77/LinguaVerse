// ═══════════════════════════════════════════════════════════════════════════
// azure-speech.js — AZURE SPEECH to'liq integratsiya
//
// 3 ta vazifa:
//   GET  ?action=token          → brauzer SDK uchun qisqa muddatli token
//   POST { action:'tts' }       → neural ovoz (13 til)
//   POST { action:'assess' }    → nutqni matnga + TALAFFUZ BAHOSI
//
// KALIT — faqat Netlify Environment Variables'da:
//   AZURE_SPEECH_KEY    = ...
//   AZURE_SPEECH_REGION = eastus
//
// DIQQAT: kalitni bu faylga YOZMANG.
// ═══════════════════════════════════════════════════════════════════════════

const keys = require('./_keys.js');
const ratelimit = require('./_ratelimit.js');

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS'
};

const KEY = () => (keys.get('AZURE_SPEECH_KEY') || '').trim();
const REGION = () => (keys.get('AZURE_SPEECH_REGION') || 'eastus').trim().toLowerCase().replace(/\s+/g, '');

// ───────────────────────────────────────────────────────────────────────────
// OVOZLAR — har til uchun tanlangan eng tabiiy neural ovozlar
// O'ZBEKCHA: haqiqiy uz-UZ ovozlari (transliteratsiya hiylasi kerak emas)
// ───────────────────────────────────────────────────────────────────────────
const VOICES = {
  'en-US': { female: 'en-US-AvaMultilingualNeural',  male: 'en-US-AndrewMultilingualNeural' },
  'en-GB': { female: 'en-GB-SoniaNeural',            male: 'en-GB-RyanNeural' },
  'ru-RU': { female: 'ru-RU-SvetlanaNeural',         male: 'ru-RU-DmitryNeural' },
  'es-ES': { female: 'es-ES-ElviraNeural',           male: 'es-ES-AlvaroNeural' },
  'de-DE': { female: 'de-DE-KatjaNeural',            male: 'de-DE-ConradNeural' },
  'tr-TR': { female: 'tr-TR-EmelNeural',             male: 'tr-TR-AhmetNeural' },
  'ar-SA': { female: 'ar-SA-ZariyahNeural',          male: 'ar-SA-HamedNeural' },
  'ko-KR': { female: 'ko-KR-SunHiNeural',            male: 'ko-KR-InJoonNeural' },
  'zh-CN': { female: 'zh-CN-XiaoxiaoNeural',         male: 'zh-CN-YunxiNeural' },
  'fr-FR': { female: 'fr-FR-DeniseNeural',           male: 'fr-FR-HenriNeural' },
  'ja-JP': { female: 'ja-JP-NanamiNeural',           male: 'ja-JP-KeitaNeural' },
  'it-IT': { female: 'it-IT-ElsaNeural',             male: 'it-IT-DiegoNeural' },
  'uz-UZ': { female: 'uz-UZ-MadinaNeural',           male: 'uz-UZ-SardorNeural' }
};

// Ba'zi ovozlar his-tuyg'u uslublarini qo'llab-quvvatlaydi
const STYLE_CAPABLE = new Set([
  'en-US-AvaMultilingualNeural', 'en-US-AndrewMultilingualNeural',
  'zh-CN-XiaoxiaoNeural', 'zh-CN-YunxiNeural'
]);

function pickVoice(lang, prefer) {
  if (prefer && /^[a-z]{2}-[A-Z]{2}-/.test(prefer)) return prefer;   // to'liq ovoz nomi
  const set = VOICES[lang] || VOICES[normalizeLang(lang)] || VOICES['en-US'];
  return (prefer === 'male' ? set.male : set.female);
}

function normalizeLang(lang) {
  if (!lang) return 'en-US';
  if (VOICES[lang]) return lang;

  const short = lang.split('-')[0].toLowerCase();

  // Sahifalar qisqa kod ('uz') yoki Google uslubidagi kod ('cmn-CN', 'ar-XA')
  // yuborishi mumkin — ularni to'g'ri Azure lokaliga o'giramiz
  const ALIAS = {
    uz: 'uz-UZ', en: 'en-US', ru: 'ru-RU', es: 'es-ES', de: 'de-DE',
    tr: 'tr-TR', ar: 'ar-SA', ko: 'ko-KR', zh: 'zh-CN', cmn: 'zh-CN',
    fr: 'fr-FR', ja: 'ja-JP', it: 'it-IT'
  };
  if (ALIAS[short]) return ALIAS[short];

  const found = Object.keys(VOICES).find(k => k.toLowerCase().startsWith(short + '-'));
  return found || 'en-US';
}

// ───────────────────────────────────────────────────────────────────────────
// TILGA XOS SOZLAMALAR
//
// O'zbek ovozi biroz sekinroq gapirganda ancha tabiiy va tushunarli chiqadi —
// o'quvchi har bir tovushni ilg'ab oladi. Arab va xitoy ham shunday.
// ───────────────────────────────────────────────────────────────────────────
const LANG_TUNING = {
  'uz-UZ': { rate: -6, pitch: 0 },
  'ar-SA': { rate: -5, pitch: 0 },
  'zh-CN': { rate: -5, pitch: 0 },
  'ko-KR': { rate: -3, pitch: 0 },
  'ja-JP': { rate: -3, pitch: 0 }
};

function xmlEscape(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

// ───────────────────────────────────────────────────────────────────────────
// 1) TOKEN — brauzerdagi Speech SDK uchun
//    Kalit o'rniga 10 daqiqalik token beramiz. Kalit klientga chiqmaydi.
// ───────────────────────────────────────────────────────────────────────────
async function issueToken() {
  const key = KEY();
  if (!key) throw new Error('AZURE_SPEECH_KEY sozlanmagan');

  const resp = await fetch(`https://${REGION()}.api.cognitive.microsoft.com/sts/v1.0/issueToken`, {
    method: 'POST',
    headers: { 'Ocp-Apim-Subscription-Key': key, 'Content-Length': '0' }
  });

  if (!resp.ok) {
    const detail = await resp.text().catch(() => '');
    throw new Error(`Token olinmadi (HTTP ${resp.status}) ${detail.slice(0, 160)}`);
  }

  return { token: await resp.text(), region: REGION(), expiresIn: 540 };
}

// ───────────────────────────────────────────────────────────────────────────
// 2) TTS — neural ovoz
// ───────────────────────────────────────────────────────────────────────────
async function synthesize({ text, lang, voice, rate, pitch, style }) {
  const key = KEY();
  if (!key) throw new Error('AZURE_SPEECH_KEY sozlanmagan');
  if (!text || !text.trim()) throw new Error("Matn bo'sh");
  if (text.length > 3000) text = text.slice(0, 3000);

  const locale = normalizeLang(lang);
  const voiceName = pickVoice(locale, voice);

  // rate: 0.5..1.5 → prosody foizi, ustiga tilga xos sozlama qo'shiladi
  const tune = LANG_TUNING[locale] || { rate: 0, pitch: 0 };
  const ratePct = Math.round(((Number(rate) || 1) - 1) * 100) + tune.rate;
  const pitchPct = Math.round(Number(pitch) || 0) + tune.pitch;

  let inner = `<prosody rate='${ratePct >= 0 ? '+' : ''}${ratePct}%' pitch='${pitchPct >= 0 ? '+' : ''}${pitchPct}%'>${xmlEscape(text)}</prosody>`;
  if (style && STYLE_CAPABLE.has(voiceName)) {
    inner = `<mstts:express-as style='${xmlEscape(style)}'>${inner}</mstts:express-as>`;
  }

  const ssml =
    `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' ` +
    `xmlns:mstts='http://www.w3.org/2001/mstts' xml:lang='${locale}'>` +
    `<voice name='${voiceName}'>${inner}</voice></speak>`;

  const resp = await fetch(`https://${REGION()}.tts.speech.microsoft.com/cognitiveservices/v1`, {
    method: 'POST',
    headers: {
      'Ocp-Apim-Subscription-Key': key,
      'Content-Type': 'application/ssml+xml',
      'X-Microsoft-OutputFormat': 'audio-24khz-96kbitrate-mono-mp3',
      'User-Agent': 'LinguaVerse'
    },
    body: ssml
  });

  if (!resp.ok) {
    const detail = await resp.text().catch(() => '');
    throw new Error(`Azure TTS HTTP ${resp.status}: ${detail.slice(0, 200)}`);
  }

  const buf = Buffer.from(await resp.arrayBuffer());
  if (!buf.length) throw new Error("Azure bo'sh audio qaytardi");

  return { audio: buf.toString('base64'), mime: 'audio/mpeg', voice: voiceName, lang: locale };
}

// ───────────────────────────────────────────────────────────────────────────
// 3) TALAFFUZ BAHOSI — bu Azure'ning eng qimmatli imkoniyati
//    Har bir so'z va tovush uchun ball beradi.
// ───────────────────────────────────────────────────────────────────────────
async function assess({ audio, lang, referenceText }) {
  const key = KEY();
  if (!key) throw new Error('AZURE_SPEECH_KEY sozlanmagan');
  if (!audio) throw new Error("Audio yo'q");

  const m = String(audio).match(/^data:(audio\/[\w.+-]+);base64,(.+)$/s);
  if (!m) throw new Error("Audio formati noto'g'ri (data URI kutilgan)");

  const mime = m[1];
  const buf = Buffer.from(m[2], 'base64');
  if (!buf.length) throw new Error("Audio bo'sh");
  if (buf.length > 10 * 1024 * 1024) throw new Error('Audio juda katta (max 10MB)');

  const locale = normalizeLang(lang);

  // Azure qisqa audio REST faqat WAV/PCM yoki OGG-OPUS qabul qiladi.
  // Klient (js/lv-speech.js) doim 16kHz mono WAV yuboradi.
  let contentType;
  if (mime.includes('wav')) contentType = 'audio/wav; codecs=audio/pcm; samplerate=16000';
  else if (mime.includes('ogg')) contentType = 'audio/ogg; codecs=opus';
  else throw new Error(`Qo'llab-quvvatlanmaydigan format: ${mime}. WAV yoki OGG/Opus yuboring.`);

  const config = {
    GradingSystem: 'HundredMark',
    Granularity: 'Phoneme',
    Dimension: 'Comprehensive',
    EnableMiscue: !!referenceText,        // faqat matn berilganda mantiqiy
    EnableProsodyAssessment: true
  };
  if (referenceText) config.ReferenceText = referenceText;

  const url = `https://${REGION()}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1` +
              `?language=${encodeURIComponent(locale)}&format=detailed`;

  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Ocp-Apim-Subscription-Key': key,
      'Content-Type': contentType,
      'Accept': 'application/json',
      'Pronunciation-Assessment': Buffer.from(JSON.stringify(config)).toString('base64')
    },
    body: buf
  });

  if (!resp.ok) {
    const detail = await resp.text().catch(() => '');
    throw new Error(`Azure STT HTTP ${resp.status}: ${detail.slice(0, 200)}`);
  }

  const data = await resp.json();

  if (data.RecognitionStatus === 'NoMatch' || data.RecognitionStatus === 'InitialSilenceTimeout') {
    return { text: '', empty: true, message: 'Ovoz eshitilmadi. Balandroq va aniqroq gapiring.' };
  }
  if (data.RecognitionStatus !== 'Success') {
    throw new Error(`Tanib bo'lmadi: ${data.RecognitionStatus}`);
  }

  const best = (data.NBest || [])[0] || {};
  const pa = best.PronunciationAssessment || {};

  // So'z darajasidagi tafsilot — qaysi so'z qayerda oqsayotganini ko'rsatish
  const words = (best.Words || []).map(w => {
    const wa = w.PronunciationAssessment || {};
    return {
      word: w.Word,
      score: round(wa.AccuracyScore),
      errorType: wa.ErrorType && wa.ErrorType !== 'None' ? wa.ErrorType : null,
      phonemes: (w.Phonemes || []).map(p => ({
        phoneme: p.Phoneme,
        score: round(p.PronunciationAssessment?.AccuracyScore)
      }))
    };
  });

  const scores = {
    accuracy: round(pa.AccuracyScore),
    fluency: round(pa.FluencyScore),
    completeness: round(pa.CompletenessScore),
    prosody: round(pa.ProsodyScore),
    overall: round(pa.PronScore)
  };

  return {
    text: best.Display || data.DisplayText || '',
    lang: locale,
    scores,
    words,
    weakWords: words.filter(w => w.score !== null && w.score < 70).map(w => w.word),
    feedback: buildFeedback(scores, words)
  };
}

function round(n) {
  return typeof n === 'number' ? Math.round(n * 10) / 10 : null;
}

/** Ballardan o'zbekcha tushunarli xulosa. */
function buildFeedback(s, words) {
  const out = [];
  const overall = s.overall ?? s.accuracy;
  if (overall === null) return out;

  if (overall >= 90) out.push({ type: 'good', text: "Talaffuzingiz a'lo darajada. Ona tilida so'zlashuvchiga juda yaqin." });
  else if (overall >= 75) out.push({ type: 'good', text: 'Yaxshi talaffuz. Ayrim tovushlarni sayqallash kerak.' });
  else if (overall >= 60) out.push({ type: 'warn', text: 'Tushunarli, lekin talaffuz ustida ishlash kerak.' });
  else out.push({ type: 'bad', text: 'Talaffuz qiyin tushuniladi. Sekinroq va aniqroq gapirib mashq qiling.' });

  if (s.fluency !== null && s.fluency < 65) {
    out.push({ type: 'warn', text: "Ravonlik past — gap orasida ko'p to'xtayapsiz. Butun jumlani oldin o'ylab, keyin bir tekis ayting." });
  }
  if (s.completeness !== null && s.completeness < 70) {
    out.push({ type: 'warn', text: "Ba'zi so'zlarni tushirib qoldirdingiz. Jumlani to'liq ayting." });
  }
  if (s.prosody !== null && s.prosody < 65) {
    out.push({ type: 'warn', text: "Ohang va urg'u tabiiy emas. Ona tilida so'zlashuvchini tinglab, ohangini takrorlang." });
  }

  const weak = words.filter(w => w.score !== null && w.score < 60);
  if (weak.length) {
    out.push({
      type: 'focus',
      text: `Shu so'zlarni alohida mashq qiling: ${weak.slice(0, 5).map(w => w.word).join(', ')}`
    });
  }

  return out;
}

// ───────────────────────────────────────────────────────────────────────────
// HANDLER
// ───────────────────────────────────────────────────────────────────────────
exports.handler = async function (event) {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' };

  const q = event.queryStringParameters || {};

  if (event.httpMethod === 'GET') {
    if (q.action === 'token') {
      try {
        return json(200, await issueToken(), { 'Cache-Control': 'no-store' });
      } catch (e) {
        console.error('[azure-speech] token:', e.message);
        return json(502, { error: e.message });
      }
    }

    if (q.action === 'voices') return json(200, { voices: VOICES });

    // Sozlamalarni tekshirish: /.netlify/functions/azure-speech?test=1
    const status = {
      ok: true,
      keyConfigured: !!KEY(),
      region: keys.get('AZURE_SPEECH_REGION') || '(sozlanmagan, eastus ishlatiladi)',
      languages: Object.keys(VOICES)
    };
    if (q.test) {
      try {
        const r = await synthesize({ text: 'Salom! Azure ovozi ishlayapti.', lang: 'uz-UZ', rate: 1 });
        status.ttsTest = `✅ ISHLADI (${Math.round(r.audio.length * 0.75 / 1024)} KB, ${r.voice})`;
      } catch (e) { status.ttsTest = `❌ XATO: ${e.message}`; }
      try {
        await issueToken();
        status.tokenTest = '✅ ISHLADI';
      } catch (e) { status.tokenTest = `❌ XATO: ${e.message}`; }
    }
    return json(200, status, { 'Cache-Control': 'no-store' });
  }

  if (event.httpMethod !== 'POST') return json(405, { error: 'Method Not Allowed' });

  // Nutq baholash (assess) va TTS pullik/og'ir amallar — IP bo'yicha
  // tezlik chekloviga olindi.
  const rl = await ratelimit.checkRateLimit(`azure-speech:${ratelimit.clientIp(event)}`, { windowMs: 60_000, max: 25 });
  if (!rl.ok) {
    return json(429, { error: "Juda ko'p so'rov. Biroz kuting." });
  }

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return json(400, { error: "Noto'g'ri JSON" }); }

  try {
    switch (body.action) {
      case 'tts':    return json(200, await synthesize(body));
      case 'assess': return json(200, await assess(body));
      case 'token':  return json(200, await issueToken(), { 'Cache-Control': 'no-store' });
      default:       return json(400, { error: `Noma'lum action: ${body.action}` });
    }
  } catch (e) {
    console.error(`[azure-speech] ${body.action}:`, e.message);
    return json(502, { error: e.message });
  }
};

function json(statusCode, body, extra = {}) {
  return {
    statusCode,
    headers: { ...CORS, 'Content-Type': 'application/json', ...extra },
    body: JSON.stringify(body)
  };
}
