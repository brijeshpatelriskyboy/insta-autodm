import { afterEach, describe, expect, it } from "vitest";
import {
  getFeatureFlags,
  isSmartCampaignsEnabled,
} from "./smartCampaigns";

describe("SMART_CAMPAIGNS_ENABLED", () => {
  afterEach(() => {
    delete process.env.SMART_CAMPAIGNS_ENABLED;
  });

  it("missing → false", () => {
    delete process.env.SMART_CAMPAIGNS_ENABLED;
    expect(isSmartCampaignsEnabled()).toBe(false);
    expect(isSmartCampaignsEnabled(undefined)).toBe(false);
  });

  it('"false" → false', () => {
    expect(isSmartCampaignsEnabled("false")).toBe(false);
  });

  it('"true" → true', () => {
    expect(isSmartCampaignsEnabled("true")).toBe(true);
  });

  it("invalid string → false", () => {
    expect(isSmartCampaignsEnabled("TRUE")).toBe(false);
    expect(isSmartCampaignsEnabled("1")).toBe(false);
    expect(isSmartCampaignsEnabled("yes")).toBe(false);
    expect(isSmartCampaignsEnabled("")).toBe(false);
  });

  it("getFeatureFlags mirrors smartCampaigns only", () => {
    delete process.env.SMART_CAMPAIGNS_ENABLED;
    expect(getFeatureFlags()).toEqual({ smartCampaigns: false });

    process.env.SMART_CAMPAIGNS_ENABLED = "true";
    expect(getFeatureFlags()).toEqual({ smartCampaigns: true });
    expect(Object.keys(getFeatureFlags())).toEqual(["smartCampaigns"]);
  });
});
