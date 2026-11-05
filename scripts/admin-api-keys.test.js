const assert = require('node:assert/strict');
const test = require('node:test');
const parserPromise = import('../admin/api-key-import.mjs');

const SUPPORTED_FIELDS = [
  'GROQ_API_KEY',
  'GEMINI_API_KEYS',
  'GOOGLE_TTS_KEYS',
  'YOUTUBE_API_KEY',
  'ELEVENLABS_API_KEY',
  'ELEVENLABS_VOICE_ID',
  'DEEPSEEK_API_KEY',
  'OPENROUTER_API_KEY',
  'CLOUDFLARE_API_TOKEN',
  'CLOUDFLARE_ACCOUNT_ID',
  'AZURE_OPENAI_KEY',
  'AZURE_OPENAI_RESOURCE',
  'AZURE_OPENAI_DEPLOYMENT',
  'AZURE_SPEECH_KEY',
  'AZURE_SPEECH_REGION'
];

test('detects distinctive raw key formats and accepts named supported fields', () => {
  return parserPromise.then(({ parsePastedApiKeys }) => {
  const secretGroq = 'gsk_secret-value';
  const secretGemini = 'AIzaSy_secret-value';
  const secretRouter = 'sk-or-v1-secret-value';
  const secretDeepseek = 'sk-secret-deepseek';
  const parsed = parsePastedApiKeys([
    secretGroq,
    secretGemini,
    secretRouter,
    `DEEPSEEK_API_KEY=${secretDeepseek}`,
    'export GOOGLE_TTS_KEYS="AIza_tts-secret,AIza_tts-secret-2"',
    'YOUTUBE_API_KEY=youtube-secret',
    'ELEVENLABS_API_KEY=elevenlabs-secret',
    'CLOUDFLARE_ACCOUNT_ID=account-id-value',
    'UNKNOWN_PROVIDER_KEY=not-a-secret'
  ].join('\n'), SUPPORTED_FIELDS);

  assert.deepEqual(parsed.values, {
    GROQ_API_KEY: secretGroq,
    GEMINI_API_KEYS: secretGemini,
    OPENROUTER_API_KEY: secretRouter,
    DEEPSEEK_API_KEY: secretDeepseek,
    GOOGLE_TTS_KEYS: 'AIza_tts-secret,AIza_tts-secret-2',
    YOUTUBE_API_KEY: 'youtube-secret',
    ELEVENLABS_API_KEY: 'elevenlabs-secret',
    CLOUDFLARE_ACCOUNT_ID: 'account-id-value'
  });
  assert.deepEqual(parsed.recognized, [
    'GROQ_API_KEY', 'GEMINI_API_KEYS', 'OPENROUTER_API_KEY', 'DEEPSEEK_API_KEY',
    'GOOGLE_TTS_KEYS', 'YOUTUBE_API_KEY', 'ELEVENLABS_API_KEY', 'CLOUDFLARE_ACCOUNT_ID'
  ]);
  assert.equal(JSON.stringify(parsed.notices).includes(secretGroq), false);
  assert.equal(JSON.stringify(parsed.notices).includes(secretDeepseek), false);
  assert.equal(JSON.stringify(parsed.notices).includes('youtube-secret'), false);
  assert.equal(parsed.notices.some(({ code }) => code === 'unsupported-name'), true);
  });
});

test('imports named keys from JSON and multiline JSON properties without echoing secrets', () => {
  return parserPromise.then(({ parsePastedApiKeys }) => {
    const secret = 'azure-secret-value';
    const parsed = parsePastedApiKeys(
      `{\n  "AZURE_OPENAI_KEY": "${secret}",\n  "GEMINI_API_KEY": "AIza_gemini-secret"\n}`,
      SUPPORTED_FIELDS
    );

    assert.deepEqual(parsed.values, {
      AZURE_OPENAI_KEY: secret,
      GEMINI_API_KEYS: 'AIza_gemini-secret'
    });
    assert.equal(JSON.stringify(parsed.notices).includes(secret), false);
  });
});

