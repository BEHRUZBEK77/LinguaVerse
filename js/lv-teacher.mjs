// ═══════════════════════════════════════════════════════════════════════════
// lv-teacher.mjs — JONLI AI USTOZ (avatar + emotsiya + ovoz + quloq)
//
//   import { TeacherAvatar, TeacherVoice, TeacherEar, teacherApi, TEACHER_LOOKS } from '../js/lv-teacher.mjs';
//
//   const avatar = new TeacherAvatar(el, 'english');
//   avatar.setEmotion('angry', 3);
//   await TeacherVoice.say('No, no, no!', 'en-GB', 'angry', avatar);
//   const { text, pron } = await TeacherEar.listen({ locale: 'en-GB', onLevel });
//
// Avatar — SVG yuz: qosh, ko'z, og'iz, yonoq har bir emotsiyada o'zgaradi;
// gapirayotganda og'iz ovoz balandligiga qarab ochiladi (lip-sync).
// Ovoz — ElevenLabs (emotsiya bilan), bo'lmasa Azure, bo'lmasa brauzer.
// ═══════════════════════════════════════════════════════════════════════════

import { auth, url } from './lv-core.js';
import { Recorder } from './lv-speech.js';
import { TeacherAvatar, TEACHER_LOOKS, EMOTION_LABELS, TEACHER_CSS } from './teacher-avatar.mjs';

export { TeacherAvatar, TEACHER_LOOKS, EMOTION_LABELS, TEACHER_CSS };

const SPEECH_URL = url('.netlify/functions/azure-speech');
const WHISPER_URL = url('.netlify/functions/whisper');
const TEACHER_URL = url('.netlify/functions/teacher');

// ───────────────────────────────────────────────────────────────────────────
// OVOZ — emotsiya bilan
// ───────────────────────────────────────────────────────────────────────────
let _audio = null, _ctx = null, _raf = 0;
export const TeacherVoice = {
  muted: false,
  rate: 1,

  stop() {
    cancelAnimationFrame(_raf);
    try { _audio?.pause(); } catch {}
    try { speechSynthesis.cancel(); } catch {}
    _audio = null;
  },

  async say(text, locale, emotion = 'neutral', avatar = null) {
    this.stop();
    if (!text || this.muted) return;
    avatar?.setSpeaking(true);
    try {
      const r = await fetch(SPEECH_URL, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'tts', text, lang: locale, emotion, rate: this.rate })
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || !d.audio) throw new Error(d.error || 'TTS');
      await this._play(`data:${d.mime || 'audio/mpeg'};base64,${d.audio}`, avatar);
    } catch (e) {
      console.warn('[teacher] neyro-ovoz ishlamadi, brauzer ovozi:', e.message);
      await this._browser(text, locale, emotion, avatar);
    } finally {
      avatar?.setSpeaking(false);
    }
  },

  _play(src, avatar) {
    return new Promise(resolve => {
      const audio = new Audio(src);
      _audio = audio;
      try {
        _ctx = _ctx || new (window.AudioContext || window.webkitAudioContext)();
        const node = _ctx.createMediaElementSource(audio);
        const an = _ctx.createAnalyser();
        an.fftSize = 512;
        node.connect(an); an.connect(_ctx.destination);
        const buf = new Uint8Array(an.fftSize);
        const tick = () => {
          an.getByteTimeDomainData(buf);
          let sum = 0;
          for (let i = 0; i < buf.length; i++) { const v = (buf[i] - 128) / 128; sum += v * v; }
          avatar?.mouthLevel(Math.min(1, Math.sqrt(sum / buf.length) * 5));
          _raf = requestAnimationFrame(tick);
        };
        if (_ctx.state === 'suspended') _ctx.resume();
        tick();
      } catch { /* analyser bo'lmasa ham ovoz chiqadi */ }
      audio.onended = audio.onerror = () => { cancelAnimationFrame(_raf); resolve(); };
      audio.play().catch(() => resolve());
    });
  },

  _browser(text, locale, emotion, avatar) {
    return new Promise(resolve => {
      if (!('speechSynthesis' in window)) return resolve();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = locale;
      const v = speechSynthesis.getVoices().find(x => x.lang?.toLowerCase().startsWith(locale.slice(0, 2).toLowerCase()));
      if (v) u.voice = v;
      u.rate = emotion === 'angry' ? 1.08 : emotion === 'disappointed' ? 0.9 : 1;
      u.pitch = emotion === 'angry' ? 0.85 : emotion === 'happy' || emotion === 'laughing' ? 1.15 : 1;
      let t = 0;
      const fake = setInterval(() => avatar?.mouthLevel(0.25 + 0.6 * Math.abs(Math.sin((t += 0.6)))), 90);
      u.onend = u.onerror = () => { clearInterval(fake); resolve(); };
      speechSynthesis.speak(u);
    });
  }
};

