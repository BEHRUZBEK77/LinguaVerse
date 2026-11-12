const assert = require('node:assert/strict');
const test = require('node:test');

const keysPath = require.resolve('../netlify/functions/_keys.js');
const ratelimitPath = require.resolve('../netlify/functions/_ratelimit.js');
const videosPath = require.resolve('../netlify/functions/youtube-videos.js');
const fsdbPath = require.resolve('../netlify/functions/_firestore.js');
const originalModules = new Map(
  [keysPath, ratelimitPath, videosPath, fsdbPath].map(path => [path, require.cache[path]])
);

function loadVideos(apiKey = '', store = null) {
  require.cache[fsdbPath] = {
    id: fsdbPath,
    filename: fsdbPath,
    loaded: true,
    exports: store ? {
      configured: () => true,
      getDoc: async path => store.has(path) ? { ...store.get(path) } : null,
      setDoc: async (path, data) => { store.set(path, { ...(store.get(path) || {}), ...data }); },
      transact: async (path, mutate) => {
        const patch = await mutate(store.has(path) ? { ...store.get(path) } : null);
        if (patch) store.set(path, { ...(store.get(path) || {}), ...patch });
      }
    } : { configured: () => false }
  };
  require.cache[keysPath] = {
    id: keysPath,
    filename: keysPath,
    loaded: true,
    exports: {
      get: name => name === 'YOUTUBE_API_KEY' ? apiKey : '',
      refreshFromFirestore: async () => {}
    }
  };
  require.cache[ratelimitPath] = {
    id: ratelimitPath,
    filename: ratelimitPath,
    loaded: true,
    exports: {
      checkRateLimit: async () => ({ ok: true }),
      clientIp: () => 'test-client'
    }
  };
  delete require.cache[videosPath];
  return require(videosPath);
}

test.afterEach(() => {
  for (const [path, original] of originalModules) {
    if (original) require.cache[path] = original;
    else delete require.cache[path];
  }
});

test('builds a language-specific YouTube query for the weak course skill', () => {
  const { buildSearch } = loadVideos();
  const result = buildSearch('german', 'listening', 'A2 elementary', 'Goethe exam');
  assert.match(result.query, /German Hörverstehen A2 elementary Goethe exam/);
  assert.match(result.searchUrl, /^https:\/\/www\.youtube\.com\/results\?search_query=/);
  assert.equal(result.language.code, 'de');
});

test('returns a clearly marked YouTube search link if the API key is not configured', async () => {
  const { handler } = loadVideos();
  const response = await handler({
    httpMethod: 'POST',
    headers: {},
    body: JSON.stringify({ language: 'english', skill: 'listening', level: 'A1 beginner' })
  });
  const body = JSON.parse(response.body);
  assert.equal(response.statusCode, 200);
  assert.equal(body.configured, false);
  assert.deepEqual(body.videos, []);
  assert.match(body.searchUrl, /^https:\/\/www\.youtube\.com\/results/);
});

test('returns real, sanitized search videos without exposing the API key', async () => {
  const { handler } = loadVideos('youtube-secret-key');
  const originalFetch = global.fetch;
  let upstream;
  global.fetch = async (url, options) => {
    upstream = { url: new URL(url), options };
    return {
      ok: true,
      json: async () => ({
        items: [
          {
            id: { videoId: 'abcdefghijk' },
            snippet: {
              title: '<script>unsafe</script> Listening',
              channelTitle: 'Learning Channel',
              thumbnails: { medium: { url: 'https://i.ytimg.com/vi/abcdefghijk/mqdefault.jpg' } }
            }
          },
          { id: { videoId: 'short' }, snippet: { title: 'Ignore invalid ID' } }
        ]
      })
    };
  };
  try {
    const response = await handler({
      httpMethod: 'POST',
      headers: {},
      body: JSON.stringify({
        language: 'english',
        skill: 'listening',
        level: 'B1 intermediate',
        score: 18
      })
    });
    const body = JSON.parse(response.body);
    assert.equal(response.statusCode, 200);
    assert.equal(body.configured, true);
    assert.equal(body.videos.length, 1);
    assert.equal(body.videos[0].title, '<script>unsafe</script> Listening');
    assert.equal(body.videos[0].url, 'https://www.youtube.com/watch?v=abcdefghijk');
    assert.equal(upstream.url.searchParams.get('key'), 'youtube-secret-key');
    assert.equal(upstream.url.searchParams.get('type'), 'video');
    assert.equal(upstream.url.searchParams.get('relevanceLanguage'), 'en');
    assert.equal(response.body.includes('youtube-secret-key'), false);
  } finally {
    global.fetch = originalFetch;
  }
});

test('rejects invalid language and skill ids before contacting YouTube', async () => {
  const { handler } = loadVideos();
  const response = await handler({
    httpMethod: 'POST',
    headers: {},
    body: JSON.stringify({ language: 'unknown', skill: 'listening' })
  });
  assert.equal(response.statusCode, 400);
  assert.match(JSON.parse(response.body).error, /qo‘llab-quvvatlanmaydi/);
});

function fakeFetch(counter) {
  return async () => {
    counter.calls += 1;
    return {
      ok: true,
      json: async () => ({ items: [{ id: { videoId: 'abcdefghijk' }, snippet: { title: 'Cached video' } }] })
    };
  };
}

test('caches identical searches for 6 hours instead of calling YouTube again', async () => {
  const store = new Map();
  const { cachedSearch, buildSearch } = loadVideos('key', store);
  const counter = { calls: 0 };
  const search = buildSearch('english', 'listening', 'B1', 'IELTS');
  const first = await cachedSearch(search, 'key', fakeFetch(counter));
  const second = await cachedSearch(search, 'key', fakeFetch(counter));
  assert.equal(counter.calls, 1);
  assert.equal(first.videos.length, 1);
  assert.equal(second.cached, true);
  assert.deepEqual(second.videos, first.videos);

  // Muddati o'tgan kesh qayta qidiruvga olib keladi
  for (const [path, doc] of store) if (path.startsWith('ytCache/')) doc.cachedAt = Date.now() - 7 * 3600_000;
  await cachedSearch(search, 'key', fakeFetch(counter));
  assert.equal(counter.calls, 2);
});

test('stops calling YouTube after the shared daily limit', async () => {
  const store = new Map();
  const { cachedSearch, buildSearch, DAILY_API_LIMIT } = loadVideos('key', store);
  const day = new Date().toISOString().slice(0, 10);
  store.set(`ytQuota/${day}`, { count: DAILY_API_LIMIT });
  const counter = { calls: 0 };
  const result = await cachedSearch(buildSearch('german', 'grammar', 'A2', ''), 'key', fakeFetch(counter));
  assert.equal(counter.calls, 0);
  assert.equal(result.limited, true);
  assert.deepEqual(result.videos, []);
});
