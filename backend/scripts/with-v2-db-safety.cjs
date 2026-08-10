#!/usr/bin/env node
/**
 * Runs a Prisma CLI command only after V2 DB safety checks pass.
 *
 * Usage (from backend/):
 *   node scripts/with-v2-db-safety.cjs migrate deploy
 *   node scripts/with-v2-db-safety.cjs db seed
 *
 * Remote V2 staging is allowed only when:
 *   COMMENT2DM_ALLOW_REMOTE_V2_DB=true
 *   database name includes both "v2" and "staging"
 *   hostname/database do not contain known production identifiers
 */
"use strict";

const path = require("path");
const { spawnSync } = require("child_process");

// Load optional local env files without overriding an already-set DATABASE_URL.
try {
  require("dotenv").config({ path: path.join(__dirname, "..", ".env.v2") });
  require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
} catch {
  // dotenv optional
}

const KNOWN_PRODUCTION_IDENTIFIERS = ["insta-autodm-production"];

function containsKnownProductionIdentifier(value) {
  const hay = String(value).toLowerCase();
  return KNOWN_PRODUCTION_IDENTIFIERS.some((id) => hay.includes(id.toLowerCase()));
}

function assertSafeV2DatabaseUrl(databaseUrl) {
  if (!databaseUrl || !String(databaseUrl).trim()) {
    throw new Error(
      "V2 DB safety: DATABASE_URL is required and must point at an isolated V2 database",
    );
  }

  let url;
  try {
    url = new URL(databaseUrl);
  } catch {
    throw new Error("V2 DB safety: DATABASE_URL is not a valid URL");
  }

  const hostname = url.hostname.toLowerCase();
  const database = decodeURIComponent(url.pathname.replace(/^\//, "").split("?")[0] || "");

  if (!database) {
    throw new Error("V2 DB safety: DATABASE_URL is missing a database name");
  }

  if (containsKnownProductionIdentifier(hostname) || containsKnownProductionIdentifier(database)) {
    throw new Error(
      `V2 DB safety: refusing known production identifier in host/database ` +
        `(host="${hostname}" database="${database}")`,
    );
  }

  const local =
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1" ||
    hostname === "host.docker.internal";

  if (local) {
    if (!/v2/i.test(database)) {
      throw new Error(
        `V2 DB safety: database name "${database}" must include "v2" (e.g. comment2dm_v2_dev)`,
      );
    }
    return { hostname, database, remoteStaging: false };
  }

  if (process.env.COMMENT2DM_ALLOW_REMOTE_V2_DB !== "true") {
    throw new Error(
      `V2 DB safety: refusing non-local host "${hostname}" ` +
        `(set COMMENT2DM_ALLOW_REMOTE_V2_DB=true only for approved V2 staging)`,
    );
  }

  if (!(/v2/i.test(database) && /staging/i.test(database))) {
    throw new Error(
      `V2 DB safety: remote database name "${database}" must include both "v2" and "staging"`,
    );
  }

  return { hostname, database, remoteStaging: true };
}

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error("Usage: node scripts/with-v2-db-safety.cjs <prisma-args...>");
  process.exit(1);
}

try {
  const parts = assertSafeV2DatabaseUrl(process.env.DATABASE_URL);
  console.log(
    `[v2-db-safety] OK host=${parts.hostname} database=${parts.database}` +
      (parts.remoteStaging ? " remoteStaging=true" : ""),
  );
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

const result = spawnSync(
  process.execPath,
  [require.resolve("prisma/build/index.js"), ...args],
  {
    cwd: path.join(__dirname, ".."),
    env: process.env,
    stdio: "inherit",
  },
);

process.exit(result.status == null ? 1 : result.status);
