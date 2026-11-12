'use strict';
// Hamkorlik markazi — bazadagi amallar (API, kunlik cron va to'lov tasdig'i chaqiradi).
const fsdb = require('./_firestore.js');
const keys = require('./_keys.js');
const P = require('./_partner-program.js');

const SITE = () => (process.env.URL || 'https://linguaverse.akromovbehruz7.workers.dev').replace(/\/$/, '');
const err = (status, message) => Object.assign(new Error(message), { status });
const now = () => Date.now();
const dup = e => e && (e.code === '23505' || /duplicate key|23505/i.test(e.message || ''));

async function config() {
  return P.settings(await fsdb.getDoc('partnerConfig/program').catch(() => null));
}
const account = uid => fsdb.getDoc(`partnerAccounts/${uid}`);

async function audit(actor, action, target, detail = {}) {
  await fsdb.addDoc('partnerAudit', { at: new Date(), atMs: now(), actor, action, target, detail }).catch(e => console.warn('partner.audit', e.message));
}
async function history(uid, event, by = 'tizim', note = '') {
  await fsdb.transact(`partnerAccounts/${uid}`, cur => cur ? { history: [{ at: new Date(), event, by, note: P.clean(note, 200) }, ...(cur.history || [])].slice(0, 40), updatedAt: new Date(), updatedMs: now() } : null);
}
async function bumpStats(uid, inc) {
  const day = P.dayKey();
  await fsdb.transact(`partnerStats/${uid}_${day}`, cur => {
    const out = { uid, day, updatedAt: new Date() };
    for (const [k, v] of Object.entries(inc)) out[k] = (Number(cur?.[k]) || 0) + v;
    return out;
  });
  await fsdb.transact(`partnerAccounts/${uid}`, cur => {
    if (!cur) return null;
    const totals = { ...(cur.totals || {}) };
    for (const [k, v] of Object.entries(inc)) totals[k] = (Number(totals[k]) || 0) + v;
    return { totals };
  });
}

async function resolveCode(code) {
  const c = P.validCode(code);
  if (!c) return null;
  const map = await fsdb.getDoc(`partnerCodes/${c}`);
  if (!map?.uid) return null;
  const acc = await account(map.uid);
  return acc && acc.status === 'active' ? acc : null;
}

/** Yangi kod band qiladi (noyob). */
async function claimCode(uid, wanted) {
  for (let i = 0; i < 6; i++) {
    const code = i === 0 && P.codeAllowed(wanted) ? P.validCode(wanted) : P.suggestCode(wanted);
    try { await fsdb.addDoc('partnerCodes', { uid, createdAt: new Date() }, code); return code; }
    catch (e) { if (!dup(e)) throw e; if (i === 0 && P.codeAllowed(wanted)) throw err(409, 'Bu kod band. Boshqasini tanlang.'); }
  }
  throw err(500, 'Kod yaratilmadi, qayta urinib ko‘ring');
}

