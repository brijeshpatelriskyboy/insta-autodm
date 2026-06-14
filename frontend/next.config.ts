import type { NextConfig } from "next";

function resolveBackendUrl(): string {
  const url =
    process.env.NEXT_PUBLIC_API_URL ??
    process.env.API_URL ??
    "http://localhost:4000";
  return url.replace(/\/$/, "");
}

const backendUrl = resolveBackendUrl();

if (
  (process.env.VERCEL === "1" || process.env.NODE_ENV === "production") &&
  backendUrl === "http://localhost:4000"
) {
  console.warn(
    "[build] NEXT_PUBLIC_API_URL and API_URL are unset — API requests will fail in production.",
  );
}

const nextConfig: NextConfig = {
  output: "standalone",
  env: {
    // Expose backend URL to the client at build time (API_URL works without NEXT_PUBLIC_ prefix).
    NEXT_PUBLIC_API_URL: backendUrl,
  },
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${backendUrl}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
