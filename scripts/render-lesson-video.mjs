#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════════
// render-lesson-video.mjs — AI DARSNI HAQIQIY MP4 VIDEOGA AYLANTIRISH
//
// Har bir dars uchun:
//   1. Ssenariy — Firestore'dagi tayyor dars (yo'q bo'lsa AI yozadi va saqlaydi)
//   2. Ovoz — har sahna ustoz ovozida (ElevenLabs → Azure), emotsiya bilan
//   3. Montaj — render/lesson-video.html: kirish kartochkasi, ustoz avatari
//      (lip-sync), doskada qatorlar ketma-ket, subtitr (til + o'zbekcha),
//      sahnalar orasida o'tish, progress, yakuniy kartochka (lug'at)
//   4. Kodlash — ffmpeg: H.264 1080p + AAC, +faststart (darhol ochiladi)
//   5. Yuklash — Firebase Storage courseVideos/…mp4, dars hujjatiga videoPath
//      (sayt pleyeri endi shu MP4 ni ko'rsatadi)
//
// Ishga tushirish (GitHub Actions: "Render lesson videos" — yoki lokal):
//   node scripts/render-lesson-video.mjs --lang english --level b2 --lessons 0-4 --upload
//
// Lokal sinov (Firebase'siz, tayyor JSON va offline ovoz bilan):
//   node scripts/render-lesson-video.mjs --json lesson.json --lang english --level b2 --n 0 \
//        --tts piper --piper-model en_GB-alan-medium.onnx --out out/
//
// Kerak: Node 20+, ffmpeg, playwright (npm i --no-save playwright && npx playwright install chromium)
// Env: FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY
//      (AI va ElevenLabs kalitlari Firestore apiConfig/global dan o'qiladi)
// ═══════════════════════════════════════════════════════════════════════════

import { createRequire } from 'node:module';
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import os from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { videoMetadata, captionsVtt } from '../js/video-captions.mjs';
import { copy } from '../js/learning-copy.mjs';
import { cutPoints, lessonId, lessonNumber, LANG_UZ } from './lesson-script-export.mjs';

const require = createRequire(import.meta.url);
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

// ── Argumentlar ──
const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, all) => {
  if (a.startsWith('--')) acc.push([a.slice(2), all[i + 1] && !all[i + 1].startsWith('--') ? all[i + 1] : true]);
  return acc;
}, []));
let LANG = String(args.lang || 'english');
let LEVEL = String(args.level || 'b2');
const FPS = Number(args.fps || process.env.VIDEO_FPS || 15);   // 30 daqiqalik darslar uchun 15 kadr/s — sifat yetarli, render 40% tezroq
const learning = require('../js/learning-language.js');
const NATIVE = learning.normalize(args.native || 'uz');
if (args.native && NATIVE !== args.native) throw new Error('Unsupported native language');
const FFMPEG = process.env.FFMPEG_PATH || 'ffmpeg';
const FFPROBE = process.env.FFPROBE_PATH || 'ffprobe';
if (!Number.isInteger(FPS) || FPS < 1 || FPS > 60) throw new Error('FPS must be 1–60');
const SCALE = args.hd === 'false' ? 1 : 1.5;          // 1280×720 × 1.5 = 1920×1080
const OUT = path.resolve(args.out || path.join(ROOT, 'out', 'videos'));
const TTS = String(args.tts || 'server');
fs.mkdirSync(OUT, { recursive: true });

const INTRO_SEC = 4.2, PRE_GAP = 0.45, POST_GAP = 0.9, OUTRO_SEC = 5;

function lessonList() {
  if (args.n != null) return [Number(args.n)];
  const spec = String(args.lessons || '0');
  return spec.split(',').flatMap(part => {
    const [a, b] = part.split('-').map(Number);
    return b >= a ? Array.from({ length: b - a + 1 }, (_, k) => a + k) : [a];
  });
}

