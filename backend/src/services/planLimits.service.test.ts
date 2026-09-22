import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockSubscriptionFindUnique,
  mockKeywordCount,
  mockUsageUpsert,
  mockUsageUpdateMany,
  mockUsageFindUnique,
  mockTransaction,
} = vi.hoisted(() => ({
  mockSubscriptionFindUnique: vi.fn(),
  mockKeywordCount: vi.fn(),
  mockUsageUpsert: vi.fn(),
  mockUsageUpdateMany: vi.fn(),
  mockUsageFindUnique: vi.fn(),
  mockTransaction: vi.fn(),
}));

vi.mock("../lib/prisma", () => ({
  prisma: {
    subscription: { findUnique: mockSubscriptionFindUnique },
    keywordRule: { count: mockKeywordCount },
    planUsage: { findUnique: mockUsageFindUnique, updateMany: mockUsageUpdateMany },
    $transaction: mockTransaction,
  },
}));

import {
  assertCanCreateKeywordRule,
  getMonthlyDmUsage,
  releaseMonthlyDm,
  reserveMonthlyDm,
} from "./planLimits.service";

describe("plan limits", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSubscriptionFindUnique.mockResolvedValue({ plan: "starter" });
    mockTransaction.mockImplementation(async (callback) =>
      callback({
        planUsage: {
          upsert: mockUsageUpsert,
          updateMany: mockUsageUpdateMany,
        },
      }),
    );
  });

  it("blocks a fourth Starter keyword rule", async () => {
    mockKeywordCount.mockResolvedValue(3);
    await expect(assertCanCreateKeywordRule("user-1")).rejects.toMatchObject({
      statusCode: 403,
      message: expect.stringContaining("up to 3 keyword rules"),
    });
  });

  it("allows unlimited Pro keyword rules", async () => {
    mockSubscriptionFindUnique.mockResolvedValue({ plan: "pro" });
    await expect(assertCanCreateKeywordRule("user-1")).resolves.toBeUndefined();
    expect(mockKeywordCount).not.toHaveBeenCalled();
  });

  it("atomically reserves an available monthly DM", async () => {
    mockUsageUpdateMany.mockResolvedValue({ count: 1 });
    await expect(reserveMonthlyDm("user-1")).resolves.toEqual({
      allowed: true,
      plan: "starter",
      limit: 500,
    });
    expect(mockUsageUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ dmCount: { lt: 500 } }) }),
    );
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
      limit: 500,
      remaining: 486,
      plan: "starter",
    });
  });

  it("reports zero usage when the current month has no counter yet", async () => {
    mockUsageFindUnique.mockResolvedValue(null);

    await expect(getMonthlyDmUsage("user-1")).resolves.toMatchObject({
      used: 0,
      remaining: 500,
    });
  });
});
