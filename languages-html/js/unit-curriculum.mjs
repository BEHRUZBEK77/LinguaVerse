const COURSE_COPY = {
  'en-US': {
    title: 'Vocabulary set',
    description: 'Learn a fresh set of words from this level in context.',
    prompt: word => `What does “${word}” mean in Uzbek?`,
    focus: words => `Vocabulary review: ${words.join(', ')}. Use each word in context, then check its meaning.`,
  },
  'de-DE': {
    title: 'Wortschatzrunde',
    description: 'Lerne neue Wörter dieser Stufe anhand von Beispielen.',
    prompt: word => `Was bedeutet „${word}“ auf Usbekisch?`,
    focus: words => `Wortschatzwiederholung: ${words.join(', ')}. Lerne die Wörter im Kontext.`,
  },
  'ko-KR': {
    title: '새 어휘 세트',
    description: '예문을 보며 이 단계의 새 어휘를 익혀 보세요.',
    prompt: word => `‘${word}’은/는 우즈베크어로 무슨 뜻인가요?`,
    focus: words => `어휘 복습: ${words.join(', ')}. 예문 속에서 단어의 뜻을 확인하세요.`,
  },
  'ru-RU': {
    title: 'Новый набор слов',
    description: 'Изучите новые слова этого уровня на примерах.',
    prompt: word => `Что означает «${word}» по-узбекски?`,
    focus: words => `Повторение слов: ${words.join(', ')}. Изучайте их в контексте.`,
  },
  'es-ES': {
    title: 'Nuevo bloque de vocabulario',
    description: 'Aprende nuevas palabras del nivel con ejemplos.',
    prompt: word => `¿Qué significa «${word}» en uzbeko?`,
    focus: words => `Repaso de vocabulario: ${words.join(', ')}. Aprende cada palabra en contexto.`,
  },
  'tr-TR': {
    title: 'Yeni kelime grubu',
    description: 'Bu seviyedeki yeni kelimeleri örneklerle öğren.',
    prompt: word => `“${word}” Özbekçede ne anlama gelir?`,
    focus: words => `Kelime tekrarı: ${words.join(', ')}. Kelimeleri örnek içinde öğren.`,
  },
  'ar-SA': {
    title: 'مجموعة مفردات جديدة',
    description: 'تعلّم كلمات جديدة من هذا المستوى من خلال الأمثلة.',
    prompt: word => `ما معنى «${word}» بالأوزبكية؟`,
    focus: words => `مراجعة المفردات: ${words.join('، ')}. تعلّم الكلمات ضمن السياق.`,
  },
  'zh-CN': {
    title: '新词汇组',
    description: '结合例句学习本级别的新词汇。',
    prompt: word => `“${word}”用乌兹别克语是什么意思？`,
    focus: words => `词汇复习：${words.join('、')}。结合例句记忆词义。`,
  },
};

function getWord(entry, wordField) {
  return String(entry[wordField] || entry.e || entry.de || entry.ch || entry.a || '').trim();
}

function getMeaning(entry) {
  return String(entry.u || entry.uz || '').trim();
}

function normalize(value) {
  return String(value || '').normalize('NFKC').toLocaleLowerCase().trim();
}

export function buildCourseCurriculum(unitData, dictionary, locale, wordField) {
  const copy = COURSE_COPY[locale];
  if (!copy) throw new Error(`Unsupported course locale: ${locale}`);
  if (!Array.isArray(dictionary) || !dictionary.length) {
    throw new Error(`No vocabulary entries found for ${locale}`);
  }

  const answerPool = [...new Map(
    dictionary
      .map(entry => [normalize(getMeaning(entry)), getMeaning(entry)])
      .filter(([key, value]) => key && value)
  ).values()];

  for (const [level, units] of Object.entries(unitData)) {
    if (!Array.isArray(units)) throw new TypeError(`Units for ${level} must be an array`);
    const levelWords = dictionary.filter(entry => entry.l === level && getWord(entry, wordField) && getMeaning(entry));
    if (!levelWords.length && units.length === 0) {
      throw new Error(`No translatable vocabulary found for ${locale}/${level}`);
    }

    const authoredWords = new Set(
      units.flatMap(unit => (unit.words || []).map(normalize))
    );
    const reviewWords = levelWords.filter(entry => !authoredWords.has(normalize(getWord(entry, wordField))));
    const groups = [];
    for (let index = 0; index < reviewWords.length; index += 5) {
      groups.push(reviewWords.slice(index, index + 5));
    }
    if (groups.length > 1 && groups[groups.length - 1].length < 3) {
      groups[groups.length - 2].push(...groups.pop());
    }

    for (const [index, entries] of groups.entries()) {
      if (!entries.length) continue;
      const words = entries.map(entry => getWord(entry, wordField));
      const questions = entries.map((entry, questionIndex) => {
        const answer = getMeaning(entry);
        const distractors = [];
        for (let offset = questionIndex; offset < answerPool.length && distractors.length < 3; offset++) {
          const option = answerPool[(offset * 7 + index * 3) % answerPool.length];
          if (normalize(option) !== normalize(answer) &&
              !distractors.some(item => normalize(item) === normalize(option))) {
            distractors.push(option);
          }
        }
        for (const option of answerPool) {
          if (distractors.length === 3) break;
          if (normalize(option) !== normalize(answer) &&
              !distractors.some(item => normalize(item) === normalize(option))) {
            distractors.push(option);
          }
        }
        if (distractors.length < 3) throw new Error(`Not enough distinct answers for ${locale}/${level}`);

        const correctIndex = questionIndex % 4;
        const opts = distractors.slice(0, 3);
        opts.splice(correctIndex, 0, answer);
        return { q: copy.prompt(getWord(entry, wordField)), opts, c: correctIndex };
      });

      const unitNumber = units.length + 1;
      units.push({
        id: `review_${level}_${unitNumber}`,
        emoji: '📚',
        title: `${copy.title} ${String(unitNumber).padStart(2, '0')}`,
        desc: copy.description,
        level,
        words,
        xp: 60,
        coin: 25,
        grammar_rule: copy.focus(words),
        grammar_example: entries
          .slice(0, 2)
          .map(entry => `${entry.ex || ''} (${entry.eu || entry.u || entry.uz || ''})`)
          .join(' '),
        reading_text: entries.map(entry => entry.ex).filter(Boolean).join(' '),
        reading_qs: questions
      });
    }
  }

  return unitData;
}