function sh(cmd, argv, opts = {}) {
  const r = spawnSync(cmd, argv, { encoding: 'utf8', maxBuffer: 1 << 26, ...opts });
  if (r.status !== 0) throw new Error(`${cmd} xato: ${(r.stderr || '').slice(-600)}`);
  return r.stdout;
}
const ffprobeDur = f => Number(sh(FFPROBE, ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).trim());

// ── DIKTOR YOZUVI (o'zbekcha qismlar sizning ovozingizda) ──
// ovozlar/<native>/<lang>/A1-02.m4a  — bitta fayl, bloklar orasida ~2 s jimlik
// ovozlar/<native>/<lang>/A1-02/01.m4a, 02.m4a … — har blok alohida
// Mahalliy papkada bo'lmasa va R2 sozlangan bo'lsa — R2 dagi ovozlar/ dan olinadi.
const AUDIO_EXT = ['m4a', 'mp3', 'wav', 'ogg', 'opus', 'webm', 'aac', 'flac'];
const VOICE_DIR = path.resolve(args['ovoz-dir'] || process.env.OVOZ_DIR || path.join(ROOT, 'ovozlar'));

function silencesOf(file) {
  const r = spawnSync(FFMPEG, ['-hide_banner', '-i', file, '-af', 'silencedetect=noise=-35dB:d=1.2', '-f', 'null', '-'], { encoding: 'utf8', maxBuffer: 1 << 26 });
  const list = [];
  let start = null;
  for (const line of (r.stderr || '').split('\n')) {
    const a = /silence_start: ([\d.]+)/.exec(line);
    const b = /silence_end: ([\d.]+)/.exec(line);
    if (a) start = Number(a[1]);
    if (b && start != null) { list.push({ start, end: Number(b[1]) }); start = null; }
  }
  return list;
}

async function fetchRemoteRecording(rel, work) {
  const storage = require(path.join(ROOT, 'netlify/functions/_storage.js'));
  if (storage.provider() !== 'r2') return null;
  for (const ext of AUDIO_EXT) {
    const r = await fetch(storage.signedUrl(`r2:ovozlar/${rel}.${ext}`, 600)).catch(() => null);
    if (r?.ok) {
      const f = path.join(work, `rec.${ext}`);
      fs.writeFileSync(f, Buffer.from(await r.arrayBuffer()));
      return f;
    }
  }
  return null;
}

/** count ta WAV bo'lak yoki null (yozuv yo'q) */
async function loadRecording(rel, count, work) {
  const dir = path.join(VOICE_DIR, rel);
  if (fs.existsSync(dir) && fs.statSync(dir).isDirectory()) {
    const files = fs.readdirSync(dir).filter(f => AUDIO_EXT.includes(f.split('.').pop().toLowerCase())).sort();
    if (files.length !== count) throw new Error(`${rel}/ papkada ${files.length} ta fayl, kerak: ${count}`);
    return files.map(f => path.join(dir, f));
  }
  let file = AUDIO_EXT.map(e => `${dir}.${e}`).find(f => fs.existsSync(f)) || await fetchRemoteRecording(rel, work);
  if (!file) return null;
  const total = ffprobeDur(file);
  const cuts = cutPoints(silencesOf(file), count);
  if (!cuts) throw new Error(`${rel}: yozuvda ${count} ta blok topilmadi — bloklar orasida 2 soniya jim turing`);
  const edges = [0, ...cuts, total];
  return edges.slice(0, -1).map((s, i) => {
    const f = path.join(work, `rec${i}.wav`);
    sh(FFMPEG, ['-v', 'error', '-y', '-i', file, '-ss', String(s), '-to', String(edges[i + 1]), '-af', 'silenceremove=start_periods=1:start_threshold=-40dB:stop_periods=-1:stop_threshold=-40dB:stop_duration=1', '-ac', '1', '-ar', '44100', '-c:a', 'pcm_s16le', f]);
    return f;
  });
}

