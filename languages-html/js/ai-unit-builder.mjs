import { doc, getDoc, setDoc, serverTimestamp } from '/js/fb/firebase-firestore.js';
import { LV, auth, db } from '../../js/lv-core.js';
import { getAIThinkingMode } from './ai-chat-ui.mjs';
import {
  buildAIUnitPrompt,
  chooseUnitVocabulary,
  normalizeAIUnit,
  normalizeSavedAIUnits,
  parseAIUnitResponse
} from './ai-unit-data.mjs';

const LANGUAGE_NAMES = {
  'en-US': 'English', 'de-DE': 'German', 'ko-KR': 'Korean', 'ru-RU': 'Russian',
  'es-ES': 'Spanish', 'tr-TR': 'Turkish', 'ar-SA': 'Arabic', 'zh-CN': 'Chinese'
};
const loadedProfiles = new Set();

export function mountAIUnitBuilder({ container, courseId, level, locale, wordField, dictionary, units, onUnitsLoaded }) {
  if (!container) return;
  const existing = container.querySelector('[data-ai-unit-builder]');
  if (existing) existing.remove();

  const panel = document.createElement('div');
  panel.dataset.aiUnitBuilder = 'true';
  panel.style.cssText = 'grid-column:1/-1;order:99;display:flex;flex-direction:column;align-items:center;gap:8px;padding:18px;border:1px dashed rgba(139,92,246,.35);border-radius:16px;background:rgba(139,92,246,.05);';
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'btn';
  button.style.cssText = 'padding:11px 18px;border-radius:11px;border:1px solid rgba(139,92,246,.45);background:rgba(139,92,246,.15);color:inherit;font-weight:700;cursor:pointer;';
  button.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> AI bilan yangi Unit yaratish';
  const status = document.createElement('div');
  status.dataset.aiUnitStatus = 'true';
  status.setAttribute('role', 'status');
  status.style.cssText = 'font-size:.82rem;color:var(--text3,#9aa);text-align:center;';
  panel.append(button, status);
  container.appendChild(panel);

  const docId = `ai_units_${courseId}_${level}`.replace(/[^a-zA-Z0-9_-]/g, '_');
  const setStatus = message => {
    const liveStatus = container.querySelector('[data-ai-unit-status]');
    (liveStatus || status).textContent = message;
  };

  async function loadSaved() {
    await LV.ready();
    const user = auth.currentUser;
    if (!user) return;
    const key = `${user.uid}:${docId}`;
    if (loadedProfiles.has(key)) return;
    loadedProfiles.add(key);
    try {
      const snapshot = await getDoc(doc(db, 'users', user.uid, 'learner_profiles', docId));
      const saved = snapshot.exists() ? normalizeSavedAIUnits(snapshot.data().units, level) : [];
      if (saved.length) onUnitsLoaded(level, saved);
      if (saved.length) setStatus(`${saved.length} ta saqlangan AI Unit yuklandi.`);
    } catch (error) {
      loadedProfiles.delete(key);
      console.error('[ai-unit] Saqlangan Unitlarni yuklash xatosi:', error);
      setStatus('Saqlangan AI Unitlarni yuklab bo‘lmadi. Qayta urinib ko‘ring.');
    }
  }

  void loadSaved();

  button.addEventListener('click', async () => {
    button.disabled = true;
    status.textContent = 'AI mavzuni chuqur ishlab, Unit tayyorlayapti…';
    try {
      await LV.ready();
      const user = auth.currentUser;
      if (!user) throw new Error('Unit yaratish va saqlash uchun avval tizimga kiring.');
      const profileRef = doc(db, 'users', user.uid, 'learner_profiles', docId);
      const snapshot = await getDoc(profileRef);
      const saved = snapshot.exists() ? normalizeSavedAIUnits(snapshot.data().units, level) : [];
      const currentUnits = [...(units() || []), ...saved];
      const vocabulary = chooseUnitVocabulary(dictionary, wordField, level, currentUnits, currentUnits.length);
      const model = LV.bestModel(true);
      const result = await LV.ai(model, [{
        role: 'user',
        content: buildAIUnitPrompt({
          language: LANGUAGE_NAMES[locale] || courseId,
          nativeLanguage: 'Uzbek',
          level,
          vocabulary
        })
      }], {
        task: 'course_unit',
        target: courseId,
        native: 'uz',
        level,
        temperature: 0.35,
        maxTokens: 1800,
        thinkingMode: getAIThinkingMode()
      });
      if (!result.ok) throw new Error(result.message || 'AI Unit yaratolmadi.');

      const unit = normalizeAIUnit(parseAIUnitResponse(result.text), {
        id: `ai_${courseId}_${Date.now().toString(36)}`,
        level,
        vocabulary
      });
      const nextUnits = [...saved.filter(item => item.id !== unit.id), unit].slice(-20);
      await setDoc(profileRef, {
        units: nextUnits,
        courseId,
        level,
        updatedAt: serverTimestamp()
      }, { merge: true });

      onUnitsLoaded(level, [unit]);
      setStatus('Yangi Unit Firebase’da saqlandi va kursga qo‘shildi.');
    } catch (error) {
      console.error('[ai-unit] Unit yaratish/saqlash xatosi:', error);
      setStatus(error.message || 'Unit yaratilmadi. Qayta urinib ko‘ring.');
    } finally {
      button.disabled = false;
    }
  });
}
