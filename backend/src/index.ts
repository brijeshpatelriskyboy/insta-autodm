import { createApp } from "./app";

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
console.log(`[startup] NODE_ENV=${process.env.NODE_ENV ?? "unset"}`);
console.log(`[startup] bind=${host}:${port}`);

app.listen(port, host, () => {
  console.log(`[startup] Ready — GET /health on http://${host}:${port}/health`);
});
