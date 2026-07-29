# One-time: apply dm_events private-reply schema (Railway)

Use this **once** on production after commit `950fc7b` failed because
`prisma db push` refused the unique index without `--accept-data-loss`.

Production `dm_events` was confirmed **empty**. This script re-checks
`COUNT(*) = 0` and **aborts** if the table is not empty. It does **not**
run `DELETE`, and it does **not** change `start:prod`.

## What it does

1. Connects with `DATABASE_URL`
2. `SELECT COUNT(*) FROM dm_events` → abort unless `0`
3. No-op success if unique index `dm_events_instagramAccountId_commentId_key` already exists
4. Otherwise runs `scripts/sql/apply-dm-event-private-reply.sql` in one transaction:
   - create enum `DmEventStatus` (idempotent)
   - add private-reply columns
   - create unique + user/createdAt indexes
   - add FK to `instagram_accounts`
5. On any error → transaction rollback; process exits non-zero

## Command to run on Railway

Railway service **Root Directory** is `backend`.

### Option A — Railway dashboard one-off command (recommended)

1. Open the **insta-autodm** API service on Railway  
2. Ensure you are on a deployment image that includes this script (merge/deploy this PR’s commit first, **or** run from a shell on a release that already has these files)  
3. **Settings → One-off command** / **Shell** / **Run command**:

```bash
node scripts/apply-dm-event-private-reply.cjs
```

Equivalent npm script:

```bash
npm run db:apply-dm-event-private-reply
```

### Option B — Railway CLI (from your machine)

```bash
# Link/select the production API service, then:
railway run node scripts/apply-dm-event-private-reply.cjs
```

(`railway run` injects production `DATABASE_URL`. Run from the `backend` directory, or set the service root accordingly.)

## After success

Redeploy or restart the API so normal startup runs:

```bash
npx prisma db push && node dist/index.js
```

`db push` should then be a no-op (schema already matches).  
Do **not** put `--accept-data-loss` into `start:prod`.

## Failure behaviour

| Situation | Behaviour |
|-----------|-----------|
| `dm_events` count ≠ 0 | Abort, no DDL |
| `instagram_accounts` missing | Abort, no DDL |
| Mid-apply SQL error | Transaction rollback; schema unchanged |
| Already applied (unique index present) | Exit 0, no changes |

## Rollback

This apply only adds columns/indexes/enum/FK on an empty table.

If you must undo **before** the app writes rows:

```sql
ALTER TABLE "dm_events" DROP CONSTRAINT IF EXISTS "dm_events_instagramAccountId_fkey";
DROP INDEX IF EXISTS "dm_events_instagramAccountId_commentId_key";
DROP INDEX IF EXISTS "dm_events_userId_createdAt_idx";
ALTER TABLE "dm_events" DROP COLUMN IF EXISTS "instagramAccountId";
ALTER TABLE "dm_events" DROP COLUMN IF EXISTS "commentId";
ALTER TABLE "dm_events" DROP COLUMN IF EXISTS "status";
ALTER TABLE "dm_events" DROP COLUMN IF EXISTS "mediaId";
ALTER TABLE "dm_events" DROP COLUMN IF EXISTS "messageId";
ALTER TABLE "dm_events" DROP COLUMN IF EXISTS "errorSummary";
ALTER TABLE "dm_events" DROP COLUMN IF EXISTS "attemptCount";
ALTER TABLE "dm_events" DROP COLUMN IF EXISTS "lastAttemptAt";
DROP TYPE IF EXISTS "DmEventStatus";
```

Only run rollback if you are sure no private-reply rows exist yet.
