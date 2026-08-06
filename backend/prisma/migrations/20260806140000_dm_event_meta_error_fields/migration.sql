-- Persist Meta Graph error details on failed private-reply attempts.
ALTER TABLE "dm_events" ADD COLUMN "metaErrorCode" INTEGER;
ALTER TABLE "dm_events" ADD COLUMN "metaErrorMessage" TEXT;
