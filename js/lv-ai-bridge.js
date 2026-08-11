// ═══════════════════════════════════════════════════════════════════════════
// lv-ai-bridge.js — ESKI SAHIFALARNI YANGI AI TIZIMIGA ULAYDIGAN KO'PRIK
//
// Muammo: 8 ta til fayli va speaking-coach da AI 17 xil joyda chaqiriladi.
// Har birini alohida tahrirlash xavfli — bu fayllar 1900 qatordan iborat va
// chaqiruv shakllari biroz farq qiladi.
//
// Yechim: shu modul AI endpointiga ketayotgan so'rovlarni ushlab, ularga
//   (1) foydalanuvchi rejasiga mos MODEL nomini qo'shadi,
//   (2) LIMITNI tekshirib, hisobga oladi.
// Chaqiruv joylari umuman o'zgarmaydi.
//
// ⚠️  Bu O'TKINCHI yechim. To'g'ri arxitektura — har bir chaqiruv joyi
//     to'g'ridan-to'g'ri LV.ai() ni ishlatishi. Ko'prik shu ish
//     bajarilgunicha limitlarni ishlatib turadi.
//
// Ulash: har bir sahifaga, boshqa skriptlardan OLDIN:
//   <script type="module" src="../js/lv-ai-bridge.js"></script>
// ═══════════════════════════════════════════════════════════════════════════

import { LV, MODELS, aiRequest } from './lv-core.js';

const AI_PATH = '.netlify/functions/ai';
const origFetch = window.fetch.bind(window);

// Reja yuklanmaguncha so'rovlarni kutkazamiz
const readyPromise = LV.ready().catch(e => {
  console.warn('[ai-bridge] LV yuklanmadi, limitlarsiz davom etamiz:', e.message);
  return null;
});

/**
 * So'rov qaysi vazifa uchun ekanini matndan taxmin qiladi.
 * Og'ir vazifalarga kuchliroq model beriladi.
 */
function guessTask(text) {
  const t = String(text).toLowerCase();
  if (/\bjson\b/.test(t) && /(lesson|unit|dars)/.test(t)) return 'lesson';
  if (/\bjson\b/.test(t) && /(word|vocab|so'z|lug)/.test(t)) return 'vocab';
  if (/(essay|insho|writing|yozgan)/.test(t)) return 'writing';
  if (/(grammar|grammatika|rule|qoida)/.test(t)) return 'grammar';
  if (/(translate|tarjima)/.test(t)) return 'translate';
  return 'chat';
}

/** Vazifa va rejaga qarab model tanlaydi. */
function pickModel(task) {
  const needsThinking = ['lesson', 'writing', 'grammar'].includes(task);
  return LV.bestModel(needsThinking);
}

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

window.fetch = async function (input, init) {
  const url = typeof input === 'string' ? input : (input?.url || '');

  // AI endpointiga ketmayotgan so'rovlarga tegmaymiz
  if (!url.includes(AI_PATH) || !init?.body) {
    return origFetch(input, init);
  }

  let payload;
  try { payload = JSON.parse(init.body); }
  catch { return origFetch(input, init); }

  // Model allaqachon berilgan bo'lsa — bu yangi kod, aralashmaymiz
  if (payload.model && MODELS[payload.model]) {
    return origFetch(input, init);
  }

  const snap = await readyPromise;
  const isLegacy = Array.isArray(payload.contents);

  // Tizimga kirmagan bo'lsa — limitsiz, eng oddiy model
  if (!snap?.signedIn) {
    payload.model = 'nova';
    const r = await aiRequest(payload);
    return jsonResponse(
      isLegacy
        ? (r.ok ? { candidates: [{ content: { parts: [{ text: r.text }] } }] }
                : { candidates: [{ content: { parts: [{ text: r.error }] } }], error: r.error })
        : (r.ok ? { text: r.text, backend: r.backend } : { text: r.error, error: r.error }),
      r.ok ? 200 : 502
    );
  }

  // Vazifani aniqlab, model tanlaymiz
  const firstText = isLegacy
    ? (payload.contents[0]?.parts?.[0]?.text || '')
    : (payload.messages?.[0]?.content || '');

  const task = guessTask(firstText);
  let model = pickModel(task);

  // ── LIMIT ──
  const gate = await LV.consume(model);
  if (!gate.ok) {
    console.warn('[ai-bridge] limit:', gate.message);

    // Quyiroq modelga tushishga urinamiz — foydalanuvchi butunlay
    // to'xtab qolmasin
    let ok = false;
    for (const alt of ['mega', 'nova']) {
      if (alt === model || !LV.hasModel(alt)) continue;
      const g2 = await LV.consume(alt);
      if (g2.ok) {
        console.log(`[ai-bridge] ${model} limiti tugadi → ${alt} ishlatildi`);
        model = alt;
        ok = true;
        break;
      }
    }

    if (!ok) {
      const text = (gate.message || 'Limit tugadi.') +
        (gate.upgrade ? ` ${gate.upgrade.name} rejasiga o'tsangiz limit oshadi.` : '');
      return jsonResponse(
        isLegacy
          ? { candidates: [{ content: { parts: [{ text }] } }], limitReached: true }
          : { text, limitReached: true }
      );
    }
  }

  payload.model = model;

  // aiRequest zaxira yo'lini o'zi boshqaradi: Netlify funksiyasi bo'lmasa
  // (Live Server, oddiy statik server) to'g'ridan-to'g'ri worker'ga o'tadi.
  const result = await aiRequest(payload);

  if (!result.ok) {
    await LV.refund(model);
    return jsonResponse(
      isLegacy
        ? { candidates: [{ content: { parts: [{ text: result.error }] } }], error: result.error }
        : { text: result.error, error: result.error },
      502
    );
  }

  return jsonResponse(
    isLegacy
      ? { candidates: [{ content: { parts: [{ text: result.text }] } }], backend: result.backend }
      : { text: result.text, backend: result.backend, model }
  );
};

console.log("[ai-bridge] ulandi — AI so'rovlari reja va limit bilan boshqariladi");
