import { describe, expect, it } from "vitest";
import {
  CAMPAIGN_DM_MAX_LENGTH,
  renderCampaignMessage,
} from "./campaignMessageRenderer";

describe("renderCampaignMessage", () => {
  it("replaces all {{code}} occurrences exactly", () => {
    const result = renderCampaignMessage(
      "Hi! Code {{code}} again {{code}}",
      { code: "SUNDAY-X8K4" },
      { requireCode: true },
    );
    expect(result).toEqual({
      ok: true,
      message: "Hi! Code SUNDAY-X8K4 again SUNDAY-X8K4",
    });
  });

  it("preserves ordinary text and emojis", () => {
    const result = renderCampaignMessage("🎉 Your code is {{code}} — enjoy!", {
      code: "A-1",
    });
    expect(result.ok && result.message).toBe("🎉 Your code is A-1 — enjoy!");
  });

  it("fails safely when requireCode and placeholder missing", () => {
    expect(
      renderCampaignMessage("Thanks!", { code: "X" }, { requireCode: true }),
    ).toEqual({ ok: false, reason: "missing_code_placeholder" });
  });

  it("fails safely when requireCode and code value missing", () => {
    expect(
      renderCampaignMessage("Code {{code}}", { code: null }, { requireCode: true }),
    ).toEqual({ ok: false, reason: "missing_code_value" });
  });

  it("allows non-code messages without placeholder", () => {
    expect(renderCampaignMessage("Sold out", {})).toEqual({
      ok: true,
      message: "Sold out",
    });
  });

  it("rejects messages over max length", () => {
    const long = `${"x".repeat(CAMPAIGN_DM_MAX_LENGTH)}{{code}}`;
    expect(
      renderCampaignMessage(long, { code: "Y" }, { requireCode: true }),
    ).toEqual({ ok: false, reason: "message_too_long" });
  });
});
