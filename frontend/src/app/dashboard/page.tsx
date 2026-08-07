"use client";

import { useEffect, useState } from "react";
import { Zap, Send, Users, Percent } from "lucide-react";
import { KpiCard } from "@/components/ui/KpiCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { KpiCardSkeleton } from "@/components/ui/Skeleton";
import { ActivityFeed } from "@/components/dashboard/ActivityFeed";
import { InstagramConnectionCard } from "@/components/dashboard/InstagramConnectionCard";
import { KeywordLeaderboard } from "@/components/dashboard/KeywordLeaderboard";
import { QuickStartChecklist } from "@/components/dashboard/QuickStartChecklist";
import { BetaBadge } from "@/components/trust/BetaBadge";
import { api, type AnalyticsSummary, type User } from "@/lib/api";
import { getStoredUser, getToken } from "@/lib/auth";
import { useOnboardingProgress } from "@/hooks/useOnboardingProgress";
import { formatNumber } from "@/lib/demo-data";

export default function DashboardPage() {
  const [user, setUser] = useState<User | null>(null);
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const progress = useOnboardingProgress();

  useEffect(() => {
    setUser(getStoredUser());
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

  const greeting = progress.loading
    ? "Welcome"
    : progress.isReturning
      ? "Welcome back"
      : "Welcome";

  return (
    <div className="space-y-8">
      <PageHeader
        title={
          <span className="inline-flex flex-wrap items-center gap-2">
            {greeting}
            {user?.name ? `, ${user.name}` : ""}
            <BetaBadge />
          </span>
        }
        description="You're in early access — Comment2DM is in beta for connected Instagram test accounts."
      />

      <div className="rounded-xl border border-amber-200/80 bg-amber-50/60 px-4 py-3 text-sm text-amber-900">
        <span className="font-semibold">Beta:</span> Live Instagram connect and DMs work.
        Overview numbers reflect your account only — not sample data.
      </div>

      <div>
        <div className="mb-3 flex items-center gap-2">
          <h2 className="text-sm font-semibold text-slate-700">Performance overview</h2>
        </div>
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
                label="Total DMs"
                value={formatNumber(summary?.totalDmEvents ?? 0)}
                icon={Send}
                accent="pink"
                delay={80}
              />
              <KpiCard
                label="Leads Generated"
                value={formatNumber(summary?.totalLeads ?? 0)}
                icon={Users}
                accent="emerald"
                delay={160}
              />
              <KpiCard
                label="Conversion Rate"
                value={
                  summary && summary.totalDmEvents > 0
                    ? `${Math.round((summary.totalLeads / summary.totalDmEvents) * 1000) / 10}%`
                    : "—"
                }
                icon={Percent}
                accent="blue"
                delay={240}
              />
            </>
          )}
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="animate-slide-up space-y-6 xl:col-span-2" style={{ animationDelay: "200ms" }}>
          <ActivityFeed />
          <KeywordLeaderboard />
        </div>
        <div className="animate-slide-up space-y-6" style={{ animationDelay: "300ms" }}>
          <QuickStartChecklist />
          <InstagramConnectionCard />
        </div>
      </div>
    </div>
  );
}
