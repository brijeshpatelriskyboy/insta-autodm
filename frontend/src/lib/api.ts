import {
  isPlaceholderBackendUrl,
  normalizeBackendUrl,
  resolveBackendUrl,
} from "./backend-url";

export function getApiBaseUrl(): string {
  return resolveBackendUrl();
}

function getRequestUrl(path: string): string {
  // Browser: same-origin requests proxied by src/app/api/[...path]/route.ts.
  if (typeof window !== "undefined") {
    if (path === "/health") {
      return "/api/health";
    }
    return path;
  }

  const base = getApiBaseUrl();
  if (path === "/health" || path === "/api/health") {
    return `${base}/health`;
  }
  return `${base}${path}`;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  token?: string | null,
): Promise<T> {
  const method = options.method ?? "GET";
  const url = getRequestUrl(path);

  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...(options.headers ?? {}),
  };

  if (token) {
    (headers as Record<string, string>)["Authorization"] = `Bearer ${token}`;
  }

  console.log(`[API] ${method} ${url}`);

  let response: Response;
  try {
    response = await fetch(url, {
      ...options,
      headers,
    });
  } catch (error) {
    console.error(`[API] Network error for ${method} ${url}:`, error);
    const backend = getApiBaseUrl();
    const hint = isPlaceholderBackendUrl(backend)
      ? "API_URL on Vercel is still a placeholder (e.g. YOUR-RAILWAY-DOMAIN). Set your real Railway URL and redeploy."
      : `Set API_URL on Vercel to your Railway backend (${backend}) and redeploy.`;
    throw new ApiError(0, `Cannot reach the API server (${url}). ${hint}`);
  }

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const message =
      body.error ??
      body.message ??
      `Request failed (${response.status}) at ${url}`;
    console.error(`[API] ${method} ${url} failed:`, response.status, message);
    throw new ApiError(response.status, message);
  }

  if (response.status === 204 || response.status === 205) {
    console.log(`[API] ${method} ${url} succeeded (no content)`);
    return undefined as T;
  }

  const text = await response.text();
  if (!text.trim()) {
    console.log(`[API] ${method} ${url} succeeded (empty body)`);
    return undefined as T;
  }

  const data = JSON.parse(text) as T;
  console.log(`[API] ${method} ${url} succeeded`);
  return data;
}

