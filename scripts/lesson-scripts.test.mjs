// Diktor ssenariysi eksporti va yozuvni bloklarga bo'lish
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { toMarkdown, indexMarkdown, lessonId, recordingName, cutPoints } from './lesson-script-export.mjs';

assert.equal(lessonId('A1', 1), 'A1-02');
assert.equal(lessonId('C2', 49), 'C2-25');
assert.equal(recordingName('uz', 'english', 'B1', 0), 'uz/english/B1-01');

const core = {
  title: 'Salomlashish', goal_uz: "Salomlasha olasiz", vocab: [{ w: 'hello', uz: 'salom' }],
  scenes: [
    { title: 'Kirish', board: ['Hello!'], say_native: "Assalomu alaykum, bugun salomlashamiz.", say: 'Hello! Good morning.', say_uz: 'Salom! Xayrli tong.', practice_seconds: 0 },
    { title: 'Mashq', board: [], say_native: "Endi siz ayting.", say: 'Say hello.', say_uz: 'Salom deng.', practice_seconds: 8 }
  ],
  homework_uz: "O'zingizni tanishtiring."
};
const md = toMarkdown({ lang: 'english', cefr: 'A1', idx: 1, meta: { t: 'Salom' }, core, estSeconds: 1500 });
assert.match(md, /^# Ingliz tili · A1 · 2-dars — Salomlashish/);
assert.match(md, /SIZ \[1\/2\]/);
assert.match(md, /SIZ \[2\/2\]/);
assert.match(md, /ovozlar\/uz\/english\/A1-02\.m4a/);
assert.match(md, /AI\*\* \(Ingliz tilida, siz o'qimaysiz\): Hello! Good morning\./);
assert.match(md, /mashq uchun 8 soniya/);
assert.match(indexMarkdown('english', [{ id: 'A1-01', title: 'X', ready: true, minutes: 20, blocks: 40 }, { id: 'A1-02', title: 'Y', ready: false }]), /Tayyor: \*\*1 \/ 2\*\*/);

// Eng uzun N-1 jimlik — chegara; blok ichidagi qisqa pauza bo'lmaydi
assert.deepEqual(cutPoints([{ start: 1, end: 2.3 }, { start: 3, end: 4.2 }, { start: 6, end: 8.5 }], 2), [7.25]);
assert.deepEqual(cutPoints([{ start: 1, end: 3 }, { start: 5, end: 7 }], 3), [2, 6]);
assert.equal(cutPoints([{ start: 1, end: 3 }], 3), null);
assert.deepEqual(cutPoints([], 1), []);

// Haqiqiy audio: 3 blok, orasida 2 s jimlik, 2-blok ichida 1.3 s pauza
if (spawnSync('ffmpeg', ['-version']).status === 0) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'lvrec-'));
  const f = path.join(d, 'rec.wav');
  const seg = (s) => `sine=f=440:d=${s}`;
  const sil = (s) => `anullsrc=r=44100:cl=mono:d=${s}`;
  const parts = [seg(2), sil(2), seg(1.5), sil(1.3), seg(1.5), sil(2.2), seg(2)];
  const inputs = parts.flatMap(p => ['-f', 'lavfi', '-i', p]);
  const r = spawnSync('ffmpeg', ['-v', 'error', '-y', ...inputs, '-filter_complex', parts.map((_, i) => `[${i}:a]aresample=44100,aformat=channel_layouts=mono[a${i}]`).join(';') + ';' + parts.map((_, i) => `[a${i}]`).join('') + `concat=n=${parts.length}:v=0:a=1`, f]);
  assert.equal(r.status, 0, r.stderr?.toString());
  const out = spawnSync('ffmpeg', ['-hide_banner', '-i', f, '-af', 'silencedetect=noise=-35dB:d=1.2', '-f', 'null', '-'], { encoding: 'utf8' }).stderr;
  const sil2 = [...out.matchAll(/silence_start: ([\d.]+)[\s\S]*?silence_end: ([\d.]+)/g)].map(m => ({ start: +m[1], end: +m[2] }));
  assert.equal(sil2.length, 3);
  const cuts = cutPoints(sil2, 3);
  assert.ok(Math.abs(cuts[0] - 3) < 0.2 && Math.abs(cuts[1] - 9.4) < 0.2, JSON.stringify(cuts));
  fs.rmSync(d, { recursive: true, force: true });
}
console.log('lesson-scripts: ok');
