// ═══════════════════════════════════════════════════════════════════════════
// payment.js — TO'LOV (inpay.uz)
//
// Uchta amal:
//   POST { action:'create', planId, idToken }  → to'lov havolasi
//   POST { action:'status', orderId }          → buyurtma holati
//   POST /webhook  (inpay.uz yuboradi)         → to'lov tasdiqlandi → tarif yoqiladi
//
// ── XAVFSIZLIK QOIDALARI (provayderdan qat'i nazar) ────────────────────────
//  1. Summani KLIENT emas, SERVER hisoblaydi (_plans.js dan).
//  2. Foydalanuvchi Firebase ID-token bilan tasdiqlanadi.
//  3. Webhook imzosi tekshiriladi — aks holda istalgan odam "to'ladim" deb
//     so'rov yuborib bepul PREMIUM olardi.
//  4. Idempotentlik: bir xil to'lov ikki marta kelsa, bir marta hisoblanadi.
//  5. Tarifni faqat SHU server yoqadi (firestore.rules klientga taqiqlaydi).
// ═══════════════════════════════════════════════════════════════════════════

const crypto = require('crypto');
const fsdb = require('./_firestore');
const { paidPlan, referralReward } = require('./_plans');

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS'
};

// ═══════════════════════════════════════════════════════════════════════════
// ⚠️  INPAY.UZ SOZLAMALARI — Netlify Environment Variables ga yozing
//
//   INPAY_API_URL         — API bazaviy manzili (standart: https://inpay.uz)
//   INPAY_MERCHANT_ID     — merchant/kassa identifikatori
//   INPAY_BEARER_TOKEN    — API'ga kirish tokeni (kassa bearer tokeni)
//   INPAY_WEBHOOK_SECRET  — webhook imzosi uchun maxfiy kalit (HMAC-SHA256)
//   INPAY_SECRET_KEY      — (ESKI) Ikkalasi o'rniga ishlatiladi
//   INPAY_SANDBOX         — "1" bo'lsa sinov rejimi (haqiqiy pul o'tmaydi)
//
// Eslatma: rasmiy inPAY SDK (inpayuz/inpay-js) asosida ishlangan. API auth
// bearer token va webhook imzo secreti IKKI ALOHIDA narsa — aralashtirmang.
// ═══════════════════════════════════════════════════════════════════════════
const INPAY = {
  apiUrl: () => (process.env.INPAY_API_URL || 'https://inpay.uz').replace(/\/+$/, ''),
  merchantId: () => process.env.INPAY_MERCHANT_ID || '',
  // Kassa paneldagi "Merchant Token" — bu BEVOSITA Authorization header'ga
  // qo'yiladigan bearer token EMAS. Rasmiy hujjatga ko'ra bu faqat
  // GET /authorization/ orqali VAQTINCHALIK (24 soatlik) bearer token
  // olish uchun ishlatiladigan kalit. Shu vaqtinchalik token keshlanadi
  // (bearerTokenCached) va /create/ so'rovida ishlatiladi.
  merchantToken: () => process.env.INPAY_BEARER_TOKEN || process.env.INPAY_SECRET_KEY || '',
  // Webhook imzosini tekshirish uchun (HMAC-SHA256) — merchant tokendan alohida
  webhookSecret: () => process.env.INPAY_WEBHOOK_SECRET || process.env.INPAY_SECRET_KEY || '',
  sandbox: () => process.env.INPAY_SANDBOX === '1',

  // ── (0) VAQTINCHALIK BEARER TOKEN OLISH VA KESHLASH ───────────────────
  // GET /api/v1/authorization/?merchant_id=...&merchant_token=...
  // 24 soat amal qiladi — har so'rovda qayta olmaymiz, keshlaymiz.
  authEndpoint: '/api/v1/authorization/',
  _cachedToken: null,
  _cachedUntil: 0,

  async getBearerToken() {
    const now = Date.now();
    // 1 soatlik xavfsizlik zaxirasi bilan keshdan foydalanamiz
    if (INPAY._cachedToken && now < INPAY._cachedUntil) return INPAY._cachedToken;

    const url = `${INPAY.apiUrl()}${INPAY.authEndpoint}?merchant_id=${encodeURIComponent(INPAY.merchantId())}&merchant_token=${encodeURIComponent(INPAY.merchantToken())}`;
    const resp = await fetch(url, { headers: { Accept: 'application/json' } });
    const data = await resp.json().catch(() => ({}));

    if (!resp.ok || !data.success || !data.bearer_token) {
      throw new Error("Bearer token olinmadi: " + JSON.stringify(data).slice(0, 200));
    }

    INPAY._cachedToken = data.bearer_token;
    // 24 soat — 1 soat zaxira = 23 soat kesh muddati
    INPAY._cachedUntil = now + 23 * 3600 * 1000;
    return INPAY._cachedToken;
  },

  // ── (1) HISOB-FAKTURA YARATISH ────────────────────────────────────────
  // Rasmiy hujjat: POST /api/v1/create/  (oxiridagi slash SHART — slashsiz
  // 301 redirect qilib POST tanasini yo'qotadi).
  createEndpoint: '/api/v1/create/',

  createBody({ orderId, amount, description, callbackUrl }) {
    return {
      merchant_id: INPAY.merchantId(),
      // Hujjatga ko'ra body'dagi `token` maydoni — MERCHANT TOKEN (kassa
      // kalitingiz), buyurtma raqami emas! Buyurtma reference'ni biz
      // description yoki alohida kuzatuvda saqlaymiz.
      token: INPAY.merchantToken(),
      amount,
      description,
      callback_url: callbackUrl
    };
  },

  parseCreate(data) {
    const url = data.pay_url || data.pay_url_link || data.payment_url || data.checkout_url || data.url;
    // providerId = inPAY order_id (16 hex) — webhook'da shu bilan qaytadi
    const id = data.order_id || data.invoice_id || data.transaction_id || data.id;
    if (!url) throw new Error("Javobda to'lov havolasi yo'q: " + JSON.stringify(data).slice(0, 200));
    return { paymentUrl: url, providerId: id ? String(id) : null };
  },

  // ── (2) WEBHOOK IMZOSI ────────────────────────────────────────────────
  // Rasmiy SDK:  X-InPAY-Signature = hex(hmac_sha256(rawBody, webhookSecret))
  // Imzo XOM (raw) tana ustidan hisoblanadi — JSON parse qilishdan OLDIN.
  webhookSignature(rawBody) {
    const secret = INPAY.webhookSecret();
    if (!secret) return null;
    return crypto.createHmac('sha256', secret).update(String(rawBody), 'utf8').digest('hex');
  },

  verifyWebhook(rawBody, headers) {
    const secret = INPAY.webhookSecret();
    if (!secret) return { ok: false, reason: 'INPAY_WEBHOOK_SECRET sozlanmagan' };

    const got = String(headers['x-inpay-signature'] || headers['x-signature'] || '').trim();
    if (!got) return { ok: false, reason: 'X-InPAY-Signature yuborilmagan' };

    // Ba'zi provayderlar "sha256=..." prefiksi bilan yuboradi
    const candidate = got.toLowerCase().startsWith('sha256=') ? got.slice(7) : got;

    const expected = INPAY.webhookSignature(rawBody);
    if (!expected) return { ok: false, reason: 'secret bo\'sh' };

    // Vaqt bo'yicha barqaror solishtirish — imzoni bit-bit topib olishning
    // oldini oladi
    const a = Buffer.from(expected, 'utf8');
    const b = Buffer.from(candidate, 'utf8');
    const ok = a.length === b.length && crypto.timingSafeEqual(a, b);

    return ok ? { ok: true } : { ok: false, reason: 'Imzo mos kelmadi' };
  },

  // ── (3) AVTO-TO'LOV ───────────────────────────────────────────────────
  // DIQQAT: inPAY rasmiy SDK'sida (v1.0) takroriy (recurrent) yechish API'si
  // hujjatlashtirilmagan. Quyidagi endpoint/maydonlar taxminiy — inPAY
  // hujjatiga qarab tasdiqlash kerak. Sandbox oqimi esa to'liq sinaladi.
  saveCardFlag: { save_card: true, recurrent: true },

  chargeEndpoint: '/api/v1/recurrent/pay/',

  chargeBody({ orderId, amount, token, description }) {
    return {
      merchant_id: INPAY.merchantId(),
      card_token: token,
      amount,                    // so'm (createBody bilan bir xil birlik)
      token: orderId,
      description
    };
  },

  parseCharge(data) {
    const status = String(data.status || data.state || '').toLowerCase();
    const paid = ['success', 'paid', 'completed', 'confirmed', '1', 'true']
      .includes(status);
    return {
      paid,
      status,
      providerId: data.transaction_id || data.invoice_id || data.order_id || data.id || null,
      // Rad javobi sababi — foydalanuvchiga ko'rsatamiz
      message: data.message || data.error || data.reason || ''
    };
  },

  // Webhook kartani saqlagan bo'lsa, tokenni shu yerdan olamiz.
  // `token` maydonini bu yerda o'qimaymiz — inPAY webhook'ida `token`
  // bizning buyurtma reference'miz bo'lishi mumkin, karta tokeni emas.
  parseCardToken(body) {
    const token = body.card_token || body.recurrent_token || null;
    const mask = body.card_mask || body.pan_masked || body.masked_pan || null;
    return token ? { token: String(token), mask: mask ? String(mask) : null } : null;
  },

  // ── (4) WEBHOOK MAZMUNINI O'QISH ──────────────────────────────────────
  parseWebhook(body) {
    const status = String(body.status || body.state || '').toLowerCase();
    const paid = ['success', 'paid', 'completed', 'confirmed', '1', 'true']
      .includes(status);
    return {
      orderId: body.token || body.order_id || body.orderId,
      amount: Number(body.amount || 0),   // so'm — inPAY tiyin ishlatmaydi
      paid,
      status,
      providerId: body.transaction_id || body.order_id || body.invoice_id || body.id || null
    };
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// FIREBASE ID-TOKEN TEKSHIRUVI
// Klient "men falonchiman" deb aytishi yetarli emas — tokenni tasdiqlaymiz.
// ═══════════════════════════════════════════════════════════════════════════
let certCache = null, certCachedUntil = 0;

async function googleCerts() {
  if (certCache && Date.now() < certCachedUntil) return certCache;
  const r = await fetch('https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com');
  if (!r.ok) throw new Error('Google sertifikatlari olinmadi');
  certCache = await r.json();
  const maxAge = /max-age=(\d+)/.exec(r.headers.get('cache-control') || '');
  certCachedUntil = Date.now() + (maxAge ? +maxAge[1] : 3600) * 1000;
  return certCache;
}

async function verifyIdToken(idToken) {
  if (!idToken) throw new Error('Token yuborilmagan');

  const [h, p, s] = idToken.split('.');
  if (!h || !p || !s) throw new Error("Token ko'rinishi noto'g'ri");

  const header = JSON.parse(Buffer.from(h, 'base64url').toString());
  const payload = JSON.parse(Buffer.from(p, 'base64url').toString());
  const projectId = process.env.FIREBASE_PROJECT_ID || 'linguaverse-81b52';

  if (payload.aud !== projectId) throw new Error('Token boshqa loyihaga tegishli');
  if (payload.iss !== `https://securetoken.google.com/${projectId}`) throw new Error("Token manbasi noto'g'ri");
  if (payload.exp * 1000 < Date.now()) throw new Error('Token muddati tugagan');
  if (!payload.sub) throw new Error("Tokenda foydalanuvchi yo'q");

  const certs = await googleCerts();
  const cert = certs[header.kid];
  if (!cert) throw new Error('Token kaliti topilmadi');

  const verifier = crypto.createVerify('RSA-SHA256');
  verifier.update(`${h}.${p}`);
  if (!verifier.verify(cert, Buffer.from(s, 'base64url'))) {
    throw new Error("Token imzosi noto'g'ri");
  }

  return { uid: payload.sub, email: payload.email || '' };
}

// ═══════════════════════════════════════════════════════════════════════════
// AMALLAR
// ═══════════════════════════════════════════════════════════════════════════

/** To'lov yaratadi. Summani SERVER hisoblaydi. */
async function createPayment(body, siteUrl) {
  const { uid, email } = await verifyIdToken(body.idToken);

  const plan = paidPlan(body.planId, body.duration);
  if (!plan) throw new Error("Noto'g'ri yoki bepul reja: " + body.planId);

  const orderId = 'LV-' + Date.now().toString(36).toUpperCase() + '-' +
                  crypto.randomBytes(3).toString('hex').toUpperCase();

  // Foydalanuvchi avto-to'lovni so'raganmi? Faqat u aniq yoqsa yoqiladi —
  // "unutib qoldi" degan bahona bilan pul yechilmasin.
  const autopay = body.autopay === true;

  // 1) Avval Firestore'ga yozamiz — provayder javob bermay qolsa ham iz qoladi
  await fsdb.addDoc('orders', {
    orderId,
    uid,
    userEmail: email,
    plan: plan.id,
    planName: plan.name,
    amount: plan.price,          // SERVER hisoblagan summa
    currency: 'UZS',
    duration: plan.duration,     // daily | monthly | q3 | q6 | yearly
    durationLabel: plan.durationLabel,
    days: plan.days,
    provider: 'inpay',
    status: 'pending',
    autopay,
    offerAccepted: body.offerAccepted === true,
    offerAcceptedAt: body.offerAccepted === true ? new Date() : null,
    sandbox: INPAY.sandbox(),
    createdAt: new Date()
  }, orderId);

  // 2) Sinov rejimi — provayder chaqirilmaydi, soxta havola qaytariladi.
  //    Butun oqimni haqiqiy pul sarflamasdan sinash uchun.
  if (INPAY.sandbox() || !INPAY.merchantId()) {
    return {
      orderId,
      amount: plan.price,
      duration: plan.duration,
      sandbox: true,
      paymentUrl: `${siteUrl}/payment-sandbox.html?order=${orderId}&amount=${plan.price}&plan=${plan.id}&duration=${plan.duration}`,
      eslatma: INPAY.merchantId()
        ? 'Sinov rejimi yoqilgan (INPAY_SANDBOX=1)'
        : 'INPAY_MERCHANT_ID sozlanmagan — sinov rejimida ishlayapti'
    };
  }

  // 3) Haqiqiy so'rov — avval vaqtinchalik bearer token olamiz (keshlangan
  //    bo'lsa qayta so'ramaymiz), keyin /create/ ga shu token bilan boramiz.
  const bearer = await INPAY.getBearerToken();
  const resp = await fetch(INPAY.apiUrl() + INPAY.createEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + bearer
    },
    body: JSON.stringify({
      ...INPAY.createBody({
        orderId,
        amount: plan.price,
        description: `LinguaVerse ${plan.name} — ${plan.durationLabel}`,
        callbackUrl: `${siteUrl}/.netlify/functions/payment/webhook`
      }),
      // Avto-to'lov so'ralganda provayderdan kartani eslab qolishni so'raymiz
      ...(autopay ? INPAY.saveCardFlag : {})
    })
  });

  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    await fsdb.setDoc(`orders/${orderId}`, {
      status: 'failed',
      error: JSON.stringify(data).slice(0, 500),
      failedAt: new Date()
    });
    throw new Error('inpay.uz javob bermadi: ' + (data.message || data.error || resp.status));
  }

  const { paymentUrl, providerId } = INPAY.parseCreate(data);
  await fsdb.setDoc(`orders/${orderId}`, { providerId, paymentUrl });

  return { orderId, amount: plan.price, duration: plan.duration, paymentUrl, sandbox: false };
}

