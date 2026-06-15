import { env } from "../config/env";
import {
  buildOAuthPreviewUrl,
  getMetaRedirectUri,
  getPublicMetaConfig,
  isMetaOAuthConfigured,
  META_GRAPH_API_VERSION,
  META_OAUTH_SCOPES,
} from "../config/meta";
import { AppError } from "../utils/errors";

export const metaOAuthService = {
  getPublicConfig(apiBaseUrl: string) {
    const config = getPublicMetaConfig();
    return {
      ...config,
      webhookUrl: `${apiBaseUrl.replace(/\/$/, "")}/api/webhooks/instagram`,
      scopes: META_OAUTH_SCOPES.split(","),
      graphApiVersion: META_GRAPH_API_VERSION,
    };
  },

  getOAuthUrlPlaceholder(userId: string) {
    const configured = isMetaOAuthConfigured();
    const state = `placeholder_${userId}_${Date.now()}`;

    return {
      url: null,
      previewUrl: buildOAuthPreviewUrl(state),
      oauthEnabled: false,
      configured,
      redirectUri: getMetaRedirectUri(),
      message: configured
        ? "OAuth URL preview is ready. Token exchange will be enabled in the next release."
        : "Set META_APP_ID, META_APP_SECRET, and META_REDIRECT_URI on the server first.",
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

    return {
      status: "placeholder",
      oauthEnabled: false,
      message:
        "Authorization code received. Token exchange is not enabled yet — this callback is scaffolding only.",
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
      params.set("oauth", "placeholder");
      params.set("message", "Meta returned an authorization code. Token exchange ships in the next release.");
      return `${base}?${params.toString()}`;
    }

    params.set("oauth", "error");
    params.set("message", "No authorization code received from Meta");
    return `${base}?${params.toString()}`;
  },
};
