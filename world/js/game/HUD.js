// ═══════════════════════════════════════════════════════════════════════════
// HUD.js — interfeys qatlami: barcha DOM o'zaro aloqalar
//
// main.js dan chaqiriladi. Id-lar index.html dagi elementlarga mos keladi.
// hooks orqali o'yin logikasi bilan bog'lanadi.
// ═══════════════════════════════════════════════════════════════════════════
import { QUESTS, WORDS_BY_ZONE } from '../config.js';

const I18N_TYPE = {
  noun: 'ot', verb: 'fe\'l', adjective: 'sifat', adverb: 'ravish', phrase: 'ibora'
};

export class HUD {
  constructor(hooks = {}) {
    this.hooks = hooks;
    this.$ = id => document.getElementById(id);
    this._bindElements();
    this._bindControls();
    this._bindJoystick();
    this._toastTimer = null;
    this.micActive = false;
    this._dialogNpc = null;
  }

  // ───────────────────────────────────────────────────────────────────────
  _bindElements() {
    const ids = [
      'loading', 'loadFill', 'loadText', 'loadPct', 'loadTip',
      'btn-home', 'zone-badge', 'zone-name', 'streak-num',
      'btn-quests', 'btn-settings', 'minimap',
      'level-badge', 'xp-fill', 'coins-badge', 'xp-text',
      'quest-mini-text', 'context-hint',
      'joy-zone', 'joy-knob', 'btn-interact',
      'dialog', 'dialog-avatar', 'dialog-npc-name', 'dialog-npc-role',
      'btn-dialog-tts', 'btn-dialog-close', 'dialog-messages',
      'dialog-typing', 'dialog-chips', 'dialog-input', 'btn-dialog-mic', 'btn-dialog-send',
      'dialog-mic-hint', 'vocab-card', 'btn-vocab-close', 'vocab-word',
      'vocab-type', 'vocab-level', 'vocab-translation', 'vocab-example',
      'vocab-example-tr', 'btn-vocab-audio', 'btn-vocab-mic',
      'vocab-score', 'btn-vocab-known', 'quest-panel', 'btn-quest-close',
      'quest-stats', 'quest-list', 'settings-panel', 'btn-settings-close',
      'set-cefr', 'set-lang', 'set-subtitles', 'set-sound',
      'set-quality', 'set-voice', 'levelup-modal', 'levelup-num',
      'btn-levelup-close', 'toast'
    ];
    this.el = {};
    for (const id of ids) this.el[id] = this.$(id);
  }

