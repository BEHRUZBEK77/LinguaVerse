const assert = require('node:assert/strict');
const test = require('node:test');

const plans = require('../netlify/functions/_plans.js');
const teacher = require('../netlify/functions/teacher.js');
const course = require('../netlify/functions/course.js');
const { synthesizeElevenLabs, voiceForLocale } = require('../netlify/functions/azure-speech.js');
const { think, extractJson } = require('../netlify/functions/_brain.js');

test('course products are priced on the server: B2 200k, C2 400k, C2 also unlocks B2', () => {
  const b2 = plans.courseProduct('english', 'b2');
  const c2 = plans.courseProduct('korean', 'C2');
  assert.equal(b2.price, 200000);
  assert.equal(c2.price, 400000);
  assert.equal(c2.key, 'korean_c2');
  assert.deepEqual(plans.courseUnlocks(c2), ['korean_c2', 'korean_b2']);
  assert.deepEqual(plans.courseUnlocks(b2), ['english_b2']);
  assert.equal(plans.courseProduct('klingon', 'b2'), null);
  assert.equal(plans.courseProduct('english', 'c1'), null);
});

test('IELTS/SERTIFIKAT PRO is retired from new sales but plan data is preserved for existing subscribers', () => {
  assert.equal(plans.PLANS.ielts.price, 200000);
  assert.equal(plans.paidPlan('ielts', 'monthly'), null); // yangi sotuvdan olingan
  assert.equal(plans.paidPlan('ielts', 'yearly'), null);
});

test('IELTS overall band follows official rounding', () => {
  assert.equal(teacher.ieltsOverall(6.5, 6, 6, 6.5), 6.5);   // 6.25 → 6.5
  assert.equal(teacher.ieltsOverall(6, 6, 6, 6.5), 6);       // 6.125 → 6
  assert.equal(teacher.ieltsOverall(7, 7, 6.5, 6.5), 7);     // 6.75 → 7
  assert.equal(teacher.ieltsOverall(9, 9, 9, 9), 9);
  assert.equal(teacher.ieltsOverall(7, 7, 7), null);
});

test('teacher replies are normalised: valid emotion, no coaching in exam mode', () => {
  const raw = 'Sure! ```json {"say":"No, no, no! **Again.**","emotion":"ANGRY","intensity":5,"correction":{"wrong":"he go","right":"he goes","why_uz":"3-shaxs"},"retry":true,"bandHint":5.25} ```';
  const parsed = extractJson(raw);
  const coach = teacher.normalizeReply(parsed, raw, 'coach');
  assert.equal(coach.emotion, 'angry');
  assert.equal(coach.intensity, 3);
  assert.equal(coach.say, 'No, no, no! Again.');
  assert.equal(coach.correction.right, 'he goes');
  assert.equal(coach.retry, true);
  assert.equal(coach.bandHint, 5.5);

  const exam = teacher.normalizeReply({ ...parsed, emotion: 'furious' }, raw, 'exam');
  assert.equal(exam.emotion, 'neutral');
  assert.equal(exam.correction, null);
  assert.equal(exam.retry, false);

  const plain = teacher.normalizeReply(null, 'Tell me more.', 'coach');
  assert.equal(plain.say, 'Tell me more.');
});

test('teacher persona is strict but forbids profanity and abuse', () => {
  const p = teacher.teacherPersona(teacher.TEACHERS.english, 'coach', 'B2');
  assert.match(p, /Never use profanity/);
  assert.match(p, /angry/);
  assert.equal(Object.keys(teacher.TEACHERS).length, 8);
});

test('every language has its own ElevenLabs teacher voice and admin overrides win', () => {
  const ids = ['en-GB', 'ru-RU', 'es-ES', 'de-DE', 'tr-TR', 'ar-SA', 'ko-KR', 'zh-CN'].map(l => voiceForLocale(l, {}));
  assert.equal(new Set(ids).size, 8);
  assert.equal(voiceForLocale('ru-RU', { langVoices: { 'ru-RU': 'customRussianVoice' } }), 'customRussianVoice');
});

