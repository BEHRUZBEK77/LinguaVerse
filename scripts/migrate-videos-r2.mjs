#!/usr/bin/env node
// GitHub Releases'dagi dars videolarini Cloudflare R2'ga ko'chiradi va bazadagi videoPath'ni
// "gh:<tag>#<obj>" → "r2:<obj>" ga almashtiradi. Qayta ishga tushirsa bo'ladi: r2 dagilar o'tkazib yuboriladi.
//   SHARD=0 SHARDS=10 node scripts/migrate-videos-r2.mjs        (R2_* va SUPABASE_* env kerak)
//   DRY=1 ...  — hech narsa yuklamaydi, faqat ro'yxat
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const fsdb = require('../netlify/functions/_firestore.js');
process.env.VIDEO_STORE = 'r2';                       // upload() R2'ga yozsin
const storage = require('../netlify/functions/_storage.js');

const SHARD = Number(process.env.SHARD || 0), SHARDS = Number(process.env.SHARDS || 1), DRY = !!process.env.DRY;
const REPO = process.env.GITHUB_REPOSITORY || 'BEHRUZBEK77/LinguaVerse';
const LANGS = ['english', 'russian', 'turkish', 'german', 'spanish', 'arabic', 'chinese', 'korean'];
if (!DRY && storage.provider() !== 'r2') { console.error('❌ R2 kalitlari yo\'q: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET'); process.exit(1); }

let todo = [];
for (const lang of LANGS) {
  const docs = await fsdb.queryList('courseLessons', [
    { field: 'nativeLang', op: 'EQUAL', value: 'uz' }, { field: 'lang', op: 'EQUAL', value: lang }
  ], null, 1000).catch(e => { console.error(lang, e.message); return []; });
  for (const d of docs) if (typeof d.videoPath === 'string' && d.videoPath.startsWith('gh:'))
    todo.push({ lang, level: d.level, n: d.n, videoPath: d.videoPath });
}
todo.sort((a, b) => (a.lang + a.level + String(a.n).padStart(3, '0')).localeCompare(b.lang + b.level + String(b.n).padStart(3, '0')));
const mine = todo.filter((_, i) => i % SHARDS === SHARD);
console.log(`GitHub'da: ${todo.length} ta video; bu bo'lak (${SHARD}/${SHARDS}): ${mine.length} ta`);

let ok = 0, bytes = 0; const failed = [];
for (const v of mine) {
  const rest = v.videoPath.slice(3), hash = rest.indexOf('#');
  const [tag, obj] = hash > 0 ? [rest.slice(0, hash), rest.slice(hash + 1)] : ['videos-v1', rest];
  const url = `https://github.com/${REPO}/releases/download/${tag}/${obj.replace(/\//g, '__')}`;
  if (DRY) { console.log('·', v.lang, v.level, v.n, '→ r2:' + obj); continue; }
  try {
    let buf;
    for (let i = 1; ; i++) {
      try { const r = await fetch(url, { redirect: 'follow' }); if (!r.ok) throw new Error(`GitHub ${r.status}`); buf = Buffer.from(await r.arrayBuffer()); break; }
      catch (e) { if (i >= 3) throw e; await new Promise(r => setTimeout(r, 4000 * i)); }
    }
    let up;
    for (let i = 1; ; i++) {
      try { up = await storage.upload(obj, buf, 'video/mp4'); break; }
      catch (e) { if (i >= 3) throw e; await new Promise(r => setTimeout(r, 4000 * i)); }
    }
    await fsdb.setDoc(`courseLessons/v4_uz_${v.lang}_${v.level}_${v.n}`, { videoPath: up.stored || `r2:${obj}`, videoGhPath: v.videoPath, videoMovedAt: new Date() });
    ok++; bytes += buf.length;
    console.log(`✅ ${v.lang} ${v.level}#${v.n}  ${(buf.length / 1048576).toFixed(0)} MB`);
  } catch (e) { failed.push(`${v.lang} ${v.level}#${v.n}: ${e.message}`); console.log(`❌ ${v.lang} ${v.level}#${v.n}: ${e.message}`); }
}
console.log(`\nKo'chirildi: ${ok}/${mine.length} (${(bytes / 1073741824).toFixed(1)} GB)`);
if (failed.length) { console.log(`Xato: ${failed.length}\n  ` + failed.join('\n  ')); process.exitCode = 1; }
