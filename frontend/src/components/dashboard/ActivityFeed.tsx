"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Send,
  MessageSquare,
  MessageCircle,
  AlertCircle,
  Clock,
  Circle,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { ClientTime } from "@/components/ui/ClientTime";
import { EmptyState } from "@/components/ui/EmptyState";
import { api, type ActivityEventRecord } from "@/lib/api";
import { getToken } from "@/lib/auth";
import { formatRelativeTime } from "@/lib/demo-data";

const typeStyles: Record<string, string> = {
  dm_sent: "bg-brand-50 text-brand-600",
  dm_failed: "bg-red-50 text-red-600",
  comment_received: "bg-sky-50 text-sky-600",
  keyword_matched: "bg-pink-50 text-pink-600",
  dm_pending: "bg-amber-50 text-amber-600",
};

function iconForType(type: string) {
  switch (type) {
    case "dm_sent":
      return Send;
    case "dm_failed":
      return AlertCircle;
    case "comment_received":
      return MessageCircle;
    case "keyword_matched":
      return MessageSquare;
    case "dm_pending":
      return Clock;
    default:
      return Circle;
  }
}

export function ActivityFeed() {
  const [events, setEvents] = useState<ActivityEventRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    api
      .getActivityEvents(token)
      .then((value) => {
        if (cancelled) return;
        const sorted = [...value].sort(
          (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
        );
        setEvents(sorted.slice(0, 6));
      })
      .catch(() => {
        if (!cancelled) setEvents([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <Card title="Recent Activity" description="Loading your automation events…">
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-14 animate-pulse rounded-xl bg-slate-100" />
          ))}
        </div>
      </Card>
    );
  }

  if (events.length === 0) {
    return (
      <Card title="Recent Activity">
        <EmptyState
          compact
          title="No activity yet"
          description="When someone comments a keyword on your post, you’ll see it here — comment received, keyword matched, then DM sent."
          actionLabel="Create a keyword rule"
          actionHref="/dashboard/rules"
          icon={<MessageCircle className="h-7 w-7 text-brand-600" />}
        />
        <Link
          href="/dashboard/activity"
          className="mt-4 block text-center text-sm font-medium text-brand-600 transition-colors hover:text-brand-700"
        >
          Open Activity →
        </Link>
      </Card>
    );
  }

  return (
    <Card
      title="Recent Activity"
      description="Live automation events from your connected Instagram account."
    >
      <div className="space-y-1">
        {events.map((item, index) => {
          const Icon = iconForType(item.type);
          const colorClass = typeStyles[item.type] ?? "bg-slate-100 text-slate-600";
          return (
            <div
              key={item.id}
              className="animate-fade-in flex gap-3 rounded-xl px-3 py-3 transition-colors hover:bg-slate-50"
              style={{ animationDelay: `${index * 60}ms` }}
            >
              <div
                className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${colorClass}`}
              >
                <Icon className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                <p className="mt-0.5 text-xs text-slate-500">{item.description}</p>
              </div>
              <ClientTime
                timestamp={item.timestamp}
                format={formatRelativeTime}
                className="shrink-0 text-xs text-slate-400"
              />
            </div>
          );
        })}
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
