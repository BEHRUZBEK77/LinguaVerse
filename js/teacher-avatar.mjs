// ═══════════════════════════════════════════════════════════════════════════
// teacher-avatar.mjs — AI USTOZ YUZI (SVG avatar + emotsiyalar)
//
// Hech qanday tashqi bog'liqliksiz: sayt sahifalari (lv-teacher.mjs orqali)
// va MP4 video dars renderi (render/lesson-video.html) bir xil ustozni
// ko'rsatadi.
// ═══════════════════════════════════════════════════════════════════════════

// ───────────────────────────────────────────────────────────────────────────
// USTOZLAR KO'RINISHI — har til uchun alohida odam
// ───────────────────────────────────────────────────────────────────────────
export const TEACHER_LOOKS = {
  english: { name: 'Mr. Daniel Carter', role: 'IELTS senior examiner · London', locale: 'en-GB', skin: '#f1c6a6', hair: '#3b2a20', hairStyle: 'short', suit: '#1e293b', tie: '#b91c1c', glasses: true, beard: false },
  russian: { name: 'Борис Сергеевич', role: 'Professor · Moskva', locale: 'ru-RU', skin: '#efc3a2', hair: '#9ca3af', hairStyle: 'bald', suit: '#374151', tie: '#1d4ed8', glasses: true, beard: true },
  spanish: { name: 'Profesora Elena Ruiz', role: 'DELE examiner · Madrid', locale: 'es-ES', skin: '#e0ab86', hair: '#1f1308', hairStyle: 'long', suit: '#7f1d1d', tie: null, glasses: false, beard: false },
  german:  { name: 'Herr Klaus Weber', role: 'Goethe-Institut · München', locale: 'de-DE', skin: '#f3cdb0', hair: '#c9a66b', hairStyle: 'side', suit: '#0f172a', tie: '#475569', glasses: true, beard: false },
  turkish: { name: 'Ayşe Hoca', role: 'TÖMER ustozi · Ankara', locale: 'tr-TR', skin: '#e6b391', hair: '#3f1d0b', hairStyle: 'bun', suit: '#065f46', tie: null, glasses: false, beard: false },
  arabic:  { name: 'الأستاذ خالد', role: 'Professor · Qohira', locale: 'ar-SA', skin: '#c98e66', hair: '#111', hairStyle: 'short', suit: '#f5f5f4', tie: null, glasses: false, beard: true },
  korean:  { name: '김지은 선생님', role: 'TOPIK ustozi · Seul', locale: 'ko-KR', skin: '#f5d3b8', hair: '#0b0b0f', hairStyle: 'bob', suit: '#312e81', tie: null, glasses: true, beard: false },
  chinese: { name: '王老师', role: 'HSK ustozi · Pekin', locale: 'zh-CN', skin: '#f2cfae', hair: '#0a0a0a', hairStyle: 'side', suit: '#1f2937', tie: '#b45309', glasses: false, beard: false }
};

export const EMOTION_LABELS = {
  neutral:      { uz: 'Diqqat bilan tinglayapti', icon: 'fa-face-meh', color: '#94a3b8' },
  happy:        { uz: 'Xursand', icon: 'fa-face-smile', color: '#34d399' },
  proud:        { uz: 'Faxrlanyapti', icon: 'fa-face-smile-beam', color: '#34d399' },
  impressed:    { uz: 'Hayratda — zo\'r!', icon: 'fa-face-grin-stars', color: '#f5c842' },
  encouraging:  { uz: 'Ruhlantiryapti', icon: 'fa-hand-fist', color: '#60a5fa' },
  thinking:     { uz: 'O\'ylayapti', icon: 'fa-face-rolling-eyes', color: '#a78bfa' },
  stern:        { uz: 'Qat\'iy', icon: 'fa-face-frown-open', color: '#fb923c' },
  disappointed: { uz: 'Hafsalasi pir bo\'ldi', icon: 'fa-face-frown', color: '#fb923c' },
  angry:        { uz: 'Jahli chiqdi!', icon: 'fa-face-angry', color: '#ef4444' },
  laughing:     { uz: 'Kulyapti', icon: 'fa-face-laugh-squint', color: '#f5c842' },
  surprised:    { uz: 'Hayron qoldi', icon: 'fa-face-surprise', color: '#22d3ee' }
};

