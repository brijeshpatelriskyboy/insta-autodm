import { afterEach, describe, expect, it, vi } from "vitest";
import type { Campaign } from "@prisma/client";
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

const smartResult = {
  matched: true as const,
  sent: true,
  failed: false,
  duplicate: false as const,
  eventsCreated: 3,
  campaignOutcome: "ALLOCATED" as const,
};

const sampleCampaign = {
  id: "camp-1",
  userId: "user-1",
  keywordRuleId: "rule-1",
  name: "Sale",
  status: "ACTIVE",
} as Campaign;

vi.mock("../lib/prisma", () => ({
  prisma: {
    dmEvent: { update: vi.fn().mockResolvedValue({}) },
  },
}));

vi.mock("./activity.service", () => ({
  activityService: {
    log: vi.fn().mockResolvedValue({}),
  },
}));

describe("ResponseRouter campaign bridge", () => {
  afterEach(() => {
    delete process.env.SMART_CAMPAIGNS_ENABLED;
    vi.clearAllMocks();
  });

  it("1. flag missing → zero campaign lookup → Standard DM", async () => {
    delete process.env.SMART_CAMPAIGNS_ENABLED;
    const findCampaign = vi.fn();
    const standardDmExecute = vi.fn().mockResolvedValue(standardResult);
    const smartCampaignExecute = vi.fn();
    const router = createResponseRouter({
      findCampaign,
      standardDmExecute,
      smartCampaignExecute,
    });

    const result = await router.dispatch(baseParams);

    expect(findCampaign).not.toHaveBeenCalled();
    expect(smartCampaignExecute).not.toHaveBeenCalled();
    expect(standardDmExecute).toHaveBeenCalledTimes(1);
    expect(standardDmExecute).toHaveBeenCalledWith(baseParams);
    expect(result).toEqual(standardResult);
  });

  it("2. flag false → zero campaign lookup → Standard DM", async () => {
    process.env.SMART_CAMPAIGNS_ENABLED = "false";
    const findCampaign = vi.fn();
    const standardDmExecute = vi.fn().mockResolvedValue(standardResult);
    const router = createResponseRouter({
      findCampaign,
      standardDmExecute,
      smartCampaignExecute: vi.fn(),
    });

    await router.dispatch(baseParams);

    expect(findCampaign).not.toHaveBeenCalled();
    expect(standardDmExecute).toHaveBeenCalledTimes(1);
  });

  it("3. invalid flag → zero lookup → Standard DM", async () => {
    process.env.SMART_CAMPAIGNS_ENABLED = "yes";
    const findCampaign = vi.fn();
    const standardDmExecute = vi.fn().mockResolvedValue(standardResult);
    const router = createResponseRouter({
      findCampaign,
      standardDmExecute,
      smartCampaignExecute: vi.fn(),
    });

    await router.dispatch(baseParams);

    expect(findCampaign).not.toHaveBeenCalled();
    expect(standardDmExecute).toHaveBeenCalledTimes(1);
  });

  it("4. flag true + no campaign → Standard DM", async () => {
    process.env.SMART_CAMPAIGNS_ENABLED = "true";
    const findCampaign = vi.fn().mockResolvedValue({ status: "none" });
    const standardDmExecute = vi.fn().mockResolvedValue(standardResult);
    const smartCampaignExecute = vi.fn();
    const router = createResponseRouter({
      findCampaign,
      standardDmExecute,
      smartCampaignExecute,
    });

    const result = await router.dispatch(baseParams);

    expect(findCampaign).toHaveBeenCalledWith({
      keywordRuleId: "rule-1",
      userId: "user-1",
    });
    expect(smartCampaignExecute).not.toHaveBeenCalled();
    expect(standardDmExecute).toHaveBeenCalledWith(baseParams);
    expect(result).toEqual(standardResult);
  });

  it("5. flag true + campaign → SmartCampaignResponseService", async () => {
    process.env.SMART_CAMPAIGNS_ENABLED = "true";
    const findCampaign = vi
      .fn()
      .mockResolvedValue({ status: "found", campaign: sampleCampaign });
    const standardDmExecute = vi.fn();
    const smartCampaignExecute = vi.fn().mockResolvedValue(smartResult);
    const router = createResponseRouter({
      findCampaign,
      standardDmExecute,
      smartCampaignExecute,
    });

    const result = await router.dispatch(baseParams);

    expect(standardDmExecute).not.toHaveBeenCalled();
    expect(smartCampaignExecute).toHaveBeenCalledWith({
      account: baseParams.account,
      matchedRule: { id: "rule-1", keyword: "PRICE" },
      campaign: sampleCampaign,
      comment: baseParams.comment,
      dmClaim: baseParams.claim,
      priorEventsCreated: 2,
    });
    expect(result).toEqual(smartResult);
  });

  it("6. campaign belongs to wrong user → not dispatched (lookup scopes userId)", async () => {
    process.env.SMART_CAMPAIGNS_ENABLED = "true";
    const findCampaign = vi.fn().mockImplementation(async (args) => {
      // Simulate ownership filter: wrong user sees none
      if (args.userId !== "user-1") return { status: "none" };
      return { status: "none" };
    });
    const standardDmExecute = vi.fn().mockResolvedValue(standardResult);
    const smartCampaignExecute = vi.fn();
    const router = createResponseRouter({
      findCampaign,
      standardDmExecute,
      smartCampaignExecute,
    });

    await router.dispatch({
      ...baseParams,
      account: { ...baseParams.account, userId: "other-user" },
    });

    expect(findCampaign).toHaveBeenCalledWith({
      keywordRuleId: "rule-1",
      userId: "other-user",
    });
    expect(smartCampaignExecute).not.toHaveBeenCalled();
    expect(standardDmExecute).toHaveBeenCalled();
  });

  it("7. not-started ACTIVE campaign → Smart Campaign path", async () => {
    process.env.SMART_CAMPAIGNS_ENABLED = "true";
    const notStarted = {
      ...sampleCampaign,
      startsAt: new Date("2090-01-01T00:00:00.000Z"),
      endsAt: new Date("2091-01-01T00:00:00.000Z"),
    } as Campaign;
    const findCampaign = vi
      .fn()
      .mockResolvedValue({ status: "found", campaign: notStarted });
    const smartCampaignExecute = vi.fn().mockResolvedValue({
      ...smartResult,
      campaignOutcome: "NOT_STARTED",
    });
    const router = createResponseRouter({
      findCampaign,
      standardDmExecute: vi.fn(),
      smartCampaignExecute,
    });

    await router.dispatch(baseParams);
    expect(smartCampaignExecute).toHaveBeenCalled();
  });

  it("8. ended-by-time ACTIVE campaign → Smart Campaign path", async () => {
    process.env.SMART_CAMPAIGNS_ENABLED = "true";
    const ended = {
      ...sampleCampaign,
      startsAt: new Date("2020-01-01T00:00:00.000Z"),
      endsAt: new Date("2021-01-01T00:00:00.000Z"),
    } as Campaign;
    const findCampaign = vi.fn().mockResolvedValue({ status: "found", campaign: ended });
    const smartCampaignExecute = vi.fn().mockResolvedValue({
      ...smartResult,
      campaignOutcome: "ENDED",
    });
    const router = createResponseRouter({
      findCampaign,
      standardDmExecute: vi.fn(),
      smartCampaignExecute,
    });

    await router.dispatch(baseParams);
    expect(smartCampaignExecute).toHaveBeenCalled();
  });

  it("9. paused campaign → Smart Campaign path", async () => {
    process.env.SMART_CAMPAIGNS_ENABLED = "true";
    const paused = { ...sampleCampaign, status: "PAUSED" } as Campaign;
    const findCampaign = vi.fn().mockResolvedValue({ status: "found", campaign: paused });
    const smartCampaignExecute = vi.fn().mockResolvedValue({
      ...smartResult,
      campaignOutcome: "PAUSED",
    });
    const router = createResponseRouter({
      findCampaign,
      standardDmExecute: vi.fn(),
      smartCampaignExecute,
    });

    await router.dispatch(baseParams);

    expect(smartCampaignExecute).toHaveBeenCalledWith(
      expect.objectContaining({ campaign: paused }),
    );
  });

  it("10. campaign lookup error → safe failure, no Standard DM", async () => {
    process.env.SMART_CAMPAIGNS_ENABLED = "true";
    const findCampaign = vi.fn().mockRejectedValue(new Error("db down"));
    const standardDmExecute = vi.fn();
    const smartCampaignExecute = vi.fn();
    const router = createResponseRouter({
      findCampaign,
      standardDmExecute,
      smartCampaignExecute,
    });

    const result = await router.dispatch(baseParams);

    expect(standardDmExecute).not.toHaveBeenCalled();
    expect(smartCampaignExecute).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      matched: true,
      sent: false,
      failed: true,
    });
  });

  it("ambiguous lookup → fail closed, no Standard DM", async () => {
    process.env.SMART_CAMPAIGNS_ENABLED = "true";
    const findCampaign = vi.fn().mockResolvedValue({
      status: "ambiguous",
      detail: "Multiple ACTIVE campaigns for keyword rule",
    });
    const standardDmExecute = vi.fn();
    const router = createResponseRouter({
      findCampaign,
      standardDmExecute,
      smartCampaignExecute: vi.fn(),
    });

    const result = await router.dispatch(baseParams);

    expect(standardDmExecute).not.toHaveBeenCalled();
    expect(result.failed).toBe(true);
  });

  it("router stays thin: no allocator / template imports in decision path deps", async () => {
    // Structural: createResponseRouter only needs flag + lookup + two execute fns.
    process.env.SMART_CAMPAIGNS_ENABLED = "true";
    const findCampaign = vi.fn().mockResolvedValue({ status: "none" });
    const standardDmExecute = vi.fn().mockResolvedValue(standardResult);
    const router = createResponseRouter({ findCampaign, standardDmExecute });
    await router.dispatch(baseParams);
    expect(findCampaign).toHaveBeenCalled();
  });
});
