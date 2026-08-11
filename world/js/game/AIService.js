// ═══════════════════════════════════════════════════════════════════════════
// AIService.js — NPC AI suhbat xizmati
//
// Tizimga kirgan foydalanuvchiga LV.ai() orqali limit hisoblanadi (NOVA,
// bepul rejada kuniga 40 ta). Kirishmaganlar to'g'ridan-to'g'ri proxydan
// foydalanadi. AI ishlamasa — shaxsga mos zahira javob beriladi.
// ═══════════════════════════════════════════════════════════════════════════
import { LV, aiRequest } from '../../../js/lv-core.js';
import { ZONE_BY_ID } from '../config.js';

const TARGET_LANG_NAME = {
  'en-US': 'English', 'ru-RU': 'Russian', 'es-ES': 'Spanish',
  'de-DE': 'German', 'tr-TR': 'Turkish'
};

const NATIVE_NAME = { uz: 'Uzbek', ru: 'Russian', en: 'English' };

export function buildNpcSystem(npc, settings, ctx = {}) {
  const target = TARGET_LANG_NAME[settings.targetLang] || 'English';
  const native = NATIVE_NAME[settings.nativeLang] || 'Uzbek';
  const cefr = settings.cefr || 'A2';
  const cityName = (ctx.city && ctx.city.name) || '';
  const userName = ctx.userName || null;

  const lines = [
    npc.persona,
    '',
    `SETTINGS:`,
    `- Speak MAINLY in ${target}.`,
    `- The student's level is CEFR ${cefr}. Adapt vocabulary and sentence length to that level.`,
    `- If the student makes a grammar or vocabulary mistake, correct it in ONE short line in ${native} (e.g. "(correct: ...)") and then continue naturally.`,
    `- Keep each reply to 2-4 spoken sentences (under 60 words).`,
    `- Always end with one simple question so the conversation continues.`,
    `- You are a 3D character in a language-learning city. Never mention that you are an AI.`,
    `- Reply in plain text only. No markdown, no emoji, no "[[META]]" lines.`
  ];

  // Joylashuv va foydalanuvchi konteksti — tabiiy suhbat uchun
  if (cityName) {
    const zoneName = npc.zone ? ((ZONE_BY_ID[npc.zone] || {}).name || '') : '';
    lines.push(`- We are currently in ${cityName}${zoneName ? `, at the ${zoneName}` : ''}. Mention the place naturally when relevant.`);
  }
  if (userName) {
    lines.push(`- The learner's name is ${userName}; use it occasionally to keep the conversation personal.`);
  }

  return lines.join('\n');
}

/**
 * NPC javobini oladi.
 * @returns {{ok:boolean, text:string, backend?:string, limitNote?:string}}
 */
export async function npcReply(npc, history, settings, ctx = {}) {
  const messages = [
    { role: 'system', content: buildNpcSystem(npc, settings, ctx) },
    ...history.slice(-8)
  ];

  // Kirgan foydalanuvchi — limit bilan, reja bo'yicha
  if (LV.snapshot().signedIn) {
    const r = await LV.ai('nova', messages, { task: 'speaking', level: settings.cefr });
    if (r.ok) return { ok: true, text: cleanReply(r.text), backend: r.backend };
    if (r.reason !== 'auth') {
      // Limit/plan/ai xatosi — so'zlab qo'ymaymiz, to'g'ridan-to'g'ri proxyga o'tamiz
      const direct = await aiRequest({ model: 'nova', messages, temperature: 0.75, maxTokens: 300 });
      if (direct.ok) return { ok: true, text: cleanReply(direct.text), backend: direct.backend, fallback: true };
      return { ok: false, text: fallbackReply(npc), limitNote: r.message };
    }
  }

  // Mehmon — to'g'ridan-to'g'ri proxy
  try {
    const r = await aiRequest({ model: 'nova', messages, temperature: 0.75, maxTokens: 300 });
    if (r.ok) return { ok: true, text: cleanReply(r.text), backend: r.backend };
  } catch (e) {
    console.warn('[world] AI xatosi:', e.message);
  }
  return { ok: false, text: fallbackReply(npc) };
}

/** AI javobidan qo'pol qoldiqlarni tozalaymiz. */
function cleanReply(t) {
  return String(t || '')
    .replace(/\[\[META\]\][^\n]*/g, '')
    .replace(/\*\*/g, '')
    .replace(/\n+/g, ' ')
    .trim();
}

/** AI yo'q paytda ishlatiladigan, shaxsga mos javoblar. */
const FALLBACKS = {
  cafe_marta: "Of course! Our coffee is really good. Would you like it with milk?",
  market_ali: "Today I have fresh apples and bananas. How many would you like?",
  office_sara: "Sure! We have a meeting at nine. Are you coming?",
  airport_karim: "Yes, your flight is on time. May I see your passport, please?",
  home_grandpa: "I'm fine, thanks! The garden is blooming today. Do you like flowers?",
  school_nilufar: "Great question! Let's practise: say it in English, then I'll help you. Ready?",
  airport_lia: "I'm going to Italy next week! Where do you like to travel?",
  market_dilya: "The bread is still warm. Would you like two loaves?"
};

function fallbackReply(npc) {
  const base = FALLBACKS[npc.id] || "That's a good question! Let me think... Can you tell me more?";
  return base;
}

export default { npcReply, buildNpcSystem };
