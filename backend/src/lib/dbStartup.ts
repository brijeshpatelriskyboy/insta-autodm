import { prisma } from "./prisma";

async function instagramAccountsTableExists(): Promise<boolean> {
  const rows = await prisma.$queryRaw<{ exists: boolean }[]>`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = 'instagram_accounts'
    ) AS exists
  `;
  return Boolean(rows[0]?.exists);
}

async function activityEventsTableExists(): Promise<boolean> {
  const rows = await prisma.$queryRaw<{ exists: boolean }[]>`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = 'activity_events'
    ) AS exists
  `;
  return Boolean(rows[0]?.exists);
}

async function planUsageTableExists(): Promise<boolean> {
  const rows = await prisma.$queryRaw<{ exists: boolean }[]>`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = 'plan_usage'
    ) AS exists
  `;
  return Boolean(rows[0]?.exists);
}

/**
 * Production safety net for environments whose migration history says the
 * plan-usage migration ran even though the physical table is missing.
 * Both statements are idempotent, so normal environments are left unchanged.
 */
export async function ensurePlanUsageTable(): Promise<void> {
  if (await planUsageTableExists()) {
    console.log("[startup][db] plan_usage table: present");
    return;
  }

  console.warn("[startup][db] plan_usage table: MISSING — creating repair table");

  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS "plan_usage" (
      "id" TEXT NOT NULL,
      "userId" TEXT NOT NULL,
      "monthKey" TEXT NOT NULL,
      "dmCount" INTEGER NOT NULL DEFAULT 0,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL,
      CONSTRAINT "plan_usage_pkey" PRIMARY KEY ("id")
    )
  `;

  await prisma.$executeRaw`
    CREATE UNIQUE INDEX IF NOT EXISTS "plan_usage_userId_monthKey_key"
    ON "plan_usage"("userId", "monthKey")
  `;

  console.log("[startup][db] plan_usage repair table created");
}

export async function logInstagramTableStatus(): Promise<void> {
  try {
    const instagramAccounts = await instagramAccountsTableExists();
    const activityEvents = await activityEventsTableExists();
    const planUsage = await planUsageTableExists();
    console.log(
      `[startup][db] instagram_accounts table: ${instagramAccounts ? "present" : "MISSING"}`,
    );
    console.log(
      `[startup][db] activity_events table: ${activityEvents ? "present" : "MISSING"}`,
    );
    console.log(`[startup][db] plan_usage table: ${planUsage ? "present" : "MISSING"}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[startup][db] table status check failed:", message);
  }
}
