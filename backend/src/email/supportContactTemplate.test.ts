import { describe, expect, it } from "vitest";
import { buildSupportContactEmail } from "./supportContactTemplate";

describe("support contact email content", () => {
  const content = buildSupportContactEmail({
    name: "Ada",
    email: "ada@example.com",
    subject: "Help with rules",
    message: "How do keywords work?",
    receivedAt: new Date("2026-08-17T12:00:00.000Z"),
  });

  it("includes sender, subject, message, timestamp, and Comment2DM context", () => {
    expect(content.subject).toBe("[Comment2DM support] Help with rules");
    expect(content.text).toContain("Ada");
    expect(content.text).toContain("ada@example.com");
    expect(content.text).toContain("How do keywords work?");
    expect(content.text).toContain("2026-08-17T12:00:00.000Z");
    expect(content.text).toContain("Comment2DM support request");
    expect(content.html).not.toMatch(/re_|Bearer |JWT_SECRET/);
  });
});
