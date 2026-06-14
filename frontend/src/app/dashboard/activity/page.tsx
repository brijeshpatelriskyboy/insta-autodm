"use client";

import { useMemo, useState } from "react";
import {
  Send,
  MessageSquare,
  UserPlus,
  PlusCircle,
  Pencil,
  Calendar,
  Filter,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  mockActivityEvents,
  filterEventsByDate,
  formatActivityTime,
  getActivityTypeLabel,
  type ActivityEvent,
  type ActivityType,
} from "@/lib/activity";

const typeIcons: Record<ActivityType, React.ComponentType<{ className?: string }>> = {
  dm_sent: Send,
  keyword_matched: MessageSquare,
  lead_captured: UserPlus,
  rule_created: PlusCircle,
  rule_updated: Pencil,
};

const typeColors: Record<ActivityType, string> = {
  dm_sent: "bg-brand-50 text-brand-600",
  keyword_matched: "bg-pink-50 text-pink-600",
  lead_captured: "bg-emerald-50 text-emerald-600",
  rule_created: "bg-blue-50 text-blue-600",
  rule_updated: "bg-amber-50 text-amber-600",
};

function ActivityItem({ event }: { event: ActivityEvent }) {
  const Icon = typeIcons[event.type];

  return (
    <div className="flex gap-4 rounded-xl border border-slate-100 bg-white p-4 transition-colors hover:border-slate-200 hover:bg-slate-50/50">
      <div
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${typeColors[event.type]}`}
      >
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="font-medium text-slate-900">{event.title}</p>
            <p className="mt-1 text-sm text-slate-500">{event.description}</p>
          </div>
          <time className="shrink-0 text-xs text-slate-400">
            {formatActivityTime(event.timestamp)}
          </time>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
            {getActivityTypeLabel(event.type)}
          </span>
          {event.keyword && (
            <span className="rounded-md bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700">
              {event.keyword}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ActivityPage() {
  const [dateFilter, setDateFilter] = useState("");

  const filteredEvents = useMemo(
    () => filterEventsByDate(mockActivityEvents, dateFilter),
    [dateFilter],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Activity Log"
        description="A timeline of automation events across your keyword rules and DMs."
      />

      <Card padding="sm">
        <div className="flex flex-col gap-4 p-2 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label
              htmlFor="date-filter"
              className="mb-1.5 flex items-center gap-2 text-sm font-medium text-slate-700"
            >
              <Calendar className="h-4 w-4 text-slate-400" />
              Filter by date
            </label>
            <input
              id="date-filter"
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="h-10 w-full max-w-xs rounded-[var(--radius-button)] border border-slate-200 bg-white px-3 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
            />
          </div>
          {dateFilter && (
            <Button variant="secondary" onClick={() => setDateFilter("")}>
              <Filter className="h-4 w-4" />
              Clear filter
            </Button>
          )}
        </div>
      </Card>

      <div className="space-y-3">
        {filteredEvents.length === 0 ? (
          <EmptyState
            title="No events for this date"
            description="Try selecting a different date or clear the filter to see all activity."
            actionLabel="Clear filter"
            onAction={() => setDateFilter("")}
          />
        ) : (
          <>
            <p className="text-sm text-slate-500">
              Showing {filteredEvents.length} event
              {filteredEvents.length !== 1 ? "s" : ""}
              {dateFilter ? ` for ${dateFilter}` : ""}
            </p>
            {filteredEvents.map((event) => (
              <ActivityItem key={event.id} event={event} />
            ))}
          </>
        )}
      </div>

      <p className="text-center text-xs text-slate-400">
        Activity data is illustrative until live Meta webhook integration is enabled.
      </p>
    </div>
  );
}
