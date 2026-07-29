import { createHmac, timingSafeEqual } from "crypto";

const SIGNATURE_PREFIX = "sha256=";
const HEX_DIGEST_LENGTH = 64;

/**
 * Compute Meta X-Hub-Signature-256 digest (hex) for a raw request body.
 * Uses HMAC-SHA256 with the Instagram app secret.
 */
export function computeMetaWebhookSignature(rawBody: Buffer, appSecret: string): string {
  return createHmac("sha256", appSecret).update(rawBody).digest("hex");
}

/**
 * Verify Meta webhook X-Hub-Signature-256 against the exact raw body bytes.
 * Returns false for missing, malformed, or invalid signatures.
 * Uses constant-time comparison; never throws on bad input.
 */
export function verifyMetaWebhookSignature(
  rawBody: Buffer,
  signatureHeader: string | undefined,
  appSecret: string,
): boolean {
  if (!appSecret || !Buffer.isBuffer(rawBody)) {
    return false;
  }

  if (typeof signatureHeader !== "string" || !signatureHeader.startsWith(SIGNATURE_PREFIX)) {
    return false;
  }

  const providedHex = signatureHeader.slice(SIGNATURE_PREFIX.length);
  if (
    providedHex.length !== HEX_DIGEST_LENGTH ||
    !/^[0-9a-fA-F]+$/.test(providedHex)
  ) {
    return false;
  }

  const expectedHex = computeMetaWebhookSignature(rawBody, appSecret);

  try {
    const provided = Buffer.from(providedHex, "hex");
    const expected = Buffer.from(expectedHex, "hex");
    if (provided.length !== expected.length) {
      return false;
    }
    return timingSafeEqual(provided, expected);
  } catch {
    return false;
  }
}
