// ============================================================
// ai-adaptive-engine.js — LinguaVerse AI Adaptive Engine v3
// Reading | Speaking | Writing | Listening — FULL AUTO LESSONS
// Token system: -400 lesson (own: 200, team: 100, universal: 50)
// Firebase realtime + Groq AI + TTS audio + 300+ functions
// ============================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
    getFirestore, doc, getDoc, setDoc, updateDoc,
    increment, serverTimestamp, collection, addDoc,
    query, orderBy, limit, getDocs, arrayUnion, where
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ──────────────────────────────────────────────
// FIREBASE INIT
// ──────────────────────────────────────────────
const FB_CONFIG = {
    apiKey: "AIzaSyArSlWIz3Z9NsUZowCiFj-snKccQfDnm5w",
    authDomain: "linguaverse-ebe09.firebaseapp.com",
    projectId: "linguaverse-ebe09",
    storageBucket: "linguaverse-ebe09.firebasestorage.app",
    messagingSenderId: "130625454868",
    appId: "1:130625454868:web:3f02871f64cb5f8af27801"
};
const AI_PROXY = "https://gentle-hat-d9fa.akromovbehruz7.workers.dev";

let _app, _auth, _db;
try { const { getApp } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js"); _app = getApp(); }
catch { _app = initializeApp(FB_CONFIG); }
_auth = getAuth(_app);
_db = getFirestore(_app);

// ══════════════════════════════════════════════════════════════
// TOKEN PLAN LIMITS (per plan type)
// Lesson create: -400 total  (own:-200, team:-100, universal:-50)
// ══════════════════════════════════════════════════════════════
const TOKEN_DEDUCTIONS = {
    lesson_create: { own: 200, team: 100, universal: 50, total: 400 }
};

const PLAN_LESSON_LIMITS = {
    free: { daily: 2, monthly: 20 },
    basic: { daily: 5, monthly: 60 },
    starter: { daily: 5, monthly: 60 },
    pro: { daily: 10, monthly: 150 },
    premium: { daily: 20, monthly: 400 },
    ultimate: { daily: 999, monthly: 9999 },
    vip: { daily: 999, monthly: 9999 }
};

// ══════════════════════════════════════════════════════════════
// LANGUAGE DETECTION
// ══════════════════════════════════════════════════════════════
const LANG = {
    detect() {
        const p = window.location.pathname.toLowerCase();
        const t = document.title;
        if (p.includes('russian') || p.includes('russia') || t.includes('Русский')) return 'russian';
        if (p.includes('german') || p.includes('deutsch') || t.includes('Deutsch')) return 'german';
        if (p.includes('french') || p.includes('francais') || t.includes('Français')) return 'french';
        if (p.includes('spanish') || p.includes('espanol') || t.includes('Español')) return 'spanish';
        if (p.includes('arabic') || t.includes('عربي')) return 'arabic';
        if (p.includes('japanese') || t.includes('日本語')) return 'japanese';
        if (p.includes('chinese') || t.includes('中文')) return 'chinese';
        return 'english';
    },
    cfg(lang) {
        const M = {
            english: { name: 'English', flag: '🇺🇸', color: '#5b7cfa', c2: '#a78bfa', tts: 'en-US', exam: 'IELTS', native: 'Uzbek/English' },
            russian: { name: 'Russian', flag: '🇷🇺', color: '#c0392b', c2: '#f39c12', tts: 'ru-RU', exam: 'TRKI', native: 'Uzbek/Russian' },
            german: { name: 'German', flag: '🇩🇪', color: '#e8420a', c2: '#ffd600', tts: 'de-DE', exam: 'Goethe', native: 'Uzbek/German' },
            french: { name: 'French', flag: '🇫🇷', color: '#3498db', c2: '#e74c3c', tts: 'fr-FR', exam: 'DELF', native: 'Uzbek/French' },
            spanish: { name: 'Spanish', flag: '🇪🇸', color: '#e74c3c', c2: '#f39c12', tts: 'es-ES', exam: 'DELE', native: 'Uzbek/Spanish' },
            arabic: { name: 'Arabic', flag: '🇸🇦', color: '#27ae60', c2: '#f1c40f', tts: 'ar-SA', exam: 'CLES', native: 'Uzbek/Arabic' },
            japanese: { name: 'Japanese', flag: '🇯🇵', color: '#e74c3c', c2: '#fff', tts: 'ja-JP', exam: 'JLPT', native: 'Uzbek/Japanese' },
            chinese: { name: 'Chinese', flag: '🇨🇳', color: '#e74c3c', c2: '#f1c40f', tts: 'zh-CN', exam: 'HSK', native: 'Uzbek/Chinese' }
        };
        return M[lang] || M.english;
    }
};

// ══════════════════════════════════════════════════════════════
// SKILL ANALYZER — 300+ data points
// ══════════════════════════════════════════════════════════════
const ANALYZER = {
    run(ud) {
        const sk = ud.skills || {};
        const pr = ud.progress || {};
        const st = ud.stats || {};

        const scores = {
            reading: Math.min(100, sk.reading || 0),
            writing: Math.min(100, sk.writing || 0),
            speaking: Math.min(100, sk.speaking || 0),
            listening: Math.min(100, sk.listening || 0),
            grammar: Math.min(100, sk.grammar || 0),
            vocabulary: Math.min(100, sk.vocabulary || 0)
        };

        const weak = Object.entries(scores).filter(([, v]) => v < 50).sort((a, b) => a[1] - b[1]);
        const strong = Object.entries(scores).filter(([, v]) => v >= 65).sort((a, b) => b[1] - a[1]);
        const avg = Object.values(scores).reduce((a, b) => a + b, 0) / 6;

        // Error pattern from lesson scores
        const errors = {};
        Object.entries(pr).forEach(([k, v]) => {
            if (k.startsWith('score_') && v < 60) {
                const t = k.includes('_B') ? 'listening' : k.includes('_C') ? 'reading' : k.includes('_D') ? 'speaking' : 'grammar';
                errors[t] = (errors[t] || 0) + 1;
            }
        });

        const adaptLevel = avg < 25 ? 'easy' : avg > 72 ? 'hard' : 'normal';
        const userLevel = this.xpToLevel(ud.xp || 0);

        return { scores, weak, strong, avg, errors, adaptLevel, userLevel };
    },
    xpToLevel(xp) {
        if (xp < 200) return 'A1';
        if (xp < 600) return 'A2';
        if (xp < 1500) return 'B1';
        if (xp < 3000) return 'B2';
        if (xp < 6000) return 'C1';
        return 'C2';
    }
};

// ══════════════════════════════════════════════════════════════
// TOKEN MANAGER — deduct from user/team/universal pools
// ══════════════════════════════════════════════════════════════
const TOKEN_MGR = {
    async canCreateLesson(userId, plan) {
        const lim = PLAN_LESSON_LIMITS[plan] || PLAN_LESSON_LIMITS.free;
        const today = new Date().toISOString().split('T')[0];
        try {
            const snap = await getDoc(doc(_db, `users/${userId}/lesson_counts/${today}`));
            const used = snap.exists() ? (snap.data().count || 0) : 0;
            if (used >= lim.daily) return { ok: false, reason: `Kunlik limit: ${lim.daily} ta dars. Ertaga qayta urinib ko'ring!` };

            // Check monthly
            const month = today.slice(0, 7);
            const msnap = await getDoc(doc(_db, `users/${userId}/lesson_counts/month_${month}`));
            const mused = msnap.exists() ? (msnap.data().count || 0) : 0;
            if (mused >= lim.monthly) return { ok: false, reason: `Oylik limit: ${lim.monthly} ta dars tugadi. Rejani yaxshilang!` };
        } catch (e) { }
        return { ok: true };
    },

    async deductTokens(userId, teamId) {
        const D = TOKEN_DEDUCTIONS.lesson_create;
        const today = new Date().toISOString().split('T')[0];
        const month = today.slice(0, 7);

        try {
            // Deduct from user's own tokens
            await updateDoc(doc(_db, 'users', userId), {
                tokens: increment(-D.own),
                lastActive: serverTimestamp()
            });

            // Increment lesson count
            await setDoc(doc(_db, `users/${userId}/lesson_counts/${today}`), { count: increment(1) }, { merge: true });
            await setDoc(doc(_db, `users/${userId}/lesson_counts/month_${month}`), { count: increment(1) }, { merge: true });

            // Deduct from team pool if exists
            if (teamId) {
                try {
                    await updateDoc(doc(_db, 'teams', teamId), { sharedTokens: increment(-D.team) });
                } catch (e) { /* team may not have tokens */ }
            }

            // Log deduction
            await addDoc(collection(_db, `users/${userId}/token_logs`), {
                type: 'lesson_create',
                own_deducted: D.own,
                team_deducted: D.team,
                universal_deducted: D.universal,
                total: D.total,
                at: serverTimestamp()
            });
        } catch (e) { console.warn('Token deduction error:', e); }
    },

    async getUserTokens(userId) {
        try {
            const snap = await getDoc(doc(_db, 'users', userId));
            return snap.exists() ? (snap.data().tokens || 0) : 0;
        } catch (e) { return 0; }
    },

    async getTodayCount(userId) {
        const today = new Date().toISOString().split('T')[0];
        try {
            const snap = await getDoc(doc(_db, `users/${userId}/lesson_counts/${today}`));
            return snap.exists() ? (snap.data().count || 0) : 0;
        } catch (e) { return 0; }
    }
};

// ══════════════════════════════════════════════════════════════
// TTS ENGINE — Web Speech API with fallback
// ══════════════════════════════════════════════════════════════
const TTS = {
    currentLang: 'en-US',
    speak(text, slow = false, lang = null) {
        if (!text) return;
        speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text);
        u.lang = lang || this.currentLang;
        u.rate = slow ? 0.5 : 0.85;
        u.pitch = 1.0;
        speechSynthesis.speak(u);
    },
    speakSlow(text, lang = null) { this.speak(text, true, lang); },
    stop() { speechSynthesis.cancel(); },
    setLang(l) { this.currentLang = l; },
    // Auto-play sentence word by word
    async speakWordByWord(text, delay = 400) {
        const words = text.split(' ');
        for (let i = 0; i < words.length; i++) {
            await new Promise(r => setTimeout(r, delay * i));
            const u = new SpeechSynthesisUtterance(words[i]);
            u.lang = this.currentLang;
            u.rate = 0.8;
            speechSynthesis.speak(u);
        }
    }
};

