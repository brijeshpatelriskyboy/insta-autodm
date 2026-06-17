import { env, isMetaOAuthEnabled } from "../config/env";
import {
  buildOAuthUrl,
  getMetaRedirectUri,
  getMissingMetaCredentials,
  getPublicMetaConfig,
  isMetaOAuthConfigured,
  META_GRAPH_API_VERSION,
  META_OAUTH_SCOPES_PLANNED,
} from "../config/meta";
import { AppError } from "../utils/errors";

function buildOAuthState(userId: string): string {
  return `${userId}:${Date.now()}`;
}

export const metaOAuthService = {
  getPublicConfig(apiBaseUrl: string) {
    const config = getPublicMetaConfig();
    return {
      ...config,
      webhookUrl: `${apiBaseUrl.replace(/\/$/, "")}/api/webhooks/instagram`,
      scopes: [], // none requested until redirect with ?code= is confirmed
      scopesPlanned: [...META_OAUTH_SCOPES_PLANNED],
      graphApiVersion: META_GRAPH_API_VERSION,
    };
  },

  getOAuthUrl(userId: string) {
    const oauthEnabled = isMetaOAuthEnabled();
    const configured = isMetaOAuthConfigured();
    const redirectUri = getMetaRedirectUri();
    const missing = getMissingMetaCredentials();
    const state = buildOAuthState(userId);

    if (!oauthEnabled) {
      return {
        url: null,
        previewUrl: configured ? buildOAuthUrl(state) : null,
        oauthEnabled: false,
        configured,
        redirectUri,
        setupError: null,
        message:
          "Meta OAuth is disabled. Set META_OAUTH_ENABLED=true after Meta app verification.",
      };
    }

    if (!configured) {
      return {
        url: null,
        previewUrl: null,
        oauthEnabled: true,
        configured: false,
        redirectUri,
        setupError: {
          missing,
          message: `Meta setup required. Missing: ${missing.join(", ")}`,
        },
        message: `Meta setup required. Missing: ${missing.join(", ")}`,
      };
    }

    const url = buildOAuthUrl(state);

    return {
      url,
      previewUrl: url,
      oauthEnabled: true,
      configured: true,
      redirectUri,
      setupError: null,
      message: "Redirect to Meta to authorize Instagram access.",
    };
  },

  handleCallbackPlaceholder(query: {
    code?: string;
    state?: string;
    error?: string;
    error_description?: string;
  }) {
    if (query.error) {
      throw new AppError(
        400,
        query.error_description ?? query.error ?? "Meta OAuth authorization was denied",
      );
    }

    if (!query.code) {
      throw new AppError(400, "Missing authorization code from Meta");
    }

    if (!isMetaOAuthEnabled()) {
      return {
        status: "placeholder",
        oauthEnabled: false,
        message:
          "Authorization code received. Enable META_OAUTH_ENABLED=true to continue token exchange in a future release.",
        received: {
          hasCode: Boolean(query.code),
          state: query.state ?? null,
        },
      };
    }

    return {
      status: "authorized",
      oauthEnabled: true,
      message:
        "Authorization code received. Token exchange will be enabled in the next release — no DMs are sent yet.",
      received: {
        hasCode: Boolean(query.code),
        state: query.state ?? null,
      },
    };
  },

  buildCallbackRedirect(query: {
    code?: string;
    state?: string;
    error?: string;
    error_description?: string;
  }): string {
    const base = `${env.FRONTEND_URL.replace(/\/$/, "")}/dashboard/integrations/instagram-setup`;
    const params = new URLSearchParams();

    if (query.error) {
      params.set("oauth", "error");
      params.set("message", query.error_description ?? query.error);
      return `${base}?${params.toString()}`;
    }

    if (query.code) {
      params.set("oauth", isMetaOAuthEnabled() ? "authorized" : "placeholder");
      params.set(
        "message",
        isMetaOAuthEnabled()
          ? "Meta authorization received. Token exchange ships in the next release."
          : "Meta returned an authorization code. Enable META_OAUTH_ENABLED=true to continue.",
      );
      return `${base}?${params.toString()}`;
    }

    params.set("oauth", "error");
    params.set("message", "No authorization code received from Meta");
    return `${base}?${params.toString()}`;
  },
};
