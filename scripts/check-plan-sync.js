#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// check-plan-sync.js — narxlar ikkala manbada bir xilmi?
//
// js/lv-core.js                (brauzer ko'rsatadigan narx)
// netlify/functions/_plans.js  (server undiradigan narx)
//
// Bular farq qilsa, foydalanuvchi bir narxni ko'rib boshqasini to'laydi.
// Ishga tushirish:  node scripts/check-plan-sync.js
// ═══════════════════════════════════════════════════════════════════════════

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const core = fs.readFileSync(path.join(ROOT, 'js', 'lv-core.js'), 'utf8');
const { PLANS: serverPlans } = require(path.join(ROOT, 'netlify', 'functions', '_plans.js'));

// lv-core.js dan narxlarni ajratib olamiz
const clientPrices = {};
const re = /id:\s*'(\w+)',[\s\S]*?price:\s*(\d+)/g;
let m;
while ((m = re.exec(core)) !== null) {
  if (!(m[1] in clientPrices)) clientPrices[m[1]] = parseInt(m[2], 10);
}

let fail = 0;
console.log('Reja        klient      server      holat');
console.log('─────────────────────────────────────────────');

const ids = new Set([...Object.keys(serverPlans)]);
for (const id of ids) {
  const c = clientPrices[id];
  const s = serverPlans[id]?.price;
  const ok = c === s;
  if (!ok) fail++;
  console.log(
    id.padEnd(11) +
    String(c ?? '—').padEnd(11) +
    String(s ?? '—').padEnd(11) +
    (ok ? '✅' : '❌ FARQ BOR')
  );
}

// ── Video kurs narxlari: js/course-catalog.mjs ↔ _plans.js COURSE_LEVELS ──
const { COURSE_LEVELS: serverCourses } = require(path.join(ROOT, 'netlify', 'functions', '_plans.js'));
const catalog = fs.readFileSync(path.join(ROOT, 'js', 'course-catalog.mjs'), 'utf8');
const cm = /COURSE_PRICES\s*=\s*\{([^}]*)\}/.exec(catalog);
const clientCourses = {};
if (cm) for (const [, k, v] of cm[1].matchAll(/(\w+):\s*(\d+)/g)) clientCourses[k] = +v;
for (const id of Object.keys(serverCourses)) {
  const c = clientCourses[id];
  const s = serverCourses[id].price;
  const ok = c === s;
  if (!ok) fail++;
  console.log(('kurs_' + id).padEnd(11) + String(c ?? '—').padEnd(11) + String(s).padEnd(11) + (ok ? '✅' : '❌ FARQ BOR'));
}

console.log('');
if (fail) {
  console.log(`❌ ${fail} ta rejada narx farq qilyapti.`);
  console.log('   js/lv-core.js va netlify/functions/_plans.js ni moslashtiring.');
  process.exit(1);
}
console.log("✅ Narxlar mos — klient ko'rsatgan summa server undiradigan summa bilan bir xil.");
