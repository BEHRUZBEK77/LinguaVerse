// Hamkorlik va video huquqi — xavfsizlik regressiya testlari
const test = require('node:test');
const assert = require('node:assert');
const P = require('../netlify/functions/_partner-program.js');
const { withServerPerks, effectivePlan } = require('../netlify/functions/_video-entitlements.js');

test('users.creator (mijoz yozadigan) bepul YOUTUBER bermaydi — faqat partnerAccounts', async () => {
  const fake = { creator: { status: 'active', activeUntil: new Date(Date.now() + 9e9) } };
  const db = { getDoc: async () => null };
  const u = await withServerPerks(db, 'u1', fake);
  assert.strictEqual(u.creator, null);
  const db2 = { getDoc: async () => ({ status: 'suspended', creator: fake.creator }) };
  assert.strictEqual((await withServerPerks(db2, 'u1', fake)).creator, null);
  const db3 = { getDoc: async () => ({ status: 'active', creator: fake.creator }) };
  assert.ok((await withServerPerks(db3, 'u1', {})).creator);
  assert.notStrictEqual(effectivePlan(await withServerPerks(db, 'u1', fake)), 'youtuber');
});

test("o'zini o'zi taklif — xavf 100, avtomatik to'lanmaydi", () => {
  const r = P.riskScore({ account: { uid: 'a', status: 'active' }, attribution: { at: new Date(0) }, buyerUid: 'a' });
  assert.ok(r.score >= 100);
  assert.strictEqual(P.releaseDecision({ risk: r.score, commission: 1000 }, P.settings(), true).status, 'review');
});

test('bekor qilingan to\'lov — komissiya qaytariladi; katta summa — admin', () => {
  const cfg = P.settings();
  assert.strictEqual(P.releaseDecision({ risk: 0, commission: 1000 }, cfg, false).status, 'reversed');
  assert.strictEqual(P.releaseDecision({ risk: 0, commission: cfg.autoApproveMax + 1 }, cfg, true).status, 'review');
  assert.strictEqual(P.releaseDecision({ risk: 0, commission: 1000 }, cfg, true).status, 'credited');
});

test("do'st taklifi faqat birinchi to'lovdan; muddati o'tgan bog'lanish hisoblanmaydi", () => {
  const acc = { uid: 'p', status: 'active', type: 'referral' };
  const attr = { partnerUid: 'p', expiresAt: new Date(Date.now() + 1e9) };
  assert.strictEqual(P.commissionAllowed({ account: acc, attribution: attr, previousSales: 0 }), true);
  assert.strictEqual(P.commissionAllowed({ account: acc, attribution: attr, previousSales: 1 }), false);
  assert.strictEqual(P.commissionAllowed({ account: { ...acc, type: 'creator' }, attribution: { ...attr, expiresAt: new Date(1) }, previousSales: 0 }), false);
  assert.strictEqual(P.commissionAllowed({ account: { ...acc, status: 'suspended' }, attribution: attr, previousSales: 0 }), false);
});

test('stavka 45% dan oshmaydi; rasmiy kodlar band qilinmaydi', () => {
  assert.ok(P.rateFor({ type: 'creator' }, 1000) <= P.MAX_RATE);
  assert.ok(P.rateFor({ type: 'creator', rateOverride: 0.9 }, 0) <= P.MAX_RATE);
  for (const c of ['ADMIN1', 'LINGUAVERSE', 'lvx1', 'ab']) assert.strictEqual(P.codeAllowed(c), false);
  assert.strictEqual(P.codeAllowed('ANVAR24'), true);
});
