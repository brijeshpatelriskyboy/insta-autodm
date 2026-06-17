import { prisma } from "./prisma";

export async function logInstagramTableStatus(): Promise<void> {
  try {
    const rows = await prisma.$queryRaw<{ exists: boolean }[]>`
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'instagram_accounts'
      ) AS exists
    `;
    const present = Boolean(rows[0]?.exists);
    console.log(
      `[startup][db] instagram_accounts table: ${present ? "present" : "MISSING — Meta OAuth save will fail until migrations run"}`,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[startup][db] instagram_accounts table check failed:", message);
  }
}
