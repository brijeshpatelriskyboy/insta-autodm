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
import { SampleDataLabel } from "@/components/trust/SampleDataLabel";
import {
  demoMetrics,
  demoTrends,
  formatNumber,
} from "@/lib/demo-data";
import { getStoredUser } from "@/lib/auth";
import type { User } from "@/lib/api";

export default function DashboardPage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setUser(getStoredUser());
    const timer = setTimeout(() => setLoading(false), 600);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="space-y-8">
      <PageHeader
        title={
          <span className="inline-flex flex-wrap items-center gap-2">
            Welcome back{user?.name ? `, ${user.name}` : ""}
            <BetaBadge />
          </span>
        }
        description="You're in early access — Comment2DM is in beta for connected Instagram test accounts."
      />

      <div className="rounded-xl border border-amber-200/80 bg-amber-50/60 px-4 py-3 text-sm text-amber-900">
        <span className="font-semibold">Beta disclaimer:</span> Overview metrics may include
        sample preview data. Live Instagram automation for Business and Creator accounts is
        available after you connect a test account and enable comment webhooks.
      </div>

      <div>
        <div className="mb-3 flex items-center gap-2">
          <h2 className="text-sm font-semibold text-slate-700">Performance overview</h2>
          <SampleDataLabel />
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
