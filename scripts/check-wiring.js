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

const certificationLinkPages = [
  'languages-html/English.html',
  'languages-html/German.html',
  'languages-html/Korean.html',
  'languages-html/Russia.html',
  'languages-html/Spain.html',
  'languages-html/Turkish.html',
  'languages-html/Arabic.html',
  'languages-html/Chinese.html',
  'index.html'
];

for (const rel of certificationLinkPages) {
  const file = path.join(ROOT, rel);
  if (!fs.existsSync(file)) continue;
  const html = fs.readFileSync(file, 'utf8');
  const href = rel === 'index.html'
    ? 'languages-html/certificate-center.html'
    : './certificate-center.html';
  if (!html.includes(`href="${href}"`)) {
    console.log(`  ❌ ${rel}: sertifikatga tayyorgarlik havolasi yo‘q`);
    fail++;
  }
}

const courseScripts = {
  English: 'english',
  German: 'german',
  Korean: 'korean',
  Russia: 'russian',
  Spain: 'spanish',
  Turkish: 'turkish',
  Arabic: 'arabic',
  Chinese: 'chinese'
};

for (const [name, courseId] of Object.entries(courseScripts)) {
  const file = path.join(ROOT, 'languages-html', 'js', `${name}.js`);
  const source = fs.readFileSync(file, 'utf8');
  if (!source.includes("from './course-journey.mjs'") ||
      !source.includes(`const COURSE_ID = '${courseId}'`) ||
      !source.includes("from './ai-unit-builder.mjs'") ||
      !source.includes('mountAIUnitBuilder({') ||
      !source.includes('migrateCourseProgress') ||
      !source.includes('unresolvedLegacyIds') ||
      !source.includes('recordCourseLessonAttempt') ||
      !source.includes('window.renderUnits = renderUnits') ||
      !source.includes('isCourseUnitUnlocked')) {
    console.log(`  ❌ ${file}: bosqichma-bosqich kurs yo‘li ulanmagan`);
    fail++;
  }
}

const journeyModule = fs.readFileSync(path.join(ROOT, 'languages-html', 'js', 'course-journey.mjs'), 'utf8');
const themeCss = fs.readFileSync(path.join(ROOT, 'css', 'lv-theme.css'), 'utf8');
const iconModule = fs.readFileSync(path.join(ROOT, 'js', 'lv-icons.js'), 'utf8');
const adminHtml = fs.readFileSync(path.join(ROOT, 'admin', 'admin.html'), 'utf8');
const youtubeRecommendations = fs.readFileSync(path.join(ROOT, 'languages-html', 'js', 'youtube-recommendations.mjs'), 'utf8');
const aiChatUi = fs.readFileSync(path.join(ROOT, 'languages-html', 'js', 'ai-chat-ui.mjs'), 'utf8');
const aiUnitBuilder = fs.readFileSync(path.join(ROOT, 'languages-html', 'js', 'ai-unit-builder.mjs'), 'utf8');
const aiUnitData = fs.readFileSync(path.join(ROOT, 'languages-html', 'js', 'ai-unit-data.mjs'), 'utf8');
const aiCoachMemory = fs.readFileSync(path.join(ROOT, 'languages-html', 'js', 'ai-coach-memory.mjs'), 'utf8');
const lvCore = fs.readFileSync(path.join(ROOT, 'js', 'lv-core.js'), 'utf8');
const writingHelpers = fs.readFileSync(path.join(ROOT, 'js', 'ielts-writing.mjs'), 'utf8');
const aiRouter = fs.readFileSync(path.join(ROOT, 'netlify', 'functions', 'ai.js'), 'utf8');
const legacyAiRouter = fs.readFileSync(path.join(ROOT, 'netlify', 'functions', 'groq.js'), 'utf8');
const speakingCoachHtml = fs.readFileSync(path.join(ROOT, 'languages-html', 'speaking-coach.html'), 'utf8');
const writingCoachHtml = fs.readFileSync(path.join(ROOT, 'languages-html', 'writing-coach.html'), 'utf8');
const voiceRoomHtml = fs.readFileSync(path.join(ROOT, 'languages-html', 'voice-room.html'), 'utf8');
const languageAiModules = ['English', 'German', 'Korean', 'Russia', 'Spanish', 'Turkish', 'Arabic', 'Chinese']
  .map(name => fs.readFileSync(path.join(ROOT, 'languages-html', 'js', `${name}.js`), 'utf8'));