/**
 * To'lovni tasdiqlash va tarifni yoqish. ATOMIK va IDEMPOTENT —
 * webhook ikki marta kelsa ham tarif bir marta uzaytiriladi.
 */
async function confirmPayment(orderId, paidAmount, providerId, source, cardInfo) {
  let activated = null;

  await fsdb.transact(`orders/${orderId}`, async (order) => {
    if (!order) throw new Error('Buyurtma topilmadi: ' + orderId);

    // Allaqachon hisoblangan — hech narsa qilmaymiz
    if (order.status === 'paid') {
      activated = { already: true, plan: order.plan, uid: order.uid };
      return null;
    }

    // Summa mos kelmasa qabul qilmaymiz
    if (paidAmount != null && Math.abs(paidAmount - order.amount) > 1) {
      throw new Error(`Summa mos emas: kutilgan ${order.amount}, kelgan ${paidAmount}`);
    }

    activated = {
      already: false, plan: order.plan, uid: order.uid,
      days: order.days, duration: order.duration || 'monthly',
      amount: order.amount, autopay: order.autopay === true
    };
    return {
      status: 'paid',
      paidAt: new Date(),
      paidAmount: paidAmount ?? order.amount,
      providerId: providerId || order.providerId || null,
      confirmedBy: source
    };
  });

  if (!activated || activated.already) return activated;

  // ── Tarifni yoqamiz. Buni FAQAT server qila oladi. ──
  const user = await fsdb.getDoc(`users/${activated.uid}`);

  // Amaldagi tarif tugamagan bo'lsa — ustiga qo'shamiz, yo'qotmaymiz
  const now = Date.now();
  const currentExpiry = user?.planExpiry instanceof Date ? user.planExpiry.getTime() : 0;
  const from = (user?.plan === activated.plan && currentExpiry > now) ? currentExpiry : now;
  const expiry = new Date(from + activated.days * 86400_000);

  await fsdb.setDoc(`users/${activated.uid}`, {
    plan: activated.plan,
    planExpiry: expiry,
    planUpdatedAt: new Date()
  });

  await fsdb.addDoc(`users/${activated.uid}/events`, {
    event: 'plan_activated',
    plan: activated.plan,
    orderId,
    expiry,
    at: new Date()
  });

  // ── Avto-to'lov: karta tokeni kelgan bo'lsa obunani yozamiz ──
  // Token provayderniki. Karta raqami bizga hech qachon kelmaydi va
  // saqlanmaydi — faqat shu token va oxirgi 4 raqamli niqob.
  if (activated.autopay && cardInfo?.token) {
    await saveSubscription(activated.uid, {
      active: true,
      plan: activated.plan,
      duration: activated.duration,
      amount: activated.amount,
      days: activated.days,
      cardToken: cardInfo.token,
      cardMask: cardInfo.mask || null,
      // Keyingi yechish — reja tugagan kuni, bir kun oldin emas
      nextChargeAt: expiry,
      lastChargeAt: new Date(),
      failCount: 0,
      updatedAt: new Date()
    });
    console.log(`[payment] avto-to'lov yoqildi: ${activated.uid} → ${expiry.toISOString()}`);
  }

  // ── REFERAL MUKOFOTI ──
  // Bu foydalanuvchining BIRINCHI pullik to'lovi bo'lsa va uni kimdir taklif
  // qilgan bo'lsa, taklif qiluvchiga haqiqiy pul (balance) beramiz. Faqat bir
  // marta — referral hujjatidagi `rewarded` bayrog'i takrorlashning oldini oladi.
  try {
    await creditReferral(activated.uid, activated.amount);
  } catch (e) {
    // Referal xatosi to'lovni buzmasin — tarif baribir yoqildi
    console.error('[payment] referal mukofoti berilmadi:', e.message);
  }

  console.log(`[payment] tarif yoqildi: ${activated.uid} → ${activated.plan} (${expiry.toISOString()})`);
  return { ...activated, expiry };
}

