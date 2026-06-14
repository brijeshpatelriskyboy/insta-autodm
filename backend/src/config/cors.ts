import type { CorsOptions } from "cors";
import { env } from "../config/env";

const DEV_ORIGINS = [
  "http://localhost:3000",
  "http://127.0.0.1:3000",
];

function getConfiguredOrigins(): string[] {
  return env.CORS_ORIGIN.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function isAllowedOrigin(origin: string): boolean {
  const configured = getConfiguredOrigins();

  if (configured.includes(origin)) {
    return true;
  }

  if (env.NODE_ENV === "development" && DEV_ORIGINS.includes(origin)) {
    return true;
  }

  return false;
}

export const corsOptions: CorsOptions = {
  origin(origin, callback) {
    // Allow server-to-server tools (curl, health checks) with no Origin header
    if (!origin) {
      callback(null, true);
      return;
    }

    if (isAllowedOrigin(origin)) {
      callback(null, origin);
      return;
    }

    console.warn(`[CORS] Blocked request from origin: ${origin}`);
    callback(null, false);
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
};
