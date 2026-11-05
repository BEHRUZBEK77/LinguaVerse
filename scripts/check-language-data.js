#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const LANGUAGES = {
  English: { word: 'e', translation: 'u' },
  German: { word: 'de', translation: 'u' },
  Korean: { word: 'e', translation: 'u' },
  Russia: { word: 'e', translation: 'u' },
  Spain: { word: 'e', translation: 'u' },
  Spanish: { word: 'e', translation: 'u' },
  Turkish: { word: 'e', translation: 'u' },
  Arabic: { word: 'a', translation: 'u' },
  Chinese: { word: 'ch', translation: 'uz' }
};

function readLiteral(source, name) {
  const match = new RegExp(`const\\s+${name}\\s*=\\s*([\\[{])`).exec(source);
  if (!match) throw new Error(`Missing ${name}`);

  const start = match.index + match[0].lastIndexOf(match[1]);
  const stack = [];
  let quote = '';
  let escaped = false;

  for (let i = start; i < source.length; i++) {
    const char = source[i];
    if (quote) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === quote) quote = '';
      continue;
    }

    if (char === '\'' || char === '"' || char === '`') {
      quote = char;
      continue;
    }
    if (char === '/' && source[i + 1] === '/') {
      while (i < source.length && source[i] !== '\n') i++;
      continue;
    }
    if (char === '/' && source[i + 1] === '*') {
      i += 2;
      while (i < source.length && !(source[i] === '*' && source[i + 1] === '/')) i++;
      i++;
      continue;
    }
    if (char === '[' || char === '{') stack.push(char);
    if (char === ']' || char === '}') {
      stack.pop();
      if (!stack.length) {
        return vm.runInNewContext(`(${source.slice(start, i + 1)})`);
      }
    }
  }

  throw new Error(`Unterminated ${name}`);
}

function normalize(value) {
  return String(value || '').normalize('NFKC').trim().toLocaleLowerCase();
}

function validateQuestions(value, context, errors) {
  if (!value || typeof value !== 'object') return;

  if (Array.isArray(value.opts) && Number.isInteger(value.c)) {
    if (value.c < 0 || value.c >= value.opts.length) {
      errors.push(`${context}: answer index ${value.c} is outside ${value.opts.length} options`);
    }
  }

  for (const [key, child] of Object.entries(value)) {
    validateQuestions(child, `${context}.${key}`, errors);
  }
}

let failures = 0;
for (const [name, fields] of Object.entries(LANGUAGES)) {
  const file = path.join(ROOT, 'languages-html', 'js', `${name}.js`);
  const errors = [];
  try {
    const source = fs.readFileSync(file, 'utf8');
    const words = readLiteral(source, 'WDB');
    const units = readLiteral(source, 'UD_DATA');

    if (!Array.isArray(words) || words.length === 0) {
      errors.push('WDB must contain vocabulary entries');
    }

    const terms = new Map();
    for (const [index, word] of words.entries()) {
      const term = normalize(word[fields.word]);
      if (!term || !normalize(word[fields.translation]) || !normalize(word.ex) ||
          !normalize(word.eu) || !normalize(word.t) || !normalize(word.l)) {
        errors.push(`WDB[${index}] is missing a word, translation, example, type, or level`);
      }
      if (term) {
        if (terms.has(term)) errors.push(`duplicate vocabulary term "${word[fields.word]}"`);
        terms.set(term, word);
      }
    }

    const unitIds = new Set();
    for (const [level, levelUnits] of Object.entries(units)) {
      for (const [index, unit] of levelUnits.entries()) {
        const context = `${level}[${index}]`;
        if (!unit.id || unitIds.has(unit.id)) errors.push(`${context} has a missing or duplicate unit id`);
        unitIds.add(unit.id);
        for (const term of unit.words || []) {
          if (!terms.has(normalize(term))) errors.push(`${context} references missing vocabulary "${term}"`);
        }
        validateQuestions(unit, context, errors);
      }
    }

    console.log(`${name}: ${words.length} words, ${unitIds.size} authored units — ${errors.length ? 'FAIL' : 'OK'}`);
  } catch (error) {
    errors.push(error.message);
  }

  for (const error of errors) console.error(`  ${name}: ${error}`);
  failures += errors.length;
}

