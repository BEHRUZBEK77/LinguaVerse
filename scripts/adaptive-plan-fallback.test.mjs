import assert from 'node:assert/strict';
import test from 'node:test';
import { createFallbackDailyPlan } from '../languages-html/js/adaptive-plan-fallback.mjs';

test('fallback daily plan preserves the engine task contract and daily duration', () => {
  const plan = createFallbackDailyPlan({
    weak: [['speaking', 18]],
    userLevel: 'B1'
  }, { stats: { streak: 4 } });

  assert.equal(plan.isFallback, true);
  assert.equal(plan.totalMinutes, 30);
  assert.equal(plan.tasks.length, 5);
  assert.equal(plan.tasks.reduce((total, task) => total + task.min, 0), plan.totalMinutes);
  assert.deepEqual(plan.tasks.map(task => task.order), [1, 2, 3, 4, 5]);
  assert.match(plan.tasks[0].desc, /speaking/);
  assert.match(plan.greeting, /4 kunlik/);
  for (const task of plan.tasks) {
    assert.ok(task.type && task.skill && task.title && task.desc);
    assert.ok(Number.isInteger(task.xp) && task.xp > 0);
  }
});

test('fallback plan handles missing learning history', () => {
  const plan = createFallbackDailyPlan({}, {});

  assert.equal(plan.isFallback, true);
  assert.equal(plan.tasks.length, 5);
  assert.match(plan.greeting, /muntazamlik/);
  assert.match(plan.weeklyGoal, /har kuni/);
});
