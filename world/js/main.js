// ═══════════════════════════════════════════════════════════════════════════
// main.js — 3D DUNYO ENTRY POINT
//
// Barcha tizimlarni yig'adi: sahna, o'yinchi, NPC, predmetlar, questlar,
// suhbat (AI), lug'at, sozlamalar, minimap. O'yin sikli shu yerda.
// ═══════════════════════════════════════════════════════════════════════════
import * as THREE from 'three';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';

import { LV } from '../../js/lv-core.js';
import { Voice, BrowserSTT, PronunciationTrainer } from '../../js/lv-speech.js';

import {
  WORLD, ZONES, WORDS, NPCS, WORD_BY_ID, NPC_BY_ID, zoneAt,
  CITIES, CITY_BY_ID, DEFAULT_SETTINGS
} from './config.js';
import { SceneManager } from './core/SceneManager.js';
import { CameraController } from './core/CameraController.js';
import { InputManager } from './core/InputManager.js';
import { PhysicsWorld } from './core/Physics.js';
import { WorldBuilder } from './build/WorldBuilder.js';
import { PlayerController } from './game/PlayerController.js';
import { NPC } from './game/NPC.js';
import { Interactables } from './game/Interactables.js';
import { ProgressStore } from './game/ProgressStore.js';
import { QuestManager } from './game/QuestManager.js';
import { AudioManager } from './game/AudioManager.js';
import { HUD } from './game/HUD.js';
import { Minimap } from './game/Minimap.js';
import { Traffic } from './game/Traffic.js';
import { Weather } from './game/Weather.js';
import { npcReply } from './game/AIService.js';

// ───────────────────────────────────────────────────────────────────────────
// TIZIMLAR
// ───────────────────────────────────────────────────────────────────────────
const container = document.getElementById('game-canvas');
const sceneMgr = new SceneManager(container);
const scene = sceneMgr.scene;
const camera = sceneMgr.camera;

const cameraCtrl = new CameraController(camera);
const input = new InputManager(sceneMgr.renderer.domElement);
// E tugmasi / joystik-interact — InputManager ishga tushishi uchun bog'lash
input.onInteract = () => interactNearest();
const physics = new PhysicsWorld();
const audio = new AudioManager();
const store = new ProgressStore();
const quests = new QuestManager(store);

const hud = new HUD({
  homeUrl: '../index.html',
  onSend: text => sendDialog(text),
  onQuickReply: text => sendDialog(text),
  onMic: toggleDialogMic,
  onTTS: toggleTTS,
  onCloseDialog: closeDialog,
  onCloseVocab: closeVocab,
  onVocabAudio: playVocabAudio,
  onVocabMic: micVocab,
  onVocabKnown: learnWord,
  onInteract: () => interactNearest(),
  onJoystick: (x, z) => input.setJoystick(x, z),
  onSettings: patch => applySettings(patch),
  onSettingsLive: patch => applySettings(patch, { live: true })
});

const minimap = new Minimap(document.getElementById('minimap'));

// ───────────────────────────────────────────────────────────────────────────
// LABEL RENDERER (CSS2D)
// ───────────────────────────────────────────────────────────────────────────
const labelRenderer = new CSS2DRenderer();
labelRenderer.setSize(container.clientWidth, container.clientHeight);
labelRenderer.domElement.style.position = 'absolute';
labelRenderer.domElement.style.top = '0';
labelRenderer.domElement.style.left = '0';
labelRenderer.domElement.style.pointerEvents = 'none';
labelRenderer.domElement.classList.add('label-renderer');
container.appendChild(labelRenderer.domElement);

window.addEventListener('resize', () => {
  labelRenderer.setSize(container.clientWidth, container.clientHeight);
});

// ───────────────────────────────────────────────────────────────────────────
// DUNYO QURISH (shahar tanlanganidan keyin startWorld() chaqiriladi)
// ───────────────────────────────────────────────────────────────────────────
let builder = null, built = null, wordMesh = null, npcMeshes = null;
let player = null, interact = null, npcs = [], npcByDef = new Map();
let traffic = null;
let currentCity = null;
let weather = new Weather(scene);