// ── ARIZA ────────────────────────────────────────────────────────────────
async function apply(user, body, ip) {
  const cfg = await config();
  if (cfg.paused) throw err(503, "Hamkorlik dasturi vaqtincha yangi arizalarni qabul qilmayapti");
  const app = P.validateApplication(body);
  const cur = await account(user.uid);
  if (cur && ['active', 'review', 'pending', 'needs-info'].includes(cur.status)) throw err(409, 'Sizda allaqachon hamkorlik arizasi bor — holatini kabinetda ko‘ring');
  // Rad etilgan hamkor qayta ariza bersa — avtomatik emas, admin ko'rigi orqali
  const wasRejected = cur?.status === 'rejected';
  if (cur?.status === 'suspended') throw err(403, "Hisobingiz to'xtatilgan. Qo'llab-quvvatlash bilan bog'laning.");
  const T = P.TYPES[app.type];
  const code = cur?.code || await claimCode(user.uid, body.code || app.name);
  let status = 'review';
  if (T.auto && !wasRejected && (app.type !== 'teacher' || cfg.autoApproveTeachers)) status = 'active';
  else if (!wasRejected && (T.verify === 'social' || T.verify === 'dns')) status = 'pending';
  const h = P.ipHash(ip);
  const doc = {
    uid: user.uid, email: user.email || '', type: app.type, name: app.name, contact: app.contact, about: app.about, city: app.city,
    code, status, termsVersion: P.TERMS_VERSION, ipHashes: h ? [h] : [],
    social: app.social || null, brand: app.brand ? { ...app.brand, dnsToken: require('node:crypto').randomBytes(12).toString('hex'), dnsVerified: false, published: false } : null,
    org: app.org || null, totals: cur?.totals || {}, rateOverride: cur?.rateOverride ?? null,
    createdAt: cur?.createdAt || new Date(), createdMs: cur?.createdMs || now(), updatedAt: new Date(), updatedMs: now(),
    approvedAt: status === 'active' ? new Date() : null,
    history: [{ at: new Date(), event: status === 'active' ? 'avtomatik faollashdi' : 'ariza yuborildi', by: 'tizim' }, ...(cur?.history || [])].slice(0, 40)
  };
  await fsdb.setDoc(`partnerAccounts/${user.uid}`, doc);
  await audit('tizim', 'apply', user.uid, { type: app.type, status });
  // Kontent yaratuvchi: darhol avtomatik tekshirib ko'ramiz (kod tavsifda bo'lsa — shu zahoti faol)
  if (app.type === 'creator') return { ...(await verifySocial(user.uid).catch(e => ({ ok: false, message: e.message }))), code };
  return { ok: true, status, code };
}

