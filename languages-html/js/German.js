import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
    getFirestore, doc, getDoc, setDoc, updateDoc,
    increment, serverTimestamp, arrayUnion, collection,
    addDoc, query, orderBy, limit, getDocs, deleteDoc
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ── FIREBASE ──
const FB = {
    apiKey: "AIzaSyDgVpIEd4Ojm4PEQHOme5yWp87P_xSb6E8",
    authDomain: "linguaverse-ebe09.firebaseapp.com",
    projectId: "linguaverse-ebe09",
    storageBucket: "linguaverse-ebe09.firebasestorage.app",
    messagingSenderId: "130625454868",
    appId: "1:130625454868:web:3f02871f64cb5f8af27801"
};
const app = initializeApp(FB);
const auth = getAuth(app);
const db = getFirestore(app);
const GEMINI = "https://gentle-hat-d9fa.akromovbehruz7.workers.dev";

// ── STATE ──
let CU = null, UP = 'free', UL = {}, UProg = {}, USk = { lesen: 0, schreiben: 0, sprechen: 0, hoeren: 0, grammatik: 0 };
let curLevel = 'beginner', chatMode = 'free', chatHist = [], wOff = 0, wFilt = 'all', wSrch = '';
let recog = null, isRec = false, vcRec = false, upTimer = null;
let curUnit = null, curLesson = null, lScore = 0, lTotal = 0, lexSel = {}, rSel = {}, woAns = [];
let lessonMics = {};

// ── PLAN CONFIG ──
const PL = {
    free:      { u: 2,        ai: 5,        rh: 4, xb: 1,   cb: 1,   voice: false },
    own:       { u: 8,        ai: 50,       rh: 4, xb: 1,   cb: 1,   voice: false },
    team:      { u: 20,       ai: 200,      rh: 4, xb: 2,   cb: 1.5, voice: true  },
    universal: { u: Infinity, ai: Infinity, rh: 0, xb: 3,   cb: 2,   voice: true  }
};

// ── WORDS DATABASE — faqat misollar, asosiy lug'atni o'zing to'ldirasan ──
// WDB bo'sh qoldirildi — o'zing to'ldirasan
const WDB = [
    // { de: 'Hallo', u: 'Salom', t: 'interjection', l: 'beginner', ex: 'Hallo, wie geht es Ihnen?', eu: 'Salom, qandaysiz?' },
    // ...
];

// ── UNITS DATA — bo'sh, o'zing to'ldirasan ──
const UD = {
    beginner:         [],
    elementary:       [],
    intermediate:     [],
    upperintermediate:[],
    advanced:         []
};

// ── HELPER FUNCTIONS ──
const plan = () => PL[UP] || PL.free;
const canUnit = () => UP === 'universal' || ((UL.units_used_today || 0) < plan().u);
const canAI   = () => UP === 'universal' || ((UL.ai_used_today   || 0) < plan().ai);

const chkReset = () => {
    if (UP === 'universal') return;
    const rms = (plan().rh || 4) * 3600000;
    if (Date.now() - (UL.last_reset || 0) >= rms) {
        UL.units_used_today = 0;
        UL.ai_used_today    = 0;
        UL.last_reset       = Date.now();
        saveLimits();
    }
};

async function saveLimits() {
    if (!CU) return;
    try { await updateDoc(doc(db, 'users_de', CU.uid), { limits: UL }); } catch (e) {}
}




// ════════════════════════════════════════
// FIREBASE — PERSISTENCE
// ════════════════════════════════════════

async function saveChatMessage(role, text, mode) {
    if (!CU) return;
    try {
        const chatRef = collection(db, 'users_de', CU.uid, 'chatHistory');
        await addDoc(chatRef, { role, text, mode: mode || chatMode, timestamp: serverTimestamp(), createdAt: Date.now() });
    } catch (e) { console.error('Chat save error:', e); }
}

async function loadChatHistory(limitCount = 30) {
    if (!CU) return [];
    try {
        const chatRef = collection(db, 'users_de', CU.uid, 'chatHistory');
        const q = query(chatRef, orderBy('createdAt', 'desc'), limit(limitCount));
        const snap = await getDocs(q);
        const msgs = [];
        snap.forEach(d => msgs.unshift({ id: d.id, ...d.data() }));
        return msgs;
    } catch (e) { console.error('Chat load error:', e); return []; }
}

async function savePracticeResult(type, score, total, details = {}) {
    if (!CU) return;
    try {
        const practiceRef = collection(db, 'users_de', CU.uid, 'practiceHistory');
        const pct = total > 0 ? Math.round((score / total) * 100) : 0;
        await addDoc(practiceRef, { type, score, total, percentage: pct, details, timestamp: serverTimestamp(), createdAt: Date.now() });
        const skillInc = Math.max(1, Math.round(pct / 20));
        await updateDoc(doc(db, 'users_de', CU.uid), {
            [`skills.${type}`]: Math.min(100, (USk[type] || 0) + skillInc),
            [`practiceStats.${type}.count`]: increment(1),
            [`practiceStats.${type}.totalScore`]: increment(pct),
            lastActive: serverTimestamp()
        });
        USk[type] = Math.min(100, (USk[type] || 0) + skillInc);
        drawRadar();
    } catch (e) { console.error('Practice save error:', e); }
}

async function saveLessonCompletion(unitId, lessonKey, score, total, xpEarned, coinEarned) {
    if (!CU) return;
    const pct = total > 0 ? Math.round((score / total) * 100) : 0;
    try {
        const lessonRef = collection(db, 'users_de', CU.uid, 'lessonHistory');
        await addDoc(lessonRef, { unitId, lessonKey, score, total, percentage: pct, xpEarned, coinEarned, timestamp: serverTimestamp(), createdAt: Date.now() });
        await updateDoc(doc(db, 'users_de', CU.uid), {
            xp: increment(xpEarned),
            coins: increment(coinEarned),
            [`progress.${unitId}_${lessonKey}`]: 100,
            [`scores.${unitId}_${lessonKey}`]: pct,
            [`scoreHistory.${unitId}_${lessonKey}`]: arrayUnion({ score: pct, date: Date.now() }),
            lastActive: serverTimestamp()
        });
        UProg[`${unitId}_${lessonKey}`]       = 100;
        UProg[`score_${unitId}_${lessonKey}`] = pct;
        showToast(`✅ Natija saqlandi! ${xpEarned} XP`, 'success');
    } catch (e) { console.error('Lesson save error:', e); }
}

// ── GEMINI API ──
async function callAI(prompt, maxTok = 1000) {
    try {
        const r = await fetch(GEMINI, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ role: 'user', parts: [{ text: prompt }] }],
                generationConfig: { temperature: 0.7, maxOutputTokens: maxTok }
            })
        });
        const d = await r.json();
        return d.candidates?.[0]?.content?.parts?.[0]?.text || 'Javob olishda xatolik.';
    } catch (e) { return '❗ AI bilan boglanishda xatolik.'; }
}

async function callAIChat(hist, sysP) {
    try {
        const msgs = [{ role: 'user', parts: [{ text: sysP }] }, ...hist.slice(1)];
        const r = await fetch(GEMINI, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: msgs,
                generationConfig: { temperature: 0.8, maxOutputTokens: UP === 'universal' ? 1500 : 800 }
            })
        });
        const d = await r.json();
        return d.candidates?.[0]?.content?.parts?.[0]?.text || 'Javob olishda xatolik.';
    } catch (e) { return '❗ AI bilan boglanishda xatolik.'; }
}

async function loadUD() {
    try {
        const ref  = doc(db, 'users_de', CU.uid);
        const snap = await getDoc(ref);
        if (snap.exists()) {
            const d = snap.data();
            UP    = d.plan     || 'free';
            UL    = d.limits   || {};
            UProg = d.progress || {};
            USk   = d.skills   || { lesen: 0, schreiben: 0, sprechen: 0, hoeren: 0, grammatik: 0 };
            if (!UL.units_used_today) UL.units_used_today = 0;
            if (!UL.ai_used_today)   UL.ai_used_today    = 0;
            if (!UL.last_reset)      UL.last_reset        = Date.now();
        } else {
            UP    = 'free';
            UL    = { units_used_today: 0, ai_used_today: 0, last_reset: Date.now() };
            UProg = {};
            USk   = { lesen: 0, schreiben: 0, sprechen: 0, hoeren: 0, grammatik: 0 };
            await setDoc(ref, {
                email: CU.email,
                displayName: CU.displayName || CU.email.split('@')[0],
                plan: 'free', xp: 0, coins: 0, streak: 0,
                limits: UL, progress: {}, skills: USk,
                practiceStats: {},
                createdAt: serverTimestamp()
            });
        }
        chkReset();
    } catch (e) { console.error(e); }
}

// ── AUTH ──
onAuthStateChanged(auth, async user => {
    CU = user;
    await loadUD();
    renderNav();
    renderLimitBar();
    await initAll();
    // Nav user info
    const navAvatar   = document.getElementById('navAvatar');
    const navUsername = document.getElementById('navUsername');
    const navLogout   = document.getElementById('navLogoutBtn');
    if (navAvatar)   navAvatar.textContent   = (user.displayName || user.email || 'U').charAt(0).toUpperCase();
    if (navUsername) navUsername.textContent = user.displayName || user.email?.split('@')[0] || 'Foydalanuvchi';
    if (navLogout)   navLogout.onclick       = () => auth.signOut().then(() => window.location.href = '../index.html');
});

function renderNav() {
    const plabs = { free: 'Free 🌱', own: 'Own 💎', team: 'Team 👥', universal: 'Universal 🚀' };
    const pn = document.getElementById('planBadgeNav');
    if (pn) { pn.textContent = plabs[UP] || 'Free'; pn.className = `plan-badge-nav ${UP}`; }
}

function renderLimitBar() {
    const lt = document.getElementById('limitText');
    const lp = document.getElementById('limitPills');
    const lr = document.getElementById('limitReset');
    if (!lt) return;
    if (UP === 'universal') {
        lt.textContent = '🚀 Universal — Cheksiz!';
        if (lp) lp.innerHTML = '<span class="limit-pill ok">∞ Cheksiz</span>';
        if (lr) lr.textContent = '';
        return;
    }
    const p  = plan();
    const ul = Math.max(0, p.u   - (UL.units_used_today || 0));
    const al = Math.max(0, p.ai  - (UL.ai_used_today    || 0));
    const rt = new Date((UL.last_reset || Date.now()) + (p.rh || 4) * 3600000);
    const diff = Math.max(0, rt.getTime() - Date.now());
    const h = Math.floor(diff / 3600000), m = Math.floor((diff % 3600000) / 60000), s = Math.floor((diff % 60000) / 1000);
    lt.textContent = `${UP.toUpperCase()} —`;
    if (lp) lp.innerHTML = `<span class="limit-pill ${ul > 0 ? 'ok' : 'out'}">📚 ${ul}/${p.u}</span><span class="limit-pill ${al > 2 ? 'ok' : al > 0 ? 'warn' : 'out'}">🤖 ${al}/${p.ai === Infinity ? '∞' : p.ai}</span>`;
    if (lr) lr.textContent = diff > 0 ? `⏱ ${h}s ${m}d ${s}s` : '';
    const ai = document.getElementById('aiLimitInfo');
    if (ai) ai.innerHTML = `AI: ${al}/${p.ai === Infinity ? '∞' : p.ai} | Tikl: ${p.rh}h`;
}
setInterval(renderLimitBar, 1000);

// ── INIT ──
async function initAll() {
    initNavScroll();
    switchLevel('beginner');
    renderWords();
    drawRadar();
    initWritingCounter();
    renderPractice();
    await loadAndRenderChatHistory();
}

function initNavScroll() {
    window.addEventListener('scroll', () => {
        document.getElementById('navbar')?.classList.toggle('scrolled', window.scrollY > 30);
    });
}

// ── LEVEL & UNITS ──
window.switchLevel = function (level) {
    curLevel = level;
    document.querySelectorAll('.level-tab').forEach(t => t.classList.toggle('active', t.dataset.level === level));
    renderUnits();
};

