const assert = require('node:assert/strict');
const test = require('node:test');

async function loadHelpers() {
  const [units, memory] = await Promise.all([
    import('../languages-html/js/ai-unit-data.mjs'),
    import('../languages-html/js/ai-coach-memory.mjs')
  ]);
  return { ...units, ...memory };
}

test('AI unit vocabulary selection prefers unseen words from the selected level', async () => {
  const { chooseUnitVocabulary } = await loadHelpers();
  const dictionary = [
    { e: 'hola', u: 'salom', l: 'beginner' },
    { e: 'adios', u: 'xayr', l: 'beginner' },
    { e: 'gracias', u: 'rahmat', l: 'beginner' },
    { e: 'perdon', u: 'kechirasiz', l: 'beginner' },
    { e: 'buenos dias', u: 'xayrli tong', l: 'beginner' },
    { e: 'advanced', u: 'murakkab', l: 'advanced' }
  ];

  const words = chooseUnitVocabulary(dictionary, 'e', 'beginner', [{ words: ['hola'] }]);
  assert.equal(words.length, 4);
  assert.equal(words.some(item => item.word === 'hola'), false);
  assert.equal(words.every(item => item.translation), true);
});

test('AI unit parsing accepts JSON fences and normalizes safe lesson data', async () => {
  const { parseAIUnitResponse, normalizeAIUnit } = await loadHelpers();
  const raw = {
    title: '<b>Daily routines</b>',
    desc: 'Kundalik ishlar',
    grammar_rule: 'Present simple',
    grammar_example: 'I work. You study.',
    reading_text: 'This is a sufficiently long short reading passage about a daily routine.',
    reading_qs: [0, 1, 2].map(index => ({
      q: `Question ${index + 1}`,
      opts: ['A', 'B', 'C', 'D'],
      c: index
    }))
  };
  const parsed = parseAIUnitResponse(`\`\`\`json\n${JSON.stringify(raw)}\n\`\`\``);
  const unit = normalizeAIUnit(parsed, {
    id: 'ai_english_beginner_test',
    level: 'beginner',
    vocabulary: [
      { word: 'work', translation: 'ishlamoq' },
      { word: 'study', translation: 'o‘qimoq' },
      { word: 'wake up', translation: 'uyg‘onmoq' },
      { word: 'eat', translation: 'yemoq' }
    ]
  });

  assert.equal(unit.title, 'Daily routines');
  assert.equal(unit.words.length, 4);
  assert.equal(unit.reading_qs[2].c, 2);
  assert.equal(unit.id, 'ai_english_beginner_test');
});

test('AI-generated arguments are safe in inline HTML handlers and round-trip Unicode', async () => {
  const { encodeInlineHandlerArg } = await loadHelpers();
  const value = `Let's study "today" — café`;
  const encoded = encodeInlineHandlerArg(value);
  assert.doesNotMatch(encoded, /['"<>()!]/);
  assert.equal(decodeURIComponent(encoded), value);
});

test('AI unit validation rejects malformed answer keys and prevents HTML injection', async () => {
  const { normalizeAIUnit } = await loadHelpers();
  const malformed = {
    title: 'Daily routine',
    desc: 'Desc',
    grammar_rule: 'Rule',
    grammar_example: 'Example',
    reading_text: 'This is a sufficiently long short reading passage about a daily routine.',
    reading_qs: [0, 1, 2].map(index => ({
      q: `Question ${index + 1}`,
      opts: ['A', 'B', 'C', 'D'],
      c: index === 1 ? 4 : index
    }))
  };
  const vocabulary = ['one', 'two', 'three', 'four'].map(word => ({ word }));
  assert.throws(() => normalizeAIUnit(malformed, { id: 'invalid', level: 'beginner', vocabulary }), /savoli 2 noto‘g‘ri/);

  malformed.reading_qs[1].c = 1;
  malformed.title = '<img src=x onerror=alert(1)>';
  assert.throws(() => normalizeAIUnit(malformed, { id: 'safe', level: 'beginner', vocabulary }), /zarur dars matnlari/);
});

test('coach memory accumulates capped learning notes without saving conversation transcripts', async () => {
  const { mergeCoachMemory, completeCoachMemorySession, formatCoachMemoryContext, getCoachMemoryDocumentId } = await loadHelpers();
  let memory = mergeCoachMemory({}, {
    topic: 'Travel',
    vocabulary: ['itinerary', 'boarding pass'],
    strength: 'Clear pronunciation',
    recurringError: 'Past tense endings',
    nextStep: 'Retell a recent trip',
    summary: 'Practised travel planning and past tense.'
  });
  memory = completeCoachMemorySession(memory, memory.summary);
  const context = formatCoachMemoryContext(memory);

  assert.equal(memory.sessions, 1);
  assert.equal(getCoachMemoryDocumentId('english'), 'ai_coach_memory_english');
  assert.deepEqual(memory.topics, ['Travel']);
  assert.match(context, /Past tense endings/);
  assert.doesNotMatch(context, /assistant|user transcript/i);
});
