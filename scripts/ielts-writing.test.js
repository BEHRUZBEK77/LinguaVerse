const assert = require('node:assert/strict');
const test = require('node:test');

async function loadWritingHelpers() {
  return import('../js/ielts-writing.mjs');
}

test('estimates an IELTS task band from the four rubric criteria, rounded to half bands', async () => {
  const { normalizeWritingAssessment } = await loadWritingHelpers();
  const result = normalizeWritingAssessment({
    band: 9,
    scores: { task: 7, coherence: 8, vocabulary: 7, grammar: 8 }
  }, 'ielts2');

  assert.equal(result.band, 7.5);
  assert.deepEqual(result.scores, { task: 7, coherence: 8, vocabulary: 7, grammar: 8 });
});

test('uses the correct task criterion labels for Task 1 and Task 2', async () => {
  const { IELTS_WRITING_CRITERIA } = await loadWritingHelpers();
  assert.equal(IELTS_WRITING_CRITERIA.ielts1[0][1], 'Task Achievement');
  assert.equal(IELTS_WRITING_CRITERIA.ielts1gt[0][1], 'Task Achievement');
  assert.equal(IELTS_WRITING_CRITERIA.ielts2[0][1], 'Task Response');
});

test('rejects invalid IELTS assessment criteria rather than displaying a fabricated band', async () => {
  const { normalizeWritingAssessment } = await loadWritingHelpers();
  assert.equal(normalizeWritingAssessment({
    band: 9,
    scores: { task: 9, coherence: 9, vocabulary: 9 }
  }, 'ielts2'), null);
  assert.equal(normalizeWritingAssessment({
    band: 9,
    scores: { task: 10, coherence: 9, vocabulary: 9, grammar: 9 }
  }, 'ielts2'), null);
  assert.equal(normalizeWritingAssessment({
    band: 9,
    scores: { task: null, coherence: 9, vocabulary: 9, grammar: 9 }
  }, 'ielts2'), null);
  assert.equal(normalizeWritingAssessment({
    band: 9,
    scores: { task: 6.5, coherence: 7, vocabulary: 7, grammar: 7 }
  }, 'ielts2'), null);
});

test('writing progress context uses recent records for the same task type only', async () => {
  const { summarizeWritingProgress } = await loadWritingHelpers();
  const context = summarizeWritingProgress([
    {
      type: 'ielts2',
      scores: { task: 7, coherence: 5, vocabulary: 7, grammar: 6 },
      skillFocus: ['Use clearer topic sentences']
    },
    { type: 'ielts1', scores: { task: 3, coherence: 3, vocabulary: 3, grammar: 3 } }
  ], 'ielts2');

  assert.match(context, /Lowest recent criterion: Coherence and Cohesion/);
  assert.match(context, /Use clearer topic sentences/);
  assert.doesNotMatch(context, /Academic Task 1/);
});

test('writing progress context stays useful for non-IELTS practice without historical scores', async () => {
  const { summarizeWritingProgress } = await loadWritingHelpers();
  assert.equal(
    summarizeWritingProgress([{ type: 'essay', skillFocus: ['Support claims with examples'] }], 'essay'),
    'Previous attempts for this same task type: 1.\nPreviously identified focus areas: Support claims with examples.'
  );
});
