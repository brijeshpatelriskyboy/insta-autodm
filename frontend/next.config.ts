import type { NextConfig } from "next";
import {
  isPlaceholderBackendUrl,
  resolveBackendUrl,
} from "./src/lib/backend-url";

const backendUrl = resolveBackendUrl(
  process.env.API_URL,
  process.env.NEXT_PUBLIC_API_URL,
);

if (process.env.VERCEL === "1" || process.env.NODE_ENV === "production") {
  if (backendUrl === "http://localhost:4000") {
    console.warn(
      "[build] API_URL / NEXT_PUBLIC_API_URL is unset — API requests will fail in production.",
    );
  } else if (isPlaceholderBackendUrl(backendUrl)) {
    console.warn(
      `[build] API URL looks like a placeholder (${backendUrl}). Set your real Railway URL on Vercel.`,
    );
  }
}

const nextConfig: NextConfig = {
  output: "standalone",
  env: {
    NEXT_PUBLIC_API_URL: backendUrl,
  },
};

export default nextConfig;
