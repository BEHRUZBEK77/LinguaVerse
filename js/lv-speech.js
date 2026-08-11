// ═══════════════════════════════════════════════════════════════════════════
// lv-speech.js — SPEAKING dvigateli (klient tomoni)
//
// Nima uchun kerak:
//   Brauzerning MediaRecorder'i WebM/Opus beradi, Azure esa uni QABUL QILMAYDI.
//   Shuning uchun biz Web Audio orqali xom PCM olib, o'zimiz 16kHz mono WAV
//   quramiz. Shu tufayli talaffuz bahosi Chrome, Firefox va Safari'da ishlaydi.
//
// Ishlatish:
//   import { Recorder, Voice, BrowserSTT } from './js/lv-speech.js';
//
//   const rec = new Recorder();
//   await rec.start();
//   ... foydalanuvchi gapiradi ...
//   const wav = await rec.stop();                    // { dataUri, duration, minutes }
//   const result = await Voice.assess(wav, 'en-US', 'I would like a coffee');
// ═══════════════════════════════════════════════════════════════════════════

import { LV, Speech } from './lv-core.js';

const SAMPLE_RATE = 16000;   // Azure talaffuz bahosi uchun talab qilinadigan chastota

// ═══════════════════════════════════════════════════════════════════════════
// YOZIB OLUVCHI — 16kHz mono WAV
// ═══════════════════════════════════════════════════════════════════════════
export class Recorder {
  constructor(opts = {}) {
    this.stream = null;
    this.ctx = null;
    this.source = null;
    this.node = null;
    this.chunks = [];
    this.recording = false;
    this.startedAt = 0;

    // Ovoz darajasi (jonli vizualizatsiya uchun)
    this.analyser = null;
    this.onLevel = opts.onLevel || null;
    this._levelRAF = null;

    // Jimlikni aniqlash — foydalanuvchi gapirishni to'xtatsa avtomatik tugatish
    this.onSilence = opts.onSilence || null;
    this.silenceMs = opts.silenceMs ?? 1500;
    this.silenceThreshold = opts.silenceThreshold ?? 0.012;
    this._lastSound = 0;
    this._spokeAtAll = false;
  }

  /** Mikrofonga ruxsat so'raydi va yozishni boshlaydi. */
  async start() {
    if (this.recording) return;

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
    } catch (e) {
      const err = new Error(
        e.name === 'NotAllowedError'
          ? "Mikrofonga ruxsat berilmadi. Brauzer manzil qatoridagi <i class='fa-solid fa-lock' style='color:#94a3b8'></i> belgisidan ruxsat bering."
          : e.name === 'NotFoundError'
            ? 'Mikrofon topilmadi. Qurilmangizga mikrofon ulanganini tekshiring.'
            : 'Mikrofon ochilmadi: ' + e.message
      );
      err.code = e.name;
      throw err;
    }

