const assert = require('node:assert/strict');
const test = require('node:test');

const uiPromise = import('../languages-html/js/ai-chat-ui.mjs');
const ai = require('../netlify/functions/ai.js');

test('AI response formatter renders readable markdown while escaping HTML', async () => {
  const { formatAIResponse } = await uiPromise;
  const result = formatAIResponse('## Grammar\nUse **careful** wording.\n- First point\n- <img src=x onerror=alert(1)>');

  assert.match(result, /<h3>Grammar<\/h3>/);
  assert.match(result, /<strong>careful<\/strong>/);
  assert.match(result, /<ul><li>First point<\/li><li>&lt;img src=x onerror=alert\(1\)&gt;<\/li><\/ul>/);
  assert.doesNotMatch(result, /<img/);
});

test('very deep thinking is the default unless the user explicitly selects balanced mode', async () => {
  const { getAIThinkingMode } = await uiPromise;
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  let stored = null;
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: { getItem: () => stored }
  });
  try {
    assert.equal(getAIThinkingMode(), 'deep');
    stored = 'balanced';
    assert.equal(getAIThinkingMode(), 'balanced');
  } finally {
    if (previous) Object.defineProperty(globalThis, 'localStorage', previous);
    else delete globalThis.localStorage;
  }
});

test('very deep thinking mode selects reasoning models and elevated generation settings', () => {
  const plan = ai.getThinkingPlan('deep');

  assert.equal(plan.temperature, 0.25);
  assert.equal(plan.maxTokens, 8000);
  assert.ok(plan.chain.some(spec => spec.provider === 'gemini' && spec.thinkingBudget >= 24576));
  assert.ok(plan.chain.some(spec => spec.provider === 'deepseek' && spec.model === 'deepseek-reasoner'));
  assert.match(plan.guidance, /fikrlash zanjirini oshkor qilmang/i);
  assert.equal(ai.getThinkingPlan('balanced'), null);
});
