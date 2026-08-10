import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { validateCampaignCreateForm } from "./campaignForm";

const base = {
  name: "Sunday Sale",
  keywordRuleId: "rule-1",
  startsAt: "2026-01-01T00:00",
  endsAt: "2026-12-31T00:00",
  maxClaims: 50,
  dmTemplate: "Your code is {{code}}",
  soldOutMessage: "Sold out",
  alreadyClaimedMessage: "Already {{code}}",
  prefix: "SUNDAY",
};

describe("validateCampaignCreateForm", () => {
  it("accepts a valid form", () => {
    assert.equal(validateCampaignCreateForm(base), null);
  });

  it("requires {{code}} and positive quantity under cap", () => {
    assert.match(
      validateCampaignCreateForm({ ...base, dmTemplate: "Thanks" }) ?? "",
      /\{\{code\}\}/,
    );
    assert.match(
      validateCampaignCreateForm({ ...base, maxClaims: 0 }) ?? "",
      /greater than 0/,
    );
    assert.match(
      validateCampaignCreateForm({ ...base, maxClaims: 10_001 }) ?? "",
      /cannot exceed/,
    );
  });
});