/**
 * Taklif qiluvchiga referal mukofotini beradi. IDEMPOTENT —
 * referral hujjatini atomik ravishda `rewarded:true` qiladi; ikkinchi
 * chaqiruv hech narsa qilmaydi.
 */
async function creditReferral(invitedUid, planPrice) {
  const refDoc = await fsdb.getDoc(`referrals/${invitedUid}`);
  if (!refDoc || refDoc.rewarded === true || !refDoc.inviterUid) return;

  const reward = referralReward(planPrice);
  if (reward <= 0) return;

  // Avval bayroqni atomik yoqamiz — ikki webhook bir vaqtda kelsa ham
  // faqat bittasi o'tadi.
  let claimed = false;
  await fsdb.transact(`referrals/${invitedUid}`, (cur) => {
    if (!cur || cur.rewarded === true) return null;   // allaqachon berilgan
    claimed = true;
    return { rewarded: true, reward, rewardedAt: new Date() };
  });
  if (!claimed) return;

  // Taklif qiluvchining balansini oshiramiz (haqiqiy pul)
  const inviter = await fsdb.getDoc(`users/${refDoc.inviterUid}`);
  if (!inviter) return;

  await fsdb.setDoc(`users/${refDoc.inviterUid}`, {
    balance: (inviter.balance || 0) + reward,
    referralEarnings: (inviter.referralEarnings || 0) + reward,
    referralCount: (inviter.referralCount || 0) + 1
  });

  await fsdb.addDoc(`users/${refDoc.inviterUid}/events`, {
    event: 'referral_reward',
    invitedUid,
    reward,
    at: new Date()
  });

  console.log(`[payment] referal: ${refDoc.inviterUid} +${reward} so'm (do'st: ${invitedUid})`);
}

