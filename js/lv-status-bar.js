// ═══════════════════════════════════════════════════════════════════════════
// lv-status-bar.js — TIL SAHIFALARI UCHUN JONLI HOLAT PANELI
//
// Har bir til sahifasining tepasiga o'rnatiladi va ko'rsatadi:
//   · Joriy reja va uning rangi
//   · Har bir AI model uchun QOLGAN limit (jonli, sarflanganda yangilanadi)
//   · Speaking daqiqalari, darslar
//   · Coin va XP
//
// Nega kerak: ilgari sahifalarda "1000 token / 5 soat" degan eski tizim
// ko'rsatilardi va u haqiqiy limitlarga aloqador emas edi.
//
// O'zini avtomatik o'rnatadi — sahifaga faqat shu qatorni qo'shish kifoya:
//   <script type="module" src="../js/lv-status-bar.js"></script>
// ═══════════════════════════════════════════════════════════════════════════

import { LV, PLANS, RESOURCES } from './lv-core.js';
import { planText, resourceText, currentLang } from './lv-i18n.js';

const lang = currentLang();

const CSS = `
#lvBar { position:sticky; top:0; z-index:900; background:rgba(4,6,15,.94); backdrop-filter:blur(14px); border-bottom:1px solid rgba(255,255,255,.08); font-family:'DM Sans',system-ui,sans-serif; }
#lvBar .lvb-in { max-width:1200px; margin:0 auto; padding:9px 16px; display:flex; align-items:center; gap:12px; flex-wrap:wrap; }
#lvBar .lvb-plan { display:inline-flex; align-items:center; gap:6px; padding:5px 12px; border-radius:100px; font-size:.78rem; font-weight:800; white-space:nowrap; }
#lvBar .lvb-stats { display:flex; gap:7px; flex-wrap:wrap; flex:1; }
#lvBar .lvb-chip { display:inline-flex; align-items:center; gap:5px; padding:5px 10px; border-radius:9px; background:rgba(255,255,255,.04); border:1px solid rgba(255,255,255,.07); font-size:.75rem; color:#e8ecff; white-space:nowrap; }
#lvBar .lvb-chip b { font-variant-numeric:tabular-nums; }
#lvBar .lvb-chip.low { background:rgba(248,113,113,.1); border-color:rgba(248,113,113,.3); color:#fca5a5; }
#lvBar .lvb-chip.out { background:rgba(248,113,113,.16); border-color:rgba(248,113,113,.45); color:#f87171; }
#lvBar .lvb-more { padding:5px 11px; border-radius:9px; background:transparent; border:1px solid rgba(255,255,255,.12); color:#7580a8; font-size:.73rem; font-weight:700; cursor:pointer; font-family:inherit; white-space:nowrap; }
#lvBar .lvb-more:hover { color:#e8ecff; border-color:rgba(255,255,255,.3); }
#lvBar .lvb-up { padding:5px 13px; border-radius:9px; background:#4f6ef7; border:none; color:#fff; font-size:.73rem; font-weight:800; cursor:pointer; font-family:inherit; text-decoration:none; white-space:nowrap; }
#lvBar .lvb-up:hover { background:#5f7bff; }

#lvPanel { display:none; border-top:1px solid rgba(255,255,255,.07); background:rgba(11,15,30,.6); }
#lvPanel.open { display:block; }
#lvPanel .lvp-in { max-width:1200px; margin:0 auto; padding:16px; }
#lvPanel .lvp-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(220px,1fr)); gap:9px; }
#lvPanel .lvp-row { background:rgba(255,255,255,.03); border:1px solid rgba(255,255,255,.06); border-radius:11px; padding:10px 12px; }
#lvPanel .lvp-top { display:flex; justify-content:space-between; align-items:center; font-size:.78rem; margin-bottom:6px; }
#lvPanel .lvp-nm { font-weight:700; color:#e8ecff; display:flex; align-items:center; gap:6px; }
#lvPanel .lvp-val { font-variant-numeric:tabular-nums; font-weight:800; }
#lvPanel .lvp-track { height:4px; background:rgba(255,255,255,.07); border-radius:3px; overflow:hidden; }
#lvPanel .lvp-fill { height:100%; border-radius:3px; transition:width .3s; }
#lvPanel .lvp-sub { font-size:.68rem; color:#7580a8; margin-top:5px; }
#lvPanel .lvp-locked { opacity:.45; }
#lvPanel .lvp-note { font-size:.72rem; color:#7580a8; margin-top:12px; text-align:center; }

@media (max-width:640px){
  #lvBar .lvb-stats { order:3; width:100%; }
  #lvBar .lvb-in { padding:8px 12px; gap:8px; }
}
`;

function pct(used, cap) {
  return cap > 0 ? Math.min(100, Math.round(used / cap * 100)) : 0;
}

function barColor(left, cap) {
  const p = cap > 0 ? left / cap : 0;
  return p > .5 ? '#34d399' : p > .2 ? '#f5c842' : '#f87171';
}

