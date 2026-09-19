import { describe, expect, it } from "vitest";
import { buildPasswordResetUrl } from "./resetUrl";

describe("buildPasswordResetUrl", () => {
  it("uses configured FRONTEND_URL and a fixed path", () => {
    expect(buildPasswordResetUrl("https://app.example.test", "tok_abc12345")).toBe(
      "https://app.example.test/reset-password?token=tok_abc12345",
    );
  });

  it("strips trailing slash, hash, and extra query params from FRONTEND_URL", () => {
    expect(
      buildPasswordResetUrl("https://app.example.test/dashboard?next=https://evil.test#x", "tok_abc12345"),
    ).toBe("https://app.example.test/reset-password?token=tok_abc12345");
  });

  it("rejects non-http FRONTEND_URL values", () => {
    expect(() => buildPasswordResetUrl("javascript:alert(1)", "tok_abc12345")).toThrow(/http/i);
  });
});