// ═══════════════════════════════════════════════════════════════════════════
// AVTO-TO'LOV
// ═══════════════════════════════════════════════════════════════════════════
const SUB_PATH = uid => `users/${uid}/billing/subscription`;

async function saveSubscription(uid, data) {
  await fsdb.setDoc(SUB_PATH(uid), data);
}

/** Klientga ko'rsatiladigan holat. cardToken HECH QACHON qaytmaydi. */
async function subscriptionStatus(idToken) {
  const { uid } = await verifyIdToken(idToken);
  const sub = await fsdb.getDoc(SUB_PATH(uid));
  if (!sub) return { autopay: false, hasCard: false };

  return {
    autopay: sub.active === true,
    hasCard: !!sub.cardToken,
    cardMask: sub.cardMask || null,
    plan: sub.plan || null,
    amount: sub.amount || null,
    nextChargeAt: sub.nextChargeAt instanceof Date ? sub.nextChargeAt.toISOString() : null,
    lastChargeAt: sub.lastChargeAt instanceof Date ? sub.lastChargeAt.toISOString() : null,
    failCount: sub.failCount || 0
  };
}

/**
 * Foydalanuvchi avto-to'lovni yoqadi/o'chiradi.
 * Yoqish faqat saqlangan karta bo'lsa ishlaydi — kartani bu yerda
 * so'ramaymiz, u faqat to'lov sahifasida provayder tomonida kiritiladi.
 */