// Yuz parametrlari: qosh burchagi (chap/o'ng), qosh balandligi, og'iz, ko'z kattaligi
const FACE = {
  neutral:      { bl: 0,   br: 0,   by: 0,  mouth: 'M86 151 Q100 155 114 151', eye: 1,    cheek: 0,   flush: 0 },
  happy:        { bl: -4,  br: 4,   by: -2, mouth: 'M83 147 Q100 163 117 147', eye: 0.85, cheek: .5,  flush: 0 },
  proud:        { bl: -3,  br: 3,   by: -1, mouth: 'M84 148 Q100 160 116 148', eye: 0.8,  cheek: .4,  flush: 0 },
  impressed:    { bl: -8,  br: 8,   by: -6, mouth: 'M84 147 Q100 165 116 147', eye: 1.15, cheek: .45, flush: 0 },
  encouraging:  { bl: -5,  br: 5,   by: -3, mouth: 'M85 149 Q100 159 115 149', eye: 1,    cheek: .3,  flush: 0 },
  thinking:     { bl: 6,   br: -10, by: -2, mouth: 'M88 153 Q98 151 112 149', eye: 0.9,  cheek: 0,   flush: 0 },
  stern:        { bl: 12,  br: -12, by: 3,  mouth: 'M87 152 L113 152',        eye: 0.85, cheek: 0,   flush: 0 },
  disappointed: { bl: -10, br: 10,  by: 1,  mouth: 'M87 155 Q100 148 113 155', eye: 0.8,  cheek: 0,   flush: 0 },
  angry:        { bl: 20,  br: -20, by: 5,  mouth: 'M86 156 Q100 145 114 156', eye: 0.75, cheek: 0,   flush: .55 },
  laughing:     { bl: -6,  br: 6,   by: -4, mouth: 'M82 146 Q100 170 118 146 Z', eye: 0.35, cheek: .6, flush: 0 },
  surprised:    { bl: -10, br: 10,  by: -9, mouth: 'M94 152 Q100 164 106 152 Q100 146 94 152 Z', eye: 1.25, cheek: 0, flush: 0 }
};

function hairPath(style) {
  switch (style) {
    case 'bald': return '<path d="M58 92 Q60 70 72 64 M142 92 Q140 70 128 64" stroke="HAIR" stroke-width="7" fill="none" stroke-linecap="round"/>';
    case 'long': return '<path d="M52 110 Q46 40 100 36 Q154 40 148 110 L152 178 Q140 170 136 120 Q132 70 100 66 Q68 70 64 120 Q60 170 48 178 Z" fill="HAIR"/>';
    case 'bun':  return '<circle cx="100" cy="34" r="17" fill="HAIR"/><path d="M57 100 Q54 48 100 44 Q146 48 143 100 Q132 64 100 62 Q68 64 57 100 Z" fill="HAIR"/>';
    case 'bob':  return '<path d="M54 128 Q46 44 100 40 Q154 44 146 128 L136 128 Q138 74 100 68 Q62 74 64 128 Z" fill="HAIR"/>';
    case 'side': return '<path d="M56 96 Q54 44 104 42 Q150 46 145 96 Q138 66 112 62 Q90 70 62 74 Z" fill="HAIR"/>';
    default:     return '<path d="M57 94 Q56 44 100 42 Q144 44 143 94 Q136 62 100 60 Q64 62 57 94 Z" fill="HAIR"/>';
  }
}

// ───────────────────────────────────────────────────────────────────────────
// AVATAR
// ───────────────────────────────────────────────────────────────────────────
export class TeacherAvatar {
  constructor(el, lang = 'english', opts = {}) {
    this.el = el;
    this.emotion = 'neutral';
    this.setTeacher(lang);
    // Video renderida ko'z qisish kadrma-kadr boshqariladi (setBlink)
    if (opts.autoBlink !== false) this._blink();
  }

  /** Ko'zni yumish/ochish (video renderi uchun deterministik boshqaruv). */
  setBlink(closed) {
    this.el.querySelectorAll('.tv-eye').forEach(e => this._applyEye(e, closed ? 0.1 : (Number(e.dataset.scale) || 1)));
  }

