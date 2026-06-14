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
import {
  demoMetrics,
  demoTrends,
  formatNumber,
} from "@/lib/demo-data";
import { getStoredUser } from "@/lib/auth";

export default function DashboardPage() {
  const user = getStoredUser();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 600);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="space-y-8">
      <PageHeader
        title={`Welcome back${user?.name ? `, ${user.name}` : ""}`}
        description="Your automations are performing well — here's what's happening today."
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
              icon={Send}
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
