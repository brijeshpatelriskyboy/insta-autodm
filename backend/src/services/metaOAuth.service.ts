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
import { instagramIntegrationService } from "./instagramIntegration.service";

function buildOAuthState(userId: string): string {
  return `${userId}:${Date.now()}`;
}

function parseOAuthState(state?: string): string | null {
  if (!state?.trim()) {
    return null;
  }

  const userId = state.split(":")[0]?.trim();
  if (!userId) {
    return null;
  }

  return userId;
}

function integrationsRedirect(params: Record<string, string>): string {
  const base = `${env.FRONTEND_URL.replace(/\/$/, "")}/dashboard/integrations`;
  const search = new URLSearchParams(params);
  return `${base}?${search.toString()}`;
}

export const metaOAuthService = {
  getPublicConfig(apiBaseUrl: string) {
    const config = getPublicMetaConfig();
    return {
      ...config,
      webhookUrl: `${apiBaseUrl.replace(/\/$/, "")}/api/webhooks/instagram`,
      scopes: [],
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
      message: "Redirect to Meta to authorize access.",
    };
  },

  async handleCallback(query: {
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
          "Authorization code received. Enable META_OAUTH_ENABLED=true to exchange tokens.",
        received: {
          hasCode: true,
          state: query.state ?? null,
        },
      };
    }

    const userId = parseOAuthState(query.state);
    if (!userId) {
      throw new AppError(400, "Invalid OAuth state");
    }

    console.log("[meta-oauth] callback received:", {
      userId,
      hasCode: true,
    });

    const account = await instagramIntegrationService.connectViaOAuth(userId, query.code);

    return {
      status: "connected",
      oauthEnabled: true,
      message: `Connected as ${account.username ?? "Meta user"}.`,
      username: account.username,
      accountType: account.accountType,
    };
  },

  async handleCallbackRedirect(query: {
    code?: string;
    state?: string;
    error?: string;
    error_description?: string;
  }): Promise<string> {
    if (query.error) {
      return integrationsRedirect({
        oauth: "error",
        message: query.error_description ?? query.error ?? "Meta OAuth authorization was denied",
      });
    }

    if (!query.code) {
      return integrationsRedirect({
        oauth: "error",
        message: "No authorization code received from Meta",
      });
    }

    if (!isMetaOAuthEnabled()) {
      return integrationsRedirect({
        oauth: "placeholder",
        message:
          "Meta returned an authorization code. Enable META_OAUTH_ENABLED=true to exchange tokens.",
      });
    }

    try {
      const result = await this.handleCallback(query);
      return integrationsRedirect({
        oauth: "success",
        message: result.message,
      });
    } catch (error) {
      const message =
        error instanceof AppError
          ? error.message
          : error instanceof Error
            ? error.message
            : "Meta OAuth callback failed";

      console.error("[meta-oauth] callback redirect failed:", {
        name: error instanceof Error ? error.name : "UnknownError",
        message,
      });

      return integrationsRedirect({
        oauth: "error",
        message,
      });
    }
  },
};
