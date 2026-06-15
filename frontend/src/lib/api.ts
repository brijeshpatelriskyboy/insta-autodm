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

  if (response.status === 204) {
    console.log(`[API] ${method} ${url} succeeded (no content)`);
    return undefined as T;
  }

  const data = await response.json();
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
  createdAt: string;
  updatedAt: string;
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

export const api = {
  health: () => request<{ status: string; service?: string }>("/api/health"),

  register: (email: string, password: string, name?: string) =>
    request<AuthResponse>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ email, password, name }),
    }),

  login: (email: string, password: string) =>
    request<AuthResponse>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),

  me: (token: string) => request<User>("/api/auth/me", {}, token),

  getKeywordRules: (token: string) =>
    request<KeywordRule[]>("/api/keyword-rules", {}, token),

  createKeywordRule: (
    token: string,
    data: { keyword: string; dmMessage: string; isActive?: boolean },
  ) =>
    request<KeywordRule>("/api/keyword-rules", {
      method: "POST",
      body: JSON.stringify(data),
    }, token),

  updateKeywordRule: (
    token: string,
    id: string,
    data: { keyword?: string; dmMessage?: string; isActive?: boolean },
  ) =>
    request<KeywordRule>(`/api/keyword-rules/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }, token),

  deleteKeywordRule: (token: string, id: string) =>
    request<void>(`/api/keyword-rules/${id}`, { method: "DELETE" }, token),

  getAnalyticsSummary: (token: string) =>
    request<AnalyticsSummary>("/api/analytics/summary", {}, token),

  getInstagramStatus: (token: string) =>
    request<InstagramStatus>("/api/instagram/status", {}, token),

  connectInstagram: (token: string, instagramUsername: string) =>
    request<InstagramConnectResponse>("/api/instagram/connect", {
      method: "POST",
      body: JSON.stringify({ instagramUsername }),
    }, token),

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
