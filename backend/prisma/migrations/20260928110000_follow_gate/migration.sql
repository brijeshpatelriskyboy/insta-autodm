ALTER TABLE "keyword_rules" ADD COLUMN "requireFollow" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "dm_events" ADD COLUMN "followGateStatus" TEXT,
 ADD COLUMN "followGateRecipientId" TEXT,
 ADD COLUMN "followGateLastInteractionAt" TIMESTAMP(3),
 ADD COLUMN "followGateCheckedAt" TIMESTAMP(3),
 ADD COLUMN "followGateMessageId" TEXT;
