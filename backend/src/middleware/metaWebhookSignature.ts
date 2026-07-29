import type { Request, Response, NextFunction } from "express";
import { getInstagramAppSecret } from "../config/meta";
import { AppError } from "../utils/errors";
import { verifyMetaWebhookSignature } from "../utils/metaWebhookSignature";

/**
 * Verifies Meta X-Hub-Signature-256 using the exact raw request body
 * (must run after express.raw, before JSON parse / business logic).
 * Rejects missing or invalid signatures with HTTP 401.
 * Does not log the app secret, access token, signature, or raw payload.
 */
export function metaWebhookSignatureMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  const appSecret = getInstagramAppSecret();
  if (!appSecret) {
    console.error("[webhook] signature verification unavailable: app secret not configured");
    next(new AppError(503, "Webhook signature verification is not configured"));
    return;
  }

  const header = req.headers["x-hub-signature-256"];
  const signatureHeader = Array.isArray(header) ? header[0] : header;
  const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);

  if (!verifyMetaWebhookSignature(rawBody, signatureHeader, appSecret)) {
    console.warn("[webhook] signature verification failed", {
      hasSignatureHeader: Boolean(signatureHeader),
      bodyByteLength: rawBody.length,
    });
    next(new AppError(401, "Invalid webhook signature"));
    return;
  }

  try {
    const text = rawBody.toString("utf8");
    req.body = text.length === 0 ? {} : JSON.parse(text);
  } catch {
    console.warn("[webhook] invalid JSON after successful signature check", {
      bodyByteLength: rawBody.length,
    });
    next(new AppError(400, "Invalid JSON payload"));
    return;
  }

  next();
}
