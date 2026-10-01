-- Multi-account Instagram support and annual billing interval
DROP INDEX IF EXISTS "instagram_accounts_userId_key";
CREATE INDEX IF NOT EXISTS "instagram_accounts_userId_idx" ON "instagram_accounts"("userId");

ALTER TABLE "subscriptions"
ADD COLUMN IF NOT EXISTS "billingInterval" TEXT NOT NULL DEFAULT 'monthly';
