const FIELD_ALIASES = {
  GEMINI_API_KEY: 'GEMINI_API_KEYS',
  GOOGLE_TTS_KEY: 'GOOGLE_TTS_KEYS'
};

const RAW_KEY_PATTERNS = [
  { field: 'GROQ_API_KEY', test: value => /^gsk_[A-Za-z0-9_-]+$/.test(value) },
  { field: 'GEMINI_API_KEYS', test: value => /^AIza[A-Za-z0-9_-]+$/.test(value) },
  { field: 'OPENROUTER_API_KEY', test: value => /^sk-or-v1-[A-Za-z0-9_-]+$/.test(value) }
];

function parsePastedApiKeys(text, supportedFields = []) {
  const allowed = new Map(supportedFields.map(field => {
    const name = typeof field === 'string' ? field : field.name;
    return [name.toUpperCase(), name];
  }));
  const values = {};
  const conflicts = new Set();
  const notices = [];
  const addNotice = (code, message) => {
    const existing = notices.find(notice => notice.code === code && notice.message === message);
    if (existing) existing.count++;
    else notices.push({ code, message, count: 1 });
  };

  function normalizeField(sourceName) {
    const name = String(sourceName).trim().replace(/^["']|["']$/g, '').toUpperCase();
    return allowed.get(FIELD_ALIASES[name] || name) || null;
  }

  function addValue(field, value) {
    if (!field || !value) return false;
    if (field.endsWith('_KEYS')) {
      const merged = [...new Set([...(values[field] || '').split(',').filter(Boolean), ...value.split(',').map(key => key.trim()).filter(Boolean)])];
      values[field] = merged.join(',');
    } else if (values[field] !== undefined && values[field] !== value) {
      delete values[field];
      conflicts.add(field);
      addNotice('ambiguous', `${field} uchun bir nechta turli qiymat topildi; xavfsizlik uchun o'tkazilmadi.`);
      return false;
    } else if (!conflicts.has(field)) {
      values[field] = value;
    }
    return true;
  }

  function acceptNamedValue(sourceName, rawValue) {
    const field = normalizeField(sourceName);
    const value = String(rawValue ?? '').trim().replace(/^(['"])(.*)\1$/, '$2');
    if (field && value) {
      addValue(field, value);
    } else if (field) {
      addNotice('empty', `${field} qatorida qiymat yo'q; o'tkazilmadi.`);
    } else {
      addNotice('unsupported-name', 'Noma’lum sozlama nomi topildi; faqat ilovada qo‘llab-quvvatlanadigan maydonlar qabul qilinadi.');
    }
  }

  const input = String(text || '').trim();
  if (input.startsWith('{')) {
    try {
      const parsed = JSON.parse(input);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        for (const [name, rawValue] of Object.entries(parsed)) {
          if (typeof rawValue === 'string' || (Array.isArray(rawValue) && rawValue.every(value => typeof value === 'string'))) {
            acceptNamedValue(name, Array.isArray(rawValue) ? rawValue.join(',') : rawValue);
          } else {
            acceptNamedValue(name, '');
          }
        }
        return { values, notices, recognized: Object.keys(values) };
      }
    } catch {
      // Fall through to line-based .env and JSON-property parsing.
    }
  }

  for (const rawLine of input.split(/\r?\n/)) {
    let line = rawLine.trim();
    if (!line || line.startsWith('#') || line === '{' || line === '}') continue;
    line = line.replace(/^export\s+/i, '').replace(/,\s*$/, '');

    const equalsAt = line.indexOf('=');
    if (equalsAt > 0) {
      acceptNamedValue(line.slice(0, equalsAt), line.slice(equalsAt + 1));
      continue;
    }

    const jsonProperty = line.match(/^["']?([A-Za-z_][A-Za-z0-9_]*)["']?\s*:\s*["'](.*)["']$/);
    if (jsonProperty) {
      acceptNamedValue(jsonProperty[1], jsonProperty[2]);
      continue;
    }

    let recognized = false;
    for (const pattern of RAW_KEY_PATTERNS) {
      const field = normalizeField(pattern.field);
      if (field && pattern.test(line)) {
        addValue(field, line);
        recognized = true;
        break;
      }
    }
    if (recognized) continue;

    if (/^sk-[A-Za-z0-9_-]+$/.test(line)) {
      addNotice('ambiguous-format', 'Bu kalit formati bir nechta xizmatda uchraydi; xavfsizlik uchun avtomatik ravishda maydonga joylanmadi.');
    } else {
      addNotice('unsupported-format', 'Bu kalit formati qo‘llab-quvvatlanadigan xizmatga ishonchli bog‘lanmadi; uni pastdagi tegishli maydonga qo‘lda joylang.');
    }
  }

  return { values, notices, recognized: Object.keys(values) };
}

export { parsePastedApiKeys };