function renderUnits() {
    const grid  = document.getElementById('unitsGrid');
    const units = UD[curLevel] || [];
    if (!grid) return;
    grid.innerHTML = '';
    if (units.length === 0) {
        grid.innerHTML = '<div style="color:var(--text3);font-size:0.9rem;padding:32px 0;text-align:center">Bu daraja uchun unitlar hali qo\'shilmagan.</div>';
        return;
    }
    units.forEach((unit, i) => {
        const done = ['A','B','C','D'].filter(l => UProg[`${unit.id}_${l}`] >= 100).length;
        const pct  = Math.round((done / 4) * 100);
        const isComp = pct === 100;
        const card = document.createElement('div');
        card.className = `unit-card${isComp ? ' completed' : ''}`;
        card.innerHTML = `
      <div class="unit-num">Unit ${i + 1}</div>
      <div class="unit-emoji">${unit.emoji}</div>
      <div class="unit-title">${unit.title}</div>
      <div class="unit-desc">${unit.desc}</div>
      <div class="unit-lessons-mini">
        ${['A','B','C','D'].map(l => `<div class="unit-lesson-dot ${UProg[unit.id+'_'+l] >= 100 ? 'done' : ''}">${l}</div>`).join('')}
      </div>
      <div class="unit-progress-bar-wrap"><div class="unit-progress-bar" style="width:${pct}%"></div></div>
      <div class="unit-xp">+${unit.xp} XP · +${unit.coin} 🪙</div>
      ${isComp ? '<div class="unit-complete-badge">✅</div>' : ''}
    `;
        card.onclick = () => openUnit(unit);
        grid.appendChild(card);
    });
}

window.openUnit = function (unit) {
    if (!canUnit()) { showUpgradeModal('Bugungi unit limitingiz tugadi!'); return; }
    curUnit = unit;
    const modal   = document.getElementById('unitModal');
    const content = document.getElementById('modalContent');
    if (!modal || !content) return;
    const lnames  = { A: "📖 Grammatik & Wortschatz", B: "🎧 Hören", C: "📖 Lesen", D: "🎤 Sprechen & Schreiben" };
    const lcolors = { A: '#e63946', B: '#2196f3', C: '#43a047', D: '#ff9800' };
    content.innerHTML = `
    <div class="unit-modal-header">
      <div class="unit-modal-emoji">${unit.emoji}</div>
      <div class="unit-modal-title">${unit.title}</div>
      <div class="unit-modal-desc">${unit.desc}</div>
      <div class="unit-modal-meta">
        <span>⭐ +${unit.xp} XP</span><span>🪙 +${unit.coin} Coin</span><span>📚 ${(unit.words||[]).length} so'z</span>
      </div>
    </div>
    <div class="unit-lessons-grid">
      ${['A','B','C','D'].map(k => {
        const done = UProg[`${unit.id}_${k}`] >= 100;
        const sc   = UProg[`score_${unit.id}_${k}`] || 0;
        return `<div class="lesson-card ${done ? 'done' : ''}" onclick="openLesson('${unit.id}','${k}')">
          <div class="lesson-badge" style="background:${lcolors[k]}22;border-color:${lcolors[k]}55;color:${lcolors[k]}">${k}</div>
          <div class="lesson-card-title" style="color:${lcolors[k]}">${lnames[k]}</div>
          ${done ? `<div class="lesson-score">${sc}%</div>` : ''}
          <div class="lesson-start">${done ? '🔄 Qayta' : '▶ Boshlash'}</div>
        </div>`;
    }).join('')}
    </div>
    <div class="unit-words-preview">
      <div class="uwp-title">📝 So'zlar (${(unit.words||[]).length} ta):</div>
      <div class="uwp-words">${(unit.words||[]).map(w => `<span class="uwp-word" onclick="spk('${w}')">${w} 🔊</span>`).join('')}</div>
    </div>
  `;
    modal.classList.add('open');
};

window.openLesson = function (unitId, lessonKey) {
    let unit = null;
    for (const lvl of Object.values(UD)) { const f = lvl.find(u => u.id === unitId); if (f) { unit = f; break; } }
    if (!unit) return;
    curUnit = unit; curLesson = lessonKey; lScore = 0; lTotal = 0; lexSel = {}; rSel = {}; woAns = []; lessonMics = {};
    UL.units_used_today = (UL.units_used_today || 0) + 1; saveLimits();
    document.getElementById('unitModal')?.classList.remove('open');
    showLessonModal(unit, lessonKey);
};

function showLessonModal(unit, lk) {
    const modal   = document.getElementById('unitModal');
    const content = document.getElementById('modalContent');
    if (!modal || !content) return;
    const lnames = { A: "📖 Grammatik & Wortschatz", B: "🎧 Hören", C: "📖 Lesen", D: "🎤 Sprechen & Schreiben" };
    content.innerHTML = `<div class="lesson-modal-wrap">
    <div class="lesson-modal-header">
      <div class="lm-back" onclick="openUnit(window.__curUnit)">← Orqaga</div>
      <div class="lm-title">${unit.emoji} ${unit.title} — ${lnames[lk]}</div>
      <div class="lm-level">${unit.level}</div>
    </div>
    <div id="lessonBody">${getLessonHTML(unit, lk)}</div>
  </div>`;
    window.__curUnit = unit;
    modal.classList.add('open');
    if (lk === 'D') initWOChips();
}

function getLessonHTML(unit, lk) {
    if (lk === 'A') return lessonA(unit);
    if (lk === 'B') return lessonB(unit);
    if (lk === 'C') return lessonC(unit);
    if (lk === 'D') return lessonD(unit);
    return '';
}

// ════════════════════════════════════════
// LESSON A: GRAMMATIK & WORTSCHATZ
// ════════════════════════════════════════
function lessonA(unit) {
    const words = (unit.words || []).slice(0, 12);
    const rule  = unit.grammar_rule    || '';
    const ex    = unit.grammar_example || '';

    const fills = words.slice(0, 4).map((w, i) => {
        const wd    = WDB.find(x => x.de === w) || { ex: `Verwende das Wort "${w}" in einem Satz.`, eu: '', u: '' };
        const blank = (wd.ex || '').replace(new RegExp('\\b' + w + '\\b', 'i'), '_______');
        return `<div class="gex-item">
      <div class="gex-q">${i + 1}. ${blank}</div>
      <div class="gex-uz">${wd.eu || ''}</div>
      <input class="gex-input" id="gex${i}" data-ans="${w}" placeholder="Javobingiz...">
      <div class="gex-row">
        <button class="btn-sm btn-check" onclick="chkFill(${i})">✓ Tekshir</button>
        <button class="btn-sm btn-ai"    onclick="aiExWord('${w}')">🤖 AI</button>
        <button class="btn-sm btn-sound" onclick="spk('${w}')">🔊</button>
      </div>
      <div class="gex-fb" id="gexfb${i}"></div>
    </div>`;
    }).join('');

    const matchW  = words.slice(0, 6);
    const matchUZ = matchW.map(w => { const d = WDB.find(x => x.de === w); return d ? d.u : w; });
    const shuffUZ = [...matchUZ].sort(() => Math.random() - 0.5);

    return `
  <div class="ls-section">
    <h3 class="ls-title">📚 Wortschatz (${words.length} so'z)</h3>
    <div class="vocab-grid">
      ${words.map(w => {
        const d = WDB.find(x => x.de === w) || { u: '', t: '', ex: '', eu: '' };
        return `<div class="vocab-card">
          <div class="vocab-top"><span class="vocab-eng">${w}</span><button class="btn-sound-sm" onclick="spk('${w}')">🔊</button></div>
          <div class="vocab-uz">${d.u}</div>
          <div class="vocab-type">${d.t}</div>
          <div class="vocab-ex">"${d.ex}"</div>
          <div class="vocab-exuz">${d.eu}</div>
        </div>`;
    }).join('')}
    </div>
  </div>
  <div class="ls-section">
    <h3 class="ls-title">📝 Grammatikregel</h3>
    <div class="grammar-rule-box">
      <div class="grb-rule">💡 ${rule}</div>
      <div class="grb-example">✏️ ${ex}</div>
      <button class="btn-ai-full" onclick="aiGrammarExplain('${unit.title}','${rule.replace(/'/g,"\\'")}')">🤖 AI tushuntirsin</button>
      <div class="grb-fb" id="gramRuleFB"></div>
    </div>
  </div>
  <div class="ls-section">
    <h3 class="ls-title">✏️ Lückentext — Bo'sh joylarni to'ldiring</h3>
    ${fills}
    <div class="gex-fb" id="vocabAIFB"></div>
  </div>
  <div class="ls-section">
    <h3 class="ls-title">🧩 Zuordnung — Juftlashtirish</h3>
    <p class="ls-hint">Nemischa so'zni o'zbek tarjimasiga ulang:</p>
    <div class="match-wrap">
      <div class="match-col">${matchW.map((w,i)=>`<div class="match-item eng" data-i="${i}" onclick="selMatch(this,'e',${i})">${w} 🔊</div>`).join('')}</div>
      <div class="match-col">${shuffUZ.map(u=>`<div class="match-item uz" data-u="${u}" onclick="selMatch(this,'u','${u.replace(/'/g,"\\'")}')"> ${u}</div>`).join('')}</div>
    </div>
    <div id="matchFB" class="gex-fb"></div>
  </div>
  <button class="btn-complete" onclick="finLessonA('${unit.id}')">✅ Grammatik darsini yakunlash</button>
  `;
}

window.chkFill = function (i) {
    const inp = document.getElementById(`gex${i}`);
    const fb  = document.getElementById(`gexfb${i}`);
    if (!inp || !fb) return;
    const ans = inp.dataset.ans.toLowerCase();
    const usr = inp.value.trim().toLowerCase();
    if (usr === ans) {
        fb.className = 'gex-fb correct'; fb.innerHTML = `✅ Richtig! "${inp.dataset.ans}" — super!`;
        inp.style.borderColor = '#43a047'; lScore++; awardXP(10, 'grammatik');
    } else {
        fb.className = 'gex-fb wrong'; fb.innerHTML = `❌ Falsch. Richtige Antwort: <strong>${inp.dataset.ans}</strong>`;
        inp.style.borderColor = '#e63946';
    }
    lTotal++;
};

let mSel = { e: null, u: null, eEl: null, uEl: null };
window.selMatch = function (el, type, val) {
    if (type === 'e') {
        document.querySelectorAll('.match-item.eng').forEach(x => x.classList.remove('selected'));
        el.classList.add('selected'); mSel.e = val; mSel.eEl = el;
    } else {
        document.querySelectorAll('.match-item.uz').forEach(x => x.classList.remove('selected'));
        el.classList.add('selected'); mSel.u = val; mSel.uEl = el;
    }
    if (mSel.e !== null && mSel.u !== null) {
        const unit  = curUnit;
        const words = (unit.words || []).slice(0, 6);
        const w     = words[mSel.e];
        const wd    = WDB.find(x => x.de === w);
        if (wd && wd.u === mSel.u) {
            mSel.eEl?.classList.add('match-ok'); mSel.uEl?.classList.add('match-ok');
            awardXP(5, 'grammatik'); showToast(`✅ "${w}" = "${mSel.u}"!`, 'success');
        } else {
            mSel.eEl?.classList.add('match-no'); mSel.uEl?.classList.add('match-no');
            setTimeout(() => { mSel.eEl?.classList.remove('match-no','selected'); mSel.uEl?.classList.remove('match-no','selected'); }, 700);
        }
        mSel = { e: null, u: null, eEl: null, uEl: null };
    }
};

window.aiGrammarExplain = async function (title, rule) {
    if (!canAI()) { showUpgradeModal('AI limit tugadi!'); return; }
    const fb = document.getElementById('gramRuleFB');
    if (fb) { fb.className = 'gex-fb info'; fb.innerHTML = '🤖 AI tahlil qilmoqda...'; }
    UL.ai_used_today++; saveLimits();
    const r = await callAI(`"${title}" mavzusida "${rule}" nemis grammatika qoidasini O'zbek tilida tushuntir. 3 ta misol keltir. Sodda va aniq bo'lsin.`, 800);
    if (fb) { fb.className = 'gex-fb info show'; fb.innerHTML = r.replace(/\n/g,'<br>'); }
};

window.aiExWord = async function (word) {
    if (!canAI()) { showUpgradeModal('AI limit tugadi!'); return; }
    const fb = document.getElementById('vocabAIFB');
    if (fb) { fb.className = 'gex-fb info'; fb.innerHTML = `🤖 "${word}" so'zini tahlil qilmoqda...`; }
    UL.ai_used_today++; saveLimits();
    const r = await callAI(`"${word}" nemischa so'zini O'zbek tilida tushuntir: 1) Ma'nosi 2) Uch xil misol jumla 3) Nemis tilida qanday qo'llanadi 4) Esda qolish uchun maslahat`, 600);
    if (fb) { fb.className = 'gex-fb info show'; fb.innerHTML = r.replace(/\n/g,'<br>'); }
};

window.finLessonA = async function (uid) { await finLesson(uid, 'A', 'grammatik', lScore, lTotal || 4); };

