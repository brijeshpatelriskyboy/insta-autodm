import type { NextFunction, Request, Response } from "express";
import { AUTH_RATE_LIMIT_MESSAGE } from "../config/authSecurity";
import { AppError } from "../utils/errors";
import { getClientIp } from "./clientIp";

type Bucket = { count: number; resetAt: number };

const stores = new Map<string, Map<string, Bucket>>();

function getStore(name: string): Map<string, Bucket> {
  let store = stores.get(name);
  if (!store) {
    store = new Map();
    stores.set(name, store);
  }
  return store;
}

export function resetAuthRateLimitForTests(): void {
  stores.clear();
}

export function createAuthRateLimiter(options: {
  name: string;
  windowMs: number;
  max: number;
}) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const ip = getClientIp(req);
    const store = getStore(options.name);
    const now = Date.now();
    const existing = store.get(ip);

    if (!existing || existing.resetAt <= now) {
      store.set(ip, { count: 1, resetAt: now + options.windowMs });
      next();
      return;
    }

    if (existing.count >= options.max) {
      const retryAfterSec = Math.max(1, Math.ceil((existing.resetAt - now) / 1000));
      res.setHeader("Retry-After", String(retryAfterSec));
      next(new AppError(429, AUTH_RATE_LIMIT_MESSAGE));
      return;
    }

    existing.count += 1;
    next();
  };
}
