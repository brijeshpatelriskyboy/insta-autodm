-- Repair environments where the original plan usage migration was recorded
-- but the underlying table was not created (or was removed later).
CREATE TABLE IF NOT EXISTS "plan_usage" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "monthKey" TEXT NOT NULL,
    "dmCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "plan_usage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "plan_usage_userId_monthKey_key"
ON "plan_usage"("userId", "monthKey");

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'plan_usage_userId_fkey'
          AND conrelid = 'plan_usage'::regclass
    ) THEN
        ALTER TABLE "plan_usage"
        ADD CONSTRAINT "plan_usage_userId_fkey"
        FOREIGN KEY ("userId") REFERENCES "users"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