// ── 1) SSENARIY ──
async function loadLesson(n) {
  if (args.json) {
    const j = JSON.parse(fs.readFileSync(args.json, 'utf8'));
    const cat = await import(pathToFileURL(path.join(ROOT, 'js', 'course-catalog.mjs')).href);
    return { core: j.lesson || j, meta: cat.COURSE_LEVELS[LEVEL].lessons[n], total: cat.COURSE_LEVELS[LEVEL].lessons.length };
  }
  const keys = require(path.join(ROOT, 'netlify/functions/_keys.js'));
  await keys.refreshFromFirestore();
  const course = require(path.join(ROOT, 'netlify/functions/course.js'));
  return course.ensureLesson(LANG, LEVEL, n, NATIVE);
}

// ── 2) OVOZ ── (tezlik CEFR darajasiga qarab: A1 sekin, C2 tabiiy)
const CEFR_RATE = { A1: 0.85, A2: 0.88, B1: 0.92, B2: 0.95, C1: 1, C2: 1 };
let RATE = 1;
async function synth(text, locale, emotion, file) {
  if (TTS === 'windows') {
    if (process.platform !== 'win32') throw new Error('Windows speech requires Windows');
    const textFile = file + '.txt';
    fs.writeFileSync(textFile, text, 'utf8');
    sh('powershell.exe', ['-NoProfile', '-File', path.join(ROOT, 'scripts/windows-tts.ps1'), '-TextFile', textFile, '-OutputFile', file, '-Locale', locale]);
    return file;
  }
  if (TTS === 'piper') {
    const r = spawnSync('python3', ['-m', 'piper', '-m', args['piper-model'], '-f', file], { input: text, encoding: 'utf8' });
    if (r.status !== 0) throw new Error('piper: ' + r.stderr);
    return file;
  }
  const speech = require(path.join(ROOT, 'netlify/functions/azure-speech.js'));
  // --voice azure: ommaviy ishlab chiqarishda arzon Azure ovozi (ElevenLabs o'tkazib yuboriladi)
  const VOICE = String(args.voice || process.env.VIDEO_VOICE || 'auto');
  const r = await speech.synthesizeConfigured({ text, lang: locale, emotion, rate: RATE }, VOICE === 'azure' ? { elevenLabsKey: '' } : {});
  fs.writeFileSync(file, Buffer.from(r.audio, 'base64'));
  return file;
}

// ── Statik server (render sahifasi ES modullari uchun) ──
function serve() {
  const types = { '.html': 'text/html', '.mjs': 'text/javascript', '.js': 'text/javascript', '.css': 'text/css' };
  const server = http.createServer((req, res) => {
    const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
    if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': (types[path.extname(p)] || 'application/octet-stream') + '; charset=utf-8' });
    fs.createReadStream(p).pipe(res);
  });
  return new Promise(r => server.listen(0, '127.0.0.1', () => r(server)));
}

// ── Ovoz balandligi konverti (lip-sync uchun, har kadrga bitta qiymat) ──
function envelope(wavFile, duration) {
  const raw = sh(FFMPEG, ['-v', 'error', '-i', wavFile, '-f', 's16le', '-ac', '1', '-ar', '16000', '-'], { encoding: 'buffer' });
  const samples = new Int16Array(raw.buffer, raw.byteOffset, Math.floor(raw.length / 2));
  const per = 16000 / FPS;
  const frames = Math.ceil(duration * FPS);
  const env = new Array(frames).fill(0);
  let peak = 1e-6;
  for (let f = 0; f < frames; f++) {
    let s = 0, n = 0;
    for (let i = Math.floor(f * per); i < Math.min(samples.length, Math.floor((f + 1) * per)); i++) { const v = samples[i] / 32768; s += v * v; n++; }
    env[f] = n ? Math.sqrt(s / n) : 0;
    peak = Math.max(peak, env[f]);
  }
  // Normallashtirish + yumshatish (og'iz titramasin)
  let prev = 0;
  return env.map(v => { const x = Math.min(1, (v / peak) * 1.6); prev = prev * 0.45 + x * 0.55; return Math.round(prev * 1000) / 1000; });
}

