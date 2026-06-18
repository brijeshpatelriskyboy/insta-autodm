import { env, isMetaOAuthEnabled } from "./env";

export const META_GRAPH_API_VERSION = "v21.0";

// Planned scopes for later — NOT sent in the OAuth URL until redirect is confirmed.
// TODO: Add scope param back once Meta app is approved:
//   instagram_basic, instagram_manage_comments, pages_show_list, pages_read_engagement
export const META_OAUTH_SCOPES_PLANNED = [
  "instagram_basic",
  "instagram_manage_comments",
  "pages_show_list",
  "pages_read_engagement",
] as const;

export function getMetaRedirectUri(): string {
  if (env.META_REDIRECT_URI?.trim()) {
    return env.META_REDIRECT_URI.trim().replace(/\/$/, "");
  }

  const port = env.PORT;
  const host =
    env.NODE_ENV === "production"
      ? "https://your-api.up.railway.app"
      : `http://localhost:${port}`;
  return `${host}/api/integrations/instagram/callback`;
}

export function getMissingMetaCredentials(): string[] {
  const missing: string[] = [];
  if (!env.META_APP_ID?.trim()) missing.push("META_APP_ID");
  if (!env.META_APP_SECRET?.trim()) missing.push("META_APP_SECRET");
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
    appId: env.META_APP_ID?.trim() ?? null,
    redirectUri: getMetaRedirectUri(),
    graphApiVersion: META_GRAPH_API_VERSION,
    webhookUrl: null as string | null,
    verifyToken: getMetaVerifyToken(),
    oauthEnabled: isMetaOAuthEnabled(),
  };
}

export function buildOAuthUrl(state: string): string {
  if (!env.META_APP_ID?.trim()) {
    throw new Error("META_APP_ID is required to build OAuth URL");
  }

  const params = new URLSearchParams({
    client_id: env.META_APP_ID.trim(),
    redirect_uri: getMetaRedirectUri(),
    state,
    response_type: "code",
  });

  return `https://www.facebook.com/${META_GRAPH_API_VERSION}/dialog/oauth?${params.toString()}`;
}

/** @deprecated Use buildOAuthUrl */
export function buildOAuthPreviewUrl(state: string): string | null {
  if (!env.META_APP_ID?.trim()) {
    return null;
  }
  return buildOAuthUrl(state);
}
