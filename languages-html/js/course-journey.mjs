const LESSON_KEYS = ['A', 'B', 'C', 'D'];

const LEVEL_LABELS = {
  english: ['A1 · Boshlang‘ich', 'A2 · Asosiy', 'B1 · O‘rta', 'B2–C1 · Ilg‘or'],
  german: ['A1 · Anfänger', 'A2 · Grundlagen', 'B1 · Mittelstufe', 'B2 · Fortgeschritten', 'C1–C2 · Kompetent'],
  spanish: ['A1 · Principiante', 'A2 · Básico', 'B1 · Intermedio', 'B2–C1 · Avanzado'],
  russian: ['A1 · Начальный', 'A2 · Базовый', 'B1 · Средний', 'B2–C1 · Продвинутый'],
  turkish: ['A1 · Başlangıç', 'A2 · Temel', 'B1 · Orta', 'B2–C1 · İleri'],
  arabic: ['A1 · مبتدئ', 'A2 · أساسي', 'B1 · متوسط', 'B2–C1 · متقدم'],
  korean: ['1-bosqich · Boshlang‘ich', '2-bosqich · Asosiy', '3-bosqich · O‘rta', '4-bosqich · Ilg‘or'],
  chinese: ['HSK 1 · 基础', 'HSK 2 · 初级', 'HSK 3–4 · 中级', 'HSK 5–6 · 高级'],
};

const SHARED_LEGACY_UNIT_IDS = new Set([
  'b0', 'b1', 'b2', 'b3', 'b4', 'b5',
  'e1', 'e2', 'e3', 'i1', 'i2', 'p1', 'p2', 'a1', 'a2',
  'review_beginner_7', 'review_beginner_8', 'review_beginner_9',
  'review_beginner_10', 'review_beginner_11', 'review_beginner_12',
  'review_beginner_13', 'review_beginner_14', 'review_beginner_15',
  'review_beginner_16', 'review_beginner_17', 'review_beginner_18',
  'review_beginner_19', 'review_beginner_20',
  'review_elementary_4', 'review_elementary_5', 'review_elementary_6',
  'review_elementary_7', 'review_elementary_8', 'review_elementary_9',
  'review_elementary_10', 'review_elementary_11', 'review_elementary_12',
  'review_elementary_14', 'review_elementary_15',
  'review_pre-intermediate_3', 'review_pre-intermediate_4',
  'review_pre-intermediate_5', 'review_pre-intermediate_6',
  'review_pre-intermediate_7',
  'review_advanced_3', 'review_advanced_4', 'review_advanced_5',
  'review_advanced_6', 'review_advanced_7',
]);

export function canMigrateLegacyCourseUnit(unitId) {
  return !SHARED_LEGACY_UNIT_IDS.has(unitId);
}

export function courseProgressKey(courseId, key) {
  if (!courseId || !key) throw new TypeError('Course and progress keys are required');
  return `${courseId}__${key}`;
}

export function projectCourseProgress(progress, courseId) {
  const prefix = `${courseId}__`;
  return Object.fromEntries(
    Object.entries(progress || {})
      .filter(([key]) => key.startsWith(prefix))
      .map(([key, value]) => [key.slice(prefix.length), value])
  );
}

export function migrateCourseProgress(progress, courseId, levels, storageField = 'progress') {
  const source = progress || {};
  const projected = projectCourseProgress(source, courseId);
  const updates = {};
  const unresolvedLegacyIds = new Set();

  for (const units of Object.values(levels || {})) {
    for (const unit of units) {
      if (!canMigrateLegacyCourseUnit(unit.id)) {
        if (LESSON_KEYS.some(lesson =>
          Object.prototype.hasOwnProperty.call(source, `${unit.id}_${lesson}`) &&
          !Object.prototype.hasOwnProperty.call(source, courseProgressKey(courseId, `${unit.id}_${lesson}`))
        )) unresolvedLegacyIds.add(unit.id);
        continue;
      }
      for (const lesson of LESSON_KEYS) {
        const key = `${unit.id}_${lesson}`;
        const namespacedKey = courseProgressKey(courseId, key);
        if (!Object.prototype.hasOwnProperty.call(source, namespacedKey) &&
            Object.prototype.hasOwnProperty.call(source, key)) {
          projected[key] = source[key];
          updates[`${storageField}.${namespacedKey}`] = source[key];
        }

        const scoreKey = `score_${key}`;
        const namespacedScoreKey = courseProgressKey(courseId, scoreKey);
        if (!Object.prototype.hasOwnProperty.call(source, namespacedScoreKey) &&
            Object.prototype.hasOwnProperty.call(source, scoreKey)) {
          projected[scoreKey] = source[scoreKey];
          updates[`${storageField}.${namespacedScoreKey}`] = source[scoreKey];
        }
      }
    }
  }

  return { progress: projected, updates, unresolvedLegacyIds: [...unresolvedLegacyIds] };
}

function isUnitComplete(unit, progress, courseId) {
  return LESSON_KEYS.every(key => Number(progress[`${unit.id}_${key}`]) >= 100);
}

export function getCourseLevelStatuses(levels, progress, courseId) {
  const keys = Object.keys(levels || {});
  return keys.map((key, index) => {
    const units = levels[key];
    if (!Array.isArray(units)) throw new TypeError(`Units for ${key} must be an array`);
    const completed = units.filter(unit => isUnitComplete(unit, progress || {}, courseId)).length;
    const unlocked = index === 0 || keys.slice(0, index).every(previous =>
      levels[previous].length > 0 &&
      levels[previous].every(unit => isUnitComplete(unit, progress || {}, courseId))
    );
    return {
      key,
      label: LEVEL_LABELS[courseId]?.[index] || `Bosqich ${index + 1}`,
      completed,
      total: units.length,
      unlocked,
    };
  });
}

