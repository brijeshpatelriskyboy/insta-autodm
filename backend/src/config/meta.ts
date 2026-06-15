import { env } from "./env";

export const META_GRAPH_API_VERSION = "v21.0";

export const META_OAUTH_SCOPES = [
  "instagram_basic",
  "instagram_manage_comments",
  "pages_show_list",
  "pages_read_engagement",
].join(",");

export function getMetaRedirectUri(): string {
  if (env.META_REDIRECT_URI) {
    return env.META_REDIRECT_URI.replace(/\/$/, "");
  }

  const port = env.PORT;
  const host = env.NODE_ENV === "production" ? "https://your-api.up.railway.app" : `http://localhost:${port}`;
  return `${host}/api/integrations/instagram/callback`;
}

export function isMetaOAuthConfigured(): boolean {
  return Boolean(env.META_APP_ID && env.META_APP_SECRET && getMetaRedirectUri());
}

export function getPublicMetaConfig() {
  return {
    configured: isMetaOAuthConfigured(),
    appId: env.META_APP_ID ?? null,
    redirectUri: getMetaRedirectUri(),
    graphApiVersion: META_GRAPH_API_VERSION,
    webhookUrl: null as string | null,
    oauthEnabled: false,
  };
}

export function buildOAuthPreviewUrl(state: string): string | null {
  if (!env.META_APP_ID) {
    return null;
  }

  const params = new URLSearchParams({
    client_id: env.META_APP_ID,
    redirect_uri: getMetaRedirectUri(),
    state,
    scope: META_OAUTH_SCOPES,
    response_type: "code",
  });

  return `https://www.facebook.com/${META_GRAPH_API_VERSION}/dialog/oauth?${params.toString()}`;
}