    // AudioContext'ni to'g'ridan-to'g'ri 16kHz da ochishga urinamiz.
    // Qo'llab-quvvatlanmasa, keyin qo'lda pasaytiramiz.
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: SAMPLE_RATE });
    } catch {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (this.ctx.state === 'suspended') await this.ctx.resume();

    this.source = this.ctx.createMediaStreamSource(this.stream);

    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 512;
    this.source.connect(this.analyser);

    this.chunks = [];
    this.recording = true;
    this.startedAt = Date.now();
    this._lastSound = Date.now();
    this._spokeAtAll = false;

    await this._attachCapture();
    this._trackLevel();
  }

  /** PCM ushlagichni ulaydi: avval AudioWorklet, bo'lmasa ScriptProcessor. */
  async _attachCapture() {
    const collect = (data) => {
      if (!this.recording) return;
      this.chunks.push(new Float32Array(data));
    };

    if (this.ctx.audioWorklet) {
      try {
        // Worklet kodini alohida faylsiz, Blob orqali yuklaymiz
        const workletCode = `
          class PCMCapture extends AudioWorkletProcessor {
            process(inputs) {
              const ch = inputs[0] && inputs[0][0];
              if (ch && ch.length) this.port.postMessage(ch.slice(0));
              return true;
            }
          }
          registerProcessor('pcm-capture', PCMCapture);
        `;
        const url = URL.createObjectURL(new Blob([workletCode], { type: 'application/javascript' }));
        await this.ctx.audioWorklet.addModule(url);
        URL.revokeObjectURL(url);

        this.node = new AudioWorkletNode(this.ctx, 'pcm-capture');
        this.node.port.onmessage = e => collect(e.data);
        this.source.connect(this.node);
        this.node.connect(this.ctx.destination);
        this._workletMuted();
        return;
      } catch (e) {
        console.warn('[speech] AudioWorklet ishlamadi, ScriptProcessor ishlatiladi:', e.message);
      }
    }

    // Zaxira yo'l — eski brauzerlar
    this.node = this.ctx.createScriptProcessor(4096, 1, 1);
    this.node.onaudioprocess = e => collect(e.inputBuffer.getChannelData(0));
    this.source.connect(this.node);
    this.node.connect(this.ctx.destination);
    this._workletMuted();
  }

  /** Yozayotgan ovoz karnaydan qaytib chiqmasligi uchun jimlatamiz. */
  _workletMuted() {
    try {
      const mute = this.ctx.createGain();
      mute.gain.value = 0;
      this.node.disconnect();
      this.node.connect(mute);
      mute.connect(this.ctx.destination);
    } catch { /* muhim emas */ }
  }

  /** Ovoz darajasini kuzatadi — vizualizatsiya va jimlikni aniqlash uchun. */
  _trackLevel() {
    const buf = new Uint8Array(this.analyser.frequencyBinCount);
    const tick = () => {
      if (!this.recording) return;
      this.analyser.getByteTimeDomainData(buf);

      let sum = 0;
      for (let i = 0; i < buf.length; i++) {
        const v = (buf[i] - 128) / 128;
        sum += v * v;
      }
      const level = Math.sqrt(sum / buf.length);

      if (this.onLevel) this.onLevel(Math.min(1, level * 4));

      if (level > this.silenceThreshold) {
        this._lastSound = Date.now();
        this._spokeAtAll = true;
      } else if (this._spokeAtAll && this.onSilence && Date.now() - this._lastSound > this.silenceMs) {
        this.onSilence();
        return;   // takror chaqirmaslik uchun to'xtaymiz
      }

      this._levelRAF = requestAnimationFrame(tick);
    };
    tick();
  }

  /** Yozishni tugatadi va WAV data-URI qaytaradi. */
  async stop() {
    if (!this.recording) return null;
    this.recording = false;

    if (this._levelRAF) cancelAnimationFrame(this._levelRAF);
    const duration = (Date.now() - this.startedAt) / 1000;
    const srcRate = this.ctx.sampleRate;

    this._teardown();

    if (!this.chunks.length) return null;

    // Barcha bo'laklarni bitta massivga yig'amiz
    let total = 0;
    this.chunks.forEach(c => total += c.length);
    const pcm = new Float32Array(total);
    let off = 0;
    this.chunks.forEach(c => { pcm.set(c, off); off += c.length; });
    this.chunks = [];

    const resampled = srcRate === SAMPLE_RATE ? pcm : downsample(pcm, srcRate, SAMPLE_RATE);
    const wav = encodeWAV(resampled, SAMPLE_RATE);

    return {
      dataUri: 'data:audio/wav;base64,' + arrayBufferToBase64(wav),
      blob: new Blob([wav], { type: 'audio/wav' }),
      duration,
      minutes: Math.max(1, Math.ceil(duration / 60))   // limit hisobi uchun
    };
  }

  cancel() {
    this.recording = false;
    if (this._levelRAF) cancelAnimationFrame(this._levelRAF);
    this.chunks = [];
    this._teardown();
  }

  _teardown() {
    try { this.node?.disconnect(); } catch {}
    try { this.source?.disconnect(); } catch {}
    try { this.stream?.getTracks().forEach(t => t.stop()); } catch {}
    try { this.ctx?.close(); } catch {}
    this.node = this.source = this.stream = this.ctx = this.analyser = null;
  }

  static async permissionState() {
    try {
      const s = await navigator.permissions.query({ name: 'microphone' });
      return s.state;   // granted | denied | prompt
    } catch { return 'unknown'; }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// WAV KODLASH
// ═══════════════════════════════════════════════════════════════════════════

function downsample(input, fromRate, toRate) {
  if (toRate >= fromRate) return input;
  const ratio = fromRate / toRate;
  const outLength = Math.floor(input.length / ratio);
  const out = new Float32Array(outLength);

  // O'rtacha qiymat olib pasaytiramiz — oddiy tashlab yuborishdan sifatliroq
  for (let i = 0; i < outLength; i++) {
    const start = Math.floor(i * ratio);
    const end = Math.min(Math.floor((i + 1) * ratio), input.length);
    let sum = 0, n = 0;
    for (let j = start; j < end; j++) { sum += input[j]; n++; }
    out[i] = n ? sum / n : 0;
  }
  return out;
}

function encodeWAV(samples, sampleRate) {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  const writeStr = (offset, s) => {
    for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i));
  };

  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);              // PCM blok hajmi
  view.setUint16(20, 1, true);               // format: PCM
  view.setUint16(22, 1, true);               // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);  // byte rate
  view.setUint16(32, 2, true);               // block align
  view.setUint16(34, 16, true);              // bit depth
  writeStr(36, 'data');
  view.setUint32(40, samples.length * 2, true);

  let off = 44;
  for (let i = 0; i < samples.length; i++, off += 2) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
  }
  return buffer;
}

