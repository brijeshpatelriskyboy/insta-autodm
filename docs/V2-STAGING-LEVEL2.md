# Comment2DM V2 Staging — Level 2

Meta-free operator / lifecycle / isolation / security E2E on isolated staging.
**Production remains untouched. No real Meta APIs.**

Level 1 (claim hot path + stub) must still pass. Level 2 adds the contracts below.

## Run

Same staging API + V2 Postgres as Level 1. Diagnostic stub routes now require
`STAGING_META_STUB_SECRET` (min 16 chars) via header `X-Comment2DM-Stub-Key`.

```bash
export STAGING_API_URL=https://<staging-railway-host>
export DATABASE_URL=<staging-postgres-url>
export COMMENT2DM_ALLOW_REMOTE_V2_DB=true
export JWT_SECRET=<same-as-staging>
export INSTAGRAM_APP_SECRET=<same-as-staging>
export STAGING_META_STUB_SECRET=<same-as-staging>
cd backend && npm run staging:level2-e2e
```

Do not print the stub secret. Do not point `STAGING_API_URL` / `DATABASE_URL` at production.

## P0 coverage

1. Missing/invalid HMAC → 401; valid HMAC → 200
2. Cross-user campaign GET/PATCH/claims → 404; unauthenticated claims → 401
3. Two users + two IG accounts + same keyword text → isolated code pools
4. One user + two campaigns + two keywords → independent claims/codes
5. DRAFT matching comment → Standard DM fallback, zero campaign claims
6. ARCHIVED matching comment → Standard DM fallback
7. Pause with remaining inventory → paused response; resume → allocation continues
8. ACTIVE allowed message PATCH → next webhook uses updated copy
9. ACTIVE forbidden PATCH (`maxClaims`, `dmTemplate`, `name`) → 400
10. DRAFT `maxClaims` 50→3→10 → `codeCount === maxClaims` → activate → allocate
11. Second ACTIVE campaign on the same keyword rule → 409
12. Failed delivery then **new** comment from the same commenter → already-claimed / same code; no second allocation; failed code stays `RESERVED`
13. Product APIs never expose unused codes; claims remain authenticated
14. Invariants: `claimedCount ==` claim rows; code count `== maxClaims`; no duplicate allocation; failed/exhausted never `AVAILABLE`; `claimedCount <= maxClaims`

## Stub security

`/api/staging/meta-stub/*` mounts only when the existing three stub flags are valid
and no production identifiers are present. Requests additionally require
`STAGING_META_STUB_SECRET`. Missing config → 503. Wrong/missing key → 401.
Production still never mounts these routes.

## Constraints

- Single backend instance (stub captures are in-memory)
- No schema migration
- No Railway / Vercel / Meta / production env changes from this harness
