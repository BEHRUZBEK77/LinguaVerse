import { copy, commonTranslations } from './learning-copy.mjs';

const language = window.LearningLanguage;
const $ = id => document.getElementById(id);
const norm = s => s.replace(/\s+/g, ' ').trim();
const SKIP = 'script,style,code,pre,textarea,select,[contenteditable], [translate="no"], [data-no-translate],#board,#subs,#modalContent,#wordModalContent,.quiz-opt,.match-item,.ae-ex-text,.ae-ex-opt,.ae-reading-text,.word-en,.word-target,.word-native,#quizWord,#dictationText,#translateText,.ae-vocab-w,.ae-vocab-ipa,.ae-ex-q,.ae-opt,.ae-passage,#after .vocab,#after .q,#chatMessages,.chat-messages,.message-content,.msg-text,.chat-msg,.bubble,.user-name,#userName';
let native = language.get().nativeLang;
let sourceMap = {}, remote = {}, pending = false, failed = false;
let generation = 0, timer;
const records = new WeakMap();
const attrRecords = new WeakMap();
const requested = new Set();
const link = document.createElement('link'); link.rel = 'stylesheet'; link.href = '/css/learning-language.css'; document.head.append(link);

const trigger = document.createElement('button');
trigger.id = 'lvLanguageButton'; trigger.className = 'lv-language-button'; trigger.type = 'button'; trigger.translate = false;
trigger.addEventListener('click', () => openLanguageSettings());
document.body.append(trigger);
const status = document.createElement('button'); status.className = 'lv-translation-status'; status.hidden = true; status.translate = false;
status.onclick = () => { failed = false; requested.clear(); translatePage(); };
document.body.append(status);

function refreshTrigger() { trigger.textContent = `◎ ${language.languages[native].label}`; trigger.setAttribute('aria-label', copy('settings', native)); }
refreshTrigger();
export function openLanguageSettings() {
  if ($('lvLanguageDialog')) return;
  const dialog = document.createElement('dialog'); dialog.id = 'lvLanguageDialog'; dialog.className = 'lv-language-dialog'; dialog.translate = false;
  dialog.setAttribute('aria-labelledby', 'lvLanguageHeading');
  // All labels below come from our local dictionaries, never server HTML.
  dialog.innerHTML = `<form id="lvLanguageForm"><div class="lv-language-brand">LINGUA<span>VERSE</span> / LEARNING PROFILE</div><button class="lv-language-close" type="button">×</button><span class="lv-language-orbit" aria-hidden="true">◎</span><h2 id="lvLanguageHeading"></h2><p id="lvLanguageIntro"></p><div class="lv-language-fields"><label><span id="lvNativeLabel"></span><select id="lvNative"></select></label><label><span id="lvTargetLabel"></span><select id="lvTarget"></select></label></div><p id="lvLanguageHint" class="lv-language-hint"></p><p id="lvLanguageError" role="status"></p><button type="submit" id="lvLanguageSave"></button></form>`;
  document.body.append(dialog);
  const pref = language.get();
  for (const [code, l] of Object.entries(language.languages)) {
    $('lvNative').add(new Option(l.label, code));
    if (l.target) $('lvTarget').add(new Option(l.label, l.target));
  }
  $('lvNative').value = pref.nativeLang; $('lvTarget').value = pref.targetLang;
  function updateLabels() {
    const l = $('lvNative').value;
    dialog.dir = l === 'ar' ? 'rtl' : 'ltr';
    for (const [id, key] of Object.entries({ lvLanguageHeading:'welcome',lvLanguageIntro:'intro',lvNativeLabel:'native',lvTargetLabel:'target',lvLanguageHint:'hint',lvLanguageSave:'save' })) $(id).textContent = copy(key,l);
    dialog.querySelector('.lv-language-close').setAttribute('aria-label', copy('cancel',l));
  }
  $('lvNative').onchange = updateLabels;
  dialog.querySelector('.lv-language-close').onclick = () => dialog.close();
  dialog.addEventListener('close', () => { dialog.remove(); trigger.focus(); });
  $('lvLanguageForm').onsubmit = async event => {
    event.preventDefault();
    const value = { nativeLang: $('lvNative').value, targetLang: $('lvTarget').value };
    if (language.languages[value.nativeLang].target === value.targetLang) { $('lvLanguageError').textContent = copy('same', value.nativeLang); return; }
    language.set(value);
    $('lvLanguageSave').disabled = true;
    // Local preferences work for guests as well. Signed-in users retain them
    // across devices through the existing profile API and authorization rules.
    try {
      const { LV } = await import('./lv-core.js');
      const state = await LV.ready();
      if (state.signedIn) await LV.updateProfile(value);
      location.reload();
    } catch {
      $('lvLanguageError').textContent = copy('localOnly', value.nativeLang);
      $('lvLanguageSave').disabled = false;
    }
  };
  updateLabels(); dialog.showModal();
}
window.openLanguageSettings = openLanguageSettings;

