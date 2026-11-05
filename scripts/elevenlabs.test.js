const assert = require('node:assert/strict');
const test = require('node:test');
const { synthesizeElevenLabs, synthesizeConfigured } = require('../netlify/functions/azure-speech.js');

test('ElevenLabs TTS sends credentials only server-side and returns playable audio', async () => {
  let request;
  const result = await synthesizeElevenLabs({
    text: 'Hello there',
    lang: 'en-US',
    rate: 0.75
  }, {
    apiKey: 'secret-elevenlabs-key',
    defaultVoiceId: 'voice_123456',
    fetchImpl: async (url, options) => {
      request = { url, options };
      return { ok: true, arrayBuffer: async () => Buffer.from('audio bytes') };
    }
  });

  assert.match(request.url, /text-to-speech\/voice_123456/);
  assert.equal(request.options.headers['xi-api-key'], 'secret-elevenlabs-key');
  assert.equal(JSON.parse(request.options.body).model_id, 'eleven_multilingual_v2');
  assert.equal(JSON.parse(request.options.body).voice_settings.speed, 0.75);
  assert.equal(result.mime, 'audio/mpeg');
  assert.equal(result.provider, 'elevenlabs');
  assert.equal(Buffer.from(result.audio, 'base64').toString(), 'audio bytes');
  assert.equal(JSON.stringify(result).includes('secret-elevenlabs-key'), false);
});

test('the configured Uzbek voice is used only for Uzbek speech', async () => {
  const voiceRequests = [];
  const fetchImpl = async url => {
    voiceRequests.push(url);
    return { ok: true, arrayBuffer: async () => Buffer.from('audio bytes') };
  };
  const shared = {
    apiKey: 'test-key',
    uzbekVoiceId: 'YPq6xmLsGXihVzYVFvZw',
    defaultVoiceId: 'general_multilingual_voice',
    fetchImpl
  };

  const uzbek = await synthesizeElevenLabs({ text: 'Salom', lang: 'uz' }, shared);
  const english = await synthesizeElevenLabs({ text: 'Hello', lang: 'en-US' }, shared);
  assert.equal(uzbek.voice, 'YPq6xmLsGXihVzYVFvZw');
  assert.equal(english.voice, 'general_multilingual_voice');
  assert.match(voiceRequests[0], /text-to-speech\/YPq6xmLsGXihVzYVFvZw/);
  assert.match(voiceRequests[1], /text-to-speech\/general_multilingual_voice/);
});

test('uses the requested voice ID as the Uzbek default when no override is saved', async () => {
  const result = await synthesizeElevenLabs({ text: 'Salom', lang: 'uz-UZ' }, {
    apiKey: 'test-key',
    uzbekVoiceId: '',
    fetchImpl: async () => ({ ok: true, arrayBuffer: async () => Buffer.from('audio bytes') })
  });
  assert.equal(result.voice, 'YPq6xmLsGXihVzYVFvZw');
});

test('ElevenLabs TTS reports service errors without exposing the API key', async () => {
  await assert.rejects(
    synthesizeElevenLabs({ text: 'Hello', lang: 'en-US' }, {
      apiKey: 'secret-elevenlabs-key',
      defaultVoiceId: 'voice_123456',
      fetchImpl: async () => ({ ok: false, status: 401 })
    }),
    error => error.message === 'ElevenLabs HTTP 401'
      && !error.message.includes('secret-elevenlabs-key')
  );
});

test('Speaking prefers ElevenLabs and falls back to Azure only when available', async () => {
  let azureCalled = false;
  const preferred = await synthesizeConfigured({ text: 'Hello' }, {
    elevenLabsKey: 'configured',
    elevenLabs: async () => ({ provider: 'elevenlabs' }),
    azure: async () => {
      azureCalled = true;
      return { provider: 'azure' };
    }
  });
  assert.equal(preferred.provider, 'elevenlabs');
  assert.equal(azureCalled, false);

  const fallback = await synthesizeConfigured({ text: 'Hello' }, {
    elevenLabsKey: 'configured',
    azureKey: 'configured',
    elevenLabs: async () => { throw new Error('ElevenLabs unavailable'); },
    azure: async () => ({ provider: 'azure' }),
    onFallback: () => {}
  });
  assert.equal(fallback.provider, 'azure');
});
