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

export async function logInstagramTableStatus(): Promise<void> {
  try {
    const instagramAccounts = await instagramAccountsTableExists();
    const activityEvents = await activityEventsTableExists();
    console.log(
      `[startup][db] instagram_accounts table: ${instagramAccounts ? "present" : "MISSING"}`,
    );
    console.log(
      `[startup][db] activity_events table: ${activityEvents ? "present" : "MISSING"}`,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[startup][db] table status check failed:", message);
  }
}
