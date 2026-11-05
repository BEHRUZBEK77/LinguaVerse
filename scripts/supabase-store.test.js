const assert = require('node:assert/strict');
const test = require('node:test');

// PostgREST'ni xotirada taqlid qiladigan soxta fetch — server _firestore.js
// Supabase bilan to'g'ri gaplashishini tekshiradi (haqiqiy kalitsiz).
function fakeSupabase() {
  const rows = new Map();   // path → { path, col, parent, data, version }
  const calls = [];
  const fetchImpl = async (url, opts = {}) => {
    const u = new URL(url);
    const method = opts.method || 'GET';
    const body = opts.body ? JSON.parse(opts.body) : null;
    calls.push({ method, path: u.pathname, query: u.search });
    const reply = (status, data) => ({ ok: status < 300, status, text: async () => (data === undefined ? '' : JSON.stringify(data)) });
    const pathEq = u.searchParams.get('path')?.replace(/^eq\./, '');
    const verEq = u.searchParams.get('version')?.replace(/^eq\./, '');
    if (u.pathname === '/rest/v1/docs') {
      if (method === 'GET') { const r = rows.get(pathEq); return reply(200, r ? [{ data: r.data, version: r.version }] : []); }
      if (method === 'POST') {
        if (rows.has(body.path)) return reply(409, { code: '23505', message: 'duplicate' });
        const r = { ...body, version: 1 }; rows.set(body.path, r); return reply(201, [r]);
      }
      if (method === 'PATCH') {
        const r = rows.get(pathEq);
        if (!r || String(r.version) !== verEq) return reply(200, []);
        Object.assign(r, body); return reply(200, [r]);
      }
      if (method === 'DELETE') { rows.delete(pathEq); return reply(204); }
    }
    if (u.pathname === '/rest/v1/rpc/lv_query') {
      let list = [...rows.values()].filter(r => r.col === body.c && (body.par === null || r.parent === body.par));
      for (const f of body.filters) list = list.filter(r => (f.op === '==' ? r.data[f.f] === f.v : f.op === '<=' ? JSON.stringify(r.data[f.f]?.$t || r.data[f.f]) <= JSON.stringify(f.v?.$t || f.v) : true));
      return reply(200, list.slice(0, body.lim));
    }
    if (u.pathname === '/rest/v1/rpc/lv_count') return reply(200, [...rows.values()].filter(r => r.col === body.c).length);
    return reply(404, { message: 'not found' });
  };
  return { rows, calls, fetchImpl };
}

test('server store writes Firestore-style documents into Supabase with Date round-trip', async () => {
  const sb = fakeSupabase();
  const origFetch = global.fetch;
  process.env.SUPABASE_URL = 'https://x.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service';
  global.fetch = sb.fetchImpl;
  try {
    delete require.cache[require.resolve('../netlify/functions/_firestore.js')];
    const fsdb = require('../netlify/functions/_firestore.js');
    assert.equal(fsdb.configured(), true);

    const when = new Date('2026-11-04T10:00:00.000Z');
    await fsdb.setDoc('users/U1', { plan: 'ielts', planExpiry: when, coins: 5 });
    await fsdb.setDoc('users/U1', { coins: 6 });                                   // merge — plan saqlanadi
    const u = await fsdb.getDoc('users/U1');
    assert.equal(u.plan, 'ielts');
    assert.equal(u.coins, 6);
    assert.ok(u.planExpiry instanceof Date);
    assert.equal(u.planExpiry.toISOString(), when.toISOString());
    assert.deepEqual(sb.rows.get('users/U1').data.planExpiry, { $t: when.toISOString() });
    assert.equal(sb.rows.get('users/U1').col, 'users');

    await fsdb.setDoc('users/U1/billing/subscription', { active: true, nextChargeAt: when });
    assert.equal(sb.rows.get('users/U1/billing/subscription').parent, 'users/U1');
    const due = await fsdb.queryGroup('billing', [{ field: 'active', op: 'EQUAL', value: true }]);
    assert.equal(due.length, 1);
    assert.equal(due[0].path, 'users/U1/billing/subscription');

    // Atomik: ikkita parallel transact — ikkalasi ham hisobga olinadi
    await Promise.all([1, 2].map(() => fsdb.transact('users/U1', cur => ({ coins: (cur?.coins || 0) + 1 }))));
    assert.equal((await fsdb.getDoc('users/U1')).coins, 8);

    const added = await fsdb.addDoc('orders', { uid: 'U1', amount: 200000 }, 'LV-1');
    assert.equal(added.id, 'LV-1');
    await assert.rejects(fsdb.addDoc('orders', { uid: 'U1' }, 'LV-1'));

    await fsdb.deleteFields('users/U1', ['coins']);
    assert.equal((await fsdb.getDoc('users/U1')).coins, undefined);
    assert.equal(await fsdb.countCollection('orders'), 1);
    await fsdb.deleteDoc('orders/LV-1');
    assert.equal(await fsdb.getDoc('orders/LV-1'), null);
  } finally {
    global.fetch = origFetch;
    delete require.cache[require.resolve('../netlify/functions/_firestore.js')];
  }
});

test('Firestore REST values convert to the Supabase document format during migration', () => {
  const { fromFsFields } = require('../netlify/functions/auth-bridge.js');
  const out = fromFsFields({
    plan: { stringValue: 'premium' },
    coins: { integerValue: '120' },
    ratio: { doubleValue: 0.5 },
    planExpiry: { timestampValue: '2026-12-01T00:00:00Z' },
    tags: { arrayValue: { values: [{ stringValue: 'a' }, { nullValue: null }] } },
    skills: { mapValue: { fields: { reading: { integerValue: '3' } } } },
    ref: { referenceValue: 'projects/p/databases/(default)/documents/users/U1' }
  });
  assert.deepEqual(out, {
    plan: 'premium', coins: 120, ratio: 0.5,
    planExpiry: { $t: '2026-12-01T00:00:00.000Z' },
    tags: ['a', null], skills: { reading: 3 }, ref: 'users/U1'
  });
});

test('Supabase users keep their old Firebase uid so existing data paths still match', () => {
  const { mapUser } = require('../netlify/functions/_auth.js');
  assert.equal(mapUser({ id: 'uuid-1', email: 'a@b.uz', app_metadata: { legacy_uid: 'FBUID123' } }).uid, 'FBUID123');
  assert.equal(mapUser({ id: 'uuid-2', email: 'new@b.uz', app_metadata: {} }).uid, 'uuid-2');
  assert.equal(mapUser({ id: 'uuid-3', email: 'x@y.uz', user_metadata: { full_name: 'Ali' } }).name, 'Ali');
});
