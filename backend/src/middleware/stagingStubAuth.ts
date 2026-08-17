/**
 * Staging-only auth for Meta private-reply stub diagnostic routes.
 * Does not enable the stub; production still never mounts these routes.
 * Never logs the configured or provided secret.
 */

import { createHash, timingSafeEqual } from "crypto";
import type { NextFunction, Request, Response } from "express";
import { AppError } from "../utils/errors";

export const STAGING_STUB_KEY_HEADER = "X-Comment2DM-Stub-Key";
export const STAGING_STUB_SECRET_MIN_LENGTH = 16;

export function getConfiguredStagingStubSecret(
  value: string | undefined = process.env.STAGING_META_STUB_SECRET,
): string | null {
  const secret = value?.trim() ?? "";
  if (secret.length < STAGING_STUB_SECRET_MIN_LENGTH) {
    return null;
  }
  return secret;
}

export function stagingStubSecretsEqual(provided: string, expected: string): boolean {
  const a = createHash("sha256").update(provided, "utf8").digest();
  const b = createHash("sha256").update(expected, "utf8").digest();
  return timingSafeEqual(a, b);
}

function headerValue(req: Request, name: string): string | undefined {
  const raw = req.headers[name.toLowerCase()];
  if (Array.isArray(raw)) return raw[0];
  return raw;
}

/**
 * Require X-Comment2DM-Stub-Key matching STAGING_META_STUB_SECRET (min 16).
 * Missing/short config → 503 (fail closed). Missing/wrong key → 401.
 */
export function requireStagingStubDiagnosticAuth(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  const configured = getConfiguredStagingStubSecret();
  if (!configured) {
    next(new AppError(503, "Staging stub diagnostics are not configured"));
    return;
  }

  const provided = headerValue(req, STAGING_STUB_KEY_HEADER)?.trim() ?? "";
  if (!provided || !stagingStubSecretsEqual(provided, configured)) {
    next(new AppError(401, "Unauthorized"));
    return;
  }

  next();
}
