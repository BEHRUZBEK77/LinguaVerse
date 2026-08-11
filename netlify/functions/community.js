// ═══════════════════════════════════════════════════════════════════════════
// community.js — GLOBAL LUG'AT / UNIT / FLASHCARD MAKONI
//
// Foydalanuvchilar AI bilan yaratgan lug'at to'plamlari, unitlar va
// flashcardlari shu yerdan HAMMAGA umumiy (global) makonga chiqariladi.
//
// Nega alohida server funksiya kerak: firestore.rules oddiy foydalanuvchiga
// boshqa birovning maydoniga yozishni yoki spam/dublikat qo'shishni oldini
// olish uchun `community_*` kolleksiyalariga to'g'ridan-to'g'ri yozishni
// TAQIQLAYDI. Faqat bu server (admin xizmat hisobi orqali) yoza oladi —
// va yozishdan oldin: (1) Firebase ID-tokenni tasdiqlaydi (kim ekanini),
// (2) dublikatni tekshiradi (bir xil so'z/unit/flashcard ikki marta
// chiqmasin), (3) tarif limitini his qiladi (juda ko'p spam qilinmasin).
//
// ACTIONS (POST body):
//   { action:'submit', idToken, kind:'vocab'|'unit'|'flashcard', item }
//   { action:'list',   kind, target, level, cursor }
//
// Kolleksiyalar: community_vocab, community_units, community_flashcards
// Har biri: { target, level, title, ..., authorUid, authorName, saves,
//             dupKey, createdAt }
// ═══════════════════════════════════════════════════════════════════════════

const crypto = require('crypto');
const fsdb = require('./_firestore');
const { verifyIdToken } = require('./_auth');

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

