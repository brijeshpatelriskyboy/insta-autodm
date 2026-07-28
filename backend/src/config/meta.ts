import { env, isMetaOAuthEnabled } from "./env";

export const META_GRAPH_API_VERSION = "v21.0";

/** Instagram Business Login scopes (Instagram API with Instagram Login). */
export const INSTAGRAM_OAUTH_SCOPES = [
  "instagram_business_basic",
  "instagram_business_manage_comments",
  "instagram_business_manage_messages",
] as const;

/** @deprecated Prefer INSTAGRAM_OAUTH_SCOPES — kept for public config compatibility. */
export const META_OAUTH_SCOPES_PLANNED = INSTAGRAM_OAUTH_SCOPES;

const PRODUCTION_CALLBACK =
  "https://insta-autodm-production.up.railway.app/api/meta/callback";

export function getInstagramAppId(): string | null {
  const value = env.INSTAGRAM_APP_ID?.trim();
  return value || null;
}

export function getInstagramAppSecret(): string | null {
  const value = env.INSTAGRAM_APP_SECRET?.trim();
  return value || null;
}

export function getMetaRedirectUri(): string {
  if (env.META_REDIRECT_URI?.trim()) {
    return env.META_REDIRECT_URI.trim().replace(/\/$/, "");
  }

  if (env.NODE_ENV === "production") {
    return PRODUCTION_CALLBACK;
  }

  return `http://localhost:${env.PORT}/api/meta/callback`;
}

export function getMissingMetaCredentials(): string[] {
  const missing: string[] = [];
  if (!getInstagramAppId()) missing.push("INSTAGRAM_APP_ID");
  if (!getInstagramAppSecret()) missing.push("INSTAGRAM_APP_SECRET");
  if (!env.META_REDIRECT_URI?.trim()) missing.push("META_REDIRECT_URI");
  return missing;
}

export function isMetaOAuthConfigured(): boolean {
  return getMissingMetaCredentials().length === 0;
}

export function getMetaVerifyToken(): string {
  return env.META_VERIFY_TOKEN?.trim() || "insta-autodm-verify-token";
}

export function getPublicMetaConfig() {
  return {
    configured: isMetaOAuthConfigured(),
    appId: getInstagramAppId(),
    redirectUri: getMetaRedirectUri(),
    graphApiVersion: META_GRAPH_API_VERSION,
    webhookUrl: null as string | null,
    verifyToken: getMetaVerifyToken(),
    oauthEnabled: isMetaOAuthEnabled(),
    authorizationEndpoint: "https://www.instagram.com/oauth/authorize",
    tokenEndpoint: "https://api.instagram.com/oauth/access_token",
    scopes: [...INSTAGRAM_OAUTH_SCOPES],
  };
}

/**
 * Build Instagram Business Login authorization URL.
 * @see https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/business-login
 */
export function buildOAuthUrl(state: string): string {
  const clientId = getInstagramAppId();
  if (!clientId) {
    throw new Error("INSTAGRAM_APP_ID is required to build OAuth URL");
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: getMetaRedirectUri(),
    response_type: "code",
    scope: INSTAGRAM_OAUTH_SCOPES.join(","),
    state,
  });

  return `https://www.instagram.com/oauth/authorize?${params.toString()}`;
}

/** @deprecated Use buildOAuthUrl */
export function buildOAuthPreviewUrl(state: string): string | null {
  if (!getInstagramAppId()) {
    return null;
  }
  return buildOAuthUrl(state);
}
