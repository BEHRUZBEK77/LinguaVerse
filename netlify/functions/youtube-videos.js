const keys = require('./_keys.js');
const ratelimit = require('./_ratelimit.js');
const fsdb = require('./_firestore.js');
const crypto = require('crypto');

// Natijalar 6 soat keshlanadi; YouTube API'ga kunlik umumiy so'rovlar soni cheklangan
// (search.list = 100 kvota birligi, standart kunlik kvota 10 000).
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const DAILY_API_LIMIT = 90;

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

const LANGUAGES = {
  english: { name: 'English', code: 'en', exam: 'IELTS' },
  german: { name: 'German', code: 'de', exam: 'Goethe exam' },
  korean: { name: 'Korean', code: 'ko', exam: 'TOPIK' },
  russian: { name: 'Russian', code: 'ru', exam: 'TORFL' },
  spanish: { name: 'Spanish', code: 'es', exam: 'DELE' },
  turkish: { name: 'Turkish', code: 'tr', exam: 'TÖMER' },
  arabic: { name: 'Arabic', code: 'ar', exam: 'Arabic proficiency' },
  chinese: { name: 'Chinese', code: 'zh', exam: 'HSK' }
};

const SKILLS = {
  reading: { en: 'reading comprehension', de: 'Leseverstehen', ko: '읽기 독해', ru: 'чтение и понимание', es: 'comprensión lectora', tr: 'okuduğunu anlama', ar: 'فهم المقروء', zh: '阅读理解' },
  writing: { en: 'writing', de: 'Schreiben', ko: '쓰기', ru: 'письмо', es: 'expresión escrita', tr: 'yazma', ar: 'الكتابة', zh: '写作' },
  speaking: { en: 'speaking and pronunciation', de: 'Sprechen und Aussprache', ko: '말하기와 발음', ru: 'говорение и произношение', es: 'expresión oral y pronunciación', tr: 'konuşma ve telaffuz', ar: 'التحدث والنطق', zh: '口语和发音' },
  listening: { en: 'listening comprehension', de: 'Hörverstehen', ko: '듣기 이해', ru: 'аудирование', es: 'comprensión auditiva', tr: 'dinleme', ar: 'الاستماع والفهم', zh: '听力理解' },
  grammar: { en: 'grammar practice', de: 'Grammatik', ko: '문법', ru: 'грамматика', es: 'gramática', tr: 'dil bilgisi', ar: 'القواعد', zh: '语法' }
};

function json(statusCode, body) {
  return {
    statusCode,
    headers: { ...CORS, 'Content-Type': 'application/json', 'Cache-Control': 'no-store, max-age=0' },
    body: JSON.stringify(body)
  };
}

function buildSearch(languageId, skillId, level, exam, score) {
  const language = LANGUAGES[languageId];
  const skill = SKILLS[skillId];
  if (!language || !skill) throw new TypeError('Til yoki ko‘nikma qo‘llab-quvvatlanmaydi.');
  const safeLevel = String(level || '').trim().slice(0, 40);
  const safeExam = String(exam || language.exam).trim().slice(0, 40);
  const query = [language.name, skill[language.code], safeLevel, safeExam, 'lesson practice']
    .filter(Boolean)
    .join(' ')
    .slice(0, 180);
  return {
    query,
    searchUrl: `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`,
    language
  };
}

async function searchVideos({ query, language, apiKey, fetchImpl = globalThis.fetch }) {
  if (!apiKey) return { ok: true, configured: false, videos: [] };
  if (!fetchImpl) throw new Error('YouTube qidiruv uchun server fetch mavjud emas.');

  const url = new URL('https://www.googleapis.com/youtube/v3/search');
  url.search = new URLSearchParams({
    part: 'snippet',
    type: 'video',
    maxResults: '6',
    order: 'relevance',
    safeSearch: 'strict',
    videoEmbeddable: 'true',
    relevanceLanguage: language.code,
    q: query,
    key: apiKey
  }).toString();

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6500);
  try {
    const response = await fetchImpl(url, { signal: controller.signal });
    const data = await response.json();
    if (!response.ok) {
      const message = data?.error?.message || `YouTube API HTTP ${response.status}`;
      throw new Error(message);
    }

    const videos = (Array.isArray(data.items) ? data.items : [])
      .filter(item => /^[A-Za-z0-9_-]{11}$/.test(item?.id?.videoId || ''))
      .map(item => {
        const id = item.id.videoId;
        const snippet = item.snippet || {};
        const thumbnail = snippet.thumbnails?.medium?.url || snippet.thumbnails?.default?.url || '';
        return {
          id,
          title: String(snippet.title || 'YouTube video').slice(0, 240),
          channel: String(snippet.channelTitle || 'YouTube').slice(0, 120),
          thumbnail: thumbnail.startsWith('https://') ? thumbnail : '',
          url: `https://www.youtube.com/watch?v=${id}`
        };
      });
    return { ok: true, configured: true, videos };
  } finally {
    clearTimeout(timeout);
  }
}

