import { env } from "../config/env";
import {
  buildOAuthUrl,
  getInstagramAppId,
  getMetaGraphApiVersion,
  getMetaRedirectUri,
  getMissingMetaCredentials,
  getPublicMetaConfig,
  INSTAGRAM_OAUTH_SCOPES,
  isMetaOAuthConfigured,
  isMetaOAuthEnabled,
  last4,
} from "../config/meta";
import { AppError } from "../utils/errors";
import { instagramIntegrationService } from "./instagramIntegration.service";

/** state = userId:timestamp:authorizeClientId */
function buildOAuthState(userId: string, authorizeClientId: string): string {
  return `${userId}:${Date.now()}:${authorizeClientId}`;
}

function parseOAuthState(state?: string): { userId: string; authorizeClientId: string | null } | null {
  if (!state?.trim()) {
    return null;
  }

  const parts = state.split(":");
  const userId = parts[0]?.trim();
  if (!userId) {
    return null;
  }

  const authorizeClientId = parts[2]?.trim() || null;
  return { userId, authorizeClientId };
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
      scopes: [...INSTAGRAM_OAUTH_SCOPES],
      scopesPlanned: [...INSTAGRAM_OAUTH_SCOPES],
      graphApiVersion: getMetaGraphApiVersion(),
    };
  },

  getOAuthUrl(userId: string) {
    const oauthEnabled = isMetaOAuthEnabled();
    const configured = isMetaOAuthConfigured();
    const redirectUri = getMetaRedirectUri();
    const missing = getMissingMetaCredentials();
    const authorizeClientId = getInstagramAppId() ?? "";
    const state = buildOAuthState(userId, authorizeClientId);

    if (!oauthEnabled) {
      return {
        url: null,
        previewUrl: configured ? buildOAuthUrl(state) : null,
        oauthEnabled: false,
        configured,
        redirectUri,
        setupError: null,
        message:
          "Instagram OAuth is disabled. Set META_OAUTH_ENABLED=true after app verification.",
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
          message: `Instagram setup required. Missing: ${missing.join(", ")}`,
        },
        message: `Instagram setup required. Missing: ${missing.join(", ")}`,
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
      message: "Redirect to Instagram to authorize access.",
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
        query.error_description ?? query.error ?? "Instagram OAuth authorization was denied",
      );
    }

    if (!query.code) {
      throw new AppError(400, "Missing authorization code from Instagram");
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

    const parsedState = parseOAuthState(query.state);
    if (!parsedState?.userId) {
      throw new AppError(400, "Invalid OAuth state");
    }

    const { userId, authorizeClientId } = parsedState;
    const tokenExchangeClientId = getInstagramAppId();

    console.log("[instagram-oauth] callback received:", {
      userId,
      hasCode: true,
      hasState: Boolean(query.state),
      authorizeClientId,
      authorizeClientIdLast4: last4(authorizeClientId),
      tokenExchangeClientId,
      tokenExchangeClientIdLast4: last4(tokenExchangeClientId),
      clientIdsStrictlyEqual: authorizeClientId === tokenExchangeClientId,
      codeLength: query.code.length,
    });

    const account = await instagramIntegrationService.connectViaOAuth(userId, query.code);
    const subscription = account.webhookSubscription;
    const webhookOk = subscription?.success === true;
    const username = account.username ?? "instagram";

    return {
      status: "connected",
      oauthEnabled: true,
      message: webhookOk
        ? `Connected as @${username}. Comment webhooks enabled.`
        : `Connected as @${username}, but webhook subscription failed. Open Integrations and click Enable comment webhooks.`,
      username: account.username,
      accountType: account.accountType,
      webhookSubscribed: webhookOk,
      webhookSubscriptionError:
        subscription && !subscription.success ? subscription.error : null,
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
        message:
          query.error_description ?? query.error ?? "Instagram OAuth authorization was denied",
      });
    }

    if (!query.code) {
      return integrationsRedirect({
        oauth: "error",
        message: "No authorization code received from Instagram",
      });
    }

    if (!isMetaOAuthEnabled()) {
      return integrationsRedirect({
        oauth: "placeholder",
        message:
          "Instagram returned an authorization code. Enable META_OAUTH_ENABLED=true to exchange tokens.",
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
            : "Instagram OAuth callback failed";

      console.error("[instagram-oauth] callback redirect failed:", {
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
