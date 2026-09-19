import { Router } from "express";
import { timingSafeEqual } from "crypto";
import { prisma } from "../lib/prisma";

const router = Router();

function isAuthorized(authorization?: string): boolean {
  const expected = process.env.JARVIS_INTERNAL_TOKEN;
  if (!expected || !authorization?.startsWith("Bearer ")) return false;

  const provided = authorization.slice("Bearer ".length);
  const expectedBuffer = Buffer.from(expected, "utf8");
  const providedBuffer = Buffer.from(provided, "utf8");

  if (expectedBuffer.length !== providedBuffer.length) return false;
  return timingSafeEqual(expectedBuffer, providedBuffer);
}

function percent(part: number, total: number): number | null {
  if (total <= 0) return null;
  return Math.round((part / total) * 1000) / 10;
}

router.get("/summary", async (req, res, next) => {
  try {
    if (!process.env.JARVIS_INTERNAL_TOKEN) {
      res.status(503).json({ error: "Jarvis integration is not configured" });
      return;
    }

    if (!isAuthorized(req.header("authorization") ?? undefined)) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const now = new Date();
    const startOfTodayUtc = new Date(now);
    startOfTodayUtc.setUTCHours(0, 0, 0, 0);
    const startOfLast24Hours = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const [
      users,
      totalInstagramAccounts,
      connectedInstagramAccounts,
      activeKeywordRules,
      activeSubscriptions,
      todayAttempts,
      todaySent,
      todayFailed,
      todaySkipped,
      todaySending,
      last24Attempts,
      last24Sent,
      last24Failed,
      last24Skipped,
      last24Sending,
      recentFailures,
      lastActivity,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.instagramAccount.count(),
      prisma.instagramAccount.count({ where: { connectionStatus: "connected" } }),
      prisma.keywordRule.count({ where: { isActive: true } }),
      prisma.subscription.count({ where: { status: { in: ["active", "trialing"] } } }),
      prisma.dmEvent.count({ where: { createdAt: { gte: startOfTodayUtc } } }),
      prisma.dmEvent.count({ where: { createdAt: { gte: startOfTodayUtc }, status: "sent" } }),
      prisma.dmEvent.count({ where: { createdAt: { gte: startOfTodayUtc }, status: "failed" } }),
      prisma.dmEvent.count({ where: { createdAt: { gte: startOfTodayUtc }, status: "skipped" } }),
      prisma.dmEvent.count({ where: { createdAt: { gte: startOfTodayUtc }, status: "sending" } }),
      prisma.dmEvent.count({ where: { createdAt: { gte: startOfLast24Hours } } }),
      prisma.dmEvent.count({ where: { createdAt: { gte: startOfLast24Hours }, status: "sent" } }),
      prisma.dmEvent.count({ where: { createdAt: { gte: startOfLast24Hours }, status: "failed" } }),
      prisma.dmEvent.count({ where: { createdAt: { gte: startOfLast24Hours }, status: "skipped" } }),
      prisma.dmEvent.count({ where: { createdAt: { gte: startOfLast24Hours }, status: "sending" } }),
      prisma.dmEvent.findMany({
        where: { status: "failed" },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: {
          createdAt: true,
          metaErrorCode: true,
          errorSummary: true,
          metaErrorMessage: true,
          attemptCount: true,
        },
      }),
      prisma.dmEvent.findFirst({
        orderBy: { createdAt: "desc" },
        select: {
          createdAt: true,
          status: true,
        },
      }),
    ]);

    const completedLast24 = last24Sent + last24Failed;
    const matchedLast24 = Math.max(0, last24Attempts - last24Skipped);

    const successRate = percent(last24Sent, completedLast24);
    const matchRate = percent(matchedLast24, last24Attempts);
    const connectionCoverage = percent(connectedInstagramAccounts, totalInstagramAccounts);

    const alerts: string[] = [];

    if (totalInstagramAccounts === 0) {
      alerts.push("No Instagram accounts have been added yet.");
    } else if (connectedInstagramAccounts === 0) {
      alerts.push("No Instagram account is currently connected.");
    } else if (connectedInstagramAccounts < totalInstagramAccounts) {
      const disconnected = totalInstagramAccounts - connectedInstagramAccounts;
      alerts.push(`${disconnected} Instagram account${disconnected === 1 ? "" : "s"} not currently connected.`);
    }

    if (activeKeywordRules === 0) {
      alerts.push("There are no active keyword rules.");
    }

    if (last24Failed > 0) {
      alerts.push(`${last24Failed} DM attempt${last24Failed === 1 ? "" : "s"} failed in the last 24 hours.`);
    }

    if (last24Sending > 0) {
      alerts.push(`${last24Sending} DM attempt${last24Sending === 1 ? " is" : "s are"} still marked as sending.`);
    }

    if (last24Attempts === 0) {
      alerts.push("No DM attempts were recorded in the last 24 hours.");
    }

    res.setHeader("Cache-Control", "no-store");
    res.json({
      generatedAt: now.toISOString(),
      period: {
        label: "Today (UTC)",
        start: startOfTodayUtc.toISOString(),
      },
      totals: {
        users,
        totalInstagramAccounts,
        connectedInstagramAccounts,
        activeKeywordRules,
        activeSubscriptions,
      },
      today: {
        dmAttempts: todayAttempts,
        sent: todaySent,
        failed: todayFailed,
        skipped: todaySkipped,
        sending: todaySending,
      },
      last24Hours: {
        start: startOfLast24Hours.toISOString(),
        dmAttempts: last24Attempts,
        sent: last24Sent,
        failed: last24Failed,
        skipped: last24Skipped,
        sending: last24Sending,
      },
      insights: {
        successRate,
        matchRate,
        connectionCoverage,
        lastActivityAt: lastActivity?.createdAt.toISOString() ?? null,
        lastActivityStatus: lastActivity?.status ?? null,
        alerts,
      },
      recentFailures: recentFailures.map((failure) => ({
        createdAt: failure.createdAt.toISOString(),
        code: failure.metaErrorCode,
        summary: failure.errorSummary || failure.metaErrorMessage || "DM delivery failed",
        attemptCount: failure.attemptCount,
      })),
    });
  } catch (error) {
    next(error);
  }
});

export default router;
