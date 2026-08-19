import crypto from "crypto";

/**
 * Parse Meta `signed_request` (Data Deletion / Deauthorize callbacks).
 * @see https://developers.facebook.com/docs/development/create-an-app/app-dashboard/data-deletion-callback
 *
 * Format: `<base64url-sig>.<base64url-payload>`
 * Signature is HMAC-SHA256 of the encoded payload using the app secret.
 */
export function parseMetaSignedRequest(
  signedRequest: string,
  appSecret: string,
): { user_id?: string; algorithm?: string } | null {
  if (!signedRequest || !appSecret) {
    return null;
  }

  const parts = signedRequest.split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    return null;
  }

  const [encodedSig, encodedPayload] = parts;
  let signature: Buffer;
  try {
    signature = decodeBase64Url(encodedSig);
  } catch {
    return null;
  }

  const expected = crypto.createHmac("sha256", appSecret).update(encodedPayload).digest();
  if (signature.length !== expected.length || !crypto.timingSafeEqual(signature, expected)) {
    return null;
  }

  try {
    const json = decodeBase64Url(encodedPayload).toString("utf8");
    const data = JSON.parse(json) as { user_id?: string; algorithm?: string };
    if (data.algorithm && data.algorithm !== "HMAC-SHA256") {
      return null;
    }
    if (typeof data.user_id !== "string" || data.user_id.length === 0) {
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

function decodeBase64Url(value: string): Buffer {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const pad = (4 - (padded.length % 4)) % 4;
  return Buffer.from(`${padded}${"=".repeat(pad)}`, "base64");
}

export function createMetaSignedRequestForTests(
  payload: object,
  appSecret: string,
): string {
  const encodedPayload = Buffer.from(JSON.stringify(payload), "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
  const sig = crypto
    .createHmac("sha256", appSecret)
    .update(encodedPayload)
    .digest("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
  return `${sig}.${encodedPayload}`;
}
