const assert = require('node:assert/strict');
const test = require('node:test');

const fsdbPath = require.resolve('../netlify/functions/_firestore.js');
const coursePath = require.resolve('../netlify/functions/course.js');
const originals = new Map([fsdbPath, coursePath].map(p => [p, require.cache[p]]));

test.afterEach(() => {
  for (const [p, original] of originals) {
    if (original) require.cache[p] = original;
    else delete require.cache[p];
  }
});

// Versiyali (optimistik) transact — haqiqiy _firestore.js kabi to'qnashuvda qayta urinadi
function fakeStore() {
  const rows = new Map();
  const writes = [];
  const tick = () => new Promise(r => setImmediate(r));
  return {
    rows, writes,
    exports: {
      configured: () => true,
      getDoc: async p => rows.has(p) ? { ...rows.get(p).data } : null,
      transact: async (p, mutate) => {
        for (let i = 0; i < 10; i++) {
          const row = rows.get(p);
          const version = row ? row.version : 0;
          const patch = await mutate(row ? { ...row.data } : null);
          await tick();
          if (!patch) return row?.data || null;
          if ((rows.get(p)?.version || 0) !== version) continue;
          rows.set(p, { version: version + 1, data: { ...(row?.data || {}), ...patch } });
          return rows.get(p).data;
        }
        throw new Error('transact failed');
      },
      setDoc: async (p, data) => { writes.push(p); rows.set(p, { version: 1, data }); },
      addDoc: async (col, data) => { writes.push(col); return { id: 'x', ...data }; }
    }
  };
}

test('two parallel final-test submissions issue exactly one certificate', async () => {
  const store = fakeStore();
  const lessons = {};
  for (let i = 0; i < 20; i++) lessons[i] = { score: 1, passed: true };
  store.rows.set('users/u1/courseProgress/english_b2', { version: 1, data: { lessons } });
  require.cache[fsdbPath] = { id: fsdbPath, filename: fsdbPath, loaded: true, exports: store.exports };
  delete require.cache[coursePath];
  const course = require(coursePath);

  const r = { key: 'english_b2', idx: 24, total: 25, score: 0.9, passed: true, isFinal: true, owned: true, level: 'b2', courseName: 'English B2', lang: 'english' };
  const [a, b] = await Promise.all([
    course.recordQuizResult('u1', 'a@b.c', 'Ali', r),
    course.recordQuizResult('u1', 'a@b.c', 'Ali', r)
  ]);
  assert.ok(a.certificate);
  assert.equal(a.certificate, b.certificate);
  assert.equal(store.writes.filter(w => w.startsWith('certificates/')).length, 1);
  assert.equal(store.rows.get('users/u1/courseProgress/english_b2').data.certificateId, a.certificate);
  assert.equal(course.QUIZ_ATTEMPTS_PER_HOUR, 10);
});
