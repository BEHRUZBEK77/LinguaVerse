#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// dev-server.js — mahalliy ishlab chiqish serveri
//
// Nima uchun kerak: Netlify funksiyalari (AI, speaking, to'lov) oddiy statik
// serverda ishlamaydi. Netlify CLI ~300MB, shuning uchun bu server
// funksiyalarni o'zi require qilib chaqiradi.
//
// Ishga tushirish:
//   node dev-server.js
//   node dev-server.js 3000        (boshqa port)
//
// Keyin brauzerda:  http://localhost:5500
// ═══════════════════════════════════════════════════════════════════════════

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const ROOT = __dirname;
const PORT = parseInt(process.argv[2], 10) || 5500;
const FUNCTIONS_DIR = path.join(ROOT, 'netlify', 'functions');

// ═══════════════════════════════════════════════════════════════════════════
// .env — mahalliy sirlar
//
// Netlify'da kalitlar Environment Variables da turadi. Mahalliy sinovda
// ularni .env faylidan o'qiymiz. Bu fayl .gitignore da — GitHub'ga tushmaydi.
// ═══════════════════════════════════════════════════════════════════════════
function loadEnv() {
  for (const name of ['.env', '.env.local']) {
    const p = path.join(ROOT, name);
    if (!fs.existsSync(p)) continue;

    for (const line of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
      const t = line.trim();
      if (!t || t.startsWith('#')) continue;

      const eq = t.indexOf('=');
      if (eq < 1) continue;

      const key = t.slice(0, eq).trim();
      let val = t.slice(eq + 1).trim();

      if ((val.startsWith('"') && val.endsWith('"')) ||
          (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (!(key in process.env)) process.env[key] = val;
    }
    console.log('  .env yuklandi: ' + name);
  }
}
loadEnv();

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.gif': 'image/gif', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
  '.webp': 'image/webp', '.woff': 'font/woff', '.woff2': 'font/woff2',
  '.ttf': 'font/ttf', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.webm': 'video/webm'
};

// ═══════════════════════════════════════════════════════════════════════════
// NETLIFY FUNKSIYALARINI ISHGA TUSHIRISH
//
// Netlify funksiyasi — oddiy CommonJS modul, `exports.handler` beradi.
// ═══════════════════════════════════════════════════════════════════════════
async function runFunction(name, req, pathname, query, body) {
  const file = path.join(FUNCTIONS_DIR, name + '.js');
  if (!fs.existsSync(file)) {
    return { statusCode: 404, body: JSON.stringify({ error: 'Funksiya topilmadi: ' + name }) };
  }

  // Keshni tozalaymiz — faylni tahrirlasangiz serverni qayta ishga
  // tushirish shart emas
  for (const k of Object.keys(require.cache)) {
    if (k.startsWith(FUNCTIONS_DIR)) delete require.cache[k];
  }

  let mod;
  try {
    mod = require(file);
  } catch (e) {
    console.error('  [funksiya] yuklanmadi: ' + name, e.message);
    return { statusCode: 500, body: JSON.stringify({ error: 'Funksiya yuklanmadi: ' + e.message }) };
  }

  if (typeof mod.handler !== 'function') {
    return { statusCode: 500, body: JSON.stringify({ error: name + " da handler yo'q" }) };
  }

  const event = {
    httpMethod: req.method,
    path: pathname,
    rawUrl: 'http://localhost:' + PORT + req.url,
    headers: req.headers,
    queryStringParameters: Object.fromEntries(new URLSearchParams(query || '')),
    body: body || null,
    isBase64Encoded: false
  };

  try {
    return await mod.handler(event, {});
  } catch (e) {
    console.error('  [funksiya] xato: ' + name, e);
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
}

function readBody(req) {
  return new Promise(resolve => {
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', () => resolve(''));
  });
}

/** So'ralgan yo'l uchun haqiqiy faylni topadi. */
function resolveFile(pathname) {
  // Katalogdan chiqib ketishga urinishni to'sib qo'yamiz
  const safe = path.normalize(decodeURIComponent(pathname)).replace(/^(\.\.[/\\])+/, '');
  let p = path.join(ROOT, safe);

  if (!p.startsWith(ROOT)) return null;

  if (fs.existsSync(p) && fs.statSync(p).isFile()) return p;

  if (fs.existsSync(p) && fs.statSync(p).isDirectory()) {
    const idx = path.join(p, 'index.html');
    if (fs.existsSync(idx)) return idx;
  }

  // /admin → /admin/admin.html  (netlify.toml dagi qoidaga mos)
  const clean = safe.replace(/[/\\]$/, '').replace(/\\/g, '/');
  if (clean === '/admin') {
    const a = path.join(ROOT, 'admin', 'admin.html');
    if (fs.existsSync(a)) return a;
  }

  return null;
}

const server = http.createServer(async (req, res) => {
  const parsed = url.parse(req.url);
  const pathname = parsed.pathname;

  // ── Netlify funksiyalari ──
  if (pathname.includes('/.netlify/functions/')) {
    const rest = pathname.split('/.netlify/functions/')[1] || '';
    const name = rest.split('/')[0];

    const body = ['POST', 'PUT', 'PATCH'].includes(req.method) ? await readBody(req) : null;
    const result = await runFunction(name, req, pathname, parsed.query, body);

    const headers = { 'Content-Type': 'application/json', ...(result.headers || {}) };
    res.writeHead(result.statusCode || 200, headers);
    res.end(result.body || '');

    const code = result.statusCode || 200;
    console.log(`  ${code} ${code < 400 ? ' ' : '⚠'} fn:${name}`);
    return;
  }

  const file = resolveFile(pathname);

  if (!file) {
    res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`<!doctype html><meta charset="utf-8">
      <body style="font-family:system-ui;background:#04060f;color:#e8ecff;padding:40px">
      <h1 style="color:#f87171">404 — topilmadi</h1>
      <p style="color:#7580a8">So'ralgan yo'l: <code>${pathname}</code></p>
      <a href="/index.html" style="color:#4f6ef7">Bosh sahifaga</a></body>`);
    console.log('  404  ' + pathname);
    return;
  }

  const ext = path.extname(file).toLowerCase();
  const type = MIME[ext] || 'application/octet-stream';

  fs.readFile(file, (err, data) => {
    if (err) {
      res.writeHead(500);
      res.end('Server xatosi');
      console.log('  500  ' + pathname + '  ' + err.message);
      return;
    }
    res.writeHead(200, {
      'Content-Type': type,
      'Cache-Control': 'no-store'   // ishlab chiqishda kesh kerak emas
    });
    res.end(data);
  });
});

/**
 * Portni band bo'lmagunicha oshirib ko'radi.
 * Live Server ko'pincha 5500 da turadi — avtomatik keyingisiga o'tamiz.
 */
function listen(port, attemptsLeft = 10) {
  // MUHIM: har urinishdan oldin eski tinglovchilarni tozalaymiz, aks holda
  // muvaffaqiyatsiz urinishning callback'i keyin ishga tushib, noto'g'ri
  // portni chop etadi.
  server.removeAllListeners('listening');
  server.removeAllListeners('error');

  server.once('error', e => {
    if (e.code === 'EADDRINUSE' && attemptsLeft > 0) {
      console.log('  ' + port + '-port band → ' + (port + 1) + ' bilan urinamiz...');
      listen(port + 1, attemptsLeft - 1);
      return;
    }
    console.error('\n  ❌ ' + (e.code === 'EADDRINUSE' ? "Bo'sh port topilmadi." : e.message) + '\n');
    process.exit(1);
  });

  server.once('listening', () => {
    console.log('');
    console.log('  ╭──────────────────────────────────────────────╮');
    console.log('  │  LinguaVerse — mahalliy server               │');
    console.log('  ╰──────────────────────────────────────────────╯');
    console.log('');
    console.log('  →  http://localhost:' + port);
    console.log('');
    console.log('  Netlify funksiyalari ishlaydi:');
    console.log('     /.netlify/functions/ai            (AI suhbat)');
    console.log('     /.netlify/functions/azure-speech  (speaking)');
    console.log('     /.netlify/functions/admin-keys    (API kalitlar)');
    console.log('     /.netlify/functions/payment       (to\'lov)');
    console.log('');
    console.log('  Live Server ham sahifalar uchun ishlaydi, lekin unda');
    console.log('  AI/speaking ishlamaydi — funksiyalar faqat shu serverda.');
    console.log('');
    console.log('  To\'xtatish: Ctrl+C');
    console.log('');
  });

  server.listen(port);
}

listen(PORT);
