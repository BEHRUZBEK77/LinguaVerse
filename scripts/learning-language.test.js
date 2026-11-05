const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const learning = require('../js/learning-language.js');
const course = require('../netlify/functions/course.js');

test('language settings distinguish nine native languages from eight target languages', () => {
  assert.equal(Object.keys(learning.languages).length,9);
  for (const bad of [null,undefined,'','uz','__proto__','constructor','../../x']) assert.equal(learning.validTarget(bad),false);
  assert.equal(learning.normalize('__proto__'),'uz');
  assert.equal(learning.validTarget('english'),true);
  assert.equal(learning.targetCode('arabic'),'ar');
});

test('lesson caches separate native-language editions without separating purchases', () => {
  const paths = Object.keys(learning.languages).map(n=>course.lessonPath('english','b2',0,n));
  assert.equal(new Set(paths).size,9);
  assert.equal(course.lessonPath('english','b2',0,'ru'),'courseLessons/v4_ru_english_b2_0');
});

test('lesson and quiz instructions teach through the selected native language', () => {
  const p = course.corePrompt(course.LANG_INFO.german,'b2',{t:'Salomlashish',skill:'Speaking',cefr:'A1'},0,100,'ko');
  assert.match(p,/Korean-speaking learners/);
  assert.match(p,/say_native/);
  assert.match(p,/practice_seconds/);
  assert.match(p,/TEACHING explanation in Korean/);
  assert.doesNotMatch(p,/Uzbek-speaking|title in Uzbek|Uzbek translation/);
  const quiz = course.quizPrompt(course.LANG_INFO.german,'b2',{t:'Hello',cefr:'A1'}, {scenes:[]},false,'ru');
  assert.match(quiz,/in Russian in why_uz/);
});

test('practice pauses are bounded and native speech is kept in validated lesson data', () => {
  const s = {say:'Hello',say_native:'Salomlashamiz.',kind:'practice',practice_seconds:1000};
  const core = course.cleanCore({scenes:Array(4).fill(s)});
  assert.equal(core.scenes[0].practice_seconds,20);
  assert.equal(core.scenes[0].say_native,'Salomlashamiz.');
});

test('browser preferences persist and annotate only same-origin learning requests', async () => {
  const storage = new Map(); const sent=[];
  const window = {document:{documentElement:{}},location:{href:'https://example.test/languages-html/German.html',origin:'https://example.test',pathname:'/languages-html/German.html'},localStorage:{getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v)},dispatchEvent:()=>{},fetch:async (...args)=>{sent.push(args);return {};}};
  const context = vm.createContext({window,URL,CustomEvent:class {constructor(type,data){this.type=type;this.detail=data.detail;}}});
  vm.runInContext(fs.readFileSync(require.resolve('../js/learning-language.js'),'utf8'),context);
  assert.equal(window.LearningLanguage.get().targetLang,'english');
  window.LearningLanguage.set({nativeLang:'ar',targetLang:'korean'});
  assert.equal(window.document.documentElement.dir,'rtl');
  assert.equal(storage.get('lv_lang'),'ar');
  await window.fetch('/.netlify/functions/ai',{body:JSON.stringify({messages:[]})});
  const payload=JSON.parse(sent[0][1].body);
  assert.equal(payload.nativeLang,'ar');
  assert.equal(payload.targetLang,'german'); // Explicit language page overrides saved target.
  await window.fetch('https://third.example/.netlify/functions/ai',{body:'{"x":1}'});
  assert.equal(sent[1][1].body,'{"x":1}');
});

test('VTT captions preserve languages and reject markup and invalid cue times', async () => {
  const {captionsVtt,vttTime,videoMetadata}=await import('../js/video-captions.mjs');
  assert.equal(vttTime(61.234),'00:01:01.234');
  const vtt=captionsVtt([{start:1,end:3,native:'<script>salom</script> --> test'},{start:4,end:2,native:'invalid'}]);
  assert.ok(vtt.startsWith('WEBVTT'));
  assert.doesNotMatch(vtt,/<script>|invalid/);
  const meta=videoMetadata([{title:'Intro',lessonScene:0,start:0,audioStart:1,audioEnd:2,say:'Salom',nativeSpeech:true},{title:'Intro',lessonScene:0,start:2,audioStart:3,audioEnd:4,say:'Hello',say_uz:'Salom'}]);
  assert.equal(meta.chapters.length,1);
  assert.equal(meta.captions[0].target,'');
  assert.equal(meta.captions[1].native,'Salom');
});