async function renderOne(n, browser, baseUrl) {
  const t0 = Date.now();
  const cat = await import(pathToFileURL(path.join(ROOT, 'js', 'course-catalog.mjs')).href);
  const langInfo = cat.COURSE_LANGS.find(l => l.id === LANG);
  const L = await loadLesson(n);
  const core = L.core;
  if (!langInfo || !L.meta || !Array.isArray(core.scenes) || !core.scenes.length) throw new Error('Invalid lesson script');
  const renderScenes = core.scenes.flatMap((scene, lessonScene) => [
    ...(scene.say_native ? [{ ...scene, lessonScene, say: scene.say_native, say_uz: '', nativeSpeech: true, practice_seconds: 0 }] : []),
    { ...scene, lessonScene, nativeSpeech: false }
  ]);
  RATE = CEFR_RATE[L.meta.cefr] || 1;
  const work = fs.mkdtempSync(path.join(os.tmpdir(), `lv-${LANG}-${LEVEL}-${n}-`));
  // Diktor yozuvi bo'lsa — o'zbekcha qismlar sizning ovozingizda
  const nativeCount = renderScenes.filter(sc => sc.nativeSpeech).length;
  const no = lessonNumber(L.meta.cefr, n % 25);
  const recNames = [`${NATIVE}/${LANG}/${lessonId(L.meta.cefr, n % 25)}`, `${NATIVE}/${LANG}/${no}-dars`, `${NATIVE}/${LANG}/${String(no).padStart(3, '0')}-dars`,
    `${NATIVE}/${LANG_UZ[LANG]}/${no}-dars`, `${NATIVE}/${LANG_UZ[LANG]}/${String(no).padStart(3, '0')}-dars`];
  let recording = null, recRel = recNames[0];
  for (const rel of args['no-recording'] ? [] : recNames) { recording = await loadRecording(rel, nativeCount, work); if (recording) { recRel = rel; break; } }
  if (recording) console.log(`  🎙 diktor yozuvi: ${recRel} (${recording.length} blok)`);
  // Oylik bepul ovoz limiti: butun dars ovozini oldindan band qilamiz
  // (yarmida to'xtab qolmasin). Yetmasa — keyingi oyga qoladi.
  if (TTS === 'server' && args.upload) {
    const chars = renderScenes.reduce((a, sc) => a + (recording && sc.nativeSpeech ? 0 : (sc.say || '').length), 0);
    const b = await require(path.join(ROOT, 'netlify/functions/_ttsBudget.js')).reserve(chars);
    if (!b.ok) throw Object.assign(new Error(`Bu oyning bepul ovoz limiti tugadi (${b.used}/${b.limit} belgi, dars ${chars} belgi)`), { budget: true });
    console.log(`  ovoz limiti: ${b.unlimited ? 'cheklovsiz' : `${b.used}/${b.limit} belgi`}`);
  }
  console.log(`\n▶ ${LANG} ${LEVEL.toUpperCase()} #${n + 1}: ${L.meta.t} (${core.scenes.length} sahna)`);

  // Ovoz bo'laklari → bir xil formatdagi WAV, orasida jimlik
  const parts = [];
  const silence = (sec, name) => {
    const f = path.join(work, name);
    sh(FFMPEG, ['-v', 'error', '-y', '-f', 'lavfi', '-i', `anullsrc=r=44100:cl=mono`, '-t', String(sec), '-c:a', 'pcm_s16le', f]);
    return f;
  };
  parts.push(silence(INTRO_SEC, 'intro.wav'));
  let cursor = INTRO_SEC;
  const scenes = [];
  for (let i = 0; i < renderScenes.length; i++) {
    const sc = renderScenes[i];
    const recFile = recording && sc.nativeSpeech ? recording[renderScenes.slice(0, i).filter(x => x.nativeSpeech).length] : null;
    const rawFile = recFile || await synth(sc.say, sc.nativeSpeech ? learning.languages[NATIVE].locale : langInfo.locale, sc.emotion, path.join(work, `s${i}.${TTS === 'piper' || TTS === 'windows' ? 'wav' : 'mp3'}`));
    const wav = path.join(work, `s${i}n.wav`);
    sh(FFMPEG, ['-v', 'error', '-y', '-i', rawFile, '-ac', '1', '-ar', '44100', '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11', '-c:a', 'pcm_s16le', wav]);
    const d = ffprobeDur(wav);
    const postGap = POST_GAP + Math.max(0, Math.min(20, Number(sc.practice_seconds) || 0));
    parts.push(silence(PRE_GAP, `pre${i}.wav`), wav, silence(postGap, `post${i}.wav`));
    scenes.push({ ...sc, start: cursor, audioStart: cursor + PRE_GAP, audioEnd: cursor + PRE_GAP + d, end: cursor + PRE_GAP + d + postGap });
    cursor += PRE_GAP + d + postGap;
    process.stdout.write(`  ovoz ${i + 1}/${core.scenes.length} (${d.toFixed(1)}s)\r`);
  }
  parts.push(silence(OUTRO_SEC, 'outro.wav'));
  const duration = cursor + OUTRO_SEC;

  const list = path.join(work, 'list.txt');
  fs.writeFileSync(list, parts.map(p => `file '${p.replace(/\\/g, '/').replace(/'/g, "'\\''")}'`).join('\n'));
  const track = path.join(work, 'track.wav');
  sh(FFMPEG, ['-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', list, '-c:a', 'pcm_s16le', track]);
  const env = envelope(track, duration);

  // Kadrlar → ffmpeg (MJPEG oqimi) → H.264 + AAC
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  page.on('pageerror', e => console.error('  sahifa xatosi:', e.message));
  await page.goto(`${baseUrl}/render/lesson-video.html`, { waitUntil: 'networkidle' });
  await page.evaluate(d => window.setup(d), {
    lang: LANG, level: LEVEL, cefr: L.meta.cefr || LEVEL.toUpperCase(), n, total: L.total,
    courseName: `${langInfo.native}`, nativeLang: NATIVE, labels: { chapters:copy('chapters',NATIVE), practice:copy('practice',NATIVE), next:copy('next',NATIVE) }, uzTitle: core.title || L.meta.t, goal: core.goal_uz, vocab: core.vocab,
    scenes, intro: { start: 0, end: INTRO_SEC }, outro: { start: duration - OUTRO_SEC, end: duration },
    duration, fps: FPS, envelope: env
  });

  const file = path.join(OUT, `${NATIVE}_${LANG}_${LEVEL}_${String(n + 1).padStart(2, '0')}.mp4`);
  const ff = spawn(FFMPEG, ['-v', 'error', '-y',
    '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
    '-i', track,
    '-c:v', 'libx264', '-preset', args.preset || 'medium', '-tune', 'stillimage', '-crf', String(args.crf || process.env.VIDEO_CRF || 27), '-pix_fmt', 'yuv420p', '-r', String(FPS), '-g', String(FPS * 10),
    '-c:a', 'aac', '-ac', '1', '-b:a', '96k', '-shortest', '-movflags', '+faststart',
    '-metadata', `title=LinguaVerse ${LANG} ${LEVEL.toUpperCase()} — ${L.meta.t}`,
    file], { stdio: ['pipe', 'inherit', 'inherit'] });
  const done = new Promise((res, rej) => ff.on('close', c => c === 0 ? res() : rej(new Error('ffmpeg kodlash xatosi ' + c))));

  // CDP to'g'ridan-to'g'ri skrinshot — page.screenshot dan ~6 marta tez
  const cdp = await page.context().newCDPSession(page);
  const total = Math.ceil(duration * FPS);
  for (let f = 0; f < total; f++) {
    await page.evaluate(t => window.frame(t), f / FPS);
    const shot = await cdp.send('Page.captureScreenshot', {
      format: 'jpeg', quality: 90, optimizeForSpeed: true,
      clip: { x: 0, y: 0, width: 1280, height: 720, scale: SCALE }     // 1080p
    });
    const jpg = Buffer.from(shot.data, 'base64');
    if (!ff.stdin.write(jpg)) await new Promise(r => ff.stdin.once('drain', r));
    if (f % (FPS * 5) === 0) process.stdout.write(`  kadr ${f}/${total} (${Math.round(f / total * 100)}%)        \r`);
  }
  ff.stdin.end();
  await done;
  const actualDuration = ffprobeDur(file);
  if (Math.abs(actualDuration - duration) > 1) throw new Error('Encoded video duration mismatch');
  await page.close();
  fs.rmSync(work, { recursive: true, force: true });

  const metadata = videoMetadata(scenes);
  fs.writeFileSync(file.replace(/\.mp4$/, '.json'), JSON.stringify({nativeLang:NATIVE,lang:LANG,level:LEVEL,n,duration,...metadata}, null, 2));
  fs.writeFileSync(file.replace(/\.mp4$/, '.vtt'), captionsVtt(metadata.captions));
  const sizeMb = fs.statSync(file).size / 1048576;
  console.log(`  ✅ ${path.basename(file)} — ${Math.round(duration)}s, ${sizeMb.toFixed(1)} MB, ${Math.round((Date.now() - t0) / 1000)}s da tayyor`);

  // Yuklash va darsga bog'lash
  if (args.upload) {
    const storage = require(path.join(ROOT, 'netlify/functions/_storage.js'));
    const fsdb = require(path.join(ROOT, 'netlify/functions/_firestore.js'));
    const course = require(path.join(ROOT, 'netlify/functions/course.js'));
    const objectName = `courseVideos/v3/${NATIVE}/${LANG}_${LEVEL}_${n}.mp4`;
    await storage.upload(objectName, fs.readFileSync(file), 'video/mp4');
    await fsdb.setDoc(course.lessonPath(LANG, LEVEL, n, NATIVE), { videoPath: storage.storedPath(objectName), videoWanted: false, videoDuration: Math.round(duration), videoUpdatedAt: new Date(), videoRenderingAt: null, videoChapters: metadata.chapters, videoCaptions: metadata.captions, nativeLang: NATIVE, videoError: null });
    await bumpStatus(fsdb, `${LANG}_${LEVEL}`, 1);
    const cefr = L.meta?.cefr;
    if (cefr) await fsdb.transact(`videoFactory/v3_${NATIVE}`, cur => ({ cefr: { ...(cur?.cefr || {}), [`${LANG}_${cefr}`]: ((cur?.cefr || {})[`${LANG}_${cefr}`] || 0) + 1 } })).catch(() => {});
    console.log(`  ☁️  yuklandi: ${objectName}`);
    if (args.auto) fs.rmSync(file, { force: true });     // fabrika rejimida disk to'lmasin
  }
  return file;
}

