const test = require('node:test');
const assert = require('node:assert/strict');
const { prepareAdminAIEvent } = require('../netlify/functions/admin-ai.js');

test('admin AI defaults to the strongest configured model', () => {
  const result = prepareAdminAIEvent({
    httpMethod: 'POST',
    headers: { authorization: 'Bearer test-token' },
    body: JSON.stringify({ messages: [{ role: 'user', content: 'Dashboard holati?' }] })
  });

  assert.equal(result.error, undefined);
  const payload = JSON.parse(result.event.body);
  assert.equal(payload.model, 'megaplus');
  assert.equal(payload.messages.length, 1);
  assert.equal(result.event.headers.authorization, 'Bearer test-token');
});

test('team mode prepares read-only expert agents without persisting its UI mode flag', () => {
  const result = prepareAdminAIEvent({
    headers: {},
    body: JSON.stringify({
      mode: 'team',
      messages: [{ role: 'user', content: 'Yangi kursni tahlil qil.' }]
    })
  });

  assert.equal(result.error, undefined);
  assert.equal(result.teamMode, true);
  const payload = JSON.parse(result.event.body);
  assert.equal(payload.model, 'megaplus');
  assert.equal(Object.hasOwn(payload, 'mode'), false);
  assert.equal(payload.messages[0].role, 'system');
  assert.match(payload.messages[0].content, /hech qanday hisob/);
  assert.equal(payload.messages[1].content, 'Yangi kursni tahlil qil.');
  assert.equal(payload.teamMode, undefined);
});

test('admin AI request preparation rejects malformed payloads', () => {
  assert.match(prepareAdminAIEvent({ body: '{' }).error, /JSON/);
  assert.match(prepareAdminAIEvent({ body: '[]' }).error, /format/);
  assert.match(prepareAdminAIEvent({
    body: JSON.stringify({ mode: 'team', messages: 'not-an-array' })
  }).error, /xabarlari/);
  assert.match(prepareAdminAIEvent({
    body: JSON.stringify({ mode: 'team', messages: [null] })
  }).error, /xabarlari/);
  assert.match(prepareAdminAIEvent({
    body: JSON.stringify({ mode: 'team', messages: [{ role: 'user', content: 'x'.repeat(12_001) }] })
  }).error, /xabarlari/);
});