  _bindControls() {
    const h = this.hooks;

    this.el['btn-home'].addEventListener('click', () => {
      window.location.href = h.homeUrl || 'index.html';
    });

    // ── Suhbat ──
    this.el['btn-dialog-send'].addEventListener('click', () => this._submit());
    this.el['dialog-input'].addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); this._submit(); }
    });
    this.el['btn-dialog-mic'].addEventListener('click', () => h.onMic && h.onMic());
    this.el['btn-dialog-tts'].addEventListener('click', () => h.onTTS && h.onTTS());
    this.el['btn-dialog-close'].addEventListener('click', () => h.onCloseDialog && h.onCloseDialog());

    // ── So'z kartasi ──
    this.el['btn-vocab-close'].addEventListener('click', () => h.onCloseVocab && h.onCloseVocab());
    this.el['btn-vocab-audio'].addEventListener('click', () => h.onVocabAudio && h.onVocabAudio());
    this.el['btn-vocab-mic'].addEventListener('click', () => h.onVocabMic && h.onVocabMic());
    this.el['btn-vocab-known'].addEventListener('click', () => h.onVocabKnown && h.onVocabKnown());

    // ── Panellar ──
    this.el['btn-quests'].addEventListener('click', () => this.toggleQuestPanel());
    this.el['btn-quest-close'].addEventListener('click', () => this.hideQuestPanel());
    this.el['btn-settings'].addEventListener('click', () => this.toggleSettings());
    this.el['btn-settings-close'].addEventListener('click', () => this.hideSettings());
    this.el['btn-levelup-close'].addEventListener('click', () => this.hideLevelUp());

    // ── Sozlamalar ──
    const patch = (key, value) => h.onSettings && h.onSettings({ [key]: value });
    this.el['set-cefr'].addEventListener('change', e => patch('cefr', e.target.value));
    this.el['set-lang'].addEventListener('change', e => patch('targetLang', e.target.value));
    this.el['set-quality'].addEventListener('change', e => patch('quality', e.target.value));
    this.el['set-voice'].addEventListener('change', e => patch('voice', e.target.value));
    this.el['set-sound'].addEventListener('input', e =>
      h.onSettingsLive && h.onSettingsLive({ sound: e.target.value / 100 }));
    this.el['set-subtitles'].addEventListener('click', () => {
      const on = this.el['set-subtitles'].getAttribute('aria-pressed') !== 'true';
      this.el['set-subtitles'].setAttribute('aria-pressed', String(on));
      this.el['set-subtitles'].textContent = on ? 'ON' : 'OFF';
      this.el['set-subtitles'].classList.toggle('on', on);
      patch('subtitles', on);
    });

    // ── Mobil — interact tugmasi ──
    this.el['btn-interact'].addEventListener('click', () => h.onInteract && h.onInteract());
  }

  _submit() {
    const v = this.el['dialog-input'].value.trim();
    if (!v) return;
    this.el['dialog-input'].value = '';
    this.hooks.onSend && this.hooks.onSend(v);
  }

  // ───────────────────────────────────────────────────────────────────────
  // YUKLASH EKRANI
  // ───────────────────────────────────────────────────────────────────────
  setLoading(pct, text) {
    if (!this.el['loadFill']) return;
    this.el['loadFill'].style.width = Math.min(100, pct) + '%';
    this.el['loadPct'].textContent = Math.round(pct) + '%';
    if (text) this.el['loadText'].textContent = text;
  }

  finishLoading() {
    setTimeout(() => {
      this.el['loading'].classList.add('done');
      setTimeout(() => this.el['loading'].remove(), 600);
    }, 250);
  }

  // ───────────────────────────────────────────────────────────────────────
  // HOLAT KO'RSATKICHLARI
  // ───────────────────────────────────────────────────────────────────────
  updateProgress(store) {
    const need = store.xpToNext();
    this.el['level-badge'].textContent = store.level;
    this.el['xp-fill'].style.width = Math.min(100, (store.xp / need) * 100) + '%';
    this.el['xp-text'].textContent = `${store.xp} / ${need} XP`;
    this.el['coins-badge'].textContent = `🪙 ${store.coins}`;
    this.el['streak-num'].textContent = store.streak;
  }

  setZone(zone) {
    this.el['zone-name'].textContent = zone ? zone.nameUz : 'Shahar markazi';
    this.el['zone-badge'].style.setProperty('--zone-color', zone ? zone.theme : '#4f6ef7');
  }

  setHint(text) {
    const el = this.el['context-hint'];
    if (!el) return;
    el.innerHTML = text || '';
    el.classList.toggle('show', !!text);
  }

  toast(msg, type = 'good', ms = 3000) {
    const el = this.el['toast'];
    el.textContent = msg;
    el.className = 'toast show ' + type;
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => {
      el.className = 'toast';
    }, ms);
  }

  // ───────────────────────────────────────────────────────────────────────
  // SUHBAT
  // ───────────────────────────────────────────────────────────────────────
  openDialog(npc) {
    this._dialogNpc = npc;
    document.body.classList.add('ui-locked');
    this.el['dialog'].hidden = false;
    this.el['dialog-avatar'].textContent = npc.gender === 'female' ? '👩' : '👨';
    this.el['dialog-npc-name'].textContent = npc.name;
    this.el['dialog-npc-role'].textContent = npc.role;
    this.el['dialog-messages'].innerHTML = '';
    this.el['dialog-typing'].hidden = true;
    this.el['dialog-mic-hint'].hidden = true;
    setTimeout(() => this.el['dialog-input'].focus(), 80);
  }

  closeDialog() {
    this.el['dialog'].hidden = true;
    this._dialogNpc = null;
    document.body.classList.remove('ui-locked');
    this.setMicActive(false);
  }

  get dialogOpen() { return !this.el['dialog'].hidden; }

  addMessage(role, text, opts = {}) {
    const div = document.createElement('div');
    div.className = 'msg ' + role;

    let html = esc(text);

    // "(correct: ...)" qolipini alohida chiroyli qatorga ajratamiz
    const m = html.match(/\(correct:\s*([^)]+)\)/i);
    if (m) {
      html = html.replace(m[0], '').trim();
      div.innerHTML = `<span>${html}</span><span class="msg-correction">✔ ${m[1].trim()}</span>`;
    } else {
      div.innerHTML = html;
    }

    if (opts.note) div.insertAdjacentHTML('beforeend', `<span class="msg-note">${esc(opts.note)}</span>`);
    if (opts.feedback) div.insertAdjacentHTML('beforeend', `<span class="msg-note">${esc(opts.feedback)}</span>`);

    this.el['dialog-messages'].appendChild(div);
    this.el['dialog-messages'].scrollTop = this.el['dialog-messages'].scrollHeight;
  }

  setTyping(on) { this.el['dialog-typing'].hidden = !on; }

  /** Tayyor javob chipslarini dialogga chizadi (bosish → onQuickReply). */
  setQuickReplies(phrases) {
    const wrap = this.el['dialog-chips'];
    if (!wrap) return;
    wrap.innerHTML = '';
    if (!Array.isArray(phrases) || !phrases.length) return;
    const mk = text => {
      const b = document.createElement('button');
      b.className = 'dchip';
      b.type = 'button';
      b.textContent = text;
      b.addEventListener('click', () => this.hooks.onQuickReply && this.hooks.onQuickReply(text));
      wrap.appendChild(b);
    };
    phrases.forEach(mk);
  }

  setMicActive(on, hint) {
    this.micActive = on;
    this.el['btn-dialog-mic'].classList.toggle('recording', on);
    this.el['btn-dialog-mic'].textContent = on ? '⏹' : '🎤';
    this.el['dialog-mic-hint'].hidden = !on;
    if (hint) this.el['dialog-mic-hint'].textContent = hint;
  }

  // ───────────────────────────────────────────────────────────────────────
  // SO'Z KARTASI
  // ───────────────────────────────────────────────────────────────────────
  openVocab(word, known) {
    document.body.classList.add('ui-locked');
    this.el['vocab-word'].textContent = word.word;
    this.el['vocab-type'].textContent = I18N_TYPE[word.type] || word.type;
    this.el['vocab-level'].textContent = 'CEFR ' + word.level;
    this.el['vocab-translation'].textContent = word.translation;
    this.el['vocab-example'].textContent = word.example;
    this.el['vocab-example-tr'].textContent = word.exampleTranslation;
    this.el['vocab-score'].hidden = true;
    this.el['btn-vocab-known'].textContent = known
      ? '✅ Yana takrorlash (+5 XP)'
      : '✅ O\'rgandim (+10 XP)';
    this.el['vocab-card'].hidden = false;
  }

  closeVocab() {
    this.el['vocab-card'].hidden = true;
    document.body.classList.remove('ui-locked');
    this.setVocabScore(null);
  }

  get vocabOpen() { return !this.el['vocab-card'].hidden; }

  setVocabScore(score) {
    const el = this.el['vocab-score'];
    if (score === null || score === undefined) { el.hidden = true; return; }
    el.hidden = false;
    const cls = score >= 85 ? 'good' : score >= 70 ? 'ok' : score >= 55 ? 'mid' : 'low';
    el.className = 'vocab-score ' + cls;
    el.innerHTML = `<span class="score-big">${Math.round(score)}%</span> Talaffuz bahosi`;
  }

  // ───────────────────────────────────────────────────────────────────────
  // VAZIFALAR PANELI
  // ───────────────────────────────────────────────────────────────────────
  toggleQuestPanel() {
    if (this.el['quest-panel'].hidden) this.showQuestPanel();
    else this.hideQuestPanel();
  }
  showQuestPanel() {
    this.el['quest-panel'].hidden = false;
    this.renderQuests(this._store, this._qm);
  }
  hideQuestPanel() { this.el['quest-panel'].hidden = true; }

  /** Quest ro'yxatini chizadi. Har bir o'zgarishda chaqiriladi. */
  renderQuests(store, qm) {
    if (!store || !qm) return;
    this._store = store;
    this._qm = qm;
    if (this.el['quest-panel'].hidden) return;

    const done = QUESTS.filter(q => store.questDone(q.id)).length;
    const learned = store.learnedCount();
    this.el['quest-stats'].innerHTML =
      `<div class="stat-chip"><b>${done}</b><span>Bajarildi</span></div>` +
      `<div class="stat-chip"><b>${QUESTS.length}</b><span>Jami</span></div>` +
      `<div class="stat-chip"><b>${learned}</b><span>So'zlar</span></div>`;

    const activeId = qm.getActive()?.id;

    this.el['quest-list'].innerHTML = QUESTS.map(q => {
      const isDone = store.questDone(q.id);
      const isActive = !isDone && q.id === activeId;
      const prog = this._questProgress(store, q);
      const pct = Math.min(100, Math.round((prog.cur / prog.max) * 100));

      const reward = `<span class="qr">+${q.xp} XP · +${q.coins} 🪙</span>`;
      const bar = prog.max > 0
        ? `<div class="qprog"><div style="width:${pct}%"></div></div>`
        : '';

      return `
        <div class="quest-item ${isDone ? 'done' : isActive ? 'active' : ''}">
          <div class="qic">${ICONS[q.type] || '📌'}</div>
          <div style="flex:1;min-width:0">
            <div class="qt">${esc(q.title)}</div>
            <div class="qd">${esc(q.desc)}</div>
            ${reward}${bar}
          </div>
        </div>`;
    }).join('');
  }

  _questProgress(store, q) {
    switch (q.type) {
      case 'words': {
        const known = (WORDS_BY_ZONE[q.zone] || []).filter(w => store.isKnown(w.id)).length;
        return { cur: known, max: q.count };
      }
      case 'talk': {
        const s = store.state.quests[q.id] || {};
        return { cur: s.progress || 0, max: q.turns || 1 };
      }
      case 'zones':
        return { cur: store.visitedCount(), max: q.count };
      default:
        return { cur: store.questDone(q.id) ? 1 : 0, max: 1 };
    }
  }

  updateQuestMini(q) {
    this.el['quest-mini-text'].textContent = q
      ? `${ICONS[q.type] || '🎯'} ${q.title}`
      : 'Barcha vazifalar bajarildi! 🏆';
  }

  // ───────────────────────────────────────────────────────────────────────
  // SOZLAMALAR
  // ───────────────────────────────────────────────────────────────────────
  toggleSettings() {
    if (this.el['settings-panel'].hidden) this.showSettings();
    else this.hideSettings();
  }
  showSettings() { this.el['settings-panel'].hidden = false; }
  hideSettings() { this.el['settings-panel'].hidden = true; }

  loadSettings(s) {
    this.el['set-cefr'].value = s.cefr || 'A2';
    this.el['set-lang'].value = s.targetLang || 'en-US';
    this.el['set-quality'].value = s.quality || 'high';
    this.el['set-voice'].value = s.voice || 'female';
    this.el['set-sound'].value = Math.round((s.sound ?? 0.6) * 100);
    this.el['set-subtitles'].setAttribute('aria-pressed', String(!!s.subtitles));
    this.el['set-subtitles'].textContent = s.subtitles ? 'ON' : 'OFF';
    this.el['set-subtitles'].classList.toggle('on', !!s.subtitles);
  }

  // ───────────────────────────────────────────────────────────────────────
  // LEVEL UP
  // ───────────────────────────────────────────────────────────────────────
  showLevelUp(level) {
    this.el['levelup-num'].textContent = level;
    this.el['levelup-modal'].hidden = false;
  }
  hideLevelUp() { this.el['levelup-modal'].hidden = true; }

  // ───────────────────────────────────────────────────────────────────────
  // MOBIL JOYSTIK
  // ───────────────────────────────────────────────────────────────────────
  _bindJoystick() {
    const zone = this.el['joy-zone'];
    if (!zone) return;
    const knob = this.el['joy-knob'];
    const MAX = 34;
    let active = false;
    let id = null;

    const set = (dx, dy) => {
      const len = Math.hypot(dx, dy);
      const clamp = Math.min(len, MAX);
      const x = len > 0 ? (dx / len) * clamp : 0;
      const y = len > 0 ? (dy / len) * clamp : 0;
      knob.style.transform = `translate(${x}px, ${y}px)`;
      // x: o'ngga → +1; y: pastga (touch) → oldinga (+z)
      this.hooks.onJoystick && this.hooks.onJoystick(x / MAX, y / MAX);
    };

    zone.addEventListener('pointerdown', e => {
      active = true;
      id = e.pointerId;
      zone.setPointerCapture(id);
      const r = zone.getBoundingClientRect();
      set(e.clientX - (r.left + r.width / 2), e.clientY - (r.top + r.height / 2));
    });
    zone.addEventListener('pointermove', e => {
      if (!active) return;
      const r = zone.getBoundingClientRect();
      set(e.clientX - (r.left + r.width / 2), e.clientY - (r.top + r.height / 2));
    });
    const up = () => {
      active = false;
      knob.style.transform = 'translate(0,0)';
      this.hooks.onJoystick && this.hooks.onJoystick(0, 0);
    };
    zone.addEventListener('pointerup', up);
    zone.addEventListener('pointercancel', up);
  }
}

const ICONS = { talk: '💬', words: '📚', phrase: '🎯', arrive: '🚶', zones: '🧭' };

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