// ═══════════════════════════════════════════════════════════════════════════
// VIDEO FABRIKA (--auto): hali MP4 i yo'q darslarni o'zi topib, navbat bilan
// yaratadi. Bir nechta runner parallel ishlasa ham bir darsni ikki marta
// qilmaydi (videoRenderingAt qulfi, 3 soatdan keyin eskiradi).
// Holat videoFactory/status hujjatida — admin panel shuni ko'rsatadi.
// ═══════════════════════════════════════════════════════════════════════════
const LOCK_MS = 3 * 3600_000;

async function bumpStatus(fsdb, key, add = 0, extra = {}) {
  await fsdb.transact(`videoFactory/v3_${NATIVE}`, cur => {
    const done = { ...(cur?.done || {}) };
    if (add) done[key] = (done[key] || 0) + add;
    return { done, updatedAt: new Date(), ...extra };
  }).catch(e => console.warn('  holat yozilmadi:', e.message));
}

async function claim(fsdb, docPath) {
  let ok = false;
  await fsdb.transact(docPath, cur => {
    if (cur?.videoPath) return null;
    const at = cur?.videoRenderingAt instanceof Date ? cur.videoRenderingAt.getTime() : 0;
    if (at && Date.now() - at < LOCK_MS) return null;
    ok = true;
    return { videoRenderingAt: new Date() };
  });
  return ok;
}