function render() {
  const bar = document.getElementById('lvBar');
  const panel = document.getElementById('lvPanel');
  if (!bar) return;

  const snap = LV.snapshot();

  // Kirmagan bo'lsa — taklif ko'rsatamiz
  if (!snap.signedIn) {
    bar.querySelector('.lvb-in').innerHTML = `
      <span class="lvb-plan" style="background:rgba(148,163,184,.15);color:#94a3b8"><i class="fa-solid fa-lock"></i> Mehmon</span>
      <div class="lvb-stats"><span class="lvb-chip">Limitlarni ko'rish uchun tizimga kiring</span></div>
      <a class="lvb-up" href="../auth/login.html">Kirish</a>`;
    return;
  }

  const p = planText(snap.plan, lang);

  // Tepa qatorda: joriy rejadagi modellar + speaking + darslar
  const quick = [...PLANS[snap.plan].models, 'speak_min', 'lesson'];

  const chips = quick.map(res => {
    const rem = LV.remaining(res);
    if (!rem) return '';
    const r = resourceText(res, lang);
    const left = rem.min;
    const cap = rem.daily.cap;
    const cls = left === 0 ? 'out' : (left / cap < .2 ? 'low' : '');
    return `<span class="lvb-chip ${cls}" title="${r.label}: bugun ${rem.daily.used}/${cap}">
      <i class="fa-solid ${r.fa}"></i> <b>${left}</b></span>`;
  }).join('');

  bar.querySelector('.lvb-in').innerHTML = `
    <span class="lvb-plan" style="background:${p.color}22;color:${p.color};border:1px solid ${p.color}55">
      <i class="fa-solid ${p.fa}"></i> ${p.name}
    </span>
    <div class="lvb-stats">
      ${chips}
      <span class="lvb-chip"><i class="fa-solid fa-coins" style="color:#f5c842"></i> <b>${(snap.profile?.coins || 0).toLocaleString()}</b></span>
      <span class="lvb-chip"><i class="fa-solid fa-star" style="color:#a78bfa"></i> <b>${(snap.profile?.xp || 0).toLocaleString()}</b></span>
    </div>
    <button class="lvb-more" id="lvbToggle">Limitlar</button>
    ${snap.plan !== 'premium' ? `<a class="lvb-up" href="../order.html">Rejani oshirish</a>` : ''}`;

  document.getElementById('lvbToggle').onclick = () => {
    panel.classList.toggle('open');
    if (panel.classList.contains('open')) renderPanel(panel);
  };
}

function renderPanel(panel) {
  const snap = LV.snapshot();
  if (!snap.signedIn) return;

  const rows = Object.keys(RESOURCES).map(res => {
    const r = resourceText(res, lang);
    const lim = LV.limitFor(res);

    if (!lim) {
      const need = Object.keys(PLANS)
        .sort((a, b) => PLANS[a].order - PLANS[b].order)
        .find(pl => LV.limitFor(res, pl));
      return `<div class="lvp-row lvp-locked">
        <div class="lvp-top">
          <span class="lvp-nm"><i class="fa-solid ${r.fa}"></i> ${r.label}</span>
          <span class="lvp-val">—</span>
        </div>
        <div class="lvp-track"></div>
        <div class="lvp-sub">${need ? planText(need, lang).name + ' rejasidan' : 'Mavjud emas'}</div>
      </div>`;
    }

    const rem = LV.remaining(res);
    const col = barColor(rem.daily.left, rem.daily.cap);

    return `<div class="lvp-row">
      <div class="lvp-top">
        <span class="lvp-nm"><i class="fa-solid ${r.fa}"></i> ${r.label}</span>
        <span class="lvp-val" style="color:${col}">${rem.daily.left} / ${rem.daily.cap}</span>
      </div>
      <div class="lvp-track">
        <div class="lvp-fill" style="width:${pct(rem.daily.used, rem.daily.cap)}%;background:${col}"></div>
      </div>
      <div class="lvp-sub">
        Hafta: ${rem.weekly.left}/${rem.weekly.cap} · Oy: ${rem.monthly.left}/${rem.monthly.cap} ${r.unit}
      </div>
    </div>`;
  }).join('');

  panel.querySelector('.lvp-in').innerHTML = `
    <div class="lvp-grid">${rows}</div>
    <div class="lvp-note">Kunlik limit har kuni yarim tunda, haftalik dushanba, oylik oy boshida yangilanadi.</div>`;
}

// ── O'RNATISH ──
(function install() {
  if (document.getElementById('lvBar')) return;

  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);

  const mount = () => {
    const wrap = document.createElement('div');
    wrap.innerHTML = `<div id="lvBar"><div class="lvb-in"></div></div><div id="lvPanel"><div class="lvp-in"></div></div>`;
    // Ikkala elementni ham body boshiga qo'yamiz
    while (wrap.firstChild) document.body.insertBefore(wrap.lastChild, document.body.firstChild);

    LV.ready().then(render).catch(e => console.warn('[status-bar]', e.message));
    LV.onChange(render);   // limit sarflanganda darhol yangilanadi
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
  else mount();
})();
