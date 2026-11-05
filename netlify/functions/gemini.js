const learningLanguage = require('../../js/learning-language.js');
const keys = require('./_keys.js');
const ratelimit = require('./_ratelimit.js');

exports.handler = async function(event, context) {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      },
      body: ''
    };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }
  await keys.refreshFromFirestore();

  // Diqqat: hech qanday client-side chaqiruv topilmadi — bu endpoint
  // ilova ichida ishlatilmayotganga o'xshaydi (ai.js uni almashtirgan).
  // Baribir ochiq va pullik Gemini kalitiga ulanadigan bo'lgani uchun
  // tezlik chekloviga olindi. Agar rostdan ishlatilmasa, faylni butunlay
  // o'chirish xavfsizlik nuqtai nazaridan yanada yaxshiroq.
  const rl = await ratelimit.checkRateLimit(`gemini:${ratelimit.clientIp(event)}`, { windowMs: 60_000, max: 15 });
  if (!rl.ok) {
    return {
      statusCode: rl.unavailable ? 503 : 429,
      headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: rl.unavailable ? 'Xizmat vaqtincha mavjud emas.' : "Juda ko'p so'rov. Biroz kuting." })
    };
  }

  try {
    const body = JSON.parse(event.body);
    const model = body.model || 'gemini-2.0-flash';
    const payload = { ...(body.payload || body) };
    delete payload.model; delete payload.nativeLang; delete payload.targetLang;
    if (body.nativeLang) payload.systemInstruction = {parts:[...(payload.systemInstruction?.parts || []),{text:learningLanguage.instruction(body.nativeLang,body.targetLang)}]};
    
    const geminiKey = (keys.get('GEMINI_API_KEYS') || keys.get('GEMINI_API_KEY') || '').split(',').map(key => key.trim()).find(Boolean);
    if (!geminiKey) throw new Error('GEMINI_API_KEYS sozlanmagan');
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    return {
      statusCode: response.status,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: error.message })
    };
  }
};