// ── Osmonda aylanib yuruvchi qushlar (jonli atmosfera) ──
const birds = new THREE.Group();
{
  const birdGeo = new THREE.ConeGeometry(0.32, 1, 5);
  const birdMat = new THREE.MeshLambertMaterial({ color: 0x2a2a3a, flatShading: true });
  for (let i = 0; i < 7; i++) {
    const b = new THREE.Mesh(birdGeo, birdMat);
    b.rotation.z = Math.PI / 2;
    const ang = (i / 7) * Math.PI * 2;
    b.position.set(Math.cos(ang) * 26, 0, Math.sin(ang) * 26);
    b.userData.ang = ang;
    b.userData.alt = 28 + Math.random() * 10;
    b.userData.flap = Math.random() * 6;
    birds.add(b);
  }
}
scene.add(birds);

function startWorld(city) {
  currentCity = city;

  // Shahar osmoni, yorug'ligi va kunduz/tun bazasi
  scene.background = new THREE.Color(city.sky);
  scene.fog = new THREE.Fog(city.fog, 90, 320);
  sceneMgr.sun.color.setHex(city.sunColor || 0xfff2d9);
  sceneMgr.sun.intensity = city.sun;
  sceneMgr.applyCity(city);

  // Shahar muhit ovozi (yengil fon)
  audio.setCity(city);

  builder = new WorldBuilder(scene, physics, city);
  built = builder.build();
  wordMesh = built.wordMesh;
  npcMeshes = built.npcMeshes;
  sceneMgr.registerLamps(built.lampLights);
  sceneMgr.registerWindows(built.windowMats);

  // Ob-havo (London — yomg'ir)
  if (city.weather === 'rain' && store.settings.quality !== 'low') {
    weather.enable();
  }

  player = new PlayerController(scene, physics, audio);
  interact = new Interactables(scene);

  // Shahar transporti (mashinalar + piyodalar)
  traffic = new Traffic(scene, city);
  traffic.init();

  // NPC instansiyalari
  npcs = [];
  for (const [id, group] of npcMeshes) {
    npcs.push(new NPC(NPC_BY_ID[id], group));
  }
  npcByDef = new Map(NPCS.map(n => [n.id, n]));

  // Word / NPC CSS2D label — gruppaga biriktiriladi (pos nisbiy)
  for (const w of WORDS) {
    const g = wordMesh.get(w.id);
    if (!g) continue;
    const lbl = interact.buildWordLabel(w);
    g.add(lbl);
  }
  for (const n of NPCS) {
    const g = npcMeshes.get(n.id);
    if (!g) continue;
    const lbl = interact.buildNpcLabel(n);
    g.add(lbl);
  }
}

// ───────────────────────────────────────────────────────────────────────────
// RAYCAST (sichqoncha)
// ───────────────────────────────────────────────────────────────────────────
const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
let hovering = null;         // hozirgi highlight qilingan group

function raycastAt(clientX, clientY) {
  const rect = sceneMgr.renderer.domElement.getBoundingClientRect();
  ndc.set(
    ((clientX - rect.left) / rect.width) * 2 - 1,
    -((clientY - rect.top) / rect.height) * 2 + 1
  );
  raycaster.setFromCamera(ndc, camera);
  return raycaster.intersectObjects(built.interactMeshes, true);
}

function findTarget(hits) {
  for (const h of hits) {
    let o = h.object;
    while (o) {
      if (o.userData && o.userData.wordId) return { kind: 'word', id: o.userData.wordId };
      if (o.userData && o.userData.npcId) return { kind: 'npc', id: o.userData.npcId };
      o = o.parent;
    }
  }
  return null;
}

