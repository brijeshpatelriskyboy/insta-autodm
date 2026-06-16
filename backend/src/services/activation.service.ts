import { prisma } from "../lib/prisma";
import { AppError } from "../utils/errors";

const STEP_DEFINITIONS = [
  {
    id: "account",
    label: "Create Account",
    href: "/dashboard",
  },
  {
    id: "first_rule",
    label: "Create First Rule",
    href: "/dashboard/rules",
  },
  {
    id: "instagram",
    label: "Connect Instagram (Beta)",
    href: "/dashboard/integrations",
  },
  {
    id: "plan",
    label: "Choose Plan",
    href: "/dashboard/billing",
  },
  {
    id: "go_live",
    label: "Go Live",
    href: "/dashboard/rules",
  },
] as const;

type StepId = (typeof STEP_DEFINITIONS)[number]["id"];

function isPlanChosen(
  subscription: {
    status: string;
    stripeSubscriptionId: string | null;
  } | null,
): boolean {
  if (!subscription) return false;

  return (
    subscription.status === "active" ||
    subscription.status === "trialing" ||
    subscription.stripeSubscriptionId !== null
  );
}

function isInstagramComplete(
  instagramAccount: { connectionStatus: string; connectedAt: Date | null } | null,
  instagramConnectionRequest: { createdAt: Date } | null,
): boolean {
  if (instagramAccount?.connectionStatus === "connected") {
    return true;
  }

  return instagramConnectionRequest !== null;
}

function isGoLiveReady(
  hasActiveRule: boolean,
  instagramConnected: boolean,
  planChosen: boolean,
): boolean {
  return hasActiveRule && instagramConnected && planChosen;
}

function isMissingQuickStartTable(error: unknown): boolean {
  if (typeof error !== "object" || error === null) {
    return false;
  }

  if ("code" in error && error.code === "P2021") {
    return true;
  }

  const message =
    "message" in error && typeof error.message === "string" ? error.message : "";

  return message.includes("quick_start_progress") || message.includes("does not exist");
}

