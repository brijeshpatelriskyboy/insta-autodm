-- One-time production apply for dm_events private-reply columns.
-- Intended to be run ONLY via scripts/apply-dm-event-private-reply.cjs
-- after that script confirms COUNT(*) FROM dm_events = 0.
--
-- Differences from prisma/migrations/20260728120000_dm_event_private_reply/migration.sql:
--   - NO DELETE FROM dm_events (caller aborts if the table is non-empty)
--   - Enum create is idempotent (duplicate_object ignored)
--
-- Does not touch any table other than dm_events (plus enum type DmEventStatus).

DO $$ BEGIN
  CREATE TYPE "DmEventStatus" AS ENUM ('sending', 'sent', 'failed');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "dm_events" ADD COLUMN "instagramAccountId" TEXT NOT NULL;
ALTER TABLE "dm_events" ADD COLUMN "commentId" TEXT NOT NULL;
ALTER TABLE "dm_events" ADD COLUMN "status" "DmEventStatus" NOT NULL DEFAULT 'sending';
ALTER TABLE "dm_events" ADD COLUMN "mediaId" TEXT;
ALTER TABLE "dm_events" ADD COLUMN "messageId" TEXT;
ALTER TABLE "dm_events" ADD COLUMN "errorSummary" TEXT;
ALTER TABLE "dm_events" ADD COLUMN "attemptCount" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "dm_events" ADD COLUMN "lastAttemptAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "dm_events_instagramAccountId_commentId_key"
  ON "dm_events"("instagramAccountId", "commentId");

CREATE INDEX "dm_events_userId_createdAt_idx"
  ON "dm_events"("userId", "createdAt");

ALTER TABLE "dm_events"
  ADD CONSTRAINT "dm_events_instagramAccountId_fkey"
  FOREIGN KEY ("instagramAccountId") REFERENCES "instagram_accounts"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