function handleClick(clientX, clientY) {
  if (hud.dialogOpen || hud.vocabOpen) return;
  const target = findTarget(raycastAt(clientX, clientY));
  if (!target) return;
  if (target.kind === 'word') {
    const w = WORD_BY_ID[target.id];
    const d = Math.hypot(w.pos.x - player.position.x, w.pos.z - player.position.z);
    if (d <= WORLD.propInteractDist) openWord(w);
  } else {
    // NPC sayr qilgani uchun jonli pozitsiyadan hisoblaymiz
    const inst = npcs.find(n => n.def.id === target.id);
    const px = inst ? inst.position.x : NPC_BY_ID[target.id].pos.x;
    const pz = inst ? inst.position.z : NPC_BY_ID[target.id].pos.z;
    const d = Math.hypot(px - player.position.x, pz - player.position.z);
    if (d <= WORLD.npcInteractDist) openDialog(NPC_BY_ID[target.id]);
  }
}

// Hover highlight — sichqoncha ustiga olib borilganda
let lastPointer = null;
container.addEventListener('pointermove', e => {
  if (hud.dialogOpen || hud.vocabOpen) return;
  lastPointer = { x: e.clientX, y: e.clientY };
});
container.addEventListener('pointerleave', () => {
  lastPointer = null;
  interact.clearHighlight();
});

function updateHover() {
  if (!lastPointer || hud.dialogOpen || hud.vocabOpen) {
    if (hovering) { interact.clearHighlight(); hovering = null; }
    return;
  }
  const target = findTarget(raycastAt(lastPointer.x, lastPointer.y));
  let group = null;
  if (target) {
    if (target.kind === 'word') group = wordMesh.get(target.id);
    else group = npcMeshes.get(target.id);
  }
  if (group !== hovering) {
    interact.clearHighlight();
    hovering = group;
    if (group) interact.highlight(group);
  }
}

// ───────────────────────────────────────────────────────────────────────────
// YAQIN OBYEKT — E tugmasi / mobil tugma
// ───────────────────────────────────────────────────────────────────────────
function nearestInteractable() {
  const p = player.position;
  let best = null, bestD = Infinity;
  for (const w of WORDS) {
    const d = Math.hypot(w.pos.x - p.x, w.pos.z - p.z);
    if (d < WORLD.propInteractDist && d < bestD) {
      bestD = d; best = { kind: 'word', def: w };
    }
  }
  for (const n of npcs) {
    const d = Math.hypot(n.position.x - p.x, n.position.z - p.z);
    if (d < WORLD.npcInteractDist && d < bestD) {
      bestD = d; best = { kind: 'npc', def: n.def };
    }
  }
  return best;
}

function interactNearest() {
  const t = nearestInteractable();
  if (!t) { hud.toast('Yaqin atrofda suhbat yoki so\'z yo\'q', 'warn', 1800); return; }
  if (t.kind === 'npc') openDialog(t.def);
  else openWord(t.def);
}

function updateHint() {
  const t = nearestInteractable();
  if (hud.dialogOpen) { hud.setHint(''); return; }
  if (t) {
    hud.setHint(t.kind === 'npc'
      ? `<b>💬 ${t.def.name}</b> — suhbat (E)`
      : `<b>📖 ${t.def.word}</b> — bosib o\'rganing`);
  } else {
    hud.setHint('');
  }
}

// ───────────────────────────────────────────────────────────────────────────
// SUHBAT
// ───────────────────────────────────────────────────────────────────────────
let dialog = null;
let ttsOn = true;

// Dialogdagi tayyor javoblar (tanlangan tilga mos) — suhbatni oson boshlash uchun
const QUICK_REPLIES = {
  'en-US': ['Hello!', 'How are you?', 'Could you say that again?', 'Thank you!', 'Goodbye!'],
  'ru-RU': ['Привет!', 'Как дела?', 'Повторите, пожалуйста', 'Спасибо!', 'До свидания!'],
  'es-ES': ['¡Hola!', '¿Cómo estás?', 'Repite, por favor', '¡Gracias!', '¡Adiós!'],
  'de-DE': ['Hallo!', 'Wie geht\'s?', 'Kannst du das wiederholen?', 'Danke!', 'Tschüss!'],
  'tr-TR': ['Merhaba!', 'Nasılsın?', 'Tekrar söyler misin?', 'Teşekkürler!', 'Hoşça kal!']
};

