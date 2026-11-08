#!/usr/bin/env node
// Ish holati: har til bo'yicha nechta dars GitHub'da, oxirgi dars qachon, to'xtab qolganmi.
//   node scripts/holat.mjs          (avval `git fetch` qiladi)
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const sh = c => { try { return execSync(c, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch { return ''; } };
const LANGS = ['english', 'russian', 'turkish', 'german', 'spanish', 'arabic', 'chinese', 'korean'];
const G = '\x1b[32m', Y = '\x1b[33m', R = '\x1b[31m', D = '\x1b[2m', X = '\x1b[0m';

sh('git fetch -q origin main');
const ref = sh('git rev-parse -q --verify origin/main') ? 'origin/main' : 'HEAD';
const now = Date.now() / 1000;
const ago = s => s < 3600 ? `${Math.round(s / 60)} daq oldin` : s < 86400 ? `${(s / 3600).toFixed(1)} soat oldin` : `${Math.round(s / 86400)} kun oldin`;

console.log(`\nLinguaVerse — holat (${new Date().toLocaleString('uz-UZ')})\n`);
let total = 0;
for (const l of LANGS) {
  const n = sh(`git ls-tree --name-only ${ref} content/uz/${l}/`).split('\n').filter(f => /[ABCP][12]-\d\d\.json$/.test(f)).length;
  total += n;
  const t = Number(sh(`git log -1 --format=%ct ${ref} -- content/uz/${l}/`)) || 0;
  const age = t ? now - t : Infinity;
  const done = n >= 200;
  const c = done ? G : age < 3600 ? G : age < 3 * 3600 ? Y : R;
  const st = done ? 'TUGADI' : age < 3600 ? 'ishlayapti' : age < 3 * 3600 ? 'sekin' : "TO'XTAGAN";
  const bar = '█'.repeat(Math.round(n / 10)) + '░'.repeat(20 - Math.round(n / 10));
  console.log(`${c}${st.padEnd(11)}${X} ${l.padEnd(8)} ${bar} ${String(n).padStart(3)}/200  ${D}oxirgi dars: ${t ? ago(age) : '—'}${X}`);
}
console.log(`\nJami: ${total} / ${LANGS.length * 200} dars (har tilda 150 asosiy + 50 PRO)`);

// Avtomatik yozish skriptining oxirgi xabarlari (bo'lsa)
const dir = path.join(ROOT, '.overnight');
if (fs.existsSync(dir)) {
  const logs = fs.readdirSync(dir).filter(f => f.startsWith('log-'));
  if (logs.length) console.log(`\nAvtomatik yozish (oxirgi xabar):`);
  for (const f of logs) {
    const lines = fs.readFileSync(path.join(dir, f), 'utf8').trim().split('\n');
    console.log(`  ${D}${lines.at(-1)}${X}`);
  }
}
const q = sh(`"${process.execPath}" scripts/lesson-missing.mjs`);
if (q) console.log(`\nNavbat (yozilmagan / sifat tekshiruvidan o'tmagan — qayta yoziladi):\n${q.split('\n').map(l => '  ' + l).join('\n')}`);
const local = sh('git status --porcelain content/').split('\n').filter(Boolean);
if (local.length) console.log(`\n${Y}Kompyuterda GitHub'ga yuklanmagan ${local.length} ta dars fayli bor${X} (OpenCode hali yozyapti yoki tekshiruvdan o'tmagan).`);
console.log('');
