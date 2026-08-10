# Comment2DM V2 Staging — Level 1

Isolated staging for Smart Campaigns. **Production remains untouched.**

## Resources (create once)

| Resource | Name | Notes |
|---|---|---|
| Railway project/service | `comment2dm-v2-staging` | Watches `v2-smart-campaigns` (or harness PR branch until merge), root `backend` |
| Postgres | name must include `v2` + `staging` | e.g. `comment2dm_v2_staging` |
| Vercel project | `comment2dm-v2-staging` | Root `frontend`, API → staging Railway only |

## Backend start (staging only)

```bash
npm run start:staging
# → node scripts/with-v2-db-safety.cjs migrate deploy && node dist/index.js
```

Never use `start:prod` / `prisma db push --accept-data-loss` on staging.

## Meta Level 1

- Do not change production Meta app or webhook URL.
- Enable staging stub (`META_PRIVATE_REPLY_STUB` + `COMMENT2DM_DEPLOYMENT_ENV=staging` + `COMMENT2DM_ALLOW_META_STUB`).
- Use signed webhook fixtures; stub private-reply only.

## Level 1 E2E

```bash
export STAGING_API_URL=https://<staging-railway-host>
export DATABASE_URL=<staging-postgres-url>
export COMMENT2DM_ALLOW_REMOTE_V2_DB=true
export JWT_SECRET=<same-as-staging>
export INSTAGRAM_APP_SECRET=<same-as-staging>
cd backend && npm run staging:level1-e2e
```

## V1 safety

- Do not deploy/merge to `main`
- Do not change production Railway / Vercel / Postgres / Meta
- Production `SMART_CAMPAIGNS_ENABLED` remains false/unset
