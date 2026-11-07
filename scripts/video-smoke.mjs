#!/usr/bin/env node
// Tezkor sinov: qisqa video yasaydi va saqlash joyiga yuklaydi; natija videoFactory/smoke ga yoziladi
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const fsdb = require(path.join(ROOT, 'netlify/functions/_firestore.js'));
const report = async (o) => { console.log(JSON.stringify(o)); await fsdb.setDoc('videoFactory/smoke', { ...o, at: new Date() }).catch(e => console.error('db', e.message)); };
try {
  const L = JSON.parse(fs.readFileSync(path.join(ROOT, 'content/uz/english/A1-01.json'), 'utf8'));
  L.scenes = L.scenes.slice(0, 2);
  fs.writeFileSync('/tmp/smoke.json', JSON.stringify(L));
  const r = spawnSync('node', [path.join(ROOT, 'scripts/render-lesson-video.mjs'), '--json', '/tmp/smoke.json', '--tts', 'sado', '--lang', 'english', '--level', 'b2', '--n', '0', '--fps', '5', '--out', '/tmp/smoke', '--no-recording'], { encoding: 'utf8', maxBuffer: 1 << 26 });
  const mp4 = fs.existsSync('/tmp/smoke') && fs.readdirSync('/tmp/smoke').find(f => f.endsWith('.mp4'));
  if (!mp4) { await report({ ok: false, step: 'render', log: (r.stderr || '').slice(-1500) + (r.stdout || '').slice(-500) }); process.exit(1); }
  const storage = require(path.join(ROOT, 'netlify/functions/_storage.js'));
  const up = await storage.upload('courseVideos/test/smoke.mp4', fs.readFileSync(path.join('/tmp/smoke', mp4)), 'video/mp4');
  const url = storage.signedUrl(up?.stored || storage.storedPath('courseVideos/test/smoke.mp4'));
  const head = await fetch(url, { method: 'HEAD', redirect: 'follow' });       // video haqiqatan ochiladimi
  if (!head.ok) throw new Error(`Yuklangan video ochilmadi: ${head.status} ${url}`);
  if (up?.tag && process.env.GITHUB_TOKEN) {                                  // sinov relizi to'planib qolmasin
    const api = `https://api.github.com/repos/${process.env.GITHUB_REPOSITORY || 'BEHRUZBEK77/LinguaVerse'}`;
    const h = { Authorization: `Bearer ${process.env.GITHUB_TOKEN}`, Accept: 'application/vnd.github+json', 'User-Agent': 'linguaverse-video' };
    const r = await fetch(`${api}/releases/tags/${up.tag}`, { headers: h });
    if (r.ok) await fetch(`${api}/releases/${(await r.json()).id}`, { method: 'DELETE', headers: h });
  }
  await report({ ok: true, provider: storage.provider(), up, url });
} catch (e) { await report({ ok: false, step: 'upload', error: String(e.stack || e.message).slice(0, 1500) }); process.exit(1); }
