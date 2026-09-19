-- Second duplicate guard: one successful/in-flight DM per commenter + post/reel + keyword rule.
-- duplicateTriggerKey is null when the guard is not held. Failed private replies clear it
-- so a genuine retry remains possible. PostgreSQL unique indexes allow multiple NULLs.

ALTER TABLE "dm_events" ADD COLUMN "commenterId" TEXT;
ALTER TABLE "dm_events" ADD COLUMN "duplicateTriggerKey" TEXT;

CREATE UNIQUE INDEX "dm_events_instagramAccountId_duplicateTriggerKey_key"
  ON "dm_events"("instagramAccountId", "duplicateTriggerKey");
