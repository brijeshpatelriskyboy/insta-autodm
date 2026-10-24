import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockSubscriptionFindUnique,
  mockKeywordCount,
  mockUsageUpsert,
  mockUsageUpdateMany,
  mockUsageFindUnique,
  mockInstagramCount,
  mockInstagramFindUnique,
  mockStripeRetrieve,
} = vi.hoisted(() => ({
  mockSubscriptionFindUnique: vi.fn(),
  mockKeywordCount: vi.fn(),
  mockUsageUpsert: vi.fn(),
  mockUsageUpdateMany: vi.fn(),
  mockUsageFindUnique: vi.fn(),
  mockInstagramCount: vi.fn(),
  mockInstagramFindUnique: vi.fn(),
  mockStripeRetrieve: vi.fn(),
}));

vi.mock("../config/env", () => ({ env: { STRIPE_SECRET_KEY: "sk_live_test_not_real" } }));
vi.mock("stripe", () => ({
  default: class MockStripe {
    subscriptions = { retrieve: mockStripeRetrieve };
    static errors = { StripeInvalidRequestError: class StripeInvalidRequestError extends Error {} };
  },
}));
vi.mock("../lib/prisma", () => ({
  prisma: {
    subscription: { findUnique: mockSubscriptionFindUnique },
    keywordRule: { count: mockKeywordCount },
    instagramAccount: {
      count: mockInstagramCount,
      findUnique: mockInstagramFindUnique,
    },
    planUsage: {
      findUnique: mockUsageFindUnique,
      upsert: mockUsageUpsert,
      updateMany: mockUsageUpdateMany,
    },
  },
}));

import {
  assertCanConnectInstagramAccount,
  assertCanCreateKeywordRule,
  getInstagramAccountUsage,
  getMonthlyDmUsage,
  releaseMonthlyDm,
  reserveMonthlyDm,
} from "./planLimits.service";

describe("plan limits", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStripeRetrieve.mockResolvedValue({ status: "active" });
    mockSubscriptionFindUnique.mockResolvedValue({ plan: "starter", status: "active", stripeSubscriptionId: "sub_live" });
    mockInstagramCount.mockResolvedValue(0);
    mockInstagramFindUnique.mockResolvedValue(null);
  });

  it("blocks automation setup without an active subscription", async () => {
    mockSubscriptionFindUnique.mockResolvedValue({ plan: "starter", status: "inactive" });
    await expect(assertCanCreateKeywordRule("user-1")).rejects.toMatchObject({
      statusCode: 402,
      message: expect.stringContaining("active subscription"),
    });
  });

  it("does not reserve a DM for an inactive subscription", async () => {
    mockSubscriptionFindUnique.mockResolvedValue({ plan: "starter", status: "canceled" });
    await expect(reserveMonthlyDm("user-1")).resolves.toEqual({
      allowed: false,
      plan: "starter",
      limit: 1_000,
      reason: "inactive_subscription",
    });
    expect(mockUsageUpsert).not.toHaveBeenCalled();
  });

  it("blocks a sixth Starter keyword rule", async () => {
    mockKeywordCount.mockResolvedValue(5);
    await expect(assertCanCreateKeywordRule("user-1")).rejects.toMatchObject({
      statusCode: 403,
      message: expect.stringContaining("up to 5 keyword rules"),
    });
  });

  it("allows unlimited Creator keyword rules", async () => {
    mockSubscriptionFindUnique.mockResolvedValue({ plan: "creator", status: "active", stripeSubscriptionId: "sub_live" });
    await expect(assertCanCreateKeywordRule("user-1")).resolves.toBeUndefined();
    expect(mockKeywordCount).not.toHaveBeenCalled();
  });

  it("allows unlimited Pro keyword rules", async () => {
    mockSubscriptionFindUnique.mockResolvedValue({ plan: "pro", status: "active", stripeSubscriptionId: "sub_live" });
    await expect(assertCanCreateKeywordRule("user-1")).resolves.toBeUndefined();
    expect(mockKeywordCount).not.toHaveBeenCalled();
  });

  it("allows Creator to connect up to 3 Instagram accounts", async () => {
    mockSubscriptionFindUnique.mockResolvedValue({ plan: "creator", status: "active", stripeSubscriptionId: "sub_live" });
    mockInstagramCount.mockResolvedValue(2);

    await expect(assertCanConnectInstagramAccount("user-1", "ig-new")).resolves.toBeUndefined();
    await expect(getInstagramAccountUsage("user-1")).resolves.toEqual({
      used: 2,
      limit: 3,
      remaining: 1,
      plan: "creator",
    });
  });

  it("blocks another Instagram account when the Pro 15-account limit is reached", async () => {
    mockSubscriptionFindUnique.mockResolvedValue({ plan: "pro", status: "active", stripeSubscriptionId: "sub_live" });
    mockInstagramCount.mockResolvedValue(15);

    await expect(assertCanConnectInstagramAccount("user-1", "ig-new")).rejects.toMatchObject({
      statusCode: 403,
      message: expect.stringContaining("up to 15 Instagram accounts"),
    });
  });


  it("enforces Lite limits and expiry", async () => {
    mockSubscriptionFindUnique.mockResolvedValue({
      plan: "lite",
      status: "active",
      currentPeriodEnd: new Date(Date.now() + 60_000),
    });
    mockKeywordCount.mockResolvedValue(2);

    await expect(assertCanCreateKeywordRule("user-1")).rejects.toMatchObject({
      statusCode: 403,
      message: expect.stringContaining("up to 2 keyword rules"),
    });

    mockUsageUpdateMany.mockResolvedValue({ count: 1 });
    await expect(reserveMonthlyDm("user-1")).resolves.toEqual({
      allowed: true,
      plan: "lite",
      limit: 200,
    });

    mockSubscriptionFindUnique.mockResolvedValue({
      plan: "lite",
      status: "active",
      currentPeriodEnd: new Date(Date.now() - 60_000),
    });
    await expect(reserveMonthlyDm("user-1")).resolves.toEqual({
      allowed: false,
      plan: "lite",
      limit: 200,
      reason: "inactive_subscription",
    });
  });

  it("atomically reserves an available monthly DM", async () => {
    mockUsageUpdateMany.mockResolvedValue({ count: 1 });
    await expect(reserveMonthlyDm("user-1")).resolves.toEqual({
      allowed: true,
      plan: "starter",
      limit: 1_000,
    });
    expect(mockUsageUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ dmCount: { lt: 1_000 } }) }),
    );
    expect(mockUsageUpsert).toHaveBeenCalledOnce();
  });

  it("rejects a DM when the monthly allowance is exhausted", async () => {
    mockUsageUpdateMany.mockResolvedValue({ count: 0 });
    await expect(reserveMonthlyDm("user-1")).resolves.toMatchObject({ allowed: false });
  });

  it("releases a reservation after a failed send", async () => {
    mockUsageUpdateMany.mockResolvedValue({ count: 1 });
    await releaseMonthlyDm("user-1");
    expect(mockUsageUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ dmCount: { gt: 0 } }),
        data: { dmCount: { decrement: 1 } },
      }),
    );
  });

  it("reports the active plan's monthly DM usage and remaining allowance", async () => {
    mockUsageFindUnique.mockResolvedValue({ dmCount: 14 });

    await expect(getMonthlyDmUsage("user-1")).resolves.toEqual({
      used: 14,
      limit: 1_000,
      remaining: 986,
      plan: "starter",
    });
  });

  it("reports zero usage when the current month has no counter yet", async () => {
    mockUsageFindUnique.mockResolvedValue(null);

    await expect(getMonthlyDmUsage("user-1")).resolves.toMatchObject({
      used: 0,
      remaining: 1_000,
    });
  });
});