function openDialog(npcDef) {
  if (dialog) return;
  if (!audio.ctx) audio.init();
  dialog = { npc: npcDef, history: [] };
  player.setFrozen(true);
  const npc = npcs.find(n => n.def.id === npcDef.id);
  if (npc) npc.setTalking(true);
  cameraCtrl.target.set(npcDef.pos.x, 0, npcDef.pos.z);
  cameraCtrl.distance = 4.2;
  audio.talk();
  hud.openDialog(npcDef);
  hud.setQuickReplies(QUICK_REPLIES[store.settings.targetLang] || QUICK_REPLIES['en-US']);
  hud.addMessage('npc', npcDef.greeting);
  dialog.history.push({ role: 'assistant', content: npcDef.greeting });
  showTalkBubble(npcDef, npcDef.greeting);
  speak(npcDef.greeting);
}

// ───────────────────────────────────────────────────────────────────────────
// SUHBAT PUFAKCHASI — NPC boshining ustida suzuvchi so'zlashuv matni
// ───────────────────────────────────────────────────────────────────────────
const talkBubbleEl = document.createElement('div');
talkBubbleEl.className = 'lv-talk-bubble';
const talkBubble = new CSS2DObject(talkBubbleEl);
let talkBubbleNpc = null;
let talkBubbleTimer = null;

function showTalkBubble(npcDef, text) {
  hideTalkBubble();
  const group = npcMeshes.get(npcDef.id);
  if (!group) return;
  talkBubbleEl.textContent = String(text || '');
  talkBubble.position.set(0, 2.75, 0);
  group.add(talkBubble);
  talkBubbleNpc = npcDef.id;
  clearTimeout(talkBubbleTimer);
  talkBubbleTimer = setTimeout(hideTalkBubble, 6000);
}

function hideTalkBubble() {
  clearTimeout(talkBubbleTimer);
  if (talkBubbleNpc) {
    const group = npcMeshes.get(talkBubbleNpc);
    if (group) group.remove(talkBubble);
    talkBubbleNpc = null;
  }
}

function closeDialog() {
  if (!dialog) return;
  const npc = npcs.find(n => n.def.id === dialog.npc.id);
  if (npc) npc.setTalking(false);
  dialog = null;
  player.setFrozen(false);
  audio.stopSpeak();
  hideTalkBubble();
  hud.closeDialog();
}

function toggleTTS() {
  ttsOn = !ttsOn;
  hud.toast(ttsOn ? '🔊 Ovoz yoqildi' : '🔇 Ovoz o\'chirildi', ttsOn ? 'good' : 'warn', 1600);
  if (!ttsOn) audio.stopSpeak();
  else if (dialog && dialog.history.length) {
    const last = [...dialog.history].reverse().find(m => m.role === 'assistant');
    if (last) speak(last.content);
  }
}

function speak(text) {
  if (!ttsOn) return;
  const s = store.settings;
  audio.speak(text, s.targetLang, { voice: s.voice === 'female' ? 'Female' : 'Male' })
    .catch(() => {});
}

async function sendDialog(text) {
  if (!dialog) return;
  const npc = dialog.npc;
  hud.addMessage('user', text);
  dialog.history.push({ role: 'user', content: text });

  // Questlar: suhbat xabari + ibora
  quests.trigger('talk', { npc: npc.id });
  quests.checkPhrase(text);
  store.addTalk();
  refresh();

  hud.setTyping(true);
  const r = await npcReply(npc, dialog.history, store.settings, {
    city: currentCity,
    userName: (LV.profile && LV.profile.displayName) || null
  });
  hud.setTyping(false);

  if (!r.ok) {
    hud.addMessage('npc', r.text, { note: r.limitNote });
    dialog.history.push({ role: 'assistant', content: r.text });
    return;
  }
  hud.addMessage('npc', r.text);
  dialog.history.push({ role: 'assistant', content: r.text });
  showTalkBubble(dialog.npc, r.text);
  speak(r.text);
}

