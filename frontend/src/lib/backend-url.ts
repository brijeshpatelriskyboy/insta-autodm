const PLACEHOLDER_HOST_PATTERNS = [
  /^your-api\.up\.railway\.app$/i,
  /^your-railway-domain\.up\.railway\.app$/i,
  /^your-app\.vercel\.app$/i,
];

export function normalizeBackendUrl(raw: string): string {
  let url = raw.trim().replace(/\/$/, "");
  if (!url) {
    return "http://localhost:4000";
  }
  if (!/^https?:\/\//i.test(url)) {
    url = `https://${url}`;
  }
  return url;
}

export function resolveBackendUrl(
  apiUrl?: string | null,
  publicApiUrl?: string | null,
): string {
  const raw =
    apiUrl ??
    publicApiUrl ??
    process.env.API_URL ??
    process.env.NEXT_PUBLIC_API_URL ??
    "http://localhost:4000";
  return normalizeBackendUrl(raw);
}

export function isPlaceholderBackendUrl(url: string): boolean {
  try {
    const host = new URL(normalizeBackendUrl(url)).hostname.toLowerCase();
    if (PLACEHOLDER_HOST_PATTERNS.some((pattern) => pattern.test(host))) {
      return true;
    }
    return host.includes("your-railway") || host.includes("your-api");
  } catch {
    return true;
  }
}
