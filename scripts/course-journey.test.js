const test = require('node:test');
const assert = require('node:assert/strict');
const helpers = import('../languages-html/js/course-journey.mjs');

const levels = {
  beginner: [{ id: 'b0' }, { id: 'b1' }],
  elementary: [{ id: 'e0' }],
  advanced: [{ id: 'a0' }],
};

function completedUnit(progress, courseId, unitId) {
  for (const lesson of ['A', 'B', 'C', 'D']) {
    progress[`${courseId}__${unitId}_${lesson}`] = 100;
  }
}

test('course progress is isolated between languages', async () => {
  const { courseProgressKey, isCourseLevelUnlocked, projectCourseProgress } = await helpers;
  const progress = {};
  completedUnit(progress, 'english', 'b0');
  completedUnit(progress, 'german', 'b0');

  assert.equal(courseProgressKey('english', 'b0_A'), 'english__b0_A');
  const englishProgress = projectCourseProgress(progress, 'english');
  const germanProgress = projectCourseProgress(progress, 'german');
  assert.deepEqual(englishProgress, {
    b0_A: 100,
    b0_B: 100,
    b0_C: 100,
    b0_D: 100,
  });
  assert.equal(isCourseLevelUnlocked(levels, englishProgress, 'english', 'elementary'), false);
  assert.equal(isCourseLevelUnlocked(levels, germanProgress, 'german', 'elementary'), false);

  completedUnit(progress, 'english', 'b1');
  assert.equal(isCourseLevelUnlocked(levels, projectCourseProgress(progress, 'english'), 'english', 'elementary'), true);
  assert.equal(isCourseLevelUnlocked(levels, projectCourseProgress(progress, 'german'), 'german', 'elementary'), false);
});

test('legacy progress migrates only when unit IDs belong to one language', async () => {
  const { canMigrateLegacyCourseUnit, migrateCourseProgress } = await helpers;
  const levels = { beginner: [{ id: 'b0' }, { id: 'unique0' }] };
  const migration = migrateCourseProgress({
    b0_A: 100,
    unique0_A: 100,
    unique0_B: 100,
    score_unique0_A: 90,
  }, 'english', levels);

  assert.equal(canMigrateLegacyCourseUnit('b0'), false);
  assert.equal(canMigrateLegacyCourseUnit('unique0'), true);
  assert.equal(migration.progress.b0_A, undefined);
  assert.equal(migration.progress.unique0_A, 100);
  assert.equal(migration.progress.score_unique0_A, 90);
  assert.equal(migration.updates['progress.english__unique0_A'], 100);
  assert.equal(migration.unresolvedLegacyIds.includes('b0'), true);
});

test('the next level unlocks only after every unit in the previous level is complete', async () => {
  const { isCourseLevelUnlocked, projectCourseProgress } = await helpers;
  const progress = {};
  completedUnit(progress, 'english', 'b0');
  const courseProgress = projectCourseProgress(progress, 'english');
  assert.equal(isCourseLevelUnlocked(levels, courseProgress, 'english', 'beginner'), true);
  assert.equal(isCourseLevelUnlocked(levels, courseProgress, 'english', 'elementary'), false);

  completedUnit(progress, 'english', 'b1');
  const updatedProgress = projectCourseProgress(progress, 'english');
  assert.equal(isCourseLevelUnlocked(levels, updatedProgress, 'english', 'elementary'), true);
  assert.equal(isCourseLevelUnlocked(levels, updatedProgress, 'english', 'advanced'), false);
  completedUnit(progress, 'english', 'e0');
  assert.equal(isCourseLevelUnlocked(levels, projectCourseProgress(progress, 'english'), 'english', 'advanced'), true);
});

test('unit access follows the unlock state of its level', async () => {
  const { isCourseUnitUnlocked, projectCourseProgress } = await helpers;
  const progress = {};
  assert.equal(isCourseUnitUnlocked(levels, progress, 'english', 'e0'), false);
  completedUnit(progress, 'english', 'b0');
  completedUnit(progress, 'english', 'b1');
  assert.equal(isCourseUnitUnlocked(levels, projectCourseProgress(progress, 'english'), 'english', 'e0'), true);
  assert.equal(isCourseUnitUnlocked(levels, progress, 'english', 'missing'), false);
});

test('progress summaries report completed units without counting partial lessons', async () => {
  const { courseProgressKey, getCourseLevelStatuses, projectCourseProgress } = await helpers;
  const progress = projectCourseProgress({ [courseProgressKey('english', 'b0_A')]: 100 }, 'english');
  const statuses = getCourseLevelStatuses(levels, progress, 'english');
  assert.equal(statuses[0].completed, 0);
  assert.equal(statuses[1].unlocked, false);
});

test('lesson progress requires 60 percent and unit completion rewards happen once', async () => {
  const { recordCourseLessonAttempt } = await helpers;
  const progress = {};
  assert.deepEqual(recordCourseLessonAttempt(progress, 'b0', 'A', 59), {
    passed: false,
    progressValue: 59,
    completedNow: false,
  });
  assert.deepEqual(recordCourseLessonAttempt(progress, 'b0', 'A', 60), {
    passed: true,
    progressValue: 100,
    completedNow: false,
  });
  for (const lesson of ['B', 'C']) {
    assert.equal(recordCourseLessonAttempt(progress, 'b0', lesson, 100).completedNow, false);
  }
  assert.equal(recordCourseLessonAttempt(progress, 'b0', 'D', 100).completedNow, true);
  assert.equal(recordCourseLessonAttempt(progress, 'b0', 'D', 100).completedNow, false);
});
