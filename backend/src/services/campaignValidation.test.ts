import { describe, expect, it } from "vitest";
import {
  assertCampaignInvariants,
  validateCampaignInvariants,
} from "./campaignValidation";

describe("campaignValidation", () => {
  const base = {
    maxClaims: 10,
    claimedCount: 0,
    startsAt: new Date("2026-01-01T00:00:00.000Z"),
    endsAt: new Date("2026-12-31T00:00:00.000Z"),
    dmTemplate: "Your code is {{code}}",
  };

  it("accepts a valid code campaign", () => {
    expect(validateCampaignInvariants(base)).toEqual([]);
    expect(() => assertCampaignInvariants(base)).not.toThrow();
  });

  it("requires maxClaims > 0", () => {
    expect(validateCampaignInvariants({ ...base, maxClaims: 0 })).toContain(
      "maxClaims_must_be_positive",
    );
  });

  it("requires claimedCount >= 0 and claimedCount <= maxClaims", () => {
    expect(validateCampaignInvariants({ ...base, claimedCount: -1 })).toContain(
      "claimedCount_must_be_non_negative",
    );
    expect(validateCampaignInvariants({ ...base, claimedCount: 11 })).toContain(
      "claimedCount_exceeds_maxClaims",
    );
  });

  it("requires startsAt < endsAt", () => {
    expect(
      validateCampaignInvariants({
        ...base,
        startsAt: new Date("2026-06-01T00:00:00.000Z"),
        endsAt: new Date("2026-06-01T00:00:00.000Z"),
      }),
    ).toContain("startsAt_must_precede_endsAt");
  });

  it("requires {{code}} in dmTemplate for code campaigns", () => {
    expect(
      validateCampaignInvariants({ ...base, dmTemplate: "Thanks for claiming!" }),
    ).toContain("dmTemplate_missing_code_placeholder");
  });

  it("rejects maxClaims above the safe cap", () => {
    expect(
      validateCampaignInvariants({ ...base, maxClaims: 10_001 }),
    ).toContain("maxClaims_exceeds_cap");
  });

  it("can skip code placeholder when requiresCodePlaceholder is false", () => {
    expect(
      validateCampaignInvariants({
        ...base,
        dmTemplate: "Thanks!",
        requiresCodePlaceholder: false,
      }),
    ).toEqual([]);
  });
});
