'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { VIDEO_LIMITS, effectivePlan, canWatch, creatorActive } = require('../netlify/functions/_video-entitlements.js');
const now=Date.parse('2026-11-09T12:00:00Z');
test('exact per-language video caps',()=>{
  assert.deepEqual(VIDEO_LIMITS,{free:10,nova:30,mega:50,premium:70,ultra:150,youtuber:150});
  for(const [plan,cap] of Object.entries(VIDEO_LIMITS)){
    const user=plan==='youtuber'?{creator:{status:'active',activeUntil:new Date(now+3600000)}}:{plan,planExpiry:new Date(now+3600000)};
    assert.equal(effectivePlan(user,now),plan);
    assert.equal(canWatch(user,'english','b2',0,now),true);
    if(cap<150) assert.equal(canWatch(user,'english',cap<100?'b2':'c2',cap<100?cap:cap-100,now),false);
    if(cap>100)assert.equal(canWatch(user,'english','c2',49,now),true);
  }
});
test('course purchases and PRO exceptions',()=>{
  const u={courses:{english_c2:true}};
  assert.equal(canWatch(u,'english','c2',49,now),true);
  assert.equal(canWatch(u,'english','b2',99,now),true);
  assert.equal(canWatch(u,'english','pro',0,now),false);
  assert.equal(canWatch({courses:{english_pro:true}},'english','pro',49,now),true);
});
test('creator expires or is revoked automatically',()=>{
  const creator={status:'active',activeUntil:new Date(now+10_000)};
  assert.equal(creatorActive({creator},now),true);
  assert.equal(creatorActive({creator},now+10_001),false);
  assert.equal(effectivePlan({plan:'mega',planExpiry:new Date(now+86400000),creator},now+10_001),'mega');
  creator.status='paused';assert.equal(effectivePlan({creator},now),'free');
});