describe("live Stripe entitlement checks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSubscriptionFindUnique.mockResolvedValue({ plan: "starter", status: "active", stripeSubscriptionId: "sub_historical" });
    mockStripeRetrieve.mockResolvedValue({ status: "active" });
  });
  it("does not reserve DMs for a historical subscription missing from live Stripe", async () => {
    mockStripeRetrieve.mockRejectedValueOnce(new Error("No such subscription"));
    await expect(reserveMonthlyDm("user-1")).resolves.toMatchObject({ allowed: false, reason: "inactive_subscription" });
    expect(mockUsageUpsert).not.toHaveBeenCalled();
  });
  it("preserves paid access for live verified active subscriptions", async () => {
    mockUsageUpdateMany.mockResolvedValue({ count: 1 });
    await expect(reserveMonthlyDm("user-1")).resolves.toMatchObject({ allowed: true });
    expect(mockStripeRetrieve).toHaveBeenCalledWith("sub_historical");
  });
  it("rejects a locally active subscription cancelled in live Stripe", async () => {
    mockStripeRetrieve.mockResolvedValue({ status: "canceled" });
    await expect(reserveMonthlyDm("user-1")).resolves.toMatchObject({ allowed: false });
  });
  it("reuses recent positive verification during a brief Stripe outage", async () => {
    mockSubscriptionFindUnique.mockResolvedValue({ plan: "starter", status: "active", stripeSubscriptionId: "sub_outage_grace" });
    mockUsageUpdateMany.mockResolvedValue({ count: 1 });
    await expect(reserveMonthlyDm("user-1")).resolves.toMatchObject({ allowed: true });
    mockStripeRetrieve.mockRejectedValue(new Error("Stripe unavailable"));
    await expect(reserveMonthlyDm("user-1")).resolves.toMatchObject({ allowed: true });
    expect(mockStripeRetrieve).toHaveBeenCalledTimes(1);
  });

});