// ── KONTENT YARATUVCHINI AVTOMATIK TEKSHIRISH ───────────────────────────────
async function youtubeChannel(handle) {
  await keys.refreshFromFirestore().catch(() => {});
  const key = keys.get('YOUTUBE_API_KEY');
  if (!key) return null;
  const u = new URL('https://www.googleapis.com/youtube/v3/channels');
  u.searchParams.set('part', 'snippet,statistics,contentDetails');
  u.searchParams.set(handle.startsWith('@') ? 'forHandle' : 'id', handle);
  u.searchParams.set('key', key);
  const r = await fetch(u, { signal: AbortSignal.timeout(12000) });
  if (!r.ok) throw new Error('YouTube API: ' + r.status);
  const ch = (await r.json()).items?.[0];
  if (!ch) return { found: false };
  return { found: true, id: ch.id, title: ch.snippet?.title || '', text: ch.snippet?.description || '', followers: ch.statistics?.hiddenSubscriberCount ? null : Number(ch.statistics?.subscriberCount || 0), uploads: ch.contentDetails?.relatedPlaylists?.uploads || null };
}
async function telegramChannel(handle) {
  await keys.refreshFromFirestore().catch(() => {});
  const token = keys.get('TELEGRAM_BOT_TOKEN');
  if (!token) return null;
  const api = m => fetch(`https://api.telegram.org/bot${token}/${m}?chat_id=${encodeURIComponent('@' + handle)}`, { signal: AbortSignal.timeout(10000) }).then(r => r.json());
  const chat = await api('getChat');
  if (!chat.ok) return { found: false };
  const count = await api('getChatMemberCount');
  return { found: true, id: String(chat.result.id), title: chat.result.title || '', text: chat.result.description || '', followers: count.ok ? Number(count.result) : null };
}
async function verifySocial(uid) {
  const acc = await account(uid);
  if (!acc || acc.type !== 'creator' || !acc.social) throw err(400, 'Kontent yaratuvchi arizasi topilmadi');
  if (acc.status === 'active') return { ok: true, status: 'active', code: acc.code };
  if (!['pending', 'needs-info'].includes(acc.status)) return { ok: false, status: acc.status, message: 'Ariza admin ko‘rigida' };
  const plat = P.PLATFORMS[acc.social.platform];
  let info = null;
  try {
    if (acc.social.platform === 'youtube') info = await youtubeChannel(acc.social.handle);
    if (acc.social.platform === 'telegram') info = await telegramChannel(acc.social.handle);
  } catch (e) { console.warn('partner.verify', e.message); info = null; }
  if (!plat.auto || info === null) {
    // API yo'q (Instagram/TikTok yoki kalit sozlanmagan) — admin qo'lda tekshiradi
    await fsdb.setDoc(`partnerAccounts/${uid}`, { status: 'review', reviewReason: `${plat.label}: avtomatik tekshirib bo'lmaydi — profil tavsifida ${acc.code} kodi borligini va obunachilar sonini tekshiring`, updatedAt: new Date(), updatedMs: now() });
    await history(uid, 'admin ko‘rigiga yuborildi');
    return { ok: true, status: 'review', message: "Arizangiz admin ko'rigiga yuborildi (odatda 24 soat ichida)." };
  }
  if (!info.found) return { ok: false, status: 'pending', message: `${plat.label} sahifasi topilmadi. Havolani tekshiring.` };
  const owns = new RegExp(`\\b${acc.code}\\b`, 'i').test(info.text || '');
  const patch = { social: { ...acc.social, channelId: info.id, title: P.clean(info.title, 100), followers: info.followers, checkedAt: new Date(), uploads: info.uploads || null }, updatedAt: new Date(), updatedMs: now() };
  if (!owns) {
    await fsdb.setDoc(`partnerAccounts/${uid}`, patch);
    return { ok: false, status: 'pending', message: `Kanal egasi ekaningizni tasdiqlash uchun kanal tavsifiga (description/bio) ${acc.code} kodini qo'shing va qayta tekshiring. Tasdiqlangach kodni olib tashlashingiz mumkin.` };
  }
  if (info.followers == null || info.followers < plat.min) {
    await fsdb.setDoc(`partnerAccounts/${uid}`, { ...patch, status: 'review', reviewReason: `Obunachilar: ${info.followers ?? 'yashirin'} (talab ${plat.min}). Admin qaror qiladi.` });
    await history(uid, 'obunachi kam — admin ko‘rigiga');
    return { ok: true, status: 'review', message: `Obunachilar soni ${plat.min} dan kam yoki yashirin — arizangiz admin ko'rigiga yuborildi.` };
  }
  await activate(uid, 'tizim', 'kanal API orqali tasdiqlandi', { ...patch, social: { ...patch.social, verifiedAt: new Date(), method: 'api' } });
  return { ok: true, status: 'active', message: '✅ Kanal tasdiqlandi! Hamkorlik va bepul YOUTUBER rejasi faollashdi.', code: acc.code };
}

async function verifyDomain(uid) {
  const acc = await account(uid);
  if (!acc?.brand?.domain) throw err(400, 'Brend arizasi topilmadi');
  if (acc.brand.dnsVerified) return { ok: true, status: acc.status };
  const u = new URL('https://cloudflare-dns.com/dns-query');
  u.searchParams.set('name', `_linguaverse.${acc.brand.domain}`);
  u.searchParams.set('type', 'TXT');
  const r = await fetch(u, { headers: { Accept: 'application/dns-json' }, signal: AbortSignal.timeout(10000) }).then(x => x.json()).catch(() => ({}));
  const ok = (r.Answer || []).some(a => a.type === 16 && String(a.data || '').includes(`lv-partner=${acc.brand.dnsToken}`));
  if (!ok) return { ok: false, status: acc.status, message: 'DNS yozuvi hali topilmadi. Yozuv tarqalishi 5–60 daqiqa olishi mumkin.' };
  await fsdb.setDoc(`partnerAccounts/${uid}`, { brand: { ...acc.brand, dnsVerified: true, dnsVerifiedAt: new Date() }, status: acc.status === 'pending' ? 'review' : acc.status, reviewReason: 'Domen DNS orqali tasdiqlandi — brend va sahifani tekshiring', updatedAt: new Date(), updatedMs: now() });
  await history(uid, 'domen tasdiqlandi');
  return { ok: true, status: 'review', message: '✅ Domen tasdiqlandi. Brend sahifasi admin ko‘rigidan so‘ng e’lon qilinadi.' };
}

