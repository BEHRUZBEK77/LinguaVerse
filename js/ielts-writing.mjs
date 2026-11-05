export const IELTS_WRITING_CRITERIA = Object.freeze({
  ielts1: [
    ['task', 'Task Achievement'],
    ['coherence', 'Coherence and Cohesion'],
    ['vocabulary', 'Lexical Resource'],
    ['grammar', 'Grammatical Range and Accuracy']
  ],
  ielts1gt: [
    ['task', 'Task Achievement'],
    ['coherence', 'Coherence and Cohesion'],
    ['vocabulary', 'Lexical Resource'],
    ['grammar', 'Grammatical Range and Accuracy']
  ],
  ielts2: [
    ['task', 'Task Response'],
    ['coherence', 'Coherence and Cohesion'],
    ['vocabulary', 'Lexical Resource'],
    ['grammar', 'Grammatical Range and Accuracy']
  ]
});

export function normalizeWritingAssessment(assessment, type) {
  const criteria = IELTS_WRITING_CRITERIA[type];
  if (!criteria || !assessment || !assessment.scores) return null;

  const scores = {};
  for (const [key] of criteria) {
    const rawValue = assessment.scores[key];
    const value = typeof rawValue === 'number'
      ? rawValue
      : typeof rawValue === 'string' && rawValue.trim()
        ? Number(rawValue)
        : NaN;
    if (!Number.isInteger(value) || value < 0 || value > 9) return null;
    scores[key] = value;
  }

  const average = Object.values(scores).reduce((sum, score) => sum + score, 0) / criteria.length;
  return {
    ...assessment,
    band: Math.round(average * 2) / 2,
    scores
  };
}

export function summarizeWritingProgress(history, type) {
  const records = (Array.isArray(history) ? history : [])
    .filter(record => record && typeof record === 'object' && record.type === type)
    .slice(0, 5);
  if (!records.length) return 'No previous assessment is available for this writing task type.';

  const clean = value => String(value || '').replace(/\s+/g, ' ').trim().slice(0, 140);
  const lines = [`Previous attempts for this same task type: ${records.length}.`];
  const focusAreas = [...new Set(records.flatMap(record =>
    Array.isArray(record.skillFocus) ? record.skillFocus.map(clean).filter(Boolean) : []
  ))].slice(0, 5);
  if (focusAreas.length) lines.push(`Previously identified focus areas: ${focusAreas.join('; ')}.`);

  const criteria = IELTS_WRITING_CRITERIA[type];
  if (criteria) {
    const averages = criteria.map(([key, label]) => {
      const scores = records
        .map(record => {
          const value = record.scores?.[key];
          return value == null || value === '' ? NaN : Number(value);
        })
        .filter(score => Number.isInteger(score) && score >= 0 && score <= 9);
      return scores.length
        ? { label, average: scores.reduce((sum, score) => sum + score, 0) / scores.length }
        : null;
    }).filter(Boolean);
    if (averages.length) {
      const ordered = [...averages].sort((a, b) => a.average - b.average);
      lines.push(`Recent criterion averages (unofficial historical AI estimates): ${averages.map(item => `${item.label} ${item.average.toFixed(1)}`).join(', ')}.`);
      lines.push(`Lowest recent criterion: ${ordered[0].label}. Check whether it remains weak; do not assume the current essay has the same issue.`);
    }
  }
  return lines.join('\n');
}
