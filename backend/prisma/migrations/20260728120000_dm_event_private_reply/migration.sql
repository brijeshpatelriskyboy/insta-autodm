-- Private-reply automation: extend dm_events for account-aware duplicate guard + retry.
-- Existing dm_events rows (legacy analytics stubs without comment ids) are removed;
-- the webhook pipeline never wrote commentId-backed rows before this migration.

CREATE TYPE "DmEventStatus" AS ENUM ('sending', 'sent', 'failed');

DELETE FROM "dm_events";

ALTER TABLE "dm_events" ADD COLUMN "instagramAccountId" TEXT NOT NULL;
ALTER TABLE "dm_events" ADD COLUMN "commentId" TEXT NOT NULL;
ALTER TABLE "dm_events" ADD COLUMN "status" "DmEventStatus" NOT NULL DEFAULT 'sending';
ALTER TABLE "dm_events" ADD COLUMN "mediaId" TEXT;
ALTER TABLE "dm_events" ADD COLUMN "messageId" TEXT;
ALTER TABLE "dm_events" ADD COLUMN "errorSummary" TEXT;
ALTER TABLE "dm_events" ADD COLUMN "attemptCount" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "dm_events" ADD COLUMN "lastAttemptAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "dm_events_instagramAccountId_commentId_key" ON "dm_events"("instagramAccountId", "commentId");
CREATE INDEX "dm_events_userId_createdAt_idx" ON "dm_events"("userId", "createdAt");

ALTER TABLE "dm_events" ADD CONSTRAINT "dm_events_instagramAccountId_fkey" FOREIGN KEY ("instagramAccountId") REFERENCES "instagram_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