export interface User {
  id: string;
  email: string;
  name: string | null;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface KeywordRule {
  id: string;
  userId: string;
  keyword: string;
  dmMessage: string;
  isActive: boolean;
  /** Null = global (all posts). */
  instagramMediaId: string | null;
  mediaScopeKey: string;
  /** Cached dashboard preview only — not used for matching. */
  mediaType: string | null;
  mediaThumbnailUrl: string | null;
  mediaCaption: string | null;
  mediaPermalink: string | null;
  /** Instagram media publish time (ISO). Display-only cache. */
  mediaTimestamp: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface InstagramMediaItem {
  id: string;
  caption: string | null;
  mediaType: string | null;
  thumbnailUrl: string | null;
  permalink: string | null;
  timestamp: string | null;
}

export interface InstagramMediaListResponse {
  instagramUserId: string;
  username: string;
  media: InstagramMediaItem[];
}

export interface AnalyticsSummary {
  totalKeywordRules: number;
  totalDmEvents: number;
  totalLeads: number;
}

export interface InstagramStatus {
  connected: boolean;
  status: string;
  instagramUsername: string | null;
  joinedWaitlist: boolean;
}

export interface InstagramConnectResponse {
  id: string;
  instagramUsername: string;
  status: string;
  message: string;
}

export interface InstagramSetupChecklist {
  professionalAccount: boolean;
  facebookPageLinked: boolean;
  metaDeveloperApp: boolean;
  webhookConfigured: boolean;
}

export type GraphApiStatus = "active" | "pending" | "error" | "disconnected";

export interface InstagramIntegrationStatus {
  connected: boolean;
  connectionStatus: string;
  username: string | null;
  instagramUserId: string | null;
  accountType: string | null;
  profilePictureUrl: string | null;
  pageId: string | null;
  connectedAt: string | null;
  lastSyncAt: string | null;
  webhookSubscribedAt?: string | null;
  webhookSubscribedFields?: string | null;
  /** Live Meta Graph access check via Instagram profile request (not pageId). */
  graphApiStatus?: GraphApiStatus;
  graphApiVerifiedAt?: string | null;
  graphApiError?: string | null;
  setupChecklist: InstagramSetupChecklist;
  webhookSubscription?:
    | { success: true; fields: string[] }
    | { success: false; error: string };
}

export interface ActivityEventRecord {
  id: string;
  type: string;
  title: string;
  description: string;
  timestamp: string;
  keyword?: string;
}

export interface MetaOAuthConfig {
  configured: boolean;
  appId: string | null;
  redirectUri: string;
  graphApiVersion: string;
  webhookUrl: string | null;
  verifyToken?: string;
  oauthEnabled: boolean;
  scopes?: string[];
}

export interface MetaOAuthUrlPreview {
  url: string | null;
  previewUrl: string | null;
  oauthEnabled: boolean;
  configured: boolean;
  redirectUri: string;
  message: string;
  setupError?: {
    missing: string[];
    message: string;
  } | null;
}

export interface SubscriptionInfo {
  plan: string | null;
  planName: string | null;
  price: number | null;
  status: string;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  stripeConfigured: boolean;
}

export interface BillingHistoryItem {
  id: string;
  amount: number;
  currency: string;
  status: string;
  description: string | null;
  invoiceUrl: string | null;
  createdAt: string;
}

export interface FeatureFlags {
  smartCampaigns: boolean;
}

export type CampaignStatus =
  | "DRAFT"
  | "ACTIVE"
  | "PAUSED"
  | "ENDED"
  | "ARCHIVED";

export interface CampaignListItem {
  id: string;
  name: string;
  status: CampaignStatus;
  keywordRule: { id: string; keyword: string };
  startsAt: string;
  endsAt: string;
  maxClaims: number;
  claimedCount: number;
  remainingCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CampaignDetail extends CampaignListItem {
  dmTemplate: string;
  soldOutMessage: string;
  alreadyClaimedMessage: string;
  notStartedMessage: string | null;
  endedMessage: string | null;
  redemptionEnabled: boolean;
  archivedAt: string | null;
  codeCounts: Record<string, number>;
  claimCount: number;
}

export interface CampaignClaimListItem {
  id: string;
  instagramUsername: string | null;
  code: string;
  claimedAt: string;
  deliveryStatus: string;
}

export interface CreateCampaignPayload {
  keywordRuleId: string;
  name: string;
  startsAt: string;
  endsAt: string;
  maxClaims: number;
  dmTemplate: string;
  soldOutMessage: string;
  alreadyClaimedMessage: string;
  notStartedMessage?: string | null;
  endedMessage?: string | null;
  codeGeneration: {
    mode: "AUTO";
    prefix: string;
    length: number;
  };
}

export interface PatchCampaignPayload {
  name?: string;
  startsAt?: string;
  endsAt?: string;
  dmTemplate?: string;
  soldOutMessage?: string;
  alreadyClaimedMessage?: string;
  notStartedMessage?: string | null;
  endedMessage?: string | null;
  maxClaims?: number;
}

export const api = {
  health: () => request<{ status: string; service?: string }>("/api/health"),

  register: (
    email: string,
    password: string,
    options: { name?: string; acceptedTerms: boolean; acceptedPrivacy: boolean },
  ) =>
    request<AuthResponse>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({
        email,
        password,
        name: options.name,
        acceptedTerms: options.acceptedTerms,
        acceptedPrivacy: options.acceptedPrivacy,
      }),
    }),

  login: (email: string, password: string) =>
    request<AuthResponse>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),