  setTeacher(lang) {
    this.lang = TEACHER_LOOKS[lang] ? lang : 'english';
    const L = TEACHER_LOOKS[this.lang];
    const hair = hairPath(L.hairStyle).replace(/HAIR/g, L.hair);
    this.el.innerHTML = `
<svg viewBox="0 0 200 220" class="tv-svg" role="img" aria-label="${L.name}">
  <defs>
    <radialGradient id="tvFlush" cx="50%" cy="55%" r="50%">
      <stop offset="0%" stop-color="#ef4444" stop-opacity=".75"/>
      <stop offset="100%" stop-color="#ef4444" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="tvGlow" cx="50%" cy="45%" r="60%">
      <stop offset="0%" stop-color="var(--tv-glow,#4f6ef7)" stop-opacity=".55"/>
      <stop offset="100%" stop-color="var(--tv-glow,#4f6ef7)" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <circle cx="100" cy="110" r="100" fill="url(#tvGlow)" class="tv-glow"/>
  ${L.hairStyle === 'long' ? hair : ''}
  <path d="M30 220 Q34 176 76 168 L124 168 Q166 176 170 220 Z" fill="${L.suit}"/>
  <path d="M86 168 L100 192 L114 168 Z" fill="#f8fafc"/>
  ${L.tie ? `<path d="M96 172 L104 172 L107 204 L100 212 L93 204 Z" fill="${L.tie}"/>` : ''}
  <rect x="88" y="148" width="24" height="24" rx="8" fill="${L.skin}" filter="brightness(.93)"/>
  <ellipse cx="57" cy="110" rx="8" ry="12" fill="${L.skin}"/>
  <ellipse cx="143" cy="110" rx="8" ry="12" fill="${L.skin}"/>
  <ellipse cx="100" cy="106" rx="44" ry="54" fill="${L.skin}"/>
  <ellipse class="tv-flush" cx="100" cy="118" rx="40" ry="34" fill="url(#tvFlush)" opacity="0"/>
  ${L.beard ? `<path d="M60 118 Q62 168 100 170 Q138 168 140 118 Q132 150 100 152 Q68 150 60 118 Z" fill="${L.hair}" opacity=".85"/>` : ''}
  ${L.hairStyle !== 'long' ? hair : `<path d="M58 96 Q60 56 100 54 Q140 56 142 96 Q128 70 100 68 Q72 70 58 96 Z" fill="${L.hair}"/>`}
  <ellipse class="tv-cheek" cx="74" cy="132" rx="9" ry="5" fill="#f87171" opacity="0"/>
  <ellipse class="tv-cheek" cx="126" cy="132" rx="9" ry="5" fill="#f87171" opacity="0"/>
  <g class="tv-eyes">
    <g class="tv-eye" transform="translate(82 108)"><ellipse rx="6.5" ry="6.5" fill="#fff"/><circle r="3.6" fill="#1f2937"/><circle cx="1.2" cy="-1.2" r="1.1" fill="#fff"/></g>
    <g class="tv-eye" transform="translate(118 108)"><ellipse rx="6.5" ry="6.5" fill="#fff"/><circle r="3.6" fill="#1f2937"/><circle cx="1.2" cy="-1.2" r="1.1" fill="#fff"/></g>
  </g>
  <path class="tv-brow tv-brow-l" d="M72 94 Q82 89 92 93" stroke="${L.hairStyle === 'bald' ? '#6b7280' : L.hair}" stroke-width="4" fill="none" stroke-linecap="round"/>
  <path class="tv-brow tv-brow-r" d="M108 93 Q118 89 128 94" stroke="${L.hairStyle === 'bald' ? '#6b7280' : L.hair}" stroke-width="4" fill="none" stroke-linecap="round"/>
  ${L.glasses ? `<g fill="none" stroke="#111827" stroke-width="2.2" opacity=".85"><rect x="70" y="99" width="24" height="18" rx="6"/><rect x="106" y="99" width="24" height="18" rx="6"/><path d="M94 107 L106 107"/></g>` : ''}
  <path d="M100 112 Q96 126 99 130 Q102 131 104 129" stroke="#00000033" stroke-width="2" fill="none" stroke-linecap="round"/>
  <path class="tv-mouth" d="${FACE.neutral.mouth}" stroke="#7f1d1d" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
  <ellipse class="tv-mouth-open" cx="100" cy="153" rx="8" ry="0" fill="#450a0a"/>
</svg>`;
    this.$ = sel => this.el.querySelector(sel);
    this.setEmotion(this.emotion, 1);
  }