export function isCourseLevelUnlocked(levels, progress, courseId, targetLevel) {
  return getCourseLevelStatuses(levels, progress, courseId)
    .some(status => status.key === targetLevel && status.unlocked);
}

export function isCourseUnitUnlocked(levels, progress, courseId, unitId) {
  const level = Object.keys(levels || {}).find(key =>
    levels[key].some(unit => String(unit.id) === String(unitId))
  );
  return Boolean(level && isCourseLevelUnlocked(levels, progress, courseId, level));
}

export function recordCourseLessonAttempt(progress, unitId, lessonKey, score) {
  if (!LESSON_KEYS.includes(lessonKey)) throw new RangeError(`Unknown lesson: ${lessonKey}`);
  const key = `${unitId}_${lessonKey}`;
  const percentage = Math.min(100, Math.max(0, Number(score) || 0));
  const wasComplete = LESSON_KEYS.every(lesson =>
    Number(progress[`${unitId}_${lesson}`]) >= 100
  );
  const passed = percentage >= 60;
  const progressValue = passed
    ? 100
    : Math.max(Number(progress[key]) || 0, percentage);
  progress[key] = progressValue;
  const allLessonsComplete = LESSON_KEYS.every(lesson =>
    Number(progress[`${unitId}_${lesson}`]) >= 100
  );
  return {
    passed,
    progressValue,
    completedNow: !wasComplete && allLessonsComplete,
  };
}

export function renderCourseJourney({ courseId, levels, progress, activeLevel, onSelect }) {
  const statuses = getCourseLevelStatuses(levels, progress, courseId);
  const firstUnlocked = statuses.find(status => status.unlocked);
  const active = statuses.find(status =>
    status.key === activeLevel && status.unlocked && status.completed < status.total
  ) || statuses.find(status => status.unlocked && status.completed < status.total) ||
    [...statuses].reverse().find(status => status.unlocked) || firstUnlocked;
  if (!active) return '';

  const journey = document.getElementById('courseJourney') || document.createElement('section');
  journey.id = 'courseJourney';
  journey.className = 'course-journey';
  journey.setAttribute('aria-label', 'Kurs yo‘nalishi');
  journey.innerHTML = `
    <div class="course-journey-copy">
      <div>
        <p class="course-journey-eyebrow">BOSQICHMA-BOSQICH O‘RGANISH</p>
        <h2>Sizning o‘quv yo‘lingiz</h2>
        <p class="course-journey-hint">Bir bosqichni yakunlang — keyingisi shunda ochiladi.</p>
      </div>
      <div class="course-journey-count" id="courseJourneyCount"></div>
    </div>
    <div class="course-journey-progress" role="progressbar" aria-label="Joriy bosqich bajarilishi" aria-valuemin="0" aria-valuemax="100">
      <span id="courseJourneyProgress"></span>
    </div>
    <div class="course-journey-milestone" id="courseJourneyMilestone" hidden>
      <span><strong id="courseMilestoneTitle"></strong> Keyingi bosqich va do‘kondagi mukofotlarni ko‘ring.</span>
      <a href="./shop.html">Do‘konga o‘tish <span aria-hidden="true">→</span></a>
    </div>`;

  const tabs = document.getElementById('levelTabs');
  if (tabs) {
    tabs.classList.add('course-level-tabs');
    tabs.replaceChildren(...statuses.map(status => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `level-tab${status.key === active.key ? ' active' : ''}`;
      button.dataset.level = status.key;
      button.disabled = !status.unlocked;
      button.setAttribute('aria-current', status.key === active.key ? 'step' : 'false');
      button.setAttribute('aria-label', `${status.label}: ${status.completed}/${status.total} unit${status.unlocked ? '' : ', qulflangan'}`);
      button.innerHTML = `<span class="course-level-tab-label"></span><span class="course-level-tab-count"></span>`;
      button.querySelector('.course-level-tab-label').textContent = status.label;
      button.querySelector('.course-level-tab-count').textContent = status.unlocked
        ? `${status.completed}/${status.total}`
        : '🔒';
      button.addEventListener('click', () => onSelect(status.key, button));
      return button;
    }));
  }

  if (tabs && journey.parentElement !== tabs.parentElement) {
    tabs.parentElement.insertBefore(journey, tabs);
  }

  const activeProgress = active.total ? Math.round((active.completed / active.total) * 100) : 0;
  const count = document.getElementById('courseJourneyCount');
  const progressBar = document.getElementById('courseJourneyProgress');
  if (count) count.textContent = `${active.label} · ${active.completed}/${active.total} unit`;
  if (progressBar) progressBar.style.width = `${activeProgress}%`;
  const progressTrack = journey.querySelector('.course-journey-progress');
  if (progressTrack) progressTrack.setAttribute('aria-valuenow', String(activeProgress));

  const firstLevel = statuses[0];
  const milestone = document.getElementById('courseJourneyMilestone');
  if (milestone) milestone.hidden = !firstLevel || firstLevel.total === 0 || firstLevel.completed !== firstLevel.total;
  const milestoneTitle = document.getElementById('courseMilestoneTitle');
  if (milestoneTitle && firstLevel) milestoneTitle.textContent = `${firstLevel.label.split(' · ')[0]} yakunlandi!`;
  return active.key;
}