test('translation endpoint rejects arbitrary or private text and unknown locale IDs', async () => {
  const handler=require('../netlify/functions/site-translations.js').handler;
  for (const body of [{locale:'ru',ids:['private-email@example.test']},{locale:'__proto__',ids:[]},{locale:'ru',ids:Array(25).fill('x')}]) {
    const r=await handler({httpMethod:'POST',body:JSON.stringify(body)});
    assert.equal(r.statusCode,400);
  }
});

test('every one of the 150 catalog lessons has mandatory teaching material in the AI prompt', async () => {
  const syl = require('../netlify/functions/_syllabus.js');
  const cat = await import('../js/course-catalog.mjs');
  for (const level of ['b2', 'c2']) {
    cat.COURSE_LEVELS[level].lessons.forEach((l, idx) => {
      const m = syl.lessonMaterial(l.cefr, syl.indexInLevel(level, idx));
      assert.ok(m && m.goal && m.points.length >= 3 && m.task, `${level} #${idx + 1}`);
    });
  }
  for (const c of syl.LEVELS) assert.equal(syl.SYLLABUS[c].length, 25, c);
  const p = course.corePrompt(course.LANG_INFO.russian, 'b2', cat.COURSE_LEVELS.b2.lessons[54], 54, 100, 'uz');
  assert.match(p, /MANDATORY LESSON MATERIAL/);
  assert.match(p, /Real conditionals|real conditional/i);
  assert.match(p, /6 cases/);
});

test('a 30-minute lesson is built part by part, one AI call per request, then the quiz', async () => {
  const store = new Map();
  const fake = { getDoc: async p => store.has(p) ? JSON.parse(JSON.stringify(store.get(p))) : null, setDoc: async (p, d) => store.set(p, { ...(store.get(p) || {}), ...JSON.parse(JSON.stringify(d)) }) };
  let calls = 0;
  const scene = i => ({ kind: i % 3 ? 'explain' : 'practice', title: 'S' + i, board: ['x'], say: 'B'.repeat(300), say_uz: 'u', say_native: 'A'.repeat(420), practice_seconds: 8, emotion: 'neutral' });
  const brain = { think: async (tier, msgs) => { calls++; const sys = msgs[0].content;
      if (/multiple-choice test/.test(sys)) return { text: JSON.stringify({ quiz: Array.from({ length: 10 }, () => ({ q: 'q', options: ['a', 'b', 'c', 'd'], answer: 1, why_uz: 'w' })) }) };
      return { text: JSON.stringify({ title: 'T', goal_uz: 'G', vocab: Array(10).fill({ w: 'w', uz: 'u' }), scenes: Array.from({ length: 7 }, (_, i) => scene(i)), homework_uz: /FINAL PART/.test(sys) ? 'HW' : '' }) }; },
    extractJson: t => JSON.parse(t) };
  const paths = ['../netlify/functions/course.js', '../netlify/functions/_firestore.js', '../netlify/functions/_brain.js'].map(p => require.resolve(p));
  const saved = paths.map(p => require.cache[p]);
  require.cache[paths[1]] = { id: paths[1], filename: paths[1], loaded: true, exports: fake };
  require.cache[paths[2]] = { id: paths[2], filename: paths[2], loaded: true, exports: { ...require('../netlify/functions/_brain.js'), ...brain } };
  delete require.cache[paths[0]];
  try {
    const c = require('../netlify/functions/course.js');
    const meta = { t: 'Real', skill: 'Grammatika', cefr: 'B1' };
    const steps = [];
    for (let i = 0; i < 12; i++) { const r = await c.ensureLessonStep('german', 'b2', 54, meta, 100, { nativeLang: 'uz' }); steps.push(r.step); if (r.step === 'ready') break; }
    const doc = store.get(c.lessonPath('german', 'b2', 54, 'uz'));
    const core = JSON.parse(doc.core);
    assert.equal(doc.partsDone, 6);
    assert.ok(core.scenes.length >= 42);
    assert.equal(core.homework_uz, 'HW');
    assert.ok(c.estimateSeconds(core, 0.92) >= 30 * 60 * 0.85, 'about 30 minutes of narration');
    assert.equal(steps.at(-1), 'ready');
    assert.equal(JSON.parse(doc.quiz).length, 10);
  } finally {
    paths.forEach((p, i) => { if (saved[i]) require.cache[p] = saved[i]; else delete require.cache[p]; });
  }
});

