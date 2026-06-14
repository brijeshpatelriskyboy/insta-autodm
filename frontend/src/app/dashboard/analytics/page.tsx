"use client";

import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { KpiCard } from "@/components/ui/KpiCard";
import { ChartSkeleton, KpiCardSkeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  DmActivityChart,
  LeadsChart,
  ConversionChart,
  TopKeywords,
} from "@/components/analytics/Charts";
import {
  demoMetrics,
  demoTrends,
  demoTopKeywords,
  formatNumber,
  getDemoDmChart30Day,
  getDemoLeadsChart30Day,
  getDemoConversionChart30Day,
} from "@/lib/demo-data";
import { MessageSquare, Users, Percent, Zap, BarChart3 } from "lucide-react";

export default function AnalyticsPage() {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 700);
    return () => clearTimeout(timer);
  }, []);

  const dmData = useMemo(() => getDemoDmChart30Day(), []);
  const leadsData = useMemo(() => getDemoLeadsChart30Day(), []);
  const conversionData = useMemo(() => getDemoConversionChart30Day(), []);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Analytics"
        description="30-day performance across DMs, leads, and conversion trends."
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
              label="Active Automations"
              value={demoMetrics.activeAutomations}
              icon={Zap}
              trend={demoTrends.activeAutomations}
              accent="violet"
              delay={0}
            />
            <KpiCard
              label="Total DMs Sent"
              value={formatNumber(demoMetrics.totalDmsSent)}
              icon={MessageSquare}
              trend={demoTrends.totalDmsSent}
              accent="pink"
              delay={80}
            />
            <KpiCard
              label="Leads Generated"
              value={formatNumber(demoMetrics.leadsGenerated)}
              icon={Users}
              trend={demoTrends.leadsGenerated}
              accent="emerald"
              delay={160}
            />
            <KpiCard
              label="Conversion Rate"
              value={`${demoMetrics.conversionRate}%`}
              icon={Percent}
              trend={demoTrends.conversionRate}
              accent="blue"
              delay={240}
            />
          </>
        )}
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        {loading ? (
          <>
            <ChartSkeleton />
            <ChartSkeleton />
          </>
        ) : (
          <>
            <Card title="DM Activity" description="DMs sent over the last 30 days">
              <DmActivityChart data={dmData} />
            </Card>
            <Card title="Leads Generated" description="Daily leads captured over 30 days">
              <LeadsChart data={leadsData} />
            </Card>
          </>
        )}
      </div>

      <Card
        title="Conversion Rate Trend"
        description="How effectively DMs convert into leads over 30 days"
      >
        {loading ? (
          <ChartSkeleton />
        ) : (
          <ConversionChart data={conversionData} />
        )}
      </Card>

      <Card title="Top Keywords" description="Best-performing keyword triggers">
        {loading ? (
          <div className="space-y-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-16 animate-pulse rounded-xl bg-slate-100" />
            ))}
          </div>
        ) : (
          <TopKeywords keywords={demoTopKeywords} />
        )}
      </Card>

      {!loading && demoTopKeywords.length === 0 && (
        <EmptyState
          title="No analytics data yet"
          description="Once your automations go live, you'll see detailed performance metrics here."
          icon={<BarChart3 className="h-9 w-9 text-brand-600" />}
        />
      )}
    </div>
  );
}
