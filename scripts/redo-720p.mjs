#!/usr/bin/env node
// Tezkor rejimda (720p) yasalgan videolarni qayta 1080p ga navbatga qo'yadi:
// videoUpdatedAt [SINCE, hozir] oralig'idagi darslarga videoStaleAt qo'yiladi (eski video qayta yasalguncha ko'rinadi).
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const fsdb = require('../netlify/functions/_firestore.js');
const since = Date.parse(process.env.REDO_SINCE || '2026-11-11T17:15:00Z');
const t = v => v instanceof Date ? v.getTime() : Date.parse(v?.$t || v || '') || 0;
let n = 0;
for (const lang of ['english', 'russian', 'turkish', 'german', 'spanish', 'arabic', 'chinese', 'korean']) {
  const rows = await fsdb.queryList('courseLessons', [{ field: 'lang', op: 'EQUAL', value: lang }], null, 2000);
  for (const d of rows) {
    // Tezkor rejim boshlangandan keyin yasalgan va 1080p deb belgilanmagan videolar (idempotent)
    if (!d.videoPath || d.videoStaleAt || d.videoQuality === '1080p' || t(d.videoUpdatedAt) < since) continue;
    await fsdb.setDoc(`courseLessons/${d.id}`, { videoStaleAt: new Date(), videoOldPath: d.videoPath, videoRedo: '1080p' });
    n++;
  }
}
console.log(`1080p uchun qayta navbatga qo'yildi: ${n} ta video`);
