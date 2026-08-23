// ═══════════════════════════════════════════════════════════════════════════
// lv-profile-panel.js — PROFIL: reja, limitlar, inventar, faol effektlar
//
// Profil sahifasida shu paytgacha do'kondan sotib olingan narsalar umuman
// ko'rinmasdi va reja/limitlar eski tizimda edi. Bu modul to'rt blok qo'shadi:
//
//   1. REJA      — qaysi tarif, qancha qolgan, uzaytirish tugmasi
//   2. LIMITLAR  — 11 resurs bo'yicha kunlik/haftalik/oylik holat
//   3. EFFEKTLAR — faol boostlar (qolgan vaqt bilan), chiptalar, muzlatishlar
//   4. INVENTAR  — sotib olingan buyumlar, bezaklarni yoqish/o'chirish
//
// O'zini <div id="lvProfilePanel"></div> ichiga chizadi.
// ═══════════════════════════════════════════════════════════════════════════

import { LV, PLANS, RESOURCES, db } from './lv-core.js';
import { planText, resourceText, currentLang } from './lv-i18n.js';
import { ITEMS, CATEGORIES, loadInventory } from './lv-shop-items.js';
import {
  doc, setDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const lang = currentLang();

const CSS = `
#lvProfilePanel { display:grid; gap:14px; margin:20px 0; font-family:'DM Sans',system-ui,sans-serif; }
#lvProfilePanel .pp-card { background:rgba(11,15,30,.7); border:1px solid rgba(255,255,255,.08); border-radius:16px; padding:18px; }
#lvProfilePanel .pp-h { display:flex; align-items:center; gap:9px; font-size:.95rem; font-weight:800; margin-bottom:14px; color:#e8ecff; }
#lvProfilePanel .pp-h i { color:#4f6ef7; }
#lvProfilePanel .pp-h small { margin-left:auto; font-size:.72rem; color:#7580a8; font-weight:500; }

#lvProfilePanel .pp-plan { display:flex; align-items:center; gap:14px; flex-wrap:wrap; }
#lvProfilePanel .pp-badge { display:inline-flex; align-items:center; gap:8px; padding:9px 18px; border-radius:100px; font-weight:800; font-size:.95rem; }
#lvProfilePanel .pp-exp { font-size:.8rem; }
#lvProfilePanel .pp-btn { margin-left:auto; padding:9px 18px; border-radius:10px; background:#4f6ef7; color:#fff; border:none; font-family:inherit; font-weight:700; font-size:.82rem; cursor:pointer; text-decoration:none; display:inline-block; }
#lvProfilePanel .pp-btn:hover { background:#5f7bff; }
#lvProfilePanel .pp-btn.ghost { background:transparent; border:1.5px solid rgba(255,255,255,.15); color:#e8ecff; }

#lvProfilePanel .pp-lims { display:grid; grid-template-columns:repeat(auto-fill,minmax(215px,1fr)); gap:9px; }
#lvProfilePanel .pp-lim { background:rgba(255,255,255,.03); border:1px solid rgba(255,255,255,.06); border-radius:11px; padding:11px 13px; }
#lvProfilePanel .pp-lim.off { opacity:.4; }
#lvProfilePanel .pp-lt { display:flex; justify-content:space-between; align-items:center; font-size:.78rem; margin-bottom:7px; }
#lvProfilePanel .pp-lt span:first-child { font-weight:700; display:flex; align-items:center; gap:7px; }
#lvProfilePanel .pp-lv { font-variant-numeric:tabular-nums; font-weight:800; }
#lvProfilePanel .pp-track { height:5px; background:rgba(255,255,255,.07); border-radius:3px; overflow:hidden; }
#lvProfilePanel .pp-fill { height:100%; border-radius:3px; transition:width .3s; }
#lvProfilePanel .pp-sub { font-size:.67rem; color:#7580a8; margin-top:6px; }

#lvProfilePanel .pp-fx { display:flex; gap:9px; flex-wrap:wrap; }
#lvProfilePanel .pp-chip { display:inline-flex; align-items:center; gap:7px; padding:8px 14px; border-radius:10px; font-size:.8rem; font-weight:700; border:1px solid; }
#lvProfilePanel .pp-chip small { opacity:.7; font-weight:500; }

#lvProfilePanel .pp-inv { display:grid; grid-template-columns:repeat(auto-fill,minmax(150px,1fr)); gap:9px; }
#lvProfilePanel .pp-it { position:relative; background:rgba(255,255,255,.03); border:1px solid rgba(255,255,255,.07); border-radius:12px; padding:13px; text-align:center; transition:border-color .15s; }
#lvProfilePanel .pp-it.active { border-color:#34d399; background:rgba(52,211,153,.07); }
#lvProfilePanel .pp-ii { width:40px; height:40px; margin:0 auto 8px; border-radius:11px; display:grid; place-items:center; font-size:1.1rem; }
#lvProfilePanel .pp-in { font-size:.78rem; font-weight:700; margin-bottom:3px; }
#lvProfilePanel .pp-iq { font-size:.68rem; color:#7580a8; }
#lvProfilePanel .pp-use { margin-top:8px; padding:5px 12px; border-radius:8px; border:1px solid rgba(255,255,255,.15); background:transparent; color:#e8ecff; font-family:inherit; font-size:.7rem; font-weight:700; cursor:pointer; }
#lvProfilePanel .pp-use:hover { border-color:#34d399; color:#34d399; }
#lvProfilePanel .pp-use.on { background:rgba(52,211,153,.15); border-color:#34d399; color:#34d399; }
#lvProfilePanel .pp-empty { text-align:center; color:#7580a8; font-size:.82rem; padding:22px; }
#lvProfilePanel .pp-empty a { color:#4f6ef7; text-decoration:none; font-weight:700; }
`;

let inventory = {};

function fmtLeft(ms) {
  if (ms <= 0) return 'tugadi';
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  if (h >= 24) return Math.floor(h / 24) + ' kun ' + (h % 24) + ' soat';
  return h > 0 ? h + ' soat ' + m + ' daq' : m + ' daqiqa';
}

function barColor(left, cap) {
  const p = cap > 0 ? left / cap : 0;
  return p > .5 ? '#34d399' : p > .2 ? '#f5c842' : '#f87171';
}

// ── 1. REJA ──
function renderPlan(snap) {
  const p = planText(snap.plan, lang);
  const d = snap.profile || {};
  const expMs = d.planExpiry?.toMillis?.() ?? (d.planExpiry ? new Date(d.planExpiry).getTime() : 0);
  const daysLeft = expMs ? Math.ceil((expMs - Date.now()) / 86400000) : null;

  const exp = snap.plan === 'free'
    ? `<span class="pp-exp" style="color:#7580a8">Abadiy bepul</span>`
    : daysLeft === null
      ? `<span class="pp-exp" style="color:#f87171">Muddat belgilanmagan</span>`
      : daysLeft < 0
        ? `<span class="pp-exp" style="color:#f87171">Muddati tugagan</span>`
        : `<span class="pp-exp" style="color:${daysLeft <= 3 ? '#f5c842' : '#34d399'}">${daysLeft} kun qoldi</span>`;

  return `<div class="pp-card">
    <div class="pp-h"><i class="fa-solid fa-id-card"></i> Rejangiz</div>
    <div class="pp-plan">
      <span class="pp-badge" style="background:${p.color}1f;color:${p.color};border:1px solid ${p.color}55">
        <i class="fa-solid ${p.fa}"></i> ${p.name}
      </span>
      ${exp}
      ${snap.plan === 'premium'
        ? `<span class="pp-btn ghost" style="cursor:default">Eng yuqori reja</span>`
        : `<a class="pp-btn" href="../order.html">${snap.plan === 'free' ? 'Rejani olish' : 'Oshirish'}</a>`}
    </div>
  </div>`;
}

// ── 2. LIMITLAR ──
function renderLimits(snap) {
  const rows = Object.keys(RESOURCES).map(res => {
    const r = resourceText(res, lang);
    const lim = LV.limitFor(res);

    if (!lim) {
      const need = Object.keys(PLANS).sort((a, b) => PLANS[a].order - PLANS[b].order)
        .find(pl => LV.limitFor(res, pl));
      return `<div class="pp-lim off">
        <div class="pp-lt"><span><i class="fa-solid ${r.fa}"></i> ${r.label}</span><span class="pp-lv">—</span></div>
        <div class="pp-track"></div>
        <div class="pp-sub">${need ? planText(need, lang).name + ' rejasidan' : 'Mavjud emas'}</div>
      </div>`;
    }

    const rem = LV.remaining(res);
    const col = barColor(rem.daily.left, rem.daily.cap);
    const usedPct = Math.min(100, Math.round(rem.daily.used / rem.daily.cap * 100));

    return `<div class="pp-lim">
      <div class="pp-lt">
        <span><i class="fa-solid ${r.fa}"></i> ${r.label}</span>
        <span class="pp-lv" style="color:${col}">${rem.daily.left}/${rem.daily.cap}</span>
      </div>
      <div class="pp-track"><div class="pp-fill" style="width:${usedPct}%;background:${col}"></div></div>
      <div class="pp-sub">Hafta ${rem.weekly.left} · Oy ${rem.monthly.left} ${r.unit}</div>
    </div>`;
  }).join('');

  return `<div class="pp-card">
    <div class="pp-h"><i class="fa-solid fa-gauge-high"></i> Limitlar
      <small>kunlik yarim tunda, haftalik dushanba, oylik oy boshida yangilanadi</small></div>
    <div class="pp-lims">${rows}</div>
  </div>`;
}

// ── 3. FAOL EFFEKTLAR ──
function renderEffects(snap) {
  const d = snap.profile || {};
  const now = Date.now();
  const chips = [];

  const boost = (until, mult, label, color, fa) => {
    if (!until || until < now) return;
    chips.push(`<span class="pp-chip" style="background:${color}14;border-color:${color}44;color:${color}">
      <i class="fa-solid ${fa}"></i> ${label} ×${mult} <small>${fmtLeft(until - now)}</small></span>`);
  };

  boost(d.boostXpUntil, d.boostXpMult, 'XP', '#a78bfa', 'fa-star');
  boost(d.boostCoinUntil, d.boostCoinMult, 'Coin', '#f5c842', 'fa-coins');

  const counters = [
    ['streakFreezes', 'Muzlatish', '#22d3ee', 'fa-snowflake'],
    ['hintTickets', 'Maslahat', '#60a5fa', 'fa-lightbulb'],
    ['retryTickets', 'Qayta urinish', '#34d399', 'fa-rotate-right'],
    ['skipTickets', "O'tkazish", '#fbbf24', 'fa-forward-step'],
    ['secondChances', 'Ikkinchi imkon', '#f472b6', 'fa-clover'],
    ['examTickets', 'Imtihon', '#f87171', 'fa-file-pen']
  ];
  for (const [k, label, color, fa] of counters) {
    const v = d[k] || 0;
    if (v > 0) chips.push(`<span class="pp-chip" style="background:${color}14;border-color:${color}44;color:${color}">
      <i class="fa-solid ${fa}"></i> ${label} <small>×${v}</small></span>`);
  }

  return `<div class="pp-card">
    <div class="pp-h"><i class="fa-solid fa-wand-magic-sparkles"></i> Faol imkoniyatlar</div>
    ${chips.length
      ? `<div class="pp-fx">${chips.join('')}</div>`
      : `<div class="pp-empty">Hozircha faol boost yoki chipta yo'q.<br>
           <a href="shop.html">Do'kondan olish</a></div>`}
  </div>`;
}

// ── 4. INVENTAR ──
function renderInventory(snap) {
  const owned = Object.keys(inventory);
  if (!owned.length) {
    return `<div class="pp-card">
      <div class="pp-h"><i class="fa-solid fa-box-open"></i> Inventar</div>
      <div class="pp-empty">Hali hech narsa sotib olmagansiz.<br>
        <a href="shop.html">Do'konga o'tish</a></div>
    </div>`;
  }

  const d = snap.profile || {};
  const cards = owned.map(id => {
    const item = ITEMS.find(i => i.id === id);
    if (!item) return '';
    const c = CATEGORIES[item.cat];
    const inv = inventory[id];

    const fx = item.effect;
    const isCosmetic = fx.type === 'cosmetic';
    const active = isCosmetic && d[fx.field] === fx.value;

    return `<div class="pp-it ${active ? 'active' : ''}">
      <div class="pp-ii" style="color:${c.color};background:${c.color}1a;border:1px solid ${c.color}33">
        <i class="fa-solid ${item.fa || c.fa}"></i>
      </div>
      <div class="pp-in">${item.name}</div>
      <div class="pp-iq">${inv.qty > 1 ? '×' + inv.qty : c.name}</div>
      ${isCosmetic
        ? `<button class="pp-use ${active ? 'on' : ''}" data-use="${id}">
             ${active ? '<i class="fa-solid fa-check"></i> Faol' : 'Yoqish'}</button>`
        : ''}
    </div>`;
  }).join('');

  return `<div class="pp-card">
    <div class="pp-h"><i class="fa-solid fa-box-open"></i> Inventar <small>${owned.length} ta buyum</small></div>
    <div class="pp-inv">${cards}</div>
  </div>`;
}

// ── Bezakni yoqish/o'chirish ──
async function toggleCosmetic(itemId, root) {
  const item = ITEMS.find(i => i.id === itemId);
  if (!item || item.effect.type !== 'cosmetic') return;

  const snap = LV.snapshot();
  if (!snap.signedIn) return;

  const fx = item.effect;
  const isOn = snap.profile?.[fx.field] === fx.value;
  const newVal = isOn ? null : fx.value;

  try {
    await setDoc(doc(db, 'users', snap.uid), {
      [fx.field]: newVal,
      lastActive: serverTimestamp()
    }, { merge: true });

    // Mahalliy nusxani ham yangilaymiz — darhol ko'rinsin
    if (snap.profile) snap.profile[fx.field] = newVal;
    render(root);

  } catch (e) {
    console.error('[profile] bezak saqlanmadi:', e.code, e.message);
    alert(e.code === 'permission-denied'
      ? "Saqlanmadi: ruxsat yo'q. Qaytadan kiring."
      : 'Saqlanmadi: ' + (e.code || e.message));
  }
}

function render(root) {
  const snap = LV.snapshot();

  if (!snap.signedIn) {
    root.innerHTML = `<div class="pp-card"><div class="pp-empty">
      Ma'lumotlarni ko'rish uchun <a href="../auth/login.html">tizimga kiring</a>.
    </div></div>`;
    return;
  }

  root.innerHTML =
    renderPlan(snap) + renderLimits(snap) + renderEffects(snap) + renderInventory(snap);

  root.querySelectorAll('[data-use]').forEach(b => {
    b.onclick = () => toggleCosmetic(b.dataset.use, root);
  });
}

// ── O'RNATISH ──
(async () => {
  const root = document.getElementById('lvProfilePanel');
  if (!root) return;

  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);

  root.innerHTML = `<div class="pp-card"><div class="pp-empty">
    <i class="fa-solid fa-spinner fa-spin"></i> Yuklanmoqda...</div></div>`;

  await LV.ready();
  inventory = await loadInventory();
  render(root);

  LV.onChange(() => render(root));
  console.log('[profile] panel yuklandi');
})();
