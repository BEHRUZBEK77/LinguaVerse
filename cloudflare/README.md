# Cloudflare hosting

Production: https://linguaverse.akromovbehruz7.workers.dev/

The frontend uses Workers Static Assets. The Worker adapts the existing backend
at `/.netlify/functions/*`, including payment webhooks, without changing client
API URLs. The same Supabase database holds users, purchases and video lesson
metadata. GitHub Releases videos continue to use the existing authenticated
course endpoint; video assets are not copied into the static deployment.

Build: `npm run build:cloudflare`. Test: `npm run test:cloudflare`.
Deploy: set `CLOUDFLARE_API_TOKEN` in the local environment or CI, then run
`npm run deploy:cloudflare`. The deployment uses the official direct-upload API,
preserves existing Worker secrets, and excludes backend sources and lesson answer
files from public assets. `out/` is ignored and must not be committed or published.

All 10 Netlify production environment values were copied as Cloudflare secrets:
FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY, FIREBASE_PROJECT_ID, GROQ_API_KEY,
INPAY_BEARER_TOKEN, INPAY_MERCHANT_ID, INPAY_WEBHOOK_SECRET, MIGRATION_SECRET,
SUPABASE_SERVICE_ROLE_KEY, SUPABASE_URL. No values are stored in this repository.
Team-level Netlify variables were empty. Admin-managed provider keys remain in
the shared database.

## Scheduled jobs and old hosting

At the owner's request, the Netlify site remains running. Its existing daily
renewals (`0 5 * * *`) and leaderboard (`*/15 * * * *`) schedules remain the only
active schedules. Cloudflare implements the same handlers but has **no Cron
Triggers enabled**. Never enable both providers' renewal schedules concurrently.
The deployment script intentionally does not change schedules or Netlify.

The old Netlify URL and payment callback URLs remain available. New checkouts
created on Cloudflare use its production URL. No real charge was submitted during
verification. Signed-in/OAuth flows still require a browser account check; if
Supabase restricts OAuth redirect URLs, allow the Cloudflare origin there.

Validation: 103 existing tests and 5 adapter tests pass. Live home, course page,
API/database access, private-file blocking and a GitHub video byte-range request
were checked. `npm run check` has a pre-existing missing `dev-server.js` failure.
Cloudflare publishing is manual; GitHub video/content workflows keep updating
the shared database independently.
