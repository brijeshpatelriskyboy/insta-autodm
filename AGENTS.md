# AGENTS.md

## Cursor Cloud specific instructions

Insta AutoDM is a two-service app:
- `backend/` — Express 5 + Prisma + PostgreSQL API on port `4000` (`npm run dev`, script `dev` = `tsx watch`).
- `frontend/` — Next.js 15 app on port `3000` (`npm run dev`). The browser talks to the backend through the Next proxy route `frontend/src/app/api/[...path]/route.ts`, so only the frontend needs to be reachable in a browser.

The Windows PowerShell scripts in `scripts/` (portable Node + Postgres) are for the original author's machine only — ignore them on Linux/Cloud.

### Local Postgres (not Docker)
This environment uses a system PostgreSQL 16 (apt-installed), not `docker-compose.yml`. It is not started automatically. Start it each session before running the backend:
```
sudo pg_ctlcluster 16 main start
```
DB `insta_autodm` with role `postgres`/`postgres` already exists in the snapshot. If it is ever missing, recreate it:
```
sudo -u postgres psql -c "ALTER USER postgres PASSWORD 'postgres';"
sudo -u postgres psql -c "CREATE DATABASE insta_autodm;"
```

### Env files (gitignored, kept in the snapshot)
`backend/.env` and `frontend/.env.local` are not committed. If absent, recreate:
- `backend/.env`: `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/insta_autodm?schema=public`, `PORT=4000`, `NODE_ENV=development`, `JWT_SECRET=dev-jwt-secret-change-in-production` (must be 16+ chars or the backend refuses to boot), `CORS_ORIGIN=http://localhost:3000,http://127.0.0.1:3000`, `FRONTEND_URL=http://localhost:3000`, `META_VERIFY_TOKEN=insta-autodm-verify-token`.
- `frontend/.env.local`: `NEXT_PUBLIC_API_URL=http://localhost:4000` and `API_URL=http://localhost:4000`.

### Schema / seed (needs Postgres running)
The update script only installs deps + runs `prisma generate`. Sync the schema and demo data manually when needed (not in the update script — they need a live DB):
```
cd backend
npm run db:push
npm run db:seed
```
Demo login: `demo@instaautodm.com` / `demo1234` (also a one-click "Sign in with demo account" button on `/login`).

### Lint / build
- Backend has no lint script; type-check with `npx tsc --noEmit` in `backend/`.
- `npm run lint` in `frontend/` (`next lint`) is NOT configured — it drops into an interactive ESLint setup prompt and cannot run non-interactively. Type-check with `npx tsc --noEmit` in `frontend/` instead.
- Stripe and Meta OAuth are optional and disabled by default; the app runs fully without those secrets.
