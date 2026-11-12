#!/usr/bin/env node
// Lug'at ma'lumotini yasaydi: har til uchun eng ko'p ishlatiladigan 40 000 so'z.
// Manba: hermitdave/FrequencyWords (OpenSubtitles 2018), CC BY-SA 4.0.
//   node scripts/build-vocab.mjs <frequencywords/content/2018 papkasi>
// Natija: vocab/<til>/<n>.json  (har faylda 2000 so'z, tartib = chastota o'rni)
//         vocab/index.json             (tillar, sonlar, daraja chegaralari, manba)
import fs from 'node:fs';
import path from 'node:path';

const SRC = process.argv[2];
if (!SRC) { console.error('Foydalanish: node scripts/build-vocab.mjs <content/2018>'); process.exit(1); }
const OUT = path.resolve(import.meta.dirname, '..', 'vocab');
const TARGET = 40000, CHUNK = 2000;

const LANGS = {
  english: { src: 'en', re: /^[a-z]+(?:['-][a-z]+)*$/, keep1: new Set(['a', 'i']) },
  russian: { src: 'ru', re: /^[а-яё]+(?:-[а-яё]+)*$/, keep1: new Set(['я', 'и', 'в', 'с', 'к', 'о', 'у', 'а']) },
  turkish: { src: 'tr', re: /^[a-zçğıöşüâîû]+$/, keep1: new Set(['o']) },
  german:  { src: 'de', re: /^[a-zäöüß]+(?:-[a-zäöüß]+)*$/, keep1: new Set() },
  spanish: { src: 'es', re: /^[a-záéíóúñü]+$/, keep1: new Set(['a', 'y', 'o', 'e', 'u']) },
  arabic:  { src: 'ar', re: /^[ء-غف-ي]+$/, keep1: new Set(['و']) },
  chinese: { src: 'zh_cn', re: /^[一-鿿]+$/, keep1: null },
  korean:  { src: 'ko', re: /^[가-힣]+$/, keep1: null },
};
// Taxminiy CEFR: chastota o'rni bo'yicha (rasmiy ro'yxat emas)
const BANDS = [[500, 'A1'], [1500, 'A2'], [3000, 'B1'], [5000, 'B2'], [10000, 'C1'], [TARGET, 'C2']];

fs.rmSync(OUT, { recursive: true, force: true });
const index = { source: 'FrequencyWords (OpenSubtitles 2018) — hermitdave, CC BY-SA 4.0', chunk: CHUNK, bands: BANDS, langs: {} };
for (const [lang, cfg] of Object.entries(LANGS)) {
  const lines = fs.readFileSync(path.join(SRC, cfg.src, `${cfg.src}_50k.txt`), 'utf8').split('\n');
  const seen = new Set(), words = [];
  for (const line of lines) {
    const w = line.split(' ')[0]?.normalize('NFC').trim();
    if (!w || seen.has(w) || !cfg.re.test(w) || w.length > 30) continue;
    if (cfg.keep1 && [...w].length === 1 && !cfg.keep1.has(w)) continue;
    seen.add(w); words.push(w);
    if (words.length === TARGET) break;
  }
  fs.mkdirSync(path.join(OUT, lang), { recursive: true });
  for (let i = 0; i * CHUNK < words.length; i++)
    fs.writeFileSync(path.join(OUT, lang, `${i}.json`), JSON.stringify(words.slice(i * CHUNK, (i + 1) * CHUNK)));
  index.langs[lang] = words.length;
  console.log(lang, words.length);
}
fs.writeFileSync(path.join(OUT, 'index.json'), JSON.stringify(index, null, 1));
