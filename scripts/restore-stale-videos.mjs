#!/usr/bin/env node
// Bekor qilingan (videoPath=null) eski videolarni saytga qaytaradi: videoPath = videoOldPath.
// videoStaleAt qoladi — video jarayoni yangisini yasab, almashtiradi.
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const fsdb = require('../netlify/functions/_firestore.js');
const LANGS = ['english', 'russian', 'turkish', 'german', 'spanish', 'arabic', 'chinese', 'korean'];
let n = 0;
for (const lang of LANGS) {
  const docs = await fsdb.queryList('courseLessons', [{ field: 'nativeLang', op: 'EQUAL', value: 'uz' }, { field: 'lang', op: 'EQUAL', value: lang }], null, 1000);
  for (const d of docs) {
    if (d.videoPath || !d.videoOldPath) continue;
    await fsdb.setDoc(`courseLessons/v4_uz_${lang}_${d.level}_${d.n}`, { videoPath: d.videoOldPath, videoStaleAt: d.videoStaleAt || new Date() });
    n++; console.log('↩️ ', lang, d.level, d.n);
  }
}
console.log(`\nSaytga qaytarildi: ${n} ta eski video (yangisi yasalgach almashtiriladi)`);
