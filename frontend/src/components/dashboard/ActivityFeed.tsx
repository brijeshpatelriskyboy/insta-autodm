"use client";

import { useCallback } from "react";
import { Send, UserPlus } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { ClientTime } from "@/components/ui/ClientTime";
import { SampleDataLabel } from "@/components/trust/SampleDataLabel";
import { demoActivityFeed, formatRelativeTime } from "@/lib/demo-data";
import Link from "next/link";

const typeStyles = {
  dm_sent: "bg-brand-50 text-brand-600",
  lead: "bg-emerald-50 text-emerald-600",
};

export function ActivityFeed() {
  const format = useCallback((timestamp: string) => formatRelativeTime(timestamp), []);

  return (
    <Card
      title="Recent Activity"
      description="Example automation events for preview — not from your live account."
    >
      <div className="mb-4">
        <SampleDataLabel />
      </div>
      <div className="space-y-1">
        {demoActivityFeed.map((item, index) => (
          <div
            key={item.id}
            className="animate-fade-in flex gap-3 rounded-xl px-3 py-3 transition-colors hover:bg-slate-50"
            style={{ animationDelay: `${index * 60}ms` }}
          >
            <div
              className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                typeStyles[item.type]
              }`}
            >
              {item.type === "lead" ? (
                <UserPlus className="h-4 w-4" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm text-slate-900">
                <span className="font-semibold">{item.user}</span>{" "}
                <span className="text-slate-600">{item.action}</span>
                <span className="text-slate-400"> → </span>
                <span className="font-medium text-brand-600">{item.result}</span>
              </p>
              <p className="mt-0.5 text-xs text-slate-500">{item.detail}</p>
            </div>
            <ClientTime
              timestamp={item.timestamp}
              format={format}
              className="shrink-0 text-xs text-slate-400"
            />
          </div>
        ))}
      </div>
      <Link
        href="/dashboard/activity"
        className="mt-4 block text-center text-sm font-medium text-brand-600 transition-colors hover:text-brand-700"
      >
        View all activity →
      </Link>
    </Card>
  );
}