test('ElevenLabs speech carries the teacher emotion (voice settings and v3 audio tags)', async () => {
  let body;
  const fetchImpl = async (url, opts) => { body = JSON.parse(opts.body); return { ok: true, arrayBuffer: async () => Buffer.from('x') }; };
  const r = await synthesizeElevenLabs({ text: 'Again!', lang: 'en-GB', emotion: 'angry' }, { apiKey: 'k', fetchImpl, langVoices: {} });
  assert.equal(r.emotion, 'angry');
  assert.ok(body.voice_settings.style > 0.7);
  assert.ok(body.voice_settings.stability < 0.4);

  await synthesizeElevenLabs({ text: 'Ha ha, good one.', lang: 'en-GB', emotion: 'laughing' }, { apiKey: 'k', fetchImpl, langVoices: {}, modelId: 'eleven_v3' });
  assert.equal(body.model_id, 'eleven_v3');
  assert.match(body.text, /^\[laughs\] /);
});

test('brain falls through providers until one answers', async () => {
  const calls = [];
  const providers = {
    groq: async () => { calls.push('groq'); throw new Error('quota'); },
    gemini: async () => { calls.push('gemini'); return { text: '{"ok":1}', backend: 'gemini:x' }; }
  };
  const r = await think('fast', [{ role: 'user', content: 'hi' }], {}, { providers, hasKeyFor: () => true });
  assert.equal(r.backend, 'gemini:x');
  assert.deepEqual(calls, ['groq', 'gemini']);
});

test('lesson scripts and quizzes from AI are validated before saving', () => {
  const scene = { kind: 'explain', title: 'T', board: ['a'], examples: [{ t: 'x', uz: 'y' }], say: 'Hello **there**', say_uz: 'Salom', emotion: 'weird' };
  assert.equal(course.cleanCore({ scenes: [scene, scene] }), null);          // juda kam sahna
  const core = course.cleanCore({ title: 'D', scenes: [scene, scene, scene, scene] });
  assert.equal(core.scenes.length, 4);
  assert.equal(core.scenes[0].say, 'Hello there');
  assert.equal(core.scenes[0].emotion, 'neutral');

  const good = { q: 'Q', options: ['a', 'b', 'c', 'd'], answer: 2, why_uz: '' };
  assert.equal(course.cleanQuiz({ quiz: [good, good, good] }), null);
  assert.equal(course.cleanQuiz({ quiz: [good, good, good, good, { ...good, answer: 7 }] }).length, 4);
});

test('course catalog prices match the server prices', async () => {
  const cat = await course.catalog();
  assert.equal(cat.COURSE_LEVELS.b2.price, plans.COURSE_LEVELS.b2.price);
  assert.equal(cat.COURSE_LEVELS.c2.price, plans.COURSE_LEVELS.c2.price);
  assert.equal(cat.COURSE_LANGS.length, Object.keys(plans.COURSE_LANGS).length);
});

test('paying for C2 unlocks C2 and B2 on the user profile', async () => {
  const fsdb = require('../netlify/functions/_firestore.js');
  const store = { 'users/u1': { courses: { english_b2: { orderId: 'old' } } } };
  const orig = { getDoc: fsdb.getDoc, setDoc: fsdb.setDoc, addDoc: fsdb.addDoc };
  fsdb.getDoc = async p => store[p] || null;
  fsdb.setDoc = async (p, d) => { store[p] = { ...(store[p] || {}), ...d }; };
  fsdb.addDoc = async () => {};
  try {
    const payment = require('../netlify/functions/payment.js');
    const unlocked = await payment._test.grantCourse('u1', 'english_c2', 'LV-1', 'webhook');
    assert.deepEqual(unlocked, ['english_c2', 'english_b2']);
    assert.equal(store['users/u1'].courses.english_c2.orderId, 'LV-1');
    assert.equal(store['users/u1'].courses.english_b2.orderId, 'old');   // mavjud xarid buzilmaydi
  } finally {
    Object.assign(fsdb, orig);
  }
});

