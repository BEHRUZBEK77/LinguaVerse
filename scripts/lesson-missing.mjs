#!/usr/bin/env node
// Qaysi darslar hali yozilmagan: node scripts/lesson-missing.mjs [til] [nechta]
//   node scripts/lesson-missing.mjs            → hamma tillar bo'yicha hisob
//   node scripts/lesson-missing.mjs russian 5  → rus tilida navbatdagi 5 ta dars ID si
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const LANGS = ['english', 'russian', 'turkish', 'german', 'spanish', 'arabic', 'chinese', 'korean'];
const IDS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].flatMap(l => Array.from({ length: 25 }, (_, i) => `${l}-${String(i + 1).padStart(2, '0')}`));
const missing = lang => IDS.filter(id => !fs.existsSync(path.join(ROOT, 'content/uz', lang, id + '.json')));
const [lang, count] = process.argv.slice(2);
if (lang) {
  if (!LANGS.includes(lang)) { console.error(`Til: ${LANGS.join(', ')}`); process.exit(1); }
  console.log(missing(lang).slice(0, Number(count) || 150).join(' '));
} else {
  for (const l of LANGS) { const m = missing(l); console.log(`${l.padEnd(8)} ${150 - m.length}/150  keyingisi: ${m.slice(0, 5).join(' ') || '—'}`); }
}
