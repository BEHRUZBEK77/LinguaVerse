const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

async function loadCertification() {
  return import('../js/language-certificate.mjs');
}

test('certification paths cover the eight supported speaking languages exactly once', async () => {
  const { CERTIFICATION_LANGUAGES } = await loadCertification();
  const ids = CERTIFICATION_LANGUAGES.map(language => language.id);

  assert.deepEqual(ids, ['english', 'german', 'spanish', 'russian', 'turkish', 'arabic', 'korean', 'chinese']);
  assert.equal(new Set(ids).size, ids.length);
  for (const language of CERTIFICATION_LANGUAGES) {
    assert.ok(language.nativeName);
    assert.ok(Array.isArray(language.exams) && language.exams.length > 0);
    assert.ok(language.note);
    assert.ok(language.course.endsWith('.html'));
    assert.ok(fs.existsSync(path.join(__dirname, '..', 'languages-html', language.course.slice(2))));
    for (const exam of language.exams) {
      assert.ok(exam.name);
      assert.ok(exam.officialUrl.startsWith('https://'));
      assert.ok(exam.format);
      assert.ok(exam.targets.length > 0);
      assert.ok(exam.skillIds.length > 0);
    }
  }

  const page = fs.readFileSync(path.join(__dirname, '..', 'languages-html', 'certificate-center.html'), 'utf8');
  assert.match(page, /language-certificate\.mjs/);
  assert.match(page, /id="languageSelect"/);
  assert.match(page, /id="examSelect"/);
  assert.match(page, /id="officialLink"/);
  assert.match(page, /id="readinessChecklist"/);
  assert.match(page, /id="englishPracticeLinks"/);
});

test('study plans cover the selected exam skills and allocate every requested minute', async () => {
  const { CEFR_LEVELS, READINESS_STEPS, createStudyPlan, getCertificationExam, getCertificationLanguage } = await loadCertification();
  const spanishExam = getCertificationExam('spanish', 'SIELE Global');
  const plan = createStudyPlan({
    languageId: 'spanish',
    examName: spanishExam.name,
    target: 'C1',
    dailyMinutes: 61,
    today: new Date(2026, 0, 1),
    examDate: '2026-01-11'
  });

  assert.deepEqual(CEFR_LEVELS, ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']);
  assert.equal(getCertificationLanguage('Spain'), null);
  assert.deepEqual(plan.skills.map(skill => skill.id), ['listening', 'reading', 'writing', 'speaking']);
  assert.equal(plan.skills.length, 4);
  assert.equal(plan.skills.reduce((sum, skill) => sum + skill.minutes, 0), 61);
  assert.equal(plan.daysLeft, 10);
  assert.equal(plan.language.id, 'spanish');
  assert.equal(plan.exam.name, 'SIELE Global');
  assert.equal(plan.target, 'C1');
  assert.equal(READINESS_STEPS.length, 7);
  assert.equal(new Set(READINESS_STEPS.map(step => step.id)).size, READINESS_STEPS.length);
});

test('study plan validation rejects unsupported languages, invalid time and past dates', async () => {
  const { createStudyPlan } = await loadCertification();

  assert.throws(() => createStudyPlan({ languageId: 'Spain', dailyMinutes: 60 }), RangeError);
  assert.throws(() => createStudyPlan({ languageId: 'english', examName: 'TOPIK', dailyMinutes: 60 }), RangeError);
  assert.throws(() => createStudyPlan({ languageId: 'korean', examName: 'TOPIK I', target: '6', dailyMinutes: 60 }), RangeError);
  assert.throws(() => createStudyPlan({ languageId: 'english', dailyMinutes: 14 }), RangeError);
  assert.throws(() => createStudyPlan({ languageId: 'english', dailyMinutes: 361 }), RangeError);
  assert.throws(() => createStudyPlan({
    languageId: 'english',
    dailyMinutes: 60,
    today: new Date(2026, 0, 2),
    examDate: '2026-01-01'
  }), RangeError);
  assert.throws(() => createStudyPlan({
    languageId: 'english',
    dailyMinutes: 60,
    examDate: 'not-a-date'
  }), RangeError);
});

test('exam-specific study plans only include skills actually assessed', async () => {
  const { createStudyPlan } = await loadCertification();
  const topik = createStudyPlan({ languageId: 'korean', examName: 'TOPIK I', target: '2', dailyMinutes: 60 });
  const speakingOnly = createStudyPlan({
    languageId: 'arabic',
    examName: 'ACTFL Arabic OPI/OPIc (qabul qilinsa)',
    target: 'Superior',
    dailyMinutes: 30
  });

  assert.deepEqual(topik.skills.map(skill => skill.id), ['listening', 'reading']);
  assert.equal(topik.skills.reduce((sum, skill) => sum + skill.minutes, 0), 60);
  assert.equal(topik.target, '2');
  assert.deepEqual(speakingOnly.skills.map(skill => skill.id), ['speaking']);
  assert.equal(speakingOnly.skills[0].minutes, 30);
});
