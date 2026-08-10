import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createResponseRouter } from "./responseRouter";
import type { StandardDmExecuteParams } from "./standardDmResponse.service";

const baseParams: StandardDmExecuteParams = {
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

const standardResult = {
  matched: true as const,
  sent: true,
  failed: false,
  duplicate: false as const,
  eventsCreated: 3,
};

describe("ResponseRouter feature-flag isolation", () => {
  afterEach(() => {
    delete process.env.SMART_CAMPAIGNS_ENABLED;
  });

  it("flag missing → Standard DM; campaign resolver never called", async () => {
    delete process.env.SMART_CAMPAIGNS_ENABLED;
    const tryResolve = vi.fn();
    const standardDmExecute = vi.fn().mockResolvedValue(standardResult);
    const router = createResponseRouter({
      campaignResolver: { tryResolve },
      standardDmExecute,
    });

    const result = await router.dispatch(baseParams);

    expect(tryResolve).not.toHaveBeenCalled();
    expect(standardDmExecute).toHaveBeenCalledTimes(1);
    expect(standardDmExecute).toHaveBeenCalledWith(baseParams);
    expect(result).toEqual(standardResult);
  });

  it("flag false → Standard DM; campaign resolver never called", async () => {
    process.env.SMART_CAMPAIGNS_ENABLED = "false";
    const tryResolve = vi.fn();
    const standardDmExecute = vi.fn().mockResolvedValue(standardResult);
    const router = createResponseRouter({
      campaignResolver: { tryResolve },
      standardDmExecute,
    });

    await router.dispatch(baseParams);

    expect(tryResolve).not.toHaveBeenCalled();
    expect(standardDmExecute).toHaveBeenCalledTimes(1);
  });

  it("invalid flag → Standard DM; campaign resolver never called", async () => {
    process.env.SMART_CAMPAIGNS_ENABLED = "yes";
    const tryResolve = vi.fn();
    const standardDmExecute = vi.fn().mockResolvedValue(standardResult);
    const router = createResponseRouter({
      campaignResolver: { tryResolve },
      standardDmExecute,
    });

    await router.dispatch(baseParams);

    expect(tryResolve).not.toHaveBeenCalled();
    expect(standardDmExecute).toHaveBeenCalledTimes(1);
  });

  it("flag true (this milestone) → still Standard DM when resolver returns null", async () => {
    process.env.SMART_CAMPAIGNS_ENABLED = "true";
    const tryResolve = vi.fn().mockResolvedValue(null);
    const standardDmExecute = vi.fn().mockResolvedValue(standardResult);
    const router = createResponseRouter({
      campaignResolver: { tryResolve },
      standardDmExecute,
    });

    const result = await router.dispatch(baseParams);

    expect(tryResolve).toHaveBeenCalledTimes(1);
    expect(standardDmExecute).toHaveBeenCalledTimes(1);
    expect(result).toEqual(standardResult);
  });

  it("default webhook router has no campaign module imports", () => {
    const servicesDir = path.join(__dirname);
    for (const file of [
      "smartCampaignResponse.service.ts",
      "campaign.service.ts",
      "campaignClaim.service.ts",
      "campaignCode.service.ts",
    ]) {
      expect(fs.existsSync(path.join(servicesDir, file))).toBe(false);
    }

    const routerSource = fs.readFileSync(path.join(servicesDir, "responseRouter.ts"), "utf8");
    expect(routerSource).not.toMatch(/from\s+["']\.\/campaign/i);
    expect(routerSource).not.toMatch(/smartCampaignResponse/i);
    expect(routerSource).toContain("standardDmResponseService.execute");
  });
});
