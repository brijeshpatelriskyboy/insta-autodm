import { describe, expect, it, vi } from "vitest";
import { EmailDeliveryError } from "./types";
import { ResendEmailProvider } from "./resendProvider";

describe("ResendEmailProvider", () => {

  it("uses the configured SHC address only for SHC and preserves message content and Reply-To", async () => {
    const bodies: Array<Record<string, unknown>> = [];
    const fetchImpl = vi.fn(async (_url: unknown, init: RequestInit) => {
      bodies.push(JSON.parse(String(init.body)));
      return new Response("{}", { status: 200 });
    }) as unknown as typeof fetch;
    const provider = new ResendEmailProvider(
      "re_test_placeholder", "Comment2DM <noreply@example.test>", fetchImpl, "admin@shc.example.test",
    );
    const message = {
      kind: "security_notification" as const, to: "student@example.test",
      subject: "Enquiry #1000", text: "Your enquiry was saved.", html: "<p>Saved</p>",
      replyTo: "support@example.test",
    };
    await provider.send({ ...message, brand: "student_help_centre" });
    await provider.send(message);
    await provider.send({ ...message, kind: "password_reset" });
    expect(bodies[0]).toEqual({
      from: "Student Help Centre <admin@shc.example.test>", to: [message.to],
      subject: message.subject, text: message.text, html: message.html, reply_to: message.replyTo,
    });
    expect(bodies[1].from).toBe("Comment2DM <noreply@example.test>");
    expect(bodies[2].from).toBe("Comment2DM <noreply@example.test>");
  });

  it.each(["", "   "])("keeps the working sender when SHC address is blank", async (address) => {
    const fetchImpl = vi.fn(async () => new Response("{}", { status: 200 })) as unknown as typeof fetch;
    const provider = new ResendEmailProvider("re_test_placeholder", "noreply@example.test", fetchImpl, address);
    await provider.send({ kind: "security_notification", brand: "student_help_centre", to: "student@example.test", subject: "Enquiry", html: "x", text: "x" });
    const init = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0][1] as RequestInit;
    expect(JSON.parse(String(init.body)).from).toBe("Student Help Centre <noreply@example.test>");
  });

  it.each(["admin@example.test\r\nBcc: other@example.test", "not-an-address", "one@example.test,two@example.test", "Other <admin@example.test>"])(
    "rejects an invalid SHC override without affecting Comment2DM",
    async (address) => {
      const fetchImpl = vi.fn(async () => new Response("{}", { status: 200 })) as unknown as typeof fetch;
      const provider = new ResendEmailProvider("re_test_placeholder", "noreply@example.test", fetchImpl, address);
      await expect(provider.send({ kind: "security_notification", brand: "student_help_centre", to: "student@example.test", subject: "Enquiry", html: "x", text: "x" }))
        .rejects.toMatchObject({ code: "invalid_config" });
      expect(fetchImpl).not.toHaveBeenCalled();
      await provider.send({ kind: "password_reset", to: "student@example.test", subject: "Reset", html: "x", text: "x" });
      expect(fetchImpl).toHaveBeenCalledTimes(1);
    },
  );

  it.each(["Comment2DM <noreply@example.test>", "noreply@example.test"])(
    "uses SHC branding without changing the verified address for %s",
    async (configuredFrom) => {
      const bodies: Array<Record<string, unknown>> = [];
      const fetchImpl = vi.fn(async (_url: unknown, init: RequestInit) => {
        bodies.push(JSON.parse(String(init.body)));
        return new Response("{}", { status: 200 });
      }) as unknown as typeof fetch;
      const provider = new ResendEmailProvider("re_test_placeholder", configuredFrom, fetchImpl);
      const message = { kind: "security_notification" as const, to: "student@example.test", subject: "Enquiry saved", text: "Saved", html: "<p>Saved</p>" };
      await provider.send({ ...message, brand: "student_help_centre" });
      await provider.send(message);
      await provider.send({ ...message, kind: "password_reset" });
      expect(bodies[0].from).toBe("Student Help Centre <noreply@example.test>");
      expect(bodies[0].to).toEqual(["student@example.test"]);
      expect(bodies[1].from).toBe(configuredFrom);
      expect(bodies[2].from).toBe(configuredFrom);
      expect(bodies[0]).not.toHaveProperty("brand");
    },
  );

  it.each(["Comment2DM <sender@example.test>\r\nBcc: other@example.test", "not-an-address", "one@example.test,two@example.test"])(
    "rejects malformed SHC sender configuration before contacting the provider",
    async (configuredFrom) => {
      const fetchImpl = vi.fn() as unknown as typeof fetch;
      const provider = new ResendEmailProvider("re_test_placeholder", configuredFrom, fetchImpl);
      await expect(provider.send({ kind: "security_notification", brand: "student_help_centre", to: "student@example.test", subject: "Enquiry", html: "x", text: "x" }))
        .rejects.toMatchObject({ code: "invalid_config" });
      expect(fetchImpl).not.toHaveBeenCalled();
    },
  );

  it("POSTs to Resend with from/to/subject and does not put secrets in thrown errors", async () => {
    const fetchImpl = vi.fn(async () => new Response("{}", { status: 200 })) as unknown as typeof fetch;
    const provider = new ResendEmailProvider(
      "re_test_placeholder",
      "Comment2DM <noreply@example.test>",
      fetchImpl,
    );

    await provider.send({
      kind: "password_reset",
      to: "ada@example.com",
      subject: "Reset your Comment2DM password",
      html: "<p>https://app.example.test/reset-password?token=tok_secret</p>",
      text: "https://app.example.test/reset-password?token=tok_secret",
    });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe("https://api.resend.com/emails");
    const headers = (init as RequestInit).headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer re_test_placeholder");
    const body = JSON.parse(String((init as RequestInit).body));
    expect(body.from).toBe("Comment2DM <noreply@example.test>");
    expect(body.to).toEqual(["ada@example.com"]);
  });

  it("maps provider HTTP failures without leaking the response body", async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            message: "echo https://app.example.test/reset-password?token=tok_secret",
          }),
          { status: 403 },
        ),
    ) as unknown as typeof fetch;
    const provider = new ResendEmailProvider("re_test_placeholder", "noreply@example.test", fetchImpl);

    await expect(
      provider.send({
        kind: "password_reset",
        to: "ada@example.com",
        subject: "Reset",
        html: "x",
        text: "x",
      }),
    ).rejects.toMatchObject({
      name: "EmailDeliveryError",
      code: "provider_failed",
      httpStatus: 403,
      message: "Email delivery failed",
    });

    try {
      await provider.send({
        kind: "password_reset",
        to: "ada@example.com",
        subject: "Reset",
        html: "x",
        text: "x",
      });
    } catch (error) {
      expect(error).toBeInstanceOf(EmailDeliveryError);
      expect(JSON.stringify(error)).not.toContain("tok_secret");
      expect(JSON.stringify(error)).not.toContain("re_test_placeholder");
    }
  });
});


describe("domain-scoped SHC credentials", () => {
  it("uses the SHC key only for SHC messages and preserves the existing key for other mail", async () => {
    const fetchImpl = vi.fn(async () => new Response("{}", { status: 200 }));
    const provider = new ResendEmailProvider("re_original", "Comment2DM <noreply@example.test>", fetchImpl as typeof fetch, "admin@shc.example.test", "re_shc_only");
    const message = { kind: "security_notification" as const, to: "test@example.test", subject: "Test", text: "Test", html: "<p>Test</p>" };
    await provider.send({ ...message, brand: "student_help_centre" });
    await provider.send(message);
    const calls = fetchImpl.mock.calls as unknown as Array<[string, RequestInit]>;
    expect((calls[0][1].headers as Record<string,string>).Authorization).toBe("Bearer re_shc_only");
    expect((calls[1][1].headers as Record<string,string>).Authorization).toBe("Bearer re_original");
  });
});
