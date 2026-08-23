// ═══════════════════════════════════════════════════════════════════════════
// admin-keys.js — API KALITLARINI BOSHQARISH (admin panel)
//
//   GET  /.netlify/functions/admin-keys
//       → har bir kalit holati (kalitlarning o'zi QAYTARILMAYDI, faqat
//         yashirilgan ko'rinishi va sozlangan/sozlanmagan holati)
//
//   POST /.netlify/functions/admin-keys   body: { "GROQ_API_KEY": "gsk_...", ... }
//       → kalitlarni data/api-keys.json'ga saqlaydi va joriy jarayonga
//         darhol qo'llaydi (serverni qayta ishga tushirish shart emas).
//       → bo'sh qiymat ("" yoki null) yuborilsa — kalit o'chiriladi va
//         process.env dagi qiymatga qaytiladi.
//
// SAQLASH JOYI:
//   Mahalliy (dev-server)   → ROOT/data/api-keys.json  (gitignore da)
//   Netlify                 → kalitlar Environment Variables'da qoladi;
//                             bu funksiya faqat joriy ish sessiyasida
//                             qo'llaydi va holatni ko'rsatadi.
// ═══════════════════════════════════════════════════════════════════════════

const keys = require('./_keys.js');
const fsdb = require('./_firestore.js');
const { verifyIdToken } = require('./_auth.js');

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS'
};

/** So'rov admin ekanini tasdiqlaydi: Authorization: Bearer <Firebase ID-token>
 *  header'i talab qilinadi va tokendagi uid `admins/{uid}` hujjatida
 *  bo'lishi shart. Aks holda bu endpoint HAR KIM API kalitlarini
 *  o'zgartirishi/o'chirishi mumkin bo'lgan ochiq eshik edi. */
async function requireAdmin(event) {
  const header = event.headers?.authorization || event.headers?.Authorization || '';
  const idToken = header.replace(/^Bearer\s+/i, '').trim();
  if (!idToken) throw Object.assign(new Error('Avtorizatsiya kerak'), { statusCode: 401 });

  const auth = await verifyIdToken(idToken);
  if (!fsdb.configured()) throw Object.assign(new Error('Server sozlanmagan'), { statusCode: 500 });

  const adminDoc = await fsdb.getDoc(`admins/${auth.uid}`).catch(() => null);
  if (!adminDoc) throw Object.assign(new Error('Admin huquqi yo\'q'), { statusCode: 403 });

  return auth;
}

// Admin panelda ko'rsatiladigan barcha kalitlar (tartibi muhim)
const FIELDS = [
  { name: 'GROQ_API_KEY',           label: 'Groq API Key',                type: 'password',  help: 'https://console.groq.com/keys (bepul)' },
  { name: 'GEMINI_API_KEYS',        label: 'Gemini API Keys',             type: 'textarea',  help: 'https://aistudio.google.com/apikey — bir nechta kalitni VERGUL bilan yozing' },
  { name: 'DEEPSEEK_API_KEY',       label: 'DeepSeek API Key',            type: 'password',  help: 'https://platform.deepseek.com/api_keys' },
  { name: 'OPENROUTER_API_KEY',     label: 'OpenRouter API Key',          type: 'password',  help: 'https://openrouter.ai/keys' },
  { name: 'CLOUDFLARE_API_TOKEN',   label: 'Cloudflare API Token',        type: 'password',  help: 'https://dash.cloudflare.com/profile/api-tokens (Workers AI huquqi kerak)' },
  { name: 'CLOUDFLARE_ACCOUNT_ID',  label: 'Cloudflare Account ID',       type: 'text',      help: 'Cloudflare dashboard → right side → Account ID' },
  { name: 'AZURE_OPENAI_KEY',       label: 'Azure OpenAI Key',            type: 'password',  help: 'Azure Portal → Azure OpenAI → Keys and Endpoint' },
  { name: 'AZURE_OPENAI_RESOURCE',  label: 'Azure OpenAI Resource Name',  type: 'text',      help: 'Masalan: my-linguaverse — https://my-linguaverse.openai.azure.com' },
  { name: 'AZURE_OPENAI_DEPLOYMENT',label: 'Azure OpenAI Deployment',     type: 'text',      help: 'Masalan: gpt-4o (Azure AI Studio → Deployments)' },
  { name: 'AZURE_SPEECH_KEY',       label: 'Azure Speech Key',            type: 'password',  help: 'Azure Portal → Speech Service → Keys (ovoz / speaking uchun)' },
  { name: 'AZURE_SPEECH_REGION',    label: 'Azure Speech Region',         type: 'text',      help: 'Masalan: eastus' }
];

function json(statusCode, body) {
  return {
    statusCode,
    headers: { ...CORS, 'Content-Type': 'application/json', 'Cache-Control': 'no-store, max-age=0' },
    body: JSON.stringify(body)
  };
}

/** Har bir kalit holatini yashiramiz (hech qachon to'liq qiymat yubormaymiz). */
function buildStatus() {
  const status = {};
  for (const f of FIELDS) {
    const v = keys.get(f.name);
    status[f.name] = { configured: !!v, masked: keys.mask(v), source: v ? 'file-or-env' : 'none' };
  }
  return status;
}

exports.handler = async function (event) {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' };

  try {
    await requireAdmin(event);
  } catch (e) {
    return json(e.statusCode || 401, { error: e.message || 'Ruxsat etilmagan' });
  }

  if (event.httpMethod === 'GET') {
    return json(200, { ok: true, fields: FIELDS, status: buildStatus() });
  }

  if (event.httpMethod === 'POST') {
    let payload;
    try { payload = JSON.parse(event.body || '{}'); }
    catch { return json(400, { error: "Noto'g'ri JSON" }); }

    const current = keys.load();
    const next = { ...current };

    let changed = 0;
    for (const f of FIELDS) {
      const raw = payload[f.name];
      if (raw === undefined || raw === null) continue;
      const v = String(raw).trim();
      if (v === '') {
        // Bo'sh qiymat → o'chirish (env'dagi qiymatga qaytadi)
        if (next[f.name] !== undefined) { delete next[f.name]; changed++; }
      } else if (next[f.name] !== v) {
        next[f.name] = v;
        changed++;
      }
    }

    // Env'ni doim shu holatga keltiramiz — o'chirilgan/bo'sh kalitlarning
    // eski qiymati xotiraga yopishib qolmasligi uchun.
    keys.applyToEnv(next, FIELDS.map(f => f.name));

    if (!changed) return json(200, { ok: true, saved: true, changed: 0, status: buildStatus(), note: "O'zgarish yo'q" });

    const file = keys.save(next);

    return json(200, {
      ok: true,
      saved: true,
      changed,
      savedToFile: !!file,
      status: buildStatus()
    });
  }

  return json(405, { error: 'Method Not Allowed' });
};
