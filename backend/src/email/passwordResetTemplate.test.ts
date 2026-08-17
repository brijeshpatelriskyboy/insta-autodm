import { describe, expect, it } from "vitest";
import { buildPasswordResetEmail } from "./passwordResetTemplate";

describe("password reset email content", () => {
  const content = buildPasswordResetEmail({
    resetUrl: "https://app.example.test/reset-password?token=tok_abc12345",
    expiresMinutes: 45,
  });

  it("includes Comment2DM branding, a reset link, and 45-minute expiry", () => {
    expect(content.subject).toBe("Reset your Comment2DM password");
    expect(content.text).toMatch(/Comment2DM password reset/);
    expect(content.text).toMatch(/expires in 45 minutes/);
    expect(content.text).toContain("https://app.example.test/reset-password?token=tok_abc12345");
    expect(content.text).toMatch(/ignore this email/i);
    expect(content.html).toMatch(/Reset password/);
    expect(content.html).toContain("https://app.example.test/reset-password?token=tok_abc12345");
  });

  it("does not include unsupported marketing claims", () => {
    const blob = `${content.subject}\n${content.text}\n${content.html}`;
    expect(blob).not.toMatch(/#1|guaranteed|unlimited followers|instant growth/i);
  });
});
