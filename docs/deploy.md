# Deploy runbook (build plan, day 8)

Nothing here has been run. It needs Dushyant's go-ahead, and the steps marked **you** need his accounts or his hands: passwords, payment details and account creation are his alone.

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
7. **You:** create the Vercel project from the GitHub repository, with root directory `apps/web`. This needs the repository pushed, which needs your word. Set its environment variables:
   `DATABASE_URL`, `BETTER_AUTH_SECRET` (`openssl rand -base64 32`), `BETTER_AUTH_URL` (the production URL), `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `DAILY_BUDGET_USD`.
8. **You:** create the operator account against Neon: `DATABASE_URL=... pnpm create-operator <email> "<name>"`. It asks for the password on the terminal.
9. Sign in on the hosted URL, compile and sign off the two demo policies, and upload one recording. Done when the run reaches a verdict.

## Never

- `vercel env pull` or `vercel link`: both rewrite `.env.local`.
- `seed-dev-operator` against a hosted database. It refuses anyway.
- Deploying without the go-ahead.