// ════════════════════════════════════════
// LESSON B: HÖREN (LISTENING)
// ════════════════════════════════════════
function lessonB(unit) {
    const exs = genListenExs(unit);
    window.__listenExs = exs;
    return `
  <div class="ls-section">
    <h3 class="ls-title">🎧 Hörverständnis — Tinglab tushunish</h3>
    <p class="ls-hint">Audio tugmani bosing, diqqat bilan eshiting va savolga javob bering</p>
    <div id="lexCont">${renderLex(exs, 0)}</div>
  </div>
  <div class="ls-section">
    <h3 class="ls-title">✍️ Diktat — Diktant</h3>
    <p class="ls-hint">Gapni eshiting va to'liq yozing:</p>
    <div class="dict-controls">
      <button class="btn-play"            onclick="playDict('${unit.id}','normal')">▶ Eshitish</button>
      <button class="btn-play btn-slow"   onclick="playDict('${unit.id}','slow')">🐌 Langsam</button>
    </div>
    <div class="dict-wave paused" id="dwave"><span></span><span></span><span></span><span></span><span></span></div>
    <textarea class="dict-input" id="dictIn" placeholder="Eshitgangizni nemischa yozing..."></textarea>
    <div class="dict-actions">
      <button class="btn-sm btn-check" onclick="chkDict()">✓ Tekshir</button>
      <button class="btn-sm btn-ai"    onclick="aiChkDict()">🤖 AI tahlil</button>
    </div>
    <div class="gex-fb" id="dictFB"></div>
  </div>
  <button class="btn-complete" onclick="finLessonB('${unit.id}')">✅ Hören yakunlash</button>
  `;
}

function genListenExs(unit) {
    const w = unit.words || ['Hallo'];
    return [
        {
            text: `Heute sprechen wir über das Thema "${unit.title}". Das Wort "${w[0]}" ist sehr wichtig auf Deutsch. Es gehört zum Thema ${unit.desc}. Man benutzt "${w[1] || w[0]}" oft im Alltag.`,
            q: `Worüber sprechen wir heute?`,
            opts: [unit.title, `Sport`, `Kochen`, `Reisen`], c: 0,
            tip: `"Heute sprechen wir über ${unit.title}"`
        },
        {
            text: `Guten Tag! Ich heiße Emma. Heute lerne ich euch ${w[0]}, ${w[1] || w[0]} und ${w[2] || w[0]}. Diese Wörter sind sehr wichtig beim Thema ${unit.title}. Zuerst schauen wir uns "${w[0]}" an. Dann üben wir mit Beispielen. Seid ihr bereit?`,
            q: `Was erklärt Emma zuerst?`,
            opts: [`${w[2] || w[0]}`, `${w[0]}`, `${w[1] || w[0]}`, `Alles auf einmal`], c: 1,
            tip: `"Zuerst schauen wir uns ... an"`
        },
        {
            text: `${unit.title} ist ein faszinierendes Thema. Wenn du Deutsch verbessern möchtest, musst du ${w[0]} und ${w[1] || w[0]} lernen. Viele Schüler finden ${w[2] || w[0]} anfangs schwierig, aber mit Übung wird es einfacher.`,
            q: `Was wird mit Übung einfacher?`,
            opts: [`${w[0]}`, `${w[1] || w[0]}`, `${w[2] || w[0]}`, `${w[3] || w[0]}`], c: 2,
            tip: `"mit Übung wird es einfacher"`
        }
    ];
}

function renderLex(exs, idx) {
    const ex = exs[idx];
    if (!ex) return '<div class="lex-done">🎉 Barcha hören mashqlari tugadi!</div>';
    return `<div class="lex-card">
    <div class="lex-num">Frage ${idx + 1}/${exs.length}</div>
    <div class="lex-controls">
      <button class="btn-play"          onclick="playLex(${idx},'normal')">▶ Hören</button>
      <button class="btn-play btn-slow" onclick="playLex(${idx},'slow')">🐌 Langsam</button>
    </div>
    <div class="lex-wave paused" id="lwave${idx}"><span></span><span></span><span></span><span></span><span></span></div>
    <div class="lex-transcript" id="ltxt${idx}" style="display:none">${ex.text}</div>
    <div class="lex-q">${ex.q}</div>
    <div class="lex-opts">
      ${ex.opts.map((o,oi) => `<div class="lex-opt" data-qi="${idx}" data-oi="${oi}" onclick="selLex(this,${idx},${oi})">${String.fromCharCode(65+oi)}. ${o}</div>`).join('')}
    </div>
    <div class="lex-tip">💡 Tipp: ${ex.tip}</div>
    <div class="lex-actions">
      <button class="btn-sm btn-check" onclick="chkLex(${idx},${ex.c})">✓ Tekshir</button>
      ${idx + 1 < exs.length ? `<button class="btn-sm btn-next" onclick="nextLex(${idx+1})" id="lexnxt${idx}" style="display:none">→ Weiter</button>` : ''}
    </div>
    <div class="gex-fb" id="lexfb${idx}"></div>
  </div>`;
}

window.playLex = function (idx, speed) {
    const exs = window.__listenExs || [];
    if (!exs[idx]) return;
    const wv = document.getElementById(`lwave${idx}`);
    if (wv) wv.classList.remove('paused');
    const u = new SpeechSynthesisUtterance(exs[idx].text);
    u.lang = 'de-DE'; u.rate = speed === 'slow' ? 0.55 : 0.82;
    u.onend = () => { if (wv) wv.classList.add('paused'); };
    speechSynthesis.cancel(); speechSynthesis.speak(u);
};

window.selLex = function (el, qi, oi) {
    document.querySelectorAll(`.lex-opt[data-qi="${qi}"]`).forEach(o => o.classList.remove('selected'));
    el.classList.add('selected'); lexSel[qi] = oi;
};

window.chkLex = function (idx, correct) {
    const fb  = document.getElementById(`lexfb${idx}`);
    const sel = lexSel[idx];
    if (sel === undefined) { if (fb) { fb.className = 'gex-fb wrong'; fb.innerHTML = '⚠️ Javob tanlang!'; } return; }
    document.querySelectorAll(`.lex-opt[data-qi="${idx}"]`).forEach((o,i) => {
        if (i === correct) o.classList.add('lex-correct');
        else if (i === sel && sel !== correct) o.classList.add('lex-wrong');
    });
    const txEl = document.getElementById(`ltxt${idx}`);
    if (txEl) txEl.style.display = 'block';
    if (sel === correct) {
        if (fb) { fb.className = 'gex-fb correct'; fb.innerHTML = "✅ Richtig! Ausgezeichnet!"; }
        lScore++; awardXP(15, 'hoeren');
    } else {
        if (fb) { fb.className = 'gex-fb wrong'; fb.innerHTML = `❌ Falsch. Richtig: <strong>${String.fromCharCode(65+correct)}</strong>`; }
    }
    lTotal++;
    const nxt = document.getElementById(`lexnxt${idx}`);
    if (nxt) nxt.style.display = 'inline-flex';
};

window.nextLex = function (idx) {
    const exs  = window.__listenExs || [];
    const cont = document.getElementById('lexCont');
    if (cont) cont.innerHTML = renderLex(exs, idx);
};

let dictSent = '';
window.playDict = function (uid, speed) {
    let unit = null;
    for (const lvl of Object.values(UD)) { const f = lvl.find(u => u.id === uid); if (f) { unit = f; break; } }
    if (!unit) return;
    const w  = (unit.words || [])[0] || 'Hallo';
    const wd = WDB.find(x => x.de === w);
    dictSent = wd ? wd.ex : `Das Wort "${w}" ist sehr wichtig auf Deutsch.`;
    const wv = document.getElementById('dwave');
    if (wv) wv.classList.remove('paused');
    const u = new SpeechSynthesisUtterance(dictSent);
    u.lang = 'de-DE'; u.rate = speed === 'slow' ? 0.5 : 0.82;
    u.onend = () => { if (wv) wv.classList.add('paused'); };
    speechSynthesis.cancel(); speechSynthesis.speak(u);
};

window.chkDict = function () {
    const inp = document.getElementById('dictIn');
    const fb  = document.getElementById('dictFB');
    if (!inp || !fb) return;
    if (!dictSent) { fb.className = 'gex-fb wrong'; fb.innerHTML = '⚠️ Avval audio tinglang!'; return; }
    const usr = inp.value.trim();
    if (!usr)  { fb.className = 'gex-fb wrong'; fb.innerHTML = '⚠️ Avval yozing!'; return; }
    const cw  = dictSent.toLowerCase().replace(/[.,!?]/g,'').split(' ');
    const uw  = usr.toLowerCase().replace(/[.,!?]/g,'').split(' ');
    let mc = 0;
    const hl = cw.map(w => { if (uw.includes(w)) { mc++; return `<span class="dc">${w}</span>`; } return `<span class="dw">${w}</span>`; }).join(' ');
    const pct = Math.round((mc / cw.length) * 100);
    fb.className = 'gex-fb info show';
    fb.innerHTML = `<div><strong>Richtige Antwort:</strong> ${hl}</div><div style="margin-top:6px"><strong>Ihr Text:</strong> ${usr}</div><div class="dict-score">Genauigkeit: ${pct}%</div>`;
    if (pct >= 70) { lScore++; awardXP(20, 'hoeren'); }
    lTotal++;
};

window.aiChkDict = async function () {
    if (!canAI()) { showUpgradeModal('AI limit tugadi!'); return; }
    const inp = document.getElementById('dictIn');
    const fb  = document.getElementById('dictFB');
    if (!inp?.value.trim()) { if (fb) { fb.className = 'gex-fb wrong'; fb.innerHTML = 'Avval yozing!'; } return; }
    fb.className = 'gex-fb info'; fb.innerHTML = '🤖 AI tahlil qilmoqda...';
    UL.ai_used_today++; saveLimits();
    const r = await callAI(`Nemischa diktant natijasini O'zbek tilida tahlil qil:\nAsl matn: "${dictSent}"\nO'quvchi yozdi: "${inp.value.trim()}"\n1) Imlo xatolari\n2) Tushirib qoldirilgan so'zlar\n3) Ball: /10\n4) Maslahat`, 700);
    fb.className = 'gex-fb info show'; fb.innerHTML = r.replace(/\n/g,'<br>');
};

window.finLessonB = async function (uid) { await finLesson(uid, 'B', 'hoeren', lScore, lTotal || 3); };

// ════════════════════════════════════════
// LESSON C: LESEN (READING)
// ════════════════════════════════════════
function lessonC(unit) {
    const rt = unit.reading_text || `${unit.title} ist ein wichtiges Thema auf Deutsch.`;
    const qs = unit.reading_qs   || [{ q: 'Worum geht es im Text?', opts: [unit.title,'Sport','Essen','Wetter'], c: 0 }];
    const wh = (unit.words || []).slice(0, 5);
    return `
  <div class="ls-section">
    <h3 class="ls-title">📖 Lesetext — Matn o'qish</h3>
    <div class="reading-card">
      <div class="reading-title">${unit.title}</div>
      <div class="reading-body" id="rdbody">${rt}</div>
      <div class="reading-actions">
        <button class="btn-sm btn-play"  onclick="rdAloud()">🔊 Vorlesen</button>
        <button class="btn-sm btn-check" onclick="hlVocab('${unit.id}')">🖊 So'zlarni ajratish</button>
      </div>
    </div>
  </div>
  <div class="ls-section">
    <h3 class="ls-title">❓ Verständnisfragen — Savollari</h3>
    ${qs.map((q,qi) => `<div class="rq-card">
      <div class="rq-q">${qi+1}. ${q.q}</div>
      <div class="rq-opts">
        ${q.opts.map((o,oi) => `<div class="rq-opt" data-qi="${qi}" data-oi="${oi}" onclick="selRQ(this,${qi},${oi})">${String.fromCharCode(65+oi)}. ${o}</div>`).join('')}
      </div>
      <div class="gex-fb" id="rqfb${qi}"></div>
    </div>`).join('')}
    <div class="rd-actions">
      <button class="btn-sm btn-check" onclick="chkAllRQ(${JSON.stringify(qs.map(q=>q.c))})">✓ Hammasini tekshir</button>
      <button class="btn-sm btn-ai"    onclick="aiRdHelp('${unit.title}')">🤖 AI tushuntirsin</button>
    </div>
    <div class="gex-fb" id="rdTotFB"></div>
  </div>
  <div class="ls-section">
    <h3 class="ls-title">🔤 Wortschreibung — So'z yozish</h3>
    ${wh.map((w,i) => {
        const d = WDB.find(x => x.de === w) || { u: w };
        return `<div class="wh-row"><span class="wh-uz">${d.u}</span><input class="wh-inp" id="whi${i}" data-ans="${w}" placeholder="nemischa..."><button class="wh-btn" onclick="chkWH(${i})">✓</button><button class="wh-btn" onclick="spk('${w}')">🔊</button><span class="wh-fb" id="whfb${i}"></span></div>`;
    }).join('')}
  </div>
  <button class="btn-complete" onclick="finLessonC('${unit.id}')">✅ Lesen yakunlash</button>
  `;
}

