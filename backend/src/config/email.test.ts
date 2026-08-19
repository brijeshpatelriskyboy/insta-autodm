import { describe, expect, it } from "vitest";
import {
  emailDeliveryStatusForLogs,
  isContactDeliveryConfigured,
  isEmailDeliveryConfigured,
  isSupportEmailConfigured,
  readEmailRuntimeConfig,
} from "./email";

describe("email delivery config", () => {
  it("is not configured without Resend key and From address", () => {
    expect(
      isEmailDeliveryConfigured({
        NODE_ENV: "production",
        FRONTEND_URL: "https://app.example.test",
      }),
    ).toBe(false);
  });

  it("is configured when key, from, and https frontend URL are present", () => {
    expect(
      isEmailDeliveryConfigured({
        NODE_ENV: "production",
        RESEND_API_KEY: "re_test_placeholder",
        EMAIL_FROM: "Comment2DM <noreply@example.test>",
        FRONTEND_URL: "https://app.example.test",
      }),
    ).toBe(true);
  });

  it("fails safely in production when FRONTEND_URL is localhost", () => {
    expect(
      isEmailDeliveryConfigured({
        NODE_ENV: "production",
        RESEND_API_KEY: "re_test_placeholder",
        EMAIL_FROM: "noreply@example.test",
        FRONTEND_URL: "http://localhost:3000",
      }),
    ).toBe(false);
  });

  it("does not expose the API key in runtime config consumers that log status fields", () => {
    const config = readEmailRuntimeConfig({
      RESEND_API_KEY: "re_test_placeholder",
      EMAIL_FROM: "noreply@example.test",
      FRONTEND_URL: "https://app.example.test/",
    });
    expect(config.frontendUrl).toBe("https://app.example.test");
    expect(JSON.stringify({ hasKey: Boolean(config.resendApiKey) })).not.toContain("re_test");
  });

  it("treats SUPPORT_EMAIL as a boolean for logs and contact readiness", () => {
    expect(isSupportEmailConfigured({})).toBe(false);
    expect(
      isSupportEmailConfigured({ SUPPORT_EMAIL: "support@comment2dm.test" }),
    ).toBe(true);
    expect(
      isContactDeliveryConfigured({
        NODE_ENV: "test",
        SUPPORT_EMAIL: "support@comment2dm.test",
      }),
    ).toBe(true);
    expect(
      isContactDeliveryConfigured({
        NODE_ENV: "production",
        SUPPORT_EMAIL: "support@comment2dm.test",
        FRONTEND_URL: "https://app.example.test",
      }),
    ).toBe(false);
    const status = emailDeliveryStatusForLogs({
      SUPPORT_EMAIL: "support@comment2dm.test",
    });
    expect(status.hasSupportEmail).toBe(true);
    expect(JSON.stringify(status)).not.toContain("support@comment2dm.test");
  });
});
