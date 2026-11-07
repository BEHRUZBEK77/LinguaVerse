# LinguaVerse — instructions for coding agents (OpenCode, Codex, Claude, etc.)

LinguaVerse teaches foreign languages to Uzbek speakers. Each course has 150 video
lessons (A1–C2, 25 per level). A lesson is one JSON file; GitHub Actions turns it into
a narrated video automatically. Your main job here is usually **writing lesson files**.

## One-time setup (every new clone)

    git config core.hooksPath .githooks

This turns on the pre-commit check. If a commit is BLOCKED, read the message, fix the
named lesson files, re-run `lesson-check` until ✅, and commit again. Never use
`--no-verify`, and never edit `.githooks/` or `scripts/` to get past it.

## Writing lessons — the workflow

1. Read `content/YOZUVCHI-YORIQNOMA.md` **fully** before the first lesson. It is the
   complete specification (format, length, quality and language rules, and the section
   "Other target languages"). Follow it exactly.
2. Find what to write: `node scripts/lesson-missing.mjs` (all languages) or
   `node scripts/lesson-missing.mjs <lang> 5` (next 5 IDs for one language).
   Languages: english, russian, turkish, german, spanish, arabic, chinese, korean.
3. For each lesson ID, in order (lessons build on each other):
   - `node scripts/lesson-brief.mjs <lang> <ID>` — topic, vocabulary, grammar and what
     the previous/next lessons cover.
   - Read the previous lesson of the same language (`content/uz/<lang>/`) for style and
     continuity. `content/uz/english/` has all 150 finished lessons as reference.
   - Write `content/uz/<lang>/<ID>.json`.
   - `node scripts/lesson-check.mjs content/uz/<lang>/<ID>.json` — fix until it prints ✅.
4. After each batch of lessons that pass the check, commit **only those lesson files**
   and push:
   `git add content/uz/<lang>/<IDs>.json && git commit -m "<lang>: <IDs>" && git push`
   Pushing to `main` publishes them to the site and queues their videos.

## Hard rules

- Never push a lesson that does not print ✅ in `lesson-check`. ⚠️ (too short/long) is NOT ✅.
- Write lesson files with your file-write tool, always as UTF-8. On Windows never use
  PowerShell `Out-File`, `Set-Content` or `>` to write JSON — they break o‘, ī, ü, п into
  mojibake (oâ€˜, Ä«). `lesson-check` rejects such files; rewrite them, don't "fix" with scripts.
- Do not leave helper scripts (fix.mjs, debug.js, …) in the repo; never commit them.
- Run `lesson-check` again on every file right before `git add`.
- Do not edit files outside `content/uz/` unless the user explicitly asks.
- Do not rewrite or "improve" existing lessons unless asked.
- `say_native` (teacher's explanation) is **Uzbek in Latin script** with correct
  oʻ/gʻ written with the ‘ character (U+2018), exactly as existing lessons do: o‘, g‘. Natural,
  spoken Uzbek — not a word-for-word translation from English.
- Accuracy over volume: if unsure about a grammar fact, leave it out.
- Run `git pull --rebase` before pushing; another agent may be writing other lessons.
  Never work on the same language as another agent at the same time.

## Project map (only if you need it)

- `content/uz/<lang>/` — lesson JSON files (source of truth for videos).
- `scripts/render-lesson-video.mjs` — renders a lesson to MP4 (runs in GitHub Actions).
- `.github/workflows/videos-sado.yml` — video workflow (every 6 h and on push).
- `.github/workflows/lesson-content.yml` — loads lesson files into the site database.
- `netlify/functions/` — site backend; `js/`, `css/`, `*.html` — frontend.
- Tests: `npm test`.