window.rdAloud = function () {
    const b = document.getElementById('rdbody');
    if (!b) return;
    const u = new SpeechSynthesisUtterance(b.textContent);
    u.lang = 'de-DE'; u.rate = 0.82;
    speechSynthesis.cancel(); speechSynthesis.speak(u);
};

window.hlVocab = function (uid) {
    let unit = null;
    for (const lvl of Object.values(UD)) { const f = lvl.find(u => u.id === uid); if (f) { unit = f; break; } }
    if (!unit) return;
    const b = document.getElementById('rdbody'); if (!b) return;
    let html = b.innerHTML;
    (unit.words || []).forEach(w => {
        const re = new RegExp(`\\b${w}\\b`, 'gi');
        html = html.replace(re, `<mark class="vocab-hl">${w}</mark>`);
    });
    b.innerHTML = html;
};

window.selRQ = function (el, qi, oi) {
    document.querySelectorAll(`.rq-opt[data-qi="${qi}"]`).forEach(o => o.classList.remove('selected'));
    el.classList.add('selected'); rSel[qi] = oi;
};

window.chkAllRQ = function (corrects) {
    let ok = 0;
    corrects.forEach((ca, qi) => {
        const fb  = document.getElementById(`rqfb${qi}`);
        const sel = rSel[qi];
        document.querySelectorAll(`.rq-opt[data-qi="${qi}"]`).forEach((o,i) => {
            if (i === ca) o.classList.add('rq-correct');
            else if (sel !== undefined && i === sel && i !== ca) o.classList.add('rq-wrong');
        });
        if (sel === ca) { ok++; if (fb) { fb.className = 'gex-fb correct'; fb.innerHTML = "✅ Richtig!"; } }
        else if (sel !== undefined && fb) { fb.className = 'gex-fb wrong'; fb.innerHTML = `❌ Richtig: <strong>${String.fromCharCode(65+ca)}</strong>`; }
    });
    lScore += ok; lTotal += corrects.length;
    const pct = Math.round((ok / corrects.length) * 100);
    const tf  = document.getElementById('rdTotFB');
    if (tf) { tf.className = `gex-fb ${pct >= 60 ? 'correct' : 'wrong'} show`; tf.innerHTML = `${pct >= 60 ? '🏆' : '💪'} ${ok}/${corrects.length} — ${pct}%`; }
    if (pct >= 60) awardXP(25, 'lesen');
};

window.aiRdHelp = async function (title) {
    if (!canAI()) { showUpgradeModal('AI limit tugadi!'); return; }
    const fb = document.getElementById('rdTotFB');
    if (fb) { fb.className = 'gex-fb info'; fb.innerHTML = '🤖 AI tahlil qilmoqda...'; }
    UL.ai_used_today++; saveLimits();
    const r = await callAI(`"${title}" mavzusidagi nemischa o'qish matni bo'yicha O'zbek tilida yordam ber: 1) Asosiy fikrlar 2) Muhim so'zlar 3) Tushunish bo'yicha maslahat`, 600);
    if (fb) { fb.className = 'gex-fb info show'; fb.innerHTML = r.replace(/\n/g,'<br>'); }
};

window.chkWH = function (i) {
    const inp = document.getElementById(`whi${i}`);
    const fb  = document.getElementById(`whfb${i}`);
    if (!inp || !fb) return;
    if (inp.value.trim().toLowerCase() === inp.dataset.ans.toLowerCase()) {
        fb.className = 'whfb ok'; fb.innerHTML = '✅'; inp.style.borderColor = '#43a047'; awardXP(5, 'lesen');
    } else {
        fb.className = 'whfb no'; fb.innerHTML = `❌ ${inp.dataset.ans}`; inp.style.borderColor = '#e63946';
    }
};

window.finLessonC = async function (uid) { await finLesson(uid, 'C', 'lesen', lScore, lTotal || 3); };

// ════════════════════════════════════════
// LESSON D: SPRECHEN & SCHREIBEN
// ════════════════════════════════════════
function lessonD(unit) {
    const topics = [
        `${unit.title} haqida 3-4 jumla nemischa gapiring`,
        `"${(unit.words||['Hallo'])[0]}" so'zini ishlatib nemischa jumla ayting`,
        `${unit.desc} ni o'z so'zlaringiz bilan tushuntiring`
    ];
    const wp   = `${unit.title} haqida 40-60 so'zlik paragraf nemischa yozing. Quyidagi so'zlardan kamida 3 tasini ishlating: ${(unit.words||[]).slice(0,5).join(', ')}`;
    const w0   = (unit.words || ['Hallo'])[0];
    const wd   = WDB.find(x => x.de === w0);
    const woSent  = wd ? wd.ex : `Ich lerne gerne ${w0} auf Deutsch.`;
    const woWords = woSent.split(' ');
    const woShuf  = [...woWords].sort(() => Math.random() - 0.5);
    window.__woCorrect = woSent;

    return `
  <div class="ls-section">
    <h3 class="ls-title">🎤 Sprechübungen</h3>
    ${topics.map((t,i) => `<div class="stc" id="stc${i}">
      <div class="stc-header"><div class="stc-num">${i+1}</div><div class="stc-topic">${t}</div></div>
      <div class="stc-hint">💡 Tipp: "${(unit.words||[])[i]||w0}" so'zini ishlating</div>
      <div class="stc-mic">
        <button class="btn-mic" id="mbtn${i}" onclick="togMic(${i})">🎤 Sprechen</button>
        <div class="stc-status" id="mst${i}">Mikrofon tayyor</div>
      </div>
      <div class="stc-transcript" id="mtr${i}"></div>
      <div class="stc-actions">
        <button class="btn-sm btn-ai"    onclick="aiSpk(${i},'${t.replace(/'/g,"\\'")}')">🤖 AI baholash</button>
        <button class="btn-sm btn-check" onclick="markDone(${i})">✅ Bajarildi</button>
      </div>
      <div class="gex-fb" id="sfb${i}"></div>
    </div>`).join('')}
  </div>
  <div class="ls-section">
    <h3 class="ls-title">✍️ Schreibübung</h3>
    <div class="wp-card">${wp}</div>
    <div class="wstats"><span id="dwc">0 so'z</span><span id="dcc">0 belgi</span><span id="dst" class="wst-warn">Min 40 so'z</span></div>
    <textarea class="writing-ta" id="dta" placeholder="Hier auf Deutsch schreiben..." oninput="updWC()"></textarea>
    <div class="wa-row">
      <button class="btn-sm btn-ai"    onclick="aiWrit('${unit.title}','${(unit.words||[]).slice(0,5).join(',')}')">🤖 AI tekshirsin</button>
      <button class="btn-sm btn-check" onclick="selfChk(40)">📊 So'z soni</button>
    </div>
    <div class="gex-fb" id="wfb"></div>
  </div>
  <div class="ls-section">
    <h3 class="ls-title">🔀 Wortstellung — So'z tartibi</h3>
    <p class="ls-hint">So'zlarni bosib to'g'ri nemischa jumla tuzing:</p>
    <div class="wo-chips" id="woChips">
      ${woShuf.map(w => `<div class="wo-chip" data-w="${w}" onclick="selChip(this)">${w}</div>`).join('')}
    </div>
    <div class="wo-ans" id="woAnsDiv"><span class="wo-ph">Bu yerga bosing...</span></div>
    <div class="wa-row">
      <button class="btn-sm btn-check" onclick="chkWO()">✓ Tekshir</button>
      <button class="btn-sm"           onclick="rstWO()">🔄 Zurücksetzen</button>
      <button class="btn-sm btn-sound" onclick="spk('${woSent.replace(/'/g,"\\'")}')">🔊 Hören</button>
    </div>
    <div class="gex-fb" id="wofb"></div>
  </div>
  <button class="btn-complete" onclick="finLessonD('${unit.id}')">✅ Sprechen & Schreiben yakunlash</button>
  `;
}

window.initWOChips = function () { woAns = []; };

window.selChip = function (el) {
    if (el.classList.contains('used')) return;
    el.classList.add('used'); woAns.push(el.dataset.w);
    const d = document.getElementById('woAnsDiv');
    if (d) d.innerHTML = woAns.map((w,i) => `<span class="wo-aw" onclick="rmChip(${i})">${w}</span>`).join(' ');
};

window.rmChip = function (idx) {
    const w = woAns[idx]; woAns.splice(idx,1);
    document.querySelectorAll('.wo-chip').forEach(c => { if (c.dataset.w === w && c.classList.contains('used')) c.classList.remove('used'); });
    const d = document.getElementById('woAnsDiv');
    if (d) { if (!woAns.length) { d.innerHTML = '<span class="wo-ph">Bu yerga bosing...</span>'; } else { d.innerHTML = woAns.map((w,i) => `<span class="wo-aw" onclick="rmChip(${i})">${w}</span>`).join(' '); } }
};

window.rstWO = function () {
    woAns = [];
    document.querySelectorAll('.wo-chip').forEach(c => c.classList.remove('used'));
    const d = document.getElementById('woAnsDiv');
    if (d) d.innerHTML = '<span class="wo-ph">Bu yerga bosing...</span>';
};

window.chkWO = function () {
    const fb      = document.getElementById('wofb');
    const correct = window.__woCorrect || '';
    if (!woAns.length) { if (fb) { fb.className = 'gex-fb wrong'; fb.innerHTML = "⚠️ Avval so'zlarni tartibga qo'ying!"; } return; }
    const usr = woAns.join(' ');
    if (usr.toLowerCase() === correct.toLowerCase()) {
        if (fb) { fb.className = 'gex-fb correct'; fb.innerHTML = "🏆 Perfekt! Richtige Reihenfolge!"; } awardXP(15, 'schreiben'); lScore++;
    } else {
        if (fb) { fb.className = 'gex-fb wrong'; fb.innerHTML = `❌ Falsch. Richtig: <em>${correct}</em>`; }
    }
    lTotal++;
};

window.togMic = function (idx) {
    const btn = document.getElementById(`mbtn${idx}`);
    const st  = document.getElementById(`mst${idx}`);
    const tr  = document.getElementById(`mtr${idx}`);
    const SR  = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
        if (tr) tr.innerHTML = `<textarea class="man-inp" id="man${idx}" placeholder="Mikrofon yo'q — bu yerga yozing..."></textarea>`;
        if (st) st.textContent = '⌨️ Yozma kiritish'; return;
    }
    if (lessonMics[idx]) { try { lessonMics[idx].stop(); } catch(e){} lessonMics[idx] = null; if (btn) { btn.classList.remove('rec'); btn.innerHTML = '🎤 Sprechen'; } return; }
    const rec = new SR(); rec.lang = 'de-DE'; rec.continuous = true; rec.interimResults = true;
    rec.onresult = e => { let t = ''; for (let i = e.resultIndex; i < e.results.length; i++) t += e.results[i][0].transcript; if (tr && tr.tagName !== 'TEXTAREA') tr.textContent = t; };
    rec.onerror = e => {
        if (e.error === 'not-allowed') { if (st) st.innerHTML = "🚫 Mikrofon ruxsat yo'q"; if (tr) tr.innerHTML = `<textarea class="man-inp" id="man${idx}" placeholder="Bu yerga yozing..."></textarea>`; }
        else { if (st) st.textContent = 'Xatolik — qayta urining'; }
        if (btn) { btn.classList.remove('rec'); btn.innerHTML = '🎤 Sprechen'; } lessonMics[idx] = null;
    };
    rec.onend = () => { if (btn) { btn.classList.remove('rec'); btn.innerHTML = '🎤 Sprechen'; } if (st) st.innerHTML = '✅ Aufgezeichnet'; lessonMics[idx] = null; };
    try {
        rec.start(); lessonMics[idx] = rec;
        if (btn) { btn.classList.add('rec'); btn.innerHTML = "⏹ Stopp"; }
        if (st)  st.innerHTML = '🔴 Aufnahme läuft...';
    } catch(e) {
        if (st) st.textContent = 'Mikrofon xatolik';
        if (tr) tr.innerHTML = `<textarea class="man-inp" id="man${idx}" placeholder="Bu yerga yozing..."></textarea>`;
    }
};

