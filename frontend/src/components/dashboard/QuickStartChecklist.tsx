"use client";

import Link from "next/link";
import { Check, Circle } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { useOnboardingProgress } from "@/hooks/useOnboardingProgress";

const checklistItems = [
  {
    id: "instagram",
    label: "Connect Instagram",
    href: "/dashboard/integrations",
    doneKey: "instagramConnected" as const,
  },
  {
    id: "rule",
    label: "Create first keyword rule",
    href: "/dashboard/rules",
    doneKey: "hasKeywordRule" as const,
  },
  {
    id: "dm",
    label: "First successful DM sent",
    href: "/dashboard/activity",
    doneKey: "hasSuccessfulDm" as const,
  },
];

export function QuickStartChecklist() {
  const progress = useOnboardingProgress();

  const completedCount = checklistItems.filter((item) => progress[item.doneKey]).length;
  const total = checklistItems.length;
  const percent = progress.loading ? 0 : Math.round((completedCount / total) * 100);

  return (
    <Card
      title="Quick Start"
      description="Your real setup progress — complete these to send your first automated DM."
    >
      <div className="mb-5">
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="font-medium text-slate-700">Progress</span>
          <span className="text-slate-500">
            {progress.loading ? "Loading…" : `${percent}% complete`}
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-gradient-to-r from-brand-500 to-accent-500 transition-all duration-700 ease-out"
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>

      <ul className="space-y-3">
        {checklistItems.map((item) => {
          const completed = progress[item.doneKey];
          return (
            <li key={item.id}>
              <Link
                href={item.href}
                className="group flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/50 px-4 py-3 transition-all hover:border-brand-200 hover:bg-brand-50/40"
              >
                {progress.loading ? (
                  <span className="h-6 w-6 animate-pulse rounded-full bg-slate-200" />
                ) : completed ? (
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 text-white">
                    <Check className="h-3.5 w-3.5" />
                  </span>
                ) : (
                  <span className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-slate-300 text-slate-400">
                    <Circle className="h-3 w-3" />
                  </span>
                )}
                <span
                  className={`text-sm font-medium ${
                    completed ? "text-slate-500 line-through" : "text-slate-900"
                  }`}
                >
                  {item.label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