  forgotPassword: (email: string) =>
    request<{ message: string }>("/api/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify({ email }),
    }),

  resetPassword: (token: string, newPassword: string) =>
    request<{ message: string }>("/api/auth/reset-password", {
      method: "POST",
      body: JSON.stringify({ token, newPassword }),
    }),

  changePassword: (token: string, currentPassword: string, newPassword: string) =>
    request<{ message: string }>(
      "/api/auth/change-password",
      {
        method: "POST",
        body: JSON.stringify({ currentPassword, newPassword }),
      },
      token,
    ),

  deleteAccount: (token: string, currentPassword: string, confirmation: string) =>
    request<{ deleted: true }>(
      "/api/account",
      {
        method: "DELETE",
        body: JSON.stringify({ currentPassword, confirmation }),
      },
      token,
    ),

  submitContact: (data: {
    name: string;
    email: string;
    subject: string;
    message: string;
  }) =>
    request<{ sent: true }>("/api/contact", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  getMetaDataDeletionStatus: (code: string) =>
    request<{
      confirmationCode: string;
      status: string;
      createdAt: string;
      completedAt: string | null;
    }>(`/api/meta/data-deletion/status?code=${encodeURIComponent(code)}`),

  me: (token: string) => request<User>("/api/auth/me", {}, token),

  getKeywordRules: (token: string) =>
    request<KeywordRule[]>("/api/keyword-rules", {}, token),

  createKeywordRule: (
    token: string,
    data: {
      keyword: string;
      dmMessage: string;
      isActive?: boolean;
      instagramMediaId?: string | null;
    },
  ) =>
    request<KeywordRule>("/api/keyword-rules", {
      method: "POST",
      body: JSON.stringify(data),
    }, token),

  updateKeywordRule: (
    token: string,
    id: string,
    data: {
      keyword?: string;
      dmMessage?: string;
      isActive?: boolean;
      instagramMediaId?: string | null;
    },
  ) =>
    request<KeywordRule>(`/api/keyword-rules/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }, token),

  deleteKeywordRule: (token: string, id: string) =>
    request<void>(`/api/keyword-rules/${id}`, { method: "DELETE" }, token),

  getInstagramMedia: (token: string, limit = 25) =>
    request<InstagramMediaListResponse>(
      `/api/integrations/instagram/media?limit=${limit}`,
      {},
      token,
    ),

  getAnalyticsSummary: (token: string) =>
    request<AnalyticsSummary>("/api/analytics/summary", {}, token),

  getInstagramStatus: (token: string) =>
    request<InstagramStatus>("/api/instagram/status", {}, token),

  connectInstagram: (token: string, instagramUsername: string) =>
    request<InstagramConnectResponse>("/api/instagram/connect", {
      method: "POST",
      body: JSON.stringify({ instagramUsername }),
    }, token),

  getInstagramIntegrationStatus: (token: string) =>
    request<InstagramIntegrationStatus>(
      "/api/integrations/instagram/status",
      {},
      token,
    ),

  connectInstagramMock: (token: string) =>
    request<InstagramIntegrationStatus>(
      "/api/integrations/instagram/connect/mock",
      { method: "POST" },
      token,
    ),

  disconnectInstagram: (token: string) =>
    request<{ disconnected: boolean; alreadyDisconnected?: boolean }>(
      "/api/integrations/instagram/disconnect",
      { method: "DELETE" },
      token,
    ),

  subscribeInstagramWebhooks: (token: string) =>
    request<InstagramIntegrationStatus>(
      "/api/integrations/instagram/subscribe-webhooks",
      { method: "POST" },
      token,
    ),

  syncInstagramFacebookPageId: (token: string) =>
    request<
      InstagramIntegrationStatus & {
        pageLookup?: {
          pageId: string | null;
          source: string;
          probes: unknown[];
        };
      }
    >("/api/integrations/instagram/sync-page-id", { method: "POST" }, token),

  getMetaOAuthConfig: () =>
    request<MetaOAuthConfig>("/api/integrations/instagram/meta-config"),

  getInstagramOAuthUrl: (token: string) =>
    request<MetaOAuthUrlPreview>("/api/integrations/instagram/oauth-url", {}, token),

  getActivityEvents: (token: string) =>
    request<ActivityEventRecord[]>("/api/activity/events", {}, token),

  getFeatures: (token: string) =>
    request<FeatureFlags>("/api/features", {}, token),

  getCampaigns: (token: string) =>
    request<CampaignListItem[]>("/api/campaigns", {}, token),

  getCampaign: (token: string, id: string) =>
    request<CampaignDetail>(`/api/campaigns/${id}`, {}, token),

  createCampaign: (token: string, data: CreateCampaignPayload) =>
    request<CampaignDetail>("/api/campaigns", {
      method: "POST",
      body: JSON.stringify(data),
    }, token),

  patchCampaign: (token: string, id: string, data: PatchCampaignPayload) =>
    request<CampaignDetail>(`/api/campaigns/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }, token),

  activateCampaign: (token: string, id: string) =>
    request<CampaignDetail>(`/api/campaigns/${id}/activate`, {
      method: "POST",
    }, token),

  pauseCampaign: (token: string, id: string) =>
    request<CampaignDetail>(`/api/campaigns/${id}/pause`, {
      method: "POST",
    }, token),

  archiveCampaign: (token: string, id: string) =>
    request<CampaignDetail>(`/api/campaigns/${id}/archive`, {
      method: "POST",
    }, token),

  getCampaignClaims: (token: string, id: string, limit = 100) =>
    request<{ claims: CampaignClaimListItem[]; limit: number }>(
      `/api/campaigns/${id}/claims?limit=${limit}`,
      {},
      token,
    ),

  getSubscription: (token: string) =>
    request<SubscriptionInfo>("/api/billing/subscription", {}, token),

  getBillingHistory: (token: string) =>
    request<BillingHistoryItem[]>("/api/billing/history", {}, token),

  createCheckout: (token: string, plan: "starter" | "creator" | "pro") =>
    request<{ url: string | null }>("/api/billing/checkout", {
      method: "POST",
      body: JSON.stringify({ plan }),
    }, token),

  cancelSubscription: (token: string) =>
    request<{ message: string }>("/api/billing/cancel", {
      method: "POST",
    }, token),
};
