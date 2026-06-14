# Insta AutoDM

A SaaS MVP that automatically sends Instagram DMs when someone comments a specific keyword on a creator's post or reel.

> **Windows quick start:** See [QUICKSTART.md](./QUICKSTART.md) — run `scripts\dev.ps1` to start, `scripts\restart-frontend.ps1` if login breaks.

> **Production deploy:** See [DEPLOYMENT.md](./DEPLOYMENT.md) — Vercel (frontend) + Railway/Render (backend) + PostgreSQL + Stripe.

## Tech Stack

| Layer      | Technology                          |
|------------|-------------------------------------|
| Frontend   | Next.js 15, TypeScript, Tailwind CSS |
| Backend    | Node.js, Express 5, TypeScript      |
| Database   | PostgreSQL                          |
| ORM        | Prisma                              |
| DevOps     | Docker Compose                      |

**Deployment targets:** Vercel (frontend) · Railway (backend + database)

---

## Project Structure

```
insta-autodm/
├── docker-compose.yml      # Local dev: db + backend + frontend
├── .env.example            # Environment variable template
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma   # Database models
│   │   └── seed.ts         # Demo data
│   └── src/
│       ├── config/         # Environment validation
│       ├── controllers/    # HTTP request handlers
│       ├── middleware/     # Auth, error handling
│       ├── routes/         # API route definitions
│       ├── services/       # Business logic
│       └── lib/            # Prisma client
└── frontend/
    └── src/
        ├── app/            # Next.js App Router pages
        ├── components/     # UI components
        └── lib/            # API client, auth helpers
```

---

## Prerequisites

- [Node.js](https://nodejs.org/) 20+
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (recommended)
- Or a local PostgreSQL 16 instance

---

## Quick Start (Docker)

### 1. Clone and configure

```bash
cd "insta dm"
cp .env.example .env
```

### 2. Start all services

```bash
docker compose up --build
```

| Service  | URL                        |
|----------|----------------------------|
| Frontend | http://localhost:3000      |
| Backend  | http://localhost:4000      |
| Database | localhost:5432             |

The backend runs `prisma db push` on startup to sync the schema.

### 3. Seed demo data (optional)

In a separate terminal:

```bash
cd backend
npm install
npm run db:seed
```

**Demo credentials:**
- Email: `demo@instaautodm.com`
- Password: `demo1234`

---

## Local Development (without Docker)

### 1. Start PostgreSQL

Use Docker for just the database:

```bash
docker compose up db -d
```

Or point `DATABASE_URL` in `.env` to your own PostgreSQL instance.

### 2. Backend

```bash
cd backend
cp ../.env.example .env   # or copy .env to backend/
npm install
npm run db:generate
npm run db:push
npm run db:seed           # optional
npm run dev
```

API runs at **http://localhost:4000**

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

App runs at **http://localhost:3000**

---

## API Endpoints

### Auth (placeholder — Meta OAuth coming later)

| Method | Endpoint            | Description        |
|--------|---------------------|--------------------|
| POST   | `/api/auth/register`| Create account     |
| POST   | `/api/auth/login`   | Login              |
| GET    | `/api/auth/me`      | Current user (JWT) |

### Keyword Rules (authenticated)

| Method | Endpoint                  | Description   |
|--------|---------------------------|---------------|
| GET    | `/api/keyword-rules`      | List all      |
| GET    | `/api/keyword-rules/:id`  | Get one       |
| POST   | `/api/keyword-rules`      | Create        |
| PUT    | `/api/keyword-rules/:id`  | Update        |
| DELETE | `/api/keyword-rules/:id`  | Delete        |

### Analytics (authenticated)

| Method | Endpoint                  | Description              |
|--------|---------------------------|--------------------------|
| GET    | `/api/analytics/summary`  | Rules, DM events, leads  |

### Webhooks (Meta placeholder)

| Method | Endpoint                    | Description                    |
|--------|-----------------------------|--------------------------------|
| GET    | `/api/webhooks/instagram`   | Meta webhook verification      |
| POST   | `/api/webhooks/instagram`   | Receive Instagram events       |

### Health

| Method | Endpoint  | Description |
|--------|-----------|-------------|
| GET    | `/health` | Health check |

---

## Environment Variables

| Variable              | Description                          | Example                              |
|-----------------------|--------------------------------------|--------------------------------------|
| `DATABASE_URL`        | PostgreSQL connection string         | `postgresql://postgres:postgres@...` |
| `PORT`                | Backend port                         | `4000`                               |
| `JWT_SECRET`          | JWT signing secret (16+ chars)       | `your-secret-key`                    |
| `CORS_ORIGIN`         | Allowed frontend origin              | `http://localhost:3000`              |
| `NEXT_PUBLIC_API_URL` | Backend URL for frontend             | `http://localhost:4000`              |
| `META_VERIFY_TOKEN`   | Meta webhook verify token (optional) | `insta-autodm-verify-token`          |

---

## Deployment Notes

### Vercel (Frontend)

1. Import the `frontend/` directory as a Next.js project.
2. Set `NEXT_PUBLIC_API_URL` to your Railway backend URL.
3. Deploy.

### Railway (Backend + Database)

1. Create a PostgreSQL service on Railway.
2. Deploy `backend/` as a Node.js service.
3. Set environment variables: `DATABASE_URL`, `JWT_SECRET`, `CORS_ORIGIN` (your Vercel URL).
4. Run `npx prisma db push` or `prisma migrate deploy` on first deploy.

---

## MVP Features

- [x] Email/password auth (placeholder for Meta OAuth)
- [x] Dashboard after login
- [x] Keyword rule CRUD (keyword, DM message, active/inactive)
- [x] PostgreSQL storage via Prisma
- [x] Keyword rules table UI
- [x] Analytics page (rules count live; DM events & leads are placeholders)
- [x] REST API for keyword CRUD
- [x] Meta Instagram webhook placeholder endpoint

---

## Next Phase (not yet implemented)

- Meta OAuth / Instagram Business account connection
- Real webhook processing (comment → keyword match → send DM)
- DM event logging and lead capture
- Production auth hardening (refresh tokens, rate limiting)
