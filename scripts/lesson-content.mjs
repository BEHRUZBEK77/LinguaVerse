#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// lesson-content.mjs — QO'LDA YOZILGAN DARSLAR (content/<native>/<lang>/A1-01.json)
//
//   node scripts/lesson-content.mjs            → ssenariylar/ (diktor matni) + tekshiruv
//   node scripts/lesson-content.mjs --sql out.sql → Supabase'ga yozish uchun SQL
//   node scripts/lesson-content.mjs --push     → SUPABASE_* env bo'lsa to'g'ridan-to'g'ri
// Darslar saytda AI yozgan darslar o'rnida ko'rinadi (courseLessons/v4_...).
// ═══════════════════════════════════════════════════════════════════════════
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { toPlainText, lessonNumber, LANG_UZ } from './lesson-script-export.mjs';

const require = createRequire(import.meta.url);
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const CONTENT = path.join(ROOT, 'content');
const args = process.argv.slice(2);
const KINDS = ['intro', 'explain', 'example', 'mistake', 'practice', 'recap'];
const EMOS = ['neutral', 'happy', 'proud', 'impressed', 'encouraging', 'thinking', 'stern', 'disappointed', 'surprised'];
const CEFR_RATE = { A1: 0.85, A2: 0.88, B1: 0.92, B2: 0.95, C1: 1, C2: 1 };

/** A1-01 → { level:'b2', idx:0, cefr:'A1', n:0 } (b2 kursi: A1–B2, c2 kursi: C1–C2) */
export function locate(id) {
  const m = /^(A1|A2|B1|B2|C1|C2)-(\d{2})$/.exec(id);
  if (!m) return null;
  const n = Number(m[2]) - 1;
  if (n < 0 || n > 24) return null;
  const order = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].indexOf(m[1]);
  return order < 4 ? { level: 'b2', idx: order * 25 + n, cefr: m[1], n } : { level: 'c2', idx: (order - 4) * 25 + n, cefr: m[1], n };
}

export function validate(L, file) {
  const err = [];
  if (!L.title || !L.goal_uz || !L.homework_uz) err.push('title/goal_uz/homework_uz');
  if (!Array.isArray(L.vocab) || L.vocab.length < 6) err.push('vocab < 6');
  if (!Array.isArray(L.scenes) || L.scenes.length < 20) err.push('sahna < 20');
  (L.scenes || []).forEach((s, i) => {
    if (!KINDS.includes(s.kind)) err.push(`#${i + 1} kind`);
    if (!EMOS.includes(s.emotion)) err.push(`#${i + 1} emotion`);
    if (!s.say || s.say.length > 520) err.push(`#${i + 1} say`);
    if (!s.say_native || s.say_native.length > 900) err.push(`#${i + 1} say_native`);
    if (!s.say_uz) err.push(`#${i + 1} say_uz`);
    if (/\[(your|sizning)/i.test(s.say + s.say_native)) err.push(`#${i + 1} to'ldirilmagan joy`);
  });
  const quiz = L.quiz || [];
  if (quiz.length < 8 || quiz.some(q => q.options?.length !== 4 || !(q.answer >= 0 && q.answer < 4) || !q.why_uz)) err.push('test');
  if (err.length) throw new Error(`${file}: ${err.join(', ')}`);
}

export function loadAll() {
  const out = [];
  if (!fs.existsSync(CONTENT)) return out;
  for (const native of fs.readdirSync(CONTENT).filter(d => fs.statSync(path.join(CONTENT, d)).isDirectory())) {
    for (const lang of fs.readdirSync(path.join(CONTENT, native))) {
      for (const f of fs.readdirSync(path.join(CONTENT, native, lang)).filter(f => f.endsWith('.json')).sort()) {
        const id = f.replace(/\.json$/, '');
        const loc = locate(id);
        if (!loc) throw new Error(`Noto'g'ri fayl nomi: ${native}/${lang}/${f}`);
        const L = JSON.parse(fs.readFileSync(path.join(CONTENT, native, lang, f), 'utf8'));
        validate(L, `${native}/${lang}/${f}`);
        out.push({ native, lang, id, ...loc, L });
      }
    }
  }
  return out;
}

function toDoc({ native, lang, level, idx, cefr, L }) {
  const course = require(path.join(ROOT, 'netlify/functions/course.js'));
  const { quiz, ...core } = L;
  return {
    path: `courseLessons/v4_${native}_${lang}_${level}_${idx}`,
    data: {
      core: JSON.stringify(core), quiz: JSON.stringify(quiz),
      partsTotal: 6, partsDone: 6, extraParts: 0,
      estSeconds: Math.round(course.estimateSeconds(core, CEFR_RATE[cefr] || 1)),
      lang, level, nativeLang: native, n: idx, backend: 'manual', authored: 'manual',
      createdAt: { $t: new Date().toISOString() }
    }
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();

async function main() {
  const lessons = loadAll();
  // Diktor matni: ssenariylar/<native>/<Ingliz tili>/001-dars.txt — faqat o'qiladigan matn
  for (const x of lessons) {
    const dir = path.join(ROOT, 'ssenariylar', x.native, LANG_UZ[x.lang] || x.lang);
    fs.mkdirSync(dir, { recursive: true });
    const name = `${String(lessonNumber(x.cefr, x.n)).padStart(3, '0')}-dars.txt`;
    fs.writeFileSync(path.join(dir, name), toPlainText({ lang: x.lang, cefr: x.cefr, idx: x.n, core: x.L }));
    console.log(`📄 ${x.native}/${x.lang} ${x.id} → ${name} (~${Math.round(toDoc(x).data.estSeconds / 60)} daq video)`);
  }

  const sqlIdx = args.indexOf('--sql');
  if (sqlIdx >= 0) {
    const q = s => '$lv$' + s + '$lv$';
    const sql = lessons.map(toDoc).map(d =>
      `insert into public.docs (path, col, parent, data) values (${q(d.path)}, 'courseLessons', '', ${q(JSON.stringify(d.data))}::jsonb)\n` +
      `on conflict (path) do update set data = excluded.data, version = docs.version + 1, updated_at = now();`
    ).join('\n');
    fs.writeFileSync(args[sqlIdx + 1], sql);
    console.log(`SQL: ${args[sqlIdx + 1]} (${lessons.length} dars)`);
  }
  if (args.includes('--push')) {
    const fsdb = require(path.join(ROOT, 'netlify/functions/_firestore.js'));
    for (const d of lessons.map(toDoc)) { await fsdb.setDoc(d.path, { ...d.data, createdAt: new Date() }); console.log('↑', d.path); }
  }
}
