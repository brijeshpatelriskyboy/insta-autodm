-- Track per-account Instagram webhook subscription via Graph subscribed_apps.
ALTER TABLE "instagram_accounts" ADD COLUMN "webhookSubscribedAt" TIMESTAMP(3);
ALTER TABLE "instagram_accounts" ADD COLUMN "webhookSubscribedFields" TEXT;
