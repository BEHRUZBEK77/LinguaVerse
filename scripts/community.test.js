const assert = require('node:assert/strict');
const test = require('node:test');

const fsdbPath = require.resolve('../netlify/functions/_firestore.js');
const authPath = require.resolve('../netlify/functions/_auth.js');
const communityPath = require.resolve('../netlify/functions/community.js');
const originals = new Map([fsdbPath, authPath, communityPath].map(p => [p, require.cache[p]]));

function stub(path, exports) {
  require.cache[path] = { id: path, filename: path, loaded: true, exports };
}

function load(store) {
  stub(fsdbPath, {
    configured: () => true,
    getDoc: async p => store.has(p) ? { ...store.get(p) } : null,
    transact: async (p, mutate) => {
      const patch = await mutate(store.has(p) ? { ...store.get(p) } : null);
      if (patch) store.set(p, { ...(store.get(p) || {}), ...patch });
    },
    queryList: async () => [],
    addDoc: async (col, data) => { store.set(`${col}/new1`, data); return { id: 'new1', ...data }; }
  });
  stub(authPath, {
    verifyIdToken: async token => ({ uid: token, name: `Name of ${token}` })
  });
  delete require.cache[communityPath];
  return require(communityPath);
}

test.afterEach(() => {
  for (const [p, original] of originals) {
    if (original) require.cache[p] = original;
    else delete require.cache[p];
  }
});

const call = (handler, body) => handler({ httpMethod: 'POST', body: JSON.stringify(body) })
  .then(r => ({ status: r.statusCode, body: JSON.parse(r.body) }));

test('save_count counts each user only once', async () => {
  const store = new Map([['community_vocab/abc123', { saves: 2 }]]);
  const { handler } = load(store);
  await call(handler, { action: 'save_count', kind: 'vocab', id: 'abc123', idToken: 'u1' });
  const again = await call(handler, { action: 'save_count', kind: 'vocab', id: 'abc123', idToken: 'u1' });
  await call(handler, { action: 'save_count', kind: 'vocab', id: 'abc123', idToken: 'u2' });
  assert.equal(again.body.already, true);
  assert.equal(store.get('community_vocab/abc123').saves, 4);
});

test('save_count rejects path-like ids and missing items', async () => {
  const store = new Map();
  const { handler } = load(store);
  const bad = await call(handler, { action: 'save_count', kind: 'vocab', id: '../users/x', idToken: 'u1' });
  assert.equal(bad.status, 400);
  const missing = await call(handler, { action: 'save_count', kind: 'vocab', id: 'nope', idToken: 'u1' });
  assert.equal(missing.status, 404);
  assert.equal(store.size, 0);
});

test('submit takes authorName from the verified token, not the request', async () => {
  const store = new Map();
  const { handler } = load(store);
  const r = await call(handler, {
    action: 'submit', kind: 'unit', target: 'english', idToken: 'u9',
    authorName: 'Admin', item: { title: 'Unit 1' }
  });
  assert.equal(r.body.ok, true);
  assert.equal(r.body.item.authorName, 'Name of u9');
});