async function activate(uid, by, note, extra = {}) {
  const acc = await account(uid);
  if (!acc) throw err(404, 'Hamkor topilmadi');
  const patch = { ...extra, status: 'active', approvedAt: new Date(), reviewReason: null, updatedAt: new Date(), updatedMs: now() };
  if (acc.type === 'creator') patch.creator = { status: 'active', since: new Date(), activeUntil: new Date(now() + 33 * P.DAY), renewAt: new Date(now() + 30 * P.DAY) };
  if (acc.type === 'brand' && acc.brand) patch.brand = { ...acc.brand, ...(extra.brand || {}), published: true, slug: acc.brand.slug || (acc.code || '').toLowerCase() };
  await fsdb.setDoc(`partnerAccounts/${uid}`, patch);
  await history(uid, 'faollashdi', by, note);
  await audit(by, 'activate', uid, { note });
  await fsdb.addDoc(`users/${uid}/events`, { event: 'partner_approved', at: new Date() }).catch(() => {});
}

// ── KLIK VA RO'YXATDAN O'TISH ─────────────────────────────────────────────
async function recordClick(code, ip) {
  const acc = await resolveCode(code);
  const h = P.ipHash(ip);
  if (!acc || !h) return { ok: !!acc };
  try { await fsdb.addDoc('partnerClicks', { code: acc.code, uid: acc.uid, atMs: now() }, `${acc.code}_${P.dayKey()}_${h.slice(0, 12)}`); }
  catch (e) { if (!dup(e)) throw e; return { ok: true, unique: false }; }   // shu IP bugun allaqachon hisoblangan
  await bumpStats(acc.uid, { clicks: 1 });
  return { ok: true, unique: true, name: acc.type === 'brand' && acc.brand?.published ? acc.name : null };
}

async function attach(user, code, ip) {
  if (!user || user.anonymous) throw err(403, 'Hisobga kiring');
  const cfg = await config();
  const acc = await resolveCode(code);
  if (!acc) return { ok: false, message: 'Hamkor kodi topilmadi yoki faol emas' };
  if (acc.uid === user.uid) return { ok: false, message: "O'z kodingizni ishlata olmaysiz" };
  const existing = await fsdb.getDoc(`partnerAttribution/${user.uid}`);
  if (existing) return { ok: true, already: true };
  const created = P.toTime(user.createdAt);
  if (created && now() - created > cfg.attachWindowDays * P.DAY) return { ok: false, message: `Hamkor kodi faqat ro'yxatdan o'tgandan keyingi ${cfg.attachWindowDays} kun ichida ulanadi` };
  const paid = await fsdb.queryList('orders', [{ field: 'uid', op: 'EQUAL', value: user.uid }, { field: 'status', op: 'EQUAL', value: 'paid' }], null, 1).catch(() => []);
  if (paid.length) return { ok: false, message: "Kod faqat yangi foydalanuvchilar uchun (siz allaqachon to'lov qilgansiz)" };
  const exp = new Date(now() + cfg.attributionMonths * 30 * P.DAY);
  try {
    await fsdb.addDoc('partnerAttribution', { uid: user.uid, partnerUid: acc.uid, code: acc.code, at: new Date(), atMs: now(), ipHash: P.ipHash(ip), expiresAt: exp, name: P.clean(user.name, 60) }, user.uid);
  } catch (e) { if (!dup(e)) throw e; return { ok: true, already: true }; }
  await bumpStats(acc.uid, { signups: 1 });
  return { ok: true, partner: acc.type === 'brand' && acc.brand?.published ? acc.name : null };
}