test('reports ambiguous and arbitrary formats without assigning or echoing them', () => {
  return parserPromise.then(({ parsePastedApiKeys }) => {
  const ambiguousKey = 'sk-ambiguous-secret';
  const arbitrary = 'this is some unrelated text';
  const parsed = parsePastedApiKeys(`${ambiguousKey}\n${arbitrary}\n${arbitrary}`, SUPPORTED_FIELDS);

  assert.deepEqual(parsed.values, {});
  assert.equal(parsed.notices.some(({ code }) => code === 'ambiguous-format'), true);
  const unsupported = parsed.notices.find(({ code }) => code === 'unsupported-format');
  assert.equal(unsupported.count, 2);
  assert.equal(parsed.notices.length, 2);
  assert.equal(parsed.notices.some(({ message }) => /NAME=value|DEEPSEEK_API_KEY/.test(message)), false);
  assert.equal(JSON.stringify(parsed.notices).includes(ambiguousKey), false);
  assert.equal(JSON.stringify(parsed.notices).includes(arbitrary), false);
  });
});

test('rejects conflicting duplicate values for a provider', () => {
  return parserPromise.then(({ parsePastedApiKeys }) => {
  const parsed = parsePastedApiKeys(
    'GROQ_API_KEY=first-secret\nGROQ_API_KEY=second-secret',
    SUPPORTED_FIELDS
  );
  assert.deepEqual(parsed.values, {});
  assert.equal(parsed.notices.some(({ code }) => code === 'ambiguous'), true);
  assert.equal(JSON.stringify(parsed.notices).includes('first-secret'), false);
  assert.equal(JSON.stringify(parsed.notices).includes('second-secret'), false);
  });
});

const firestorePath = require.resolve('../netlify/functions/_firestore.js');
const authPath = require.resolve('../netlify/functions/_auth.js');
const keysPath = require.resolve('../netlify/functions/_keys.js');
const adminKeysPath = require.resolve('../netlify/functions/admin-keys.js');
const aiPath = require.resolve('../netlify/functions/ai.js');
const originalModules = new Map(
  [firestorePath, authPath, keysPath, adminKeysPath, aiPath].map(path => [path, require.cache[path]])
);

function loadAdminKeys({ keys, firestore = {}, auth = {} }) {
  const firestoreConfig = { apiKeys: {}, defaultModel: '', defaultProvider: '' };
  require.cache[keysPath] = {
    id: keysPath, filename: keysPath, loaded: true,
    exports: keys
  };
  require.cache[firestorePath] = {
    id: firestorePath, filename: firestorePath, loaded: true,
    exports: {
      configured: () => true,
      getDoc: async path => path.startsWith('admins/') ? ({ role: 'admin' }) : path === 'apiConfig/global' ? firestoreConfig : null,
      transact: async (path, mutate) => {
        const patch = await mutate({ ...firestoreConfig });
        if (patch) {
          Object.assign(firestoreConfig, patch);
          keys.setPersisted(patch.apiKeys);
          keys.setDefaultModel(patch.defaultModel);
          keys.setDefaultProvider(patch.defaultProvider);
        }
        return { id: path.split('/').pop(), ...firestoreConfig };
      },
      ...firestore
    }
  };
  require.cache[authPath] = {
    id: authPath, filename: authPath, loaded: true,
    exports: { verifyIdToken: async () => ({ uid: 'admin-1' }), ...auth }
  };
  delete require.cache[aiPath];
  delete require.cache[adminKeysPath];
  return require(adminKeysPath);
}

function makeKeys(overrides = {}) {
  const fileState = {};
  const persisted = {};
  let defaultModel = '';
  let defaultProvider = '';
  const calls = { save: 0, apply: 0, refresh: 0 };
  const keys = {
    load: () => ({ ...fileState }),
    get: name => persisted[name] || fileState[name] || '',
    getPersisted: () => ({ ...persisted }),
    setPersisted: next => {
      for (const name of Object.keys(persisted)) delete persisted[name];
      Object.assign(persisted, next);
    },
    getDefaultModel: () => defaultModel,
    setDefaultModel: value => { defaultModel = value; },
    getDefaultProvider: () => defaultProvider,
    setDefaultProvider: value => { defaultProvider = value; },
    source: name => persisted[name] ? 'firebase' : fileState[name] ? 'file' : 'none',
    refreshFromFirestore: async () => { calls.refresh++; },
    mask: value => value ? '****' : '',
    isEphemeralRuntime: () => false,
    save: next => {
      calls.save++;
      Object.assign(fileState, next);
      return 'persisted';
    },
    applyToEnv: () => { calls.apply++; },
    ...overrides
  };
  return { keys, state: persisted, calls };
}

