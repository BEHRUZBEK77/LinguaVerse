// ═══════════════════════════════════════════════════════════════════════════
// ProgressStore.js — o'yinchi taraqqiyoti: XP, level, coin, so'zlar (SRS),
// questlar, streak. Mehmon uchun localStorage, tizimga kirgan uchun Firestore.
// ═══════════════════════════════════════════════════════════════════════════
import { doc, getDoc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { LV, db } from '../../../js/lv-core.js';
import { DEFAULT_SETTINGS, xpToNext, WORD_BY_ID, QUEST_BY_ID } from '../config.js';

const KEY = 'lv_world_v1';

// ───────────────────────────────────────────────────────────────────────────
// MEHMON SAQLAGICH (localStorage)
// ───────────────────────────────────────────────────────────────────────────
const LS = {
  load() {
    try { return JSON.parse(localStorage.getItem(KEY)) || null; }
    catch { return null; }
  },
  save(data) {
    try { localStorage.setItem(KEY, JSON.stringify(data)); }
    catch { /* kvota to'lib qolsa jim o'tamiz */ }
  }
};

function defaultState() {
  const today = todayStr();
  return {
    settings: { ...DEFAULT_SETTINGS },
    level: 1,
    xp: 0,
    coins: 0,
    words: {},            // id → { mastered:bool, reviews:int, lastReview, nextReview }
    quests: {},           // id → { status:'active'|'done' }
    visited: {},          // zoneId → true
    streak: 1,
    lastLogin: today,
    talks: 0,             // jami AI suhbatlar
    phrases: {}           // questId → { attempts, best }
  };
}

function todayStr() {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

function isYesterday(s) {
  const d = new Date(s + 'T12:00:00');
  const y = new Date();
  y.setDate(y.getDate() - 1);
  return d.getFullYear() === y.getFullYear() && d.getMonth() === y.getMonth() && d.getDate() === y.getDate();
}

export class ProgressStore {
  constructor() {
    this.state = null;
    this._listeners = new Set();
  }

  onChange(fn) {
    this._listeners.add(fn);
    if (this.state) fn(this.state);
    return () => this._listeners.delete(fn);
  }

  _emit() { this._listeners.forEach(fn => fn(this.state)); }

  // ───────────────────────────────────────────────────────────────────────
  async init() {
    let st = LS.load();
    if (!st) st = defaultState();
    else st = { ...defaultState(), ...st, settings: { ...DEFAULT_SETTINGS, ...(st.settings || {}) } };

    // Streak — kunlik
    const today = todayStr();
    if (st.lastLogin !== today) {
      if (isYesterday(st.lastLogin)) st.streak = (st.streak || 1) + 1;
      else st.streak = 1;
      st.lastLogin = today;
    }

    this.state = st;

    // Firestore bilan sinxronlash (tizimga kirgan bo'lsa)
    await this._syncFromRemote();
    LS.save(this.state);
    this._emit();
    return this.state;
  }

  // ───────────────────────────────────────────────────────────────────────
  async _syncFromRemote() {
    const uid = LV.uid;
    if (!uid) return;
    try {
      const ref = doc(db, 'users', uid, 'world', 'data');
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const remote = snap.data();
        // Lokal kuchliroq (oxirgi faoliyat) — ularni birlashtiramiz
        const merge = (a, b) => ({ ...(b || {}), ...(a || {}) });
        this.state.level = Math.max(this.state.level, remote.level || 1);
        this.state.xp = remote.xp ?? this.state.xp;
        this.state.coins = Math.max(this.state.coins, remote.coins || 0);
        this.state.words = merge(this.state.words, remote.words);
        this.state.quests = merge(this.state.quests, remote.quests);
        this.state.visited = merge(this.state.visited, remote.visited);
        this.state.talks = Math.max(this.state.talks, remote.talks || 0);
      }
      this._pushToRemote();
    } catch (e) {
      console.warn('[world] Firestore sinxronlashda xato (oftlayn ishlayveramiz):', e.message);
    }
  }

  _pushToRemote() {
    const uid = LV.uid;
    if (!uid) return;
    const s = this.state;
    const payload = {
      level: s.level,
      xp: s.xp,
      coins: s.coins,
      words: s.words,
      quests: s.quests,
      visited: s.visited,
      talks: s.talks,
      streak: s.streak,
      updatedAt: serverTimestamp()
    };
    setDoc(doc(db, 'users', uid, 'world', 'data'), payload).catch(e =>
      console.warn('[world] Firestore saqlashda xato:', e.message));
  }

  _save() {
    LS.save(this.state);
    this._pushToRemote();
    this._emit();
  }

  // ───────────────────────────────────────────────────────────────────────
  get settings() { return this.state.settings; }

  async updateSettings(patch) {
    this.state.settings = { ...this.state.settings, ...patch };
    this._save();
    return this.state.settings;
  }

  get level() { return this.state.level; }
  get xp() { return this.state.xp; }
  get coins() { return this.state.coins; }
  get streak() { return this.state.streak; }

  xpToNext() { return xpToNext(this.state.level); }

  /** XP qo'shadi, level up bo'lsa chaqiruvchi xabar oladi. */
  addXp(n, reason) {
    this.state.xp += n;
    let leveled = false;
    while (this.state.xp >= this.xpToNext()) {
      this.state.xp -= this.xpToNext();
      this.state.level += 1;
      leveled = true;
    }
    this._save();
    return { leveled, level: this.state.level };
  }

  addCoins(n) {
    this.state.coins += n;
    this._save();
    return this.state.coins;
  }

  // ───────────────────────────────────────────────────────────────────────
  // SO'ZLAR (SRS — sodda 1-3-7-14 intervallar)
  // ───────────────────────────────────────────────────────────────────────
  recordWord(wordId, correct = true) {
    const w = this.state.words[wordId] || {
      mastered: false, reviews: 0, lastReview: null, nextReview: null
    };
    const today = todayStr();
    w.reviews += 1;
    w.lastReview = today;
    if (correct && w.reviews >= 3) w.mastered = true;
    if (correct) {
      const days = [1, 3, 7, 14][Math.min(w.reviews - 1, 3)] || 14;
      const d = new Date();
      d.setDate(d.getDate() + days);
      w.nextReview = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    } else {
      w.mastered = false;
      w.nextReview = null;   // xato bo'lsa — yana ko'rsatish kerak
    }
    this.state.words[wordId] = w;
    this._save();
    return w;
  }

  learnedCount() { return Object.keys(this.state.words).length; }

  /** Takrorlash muddati kelgan yoki xato qilingan so'zlar (glow uchun). */
  dueWords() {
    const today = todayStr();
    return Object.keys(this.state.words).filter(id => {
      const w = this.state.words[id];
      return !w.mastered && (!w.nextReview || w.nextReview <= today);
    });
  }

  isKnown(wordId) { return !!this.state.words[wordId]; }

  // ───────────────────────────────────────────────────────────────────────
  // QUESTLAR
  // ───────────────────────────────────────────────────────────────────────
  questState(qid) {
    return this.state.quests[qid] || { status: 'active' };
  }

  questDone(qid) { return this.state.quests[qid]?.status === 'done'; }

  completeQuest(qid) {
    if (this.questDone(qid)) return null;
    const q = QUEST_BY_ID[qid];
    if (!q) return null;
    this.state.quests[qid] = { status: 'done', completedAt: todayStr() };
    const lvl = this.addXp(q.xp, 'quest:' + qid);
    this.addCoins(q.coins);
    return { quest: q, leveled: lvl.leveled, level: lvl.level };
  }

  markPhraseAttempt(qid, score) {
    const p = this.state.phrases[qid] || { attempts: 0, best: 0 };
    p.attempts += 1;
    if (score > p.best) p.best = score;
    this.state.phrases[qid] = p;
    this._save();
    return p;
  }

  // ───────────────────────────────────────────────────────────────────────
  // ZONALAR / BOSHQA
  // ───────────────────────────────────────────────────────────────────────
  visitZone(zoneId) {
    if (!this.state.visited[zoneId]) {
      this.state.visited[zoneId] = true;
      this._save();
      return true;   // yangi zona
    }
    return false;
  }

  visitedCount() { return Object.keys(this.state.visited).length; }

  addTalk() {
    this.state.talks += 1;
    this._save();
    return this.state.talks;
  }
}
