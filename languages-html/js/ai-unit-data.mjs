function cleanText(value, maxLength) {
  if (typeof value !== 'string') return '';
  return value.replace(/<[^>]*>/g, ' ').replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

function getTargetWord(entry, wordField) {
  return String(entry?.[wordField] || entry?.e || entry?.de || entry?.ch || entry?.a || '').trim();
}

function getTranslation(entry) {
  return String(entry?.u || entry?.uz || '').trim();
}

export function encodeInlineHandlerArg(value) {
  return encodeURIComponent(String(value ?? '')).replace(/[!'()*]/g, character =>
    `%${character.charCodeAt(0).toString(16).toUpperCase()}`
  );
}

export function chooseUnitVocabulary(dictionary, wordField, level, existingUnits, offset = 0) {
  if (!Array.isArray(dictionary)) throw new TypeError('Course dictionary must be an array');
  const used = new Set((existingUnits || []).flatMap(unit => unit.words || []).map(word => word.toLocaleLowerCase()));
  const levelWords = dictionary.filter(entry => entry.l === level && getTargetWord(entry, wordField) && getTranslation(entry));
  const unused = levelWords.filter(entry => !used.has(getTargetWord(entry, wordField).toLocaleLowerCase()));
  const allWords = dictionary.filter(entry => getTargetWord(entry, wordField) && getTranslation(entry));
  const candidates = unused.length >= 4 ? unused : levelWords.length >= 4 ? levelWords : allWords;
  if (candidates.length < 4) throw new Error('Kamida 4 ta lug‘at so‘zi kerak');

  const start = Math.max(0, offset) % candidates.length;
  const rotated = [...candidates.slice(start), ...candidates.slice(0, start)];
  return rotated.slice(0, Math.min(6, rotated.length)).map(entry => ({
    word: getTargetWord(entry, wordField),
    translation: getTranslation(entry)
  }));
}

export function buildAIUnitPrompt({ language, nativeLanguage, level, vocabulary }) {
  return [
    `Create one complete language-course unit for ${language} at level "${level}".`,
    `Explain grammar and unit description in ${nativeLanguage}; write the reading passage and quiz questions/options in ${language}.`,
    `Teach these exact vocabulary items and do not replace them: ${JSON.stringify(vocabulary)}.`,
    'Make the lesson age-appropriate, factually correct, level-calibrated, and useful in real conversation.',
    'Return exactly one valid JSON object, no markdown and no extra text, with keys:',
    '{"title":"short title","desc":"short Uzbek description","grammar_rule":"clear explanation","grammar_example":"3 target-language examples","reading_text":"80-140 word target-language passage","reading_qs":[{"q":"question","opts":["A","B","C","D"],"c":0}]}',
    'Include exactly 3 reading_qs. Each opts array must contain exactly 4 distinct choices, and c must be the zero-based index of the only correct answer.',
    'Do not include HTML, scripts, markdown, or instructions to the learner outside the requested fields.'
  ].join('\n');
}

export function parseAIUnitResponse(text) {
  const source = String(text || '').trim();
  const fenced = source.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1].trim() : source.slice(source.indexOf('{'), source.lastIndexOf('}') + 1);
  if (!candidate || candidate === source && !source.startsWith('{')) {
    throw new Error('AI javobi JSON formatida emas');
  }
  try {
    return JSON.parse(candidate);
  } catch {
    throw new Error('AI unit javobidagi JSON noto‘g‘ri');
  }
}

export function normalizeAIUnit(raw, { id, level, vocabulary }) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new TypeError('AI unit obyekti noto‘g‘ri');
  const title = cleanText(raw.title, 100);
  const desc = cleanText(raw.desc, 220);
  const grammarRule = cleanText(raw.grammar_rule, 900);
  const grammarExample = cleanText(raw.grammar_example, 700);
  const readingText = cleanText(raw.reading_text, 1800);
  if (!title || !desc || !grammarRule || !grammarExample || readingText.length < 40) {
    throw new Error('AI unitda zarur dars matnlari yetarli emas');
  }
  if (!Array.isArray(raw.reading_qs) || raw.reading_qs.length < 3) {
    throw new Error('AI unitda 3 ta o‘qib tushunish savoli bo‘lishi kerak');
  }
  const readingQuestions = raw.reading_qs.slice(0, 3).map((question, index) => {
    const q = cleanText(question?.q, 220);
    const opts = Array.isArray(question?.opts) ? question.opts.slice(0, 4).map(option => cleanText(option, 120)) : [];
    const c = question?.c;
    if (!q || opts.length !== 4 || opts.some(option => !option) ||
        new Set(opts.map(option => option.toLocaleLowerCase())).size !== 4 ||
        !Number.isInteger(c) || c < 0 || c > 3) {
      throw new Error(`AI unit savoli ${index + 1} noto‘g‘ri`);
    }
    return { q, opts, c };
  });
  if (!Array.isArray(vocabulary) || vocabulary.length < 4) throw new Error('AI unit uchun lug‘at tanlanmagan');

  return {
    id,
    emoji: '✨',
    title,
    desc,
    level,
    words: vocabulary.map(item => item.word),
    xp: 45,
    coin: 15,
    grammar_rule: grammarRule,
    grammar_example: grammarExample,
    reading_text: readingText,
    reading_qs: readingQuestions
  };
}

export function normalizeSavedAIUnits(units, level) {
  if (!Array.isArray(units)) return [];
  return units.slice(-20).flatMap(unit => {
    try {
      const vocabulary = Array.isArray(unit.words)
        ? unit.words.map(word => ({ word: cleanText(word, 100) })).filter(item => item.word)
        : [];
      return [normalizeAIUnit(unit, { id: cleanText(unit.id, 100), level, vocabulary })];
    } catch {
      return [];
    }
  });
}
