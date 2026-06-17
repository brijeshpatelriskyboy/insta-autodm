import { createApp } from "./app";
import { logInstagramTableStatus } from "./lib/dbStartup";
import {
  getMetaRedirectUri,
  isMetaOAuthConfigured,
} from "./config/meta";
import { env, isMetaOAuthEnabled } from "./config/env";

const port = Number(process.env.PORT) || 4000;
const isRailway = Boolean(process.env.RAILWAY_ENVIRONMENT || process.env.RAILWAY_SERVICE_ID);
const host =
  process.env.NODE_ENV === "production" || isRailway ? "0.0.0.0" : "localhost";

const app = createApp();

async function bootstrap(): Promise<void> {
  console.log("[startup] Insta AutoDM API");
  console.log(`[startup] PORT=${port} (process.env.PORT=${process.env.PORT ?? "unset"})`);
  console.log(
    `[startup] DATABASE_URL=${process.env.DATABASE_URL ? "configured" : "MISSING"}`,
  );
  console.log(`[startup] NODE_ENV=${process.env.NODE_ENV ?? "unset"}`);
  console.log(`[startup] bind=${host}:${port}`);

  console.log(`[startup][meta] Meta OAuth enabled: ${isMetaOAuthEnabled()}`);
  console.log(`[startup][meta] App ID loaded: ${env.META_APP_ID?.trim() ? "yes" : "no"}`);
  console.log(`[startup][meta] App Secret loaded: ${env.META_APP_SECRET?.trim() ? "yes" : "no"}`);
  console.log(`[startup][meta] Redirect URI loaded: ${env.META_REDIRECT_URI?.trim() ? "yes" : "no"}`);
  console.log(`[startup][meta] Redirect URI: ${getMetaRedirectUri()}`);
  console.log(`[startup][meta] Credentials complete: ${isMetaOAuthConfigured()}`);

  await logInstagramTableStatus();

  app.listen(port, host, () => {
    console.log(`[startup] Ready — GET /health on http://${host}:${port}/health`);
  });
}

bootstrap().catch((error) => {
  console.error("[startup] fatal error:", error instanceof Error ? error.message : error);
  process.exit(1);
});
