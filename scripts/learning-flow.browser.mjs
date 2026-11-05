// Run with the dev server running: PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs
// CHROME_PATH=/path/to/chrome node scripts/learning-flow.browser.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
const { chromium } = process.env.PLAYWRIGHT_MODULE ? await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE).href) : await import('playwright');
const browser = await chromium.launch({ ...(process.env.CHROME_PATH ? {executablePath:process.env.CHROME_PATH} : {}) });
const base = process.env.TEST_BASE_URL || 'http://localhost:5511';
const errors = [];
try {
  const page = await browser.newPage({viewport:{width:1280,height:900}});
  page.on('pageerror', e=>errors.push(e.message));
  await page.goto(base + '/languages-html/courses.html',{waitUntil:'networkidle'});
  assert.equal(await page.locator('#lvTarget').inputValue(),'english');
  await page.locator('#lvNative').selectOption('ru');
  await page.locator('#lvTarget').selectOption('german');
  await page.locator('#lvLanguageSave').click();
  await page.waitForFunction(()=>document.querySelector('#courseHeading')?.textContent==='Видеоуроки' && !document.querySelector('#lvLanguageDialog'));
  assert.match(await page.locator('#coursePair').textContent(),/Русский → Deutsch/);
  await page.goto(base+'/languages-html/ai-coach.html',{waitUntil:'networkidle'});
  assert.equal(await page.locator('#nativeOpts .on').textContent(),'Русский');
  assert.equal(await page.locator('#langOpts .on').textContent(),'Deutsch');
  await page.locator('#lvLanguageButton').click();
  await page.locator('#lvNative').selectOption('ar');
  await page.locator('#lvLanguageSave').click();
  await page.waitForFunction(()=>document.documentElement.dir==='rtl' && !document.querySelector('#lvLanguageDialog'));
  await page.setViewportSize({width:390,height:844});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await page.close();

  // Isolated authorized-user fixture: no real account, payment or AI calls.
  const context=await browser.newContext();
  await context.addInitScript(()=>{localStorage.setItem('lv_language_setup','1');localStorage.setItem('coach_native','uz');});
  await context.route('**/js/lv-core.js',r=>r.fulfill({contentType:'text/javascript',body:'export const auth={}; export const url=p=>"/"+p; export const LV={ready:async()=>({signedIn:false})}; export const Speech={speak(){},stop(){}}; export const PLANS={}; export const MODELS={}; export const RESOURCES={}; export const db={}; export const aiRequest=async()=>({});'}));
  await context.route('**/js/fb/firebase-auth.js',r=>r.fulfill({contentType:'text/javascript',body:'export function onAuthStateChanged(a,cb){cb({getIdToken:async()=>"fixture"});return ()=>{};}'}));
  const lesson=JSON.parse(await fs.readFile(new URL('./samples/english_a1_greetings.json',import.meta.url),'utf8'));
  const meta=JSON.parse(await fs.readFile(new URL('../media/lessons/uz_english_b2_02.json',import.meta.url),'utf8'));
  const calls=[];
  await context.route('**/.netlify/functions/course',async route=>{
    const payload=route.request().postDataJSON();calls.push(payload);
    if(payload.action==='mine') return route.fulfill({json:{owned:['english_b2'],progress:{}}});
    if(payload.action==='lesson') return route.fulfill({json:{status:'ready',locale:'en-GB',nativeLang:'uz',videoUrl:'/media/lessons/uz_english_b2_02.mp4',videoChapters:meta.chapters,videoCaptions:meta.captions,lesson:{...lesson,quiz:[]}}});
    return route.fulfill({status:503,json:{error:'Fixture audio unavailable'}});
  });
  const player=await context.newPage();player.on('pageerror',e=>errors.push(e.message));
  await player.goto(base+'/languages-html/courses.html?lang=english&level=b2',{waitUntil:'networkidle'});
  await player.locator('#lessonSearch').fill('Salom');
  assert.equal(await player.locator('.ls:visible').count(),1);
  await player.locator('.ls:visible').click();
  await player.locator('#mp4').waitFor({state:'visible'});
  await player.waitForFunction(()=>document.getElementById('mp4').readyState>=2);
  assert.equal(await player.locator('#mp4 track').count(),2);
  assert.equal(await player.locator('#videoChapters button').count(),9);
  await player.locator('#videoChapters button').nth(2).click();
  await player.waitForFunction(()=>document.getElementById('mp4').currentTime>40);
  assert.equal(calls.find(c=>c.action==='lesson').nativeLang,'uz');
  await player.evaluate(()=>{const v=document.getElementById('mp4');v.src='/missing-video.mp4';v.load();});
  await player.locator('#mediaStatus button').first().waitFor();
  await player.locator('#mediaStatus button').nth(1).click();
  await player.locator('#screen').waitFor({state:'visible'});
  await player.evaluate(()=>window.closePlayer());
  assert.equal(await player.locator('#player').isVisible(),false);
  assert.equal(await player.locator('#mp4').getAttribute('src'),null);
  const range=await context.request.get(base+'/media/lessons/uz_english_b2_02.mp4',{headers:{Range:'bytes=0-99'}});
  assert.equal(range.status(),206);assert.equal((await range.body()).length,100);
  assert.deepEqual(errors,[]);
  console.log('PASS: language persistence, AI settings, mobile RTL, topic search, real MP4 playback/seek, captions, chapters, failure fallback, close cleanup and byte ranges.');
} finally { await browser.close(); }
