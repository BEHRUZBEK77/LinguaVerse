'use strict';
// LinguaVerse Hamkorlik markazi — API.
//   Ochiq:  GET ?brand=slug | POST program, click
//   Hamkor: me, apply, attach, verify-social, verify-domain, update, change-code, bulk-request
//   Admin:  admin-overview, admin-list, admin-get, admin-decide, admin-commissions,
//           admin-commission-decide, admin-requests, admin-request-done, admin-settings, admin-run, admin-audit
const fsdb = require('./_firestore.js');
const { verifyIdToken } = require('./_auth.js');
const { checkRateLimit, clientIp } = require('./_ratelimit.js');
const P = require('./_partner-program.js');
const S = require('./_partner-service.js');

const CORS = { 'Access-Control-Allow-Origin': S.SITE(), 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS', 'Cache-Control': 'no-store' };
const json = (statusCode, data) => ({ statusCode, headers: { ...CORS, 'Content-Type': 'application/json; charset=utf-8' }, body: JSON.stringify(data) });
const ip = e => e.headers?.['cf-connecting-ip'] || clientIp(e);

function program(cfg) {
  return {
    termsVersion: P.TERMS_VERSION, paused: cfg.paused,
    types: Object.entries(P.TYPES).map(([id, t]) => ({ id, label: t.label, icon: t.icon, rate: t.rate, recurring: t.recurring, auto: !!t.auto && (id !== 'teacher' || cfg.autoApproveTeachers), review: !!t.review, verify: t.verify || null, pitch: t.pitch, roster: !!t.roster, bulk: !!t.bulk, perk: t.perk || null })),
    platforms: Object.entries(P.PLATFORMS).map(([id, p]) => ({ id, ...p })),
    tiers: P.TIERS, maxRate: P.MAX_RATE,
    holdDays: cfg.holdDays, attributionMonths: cfg.attributionMonths, attachWindowDays: cfg.attachWindowDays, minPayout: 20000
  };
}

// ── HAMKOR KABINETI ─────────────────────────────────────────────────────────
async function me(user) {
  const [acc, cfg] = await Promise.all([S.account(user.uid), S.config()]);
  const wallet = await fsdb.getDoc(`users/${user.uid}`).catch(() => null);
  if (!acc) return { partner: null, program: program(cfg), balance: wallet?.balance || 0 };
  const sales = await S.partnerSales(user.uid, 300);
  const since90 = Date.now() - 90 * P.DAY;
  const s90 = sales.filter(c => !['rejected', 'reversed'].includes(c.status) && (c.createdMs || 0) >= since90).length;
  const tier = P.tierFor(s90);
  const stats = (await fsdb.queryList('partnerStats', [{ field: 'uid', op: 'EQUAL', value: user.uid }], 'day', 60).catch(() => []))
    .map(s => ({ day: s.day, clicks: s.clicks || 0, signups: s.signups || 0, sales: s.sales || 0, revenue: s.revenue || 0, commission: s.commission || 0 }));
  const sum = st => sales.filter(c => c.status === st).reduce((n, c) => n + (c.commission || 0), 0);
  let roster = null;
  if (P.TYPES[acc.type]?.roster) {
    const rows = await fsdb.queryList('partnerAttribution', [{ field: 'partnerUid', op: 'EQUAL', value: user.uid }], 'atMs', 300).catch(() => []);
    const buyers = new Set(sales.filter(c => !['rejected', 'reversed'].includes(c.status)).map(c => c.buyerUid));
    roster = rows.map(r => ({ name: P.maskName(r.name), joined: r.at, paid: buyers.has(r.uid) }));
  }
  const requests = P.TYPES[acc.type]?.bulk ? await fsdb.queryList('partnerRequests', [{ field: 'uid', op: 'EQUAL', value: user.uid }], 'createdMs', 20).catch(() => []) : null;
  const pub = ({ uid, email, ipHashes, brand, ...rest }) => ({ ...rest, brand: brand ? { ...brand, dnsRecord: brand.dnsVerified ? null : { name: `_linguaverse.${brand.domain}`, type: 'TXT', value: `lv-partner=${brand.dnsToken}` }, dnsToken: undefined } : null });
  return {
    partner: pub(acc), program: program(cfg), balance: wallet?.balance || 0,
    link: `${S.SITE()}/?p=${acc.code}`, registerLink: `${S.SITE()}/auth/register.html?p=${acc.code}`,
    brandUrl: acc.brand?.published ? `${S.SITE()}/languages-html/partners.html?brand=${acc.brand.slug}` : null,
    tier, rate: P.rateFor(acc, s90), sales90: s90,
    earnings: { hold: sum('hold'), review: sum('review'), credited: sum('credited'), rejected: sum('rejected') + sum('reversed') },
    commissions: sales.slice(0, 60).map(c => ({ id: c.id, at: c.createdAt, buyer: c.buyerName, kind: c.kind, amount: c.amount, rate: c.rate, commission: c.commission, status: c.status, releaseAt: c.releaseAt, reason: c.status === 'review' ? 'admin tekshiruvida' : c.reviewReason || '' })),
    stats, roster, requests
  };
}

async function update(user, body) {
  const acc = await S.account(user.uid);
  if (!acc) throw S.err(404, 'Hamkorlik hisobi topilmadi');
  const patch = { updatedAt: new Date(), updatedMs: Date.now() };
  if (body.contact != null) patch.contact = P.clean(body.contact, 120);
  if (body.about != null) patch.about = P.clean(body.about, 600);
  if (acc.brand && (body.color || body.tagline != null)) {
    const color = /^#[0-9a-f]{6}$/i.test(body.color || '') ? body.color : acc.brand.color;
    const tagline = body.tagline != null ? P.clean(body.tagline, 120) : acc.brand.tagline;
    if (color !== acc.brand.color || tagline !== acc.brand.tagline) {
      // Ko'rinish o'zgardi — sahifa yana admin ko'rigidan o'tadi (boshqa brendga taqlid qilinmasin)
      patch.brand = { ...acc.brand, color, tagline, published: false };
      if (acc.status === 'active') patch.brandReview = true;
    }
  }
  if (acc.status === 'needs-info' && body.resubmit) { patch.status = acc.type === 'creator' && P.PLATFORMS[acc.social?.platform]?.auto ? 'pending' : 'review'; }
  await fsdb.setDoc(`partnerAccounts/${user.uid}`, patch);
  if (patch.status) await S.history(user.uid, 'ma’lumot yangilandi, qayta yuborildi', 'hamkor');
  return { ok: true };
}

async function changeCode(user, body) {
  const acc = await S.account(user.uid);
  if (!acc || acc.status !== 'active') throw S.err(403, 'Faqat faol hamkorlar kodini o‘zgartira oladi');
  if (!P.codeAllowed(body.code)) throw S.err(400, "Kod 4–16 ta lotin harf/raqam bo'lsin va rasmiy so'zlar bilan boshlanmasin");
  if (P.toTime(acc.codeChangedAt) > Date.now() - 30 * P.DAY) throw S.err(429, "Kodni 30 kunda bir marta o'zgartirish mumkin");
  const code = await S.claimCode(user.uid, body.code);
  // Eski kod ham shu hamkorga ishlashda davom etadi (tarqatilgan havolalar buzilmasin)
  await fsdb.setDoc(`partnerAccounts/${user.uid}`, { code, previousCodes: [...new Set([acc.code, ...(acc.previousCodes || [])])].slice(0, 10), codeChangedAt: new Date(), updatedAt: new Date(), updatedMs: Date.now() });
  await S.history(user.uid, `kod o'zgardi: ${acc.code} → ${code}`, 'hamkor');
  return { ok: true, code };
}

async function bulkRequest(user, body) {
  const acc = await S.account(user.uid);
  if (!acc || acc.status !== 'active' || !P.TYPES[acc.type]?.bulk) throw S.err(403, "Guruh litsenziyasi faqat faol o'quv markazi va korporativ hamkorlar uchun");
  const seats = Math.floor(Number(body.seats) || 0);
  if (seats < 5 || seats > 5000) throw S.err(400, "O'rinlar soni 5 dan 5000 gacha");
  const r = await fsdb.addDoc('partnerRequests', { uid: user.uid, partnerName: acc.name, code: acc.code, seats, product: P.clean(body.product, 60), note: P.clean(body.note, 500), contact: acc.contact, status: 'new', createdAt: new Date(), createdMs: Date.now() });
  await S.audit('hamkor', 'bulk-request', user.uid, { seats });
  return { ok: true, id: r.id };
}

// ── ADMIN ───────────────────────────────────────────────────────────────────
async function requireAdmin(uid) {
  if (!(await fsdb.getDoc(`admins/${uid}`).catch(() => null))) throw S.err(403, 'Faqat admin');
}
async function adminOverview() {
  const [accounts, review, hold, requests, cfg, last] = await Promise.all([
    fsdb.queryList('partnerAccounts', [], 'updatedMs', 1000).catch(() => []),
    fsdb.queryList('partnerCommissions', [{ field: 'status', op: 'EQUAL', value: 'review' }], 'createdMs', 300).catch(() => []),
    fsdb.queryList('partnerCommissions', [{ field: 'status', op: 'EQUAL', value: 'hold' }], 'createdMs', 1000).catch(() => []),
    fsdb.queryList('partnerRequests', [{ field: 'status', op: 'EQUAL', value: 'new' }], 'createdMs', 100).catch(() => []),
    S.config(), fsdb.getDoc('partnerConfig/lastCron').catch(() => null)
  ]);
  const by = st => accounts.filter(a => a.status === st).length;
  const byType = Object.fromEntries(Object.keys(P.TYPES).map(t => [t, accounts.filter(a => a.type === t && a.status === 'active').length]));
  const top = accounts.filter(a => a.status === 'active').sort((a, b) => (b.totals?.revenue || 0) - (a.totals?.revenue || 0)).slice(0, 10)
    .map(a => ({ uid: a.uid, name: a.name, type: a.type, code: a.code, ...a.totals }));
  return {
    counts: { active: by('active'), review: by('review') + accounts.filter(a => a.brandReview).length, pending: by('pending'), needsInfo: by('needs-info'), suspended: by('suspended'), total: accounts.length },
    byType, commissionsReview: review.length, commissionsReviewSum: review.reduce((n, c) => n + c.commission, 0),
    holdCount: hold.length, holdSum: hold.reduce((n, c) => n + c.commission, 0), newRequests: requests.length,
    totals: accounts.reduce((t, a) => { for (const k of ['clicks', 'signups', 'sales', 'revenue', 'earned']) t[k] = (t[k] || 0) + (a.totals?.[k] || 0); return t; }, {}),
    top, settings: cfg, defaults: P.DEFAULTS, lastCron: last
  };
}
const adminRow = a => ({ uid: a.uid, email: a.email, name: a.name, type: a.type, status: a.status, code: a.code, contact: a.contact, city: a.city, about: a.about,
  social: a.social, brand: a.brand ? { ...a.brand, dnsToken: undefined } : null, org: a.org, totals: a.totals || {}, rateOverride: a.rateOverride ?? null,
  reviewReason: a.reviewReason || '', brandReview: !!a.brandReview, creator: a.creator || null, createdAt: a.createdAt, updatedAt: a.updatedAt, history: (a.history || []).slice(0, 15), adminNote: a.adminNote || '' });
async function adminList(body) {
  const f = [];
  if (P.TYPES[body.type]) f.push({ field: 'type', op: 'EQUAL', value: body.type });
  if (['active', 'review', 'pending', 'needs-info', 'rejected', 'suspended'].includes(body.status)) f.push({ field: 'status', op: 'EQUAL', value: body.status });
  let rows = await fsdb.queryList('partnerAccounts', f, 'updatedMs', 500);
  if (body.status === 'review') rows = [...rows, ...(await fsdb.queryList('partnerAccounts', [{ field: 'brandReview', op: 'EQUAL', value: true }], 'updatedMs', 100))];
  const q = P.clean(body.q, 60).toLowerCase();
  if (q) rows = rows.filter(a => [a.name, a.email, a.code, a.contact, a.social?.handle].some(x => String(x || '').toLowerCase().includes(q)));
  return { rows: rows.map(adminRow) };
}
async function adminDecide(admin, body) {
  const uid = P.clean(body.uid, 80), d = P.clean(body.decision, 20), note = P.clean(body.note, 300);
  const acc = await S.account(uid);
  if (!acc) throw S.err(404, 'Hamkor topilmadi');
  const who = admin.email || admin.uid;
  if (d === 'approve' || d === 'reactivate') await S.activate(uid, who, note || 'admin tasdiqladi', { brandReview: false });
  else if (d === 'publish-brand') { await fsdb.setDoc(`partnerAccounts/${uid}`, { brand: { ...acc.brand, published: true }, brandReview: false }); await S.history(uid, 'brend sahifasi e’lon qilindi', who, note); }
  else if (['reject', 'suspend', 'needs-info'].includes(d)) {
    if (d !== 'needs-info' && !note) throw S.err(400, 'Sababini yozing — hamkor uni ko‘radi');
    const status = d === 'reject' ? 'rejected' : d === 'suspend' ? 'suspended' : 'needs-info';
    await fsdb.setDoc(`partnerAccounts/${uid}`, { status, reviewReason: note, brandReview: false, ...(acc.creator ? { creator: { ...acc.creator, status: 'paused', activeUntil: new Date() } } : {}), ...(acc.brand ? { brand: { ...acc.brand, published: false } } : {}), updatedAt: new Date(), updatedMs: Date.now() });
    await S.history(uid, { rejected: 'rad etildi', suspended: "to'xtatildi", 'needs-info': "qo'shimcha ma'lumot so'raldi" }[status], who, note);
  } else if (d === 'rate') {
    const r = body.rate === '' || body.rate == null ? null : Number(body.rate) / 100;
    if (r != null && !(r >= 0 && r <= P.MAX_RATE)) throw S.err(400, `Stavka 0–${P.MAX_RATE * 100}% oralig'ida`);
    await fsdb.setDoc(`partnerAccounts/${uid}`, { rateOverride: r, updatedAt: new Date(), updatedMs: Date.now() });
    await S.history(uid, r == null ? 'shaxsiy stavka olib tashlandi' : `shaxsiy stavka: ${Math.round(r * 100)}%`, who, note);
  } else if (d === 'note') await fsdb.setDoc(`partnerAccounts/${uid}`, { adminNote: note });
  else throw S.err(400, "Noma'lum qaror");
  await S.audit(who, 'decide:' + d, uid, { note });
  return { ok: true };
}
async function adminCommissions(body) {
  const st = ['hold', 'review', 'credited', 'rejected', 'reversed'].includes(body.status) ? body.status : 'review';
  const f = [{ field: 'status', op: 'EQUAL', value: st }];
  if (body.partnerUid) f.push({ field: 'partnerUid', op: 'EQUAL', value: P.clean(body.partnerUid, 80) });
  const rows = await fsdb.queryList('partnerCommissions', f, 'createdMs', 300);
  return { rows: rows.map(c => ({ id: c.id, at: c.createdAt, partnerUid: c.partnerUid, partnerName: c.partnerName, code: c.code, type: c.type, buyer: c.buyerName, kind: c.kind, amount: c.amount, rate: c.rate, commission: c.commission, risk: c.risk, flags: c.flags || [], status: c.status, releaseAt: c.releaseAt, reason: c.reviewReason || c.note || '' })) };
}
async function adminCommissionDecide(admin, body) {
  const id = P.clean(body.id, 80), who = admin.email || admin.uid, note = P.clean(body.note, 200);
  const c = await fsdb.getDoc(`partnerCommissions/${id}`);
  if (!c) throw S.err(404, 'Komissiya topilmadi');
  if (body.decision === 'approve') {
    if (!['review', 'hold'].includes(c.status)) throw S.err(409, 'Bu komissiya allaqachon hal qilingan');
    if (!(await S.credit(id, c.status, who, note || 'admin tasdiqladi'))) throw S.err(409, 'Holat o‘zgargan — sahifani yangilang');
  } else if (body.decision === 'reject') {
    if (!note) throw S.err(400, 'Rad etish sababini yozing');
    let ok = false;
    await fsdb.transact(`partnerCommissions/${id}`, x => { if (!x || !['review', 'hold'].includes(x.status)) return null; ok = true; return { status: 'rejected', decidedBy: who, note, decidedAt: new Date() }; });
    if (!ok) throw S.err(409, 'Bu komissiya allaqachon hal qilingan');
  } else throw S.err(400, "Noma'lum qaror");
  await S.audit(who, 'commission:' + body.decision, id, { partnerUid: c.partnerUid, commission: c.commission, note });
  return { ok: true };
}
async function adminSettings(admin, body) {
  if (body.set && typeof body.set === 'object') {
    const next = P.settings({ ...(await S.config()), ...body.set });
    await fsdb.setDoc('partnerConfig/program', { ...next, updatedAt: new Date(), updatedBy: admin.email || admin.uid });
    await S.audit(admin.email || admin.uid, 'settings', 'program', next);
  }
  return { settings: await S.config(), defaults: P.DEFAULTS };
}

// ── HANDLER ───────────────────────────────────────────────────────────────
exports.handler = async event => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' };
  const q = event.queryStringParameters || {};
  try {
    if (event.httpMethod === 'GET') {
      if (q.brand) {
        const slug = P.clean(q.brand, 40).toLowerCase();
        const rows = await fsdb.queryList('partnerAccounts', [{ field: 'type', op: 'EQUAL', value: 'brand' }], null, 500);
        const a = rows.find(x => x.status === 'active' && x.brand?.published && x.brand.slug === slug);
        return a ? json(200, { name: a.name, tagline: a.brand.tagline, color: a.brand.color, domain: a.brand.domain, code: a.code }) : json(404, { error: 'Topilmadi' });
      }
      return json(200, program(await S.config()));
    }
    if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });
    let body = {};
    try { body = JSON.parse(event.body || '{}'); } catch { return json(400, { error: "JSON noto'g'ri" }); }
    const action = String(body.action || '');
    if (action === 'program') return json(200, program(await S.config()));
    if (action === 'click') {
      const rl = await checkRateLimit(`pclick:${P.ipHash(ip(event)) || 'x'}`, { windowMs: 3600_000, max: 60 });
      if (!rl.ok) return json(429, { ok: false });
      return json(200, await S.recordClick(body.code, ip(event)));
    }
    const user = await verifyIdToken(body.idToken).catch(() => null);
    if (!user || user.anonymous) return json(401, { error: 'Avval hisobga kiring' });
    const rl = await checkRateLimit(`partners:${user.uid}`, { windowMs: 60_000, max: action.startsWith('admin-') ? 120 : 30 });
    if (!rl.ok) return json(429, { error: "Juda ko'p so'rov — bir daqiqadan so'ng urinib ko'ring" });
    switch (action) {
      case 'me':            return json(200, await me(user));
      case 'apply':         return json(200, await S.apply(user, body, ip(event)));
      case 'attach':        return json(200, await S.attach(user, body.code, ip(event)));
      case 'verify-social': return json(200, await S.verifySocial(user.uid));
      case 'verify-domain': return json(200, await S.verifyDomain(user.uid));
      case 'update':        return json(200, await update(user, body));
      case 'change-code':   return json(200, await changeCode(user, body));
      case 'bulk-request':  return json(200, await bulkRequest(user, body));
    }
    if (!action.startsWith('admin-')) return json(400, { error: "Noma'lum amal" });
    await requireAdmin(user.uid);
    switch (action) {
      case 'admin-overview':          return json(200, await adminOverview());
      case 'admin-list':              return json(200, await adminList(body));
      case 'admin-decide':            return json(200, await adminDecide(user, body));
      case 'admin-commissions':       return json(200, await adminCommissions(body));
      case 'admin-commission-decide': return json(200, await adminCommissionDecide(user, body));
      case 'admin-requests':          return json(200, { rows: await fsdb.queryList('partnerRequests', [], 'createdMs', 200) });
      case 'admin-request-done':      await fsdb.setDoc(`partnerRequests/${P.clean(body.id, 80)}`, { status: 'done', doneBy: user.email || user.uid, doneAt: new Date(), note: P.clean(body.note, 300) }); return json(200, { ok: true });
      case 'admin-settings':          return json(200, await adminSettings(user, body));
      case 'admin-run':               return json(200, await S.runCron());
      case 'admin-audit':             return json(200, { rows: await fsdb.queryList('partnerAudit', [], 'atMs', 150) });
    }
    return json(400, { error: "Noma'lum amal" });
  } catch (e) {
    if (!e.status) console.error('partners', e.message);
    return json(e.status || 500, { error: e.status ? e.message : "So'rov bajarilmadi, birozdan so'ng qayta urinib ko'ring" });
  }
};
exports._test = { program };
