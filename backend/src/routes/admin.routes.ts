import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { prisma } from "../lib/prisma";

const router = Router();
router.use(authenticate);

// No admin access is granted unless explicitly configured in the backend environment.
// Never rely on frontend flags, a JWT email claim, or a user-controlled role.
router.use(async (req, res, next) => {
  try {
    const permitted = (process.env.ADMIN_EMAILS || "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean);
    if (!permitted.length || !req.user?.id) {
      res.status(403).json({ error: "Admin access unavailable" });
      return;
    }
    const account = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { email: true },
    });
    if (!account || !permitted.includes(account.email.toLowerCase())) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    res.setHeader("Cache-Control", "private, no-store");
    next();
  } catch (error) {
    next(error);
  }
});

router.get("/overview", async (_req, res, next) => {
  try {
    const now = new Date();
    const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const month = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const [users, todayUsers, monthUsers, connectedAccounts, subscriptions, recentUsers] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { createdAt: { gte: today } } }),
      prisma.user.count({ where: { createdAt: { gte: month } } }),
      prisma.instagramAccount.count({ where: { connectionStatus: "connected" } }),
      prisma.subscription.groupBy({ by: ["status"], _count: { _all: true } }),
      prisma.user.findMany({
        orderBy: { createdAt: "desc" },
        take: 25,
        select: { id: true, email: true, name: true, createdAt: true, instagramAccounts: { select: { username: true, connectionStatus: true } }, subscription: { select: { plan: true, status: true } } },
      }),
    ]);
    res.json({
      totalUsers: users,
      todayRegistrationsUTC: todayUsers,
      monthRegistrationsUTC: monthUsers,
      connectedInstagramAccounts: connectedAccounts,
      subscriptionsByStatus: Object.fromEntries(subscriptions.map((item) => [item.status, item._count._all])),
      recentUsers,
      asOf: now.toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

export default router;
