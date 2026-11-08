#!/usr/bin/env node
// Navbatdagi ish: yozilmagan darslar VA yozilgan, lekin lesson-check'dan o'tmaydigan darslar.
//   node scripts/lesson-missing.mjs            → hamma tillar bo'yicha hisob
//   node scripts/lesson-missing.mjs russian 5  → rus tilida navbatdagi 5 ta dars ID si (tartib bo'yicha)
//   node scripts/lesson-missing.mjs russian 5 --why  → har biri nega navbatda (yozilmagan / xato matni)
// Mavjud fayl navbatda bo'lsa — uni TO'LIQ qayta yozish kerak (tuzatish emas).
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const LANGS = ['english', 'russian', 'turkish', 'german', 'spanish', 'arabic', 'chinese', 'korean'];
const IDS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].flatMap(l => Array.from({ length: 25 }, (_, i) => `${l}-${String(i + 1).padStart(2, '0')}`));

function queue(lang) {
  const dir = path.join(ROOT, 'content/uz', lang);
  const existing = IDS.filter(id => fs.existsSync(path.join(dir, id + '.json')));
  const bad = new Map();
  if (existing.length) {
    const r = spawnSync(process.execPath, [path.join(ROOT, 'scripts/lesson-check.mjs'), ...existing.map(id => path.join(dir, id + '.json'))], { encoding: 'utf8', maxBuffer: 1 << 26 });
    for (const line of (r.stdout + r.stderr).split('\n')) {
      const m = line.match(/^(❌|⚠️)\s+\S*?([ABC][12]-\d\d)\.json:?\s*(.*)$/);
      // ❌ — xato; ⚠️ — faqat "kam" (juda qisqa) bo'lsa. Uzun, lekin to'g'ri dars qayta yozilmaydi.
      if (m && (m[1] === '❌' || /kam/.test(m[3]))) bad.set(m[2], m[3].slice(0, 160));
    }
  }
  return IDS.map(id => !existing.includes(id) ? { id, why: 'yozilmagan' } : bad.has(id) ? { id, why: 'QAYTA YOZING: ' + bad.get(id) } : null).filter(Boolean);
}

const [lang, count, flag] = process.argv.slice(2);
if (lang) {
  if (!LANGS.includes(lang)) { console.error(`Til: ${LANGS.join(', ')}`); process.exit(1); }
  const q = queue(lang).slice(0, Number(count) || 150);
  console.log(flag === '--json' ? JSON.stringify(q) : flag === '--why' ? q.map(x => `${x.id}  ${x.why}`).join('\n') : q.map(x => x.id).join(' '));
} else {
  for (const l of LANGS) {
    const q = queue(l), miss = q.filter(x => x.why === 'yozilmagan').length, fix = q.length - miss;
    console.log(`${l.padEnd(8)} tayyor ${150 - q.length}/150  yozilmagan ${miss}  qayta yozish kerak ${fix}  keyingisi: ${q.slice(0, 5).map(x => x.id).join(' ') || '—'}`);
  }
}
