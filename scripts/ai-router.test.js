const assert = require('node:assert/strict');
const test = require('node:test');
const ai = require('../netlify/functions/ai.js');

test('every AI tier has at least one configured deep-reasoning route', () => {
  for (const [model, config] of Object.entries(ai.REGISTRY)) {
    assert.ok(
      config.chain.some(spec =>
        spec.reasoning === 'high'
        || spec.thinkingBudget > 0
        || (spec.provider === 'deepseek' && spec.model === 'deepseek-reasoner')
      ),
      `${model} is missing a deep-reasoning route`
    );
  }
});

test('shared quality guidance asks for careful answers without exposing hidden reasoning', () => {
  const messages = ai.withQualityGuide([{ role: 'user', content: 'Explain this grammar.' }]);
  assert.equal(messages[0].role, 'system');
  assert.match(messages[0].content, /ichki fikrlash zanjirini oshkor qilmang/i);
  assert.equal(messages[1].content, 'Explain this grammar.');
});

test('the chosen API provider is routed first for normal and deep requests', () => {
  const normal = ai.prioritizeProviderChain(ai.REGISTRY.nova.chain, 'deepseek', 'nova');
  assert.equal(normal[0].provider, 'deepseek');

  const deep = ai.prioritizeProviderChain(ai.DEEP_REASONING_CHAIN, 'groq', 'megaplus', true);
  assert.equal(deep[0].provider, 'groq');
  assert.equal(deep[0].reasoning, 'high');
  assert.match(ai.getThinkingPlan('deep').guidance, /chekka holatlar/i);
});

test('team analysis includes the selected primary API as its first expert provider', () => {
  const providers = ai.getConfiguredTeamSpecs('megaplus', () => true, 'deep', 'azure');
  assert.equal(providers[0].provider, 'azure');
});

test('web search is explicit or triggered by a request for current information', () => {
  assert.equal(ai.wantsWebSearch({}, [{ role: 'user', content: 'Internetdan so‘nggi ma’lumotlarni qidir.' }]), true);
  assert.equal(ai.wantsWebSearch({}, [{ role: 'user', content: 'Find the latest news about this exam.' }]), true);
  assert.equal(ai.wantsWebSearch({}, [{ role: 'user', content: 'Explain the past tense.' }]), false);
  assert.equal(ai.wantsWebSearch({ webSearch: true }, [{ role: 'user', content: 'Explain this.' }]), true);
});

test('grounding parser extracts only unique secure citations', () => {
  const result = ai.getGroundingOutput({
    steps: [{
      type: 'model_output',
      content: [{
        type: 'text',
        text: 'Recent information.',
        annotations: [
          { type: 'url_citation', title: 'Official', url: 'https://example.com/current' },
          { type: 'url_citation', title: 'Duplicate', url: 'https://example.com/current' },
          { type: 'url_citation', title: 'Insecure', url: 'http://example.com' },
          { type: 'url_citation', title: 'Malformed', url: 'https://[' }
        ]
      }]
    }]
  });
  assert.equal(result.text, 'Recent information.');
  assert.deepEqual(result.sources, [{ title: 'Official', url: 'https://example.com/current' }]);
});

test('web search calls Gemini grounding and returns cited sources', async () => {
  let request;
  const result = await ai.searchWeb([
    { role: 'user', content: 'What are the latest exam changes?' }
  ], {
    getApiKey: () => 'test-key',
    fetchImpl: async (url, options) => {
      request = { url, options };
      return {
        ok: true,
        json: async () => ({
          steps: [{
            type: 'model_output',
            content: [{
              type: 'text',
              text: 'There are recent changes.',
              annotations: [{ type: 'url_citation', title: 'Exam board', url: 'https://example.com/exam' }]
            }]
          }]
        })
      };
    }
  });

  assert.equal(request.url, 'https://generativelanguage.googleapis.com/v1beta/interactions');
  assert.equal(request.options.headers['x-goog-api-key'], 'test-key');
  const payload = JSON.parse(request.options.body);
  assert.deepEqual(payload.tools, [{ type: 'google_search' }]);
  assert.equal(payload.generation_config.thinking_level, 'high');
  assert.equal(result.text, 'There are recent changes.');
  assert.equal(result.sources[0].url, 'https://example.com/exam');
});

test('team mode runs three independent expert prompts', async () => {
  const calls = [];
  const providers = Object.fromEntries(
    ['gemini', 'deepseek', 'openrouter', 'groq', 'cloudflare', 'azure'].map(provider => [
      provider,
      async (spec, messages) => {
        calls.push({ provider, spec, messages });
        return { backend: `${provider}:test-model`, text: `Review by ${provider}` };
      }
    ])
  );
  const result = await ai.runTeamAnalysis('megaplus', [
    { role: 'user', content: 'Evaluate the new lesson flow.' }
  ], {
    isConfigured: () => true,
    providerFunctions: providers,
    timeoutMs: 100
  });

  test('team mode applies the deep-thinking route and larger analysis budget when requested', async () => {
    const calls = [];
    const providers = Object.fromEntries(
      ['gemini', 'deepseek', 'openrouter', 'groq', 'cloudflare', 'azure'].map(provider => [
        provider,
        async (spec, messages, config) => {
          calls.push({ provider, spec, messages, config });
          return { backend: `${provider}:test-model`, text: `Review by ${provider}` };
        }
      ])
    );
    await ai.runTeamAnalysis('megaplus', [
      { role: 'user', content: 'Evaluate the new lesson flow.' }
    ], {
      thinkingMode: 'deep',
      isConfigured: () => true,
      providerFunctions: providers,
      timeoutMs: 100
    });

    assert.equal(calls.length, 3);
    assert.ok(calls.every(call => call.config.maxTokens === 3000));
    assert.ok(calls.every(call => call.messages.some(message => /fikrlash zanjirini oshkor qilmang/i.test(message.content))));
    assert.equal(calls[0].spec.model, 'gemini-2.5-pro');
  });

  assert.equal(calls.length, 3);
  assert.equal(new Set(calls.map(call => call.provider)).size, 3);
  assert.match(calls[0].messages.at(-1).content, /ta’lim metodisti/i);
  assert.match(calls[1].messages.at(-1).content, /mahsulot muhandisi/i);
  assert.match(calls[2].messages.at(-1).content, /xavfsizlik va maxfiylik/i);
  assert.equal(result.backends.length, 3);
  assert.match(result.text, /Ta’lim va til sifati/);
  assert.match(result.text, /Xavfsizlik va maxfiylik/);
});