window.aiSpk = async function (idx, topic) {
    if (!canAI()) { showUpgradeModal('AI limit tugadi!'); return; }
    const tr  = document.getElementById(`mtr${idx}`);
    const man = document.getElementById(`man${idx}`);
    const fb  = document.getElementById(`sfb${idx}`);
    let text  = '';
    if (tr) { text = tr.tagName === 'TEXTAREA' ? tr.value.trim() : tr.textContent.trim(); }
    if (!text && man) text = man.value.trim();
    if (!text) { if (fb) { fb.className = 'gex-fb wrong'; fb.innerHTML = '⚠️ Avval gapiring yoki yozing!'; } return; }
    if (fb) { fb.className = 'gex-fb info'; fb.innerHTML = '🤖 AI baholayapti...'; }
    UL.ai_used_today++; saveLimits();
    const r = await callAI(`Nemischa speaking baholash. Mavzu: "${topic}". O'quvchi gapirdi: "${text}". O'zbek tilida:\n1. ✅ Yaxshi tomonlari\n2. ❌ Grammatika xatoliklari\n3. 💡 Yaxshilash tavsiyalari\n4. 🗣️ Tuzatilgan variant\n5. ⭐ Ball: /10`, 700);
    if (fb) { fb.className = 'gex-fb info show'; fb.innerHTML = r.replace(/\n/g,'<br>'); }
    lScore++; lTotal++; awardXP(20, 'sprechen');
};

window.markDone = function (idx) {
    const c = document.getElementById(`stc${idx}`); if (c) c.classList.add('done');
    lScore++; lTotal++; awardXP(10, 'sprechen'); showToast('✅ Bajarildi!', 'success');
};

window.updWC = function () {
    const ta = document.getElementById('dta'); if (!ta) return;
    const t  = ta.value.trim(); const w = t ? t.split(/\s+/).length : 0;
    const wc = document.getElementById('dwc'); const cc = document.getElementById('dcc'); const st = document.getElementById('dst');
    if (wc) wc.textContent = w + " so'z";
    if (cc) cc.textContent = t.length + ' belgi';
    if (st) { if (w >= 40) { st.textContent = '✅ Yetarli'; st.className = 'wst-ok'; } else { st.textContent = `Min 40 so'z (${w}/40)`; st.className = 'wst-warn'; } }
};

window.selfChk = function (min) {
    const ta = document.getElementById('dta'); const fb = document.getElementById('wfb');
    if (!ta || !fb) return;
    const w = ta.value.trim() ? ta.value.trim().split(/\s+/).length : 0;
    if (w >= min) { fb.className = 'gex-fb correct'; fb.innerHTML = `✅ ${w} so'z yozdingiz!`; lScore++; awardXP(15, 'schreiben'); }
    else           { fb.className = 'gex-fb wrong';   fb.innerHTML = `⚠️ Hali ${min - w} so'z kam.`; }
    lTotal++;
};

window.aiWrit = async function (title, words) {
    if (!canAI()) { showUpgradeModal('AI limit tugadi!'); return; }
    const ta = document.getElementById('dta'); const fb = document.getElementById('wfb');
    if (!ta?.value.trim()) { if (fb) { fb.className = 'gex-fb wrong'; fb.innerHTML = 'Avval yozing!'; } return; }
    fb.className = 'gex-fb info'; fb.innerHTML = '🤖 AI tekshirmoqda...';
    UL.ai_used_today++; saveLimits();
    const r = await callAI(`Nemischa yozuvni tekshir. Mavzu: "${title}" (kerakli so'zlar: ${words}).\nMatn: "${ta.value.trim()}"\nO'zbek tilida:\n1. ✅ Grammatika xatoliklari\n2. 📝 Uslub va tuzilish\n3. 🔄 Tuzatilgan variant\n4. ⭐ Goethe bali: /15`, 800);
    fb.className = 'gex-fb info show'; fb.innerHTML = r.replace(/\n/g,'<br>'); awardXP(20, 'schreiben');
};

window.finLessonD = async function (uid) { await finLesson(uid, 'D', 'sprechen', lScore, lTotal || 3); };

// ── FINISH LESSON ──
async function finLesson(uid, lk, skill, sc, tot) {
    if (!CU) return;
    const pct  = tot > 0 ? Math.round((sc / tot) * 100) : 70;
    let unit   = null;
    for (const lvl of Object.values(UD)) { const f = lvl.find(u => u.id === uid); if (f) { unit = f; break; } }
    if (!unit) return;
    const xpB  = plan().xb || 1, coinB = plan().cb || 1;
    const xpE  = Math.round((unit.xp  / 4) * xpB  * (pct / 100));
    const coinE= Math.round((unit.coin/ 4) * coinB * (pct / 100));
    await saveLessonCompletion(uid, lk, sc, tot, xpE, coinE);
    await savePracticeResult(skill, sc, tot, { unitId: uid, lessonKey: lk, unitTitle: unit.title });
    USk[skill] = Math.min(100, (USk[skill] || 0) + Math.round(pct / 15));
    drawRadar(); renderUnits();
    showResult(lk, pct, xpE, coinE, unit, uid);
}

function showResult(lk, pct, xp, coin, unit, uid) {
    const lnames = { A: "Grammatik & Wortschatz", B: 'Hören', C: 'Lesen', D: 'Sprechen & Schreiben' };
    const nxt    = { A: 'B', B: 'C', C: 'D', D: null };
    const content= document.getElementById('modalContent');
    if (!content) return;
    content.innerHTML = `<div class="result-wrap">
    <div class="result-circle ${pct >= 80 ? 'great' : pct >= 60 ? 'good' : 'ok'}">
      <div class="rc-pct">${pct}%</div>
      <div class="rc-lbl">${lnames[lk]}</div>
    </div>
    <div class="result-rewards">
      <div class="rr-item">⭐ +${xp} XP</div>
      <div class="rr-item">🪙 +${coin} Coin</div>
    </div>
    <div class="result-msg">${pct >= 80 ? '🏆 Ausgezeichnet! Sie sind ein Meister!' : pct >= 60 ? '✅ Gut gemacht! Weiter so!' : '💪 Versuchen Sie es nochmal!'}</div>
    <div class="result-actions">
      ${nxt[lk] ? `<button class="btn-complete" onclick="openLesson('${uid}','${nxt[lk]}')">→ Weiter: ${lnames[nxt[lk]]}</button>` : `<div class="unit-done-msg">🎉 Unit to'liq bajarildi!</div>`}
      <button class="btn-back" onclick="document.getElementById('unitModal').classList.remove('open');renderUnits()">🏠 Unitlarga qaytish</button>
    </div>
  </div>`;
    showXPPop(`+${xp} XP +${coin} 🪙`);
}

// ── WORDS SECTION ──
function renderWords(reset = true) {
    if (reset) wOff = 0;
    const grid = document.getElementById('wordsGrid'); if (!grid) return;
    const filt  = getFiltered();
    const slice = filt.slice(0, wOff + 30);
    if (reset) grid.innerHTML = '';
    if (filt.length === 0) {
        grid.innerHTML = '<div style="color:var(--text3);font-size:0.9rem;padding:32px 0;text-align:center;grid-column:1/-1">Lug\'at bo\'sh — WDB massivini to\'ldiring.</div>';
        return;
    }
    slice.slice(wOff).forEach(w => {
        const card = document.createElement('div'); card.className = 'word-card';
        card.innerHTML = `<div class="wc-top"><div class="wc-eng">${w.de}</div><button onclick="spk('${w.de}',event)" class="wc-snd">🔊</button></div><div class="wc-uz">${w.u}</div><div class="wc-meta"><span>${w.t}</span><span>${w.l}</span></div>`;
        card.onclick = e => { if (e.target.closest('.wc-snd')) return; openWModal(w); };
        grid.appendChild(card);
    });
    wOff = slice.length;
    const btn = document.getElementById('loadMoreBtn'); if (btn) btn.style.display = wOff >= filt.length ? 'none' : 'block';
}

function getFiltered() {
    return WDB.filter(w => {
        const ms = !wSrch || w.de.toLowerCase().includes(wSrch) || w.u.toLowerCase().includes(wSrch);
        const ml = wFilt === 'all' || w.l === wFilt;
        return ms && ml;
    });
}

window.filterWords      = function () { wSrch = document.getElementById('wordSearch')?.value.toLowerCase() || ''; renderWords(true); };
window.filterByLevel    = function (level, el) { wFilt = level; document.querySelectorAll('.wf-tab').forEach(t => t.classList.remove('active')); el.classList.add('active'); renderWords(true); };
window.loadMoreWords    = function () { renderWords(false); };

window.openWModal = function (w) {
    const m = document.getElementById('wordModal'); const c = document.getElementById('wordModalContent'); if (!m || !c) return;
    c.innerHTML = `<div class="wm-eng">${w.de}</div><div class="wm-uz">${w.u}</div><div class="wm-meta">${w.t} · ${w.l}</div>
    <div class="wm-ex"><div>"${w.ex}"</div><div class="wm-exuz">${w.eu}</div></div>
    <div class="wm-actions">
      <button class="btn-sm btn-play" onclick="spk('${w.de}')">🔊 Aussprache</button>
      <button class="btn-sm btn-ai"   onclick="aiExWord('${w.de}')">🤖 AI erklärt</button>
    </div>
    <div class="gex-fb" id="wordAIFB"></div>`;
    m.classList.add('open');
};

window.closeWordModal = function (e) { if (!e || e.target === document.getElementById('wordModal')) document.getElementById('wordModal')?.classList.remove('open'); };

// ── PRACTICE ──
function renderPractice() { initPracticeListening(); }

// ── PRACTICE LISTENING (Hören) ──
const PLEx = [
    { text: "Guten Morgen! Das Wetter heute ist sonnig und warm. Ich empfehle leichte Kleidung. Die Temperatur liegt bei etwa 25 Grad. Genießen Sie den Tag!", q: "Wie ist das Wetter heute?", opts: ["Kalt und regnerisch","Sonnig und warm","Bewölkt und windig","Schnee"], c: 1 },
    { text: "Hallo, hier ist die Stadtbibliothek. Wir sind Montag bis Freitag von 9 bis 18 Uhr geöffnet, samstags von 10 bis 16 Uhr. Sonntags sind wir geschlossen. Auf Wiedersehen!", q: "Wann ist die Bibliothek geschlossen?", opts: ["Montag","Samstag","Sonntag","Freitag"], c: 2 },
    { text: "Achtung! Der Zug nach München fährt von Gleis 7 um halb vier ab. Bitte halten Sie Ihre Fahrkarten bereit. Vielen Dank.", q: "Von welchem Gleis fährt der Zug ab?", opts: ["Gleis 5","Gleis 6","Gleis 7","Gleis 8"], c: 2 },
    { text: "Ich rufe wegen der Stellenanzeige an. Ich habe fünf Jahre Erfahrung im Marketing. Ich spreche drei Sprachen: Deutsch, Englisch und Französisch. Ich würde die Stelle gerne besprechen.", q: "Wie viele Jahre Erfahrung hat die Person?", opts: ["Drei","Vier","Fünf","Sechs"], c: 2 },
    { text: "Willkommen in der Arztpraxis. Bei einem Notfall drücken Sie die 1. Für Termine drücken Sie die 2. Für Testergebnisse drücken Sie die 3. Um mit einem Arzt zu sprechen, bitte bleiben Sie in der Leitung.", q: "Was drückt man für einen Termin?", opts: ["1","2","3","In der Leitung bleiben"], c: 1 }
];
let plIdx = 0;

function initPracticeListening() {
    const ex = PLEx[plIdx % PLEx.length];
    const listeningQ = document.getElementById('listeningQ');
    if (listeningQ) {
        listeningQ.innerHTML = `<div class="lex-q">${ex.q}</div><div class="lex-opts">
      ${ex.opts.map((o,i) => `<div class="lex-opt plex" data-i="${i}" onclick="selPLex(this,${i})">${String.fromCharCode(65+i)}. ${o}</div>`).join('')}
    </div>`;
    }
    const as = document.getElementById('audioSentence'); if (as) as.textContent = ex.text;
    window.__plCurrent  = ex;
    window.__plSelected = -1;
}

window.toggleAudio = function () {
    const ex   = window.__plCurrent; if (!ex) return;
    const wave = document.getElementById('audioWave');
    const btn  = document.getElementById('playBtn');
    if (wave) wave.classList.remove('paused');
    if (btn)  btn.textContent = "⏸ Stopp";
    const u = new SpeechSynthesisUtterance(ex.text);
    u.lang = 'de-DE'; u.rate = 0.82;
    u.onend = () => { if (wave) wave.classList.add('paused'); if (btn) btn.textContent = '▶ Audio hören'; };
    speechSynthesis.cancel(); speechSynthesis.speak(u);
};

window.selPLex = function (el, i) {
    document.querySelectorAll('.plex').forEach(o => o.classList.remove('selected'));
    el.classList.add('selected'); window.__plSelected = i;
};

window.checkListening = async function () {
    const fb  = document.getElementById('listeningFeedback');
    const ex  = window.__plCurrent;
    if (!ex || !fb) return;
    const sel = window.__plSelected;
    if (sel < 0) { fb.className = 'feedback-box error show'; fb.innerHTML = '⚠️ Jawab tanlang!'; return; }
    document.querySelectorAll('.plex').forEach((o,i) => { if (i === ex.c) o.classList.add('lex-correct'); else if (i === sel && sel !== ex.c) o.classList.add('lex-wrong'); });
    const correct = sel === ex.c;
    if (correct) {
        fb.className = 'feedback-box success show'; fb.innerHTML = "✅ Richtig! Super!";
        awardXP(10, 'hoeren');
        await savePracticeResult('hoeren', 1, 1, { question: ex.q, correct: true, type: 'practice_panel' });
    } else {
        fb.className = 'feedback-box error show'; fb.innerHTML = `❌ Falsch. Richtig: <strong>${String.fromCharCode(65+ex.c)}</strong>`;
        await savePracticeResult('hoeren', 0, 1, { question: ex.q, correct: false, type: 'practice_panel' });
    }
    const as = document.getElementById('audioTextHidden'); if (as) as.style.display = 'block';
};

window.nextListening = function () { plIdx++; initPracticeListening(); const fb = document.getElementById('listeningFeedback'); if (fb) { fb.className = 'feedback-box'; fb.innerHTML = ''; } };

// ── PRACTICE SPRECHEN ──
const PSTopics = [
    { topic: "Beschreiben Sie Ihren Tagesablauf", ex: "Jeden Morgen stehe ich um 7 Uhr auf und frühstücke..." },
    { topic: "Sprechen Sie über Ihr Lieblingsessen", ex: "Mein Lieblingsessen ist ... weil ..." },
    { topic: "Beschreiben Sie Ihre Heimatstadt", ex: "Ich komme aus ... Es ist eine ... Stadt mit ..." },
    { topic: "Sprechen Sie über ein Hobby", ex: "In meiner Freizeit ... weil es mir ..." },
    { topic: "Beschreiben Sie eine Person, die Sie bewundern", ex: "Ich bewundere ..., weil sie/er ..." },
    { topic: "Sprechen Sie über Ihre Zukunftspläne", ex: "In der Zukunft möchte ich ..." },
];
let psIdx = 0;

window.switchPractice = function (type) {
    document.querySelectorAll('.ptab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.practice-panel').forEach(p => p.classList.remove('active'));
    document.querySelector(`.ptab[onclick*="${type}"]`)?.classList.add('active');
    const panel = document.getElementById(`panel-${type}`);
    if (panel) panel.classList.add('active');
    if (type === 'speaking') initPracticeSpeaking();
    if (type === 'grammar')  initPracticeGrammar();
    if (type === 'reading')  initPracticeReading();
    if (type === 'writing')  initPracticeWriting();
    if (type === 'postcard') initPracticePostcard();
};

function initPracticeSpeaking() {
    const t  = PSTopics[psIdx % PSTopics.length];
    const st = document.getElementById('speakTopic');
    const se = document.getElementById('speakExample');
    if (st) st.innerHTML = `<strong>📌 Thema:</strong> ${t.topic}`;
    if (se) se.innerHTML = `<em>💡 Beispielanfang: "${t.ex}"</em>`;
    const ms = document.getElementById('micStatus'); if (ms) ms.textContent = 'Mikrofon tayyor';
    const tr = document.getElementById('transcriptBox'); if (tr) tr.innerHTML = '';
    window.__psTopic = t;
}

window.toggleMic = function () {
    const btn = document.getElementById('micBtn');
    const st  = document.getElementById('micStatus');
    const tr  = document.getElementById('transcriptBox');
    const SR  = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { if (st) st.innerHTML = "⌨️ Mikrofon yo'q — quyida yozing"; if (tr) tr.innerHTML = '<textarea class="man-inp" id="psManIn" placeholder="Bu yerga yozing..."></textarea>'; return; }
    if (isRec && recog) { try { recog.stop(); } catch(e){} recog = null; isRec = false; if (btn) { btn.querySelector('.mic-icon').textContent = '🎤'; document.getElementById('micBtnText').textContent = 'Sprechen starten'; } return; }
    const rec = new SR(); rec.lang = 'de-DE'; rec.continuous = true; rec.interimResults = true;
    rec.onresult = e => { let t = ''; for (let i = e.resultIndex; i < e.results.length; i++) t += e.results[i][0].transcript; if (tr) tr.textContent = t; };
    rec.onerror  = e => { isRec = false; recog = null; if (st) st.textContent = e.error === 'not-allowed' ? '🚫 Ruxsat berilmagan' : 'Xatolik'; if (btn) { btn.querySelector('.mic-icon').textContent = '🎤'; document.getElementById('micBtnText').textContent = 'Sprechen starten'; } };
    rec.onend    = () => { isRec = false; recog = null; if (st) st.innerHTML = '✅ Aufgezeichnet'; if (btn) { btn.querySelector('.mic-icon').textContent = '🎤'; document.getElementById('micBtnText').textContent = 'Sprechen starten'; } };
    try {
        rec.start(); recog = rec; isRec = true;
        if (btn) { btn.querySelector('.mic-icon').textContent = '⏹'; document.getElementById('micBtnText').textContent = "Stopp"; }
        if (st) st.innerHTML = '🔴 Aufnahme läuft...';
    } catch(e) {
        if (st) st.textContent = 'Mikrofon xatolik';
        if (tr) tr.innerHTML = '<textarea class="man-inp" id="psManIn" placeholder="Bu yerga yozing..."></textarea>';
    }
};

window.analyzeSpeaking = async function () {
    if (!canAI()) { showUpgradeModal('AI limit tugadi!'); return; }
    const tr  = document.getElementById('transcriptBox');
    const man = document.getElementById('psManIn');
    const fb  = document.getElementById('speakingFeedback');
    let text  = '';
    if (tr) text = tr.tagName === 'TEXTAREA' ? tr.value.trim() : tr.textContent.trim();
    if (!text && man) text = man.value.trim();
    if (!text) { if (fb) { fb.className = 'feedback-box error show'; fb.innerHTML = '⚠️ Avval gapiring yoki yozing!'; } return; }
    if (fb) { fb.className = 'feedback-box info show'; fb.innerHTML = '🤖 AI baholayapti...'; }
    UL.ai_used_today++; saveLimits();
    const t = window.__psTopic || { topic: 'Freies Thema' };
    const r = await callAI(`Goethe-Zertifikat Sprechen baholash. Mavzu: "${t.topic}". O'quvchi: "${text}".\nO'zbek tilida Goethe kriteriyalari bo'yicha:\n1. 🗣️ Kommunikasiya (/15)\n2. 📚 Leksik resurs (/15)\n3. 📝 Grammatik aniqlik (/15)\n4. 🎵 Talaffuz (/5)\n5. 💬 Umumiy ball: /50\n6. 🔄 Tuzatilgan variant`, 900);
    if (fb) { fb.className = 'feedback-box info show'; fb.innerHTML = r.replace(/\n/g,'<br>'); }
    awardXP(20, 'sprechen');
    await savePracticeResult('sprechen', 1, 1, { topic: t.topic, text, type: 'practice_panel' });
};

