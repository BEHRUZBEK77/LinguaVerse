import test from 'node:test';
import assert from 'node:assert';
import { lessonHashes, pushPlan } from './lesson-content.mjs';

const L = { title: 'T', scenes: [{ say: 'a' }], quiz: [{ q: 'Which?', options: ['a', 'b', 'c', 'd'], answer: 0 }] };

test('videoHash: test savoli o\'zgarsa o\'zgarmaydi, sahna o\'zgarsa o\'zgaradi', () => {
  const a = lessonHashes(L);
  const quizOnly = lessonHashes({ ...L, quiz: [{ ...L.quiz[0], q: 'Qaysi?' }] });
  assert.notStrictEqual(a.hash, quizOnly.hash);
  assert.strictEqual(a.videoHash, quizOnly.videoHash);
  const scene = lessonHashes({ ...L, scenes: [{ say: 'b' }] });
  assert.notStrictEqual(a.videoHash, scene.videoHash);
});

test('pushPlan: o\'zgarmagan dars yozilmaydi; videoHash yo\'q bo\'lsa faqat to\'ldiriladi', () => {
  assert.deepStrictEqual(pushPlan({ contentHash: 'h', videoHash: 'v', videoPath: 'p' }, 'h', 'v'), { action: 'skip', stale: false });
  assert.deepStrictEqual(pushPlan({ contentHash: 'h', videoPath: 'p' }, 'h', 'v'), { action: 'backfill', stale: false });
});

test('pushPlan: faqat test o\'zgarsa video eskirmaydi; dars matni o\'zgarsa eskiradi', () => {
  assert.deepStrictEqual(pushPlan({ contentHash: 'old', videoHash: 'v', videoPath: 'p' }, 'new', 'v'), { action: 'write', stale: false });
  assert.deepStrictEqual(pushPlan({ contentHash: 'old', videoHash: 'v', videoPath: 'p' }, 'new', 'v2'), { action: 'write', stale: true });
});

test('pushPlan: eski yozuvlar (videoHash yo\'q) avvalgidek ishlaydi', () => {
  assert.strictEqual(pushPlan({ contentHash: 'old', videoPath: 'p' }, 'new', 'v').stale, true);
  assert.strictEqual(pushPlan({ videoPath: 'p' }, 'new', 'v', () => true).stale, true);
  assert.strictEqual(pushPlan({ videoPath: 'p' }, 'new', 'v', () => false).stale, false);
  assert.deepStrictEqual(pushPlan({ contentHash: 'old' }, 'new', 'v'), { action: 'write', stale: false });   // videosi yo'q
  assert.deepStrictEqual(pushPlan(null, 'new', 'v'), { action: 'write', stale: false });                    // yangi dars
});
