import { getPlan, type PlanSlug } from "../config/plans";
import { prisma } from "../lib/prisma";
import { AppError } from "../utils/errors";

export async function getUserPlan(userId: string) {
  const subscription = await prisma.subscription.findUnique({
    where: { userId },
    select: { plan: true },
  });
  return getPlan(subscription?.plan ?? "starter") ?? getPlan("starter")!;
}

export async function assertCanCreateKeywordRule(userId: string): Promise<void> {
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
}> {
  const plan = await getUserPlan(userId);
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

  return { allowed, plan: plan.slug, limit: plan.limits.monthlyDms };
}

export async function releaseMonthlyDm(userId: string): Promise<void> {
  const monthKey = currentMonthKey();
  await prisma.planUsage.updateMany({
    where: { userId, monthKey, dmCount: { gt: 0 } },
    data: { dmCount: { decrement: 1 } },
  });
}
