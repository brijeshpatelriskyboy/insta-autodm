# Insta AutoDM — Production Deployment Guide

Deploy the marketing site + app so anyone can sign up, log in, and subscribe via Stripe.

| Component | Platform | URL example |
|-----------|----------|-------------|
| Frontend (Next.js) | **Vercel** | `https://your-app.vercel.app` |
| Backend (Express API) | **Railway** or **Render** | `https://your-api.up.railway.app` |
| Database (PostgreSQL) | Railway / Render / Neon | connection string |
| Payments | **Stripe** (test → live) | Checkout + webhooks |

---

## Prerequisites

- [GitHub](https://github.com) account (repo pushed to GitHub)
- [Vercel](https://vercel.com) account
- [Railway](https://railway.app) or [Render](https://render.com) account
- [Stripe](https://stripe.com) account
- Domain (optional — Vercel gives a free `*.vercel.app` URL)

---

## Part 1 — Push code to GitHub

```bash
cd "insta dm"
git init
git add .
git commit -m "Prepare Insta AutoDM for production deployment"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/insta-autodm.git
git push -u origin main
```

---

## Part 2 — PostgreSQL production database

### Option A: Railway (recommended)

1. Go to [railway.app](https://railway.app) → **New Project** → **Provision PostgreSQL**
2. Open the PostgreSQL service → **Connect** → copy `DATABASE_URL`
3. Keep this tab open — you'll attach it to the API service next

### Option B: Render

1. Use the included `render.yaml` blueprint, or
2. **New** → **PostgreSQL** → copy the **Internal/External Database URL**

### Option C: Neon / Supabase

1. Create a project → copy the PostgreSQL connection string
2. Ensure `?schema=public` is appended if not present

---

## Part 3 — Deploy backend (Railway)

### Step-by-step

1. **New Project** → **Deploy from GitHub repo**
2. Select your `insta-autodm` repository
3. Railway detects the repo — click the new service → **Settings**:
   - **Root Directory:** `backend`
   - **Build Command:** `npm run build`
   - **Start Command:** `npm run start:prod`
4. **Variables** — add from `backend/.env.production.example`:

| Variable | Value |
|----------|-------|
| `NODE_ENV` | `production` |
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` (reference Railway Postgres) |
| `JWT_SECRET` | random 32+ char string |
| `CORS_ORIGIN` | `https://your-app.vercel.app` (set after Vercel deploy) |
| `FRONTEND_URL` | `https://your-app.vercel.app` |
| `STRIPE_SECRET_KEY` | `sk_test_...` (test mode first) |
| `STRIPE_WEBHOOK_SECRET` | `whsec_...` (from Stripe webhook) |
| `STRIPE_PRICE_STARTER` | Stripe Price ID |
| `STRIPE_PRICE_CREATOR` | Stripe Price ID |
| `STRIPE_PRICE_PRO` | Stripe Price ID |

5. **Settings** → **Networking** → **Generate Domain** → copy URL  
   Example: `https://insta-autodm-api-production.up.railway.app`

6. Verify: open `https://YOUR-API-URL/health` → should return `{"status":"ok"}`

### Render alternative

1. **New** → **Blueprint** → connect repo (uses root `render.yaml`), or
2. **New Web Service** → root dir `backend`, build `npm install && npm run build`, start `npm run start:prod`
3. Add the same environment variables as above
4. Link the Render PostgreSQL database

---

## Part 4 — Deploy frontend (Vercel)

1. Go to [vercel.com](https://vercel.com) → **Add New Project** → import GitHub repo
2. **Configure Project:**
   - **Framework Preset:** Next.js
   - **Root Directory:** `frontend` ← important
   - **Build Command:** `npm run build` (default)
3. **Environment Variables:**

| Variable | Value |
|----------|-------|
| `NEXT_PUBLIC_API_URL` | `https://YOUR-API-URL` (Railway/Render backend, no trailing slash) |
| `NEXT_PUBLIC_SITE_URL` | `https://your-app.vercel.app` (or custom domain) |

4. Click **Deploy**
5. Copy your Vercel URL → go back to Railway/Render and update:
   - `CORS_ORIGIN` = your Vercel URL
   - `FRONTEND_URL` = your Vercel URL
6. Redeploy backend after updating CORS

---

## Part 5 — Stripe (test mode first)

### 5.1 Create products & prices

1. [Stripe Dashboard](https://dashboard.stripe.com) → **Products** → **Add product**
2. Create three recurring monthly prices:

| Plan | Price |
|------|-------|
| Starter | $9.90/month |
| Creator | $19/month |
| Pro | $49/month |

3. Copy each **Price ID** (`price_...`) into backend env vars

### 5.2 Webhook endpoint

1. Stripe → **Developers** → **Webhooks** → **Add endpoint**
2. **Endpoint URL:** `https://YOUR-API-URL/api/billing/webhook`
3. **Events to listen for:**
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.paid`
4. Copy **Signing secret** (`whsec_...`) → `STRIPE_WEBHOOK_SECRET` on backend

### 5.3 Test vs live mode

| Mode | Secret key | When to use |
|------|------------|-------------|
| **Test** | `sk_test_...` | Development & staging — use [test cards](https://stripe.com/docs/testing) |
| **Live** | `sk_live_...` | Real payments — switch keys + price IDs + webhook endpoint |

Start with **test mode**. Switch to live only when ready for real customers.

---

## Part 6 — Seed demo user (optional)

After first deploy, seed the demo account once:

```bash
# Locally with production DATABASE_URL (temporarily in backend/.env)
cd backend
npm run db:seed
```

Demo login: `demo@instaautodm.com` / `demo1234`

---

## Part 7 — Production verification checklist

Run through these on your public Vercel URL:

| Test | URL / action | Expected |
|------|----------------|----------|
| Marketing site | `/` | Homepage loads |
| Sign up | `/register` → create account | Redirects to `/onboarding` |
| Login | `/login` | Demo or new account → dashboard |
| Dashboard | `/dashboard` | Loads after auth |
| Instagram waitlist | `/connect-instagram` | Username saved to DB |
| Billing page | `/dashboard/billing` | Plans shown |
| Stripe Checkout | Click **Subscribe** on a plan | Redirects to Stripe |
| Webhook | Complete test payment | Subscription status → active |
| Cancel | **Cancel subscription** on billing page | `cancelAtPeriodEnd: true` |
| API health | `YOUR-API/health` | `{"status":"ok"}` |

---

## Part 8 — Custom domain (optional)

### Vercel (frontend)

1. Vercel → Project → **Domains** → add `instaautodm.com`
2. Update DNS per Vercel instructions
3. Update env vars:
   - Vercel: `NEXT_PUBLIC_SITE_URL=https://instaautodm.com`
   - Backend: `CORS_ORIGIN=https://instaautodm.com` and `FRONTEND_URL=https://instaautodm.com`

### Railway (backend)

1. Railway → Service → **Settings** → **Custom Domain** → `api.instaautodm.com`
2. Update Vercel: `NEXT_PUBLIC_API_URL=https://api.instaautodm.com`
3. Update Stripe webhook URL to new API domain

---

## Environment variable reference

### Backend (Railway / Render)

```env
NODE_ENV=production
DATABASE_URL=postgresql://...
JWT_SECRET=<32+ random chars>
CORS_ORIGIN=https://your-app.vercel.app
FRONTEND_URL=https://your-app.vercel.app
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_STARTER=price_...
STRIPE_PRICE_CREATOR=price_...
STRIPE_PRICE_PRO=price_...
```

### Frontend (Vercel)

```env
NEXT_PUBLIC_API_URL=https://your-api.up.railway.app
NEXT_PUBLIC_SITE_URL=https://your-app.vercel.app
```

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Login "Failed to fetch" | `NEXT_PUBLIC_API_URL` wrong, or backend down, or CORS mismatch |
| CORS error in browser | Set `CORS_ORIGIN` to exact Vercel URL (include `https://`, no trailing slash) |
| Stripe checkout 503 | Add all `STRIPE_*` env vars on backend |
| Webhook not firing | Verify endpoint URL, signing secret, and that events are selected |
| DB connection failed | Check `DATABASE_URL`, ensure DB allows connections from Railway/Render |
| Migrations failed | Check deploy logs — `start:prod` runs `prisma migrate deploy` |
| Blank page on Vercel | Check Vercel build logs; ensure root directory is `frontend` |

---

## Quick deploy summary

```
1. GitHub     → push repo
2. Railway    → Postgres + API (backend/) + env vars + public domain
3. Vercel     → frontend/ + NEXT_PUBLIC_API_URL
4. Railway    → update CORS_ORIGIN + FRONTEND_URL with Vercel URL
5. Stripe     → products, prices, webhook → backend env vars
6. Test       → signup, login, billing on public URL
```

**Your public URL:** `https://your-app.vercel.app` — share this for anyone to use Insta AutoDM.
