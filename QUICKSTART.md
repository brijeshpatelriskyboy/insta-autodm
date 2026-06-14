# Insta AutoDM — Quick Start (Windows)

**Project location:** `C:\Users\brije\Desktop\insta dm`

## First time only

```powershell
powershell -ExecutionPolicy Bypass -File ".\scripts\setup-local.ps1"
```

This installs portable Node + PostgreSQL, runs migrations, and seeds the demo user.

## Start the app

```powershell
powershell -ExecutionPolicy Bypass -File ".\scripts\dev.ps1"
```

Opens PostgreSQL, backend, and frontend in separate windows.

| Service  | URL |
|----------|-----|
| App      | http://localhost:3000 |
| Login    | http://localhost:3000/login |
| Backend  | http://localhost:4000 |

## Demo login

- Email: `demo@instaautodm.com`
- Password: `demo1234`
- Or click **Sign in with demo account** on the login page

## If login page is blank, slow, or shows 500

```powershell
powershell -ExecutionPolicy Bypass -File ".\scripts\restart-frontend.ps1"
```

Then refresh http://localhost:3000/login

## If backend login fails

1. Ensure PostgreSQL is running: `.\scripts\start-postgres.ps1`
2. Restart backend in `backend\` with `npm run dev`

## Portable tools (no admin required)

- Node: `%LOCALAPPDATA%\node-portable\node-v22.16.0-win-x64`
- PostgreSQL: `%LOCALAPPDATA%\insta-autodm\postgres`
- Database: `insta_autodm` on `localhost:5432`
