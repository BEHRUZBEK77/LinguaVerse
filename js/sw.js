// LinguaVerse service worker — ehtiyotkor: sahifalar doim tarmoqdan (yangi versiya darrov ko'rinadi),
// internet bo'lmasa oxirgi ko'rilgan nusxa yoki "oflayn" sahifa. Lug'at bo'laklari keshdan.
// API, video, to'lov va admin hech qachon keshlanmaydi.
const VERSION = 'lv-sw-1';
const PAGES = VERSION + '-pages', DATA = VERSION + '-data';
const OFFLINE = '/offline.html';

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(PAGES).then(c => c.addAll(['/', OFFLINE])).catch(() => {}).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => !k.startsWith(VERSION)).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

const NEVER = /^\/(\.netlify|admin|payment|order)/;
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin || NEVER.test(url.pathname) || req.headers.has('range')) return;

  // Lug'at va fanlar ro'yxati: keshdan, fonda yangilanadi
  if (url.pathname.startsWith('/vocab/') || url.pathname === '/subjects/catalog.json') {
    e.respondWith(caches.open(DATA).then(async (c) => {
      const hit = await c.match(req);
      const net = fetch(req).then(r => { if (r.ok) c.put(req, r.clone()); return r; });
      if (hit) { net.catch(() => {}); return hit; }
      return net;
    }));
    return;
  }
  // Sahifalar: avval tarmoq, bo'lmasa kesh
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then((r) => {
      if (r.ok) { const copy = r.clone(); caches.open(PAGES).then(c => c.put(req, copy)); }
      return r;
    }).catch(async () => (await caches.match(req)) || (await caches.match(OFFLINE)) || Response.error()));
  }
});