test.afterEach(() => {
  for (const [path, original] of originalModules) {
    if (original) require.cache[path] = original;
    else delete require.cache[path];
  }
});

test('loads Firestore API keys and primary model into server key accessors', async () => {
  require.cache[firestorePath] = {
    id: firestorePath, filename: firestorePath, loaded: true,
    exports: {
      configured: () => true,
      getDoc: async path => path === 'apiConfig/global'
        ? { apiKeys: { GROQ_API_KEY: 'firebase-key' }, defaultModel: 'megaplus', defaultProvider: 'groq' }
        : null
    }
  };
  delete require.cache[keysPath];
  const firebaseKeys = require(keysPath);
  await firebaseKeys.refreshFromFirestore();

  assert.equal(firebaseKeys.get('GROQ_API_KEY'), 'firebase-key');
  assert.equal(firebaseKeys.source('GROQ_API_KEY'), 'firebase');
  assert.equal(firebaseKeys.getDefaultModel(), 'megaplus');
  assert.equal(firebaseKeys.getDefaultProvider(), 'groq');
});

test('persists keys through Firebase instead of ephemeral filesystem storage', async () => {
  const { keys, calls } = makeKeys({ isEphemeralRuntime: () => true });
  const handler = loadAdminKeys({ keys }).handler;
  const secret = 'gsk_never-return-this';
  const response = await handler({
    httpMethod: 'POST',
    headers: { authorization: 'Bearer admin-token' },
    body: JSON.stringify({ GROQ_API_KEY: secret })
  });
  const body = JSON.parse(response.body);

  assert.equal(response.statusCode, 200);
  assert.equal(body.ok, true);
  assert.equal(body.savedToFirebase, true);
  assert.equal(response.body.includes(secret), false);
  assert.equal(keys.get('GROQ_API_KEY'), secret);
  assert.deepEqual(calls, { save: 0, apply: 0, refresh: 2 });
});

test('does not report success when Firebase storage fails', async () => {
  const { keys } = makeKeys();
  const handler = loadAdminKeys({
    keys,
    firestore: { transact: async () => { throw new Error('database unavailable'); } }
  }).handler;
  const secret = 'gsk_storage-failure-secret';
  const response = await handler({
    httpMethod: 'POST',
    headers: { authorization: 'Bearer admin-token' },
    body: JSON.stringify({ GROQ_API_KEY: secret })
  });
  const body = JSON.parse(response.body);

  assert.equal(response.statusCode, 503);
  assert.equal(body.ok, false);
  assert.equal(body.error.includes(secret), false);
  assert.equal(keys.get('GROQ_API_KEY'), '');
});

test('confirms Firebase persistence without returning complete keys', async () => {
  const { keys, calls } = makeKeys();
  const handler = loadAdminKeys({ keys }).handler;
  const secret = 'gsk_persisted-secret';
  const response = await handler({
    httpMethod: 'POST',
    headers: { authorization: 'Bearer admin-token' },
    body: JSON.stringify({ GROQ_API_KEY: secret })
  });

  assert.equal(response.statusCode, 200);
  assert.equal(JSON.parse(response.body).saved, true);
  assert.equal(JSON.parse(response.body).savedToFirebase, true);
  assert.equal(response.body.includes(secret), false);
  assert.deepEqual(calls, { save: 0, apply: 0, refresh: 2 });
});

test('adding another provider preserves previously stored Firebase keys', async () => {
  const { keys } = makeKeys();
  const handler = loadAdminKeys({ keys }).handler;
  for (const [name, value] of [
    ['GROQ_API_KEY', 'gsk_first-secret'],
    ['DEEPSEEK_API_KEY', 'sk_second-secret']
  ]) {
    const response = await handler({
      httpMethod: 'POST',
      headers: { authorization: '******' },
      body: JSON.stringify({ apiKeys: { [name]: value } })
    });
    assert.equal(response.statusCode, 200);
  }
  assert.equal(keys.get('GROQ_API_KEY'), 'gsk_first-secret');
  assert.equal(keys.get('DEEPSEEK_API_KEY'), 'sk_second-secret');
});

