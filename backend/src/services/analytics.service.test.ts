import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  keywordRuleCount: vi.fn(),
  dmEventCount: vi.fn(),
  dmEventFindMany: vi.fn(),
  activityEventCount: vi.fn(),
  getMonthlyDmUsage: vi.fn(),
}));

vi.mock("../lib/prisma", () => ({
  prisma: {
    keywordRule: { count: mocks.keywordRuleCount },
    dmEvent: { count: mocks.dmEventCount, findMany: mocks.dmEventFindMany },
    activityEvent: { count: mocks.activityEventCount },
  },
}));

vi.mock("./planLimits.service", () => ({
  getMonthlyDmUsage: mocks.getMonthlyDmUsage,
}));

import { analyticsService } from "./analytics.service";

describe("analyticsService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.keywordRuleCount.mockResolvedValue(3);
    mocks.dmEventCount.mockResolvedValue(4);
    mocks.dmEventFindMany.mockResolvedValue([
      { commenterId: "ig-user-1" },
      { commenterId: "ig-user-2" },
    ]);
    mocks.activityEventCount.mockResolvedValue(5);
    mocks.getMonthlyDmUsage.mockResolvedValue({
      used: 4,
      limit: 500,
      remaining: 496,
      plan: "starter",
    });
  });

  it("reports sent DMs, unique successful recipients, and match conversion", async () => {
    const summary = await analyticsService.getSummary("user-1");

    expect(mocks.dmEventCount).toHaveBeenCalledWith({
      where: { userId: "user-1", status: "sent" },
    });
    expect(mocks.dmEventFindMany).toHaveBeenCalledWith({
      where: { userId: "user-1", status: "sent", commenterId: { not: null } },
      distinct: ["commenterId"],
      select: { commenterId: true },
    });
    expect(mocks.activityEventCount).toHaveBeenCalledWith({
      where: { userId: "user-1", type: "keyword_matched" },
    });
    expect(summary).toMatchObject({
      totalDmEvents: 4,
      totalLeads: 2,
      totalKeywordMatches: 5,
      conversionRate: 40,
    });
  });

  it("returns zero conversion when there are no keyword matches", async () => {
    mocks.dmEventFindMany.mockResolvedValue([]);
    mocks.activityEventCount.mockResolvedValue(0);

    const summary = await analyticsService.getSummary("user-1");

    expect(summary.totalLeads).toBe(0);
    expect(summary.conversionRate).toBe(0);
  });
});
