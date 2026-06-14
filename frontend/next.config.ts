import type { NextConfig } from "next";

function resolveBackendUrl(): string {
  const url = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
  return url.replace(/\/$/, "");
}

const backendUrl = resolveBackendUrl();

if (
  (process.env.VERCEL === "1" || process.env.NODE_ENV === "production") &&
  backendUrl === "http://localhost:4000"
) {
  console.warn(
    "[build] NEXT_PUBLIC_API_URL is unset — API requests will fail in production.",
  );
}

const nextConfig: NextConfig = {
  output: "standalone",
  env: {
    NEXT_PUBLIC_API_URL: backendUrl,
  },
};

export default nextConfig;