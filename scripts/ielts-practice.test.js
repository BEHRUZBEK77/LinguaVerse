const assert = require('node:assert/strict');
const test = require('node:test');

async function loadPractice() {
  return import('../js/ielts-practice.mjs');
}

test('reading mini-practice scores all correct and missing answers without band conversion', async () => {
  const { READING_PRACTICE, scoreReading } = await loadPractice();
  const perfect = Object.fromEntries(READING_PRACTICE.questions.map(question => [question.id, question.answer]));
  const result = scoreReading(perfect);

  assert.equal(READING_PRACTICE.questions.length, 10);
  assert.equal(result.correct, 10);
  assert.equal(result.total, 10);
  assert.equal(result.percentage, 100);
  assert.equal('band' in result, false);

  const empty = scoreReading({});
  assert.equal(empty.correct, 0);
  assert.equal(empty.total, 10);
});

test('listening mini-practice scores answers against the original script question set', async () => {
  const { LISTENING_PRACTICE, scoreListening } = await loadPractice();
  const perfect = Object.fromEntries(LISTENING_PRACTICE.questions.map(question => [question.id, question.answer]));
  const result = scoreListening(perfect);

  assert.ok(LISTENING_PRACTICE.script.length > 500);
  assert.equal(LISTENING_PRACTICE.questions.length, 8);
  assert.equal(result.correct, 8);
  assert.equal(result.total, 8);
  assert.equal('band' in result, false);
});

test('question banks have valid answer indexes and explanations', async () => {
  const { LISTENING_PRACTICE, READING_PRACTICE } = await loadPractice();
  for (const question of [...READING_PRACTICE.questions, ...LISTENING_PRACTICE.questions]) {
    assert.ok(question.prompt.length > 10);
    assert.ok(question.explanation.length > 10);
    assert.ok(Number.isInteger(question.answer));
    const optionCount = question.options?.length || 3;
    assert.ok(question.answer >= 0 && question.answer < optionCount);
  }
});
