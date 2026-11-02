# Deploy runbook (build plan, day 8)

Go-ahead given 2026-11-01. Steps marked **you** need Dushyant's accounts or hands: passwords, payment details and account creation are his alone.

## Status (2026-11-02)

| Piece | State |
|---|---|
| GitHub | `ayudhinc/BlackboxAI`, private, `main` pushed |
| Neon | Project `blackboxai` (`winter-voice-41686139`), org Ayudh, aws-us-east-1, all migrations applied |
| Vercel | Project `blackboxai` (team ayudh-incs-projects), root `apps/web`, connected to the repo; production build READY at `https://blackboxai-ayudh-incs-projects.vercel.app`. Env set: `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `DAILY_BUDGET_USD`. R2 variables set too. Deployment Protection is off; the app's own gate holds (pages redirect to `/login`, APIs return 401). |
| R2 | Bucket `blackboxai` (private, Western North America) created, with CORS allowing PUT and GET from the production origin. Account API token "BlackboxAI R2 Account Token" created (Object Read & Write, this bucket only). Keys in `.env` and in Vercel's environment |
| Fly | Signed in. **Blocked on billing:** org `ayudh` has one open invoice, GWTL7RNT-0003 (September 2026, $38.79 remaining); the later invoice is paid. Fly refuses app creation until it is settled |
| Operator account | Not created: Dushyant's password |

## What runs where

| Piece | Where | Notes |
|---|---|---|
| Web (`apps/web`) | Vercel | Root directory `apps/web`; pnpm workspace detected from the root lockfile |
| Worker (`apps/worker`) | Fly.io, 1 shared CPU, 1 GB | ffmpeg in the image; not public; health check on 3502 |
| Database | Neon, org Ayudh, project `blackboxai` | Pooled connection string for both web and worker |
| Files | Cloudflare R2, bucket `blackboxai` | Browsers upload recordings directly with presigned PUT URLs |
| Models | Meta Model API | Worker only; the web app never calls a model |

The sandbox stays on the laptop. The hosted app verifies any uploaded recording, so it does not need the sandbox.

## Steps

1. **You:** create the Neon project `blackboxai` in the Neon console (free tier; not through the Vercel Marketplace).
2. Migrate it: `DATABASE_URL="$(neonctl connection-string main --project-id <id> --pooled)" pnpm db:migrate`. The URL is passed inline and never written to a file.
3. **You:** create the R2 bucket `blackboxai` and an API token scoped to it (Object Read & Write). R2 needs a payment method on the Cloudflare account; the free tier covers this demo.
4. Set the bucket's CORS so the hosted origin can upload:
   ```json
   [{ "AllowedOrigins": ["https://<vercel-domain>"], "AllowedMethods": ["PUT", "GET"], "AllowedHeaders": ["content-type"], "MaxAgeSeconds": 3600 }]
   ```
5. **You:** create the Fly app (`fly apps create blackbox-worker`; Fly needs a card on file), then set its secrets:
   `fly secrets set -a blackbox-worker DATABASE_URL=... MODEL_API_KEY=... R2_ACCOUNT_ID=... R2_ACCESS_KEY_ID=... R2_SECRET_ACCESS_KEY=... R2_BUCKET=blackboxai`.
   You type the key values; they never go through chat.
6. Deploy the worker from the repository root:
   `fly deploy . --config apps/worker/fly.toml --dockerfile apps/worker/Dockerfile`.
   Check: `fly checks list -a blackbox-worker` shows the health check passing.
7. Done through the Vercel REST API (no `vercel link`, which would pull env into `.env.local`): project created from the GitHub repository, root `apps/web`. Its environment variables:
   `DATABASE_URL`, `BETTER_AUTH_SECRET` (`openssl rand -base64 32`), `BETTER_AUTH_URL` (the production URL), `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `DAILY_BUDGET_USD`.
8. **You:** create the operator account against Neon. It asks for the password on the terminal:
   `DATABASE_URL="$(neonctl connection-string --project-id winter-voice-41686139 --pooled)" pnpm create-operator <email> "<name>"`
9. Sign in on the hosted URL, compile and sign off the two demo policies, and upload one recording. Done when the run reaches a verdict.

## Never

- `vercel env pull` or `vercel link`: both rewrite `.env.local`.
- `seed-dev-operator` against a hosted database. It refuses anyway.
- Deploying without the go-ahead.