test('reports unchanged settings without saying a save occurred', async () => {
  const { keys } = makeKeys();
  const handler = loadAdminKeys({ keys }).handler;
  await handler({
    httpMethod: 'POST',
    headers: { authorization: '******' },
    body: JSON.stringify({ GROQ_API_KEY: 'already-set' })
  });
  const response = await handler({
    httpMethod: 'POST',
    headers: { authorization: 'Bearer admin-token' },
    body: JSON.stringify({ GROQ_API_KEY: 'already-set' })
  });
  const body = JSON.parse(response.body);

  assert.equal(response.statusCode, 200);
  assert.equal(body.unchanged, true);
  assert.equal(body.saved, false);
});

test('stores the selected primary model in Firebase and rejects unsupported models', async () => {
  const { keys } = makeKeys();
  const writes = [];
  const handler = loadAdminKeys({
    keys,
    firestore: {
      transact: async (path, mutate) => {
        const data = await mutate({ apiKeys: {}, defaultModel: '', defaultProvider: '' });
        writes.push(data);
        keys.setPersisted(data.apiKeys);
        keys.setDefaultModel(data.defaultModel);
        keys.setDefaultProvider(data.defaultProvider);
        return { id: 'global', ...data };
      }
    }
  }).handler;
  const saved = await handler({
    httpMethod: 'POST',
    headers: { authorization: '******' },
    body: JSON.stringify({ defaultModel: 'megaplus' })
  });
  assert.equal(saved.statusCode, 200);
  assert.equal(JSON.parse(saved.body).defaultModel, 'megaplus');
  assert.equal(writes[0].defaultModel, 'megaplus');

  const invalid = await handler({
    httpMethod: 'POST',
    headers: { authorization: '******' },
    body: JSON.stringify({ defaultModel: 'not-a-model' })
  });
  assert.equal(invalid.statusCode, 400);
  assert.equal(writes.length, 1);
});

test('stores a configured primary API provider in Firebase', async () => {
  const { keys } = makeKeys();
  const writes = [];
  const handler = loadAdminKeys({
    keys,
    firestore: {
      transact: async (path, mutate) => {
        const data = await mutate({ apiKeys: {}, defaultModel: 'nova', defaultProvider: '' });
        if (data) {
          writes.push(data);
          keys.setPersisted(data.apiKeys);
          keys.setDefaultModel(data.defaultModel);
          keys.setDefaultProvider(data.defaultProvider);
        }
        return { id: 'global', ...data };
      }
    }
  }).handler;
  await handler({
    httpMethod: 'POST',
    headers: { authorization: '******' },
    body: JSON.stringify({ GROQ_API_KEY: 'gsk_primary-provider' })
  });
  const response = await handler({
    httpMethod: 'POST',
    headers: { authorization: '******' },
    body: JSON.stringify({ defaultProvider: 'groq' })
  });
  assert.equal(response.statusCode, 200);
  assert.equal(JSON.parse(response.body).defaultProvider, 'groq');
  assert.equal(writes.at(-1).defaultProvider, 'groq');

  const invalid = await handler({
    httpMethod: 'POST',
    headers: { authorization: '******' },
    body: JSON.stringify({ defaultProvider: 'unknown' })
  });
  assert.equal(invalid.statusCode, 400);
});

test('exposes every AI and speech integration key field to the authenticated admin UI', async () => {
  const { keys } = makeKeys();
  const handler = loadAdminKeys({ keys }).handler;
  const response = await handler({
    httpMethod: 'GET',
    headers: { authorization: '******' }
  });
  const body = JSON.parse(response.body);
  const names = body.fields.map(field => field.name);

  assert.equal(response.statusCode, 200);
  assert.ok(names.includes('GEMINI_API_KEYS'));
  assert.ok(names.includes('GOOGLE_TTS_KEYS'));
  assert.ok(names.includes('YOUTUBE_API_KEY'));
  assert.ok(names.includes('ELEVENLABS_API_KEY'));
  assert.ok(names.includes('ELEVENLABS_VOICE_ID'));
  assert.ok(names.includes('AZURE_SPEECH_KEY'));
  assert.ok(names.includes('CLOUDFLARE_API_TOKEN'));
  assert.ok(body.models.some(model => model.id === 'megaplus'));
  assert.equal(body.defaultModel, 'nova');
  assert.equal(body.defaultProvider, '');
});
