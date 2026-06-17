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
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  STRIPE_PRICE_STARTER: z.string().optional(),
  STRIPE_PRICE_CREATOR: z.string().optional(),
  STRIPE_PRICE_PRO: z.string().optional(),
  META_APP_ID: z.string().optional(),
  META_APP_SECRET: z.string().optional(),
  META_REDIRECT_URI: z.string().optional(),
  META_VERIFY_TOKEN: z.string().optional(),
  META_OAUTH_ENABLED: z.string().optional(),
});

export const env = envSchema.parse(process.env);

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
