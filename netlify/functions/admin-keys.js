// ═══════════════════════════════════════════════════════════════════════════
// admin-keys.js — API KALITLARINI BOSHQARISH (admin panel)
//
//   GET  /.netlify/functions/admin-keys
//       → har bir kalit holati (kalitlarning o'zi QAYTARILMAYDI, faqat
//         yashirilgan ko'rinishi va sozlangan/sozlanmagan holati)
//
//   POST /.netlify/functions/admin-keys
//       → API kalitlari, standart model va asosiy AI provayderni apiConfig/global'da saqlaydi.
//       → kalit qiymatlari faqat server tomonda saqlanadi va o'qiladi.
// ═══════════════════════════════════════════════════════════════════════════

const keys = require('./_keys.js');
const fsdb = require('./_firestore.js');
const { verifyIdToken } = require('./_auth.js');
const { REGISTRY } = require('./ai.js');

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
  { name: 'GOOGLE_TTS_KEYS',        label: 'Google Text-to-Speech API Keys', type: 'textarea', help: 'Google Cloud Console → Text-to-Speech API — bir nechta kalitni vergul bilan yozing' },
  { name: 'YOUTUBE_API_KEY',        label: 'YouTube Data API Key',        type: 'password',  help: 'Google Cloud Console → YouTube Data API v3 → API key (kalitni faqat serverda saqlang)' },
  { name: 'ELEVENLABS_API_KEY',     label: 'ElevenLabs API Key (Speaking)', type: 'password', help: 'https://elevenlabs.io/app/settings/api-keys' },
  { name: 'ELEVENLABS_VOICE_ID',    label: 'ElevenLabs Uzbek Voice ID',    type: 'text',      help: 'Faqat o‘zbekcha Speaking ovozi uchun (ixtiyoriy).' },
  { name: 'ELEVENLABS_MODEL',       label: 'ElevenLabs model',             type: 'text',      help: 'Bo‘sh = eleven_multilingual_v2 (barqaror). eleven_v3 yozilsa ustoz [angry], [laughs] kabi kuchli emotsiya bilan gapiradi.' },
  { name: 'ELEVENLABS_VOICE_EN',    label: 'Ustoz ovozi — Ingliz (Voice ID)', type: 'text',   help: 'Bo‘sh = Daniel (britaniyalik qat’iy imtihonchi). elevenlabs.io → Voices → ID nusxalang.' },
  { name: 'ELEVENLABS_VOICE_RU',    label: 'Ustoz ovozi — Rus (Voice ID)',    type: 'text',   help: 'Bo‘sh = Brian. Voice Library’dan ona tilida gapiruvchi ovoz tanlash tavsiya etiladi.' },
  { name: 'ELEVENLABS_VOICE_ES',    label: 'Ustoz ovozi — Ispan (Voice ID)',  type: 'text',   help: 'Bo‘sh = Matilda.' },
  { name: 'ELEVENLABS_VOICE_DE',    label: 'Ustoz ovozi — Nemis (Voice ID)',  type: 'text',   help: 'Bo‘sh = George.' },
  { name: 'ELEVENLABS_VOICE_TR',    label: 'Ustoz ovozi — Turk (Voice ID)',   type: 'text',   help: 'Bo‘sh = Charlotte.' },
  { name: 'ELEVENLABS_VOICE_AR',    label: 'Ustoz ovozi — Arab (Voice ID)',   type: 'text',   help: 'Bo‘sh = Bill.' },
  { name: 'ELEVENLABS_VOICE_KO',    label: 'Ustoz ovozi — Koreys (Voice ID)', type: 'text',   help: 'Bo‘sh = Lily.' },
  { name: 'ELEVENLABS_VOICE_ZH',    label: 'Ustoz ovozi — Xitoy (Voice ID)',  type: 'text',   help: 'Bo‘sh = Alice.' },
  { name: 'DEEPSEEK_API_KEY',       label: 'DeepSeek API Key',             type: 'password',  help: 'https://platform.deepseek.com/api_keys' },
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
    status[f.name] = { configured: !!v, masked: keys.mask(v), source: keys.source(f.name) };
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

  try {
    await keys.refreshFromFirestore();
  } catch (e) {
    console.error('[admin-keys] Firebase sozlamalari yuklanmadi:', e.message);
    return json(503, { error: 'API sozlamalarini Firebase’dan yuklab bo‘lmadi. Keyinroq qayta urinib ko‘ring.' });
  }

  if (event.httpMethod === 'GET') {
    const models = Object.entries(REGISTRY).map(([id, model]) => ({ id, label: model.label }));
    return json(200, {
      ok: true,
      fields: FIELDS,
      status: buildStatus(),
      models,
      defaultModel: keys.getDefaultModel() || 'nova',
      defaultProvider: keys.getDefaultProvider() || ''
    });
  }

  if (event.httpMethod === 'POST') {
    let payload;
    try { payload = JSON.parse(event.body || '{}'); }
    catch { return json(400, { error: "Noto'g'ri JSON" }); }

    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      return json(400, { error: "Noto'g'ri so'rov formati" });
    }

    const suppliedKeys = payload.apiKeys && typeof payload.apiKeys === 'object' && !Array.isArray(payload.apiKeys)
      ? payload.apiKeys
      : payload;
    const hasDefaultModel = Object.prototype.hasOwnProperty.call(payload, 'defaultModel');
    const requestedModel = hasDefaultModel ? String(payload.defaultModel || '').trim().toLowerCase() : '';
    if (hasDefaultModel && !Object.prototype.hasOwnProperty.call(REGISTRY, requestedModel)) {
      return json(400, { error: 'Noma’lum AI modeli.' });
    }
    const hasDefaultProvider = Object.prototype.hasOwnProperty.call(payload, 'defaultProvider');
    const requestedProvider = hasDefaultProvider ? String(payload.defaultProvider || '').trim().toLowerCase() : '';
    const supportedProviders = ['groq', 'gemini', 'deepseek', 'openrouter', 'cloudflare', 'azure'];
    if (hasDefaultProvider && requestedProvider && !supportedProviders.includes(requestedProvider)) {
      return json(400, { error: 'Noma’lum AI provayderi.' });
    }
    if (hasDefaultProvider && requestedProvider && !providerConfigured(requestedProvider)) {
      return json(400, { error: 'Asosiy qilish uchun avval ushbu AI provayder API kalitini saqlang.' });
    }

    let expectedKeys;
    let expectedModel;
    let expectedProvider;
    let changed = 0;
    let didChange = false;
    try {
      await fsdb.transact('apiConfig/global', current => {
        const currentKeys = current?.apiKeys && typeof current.apiKeys === 'object' && !Array.isArray(current.apiKeys)
          ? current.apiKeys
          : {};
        const next = { ...currentKeys };
        changed = 0;
        for (const f of FIELDS) {
          const raw = suppliedKeys[f.name];
          if (raw === undefined || raw === null) continue;
          const value = String(raw).trim();
          if (value === '') {
            if (next[f.name] !== undefined) { delete next[f.name]; changed++; }
          } else if (next[f.name] !== value) {
            next[f.name] = value;
            changed++;
          }
        }

        const currentModel = typeof current?.defaultModel === 'string' ? current.defaultModel : '';
        const nextModel = hasDefaultModel ? requestedModel : currentModel || 'nova';
        const modelChanged = hasDefaultModel && requestedModel !== currentModel;
        const currentProvider = typeof current?.defaultProvider === 'string' ? current.defaultProvider : '';
        const nextProvider = hasDefaultProvider ? requestedProvider : currentProvider;
        const providerChanged = hasDefaultProvider && requestedProvider !== currentProvider;
        expectedKeys = next;
        expectedModel = nextModel;
        expectedProvider = nextProvider;
        didChange = changed > 0 || modelChanged || providerChanged;
        if (!didChange) return null;
        return { apiKeys: next, defaultModel: nextModel, defaultProvider: nextProvider };
      });
      if (!didChange) {
        await keys.refreshFromFirestore();
        return json(200, {
          ok: true,
          saved: false,
          unchanged: true,
          changed: 0,
          status: buildStatus(),
          defaultModel: keys.getDefaultModel() || 'nova',
          defaultProvider: keys.getDefaultProvider() || '',
          note: "O'zgarish yo'q"
        });
      }

      await keys.refreshFromFirestore();
      const savedKeys = keys.getPersisted();
      const sameKeys = Object.keys(savedKeys).length === Object.keys(expectedKeys).length
        && Object.entries(expectedKeys).every(([name, value]) => savedKeys[name] === value);
      if (!sameKeys
        || keys.getDefaultModel() !== expectedModel
        || keys.getDefaultProvider() !== expectedProvider) {
        throw new Error('Firebase yozuvi tekshiruvdan o‘tmadi');
      }
      return json(200, {
        ok: true,
        saved: true,
        changed,
        savedToFirebase: true,
        status: buildStatus(),
        defaultModel: keys.getDefaultModel(),
        defaultProvider: keys.getDefaultProvider() || ''
      });
    } catch (e) {
      console.error('[admin-keys] Firebase’da saqlash xatosi:', e.message);
      return json(503, { ok: false, error: 'Firebase’da saqlash tasdiqlanmadi. Hech qanday muvaffaqiyat qayd etilmadi.' });
    }
  }

  return json(405, { error: 'Method Not Allowed' });
};

function providerConfigured(provider) {
  switch (provider) {
    case 'groq': return !!keys.get('GROQ_API_KEY');
    case 'gemini': return !!(keys.get('GEMINI_API_KEYS') || keys.get('GEMINI_API_KEY'));
    case 'deepseek': return !!keys.get('DEEPSEEK_API_KEY');
    case 'openrouter': return !!keys.get('OPENROUTER_API_KEY');
    case 'cloudflare': return !!(keys.get('CLOUDFLARE_API_TOKEN') && keys.get('CLOUDFLARE_ACCOUNT_ID'));
    case 'azure': return !!(keys.get('AZURE_OPENAI_KEY') && keys.get('AZURE_OPENAI_RESOURCE'));
    default: return false;
  }
}
