const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vocab = require('../netlify/functions/vocab.js');

test('lug\'at: har tilda 40 000 so\'z, takrorsiz', () => {
  const root = path.join(__dirname, '..', 'vocab');
  const idx = JSON.parse(fs.readFileSync(path.join(root, 'index.json'), 'utf8'));
  for (const lang of Object.keys(vocab.LANGS)) {
    assert.strictEqual(idx.langs[lang], 40000, lang);
    const all = [];
    for (let i = 0; i < 20; i++) all.push(...JSON.parse(fs.readFileSync(path.join(root, lang, `${i}.json`), 'utf8')));
    assert.strictEqual(all.length, 40000, lang);
    assert.strictEqual(new Set(all).size, 40000, lang + ' takror');
  }
});

test('lug\'at: progress tozalanadi (noto\'g\'ri kalit/qiymat tashlanadi, chegaralar)', () => {
  const c = vocab.cleanCards({ '5': [999, 99999, 5, 3], 'x': [250, 1, 1, 1], '40000': [250, 1, 1, 1], '7': [1, 2], '9': ['a', 1, 1, 1] });
  assert.deepStrictEqual(c, { '5': [400, 3650, 5, 3] });
  assert.throws(() => vocab.cleanCards([1, 2]));
});

test('lug\'at: AI javobi tozalanadi, ma\'nosiz yozuv qabul qilinmaydi', () => {
  assert.strictEqual(vocab.cleanDef({ form: 'x' }), null);
  const d = vocab.cleanDef({ uz: 'uy', tr: '/haʊs/', ex: 'x'.repeat(500), extra: 1 });
  assert.strictEqual(d.uz, 'uy');
  assert.strictEqual(d.ex.length, 200);
  assert.ok(!('extra' in d));
});
