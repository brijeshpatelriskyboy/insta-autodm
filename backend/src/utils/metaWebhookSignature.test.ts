import { describe, expect, it } from "vitest";
import {
  computeMetaWebhookSignature,
  verifyMetaWebhookSignature,
} from "./metaWebhookSignature";

const APP_SECRET = "test-instagram-app-secret";
const PAYLOAD = Buffer.from(
  JSON.stringify({
    object: "instagram",
    entry: [{ id: "17841400000000000", time: 1, changes: [] }],
  }),
  "utf8",
);

function signedHeader(rawBody: Buffer, secret = APP_SECRET): string {
  return `sha256=${computeMetaWebhookSignature(rawBody, secret)}`;
}

describe("verifyMetaWebhookSignature", () => {
  it("accepts a valid X-Hub-Signature-256 for the exact raw body", () => {
    const header = signedHeader(PAYLOAD);
    expect(verifyMetaWebhookSignature(PAYLOAD, header, APP_SECRET)).toBe(true);
  });

  it("rejects an invalid signature", () => {
    const header = `sha256=${"ab".repeat(32)}`;
    expect(verifyMetaWebhookSignature(PAYLOAD, header, APP_SECRET)).toBe(false);
  });

  it("rejects a missing signature", () => {
    expect(verifyMetaWebhookSignature(PAYLOAD, undefined, APP_SECRET)).toBe(false);
    expect(verifyMetaWebhookSignature(PAYLOAD, "", APP_SECRET)).toBe(false);
  });

  it("rejects a malformed signature", () => {
    expect(verifyMetaWebhookSignature(PAYLOAD, "sha1=deadbeef", APP_SECRET)).toBe(false);
    expect(verifyMetaWebhookSignature(PAYLOAD, "sha256=", APP_SECRET)).toBe(false);
    expect(verifyMetaWebhookSignature(PAYLOAD, "sha256=not-hex", APP_SECRET)).toBe(false);
    expect(verifyMetaWebhookSignature(PAYLOAD, "sha256=abcd", APP_SECRET)).toBe(false);
    expect(
      verifyMetaWebhookSignature(PAYLOAD, `sha256=${"gg".repeat(32)}`, APP_SECRET),
    ).toBe(false);
  });

  it("rejects when the raw body was altered after signing", () => {
    const header = signedHeader(PAYLOAD);
    const tampered = Buffer.from(PAYLOAD.toString("utf8").replace("instagram", "facebook"));
    expect(verifyMetaWebhookSignature(tampered, header, APP_SECRET)).toBe(false);
  });
});