async function toggleDialogMic() {
  if (!dialog) return;
  if (hud.micActive) {
    hud.setMicActive(false);
    return;
  }
  if (!BrowserSTT.supported()) {
    hud.toast('Brauzeringiz nutq tanishni qo\'llab-quvvatlamaydi', 'bad', 3000);
    return;
  }
  hud.setMicActive(true);
  try {
    const res = await BrowserSTT.listen(store.settings.targetLang, { timeoutMs: 12000 });
    hud.setMicActive(false);
    if (res && res.text) sendDialog(res.text);
  } catch (e) {
    hud.setMicActive(false);
    hud.toast(e.message || 'Mikrofon xatosi', 'bad', 3000);
  }
}

// ───────────────────────────────────────────────────────────────────────────
// SO'Z KARTASI
// ───────────────────────────────────────────────────────────────────────────
let activeWord = null;
let vocabMicBusy = false;

function openWord(wordDef) {
  if (hud.vocabOpen) return;
  audio.init();
  activeWord = wordDef;
  player.setFrozen(true);
  hud.openVocab(wordDef, store.isKnown(wordDef.id));
}

function closeVocab() {
  if (!activeWord) return;
  activeWord = null;
  vocabMicBusy = false;
  audio.stopSpeak();
  player.setFrozen(false);
  hud.closeVocab();
}

function playVocabAudio() {
  if (!activeWord) return;
  const s = store.settings;
  audio.speak(activeWord.word, s.targetLang, { rate: 0.95, voice: s.voice })
    .catch(() => {});
}

async function micVocab() {
  if (!activeWord || vocabMicBusy) return;
  vocabMicBusy = true;
  const s = store.settings;
  const word = activeWord;
  const trainer = new PronunciationTrainer(s.targetLang, {
    autoStop: s.autoStop,
    silenceMs: 1500,
    onAutoStop: () => finish()
  });

  let finished = false;
  const finish = async () => {
    if (finished) return;
    finished = true;
    hud.toast('Baholanmoqda...', 'warn', 1500);
    try {
      const res = await trainer.finishAttempt(word.word);
      if (res.ok) {
        const score = res.scores?.overall;
        if (score != null) {
          hud.setVocabScore(score);
          if (score >= 70) {
            markLearned(true);
            return;
          }
          hud.toast('Yaxshi urinish! Yana bir bor sinang.', 'warn', 2500);
        } else if (res.noScores) {
          hud.toast(res.feedback?.[0]?.text || 'Yozib olindi', 'good', 3000);
        }
      } else {
        hud.toast(res.message || 'Qayta urinib ko\'ring', 'bad', 2500);
      }
    } catch (e) {
      hud.toast(e.message || 'Baholash xatosi', 'bad', 2500);
    }
  };

  hud.toast(`"${word.word}" — yozib olinmoqda...`, 'warn', 2000);
  try {
    await trainer.playModel(word.word, false);
    await trainer.startAttempt(() => {});
    setTimeout(finish, 8000);   // jimlik sezilmasa ham tugatish
  } catch (e) {
    hud.toast(e.message || 'Mikrofon xatosi', 'bad', 3000);
    vocabMicBusy = false;
  }
}

