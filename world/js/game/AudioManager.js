// ═══════════════════════════════════════════════════════════════════════════
// AudioManager.js — Web Audio orqali atrof-muhit ovozi va SFX
//
// Tashqi audio fayllarga ehtiyoj yo'q: barcha ovozlar syntez orqali hosil
// qilinadi. TTS (nutq) uchun mavjud Voice xizmati ishlatiladi.
// ═══════════════════════════════════════════════════════════════════════════
import { Voice } from '../../../js/lv-speech.js';

const AMBIENT_PRESETS = {
  cafe:    { cutoff: 500,  type: 'lowpass', gain: 0.35 },
  market:  { cutoff: 1400, type: 'bandpass', gain: 0.4 },
  office:  { cutoff: 300,  type: 'lowpass', gain: 0.25 },
  home:    { cutoff: 200,  type: 'lowpass', gain: 0.2 },
  school:  { cutoff: 900,  type: 'bandpass', gain: 0.3 },
  airport: { cutoff: 1600, type: 'bandpass', gain: 0.45 }
};

// Shahar muhit ovozi — doimiy, yengil fon shovqini (shahar turiga qarab)
const CITY_AMBIENT = {
  toshkent: { cutoff: 700,  type: 'lowpass', gain: 0.10 },
  berlin:   { cutoff: 420,  type: 'lowpass', gain: 0.08 },
  seul:     { cutoff: 1000, type: 'bandpass', gain: 0.07 },
  london:   { cutoff: 550,  type: 'lowpass', gain: 0.12 },
  tokyo:    { cutoff: 900,  type: 'bandpass', gain: 0.08 },
  paris:    { cutoff: 480,  type: 'lowpass', gain: 0.07 }
};

export class AudioManager {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.ambient = null;
    this.cityAmbient = null;
    this._level = 0.6;
    this._zoneId = null;
    this._cityId = null;
  }

  /** Foydalanuvchi interaktiv harakatidan keyin chaqiriladi (autoplay qoidasi). */
  async init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') await this.ctx.resume();
      return;
    }
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.master = this.ctx.createGain();
    this.master.gain.value = this._level;
    this.master.connect(this.ctx.destination);
    // Shahar muhit ovozi (avval setCity bilan belgilangan bo'lsa)
    this._applyCityAmbient();
  }

  setVolume(v) {
    this._level = Math.max(0, Math.min(1, v));
    if (this.master) this.master.gain.value = this._level;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // ATROF-MUHIT OVOZI
  // ─────────────────────────────────────────────────────────────────────────
  setZone(zoneId) {
    if (zoneId === this._zoneId && this.ambient) return;
    this._zoneId = zoneId;
    this._stopAmbient();
    if (!this.ctx || !zoneId) return;

    const preset = AMBIENT_PRESETS[zoneId] || AMBIENT_PRESETS.cafe;

    // Shovqin buferi (2 soniyalik tasodifiy)
    const len = this.ctx.sampleRate * 2;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      // brown noise — yumshoq, tabiiy
      const white = Math.random() * 2 - 1;
      last = (last + 0.02 * white) / 1.02;
      data[i] = last * 3.5;
    }

    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;

    const filter = this.ctx.createBiquadFilter();
    filter.type = preset.type || 'lowpass';
    filter.frequency.value = preset.cutoff;
    filter.Q.value = 1.2;

    const gain = this.ctx.createGain();
    gain.gain.value = 0;

    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);

    // Sekin kirish/chiqish
    gain.gain.linearRampToValueAtTime(preset.gain, this.ctx.currentTime + 1.5);

    src.start();
    this.ambient = { src, gain, filter, target: preset.gain };
  }

  _stopAmbient() {
    if (this.ambient) {
      try {
        this.ambient.gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.4);
        const s = this.ambient.src;
        setTimeout(() => { try { s.stop(); } catch {} }, 600);
      } catch {}
      this.ambient = null;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SHAHAR MUHIT OVOZI (doimiy yengil fon)
  // ─────────────────────────────────────────────────────────────────────────
  setCity(city) {
    this._cityId = city ? city.id : null;
    this._applyCityAmbient();
  }

  _applyCityAmbient() {
    this._stopCityAmbient();
    if (!this.ctx || !this._cityId) return;

    const preset = CITY_AMBIENT[this._cityId];
    if (!preset) return;

    // Yengil brown-noise fon — shahar g'ovuri
    const len = this.ctx.sampleRate * 2;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      last = (last + 0.02 * white) / 1.02;
      data[i] = last * 3.5;
    }

    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;

    const filter = this.ctx.createBiquadFilter();
    filter.type = preset.type || 'lowpass';
    filter.frequency.value = preset.cutoff;
    filter.Q.value = 1.0;

    const gain = this.ctx.createGain();
    gain.gain.value = 0;

    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    gain.gain.linearRampToValueAtTime(preset.gain, this.ctx.currentTime + 2);

    src.start();
    this.cityAmbient = { src, gain, target: preset.gain };
  }

  _stopCityAmbient() {
    if (this.cityAmbient) {
      try {
        this.cityAmbient.gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.5);
        const s = this.cityAmbient.src;
        setTimeout(() => { try { s.stop(); } catch {} }, 700);
      } catch {}
      this.cityAmbient = null;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SFX
  // ─────────────────────────────────────────────────────────────────────────
  _blip(freq, dur = 0.08, type = 'sine', vol = 0.3, freqEnd = null) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (freqEnd) osc.frequency.exponentialRampToValueAtTime(freqEnd, t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(g);
    g.connect(this.master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  click() { this._blip(620, 0.06, 'triangle', 0.22); }
  correct() { this._blip(660, 0.12, 'triangle', 0.3, 880); }
  wrong() { this._blip(220, 0.18, 'sawtooth', 0.16, 160); }
  coin() { this._blip(988, 0.07, 'triangle', 0.28, 1319); this._blip(1319, 0.09, 'triangle', 0.22, 1568); }

  levelUp() {
    [523, 659, 784, 1047].forEach((f, i) =>
      setTimeout(() => this._blip(f, 0.16, 'triangle', 0.32), i * 120));
  }

  step() { this._blip(140 + Math.random() * 40, 0.045, 'sine', 0.05, 90); }

  talk(zoneId) {
    // suhbat ochilganda yengil tasdiq
    this._blip(520, 0.08, 'triangle', 0.2, 700);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // TTS — mavjud Voice xizmati ustiga qatlam
  // ─────────────────────────────────────────────────────────────────────────
  async speak(text, lang = 'en-US', opts = {}) {
    return Voice.speak(text, lang, opts);
  }

  stopSpeak() { Voice.stop(); }

  get speaking() { return Voice.speaking; }

  /** Mikrofon/ovoz rejimlari uchun platforma xizmatlarini qaytaradi. */
  static get Voice() { return Voice; }
}
