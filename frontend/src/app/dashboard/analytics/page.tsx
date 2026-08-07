"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { KpiCard } from "@/components/ui/KpiCard";
import { KpiCardSkeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { api, type AnalyticsSummary } from "@/lib/api";
import { getToken } from "@/lib/auth";
import { formatNumber } from "@/lib/demo-data";
import { MessageSquare, Users, Percent, Zap, BarChart3 } from "lucide-react";

export default function AnalyticsPage() {
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);

  useEffect(() => {
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

  const hasData =
    !!summary &&
    (summary.totalKeywordRules > 0 ||
      summary.totalDmEvents > 0 ||
      summary.totalLeads > 0);

  const conversion =
    summary && summary.totalDmEvents > 0
      ? `${Math.round((summary.totalLeads / summary.totalDmEvents) * 1000) / 10}%`
      : "—";

  return (
    <div className="space-y-8">
      <PageHeader
        title="Analytics"
        description="Performance from your live Instagram automations."
      />

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
              icon={MessageSquare}
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
              value={conversion}
              icon={Percent}
              accent="blue"
              delay={240}
            />
          </>
        )}
      </div>

      {!loading && !hasData && (
        <EmptyState
          title="No analytics data yet"
          description="Once your automations send DMs, you’ll see performance metrics here."
          actionLabel="Create a keyword rule"
          actionHref="/dashboard/rules"
          icon={<BarChart3 className="h-9 w-9 text-brand-600" />}
        />
      )}
    </div>
  );
}