function json(statusCode, body) {
  return { statusCode, headers: { ...CORS, 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
}

const KIND_COLLECTION = {
  vocab: 'community_vocab',
  unit: 'community_units',
  flashcard: 'community_flashcards'
};

const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
const MAX_PER_DAY = 40; // bitta user kuniga eng ko'pi bilan shuncha submit qila oladi (spam himoyasi)

// ── Yordamchilar ────────────────────────────────────────────────────────
function normalizeText(s) {
  return String(s || '').toLowerCase().trim().replace(/\s+/g, ' ');
}

function hashKey(parts) {
  return crypto.createHash('sha1').update(parts.join('|')).digest('hex');
}

/** Har bir kind uchun dublikatni aniqlovchi "barmoq izi" hosil qiladi. */
function buildDupKey(kind, target, item) {
  if (kind === 'vocab') {
    // to'plamdagi so'zlarning birinchi 8 tasi + target — bir xil to'plam
    // ikki marta chiqmasin
    const words = (item.words || []).map(w => normalizeText(w.word)).sort().slice(0, 8).join(',');
    return hashKey(['vocab', target, words]);
  }
  if (kind === 'unit') {
    const words = (item.words || []).map(w => normalizeText(w.word)).sort().join(',');
    return hashKey(['unit', target, normalizeText(item.title), words]);
  }
  if (kind === 'flashcard') {
    const cards = (item.cards || []).map(c => normalizeText(c.front)).sort().join(',');
    return hashKey(['flashcard', target, item.level, cards]);
  }
  return hashKey(['?', target, JSON.stringify(item).slice(0, 200)]);
}

function pickPublicItem(kind, item) {
  // Faqat kerakli maydonlarni saqlaymiz — ortiqcha/ishonchsiz maydonlar
  // (masalan userning ichki ID'lari) global makonga chiqmasin.
  if (kind === 'vocab') {
    return {
      title: String(item.title || '').slice(0, 80),
      words: (item.words || []).slice(0, 40).map(w => ({
        word: String(w.word || '').slice(0, 80),
        translation: String(w.translation || '').slice(0, 120),
        type: String(w.type || '').slice(0, 20),
        level: LEVELS.includes(w.level) ? w.level : 'A2',
        example: String(w.example || '').slice(0, 240),
        exampleTranslation: String(w.exampleTranslation || '').slice(0, 240)
      }))
    };
  }
  if (kind === 'unit') {
    return {
      title: String(item.title || '').slice(0, 100),
      objective: String(item.objective || '').slice(0, 300),
      grammar: item.grammar ? {
        rule: String(item.grammar.rule || '').slice(0, 160),
        explanation: String(item.grammar.explanation || '').slice(0, 500),
        examples: (item.grammar.examples || []).slice(0, 5).map(s => String(s).slice(0, 200))
      } : null,
      exercises: (item.exercises || []).slice(0, 12).map(ex => ({
        type: String(ex.type || '').slice(0, 20),
        question: String(ex.question || '').slice(0, 300),
        options: Array.isArray(ex.options) ? ex.options.slice(0, 6).map(o => String(o).slice(0, 100)) : undefined,
        answer: String(ex.answer || '').slice(0, 200),
        hint: ex.hint ? String(ex.hint).slice(0, 160) : undefined
      })),
      words: (item.words || []).slice(0, 30).map(w => ({
        word: String(w.word || '').slice(0, 80),
        translation: String(w.translation || '').slice(0, 120)
      }))
    };
  }
  if (kind === 'flashcard') {
    return {
      title: String(item.title || '').slice(0, 80),
      level: LEVELS.includes(item.level) ? item.level : 'A2',
      cards: (item.cards || []).slice(0, 40).map(c => ({
        front: String(c.front || '').slice(0, 80),
        back: String(c.back || '').slice(0, 120),
        emoji: String(c.emoji || '').slice(0, 8),
        example: String(c.example || '').slice(0, 200)
      }))
    };
  }
  return {};
}

// ── Handler ──────────────────────────────────────────────────────────────
exports.handler = async function (event) {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' };
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method Not Allowed' });

  if (!fsdb.configured()) {
    return json(200, { ok: false, error: "Server Firestore'ga ulanmagan (admin kalitlar sozlanmagan)" });
  }

  let payload;
  try { payload = JSON.parse(event.body || '{}'); }
  catch { return json(400, { error: "Noto'g'ri JSON" }); }

  const action = payload.action;
  const kind = payload.kind;
  const collection = KIND_COLLECTION[kind];
  if (!collection) return json(400, { error: `Noma'lum tur: ${kind}` });

  try {
    if (action === 'list') {
      const filters = [];
      const target = payload.target;
      const level = payload.level;
      if (target) filters.push({ field: 'target', op: 'EQUAL', value: target });
      if (level && LEVELS.includes(level)) filters.push({ field: 'level', op: 'EQUAL', value: level });

      // Diqqat: target/level filtri + createdAt bo'yicha saralash bitta
      // so'rovda composite index talab qiladi. Agar Firestore index xatosi
      // bersa, xatoda to'g'ridan-to'g'ri index yaratish havolasi keladi —
      // o'sha havolani bir marta bosish kifoya.
      const items = await fsdb.queryList(collection, filters, 'createdAt', 30);
      return json(200, { ok: true, items });
    }

    if (action === 'submit') {
      const auth = await verifyIdToken(payload.idToken);
      const target = String(payload.target || '').slice(0, 20);
      if (!target) return json(400, { error: 'target kerak' });

      const clean = pickPublicItem(kind, payload.item || {});
      if (kind === 'vocab' && !clean.words.length) return json(400, { error: "So'zlar bo'sh" });
      if (kind === 'unit' && !clean.title) return json(400, { error: "Unit sarlavhasi bo'sh" });
      if (kind === 'flashcard' && !clean.cards.length) return json(400, { error: 'Flashcardlar bo\'sh' });

      const level = clean.level || payload.level || 'A2';
      const dupKey = buildDupKey(kind, target, clean);

      // Kunlik limit — spam himoyasi
      const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
      const mine = await fsdb.queryList(collection,
        [{ field: 'authorUid', op: 'EQUAL', value: auth.uid }], 'createdAt', MAX_PER_DAY + 1);
      const todayCount = mine.filter(d => d.createdAt && d.createdAt > since).length;
      if (todayCount >= MAX_PER_DAY) {
        return json(200, { ok: false, error: `Kunlik limit (${MAX_PER_DAY} ta) tugadi — ertaga qayta urinib ko'ring` });
      }

      // Dublikat tekshiruvi
      const existing = await fsdb.queryList(collection, [{ field: 'dupKey', op: 'EQUAL', value: dupKey }], null, 1);
      if (existing.length) {
        return json(200, { ok: true, duplicate: true, id: existing[0].id });
      }

      const doc = {
        ...clean,
        target,
        level,
        authorUid: auth.uid,
        authorName: (payload.authorName || auth.name || "O'quvchi").slice(0, 40),
        dupKey,
        saves: 0,
        createdAt: new Date().toISOString()
      };

      const ref = await fsdb.addDoc(collection, doc);
      return json(200, { ok: true, id: ref.id, item: doc });
    }

    if (action === 'save_count') {
      // Foydalanuvchi community elementni o'ziga import qilganda chaqiriladi
      // — mashhurlikni ko'rsatish uchun oddiy hisoblagich (aniq transact emas,
      // sabab: bu kritik emas, taxminiy son yetarli).
      const auth = await verifyIdToken(payload.idToken);
      if (!payload.id) return json(400, { error: 'id kerak' });
      const path = `${collection}/${payload.id}`;
      const cur = await fsdb.getDoc(path).catch(() => null);
      if (cur) await fsdb.setDoc(path, { ...cur, saves: (cur.saves || 0) + 1 });
      return json(200, { ok: true });
    }

    return json(400, { error: `Noma'lum action: ${action}` });
  } catch (e) {
    console.error('[community]', e);
    return json(200, { ok: false, error: e.message });
  }
};
