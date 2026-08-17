# Comment2DM transactional email

Password-reset mail is sent through a small provider abstraction so auth is not coupled to Resend. The same `EmailProvider.send(message)` path can later carry support/contact mail and security notifications without rewriting the provider layer. The contact form is **not** implemented yet.

## Provider architecture

- `EmailProvider` — `send({ kind, to, subject, html, text, replyTo? })`
- `kind` values: `password_reset` | `support_contact` | `security_notification`
- **Resend** (`ResendEmailProvider`) — production/staging when configured
- **Memory** — Vitest only; inspect `.sent` without calling Resend
- **Disabled** — used when delivery config is missing; `send` throws a generic `EmailDeliveryError`

Auth never logs the reset token, the reset URL, or `RESEND_API_KEY`.

## Password-reset flow

1. `POST /api/auth/forgot-password` always returns the same generic message.
2. Unknown email: no token, no email.
3. Known email: issue a hashed, 45-minute, single-use token (existing mechanism).
4. Build `${FRONTEND_URL}/reset-password?token=<token>` from operator-configured `FRONTEND_URL` only (fixed path; no `next`/`redirect` query).
5. Send HTML + text mail via the email service.
6. HTTP body never includes the token or reset URL.

## Failure behavior

Security over convenience: **if delivery is skipped or Resend fails, the newly issued token is invalidated** (`usedAt` set). Unused valid reset tokens are not left sitting in the database.

The HTTP response stays generic either way. Provider HTTP bodies are not returned to the client and are not logged (they can echo HTML/URLs).

If Resend reports success to us but the message never arrives, the user can request a new reset. If we time out after Resend actually sent, the link in that mail may already be invalid — that is accepted.

Production/`NODE_ENV=production` (including staging) **fails safely** when config is missing: no crash of the API, no email, token invalidated, generic HTTP response, operational log only.

Localhost `FRONTEND_URL` is rejected for delivery when `NODE_ENV=production`.

## Required env (set after merge — do not put real secrets in git)

| Name | Purpose |
|------|---------|
| `RESEND_API_KEY` | Resend API key |
| `EMAIL_FROM` | Verified From, e.g. `Comment2DM <noreply@your-domain.com>` |
| `FRONTEND_URL` | Public site origin used in the reset link (no trailing slash) |

Sending domain must be **verified in Resend** (SPF/DKIM, and DMARC as required by Resend) before public launch. Until then, Resend will reject From addresses on unverified domains.

`createResetTokenForTests` remains test/development only and is not an HTTP field.

## Staging vs production

Configure the three variables on isolated staging first, confirm a real inbox receive, then configure production. Do not reuse production Resend keys on staging if you can avoid it.
