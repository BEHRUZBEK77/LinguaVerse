function cleanString(value, maxLength = 180) {
  if (typeof value !== 'string') return '';
  return value.replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

function mergeList(current, next, limit = 12) {
  const items = [...(Array.isArray(current) ? current : []), ...(Array.isArray(next) ? next : [])]
    .map(item => cleanString(item))
    .filter(Boolean);
  return [...new Set(items)].slice(-limit);
}

export function normalizeCoachMemory(value = {}) {
  return {
    version: 1,
    sessions: Math.max(0, Number.isFinite(value.sessions) ? Math.floor(value.sessions) : 0),
    topics: mergeList([], value.topics, 20),
    vocabulary: mergeList([], value.vocabulary, 30),
    strengths: mergeList([], value.strengths, 12),
    recurringErrors: mergeList([], value.recurringErrors, 15),
    nextSteps: mergeList([], value.nextSteps, 12),
    summary: cleanString(value.summary, 700),
    lastSessionAt: value.lastSessionAt || null
  };
}

export function getCoachMemoryDocumentId(targetId) {
  const safeTarget = cleanString(targetId, 40).replace(/[^a-zA-Z0-9_-]/g, '_');
  if (!safeTarget) throw new TypeError('Coach memory target is required');
  return `ai_coach_memory_${safeTarget}`;
}

export function mergeCoachMemory(current, update) {
  const memory = normalizeCoachMemory(current);
  const safeUpdate = update && typeof update === 'object' ? update : {};
  const topic = cleanString(safeUpdate.topic, 120);
  const summary = cleanString(safeUpdate.summary, 700);
  return {
    ...memory,
    topics: mergeList(memory.topics, topic ? [topic] : [], 20),
    vocabulary: mergeList(memory.vocabulary, safeUpdate.vocabulary, 30),
    strengths: mergeList(memory.strengths, safeUpdate.strength ? [safeUpdate.strength] : [], 12),
    recurringErrors: mergeList(memory.recurringErrors, safeUpdate.recurringError ? [safeUpdate.recurringError] : [], 15),
    nextSteps: mergeList(memory.nextSteps, safeUpdate.nextStep ? [safeUpdate.nextStep] : [], 12),
    summary: summary || memory.summary
  };
}

export function completeCoachMemorySession(current, sessionSummary) {
  const memory = normalizeCoachMemory(current);
  const summary = cleanString(sessionSummary, 700);
  return {
    ...memory,
    sessions: memory.sessions + 1,
    summary: summary || memory.summary
  };
}

export function formatCoachMemoryContext(value) {
  const memory = normalizeCoachMemory(value);
  return JSON.stringify({
    priorSessions: memory.sessions,
    recentTopics: memory.topics.slice(-8),
    vocabularyToReview: memory.vocabulary.slice(-12),
    strengths: memory.strengths.slice(-6),
    recurringErrors: memory.recurringErrors.slice(-8),
    nextSteps: memory.nextSteps.slice(-6),
    lastSummary: memory.summary
  });
}
