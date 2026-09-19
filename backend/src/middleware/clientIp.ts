import type { Request } from "express";

/**
 * Client IP for auth rate limiting.
 *
 * Local/dev/test: use the TCP peer only. Ignore X-Forwarded-For so clients
 * cannot spoof a new bucket per request.
 *
 * Railway (one reverse proxy): use the first X-Forwarded-For hop when present,
 * otherwise the socket address.
 */
export function getClientIp(req: Request): string {
  const socketIp = req.socket?.remoteAddress?.trim() || "unknown";
  const behindRailway = Boolean(
    process.env.RAILWAY_ENVIRONMENT || process.env.RAILWAY_SERVICE_ID,
  );
  if (!behindRailway) {
    return socketIp;
  }

  const forwarded = req.headers["x-forwarded-for"];
  const raw = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  const first = raw?.split(",")[0]?.trim();
  if (first && first.length > 0 && first.length <= 45 && !/\s/.test(first)) {
    return first;
  }
  return socketIp;
}
