import { afterEach, describe, expect, it } from "vitest";
import { EmailDeliveryError } from "./types";
import { createEmailProvider, resetEmailProviderForTests, setEmailProviderForTests } from "./emailService";
import { DisabledEmailProvider } from "./emailProviders";
import { MemoryEmailProvider } from "./memoryProvider";

describe("emailService provider selection", () => {
  afterEach(() => {
    resetEmailProviderForTests();
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
