// ═══════════════════════════════════════════════════════════════════════════
// lesson-script-export.mjs — DARS SSENARIYSI → DIKTOR MATNI (.md)
//
// Har bir sahna: [SIZ] — siz o'zbekcha o'qiysiz, [AI] — chet tildagi namunani
// ElevenLabs aytadi (siz o'qimaysiz). Bitta dars = bitta audio fayl:
// [SIZ] bloklari orasida 2 soniya jim turasiz, render dasturi yozuvni shu
// jimliklar bo'yicha bo'laklarga ajratib, har birini o'z sahnasiga qo'yadi.
// ═══════════════════════════════════════════════════════════════════════════

export const LANG_UZ = {
  english: 'Ingliz tili', russian: 'Rus tili', spanish: 'Ispan tili', german: 'Nemis tili',
  turkish: 'Turk tili', arabic: 'Arab tili', korean: 'Koreys tili', chinese: 'Xitoy tili'
};

/** Dars identifikatori: A1-02 (daraja ichidagi raqam, 1 dan) */
export const lessonId = (cefr, idx) => `${cefr}-${String((idx % 25) + 1).padStart(2, '0')}`;

/** Ovoz fayli qayerga qo'yiladi (ovozlar/ papkasiga nisbatan) */
export const recordingName = (native, lang, cefr, idx) => `${native}/${lang}/${lessonId(cefr, idx)}`;

const words = s => (String(s || '').trim().match(/\S+/g) || []).length;

/** O'zbekcha o'qish vaqti (daqiqa) — o'rtacha 120 so'z/daqiqa */
export function readMinutes(core) {
  const w = (core?.scenes || []).reduce((a, s) => a + words(s.say_native), 0);
  return Math.max(1, Math.round(w / 120));
}

export function toMarkdown({ lang, cefr, idx, meta, core, native = 'uz', estSeconds }) {
  const id = lessonId(cefr, idx);
  const scenes = (core?.scenes || []).filter(s => s.say_native);
  const out = [];
  out.push(`# ${LANG_UZ[lang] || lang} · ${cefr} · ${(idx % 25) + 1}-dars — ${core.title || meta?.t || ''}`);
  out.push('');
  if (core.goal_uz) out.push(`**Maqsad:** ${core.goal_uz}`, '');
  out.push(`- Video davomiyligi: ~${Math.round((estSeconds || 0) / 60) || '?'} daqiqa`);
  out.push(`- Siz o'qiydigan qism: ~${readMinutes(core)} daqiqa, **${scenes.length} ta blok**`);
  out.push(`- Ovoz fayli nomi: \`ovozlar/${recordingName(native, lang, cefr, idx)}.m4a\` (mp3/wav ham bo'ladi)`);
  out.push('');
  out.push('> **Qanday yozasiz:** faqat 🎙 **SIZ** bloklarini ketma-ket o\'qing. Har blokdan keyin **2 soniya jim turing**, blok ichida esa 1 soniyadan uzoq to\'xtamang. 🤖 AI qatorlarini o\'qimang: ularni ElevenLabs chet tilida aytadi. Xato qilsangiz, xato joyni diktofon ilovasida kesib tashlang. Boshqa yo\'l: har blokni alohida faylga yozing (`' + lessonId(cefr, idx) + '/01.m4a`, `02.m4a`, …).');
  out.push('');
  if (core.vocab?.length) {
    out.push('## Lug\'at (ekranda chiqadi)', '');
    for (const v of core.vocab) out.push(`- **${v.w}** — ${v.uz}`);
    out.push('');
  }
  out.push('---', '');
  scenes.forEach((s, i) => {
    out.push(`### ${i + 1}. ${s.title || ''}`);
    if (s.board?.length) out.push(`_Ekranda:_ ${s.board.join(' · ')}`);
    out.push('');
    out.push(`🎙 **SIZ [${i + 1}/${scenes.length}]:**`);
    out.push('');
    out.push(String(s.say_native).trim());
    out.push('');
    out.push('⏸ _2 soniya jim turing_');
    out.push('');
    if (s.say) {
      out.push(`🤖 **AI** (${LANG_UZ[lang] || lang}da, siz o'qimaysiz): ${String(s.say).trim()}`);
      if (s.say_uz) out.push(`_Tarjimasi:_ ${String(s.say_uz).trim()}`);
    }
    if (s.practice_seconds) out.push(`✍️ _O'quvchiga mashq uchun ${s.practice_seconds} soniya_`);
    out.push('', '---', '');
  });
  if (core.homework_uz) out.push('## Uyga vazifa', '', core.homework_uz, '');
  out.push(`_Dars kodi: ${native}_${lang}_${id}_`);
  return out.join('\n');
}

/** Bitta til uchun mundarija */
export function indexMarkdown(lang, rows, native = 'uz') {
  const out = [`# ${LANG_UZ[lang] || lang} — 150 ta dars ssenariysi (${native})`, ''];
  out.push(`Tayyor: **${rows.filter(r => r.ready).length} / ${rows.length}**`, '');
  out.push('| Dars | Mavzu | Siz o\'qiysiz | Holat |', '|---|---|---|---|');
  for (const r of rows) {
    out.push(`| ${r.id} | ${r.ready ? `[${r.title}](${r.id}.md)` : r.title} | ${r.ready ? `~${r.minutes} daq, ${r.blocks} blok` : '—'} | ${r.ready ? '✅' : '⏳'} |`);
  }
  return out.join('\n') + '\n';
}

/** Yozuvni N blokka bo'lish: eng uzun N-1 jimlik — chegaralar (vaqt bo'yicha tartiblangan). */
export function cutPoints(silences, count) {
  if (count <= 1) return [];
  if (silences.length < count - 1) return null;
  return [...silences].sort((a, b) => (b.end - b.start) - (a.end - a.start)).slice(0, count - 1)
    .sort((a, b) => a.start - b.start).map(s => (s.start + s.end) / 2);
}

/** Til bo'yicha dars raqami (1–150): A1-01 → 1, B2-25 → 100, C2-25 → 150 */
export const lessonNumber = (cefr, n) => ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].indexOf(cefr) * 25 + n + 1;

/** Oddiy diktor matni: sarlavha va o'qiladigan bloklar, boshqa hech narsa yo'q. */
export function toPlainText({ lang, cefr, idx, core }) {
  const blocks = (core?.scenes || []).map(s => String(s.say_native || '').trim()).filter(Boolean);
  return `${LANG_UZ[lang] || lang}. ${lessonNumber(cefr, idx)}-dars. ${core.title}\n\n` + blocks.join('\n\n') + '\n';
}
