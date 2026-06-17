import { prisma } from "./prisma";

const ENSURE_INSTAGRAM_TABLES_SQL = `
CREATE TABLE IF NOT EXISTS "instagram_accounts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "instagramUserId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "accountType" TEXT NOT NULL,
    "profilePictureUrl" TEXT,
    "accessTokenEncrypted" TEXT NOT NULL DEFAULT 'mock_encrypted_token_placeholder',
    "pageId" TEXT,
    "connectionStatus" TEXT NOT NULL DEFAULT 'disconnected',
    "connectedAt" TIMESTAMP(3),
    "lastSyncAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "instagram_accounts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "activity_events" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_events_pkey" PRIMARY KEY ("id")
);
`;

const ENSURE_INSTAGRAM_INDEXES_SQL = `
CREATE UNIQUE INDEX IF NOT EXISTS "instagram_accounts_userId_key" ON "instagram_accounts"("userId");
CREATE UNIQUE INDEX IF NOT EXISTS "instagram_accounts_instagramUserId_key" ON "instagram_accounts"("instagramUserId");
CREATE INDEX IF NOT EXISTS "activity_events_userId_createdAt_idx" ON "activity_events"("userId", "createdAt");
`;

const ENSURE_INSTAGRAM_FKEYS_SQL = `
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'instagram_accounts_userId_fkey') THEN
    ALTER TABLE "instagram_accounts" ADD CONSTRAINT "instagram_accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'activity_events_userId_fkey') THEN
    ALTER TABLE "activity_events" ADD CONSTRAINT "activity_events_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
`;

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

export async function ensureInstagramTables(): Promise<void> {
  try {
    if (await instagramAccountsTableExists()) {
      console.log("[startup][db] instagram_accounts table: present");
      return;
    }

    console.log(
      "[startup][db] instagram_accounts table: MISSING — applying idempotent ensure SQL",
    );

    await prisma.$executeRawUnsafe(ENSURE_INSTAGRAM_TABLES_SQL);
    await prisma.$executeRawUnsafe(ENSURE_INSTAGRAM_INDEXES_SQL);
    await prisma.$executeRawUnsafe(ENSURE_INSTAGRAM_FKEYS_SQL);

    const created = await instagramAccountsTableExists();
    console.log(
      `[startup][db] instagram_accounts table: ${created ? "created" : "still missing after ensure SQL"}`,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[startup][db] ensure instagram tables failed:", message);
  }
}

export async function logInstagramTableStatus(): Promise<void> {
  try {
    const present = await instagramAccountsTableExists();
    console.log(
      `[startup][db] instagram_accounts table: ${present ? "present" : "MISSING — Meta OAuth save will fail"}`,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[startup][db] instagram_accounts table check failed:", message);
  }
}