window.nextSpeaking = function () { psIdx++; initPracticeSpeaking(); const fb = document.getElementById('speakingFeedback'); if (fb) { fb.className = 'feedback-box'; fb.innerHTML = ''; } };

// ── PRACTICE LESEN (READING) ──
const PRTexts = [
    {
        title: "Gesunde Ernährung",
        text: "Gesunde Ernährung ist sehr wichtig für das Wohlbefinden. Obst und Gemüse enthalten viele Vitamine. Man sollte täglich mindestens fünf Portionen davon essen. Zucker und Fett sollte man in Maßen genießen. Wasser ist das beste Getränk — mindestens zwei Liter am Tag sind empfehlenswert. Vollkornprodukte geben dem Körper langanhaltende Energie. Eine ausgewogene Ernährung hilft, Krankheiten vorzubeugen.",
        qs: [
            { q: "Wie viele Portionen Obst/Gemüse sollte man täglich essen?", opts: ["Drei","Vier","Fünf","Sieben"], c: 2 },
            { q: "Was ist das beste Getränk laut Text?", opts: ["Kaffee","Saft","Wasser","Milch"], c: 2 },
            { q: "Was geben Vollkornprodukte dem Körper?", opts: ["Vitamine","Energie","Wasser","Fett"], c: 1 }
        ]
    },
    {
        title: "Das deutsche Schulsystem",
        text: "Das deutsche Schulsystem ist in mehrere Stufen gegliedert. Die Grundschule dauert vier Jahre. Danach wechseln Schüler zur Hauptschule, Realschule oder zum Gymnasium. Das Abitur an einem Gymnasium ermöglicht den Universitätszugang. In Deutschland ist die Schulpflicht ab dem sechsten Lebensjahr. Ausbildungen und duale Berufsausbildungen sind wichtige Alternativen zur Universität. Bildung ist in Deutschland kostenlos.",
        qs: [
            { q: "Wie viele Jahre dauert die Grundschule?", opts: ["Drei","Vier","Fünf","Sechs"], c: 1 },
            { q: "Ab welchem Alter besteht Schulpflicht?", opts: ["5","6","7","8"], c: 1 },
            { q: "Was ermöglicht das Abitur?", opts: ["Arbeit","Universitätszugang","Ausbildung","Reisen"], c: 1 }
        ]
    },
    {
        title: "Deutschland — Land und Leute",
        text: "Deutschland liegt in Mitteleuropa und hat etwa 84 Millionen Einwohner. Die Hauptstadt ist Berlin. Deutschland ist Mitglied der Europäischen Union. Das Land ist bekannt für seine Industrie, besonders die Automobilbranche mit Marken wie BMW, Mercedes-Benz und Volkswagen. Deutsche Kultur umfasst Musik, Philosophie und Literatur. Oktoberfest in München ist das bekannteste Volksfest der Welt.",
        qs: [
            { q: "Wie viele Einwohner hat Deutschland ungefähr?", opts: ["70 Millionen","80 Millionen","84 Millionen","90 Millionen"], c: 2 },
            { q: "Was ist die Hauptstadt Deutschlands?", opts: ["München","Hamburg","Frankfurt","Berlin"], c: 3 },
            { q: "Welches Fest ist weltweit bekannt?", opts: ["Karneval","Oktoberfest","Weihnachtsmarkt","Ostern"], c: 1 }
        ]
    }
];
let prIdx = 0;

function initPracticeReading() {
    const rd = PRTexts[prIdx % PRTexts.length];
    const tb = document.getElementById('readingTextBox');
    const rq = document.getElementById('readingQuestions');
    if (!tb || !rq) return;
    tb.innerHTML = `<h3>${rd.title}</h3><p>${rd.text}</p>`;
    rq.innerHTML = rd.qs.map((q,qi) => `<div class="rq-card">
    <div class="rq-q">${qi+1}. ${q.q}</div>
    <div class="rq-opts">${q.opts.map((o,oi) => `<div class="rq-opt" data-qi="${qi}" data-oi="${oi}" onclick="selPRQ(this,${qi},${oi})">${String.fromCharCode(65+oi)}. ${o}</div>`).join('')}</div>
    <div class="gex-fb" id="prqfb${qi}"></div>
  </div>`).join('');
    window.__prCurrent = rd; window.__prSel = {};
}

window.selPRQ = function (el, qi, oi) {
    document.querySelectorAll(`.rq-opt[data-qi="${qi}"]`).forEach(o => o.classList.remove('selected'));
    el.classList.add('selected'); if (!window.__prSel) window.__prSel = {}; window.__prSel[qi] = oi;
};

window.checkReading = async function () {
    const rd = window.__prCurrent; if (!rd) return;
    const fb = document.getElementById('readingFeedback'); let ok = 0;
    rd.qs.forEach((q,qi) => {
        const qfb = document.getElementById(`prqfb${qi}`);
        const sel = window.__prSel?.[qi];
        document.querySelectorAll(`.rq-opt[data-qi="${qi}"]`).forEach((o,i) => { if (i === q.c) o.classList.add('rq-correct'); else if (sel !== undefined && i === sel && i !== q.c) o.classList.add('rq-wrong'); });
        if (sel === q.c) { ok++; if (qfb) { qfb.className = 'gex-fb correct'; qfb.innerHTML = "✅ Richtig!"; } }
        else if (sel !== undefined && qfb) { qfb.className = 'gex-fb wrong'; qfb.innerHTML = `❌ Richtig: <strong>${String.fromCharCode(65+q.c)}</strong>`; }
    });
    if (fb) {
        const pct = Math.round((ok / rd.qs.length) * 100);
        fb.className = `feedback-box ${pct >= 60 ? 'success' : 'error'} show`;
        fb.innerHTML = `${pct >= 60 ? '🏆' : '💪'} ${ok}/${rd.qs.length} — ${pct}%`;
    }
    if (ok >= 2) awardXP(20, 'lesen');
    await savePracticeResult('lesen', ok, rd.qs.length, { title: rd.title, type: 'practice_panel' });
};

