ALTER TABLE "users"
  ADD COLUMN "authProvider" TEXT NOT NULL DEFAULT 'password',
  ADD COLUMN "profileCompletedAt" TIMESTAMP(3);

UPDATE "users" SET "profileCompletedAt" = "createdAt" WHERE "profileCompletedAt" IS NULL;

ALTER TABLE "keyword_rules"
  ADD COLUMN "publicReplyEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "publicReplyMessage" TEXT;

ALTER TABLE "dm_events"
  ADD COLUMN "publicReplyStatus" TEXT,
  ADD COLUMN "publicReplyId" TEXT,
  ADD COLUMN "publicReplyError" TEXT,
  ADD COLUMN "publicReplyAttemptedAt" TIMESTAMP(3);
