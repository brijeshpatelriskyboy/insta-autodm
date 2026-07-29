/**
 * One-time production schema apply for dm_events private-reply columns.
 *
 * Safety:
 *  - Uses DATABASE_URL via Prisma
 *  - Aborts unless COUNT(*) FROM dm_events = 0
 *  - Does not DELETE any rows/tables
 *  - Applies DDL in a single transaction (rolls back on failure)
 *  - No-ops if the unique index already exists (already applied)
 *
 * Usage (Railway — root directory is backend):
 *   npm run db:apply-dm-event-private-reply
 *
 * See scripts/APPLY_DM_EVENT_PRIVATE_REPLY.md
 */

const fs = require("fs");
const path = require("path");
const { PrismaClient } = require("@prisma/client");

const UNIQUE_INDEX = "dm_events_instagramAccountId_commentId_key";
const SQL_FILE = path.join(__dirname, "sql", "apply-dm-event-private-reply.sql");

function splitSqlStatements(sql) {
  // Strip line comments, then split on semicolons outside DO $$ ... $$ blocks.
  const withoutLineComments = sql
    .split("\n")
    .map((line) => {
      const trimmed = line.trim();
      if (trimmed.startsWith("--")) return "";
      return line;
    })
    .join("\n");

  const statements = [];
  let current = "";
  let inDollar = false;

  for (let i = 0; i < withoutLineComments.length; i += 1) {
    const ch = withoutLineComments[i];
    const next = withoutLineComments[i + 1];

    if (!inDollar && ch === "$" && next === "$") {
      inDollar = true;
      current += "$$";
      i += 1;
      continue;
    }

    if (inDollar && ch === "$" && next === "$") {
      inDollar = false;
      current += "$$";
      i += 1;
      continue;
    }

    if (ch === ";" && !inDollar) {
      const stmt = current.trim();
      if (stmt) statements.push(stmt);
      current = "";
      continue;
    }

    current += ch;
  }

  const tail = current.trim();
  if (tail) statements.push(tail);
  return statements;
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("[apply-dm-event] DATABASE_URL is not set. Aborting.");
    process.exit(1);
  }

  if (!fs.existsSync(SQL_FILE)) {
    console.error(`[apply-dm-event] SQL file missing: ${SQL_FILE}`);
    process.exit(1);
  }

  const prisma = new PrismaClient();

  try {
    console.log("[apply-dm-event] Connected. Checking dm_events row count...");

    const countRows = await prisma.$queryRaw`
      SELECT COUNT(*)::bigint AS count FROM "dm_events"
    `;
    const count = Number(countRows[0]?.count ?? 0);
    console.log(`[apply-dm-event] dm_events count = ${count}`);

    if (count !== 0) {
      console.error(
        "[apply-dm-event] ABORT: dm_events is not empty. Refusing to alter required columns/unique index.",
      );
      console.error(
        "[apply-dm-event] Inspect rows, then re-run only after the table is confirmed empty (or use a different backfill plan).",
      );
      process.exit(1);
    }

    const indexRows = await prisma.$queryRaw`
      SELECT 1 AS present
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND indexname = ${UNIQUE_INDEX}
      LIMIT 1
    `;

    if (indexRows.length > 0) {
      console.log(
        `[apply-dm-event] Unique index ${UNIQUE_INDEX} already exists. Treating as already applied — no changes.`,
      );
      process.exit(0);
    }

    const accounts = await prisma.$queryRaw`
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'instagram_accounts'
      ) AS exists
    `;
    if (!accounts[0]?.exists) {
      console.error(
        "[apply-dm-event] ABORT: instagram_accounts table is missing (FK target). Fix that first.",
      );
      process.exit(1);
    }

    const sql = fs.readFileSync(SQL_FILE, "utf8");
    const statements = splitSqlStatements(sql);
    if (statements.length === 0) {
      console.error("[apply-dm-event] ABORT: no SQL statements found.");
      process.exit(1);
    }

    console.log(
      `[apply-dm-event] Applying ${statements.length} statements in one transaction (no DELETE)...`,
    );

    await prisma.$transaction(async (tx) => {
      for (const statement of statements) {
        await tx.$executeRawUnsafe(statement);
      }
    });

    console.log("[apply-dm-event] SUCCESS: dm_events private-reply schema applied.");
    console.log(
      "[apply-dm-event] Next: redeploy / restart so `npx prisma db push && node dist/index.js` sees a matching schema.",
    );
  } catch (error) {
    console.error("[apply-dm-event] FAILED — transaction rolled back.");
    console.error(
      "[apply-dm-event]",
      error instanceof Error ? error.message : String(error),
    );
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
