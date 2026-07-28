import {
  getInstagramAppId,
  getInstagramAppSecret,
  getMetaRedirectUri,
  META_GRAPH_API_VERSION,
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

/** Instagram sometimes appends `#_` to the redirect; strip it from the code. */
export function sanitizeAuthorizationCode(code: string): string {
  return code.replace(/#_+$/, "").trim();
}

export const metaGraphService = {
  /**
   * Exchange an Instagram authorization code for a short-lived user access token.
   * POST https://api.instagram.com/oauth/access_token
   */
  async exchangeCodeForToken(code: string): Promise<TokenExchangeResponse> {
    const clientId = getInstagramAppId();
    const clientSecret = getInstagramAppSecret();

    if (!clientId || !clientSecret) {
      throw new AppError(500, "INSTAGRAM_APP_ID and INSTAGRAM_APP_SECRET are required");
    }

    const form = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "authorization_code",
      redirect_uri: getMetaRedirectUri(),
      code: sanitizeAuthorizationCode(code),
    });

    console.log("[instagram-oauth] token exchange started");

    const response = await fetch("https://api.instagram.com/oauth/access_token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form.toString(),
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
    const url = new URL(`https://graph.instagram.com/${META_GRAPH_API_VERSION}/me`);
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
