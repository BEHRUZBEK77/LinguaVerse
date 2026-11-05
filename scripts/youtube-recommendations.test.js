const assert = require('node:assert/strict');
const test = require('node:test');
const recommendations = import('../languages-html/js/youtube-recommendations.mjs');

test('recommends videos for the lowest-scoring English skill and exam level', async () => {
  const { buildRecommendation } = await recommendations;
  const result = buildRecommendation({
    language: 'English',
    exam: 'IELTS',
    level: 'intermediate',
    skills: { reading: 58, writing: 31, speaking: 45, listening: 22, grammar: 49 }
  });
  assert.equal(result.skill, 'listening');
  assert.equal(result.score, 22);
  assert.equal(result.hasAssessment, true);
  assert.match(result.query, /English listening .*B1 intermediate.*IELTS/);
});

test('maps German skill field names and selects the corresponding weak skill', async () => {
  const { buildRecommendation } = await recommendations;
  const result = buildRecommendation({
    language: 'Deutsch',
    level: 'beginner',
    skills: { lesen: 45, schreiben: 38, sprechen: 26, hoeren: 30, grammatik: 40 },
    skillKeys: { reading: 'lesen', writing: 'schreiben', speaking: 'sprechen', listening: 'hoeren', grammar: 'grammatik' },
    skillLabels: { speaking: 'Sprechen und Aussprache' }
  });
  assert.equal(result.skill, 'speaking');
  assert.equal(result.score, 26);
  assert.match(result.query, /Sprechen und Aussprache/);
});

test('new learners get a transparent beginner recommendation until skill scores exist', async () => {
  const { buildRecommendation } = await recommendations;
  const result = buildRecommendation({
    language: 'Español',
    level: 'principiante',
    skills: { reading: 0, writing: 0, speaking: 0, listening: 0, grammar: 0 }
  });
  assert.equal(result.hasAssessment, false);
  assert.equal(result.level, 'A1 beginner');
});
