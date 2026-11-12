#!/usr/bin/env node
// Navbatdagi videolar soni (videosi yo'q yoki eskirgan darslar). 0 bo'lsa — render bo'laklari ishga tushmaydi.
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const fsdb = require('../netlify/functions/_firestore.js');
const t = v => Date.parse(v?.$t || v || '') || 0;
let n = 0;
for (const lang of ['english', 'russian', 'turkish', 'german', 'spanish', 'arabic', 'chinese', 'korean']) {
  const rows = await fsdb.queryList('courseLessons', [{ field: 'lang', op: 'EQUAL', value: lang }], null, 2000);
  n += rows.filter(d => d.backend === 'manual' && d.core && (!d.videoPath || d.videoStaleAt) && !(t(d.videoErrorAt) > Date.now() - 24 * 3600e3)).length;
}
console.error(`navbatda: ${n} ta video`);
console.log(n);