// ── TO'LOV → KOMISSIYA ────────────────────────────────────────────────────
async function partnerSales(partnerUid, limit = 500) {
  return fsdb.queryList('partnerCommissions', [{ field: 'partnerUid', op: 'EQUAL', value: partnerUid }], 'createdMs', limit).catch(() => []);
}
const countable = c => !['rejected', 'reversed'].includes(c.status);
async function sales90(partnerUid) {
  const since = now() - 90 * P.DAY;
  return (await partnerSales(partnerUid)).filter(c => countable(c) && (c.createdMs || 0) >= since).length;
}

/**
 * payment.js to'lovni tasdiqlaganda chaqiradi. true — bu foydalanuvchi hamkorlik
 * tizimiga tegishli (eski referal mukofoti berilmaydi), false — tegishli emas.
 */
async function recordSale({ uid, orderId, amount, kind }) {
  if (!(Number(amount) > 0) || !orderId) return false;          // faqat haqiqiy to'lovdan
  const attr = await fsdb.getDoc(`partnerAttribution/${uid}`);
  if (!attr) return false;
  const [acc, cfg] = await Promise.all([account(attr.partnerUid), config()]);
  const previous = (await fsdb.queryList('partnerCommissions', [{ field: 'buyerUid', op: 'EQUAL', value: uid }], null, 50).catch(() => [])).filter(countable).length;
  if (!P.commissionAllowed({ account: acc, attribution: attr, previousSales: previous })) return true;
  const s90 = await sales90(acc.uid);
  const rate = P.rateFor(acc, s90);
  const commission = P.roundSum(amount * rate);
  if (commission <= 0) return true;
  const stat = await fsdb.getDoc(`partnerStats/${acc.uid}_${P.dayKey(P.toTime(attr.at) || now())}`).catch(() => null);
  const risk = P.riskScore({ account: acc, attribution: attr, buyerUid: uid, signupsThatDay: stat?.signups || 0, dailySignupFlag: cfg.dailySignupFlag });
  try {
    await fsdb.addDoc('partnerCommissions', {
      orderId, partnerUid: acc.uid, code: acc.code, partnerName: acc.name, type: acc.type, buyerUid: uid, buyerName: P.maskName(attr.name),
      kind: kind || 'plan', amount, rate, commission, tier: P.tierFor(s90).id, risk: risk.score, flags: risk.flags,
      status: 'hold', createdAt: new Date(), createdMs: now(), releaseMs: now() + cfg.holdDays * P.DAY, releaseAt: new Date(now() + cfg.holdDays * P.DAY)
    }, orderId);
  } catch (e) { if (!dup(e)) throw e; return true; }   // bu buyurtma uchun allaqachon yozilgan (idempotent)
  await bumpStats(acc.uid, { sales: 1, revenue: amount, commission });
  return true;
}

/** Eski "do'st taklif" mukofoti: ham shu tizimda ushlab turiladi (darhol balansga emas). */
async function holdLegacyReferral({ inviterUid, buyerUid, orderId, amount, reward }) {
  const cfg = await config();
  try {
    await fsdb.addDoc('partnerCommissions', {
      orderId, partnerUid: inviterUid, code: '', partnerName: 'Referal (eski havola)', type: 'referral-legacy', buyerUid, buyerName: 'Do‘st',
      kind: 'plan', amount, rate: amount ? +(reward / amount).toFixed(4) : 0, commission: reward, tier: 'start', risk: inviterUid === buyerUid ? 100 : 0, flags: [],
      status: 'hold', createdAt: new Date(), createdMs: now(), releaseMs: now() + cfg.holdDays * P.DAY, releaseAt: new Date(now() + cfg.holdDays * P.DAY)
    }, orderId);
  } catch (e) { if (!dup(e)) throw e; }
}

