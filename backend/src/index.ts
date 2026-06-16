import { createApp } from "./app";
import { prisma } from "./lib/prisma";
import { getDatabaseHostHint, getEnvDiagnostics } from "./utils/dbDiagnostics";

const port = Number(process.env.PORT) || 4000;
const isRailway = Boolean(process.env.RAILWAY_ENVIRONMENT || process.env.RAILWAY_SERVICE_ID);
const host =
  process.env.NODE_ENV === "production" || isRailway ? "0.0.0.0" : "localhost";

const app = createApp();

console.log("[startup] Insta AutoDM API");
console.log(`[startup] PORT=${port} (process.env.PORT=${process.env.PORT ?? "unset"})`);
console.log(
  `[startup] DATABASE_URL=${process.env.DATABASE_URL ? "configured" : "MISSING"}`,
);
console.log(`[startup] databaseHost=${getDatabaseHostHint()}`);
console.log(`[startup] NODE_ENV=${process.env.NODE_ENV ?? "unset"}`);
console.log(`[startup] env=${JSON.stringify(getEnvDiagnostics())}`);
console.log(`[startup] bind=${host}:${port}`);

app.listen(port, host, () => {
  console.log(`[startup] Ready — GET /health on http://${host}:${port}/health`);

  prisma
    .$queryRaw`SELECT 1`
    .then(() => console.log("[startup] Database connection ok"))
    .catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      console.error("[startup] Database connection failed:", message);
    });
});
