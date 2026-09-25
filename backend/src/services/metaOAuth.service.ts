import { env } from "../config/env";
import crypto from "crypto";
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
import { authService } from "./auth.service";

type OAuthMode = "connect" | "login";
interface OAuthState { mode: OAuthMode; userId?: string; ts: number; nonce: string }

function buildOAuthState(mode: OAuthMode, userId?: string): string {
  const payload: OAuthState = { mode, userId, ts: Date.now(), nonce: crypto.randomBytes(16).toString("base64url") };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto.createHmac("sha256", env.JWT_SECRET).update(encoded).digest("base64url");
  return `${encoded}.${signature}`;
}

function parseOAuthState(state?: string): OAuthState | null {
  if (!state) return null;
  const [encoded, signature] = state.split(".");
  if (!encoded || !signature) return null;
  const expected = crypto.createHmac("sha256", env.JWT_SECRET).update(encoded).digest();
  let supplied: Buffer;
  try { supplied = Buffer.from(signature, "base64url"); } catch { return null; }
  if (expected.length !== supplied.length || !crypto.timingSafeEqual(expected, supplied)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as OAuthState;
    if (!(["connect", "login"] as string[]).includes(parsed.mode)) return null;
    if (!Number.isFinite(parsed.ts) || Date.now() - parsed.ts > 10 * 60_000 || parsed.ts > Date.now() + 60_000) return null;
    if (parsed.mode === "connect" && !parsed.userId) return null;
    return parsed;
  } catch { return null; }
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
    const state = buildOAuthState("connect", userId);

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

  getLoginOAuthUrl() {
    const base = this.getOAuthUrlForState(buildOAuthState("login"));
    return base;
  },

  getOAuthUrlForState(state: string) {
    const oauthEnabled = isMetaOAuthEnabled();
    const configured = isMetaOAuthConfigured();
    const redirectUri = getMetaRedirectUri();
    const missing = getMissingMetaCredentials();
    const url = configured ? buildOAuthUrl(state) : null;
    return {
      url: oauthEnabled ? url : null,
      previewUrl: url,
      oauthEnabled,
      configured,
      redirectUri,
      setupError: configured ? null : { missing, message: `Instagram setup required. Missing: ${missing.join(", ")}` },
      message: !oauthEnabled ? "Instagram OAuth is disabled." : configured ? "Redirect to Instagram to continue." : "Instagram setup required.",
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
    if (!parsedState) {
      throw new AppError(400, "Invalid OAuth state");
    }

    const userId = parsedState.userId;
    const tokenExchangeClientId = getInstagramAppId();

    console.log("[instagram-oauth] callback received:", {
      userId: userId ?? null,
      mode: parsedState.mode,
      hasCode: true,
      hasState: Boolean(query.state),
      tokenExchangeClientId,
      tokenExchangeClientIdLast4: last4(tokenExchangeClientId),
      codeLength: query.code.length,
    });

    if (parsedState.mode === "login") {
      const login = await instagramIntegrationService.loginViaOAuth(query.code);
      const session = await authService.createSessionForUser(login.userId);
      return { status: "authenticated", oauthEnabled: true, session };
    }
    if (!userId) throw new AppError(400, "Invalid OAuth state");
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
      const parsedState = parseOAuthState(query.state);
      const result = await this.handleCallback(query);
      if (parsedState?.mode === "login" && "session" in result) {
        const payload = Buffer.from(JSON.stringify(result.session)).toString("base64url");
        return `${env.FRONTEND_URL.replace(/\/$/, "")}/auth/instagram/callback#session=${payload}`;
      }
      return integrationsRedirect({
        oauth: "success",
        message: result.message ?? "Instagram connected successfully.",
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
