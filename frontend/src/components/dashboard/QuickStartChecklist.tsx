"use client";

import Link from "next/link";
import { Check, Circle } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { demoOnboardingChecklist } from "@/lib/demo-data";

const linkMap: Record<string, string> = {
  account: "/dashboard",
  rule: "/dashboard/rules",
  instagram: "/dashboard/integrations",
  launch: "/dashboard/rules",
  lead: "/dashboard/analytics",
};

export function QuickStartChecklist() {
  const completed = demoOnboardingChecklist.filter((i) => i.completed).length;
  const progress = Math.round((completed / demoOnboardingChecklist.length) * 100);

  return (
    <Card title="Quick Start" description="Complete setup to go live with automations.">
      <div className="mb-5">
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="font-medium text-slate-700">Progress</span>
          <span className="text-slate-500">{progress}% complete</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-gradient-to-r from-brand-500 to-accent-500 transition-all duration-700 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <ul className="space-y-3">
        {demoOnboardingChecklist.map((item) => (
          <li key={item.id}>
            <Link
              href={linkMap[item.id] ?? "/dashboard"}
              className="group flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/50 px-4 py-3 transition-all hover:border-brand-200 hover:bg-brand-50/40"
            >
              {item.completed ? (
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
                  item.completed ? "text-slate-500 line-through" : "text-slate-900"
                }`}
              >
                {item.label}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}
