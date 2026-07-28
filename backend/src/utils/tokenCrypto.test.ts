import { describe, expect, it, beforeAll } from "vitest";
import { decryptToken, encryptToken } from "../utils/tokenCrypto";

describe("tokenCrypto", () => {
  beforeAll(() => {
    process.env.JWT_SECRET = "test-secret-min-16chars-crypto";
    process.env.DATABASE_URL =
      process.env.DATABASE_URL ?? "postgresql://u:p@localhost:5432/db";
  });

  it("round-trips with the same AES-256-GCM iv:tag:ciphertext format", () => {
    const encrypted = encryptToken("instagram-user-access-token");
    expect(encrypted.split(":")).toHaveLength(3);
    expect(decryptToken(encrypted)).toBe("instagram-user-access-token");
  });

  it("throws on invalid payload format", () => {
    expect(() => decryptToken("not-valid")).toThrow(/Invalid encrypted token format/);
  });
});
