import {
  getCredentialDiagnostics,
  getInstagramAppId,
  getInstagramAppSecret,
  getMetaGraphApiVersion,
  getMetaRedirectUri,
  INSTAGRAM_WEBHOOK_SUBSCRIBED_FIELDS,
  last4,
  logOAuthClientDiagnostics,
} from "../config/meta";
import { AppError } from "../utils/errors";

type MetaGraphError = {
  error?: {
    message?: string;
    type?: string;
    code?: number;
  };
  error_message?: string;
  error_type?: string;
};

type TokenExchangeResponse = {
  access_token: string;
  user_id: string;
  permissions?: string;
  token_type?: string;
  expires_in?: number;
};

type InstagramProfile = {
  id: string;
  user_id?: string;
  username?: string;
  account_type?: string;
  name?: string;
  profile_picture_url?: string;
};

export type FacebookPageLookupProbe = {
  host: "graph.instagram.com" | "graph.facebook.com";
  path: string;
  fields: string;
  httpStatus: number;
  ok: boolean;
  /** Full Graph JSON body with tokens omitted (never includes access_token). */
  body: unknown;
};

export type FacebookPageLookupResult = {
  pageId: string | null;
  source:
    | "instagram_me_page_field"
    | "facebook_me_accounts"
    | "not_available"
    | "error";
  probes: FacebookPageLookupProbe[];
};

async function parseJsonResponse<T>(response: Response, context: string): Promise<T> {
  const body = (await response.json()) as T & MetaGraphError;

  if (!response.ok || body.error || body.error_message) {
    const message =
      body.error?.message ??
      body.error_message ??
      `Instagram API request failed (${context})`;
    console.error(`[instagram-oauth] ${context} failed:`, {
      status: response.status,
      type: body.error?.type ?? body.error_type ?? "unknown",
      code: body.error?.code ?? null,
      message,
    });
    throw new AppError(502, message);
  }

  return body;
}

/**
 * Normalize Instagram short-lived token response.
 * Meta has returned both a flat object and a `{ data: [...] }` envelope.
 */
function normalizeTokenPayload(body: unknown): TokenExchangeResponse {
  const root = body as Record<string, unknown>;

  if (Array.isArray(root.data) && root.data[0] && typeof root.data[0] === "object") {
    const entry = root.data[0] as Record<string, unknown>;
    if (typeof entry.access_token === "string") {
      return {
        access_token: entry.access_token,
        user_id: String(entry.user_id ?? ""),
        permissions: typeof entry.permissions === "string" ? entry.permissions : undefined,
      };
    }
  }

  if (typeof root.access_token === "string") {
    return {
      access_token: root.access_token,
      user_id: String(root.user_id ?? ""),
      permissions: typeof root.permissions === "string" ? root.permissions : undefined,
      token_type: typeof root.token_type === "string" ? root.token_type : undefined,
      expires_in: typeof root.expires_in === "number" ? root.expires_in : undefined,
    };
  }

  throw new AppError(502, "Instagram token exchange returned an unexpected payload");
}

/**
 * Pass the authorization code through unchanged.
 * Express already decoded req.query once — do not trim, strip, re-decode, or truncate.
 */
export function readAuthorizationCode(code: string): string {
  return code;
}

