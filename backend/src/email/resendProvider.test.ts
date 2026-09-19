import { describe, expect, it, vi } from "vitest";
import { EmailDeliveryError } from "./types";
import { ResendEmailProvider } from "./resendProvider";

describe("ResendEmailProvider", () => {
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
