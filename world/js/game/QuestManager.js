// ═══════════════════════════════════════════════════════════════════════════
// QuestManager.js — vazifalar va ularning bajarilishini kuzatadi
// ═══════════════════════════════════════════════════════════════════════════
import { QUESTS, QUEST_BY_ID, WORDS_BY_ZONE } from '../config.js';

export class QuestManager {
  constructor(store) {
    this.store = store;
    this.listeners = new Set();
  }

  onChange(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  _emit(event, data) {
    this.listeners.forEach(fn => fn(event, data));
  }

  /** Hozirgi (navbatdagi) faol quest. */
  getActive() {
    for (const q of QUESTS) {
      if (!this.store.questDone(q.id)) return q;
    }
    return null;
  }

  activeProgress(q) {
    const s = this.store.state.quests[q.id] || { status: 'active' };
    return s.progress || 0;
  }

  isDone(qid) { return this.store.questDone(qid); }

  /**
   * Dunyo hodisasi. main.js shu yerdan o'tkazadi.
   * @param {string} event  zoneEntered | wordLearned | talk | phrase
   * @param {object} data
   */
  trigger(event, data = {}) {
    for (const q of QUESTS) {
      if (this.store.questDone(q.id)) continue;

      let done = false;

      switch (q.type) {
        case 'arrive':
          if (event === 'zoneEntered' && q.zone === data.zone) done = true;
          break;

        case 'zones':
          if (event === 'zoneEntered') {
            const count = this.store.visitedCount();
            if (count >= q.count) done = true;
          }
          break;

        case 'words':
          if (event === 'wordLearned' && q.zone === data.zone) {
            const known = (WORDS_BY_ZONE[q.zone] || [])
              .filter(w => this.store.isKnown(w.id)).length;
            if (known >= q.count) done = true;
          }
          break;

        case 'talk':
          if (event === 'talk' && q.npc === data.npc) {
            this._bump(q);
            if (this.activeProgress(q) >= (q.turns || 1)) done = true;
          }
          break;

        case 'phrase':
          if (event === 'phrase') {
            // Suhbatda yozilgan matn yoki mikrofon matni orqali tekshiriladi
            this._checkPhrase(q, data);
          }
          break;
      }

      if (done) this._complete(q);
    }
  }

  /** Foydalanuvchi matnini barcha phrase-questlarga qarshi tekshiradi. */
  checkPhrase(text) {
    const t = String(text || '').toLowerCase();
    for (const q of QUESTS) {
      if (q.type === 'phrase' && !this.store.questDone(q.id)) {
        if (t.includes(q.phrase.toLowerCase())) this._complete(q);
      }
    }
  }

  _checkPhrase(q, data) {
    const t = String(data.text || '').toLowerCase();
    if (q.phrase && t.includes(q.phrase.toLowerCase())) this._complete(q);
  }

  _bump(q) {
    const s = this.store.state.quests[q.id] || { status: 'active' };
    s.status = 'active';
    s.progress = (s.progress || 0) + 1;
    this.store.state.quests[q.id] = s;
    this.store._save();
  }

  _complete(q) {
    const reward = this.store.completeQuest(q.id);
    if (reward) {
      this._emit('questComplete', { quest: q, ...reward });
    }
  }
}