export const metaGraphService = {
  /**
   * Exchange an Instagram authorization code for a short-lived user access token.
   * Exactly one application/x-www-form-urlencoded POST to
   * https://api.instagram.com/oauth/access_token
   */
  async exchangeCodeForToken(code: string): Promise<TokenExchangeResponse> {
    const clientId = getInstagramAppId();
    const clientSecret = getInstagramAppSecret();

    if (!clientId || !clientSecret) {
      throw new AppError(500, "INSTAGRAM_APP_ID and INSTAGRAM_APP_SECRET are required");
    }

    const redirectUri = getMetaRedirectUri();
    // Code is used once, unmodified (Express already decoded the query param).
    const authorizationCode = readAuthorizationCode(code);

    const TOKEN_URL = "https://api.instagram.com/oauth/access_token";

    const body = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
      code: authorizationCode,
    });

    const tokenExchangeClientId = body.get("client_id") ?? "";
    const tokenExchangeRedirectUri = body.get("redirect_uri") ?? "";

    logOAuthClientDiagnostics("token-exchange", clientId, redirectUri, {
      tokenExchangeClientId,
      tokenExchangeClientIdLast4: last4(tokenExchangeClientId),
      tokenExchangeClientIdMatchesGetter: tokenExchangeClientId === clientId,
      tokenExchangeRedirectUri: JSON.stringify(tokenExchangeRedirectUri),
      tokenExchangeRedirectUriLength: tokenExchangeRedirectUri.length,
      tokenExchangeMatchesGetter: tokenExchangeRedirectUri === redirectUri,
      grantType: body.get("grant_type"),
      tokenEndpoint: TOKEN_URL,
      tokenEndpointHostname: new URL(TOKEN_URL).hostname,
      contentType: "application/x-www-form-urlencoded",
      formKeys: ["client_id", "client_secret", "grant_type", "redirect_uri", "code"],
      codeLength: authorizationCode.length,
      codeWasModified: authorizationCode !== code,
      credentials: getCredentialDiagnostics(),
      // Never log client_secret, access tokens, or the full authorization code.
    });

    console.log("[instagram-oauth] token exchange posting to", TOKEN_URL);

    const response = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });

    const raw = await parseJsonResponse<unknown>(response, "token exchange");
    const data = normalizeTokenPayload(raw);

    console.log("[instagram-oauth] token exchange succeeded:", {
      userId: data.user_id || null,
      accessTokenReceived: Boolean(data.access_token),
      permissions: data.permissions ?? null,
    });

    return data;
  },

  /**
   * Exchange short-lived Instagram user token for a long-lived token (60 days).
   * Falls back to the short-lived token if exchange fails.
   */
  async exchangeForLongLivedToken(
    shortLivedToken: string,
  ): Promise<{ access_token: string; expires_in?: number }> {
    const clientSecret = getInstagramAppSecret();
    if (!clientSecret) {
      return { access_token: shortLivedToken };
    }

    const url = new URL("https://graph.instagram.com/access_token");
    url.searchParams.set("grant_type", "ig_exchange_token");
    url.searchParams.set("client_secret", clientSecret);
    url.searchParams.set("access_token", shortLivedToken);

    try {
      const response = await fetch(url.toString(), { method: "GET" });
      const data = await parseJsonResponse<{ access_token: string; expires_in?: number }>(
        response,
        "long-lived token exchange",
      );

      console.log("[instagram-oauth] long-lived token exchange succeeded:", {
        expiresIn: data.expires_in ?? null,
      });

      return data;
    } catch (error) {
      console.warn("[instagram-oauth] long-lived token exchange failed; using short-lived token", {
        message: error instanceof Error ? error.message : String(error),
      });
      return { access_token: shortLivedToken };
    }
  },

  /**
   * Fetch the connected Instagram professional account profile.
   * GET https://graph.instagram.com/{version}/me
   */
  async fetchInstagramProfile(accessToken: string): Promise<InstagramProfile> {
    const url = new URL(`https://graph.instagram.com/${getMetaGraphApiVersion()}/me`);
    url.searchParams.set(
      "fields",
      "user_id,username,name,account_type,profile_picture_url",
    );
    url.searchParams.set("access_token", accessToken);

    const response = await fetch(url.toString(), { method: "GET" });
    const profile = await parseJsonResponse<InstagramProfile>(response, "profile fetch");

    console.log("[instagram-oauth] profile fetched:", {
      id: profile.user_id ?? profile.id,
      username: profile.username ?? null,
      accountType: profile.account_type ?? null,
      hasPicture: Boolean(profile.profile_picture_url),
    });

    return profile;
  },

  /**
   * Attempt to resolve the Facebook Page ID linked to an Instagram professional account.
   *
   * Instagram Login docs do NOT list a Page ID on `/me` and state a Facebook Page is not
   * required. Facebook Login uses `GET /me/accounts` on graph.facebook.com instead.
   * This method probes both paths with the stored Instagram user token and returns the
   * exact Graph JSON bodies so callers can persist a Page ID only when Meta returns one.
   *
   * @see https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/get-started/
   * @see https://developers.facebook.com/docs/instagram-platform/instagram-api-with-facebook-login/business-login-for-instagram/
   */
  async resolveLinkedFacebookPageId(params: {
    igUserId: string;
    accessToken: string;
  }): Promise<FacebookPageLookupResult> {
    const version = getMetaGraphApiVersion();
    const probes: FacebookPageLookupProbe[] = [];

    async function probe(
      host: "graph.instagram.com" | "graph.facebook.com",
      path: string,
      fields: string,
    ): Promise<Record<string, unknown>> {
      const url = new URL(`https://${host}/${version}${path}`);
      url.searchParams.set("fields", fields);
      url.searchParams.set("access_token", params.accessToken);

      const response = await fetch(url.toString(), { method: "GET" });
      const body = (await response.json()) as Record<string, unknown>;
      probes.push({
        host,
        path,
        fields,
        httpStatus: response.status,
        ok: response.ok && !body.error,
        body,
      });
      return body;
    }

    try {
      // 1) Documented Instagram Login profile fields (baseline).
      await probe(
        "graph.instagram.com",
        "/me",
        "user_id,username,name,account_type,profile_picture_url",
      );

      // 2) Ask Instagram Login host for any page-shaped fields (exact success/error).
      const igPageProbe = await probe(
        "graph.instagram.com",
        "/me",
        "user_id,username,id,page_id,facebook_page,connected_facebook_page",
      );

      const igPageId =
        (typeof igPageProbe.page_id === "string" && igPageProbe.page_id) ||
        (typeof igPageProbe.facebook_page === "string" && igPageProbe.facebook_page) ||
        (igPageProbe.connected_facebook_page &&
        typeof igPageProbe.connected_facebook_page === "object" &&
        typeof (igPageProbe.connected_facebook_page as { id?: unknown }).id === "string"
          ? (igPageProbe.connected_facebook_page as { id: string }).id
          : null) ||
        (typeof igPageProbe.connected_facebook_page === "string"
          ? igPageProbe.connected_facebook_page
          : null);

      if (igPageId) {
        console.log("[instagram-oauth] facebook page id from Instagram Login fields:", {
          igUserId: params.igUserId,
          pageId: igPageId,
        });
        return { pageId: igPageId, source: "instagram_me_page_field", probes };
      }

      // 3) Facebook Login path: list Pages and match instagram_business_account.
      const accountsBody = await probe(
        "graph.facebook.com",
        "/me/accounts",
        "id,name,instagram_business_account",
      );

      const rows = Array.isArray(accountsBody.data) ? accountsBody.data : [];
      for (const row of rows) {
        if (!row || typeof row !== "object") continue;
        const page = row as {
          id?: unknown;
          instagram_business_account?: { id?: unknown };
        };
        const linkedIgId =
          page.instagram_business_account &&
          typeof page.instagram_business_account === "object"
            ? String(page.instagram_business_account.id ?? "")
            : "";
        if (linkedIgId && linkedIgId === params.igUserId && typeof page.id === "string") {
          console.log("[instagram-oauth] facebook page id from me/accounts:", {
            igUserId: params.igUserId,
            pageId: page.id,
          });
          return { pageId: page.id, source: "facebook_me_accounts", probes };
        }
      }

      console.log("[instagram-oauth] no facebook page id available for Instagram Login token:", {
        igUserId: params.igUserId,
        probeCount: probes.length,
        probeStatuses: probes.map((p) => ({
          host: p.host,
          path: p.path,
          httpStatus: p.httpStatus,
          ok: p.ok,
          error:
            p.body && typeof p.body === "object" && "error" in p.body
              ? (p.body as { error?: { message?: string; code?: number } }).error
              : null,
        })),
      });

      return { pageId: null, source: "not_available", probes };
    } catch (error) {
      console.error("[instagram-oauth] facebook page lookup failed:", {
        igUserId: params.igUserId,
        message: error instanceof Error ? error.message : String(error),
      });
      return { pageId: null, source: "error", probes };
    }
  },

  /**
   * Enable webhook delivery for a specific Instagram professional account.
   *
   * Meta Instagram Login webhooks require BOTH:
   * 1. App Dashboard: subscribe the Instagram object + fields (callback verify)
   * 2. This Graph call: POST /{ig-user-id}/subscribed_apps with subscribed_fields
   *
   * Without step 2, dashboard "Test" webhooks still work, but real comments never
   * reach the callback. Official docs:
   * https://developers.facebook.com/docs/instagram-platform/webhooks/
   *
   * POST https://graph.instagram.com/{VERSION}/{IG_USER_ID}/subscribed_apps
   */
  async subscribeAppWebhooks(params: {
    igUserId: string;
    accessToken: string;
    fields?: readonly string[];
  }): Promise<{ success: true; fields: string[] }> {
    const fields = [...(params.fields ?? INSTAGRAM_WEBHOOK_SUBSCRIBED_FIELDS)];
    if (fields.length === 0) {
      throw new AppError(500, "No Instagram webhook fields configured for subscription");
    }

    const version = getMetaGraphApiVersion();
    const url = new URL(
      `https://graph.instagram.com/${version}/${encodeURIComponent(params.igUserId)}/subscribed_apps`,
    );
    url.searchParams.set("subscribed_fields", fields.join(","));
    url.searchParams.set("access_token", params.accessToken);

    console.log("[instagram-webhooks] subscribed_apps request:", {
      igUserId: params.igUserId,
      fields,
      graphHost: "graph.instagram.com",
      version,
    });

    const response = await fetch(url.toString(), { method: "POST" });
    const raw = await parseJsonResponse<{ success?: boolean }>(
      response,
      "subscribed_apps",
    );

    if (raw.success !== true) {
      console.error("[instagram-webhooks] subscribed_apps unexpected response:", {
        igUserId: params.igUserId,
        success: raw.success ?? null,
      });
      throw new AppError(502, "Instagram subscribed_apps did not return success=true");
    }

    console.log("[instagram-webhooks] subscribed_apps succeeded:", {
      igUserId: params.igUserId,
      fields,
    });

    return { success: true, fields };
  },

  /**
   * Send one private reply to an Instagram commenter via Messaging API.
   *
   * Limitations (Meta platform rules — still apply):
   * - This is a private reply to a specific comment, not unrestricted outbound DM.
   * - Typically one private reply per commenter/comment context.
   * - Must be sent within Meta's eligibility window (commonly 7 days for post/reel
   *   comments; live comments only during the broadcast).
   * - Follow-up free-form DMs require the recipient to reply first (24h window).
   *
   * POST https://graph.instagram.com/{VERSION}/{IG_USER_ID}/messages
   */
  async sendPrivateReplyToComment(params: {
    igUserId: string;
    accessToken: string;
    commentId: string;
    messageText: string;
    timeoutMs?: number;
  }): Promise<{ recipientId: string | null; messageId: string }> {
    const version = getMetaGraphApiVersion();
    const url = `https://graph.instagram.com/${version}/${encodeURIComponent(params.igUserId)}/messages`;
    const timeoutMs = params.timeoutMs ?? 10_000;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${params.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          recipient: { comment_id: params.commentId },
          message: { text: params.messageText },
        }),
        signal: controller.signal,
      });

      const raw = (await response.json()) as {
        recipient_id?: string;
        message_id?: string;
        error?: { message?: string; type?: string; code?: number };
      };

      if (!response.ok || raw.error || !raw.message_id) {
        const message =
          raw.error?.message ?? `Instagram private reply failed (HTTP ${response.status})`;
        console.error("[instagram-dm] private reply failed:", {
          status: response.status,
          type: raw.error?.type ?? null,
          code: raw.error?.code ?? null,
          message,
          commentId: params.commentId,
          igUserId: params.igUserId,
        });
        throw new AppError(502, message);
      }

      console.log("[instagram-dm] private reply sent:", {
        commentId: params.commentId,
        igUserId: params.igUserId,
        messageIdPresent: Boolean(raw.message_id),
        recipientIdPresent: Boolean(raw.recipient_id),
      });

      return {
        recipientId: raw.recipient_id ?? null,
        messageId: raw.message_id,
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      if (error instanceof Error && error.name === "AbortError") {
        throw new AppError(504, `Instagram private reply timed out after ${timeoutMs}ms`);
      }
      throw new AppError(
        502,
        error instanceof Error ? error.message : "Instagram private reply request failed",
      );
    } finally {
      clearTimeout(timer);
    }
  },

  /** @deprecated Use fetchInstagramProfile — kept for any residual Facebook Login callers. */
  async fetchFacebookProfile(accessToken: string): Promise<{
    id: string;
    name?: string;
    picture?: { data?: { url?: string } };
  }> {
    const profile = await this.fetchInstagramProfile(accessToken);
    return {
      id: profile.user_id ?? profile.id,
      name: profile.name ?? profile.username,
      picture: profile.profile_picture_url
        ? { data: { url: profile.profile_picture_url } }
        : undefined,
    };
  },
};
