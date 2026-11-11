// Hamkor havolasi: ?p=KOD — kodni 30 kun eslab qoladi, klikni hisoblaydi va
// foydalanuvchi hisobga kirgach uni hamkorga bog'laydi (server tekshiradi).
import { auth } from '/js/lv-core.js';
import { onAuthStateChanged } from '/js/fb/firebase-auth.js';

const KEY = 'lv_pcode', API = '/.netlify/functions/partners';
const read = () => { try { const v = JSON.parse(localStorage.getItem(KEY) || 'null'); return v && Date.now() - v.at < 30 * 864e5 ? v : null; } catch { return null; } };
const write = v => { try { v ? localStorage.setItem(KEY, JSON.stringify(v)) : localStorage.removeItem(KEY); } catch {} };

const fromUrl = (new URLSearchParams(location.search).get('p') || '').trim().toUpperCase();
if (/^[A-Z0-9]{4,16}$/.test(fromUrl)) {
  const cur = read();
  if (!cur || cur.code !== fromUrl) write({ code: fromUrl, at: Date.now() });   // oxirgi bosilgan havola hisoblanadi
  let sent = false; try { sent = sessionStorage.getItem('lv_pclick') === fromUrl; } catch {}
  if (!sent) {
    fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'click', code: fromUrl }), keepalive: true }).catch(() => {});
    try { sessionStorage.setItem('lv_pclick', fromUrl); } catch {}
  }
}

onAuthStateChanged(auth, async user => {
  const v = read();
  if (!user || user.isAnonymous || !v || v.tried === user.uid) return;
  try {
    const r = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'attach', code: v.code, idToken: await user.getIdToken() }) });
    const d = await r.json().catch(() => ({}));
    if (r.ok && (d.ok || d.already)) write(null);
    else if (r.status !== 429 && r.status < 500) write({ ...v, tried: user.uid });   // rad etildi — qayta urinmaymiz
  } catch {}
});