function translated(source) {
  if (native === 'uz') return source;
  const common = commonTranslations[source]?.[native];
  if (common) return common;
  return remote[sourceMap[source]];
}
function translatePage() {
  clearTimeout(timer);
  // The home page already ships complete dictionaries for these six locales.
  if (/\/(index\.html)?$/.test(location.pathname) && ['uz','en','ru','tr','de','ar'].includes(native)) return;
  const needed = new Set();
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const node = walker.currentNode;
    if (!node.parentElement || node.parentElement.closest(SKIP)) continue;
    const old = records.get(node);
    const source = old && node.nodeValue === old.rendered ? old.source : node.nodeValue;
    const key = norm(source);
    if (!key) continue;
    const result = translated(key);
    if (result) {
      const rendered = (source.match(/^\s*/)?.[0] || '') + result + (source.match(/\s*$/)?.[0] || '');
      if (node.nodeValue !== rendered) node.nodeValue = rendered;
      records.set(node, { source, rendered });
    } else if (sourceMap[key] && !requested.has(sourceMap[key])) needed.add(sourceMap[key]);
  }
  for (const el of document.querySelectorAll('[placeholder],[aria-label],[title]')) {
    if (el.closest(SKIP)) continue;
    const saved = attrRecords.get(el) || {};
    for (const attr of ['placeholder','aria-label','title']) {
      if (!el.hasAttribute(attr)) continue;
      const value = el.getAttribute(attr), old = saved[attr];
      const source = old && old.rendered === value ? old.source : value;
      const key = norm(source), result = translated(key);
      if (result) { if (value !== result) el.setAttribute(attr, result); saved[attr] = {source, rendered:result}; }
      else if (sourceMap[key] && !requested.has(sourceMap[key])) needed.add(sourceMap[key]);
    }
    attrRecords.set(el, saved);
  }
  if (native !== 'uz' && needed.size && !pending && !failed) fetchTranslations([...needed].slice(0, 24));
}
async function fetchTranslations(ids) {
  const mine = generation, locale = native;
  pending = true; ids.forEach(id => requested.add(id));
  status.hidden = false; status.textContent = copy('translating'); status.disabled = true;
  try {
    const r = await fetch('/.netlify/functions/site-translations', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({locale, ids}), signal: AbortSignal.timeout(22000) });
    if (!r.ok) throw new Error('translation unavailable');
    const data = await r.json();
    if (mine !== generation) return;
    Object.assign(remote, data.translations);
    if (ids.some(id => !remote[id])) failed = true;
    try { sessionStorage.setItem(`lv_ui_v1_${locale}`, JSON.stringify(remote)); } catch {}
  } catch { if (mine === generation) failed = true; }
  finally {
    pending = false;
    status.disabled = false; status.hidden = !failed; status.textContent = copy('untranslated');
    if (mine === generation && !failed) translatePage();
  }
}
function activate() {
  generation++; native = language.get().nativeLang; requested.clear(); failed = false;
  remote = {};
  try { remote = JSON.parse(sessionStorage.getItem(`lv_ui_v1_${native}`) || '{}'); } catch {}
  refreshTrigger(); translatePage();
}
window.addEventListener('lv:languagechange', activate);
window.addEventListener('storage', e => { if (e.key === 'coach_native') location.reload(); });
new MutationObserver(() => { clearTimeout(timer); timer = setTimeout(translatePage, 100); }).observe(document.body, {subtree:true,childList:true,characterData:true});
try { sourceMap = await (await fetch('/locales/ui-source.json')).json(); } catch {}
activate();
// Show the two essential questions on the first learning visit, including guests.
try {
  if (!localStorage.getItem('lv_language_setup') && /\/(?:index|select-language)\.html$|^\/$|\/courses\.html$/.test(location.pathname)) openLanguageSettings();
} catch {}