async function autoQueue() {
  const fsdb = require(path.join(ROOT, 'netlify/functions/_firestore.js'));
  const course = require(path.join(ROOT, 'netlify/functions/course.js'));
  const cat = await import(pathToFileURL(path.join(ROOT, 'js', 'course-catalog.mjs')).href);
  const langs = !args.langs || args.langs === 'all' ? cat.COURSE_LANGS.map(l => l.id) : String(args.langs).split(',');
  if (langs.some(l => !cat.COURSE_LANGS.some(c=>c.id===l))) throw new Error('Unsupported target language');
  const batch = Math.max(1, Math.min(30, Number(args.batch) || 10));
  const jobs = [];
  const cefrDone = {};
  // 0) BITTA DARS (--only english:b2:5) — sayt o'quvchi bosishi bilan yuboradi
  const only = args.only || process.env.ONE_LESSON;
  if (only) {
    const [lang, level, nStr] = String(only).split(':');
    const n = Number(nStr);
    if (!cat.COURSE_LANGS.some(c => c.id === lang) || !cat.COURSE_LEVELS[level] || !Number.isInteger(n) || !cat.COURSE_LEVELS[level].lessons[n]) throw new Error('Invalid --only lesson');
    return { jobs: [{ lang, level, n, docPath: course.lessonPath(lang, level, n, NATIVE) }], fsdb, batch: 1 };
  }
  // 1) NAVBAT: o'quvchilar ochgan darslar (eng ko'p ochilgani birinchi)
  const wanted = await fsdb.queryList('courseLessons', [{ field: 'videoWanted', op: 'EQUAL', value: true }, { field: 'nativeLang', op: 'EQUAL', value: NATIVE }], 'videoDemand', 200).catch(() => []);
  for (const d of wanted) {
    if (d.videoPath || !langs.includes(d.lang) || !['b2', 'c2'].includes(d.level) || !Number.isInteger(d.n)) continue;
    if (!cat.COURSE_LEVELS[d.level].lessons[d.n]?.core) continue;   // MP4 faqat 60 ta asosiy darsga
    if (jobs.length < batch * 4) jobs.push({ lang: d.lang, level: d.level, n: d.n, docPath: course.lessonPath(d.lang, d.level, d.n, NATIVE), demand: d.videoDemand || 1 });
  }
  // 2) "all" rejimida qolgan darslar ham ketma-ket (A1 dan boshlab) — pullik
  //    ovoz/joy bo'lsa. Standart "demand": faqat navbatdagilar (bepul rejim).
  const fillAll = String(args.mode || process.env.VIDEO_MODE || 'demand') === 'all';
  for (const lang of langs) {
    if (learning.languages[NATIVE].target === lang) continue;
    for (const level of ['b2', 'c2']) {
      const all = cat.COURSE_LEVELS[level].lessons;
      const total = all.filter(l => l.core).length;
      let ready = 0;
      for (let n = 0; n < all.length; n++) {
        if (!all[n].core) continue;                       // YouTube darslari — MP4 yasalmaydi
        const cefr = all[n].cefr;
        cefrDone[`${lang}_${cefr}`] = cefrDone[`${lang}_${cefr}`] || 0;
        const doc = await fsdb.getDoc(course.lessonPath(lang, level, n, NATIVE)).catch(() => null);
        if (doc?.videoPath) { ready++; cefrDone[`${lang}_${cefr}`]++; continue; }
        if (fillAll && jobs.length < batch * 4 && !jobs.some(j => j.docPath === course.lessonPath(lang, level, n, NATIVE))) jobs.push({ lang, level, n, docPath: course.lessonPath(lang, level, n, NATIVE) });
      }
      // Aniq sonni qayta yozamiz (qo'lda o'chirilgan videolar ham hisobga olinsin)
      await fsdb.transact(`videoFactory/v3_${NATIVE}`, cur => ({ done: { ...(cur?.done || {}), [`${lang}_${level}`]: ready }, totals: { ...(cur?.totals || {}), [`${lang}_${level}`]: total }, updatedAt: new Date() }));
    }
  }
  await fsdb.transact(`videoFactory/v3_${NATIVE}`, cur => ({ cefr: { ...(cur?.cefr || {}), ...cefrDone }, updatedAt: new Date() }));
  return { jobs, fsdb, batch };
}

