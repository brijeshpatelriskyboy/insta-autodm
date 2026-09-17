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

  if (expectedBuffer.length != providedBuffer.length) return false;
  return timingSafeEqual(expectedBuffer, providedBuffer);
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

    const [
      users,
      connectedInstagramAccounts,
      activeKeywordRules,
      activeSubscriptions,
      dmAttempts,
      sent,
      failed,
      sending,
      recentFailures,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.instagramAccount.count({ where: { connectionStatus: "connected" } }),
      prisma.keywordRule.count({ where: { isActive: true } }),
      prisma.subscription.count({ where: { status: { in: ["active", "trialing"] } } }),
      prisma.dmEvent.count({ where: { createdAt: { gte: startOfTodayUtc } } }),
      prisma.dmEvent.count({ where: { createdAt: { gte: startOfTodayUtc }, status: "sent" } }),
      prisma.dmEvent.count({ where: { createdAt: { gte: startOfTodayUtc }, status: "failed" } }),
      prisma.dmEvent.count({ where: { createdAt: { gte: startOfTodayUtc }, status: "sending" } }),
      prisma.dmEvent.findMany({
        where: { status: "failed" },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: {
          createdAt: true,
          errorSummary: true,
          attemptCount: true,
        },
      }),
    ]);

    res.setHeader("Cache-Control", "no-store");
    res.json({
      generatedAt: now.toISOString(),
      period: {
        label: "Today (UTC)",
        start: startOfTodayUtc.toISOString(),
      },
      totals: {
        users,
        connectedInstagramAccounts,
        activeKeywordRules,
        activeSubscriptions,
      },
      today: {
        dmAttempts,
        sent,
        failed,
        skipped: 0,
        sending,
      },
      recentFailures: recentFailures.map((failure) => ({
        createdAt: failure.createdAt.toISOString(),
        code: null,
        summary: failure.errorSummary || "DM delivery failed",
        attemptCount: failure.attemptCount,
      })),
    });
  } catch (error) {
    next(error);
  }
});

export default router;
