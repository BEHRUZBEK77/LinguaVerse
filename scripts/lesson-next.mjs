#!/usr/bin/env node
// OpenCode uchun BITTA keyingi ish — hech qachon bo'sh qolmaydi:
//   node scripts/lesson-next.mjs <o'z_tili>
// 1) o'z tilining navbati (boshidan): yozilmagan yoki "QAYTA YOZING"
// 2) o'z tili tugagan bo'lsa — boshqa tillarga yordam: ularning navbatini OXIRIDAN oladi
//    (o'sha tilning o'z tabi boshidan ishlaydi — to'qnashmaydi)
// 3) hammasi tugagan bo'lsa — "HAMMASI TUGADI"
// Chiqish: "<til> <ID> <yozilmagan | QAYTA YOZING: sabab>"
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const LANGS = ['russian', 'turkish', 'spanish', 'arabic', 'chinese', 'korean', 'german', 'english'];
const own = process.argv[2];
if (!LANGS.includes(own)) { console.error(`Ishlatish: node scripts/lesson-next.mjs <til>  (${LANGS.join(', ')})`); process.exit(1); }
const queue = lang => {
  const r = spawnSync(process.execPath, [path.join(ROOT, 'scripts/lesson-missing.mjs'), lang, '150', '--json'], { encoding: 'utf8', maxBuffer: 1 << 24 });
  try { return JSON.parse(r.stdout.trim() || '[]'); } catch { return []; }
};
const mine = queue(own);
if (mine.length) { console.log(`${own} ${mine[0].id} ${mine[0].why}`); process.exit(0); }
// Boshqa tillar — tabning o'z tilidan keyingi tartibda (har tab boshqa tilga yordam beradi)
const i = LANGS.indexOf(own);
for (const l of [...LANGS.slice(i + 1), ...LANGS.slice(0, i)]) {
  const q = queue(l);
  // har bir yordamchi tab oxiridan boshqa o'rinni oladi (nemis −7, ingliz −8 …) — ikki yordamchi bir darsga tushmasin
  if (q.length) { const x = q[Math.max(0, q.length - 1 - i)]; console.log(`${l} ${x.id} ${x.why}`); process.exit(0); }
}
console.log('HAMMASI TUGADI');
