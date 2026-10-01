"use client";

import { useEffect, useState } from "react";
import { Zap, Send, Users, Percent } from "lucide-react";
import { KpiCard } from "@/components/ui/KpiCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { KpiCardSkeleton } from "@/components/ui/Skeleton";
import { InstagramConnectionCard } from "@/components/dashboard/InstagramConnectionCard";
import { KeywordLeaderboard } from "@/components/dashboard/KeywordLeaderboard";
import { QuickStartChecklist } from "@/components/dashboard/QuickStartChecklist";
import { TestFirstAutomationPanel } from "@/components/dashboard/TestFirstAutomationPanel";
import { api, type AnalyticsSummary, type User } from "@/lib/api";
import { getStoredUser, getToken } from "@/lib/auth";
import { useOnboardingProgress } from "@/hooks/useOnboardingProgress";
import {
  dismissTestAutomationPanel,
  isTestAutomationPanelDismissed,
  shouldShowTestAutomationPanel,
} from "@/lib/onboarding";
import { formatNumber } from "@/lib/demo-data";

export default function DashboardPage() {
  const [user, setUser] = useState<User | null>(null);
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [showTestPanel, setShowTestPanel] = useState(false);
  const progress = useOnboardingProgress();

  useEffect(() => {
    const stored = getStoredUser();
    setUser(stored);
    const token = getToken();
    if (!token) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    api
      .getAnalyticsSummary(token)
      .then((value) => {
        if (!cancelled) setSummary(value);
      })
      .catch(() => {
        if (!cancelled) setSummary(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (progress.loading || !user?.id) {
      setShowTestPanel(false);
      return;
    }

    setShowTestPanel(
      shouldShowTestAutomationPanel({
        hasKeywordRule: progress.hasKeywordRule,
        hasSuccessfulDm: progress.hasSuccessfulDm,
        dismissed: isTestAutomationPanelDismissed(user.id),
      }),
    );
  }, [progress, user?.id]);

  function handleDismissTestPanel() {
    if (user?.id) dismissTestAutomationPanel(user.id);
    setShowTestPanel(false);
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title={user?.name ? `Welcome, ${user.name}` : "Welcome"}
        description="Manage your Instagram automations and see your results."
      />

      {showTestPanel && (
        <TestFirstAutomationPanel onDismiss={handleDismissTestPanel} />
      )}

      <div>
        <h2 className="mb-3 text-sm font-semibold text-slate-700">Overview</h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {loading ? (
            <>
              <KpiCardSkeleton />
              <KpiCardSkeleton />
              <KpiCardSkeleton />
              <KpiCardSkeleton />
            </>
          ) : (
            <>
              <KpiCard
                label="Keyword Rules"
                value={summary?.totalKeywordRules ?? 0}
                icon={Zap}
                accent="violet"
                delay={0}
              />
              <KpiCard
                label="Monthly DMs"
                value={`${formatNumber(summary?.monthlyDmUsed ?? 0)} / ${formatNumber(summary?.monthlyDmLimit ?? 1_000)}`}
                detail={`${formatNumber(summary?.monthlyDmRemaining ?? 1_000)} remaining`}
                icon={Send}
                accent="pink"
                delay={80}
              />
              <KpiCard
                label="Leads"
                value={formatNumber(summary?.totalLeads ?? 0)}
                icon={Users}
                accent="emerald"
                delay={160}
              />
              <KpiCard
                label="Conversion"
                value={summary?.totalKeywordMatches ? `${summary.conversionRate}%` : "—"}
                icon={Percent}
                accent="blue"
                delay={240}
              />
            </>
          )}
        </div>
      </div>

      <div className="space-y-6">
        {!progress.loading && (!progress.instagramConnected || !progress.hasKeywordRule || !progress.hasSuccessfulDm) && (
          <QuickStartChecklist />
        )}
        <InstagramConnectionCard />
        <KeywordLeaderboard />
      </div>
    </div>
  );
}
