#!/usr/bin/env node
// Dars yozuvchi uchun yo'riqnoma: node scripts/lesson-brief.mjs english A1-04
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const require = createRequire(import.meta.url);
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const [lang = 'english', id = 'A1-01'] = process.argv.slice(2);
const cat = await import(pathToFileURL(path.join(ROOT, 'js/course-catalog.mjs')).href);
const syl = require(path.join(ROOT, 'netlify/functions/_syllabus.js'));
const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
const all = [...cat.COURSE_LEVELS.b2.lessons, ...cat.COURSE_LEVELS.c2.lessons];
const [cefr, nn] = id.split('-');
const n = Number(nn) - 1;
const no = LEVELS.indexOf(cefr) * 25 + n;               // 0..149
const meta = all[no];
const m = syl.lessonMaterial(cefr, n);
const name = no2 => { const x = all[no2]; return x ? `${LEVELS[Math.floor(no2 / 25)]}-${String(no2 % 25 + 1).padStart(2, '0')} ${x.t}` : '(kurs tugaydi)'; };
console.log(`TIL: ${lang}   DARS: ${id} (${no + 1}/150)   CEFR: ${cefr}`);
console.log(`MAVZU (o'zbekcha): ${meta.t}   ko'nikma: ${meta.skill}`);
console.log(`MAQSAD: ${m.goal}`);
console.log(`ALBATTA O'RGATILADI:\n${m.points.map((p, i) => `  ${i + 1}) ${p}`).join('\n')}`);
console.log(`UY VAZIFASI: ${m.task}`);
console.log(`TIL XUSUSIYATLARI: ${syl.LANG_NOTES[lang]}`);
console.log(`OLDINGI DARS: ${no ? name(no - 1) : '—'}`);
console.log(`KEYINGI DARS: ${name(no + 1)}`);
if (n === 24) console.log("BU DARAJA IMTIHONI: butun daraja bo'yicha takrorlash va imtihonga tayyorlash (test 15 savol).");