function markLearned(fromMic = false) {
  if (!activeWord) return;
  const word = activeWord;
  const known = store.isKnown(word.id);
  store.recordWord(word.id, true);
  const xpGain = known ? 5 : 10;
  const coins = known ? 0 : 1;
  const lvl = store.addXp(xpGain, 'word:' + word.id);
  store.addCoins(coins);
  audio.correct();
  quests.trigger('wordLearned', { zone: word.zone });
  hud.toast(`"${word.word}" — ${known ? 'takrorlandi' : 'o\'rganildi'}! +${xpGain} XP`, 'good', 3000);
  refresh();
  if (lvl.leveled) {
    audio.levelUp();
    hud.showLevelUp(lvl.level);
  }
  if (fromMic) {
    // mikrofon baholaganda xam kartani yopamiz
    closeVocab();
  }
}

function learnWord() { markLearned(false); }

// ───────────────────────────────────────────────────────────────────────────
// SOZLAMALAR
// ───────────────────────────────────────────────────────────────────────────
function applySettings(patch, opts = {}) {
  store.updateSettings(patch);
  const s = store.settings;
  if (opts.live) {
    audio.setVolume(s.sound);
    return;
  }
  sceneMgr.setQuality(s.quality);
  audio.setVolume(s.sound);
  hud.loadSettings(s);
  hud.toast('Sozlamalar saqlandi', 'good', 1600);
}

// ───────────────────────────────────────────────────────────────────────────
// QUEST EVENTLAR
// ───────────────────────────────────────────────────────────────────────────
function refresh() {
  if (!interact || !wordMesh) return;
  hud.updateProgress(store);
  hud.renderQuests(store, quests);
  hud.updateQuestMini(quests.getActive());
  interact.setDueRings(store.dueWords(), wordMesh);
}

quests.onChange((event, data) => {
  if (event === 'questComplete') {
    audio.coin();
    hud.toast(`✅ ${data.quest.title} — +${data.quest.xp} XP`, 'good', 4000);
    refresh();
    if (data.leveled) {
      audio.levelUp();
      hud.showLevelUp(data.level);
    }
  }
});

// ───────────────────────────────────────────────────────────────────────────
// ZONA ANIQLASH
// ───────────────────────────────────────────────────────────────────────────
let currentZone = null;

function checkZone() {
  const z = zoneAt(player.position.x, player.position.z);
  if (z !== currentZone) {
    currentZone = z;
    hud.setZone(z);
    audio.setZone(z ? z.ambient : null);
    if (z) {
      const isNew = store.visitZone(z.id);
      quests.trigger('zoneEntered', { zone: z.id });
      if (isNew) {
        hud.toast(`📍 ${z.nameUz} zonasiga xush kelibsiz!`, 'good', 2500);
      }
      refresh();
    }
  }
}

// ───────────────────────────────────────────────────────────────────────────
// AUDIO — autoplay qoidasi uchun birinchi bosish
// ───────────────────────────────────────────────────────────────────────────
function unlockAudio() {
  audio.init();
}
window.addEventListener('pointerdown', unlockAudio, { once: true });
window.addEventListener('keydown', unlockAudio, { once: true });

// ───────────────────────────────────────────────────────────────────────────
// O'YIN SIKLI
// ───────────────────────────────────────────────────────────────────────────
const clock = { last: performance.now() };
let ringTimer = 0;
let worldTime = 0;          // kunduz/tun sikli uchun

