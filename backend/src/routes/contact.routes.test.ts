import http from "http";
import type { AddressInfo } from "net";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CONTACT_RATE_LIMIT } from "../config/contact";
import { CONTACT_UNAVAILABLE_MESSAGE } from "../services/contact.service";
import {
  getMemoryEmailProvider,
  resetEmailProviderForTests,
  setEmailProviderForTests,
} from "../email/emailService";
import { EmailDeliveryError } from "../email/types";
import { resetAuthRateLimitForTests } from "../middleware/authRateLimit";
import { createApp } from "../app";

async function withServer(run: (baseUrl: string) => Promise<void>): Promise<void> {
  const app = createApp();
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  try {
    await run(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((err) => (err ? reject(err) : resolve())),
    );
  }
}

const validBody = {
  name: "Ada Lovelace",
  email: "ada@example.com",
  subject: "Keyword rule question",
  message: "How do I scope a rule to one post?",
};

describe("POST /api/contact", () => {
  const previousSupport = process.env.SUPPORT_EMAIL;

  beforeEach(() => {
    resetAuthRateLimitForTests();
    resetEmailProviderForTests();
    process.env.SUPPORT_EMAIL = "support@comment2dm.test";
  });

  afterEach(() => {
    resetAuthRateLimitForTests();
    resetEmailProviderForTests();
    if (previousSupport === undefined) {
      delete process.env.SUPPORT_EMAIL;
    } else {
      process.env.SUPPORT_EMAIL = previousSupport;
    }
  });

  it("sends a valid message once with Reply-To set to the user email", async () => {
    await withServer(async (baseUrl) => {
      const res = await fetch(`${baseUrl}/api/contact`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validBody),
      });
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ sent: true });
      const sent = getMemoryEmailProvider().sent;
      expect(sent).toHaveLength(1);
      expect(sent[0]?.kind).toBe("support_contact");
      expect(sent[0]?.to).toBe("support@comment2dm.test");
      expect(sent[0]?.replyTo).toBe("ada@example.com");
      expect(sent[0]?.subject).toMatch(/Comment2DM support/);
      expect(sent[0]?.text).toContain("Ada Lovelace");
      expect(sent[0]?.text).toContain(validBody.message);
      expect(JSON.stringify(sent[0])).not.toMatch(/re_|Bearer /);
    });
  });

  it("rejects an invalid email and empty or oversized fields", async () => {
    await withServer(async (baseUrl) => {
      const invalidEmail = await fetch(`${baseUrl}/api/contact`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...validBody, email: "not-an-email" }),
      });
      expect(invalidEmail.status).toBe(400);

      const empty = await fetch(`${baseUrl}/api/contact`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...validBody, message: "" }),
      });
      expect(empty.status).toBe(400);

      const oversized = await fetch(`${baseUrl}/api/contact`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...validBody, message: "x".repeat(5001) }),
      });
      expect(oversized.status).toBe(400);
      expect(getMemoryEmailProvider().sent).toHaveLength(0);
    });
  });

  it("rejects header injection and does not send mail", async () => {
    await withServer(async (baseUrl) => {
      const res = await fetch(`${baseUrl}/api/contact`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...validBody,
          subject: "Help\r\nBcc: evil@example.com",
        }),
      });
      expect(res.status).toBe(400);
      expect(getMemoryEmailProvider().sent).toHaveLength(0);
    });
  });

  it("returns 429 after the contact rate limit", async () => {
    await withServer(async (baseUrl) => {
      for (let i = 0; i < CONTACT_RATE_LIMIT.max; i += 1) {
        const res = await fetch(`${baseUrl}/api/contact`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(validBody),
        });
        expect(res.status).toBe(200);
      }
      const limited = await fetch(`${baseUrl}/api/contact`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validBody),
      });
      expect(limited.status).toBe(429);
      const body = await limited.json();
      expect(body.error).toMatch(/too many attempts/i);
      expect(getMemoryEmailProvider().sent).toHaveLength(CONTACT_RATE_LIMIT.max);
    });
  });

  it("does not report success when the provider fails", async () => {
    setEmailProviderForTests({
      name: "failing",
      send: async () => {
        throw new EmailDeliveryError("provider_failed", 500);
      },
    });
    await withServer(async (baseUrl) => {
      const res = await fetch(`${baseUrl}/api/contact`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validBody),
      });
      expect(res.status).toBe(503);
      const body = await res.json();
      expect(body.error).toBe(CONTACT_UNAVAILABLE_MESSAGE);
      expect(JSON.stringify(body)).not.toContain("provider_failed");
    });
  });

  it("fails safely when SUPPORT_EMAIL is missing", async () => {
    delete process.env.SUPPORT_EMAIL;
    await withServer(async (baseUrl) => {
      const res = await fetch(`${baseUrl}/api/contact`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validBody),
      });
      expect(res.status).toBe(503);
      expect(await res.json()).toEqual({ error: CONTACT_UNAVAILABLE_MESSAGE });
      expect(getMemoryEmailProvider().sent).toHaveLength(0);
    });
  });
});
