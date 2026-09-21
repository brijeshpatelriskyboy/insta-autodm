CREATE TABLE "plan_usage" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "monthKey" TEXT NOT NULL,
    "dmCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "plan_usage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "plan_usage_userId_monthKey_key" ON "plan_usage"("userId", "monthKey");

ALTER TABLE "plan_usage" ADD CONSTRAINT "plan_usage_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