function frame(now) {
  const dt = Math.min(0.05, (now - clock.last) / 1000);
  clock.last = now;
  worldTime += dt;

  // Kamera orbit / zoom
  const orbit = input.consumeOrbit();
  const zoom = input.consumeZoom();
  const click = input.consumeClick();
  if (click) handleClick(click.x, click.y);

  // Kunduz/tun — sekin, atmosferik sikl (chuqur tun emas, qorong'ulik maks ~45%)
  const nightFactor = (Math.sin(worldTime * 0.025) * 0.5 + 0.5) * 0.45;
  sceneMgr.setDayNight(nightFactor);
  sceneMgr.updateAmbient(dt);

  // Kamera fokusi: suhbatda NPC, aks holda o'yinchi
  const targetPos = dialog
    ? new THREE.Vector3(dialog.npc.pos.x, 0, dialog.npc.pos.z)
    : new THREE.Vector3(player.position.x, 0, player.position.z);
  cameraCtrl.target.lerp(targetPos, 1 - Math.pow(0.001, dt));

  // O'yinchi
  player.update(dt, input, cameraCtrl.yaw);
  cameraCtrl.update(dt, orbit, zoom);

  // NPC + label + hud
  for (const n of npcs) n.update(dt, player.position);
  interact.updateWordLabels(player.position);
  interact.updateNpcLabels(player.position);
  interact.updateRings(dt);

  // Shahar transporti + ob-havo
  if (traffic) traffic.update(dt, player.position);
  weather.update(dt);

  // Qushlar — osmonda aylanish + tebranish (qanot)
  birds.rotation.y += dt * 0.06;
  for (const b of birds.children) {
    b.position.y = b.userData.alt + Math.sin(worldTime * 1.7 + b.userData.flap) * 1.6;
    b.rotation.z = Math.PI / 2 + Math.sin(worldTime * 2 + b.userData.flap) * 0.25;
  }

  // Fontan suv sachratgichi — tomchilar aylanadi va yuqoriga otiladi
  if (built && built.fountainSpray) {
    const ft = worldTime * 2.2;
    for (let i = 0; i < built.fountainSpray.children.length; i++) {
      const d = built.fountainSpray.children[i];
      const ang = d.userData.ang + ft * 0.4;
      const h = 0.55 + (Math.sin(ft * 2 + d.userData.phase) * 0.5 + 0.5) * 1.35;
      d.position.set(Math.cos(ang) * 1.05, h, Math.sin(ang) * 1.05);
    }
  }

  updateHover();
  updateHint();
  checkZone();

  // SRS ring — har 2 soniyada yangilash
  ringTimer += dt;
  if (ringTimer > 2) {
    ringTimer = 0;
    interact.setDueRings(store.dueWords(), wordMesh);
  }

  // Render
  sceneMgr.render();
  labelRenderer.render(scene, camera);

  // Minimap
  minimap.update(dt, player.position, currentZone);

  requestAnimationFrame(frame);
}

// ───────────────────────────────────────────────────────────────────────────
// YUKLASH + START
// ───────────────────────────────────────────────────────────────────────────
async function boot() {
  hud.setLoading(5, 'Tizimga ulanmoqda...');
  try { await LV.ready(); }
  catch {}

  // ── KIRISH TEKSHIRUVI ──
  if (!LV.snapshot().signedIn) {
    try { sessionStorage.setItem('intendedWorld', location.href); } catch {}
    location.href = '../auth/login.html';
    return;
  }

  hud.setLoading(25, 'Taraqqiyot yuklanmoqda...');
  await store.init();

  // ── TIL + SHAHAR TANLASH ──
  const { city, lang } = await selectSetup();
  if (lang && lang !== store.settings.targetLang) {
    store.updateSettings({ targetLang: lang });
  }
  hud.setLoading(45, 'Dunyo qurilmoqda...');
  await new Promise(r => setTimeout(r, 120));
  startWorld(city);

  // onChange endi ro'yxatdan o'tkaziladi — interact/player tayyor bo'lgach
  store.onChange(() => refresh());

  hud.setLoading(65, 'Ranglar bo\'yamoqda...');
  await new Promise(r => setTimeout(r, 120));

  hud.setLoading(85, 'NPClar joylashtirilmoqda...');
  await new Promise(r => setTimeout(r, 120));

  // Boshlang'ich holat
  hud.loadSettings(store.settings);
  sceneMgr.setQuality(store.settings.quality);
  audio.setVolume(store.settings.sound);
  interact.setDueRings(store.dueWords(), wordMesh);
  refresh();

  grantDailyBonus();

  hud.setLoading(100, 'Tayyor!');
  setTimeout(() => hud.finishLoading(), 200);
  requestAnimationFrame(frame);
}

