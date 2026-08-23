#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// check-wiring.js — LV modullari sahifalarga to'g'ri ulanganmi?
//
// Nega kerak: modul ulanishi jimgina yo'qolishi mumkin (tahrirlash paytida
// yoki avtomatik skript noto'g'ri ishlaganda). O'shanda sahifa xatosiz
// ochiladi, lekin limitlar hisoblanmaydi, do'kon chiqmaydi, panel yo'q.
//
// Ishga tushirish:  node scripts/check-wiring.js
// ═══════════════════════════════════════════════════════════════════════════

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

// Sahifa → kerakli modullar (ulanish nuqtasi bilan)
const EXPECT = {
  'languages-html/English.html':        { mods: ['lv-ai-bridge', 'lv-status-bar', 'lv-vocab-room'], mounts: ['lvVocabRoom'] },
  'languages-html/German.html':         { mods: ['lv-ai-bridge', 'lv-status-bar', 'lv-vocab-room'], mounts: ['lvVocabRoom'] },
  'languages-html/Korean.html':         { mods: ['lv-ai-bridge', 'lv-status-bar', 'lv-vocab-room'], mounts: ['lvVocabRoom'] },
  'languages-html/Russia.html':         { mods: ['lv-ai-bridge', 'lv-status-bar', 'lv-vocab-room'], mounts: ['lvVocabRoom'] },
  'languages-html/Spain.html':          { mods: ['lv-ai-bridge', 'lv-status-bar', 'lv-vocab-room'], mounts: ['lvVocabRoom'] },
  'languages-html/Turkish.html':        { mods: ['lv-ai-bridge', 'lv-status-bar', 'lv-vocab-room'], mounts: ['lvVocabRoom'] },
  'languages-html/Arabic.html':         { mods: ['lv-ai-bridge', 'lv-status-bar', 'lv-vocab-room'], mounts: ['lvVocabRoom'] },
  'languages-html/Chinese.html':        { mods: ['lv-ai-bridge', 'lv-status-bar', 'lv-vocab-room'], mounts: ['lvVocabRoom'] },
  'languages-html/speaking-coach.html': { mods: ['lv-ai-bridge', 'lv-status-bar'], mounts: [] },
  'languages-html/language.html':       { mods: ['lv-ai-bridge', 'lv-status-bar'], mounts: [] },
  'languages-html/profile.html':        { mods: ['lv-status-bar', 'lv-profile-panel'], mounts: ['lvProfilePanel'] },
  'languages-html/shop.html':           { mods: ['lv-shop-items'], mounts: ['lvMegaShop'] },
  'index.html':                         { mods: [], mounts: [] }
};

let fail = 0;
console.log('Sahifa                                modullar  ulanish  holat');
console.log('─'.repeat(72));

for (const [rel, want] of Object.entries(EXPECT)) {
  const file = path.join(ROOT, rel);
  if (!fs.existsSync(file)) {
    console.log('  ' + rel.padEnd(36) + '  —        —        ❌ fayl yo\'q');
    fail++;
    continue;
  }

  const html = fs.readFileSync(file, 'utf8');
  const problems = [];

  // Modul HAQIQIY <script> tegi bilan ulanganmi? (izoh hisoblanmaydi)
  for (const m of want.mods) {
    const re = new RegExp(`<script[^>]+src=["'][^"']*${m}\\.js["']`);
    if (!re.test(html)) problems.push('ulanmagan: ' + m);

    const count = (html.match(new RegExp(`<script[^>]+${m}\\.js`, 'g')) || []).length;
    if (count > 1) problems.push('takror: ' + m);
  }

  // Ulanish nuqtasi (div) bormi?
  for (const id of want.mounts) {
    if (!new RegExp(`id=["']${id}["']`).test(html)) problems.push('div yo\'q: ' + id);
  }

  // Modul tartibi: lv-ai-bridge sahifa kodidan OLDIN bo'lishi kerak
  if (want.mods.includes('lv-ai-bridge')) {
    const bridge = html.search(/<script[^>]+lv-ai-bridge\.js/);
    const pageJs = html.search(/<script[^>]+src=["']\.\/js\//);
    if (bridge >= 0 && pageJs >= 0 && bridge > pageJs) {
      problems.push('lv-ai-bridge sahifa kodidan KEYIN');
    }
  }

  const ok = problems.length === 0;
  if (!ok) fail++;

  console.log('  ' + rel.padEnd(36) +
    String(want.mods.length).padEnd(9) +
    String(want.mounts.length).padEnd(9) +
    (ok ? '✅' : '❌ ' + problems.join(', ')));
}

console.log('');
if (fail) {
  console.log(`❌ ${fail} ta sahifada muammo.`);
  process.exit(1);
}
console.log('✅ Barcha modullar to\'g\'ri ulangan.');
