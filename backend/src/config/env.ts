import { z } from "zod";
import dotenv from "dotenv";

dotenv.config();

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  PORT: z.coerce.number().default(4000),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  JWT_SECRET: z.string().min(16),
  CORS_ORIGIN: z.string().default("http://localhost:3000"),
  FRONTEND_URL: z.string().default("http://localhost:3000"),
  /** Resend API key — never log. Optional until transactional email is configured. */
  RESEND_API_KEY: z.string().optional(),
  /** Verified From address, e.g. Comment2DM <noreply@example.com> */
  EMAIL_FROM: z.string().optional(),
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  STRIPE_PRICE_STARTER: z.string().optional(),
  STRIPE_PRICE_CREATOR: z.string().optional(),
  STRIPE_PRICE_PRO: z.string().optional(),
  /** Instagram App ID (Business Login for Instagram) — required for OAuth. */
  INSTAGRAM_APP_ID: z.string().optional(),
  /** Instagram App Secret (server only) — required for OAuth. Never fall back to META_APP_SECRET. */
  INSTAGRAM_APP_SECRET: z.string().optional(),
  /** Legacy Meta App ID — ignored for Instagram Business Login OAuth. */
  META_APP_ID: z.string().optional(),
  /** Legacy Meta App Secret — ignored for Instagram Business Login OAuth. */
  META_APP_SECRET: z.string().optional(),
  META_REDIRECT_URI: z.string().optional(),
  META_VERIFY_TOKEN: z.string().optional(),
  META_OAUTH_ENABLED: z.string().optional(),
});

const parsed = envSchema.parse(process.env);

/**
 * Instagram OAuth credentials must come from INSTAGRAM_APP_* only.
 * Do not merge META_APP_ID / META_APP_SECRET into Instagram credentials —
 * those can belong to a different Meta app and break token exchange.
 */
export const env = {
  ...parsed,
  INSTAGRAM_APP_ID: parsed.INSTAGRAM_APP_ID?.trim() || undefined,
  INSTAGRAM_APP_SECRET: parsed.INSTAGRAM_APP_SECRET?.trim() || undefined,
  RESEND_API_KEY: parsed.RESEND_API_KEY?.trim() || undefined,
  EMAIL_FROM: parsed.EMAIL_FROM?.trim() || undefined,
};

export function isMetaOAuthEnabled(): boolean {
  return env.META_OAUTH_ENABLED === "true";
}

export function isStripeConfigured(): boolean {
  return Boolean(
    env.STRIPE_SECRET_KEY &&
      env.STRIPE_PRICE_STARTER &&
      env.STRIPE_PRICE_CREATOR &&
      env.STRIPE_PRICE_PRO,
  );
}
