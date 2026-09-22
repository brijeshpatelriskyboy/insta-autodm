import { prisma } from "../lib/prisma";
import { getMonthlyDmUsage } from "./planLimits.service";

export class AnalyticsService {
  async getSummary(userId: string) {
    const [totalKeywordRules, totalDmEvents, totalLeads, monthlyDmUsage] = await Promise.all([
      prisma.keywordRule.count({ where: { userId } }),
      prisma.dmEvent.count({ where: { userId } }),
      prisma.lead.count({ where: { userId } }),
      getMonthlyDmUsage(userId),
    ]);

    return {
      totalKeywordRules,
      totalDmEvents,
      totalLeads,
      monthlyDmUsed: monthlyDmUsage.used,
      monthlyDmLimit: monthlyDmUsage.limit,
      monthlyDmRemaining: monthlyDmUsage.remaining,
      plan: monthlyDmUsage.plan,
    };
  }
}

export const analyticsService = new AnalyticsService();
