# Writing a LinguaVerse video lesson (instructions for lesson writers)

You write complete ~25-minute video lessons for Uzbek-speaking learners. A human Uzbek
teacher records every `say_native` block aloud on camera; an English TTS voice
(ElevenLabs) speaks every `say`. The JSON goes straight onto the live site, so it must be
accurate, natural and finished. Nothing you write is a draft.

## Before writing each lesson
1. `cd /home/claude/linguaverse`
2. `node scripts/lesson-brief.mjs english <ID>` gives the topic, mandatory teaching points,
   homework task and the previous and next lesson. Teach **every** mandatory point in depth.
3. Read `content/uz/english/A1-02.json` once, fully, as the reference for structure, tone,
   field format and density (A1-01 and A1-03 are more examples).

## File
`content/uz/english/<ID>.json`, UTF-8, an object with these keys:
`title` (Uzbek), `goal_uz` (a measurable outcome in Uzbek), `vocab` (10 items `{w, uz}`),
`scenes` (array), `homework_uz` (Uzbek), `quiz` (array).

Each scene has these keys:
- `kind`: one of `intro|explain|example|mistake|practice|recap`
- `title`: short, Uzbek
- `emotion`: one of `neutral|happy|proud|impressed|encouraging|thinking|stern|disappointed|surprised`
- `board`: 1–4 short on-screen lines (English rules, formulas or key phrases, with short Uzbek glosses in brackets)
- `examples`: 0–3 items `{t: English sentence, uz: Uzbek translation}`
- `say`: English model speech for the TTS voice, max 520 characters.
  - At A1–A2: short and clear.
  - At B1+: richer and more natural.
  - At C1–C2: authentic, sophisticated English.
- `say_native`: what the Uzbek teacher says.
  - 250–650 characters (max 700) of natural spoken Uzbek explanation, not a translation.
  - Explain the rule, why it works, when to use it, and contrast it with Uzbek (or Russian where relevant).
  - English words and examples may appear inside it.
- `say_uz`: faithful Uzbek translation of `say` (used for subtitles)
- `practice_seconds`: 8–20 in `practice` scenes, otherwise 0.

`quiz`: 10 questions, or 15 in the level exam lesson (`-25`). Each question has:
- `q`: the question, in English
- `options`: exactly 4 options
- `answer`: the index (0–3) of the correct option
- `why_uz`: a short explanation in Uzbek

Distractors should come from typical mistakes Uzbek speakers make.

## Required shape of each lesson
- **Length:** 42–55 scenes. `node scripts/lesson-check.mjs <file>` must print ✅ (estimated 23–32 minutes; aim for 25–28). Uzbek narration is roughly 1500–2200 words; higher levels can have longer `say`.
- **Order:**
  1. Opening: greet, give a 1–2 sentence recap of the previous lesson and state today's outcome.
  2. For each mandatory point: rule → many examples → contrast with Uzbek → typical mistake (a `mistake` scene with ✗/✓ on the board) → guided `practice` with a pause → an `explain` scene with the answers.
  3. At least 2 realistic listening dialogues (`example`, in `say`), each followed by a comprehension `practice` scene and an answers scene.
  4. A pronunciation or natural-speech point where relevant.
  5. A final productive task (speaking or writing), then a `recap` scene.
  6. Last scene: the homework (from the brief, with a success criterion) and one sentence naming the next lesson's topic in Uzbek, e.g. “Keyingi darsda … o‘rganamiz.”
- **Every practice scene is followed by an answers scene.**
- **Exam lessons (`-25`):** a structured review of the whole level, exam strategy, timed mock tasks across grammar, vocabulary, reading, listening, writing and speaking, and a 15-question quiz.

## Language and quality rules
- **Uzbek orthography:** Latin script; use ‘ (U+2018) in o‘ and g‘, and ’ (U+2019) for tutuq belgisi (ma’no, san’at).
  - Address the learner as “siz”.
  - Tone: warm and confident, like a top teacher.
- **`say_native` is read aloud by a person.** It must contain:
  - no markdown, emojis or bullet symbols;
  - no lesson codes like "A1-04", and no words like "AI", "video", "scene" or "blok";
  - no placeholders like [Your Name] or ___.
  - Refer to other lessons as “oldingi darsda” / “keyingi darsda”.
- **Accuracy is critical.** Double-check every grammar rule, stress position, IPA symbol, spelling and irregular form. British English is the default; mention the American form only where it really differs. If unsure about a claim, leave it out. Never invent rules or statistics.
- **No repetition across scenes.** Each scene adds something new.
- **Level-appropriate content.** Do not teach material from much later levels; you may briefly preview it.
- **Practice prompts must be answerable.** Questions in `say` or on the board must have the answers in the following scene.

## Done when
- [ ] `node scripts/lesson-check.mjs content/uz/english/<ID>.json` prints ✅ for every lesson you wrote.
- [ ] You did not edit any other file and did not run git commands.
