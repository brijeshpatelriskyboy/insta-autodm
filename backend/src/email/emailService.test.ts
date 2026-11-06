import { afterEach, describe, expect, it, vi } from "vitest";
import { EmailDeliveryError } from "./types";
import { createEmailProvider, resetEmailProviderForTests, setEmailProviderForTests } from "./emailService";
import { DisabledEmailProvider } from "./emailProviders";
import { MemoryEmailProvider } from "./memoryProvider";

describe("emailService provider selection", () => {
  afterEach(() => {
    resetEmailProviderForTests();
    vi.unstubAllGlobals();
  });

  it("wires the SHC sender override from server configuration without changing the default sender", async () => {
    const fetchImpl = vi.fn(async () => new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchImpl);
    const provider = createEmailProvider({
      NODE_ENV: "production", RESEND_API_KEY: "re_test_placeholder",
      FRONTEND_URL: "https://app.example.test", EMAIL_FROM: "Comment2DM <noreply@example.test>",
      SHC_EMAIL_FROM_ADDRESS: "admin@shc.example.test",
      SHC_RESEND_API_KEY: "re_shc_scoped_test",
    });
    const message = { kind: "security_notification" as const, to: "student@example.test", subject: "Saved", text: "Saved", html: "<p>Saved</p>" };
    await provider.send({ ...message, brand: "student_help_centre" });
    await provider.send(message);
    const calls = fetchImpl.mock.calls as unknown as Array<[string, RequestInit]>;
    expect((calls[0][1].headers as Record<string, string>).Authorization).toBe("Bearer re_shc_scoped_test");
    expect((calls[1][1].headers as Record<string, string>).Authorization).toBe("Bearer re_test_placeholder");
    expect(JSON.parse(String(calls[0][1].body)).from).toBe("Student Help Centre <admin@shc.example.test>");
    expect(JSON.parse(String(calls[1][1].body)).from).toBe("Comment2DM <noreply@example.test>");
  });

  it("uses the in-memory provider during tests", () => {
    expect(createEmailProvider({ NODE_ENV: "test" })).toBeInstanceOf(MemoryEmailProvider);
  });

  it("uses the disabled provider when production email config is missing", () => {
    resetEmailProviderForTests();
    const provider = createEmailProvider({
      NODE_ENV: "production",
      FRONTEND_URL: "https://app.example.test",
    });
    expect(provider).toBeInstanceOf(DisabledEmailProvider);
  });

  it("test override can simulate provider failure without leaking details", async () => {
    setEmailProviderForTests({
      name: "failing",
      send: async () => {
        throw new EmailDeliveryError("provider_failed", 500);
      },
    });
    await expect(
      createEmailProvider().send({
        kind: "password_reset",
        to: "ada@example.com",
        subject: "Reset",
        html: "x",
        text: "x",
      }),
    ).rejects.toMatchObject({ message: "Email delivery failed", httpStatus: 500 });
  });
});