function arrayBufferToBase64(buf) {
  const bytes = new Uint8Array(buf);
  let binary = '';
  const CHUNK = 0x8000;   // katta massivda stack overflow bo'lmasligi uchun
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

// ═══════════════════════════════════════════════════════════════════════════
// OVOZ — TTS ijro etish (keshlash bilan)
// ═══════════════════════════════════════════════════════════════════════════
const ttsCache = new Map();
const CACHE_MAX = 60;
let currentAudio = null;

export const Voice = {
  /** Matnni aytadi. Bir xil matn qayta so'ralsa keshdan oladi. */
  async speak(text, lang = 'en-US', opts = {}) {
    if (!text?.trim()) return;
    Voice.stop();

    const key = `${lang}|${opts.voice || 'default'}|${opts.rate || 1}|${text}`;
    let src = ttsCache.get(key);

    if (!src) {
      try {
        const r = await Speech.speak(text, lang, opts);
        src = `data:${r.mime};base64,${r.audio}`;

        if (ttsCache.size >= CACHE_MAX) ttsCache.delete(ttsCache.keys().next().value);
        ttsCache.set(key, src);
      } catch (e) {
        console.warn("[speech] Azure TTS ishlamadi, brauzer ovoziga o'tamiz:", e.message);
        return Voice._browserFallback(text, lang, opts);
      }
    }

    return new Promise((resolve, reject) => {
      const audio = new Audio(src);
      currentAudio = audio;
      audio.playbackRate = opts.playbackRate || 1;
      audio.onended = () => { currentAudio = null; resolve(); };
      audio.onerror = () => { currentAudio = null; reject(new Error('Audio ijro etilmadi')); };
      // AI Coach avatari og'zini ovoz balandligiga moslashi uchun audio
      // elementni beramiz. Manba data: URI — CORS muammosi yo'q, AnalyserNode
      // to'g'ridan-to'g'ri ulanadi. Callback xato bersa ijro to'xtamaydi.
      if (typeof opts.onAudio === 'function') {
        try { opts.onAudio(audio); } catch (e) { console.warn('[speech] onAudio:', e.message); }
      }
      audio.play().catch(reject);
    });
  },

  /** Azure ishlamasa — brauzerning o'z ovozi. Sayt hech qachon to'xtamasin. */
  _browserFallback(text, lang, opts = {}) {
    return new Promise(resolve => {
      if (!window.speechSynthesis) return resolve();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = lang;
      u.rate = opts.rate || 0.95;
      u.onend = u.onerror = () => resolve();
      speechSynthesis.speak(u);
    });
  },

  stop() {
    if (currentAudio) { currentAudio.pause(); currentAudio = null; }
    if (window.speechSynthesis?.speaking) speechSynthesis.cancel();
  },

  get speaking() {
    return !!(currentAudio && !currentAudio.paused) || !!window.speechSynthesis?.speaking;
  },

  /**
   * Talaffuz bahosi. Limitni ham hisoblaydi.
   *
   * Azure mavjud bo'lmasa (kalitsiz server) brauzerning o'z nutq tanish
   * tizimiga tushadi — matn olinadi, lekin ball berilmaydi.
   */
  async assess(recording, lang, reference = null) {
    if (!recording?.dataUri) return { ok: false, message: 'Ovoz yozilmadi.' };

    // Speaking daqiqalarini sarflaymiz
    const gate = await LV.consume('speak_min', recording.minutes);
    if (!gate.ok) return { ok: false, ...gate };

    try {
      const r = await Speech.assess(recording.dataUri, lang, reference);
      if (r.empty) {
        await LV.refund('speak_min', recording.minutes);
        return { ok: false, message: r.message };
      }
      return { ok: true, ...r };

    } catch (e) {
      console.warn('[speech] Azure ishlamadi:', e.message);

      if (BrowserSTT.supported()) {
        return {
          ok: true,
          text: '',
          scores: null,
          words: [],
          noScores: true,
          feedback: [{
            type: 'warn',
            text: 'Talaffuz bahosi hozir mavjud emas (Azure sozlanmagan). ' +
                  'Gapirganingiz yozib olindi, lekin ball berilmadi.'
          }]
        };
      }

      await LV.refund('speak_min', recording.minutes);
      return { ok: false, message: "Talaffuz bahosi hozir ishlamayapti. Qayta urinib ko'ring." };
    }
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// BRAUZER NUTQ TANISH — zaxira
//
// Azure yoki Whisper mavjud bo'lmaganda ishlatiladi. Ball bermaydi, faqat
// matnni beradi — lekin foydalanuvchi hech bo'lmasa gapira oladi.
// Chrome va Edge'da ishlaydi, Firefox'da yo'q.
// ═══════════════════════════════════════════════════════════════════════════
export const BrowserSTT = {
  supported() {
    return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  },

  /** Mikrofondan tinglaydi va matn qaytaradi. */
  listen(lang = 'en-US', opts = {}) {
    return new Promise((resolve, reject) => {
      const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SR) return reject(new Error("Brauzeringiz nutq tanishni qo'llab-quvvatlamaydi"));

      const rec = new SR();
      rec.lang = lang;
      rec.continuous = false;
      rec.interimResults = !!opts.onInterim;
      rec.maxAlternatives = 1;

      let finalText = '';
      let done = false;

      const finish = () => {
        if (done) return;
        done = true;
        try { rec.stop(); } catch {}
        resolve({ text: finalText.trim(), confidence: 0 });
      };

      rec.onresult = e => {
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const r = e.results[i];
          if (r.isFinal) finalText += r[0].transcript + ' ';
          else if (opts.onInterim) opts.onInterim(r[0].transcript);
        }
      };

      rec.onerror = e => {
        if (done) return;
        done = true;
        const msg = {
          'not-allowed': 'Mikrofonga ruxsat berilmadi.',
          'no-speech': 'Ovoz eshitilmadi. Balandroq gapiring.',
          'audio-capture': 'Mikrofon topilmadi.',
          'network': "Internet aloqasi yo'q."
        }[e.error] || ('Nutq tanish xatosi: ' + e.error);
        reject(new Error(msg));
      };

      rec.onend = finish;

      try { rec.start(); } catch (e) { reject(e); }

      if (opts.timeoutMs !== 0) setTimeout(finish, opts.timeoutMs || 15000);
    });
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// TALAFFUZ MASHQI — bitta jumlani takrorlab mashq qilish
// ═══════════════════════════════════════════════════════════════════════════
export class PronunciationTrainer {
  constructor(lang, opts = {}) {
    this.lang = lang;
    this.attempts = [];
    this.recorder = null;
    this.opts = opts;
  }

  async playModel(text, slow = false) {
    return Voice.speak(text, this.lang, { rate: slow ? 0.7 : 1 });
  }

  async startAttempt(onLevel) {
    this.recorder = new Recorder({
      onLevel,
      onSilence: this.opts.autoStop ? () => this.opts.onAutoStop?.() : null,
      silenceMs: this.opts.silenceMs ?? 1800
    });
    await this.recorder.start();
  }

  async finishAttempt(referenceText) {
    if (!this.recorder) return { ok: false, message: 'Yozuv boshlanmagan' };

    const rec = await this.recorder.stop();
    this.recorder = null;

    if (!rec || rec.duration < 0.4) {
      return { ok: false, message: "Juda qisqa. Yana bir bor, to'liq ayting." };
    }

    const result = await Voice.assess(rec, this.lang, referenceText);
    if (result.ok) {
      this.attempts.push({ at: Date.now(), scores: result.scores, text: result.text });
    }
    return { ...result, recording: rec };
  }

  progress() {
    if (this.attempts.length < 2) return null;
    const first = this.attempts[0].scores?.overall;
    const last = this.attempts[this.attempts.length - 1].scores?.overall;
    return {
      first, last,
      delta: Math.round((last - first) * 10) / 10,
      improved: last > first,
      best: Math.max(...this.attempts.map(a => a.scores?.overall || 0))
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// KO'RSATISH YORDAMCHILARI
// ═══════════════════════════════════════════════════════════════════════════

export function scoreColor(score) {
  if (score === null || score === undefined) return '#94a3b8';
  if (score >= 85) return '#22c55e';
  if (score >= 70) return '#84cc16';
  if (score >= 55) return '#f59e0b';
  return '#ef4444';
}

export function renderScoredWords(words) {
  return words.map(w => {
    const color = scoreColor(w.score);
    const title = w.errorType
      ? `${w.word}: ${w.score ?? '—'} — ${errorLabel(w.errorType)}`
      : `${w.word}: ${w.score ?? '—'}`;
    return `<span class="lv-word" style="color:${color};border-bottom:2px solid ${color}" title="${title}">${escapeHtml(w.word)}</span>`;
  }).join(' ');
}

function errorLabel(type) {
  return ({
    Mispronunciation: "noto'g'ri talaffuz",
    Omission: 'tushirib qoldirildi',
    Insertion: "ortiqcha qo'shildi",
    UnexpectedBreak: "kutilmagan to'xtash",
    MissingBreak: "to'xtash yetishmadi",
    Monotone: 'bir xil ohang'
  })[type] || type;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export default { Recorder, Voice, PronunciationTrainer, BrowserSTT, scoreColor, renderScoredWords };