  setEmotion(emotion = 'neutral', intensity = 1) {
    const f = FACE[emotion] || FACE.neutral;
    this.emotion = FACE[emotion] ? emotion : 'neutral';
    const k = 0.7 + 0.3 * Math.max(1, Math.min(3, intensity));   // kuchliroq emotsiya — kattaroq ifoda
    const m = this.$('.tv-mouth');
    m.setAttribute('d', f.mouth);
    m.setAttribute('fill', f.mouth.endsWith('Z') ? '#7f1d1d' : 'none');
    this.$('.tv-brow-l').setAttribute('transform', `translate(0 ${f.by * k}) rotate(${f.bl * k} 82 92)`);
    this.$('.tv-brow-r').setAttribute('transform', `translate(0 ${f.by * k}) rotate(${f.br * k} 118 92)`);
    this.el.querySelectorAll('.tv-eye').forEach(e => { e.dataset.scale = f.eye; this._applyEye(e, f.eye); });
    this.el.querySelectorAll('.tv-cheek').forEach(c => c.setAttribute('opacity', f.cheek));
    this.$('.tv-flush').setAttribute('opacity', (f.flush * (0.5 + intensity / 6)).toFixed(2));
    const label = EMOTION_LABELS[this.emotion];
    this.el.style.setProperty('--tv-glow', label.color);
    this.el.dataset.emotion = this.emotion;
    this.el.classList.toggle('tv-shake', this.emotion === 'angry' && intensity >= 2);
    this.el.classList.toggle('tv-bounce', this.emotion === 'laughing' || (this.emotion === 'impressed' && intensity >= 2));
    this.onEmotion?.(this.emotion, intensity);
  }

  _applyEye(e, sy) {
    const base = e.getAttribute('transform').replace(/ scale\([^)]*\)/, '');
    e.setAttribute('transform', `${base} scale(1 ${sy})`);
  }

  _blink() {
    clearTimeout(this._bt);
    this._bt = setTimeout(() => {
      const eyes = this.el.querySelectorAll('.tv-eye');
      eyes.forEach(e => this._applyEye(e, 0.1));
      setTimeout(() => eyes.forEach(e => this._applyEye(e, Number(e.dataset.scale) || 1)), 130);
      this._blink();
    }, 2500 + Math.random() * 3000);
  }

  /** Lip-sync: 0..1 ovoz balandligi. */
  mouthLevel(v) {
    const o = this.$('.tv-mouth-open');
    if (o) o.setAttribute('ry', (Math.max(0, Math.min(1, v)) * 9).toFixed(1));
  }

  setSpeaking(on) { this.el.classList.toggle('tv-speaking', !!on); if (!on) this.mouthLevel(0); }
  setListening(on) { this.el.classList.toggle('tv-listening', !!on); }
}

export const TEACHER_CSS = `
.tv-wrap{position:relative;display:grid;place-items:center}
.tv-svg{width:100%;height:100%;display:block;overflow:visible}
.tv-glow{transition:opacity .4s}
.tv-speaking .tv-glow{animation:tvPulse 1.1s ease-in-out infinite}
.tv-listening .tv-glow{animation:tvPulse 2s ease-in-out infinite;opacity:.7}
.tv-shake{animation:tvShake .45s ease-in-out 2}
.tv-bounce .tv-svg{animation:tvBounce .5s ease-in-out 3}
.tv-brow,.tv-mouth,.tv-cheek,.tv-flush{transition:all .25s ease}
@keyframes tvPulse{0%,100%{opacity:.55}50%{opacity:1}}
@keyframes tvShake{0%,100%{transform:translateX(0)}20%{transform:translateX(-6px) rotate(-1deg)}40%{transform:translateX(6px) rotate(1deg)}60%{transform:translateX(-4px)}80%{transform:translateX(4px)}}
@keyframes tvBounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
@media (prefers-reduced-motion:reduce){.tv-shake,.tv-bounce .tv-svg,.tv-speaking .tv-glow{animation:none}}
`;
