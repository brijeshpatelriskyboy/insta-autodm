#!/usr/bin/env node
/**
 * Idempotent one-shot applicator for migration:
 *   prisma/migrations/20260728120000_dm_event_private_reply
 *
 * Applies the DmEvent private-reply schema (enum, columns, unique guard, FK)
 * against DATABASE_URL without requiring a full `prisma migrate deploy` run.
 *
 * Usage (from backend/):
 *   node scripts/apply-dm-event-private-reply.cjs
 *   npm run db:apply-dm-event-private-reply
 *
 * Safe to re-run. Does not print secrets.
 */

"use strict";

const path = require("path");
const { execFileSync } = require("child_process");

// Load backend/.env when present (local). Railway injects env directly.
try {
  require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
} catch {
  // dotenv optional at runtime if already loaded by host
}

const { PrismaClient } = require("@prisma/client");

const MIGRATION_NAME = "20260728120000_dm_event_private_reply";

async function columnExists(prisma, tableName, columnName) {
  const rows = await prisma.$queryRaw`
    SELECT 1 AS ok
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = ${tableName}
      AND column_name = ${columnName}
    LIMIT 1
  `;
  return rows.length > 0;
}

async function typeExists(prisma, typeName) {
  const rows = await prisma.$queryRaw`
    SELECT 1 AS ok
    FROM pg_type
    WHERE typname = ${typeName}
    LIMIT 1
  `;
  return rows.length > 0;
}

async function constraintExists(prisma, constraintName) {
  const rows = await prisma.$queryRaw`
    SELECT 1 AS ok
    FROM pg_constraint
    WHERE conname = ${constraintName}
    LIMIT 1
  `;
  return rows.length > 0;
}

async function indexExists(prisma, indexName) {
  const rows = await prisma.$queryRaw`
    SELECT 1 AS ok
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = ${indexName}
    LIMIT 1
  `;
  return rows.length > 0;
}

async function migrationRecorded(prisma) {
  try {
    const rows = await prisma.$queryRaw`
      SELECT 1 AS ok
      FROM "_prisma_migrations"
      WHERE migration_name = ${MIGRATION_NAME}
      LIMIT 1
    `;
    return rows.length > 0;
  } catch {
    return false;
  }
}

function markMigrationApplied() {
  try {
    execFileSync(
      process.execPath,
      [
        require.resolve("prisma/build/index.js"),
        "migrate",
        "resolve",
        "--applied",
        MIGRATION_NAME,
      ],
      {
        cwd: path.join(__dirname, ".."),
        env: process.env,
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    console.log(`[apply-dm-event] marked migration applied: ${MIGRATION_NAME}`);
  } catch (error) {
    const stderr = error && error.stderr ? String(error.stderr) : "";
    const message = error instanceof Error ? error.message : String(error);
    console.warn("[apply-dm-event] could not mark prisma migration resolved:", message);
    if (stderr) {
      console.warn(stderr.trim());
    }
  }
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("[apply-dm-event] DATABASE_URL is required");
    process.exit(1);
  }

  const prisma = new PrismaClient();

  try {
    console.log("[apply-dm-event] starting idempotent schema apply");

    const already = await columnExists(prisma, "dm_events", "commentId");
    if (already) {
      console.log("[apply-dm-event] dm_events.commentId already present — schema looks applied");
      if (!(await migrationRecorded(prisma))) {
        markMigrationApplied();
      } else {
        console.log(`[apply-dm-event] _prisma_migrations already contains ${MIGRATION_NAME}`);
      }
      return;
    }

    if (!(await typeExists(prisma, "DmEventStatus"))) {
      await prisma.$executeRawUnsafe(
        `CREATE TYPE "DmEventStatus" AS ENUM ('sending', 'sent', 'failed')`,
      );
      console.log("[apply-dm-event] created enum DmEventStatus");
    } else {
      console.log("[apply-dm-event] enum DmEventStatus already exists");
    }

    // Legacy analytics stub rows have no commentId; clear before NOT NULL columns.
    const deleted = await prisma.$executeRawUnsafe(`DELETE FROM "dm_events"`);
    console.log(`[apply-dm-event] cleared legacy dm_events rows (count response: ${deleted})`);

    const alterStatements = [
      [`instagramAccountId`, `ALTER TABLE "dm_events" ADD COLUMN "instagramAccountId" TEXT`],
      [`commentId`, `ALTER TABLE "dm_events" ADD COLUMN "commentId" TEXT`],
      [
        `status`,
        `ALTER TABLE "dm_events" ADD COLUMN "status" "DmEventStatus" NOT NULL DEFAULT 'sending'`,
      ],
      [`mediaId`, `ALTER TABLE "dm_events" ADD COLUMN "mediaId" TEXT`],
      [`messageId`, `ALTER TABLE "dm_events" ADD COLUMN "messageId" TEXT`],
      [`errorSummary`, `ALTER TABLE "dm_events" ADD COLUMN "errorSummary" TEXT`],
      [
        `attemptCount`,
        `ALTER TABLE "dm_events" ADD COLUMN "attemptCount" INTEGER NOT NULL DEFAULT 1`,
      ],
      [`lastAttemptAt`, `ALTER TABLE "dm_events" ADD COLUMN "lastAttemptAt" TIMESTAMP(3)`],
    ];

    for (const [column, sql] of alterStatements) {
      if (!(await columnExists(prisma, "dm_events", column))) {
        await prisma.$executeRawUnsafe(sql);
        console.log(`[apply-dm-event] added column ${column}`);
      }
    }

    // Enforce NOT NULL on required new columns (table is empty after DELETE).
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "dm_events" ALTER COLUMN "instagramAccountId" SET NOT NULL`,
    );
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "dm_events" ALTER COLUMN "commentId" SET NOT NULL`,
    );

    if (!(await indexExists(prisma, "dm_events_instagramAccountId_commentId_key"))) {
      await prisma.$executeRawUnsafe(
        `CREATE UNIQUE INDEX "dm_events_instagramAccountId_commentId_key" ON "dm_events"("instagramAccountId", "commentId")`,
      );
      console.log("[apply-dm-event] created unique index (instagramAccountId, commentId)");
    }

    if (!(await indexExists(prisma, "dm_events_userId_createdAt_idx"))) {
      await prisma.$executeRawUnsafe(
        `CREATE INDEX "dm_events_userId_createdAt_idx" ON "dm_events"("userId", "createdAt")`,
      );
      console.log("[apply-dm-event] created index (userId, createdAt)");
    }

    if (!(await constraintExists(prisma, "dm_events_instagramAccountId_fkey"))) {
      await prisma.$executeRawUnsafe(`
        ALTER TABLE "dm_events"
        ADD CONSTRAINT "dm_events_instagramAccountId_fkey"
        FOREIGN KEY ("instagramAccountId") REFERENCES "instagram_accounts"("id")
        ON DELETE CASCADE ON UPDATE CASCADE
      `);
      console.log("[apply-dm-event] added FK dm_events_instagramAccountId_fkey");
    }

    markMigrationApplied();
    console.log("[apply-dm-event] done");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error("[apply-dm-event] failed:", message);
  process.exit(1);
});