function logActivationError(context: string, error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[activation] ${context}:`, message);
}

export function getDefaultQuickStartProgress(accountComplete = false) {
  const steps = STEP_DEFINITIONS.map((step) => ({
    id: step.id,
    label: step.label,
    href: step.href,
    completed: step.id === "account" ? accountComplete : false,
    completedAt: null as string | null,
  }));

  const completedCount = accountComplete ? 1 : 0;

  return {
    progress: Math.round((completedCount / steps.length) * 100),
    completedCount,
    totalSteps: steps.length,
    steps,
    showCelebration: false,
    celebrated: false,
  };
}

function buildQuickStartSnapshot(
  user: {
    createdAt: Date;
    keywordRules: { isActive: boolean; createdAt: Date }[];
    instagramAccount: { connectionStatus: string; connectedAt: Date | null } | null;
    instagramConnectionRequest: { createdAt: Date } | null;
    subscription: {
      status: string;
      stripeSubscriptionId: string | null;
      updatedAt: Date;
    } | null;
  },
  progress: {
    accountCompletedAt: Date | null;
    firstRuleCompletedAt: Date | null;
    instagramCompletedAt: Date | null;
    planChosenCompletedAt: Date | null;
    goLiveCompletedAt: Date | null;
    celebratedAt: Date | null;
  } | null,
) {
  const now = new Date();
  const firstRule = user.keywordRules[0] ?? null;
  const hasActiveRule = user.keywordRules.some((rule) => rule.isActive);
  const instagramConnected = user.instagramAccount?.connectionStatus === "connected";
  const instagramComplete = isInstagramComplete(
    user.instagramAccount,
    user.instagramConnectionRequest,
  );
  const planChosen = isPlanChosen(user.subscription);
  const goLiveReady = isGoLiveReady(hasActiveRule, instagramConnected, planChosen);

  const accountCompletedAt = progress?.accountCompletedAt ?? user.createdAt;
  const firstRuleCompletedAt =
    progress?.firstRuleCompletedAt ?? (firstRule ? firstRule.createdAt : null);
  const instagramCompletedAt =
    progress?.instagramCompletedAt ??
    (instagramComplete
      ? (user.instagramAccount?.connectedAt ??
        user.instagramConnectionRequest?.createdAt ??
        now)
      : null);
  const planChosenCompletedAt =
    progress?.planChosenCompletedAt ??
    (planChosen ? (user.subscription?.updatedAt ?? now) : null);
  const goLiveCompletedAt =
    progress?.goLiveCompletedAt ?? (goLiveReady ? now : null);

  const completionMap: Record<StepId, boolean> = {
    account: !!accountCompletedAt,
    first_rule: !!firstRuleCompletedAt,
    instagram: !!instagramCompletedAt,
    plan: !!planChosenCompletedAt,
    go_live: !!goLiveCompletedAt,
  };

  const completedAtMap: Record<StepId, Date | null> = {
    account: accountCompletedAt,
    first_rule: firstRuleCompletedAt,
    instagram: instagramCompletedAt,
    plan: planChosenCompletedAt,
    go_live: goLiveCompletedAt,
  };

  const steps = STEP_DEFINITIONS.map((step) => ({
    id: step.id,
    label: step.label,
    href: step.href,
    completed: completionMap[step.id],
    completedAt: completedAtMap[step.id]?.toISOString() ?? null,
  }));

  const completedCount = steps.filter((step) => step.completed).length;
  const progressPercent = Math.round((completedCount / steps.length) * 100);

  return {
    progress: progressPercent,
    completedCount,
    totalSteps: steps.length,
    steps,
    showCelebration: progressPercent === 100 && !progress?.celebratedAt,
    celebrated: !!progress?.celebratedAt,
  };
}

async function loadOrCreateProgress(userId: string) {
  try {
    let progress = await prisma.quickStartProgress.findUnique({
      where: { userId },
    });

    if (!progress) {
      progress = await prisma.quickStartProgress.create({
        data: { userId },
      });
    }

    return progress;
  } catch (error) {
    if (isMissingQuickStartTable(error)) {
      logActivationError("quick_start_progress table unavailable", error);
      return null;
    }

    logActivationError("loadOrCreateProgress failed", error);
    return null;
  }
}

async function saveProgressUpdates(
  userId: string,
  progress: NonNullable<Awaited<ReturnType<typeof loadOrCreateProgress>>>,
  updates: {
    accountCompletedAt?: Date;
    firstRuleCompletedAt?: Date;
    instagramCompletedAt?: Date;
    planChosenCompletedAt?: Date;
    goLiveCompletedAt?: Date;
  },
) {
  if (Object.keys(updates).length === 0) {
    return progress;
  }

  try {
    return await prisma.quickStartProgress.update({
      where: { userId },
      data: updates,
    });
  } catch (error) {
    if (isMissingQuickStartTable(error)) {
      logActivationError("quick_start_progress update unavailable", error);
      return { ...progress, ...updates };
    }

    logActivationError("saveProgressUpdates failed", error);
    return { ...progress, ...updates };
  }
}

export const activationService = {
  async getQuickStart(userId: string) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
          keywordRules: {
            select: { id: true, isActive: true, createdAt: true },
            orderBy: { createdAt: "asc" },
          },
          instagramAccount: {
            select: { connectionStatus: true, connectedAt: true },
          },
          instagramConnectionRequest: {
            select: { createdAt: true },
          },
          subscription: {
            select: {
              status: true,
              stripeSubscriptionId: true,
              updatedAt: true,
            },
          },
        },
      });

      if (!user) {
        throw new AppError(404, "User not found");
      }

      const firstRule = user.keywordRules[0] ?? null;
      const hasActiveRule = user.keywordRules.some((rule) => rule.isActive);
      const instagramConnected = user.instagramAccount?.connectionStatus === "connected";
      const instagramComplete = isInstagramComplete(
        user.instagramAccount,
        user.instagramConnectionRequest,
      );
      const planChosen = isPlanChosen(user.subscription);
      const goLiveReady = isGoLiveReady(hasActiveRule, instagramConnected, planChosen);

      let progress = await loadOrCreateProgress(userId);

      if (!progress) {
        return buildQuickStartSnapshot(user, null);
      }

      const now = new Date();
      const updates: {
        accountCompletedAt?: Date;
        firstRuleCompletedAt?: Date;
        instagramCompletedAt?: Date;
        planChosenCompletedAt?: Date;
        goLiveCompletedAt?: Date;
      } = {};

      if (!progress.accountCompletedAt) {
        updates.accountCompletedAt = user.createdAt;
      }

      if (firstRule && !progress.firstRuleCompletedAt) {
        updates.firstRuleCompletedAt = firstRule.createdAt;
      }

      if (instagramComplete && !progress.instagramCompletedAt) {
        updates.instagramCompletedAt =
          user.instagramAccount?.connectedAt ??
          user.instagramConnectionRequest?.createdAt ??
          now;
      }

      if (planChosen && !progress.planChosenCompletedAt) {
        updates.planChosenCompletedAt = user.subscription?.updatedAt ?? now;
      }

      if (goLiveReady && !progress.goLiveCompletedAt) {
        updates.goLiveCompletedAt = now;
      }

      progress = await saveProgressUpdates(userId, progress, updates);

      return buildQuickStartSnapshot(user, progress);
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      logActivationError("getQuickStart failed, returning default progress", error);
      return getDefaultQuickStartProgress(true);
    }
  },

  async markCelebrated(userId: string) {
    try {
      const snapshot = await this.getQuickStart(userId);

      if (snapshot.progress < 100) {
        throw new AppError(400, "Complete all Quick Start steps before celebrating");
      }

      try {
        await prisma.quickStartProgress.update({
          where: { userId },
          data: { celebratedAt: new Date() },
        });
      } catch (error) {
        if (!isMissingQuickStartTable(error)) {
          logActivationError("markCelebrated update failed", error);
        }
      }

      return {
        celebrated: true,
        showCelebration: false,
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }

      logActivationError("markCelebrated failed", error);
      return {
        celebrated: false,
        showCelebration: false,
      };
    }
  },
};
