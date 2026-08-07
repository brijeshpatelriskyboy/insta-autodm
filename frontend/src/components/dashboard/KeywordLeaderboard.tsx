"use client";

import { Trophy } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";

export function KeywordLeaderboard() {
  return (
    <Card title="Top Performing Keywords">
      <EmptyState
        compact
        title="No keyword data yet"
        description="Create keyword rules and send DMs to see which triggers perform best."
        actionLabel="Create a rule"
        actionHref="/dashboard/rules"
        icon={<Trophy className="h-7 w-7 text-brand-600" />}
      />
    </Card>
  );
}
