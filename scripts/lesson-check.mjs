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
    // O'zbekcha matnda o‘/g‘ faqat ‘ bilan (oddiy ' ` ʻ ʼ emas) — hamma darslarda bir xil bo'lsin
    const uz = [L.goal_uz, L.homework_uz, ...(L.scenes || []).flatMap(s => [s.say_native, s.say_uz]), ...(L.quiz || []).map(q => q.why_uz)].filter(Boolean).join('\n');
    const apo = uz.match(/[oOgG]['`ʻʼ](?=[a-z])(?!clock)/);
    if (apo) throw new Error(`o‘zbekcha matnda "${apo[0]}" — o‘ va g‘ ni faqat ‘ belgisi bilan yozing (o‘, g‘). Faylni UTF-8 da qayta yozing`);
    // `say` — o'qiladigan til: o'sha tilning o'z yozuvida, transliteratsiya yoki inglizcha emas
    const lang = path.basename(path.dirname(path.resolve(f)));
    const SCRIPT = { russian: /[\u0400-\u04FF]/, arabic: /[\u0600-\u06FF]/, chinese: /[\u4E00-\u9FFF]/, korean: /[\uAC00-\uD7AF]/ };
    const ENG = /\b(the|this|that|these|with|repeat|match|correct|sentences?|answers?|listen|say)\b/gi;
    (L.scenes || []).forEach((s, i) => {
      if (!s.say) return;
      if (SCRIPT[lang] && !SCRIPT[lang].test(s.say)) throw new Error(`#${i + 1} say "${s.say.slice(0, 40)}" — ${lang} yozuvida emas. say o'sha tilning o'z yozuvida bo'lsin (transliteratsiya emas)`);
      if (lang !== 'english' && (s.say.match(ENG) || []).length >= 2) throw new Error(`#${i + 1} say "${s.say.slice(0, 40)}" — inglizcha. say faqat ${lang} tilida bo'lsin`);
    });
    // Lotin yozuvli tillarda maxsus harflar tushib qolmasin (Kac → Kaç, Uc → Üç)
    const LETTERS = { turkish: [/[çğıİöşüÇĞŞÖÜ]/, 0.4, 'ç ğ ı İ ö ş ü'], german: [/[äöüßÄÖÜ]/, 0.08, 'ä ö ü ß'], spanish: [/[ñáéíóúü¿¡ÁÉÍÓÚÑ]/, 0.1, 'ñ á é í ó ú ¿ ¡'] };
    if (LETTERS[lang]) {
      const [rx, min, list] = LETTERS[lang];
      const says = (L.scenes || []).map(s => s.say).filter(Boolean);
      const share = says.filter(t => rx.test(t)).length / Math.max(1, says.length);
      if (share < min) throw new Error(`say qatorlarida ${lang} harflari (${list}) deyarli yo'q (${Math.round(share * 100)}%) — so'zlarni to'g'ri imlo bilan yozing (Kac emas Kaç, Uc emas Üç)`);
    }
    // Sifat: o'zbekcha tushuntirish yetarli bo'lsin va boshqa darslardan ko'chirilmagan bo'lsin
    const natives = (L.scenes || []).map(s => s.say_native || '');
    const uzWords = natives.join(' ').split(/\s+/).filter(Boolean).length;
    if (uzWords < 1300) throw new Error(`o'zbekcha tushuntirish juda kam (${uzWords} so'z, kamida 1300). Sahnalarni mayda bo'lmang — har birida qoidani misollar bilan to'liq tushuntiring`);
    const long = natives.filter(n => n.length > 60);
    if (long.length && new Set(long).size / long.length < 0.9) throw new Error(`bir xil tushuntirish shu darsda takrorlangan — har sahna o'z mazmuniga ega bo'lsin`);
    const dir = path.dirname(path.resolve(f)), me = path.basename(f);
    const others = new Set();
    for (const g of fs.readdirSync(dir)) {
      if (g === me || !/^[ABC][12]-\d\d\.json$/.test(g)) continue;
      try { for (const s of JSON.parse(fs.readFileSync(path.join(dir, g), 'utf8')).scenes || []) if ((s.say_native || '').length > 60) others.add(s.say_native); } catch {}
    }
    const copied = long.filter(n => others.has(n)).length;
    if (copied > 2) throw new Error(`${copied} ta tushuntirish boshqa darslardan so'zma-so'z ko'chirilgan — har darsni o'z mavzusi bo'yicha yangidan yozing (qolip ishlatmang)`);
    // Ko'rinmas/boshqaruv belgilari
    const ctl = raw.match(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u200B-\u200F\u2028\u2029\uFEFF]/);
    if (ctl) throw new Error(`ko'rinmas belgi U+${ctl[0].charCodeAt(0).toString(16).padStart(4, '0')} — olib tashlang`);
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