// ───────────────────────────────────────────────────────────────────────────
// KUNLIK BONUS — kuniga bir marta XP + tanga
// ───────────────────────────────────────────────────────────────────────────
function grantDailyBonus() {
  let last = null;
  try { last = localStorage.getItem('lv_daily'); } catch {}
  const today = new Date().toISOString().slice(0, 10);
  if (last === today) return;
  try { localStorage.setItem('lv_daily', today); } catch {}

  store.addXp(15, 'daily');
  store.addCoins(8);
  refresh();
  hud.toast('🎁 Kunlik bonus: +15 XP · +8 🪙', 'good', 5000);
}

// ───────────────────────────────────────────────────────────────────────────
// TIL + SHAHAR TANLASH OVERLAY (index.html da #city-select — 2 qadam)
// ───────────────────────────────────────────────────────────────────────────
function selectSetup() {
  return new Promise(resolve => {
    const overlay = document.getElementById('city-select');
    if (!overlay) { resolve({ city: CITIES[0], lang: DEFAULT_SETTINGS.targetLang }); return; }

    const stepLang = document.getElementById('setup-step-lang');
    const stepCity = document.getElementById('setup-step-city');
    const btnEnter = document.getElementById('btn-setup-enter');
    const btnBack = document.getElementById('btn-setup-back');
    if (!stepLang || !stepCity || !btnEnter || !btnBack) {
      resolve({ city: CITIES[0], lang: DEFAULT_SETTINGS.targetLang });
      return;
    }

    let chosenLang = null;
    let chosenCity = null;

    const lastLang = (() => { try { return localStorage.getItem('lv_lang'); } catch { return null; } })();
    const lastCity = (() => { try { return localStorage.getItem('lv_city'); } catch { return null; } })();
    selectSetupCard('.lang-card', 'data-lang', lastLang || DEFAULT_SETTINGS.targetLang);
    selectSetupCard('.city-card', 'data-id', CITY_BY_ID[lastCity] ? lastCity : CITIES[0].id);
    // Oldindan tanlangan shahar bo'lsa — kirish tugmasini faollashtirish
    if (CITY_BY_ID[lastCity]) {
      chosenCity = lastCity;
      btnEnter.disabled = false;
    }

    const showStep = which => {
      stepLang.hidden = which !== 'lang';
      stepCity.hidden = which !== 'city';
      document.querySelectorAll('.setup-dot').forEach(d =>
        d.classList.toggle('on', d.dataset.step === which));
    };

    const onPick = e => {
      const langCard = e.target.closest('.lang-card');
      if (langCard) {
        chosenLang = langCard.getAttribute('data-lang');
        selectSetupCard('.lang-card', 'data-lang', chosenLang);
        try { localStorage.setItem('lv_lang', chosenLang); } catch {}
        setTimeout(() => showStep('city'), 220);
        return;
      }

      const cityCard = e.target.closest('.city-card');
      if (cityCard) {
        chosenCity = cityCard.getAttribute('data-id');
        selectSetupCard('.city-card', 'data-id', chosenCity);
        btnEnter.disabled = false;
        try { localStorage.setItem('lv_city', chosenCity); } catch {}
        return;
      }

      if (e.target.closest('#btn-setup-back')) {
        showStep('lang');
        return;
      }

      if (e.target.closest('#btn-setup-enter') && chosenCity) {
        document.removeEventListener('click', onPick);
        overlay.classList.remove('show');
        resolve({ city: CITY_BY_ID[chosenCity], lang: chosenLang || DEFAULT_SETTINGS.targetLang });
      }
    };

    document.addEventListener('click', onPick);
    showStep('lang');
    overlay.classList.add('show');
  });
}

function selectSetupCard(selector, attr, id) {
  document.querySelectorAll(selector).forEach(c => {
    c.classList.toggle('selected', c.getAttribute(attr) === id);
  });
}

boot();
