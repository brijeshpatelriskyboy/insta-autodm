/** Instagram Business Login scopes (Instagram API with Instagram Login). */
export const INSTAGRAM_OAUTH_SCOPES = [
  "instagram_business_basic",
  "instagram_business_manage_comments",
  "instagram_business_manage_messages",
] as const;

/** @deprecated Prefer INSTAGRAM_OAUTH_SCOPES — kept for public config compatibility. */
export const META_OAUTH_SCOPES_PLANNED = INSTAGRAM_OAUTH_SCOPES;

export const META_GRAPH_API_VERSION = "v21.0";

/** Expected production Instagram App ID (Business Login). */
export const EXPECTED_INSTAGRAM_APP_ID = "1002912682559021";

/** Known legacy Meta App ID that must NOT be used for Instagram Business Login. */
export const LEGACY_META_APP_ID = "2478735929261424";

const EXPECTED_PRODUCTION_CALLBACK =
  "https://insta-autodm-production.up.railway.app/api/meta/callback";

const TOKEN_ENDPOINT = "https://api.instagram.com/oauth/access_token";
const AUTHORIZE_ENDPOINT = "https://www.instagram.com/oauth/authorize";

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
 * Reads process.env.META_REDIRECT_URI and normalises with trim() only.
 */
export function getMetaRedirectUri(): string {
  const raw = process.env.META_REDIRECT_URI;
  if (raw !== undefined && raw !== null && raw.trim()) {
    return raw.trim();
  }

  const port = process.env.PORT || "4000";
  if (process.env.NODE_ENV === "production") {
    return EXPECTED_PRODUCTION_CALLBACK;
  }
  return `http://localhost:${port}/api/meta/callback`;
}

/**
 * Instagram App ID only — never falls back to META_APP_ID.
 */
export function getInstagramAppId(): string | null {
  const value = process.env.INSTAGRAM_APP_ID?.trim() || "";
  return value || null;
}

/**
 * Instagram App Secret only — never falls back to META_APP_SECRET.
 */
export function getInstagramAppSecret(): string | null {
  const value = process.env.INSTAGRAM_APP_SECRET?.trim() || "";
  return value || null;
}

/** Safe last-4 helper for client_id diagnostics (never for secrets). */
export function last4(value: string | null | undefined): string | null {
  if (!value) return null;
  return value.length <= 4 ? value : value.slice(-4);
}

/**
 * Safe credential inventory for startup / OAuth diagnostics.
 * Never includes secret values.
 */
export function getCredentialDiagnostics() {
  const instagramAppId = getInstagramAppId();
  const instagramAppSecret = getInstagramAppSecret();
  const metaAppId = process.env.META_APP_ID?.trim() || null;
  const metaAppSecretPresent = Boolean(process.env.META_APP_SECRET?.trim());

  return {
    instagramAppId,
    instagramAppIdLast4: last4(instagramAppId),
    equalsExpectedInstagramAppId: instagramAppId === EXPECTED_INSTAGRAM_APP_ID,
    expectedInstagramAppId: EXPECTED_INSTAGRAM_APP_ID,
    instagramAppSecretPresent: Boolean(instagramAppSecret),
    instagramAppSecretLength: instagramAppSecret?.length ?? 0,
    metaAppId,
    metaAppIdPresent: Boolean(metaAppId),
    metaAppIdDifferentFromInstagram: Boolean(metaAppId && metaAppId !== instagramAppId),
    metaAppIdIsLegacy: metaAppId === LEGACY_META_APP_ID,
    metaAppSecretPresent,
    usingMetaAppIdFallback: false,
    usingMetaAppSecretFallback: false,
    credentialSource: {
      clientId: "INSTAGRAM_APP_ID",
      clientSecret: "INSTAGRAM_APP_SECRET",
    },
  };
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
  const credentials = getCredentialDiagnostics();
  return {
    configured: isMetaOAuthConfigured(),
    appId: getInstagramAppId(),
    redirectUri: getMetaRedirectUri(),
    graphApiVersion: META_GRAPH_API_VERSION,
    webhookUrl: null as string | null,
    verifyToken: getMetaVerifyToken(),
    oauthEnabled: isMetaOAuthEnabled(),
    authorizationEndpoint: AUTHORIZE_ENDPOINT,
    tokenEndpoint: TOKEN_ENDPOINT,
    scopes: [...INSTAGRAM_OAUTH_SCOPES],
    // Safe credential status only — no secrets.
    credentials: {
      instagramAppId: credentials.instagramAppId,
      equalsExpectedInstagramAppId: credentials.equalsExpectedInstagramAppId,
      instagramAppSecretPresent: credentials.instagramAppSecretPresent,
      instagramAppSecretLength: credentials.instagramAppSecretLength,
      metaAppIdPresent: credentials.metaAppIdPresent,
      metaAppIdDifferentFromInstagram: credentials.metaAppIdDifferentFromInstagram,
      metaAppIdIsLegacy: credentials.metaAppIdIsLegacy,
      usingMetaAppIdFallback: false,
      usingMetaAppSecretFallback: false,
    },
  };
}

/** Temporary diagnostics for OAuth authorize / token-exchange debugging. */
export function logOAuthClientDiagnostics(
  phase: "authorize" | "token-exchange",
  clientId: string,
  redirectUri: string,
  extras?: Record<string, unknown>,
): void {
  console.log(`[instagram-oauth] client diagnostics (${phase}):`, {
    clientId,
    clientIdLast4: last4(clientId),
    equalsExpectedInstagramAppId: clientId === EXPECTED_INSTAGRAM_APP_ID,
    isLegacyMetaAppId: clientId === LEGACY_META_APP_ID,
    redirectUri: JSON.stringify(redirectUri),
    redirectUriLength: redirectUri.length,
    endsWithSlash: redirectUri.endsWith("/"),
    tokenEndpointHostname: "api.instagram.com",
    tokenEndpoint: TOKEN_ENDPOINT,
    credentialSource: "INSTAGRAM_APP_ID / INSTAGRAM_APP_SECRET only",
    ...extras,
  });
}

/**
 * Build Instagram Business Login authorization URL.
 * client_id comes only from INSTAGRAM_APP_ID.
 */
export function buildOAuthUrl(state: string): string {
  const clientId = getInstagramAppId();
  if (!clientId) {
    throw new Error("INSTAGRAM_APP_ID is required to build OAuth URL");
  }

  const redirectUri = getMetaRedirectUri();

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: INSTAGRAM_OAUTH_SCOPES.join(","),
    state,
  });

  const url = `${AUTHORIZE_ENDPOINT}?${params.toString()}`;
  const decodedFromAuthUrl = new URL(url).searchParams.get("redirect_uri") ?? "";
  const authClientId = new URL(url).searchParams.get("client_id") ?? "";

  logOAuthClientDiagnostics("authorize", clientId, redirectUri, {
    authorizationClientId: authClientId,
    authorizationClientIdLast4: last4(authClientId),
    authorizationClientIdMatchesGetter: authClientId === clientId,
    authorizationUrlDecodedRedirectUri: JSON.stringify(decodedFromAuthUrl),
    authorizationUrlDecodedRedirectUriLength: decodedFromAuthUrl.length,
    authorizeMatchesGetter: decodedFromAuthUrl === redirectUri,
    credentials: getCredentialDiagnostics(),
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
