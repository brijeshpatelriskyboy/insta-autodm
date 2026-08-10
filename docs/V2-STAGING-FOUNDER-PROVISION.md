# Founder runbook: provision hosted `comment2dm-v2-staging`

Agent environment has **no** Railway/Vercel tokens (user skipped). Hosted resources must be created manually. Production must remain untouched.

## Hard rules

- Do **not** modify production Railway, Vercel, Postgres, Meta app, domains, env vars, or webhook.
- Do **not** copy production `DATABASE_URL` / JWT / encryption secrets.
- Backend start command must be `npm run start:staging` (migrate deploy via safety wrapper).
- Never use `prisma db push --accept-data-loss` on staging.
- Source branch: `v2-smart-campaigns` (or merge PR #29 first so the Meta stub / safety harness is present).
- Meta Level 1 only: stub private-reply; production-shaped signed webhook fixtures.

## 1) Railway — new project

1. Create **new** project named exactly: `comment2dm-v2-staging`
2. Add **new** Postgres. Database / environment name must include both:
   - `v2`
   - `staging`  
   Example: `comment2dm_v2_staging`
3. Add a service from GitHub repo `insta-autodm`:
   - Branch: `v2-smart-campaigns` (after PR #29 merge) **or** `cursor/v2-staging-level1-harness-7d37`
   - Root directory: `backend`
   - Start command: `npm run start:staging`
   - Optional: apply `backend/railway.staging.toml` start command override
4. Set env vars (names from `backend/.env.staging.example`):

| Name | Notes |
|---|---|
| `DATABASE_URL` | **New** staging Postgres only |
| `JWT_SECRET` | New staging secret (min 16) |
| `FRONTEND_URL` | Staging Vercel URL only |
| `CORS_ORIGIN` | Staging Vercel URL only |
| `COMMENT2DM_DEPLOYMENT_ENV` | `staging` |
| `SMART_CAMPAIGNS_ENABLED` | `true` |
| `COMMENT2DM_ALLOW_REMOTE_V2_DB` | `true` |
| `META_PRIVATE_REPLY_STUB` | `true` |
| `COMMENT2DM_ALLOW_META_STUB` | `true` |
| `INSTAGRAM_APP_ID` | Staging fixture signing id (can reuse expected app id shape) |
| `INSTAGRAM_APP_SECRET` | **Staging-only** HMAC secret for fixtures (not production webhook secret reuse required) |
| `META_VERIFY_TOKEN` | Staging-only verify token |
| `NODE_ENV` | `production` |
| `PORT` | `4000` (or Railway default) |

5. Confirm public URL is **not** `insta-autodm-production.up.railway.app`
6. Confirm `/health` returns `"deploymentEnv":"staging"`
7. Confirm `/api/staging/meta-stub/status` shows `stubActive: true`

## 2) Migrations

From a trusted machine with staging `DATABASE_URL` only:

```bash
cd backend
export COMMENT2DM_ALLOW_REMOTE_V2_DB=true
export DATABASE_URL='postgresql://…/comment2dm_v2_staging…'
npm run db:v2:migrate:deploy
```

Or rely on `start:staging` which runs the same wrapper before boot.

## 3) Vercel — new project

1. Create **new** project named exactly: `comment2dm-v2-staging`
2. Root: `frontend`
3. Branch: same as Railway staging source
4. Env:
   - `API_URL` = **new** staging Railway URL
   - `NEXT_PUBLIC_API_URL` = same staging Railway URL
   - `NEXT_PUBLIC_SITE_URL` = provider Vercel URL is fine initially
5. Do **not** configure `v2.comment2dm.ai` yet unless required
6. Do **not** change existing production Vercel project `insta-autodm`

## 4) Existing Vercel Preview risk (read-only)

In production project `insta-autodm`, check Preview `API_URL` / `NEXT_PUBLIC_API_URL`.

- If Preview points at production Railway → **do not** enable Smart Campaign UI testing via those previews.
- Use only the isolated `comment2dm-v2-staging` Vercel project.

## 5) Level 1 E2E against hosted staging

```bash
cd backend
export STAGING_API_URL='https://<staging-railway-host>'
export DATABASE_URL='postgresql://…/comment2dm_v2_staging…'
export COMMENT2DM_ALLOW_REMOTE_V2_DB=true
export JWT_SECRET='<same as staging Railway>'
export INSTAGRAM_APP_SECRET='<same as staging Railway>'
npm run staging:level1-e2e
```

## 6) Meta

- Do **not** change production Meta app or webhook URL.
- Do **not** create Level 2 staging Meta app yet.

## 7) After hosted E2E passes

Reassess Level 2. Default recommendation until hosted proof exists: **HOLD**.
