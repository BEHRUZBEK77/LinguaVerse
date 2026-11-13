#!/usr/bin/env node
// subjects/<fan>.json fayllarini bitta subjects/catalog.json ga yig'adi va tekshiradi.
import fs from 'node:fs';
import path from 'node:path';
const dir = path.resolve(import.meta.dirname, '..', 'subjects');
export const ORDER = ['matematika', 'algebra', 'geometriya', 'fizika', 'kimyo', 'biologiya', 'tabiiy-fan', 'geografiya',
  'ozbekiston-tarixi', 'jahon-tarixi', 'ona-tili', 'adabiyot', 'informatika', 'huquq', 'iqtisodiyot', 'astronomiya'];
// Oʻzbek apostroflarini bir xil qiladi: oʻ/gʻ → U+02BB, tutuq belgisi → U+02BC
const uz = (x) => String(x || '').trim().replace(/([oOgG])['‘’`ʼ]/g, '$1ʻ').replace(/['’`]/g, 'ʼ');
const subjects = [];
for (const id of ORDER) {
  const s = JSON.parse(fs.readFileSync(path.join(dir, `${id}.json`), 'utf8'));
  if (s.id !== id) throw new Error(`${id}: id mos emas`);
  const grades = {};
  for (const [g, list] of Object.entries(s.grades)) {
    if (!/^(?:[1-9]|1[01])$/.test(g)) throw new Error(`${id}: noto'g'ri sinf ${g}`);
    const seen = new Set();
    grades[g] = list.map((t, i) => {
      const title = uz(t.t);
      if (!title || title.length > 140) throw new Error(`${id} ${g}-sinf #${i + 1}: sarlavha`);
      if (seen.has(title.toLowerCase())) throw new Error(`${id} ${g}-sinf: takror "${title}"`);
      seen.add(title.toLowerCase());
      return { t: title, k: (Array.isArray(t.k) ? t.k : []).map(uz).filter(Boolean).slice(0, 4) };
    });
    if (grades[g].length < 10) throw new Error(`${id} ${g}-sinf: juda kam mavzu (${grades[g].length})`);
  }
  subjects.push({ id, name: uz(s.name), grades });
}
fs.writeFileSync(path.join(dir, 'catalog.json'), JSON.stringify({ updated: new Date().toISOString().slice(0, 10), subjects }));
const total = subjects.reduce((n, s) => n + Object.values(s.grades).reduce((m, l) => m + l.length, 0), 0);
console.log(`${subjects.length} fan, ${total} mavzu`);
