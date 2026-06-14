"use client";

import { Trophy } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { demoTopKeywords } from "@/lib/demo-data";
import { EmptyState } from "@/components/ui/EmptyState";
import Link from "next/link";

export function KeywordLeaderboard() {
  const keywords = demoTopKeywords;

  if (keywords.length === 0) {
    return (
      <Card title="Top Performing Keywords">
        <EmptyState
          title="No keyword data yet"
          description="Create keyword rules to see which triggers perform best with your audience."
          actionLabel="Create a rule"
          icon={<Trophy className="h-9 w-9 text-brand-600" />}
        />
      </Card>
    );
  }

  const maxTriggers = keywords[0].triggers;

  return (
    <Card
      title="Top Performing Keywords"
      description="Leaderboard by total trigger volume."
    >
      <div className="space-y-4">
        {keywords.map((item, index) => (
          <div
            key={item.keyword}
            className="animate-fade-in group rounded-xl border border-slate-100 p-4 transition-all hover:border-brand-200 hover:shadow-sm"
            style={{ animationDelay: `${index * 80}ms` }}
          >
            <div className="flex items-center gap-4">
              <span
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-bold ${
                  index === 0
                    ? "bg-gradient-to-br from-amber-400 to-amber-500 text-white"
                    : index === 1
                      ? "bg-slate-200 text-slate-700"
                      : index === 2
                        ? "bg-amber-100 text-amber-800"
                        : "bg-slate-100 text-slate-600"
                }`}
              >
                {index + 1}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold text-slate-900">{item.keyword}</p>
                  <p className="text-sm font-medium text-slate-600">
                    {item.triggers.toLocaleString()} triggers
                  </p>
                </div>
                <div className="mt-2.5 h-2 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-brand-500 to-accent-500 transition-all duration-700 ease-out group-hover:from-brand-600 group-hover:to-accent-600"
                    style={{ width: `${(item.triggers / maxTriggers) * 100}%` }}
                  />
                </div>
                <p className="mt-1.5 text-xs text-slate-400">
                  {item.conversion}% conversion rate
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
      <Link
        href="/dashboard/analytics"
        className="mt-4 block text-center text-sm font-medium text-brand-600 transition-colors hover:text-brand-700"
      >
        View full analytics →
      </Link>
    </Card>
  );
}