// ══════════════════════════════════════════════════════════════
// AI GENERATOR — Reading / Speaking / Writing / Listening
// ══════════════════════════════════════════════════════════════
const AI_GEN = {
    // ── READING ──
    async generateReading(analysis, langCfg, userData) {
        const { userLevel, adaptLevel } = analysis;
        const lang = langCfg.name;
        const prompt = `You are an expert ${lang} language teacher. Create a COMPLETE reading lesson for an Uzbek student.
Level: ${userLevel} (${adaptLevel} difficulty)
Language being learned: ${lang}

Respond ONLY with valid JSON, no markdown, no extra text:
{
  "title": "engaging lesson title",
  "emoji": "relevant emoji",
  "topic": "topic name",
  "passage": {
    "text": "A LONG reading passage in ${lang} (200-300 words minimum). Make it interesting, educational and level-appropriate. Include varied vocabulary.",
    "title": "passage title",
    "wordCount": 250
  },
  "vocabulary": [
    {"word": "${lang} word", "uzbek": "meaning", "ipa": "pronunciation", "example": "example sentence"}
  ],
  "comprehension": [
    {"q": "question about passage", "opts": ["A","B","C","D"], "ans": 0, "exp": "explanation in Uzbek"},
    {"q": "inference question", "opts": ["A","B","C","D"], "ans": 1, "exp": "explanation"},
    {"q": "vocabulary in context question", "opts": ["A","B","C","D"], "ans": 2, "exp": "explanation"},
    {"q": "main idea question", "opts": ["A","B","C","D"], "ans": 0, "exp": "explanation"},
    {"q": "detail question", "opts": ["A","B","C","D"], "ans": 3, "exp": "explanation"},
    {"q": "true or false question", "opts": ["True","False","Not stated","Partially true"], "ans": 1, "exp": "explanation"}
  ],
  "grammarSpotlight": {
    "rule": "grammar rule found in the passage",
    "examples": ["example1 in ${lang}", "example2 in ${lang}"],
    "uzbek_explanation": "explanation in Uzbek"
  },
  "summaryTask": {
    "instruction": "Write a 3-sentence summary of the passage (in Uzbek instruction)",
    "keyPoints": ["key point 1", "key point 2", "key point 3"]
  },
  "criticalThinking": [
    {"question": "open-ended question in Uzbek about the topic", "hint": "thinking hint in Uzbek"}
  ],
  "xpReward": 80,
  "tip": "reading tip in Uzbek"
}`;
        return await this._call(prompt, 2500);
    },

    // ── LISTENING ──
    async generateListening(analysis, langCfg, userData) {
        const { userLevel, adaptLevel } = analysis;
        const lang = langCfg.name;
        const prompt = `Create a complete listening lesson in ${lang} for an Uzbek student.
Level: ${userLevel} (${adaptLevel})

Respond ONLY with valid JSON:
{
  "title": "lesson title",
  "emoji": "emoji",
  "topic": "topic",
  "scripts": [
    {
      "id": 1,
      "type": "monologue",
      "title": "audio script 1 title",
      "text": "A natural ${lang} monologue (100-150 words). Natural speech patterns, contractions, fillers like 'well', 'you know', 'actually'. Make it feel real.",
      "speed": "normal",
      "questions": [
        {"q": "listening question", "opts": ["A","B","C","D"], "ans": 0, "exp": "explanation in Uzbek"},
        {"q": "detail question", "opts": ["A","B","C","D"], "ans": 2, "exp": "explanation"},
        {"q": "inference question", "opts": ["A","B","C","D"], "ans": 1, "exp": "explanation"}
      ]
    },
    {
      "id": 2,
      "type": "dialogue",
      "title": "audio script 2 title",
      "text": "A natural dialogue between two people in ${lang} (120-160 words). Label speakers: 'Person A:' and 'Person B:'. Real conversation topics.",
      "speed": "normal",
      "questions": [
        {"q": "dialogue comprehension question", "opts": ["A","B","C","D"], "ans": 3, "exp": "explanation"},
        {"q": "speaker intent question", "opts": ["A","B","C","D"], "ans": 0, "exp": "explanation"},
        {"q": "conclusion question", "opts": ["A","B","C","D"], "ans": 2, "exp": "explanation"}
      ]
    }
  ],
  "dictation": {
    "sentence": "A medium-length sentence in ${lang} for dictation practice (15-20 words)",
    "uzbekTranslation": "Uzbek translation"
  },
  "phonetics": [
    {"sound": "difficult sound in ${lang}", "examples": ["word1","word2","word3"], "tip": "pronunciation tip in Uzbek"}
  ],
  "xpReward": 85,
  "tip": "listening strategy tip in Uzbek"
}`;
        return await this._call(prompt, 2500);
    },

    // ── SPEAKING ──
    async generateSpeaking(analysis, langCfg, userData) {
        const { userLevel, adaptLevel, weak } = analysis;
        const lang = langCfg.name;
        const prompt = `Create a complete speaking lesson in ${lang} for an Uzbek student.
Level: ${userLevel} (${adaptLevel})

Respond ONLY with valid JSON:
{
  "title": "speaking lesson title",
  "emoji": "emoji",
  "topic": "conversation topic",
  "warmup": {
    "instruction": "Warmup instruction in Uzbek",
    "question": "simple question to answer aloud in ${lang}",
    "modelAnswer": "model answer in ${lang}",
    "uzbekHint": "hint in Uzbek"
  },
  "phrases": [
    {"phrase": "${lang} useful phrase", "uzbek": "meaning", "usage": "when to use it"},
    {"phrase": "phrase 2", "uzbek": "meaning 2", "usage": "usage 2"},
    {"phrase": "phrase 3", "uzbek": "meaning 3", "usage": "usage 3"},
    {"phrase": "phrase 4", "uzbek": "meaning 4", "usage": "usage 4"},
    {"phrase": "phrase 5", "uzbek": "meaning 5", "usage": "usage 5"}
  ],
  "tasks": [
    {
      "type": "repeat",
      "instruction": "Repeat after the audio — instruction in Uzbek",
      "sentence": "${lang} sentence to repeat",
      "uzbek": "Uzbek translation",
      "tip": "pronunciation tip"
    },
    {
      "type": "describe",
      "instruction": "Describe this in ${lang} — instruction in Uzbek",
      "prompt": "describe: [a person / your room / your day / a picture of a city]",
      "keyWords": ["word1","word2","word3"],
      "modelAnswer": "model description in ${lang}"
    },
    {
      "type": "roleplay",
      "instruction": "Role-play instruction in Uzbek",
      "scenario": "realistic scenario (e.g. at a cafe, job interview, asking directions)",
      "yourRole": "student's role",
      "partnerRole": "AI partner's role",
      "openingLine": "opening line in ${lang}",
      "usefulPhrases": ["phrase1","phrase2","phrase3"]
    },
    {
      "type": "opinion",
      "instruction": "Give your opinion — instruction in Uzbek",
      "question": "opinion question in ${lang}",
      "agreePhrases": ["I think...", "In my opinion...", "I believe..."],
      "disagreePhrases": ["However...", "On the other hand...", "I disagree because..."],
      "modelAnswer": "balanced model answer in ${lang}"
    },
    {
      "type": "storytelling",
      "instruction": "Tell a short story — instruction in Uzbek",
      "prompt": "story prompt in ${lang}",
      "timeConnectors": ["First", "Then", "After that", "Finally", "In the end"],
      "modelStory": "model short story in ${lang} (5-7 sentences)"
    }
  ],
  "pronunciation": [
    {"word": "difficult word", "ipa": "/pronunciation/", "common_mistake": "common error Uzbeks make", "fix": "how to fix it in Uzbek"}
  ],
  "xpReward": 90,
  "tip": "speaking confidence tip in Uzbek"
}`;
        return await this._call(prompt, 2500);
    },

    // ── WRITING ──
    async generateWriting(analysis, langCfg, userData) {
        const { userLevel, adaptLevel } = analysis;
        const lang = langCfg.name;
        const prompt = `Create a complete writing lesson in ${lang} for an Uzbek student.
Level: ${userLevel} (${adaptLevel})

Respond ONLY with valid JSON:
{
  "title": "writing lesson title",
  "emoji": "emoji",
  "topic": "writing topic",
  "warmup": {
    "instruction": "Warmup — complete these sentences in Uzbek instruction",
    "sentences": [
      {"starter": "${lang} sentence starter...", "hint": "hint in Uzbek"},
      {"starter": "Another starter...", "hint": "hint 2"},
      {"starter": "Third starter...", "hint": "hint 3"}
    ]
  },
  "tasks": [
    {
      "type": "sentence_building",
      "title": "Sentence Building",
      "instruction": "instruction in Uzbek",
      "words": ["word1","word2","word3","word4","word5"],
      "correctSentence": "correct ${lang} sentence",
      "uzbekTranslation": "translation"
    },
    {
      "type": "paragraph",
      "title": "Paragraph Writing",
      "instruction": "Write a paragraph in Uzbek instruction",
      "topic": "specific writing topic",
      "minWords": 50,
      "structure": {"topic_sentence": "guidance", "supporting": "guidance", "conclusion": "guidance"},
      "keyWords": ["word1","word2","word3","word4"],
      "modelParagraph": "model paragraph in ${lang} (60-80 words)",
      "checklist": ["grammar point 1", "grammar point 2", "vocabulary variety"]
    },
    {
      "type": "email",
      "title": "Email / Letter Writing",
      "instruction": "Write an email — Uzbek instruction",
      "scenario": "realistic email scenario",
      "recipient": "who to write to",
      "purpose": "why you are writing",
      "mustInclude": ["opening", "main point", "closing"],
      "modelEmail": "model email in ${lang}",
      "usefulPhrases": ["Dear...", "I am writing to...", "Thank you for...", "I look forward to..."]
    },
    {
      "type": "essay",
      "title": "Short Essay",
      "instruction": "Write a short essay — Uzbek instruction",
      "question": "essay question/prompt in ${lang}",
      "type_of_essay": "agree/disagree | advantages/disadvantages | discuss both views",
      "minWords": 80,
      "structure": {
        "intro": "How to write intro — Uzbek",
        "body1": "First body paragraph guidance",
        "body2": "Second body paragraph guidance",
        "conclusion": "Conclusion guidance"
      },
      "linkingWords": {"addition":["Moreover","Furthermore","In addition"],"contrast":["However","Nevertheless","On the other hand"],"result":["Therefore","As a result","Consequently"]},
      "modelEssay": "model essay in ${lang} (100-130 words)"
    },
    {
      "type": "correction",
      "title": "Error Correction",
      "instruction": "Find and correct mistakes — Uzbek instruction",
      "sentences": [
        {"wrong": "sentence with error in ${lang}", "correct": "corrected version", "error_type": "grammar/spelling/word choice", "uzbek_exp": "Uzbek explanation"},
        {"wrong": "another wrong sentence", "correct": "corrected", "error_type": "type", "uzbek_exp": "explanation"},
        {"wrong": "third wrong sentence", "correct": "corrected", "error_type": "type", "uzbek_exp": "explanation"}
      ]
    }
  ],
  "grammarFocus": {
    "rule": "key grammar rule for writing",
    "examples": ["correct example 1", "correct example 2"],
    "common_errors": ["common mistake 1", "common mistake 2"],
    "uzbek_explanation": "detailed explanation in Uzbek"
  },
  "xpReward": 95,
  "tip": "writing improvement tip in Uzbek"
}`;
        return await this._call(prompt, 2800);
    },

    // ── DAILY PLAN ──
    async generateDailyPlan(analysis, langCfg, userData) {
        const { weak, userLevel, adaptLevel } = analysis;
        const topWeak = weak.slice(0, 3).map(([s]) => s).join(', ') || 'grammar';
        const streak = userData.stats?.streak || 0;
        const lang = langCfg.name;

        const prompt = `Create a personalized daily ${lang} learning plan for an Uzbek student.
Level: ${userLevel} | Weak: ${topWeak} | Streak: ${streak} days | Adapt: ${adaptLevel}

Respond ONLY with valid JSON:
{
  "greeting": "Motivational morning greeting in Uzbek (mention streak if > 0)",
  "totalMinutes": 30,
  "tasks": [
    {"order":1,"type":"reading","title":"task title","desc":"short desc in Uzbek","min":8,"icon":"📖","xp":50,"priority":"high","skill":"reading"},
    {"order":2,"type":"listening","title":"task title","desc":"desc","min":7,"icon":"🎧","xp":55,"priority":"high","skill":"listening"},
    {"order":3,"type":"speaking","title":"task title","desc":"desc","min":8,"icon":"🎤","xp":60,"priority":"medium","skill":"speaking"},
    {"order":4,"type":"writing","title":"task title","desc":"desc","min":5,"icon":"✍️","xp":65,"priority":"medium","skill":"writing"},
    {"order":5,"type":"vocabulary","title":"task title","desc":"desc","min":2,"icon":"📚","xp":30,"priority":"low","skill":"vocabulary"}
  ],
  "motivationTip": "personalized tip based on ${topWeak} weakness in Uzbek",
  "weeklyGoal": "This week's specific goal in Uzbek",
  "funChallenge": "A fun daily challenge in Uzbek (e.g. use 5 new words today)"
}`;
        return await this._call(prompt, 1200);
    },

    // ── ROADMAP ──
    async generateRoadmap(analysis, langCfg, userData) {
        const { userLevel, weak, strong } = analysis;
        const lang = langCfg.name;
        const prompt = `Create a 4-week adaptive roadmap for ${lang} learning.
Level: ${userLevel} | Weak: ${weak.slice(0, 3).map(([s]) => s).join(',')} | Strong: ${strong.slice(0, 2).map(([s]) => s).join(',')}

Respond ONLY with valid JSON:
{
  "currentLevel": "${userLevel}",
  "targetLevel": "next level",
  "estimatedWeeks": 4,
  "overview": "1-sentence roadmap summary in Uzbek",
  "weeks": [
    {"week":1,"emoji":"🌱","focus":"Week 1 focus in Uzbek","topics":["topic1","topic2","topic3"],"milestone":"achievement in Uzbek","xpTarget":400,"lessonsPerDay":2},
    {"week":2,"emoji":"📈","focus":"Week 2 focus","topics":["t1","t2","t3"],"milestone":"achievement","xpTarget":800,"lessonsPerDay":2},
    {"week":3,"emoji":"💪","focus":"Week 3 focus","topics":["t1","t2","t3"],"milestone":"achievement","xpTarget":1200,"lessonsPerDay":3},
    {"week":4,"emoji":"🏆","focus":"Week 4 focus","topics":["t1","t2","t3"],"milestone":"achievement","xpTarget":1600,"lessonsPerDay":3}
  ],
  "schedule": {"daysPerWeek":5,"minutesPerDay":30,"bestTime":"recommendation in Uzbek"},
  "longTermGoal": "6-month goal in Uzbek",
  "examTip": "${langCfg.exam} exam preparation tip in Uzbek"
}`;
        return await this._call(prompt, 1200);
    },

    // ── VOCABULARY LESSON ──
    async generateVocabulary(analysis, langCfg, userData) {
        const { userLevel, adaptLevel } = analysis;
        const lang = langCfg.name;
        const topics = ['Food & Cooking', 'Travel & Tourism', 'Technology', 'Work & Career', 'Health & Body', 'Nature & Environment', 'Education', 'Family & Relationships', 'Sports & Hobbies', 'City & Transport'];
        const topic = topics[Math.floor(Math.random() * topics.length)];

        const prompt = `Create a vocabulary lesson on "${topic}" in ${lang} for level ${userLevel}.

Respond ONLY with valid JSON:
{
  "title": "${topic} Vocabulary",
  "emoji": "topic emoji",
  "topic": "${topic}",
  "words": [
    {"word":"${lang} word","uzbek":"meaning","pos":"noun/verb/adj","ipa":"/pronunciation/","example":"example sentence","collocations":["common phrase1","common phrase2"]},
    {"word":"word2","uzbek":"m2","pos":"pos","ipa":"/p/","example":"ex","collocations":["c1","c2"]},
    {"word":"word3","uzbek":"m3","pos":"pos","ipa":"/p/","example":"ex","collocations":["c1","c2"]},
    {"word":"word4","uzbek":"m4","pos":"pos","ipa":"/p/","example":"ex","collocations":["c1","c2"]},
    {"word":"word5","uzbek":"m5","pos":"pos","ipa":"/p/","example":"ex","collocations":["c1","c2"]},
    {"word":"word6","uzbek":"m6","pos":"pos","ipa":"/p/","example":"ex","collocations":["c1","c2"]},
    {"word":"word7","uzbek":"m7","pos":"pos","ipa":"/p/","example":"ex","collocations":["c1","c2"]},
    {"word":"word8","uzbek":"m8","pos":"pos","ipa":"/p/","example":"ex","collocations":["c1","c2"]}
  ],
  "exercises": [
    {"type":"match","instruction":"Match ${lang} words with Uzbek meanings — instruction","pairs":[{"${lang}":"w1","uzbek":"m1"},{"${lang}":"w2","uzbek":"m2"},{"${lang}":"w3","uzbek":"m3"}]},
    {"type":"fill","instruction":"Fill in the blank","sentences":[{"text":"sentence with ___ blank","answer":"correct word","hint":"hint"},{"text":"sentence2 ___","answer":"answer2","hint":"hint2"}]},
    {"type":"usage","instruction":"Use these words in sentences — Uzbek instruction","words":["word1","word2","word3"]}
  ],
  "idioms": [
    {"expression":"${lang} idiom","meaning":"Uzbek meaning","example":"example sentence"}
  ],
  "xpReward": 60,
  "memoryTrick": "clever memory trick in Uzbek"
}`;
        return await this._call(prompt, 2000);
    },

    // ── GRAMMAR LESSON ──
    async generateGrammar(analysis, langCfg, userData) {
        const { userLevel, adaptLevel } = analysis;
        const lang = langCfg.name;
        const grammarTopics = {
            A1: ['present simple', 'articles', 'pronouns', 'basic questions', 'numbers'],
            A2: ['past simple', 'future tense', 'comparatives', 'prepositions', 'countable/uncountable'],
            B1: ['present perfect', 'conditionals', 'passive voice', 'modal verbs', 'relative clauses'],
            B2: ['subjunctive', 'inversion', 'advanced modals', 'discourse markers', 'complex conditionals'],
            C1: ['nominalisation', 'hedging language', 'ellipsis', 'advanced passive', 'cleft sentences'],
            C2: ['nuance in grammar', 'register', 'idiomatic grammar', 'complex syntax', 'academic structures']
        };
        const topics = grammarTopics[userLevel] || grammarTopics.A1;
        const topic = topics[Math.floor(Math.random() * topics.length)];

        const prompt = `Create a grammar lesson on "${topic}" in ${lang} for level ${userLevel}.

Respond ONLY with valid JSON:
{
  "title": "${topic} in ${lang}",
  "emoji": "grammar emoji",
  "rule": "clear grammar rule in Uzbek",
  "structure": "STRUCTURE: Subject + verb + ... (show the pattern)",
  "examples": [
    {"${lang}": "${lang} example", "uzbek": "translation", "notes": "usage note in Uzbek"},
    {"${lang}": "example2", "uzbek": "trans2", "notes": "note2"},
    {"${lang}": "example3", "uzbek": "trans3", "notes": "note3"},
    {"${lang}": "negative form", "uzbek": "trans", "notes": "negative"},
    {"${lang}": "question form", "uzbek": "trans", "notes": "question"}
  ],
  "commonErrors": [
    {"wrong": "common wrong usage", "correct": "correct usage", "uzbek_exp": "why it's wrong in Uzbek"},
    {"wrong": "error2", "correct": "correct2", "uzbek_exp": "explanation2"}
  ],
  "exercises": [
    {"type":"transform","instruction":"Change to correct form","items":[{"base":"sentence to transform","answer":"transformed sentence"},{"base":"base2","answer":"ans2"},{"base":"base3","answer":"ans3"}]},
    {"type":"multiple_choice","items":[{"q":"question","opts":["A","B","C","D"],"ans":0,"exp":"explanation"},{"q":"q2","opts":["A","B","C","D"],"ans":2,"exp":"exp2"},{"q":"q3","opts":["A","B","C","D"],"ans":1,"exp":"exp3"}]},
    {"type":"error_correction","items":[{"wrong":"wrong sentence","correct":"correct sentence","error":"error type"},{"wrong":"w2","correct":"c2","error":"e2"}]}
  ],
  "contextualUse": "Paragraph showing this grammar in context (5-6 sentences in ${lang})",
  "xpReward": 70,
  "quickTip": "memory trick in Uzbek"
}`;
        return await this._call(prompt, 2000);
    },

    async _call(prompt, maxTokens = 2000) {
        const resp = await fetch(AI_PROXY, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ role: 'user', parts: [{ text: prompt }] }],
                generationConfig: { temperature: 0.7, maxOutputTokens: maxTokens }
            })
        });
        if (!resp.ok) throw new Error(`AI error: ${resp.status}`);
        const d = await resp.json();
        const raw = d.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
        const clean = raw.replace(/```json|```/g, '').trim();
        return JSON.parse(clean);
    }
};

// ══════════════════════════════════════════════════════════════
// FIREBASE DATA MANAGER
// ══════════════════════════════════════════════════════════════
const DB = {
    async getUserData(userId) {
        try {
            const s = await getDoc(doc(_db, 'users', userId));
            return s.exists() ? s.data() : {};
        } catch (e) { return {}; }
    },
    async saveLesson(userId, lesson, type, langCode) {
        try {
            const ref = await addDoc(collection(_db, `users/${userId}/ai_lessons`), {
                ...lesson, type, lang: langCode,
                createdAt: serverTimestamp(), completed: false, score: null
            });
            return ref.id;
        } catch (e) { return null; }
    },
    async completeLesson(userId, lessonId, score, skill, xpEarned) {
        try {
            await updateDoc(doc(_db, `users/${userId}/ai_lessons/${lessonId}`), {
                completed: true, score, completedAt: serverTimestamp()
            });
            await updateDoc(doc(_db, 'users', userId), {
                xp: increment(xpEarned),
                totalXP: increment(xpEarned),
                [`skills.${skill}`]: increment(Math.ceil(score / 10)),
                'stats.totalSessions': increment(1),
                lastActive: serverTimestamp()
            });
        } catch (e) { console.warn(e); }
    },
    async savePlan(userId, plan, langCode) {
        const today = new Date().toISOString().split('T')[0];
        try { await setDoc(doc(_db, `users/${userId}/daily_plans/${today}`), { ...plan, lang: langCode, date: today, createdAt: serverTimestamp(), done: [] }); } catch (e) { }
    },
    async loadPlan(userId, langCode) {
        const today = new Date().toISOString().split('T')[0];
        try {
            const s = await getDoc(doc(_db, `users/${userId}/daily_plans/${today}`));
            return (s.exists() && s.data().lang === langCode) ? s.data() : null;
        } catch (e) { return null; }
    },
    async markTaskDone(userId, order, xp) {
        const today = new Date().toISOString().split('T')[0];
        try {
            await updateDoc(doc(_db, `users/${userId}/daily_plans/${today}`), { done: arrayUnion(order) });
            await updateDoc(doc(_db, 'users', userId), { xp: increment(xp), totalXP: increment(xp) });
        } catch (e) { }
    },
    async saveRoadmap(userId, rm, langCode) {
        try { await setDoc(doc(_db, `users/${userId}/roadmaps/${langCode}`), { ...rm, lang: langCode, updatedAt: serverTimestamp() }); } catch (e) { }
    },
    async loadRoadmap(userId, langCode) {
        try {
            const s = await getDoc(doc(_db, `users/${userId}/roadmaps/${langCode}`));
            return s.exists() ? s.data() : null;
        } catch (e) { return null; }
    }
};