async function setAutopay(idToken, on) {
  const { uid } = await verifyIdToken(idToken);
  const sub = await fsdb.getDoc(SUB_PATH(uid));

  if (on && !sub?.cardToken) {
    return {
      ok: false,
      reason: 'no_card',
      message: "Saqlangan karta yo'q. Avto-to'lovni keyingi to'lov paytida yoqing."
    };
  }

  await fsdb.setDoc(SUB_PATH(uid), {
    active: !!on,
    failCount: 0,
    updatedAt: new Date(),
    ...(on ? {} : { cancelledAt: new Date() })
  });

  await fsdb.addDoc(`users/${uid}/events`, {
    event: on ? 'autopay_on' : 'autopay_off',
    at: new Date()
  });

  return { ok: true, autopay: !!on };
}

/**
 * Muddati kelgan obunalarni yechadi. Netlify Scheduled Function kuniga
 * bir marta chaqiradi.
 *
 * Ketma-ketlik: navbat topiladi → provayderdan pul yechiladi → buyurtma
 * "paid" qilinadi → confirmPayment tarifni uzaytiradi. Ya'ni qo'lda
 * to'lov bilan bir xil yo'ldan o'tadi, alohida mantiq yo'q.
 */
async function runRenewals(limit = 50) {
  if (!fsdb.configured()) return { ok: false, reason: 'firestore_sozlanmagan' };

  const due = await fsdb.queryGroup('billing', [
    { field: 'active', op: 'EQUAL', value: true },
    { field: 'nextChargeAt', op: 'LESS_THAN_OR_EQUAL', value: new Date() }
  ], limit);

  const report = { checked: due.length, charged: 0, failed: 0, disabled: 0, details: [] };

  for (const sub of due) {
    // path: users/{uid}/billing/subscription
    const uid = sub.path.split('/')[1];
    if (!uid || !sub.cardToken) continue;

    // Saqlangan davomiylik bo'yicha narx va kunlarni hisoblaymiz.
    // Eski obunalarda duration yo'q — oylik deb hisoblaymiz.
    const dur = sub.duration || 'monthly';
    const plan = paidPlan(sub.plan, dur);
    if (!plan) { report.details.push({ uid, skip: "noma'lum reja" }); continue; }
    const days = sub.days || plan.days;

    const orderId = 'LVR-' + Date.now().toString(36).toUpperCase() + '-' +
                    crypto.randomBytes(3).toString('hex').toUpperCase();

    await fsdb.addDoc('orders', {
      orderId, uid,
      plan: plan.id, planName: plan.name,
      amount: plan.price, currency: 'UZS',
      duration: dur, durationLabel: plan.durationLabel, days,
      provider: 'inpay', status: 'pending',
      autopay: true, renewal: true,
      sandbox: INPAY.sandbox(),
      createdAt: new Date()
    }, orderId);

    try {
      const charged = await chargeSaved(orderId, plan, sub.cardToken);

      if (charged.paid) {
        await confirmPayment(orderId, plan.price, charged.providerId, 'autopay');
        // confirmPayment nextChargeAt ni yangilaydi (autopay + token bor)
        await fsdb.setDoc(SUB_PATH(uid), {
          lastChargeAt: new Date(),
          nextChargeAt: new Date(Date.now() + days * 86400_000),
          failCount: 0,
          updatedAt: new Date()
        });
        report.charged++;
        report.details.push({ uid, plan: plan.id, ok: true });
        continue;
      }

      // ── Rad javobi ──
      const fails = (sub.failCount || 0) + 1;
      await fsdb.setDoc(`orders/${orderId}`, {
        status: 'failed', error: charged.message || charged.status, failedAt: new Date()
      });

      // Uch marta urinamiz: 1 kun, 3 kun, keyin to'xtatamiz.
      // Cheksiz urinish foydalanuvchi kartasini bloklashi mumkin.
      const RETRY_DAYS = [1, 3];
      if (fails > RETRY_DAYS.length) {
        await fsdb.setDoc(SUB_PATH(uid), {
          active: false, failCount: fails,
          disabledReason: 'uch marta to\'lanmadi', updatedAt: new Date()
        });
        await fsdb.addDoc(`users/${uid}/events`, {
          event: 'autopay_disabled', reason: charged.message || charged.status, at: new Date()
        });
        report.disabled++;
      } else {
        await fsdb.setDoc(SUB_PATH(uid), {
          failCount: fails,
          nextChargeAt: new Date(Date.now() + RETRY_DAYS[fails - 1] * 86400_000),
          lastError: charged.message || charged.status,
          updatedAt: new Date()
        });
        report.failed++;
      }
      report.details.push({ uid, plan: plan.id, ok: false, reason: charged.message || charged.status });

    } catch (e) {
      console.error('[autopay] xato:', uid, e.message);
      await fsdb.setDoc(`orders/${orderId}`, {
        status: 'failed', error: e.message.slice(0, 300), failedAt: new Date()
      });
      report.failed++;
      report.details.push({ uid, ok: false, reason: e.message });
    }
  }

  console.log('[autopay] natija:', JSON.stringify(report));
  return { ok: true, ...report };
}

