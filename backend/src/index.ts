import { createApp } from "./app";
import { logInstagramTableStatus } from "./lib/dbStartup";
import {
  getMetaRedirectUri,
  getMetaVerifyToken,
  inspectRawMetaRedirectUri,
  isMetaOAuthConfigured,
  isMetaOAuthEnabled,
} from "./config/meta";
import { env } from "./config/env";

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

  const redirectUri = getMetaRedirectUri();
  const rawRedirect = inspectRawMetaRedirectUri();

  console.log(`[startup][meta] Instagram OAuth enabled: ${isMetaOAuthEnabled()}`);
  console.log(`[startup][meta] INSTAGRAM_APP_ID loaded: ${env.INSTAGRAM_APP_ID?.trim() ? "yes" : "no"}`);
  console.log(
    `[startup][meta] INSTAGRAM_APP_SECRET loaded: ${env.INSTAGRAM_APP_SECRET?.trim() ? "yes" : "no"}`,
  );
  console.log(`[startup][meta] Redirect URI loaded: ${rawRedirect.present ? "yes" : "no"}`);
  console.log(`[startup][meta] Redirect URI: ${JSON.stringify(redirectUri)}`);
  console.log(`[startup][meta] Redirect URI length: ${redirectUri.length}`);
  console.log(`[startup][meta] Redirect URI endsWithSlash: ${redirectUri.endsWith("/")}`);
  console.log(`[startup][meta] Raw META_REDIRECT_URI inspect:`, rawRedirect);
  console.log(`[startup][meta] Credentials complete: ${isMetaOAuthConfigured()}`);
  console.log(`[startup][meta] Authorization: https://www.instagram.com/oauth/authorize`);
  console.log(`[startup][meta] Token exchange: https://api.instagram.com/oauth/access_token`);
  console.log(`[startup][meta] Callback route: GET /api/meta/callback`);
  console.log(`[startup][meta] Webhook verify token configured: ${Boolean(getMetaVerifyToken())}`);

  await logInstagramTableStatus();

  app.listen(port, host, () => {
    console.log(`[startup] Ready — GET /health on http://${host}:${port}/health`);
  });
}

bootstrap().catch((error) => {
  console.error("[startup] fatal error:", error instanceof Error ? error.message : error);
  process.exit(1);
});
