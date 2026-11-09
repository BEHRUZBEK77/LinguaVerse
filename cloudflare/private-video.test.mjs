import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {validTicket,privateVideo} from './private-video.mjs';
const path='gh:vid-v3-uz-english_b2_0-20261109000000#courseVideos/v3/uz/english_b2_0.mp4';
const key='test-signature-secret';
const now=Math.floor(Date.now()/1000);
const expires=String(now+600);
const sig=createHmac('sha256',key).update(`${expires}\n${path}`).digest('hex');
test('ticket valid for signed MP4, rejects tampering',()=>{
  assert.equal(validTicket(path,expires,sig,key,now),true);
  assert.equal(validTicket(path+'x',expires,sig,key,now),false);
  assert.equal(validTicket(path,String(now-1),sig,key,now),false);
});
test('invalid request never invokes GitHub',async()=>{
  const r=await privateVideo(new Request('https://site.test/.netlify/functions/private-video?path=gh%3Ainvalid'),{VIDEO_SIGNING_SECRET:key});
  assert.equal(r.status,403);
});
