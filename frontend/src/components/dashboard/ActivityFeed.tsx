"use client";

import { Send, UserPlus } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { demoActivityFeed, formatRelativeTime } from "@/lib/demo-data";
import Link from "next/link";

const typeStyles = {
  dm_sent: "bg-brand-50 text-brand-600",
  lead: "bg-emerald-50 text-emerald-600",
};

export function ActivityFeed() {
  return (
    <Card
      title="Recent Activity"
      description="Live feed of automation events across your account."
    >
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
            <time className="shrink-0 text-xs text-slate-400">
              {formatRelativeTime(item.timestamp)}
            </time>
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
