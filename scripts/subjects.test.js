const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

test('fanlar katalogi: 16 fan, har sinfda kamida 10 mavzu, takrorsiz', () => {
  const c = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'subjects', 'catalog.json'), 'utf8'));
  assert.ok(c.subjects.length >= 14);
  for (const s of c.subjects) for (const [g, l] of Object.entries(s.grades)) {
    assert.ok(+g >= 1 && +g <= 11, s.id + g);
    assert.ok(l.length >= 10, s.id + g);
    assert.strictEqual(new Set(l.map(t => t.t.toLowerCase())).size, l.length, s.id + g);
  }
});

const sub = require('../netlify/functions/subjects.js');
const T = { topic: { t: 'Kasrlar' } };
const quiz = (n) => Array.from({ length: n }, (_, i) => ({ q: 'S' + i, o: ['a', 'b', 'c', 'd'], a: i % 4, e: 'izoh' }));

test('fanlar: AI darsi tozalanadi, yaroqsiz test savollari tashlanadi', () => {
  const good = { title: 'X', sections: [{ h: 'A', p: ['p'] }, { h: 'B', list: ['l'] }], quiz: [...quiz(8), { q: 'yomon', o: ['a', 'b'], a: 0 }, { q: 'yomon2', o: ['a', 'b', 'c', 'd'], a: 7 }] };
  const r = sub.cleanLesson(good, T);
  assert.strictEqual(r.quiz.length, 8);
  assert.ok(!('a' in r.lesson), 'javoblar dars ichida emas');
  assert.strictEqual(sub.cleanLesson({ sections: good.sections, quiz: quiz(3) }, T), null);
  assert.strictEqual(sub.cleanLesson({ sections: [], quiz: quiz(8) }, T), null);
});

test('fanlar: noto\'g\'ri fan/sinf/raqam rad etiladi', () => {
  assert.throws(() => sub.topicOf({ subject: '__proto__', grade: '5', n: 0 }));
  assert.throws(() => sub.topicOf({ subject: 'fizika', grade: '1', n: 0 }));
  assert.throws(() => sub.topicOf({ subject: 'fizika', grade: '7', n: 999 }));
  assert.throws(() => sub.topicOf({ subject: 'fizika', grade: '7', n: -1 }));
  const t = sub.topicOf({ subject: 'fizika', grade: '7', n: 0 });
  assert.strictEqual(t.id, 'fizika_7_0');
});
