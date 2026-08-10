import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseFeatureFlags, shouldShowCampaignsNav } from "./features";

describe("parseFeatureFlags", () => {
  it("defaults to smartCampaigns false for invalid payloads", () => {
    assert.deepEqual(parseFeatureFlags(null), { smartCampaigns: false });
    assert.deepEqual(parseFeatureFlags(undefined), { smartCampaigns: false });
    assert.deepEqual(parseFeatureFlags("x"), { smartCampaigns: false });
  });

  it("parses smartCampaigns true only for strict true", () => {
    assert.deepEqual(parseFeatureFlags({ smartCampaigns: true }), {
      smartCampaigns: true,
    });
    assert.deepEqual(parseFeatureFlags({ smartCampaigns: false }), {
      smartCampaigns: false,
    });
    assert.deepEqual(parseFeatureFlags({ smartCampaigns: "true" }), {
      smartCampaigns: false,
    });
  });
});

describe("shouldShowCampaignsNav", () => {
  it("hides campaigns when flag false", () => {
    assert.equal(shouldShowCampaignsNav({ smartCampaigns: false }), false);
  });

  it("shows campaigns when flag true", () => {
    assert.equal(shouldShowCampaignsNav({ smartCampaigns: true }), true);
  });
});
