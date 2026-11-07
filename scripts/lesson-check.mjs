#!/usr/bin/env node
// Bitta dars faylini tekshirish: node scripts/lesson-check.mjs content/uz/english/A1-04.json
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { validate, locate } from './lesson-content.mjs';
const require = createRequire(import.meta.url);
const course = require(path.resolve('netlify/functions/course.js'));
const RATE = { A1: 0.85, A2: 0.88, B1: 0.92, B2: 0.95, C1: 1, C2: 1 };
let bad = 0;
for (const f of process.argv.slice(2)) {
  try {
    const id = path.basename(f, '.json');
    const loc = locate(id);
    if (!loc) throw new Error("fayl nomi A1-01 ko'rinishida bo'lishi kerak");
    const raw = fs.readFileSync(f, 'utf8');
    // Buzilgan kodlash (UTF-8 → Windows-1252): o‘ → oâ€˜, ī → Ä«, п → Ð¿
    const moji = raw.match(/â€|[ÃÄÅÐÑ][\u0080-\u00BF]|\uFFFD/);
    if (moji) throw new Error(`matn kodlashi buzilgan ("${raw.slice(Math.max(0, moji.index - 15), moji.index + 15)}"). Faylni UTF-8 da qayta yozing (PowerShell Out-File/Set-Content ishlatmang)`);
    const L = JSON.parse(raw);
    validate(L, f);
    if (loc.n === 24 && L.quiz.length < 15) throw new Error('imtihon darsida test kamida 15 savol');
    const min = course.estimateSeconds(L, RATE[loc.cefr]) / 60;
    const words = L.scenes.reduce((a, s) => a + s.say_native.split(/\s+/).length, 0);
    const ok = min >= 23 && min <= 32;
    console.log(`${ok ? '✅' : '⚠️'} ${f}: ${L.scenes.length} sahna, ~${min.toFixed(1)} daq video, o'zbekcha ${words} so'z, test ${L.quiz.length}${ok ? '' : min < 23 ? ' — 23 daqiqadan kam, sahna qo\'shing' : ' — 32 daqiqadan uzun, qisqartiring'}`);
    if (!ok) bad++;
  } catch (e) { bad++; console.log(`❌ ${f}: ${e.message}`); }
}
process.exitCode = bad ? 1 : 0;