/** Komissiyani balansga o'tkazadi. from — kutilgan joriy holat (hold/review). */
async function credit(id, from, by = 'tizim', note = '') {
  let claimed = null;
  await fsdb.transact(`partnerCommissions/${id}`, c => {
    if (!c || c.status !== from) return null;
    claimed = c;
    return { status: 'credited', creditedAt: new Date(), decidedBy: by, note: P.clean(note, 200) };
  });
  if (!claimed) return false;
  try {
    await fsdb.transact(`users/${claimed.partnerUid}`, u => ({ balance: (Number(u?.balance) || 0) + claimed.commission, ...(claimed.type === 'referral-legacy' ? { referralEarnings: (Number(u?.referralEarnings) || 0) + claimed.commission } : {}) }));
  } catch (e) {
    await fsdb.setDoc(`partnerCommissions/${id}`, { status: from, error: e.message.slice(0, 200) });
    throw e;
  }
  await fsdb.transact(`partnerAccounts/${claimed.partnerUid}`, a => a ? { totals: { ...(a.totals || {}), earned: (Number(a.totals?.earned) || 0) + claimed.commission } } : null);
  await fsdb.addDoc(`users/${claimed.partnerUid}/events`, { event: 'partner_commission', orderId: id, amount: claimed.commission, at: new Date() }).catch(() => {});
  return true;
}