// ═══════════════════════════════════════════════════════════════════════════
// PUL YECHISH (PAYOUT)
// ═══════════════════════════════════════════════════════════════════════════
const MIN_PAYOUT = 20000;   // eng kam yechish summasi

/**
 * Yechish so'rovi. Balansni SHU YERDA ushlaymiz (kamaytiramiz) — aks holda
 * foydalanuvchi bir balansdan bir necha so'rov yuborib, ortiqcha olardi.
 * Admin rad etsa, balans qaytariladi (admin panelida).
 */
async function requestPayout(body) {
  const { uid } = await verifyIdToken(body.idToken);
  const amount = Math.floor(Number(body.amount) || 0);
  const card = String(body.card || '').replace(/\s+/g, '');

  if (amount < MIN_PAYOUT) return { ok: false, message: `Eng kam summa ${MIN_PAYOUT.toLocaleString()} so'm.` };
  if (!/^\d{16}$/.test(card)) return { ok: false, message: "Karta raqami 16 xonali bo'lishi kerak." };

  // Balansni atomik ushlaymiz
  let held = false, newBalance = 0;
  await fsdb.transact(`users/${uid}`, (u) => {
    if (!u) return null;
    const bal = u.balance || 0;
    if (bal < amount) return null;              // yetarli emas
    held = true; newBalance = bal - amount;
    return { balance: newBalance };
  });

  if (!held) return { ok: false, message: 'Balans yetarli emas.' };

  const payoutId = 'PO-' + Date.now().toString(36).toUpperCase() + '-' +
                   crypto.randomBytes(2).toString('hex').toUpperCase();

  await fsdb.addDoc('payouts', {
    payoutId, uid,
    amount,
    card: card.slice(0, 4) + ' •••• •••• ' + card.slice(-4),   // to'liq raqam saqlanmaydi
    cardFull: card,                                             // admin to'lashi uchun (faqat admin o'qiydi)
    status: 'pending',
    balanceAfter: newBalance,
    createdAt: new Date()
  }, payoutId);

  await fsdb.addDoc(`users/${uid}/events`, {
    event: 'payout_requested', payoutId, amount, at: new Date()
  });

  return { ok: true, payoutId, amount, balance: newBalance };
}

