#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// generate-scripts.mjs — 8 TIL × 150 DARS SSENARIYSI (ona tili: uz)
//
// Har bir darsni sayt AI ustozi yozadi (course.js → ensureLesson: ~30 daqiqalik,
// 5 daqiqalik qismlar + test) va Supabase'da saqlaydi. Keyin diktor matni
// ssenariylar/<native>/<lang>/<A1-01>.md fayllariga chiqariladi.
// To'xtab qolsa, qayta ishga tushganda tayyor qismlardan davom etadi.
//
//   node scripts/generate-scripts.mjs --langs english --max 25
//   node scripts/generate-scripts.mjs --export-only         (AI chaqirmaydi)
// Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY; AI kalitlari admin paneldan.
// ═══════════════════════════════════════════════════════════════════════════
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { toMarkdown, indexMarkdown, lessonId, readMinutes } from './lesson-script-export.mjs';

const require = createRequire(import.meta.url);
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, all) => {
  if (a.startsWith('--')) acc.push([a.slice(2), all[i + 1] && !all[i + 1].startsWith('--') ? all[i + 1] : true]);
  return acc;
}, []));

const cat = await import(pathToFileURL(path.join(ROOT, 'js', 'course-catalog.mjs')).href);
const ALL = cat.COURSE_LANGS.map(l => l.id);
const LANGS = !args.langs || args.langs === 'all' ? ALL : String(args.langs).split(',').filter(l => ALL.includes(l));
const NATIVE = String(args.native || 'uz');
const MAX = Number(args.max || 1e9);                       // shu ishga tushishda ko'pi bilan nechta yangi dars
const DEADLINE = Date.now() + Number(args.minutes || 1e6) * 60000;
const OUT = path.resolve(args.out || path.join(ROOT, 'ssenariylar'));

const keys = require(path.join(ROOT, 'netlify/functions/_keys.js'));
const fsdb = require(path.join(ROOT, 'netlify/functions/_firestore.js'));
const course = require(path.join(ROOT, 'netlify/functions/course.js'));
const syllabus = require(path.join(ROOT, 'netlify/functions/_syllabus.js'));
await keys.refreshFromFirestore();

/** Bitta til: 150 dars (b2 kursi 0–99 = A1–B2, c2 kursi 0–49 = C1–C2) */
const lessonsOf = () => ['b2', 'c2'].flatMap(level => cat.COURSE_LEVELS[level].lessons.map((meta, idx) => ({ level, idx, meta })));
const pathOf = (lang, level, idx) => `courseLessons/v4_${NATIVE}_${lang}_${level}_${idx}`;

async function exportLang(lang) {
  const dir = path.join(OUT, NATIVE, lang);
  fs.mkdirSync(dir, { recursive: true });
  const rows = [];
  for (const { level, idx, meta } of lessonsOf()) {
    const cefr = meta.cefr;
    const n = syllabus.indexInLevel(level, idx);
    const id = lessonId(cefr, n);
    const doc = await fsdb.getDoc(pathOf(lang, level, idx)).catch(() => null);
    const ready = !!(doc?.core && doc.partsDone >= doc.partsTotal);
    const core = ready ? JSON.parse(doc.core) : null;
    if (ready) fs.writeFileSync(path.join(dir, `${id}.md`), toMarkdown({ lang, cefr, idx: n, meta, core, native: NATIVE, estSeconds: doc.estSeconds }));
    rows.push({ id, title: core?.title || meta.t, ready, minutes: core ? readMinutes(core) : 0, blocks: core ? core.scenes.filter(s => s.say_native).length : 0 });
  }
  fs.writeFileSync(path.join(dir, 'README.md'), indexMarkdown(lang, rows, NATIVE));
  return rows.filter(r => r.ready).length;
}

let made = 0, failed = 0;
if (!args['export-only']) {
  outer: for (const lang of LANGS) {
    for (const { level, idx, meta } of lessonsOf()) {
      if (made >= MAX || Date.now() > DEADLINE) break outer;
      const doc = await fsdb.getDoc(pathOf(lang, level, idx)).catch(() => null);
      if (doc?.core && doc.partsDone >= doc.partsTotal && doc.quiz) continue;
      const t0 = Date.now();
      try {
        await course.ensureLesson(lang, level, idx, NATIVE, { tier: 'script' });
        made++;
        console.log(`✅ ${lang} ${lessonId(meta.cefr, syllabus.indexInLevel(level, idx))} — ${meta.t} (${Math.round((Date.now() - t0) / 1000)}s)`);
      } catch (e) {
        failed++;
        console.warn(`⚠️ ${lang} ${level}#${idx}: ${e.message}`);
        if (failed >= 12 && failed > made) { console.error("Ko'p xato — AI kaliti yoki balansni tekshiring. To'xtadim."); break outer; }
      }
    }
  }
}
for (const lang of LANGS) console.log(`📄 ${lang}: ${await exportLang(lang)}/150 ssenariy fayli`);
console.log(`Yangi dars: ${made}, xato: ${failed}`);
if (failed && !made && !args['export-only']) process.exitCode = 1;
