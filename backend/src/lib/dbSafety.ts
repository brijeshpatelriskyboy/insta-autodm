/**
 * Guards V2 schema/migrate/seed/integration-test operations so they never
 * target production (or any known hosted production) databases.
 *
 * Safe targets:
 * - Local hosts with a database name containing "v2"
 * - Approved remote V2 staging only when ALL of:
 *   - COMMENT2DM_ALLOW_REMOTE_V2_DB=true
 *   - database name contains both "v2" and "staging"
 *   - hostname/database do not match known production identifiers
 */

/** Host / name fragments that must never be targeted by V2 mutate tools. */
export const KNOWN_PRODUCTION_IDENTIFIERS = [
  "insta-autodm-production",
] as const;

const HOSTED_PLATFORM_MARKERS = [
  "railway.app",
  "rlwy.net",
  "railway.internal",
  "render.com",
  "supabase.co",
  "neon.tech",
  "amazonaws.com",
  "azure.com",
  "cloud.google.com",
] as const;

export type DatabaseUrlParts = {
  protocol: string;
  hostname: string;
  port: string | null;
  database: string;
};

export function parseDatabaseUrl(databaseUrl: string): DatabaseUrlParts {
  let url: URL;
  try {
    url = new URL(databaseUrl);
  } catch {
    throw new Error("DATABASE_URL is not a valid URL");
  }

  const database = decodeURIComponent(url.pathname.replace(/^\//, "").split("?")[0] ?? "");
  if (!database) {
    throw new Error("DATABASE_URL is missing a database name");
  }

  return {
    protocol: url.protocol.replace(/:$/, ""),
    hostname: url.hostname.toLowerCase(),
    port: url.port || null,
    database,
  };
}

export function isLocalHostname(hostname: string): boolean {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1" ||
    hostname === "host.docker.internal"
  );
}

export function looksLikeProductionHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return HOSTED_PLATFORM_MARKERS.some(
    (marker) => host === marker || host.endsWith(`.${marker}`) || host.includes(marker),
  );
}

export function containsKnownProductionIdentifier(value: string): boolean {
  const hay = value.toLowerCase();
  return KNOWN_PRODUCTION_IDENTIFIERS.some((id) => hay.includes(id.toLowerCase()));
}

/** Remote V2 staging DB names must include both markers (case-insensitive). */
export function isApprovedRemoteV2StagingDatabase(databaseName: string): boolean {
  return /v2/i.test(databaseName) && /staging/i.test(databaseName);
}

/**
 * Throws if DATABASE_URL is missing or unsafe for V2 schema mutations.
 */
export function assertSafeV2DatabaseUrl(
  databaseUrl: string | undefined = process.env.DATABASE_URL,
): DatabaseUrlParts {
  if (!databaseUrl?.trim()) {
    throw new Error(
      "V2 DB safety: DATABASE_URL is required and must point at an isolated V2 database",
    );
  }

  const parts = parseDatabaseUrl(databaseUrl);

  if (
    containsKnownProductionIdentifier(parts.hostname) ||
    containsKnownProductionIdentifier(parts.database)
  ) {
    throw new Error(
      `V2 DB safety: refusing known production identifier in host/database ` +
        `(host="${parts.hostname}" database="${parts.database}")`,
    );
  }

  if (isLocalHostname(parts.hostname)) {
    if (!/v2/i.test(parts.database)) {
      throw new Error(
        `V2 DB safety: database name "${parts.database}" must include "v2" (e.g. comment2dm_v2_dev)`,
      );
    }
    return parts;
  }

  // Remote path — explicit override + staging+v2 markers required.
  if (process.env.COMMENT2DM_ALLOW_REMOTE_V2_DB !== "true") {
    throw new Error(
      `V2 DB safety: refusing non-local host "${parts.hostname}" ` +
        `(set COMMENT2DM_ALLOW_REMOTE_V2_DB=true only for approved V2 staging)`,
    );
  }

  if (!isApprovedRemoteV2StagingDatabase(parts.database)) {
    throw new Error(
      `V2 DB safety: remote database name "${parts.database}" must include both "v2" and "staging"`,
    );
  }

  return parts;
}