// ── KUNLIK AVTOMATIKA ─────────────────────────────────────────────────────
async function runCron() {
  const cfg = await config();
  const report = { credited: 0, review: 0, reversed: 0, perksRenewed: 0, perksPaused: 0, clicksCleaned: 0, errors: 0 };
  // 1) Ushlab turish muddati tugagan komissiyalar
  const hold = await fsdb.queryList('partnerCommissions', [{ field: 'status', op: 'EQUAL', value: 'hold' }], null, 1000).catch(() => []);
  for (const c of hold.filter(c => (c.releaseMs || 0) <= now())) {
    try {
      const order = await fsdb.getDoc(`orders/${c.orderId}`).catch(() => null);
      const d = P.releaseDecision(c, cfg, !order || order.status === 'paid');
      if (d.status === 'credited') { if (await credit(c.id, 'hold', 'tizim', 'avtomatik')) report.credited++; }
      else {
        await fsdb.transact(`partnerCommissions/${c.id}`, x => x && x.status === 'hold' ? { status: d.status, reviewReason: d.reason, decidedAt: new Date() } : null);
        report[d.status === 'review' ? 'review' : 'reversed']++;
      }
    } catch (e) { report.errors++; console.error('partner.cron.release', c.id, e.message); }
  }
  // 1b) Balansga o'tgandan keyin bekor qilingan/qaytarilgan to'lovlar — komissiya qaytarib olinadi
  report.clawedBack = 0;
  const credited = await fsdb.queryList('partnerCommissions', [{ field: 'status', op: 'EQUAL', value: 'credited' }], 'createdMs', 1000).catch(() => []);
  for (const c of credited.filter(c => (c.createdMs || 0) >= now() - 120 * P.DAY)) {
    try {
      const order = await fsdb.getDoc(`orders/${c.orderId}`).catch(() => null);
      if (!order || order.status === 'paid') continue;
      let took = false;
      await fsdb.transact(`partnerCommissions/${c.id}`, x => { if (!x || x.status !== 'credited') return null; took = true; return { status: 'reversed', reviewReason: "to'lov bekor qilingan — komissiya qaytarib olindi", reversedAt: new Date() }; });
      if (!took) continue;
      // Balans manfiy bo'lishi mumkin — keyingi komissiyalardan qoplanadi, pul yechib bo'lmaydi
      await fsdb.transact(`users/${c.partnerUid}`, u => ({ balance: (Number(u?.balance) || 0) - c.commission }));
      await fsdb.transact(`partnerAccounts/${c.partnerUid}`, a => a ? { totals: { ...(a.totals || {}), earned: (Number(a.totals?.earned) || 0) - c.commission } } : null);
      await audit('tizim', 'clawback', c.id, { partnerUid: c.partnerUid, commission: c.commission });
      report.clawedBack++;
    } catch (e) { report.errors++; console.error('partner.cron.clawback', c.id, e.message); }
  }
  // 2) Kontent yaratuvchilarning bepul YOUTUBER imtiyozi: har 30 kunda faollik tekshiruvi
  const creators = await fsdb.queryList('partnerAccounts', [{ field: 'type', op: 'EQUAL', value: 'creator' }], null, 1000).catch(() => []);
  for (const a of creators.filter(a => a.status === 'active' && a.creator && P.toTime(a.creator.renewAt) <= now())) {
    try {
      const since = now() - 30 * P.DAY;
      const stats = await fsdb.queryList('partnerStats', [{ field: 'uid', op: 'EQUAL', value: a.uid }], 'day', 31).catch(() => []);
      const signups = stats.filter(s => Number(s.day) >= Number(P.dayKey(since))).reduce((n, s) => n + (s.signups || 0), 0);
      const videos = signups >= cfg.creatorRenewSignups ? 0 : await recentMentions(a, since).catch(() => 0);
      const ok = signups >= cfg.creatorRenewSignups || videos > 0;
      const creator = ok
        ? { ...a.creator, status: 'active', activeUntil: new Date(now() + 33 * P.DAY), renewAt: new Date(now() + 30 * P.DAY), lastRenewal: { signups, videos, at: new Date() } }
        : { ...a.creator, status: 'paused', activeUntil: new Date(), pausedReason: `30 kunda ${signups} ta yangi foydalanuvchi va LinguaVerse haqida yangi video topilmadi`, renewAt: new Date(now() + 3 * P.DAY) };
      await fsdb.setDoc(`partnerAccounts/${a.uid}`, { creator, updatedAt: new Date(), updatedMs: now() });
      if (ok) report.perksRenewed++; else { report.perksPaused++; await history(a.uid, 'YOUTUBER imtiyozi pauza', 'tizim', creator.pausedReason); }
    } catch (e) { report.errors++; console.error('partner.cron.perk', a.uid, e.message); }
  }
  // 3) Eski klik yozuvlari (35 kundan oshgan)
  const old = await fsdb.queryList('partnerClicks', [{ field: 'atMs', op: 'LESS_THAN', value: now() - 35 * P.DAY }], null, 500).catch(() => []);
  for (const c of old) { await fsdb.deleteDoc(`partnerClicks/${c.id}`).catch(() => {}); report.clicksCleaned++; }
  await fsdb.setDoc('partnerConfig/lastCron', { at: new Date(), report });
  return { ok: true, ...report };
}
/** YouTube: oxirgi 30 kunda nomi/tavsifida LinguaVerse yoki hamkor kodi bor ommaviy video soni. */
async function recentMentions(a, since) {
  if (a.social?.platform !== 'youtube' || !a.social.uploads) return 0;
  await keys.refreshFromFirestore().catch(() => {});
  const key = keys.get('YOUTUBE_API_KEY');
  if (!key) return 0;
  const u = new URL('https://www.googleapis.com/youtube/v3/playlistItems');
  Object.entries({ part: 'snippet', playlistId: a.social.uploads, maxResults: 25, key }).forEach(([k, v]) => u.searchParams.set(k, v));
  const d = await fetch(u, { signal: AbortSignal.timeout(12000) }).then(r => r.json());
  const re = new RegExp(`lingua\\s?verse|\\b${a.code}\\b`, 'i');
  return (d.items || []).filter(v => Date.parse(v.snippet?.publishedAt || '') >= since && re.test(`${v.snippet?.title}\n${v.snippet?.description}`)).length;
}

module.exports = {
  SITE, err, config, account, audit, history, bumpStats, resolveCode, claimCode, apply, verifySocial, verifyDomain,
  activate, recordClick, attach, partnerSales, sales90, recordSale, holdLegacyReferral, credit, runCron
};