// ───────────────────────────────────────────────────────────────────────────
// QULOQ — o'quvchi nutqini matnga (+ talaffuz bahosi)
// Qisqa javob (≤55s) va Azure sozlangan bo'lsa: matn + talaffuz ballari.
// Aks holda Whisper (Groq). Ikkalasi ham ishlamasa — xato, sahifa matn
// kiritishni taklif qiladi.
// ───────────────────────────────────────────────────────────────────────────
let _caps = null;
async function speechCaps() {
  if (_caps) return _caps;
  const [az, wh] = await Promise.all([
    fetch(SPEECH_URL).then(r => r.json()).catch(() => ({})),
    fetch(WHISPER_URL).then(r => r.json()).catch(() => ({}))
  ]);
  _caps = { azure: !!az.keyConfigured, whisper: !!wh.hasKey };
  return _caps;
}

export const TeacherEar = {
  rec: null,

  async start({ onLevel, onSilence, silenceMs = 0 } = {}) {
    this.rec = new Recorder({ onLevel, onSilence, silenceMs: silenceMs || 1e9 });
    await this.rec.start();
  },

  /** Yozishni to'xtatadi va matnga o'giradi: { text, pron, duration }. */
  async stop(locale) {
    if (!this.rec) return { text: '' };
    const wav = await this.rec.stop();
    this.rec = null;
    if (!wav?.dataUri) return { text: '' };
    const caps = await speechCaps();

    if (caps.azure && wav.duration <= 55) {
      try {
        const r = await fetch(SPEECH_URL, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'assess', audio: wav.dataUri, lang: locale })
        });
        const d = await r.json();
        if (r.ok && d.text) return { text: d.text, pron: d.scores || null, weakWords: d.weakWords || [], duration: wav.duration };
      } catch (e) { console.warn('[teacher] azure assess:', e.message); }
    }
    if (caps.whisper) {
      const r = await fetch(WHISPER_URL, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audio: wav.dataUri, language: locale.slice(0, 2) })
      });
      const d = await r.json().catch(() => ({}));
      if (r.ok) return { text: (d.text || '').trim(), pron: null, duration: wav.duration };
    }
    throw new Error("Nutqni matnga o'girib bo'lmadi. Javobni yozib yuboring.");
  },

  cancel() { try { this.rec?.stop(); } catch {} this.rec = null; }
};

// ───────────────────────────────────────────────────────────────────────────
// USTOZ MIYASI — server API
// ───────────────────────────────────────────────────────────────────────────
export async function teacherApi(action, payload = {}) {
  const user = auth.currentUser;
  if (!user) throw Object.assign(new Error('Avval tizimga kiring'), { code: 'auth' });
  const idToken = await user.getIdToken();
  const r = await fetch(TEACHER_URL, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, idToken, ...payload })
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(d.error || 'Ustoz javob bermadi'), {
    upgrade: !!d.upgrade, status: r.status, locked: !!d.locked, justEnded: !!d.justEnded, quota: d.quota || null
  });
  return d;
}

// ───────────────────────────────────────────────────────────────────────────
// XOTIRA — ustoz o'quvchining takroriy xatolarini eslab qoladi
// ───────────────────────────────────────────────────────────────────────────
export const TeacherMemory = {
  key: lang => 'lv_teacher_mem_' + lang,
  get(lang) { try { return JSON.parse(localStorage.getItem(this.key(lang)) || '[]'); } catch { return []; } },
  add(lang, note) {
    if (!note) return;
    try {
      const list = this.get(lang).filter(x => x !== note);
      list.push(note);
      localStorage.setItem(this.key(lang), JSON.stringify(list.slice(-12)));
    } catch {}
  }
};
