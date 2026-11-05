const assert = require('node:assert/strict');
const test = require('node:test');

const firestorePath = require.resolve('../netlify/functions/_firestore.js');
const rateLimitPath = require.resolve('../netlify/functions/_ratelimit.js');
const originalFirestore = require.cache[firestorePath];
const originalRateLimit = require.cache[rateLimitPath];

function loadRateLimit(firestore) {
  require.cache[firestorePath] = {
    id: firestorePath,
    filename: firestorePath,
    loaded: true,
    exports: firestore
  };
  delete require.cache[rateLimitPath];
  return require(rateLimitPath);
}

test.afterEach(() => {
  if (originalFirestore) require.cache[firestorePath] = originalFirestore;
  else delete require.cache[firestorePath];
  if (originalRateLimit) require.cache[rateLimitPath] = originalRateLimit;
  else delete require.cache[rateLimitPath];
});

test('enforces the configured limit using persisted window counters', async () => {
  const docs = new Map();
  const limiter = loadRateLimit({
    configured: () => true,
    async transact(path, mutate) {
      const current = docs.get(path) || null;
      const patch = await mutate(current);
      if (patch) docs.set(path, { ...current, ...patch });
    }
  });

  const first = await limiter.checkRateLimit('ai:test-ip', { windowMs: 60_000, max: 2 });
  const second = await limiter.checkRateLimit('ai:test-ip', { windowMs: 60_000, max: 2 });
  const third = await limiter.checkRateLimit('ai:test-ip', { windowMs: 60_000, max: 2 });

  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  assert.equal(third.ok, false);
  assert.equal(third.count, 3);
});

test('fails closed when Firestore credentials are missing', async () => {
  const limiter = loadRateLimit({ configured: () => false });
  assert.deepEqual(await limiter.checkRateLimit('ai:test-ip'), {
    ok: false,
    unavailable: true
  });
});

test('fails closed when the persistent counter cannot be updated', async () => {
  const limiter = loadRateLimit({
    configured: () => true,
    async transact() {
      throw new Error('Firestore unavailable');
    }
  });
  assert.deepEqual(await limiter.checkRateLimit('ai:test-ip'), {
    ok: false,
    unavailable: true
  });
});

test('rejects invalid limits instead of silently choosing defaults', async () => {
  const limiter = loadRateLimit({ configured: () => true });
  await assert.rejects(
    limiter.checkRateLimit('ai:test-ip', { windowMs: 0 }),
    TypeError
  );
});