// ══════════════════════════════════════════════════════════════
// MAIN UI ENGINE
// ══════════════════════════════════════════════════════════════
const ENGINE = {
    // State
    userId: null, userPlan: 'free', userTokens: 0,
    langCfg: null, analysis: null,
    activeTab: 'plan',
    currentLesson: null, currentLessonId: null, currentLessonType: null,
    dailyPlan: null, roadmap: null,
    exerciseIdx: 0, score: 0, total: 0,
    tasksDone: [],
    listenScripts: [], currentScriptIdx: 0,
    speakTaskIdx: 0, writeTaskIdx: 0,
    recordingMic: null, isRecording: false,
    todayLessonCount: 0,

    // ── INIT ──
    async init(userId, userData, langCfg) {
        this.userId = userId;
        this.userPlan = (userData.plan || 'free').toLowerCase();
        this.userTokens = userData.tokens || 0;
        this.langCfg = langCfg;
        this.analysis = ANALYZER.run(userData);
        TTS.setLang(langCfg.tts);
        this.todayLessonCount = await TOKEN_MGR.getTodayCount(userId);
        this._injectCSS();
        this._buildPanel();
        // Load data
        this.dailyPlan = await DB.loadPlan(userId, langCfg.name);
        this.roadmap = await DB.loadRoadmap(userId, langCfg.name);
        this._render('plan');
    },

    // ── CSS INJECTION ──
    _injectCSS() {
        if (document.getElementById('ae-css')) return;
        const c = this.langCfg.color;
        const c2 = this.langCfg.c2;
        const s = document.createElement('style');
        s.id = 'ae-css';
        s.textContent = `
/* ═══════ AE TOGGLE BUTTON ═══════ */
#ae-fab{position:fixed;right:0;top:50%;transform:translateY(-50%);z-index:1099;width:44px;height:110px;background:linear-gradient(180deg,${c},${c2});border:none;border-radius:14px 0 0 14px;cursor:pointer;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:5px;box-shadow:-4px 0 28px ${c}50;transition:width .25s,box-shadow .25s;padding:0 4px}
#ae-fab:hover{width:52px;box-shadow:-6px 0 36px ${c}70}
#ae-fab.hidden{transform:translateY(-50%) translateX(100%)}
#ae-fab span.fi{font-size:1.2rem;color:#fff}
#ae-fab span.lt{font-size:0.52rem;font-weight:900;letter-spacing:.1em;text-transform:uppercase;color:rgba(255,255,255,.8);writing-mode:vertical-rl;transform:rotate(180deg)}
/* ═══════ PANEL ═══════ */
#ae-panel{position:fixed;right:0;top:0;bottom:0;width:430px;max-width:100vw;z-index:1100;background:#080612;border-left:1px solid ${c}25;display:flex;flex-direction:column;transform:translateX(100%);transition:transform .38s cubic-bezier(.4,0,.2,1);box-shadow:-16px 0 80px rgba(0,0,0,.85);font-family:'Montserrat','Exo 2',sans-serif}
#ae-panel.open{transform:translateX(0)}
/* Header */
.ae-hd{padding:16px 18px;border-bottom:1px solid ${c}18;background:linear-gradient(135deg,${c}12,${c2}06);display:flex;align-items:center;gap:10px;flex-shrink:0}
.ae-hd-title{font-size:.9rem;font-weight:800;color:#fff;flex:1;letter-spacing:.04em}
.ae-hd-sub{font-size:.62rem;color:#555}
.ae-close-btn{width:30px;height:30px;border-radius:8px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);color:#777;cursor:pointer;font-size:.85rem;display:flex;align-items:center;justify-content:center;transition:all .2s}
.ae-close-btn:hover{background:${c}30;color:#fff}
/* Token bar */
.ae-token-bar{padding:8px 18px;border-bottom:1px solid rgba(255,255,255,.05);background:rgba(0,0,0,.25);display:flex;align-items:center;gap:8px;flex-shrink:0}
.ae-token-pill{font-size:.68rem;font-weight:800;color:${c};background:${c}15;border:1px solid ${c}30;padding:2px 10px;border-radius:100px}
.ae-token-track{flex:1;height:4px;background:rgba(255,255,255,.07);border-radius:100px;overflow:hidden}
.ae-token-fill{height:100%;background:linear-gradient(90deg,${c},${c2});border-radius:100px;transition:width .5s}
.ae-lesson-cnt{font-size:.62rem;color:#555;margin-left:auto;flex-shrink:0}
/* Tabs */
.ae-tabs{display:flex;border-bottom:1px solid rgba(255,255,255,.06);flex-shrink:0;background:rgba(0,0,0,.2)}
.ae-tab{flex:1;padding:10px 4px;font-size:.62rem;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:#555;cursor:pointer;text-align:center;border-bottom:2px solid transparent;transition:all .2s}
.ae-tab.on{color:${c};border-color:${c};background:${c}08}
.ae-tab:hover:not(.on){color:#888;background:rgba(255,255,255,.02)}
/* Scroll area */
.ae-body{flex:1;overflow-y:auto;padding:16px;scrollbar-width:thin;scrollbar-color:${c}25 transparent}
.ae-body::-webkit-scrollbar{width:3px}
.ae-body::-webkit-scrollbar-thumb{background:${c}30;border-radius:100px}
/* ── CARDS ── */
.ae-card{padding:14px;border-radius:14px;background:rgba(255,255,255,.025);border:1px solid rgba(255,255,255,.07);margin-bottom:12px}
.ae-card.accent{background:${c}08;border-color:${c}22}
.ae-card.green{background:rgba(16,185,129,.07);border-color:rgba(16,185,129,.22)}
.ae-card.red{background:rgba(239,68,68,.07);border-color:rgba(239,68,68,.22)}
.ae-card.gold{background:rgba(245,200,66,.06);border-color:rgba(245,200,66,.2)}
/* Section label */
.ae-sec{font-size:.6rem;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:${c};margin:18px 0 10px;display:flex;align-items:center;gap:6px}
/* Buttons */
.ae-btn{width:100%;padding:12px;border-radius:11px;background:linear-gradient(135deg,${c},${c2});border:none;color:#fff;font-size:.82rem;font-weight:800;cursor:pointer;font-family:inherit;margin-bottom:8px;display:flex;align-items:center;justify-content:center;gap:7px;transition:all .2s;letter-spacing:.03em}
.ae-btn:hover{transform:translateY(-2px);filter:brightness(1.12)}
.ae-btn:disabled{opacity:.45;cursor:not-allowed;transform:none}
.ae-btn.sm{padding:7px 14px;width:auto;font-size:.72rem;margin:0}
.ae-btn.ghost{background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);color:#aaa}
.ae-btn.ghost:hover{background:rgba(255,255,255,.1);color:#fff}
.ae-btn.outline{background:${c}15;border:1px solid ${c}35;color:${c}}
.ae-btn.outline:hover{background:${c}28}
.ae-btn.danger{background:rgba(239,68,68,.15);border:1px solid rgba(239,68,68,.3);color:#ef4444}
/* Task card */
.ae-task{padding:12px 14px;border-radius:13px;background:rgba(255,255,255,.025);border:1px solid rgba(255,255,255,.06);margin-bottom:9px;cursor:pointer;display:flex;gap:10px;align-items:center;transition:all .2s}
.ae-task:hover{background:${c}0e;border-color:${c}28;transform:translateX(3px)}
.ae-task.done{background:rgba(16,185,129,.07);border-color:rgba(16,185,129,.2);cursor:default}
.ae-task.done:hover{transform:none}
.ae-task-icon{font-size:1.5rem;width:40px;height:40px;border-radius:10px;background:${c}12;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.ae-task-title{font-size:.82rem;font-weight:700;color:#e8ecff}
.ae-task-desc{font-size:.68rem;color:#555}
.ae-task-meta{margin-left:auto;text-align:right;flex-shrink:0}
.ae-task-xp{font-size:.7rem;font-weight:800;color:#f5c842}
.ae-task-min{font-size:.62rem;color:#444}
.ae-priority-h{border-left:3px solid #ef4444}
.ae-priority-m{border-left:3px solid #f59e0b}
.ae-priority-l{border-left:3px solid #10b981}
/* Skill bars */
.ae-skill{margin-bottom:12px}
.ae-skill-row{display:flex;justify-content:space-between;margin-bottom:5px}
.ae-skill-name{font-size:.75rem;font-weight:700;color:#ccc}
.ae-skill-val{font-size:.72rem;font-weight:800;color:${c}}
.ae-skill-track{height:5px;background:rgba(255,255,255,.06);border-radius:100px;overflow:hidden}
.ae-skill-fill{height:100%;border-radius:100px;transition:width 1s cubic-bezier(.4,0,.2,1)}
.ae-skill-fill.w{background:linear-gradient(90deg,#ef4444,#f59e0b)}
.ae-skill-fill.m{background:linear-gradient(90deg,#f59e0b,${c})}
.ae-skill-fill.s{background:linear-gradient(90deg,#10b981,#34d399)}
/* Exercise */
.ae-ex{padding:14px;border-radius:13px;background:rgba(255,255,255,.025);border:1px solid rgba(255,255,255,.07);margin-bottom:12px}
.ae-ex-label{font-size:.6rem;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:${c};margin-bottom:7px}
.ae-ex-q{font-size:.85rem;font-weight:700;color:#e8ecff;margin-bottom:11px;line-height:1.55}
.ae-opt{width:100%;padding:9px 13px;border-radius:9px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);color:#e8ecff;cursor:pointer;text-align:left;font-size:.82rem;margin-bottom:6px;transition:all .2s;font-family:inherit}
.ae-opt:hover{background:${c}12;border-color:${c}30}
.ae-opt.ok{background:rgba(16,185,129,.14);border-color:rgba(16,185,129,.38);color:#10b981}
.ae-opt.fail{background:rgba(239,68,68,.14);border-color:rgba(239,68,68,.38);color:#ef4444}
.ae-input{width:100%;padding:10px 13px;border-radius:9px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);color:#e8ecff;font-family:inherit;font-size:.85rem;outline:none;box-sizing:border-box;margin-bottom:8px;transition:border .2s}
.ae-input:focus{border-color:${c}50}
.ae-textarea{width:100%;padding:10px 13px;border-radius:9px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);color:#e8ecff;font-family:inherit;font-size:.82rem;outline:none;box-sizing:border-box;margin-bottom:8px;resize:vertical;min-height:80px;transition:border .2s}
.ae-textarea:focus{border-color:${c}50}
.ae-feedback{font-size:.78rem;padding:8px 11px;border-radius:8px;margin-top:7px}
.ae-feedback.ok{background:rgba(16,185,129,.1);color:#10b981;border:1px solid rgba(16,185,129,.2)}
.ae-feedback.fail{background:rgba(239,68,68,.1);color:#ef4444;border:1px solid rgba(239,68,68,.2)}
.ae-feedback.info{background:${c}10;color:${c};border:1px solid ${c}25}
/* Passage */
.ae-passage{font-size:.8rem;line-height:1.75;color:#c8d0e8;padding:14px;border-radius:11px;background:rgba(255,255,255,.02);border:1px solid rgba(255,255,255,.06);white-space:pre-line;margin-bottom:12px}
/* Badge */
.ae-badge{padding:2px 9px;border-radius:100px;font-size:.62rem;font-weight:800;background:${c}18;border:1px solid ${c}28;color:${c};display:inline-block}
.ae-badge.green{background:rgba(16,185,129,.15);border-color:rgba(16,185,129,.3);color:#10b981}
.ae-badge.gold{background:rgba(245,200,66,.12);border-color:rgba(245,200,66,.28);color:#f5c842}
.ae-badge.red{background:rgba(239,68,68,.15);border-color:rgba(239,68,68,.3);color:#ef4444}
/* Vocab card */
.ae-vocab{padding:10px 13px;border-radius:11px;background:rgba(255,255,255,.025);border:1px solid rgba(255,255,255,.06);margin-bottom:8px;display:flex;gap:10px;align-items:center}
.ae-vocab-w{font-size:.92rem;font-weight:800;color:#e8ecff;min-width:80px}
.ae-vocab-m{font-size:.78rem;color:${c};flex:1}
.ae-vocab-ipa{font-size:.65rem;color:#555}
.ae-vocab-spk{background:none;border:none;cursor:pointer;font-size:.95rem;transition:transform .2s;flex-shrink:0}
.ae-vocab-spk:hover{transform:scale(1.25)}
/* Audio player */
.ae-audio-box{padding:14px;border-radius:12px;background:linear-gradient(135deg,${c}10,${c2}06);border:1px solid ${c}22;margin-bottom:12px}
.ae-audio-title{font-size:.8rem;font-weight:700;color:#e8ecff;margin-bottom:9px}
.ae-audio-btns{display:flex;gap:7px;flex-wrap:wrap;margin-bottom:10px}
.ae-audio-btn{padding:7px 14px;border-radius:100px;font-size:.72rem;font-weight:800;cursor:pointer;font-family:inherit;transition:all .2s;display:inline-flex;align-items:center;gap:5px}
.ae-audio-btn.play{background:${c}20;border:1px solid ${c}40;color:${c}}
.ae-audio-btn.slow{background:rgba(142,68,173,.15);border:1px solid rgba(142,68,173,.3);color:#a78bfa}
.ae-audio-btn.stop{background:rgba(239,68,68,.12);border:1px solid rgba(239,68,68,.25);color:#ef4444}
.ae-audio-btn:hover{filter:brightness(1.2);transform:translateY(-1px)}
.ae-audio-text{font-size:.78rem;color:#aaa;font-style:italic;line-height:1.6;padding:10px;background:rgba(0,0,0,.2);border-radius:8px;display:none}
.ae-audio-text.shown{display:block}
/* Progress bar */
.ae-prog-wrap{margin-bottom:14px}
.ae-prog-track{height:5px;background:rgba(255,255,255,.06);border-radius:100px;overflow:hidden}
.ae-prog-fill{height:100%;background:linear-gradient(90deg,${c},${c2});border-radius:100px;transition:width .4s}
.ae-prog-label{font-size:.65rem;color:#555;margin-top:4px}
/* Roadmap */
.ae-rm-week{padding:13px 13px 13px 18px;border-radius:13px;background:rgba(255,255,255,.025);border:1px solid rgba(255,255,255,.06);margin-bottom:10px;position:relative;overflow:hidden}
.ae-rm-week::before{content:'';position:absolute;left:0;top:0;bottom:0;width:4px;background:linear-gradient(${c},${c2})}
.ae-rm-wnum{font-size:.62rem;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:${c};margin-bottom:3px}
.ae-rm-wfocus{font-size:.82rem;font-weight:700;color:#e8ecff;margin-bottom:7px}
.ae-rm-topics{display:flex;flex-wrap:wrap;gap:5px;margin-bottom:7px}
.ae-rm-topic{padding:2px 8px;border-radius:100px;background:${c}12;border:1px solid ${c}25;font-size:.62rem;font-weight:700;color:${c}}
/* Mic button */
.ae-mic{width:52px;height:52px;border-radius:50%;background:rgba(239,68,68,.15);border:2px solid rgba(239,68,68,.35);color:#ef4444;cursor:pointer;font-size:1.3rem;display:flex;align-items:center;justify-content:center;transition:all .25s;flex-shrink:0}
.ae-mic.recording{background:rgba(239,68,68,.4);border-color:#ef4444;animation:ae-pulse .8s infinite}
@keyframes ae-pulse{0%,100%{box-shadow:0 0 0 0 rgba(239,68,68,.4)}50%{box-shadow:0 0 0 10px rgba(239,68,68,0)}}
/* Loading */
.ae-loading{display:flex;flex-direction:column;align-items:center;justify-content:center;padding:50px 20px;gap:16px}
.ae-spinner{width:44px;height:44px;border:3px solid ${c}20;border-top-color:${c};border-radius:50%;animation:ae-spin .75s linear infinite}
@keyframes ae-spin{to{transform:rotate(360deg)}}
.ae-loading-msg{font-size:.8rem;color:#555;text-align:center;line-height:1.6}
/* Limit warning */
.ae-limit-warn{padding:12px 14px;border-radius:11px;background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.22);display:flex;align-items:center;gap:10px;margin-bottom:12px}
/* Motivation */
.ae-motive{padding:14px;border-radius:13px;background:linear-gradient(135deg,${c}10,${c2}07);border:1px solid ${c}22;margin-bottom:14px}
.ae-motive-greet{font-size:.85rem;font-weight:700;color:#e8ecff;margin-bottom:5px;line-height:1.5}
.ae-motive-tip{font-size:.74rem;color:#888;line-height:1.55}
/* Score result ring */
.ae-result{text-align:center;padding:24px 16px}
.ae-result-pct{font-size:2.5rem;font-weight:800}
.ae-result-msg{font-size:.85rem;color:#888;margin-top:6px}

@media(max-width:480px){#ae-panel{width:100vw}}
`;
        document.head.appendChild(s);
    },

    // ── BUILD PANEL ──
    _buildPanel() {
        // FAB
        const fab = document.createElement('button');
        fab.id = 'ae-fab';
        fab.innerHTML = `<span class="fi">🤖</span><span class="lt">AI Coach</span>`;
        fab.onclick = () => this.toggle();
        document.body.appendChild(fab);

        // Panel
        const panel = document.createElement('div');
        panel.id = 'ae-panel';
        const c = this.langCfg.color;
        const lim = PLAN_LESSON_LIMITS[this.userPlan] || PLAN_LESSON_LIMITS.free;
        panel.innerHTML = `
        <div class="ae-hd">
            <span style="font-size:1.5rem">${this.langCfg.flag}</span>
            <div>
                <div class="ae-hd-title">AI Learning Coach</div>
                <div class="ae-hd-sub">${this.langCfg.name} • ${this.analysis.userLevel} • ${this.userPlan.toUpperCase()}</div>
            </div>
            <button class="ae-close-btn" onclick="window.__AE.toggle()">✕</button>
        </div>
        <div class="ae-token-bar">
            <span class="ae-token-pill">🎫 ${this.userTokens}</span>
            <div class="ae-token-track"><div class="ae-token-fill" style="width:${Math.min(100, this.userTokens / 10)}%"></div></div>
            <span class="ae-lesson-cnt" id="ae-lesson-cnt">📚 ${this.todayLessonCount}/${lim.daily}</span>
        </div>
        <div class="ae-tabs">
            <div class="ae-tab on"  data-tab="plan"    onclick="window.__AE.nav('plan',this)">📅<br>Plan</div>
            <div class="ae-tab"     data-tab="skills"  onclick="window.__AE.nav('skills',this)">📊<br>Skills</div>
            <div class="ae-tab"     data-tab="lesson"  onclick="window.__AE.nav('lesson',this)">🎓<br>Lesson</div>
            <div class="ae-tab"     data-tab="roadmap" onclick="window.__AE.nav('roadmap',this)">🗺️<br>Map</div>
        </div>
        <div class="ae-body" id="ae-body"></div>`;
        document.body.appendChild(panel);
        window.__AE = this;
    },

    toggle() {
        const p = document.getElementById('ae-panel');
        const f = document.getElementById('ae-fab');
        p.classList.toggle('open');
        f.classList.toggle('hidden', p.classList.contains('open'));
    },

    nav(tab, el) {
        document.querySelectorAll('.ae-tab').forEach(t => t.classList.remove('on'));
        if (el) el.classList.add('on');
        this.activeTab = tab;
        this._render(tab);
    },

    // ── RENDER DISPATCHER ──
    _render(tab) {
        const body = document.getElementById('ae-body');
        if (!body) return;
        if (tab === 'plan') this._renderPlan(body);
        else if (tab === 'skills') this._renderSkills(body);
        else if (tab === 'lesson') this._renderLesson(body);
        else if (tab === 'roadmap') this._renderRoadmap(body);
    },

    // ══════════════════════════════════════════════════════════
    // PLAN TAB
    // ══════════════════════════════════════════════════════════
    _renderPlan(body) {
        if (!this.dailyPlan) {
            body.innerHTML = `<div class="ae-loading"><div class="ae-spinner"></div><div class="ae-loading-msg">Bugungi reja yuklanmoqda...</div></div>`;
            return;
        }
        const p = this.dailyPlan;
        const done = p.done || [];
        const lim = PLAN_LESSON_LIMITS[this.userPlan] || PLAN_LESSON_LIMITS.free;
        const remaining = Math.max(0, lim.daily - this.todayLessonCount);

        body.innerHTML = `
        <div class="ae-motive">
            <div class="ae-motive-greet">${p.greeting || 'Xush kelibsiz! 💪'}</div>
            <div class="ae-motive-tip">💡 ${p.motivationTip || ''}</div>
        </div>

        <div class="ae-card gold" style="display:flex;align-items:center;gap:10px;padding:10px 13px">
            <span>⚡</span>
            <div style="flex:1;font-size:.72rem;color:#f5c842">${p.funChallenge || 'Bugun 5 ta yangi so\'z o\'rganing!'}</div>
        </div>

        ${remaining === 0 ? `<div class="ae-limit-warn"><span>⚠️</span><div style="font-size:.75rem;color:#ef4444">Kunlik dars limiti (${lim.daily}) tugadi! Ertaga qayta keling yoki rejani yaxshilang.</div></div>` : ''}

        <div class="ae-sec"><span>📅</span> Bugungi reja <span class="ae-badge">${p.totalMinutes || 30} min</span></div>
        ${(p.tasks || []).map(t => `
        <div class="ae-task ae-priority-${t.priority?.[0] || 'm'} ${done.includes(t.order) ? 'done' : ''}"
             onclick="window.__AE.startTask(${t.order},'${t.type}','${t.skill}',${t.xp})">
            <div class="ae-task-icon">${t.icon}</div>
            <div style="flex:1">
                <div class="ae-task-title">${t.title}</div>
                <div class="ae-task-desc">${t.desc}</div>
            </div>
            <div class="ae-task-meta">
                <div class="ae-task-xp">+${t.xp} XP</div>
                <div class="ae-task-min">${t.min} min</div>
                ${done.includes(t.order) ? '<div style="font-size:1rem;margin-top:2px">✅</div>' : ''}
            </div>
        </div>`).join('')}

        <div class="ae-sec"><span>🎯</span> Haftalik maqsad</div>
        <div class="ae-card" style="font-size:.78rem;color:#aaa;line-height:1.6">${p.weeklyGoal || ''}</div>

        <div style="margin-top:8px">
            <button class="ae-btn outline" onclick="window.__AE.regenPlan()">🔄 Yangi reja yaratish</button>
        </div>
        `;
    },

    async startTask(order, type, skill, xp) {
        // Mark task done in Firebase
        await DB.markTaskDone(this.userId, order, xp);
        if (!this.dailyPlan.done) this.dailyPlan.done = [];
        if (!this.dailyPlan.done.includes(order)) this.dailyPlan.done.push(order);
        // Launch appropriate lesson
        this.nav('lesson', document.querySelector('.ae-tab[data-tab="lesson"]'));
        await this.launchLesson(type);
    },

    async regenPlan() {
        const body = document.getElementById('ae-body');
        body.innerHTML = `<div class="ae-loading"><div class="ae-spinner"></div><div class="ae-loading-msg">Yangi plan yaratyapti...</div></div>`;
        const ud = await DB.getUserData(this.userId);
        this.dailyPlan = await AI_GEN.generateDailyPlan(this.analysis, this.langCfg, ud);
        await DB.savePlan(this.userId, this.dailyPlan, this.langCfg.name);
        this._renderPlan(body);
    },

    // ══════════════════════════════════════════════════════════
    // SKILLS TAB
    // ══════════════════════════════════════════════════════════
    _renderSkills(body) {
        const s = this.analysis.scores;
        const c = this.langCfg.color;
        body.innerHTML = `
        <div class="ae-sec"><span>📊</span> Skill Map</div>
        ${Object.entries(s).map(([sk, val]) => {
            const cls = val < 35 ? 'w' : val < 65 ? 'm' : 's';
            const lbl = val < 35 ? '⚠️ Zaif' : val < 65 ? '📈 O\'rta' : '✅ Kuchli';
            return `<div class="ae-skill">
                <div class="ae-skill-row"><span class="ae-skill-name">${sk} <span style="font-size:.6rem;color:#444">${lbl}</span></span><span class="ae-skill-val">${val}%</span></div>
                <div class="ae-skill-track"><div class="ae-skill-fill ${cls}" style="width:${val}%"></div></div>
            </div>`;
        }).join('')}

        <div class="ae-sec"><span>⚡</span> Eng zaif ko'nikmalar</div>
        ${this.analysis.weak.slice(0, 3).map(([sk, val]) => `
        <div class="ae-card" style="display:flex;align-items:center;gap:10px;padding:11px 13px">
            <span style="font-size:1.2rem">⚠️</span>
            <div style="flex:1">
                <div style="font-size:.82rem;font-weight:700;color:#e8ecff">${sk}</div>
                <div style="font-size:.68rem;color:#555">Score: ${val}%</div>
            </div>
            <button class="ae-btn sm outline" onclick="window.__AE.launchLesson('${sk}')">Train →</button>
        </div>`).join('')}

        <div class="ae-sec"><span>💪</span> Kuchli tomonlar</div>
        ${this.analysis.strong.length ? this.analysis.strong.slice(0, 2).map(([sk, val]) => `
        <div class="ae-card green" style="display:flex;align-items:center;gap:10px;padding:10px 13px">
            <span>✅</span>
            <div style="flex:1;font-size:.8rem;font-weight:700;color:#10b981">${sk} — ${val}%</div>
        </div>`).join('') : '<div class="ae-card" style="font-size:.76rem;color:#555">Ko\'proq mashq qiling — kuchli tomonlar paydo bo\'ladi!</div>'}

        <div class="ae-sec"><span>🎓</span> Dars boshlash</div>
        ${['reading', 'listening', 'speaking', 'writing', 'vocabulary', 'grammar'].map(t => `
        <button class="ae-btn ghost" style="margin-bottom:7px" onclick="window.__AE.launchLesson('${t}')">
            ${{ reading: '📖', listening: '🎧', speaking: '🎤', writing: '✍️', vocabulary: '📚', grammar: '📝' }[t]} ${t.charAt(0).toUpperCase() + t.slice(1)} darsi
        </button>`).join('')}
        `;
    },

    // ══════════════════════════════════════════════════════════
    // LESSON TAB
    // ══════════════════════════════════════════════════════════
    _renderLesson(body) {
        if (!this.currentLesson) {
            const top = this.analysis.weak[0]?.[0] || 'grammar';
            body.innerHTML = `
            <div class="ae-card accent" style="text-align:center;padding:24px">
                <div style="font-size:3rem;margin-bottom:10px">🎓</div>
                <div style="font-size:.95rem;font-weight:800;color:#fff;margin-bottom:8px">AI Dars Generator</div>
                <div style="font-size:.78rem;color:#888;margin-bottom:16px">AI siz uchun maxsus dars tayyorlaydi — zaif tomonlaringizga qarab.</div>
                <button class="ae-btn" onclick="window.__AE.launchLesson('${top}')">✨ ${top} darsi boshlash</button>
            </div>
            <div class="ae-sec"><span>🎯</span> Ko'nikma tanlang</div>
            ${['reading', 'listening', 'speaking', 'writing', 'vocabulary', 'grammar'].map(t => `
            <button class="ae-btn ghost" style="margin-bottom:7px" onclick="window.__AE.launchLesson('${t}')">
                ${{ reading: '📖', listening: '🎧', speaking: '🎤', writing: '✍️', vocabulary: '📚', grammar: '📝' }[t]} ${t.charAt(0).toUpperCase() + t.slice(1)}
            </button>`).join('')}
            `;
            return;
        }
        const tp = this.currentLessonType;
        if (tp === 'reading') this._renderReadingLesson(body);
        else if (tp === 'listening') this._renderListeningLesson(body);
        else if (tp === 'speaking') this._renderSpeakingLesson(body);
        else if (tp === 'writing') this._renderWritingLesson(body);
        else if (tp === 'vocabulary') this._renderVocabLesson(body);
        else if (tp === 'grammar') this._renderGrammarLesson(body);
        else this._renderLesson(body);
    },

    async launchLesson(type) {
        // Map skill names to lesson types
        const typeMap = {
            reading: 'reading', listening: 'listening', speaking: 'speaking',
            writing: 'writing', vocabulary: 'vocabulary', grammar: 'grammar',
            'чтение': 'reading', 'аудирование': 'listening', 'говорение': 'speaking',
            'письмо': 'writing', 'лексика': 'vocabulary', 'грамматика': 'grammar',
            'Lesen': 'reading', 'Hören': 'listening', 'Sprechen': 'speaking',
            'Schreiben': 'writing', 'Wortschatz': 'vocabulary', 'Grammatik': 'grammar'
        };
        const lessonType = typeMap[type] || type;

        const body = document.getElementById('ae-body');

        // Check limit
        const canCreate = await TOKEN_MGR.canCreateLesson(this.userId, this.userPlan);
        if (!canCreate.ok) {
            body.innerHTML = `<div class="ae-limit-warn"><span>🚫</span><div style="font-size:.78rem;color:#ef4444"><b>Limit!</b> ${canCreate.reason}</div></div>
            <button class="ae-btn danger" onclick="window.location.href='../order.html'">⬆️ Rejani yaxshilash</button>`;
            return;
        }

        // Check tokens
        const D = TOKEN_DEDUCTIONS.lesson_create;
        if (this.userPlan !== 'ultimate' && this.userPlan !== 'vip' && this.userTokens < D.own) {
            body.innerHTML = `<div class="ae-limit-warn"><span>💔</span><div style="font-size:.78rem;color:#ef4444">Tokenlar yetarli emas! Dars uchun <b>${D.own}</b> token kerak.</div></div>
            <button class="ae-btn outline" onclick="window.location.href='../order.html'">Tokenlarni to'ldirish</button>`;
            return;
        }

        body.innerHTML = `<div class="ae-loading"><div class="ae-spinner"></div><div class="ae-loading-msg">AI ${lessonType} darsi yaratyapti...<br><small style="color:#444">Bu 5-10 soniya oladi</small></div></div>`;

        try {
            // Deduct tokens BEFORE generation
            await TOKEN_MGR.deductTokens(this.userId, null);
            this.userTokens = Math.max(0, this.userTokens - D.own);
            this.todayLessonCount++;
            this._updateTokenBar();

            const ud = await DB.getUserData(this.userId);
            let lesson;
            if (lessonType === 'reading') lesson = await AI_GEN.generateReading(this.analysis, this.langCfg, ud);
            else if (lessonType === 'listening') lesson = await AI_GEN.generateListening(this.analysis, this.langCfg, ud);
            else if (lessonType === 'speaking') lesson = await AI_GEN.generateSpeaking(this.analysis, this.langCfg, ud);
            else if (lessonType === 'writing') lesson = await AI_GEN.generateWriting(this.analysis, this.langCfg, ud);
            else if (lessonType === 'vocabulary') lesson = await AI_GEN.generateVocabulary(this.analysis, this.langCfg, ud);
            else lesson = await AI_GEN.generateGrammar(this.analysis, this.langCfg, ud);

            this.currentLesson = lesson;
            this.currentLessonType = lessonType;
            this.exerciseIdx = 0;
            this.score = 0;
            this.total = 0;
            this.listenScripts = lesson.scripts || [];
            this.currentScriptIdx = 0;
            this.speakTaskIdx = 0;
            this.writeTaskIdx = 0;

            // Save to Firebase
            this.currentLessonId = await DB.saveLesson(this.userId, lesson, lessonType, this.langCfg.name);

            this._render('lesson');
        } catch (e) {
            console.error('Lesson gen error:', e);
            body.innerHTML = `<div class="ae-card red" style="text-align:center;padding:20px">
                <div style="font-size:1.5rem;margin-bottom:8px">❌</div>
                <div style="font-size:.8rem;color:#ef4444">Dars yaratishda xatolik: ${e.message}</div>
                <button class="ae-btn danger" style="margin-top:12px" onclick="window.__AE.launchLesson('${lessonType}')">Qayta urinish</button>
            </div>`;
        }
    },

    _updateTokenBar() {
        const lim = PLAN_LESSON_LIMITS[this.userPlan] || PLAN_LESSON_LIMITS.free;
        const pill = document.querySelector('.ae-token-pill');
        const fill = document.querySelector('.ae-token-fill');
        const cnt = document.getElementById('ae-lesson-cnt');
        if (pill) pill.textContent = `🎫 ${this.userTokens}`;
        if (fill) fill.style.width = `${Math.min(100, this.userTokens / 10)}%`;
        if (cnt) cnt.textContent = `📚 ${this.todayLessonCount}/${lim.daily}`;
    },

    // ── LESSON HEADER (reusable) ──
    _lessonHeader(lesson, type) {
        const icons = { reading: '📖', listening: '🎧', speaking: '🎤', writing: '✍️', vocabulary: '📚', grammar: '📝' };
        const pct = this.total > 0 ? Math.round(this.score / this.total * 100) : 0;
        const exTotal = this._getExerciseTotal();
        const prog = exTotal > 0 ? Math.round(this.exerciseIdx / exTotal * 100) : 0;
        return `
        <div class="ae-card accent" style="padding:13px">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
                <span style="font-size:1.4rem">${lesson.emoji || icons[type]}</span>
                <div>
                    <div style="font-size:.88rem;font-weight:800;color:#fff">${lesson.title || type + ' lesson'}</div>
                    <div style="display:flex;gap:5px;margin-top:3px">
                        <span class="ae-badge">${type}</span>
                        <span class="ae-badge gold">+${lesson.xpReward || 60} XP</span>
                        <span class="ae-badge">${this.analysis.userLevel}</span>
                    </div>
                </div>
                <button class="ae-btn sm ghost" style="margin-left:auto;padding:5px 10px" onclick="window.__AE._backToLessonMenu()">← Orqaga</button>
            </div>
            <div class="ae-prog-wrap">
                <div class="ae-prog-track"><div class="ae-prog-fill" style="width:${prog}%"></div></div>
                <div class="ae-prog-label">${this.exerciseIdx} / ${exTotal} mashq • Score: ${pct}%</div>
            </div>
        </div>`;
    },

    _backToLessonMenu() {
        TTS.stop();
        this.currentLesson = null;
        this.currentLessonType = null;
        this._render('lesson');
    },

    _getExerciseTotal() {
        const l = this.currentLesson;
        if (!l) return 0;
        const t = this.currentLessonType;
        if (t === 'reading') return (l.comprehension || []).length;
        if (t === 'listening') return (l.scripts || []).reduce((a, s) => (a + (s.questions || []).length), 0) + 1;
        if (t === 'speaking') return (l.tasks || []).length;
        if (t === 'writing') return (l.tasks || []).length;
        if (t === 'vocabulary') return (l.exercises || []).reduce((a, e) => a + 1, 0);
        if (t === 'grammar') return (l.exercises || []).reduce((a, e) => a + Math.max(1, (e.items || []).length), 0);
        return 1;
    },

    // ══════════════════════════════════════════════════════════
    // READING LESSON RENDERER
    // ══════════════════════════════════════════════════════════
    _renderReadingLesson(body) {
        const l = this.currentLesson;
        const qs = l.comprehension || [];
        const cur = qs[this.exerciseIdx];

        body.innerHTML = `
        ${this._lessonHeader(l, 'reading')}

        <!-- Passage -->
        ${this.exerciseIdx === 0 ? `
        <div class="ae-sec"><span>📖</span> Matn o'qing</div>
        <div class="ae-card accent" style="padding:12px">
            <div style="font-size:.85rem;font-weight:700;color:#e8ecff;margin-bottom:8px">${l.passage?.title || ''}</div>
            <div style="display:flex;gap:7px;margin-bottom:10px">
                <button class="ae-audio-btn play" onclick="window.__AE.speakPassage()">▶ O'qib berish</button>
                <button class="ae-audio-btn slow" onclick="window.__AE.speakPassageSlow()">🐌 Sekin</button>
                <button class="ae-audio-btn stop" onclick="TTS.stop()">⏹ Stop</button>
            </div>
            <div style="font-size:.72rem;color:#555;margin-bottom:8px">📝 ~${l.passage?.wordCount || 200} so'z</div>
        </div>
        <div class="ae-passage" id="ae-passage-text">${(l.passage?.text || '').replace(/\n/g, '<br>')}</div>

        <!-- Grammar spotlight -->
        ${l.grammarSpotlight ? `
        <div class="ae-sec"><span>📝</span> Grammar spotlight</div>
        <div class="ae-card" style="padding:12px">
            <div style="font-size:.78rem;font-weight:700;color:${this.langCfg.color};margin-bottom:6px">${l.grammarSpotlight.rule}</div>
            <div style="font-size:.74rem;color:#aaa;margin-bottom:8px">${l.grammarSpotlight.uzbek_explanation}</div>
            ${(l.grammarSpotlight.examples || []).map(e => `<div style="font-size:.76rem;color:#e8ecff;padding:4px 8px;border-radius:6px;background:rgba(255,255,255,.04);margin-bottom:4px">• ${e}</div>`).join('')}
        </div>` : ''}

        <!-- Vocabulary -->
        ${(l.vocabulary || []).length ? `
        <div class="ae-sec"><span>📚</span> Vocabulary</div>
        ${l.vocabulary.map(v => `<div class="ae-vocab">
            <div>
                <div class="ae-vocab-w">${v.word}</div>
                <div class="ae-vocab-ipa">${v.ipa || ''}</div>
            </div>
            <div class="ae-vocab-m">${v.uzbek}</div>
            <button class="ae-vocab-spk" onclick="TTS.speak('${(v.word || '').replace(/'/g, "\\'")}')">🔊</button>
        </div>`).join('')}` : ''}

        <div class="ae-sec"><span>❓</span> Savollar (${qs.length} ta)</div>
        ` : ''}

        <!-- Current question -->
        ${cur ? `
        <div class="ae-ex" id="ae-cur-ex">
            <div class="ae-ex-label">❓ Savol ${this.exerciseIdx + 1} / ${qs.length}</div>
            <div class="ae-ex-q">${cur.q}</div>
            ${(cur.opts || []).map((opt, i) => `
            <button class="ae-opt" onclick="window.__AE.checkMC(this,${i},${cur.ans},'${(cur.exp || '').replace(/'/g, "\\'")}')">
                ${String.fromCharCode(65 + i)}. ${opt}
            </button>`).join('')}
            <div id="ae-fb" class="ae-feedback" style="display:none"></div>
        </div>
        <button class="ae-btn" id="ae-nxt" style="display:none" onclick="window.__AE.nextReadingQ()">Keyingi savol →</button>
        ` : `
        <!-- Summary task -->
        ${l.summaryTask ? `
        <div class="ae-sec"><span>✍️</span> Xulosa yozing</div>
        <div class="ae-card" style="padding:12px;margin-bottom:8px">
            <div style="font-size:.78rem;color:#aaa;margin-bottom:6px">${l.summaryTask.instruction}</div>
            ${(l.summaryTask.keyPoints || []).map(p => `<div style="font-size:.74rem;color:#e8ecff;margin-bottom:4px">• ${p}</div>`).join('')}
        </div>
        <textarea class="ae-textarea" id="ae-summary-input" placeholder="Xulosa yozing..."></textarea>
        <button class="ae-btn outline" onclick="window.__AE.checkSummary()">✓ Tekshirish</button>
        <div id="ae-summary-fb" class="ae-feedback" style="display:none"></div>` : ''}

        <!-- Critical thinking -->
        ${(l.criticalThinking || []).map((ct, i) => `
        <div class="ae-card" style="margin-top:8px">
            <div style="font-size:.8rem;font-weight:700;color:#e8ecff;margin-bottom:5px">💭 ${ct.question}</div>
            <div style="font-size:.72rem;color:#555;margin-bottom:8px">💡 ${ct.hint}</div>
            <textarea class="ae-textarea" id="ae-think-${i}" placeholder="Fikringizni yozing..." style="min-height:55px"></textarea>
        </div>`).join('')}

        <button class="ae-btn" style="margin-top:12px" onclick="window.__AE.finishLesson()">🏁 Darsni yakunlash</button>
        `}
        `;
    },

    speakPassage() {
        const t = this.currentLesson?.passage?.text || '';
        TTS.speak(t);
    },
    speakPassageSlow() {
        const t = this.currentLesson?.passage?.text || '';
        TTS.speakSlow(t);
    },

    checkMC(btn, sel, correct, exp) {
        document.querySelectorAll('.ae-opt').forEach((b, i) => {
            b.onclick = null;
            if (i === correct) b.classList.add('ok');
            else if (i === sel && sel !== correct) b.classList.add('fail');
        });
        const fb = document.getElementById('ae-fb');
        if (fb) {
            const ok = sel === correct;
            fb.style.display = 'block';
            fb.className = `ae-feedback ${ok ? 'ok' : 'fail'}`;
            fb.innerHTML = ok ? `✅ To'g'ri! ${exp}` : `❌ Noto'g'ri. To'g'ri javob: <b>${String.fromCharCode(65 + correct)}</b>. ${exp}`;
            if (ok) { this.score++; TTS.speak(btn.textContent.trim()); }
            this.total++;
        }
        const nxt = document.getElementById('ae-nxt');
        if (nxt) nxt.style.display = 'block';
    },

    nextReadingQ() {
        this.exerciseIdx++;
        this._renderReadingLesson(document.getElementById('ae-body'));
    },

    checkSummary() {
        const inp = document.getElementById('ae-summary-input');
        const fb = document.getElementById('ae-summary-fb');
        if (!inp || !fb) return;
        const words = inp.value.trim().split(/\s+/).filter(Boolean).length;
        fb.style.display = 'block';
        if (words >= 20) {
            fb.className = 'ae-feedback ok';
            fb.textContent = `✅ Yaxshi! ${words} so'z yozdingiz. Davom eting!`;
            this.score++; this.total++;
        } else {
            fb.className = 'ae-feedback fail';
            fb.textContent = `⚠️ Kamida 20 ta so'z yozing. Hozir ${words} ta.`;
        }
    },

    // ══════════════════════════════════════════════════════════
    // LISTENING LESSON RENDERER
    // ══════════════════════════════════════════════════════════
    _renderListeningLesson(body) {
        const l = this.currentLesson;
        const scripts = l.scripts || [];

        // Flatten all questions across scripts
        const allQs = [];
        scripts.forEach((sc, si) => {
            (sc.questions || []).forEach((q, qi) => allQs.push({ ...q, scriptIdx: si, qIdx: qi }));
        });

        // Dictation is last "exercise"
        const isDictation = this.exerciseIdx === allQs.length;
        const cur = !isDictation ? allQs[this.exerciseIdx] : null;
        const curScript = cur ? scripts[cur.scriptIdx] : null;

        body.innerHTML = `
        ${this._lessonHeader(l, 'listening')}

        <!-- Script audio player (always visible) -->
        ${scripts.map((sc, si) => `
        <div class="ae-audio-box" id="ae-script-${si}">
            <div class="ae-audio-title">${sc.type === 'dialogue' ? '💬' : '🎙️'} ${sc.title || `Audio ${si + 1}`}
                <span class="ae-badge" style="margin-left:6px">${sc.type}</span>
            </div>
            <div class="ae-audio-btns">
                <button class="ae-audio-btn play" onclick="window.__AE.playScript(${si})">▶ Tinglash</button>
                <button class="ae-audio-btn slow" onclick="window.__AE.playScriptSlow(${si})">🐌 Sekin</button>
                <button class="ae-audio-btn stop" onclick="TTS.stop()">⏹</button>
                <button class="ae-audio-btn play" onclick="window.__AE.toggleScriptText(${si})" style="background:rgba(255,255,255,.05);border-color:rgba(255,255,255,.12);color:#aaa">📄 Matn</button>
            </div>
            <div class="ae-audio-text" id="ae-script-text-${si}">${(sc.text || '').replace(/\n/g, '<br>')}</div>
        </div>`).join('')}

        <!-- Current question -->
        ${cur ? `
        <div class="ae-ex" id="ae-cur-ex">
            <div class="ae-ex-label">🎧 Savol ${this.exerciseIdx + 1} / ${allQs.length + 1} — Script ${cur.scriptIdx + 1}</div>
            <div class="ae-ex-q">${cur.q}</div>
            ${(cur.opts || []).map((opt, i) => `
            <button class="ae-opt" onclick="window.__AE.checkListenMC(this,${i},${cur.ans},'${(cur.exp || '').replace(/'/g, "\\'")}')">
                ${String.fromCharCode(65 + i)}. ${opt}
            </button>`).join('')}
            <div id="ae-fb" class="ae-feedback" style="display:none"></div>
        </div>
        <button class="ae-btn" id="ae-nxt" style="display:none" onclick="window.__AE.nextListenQ(${allQs.length})">Keyingi →</button>
        ` : isDictation ? `
        <!-- Dictation exercise -->
        <div class="ae-sec"><span>✍️</span> Diktant</div>
        <div class="ae-audio-box">
            <div class="ae-audio-title">📝 Eshitib yozing</div>
            <div style="font-size:.74rem;color:#888;margin-bottom:8px">"${l.dictation?.uzbekTranslation || ''}"</div>
            <div class="ae-audio-btns">
                <button class="ae-audio-btn play" onclick="TTS.speak('${(l.dictation?.sentence || '').replace(/'/g, "\\'")}')">▶ Eshitish</button>
                <button class="ae-audio-btn slow" onclick="TTS.speakSlow('${(l.dictation?.sentence || '').replace(/'/g, "\\'")}')">🐌 Sekin</button>
            </div>
        </div>
        <textarea class="ae-textarea" id="ae-dict-input" placeholder="Eshitganni yozing..."></textarea>
        <button class="ae-btn outline" onclick="window.__AE.checkDictation('${(l.dictation?.sentence || '').replace(/'/g, "\\'")}')">✓ Tekshirish</button>
        <div id="ae-dict-fb" class="ae-feedback" style="display:none"></div>
        <button class="ae-btn" style="margin-top:10px" id="ae-nxt" style="display:none" onclick="window.__AE.finishLesson()">🏁 Yakunlash</button>
        ` : `<button class="ae-btn" onclick="window.__AE.finishLesson()">🏁 Darsni yakunlash</button>`}

        <!-- Phonetics -->
        ${(l.phonetics || []).length && this.exerciseIdx === 0 ? `
        <div class="ae-sec"><span>🔊</span> Talaffuz</div>
        ${l.phonetics.map(ph => `
        <div class="ae-card" style="padding:11px">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:5px">
                <span style="font-size:1rem;font-weight:800;color:${this.langCfg.color}">${ph.sound}</span>
                <span style="font-size:.7rem;color:#555">${ph.tip}</span>
            </div>
            <div style="display:flex;gap:6px;flex-wrap:wrap">
                ${(ph.examples || []).map(w => `<button class="ae-badge" style="cursor:pointer;border:none;background:${this.langCfg.color}18;padding:4px 10px" onclick="TTS.speak('${w}')">${w} 🔊</button>`).join('')}
            </div>
        </div>`).join('')}` : ''}
        `;
    },

    playScript(idx) {
        const sc = (this.currentLesson?.scripts || [])[idx];
        if (sc) TTS.speak(sc.text);
    },
    playScriptSlow(idx) {
        const sc = (this.currentLesson?.scripts || [])[idx];
        if (sc) TTS.speakSlow(sc.text);
    },
    toggleScriptText(idx) {
        const el = document.getElementById(`ae-script-text-${idx}`);
        if (el) el.classList.toggle('shown');
    },

    checkListenMC(btn, sel, correct, exp) {
        this.checkMC(btn, sel, correct, exp);
    },

    nextListenQ(total) {
        this.exerciseIdx++;
        this._renderListeningLesson(document.getElementById('ae-body'));
    },

    checkDictation(correct) {
        const inp = document.getElementById('ae-dict-input');
        const fb = document.getElementById('ae-dict-fb');
        const nxt = document.getElementById('ae-nxt');
        if (!inp || !fb) return;
        const cWords = correct.toLowerCase().replace(/[.,!?]/g, '').split(' ');
        const uWords = inp.value.trim().toLowerCase().replace(/[.,!?]/g, '').split(' ');
        let hits = 0;
        const hl = cWords.map(w => { if (uWords.includes(w)) { hits++; return `<span style="color:#10b981;font-weight:700">${w}</span>`; } return `<span style="color:#ef4444">${w}</span>`; }).join(' ');
        const pct = Math.round(hits / cWords.length * 100);
        fb.style.display = 'block';
        fb.className = `ae-feedback ${pct >= 70 ? 'ok' : 'fail'}`;
        fb.innerHTML = `<div>To'g'ri: ${hl}</div><div style="margin-top:4px">Sizning: ${inp.value}</div><div style="font-weight:700;margin-top:4px">${pct}% to'g'ri</div>`;
        if (pct >= 70) { this.score++; } this.total++;
        if (nxt) nxt.style.display = 'block';
    },

    // ══════════════════════════════════════════════════════════
    // SPEAKING LESSON RENDERER
    // ══════════════════════════════════════════════════════════
    _renderSpeakingLesson(body) {
        const l = this.currentLesson;
        const tasks = l.tasks || [];
        const cur = tasks[this.speakTaskIdx];

        body.innerHTML = `
        ${this._lessonHeader(l, 'speaking')}

        <!-- Useful phrases (always visible first time) -->
        ${this.speakTaskIdx === 0 ? `
        <div class="ae-sec"><span>💬</span> Foydali iboralar</div>
        ${(l.phrases || []).map(ph => `
        <div class="ae-vocab">
            <div style="flex:1">
                <div style="font-size:.85rem;font-weight:700;color:#e8ecff">${ph.phrase}</div>
                <div style="font-size:.7rem;color:#888">${ph.uzbek} • ${ph.usage}</div>
            </div>
            <button class="ae-vocab-spk" onclick="TTS.speak('${(ph.phrase || '').replace(/'/g, "\\'")}')">🔊</button>
        </div>`).join('')}

        <!-- Warmup -->
        ${l.warmup ? `
        <div class="ae-sec"><span>🔥</span> Isitish mashqi</div>
        <div class="ae-card accent">
            <div style="font-size:.78rem;color:#aaa;margin-bottom:7px">${l.warmup.instruction}</div>
            <div style="font-size:.85rem;font-weight:700;color:#e8ecff;margin-bottom:8px">"${l.warmup.question}"</div>
            <div class="ae-audio-btns">
                <button class="ae-audio-btn play" onclick="TTS.speak('${(l.warmup.question || '').replace(/'/g, "\\'")}')">▶ Eshitish</button>
                <button class="ae-audio-btn play" style="background:rgba(16,185,129,.1);border-color:rgba(16,185,129,.3);color:#10b981" onclick="TTS.speak('${(l.warmup.modelAnswer || '').replace(/'/g, "\\'")}')">▶ Model javob</button>
            </div>
            <div style="font-size:.75rem;color:#555;margin-top:6px">💡 ${l.warmup.uzbekHint}</div>
        </div>` : ''}` : ''}

        <!-- Current task -->
        ${cur ? this._renderSpeakTask(cur) : `
        <!-- Pronunciation -->
        ${(l.pronunciation || []).length ? `
        <div class="ae-sec"><span>🔤</span> Talaffuz</div>
        ${l.pronunciation.map(p => `
        <div class="ae-card" style="padding:11px">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
                <button class="ae-vocab-spk" style="font-size:1rem" onclick="TTS.speak('${(p.word || '').replace(/'/g, "\\'")}')">🔊</button>
                <span style="font-size:.9rem;font-weight:800;color:#e8ecff">${p.word}</span>
                <span style="font-size:.72rem;color:#555">${p.ipa}</span>
            </div>
            <div style="font-size:.72rem;color:#ef4444;margin-bottom:2px">❌ Xato: ${p.common_mistake}</div>
            <div style="font-size:.72rem;color:#10b981">✅ To'g'ri: ${p.fix}</div>
        </div>`).join('')}` : ''}
        <button class="ae-btn" onclick="window.__AE.finishLesson()">🏁 Darsni yakunlash</button>
        `}
        `;
    },

    _renderSpeakTask(task) {
        const idx = this.speakTaskIdx;
        const tasks = this.currentLesson?.tasks || [];
        const c = this.langCfg.color;

        const header = `<div class="ae-sec"><span>${{ repeat: '🔄', describe: '📝', roleplay: '🎭', opinion: '💭', storytelling: '📖' }[task.type] || '🎤'}</span> 
            Vazifa ${idx + 1}/${tasks.length}: ${task.type}
            <button class="ae-btn sm ghost" style="margin-left:auto" onclick="window.__AE.nextSpeakTask()">O'tkazib yuborish →</button>
        </div>`;

        if (task.type === 'repeat') {
            return `${header}
            <div class="ae-card">
                <div style="font-size:.78rem;color:#aaa;margin-bottom:8px">${task.instruction}</div>
                <div style="font-size:.95rem;font-weight:800;color:#e8ecff;margin-bottom:6px">"${task.sentence}"</div>
                <div style="font-size:.75rem;color:#888;margin-bottom:10px">${task.uzbek}</div>
                <div style="font-size:.72rem;color:${c};margin-bottom:10px">💡 ${task.tip}</div>
                <div class="ae-audio-btns">
                    <button class="ae-audio-btn play" onclick="TTS.speak('${(task.sentence || '').replace(/'/g, "\\'")}')">▶ Eshitish</button>
                    <button class="ae-audio-btn slow" onclick="TTS.speakSlow('${(task.sentence || '').replace(/'/g, "\\'")}')">🐌 Sekin</button>
                    ${this._micButton(idx)}
                </div>
                <div id="ae-mic-transcript-${idx}" style="font-size:.78rem;color:#e8ecff;padding:6px;min-height:20px"></div>
                <div style="display:flex;gap:7px;margin-top:8px">
                    <button class="ae-btn sm outline" onclick="window.__AE.markSpeakDone(${idx},true)">✅ Bajarildi</button>
                    <button class="ae-btn sm ghost" onclick="window.__AE.nextSpeakTask()">Keyingi →</button>
                </div>
            </div>`;
        }
        if (task.type === 'describe') {
            return `${header}
            <div class="ae-card">
                <div style="font-size:.78rem;color:#aaa;margin-bottom:8px">${task.instruction}</div>
                <div style="font-size:.85rem;font-weight:700;color:#e8ecff;margin-bottom:8px">📝 ${task.prompt}</div>
                <div style="display:flex;gap:5px;flex-wrap:wrap;margin-bottom:10px">
                    ${(task.keyWords || []).map(w => `<button class="ae-badge" style="cursor:pointer" onclick="TTS.speak('${w}')">${w} 🔊</button>`).join('')}
                </div>
                <textarea class="ae-textarea" id="ae-speak-text-${idx}" placeholder="Inglizcha/tartibga soling..."></textarea>
                <div class="ae-audio-btns">
                    ${this._micButton(idx)}
                    <button class="ae-audio-btn play" onclick="TTS.speak('${(task.modelAnswer || '').replace(/'/g, "\\'")}')">▶ Model</button>
                </div>
                <div id="ae-mic-transcript-${idx}" style="font-size:.78rem;color:#e8ecff;padding:6px;min-height:20px"></div>
                <button class="ae-btn outline" style="margin-top:8px" onclick="window.__AE.markSpeakDone(${idx},true)">✅ Bajarildi</button>
            </div>`;
        }
        if (task.type === 'roleplay') {
            return `${header}
            <div class="ae-card">
                <div style="font-size:.78rem;color:#aaa;margin-bottom:8px">${task.instruction}</div>
                <div style="padding:10px;background:rgba(255,255,255,.03);border-radius:9px;margin-bottom:10px">
                    <div style="font-size:.75rem;color:#555;margin-bottom:3px">🎭 Ssenariy</div>
                    <div style="font-size:.82rem;color:#e8ecff">${task.scenario}</div>
                    <div style="font-size:.72rem;color:${c};margin-top:5px">Sizning rolingiz: <b>${task.yourRole}</b></div>
                </div>
                <div style="font-size:.78rem;color:#aaa;margin-bottom:5px">Boshlang:</div>
                <div style="font-size:.88rem;font-weight:700;color:#e8ecff;margin-bottom:8px;padding:8px;background:${c}10;border-radius:8px">"${task.openingLine}"</div>
                <button class="ae-audio-btn play" onclick="TTS.speak('${(task.openingLine || '').replace(/'/g, "\\'")}')">▶ Eshitish</button>
                <div style="margin-top:8px;display:flex;gap:5px;flex-wrap:wrap">
                    ${(task.usefulPhrases || []).map(p => `<button class="ae-badge" style="cursor:pointer" onclick="TTS.speak('${p}')">${p}</button>`).join('')}
                </div>
                ${this._micButton(idx)}
                <div id="ae-mic-transcript-${idx}" style="font-size:.78rem;color:#e8ecff;padding:6px;min-height:20px;margin-top:6px"></div>
                <button class="ae-btn outline" style="margin-top:8px" onclick="window.__AE.markSpeakDone(${idx},true)">✅ Yakunlash</button>
            </div>`;
        }
        if (task.type === 'opinion') {
            return `${header}
            <div class="ae-card">
                <div style="font-size:.78rem;color:#aaa;margin-bottom:8px">${task.instruction}</div>
                <div style="font-size:.9rem;font-weight:700;color:#e8ecff;margin-bottom:10px">"${task.question}"</div>
                <div class="ae-audio-btns">
                    <button class="ae-audio-btn play" onclick="TTS.speak('${(task.question || '').replace(/'/g, "\\'")}')">▶ Eshitish</button>
                </div>
                <div style="margin:10px 0;display:flex;gap:5px;flex-wrap:wrap">
                    ${(task.agreePhrases || []).map(p => `<button class="ae-badge" style="cursor:pointer;background:rgba(16,185,129,.12);border-color:rgba(16,185,129,.3);color:#10b981" onclick="TTS.speak('${p}')">${p}</button>`).join('')}
                    ${(task.disagreePhrases || []).map(p => `<button class="ae-badge" style="cursor:pointer;background:rgba(239,68,68,.1);border-color:rgba(239,68,68,.25);color:#ef4444" onclick="TTS.speak('${p}')">${p}</button>`).join('')}
                </div>
                <textarea class="ae-textarea" id="ae-speak-text-${idx}" placeholder="Fikringizni yozing..."></textarea>
                ${this._micButton(idx)}
                <div id="ae-mic-transcript-${idx}" style="font-size:.78rem;color:#e8ecff;padding:6px;min-height:20px"></div>
                <button class="ae-audio-btn play" style="margin-top:8px" onclick="TTS.speak('${(task.modelAnswer || '').replace(/'/g, "\\'")}')">▶ Model javob</button>
                <button class="ae-btn outline" style="margin-top:8px" onclick="window.__AE.markSpeakDone(${idx},true)">✅ Bajarildi</button>
            </div>`;
        }
        if (task.type === 'storytelling') {
            return `${header}
            <div class="ae-card">
                <div style="font-size:.78rem;color:#aaa;margin-bottom:8px">${task.instruction}</div>
                <div style="font-size:.85rem;font-weight:700;color:#e8ecff;margin-bottom:8px">${task.prompt}</div>
                <div style="margin-bottom:8px;display:flex;gap:5px;flex-wrap:wrap">
                    ${(task.timeConnectors || []).map(c => `<button class="ae-badge" style="cursor:pointer" onclick="TTS.speak('${c}')">${c}</button>`).join('')}
                </div>
                <textarea class="ae-textarea" id="ae-speak-text-${idx}" placeholder="Hikoyangizni yozing/gapiring..." style="min-height:90px"></textarea>
                ${this._micButton(idx)}
                <div id="ae-mic-transcript-${idx}" style="font-size:.78rem;color:#e8ecff;padding:6px;min-height:20px"></div>
                <button class="ae-audio-btn play" style="margin-top:8px" onclick="TTS.speak('${(task.modelStory || '').replace(/'/g, "\\'")}')">▶ Model hikoya</button>
                <button class="ae-btn outline" style="margin-top:8px" onclick="window.__AE.markSpeakDone(${idx},true)">✅ Bajarildi</button>
            </div>`;
        }
        return `${header}<button class="ae-btn" onclick="window.__AE.nextSpeakTask()">Keyingi →</button>`;
    },

    _micButton(idx) {
        return `<button class="ae-mic" id="ae-mic-${idx}" onclick="window.__AE.toggleMic(${idx})" style="margin-top:8px">🎤</button>`;
    },

    toggleMic(idx) {
        const btn = document.getElementById(`ae-mic-${idx}`);
        const transcript = document.getElementById(`ae-mic-transcript-${idx}`);
        const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SR) { if (transcript) transcript.textContent = 'Mikrofon qo\'llab-quvvatlanmaydi — matn kiriting'; return; }

        if (this.isRecording) {
            this.recordingMic?.stop(); this.isRecording = false;
            if (btn) { btn.classList.remove('recording'); btn.textContent = '🎤'; }
            return;
        }
        const rec = new SR();
        rec.lang = this.langCfg.tts; rec.continuous = true; rec.interimResults = true;
        rec.onresult = e => {
            let t = '';
            for (let i = e.resultIndex; i < e.results.length; i++) t += e.results[i][0].transcript;
            if (transcript) transcript.textContent = t;
        };
        rec.onerror = () => { this.isRecording = false; if (btn) { btn.classList.remove('recording'); btn.textContent = '🎤'; } };
        rec.onend = () => { this.isRecording = false; if (btn) { btn.classList.remove('recording'); btn.textContent = '🎤'; } };
        rec.start(); this.recordingMic = rec; this.isRecording = true;
        if (btn) { btn.classList.add('recording'); btn.textContent = '⏹'; }
    },

    markSpeakDone(idx, counted) {
        if (counted) { this.score++; this.total++; }
        this.nextSpeakTask();
    },

    nextSpeakTask() {
        if (this.isRecording) { this.recordingMic?.stop(); this.isRecording = false; }
        this.speakTaskIdx++;
        this._renderSpeakingLesson(document.getElementById('ae-body'));
    },

    // ══════════════════════════════════════════════════════════
    // WRITING LESSON RENDERER
    // ══════════════════════════════════════════════════════════
    _renderWritingLesson(body) {
        const l = this.currentLesson;
        const tasks = l.tasks || [];
        const cur = tasks[this.writeTaskIdx];
        const c = this.langCfg.color;

        body.innerHTML = `
        ${this._lessonHeader(l, 'writing')}

        <!-- Warmup (first time) -->
        ${this.writeTaskIdx === 0 && l.warmup ? `
        <div class="ae-sec"><span>🔥</span> Isitish</div>
        <div class="ae-card">
            <div style="font-size:.78rem;color:#aaa;margin-bottom:8px">${l.warmup.instruction}</div>
            ${(l.warmup.sentences || []).map((s, i) => `
            <div style="margin-bottom:8px">
                <div style="font-size:.8rem;font-weight:700;color:#e8ecff;margin-bottom:3px">${s.starter}</div>
                <div style="font-size:.7rem;color:#555;margin-bottom:4px">💡 ${s.hint}</div>
                <input class="ae-input" id="ae-warmup-${i}" placeholder="Davom ettiring..." />
            </div>`).join('')}
        </div>

        <!-- Grammar focus -->
        ${l.grammarFocus ? `
        <div class="ae-sec"><span>📝</span> Grammar Focus</div>
        <div class="ae-card">
            <div style="font-size:.78rem;font-weight:700;color:${c};margin-bottom:5px">${l.grammarFocus.rule}</div>
            <div style="font-size:.74rem;color:#aaa;margin-bottom:7px">${l.grammarFocus.uzbek_explanation}</div>
            ${(l.grammarFocus.examples || []).map(e => `<div style="font-size:.75rem;color:#e8ecff;margin-bottom:3px">✅ ${e}</div>`).join('')}
            ${(l.grammarFocus.common_errors || []).map(e => `<div style="font-size:.75rem;color:#ef4444;margin-bottom:3px">❌ ${e}</div>`).join('')}
        </div>` : ''}` : ''}

        <!-- Current task -->
        ${cur ? this._renderWriteTask(cur) : `
        <button class="ae-btn" onclick="window.__AE.finishLesson()">🏁 Darsni yakunlash</button>
        `}
        `;
    },

    _renderWriteTask(task) {
        const idx = this.writeTaskIdx;
        const tasks = this.currentLesson?.tasks || [];

        const header = `<div class="ae-sec"><span>✍️</span> Vazifa ${idx + 1}/${tasks.length}: ${task.title}
            <button class="ae-btn sm ghost" style="margin-left:auto" onclick="window.__AE.nextWriteTask()">O'tkazish →</button>
        </div>`;

        if (task.type === 'sentence_building') {
            const shuffled = [...(task.words || [])].sort(() => Math.random() - .5);
            return `${header}
            <div class="ae-card">
                <div style="font-size:.78rem;color:#aaa;margin-bottom:8px">${task.instruction}</div>
                <div style="display:flex;gap:5px;flex-wrap:wrap;margin-bottom:10px">
                    ${shuffled.map(w => `<button class="ae-badge" style="cursor:pointer;font-size:.78rem;padding:4px 10px" onclick="window.__AE.addWord('ae-sb-input','${w}')">${w}</button>`).join('')}
                </div>
                <input class="ae-input" id="ae-sb-input" placeholder="So'zlarni bosing yoki yozing...">
                <div style="display:flex;gap:7px;margin-top:5px">
                    <button class="ae-btn sm outline" onclick="window.__AE.checkSentence('ae-sb-input','${(task.correctSentence || '').replace(/'/g, "\\'")}')">✓ Tekshir</button>
                    <button class="ae-btn sm ghost" onclick="document.getElementById('ae-sb-input').value=''">🔄 Tozalash</button>
                    <button class="ae-audio-btn play" style="font-size:.72rem" onclick="TTS.speak('${(task.correctSentence || '').replace(/'/g, "\\'")}')">▶</button>
                </div>
                <div id="ae-sb-fb" class="ae-feedback" style="display:none"></div>
            </div>`;
        }
        if (task.type === 'paragraph') {
            return `${header}
            <div class="ae-card">
                <div style="font-size:.78rem;color:#aaa;margin-bottom:8px">${task.instruction}</div>
                <div style="font-size:.85rem;font-weight:700;color:#e8ecff;margin-bottom:8px">📝 "${task.topic}"</div>
                <div style="display:flex;gap:5px;flex-wrap:wrap;margin-bottom:8px">
                    ${(task.keyWords || []).map(w => `<button class="ae-badge" style="cursor:pointer" onclick="TTS.speak('${w}')">${w} 🔊</button>`).join('')}
                </div>
                <div style="font-size:.7rem;color:#555;margin-bottom:8px">Min: ${task.minWords} so'z</div>
                <textarea class="ae-textarea" id="ae-para-input" placeholder="${task.topic} haqida yozing..." style="min-height:100px" oninput="window.__AE.countWords('ae-para-wc',this.value)"></textarea>
                <div id="ae-para-wc" style="font-size:.68rem;color:#555;margin-bottom:6px">0 so'z</div>
                <div style="display:flex;gap:7px">
                    <button class="ae-btn sm outline" onclick="window.__AE.checkWordCount('ae-para-input',${task.minWords},'ae-para-fb')">✓ Tekshir</button>
                    <button class="ae-audio-btn play" style="font-size:.72rem" onclick="TTS.speak('${(task.modelParagraph || '').replace(/'/g, "\\'")}')">▶ Model</button>
                </div>
                <div id="ae-para-fb" class="ae-feedback" style="display:none"></div>
            </div>`;
        }
        if (task.type === 'email') {
            return `${header}
            <div class="ae-card">
                <div style="font-size:.78rem;color:#aaa;margin-bottom:8px">${task.instruction}</div>
                <div style="padding:10px;background:rgba(255,255,255,.03);border-radius:8px;margin-bottom:10px">
                    <div style="font-size:.72rem;color:#555">Kimga: ${task.recipient}</div>
                    <div style="font-size:.72rem;color:#555">Maqsad: ${task.purpose}</div>
                </div>
                <div style="display:flex;gap:5px;flex-wrap:wrap;margin-bottom:8px">
                    ${(task.usefulPhrases || []).map(p => `<button class="ae-badge" style="cursor:pointer" onclick="window.__AE.addWord('ae-email-input','${p} ')">${p}</button>`).join('')}
                </div>
                <textarea class="ae-textarea" id="ae-email-input" placeholder="Email yozing..." style="min-height:110px" oninput="window.__AE.countWords('ae-email-wc',this.value)"></textarea>
                <div id="ae-email-wc" style="font-size:.68rem;color:#555;margin-bottom:6px">0 so'z</div>
                <div style="display:flex;gap:7px">
                    <button class="ae-btn sm outline" onclick="window.__AE.markWriteDone(${idx},true)">✅ Bajarildi</button>
                    <button class="ae-audio-btn play" style="font-size:.72rem" onclick="TTS.speak('${(task.modelEmail || '').replace(/'/g, "\\'")}')">▶ Model</button>
                </div>
            </div>`;
        }
        if (task.type === 'essay') {
            return `${header}
            <div class="ae-card">
                <div style="font-size:.78rem;color:#aaa;margin-bottom:8px">${task.instruction}</div>
                <div style="font-size:.85rem;font-weight:700;color:#e8ecff;margin-bottom:8px">"${task.question}"</div>
                <div style="font-size:.7rem;color:#555;margin-bottom:8px">Min: ${task.minWords} so'z • Tur: ${task.type_of_essay}</div>
                <!-- Linking words -->
                <div style="display:flex;gap:5px;flex-wrap:wrap;margin-bottom:8px">
                    ${Object.entries(task.linkingWords || {}).map(([cat, ws]) => ws.map(w => `<button class="ae-badge" style="cursor:pointer;font-size:.65rem" onclick="window.__AE.addWord('ae-essay-input','${w} ')">${w}</button>`).join('')).join('')}
                </div>
                <textarea class="ae-textarea" id="ae-essay-input" placeholder="Essay yozing..." style="min-height:120px" oninput="window.__AE.countWords('ae-essay-wc',this.value)"></textarea>
                <div id="ae-essay-wc" style="font-size:.68rem;color:#555;margin-bottom:6px">0 so'z</div>
                <div style="display:flex;gap:7px">
                    <button class="ae-btn sm outline" onclick="window.__AE.checkWordCount('ae-essay-input',${task.minWords},'ae-essay-fb')">✓ Tekshir</button>
                    <button class="ae-audio-btn play" style="font-size:.72rem" onclick="TTS.speak('${(task.modelEssay || '').replace(/'/g, "\\'")}')">▶ Model</button>
                </div>
                <div id="ae-essay-fb" class="ae-feedback" style="display:none"></div>
            </div>`;
        }
        if (task.type === 'correction') {
            return `${header}
            <div>
                ${(task.sentences || []).map((s, i) => `
                <div class="ae-card" style="margin-bottom:8px">
                    <div style="font-size:.8rem;color:#ef4444;margin-bottom:4px">❌ ${s.wrong}</div>
                    <input class="ae-input" id="ae-corr-${i}" data-correct="${s.correct}" placeholder="To'g'risi...">
                    <div style="display:flex;gap:6px">
                        <button class="ae-btn sm outline" onclick="window.__AE.checkCorrection('ae-corr-${i}','ae-corr-fb-${i}','${(s.correct || '').replace(/'/g, "\\'")}','${(s.uzbek_exp || '').replace(/'/g, "\\'")}')">✓</button>
                    </div>
                    <div id="ae-corr-fb-${i}" class="ae-feedback" style="display:none"></div>
                </div>`).join('')}
                <button class="ae-btn outline" style="margin-top:8px" onclick="window.__AE.markWriteDone(${idx},true)">✅ Bajarildi</button>
            </div>`;
        }
        return `${header}<button class="ae-btn" onclick="window.__AE.nextWriteTask()">Keyingi →</button>`;
    },

    addWord(inputId, word) {
        const el = document.getElementById(inputId);
        if (el) el.value = (el.value + ' ' + word).trim() + ' ';
    },
    countWords(wcId, text) {
        const el = document.getElementById(wcId);
        if (el) el.textContent = `${text.trim().split(/\s+/).filter(Boolean).length} so'z`;
    },
    checkWordCount(inputId, min, fbId) {
        const inp = document.getElementById(inputId);
        const fb = document.getElementById(fbId);
        if (!inp || !fb) return;
        const w = inp.value.trim().split(/\s+/).filter(Boolean).length;
        fb.style.display = 'block';
        if (w >= min) { fb.className = 'ae-feedback ok'; fb.textContent = `✅ ${w} so'z yozdingiz! Juda yaxshi!`; this.score++; this.total++; }
        else { fb.className = 'ae-feedback fail'; fb.textContent = `⚠️ ${min - w} ta so'z kam. Hozir: ${w}`; }
    },
    checkSentence(inputId, correct) {
        const inp = document.getElementById(inputId);
        const fb = document.getElementById('ae-sb-fb');
        if (!inp || !fb) return;
        const ok = inp.value.trim().toLowerCase() === correct.toLowerCase();
        fb.style.display = 'block';
        fb.className = `ae-feedback ${ok ? 'ok' : 'fail'}`;
        fb.innerHTML = ok ? `✅ Ajoyib! To'g'ri jumla.` : `❌ To'g'ri: <b>${correct}</b>`;
        if (ok) { this.score++; this.total++; } else this.total++;
    },
    checkCorrection(inputId, fbId, correct, uzbekExp) {
        const inp = document.getElementById(inputId);
        const fb = document.getElementById(fbId);
        if (!inp || !fb) return;
        const ok = inp.value.trim().toLowerCase() === correct.toLowerCase();
        fb.style.display = 'block';
        fb.className = `ae-feedback ${ok ? 'ok' : 'fail'}`;
        fb.innerHTML = ok ? `✅ To'g'ri!` : `❌ To'g'ri: <b>${correct}</b> — ${uzbekExp}`;
        if (ok) { this.score++; } this.total++;
    },
    markWriteDone(idx, counted) {
        if (counted) { this.score++; this.total++; }
        this.nextWriteTask();
    },
    nextWriteTask() {
        this.writeTaskIdx++;
        this._renderWritingLesson(document.getElementById('ae-body'));
    },

    // ══════════════════════════════════════════════════════════
    // VOCABULARY LESSON RENDERER
    // ══════════════════════════════════════════════════════════
    _renderVocabLesson(body) {
        const l = this.currentLesson;
        const exs = l.exercises || [];
        const cur = exs[this.exerciseIdx];
        const c = this.langCfg.color;

        body.innerHTML = `
        ${this._lessonHeader(l, 'vocabulary')}

        <!-- Words (always show) -->
        <div class="ae-sec"><span>📚</span> So'zlar (${(l.words || []).length})</div>
        ${(l.words || []).slice(0, 8).map(v => `
        <div class="ae-vocab">
            <div style="min-width:90px">
                <div class="ae-vocab-w">${v.word}</div>
                <div class="ae-vocab-ipa">${v.ipa || ''}</div>
                <div style="font-size:.62rem;color:#444">${v.pos}</div>
            </div>
            <div>
                <div class="ae-vocab-m">${v.uzbek}</div>
                <div style="font-size:.68rem;color:#555;font-style:italic">${(v.collocations || []).slice(0, 2).join(' • ')}</div>
            </div>
            <button class="ae-vocab-spk" onclick="TTS.speak('${(v.word || '').replace(/'/g, "\\'")}')">🔊</button>
        </div>`).join('')}

        <!-- Exercises -->
        <div class="ae-sec"><span>✏️</span> Mashqlar</div>
        ${cur ? this._renderVocabExercise(cur) : `
        <!-- Idioms -->
        ${(l.idioms || []).length ? `
        <div class="ae-sec"><span>💡</span> Idiomlar</div>
        ${l.idioms.map(id => `
        <div class="ae-card" style="padding:11px">
            <div style="font-size:.85rem;font-weight:700;color:#e8ecff;margin-bottom:3px">${id.expression}</div>
            <div style="font-size:.75rem;color:${c};margin-bottom:4px">${id.meaning}</div>
            <div style="font-size:.72rem;color:#555;font-style:italic">${id.example}</div>
            <button class="ae-vocab-spk" onclick="TTS.speak('${(id.expression || '').replace(/'/g, "\\'")}')">🔊</button>
        </div>`).join('')}` : ''}

        ${l.memoryTrick ? `
        <div class="ae-card gold" style="padding:11px">
            <div style="font-size:.65rem;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:#f5c842;margin-bottom:4px">💡 YODLASH USULI</div>
            <div style="font-size:.78rem;color:#aaa">${l.memoryTrick}</div>
        </div>` : ''}
        <button class="ae-btn" onclick="window.__AE.finishLesson()">🏁 Darsni yakunlash</button>
        `}
        `;
    },

    _renderVocabExercise(ex) {
        if (ex.type === 'match') {
            return `<div class="ae-ex">
                <div class="ae-ex-label">🔗 Juftlash</div>
                <div class="ae-ex-q">${ex.instruction}</div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
                    <div>${(ex.pairs || []).map((p, i) => `<div class="ae-opt" id="ae-ml-${i}" onclick="window.__AE.selectMatchLeft(${i},'${Object.keys(p)[0]}')" style="cursor:pointer">${Object.values(p)[0]}</div>`).join('')}</div>
                    <div>${[...(ex.pairs || [])].sort(() => Math.random() - .5).map((p, i) => `<div class="ae-opt" id="ae-mr-${i}" onclick="window.__AE.selectMatchRight(${i},'${Object.values(p)[1]}')" style="cursor:pointer">${Object.values(p)[1]}</div>`).join('')}</div>
                </div>
                <div id="ae-match-fb" class="ae-feedback" style="display:none"></div>
                <button class="ae-btn" id="ae-nxt" style="display:none;margin-top:8px" onclick="window.__AE.nextVocabEx()">Keyingi →</button>
            </div>`;
        }
        if (ex.type === 'fill') {
            return `<div class="ae-ex">
                <div class="ae-ex-label">✏️ Bo'sh to'ldirish</div>
                <div class="ae-ex-q">${ex.instruction}</div>
                ${(ex.sentences || []).map((s, i) => `
                <div style="margin-bottom:10px">
                    <div style="font-size:.8rem;color:#e8ecff;margin-bottom:3px">${s.text}</div>
                    <div style="font-size:.7rem;color:#555;margin-bottom:4px">💡 ${s.hint}</div>
                    <div style="display:flex;gap:6px">
                        <input class="ae-input" id="ae-fill-${i}" data-ans="${s.answer}" placeholder="Javob..." style="margin:0">
                        <button class="ae-btn sm outline" onclick="window.__AE.checkFillVocab('ae-fill-${i}','ae-fill-fb-${i}')">✓</button>
                    </div>
                    <div id="ae-fill-fb-${i}" class="ae-feedback" style="display:none"></div>
                </div>`).join('')}
                <button class="ae-btn outline" style="margin-top:6px" onclick="window.__AE.nextVocabEx()">Keyingi →</button>
            </div>`;
        }
        return `<div class="ae-ex"><div class="ae-ex-q">${ex.instruction}</div>
            <button class="ae-btn outline" onclick="window.__AE.nextVocabEx()">Keyingi →</button>
        </div>`;
    },

    _matchLeft: null,
    selectMatchLeft(i, word) {
        document.querySelectorAll('[id^="ae-ml-"]').forEach(el => { el.style.background = 'rgba(255,255,255,.04)'; el.style.borderColor = 'rgba(255,255,255,.08)'; });
        document.getElementById(`ae-ml-${i}`).style.background = `${this.langCfg.color}20`;
        document.getElementById(`ae-ml-${i}`).style.borderColor = this.langCfg.color;
        this._matchLeft = { i, word };
    },
    selectMatchRight(i, meaning) {
        if (!this._matchLeft) return;
        const pairs = this.currentLesson?.exercises?.[this.exerciseIdx]?.pairs || [];
        const correct = pairs[this._matchLeft.i];
        const isOk = correct && Object.values(correct)[1] === meaning;
        const fb = document.getElementById('ae-match-fb');
        if (fb) {
            fb.style.display = 'block';
            fb.className = `ae-feedback ${isOk ? 'ok' : 'fail'}`;
            fb.textContent = isOk ? `✅ To'g'ri!` : `❌ Noto'g'ri edi`;
        }
        if (isOk) { this.score++; } this.total++;
        this._matchLeft = null;
        const nxt = document.getElementById('ae-nxt');
        if (nxt) nxt.style.display = 'block';
    },
    checkFillVocab(inputId, fbId) {
        const inp = document.getElementById(inputId);
        const fb = document.getElementById(fbId);
        if (!inp || !fb) return;
        const ok = inp.value.trim().toLowerCase() === inp.dataset.ans?.toLowerCase();
        fb.style.display = 'block';
        fb.className = `ae-feedback ${ok ? 'ok' : 'fail'}`;
        fb.innerHTML = ok ? `✅ To'g'ri!` : `❌ To'g'ri: <b>${inp.dataset.ans}</b>`;
        if (ok) { this.score++; } this.total++;
    },
    nextVocabEx() {
        this.exerciseIdx++;
        this._renderVocabLesson(document.getElementById('ae-body'));
    },

    // ══════════════════════════════════════════════════════════
    // GRAMMAR LESSON RENDERER
    // ══════════════════════════════════════════════════════════
    _renderGrammarLesson(body) {
        const l = this.currentLesson;
        const exGroups = l.exercises || [];
        // Flatten all exercise items
        const allItems = [];
        exGroups.forEach(eg => {
            if (eg.type === 'transform' || eg.type === 'error_correction') (eg.items || []).forEach(it => allItems.push({ ...it, type: eg.type, instruction: eg.instruction }));
            else if (eg.type === 'multiple_choice') (eg.items || []).forEach(it => allItems.push({ ...it, type: 'multiple_choice' }));
            else allItems.push({ ...eg, type: eg.type });
        });
        const cur = allItems[this.exerciseIdx];
        const c = this.langCfg.color;

        body.innerHTML = `
        ${this._lessonHeader(l, 'grammar')}

        <!-- Rule explanation -->
        ${this.exerciseIdx === 0 ? `
        <div class="ae-card accent" style="padding:13px;margin-bottom:10px">
            <div style="font-size:.65rem;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:${c};margin-bottom:6px">📝 QOIDA</div>
            <div style="font-size:.82rem;color:#e8ecff;margin-bottom:5px;line-height:1.6">${l.rule}</div>
            <div style="font-size:.78rem;color:${c};font-family:monospace;padding:6px;background:rgba(0,0,0,.2);border-radius:7px;margin-bottom:8px">${l.structure || ''}</div>
            <button class="ae-audio-btn play" onclick="TTS.speak('${(l.rule || '').replace(/'/g, "\\'")}')">🔊 Qoidani eshitish</button>
        </div>

        <!-- Examples -->
        <div class="ae-sec"><span>💡</span> Misollar</div>
        ${(l.examples || []).map(ex => `
        <div class="ae-vocab" style="align-items:flex-start">
            <div style="flex:1">
                <div style="font-size:.82rem;font-weight:700;color:#e8ecff;margin-bottom:2px">${ex[Object.keys(ex)[0]]}</div>
                <div style="font-size:.74rem;color:#888;margin-bottom:2px">${ex.uzbek}</div>
                <div style="font-size:.68rem;color:#555">${ex.notes}</div>
            </div>
            <button class="ae-vocab-spk" onclick="TTS.speak('${(ex[Object.keys(ex)[0]] || '').replace(/'/g, "\\'")}')">🔊</button>
        </div>`).join('')}

        <!-- Common errors -->
        ${(l.commonErrors || []).length ? `
        <div class="ae-sec"><span>⚠️</span> Keng tarqalgan xatolar</div>
        ${l.commonErrors.map(ce => `
        <div class="ae-card" style="padding:11px">
            <div style="font-size:.76rem;color:#ef4444;margin-bottom:3px">❌ ${ce.wrong}</div>
            <div style="font-size:.76rem;color:#10b981;margin-bottom:3px">✅ ${ce.correct}</div>
            <div style="font-size:.7rem;color:#888">${ce.uzbek_exp}</div>
        </div>`).join('')}` : ''}

        <div class="ae-sec"><span>✏️</span> Mashqlar</div>` : ''}

        <!-- Current exercise item -->
        ${cur ? this._renderGrammarItem(cur) : `
        <!-- Contextual use -->
        ${l.contextualUse ? `
        <div class="ae-sec"><span>📖</span> Kontekstda ishlatish</div>
        <div class="ae-passage" style="margin-bottom:12px">${l.contextualUse}</div>
        <button class="ae-audio-btn play" onclick="TTS.speak('${(l.contextualUse || '').replace(/'/g, "\\'")}')">▶ Eshitish</button>` : ''}
        ${l.quickTip ? `<div class="ae-card gold" style="padding:10px;margin-top:10px"><div style="font-size:.65rem;font-weight:800;color:#f5c842;margin-bottom:3px">💡 MASLAHAT</div><div style="font-size:.76rem;color:#aaa">${l.quickTip}</div></div>` : ''}
        <button class="ae-btn" style="margin-top:12px" onclick="window.__AE.finishLesson()">🏁 Darsni yakunlash</button>
        `}
        `;
    },

    _renderGrammarItem(item) {
        const idx = this.exerciseIdx;
        if (item.type === 'multiple_choice') {
            return `<div class="ae-ex" id="ae-cur-ex">
                <div class="ae-ex-label">📝 Test — savol ${idx + 1}</div>
                <div class="ae-ex-q">${item.q}</div>
                ${(item.opts || []).map((opt, i) => `
                <button class="ae-opt" onclick="window.__AE.checkMC(this,${i},${item.ans},'${(item.exp || '').replace(/'/g, "\\'")}')">
                    ${String.fromCharCode(65 + i)}. ${opt}
                </button>`).join('')}
                <div id="ae-fb" class="ae-feedback" style="display:none"></div>
                <button class="ae-btn" id="ae-nxt" style="display:none;margin-top:8px" onclick="window.__AE.nextGrammarItem()">Keyingi →</button>
            </div>`;
        }
        if (item.type === 'transform') {
            return `<div class="ae-ex">
                <div class="ae-ex-label">🔄 O'zgartirish — ${idx + 1}</div>
                ${item.instruction ? `<div style="font-size:.72rem;color:#888;margin-bottom:7px">${item.instruction}</div>` : ''}
                <div class="ae-ex-q">${item.base}</div>
                <input class="ae-input" id="ae-tr-inp" placeholder="O'zgartirilgan javob...">
                <div style="display:flex;gap:7px">
                    <button class="ae-btn sm outline" onclick="window.__AE.checkTransform('${(item.answer || '').replace(/'/g, "\\'")}')">✓ Tekshir</button>
                    <button class="ae-audio-btn play" style="font-size:.72rem" onclick="TTS.speak('${(item.answer || '').replace(/'/g, "\\'")}')">▶</button>
                </div>
                <div id="ae-fb" class="ae-feedback" style="display:none"></div>
                <button class="ae-btn" id="ae-nxt" style="display:none;margin-top:8px" onclick="window.__AE.nextGrammarItem()">Keyingi →</button>
            </div>`;
        }
        if (item.type === 'error_correction') {
            return `<div class="ae-ex">
                <div class="ae-ex-label">🔍 Xatoni toping — ${idx + 1}</div>
                ${item.instruction ? `<div style="font-size:.72rem;color:#888;margin-bottom:7px">${item.instruction}</div>` : ''}
                <div style="font-size:.84rem;color:#ef4444;margin-bottom:8px;padding:8px;background:rgba(239,68,68,.07);border-radius:8px">❌ ${item.wrong}</div>
                <input class="ae-input" id="ae-ec-inp" placeholder="To'g'ri variant...">
                <button class="ae-btn sm outline" onclick="window.__AE.checkTransform('${(item.correct || '').replace(/'/g, "\\'")}')">✓ Tekshir</button>
                <div id="ae-fb" class="ae-feedback" style="display:none"></div>
                <button class="ae-btn" id="ae-nxt" style="display:none;margin-top:8px" onclick="window.__AE.nextGrammarItem()">Keyingi →</button>
            </div>`;
        }
        return `<button class="ae-btn outline" onclick="window.__AE.nextGrammarItem()">Keyingi →</button>`;
    },

    checkTransform(correct) {
        const inp = document.getElementById('ae-tr-inp') || document.getElementById('ae-ec-inp');
        const fb = document.getElementById('ae-fb');
        const nxt = document.getElementById('ae-nxt');
        if (!inp || !fb) return;
        const ok = inp.value.trim().toLowerCase() === correct.toLowerCase();
        fb.style.display = 'block';
        fb.className = `ae-feedback ${ok ? 'ok' : 'fail'}`;
        fb.innerHTML = ok ? `✅ To'g'ri!` : `❌ To'g'ri: <b>${correct}</b>`;
        if (ok) { this.score++; TTS.speak(correct); } this.total++;
        inp.disabled = true;
        if (nxt) nxt.style.display = 'block';
    },
    nextGrammarItem() {
        this.exerciseIdx++;
        this._renderGrammarLesson(document.getElementById('ae-body'));
    },

    // ══════════════════════════════════════════════════════════
    // FINISH LESSON
    // ══════════════════════════════════════════════════════════
    async finishLesson() {
        TTS.stop();
        if (this.isRecording) { this.recordingMic?.stop(); this.isRecording = false; }

        const pct = this.total > 0 ? Math.round(this.score / this.total * 100) : 75;
        const xp = this.currentLesson?.xpReward || 60;
        const skill = this.currentLessonType || 'grammar';

        if (this.currentLessonId && this.userId) {
            await DB.completeLesson(this.userId, this.currentLessonId, pct, skill, xp);
        }

        // Update local skill score
        if (this.analysis?.scores?.[skill] !== undefined) {
            this.analysis.scores[skill] = Math.min(100, this.analysis.scores[skill] + Math.ceil(pct / 10));
        }

        const c = this.langCfg.color;
        const body = document.getElementById('ae-body');
        const circleClr = pct >= 80 ? '#10b981' : pct >= 60 ? '#f59e0b' : '#ef4444';
        body.innerHTML = `
        <div class="ae-result">
            <div style="font-size:4rem;margin-bottom:10px">${pct >= 80 ? '🏆' : pct >= 60 ? '✅' : '💪'}</div>
            <div class="ae-result-pct" style="color:${circleClr}">${pct}%</div>
            <div class="ae-result-msg">${this.score} / ${this.total || 1} to'g'ri</div>

            <div style="display:flex;gap:8px;justify-content:center;margin:14px 0">
                <div class="ae-card" style="padding:11px 18px;text-align:center">
                    <div style="font-size:1.1rem;font-weight:800;color:#f5c842">+${xp}</div>
                    <div style="font-size:.62rem;color:#555">XP</div>
                </div>
                <div class="ae-card" style="padding:11px 18px;text-align:center">
                    <div style="font-size:1.1rem;font-weight:800;color:${c}">${skill}</div>
                    <div style="font-size:.62rem;color:#555">Skill</div>
                </div>
                <div class="ae-card" style="padding:11px 18px;text-align:center">
                    <div style="font-size:1.1rem;font-weight:800;color:${circleClr}">${pct >= 80 ? 'Ajoyib!' : pct >= 60 ? 'Yaxshi!' : 'Davom eting!'}</div>
                    <div style="font-size:.62rem;color:#555">Natija</div>
                </div>
            </div>

            <div style="padding:12px;border-radius:11px;background:${c}10;border:1px solid ${c}22;margin-bottom:16px;font-size:.78rem;color:#aaa;line-height:1.55">
                ${pct >= 80 ? 'Ajoyib natija! Siz bu ko\'nikmani juda yaxshi o\'rganmoqdasiz. Davom eting! 🚀' :
                pct >= 60 ? 'Yaxshi ish! Biroz mashq qilib, siz yanada yaxshilanasiz. Ko\'proq urinib ko\'ring! 💪' :
                    'Tushkunlikka tushmang! Har mashq sizi yaxshiroq qiladi. Qayta urinib ko\'ring! 🌱'}
            </div>

            <button class="ae-btn" onclick="window.__AE._resetAndLesson('${skill}')">🔄 Yana mashq</button>
            <button class="ae-btn ghost" onclick="window.__AE._backToLessonMenu()">← Boshqa dars</button>
            <button class="ae-btn ghost" onclick="window.__AE.nav('plan', document.querySelector('[data-tab=\\'plan\\']'))">📅 Rejaga qaytish</button>
        </div>`;

        this.currentLesson = null;
        this.currentLessonId = null;
        this.currentLessonType = null;
    },

    _resetAndLesson(type) {
        this.currentLesson = null; this.exerciseIdx = 0; this.score = 0; this.total = 0;
        this.speakTaskIdx = 0; this.writeTaskIdx = 0;
        this.launchLesson(type);
    },

    // ══════════════════════════════════════════════════════════
    // ROADMAP TAB
    // ══════════════════════════════════════════════════════════
    _renderRoadmap(body) {
        if (!this.roadmap) {
            body.innerHTML = `
            <div class="ae-card accent" style="text-align:center;padding:24px">
                <div style="font-size:3rem;margin-bottom:12px">🗺️</div>
                <div style="font-size:.9rem;font-weight:800;color:#fff;margin-bottom:8px">AI Roadmap</div>
                <div style="font-size:.78rem;color:#888;margin-bottom:16px">AI siz uchun 4 haftalik o'quv rejasini tuzadi.</div>
                <button class="ae-btn" onclick="window.__AE.genRoadmap()">🗺️ Roadmap yaratish</button>
            </div>`;
            return;
        }
        const r = this.roadmap; const c = this.langCfg.color;
        body.innerHTML = `
        <div class="ae-card accent" style="padding:12px;margin-bottom:12px">
            <div style="display:flex;gap:8px;align-items:center">
                <div style="flex:1">
                    <div style="font-size:.65rem;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:${c}">📈 DARAJA</div>
                    <div style="font-size:.88rem;font-weight:700;color:#e8ecff">${r.currentLevel} → ${r.targetLevel}</div>
                </div>
                <span class="ae-badge">${r.estimatedWeeks} hafta</span>
            </div>
            ${r.overview ? `<div style="font-size:.74rem;color:#888;margin-top:7px">${r.overview}</div>` : ''}
        </div>

        <div class="ae-sec"><span>📅</span> Haftalik reja</div>
        ${(r.weeks || []).map(w => `
        <div class="ae-rm-week">
            <div class="ae-rm-wnum">${w.emoji || '📅'} Hafta ${w.week}</div>
            <div class="ae-rm-wfocus">${w.focus}</div>
            <div class="ae-rm-topics">
                ${(w.topics || []).map(t => `<span class="ae-rm-topic">${t}</span>`).join('')}
            </div>
            <div style="font-size:.74rem;color:#888;margin-bottom:4px">🎯 ${w.milestone}</div>
            <div style="font-size:.7rem;color:#f5c842">⭐ Maqsad: ${w.xpTarget} XP • ${w.lessonsPerDay} dars/kun</div>
        </div>`).join('')}

        <div class="ae-sec"><span>📅</span> Jadval</div>
        <div class="ae-card" style="padding:12px">
            <div style="font-size:.78rem;color:#ccc;margin-bottom:5px">📆 Haftada ${r.schedule?.daysPerWeek || 5} kun</div>
            <div style="font-size:.78rem;color:#ccc;margin-bottom:5px">⏱ Kuniga ${r.schedule?.minutesPerDay || 30} daqiqa</div>
            <div style="font-size:.76rem;color:#aaa">${r.schedule?.bestTime || ''}</div>
        </div>

        ${r.longTermGoal ? `
        <div class="ae-card gold" style="padding:11px;margin-top:8px">
            <div style="font-size:.65rem;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:#f5c842;margin-bottom:4px">🎯 UZOQ MUDDATLI MAQSAD</div>
            <div style="font-size:.78rem;color:#aaa">${r.longTermGoal}</div>
        </div>`: ''}

        ${r.examTip ? `
        <div class="ae-card" style="padding:11px;margin-top:8px">
            <div style="font-size:.65rem;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:${c};margin-bottom:4px">📋 ${this.langCfg.exam} MASLAHAT</div>
            <div style="font-size:.78rem;color:#aaa">${r.examTip}</div>
        </div>`: ''}

        <div style="margin-top:14px">
            <button class="ae-btn ghost" onclick="window.__AE.genRoadmap()">🔄 Roadmapni yangilash</button>
        </div>`;
    },

    async genRoadmap() {
        const body = document.getElementById('ae-body');
        body.innerHTML = `<div class="ae-loading"><div class="ae-spinner"></div><div class="ae-loading-msg">Roadmap yaratyapti...</div></div>`;
        const ud = await DB.getUserData(this.userId);
        this.roadmap = await AI_GEN.generateRoadmap(this.analysis, this.langCfg, ud);
        await DB.saveRoadmap(this.userId, this.roadmap, this.langCfg.name);
        this._renderRoadmap(body);
    }
};

// ══════════════════════════════════════════════════════════════
// BOOTSTRAP — auto-detect language, load user, start engine
// ══════════════════════════════════════════════════════════════
(async function bootstrap() {
    const detectedLang = LANG.detect();
    const langCfg = LANG.cfg(detectedLang);

    onAuthStateChanged(_auth, async user => {
        if (!user) return;

        try {
            const userData = await DB.getUserData(user.uid);
            await ENGINE.init(user.uid, userData, langCfg);

            // Load or generate daily plan
            if (!ENGINE.dailyPlan) {
                const ud = await DB.getUserData(user.uid);
                ENGINE.dailyPlan = await AI_GEN.generateDailyPlan(ENGINE.analysis, langCfg, ud);
                await DB.savePlan(user.uid, ENGINE.dailyPlan, langCfg.name);
            }

            // Refresh plan tab
            ENGINE._render('plan');

            console.log(`✅ AI Adaptive Engine v3 ready — ${langCfg.name} | Level: ${ENGINE.analysis.userLevel}`);
        } catch (e) {
            console.error('Engine bootstrap error:', e);
        }
    });
})();

export { ENGINE, AI_GEN, LANG, ANALYZER, TOKEN_MGR, TTS, DB };