test('R2 presigned URLs match the official AWS SigV4 test vector and keep paths private', () => {
  const st = require('../netlify/functions/_storage.js');
  const url = st.presign({ host: 'examplebucket.s3.amazonaws.com', path: '/test.txt', region: 'us-east-1', keyId: 'AKIAIOSFODNN7EXAMPLE', secret: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY', expires: 86400, date: new Date('2013-05-24T00:00:00Z') });
  assert.match(url, /X-Amz-Signature=aeeed9bbccd4d02ee5c0109b86d86835f995330da4c265957d157751f604d404$/);
  const env = { ...process.env };
  Object.assign(process.env, { R2_ACCOUNT_ID: 'acc', R2_ACCESS_KEY_ID: 'k', R2_SECRET_ACCESS_KEY: 's', R2_BUCKET: 'lv' });
  try {
    assert.equal(st.provider(), 'r2');
    assert.equal(st.storedPath('courseVideos/v3/uz/english_b2_0.mp4'), 'r2:courseVideos/v3/uz/english_b2_0.mp4');
    const signed = st.signedUrl('r2:courseVideos/v3/uz/english_b2_0.mp4', 3600);
    assert.match(signed, /^https:\/\/acc\.r2\.cloudflarestorage\.com\/lv\/courseVideos\/v3\/uz\/english_b2_0\.mp4\?X-Amz-Algorithm=AWS4-HMAC-SHA256/);
    assert.match(signed, /X-Amz-Expires=3600/);
  } finally { process.env = env; }
});

test('monthly free voice budget stops at the limit and can be disabled for paid plans', async () => {
  const store = new Map();
  const fake = { getDoc: async p => store.get(p) || null, transact: async (p, fn) => { const next = fn(store.get(p) || null); if (next) store.set(p, { ...(store.get(p) || {}), ...next }); } };
  const paths = ['../netlify/functions/_ttsBudget.js', '../netlify/functions/_firestore.js'].map(p => require.resolve(p));
  const saved = paths.map(p => require.cache[p]);
  require.cache[paths[1]] = { id: paths[1], filename: paths[1], loaded: true, exports: fake };
  delete require.cache[paths[0]];
  const env = process.env.TTS_MONTHLY_CHARS;
  try {
    const b = require('../netlify/functions/_ttsBudget.js');
    process.env.TTS_MONTHLY_CHARS = '50000';
    const d = new Date('2026-11-05T00:00:00Z');
    assert.equal((await b.reserve(30000, d)).ok, true);
    assert.equal((await b.reserve(30000, d)).ok, false);          // would exceed
    assert.equal((await b.reserve(20000, d)).ok, true);
    assert.equal((await b.status(d)).used, 50000);
    assert.equal((await b.reserve(30000, new Date('2026-12-01T00:00:00Z'))).ok, true);   // new month resets
    process.env.TTS_MONTHLY_CHARS = '0';
    assert.equal((await b.reserve(10_000_000, d)).unlimited, true);
  } finally {
    if (env === undefined) delete process.env.TTS_MONTHLY_CHARS; else process.env.TTS_MONTHLY_CHARS = env;
    paths.forEach((p, i) => { if (saved[i]) require.cache[p] = saved[i]; else delete require.cache[p]; });
  }
});

test('opening a lesson starts that one MP4 once, respects the lock and the free voice budget', async () => {
  const store = new Map(); const sent = [];
  const fake = { getDoc: async p => store.get(p) || null, setDoc: async (p, d) => store.set(p, { ...(store.get(p) || {}), ...d }), transact: async () => {} };
  const paths = ['../netlify/functions/course.js', '../netlify/functions/_firestore.js', '../netlify/functions/_ttsBudget.js'].map(p => require.resolve(p));
  const saved = paths.map(p => require.cache[p]);
  let used = 0;
  require.cache[paths[1]] = { id: paths[1], filename: paths[1], loaded: true, exports: fake };
  require.cache[paths[2]] = { id: paths[2], filename: paths[2], loaded: true, exports: { status: async () => ({ used, limit: 450000 }) } };
  delete require.cache[paths[0]];
  const env = { ...process.env }, origFetch = global.fetch;
  Object.assign(process.env, { GITHUB_TOKEN: 't', GITHUB_REPO: 'me/lv' });
  global.fetch = async (url, o) => { sent.push({ url, body: JSON.parse(o.body) }); return { status: 204, text: async () => '' }; };
  try {
    const c = require('../netlify/functions/course.js');
    const doc = { core: JSON.stringify({ scenes: [{ say: 'a'.repeat(1000), say_native: 'b'.repeat(2000) }] }), quiz: '[]' };
    assert.equal(await c.autoVideo('english', 'b2', 5, 'uz', doc), 'started');
    assert.equal(sent.length, 1);
    assert.deepEqual(sent[0].body.inputs, { native: 'uz', langs: 'english', lesson: 'english:b2:5', batch: '1', mode: 'demand' });
    const stored = store.get(c.lessonPath('english', 'b2', 5, 'uz'));
    assert.ok(stored.videoDispatchedAt instanceof Date);
    assert.equal(await c.autoVideo('english', 'b2', 5, 'uz', { ...doc, ...stored }), null);      // 2-bosish: yangi ish yo'q
    assert.equal(await c.autoVideo('english', 'b2', 6, 'uz', { ...doc, videoPath: 'r2:x' }), null); // video bor
    used = 449000;
    assert.equal(await c.autoVideo('english', 'b2', 7, 'uz', doc), 'budget');                       // limit yetmaydi
    assert.equal(sent.length, 1);
  } finally {
    process.env = env; global.fetch = origFetch;
    paths.forEach((p, i) => { if (saved[i]) require.cache[p] = saved[i]; else delete require.cache[p]; });
  }
});

test('Uzbek speech automatically uses ElevenLabs v3, other languages keep the configured model', async () => {
  const speech = require('../netlify/functions/azure-speech.js');
  const bodies = [];
  const fetchImpl = async (url, o) => { bodies.push(JSON.parse(o.body)); return { ok: true, arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer }; };
  await speech.synthesizeElevenLabs({ text: 'Salom, bugun yangi mavzu.', lang: 'uz-UZ', emotion: 'happy' }, { apiKey: 'k', fetchImpl, modelId: 'eleven_multilingual_v2', uzbekVoiceId: 'voiceUZ123' });
  await speech.synthesizeElevenLabs({ text: 'Hello there.', lang: 'en-GB' }, { apiKey: 'k', fetchImpl, modelId: 'eleven_multilingual_v2' });
  assert.equal(bodies[0].model_id, 'eleven_v3');
  assert.match(bodies[0].text, /^\[happy\] /);
  assert.ok([0, 0.5, 1].includes(bodies[0].voice_settings.stability));
  assert.equal(bodies[1].model_id, 'eleven_multilingual_v2');
});

test('60 core lessons per language get MP4; the other 90 use AI-picked YouTube lessons (cached)', async () => {
  const cat = await import('../js/course-catalog.mjs');
  assert.equal(cat.CORE_LESSONS_PER_LANGUAGE, 60);
  const all = [...cat.COURSE_LEVELS.b2.lessons, ...cat.COURSE_LEVELS.c2.lessons];
  for (const c of ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']) {
    const lv = all.filter(l => l.cefr === c);
    assert.equal(lv.filter(l => l.core).length, 10, c);
    assert.equal(lv.at(-1).core, true, c + ' level exam is a core MP4 lesson');
  }
  assert.equal(all[0].core, true, 'free preview lesson is a real MP4 lesson');

  const store = new Map(); const searches = [];
  const fake = { getDoc: async p => store.get(p) || null, setDoc: async (p, d) => store.set(p, { ...(store.get(p) || {}), ...d }), transact: async () => {} };
  const paths = ['../netlify/functions/course.js', '../netlify/functions/_firestore.js', '../netlify/functions/_brain.js', '../netlify/functions/_keys.js'].map(p => require.resolve(p));
  const saved = paths.map(p => require.cache[p]);
  require.cache[paths[1]] = { id: paths[1], filename: paths[1], loaded: true, exports: { ...fake } };
  require.cache[paths[2]] = { id: paths[2], filename: paths[2], loaded: true, exports: { ...require('../netlify/functions/_brain.js'), think: async () => ({ text: '{"native":"ingliz tili present simple dars","target":"present simple lesson A1"}' }) } };
  require.cache[paths[3]] = { id: paths[3], filename: paths[3], loaded: true, exports: { ...require('../netlify/functions/_keys.js'), get: k => (k === 'YOUTUBE_API_KEY' ? 'yt' : ''), refreshFromFirestore: async () => {} } };
  delete require.cache[paths[0]];
  const origFetch = global.fetch;
  global.fetch = async url => { const u = new URL(url); searches.push({ q: u.searchParams.get('q'), lang: u.searchParams.get('relevanceLanguage') });
    const base = searches.length === 1 ? 'aaaaaaaaaa' : 'bbbbbbbbbb';
    return { ok: true, json: async () => ({ items: [0, 1, 2].map(i => ({ id: { videoId: base + i }, snippet: { title: 'Lesson &amp; practice ' + i, channelTitle: 'Ch' } })) }) }; };
  store.set('users/U', { courses: { english_b2: true } });
  try {
    const c = require('../netlify/functions/course.js');
    const n = all.findIndex(l => !l.core);
    const r = await c.youtubeLessons('U', { lang: 'english', level: 'b2', n, nativeLang: 'uz' });
    assert.equal(r.videos.length, 4);
    assert.deepEqual(r.videos.map(v => v.tag), ['native', 'native', 'target', 'target']);
    assert.equal(r.videos[0].title, 'Lesson & practice 0');
    assert.deepEqual(searches.map(s => s.lang), ['uz', 'en']);
    await c.youtubeLessons('U', { lang: 'english', level: 'b2', n, nativeLang: 'uz' });
    assert.equal(searches.length, 2, 'second open is served from cache, no YouTube quota used');
  } finally {
    global.fetch = origFetch;
    paths.forEach((p, i) => { if (saved[i]) require.cache[p] = saved[i]; else delete require.cache[p]; });
  }
});

test('ULTRA plan: 350 000 so\'m, every video course unlocked while active, all limits unlimited', async () => {
  const plans = require('../netlify/functions/_plans.js');
  assert.equal(plans.PLANS.ultra.price, 350000);
  assert.equal(plans.paidPlan('ultra', 'monthly').price, 350000);
  const future = new Date(Date.now() + 86400000), past = new Date(Date.now() - 86400000);
  assert.equal(plans.ultraActive({ plan: 'ultra', planExpiry: future }), true);
  assert.equal(plans.ultraActive({ plan: 'ultra', planExpiry: past }), false);
  assert.equal(plans.ultraActive({ plan: 'ielts', planExpiry: future }), false);

  const store = new Map([['users/U', { plan: 'ultra', planExpiry: future }]]);
  const fake = { getDoc: async p => store.get(p) || null, setDoc: async () => {}, transact: async () => {} };
  const paths = ['../netlify/functions/course.js', '../netlify/functions/_firestore.js'].map(p => require.resolve(p));
  const saved = paths.map(p => require.cache[p]);
  require.cache[paths[1]] = { id: paths[1], filename: paths[1], loaded: true, exports: fake };
  delete require.cache[paths[0]];
  try {
    const c = require('../netlify/functions/course.js');
    const lessons = await c.youtubeLessons('U', { lang: 'korean', level: 'c2', n: 30, nativeLang: 'uz' }).catch(e => e);
    assert.notEqual(lessons?.statusCode, 402, 'ULTRA opens paid C2 lessons without buying the course');
    store.set('users/U', { plan: 'ultra', planExpiry: past });
    await assert.rejects(c.youtubeLessons('U', { lang: 'korean', level: 'c2', n: 30, nativeLang: 'uz' }), e => e.statusCode === 402);
  } finally {
    paths.forEach((p, i) => { if (saved[i]) require.cache[p] = saved[i]; else delete require.cache[p]; });
  }
  const src = require('node:fs').readFileSync(require('node:path').join(__dirname, '../js/lv-core.js'), 'utf8');
  assert.match(src, /PLAN_ORDER = \['free', 'nova', 'mega', 'premium', 'ielts', 'ultra'\]/);
  assert.match(require('node:fs').readFileSync(require('node:path').join(__dirname, '../netlify/functions/teacher.js'), 'utf8'), /PREMIUM_PLANS = new Set\(\['ielts', 'premium', 'ultra'\]\)/);
});
