/**
 * Guards V2 schema/migrate/seed/integration-test operations so they never
 * target production (or any known hosted production-like) databases.
 */

const PRODUCTION_HOST_MARKERS = [
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
  return PRODUCTION_HOST_MARKERS.some(
    (marker) => host === marker || host.endsWith(`.${marker}`) || host.includes(marker),
  );
}

/**
 * Throws if DATABASE_URL is missing or unsafe for V2 schema mutations.
 * Safe V2 targets: local hosts + database name containing "v2".
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

  if (looksLikeProductionHost(parts.hostname)) {
    throw new Error(
      `V2 DB safety: refusing operation against production-like host "${parts.hostname}"`,
    );
  }

  if (!isLocalHostname(parts.hostname) && process.env.COMMENT2DM_ALLOW_REMOTE_V2_DB !== "true") {
    throw new Error(
      `V2 DB safety: refusing non-local host "${parts.hostname}" (set COMMENT2DM_ALLOW_REMOTE_V2_DB=true only for approved V2 staging)`,
    );
  }

  if (!/v2/i.test(parts.database)) {
    throw new Error(
      `V2 DB safety: database name "${parts.database}" must include "v2" (e.g. comment2dm_v2_dev)`,
    );
  }

  return parts;
}