test('free speaking: 5 minutes total, survives restarts, then locked for 5 days with one grace assessment', async () => {
  const fsdb = require('../netlify/functions/_firestore.js');
  const store = {};
  const orig = fsdb.transact;
  fsdb.transact = async (p, mutate) => {
    const patch = await mutate(store[p] ? { ...store[p] } : null);
    if (patch) store[p] = { ...(store[p] || {}), ...patch };
  };
  try {
    const { chargeSpeaking } = teacher;
    let t = Date.UTC(2026, 10, 4, 10, 0, 0);
    const step = async (action, sec) => { t += sec * 1000; return chargeSpeaking('u1', action, t); };

    assert.equal((await step('questions', 0)).quota.leftSec, 300);
    assert.equal((await step('reply', 60)).quota.usedSec, 60);
    // "Qayta boshlash" — yangi questions, lekin vaqt nolga tushmaydi
    assert.equal((await step('questions', 30)).quota.usedSec, 90);
    assert.equal((await step('reply', 600)).quota.usedSec, 270);      // bir javob uchun ko'pi bilan 3 daqiqa
    const end = await step('reply', 40);
    assert.equal(end.ok, false);
    assert.equal(end.justEnded, true);
    assert.equal(end.quota.locked, true);

    assert.equal((await step('reply', 5)).ok, false);
    assert.equal((await step('assess', 5)).ok, true);                // natijani olish mumkin
    assert.equal((await step('assess', 5)).ok, false);               // faqat bir marta
    assert.equal((await step('questions', 4 * 24 * 3600)).ok, false); // 4 kundan keyin ham yopiq

    const open = await step('questions', 24 * 3600);                  // 5 kun o'tdi
    assert.equal(open.ok, true);
    assert.equal(open.quota.leftSec, 300);
    assert.equal((await step('reply', 100)).quota.usedSec, 100);     // yangi hisob saqlanadi
    assert.equal((await step('reply', 10)).quota.usedSec, 110);
  } finally {
    fsdb.transact = orig;
  }
});

test('MP4 lessons are served through short-lived V4 signed URLs', () => {
  const crypto = require('crypto');
  const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const env = { ...process.env };
  process.env.FIREBASE_CLIENT_EMAIL = 'svc@proj.iam.gserviceaccount.com';
  process.env.FIREBASE_PRIVATE_KEY = privateKey.export({ type: 'pkcs8', format: 'pem' }).replace(/\n/g, '\\n');
  process.env.FIREBASE_STORAGE_BUCKET = 'bucket.example';
  try {
    const { signedUrl } = require('../netlify/functions/_gcs.js');
    const url = new URL(signedUrl('courseVideos/english_b2_1.mp4', 3 * 3600, new Date('2026-11-04T15:00:00Z')));
    assert.equal(url.host, 'storage.googleapis.com');
    assert.equal(url.pathname, '/bucket.example/courseVideos/english_b2_1.mp4');
    assert.equal(url.searchParams.get('X-Goog-Expires'), '10800');
    assert.equal(url.searchParams.get('X-Goog-Date'), '20261104T150000Z');
    assert.match(url.searchParams.get('X-Goog-Credential'), /^svc@proj\.iam\.gserviceaccount\.com\/20261104\/auto\/storage\/goog4_request$/);

    // Imzo shu service account kaliti bilan tekshiriladi
    const q = [...url.searchParams.entries()].filter(([k]) => k !== 'X-Goog-Signature')
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&');
    const canonical = ['GET', url.pathname, q, 'host:storage.googleapis.com\n', 'host', 'UNSIGNED-PAYLOAD'].join('\n');
    const toSign = ['GOOG4-RSA-SHA256', '20261104T150000Z', '20261104/auto/storage/goog4_request', crypto.createHash('sha256').update(canonical).digest('hex')].join('\n');
    assert.ok(crypto.createVerify('RSA-SHA256').update(toSign).verify(publicKey, Buffer.from(url.searchParams.get('X-Goog-Signature'), 'hex')));
  } finally {
    process.env = env;
  }
});

test('every language has 150 video lessons: 25 per CEFR level, each level ends with an exam', async () => {
  const cat = await course.catalog();
  assert.equal(cat.LESSONS_PER_LANGUAGE, 150);
  const all = [...cat.COURSE_LEVELS.b2.lessons, ...cat.COURSE_LEVELS.c2.lessons];
  for (const cefr of ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']) {
    const list = all.filter(l => l.cefr === cefr);
    assert.equal(list.length, 25, cefr);
    assert.equal(list.at(-1).skill, 'Imtihon', cefr);
    assert.equal(new Set(list.map(l => l.t)).size, 25, cefr + ' takror mavzu');
  }
  assert.match(course.lessonPath('english', 'b2', 7), /^courseLessons\/v4_uz_english_b2_7$/);
  assert.ok(course.CEFR_RATE.A1 < course.CEFR_RATE.C2);
});