/** Balans va referal holatini o'qish (klient ko'rsatadi). */
async function walletStatus(idToken) {
  const { uid } = await verifyIdToken(idToken);
  const u = await fsdb.getDoc(`users/${uid}`);
  return {
    balance: u?.balance || 0,
    referralEarnings: u?.referralEarnings || 0,
    referralCount: u?.referralCount || 0,
    coins: u?.coins || 0,
    minPayout: MIN_PAYOUT
  };
}

/** Saqlangan token bilan pul yechish. */
async function chargeSaved(orderId, plan, token) {
  // Sinov rejimida provayder chaqirilmaydi — oqim baribir to'liq sinaladi
  if (INPAY.sandbox() || !INPAY.merchantId()) {
    return { paid: true, providerId: 'SANDBOX-' + orderId, status: 'sandbox', message: '' };
  }

  const bearer = await INPAY.getBearerToken();
  const resp = await fetch(INPAY.apiUrl() + INPAY.chargeEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + bearer
    },
    body: JSON.stringify(INPAY.chargeBody({
      orderId, amount: plan.price, token,
      description: `LinguaVerse ${plan.name} — avto-uzaytirish`
    }))
  });

  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    return { paid: false, status: String(resp.status), message: data.message || data.error || 'provayder rad etdi' };
  }
  return INPAY.parseCharge(data);
}

