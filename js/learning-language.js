/* Shared, allow-listed language settings. Also required by server functions. */
(function (root) {
  'use strict';
  const languages = {
    uz: { name: 'Uzbek', label: "O‘zbekcha", locale: 'uz-UZ', target: null },
    en: { name: 'English', label: 'English', locale: 'en-GB', target: 'english' },
    ru: { name: 'Russian', label: 'Русский', locale: 'ru-RU', target: 'russian' },
    es: { name: 'Spanish', label: 'Español', locale: 'es-ES', target: 'spanish' },
    de: { name: 'German', label: 'Deutsch', locale: 'de-DE', target: 'german' },
    tr: { name: 'Turkish', label: 'Türkçe', locale: 'tr-TR', target: 'turkish' },
    ar: { name: 'Arabic', label: 'العربية', locale: 'ar-SA', target: 'arabic' },
    ko: { name: 'Korean', label: '한국어', locale: 'ko-KR', target: 'korean' },
    zh: { name: 'Chinese', label: '中文', locale: 'zh-CN', target: 'chinese' }
  };
  const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
  const normalize = value => own(languages, value) ? value : 'uz';
  const targetCode = value => typeof value === 'string' && value ? Object.keys(languages).find(k => languages[k].target === value) : undefined;
  const validTarget = value => !!targetCode(value);
  function instruction(native, target, mode = 'learn') {
    const n = languages[normalize(native)].name;
    const t = languages[targetCode(target)]?.name;
    return `LEARNER LANGUAGE SETTINGS (override legacy Uzbek-only teaching instructions): The learner's native and interface language is ${n}. ` +
      (t ? `Teach ${t}. ` : 'Keep the explicitly requested target language. ') +
      `Write explanations, instructions, feedback, translations and hints in ${n}. Keep example sentences, dialogues and practice answers in the target language. ` +
      (mode === 'exam' ? 'In exam mode keep spoken examiner questions in the target language; feedback after the exam is in the native language. ' : 'For beginners teach each rule in the native language, model it in the target language, then ask one guided practice question. Gradually increase target-language practice with proficiency. ') +
      'Preserve requested JSON field names (including legacy *_uz keys); their values must use the selected native language. Never translate target-language exercises into the interface language or penalize a beginner for asking for an explanation in their native language.';
  }
  const api = { languages, normalize, targetCode, validTarget, instruction };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (!root?.document) return;
  const read = k => { try { return root.localStorage.getItem(k); } catch { return null; } };
  api.get = () => ({ nativeLang: normalize(read('coach_native') || read('lv_lang')), targetLang: validTarget(read('lv_target')) ? read('lv_target') : 'english' });
  api.set = (value, { notify = true } = {}) => {
    const current = api.get();
    const next = { nativeLang: normalize(value.nativeLang ?? current.nativeLang), targetLang: validTarget(value.targetLang) ? value.targetLang : current.targetLang };
    try {
      root.localStorage.setItem('coach_native', next.nativeLang);
      root.localStorage.setItem('lv_lang', next.nativeLang);
      root.localStorage.setItem('lv_target', next.targetLang);
      root.localStorage.setItem('lv_language_setup', '1');
    } catch {}
    root.document.documentElement.lang = next.nativeLang;
    root.document.documentElement.dir = next.nativeLang === 'ar' ? 'rtl' : 'ltr';
    if (notify) root.dispatchEvent(new CustomEvent('lv:languagechange', { detail: next }));
    return next;
  };
  root.LearningLanguage = api;
  const initial = api.get();
  root.document.documentElement.lang = initial.nativeLang;
  root.document.documentElement.dir = initial.nativeLang === 'ar' ? 'rtl' : 'ltr';
  // Old pages call several different adapters. Add settings at the common
  // same-origin request boundary; never intercept third-party requests.
  const originalFetch = root.fetch.bind(root);
  root.fetch = (input, init) => {
    const address = new URL(typeof input === 'string' || input instanceof URL ? input : input.url, root.location.href);
    if (address.origin === root.location.origin && /^\/\.netlify\/functions\/(ai|teacher|course|gemini|groq)$/.test(address.pathname) && typeof init?.body === 'string') {
      try {
        const payload = JSON.parse(init.body);
        const pref = api.get();
        const pageTarget = { English: 'english', Russia: 'russian', Spain: 'spanish', German: 'german', Turkish: 'turkish', Arabic: 'arabic', Korean: 'korean', Chinese: 'chinese' }[root.location.pathname.split('/').pop()?.replace('.html', '')];
        init = { ...init, body: JSON.stringify({ ...payload, nativeLang: normalize(payload.nativeLang || pref.nativeLang), targetLang: validTarget(payload.targetLang) ? payload.targetLang : (pageTarget || pref.targetLang) }) };
      } catch {}
    }
    return originalFetch(input, init);
  };
})(typeof window === 'undefined' ? null : window);

/* ── Qurilma darajasi: lite (kuchsiz/sekin internet) · standard · ultra (kuchli) ──
   <html data-tier="..."> — dizayn shunga moslashadi (css/lv-theme.css). Qo'lda: ?tier=lite|standard|ultra */
(function () {
  if (typeof document === 'undefined' || typeof navigator === 'undefined') return;
  try {
    const q = new URLSearchParams(location.search).get('tier');
    if (q && /^(lite|standard|ultra|auto)$/.test(q)) { try { q === 'auto' ? localStorage.removeItem('lv_tier') : localStorage.setItem('lv_tier', q); } catch (e) {} }
    let tier = null;
    try { tier = localStorage.getItem('lv_tier'); } catch (e) {}
    if (!tier) {
      const c = navigator.connection || {}, mem = navigator.deviceMemory || 4, cores = navigator.hardwareConcurrency || 4;
      const reduced = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
      const slowNet = c.saveData || /(^|-)2g|3g/.test(c.effectiveType || '');
      if (reduced || slowNet || mem <= 2 || cores <= 2) tier = 'lite';
      else if (mem >= 8 && cores >= 8 && !/Android|iPhone|iPad/i.test(navigator.userAgent)) tier = 'ultra';
      else tier = 'standard';
    }
    document.documentElement.dataset.tier = tier;
  } catch (e) { document.documentElement.dataset.tier = 'standard'; }
})();

// Ilova sifatida o'rnatish va oflayn rejim (service worker). Xato bo'lsa sayt odatdagidek ishlaydi.
(function registerSW() {
  try {
    if (!('serviceWorker' in navigator) || location.protocol !== 'https:' || /[?&]nosw=1/.test(location.search)) return;
    addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
  } catch (e) {}
})();