// ── Asosiy ──
// playwright lokal (npm i --no-save playwright) yoki global o'rnatilgan bo'lishi mumkin
let pw;
try { pw = process.env.PLAYWRIGHT_MODULE ? await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href) : await import('playwright'); }
catch { pw = require(path.join(sh('npm', ['root', '-g']).trim(), 'playwright')); }
const { chromium } = pw;
const server = await serve();
const baseUrl = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ ...(process.env.CHROME_PATH ? {executablePath:process.env.CHROME_PATH} : {}) });
const failed = [];
try {
  if (args.auto) {
    args.upload = true;
    const { jobs, fsdb, batch } = await autoQueue();
    console.log(`Fabrika: nomzodlar ${jobs.length} ta, bu runner ${batch} tagacha dars qiladi`);
    let taken = 0;
    for (const j of jobs) {
      if (taken >= batch) break;
      if (!(await claim(fsdb, j.docPath))) { console.log(`  ⏭ ${j.lang} ${j.level} #${j.n + 1} — boshqa runner qilmoqda`); continue; }
      taken++;
      LANG = j.lang; LEVEL = j.level;
      try { await renderOne(j.n, browser, baseUrl); }
      catch (e) {
        if (e.budget) {
          console.log('  ⏸ ' + e.message + ' — fabrika keyingi oygacha kutadi');
          await fsdb.setDoc(j.docPath, { videoRenderingAt: null }).catch(() => {});
          await bumpStatus(fsdb, '', 0, { lastError: e.message, lastErrorAt: new Date() });
          break;
        }
        failed.push(`${j.lang}_${j.level}#${j.n + 1}`);
        console.error(`  ❌ ${j.lang} ${j.level} #${j.n + 1}: ${e.message}`);
        await fsdb.setDoc(j.docPath, { videoRenderingAt: null, videoError: String(e.message).slice(0, 300) }).catch(() => {});
        await bumpStatus(fsdb, '', 0, { lastError: `${j.lang} ${j.level} #${j.n + 1}: ${String(e.message).slice(0, 200)}`, lastErrorAt: new Date() });
      }
    }
    await bumpStatus(fsdb, '', 0, { lastRunAt: new Date() });
  } else {
    for (const n of lessonList()) {
      try { await renderOne(n, browser, baseUrl); }
      catch (e) { failed.push(n + 1); console.error(`  ❌ #${n + 1}: ${e.message}`); }
    }
  }
} finally {
  await browser.close();
  server.close();
}
if (failed.length) {
  console.error('Tayyor bo\'lmagan darslar:', failed.join(', '));
  // Fabrika rejimida qisman muvaffaqiyat — normal holat (keyingi safar qayta uriniladi)
  process.exitCode = 1;
}
