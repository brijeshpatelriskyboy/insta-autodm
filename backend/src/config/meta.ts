/** Instagram Business Login scopes (Instagram API with Instagram Login). */
export const INSTAGRAM_OAUTH_SCOPES = [
  "instagram_business_basic",
  "instagram_business_manage_comments",
  "instagram_business_manage_messages",
] as const;

/** @deprecated Prefer INSTAGRAM_OAUTH_SCOPES — kept for public config compatibility. */
export const META_OAUTH_SCOPES_PLANNED = INSTAGRAM_OAUTH_SCOPES;

export const META_GRAPH_API_VERSION = "v21.0";

const EXPECTED_PRODUCTION_CALLBACK =
  "https://insta-autodm-production.up.railway.app/api/meta/callback";

/**
 * Inspect raw META_REDIRECT_URI from Railway / process.env for whitespace, quotes, newlines.
 * Does not modify the value.
 */
export function inspectRawMetaRedirectUri(): {
  present: boolean;
  length: number | null;
  json: string | null;
  hasLeadingWhitespace: boolean;
  hasTrailingWhitespace: boolean;
  hasNewline: boolean;
  hasSurroundingQuotes: boolean;
  endsWithSlash: boolean;
} {
  const raw = process.env.META_REDIRECT_URI;
  if (raw === undefined || raw === null) {
    return {
      present: false,
      length: null,
      json: null,
      hasLeadingWhitespace: false,
      hasTrailingWhitespace: false,
      hasNewline: false,
      hasSurroundingQuotes: false,
      endsWithSlash: false,
    };
  }

  const trimmed = raw.trim();
  return {
    present: true,
    length: raw.length,
    json: JSON.stringify(raw),
    hasLeadingWhitespace: raw !== raw.trimStart(),
    hasTrailingWhitespace: raw !== raw.trimEnd(),
    hasNewline: /\r|\n/.test(raw),
    hasSurroundingQuotes:
      (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
      (trimmed.startsWith("'") && trimmed.endsWith("'")),
    endsWithSlash: trimmed.endsWith("/"),
  };
}

/**
 * Single source of truth for OAuth redirect_uri.
 * Reads process.env.META_REDIRECT_URI and normalises with trim() only —
 * no trailing-slash stripping, no quote removal, no reconstruction.
 */
export function getMetaRedirectUri(): string {
  const raw = process.env.META_REDIRECT_URI;
  if (raw !== undefined && raw !== null && raw.trim()) {
    return raw.trim();
  }

  // Local-only fallback when env is unset (production must set META_REDIRECT_URI).
  const port = process.env.PORT || "4000";
  if (process.env.NODE_ENV === "production") {
    return EXPECTED_PRODUCTION_CALLBACK;
  }
  return `http://localhost:${port}/api/meta/callback`;
}

export function getInstagramAppId(): string | null {
  const value =
    process.env.INSTAGRAM_APP_ID?.trim() || process.env.META_APP_ID?.trim() || "";
  return value || null;
}

export function getInstagramAppSecret(): string | null {
  const value =
    process.env.INSTAGRAM_APP_SECRET?.trim() || process.env.META_APP_SECRET?.trim() || "";
  return value || null;
}

export function getMissingMetaCredentials(): string[] {
  const missing: string[] = [];
  if (!getInstagramAppId()) missing.push("INSTAGRAM_APP_ID");
  if (!getInstagramAppSecret()) missing.push("INSTAGRAM_APP_SECRET");
  if (!process.env.META_REDIRECT_URI?.trim()) missing.push("META_REDIRECT_URI");
  return missing;
}

export function isMetaOAuthConfigured(): boolean {
  return getMissingMetaCredentials().length === 0;
}

export function getMetaVerifyToken(): string {
  return process.env.META_VERIFY_TOKEN?.trim() || "insta-autodm-verify-token";
}

export function isMetaOAuthEnabled(): boolean {
  return process.env.META_OAUTH_ENABLED === "true";
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

/** Temporary diagnostics for redirect_uri mismatch debugging. */
export function logRedirectUriDiagnostics(
  phase: "authorize" | "token-exchange",
  redirectUri: string,
  extras?: Record<string, unknown>,
): void {
  const rawInspect = inspectRawMetaRedirectUri();
  console.log(`[instagram-oauth] redirect_uri diagnostics (${phase}):`, {
    redirectUri: JSON.stringify(redirectUri),
    redirectUriLength: redirectUri.length,
    endsWithSlash: redirectUri.endsWith("/"),
    equalsExpectedProduction: redirectUri === EXPECTED_PRODUCTION_CALLBACK,
    expectedProduction: EXPECTED_PRODUCTION_CALLBACK,
    expectedProductionLength: EXPECTED_PRODUCTION_CALLBACK.length,
    rawEnv: rawInspect,
    ...extras,
  });
}

/**
 * Build Instagram Business Login authorization URL.
 * Uses the same getMetaRedirectUri() value as the token exchange.
 */
export function buildOAuthUrl(state: string): string {
  const clientId = getInstagramAppId();
  if (!clientId) {
    throw new Error("INSTAGRAM_APP_ID is required to build OAuth URL");
  }

  // Same source as token exchange — process.env.META_REDIRECT_URI via getMetaRedirectUri().
  const redirectUri = getMetaRedirectUri();

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: INSTAGRAM_OAUTH_SCOPES.join(","),
    state,
  });

  const url = `https://www.instagram.com/oauth/authorize?${params.toString()}`;

  // URLSearchParams.get() returns the decoded redirect_uri embedded in the auth URL.
  const decodedFromAuthUrl = new URL(url).searchParams.get("redirect_uri") ?? "";

  logRedirectUriDiagnostics("authorize", redirectUri, {
    authorizationUrlDecodedRedirectUri: JSON.stringify(decodedFromAuthUrl),
    authorizationUrlDecodedRedirectUriLength: decodedFromAuthUrl.length,
    authorizeMatchesGetter: decodedFromAuthUrl === redirectUri,
  });

  return url;
}

/** @deprecated Use buildOAuthUrl */
export function buildOAuthPreviewUrl(state: string): string | null {
  if (!getInstagramAppId()) {
    return null;
  }
  return buildOAuthUrl(state);
}
