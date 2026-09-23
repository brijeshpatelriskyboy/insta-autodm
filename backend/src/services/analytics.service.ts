import { prisma } from "../lib/prisma";
import { getMonthlyDmUsage } from "./planLimits.service";

export class AnalyticsService {
  async getSummary(userId: string) {
    const [
      totalKeywordRules,
      totalDmEvents,
      uniqueLeadRows,
      totalKeywordMatches,
      monthlyDmUsage,
    ] = await Promise.all([
      prisma.keywordRule.count({ where: { userId } }),
      prisma.dmEvent.count({ where: { userId, status: "sent" } }),
      prisma.dmEvent.findMany({
        where: { userId, status: "sent", commenterId: { not: null } },
        distinct: ["commenterId"],
        select: { commenterId: true },
      }),
      prisma.activityEvent.count({ where: { userId, type: "keyword_matched" } }),
      getMonthlyDmUsage(userId),
    ]);

    const totalLeads = uniqueLeadRows.length;
    const conversionRate =
      totalKeywordMatches > 0
        ? Math.round((totalLeads / totalKeywordMatches) * 1000) / 10
        : 0;

    return {
      totalKeywordRules,
      totalDmEvents,
      totalLeads,
      totalKeywordMatches,
      conversionRate,
      monthlyDmUsed: monthlyDmUsage.used,
      monthlyDmLimit: monthlyDmUsage.limit,
      monthlyDmRemaining: monthlyDmUsage.remaining,
      plan: monthlyDmUsage.plan,
    };
  }
}

export const analyticsService = new AnalyticsService();