window.nextReading = function () { prIdx++; initPracticeReading(); const fb = document.getElementById('readingFeedback'); if (fb) { fb.className = 'feedback-box'; fb.innerHTML = ''; } };

// ── PRACTICE SCHREIBEN ──
const PWPrompts = [
    "Beschreiben Sie Ihren idealen Arbeitsplatz. Wie sieht er aus? Was hat er?",
    "Hat soziale Medien eine positive oder negative Wirkung auf die Gesellschaft? Begründen Sie Ihre Meinung.",
    "Beschreiben Sie eine unvergessliche Reise oder einen Urlaub.",
    "Manche Menschen denken, Kinder sollen mehr lernen. Andere widersprechen. Was ist Ihre Meinung?",
    "Beschreiben Sie die wichtigste Erfindung der Geschichte und erklären Sie warum.",
];
let pwIdx = 0;

function initPracticeWriting() {
    const wp = document.getElementById('writingPrompt'); if (!wp) return;
    wp.innerHTML = `<strong>📌 Thema:</strong> ${PWPrompts[pwIdx % PWPrompts.length]}`;
    window.__pwPrompt = PWPrompts[pwIdx % PWPrompts.length];
}

window.analyzeWriting = async function () {
    if (!canAI()) { showUpgradeModal('AI limit tugadi!'); return; }
    const ta = document.getElementById('writingTextarea');
    const fb = document.getElementById('writingFeedback');
    if (!ta?.value.trim()) { if (fb) { fb.className = 'feedback-box error show'; fb.innerHTML = 'Avval yozing!'; } return; }
    fb.className = 'feedback-box info show'; fb.innerHTML = '🤖 AI tekshirmoqda...';
    UL.ai_used_today++; saveLimits();
    const r = await callAI(`Goethe-Zertifikat Schreiben uslubida tekshir. Mavzu: "${window.__pwPrompt || 'Freies Thema'}"\nMatn: "${ta.value.trim()}"\nO'zbek tilida:\n1. ✅ Grammatika xatoliklari\n2. 📝 Tuzilish\n3. 📚 Leksik resurs\n4. 🔄 Tuzatilgan variant\n5. ⭐ Goethe bali: /25`, 900);
    fb.className = 'feedback-box info show'; fb.innerHTML = r.replace(/\n/g,'<br>'); awardXP(25, 'schreiben');
    const wc = ta.value.trim().split(/\s+/).length;
    await savePracticeResult('schreiben', wc >= 80 ? 1 : 0, 1, { prompt: window.__pwPrompt, wordCount: wc, type: 'practice_panel' });
};

window.nextWriting = function () {
    pwIdx++; initPracticeWriting();
    const ta = document.getElementById('writingTextarea'); if (ta) ta.value = '';
    const fb = document.getElementById('writingFeedback'); if (fb) { fb.className = 'feedback-box'; fb.innerHTML = ''; }
    const wc = document.getElementById('wordCount'); if (wc) wc.textContent = "0 so'z";
};

// ── PRACTICE GRAMMATIK ──
const PGEx = [
    { q: "Sie ___ jeden Tag zur Schule.", opts: ["gehen","geht","gehst","gehe"], c: 0, exp: "Sie (Sie formell) → 3. Person Plural → gehen" },
    { q: "Ich ___ schon fünf Jahre in Berlin.", opts: ["wohne","wohnt","wohnst","wohnen"], c: 0, exp: "Ich → 1. Person Singular → wohne" },
    { q: "Der Hund ___ sehr schnell.", opts: ["läufst","läuft","laufen","laufe"], c: 1, exp: "Er/Sie/Es → 3. Person Singular → läuft (Umlaut!)" },
    { q: "Wir ___ gestern ins Kino gegangen.", opts: ["haben","sein","sind","hatten"], c: 2, exp: "gehen → Bewegungsverb → Perfekt mit 'sein'" },
    { q: "Das ist ___ Buch meines Vaters.", opts: ["der","die","das","den"], c: 2, exp: "Buch = Neutrum → das Buch" },
    { q: "Ich kaufe ___ neuen Computer.", opts: ["ein","eine","einen","einem"], c: 2, exp: "Computer = Maskulinum, Akkusativ → einen" },
    { q: "Er kommt ___ Deutschland.", opts: ["von","aus","in","nach"], c: 1, exp: "Herkunft → aus + Land (kein Artikel)" },
    { q: "Wenn ich Zeit ___, gehe ich spazieren.", opts: ["hätte","habe","hat","haben"], c: 1, exp: "Realer Konditionalsatz → Indikativ Präsens: habe" },
    { q: "Das Buch ___ von Goethe geschrieben.", opts: ["hat","haben","wurde","werden"], c: 2, exp: "Vorgangspassiv Präteritum → wurde + Partizip II" },
    { q: "Er ist ___ groß als sein Bruder.", opts: ["mehr","größer","am größten","so"], c: 1, exp: "Komparativ → größer (Umlaut: groß → größer)" },
];
let pgIdx = 0;

function initPracticeGrammar() {
    const ex   = PGEx[pgIdx % PGEx.length];
    const qbox = document.getElementById('grammarQBox');
    const opts = document.getElementById('grammarOptions');
    const expl = document.getElementById('grammarExplanation');
    if (!qbox || !opts) return;
    qbox.innerHTML = `<div class="gq-q">${ex.q}</div>`;
    opts.innerHTML = ex.opts.map((o,i) => `<div class="gq-opt" data-i="${i}" onclick="selGQ(this,${i})">${String.fromCharCode(65+i)}. ${o}</div>`).join('');
    if (expl) { expl.className = 'grammar-explanation'; expl.innerHTML = ''; }
    window.__pgCurrent = ex; window.__pgSel = -1;
}

window.selGQ = function (el, i) {
    document.querySelectorAll('.gq-opt').forEach(o => o.classList.remove('selected'));
    el.classList.add('selected'); window.__pgSel = i;
};

window.checkGrammar = async function () {
    const ex   = window.__pgCurrent; if (!ex) return;
    const fb   = document.getElementById('grammarFeedback');
    const expl = document.getElementById('grammarExplanation');
    const sel  = window.__pgSel;
    if (sel < 0) { if (fb) { fb.className = 'feedback-box error show'; fb.innerHTML = '⚠️ Javob tanlang!'; } return; }
    document.querySelectorAll('.gq-opt').forEach((o,i) => {
        if (i === ex.c) o.classList.add('gq-correct');
        else if (i === sel && sel !== ex.c) o.classList.add('gq-wrong');
    });
    const correct = sel === ex.c;
    if (correct) {
        if (fb)   { fb.className   = 'feedback-box success show'; fb.innerHTML   = "✅ Richtig! Grammatikprofi!"; }
        if (expl) { expl.className = 'grammar-explanation show';  expl.innerHTML = `💡 Erklärung: ${ex.exp}`; }
        awardXP(15, 'grammatik');
    } else {
        if (fb)   { fb.className   = 'feedback-box error show'; fb.innerHTML   = `❌ Falsch. Richtig: <strong>${String.fromCharCode(65+ex.c)}</strong>`; }
        if (expl) { expl.className = 'grammar-explanation show'; expl.innerHTML = `💡 Erklärung: ${ex.exp}`; }
    }
    await savePracticeResult('grammatik', correct ? 1 : 0, 1, { question: ex.q, correct, type: 'practice_panel' });
};

window.nextGrammar = function () { pgIdx++; initPracticeGrammar(); const fb = document.getElementById('grammarFeedback'); if (fb) { fb.className = 'feedback-box'; fb.innerHTML = ''; } };

// ── PRACTICE POSTKARTE ──
let pcTopic = 'reise';

function initPracticePostcard() {
    const el = document.getElementById('postcardImageArea');
    if (el) el.innerHTML = '<span>📸</span><p>Bild-Bereich</p>';
}

window.selectPostcardTopic = function (t, btn) {
    pcTopic = t;
    document.querySelectorAll('.ptopic-btn').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    const ta = document.getElementById('postcardText'); if (ta) ta.value = '';
};

window.aiWritePostcard = async function () {
    if (!canAI()) { showUpgradeModal('AI limit tugadi!'); return; }
    const fb = document.getElementById('postcardFeedback');
    if (fb) { fb.className = 'feedback-box info show'; fb.innerHTML = '🤖 AI schreibt...'; }
    UL.ai_used_today++; saveLimits();
    const topics = { reise: 'Reise', weihnachten: 'Weihnachten', geburtstag: 'Geburtstag', freundschaft: 'Freundschaft', neujahr: 'Neujahr' };
    const r = await callAI(`Schreibe eine deutsche Postkarte. Thema: "${topics[pcTopic] || pcTopic}". 80-100 Wörter. Herzlich, kreativ und grammatikalisch korrekt. Am Ende unterschreiben.`, 400);
    const ta = document.getElementById('postcardText'); if (ta) ta.value = r;
    if (fb) { fb.className = 'feedback-box success show'; fb.innerHTML = '✅ AI Postkarte geschrieben! Sie können sie bearbeiten.'; }
};

window.aiCheckPostcard = async function () {
    if (!canAI()) { showUpgradeModal('AI limit tugadi!'); return; }
    const ta = document.getElementById('postcardText');
    const fb = document.getElementById('postcardFeedback');
    if (!ta?.value.trim()) { if (fb) { fb.className = 'feedback-box error show'; fb.innerHTML = 'Avval postkarte yozing!'; } return; }
    fb.className = 'feedback-box info show'; fb.innerHTML = '🤖 AI prüft...';
    UL.ai_used_today++; saveLimits();
    const r = await callAI(`Deutschen Postkarten-Text prüfen: "${ta.value.trim()}". O'zbek tilida: 1) Grammatika xatoliklari 2) Uslub 3) Tuzatilgan variant 4) Ball /10`, 600);
    fb.className = 'feedback-box info show'; fb.innerHTML = r.replace(/\n/g,'<br>');
    await savePracticeResult('schreiben', 1, 1, { type: 'postcard', topic: pcTopic });
};

// ── YOUTUBE VIDEOS ──
window.findYoutubeVideos = async function () {
    if (!canAI()) { showUpgradeModal('AI limit tugadi!'); return; }
    const grid = document.getElementById('videosGrid');
    if (grid) grid.innerHTML = '<div class="video-placeholder"><p>🤖 Videolar qidirilmoqda...</p></div>';
    UL.ai_used_today++; saveLimits();
    const weakSk  = Object.entries(USk).sort((a,b) => a[1] - b[1])[0][0];
    const cnt     = UP === 'universal' ? 9 : UP === 'team' ? 6 : 4;
    const levelMap= { beginner:'A1', elementary:'A2', intermediate:'B1', upperintermediate:'B2', advanced:'C1-C2' };
    const r = await callAI(`Suggest ${cnt} YouTube German learning videos for level: ${levelMap[curLevel]||curLevel}, weak skill: ${weakSk}. Respond ONLY as JSON array: [{"title":"Video Titel","channel":"Kanal","skill":"skill","query":"youtube search query","emoji":"🎯","description":"2 sentence Uzbek description"}]. Use channels: DW Deutsch lernen, Deutsch mit Marija, Learn German with Anja, Nicos Weg, Easy German.`, 800);
    try {
        const clean = r.replace(/```json|```/g,'').trim();
        const vids  = JSON.parse(clean);
        if (grid) grid.innerHTML = vids.map(v => `<div class="video-card" onclick="window.open('https://www.youtube.com/results?search_query=${encodeURIComponent(v.query)}','_blank')">
      <div class="video-thumb">${v.emoji}</div>
      <div class="video-info">
        <div class="video-title">${v.title}</div>
        <div class="video-channel">▶ ${v.channel}</div>
        <div class="video-desc">${v.description}</div>
        <div class="video-tags"><span>${v.skill}</span><span>${levelMap[curLevel]||curLevel}</span></div>
      </div>
    </div>`).join('');
    } catch(e) { if (grid) grid.innerHTML = '<div class="video-placeholder"><p>❌ Videolar topilmadi. Qayta urining.</p></div>'; }
};

// ════════════════════════════════════════
// AI CHAT
// ════════════════════════════════════════