const worldErrors = [];
try {
  const config = fs.readFileSync(path.join(ROOT, 'world', 'js', 'config.js'), 'utf8');
  const main = fs.readFileSync(path.join(ROOT, 'world', 'js', 'main.js'), 'utf8');
  const ai = fs.readFileSync(path.join(ROOT, 'world', 'js', 'game', 'AIService.js'), 'utf8');
  const html = fs.readFileSync(path.join(ROOT, 'world', 'index.html'), 'utf8');
  const css = fs.readFileSync(path.join(ROOT, 'world', 'css', 'world.css'), 'utf8');
  const builder = fs.readFileSync(path.join(ROOT, 'world', 'js', 'build', 'WorldBuilder.js'), 'utf8');
  const models = fs.readFileSync(path.join(ROOT, 'world', 'js', 'build', 'Models.js'), 'utf8');
  const questManager = fs.readFileSync(path.join(ROOT, 'world', 'js', 'game', 'QuestManager.js'), 'utf8');
  const sceneManager = fs.readFileSync(path.join(ROOT, 'world', 'js', 'core', 'SceneManager.js'), 'utf8');
  const targetLangs = readLiteral(config, 'TARGET_LANGS').map(lang => lang.id);
  const quests = readLiteral(config, 'QUESTS');
  const cardLangs = [...html.matchAll(/class="lang-card" data-lang="([^"]+)"/g)].map(match => match[1]);
  const quickReplies = Object.keys(readLiteral(main, 'QUICK_REPLIES'));
  const greetings = Object.keys(readLiteral(main, 'INITIAL_GREETINGS'));
  const fallbacks = Object.keys(readLiteral(ai, 'FALLBACKS_BY_LANG'));
  const sameSet = (actual, expected) =>
    actual.length === expected.length && expected.every(value => actual.includes(value));

  if (!sameSet(cardLangs, targetLangs)) {
    worldErrors.push('3D language cards do not match TARGET_LANGS');
  }
  if (!sameSet(quickReplies, targetLangs)) {
    worldErrors.push('3D quick replies are missing a supported language');
  }
  if (!sameSet(greetings, targetLangs)) {
    worldErrors.push('3D initial greetings are missing a supported language');
  }
  if (!sameSet(fallbacks, targetLangs.filter(lang => lang !== 'en-US'))) {
    worldErrors.push('3D fallback replies do not match non-English target languages');
  }
  for (const quest of quests.filter(item => item.type === 'phrase')) {
    const phraseLangs = typeof quest.phrase === 'string' ? ['en-US'] : Object.keys(quest.phrase);
    if (!sameSet(phraseLangs, targetLangs)) {
      worldErrors.push(`3D phrase quest "${quest.id}" does not cover every target language`);
    }
    if (typeof quest.phrase !== 'string' && targetLangs.some(lang => !quest.phrase[lang]?.trim())) {
      worldErrors.push(`3D phrase quest "${quest.id}" has an empty localized phrase`);
    }
  }
  if (!html.includes('role="button" aria-pressed="false" tabindex="0"')) {
    worldErrors.push('3D language/city choices are missing keyboard button semantics');
  }

  const setupCss = css.match(/#city-select\s*\{([^}]*)\}/);
  if (!setupCss || !/overflow-y\s*:\s*auto/.test(setupCss[1])) {
    worldErrors.push('3D setup overlay must scroll on short screens');
  }
  const mobileControlsCss = css.match(/#hud\s*>\s*\.mobile-controls\s*\{([^}]*)\}/);
  if (!mobileControlsCss || !/pointer-events\s*:\s*none/.test(mobileControlsCss[1])) {
    worldErrors.push('3D mobile control layer must not block other HUD buttons');
  }
  const panelCss = css.match(/\.panel\s*\{([^}]*)\}/);
  if (!panelCss || !/z-index\s*:\s*20/.test(panelCss[1])) {
    worldErrors.push('3D settings and quest panels must render above the HUD');
  }
  if (/this\.physics\.addBox\(x\s*-\s*WORLD\.roadWidth/.test(builder) ||
      /this\.physics\.addBox\(0,\s*-WORLD\.roadWidth/.test(builder)) {
    worldErrors.push('3D road crossings must remain open to player movement');
  }
  if (!/level\s*===\s*'medium'\s*\?\s*1\.25/.test(sceneManager) ||
      !/level\s*===\s*'high'\s*\?\s*2048\s*:\s*1024/.test(sceneManager)) {
    worldErrors.push('3D graphics quality levels must use distinct rendering budgets');
  }
  const worldWords = readLiteral(config, 'WORDS');
  const propBuilder = models.slice(models.indexOf('export function buildProp'), models.indexOf('/** Kichkina haykalcha'));
  const propTypes = new Set([...propBuilder.matchAll(/case\s+'([^']+)'/g)].map(match => match[1]));
  for (const word of worldWords) {
    if (!propTypes.has(word.prop)) worldErrors.push(`3D word "${word.id}" has no model for prop "${word.prop}"`);
  }
  if (!/q\.npc\s*===\s*npcId/.test(questManager)) {
    worldErrors.push('3D phrase quests must only complete in the matching NPC conversation');
  }
} catch (error) {
  worldErrors.push(error.message);
}

console.log(`3D world: ${worldErrors.length ? 'FAIL' : '8 languages and responsive controls — OK'}`);
for (const error of worldErrors) console.error(`  3D world: ${error}`);
failures += worldErrors.length;

if (failures) {
  console.error(`Language data check failed with ${failures} issue(s).`);
  process.exitCode = 1;
} else {
  console.log('All language dictionaries and unit exercises are consistent.');
}

async function checkExpandedCurricula() {
  const { buildCourseCurriculum } = await import('../languages-html/js/unit-curriculum.mjs');
  const { canMigrateLegacyCourseUnit } = await import('../languages-html/js/course-journey.mjs');
  const courses = {
    English: { locale: 'en-US', word: 'e' },
    German: { locale: 'de-DE', word: 'de' },
    Korean: { locale: 'ko-KR', word: 'e' },
    Russia: { locale: 'ru-RU', word: 'e' },
    Spain: { locale: 'es-ES', word: 'e' },
    Spanish: { locale: 'es-ES', word: 'e' },
    Turkish: { locale: 'tr-TR', word: 'e' },
    Arabic: { locale: 'ar-SA', word: 'a' },
    Chinese: { locale: 'zh-CN', word: 'ch' }
  };
  const canonicalCourseIds = {
    English: 'english',
    German: 'german',
    Korean: 'korean',
    Russia: 'russian',
    Spain: 'spanish',
    Turkish: 'turkish',
    Arabic: 'arabic',
    Chinese: 'chinese'
  };
  const legacyIdOwners = new Map();
  let errors = 0;

  for (const [name, course] of Object.entries(courses)) {
    try {
      const source = fs.readFileSync(path.join(ROOT, 'languages-html', 'js', `${name}.js`), 'utf8');
      const words = readLiteral(source, 'WDB');
      const units = readLiteral(source, 'UD_DATA');
      if (!source.includes(`buildCourseCurriculum(UD_DATA, WDB, '${course.locale}', '${course.word}')`)) {
        throw new Error('course is not wired to the localized vocabulary curriculum');
      }

      const authoredCounts = Object.fromEntries(
        Object.entries(units).map(([level, levelUnits]) => [level, levelUnits.length])
      );
      const authoredTerms = Object.fromEntries(
        Object.entries(units).map(([level, levelUnits]) => [
          level,
          new Set(levelUnits.flatMap(unit => (unit.words || []).map(normalize)))
        ])
      );
      buildCourseCurriculum(units, words, course.locale, course.word);
      if (canonicalCourseIds[name]) {
        for (const unit of Object.values(units).flat()) {
          const owners = legacyIdOwners.get(unit.id) || new Set();
          owners.add(canonicalCourseIds[name]);
          legacyIdOwners.set(unit.id, owners);
        }
      }
      for (const [level, levelUnits] of Object.entries(units)) {
        if (levelUnits.length < authoredCounts[level]) {
          throw new Error(`${level} lost authored units`);
        }
        const ids = new Set(levelUnits.map(unit => unit.id));
        if (ids.size !== levelUnits.length) throw new Error(`${level} contains duplicate unit ids`);
        const reviewedTerms = new Set();

        for (const unit of levelUnits) {
          for (const term of unit.words || []) {
            if (!words.some(entry => entry[course.word] === term)) {
              throw new Error(`${unit.id} references missing vocabulary "${term}"`);
            }
            if (unit.id.startsWith('review_')) {
              const normalized = normalize(term);
              if (authoredTerms[level].has(normalized) || reviewedTerms.has(normalized)) {
                throw new Error(`${level} repeats "${term}" in its vocabulary review units`);
              }
              reviewedTerms.add(normalized);
            }
          }
          for (const [index, question] of (unit.reading_qs || []).entries()) {
            if (!Array.isArray(question.opts) || question.opts.length !== 4 ||
                !Number.isInteger(question.c) || question.c < 0 || question.c > 3 ||
                new Set(question.opts.map(normalize)).size !== 4) {
              throw new Error(`${unit.id} question ${index + 1} has invalid answer options`);
            }
            if (unit.id.startsWith('review_')) {
              const entry = words.find(item => item[course.word] === unit.words[index]);
              if (!entry || normalize(question.opts[question.c]) !== normalize(entry.u || entry.uz)) {
                throw new Error(`${unit.id} question ${index + 1} has an incorrect answer key`);
              }
            }
          }
        }
      }
      console.log(`${name}: authored units plus non-repeating vocabulary sets — OK`);
    } catch (error) {
      errors++;
      console.error(`  ${name}: ${error.message}`);
    }
  }

  for (const [unitId, owners] of legacyIdOwners) {
    if (canMigrateLegacyCourseUnit(unitId) !== (owners.size === 1)) {
      errors++;
      console.error(`  Legacy progress migration has an incorrect collision rule for ${unitId}`);
    }
  }

  if (errors) {
    console.error(`Expanded curriculum check failed for ${errors} course(s).`);
    process.exitCode = 1;
  }
}

checkExpandedCurricula().catch(error => {
  console.error(`Expanded curriculum check failed: ${error.message}`);
  process.exitCode = 1;
});