// ═══════════════════════════════════════════════════════════════════════════
// HANDLER
// ═══════════════════════════════════════════════════════════════════════════
exports.handler = async function (event) {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' };

  const siteUrl = process.env.URL || `https://${event.headers.host}`;
  const isWebhook = event.path.endsWith('/webhook');

  // ── Sozlamalar tekshiruvi ──
  if (event.httpMethod === 'GET') {
    return json(200, {
      ok: true,
      inpay: {
        apiUrl: INPAY.apiUrl(),
        merchantConfigured: !!INPAY.merchantId(),
        bearerConfigured: !!INPAY.merchantToken(),
        webhookSecretConfigured: !!INPAY.webhookSecret(),
        sandbox: INPAY.sandbox()
      },
      firestoreAdmin: fsdb.configured(),
      webhookUrl: `${siteUrl}/.netlify/functions/payment/webhook`
    });
  }

  if (event.httpMethod !== 'POST') return json(405, { error: 'Method Not Allowed' });

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch {
    // Ba'zi provayderlar form-encoded yuboradi
    body = Object.fromEntries(new URLSearchParams(event.body || ''));
  }

  // ═══ WEBHOOK ═══
  if (isWebhook) {
    // Imzo XOM tana ustidan hisoblanadi — JSON parse qilishdan oldin.
    const rawBody = event.body || '';
    console.log('[payment] webhook keldi:', rawBody.slice(0, 300));

    const check = INPAY.verifyWebhook(rawBody, event.headers || {});
    if (!check.ok) {
      console.error('[payment] webhook RAD ETILDI:', check.reason);
      return json(403, { error: "Imzo tekshiruvidan o'tmadi" });
    }

    const info = INPAY.parseWebhook(body);
    if (!info.orderId) return json(400, { error: "order_id yo'q" });

    // inPAY webhook'ida bizning LV-XXX tokenimiz emas, inPAY order_id (16 hex)
    // keladi. Buyurtmani bog'laymiz: avval to'g'ridan (token bo'lsa), topilmasa
    // providerId (inPAY order_id) bo'yicha qidiramiz.
    let orderRef = info.orderId;
    let orderDoc = await fsdb.getDoc(`orders/${orderRef}`).catch(() => null);
    if (!orderDoc) {
      const matches = await fsdb.queryGroup('orders', [
        { field: 'providerId', op: 'EQUAL', value: orderRef }
      ], 1).catch(() => []);
      if (matches.length) {
        orderRef = matches[0].path.split('/').pop();
        orderDoc = matches[0];
      }
    }
    if (!orderDoc) return json(404, { error: 'Buyurtma topilmadi: ' + info.orderId });

    if (!info.paid) {
      await fsdb.setDoc(`orders/${orderRef}`, {
        status: 'failed',
        providerStatus: info.status,
        failedAt: new Date()
      }).catch(e => console.error('[payment] holat yozilmadi:', e.message));

      return json(200, { ok: true, note: "to'lanmagan holat qayd etildi" });
    }

    try {
      // Karta tokeni kelgan bo'lsa avto-to'lov uchun saqlanadi
      const card = INPAY.parseCardToken(body);
      const res = await confirmPayment(orderRef, info.amount, info.providerId, 'webhook', card);
      // Provayder 200 kutadi — aks holda qayta-qayta yuboraveradi
      return json(200, { ok: true, already: res?.already || false });
    } catch (e) {
      console.error('[payment] tasdiqlash xatosi:', e.message);
      return json(200, { ok: false, error: e.message });
    }
  }

  // ═══ KLIENT AMALLARI ═══
  try {
    switch (body.action) {
      case 'create':
        return json(200, await createPayment(body, siteUrl));

      case 'status': {
        const { uid } = await verifyIdToken(body.idToken);
        const order = await fsdb.getDoc(`orders/${body.orderId}`);
        if (!order) return json(404, { error: 'Buyurtma topilmadi' });
        if (order.uid !== uid) return json(403, { error: 'Bu buyurtma sizniki emas' });
        return json(200, {
          orderId: order.orderId,
          status: order.status,
          plan: order.plan,
          amount: order.amount,
          paidAt: order.paidAt || null
        });
      }

      // ── HAMYON / REFERAL / YECHISH ──
      case 'wallet':
        return json(200, await walletStatus(body.idToken));

      case 'payout-request':
        return json(200, await requestPayout(body));

      // ── AVTO-TO'LOV ──
      case 'autopay-status':
        return json(200, await subscriptionStatus(body.idToken));

      case 'autopay-on':
        return json(200, await setAutopay(body.idToken, true));

      case 'autopay-off':
        return json(200, await setAutopay(body.idToken, false));

      // Navbatdagi obunalarni yechish. Ikki yo'l bilan chaqiriladi:
      // rejalashtirilgan funksiya (ichkaridan) yoki RENEW_SECRET bilan qo'lda.
      case 'renew-run': {
        const secret = process.env.RENEW_SECRET || '';
        if (!secret || body.secret !== secret) {
          return json(403, { error: 'RENEW_SECRET mos kelmadi' });
        }
        return json(200, await runRenewals(Number(body.limit) || 50));
      }

      // Sinov rejimida to'lovni "amalga oshirish" — faqat sandbox'da
      case 'sandbox-confirm': {
        if (!INPAY.sandbox() && INPAY.merchantId()) {
          return json(403, { error: "Sinov rejimi o'chirilgan" });
        }
        const { uid } = await verifyIdToken(body.idToken);
        const order = await fsdb.getDoc(`orders/${body.orderId}`);
        if (!order) return json(404, { error: 'Buyurtma topilmadi' });
        if (order.uid !== uid) return json(403, { error: 'Bu buyurtma sizniki emas' });

        const res = await confirmPayment(body.orderId, order.amount, 'SANDBOX', 'sandbox');
        return json(200, { ok: true, ...res });
      }

      default:
        return json(400, { error: "Noma'lum action: " + body.action });
    }
  } catch (e) {
    console.error('[payment]', body.action, e.message);
    return json(400, { error: e.message });
  }
};

function json(statusCode, body) {
  return {
    statusCode,
    headers: { ...CORS, 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  };
}

// renew-subscriptions.js kunlik jadval bo'yicha shuni chaqiradi
exports.runRenewals = runRenewals;
