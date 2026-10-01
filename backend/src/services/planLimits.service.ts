import { getPlan, type PlanSlug } from "../config/plans";
import { prisma } from "../lib/prisma";
import { AppError } from "../utils/errors";

async function getSubscriptionState(userId: string) {
  const subscription = await prisma.subscription.findUnique({
    where: { userId },
    select: { plan: true, status: true, currentPeriodEnd: true },
  });
  const plan = getPlan(subscription?.plan ?? "starter") ?? getPlan("starter")!;
  const statusActive = subscription?.status === "active" || subscription?.status === "trialing";
  const liteExpired =
    plan.slug === "lite" &&
    (!subscription?.currentPeriodEnd || subscription.currentPeriodEnd.getTime() <= Date.now());
  const active = Boolean(statusActive && !liteExpired);
  return { plan, active };
}

export async function getUserPlan(userId: string) {
  return (await getSubscriptionState(userId)).plan;
}

export async function assertHasActiveSubscription(userId: string): Promise<void> {
  const { active } = await getSubscriptionState(userId);
  if (!active) {
    throw new AppError(402, "An active subscription is required to use automations");
  }
}

export async function getInstagramAccountUsage(userId: string) {
  const plan = await getUserPlan(userId);
  const used = await prisma.instagramAccount.count({
    where: { userId, connectionStatus: "connected" },
  });
  return {
    used,
    limit: plan.limits.instagramAccounts,
    remaining: Math.max(0, plan.limits.instagramAccounts - used),
    plan: plan.slug,
  };
}

export async function assertCanConnectInstagramAccount(userId: string, instagramUserId?: string): Promise<void> {
  const plan = await getUserPlan(userId);
  if (instagramUserId) {
    const existing = await prisma.instagramAccount.findUnique({
      where: { instagramUserId },
      select: { userId: true },
    });
    if (existing && existing.userId !== userId) throw new AppError(409, "Instagram account already connected elsewhere");
    if (existing?.userId === userId) return;
  }
  const used = await prisma.instagramAccount.count({ where: { userId, connectionStatus: "connected" } });
  if (used >= plan.limits.instagramAccounts) {
    throw new AppError(403, `${plan.name} allows up to ${plan.limits.instagramAccounts} Instagram accounts. Upgrade your plan to connect another account.`);
  }
}
export async function assertCanCreateKeywordRule(userId: string): Promise<void> {
  await assertHasActiveSubscription(userId);
  const plan = await getUserPlan(userId);
  if (plan.limits.keywordRules === null) return;

  const count = await prisma.keywordRule.count({ where: { userId } });
  if (count >= plan.limits.keywordRules) {
    throw new AppError(
      403,
      `${plan.name} allows up to ${plan.limits.keywordRules} keyword rules. Upgrade your plan to add more.`,
    );
  }
}

function currentMonthKey(now = new Date()): string {
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

export async function getMonthlyDmUsage(userId: string): Promise<{
  used: number;
  limit: number;
  remaining: number;
  plan: PlanSlug;
}> {
  const plan = await getUserPlan(userId);
  const usage = await prisma.planUsage.findUnique({
    where: { userId_monthKey: { userId, monthKey: currentMonthKey() } },
    select: { dmCount: true },
  });
  const used = Math.max(0, usage?.dmCount ?? 0);

  return {
    used,
    limit: plan.limits.monthlyDms,
    remaining: Math.max(0, plan.limits.monthlyDms - used),
    plan: plan.slug,
  };
}

export async function reserveMonthlyDm(userId: string): Promise<{
  allowed: boolean;
  plan: PlanSlug;
  limit: number;
  reason?: "inactive_subscription" | "monthly_limit";
}> {
  const { plan, active } = await getSubscriptionState(userId);
  if (!active) {
    return {
      allowed: false,
      plan: plan.slug,
      limit: plan.limits.monthlyDms,
      reason: "inactive_subscription",
    };
  }
  const monthKey = currentMonthKey();

  await prisma.planUsage.upsert({
    where: { userId_monthKey: { userId, monthKey } },
    create: { userId, monthKey, dmCount: 0 },
    update: {},
  });
  const reserved = await prisma.planUsage.updateMany({
    where: {
      userId,
      monthKey,
      dmCount: { lt: plan.limits.monthlyDms },
    },
    data: { dmCount: { increment: 1 } },
  });
  const allowed = reserved.count === 1;

  return {
    allowed,
    plan: plan.slug,
    limit: plan.limits.monthlyDms,
    ...(allowed ? {} : { reason: "monthly_limit" as const }),
  };
}

export async function releaseMonthlyDm(userId: string): Promise<void> {
  const monthKey = currentMonthKey();
  await prisma.planUsage.updateMany({
    where: { userId, monthKey, dmCount: { gt: 0 } },
    data: { dmCount: { decrement: 1 } },
  });
}
