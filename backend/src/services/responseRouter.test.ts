import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

const { mockExecute } = vi.hoisted(() => ({
  mockExecute: vi.fn(),
}));

vi.mock("./standardDmResponse.service", async () => {
  const actual = await vi.importActual<typeof import("./standardDmResponse.service")>(
    "./standardDmResponse.service",
  );
  return {
    ...actual,
    standardDmResponseService: {
      execute: mockExecute,
    },
  };
});

import { isSmartCampaignsEnabled } from "../config/smartCampaigns";
import { responseRouter } from "./responseRouter";

const baseParams = {
  account: {
    id: "acct-1",
    userId: "user-1",
    instagramUserId: "ig-1",
    accessTokenEncrypted: "iv:tag:cipher",
  },
  matchedRule: {
    id: "rule-1",
    keyword: "PRICE",
    dmMessage: "Thanks!",
  },
  comment: {
    instagramAccountId: "ig-1",
    commentId: "c-1",
    text: "PRICE please",
  },
  claim: {
    dmEventId: "dm-1",
    attemptCount: 1,
    isRetry: false,
  },
  priorEventsCreated: 2,
};

describe("smart campaigns foundation seam", () => {
  afterEach(() => {
    delete process.env.SMART_CAMPAIGNS_ENABLED;
    vi.clearAllMocks();
  });

  it("treats missing SMART_CAMPAIGNS_ENABLED as disabled", () => {
    delete process.env.SMART_CAMPAIGNS_ENABLED;
    expect(isSmartCampaignsEnabled()).toBe(false);
  });

  it("treats SMART_CAMPAIGNS_ENABLED=false as disabled", () => {
    process.env.SMART_CAMPAIGNS_ENABLED = "false";
    expect(isSmartCampaignsEnabled()).toBe(false);
  });

  it("treats SMART_CAMPAIGNS_ENABLED=true as enabled", () => {
    process.env.SMART_CAMPAIGNS_ENABLED = "true";
    expect(isSmartCampaignsEnabled()).toBe(true);
  });

  it("flag missing → Standard DM via ResponseRouter", async () => {
    delete process.env.SMART_CAMPAIGNS_ENABLED;
    mockExecute.mockResolvedValue({
      matched: true,
      sent: true,
      failed: false,
      duplicate: false,
      eventsCreated: 3,
    });

    const result = await responseRouter.dispatch(baseParams);

    expect(mockExecute).toHaveBeenCalledTimes(1);
    expect(mockExecute).toHaveBeenCalledWith(baseParams);
    expect(result.sent).toBe(true);
  });

  it("flag false → Standard DM via ResponseRouter", async () => {
    process.env.SMART_CAMPAIGNS_ENABLED = "false";
    mockExecute.mockResolvedValue({
      matched: true,
      sent: true,
      failed: false,
      duplicate: false,
      eventsCreated: 3,
    });

    await responseRouter.dispatch(baseParams);

    expect(mockExecute).toHaveBeenCalledTimes(1);
  });

  it("flag true (foundation seam) → still Standard DM", async () => {
    process.env.SMART_CAMPAIGNS_ENABLED = "true";
    mockExecute.mockResolvedValue({
      matched: true,
      sent: true,
      failed: false,
      duplicate: false,
      eventsCreated: 3,
    });

    await responseRouter.dispatch(baseParams);

    expect(mockExecute).toHaveBeenCalledTimes(1);
    expect(mockExecute).toHaveBeenCalledWith(baseParams);
  });

  it("does not ship or import Campaign / SmartCampaign modules in this seam", () => {
    const servicesDir = path.join(__dirname);
    const forbidden = [
      "smartCampaignResponse.service.ts",
      "campaign.service.ts",
      "campaignClaim.service.ts",
      "campaignCode.service.ts",
    ];
    for (const file of forbidden) {
      expect(fs.existsSync(path.join(servicesDir, file))).toBe(false);
    }

    const routerSource = fs.readFileSync(path.join(servicesDir, "responseRouter.ts"), "utf8");
    expect(routerSource).not.toMatch(/smartCampaignResponse/i);
    expect(routerSource).not.toMatch(/from\s+["']\.\/campaign/i);
    expect(routerSource).toContain("standardDmResponseService.execute");
    expect(routerSource).toContain('from "../config/smartCampaigns"');
  });
});
