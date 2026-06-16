import { Prisma } from "@prisma/client";

export function getDatabaseHostHint(databaseUrl?: string): string {
  const raw = databaseUrl ?? process.env.DATABASE_URL;
  if (!raw) {
    return "missing";
  }

  try {
    return new URL(raw).hostname;
  } catch {
    return "invalid-url";
  }
}

export function getEnvDiagnostics() {
  return {
    nodeEnv: process.env.NODE_ENV ?? "unset",
    databaseUrlConfigured: Boolean(process.env.DATABASE_URL),
    databaseHost: getDatabaseHostHint(),
    jwtSecretConfigured: Boolean(process.env.JWT_SECRET),
    debugDbShapeEnabled: process.env.DEBUG_DB_SHAPE === "true",
  };
}

export function logPrismaError(
  context: string,
  error: unknown,
  queryPath?: string,
): void {
  const pathSuffix = queryPath ? ` path=${queryPath}` : "";

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    console.error(`[auth] ${context}${pathSuffix}:`, {
      name: error.name,
      code: error.code,
      message: error.message,
      meta: JSON.stringify(error.meta),
    });
    return;
  }

  if (error instanceof Prisma.PrismaClientInitializationError) {
    console.error(`[auth] ${context}${pathSuffix}:`, {
      name: error.name,
      code: "P1001",
      message: error.message,
      meta: JSON.stringify({ clientVersion: error.clientVersion }),
    });
    return;
  }

  if (error instanceof Prisma.PrismaClientRustPanicError) {
    console.error(`[auth] ${context}${pathSuffix}:`, {
      name: error.name,
      message: error.message,
      meta: "{}",
    });
    return;
  }

  console.error(`[auth] ${context}${pathSuffix}:`, {
    name: error instanceof Error ? error.name : "UnknownError",
    message: error instanceof Error ? error.message : String(error),
    meta: "{}",
  });
}