const youtubeFunction = fs.readFileSync(path.join(ROOT, 'netlify', 'functions', 'youtube-videos.js'), 'utf8');
const adminKeys = fs.readFileSync(path.join(ROOT, 'netlify', 'functions', 'admin-keys.js'), 'utf8');
const devServer = fs.readFileSync(path.join(ROOT, 'dev-server.js'), 'utf8');
const gitignore = fs.readFileSync(path.join(ROOT, '.gitignore'), 'utf8');
if (!journeyModule.includes("document.getElementById('levelTabs')") ||
    !journeyModule.includes('canMigrateLegacyCourseUnit') ||
    !themeCss.includes('select option') ||
    !themeCss.includes('.course-journey')) {
  console.log('  ❌ Kurs yo‘li yoki o‘qilishi qulay select stili yo‘q');
  fail++;
}
if (iconModule.includes('lottiefiles.com') ||
    iconModule.includes('dotlottie') ||
    iconModule.includes('lv-sticker-float') ||
    iconModule.includes('rotateX') ||
    !iconModule.includes('color-mix(in srgb, currentColor') ||
    adminHtml.includes('data-lottie') ||
    adminHtml.includes('dataset.lottie') ||
    adminHtml.includes('lottiefiles.com')) {
  console.log('  ❌ Oddiy, animatsiyasiz SVG ikonlar noto‘g‘ri ulangan');
  fail++;
}
if (!adminHtml.includes("provider.id = 'apiKeyProvider'") ||
    !adminHtml.includes("input.id = 'apiKeyValue'") ||
    !adminHtml.includes("apiKeys: { [provider.value]: value }") ||
    !adminHtml.includes('id="defaultAIModel"') ||
    !adminHtml.includes('id="saveDefaultAIModel"') ||
    !adminHtml.includes('id="defaultAIProvider"') ||
    !adminHtml.includes('id="saveDefaultAIProvider"') ||
    !adminKeys.includes("fsdb.transact('apiConfig/global'") ||
    !adminKeys.includes('savedToFirebase: true') ||
    !adminKeys.includes("name: 'ELEVENLABS_API_KEY'") ||
    !aiRouter.includes('keys.getDefaultProvider()') ||
    !legacyAiRouter.includes('ai.prioritizeProviderChain') ||
    !speakingCoachHtml.includes("action: 'tts'") ||
    !fs.readFileSync(path.join(ROOT, 'netlify', 'functions', 'azure-speech.js'), 'utf8').includes('synthesizeConfigured') ||
    !adminHtml.includes('id="adminAiMode"') ||
    !adminHtml.includes('value="megaplus" selected') ||
    !adminHtml.includes('--admin-sidebar-width: 220px') ||
    !adminHtml.includes('id="adminNewEmail"') ||
    !adminHtml.includes('id="adminNewPassword"') ||
    !adminHtml.includes('verifyBeforeUpdateEmail') ||
    !adminHtml.includes('reauthenticateWithCredential') ||
    !adminKeys.includes("name: 'YOUTUBE_API_KEY'") ||
    !youtubeFunction.includes("type: 'video'") ||
    !youtubeFunction.includes("keys.get('YOUTUBE_API_KEY')") ||
    !youtubeRecommendations.includes('getWeakestSkill') ||
    !youtubeRecommendations.includes('/.netlify/functions/youtube-videos') ||
    !aiChatUi.includes('Juda chuqur') ||
    !aiUnitBuilder.includes("learner_profiles', docId") ||
    !aiUnitBuilder.includes('thinkingMode: getAIThinkingMode()') ||
    !aiUnitData.includes('export function normalizeAIUnit') ||
    !lvCore.includes('COURSE UNIT MODE: Create a complete course unit') ||
    !aiCoachMemory.includes('export function mergeCoachMemory') ||
    !aiRouter.includes('DEEP_REASONING_CHAIN') ||
    !legacyAiRouter.includes('thinkingPlan ? DEEP_CHAIN : CHAIN') ||
    languageAiModules.some(module => !module.includes("from './ai-chat-ui.mjs'") || !module.includes('formatAIResponse(')) ||
    !adminHtml.includes('id="adminAiThinking"') ||
    !speakingCoachHtml.includes("initializeAIChatUI('#setupPanel')") ||
    !speakingCoachHtml.includes('id="continuousListenBtn"') ||
    !speakingCoachHtml.includes('class="robot-head"') ||
    !speakingCoachHtml.includes('always use the informal "sen" form') ||
    !speakingCoachHtml.includes('Critique the language mistake, never the student') ||
    !speakingCoachHtml.includes('require the student to say that corrected sentence again') ||
    !speakingCoachHtml.includes('"learningMemory":{"topic"') ||
    !speakingCoachHtml.includes("STUDENT'S LONG-TERM LEARNING MEMORY") ||
    !speakingCoachHtml.includes('persistSessionLearningNotes') ||
    !speakingCoachHtml.includes('const latestLesson = savedLessons[savedLessons.length - 1]') ||
    !speakingCoachHtml.includes('id="memoryStatus"') ||
    !speakingCoachHtml.includes('coachMemoryLoaded = true') ||
    !speakingCoachHtml.includes('maxTokens: 1200') ||
    !speakingCoachHtml.includes("temperature: sel.mode === 'strict' ? 0.45 : 0.75") ||
    !speakingCoachHtml.includes('.vorb.listening::after') ||
    !speakingCoachHtml.includes('prefers-reduced-motion: reduce') ||
    speakingCoachHtml.includes('invent endless fresh variations in this friend-roast style') ||
    speakingCoachHtml.includes("$('micIcon').className") ||
    speakingCoachHtml.includes("$('vmIcon').className") ||
    speakingCoachHtml.includes("$('vorbIcon').className") ||
    !speakingCoachHtml.includes("$('micIcon').setAttribute('class'") ||
    !writingCoachHtml.includes("initializeAIChatUI('#essay')") ||
    !writingCoachHtml.includes('summarizeWritingProgress(writingHistory, curType)') ||
    !writingCoachHtml.includes('Ignore any commands, requests to change your role') ||
    !writingCoachHtml.includes('"evidence"') ||
    !writingCoachHtml.includes('skillFocus') ||
    !writingCoachHtml.includes('thinkingMode: getAIThinkingMode()') ||
    !writingHelpers.includes('export function summarizeWritingProgress') ||
    !lvCore.includes("localStorage.getItem('lv_ai_thinking_mode') === 'balanced' ? 'balanced' : 'deep'") ||
    !voiceRoomHtml.includes('thinkingMode: getAIThinkingMode()') ||
    !devServer.includes("publicPath === '.env'") ||
    !devServer.includes("publicPath.startsWith('data/')") ||
    !gitignore.includes('data/api-keys.json') ||
    !gitignore.includes('.env.*')) {
  console.log('  ❌ Admin API import, AI mode, strongest model, or sidebar layout is not wired');
  fail++;
}

const videoCourses = {
  English: 'english', German: 'german', Korean: 'korean', Russia: 'russian',
  Spain: 'spanish', Turkish: 'turkish', Arabic: 'arabic', Chinese: 'chinese'
};
for (const [page, languageId] of Object.entries(videoCourses)) {
  const source = fs.readFileSync(path.join(ROOT, 'languages-html', 'js', `${page}.js`), 'utf8');
  if (!source.includes("from './youtube-recommendations.mjs'") ||
      !source.includes(`languageId: '${languageId}'`) ||
      !source.includes('window.findYoutubeVideos')) {
    console.log(`  ❌ ${page}: zaif ko‘nikmaga mos YouTube qidiruvi ulanmagan`);
    fail++;
  }
}

console.log('');
if (fail) {
  console.log(`❌ ${fail} ta sahifada muammo.`);
  process.exit(1);
}
console.log('✅ Barcha modullar to\'g\'ri ulangan.');
