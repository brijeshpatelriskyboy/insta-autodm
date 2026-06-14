import { prisma } from "../lib/prisma";

export class AnalyticsService {
  async getSummary(userId: string) {
    const [totalKeywordRules, totalDmEvents, totalLeads] = await Promise.all([
      prisma.keywordRule.count({ where: { userId } }),
      prisma.dmEvent.count({ where: { userId } }),
      prisma.lead.count({ where: { userId } }),
    ]);

    return {
      totalKeywordRules,
      totalDmEvents,
      totalLeads,
    };
  }
}

export const analyticsService = new AnalyticsService();