function cacheKey(search) {
  const raw = [search.language.code, search.query.toLowerCase()].join('|');
  return crypto.createHash('sha256').update(raw).digest('hex').slice(0, 40);
}

async function readCache(key, now = Date.now()) {
  try {
    const doc = await fsdb.getDoc(`ytCache/${key}`);
    const cachedAt = Number(doc?.cachedAt) || 0;
    if (doc && Array.isArray(doc.videos) && now - cachedAt < CACHE_TTL_MS) return doc.videos;
  } catch (error) {
    console.error('[youtube-videos] cache read failed:', error.message);
  }
  return null;
}

async function writeCache(key, videos, now = Date.now()) {
  try {
    await fsdb.setDoc(`ytCache/${key}`, { videos, cachedAt: now });
  } catch (error) {
    console.error('[youtube-videos] cache write failed:', error.message);
  }
}

// Kunlik umumiy limit: atomik hisoblagich. Xato bo'lsa — yopiq (API chaqirilmaydi).
async function takeDailyQuota(now = Date.now(), limit = DAILY_API_LIMIT) {
  const day = new Date(now).toISOString().slice(0, 10);
  let allowed = false;
  try {
    await fsdb.transact(`ytQuota/${day}`, current => {
      const count = Number(current?.count) || 0;
      if (count >= limit) { allowed = false; return null; }
      allowed = true;
      return { count: count + 1, updatedAt: new Date(now) };
    });
  } catch (error) {
    console.error('[youtube-videos] daily quota check failed:', error.message);
    return false;
  }
  return allowed;
}

async function cachedSearch(search, apiKey, fetchImpl) {
  if (!apiKey || !fsdb.configured()) return searchVideos({ ...search, apiKey, fetchImpl });
  const key = cacheKey(search);
  const cached = await readCache(key);
  if (cached) return { ok: true, configured: true, videos: cached, cached: true };
  if (!(await takeDailyQuota())) return { ok: true, configured: true, videos: [], limited: true };
  const result = await searchVideos({ ...search, apiKey, fetchImpl });
  if (result.configured) await writeCache(key, result.videos);
  return result;
}

exports.handler = async function (event) {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: CORS, body: '' };
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method Not Allowed' });
  await keys.refreshFromFirestore();

  const rl = await ratelimit.checkRateLimit(
    `youtube-videos:${ratelimit.clientIp(event)}`,
    { windowMs: 60_000, max: 10 }
  );
  if (!rl.ok) {
    return json(rl.unavailable ? 503 : 429, {
      error: rl.unavailable ? 'Video qidiruv xizmati vaqtincha mavjud emas.' : 'Juda ko‘p video qidirildi. Biroz kutib qayta urinib ko‘ring.'
    });
  }

  let payload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch {
    return json(400, { error: 'Noto‘g‘ri JSON.' });
  }
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return json(400, { error: 'Qidiruv parametrlari noto‘g‘ri.' });
  }

  let search;
  try {
    search = buildSearch(payload.language, payload.skill, payload.level, payload.exam, payload.score);
  } catch (error) {
    return json(400, { error: error.message });
  }

  try {
    const result = await cachedSearch(search, keys.get('YOUTUBE_API_KEY'));
    return json(200, { ...result, query: search.query, searchUrl: search.searchUrl });
  } catch (error) {
    console.error('[youtube-videos] search failed:', error.message);
    return json(502, { error: 'YouTube’dan video qidirish amalga oshmadi. Keyinroq urinib ko‘ring.' });
  }
};

module.exports.buildSearch = buildSearch;
module.exports.searchVideos = searchVideos;
module.exports.cachedSearch = cachedSearch;
module.exports.CACHE_TTL_MS = CACHE_TTL_MS;
module.exports.DAILY_API_LIMIT = DAILY_API_LIMIT;