async function loadAndRenderChatHistory() {
    const msgs = document.getElementById('chatMessages'); if (!msgs) return;
    msgs.innerHTML = '<div class="chat-msg ai-msg"><div class="chat-avatar">🤖</div><div class="chat-bubble typing"><span></span><span></span><span></span></div></div>';
    try {
        const history = await loadChatHistory(20);
        msgs.innerHTML = '';
        if (history.length === 0) {
            addChatMsg('ai', "Hallo! Ich bin dein Deutschlehrer! 🇩🇪\n\nHozir <strong>Freies Gespräch</strong> rejimidamiz.\nGrammatik, tarjima yoki erkin nemischa — hammasi mumkin! 😊");
        } else {
            history.forEach(m => addChatMsgRaw(m.role, m.text));
            chatHist = history.slice(-10).map(m => ({ role: m.role === 'ai' ? 'model' : 'user', parts: [{ text: m.text }] }));
            addChatMsg('ai', `✅ Oldingi suhbatingiz yuklandi (${history.length} xabar). Weitermachen?`);
        }
    } catch(e) {
        msgs.innerHTML = '';
        addChatMsg('ai', "Hallo! Ich bin dein Deutschlehrer! 🇩🇪\nWorüber möchten wir heute sprechen? 😊");
    }
}

window._setChatMode = function (mode, el) {
    chatMode = mode;
    document.querySelectorAll('.chat-mode-btn').forEach(b => b.classList.remove('active'));
    el.classList.add('active');
    const msgs = {
        free:     "Hallo! Freies Gespräch — nemischa yoki o'zbekcha yozing! 😊",
        teacher:  "Ich bin Ihr Deutschlehrer! Was möchten Sie heute lernen? 👨‍🏫",
        grammar:  "Grammatik-Modus! Jumla yozing — xatoliklarni tuzataman. ✏️",
        translate:"Übersetzungsmodus. O'zbekcha ↔ Nemischa. 🌐",
        goethe:   "Goethe-Zertifikat tayyorlik! A1 dan C2 gacha — hammasi bo'yicha yordam beraman. 📋"
    };
    const text = msgs[mode] || 'Hallo!';
    addChatMsg('ai', text);
    saveChatMessage('ai', text, mode);
};

window._handleChatKey = function (e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); window._sendChatMessage(); } };

window._sendChatMessage = async function () {
    if (!canAI()) { showUpgradeModal('AI chat limiti tugadi!'); return; }
    const inp  = document.getElementById('chatInput');
    const text = inp?.value.trim(); if (!text) return;
    inp.value = '';
    addChatMsg('user', text);
    await saveChatMessage('user', text, chatMode);
    const tid = addTyping(); UL.ai_used_today++; saveLimits(); renderLimitBar();
    chatHist.push({ role: 'user', parts: [{ text }] });
    const sysPs = {
        free:     `Du bist ein freundlicher Deutschlehrer für usbekische Lernende. Benutze Usbekisch für Erklärungen, Deutsch für Beispiele. Aktuelles Niveau: ${curLevel}. Sei ermutigend und praktisch.`,
        teacher:  `Du bist ein Deutschlehrer für usbekische Schüler. Lehre systematisch mit Beispielen, Regeln und Übungen. Niveau: ${curLevel}.`,
        grammar:  `Du bist ein Grammatikexperte. Wenn du deutschen Text bekommst, erkläre ALLE Fehler auf Usbekisch, korrigiere sie und gib die Regel an.`,
        translate:`Du bist ein Übersetzer. Übersetze zwischen Usbekisch und Deutsch. Erkläre auch Nuancen, Kollokationen und kulturelle Besonderheiten.`,
        goethe:   `Du bist ein Goethe-Institut Prüfer und Coach. Hilf bei allen 4 Fertigkeiten. Bewerte schriftliche Arbeiten nach offiziellen Goethe-Deskriptoren.`
    };
    try {
        const res = await callAIChat(chatHist, (sysPs[chatMode] || sysPs.free) + '\nUser message: ' + text);
        rmTyping(tid);
        addChatMsg('ai', res);
        await saveChatMessage('ai', res, chatMode);
        chatHist.push({ role: 'model', parts: [{ text: res }] });
        if (chatHist.length > 20) chatHist = chatHist.slice(-20);
    } catch(e) { rmTyping(tid); addChatMsg('ai', '❗ Xatolik yuz berdi. Qayta urining.'); }
};

window._insertQuickPhrase = function (p) { const i = document.getElementById('chatInput'); if (i) { i.value = p; i.focus(); } };

window._startVoiceChat = function () {
    const btn = document.getElementById('voiceChatBtn');
    if (UP === 'free' || UP === 'own') { showToast('🎤 Ovozli chat Team va Universal rejasida!', 'error'); return; }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { showToast('Mikrofon bu brauzerda ishlamaydi', 'error'); return; }
    if (!vcRec) {
        const rec = new SR(); rec.lang = 'de-DE'; rec.interimResults = false;
        rec.onresult = e => { const t = e.results[0][0].transcript; const i = document.getElementById('chatInput'); if (i) i.value = t; window._sendChatMessage(); };
        rec.onerror  = () => { vcRec = false; btn?.classList.remove('active'); };
        rec.onend    = () => { vcRec = false; btn?.classList.remove('active'); };
        try { rec.start(); vcRec = true; btn?.classList.add('active'); showToast('🎤 Sprechen Sie...', 'info'); }
        catch(e) { showToast('Mikrofon ishlamadi', 'error'); }
    } else { vcRec = false; btn?.classList.remove('active'); }
};

window.clearChatHistory = async function () {
    if (!CU) return;
    if (!confirm("Suhbat tarixini o'chirmoqchimisiz?")) return;
    try {
        const chatRef = collection(db, 'users_de', CU.uid, 'chatHistory');
        const q       = query(chatRef, orderBy('createdAt'));
        const snap    = await getDocs(q);
        const dels    = snap.docs.map(d => deleteDoc(doc(db, 'users_de', CU.uid, 'chatHistory', d.id)));
        await Promise.all(dels);
        chatHist = [];
        const msgs = document.getElementById('chatMessages');
        if (msgs) msgs.innerHTML = '';
        addChatMsg('ai', "Suhbat tarixi tozalandi! Neues Gespräch starten! 😊");
        showToast("✅ Suhbat tarixi o'chirildi", 'success');
    } catch(e) { showToast('❌ Xatolik yuz berdi', 'error'); }
};

function addChatMsg(role, text) {
    const msgs = document.getElementById('chatMessages'); if (!msgs) return;
    const div  = document.createElement('div'); div.className = `chat-msg ${role}-msg`;
    const init = (CU?.displayName || CU?.email || 'U').charAt(0).toUpperCase();
    div.innerHTML = `<div class="chat-avatar">${role === 'ai' ? '🤖' : init}</div><div class="chat-bubble">${text.replace(/\n/g,'<br>').replace(/\*\*(.*?)\*\*/g,'<strong>$1</strong>')}</div>`;
    msgs.appendChild(div); msgs.scrollTop = msgs.scrollHeight;
}

function addChatMsgRaw(role, text) {
    const msgs = document.getElementById('chatMessages'); if (!msgs) return;
    const div  = document.createElement('div'); div.className = `chat-msg ${role}-msg`;
    const init = (CU?.displayName || CU?.email || 'U').charAt(0).toUpperCase();
    div.innerHTML = `<div class="chat-avatar">${role === 'ai' ? '🤖' : init}</div><div class="chat-bubble">${text.replace(/\n/g,'<br>').replace(/\*\*(.*?)\*\*/g,'<strong>$1</strong>')}</div>`;
    msgs.appendChild(div); msgs.scrollTop = msgs.scrollHeight;
}

function addTyping() {
    const msgs = document.getElementById('chatMessages'); if (!msgs) return '';
    const id   = 'typ' + Date.now();
    const div  = document.createElement('div'); div.className = 'chat-msg ai-msg'; div.id = id;
    div.innerHTML = '<div class="chat-avatar">🤖</div><div class="chat-bubble typing"><span></span><span></span><span></span></div>';
    msgs.appendChild(div); msgs.scrollTop = msgs.scrollHeight; return id;
}

function rmTyping(id) { document.getElementById(id)?.remove(); }

// ── RADAR ──
function drawRadar() {
    const canvas = document.getElementById('radarCanvas'); if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const cx = 110, cy = 110, r = 85;
    const skills = ['lesen','schreiben','sprechen','hoeren','grammatik'];
    const vals   = skills.map(s => (USk[s] || 0) / 100);
    const angs   = skills.map((_,i) => (i * 2 * Math.PI / 5) - Math.PI / 2);
    ctx.clearRect(0, 0, 220, 220);
    [.2,.4,.6,.8,1].forEach(p => {
        ctx.beginPath();
        angs.forEach((a,i) => { const x = cx + r*p*Math.cos(a), y = cy + r*p*Math.sin(a); i === 0 ? ctx.moveTo(x,y) : ctx.lineTo(x,y); });
        ctx.closePath(); ctx.strokeStyle = 'rgba(255,255,255,0.07)'; ctx.lineWidth = 1; ctx.stroke();
    });
    angs.forEach(a => { ctx.beginPath(); ctx.moveTo(cx,cy); ctx.lineTo(cx + r*Math.cos(a), cy + r*Math.sin(a)); ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.stroke(); });
    ctx.beginPath();
    angs.forEach((a,i) => { const x = cx + r*vals[i]*Math.cos(a), y = cy + r*vals[i]*Math.sin(a); i === 0 ? ctx.moveTo(x,y) : ctx.lineTo(x,y); });
    ctx.closePath();
    // German colors: red/gold gradient
    ctx.fillStyle   = 'rgba(230,57,70,0.2)'; ctx.fill();
    ctx.strokeStyle = '#e63946'; ctx.lineWidth = 2; ctx.stroke();
    angs.forEach((a,i) => {
        const x = cx + r*vals[i]*Math.cos(a), y = cy + r*vals[i]*Math.sin(a);
        ctx.beginPath(); ctx.arc(x,y,4,0,Math.PI*2); ctx.fillStyle = '#e63946'; ctx.fill();
    });
}

// ── XP ──
async function awardXP(amt, skill) {
    const b   = plan().xb || 1; const tot = Math.round(amt * b); if (!CU) return;
    try {
        USk[skill] = Math.min(100, (USk[skill] || 0) + 2);
        await updateDoc(doc(db, 'users_de', CU.uid), {
            xp: increment(tot),
            [`skills.${skill}`]: USk[skill],
            lastActive: serverTimestamp()
        });
        drawRadar(); showXPPop(`+${tot} XP`);
    } catch(e) {}
}

// ── UTILS ──
window.spk = function (word, e) {
    if (e) e.stopPropagation();
    const u = new SpeechSynthesisUtterance(word);
    u.lang = 'de-DE'; u.rate = 0.85;
    speechSynthesis.speak(u);
};
window.speakWord = window.spk;

window.showToast = function (msg, type = 'info') {
    const t = document.getElementById('toast'); if (!t) return;
    t.innerHTML = msg; t.className = `toast ${type} show`;
    setTimeout(() => t.classList.remove('show'), 3000);
};

function showXPPop(txt) {
    const e = document.getElementById('xpPopup'); if (!e) return;
    e.textContent = txt; e.classList.add('show');
    setTimeout(() => e.classList.remove('show'), 2500);
}

window.showUpgradeModal = function (txt) {
    const el = document.getElementById('upgradeModalText'); if (el) el.textContent = txt;
    const rt = UP !== 'universal' ? new Date((UL.last_reset || Date.now()) + (plan().rh || 4) * 3600000) : null;
    const te = document.getElementById('upgradeTimer');
    if (rt && te) {
        if (upTimer) clearInterval(upTimer);
        upTimer = setInterval(() => {
            const d = Math.max(0, rt.getTime() - Date.now());
            const h = Math.floor(d/3600000), m = Math.floor((d%3600000)/60000), s = Math.floor((d%60000)/1000);
            te.textContent = `⏱ ${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
            if (d === 0) clearInterval(upTimer);
        }, 1000);
    }
    document.getElementById('upgradeModal')?.classList.add('open');
};

window.closeUpgradeModal = function (e) {
    if (e && e.target !== document.getElementById('upgradeModal')) return;
    if (upTimer) clearInterval(upTimer);
    document.getElementById('upgradeModal')?.classList.remove('open');
};

window.closeModal       = function () { document.getElementById('unitModal')?.classList.remove('open'); };
window.closeUnitModal   = function (e) { if (e.target.id === 'unitModal') closeModal(); };

function initWritingCounter() {
    const ta = document.getElementById('writingTextarea'); if (!ta) return;
    ta.addEventListener('input', () => {
        const t  = ta.value.trim(); const w = t ? t.split(/\s+/).length : 0;
        const wc = document.getElementById('wordCount'); const cc = document.getElementById('charCount');
        if (wc) wc.textContent = w + " so'z";
        if (cc) cc.textContent = ta.value.length + ' belgi';
    });
}

export { callAI as callGemini, callAIChat as callGeminiChat };