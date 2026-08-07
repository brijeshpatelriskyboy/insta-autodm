export type ActivityType =
  | "dm_sent"
  | "dm_failed"
  | "comment_received"
  | "keyword_matched"
  | "dm_pending"
  | "lead_captured"
  | "rule_created"
  | "rule_updated"
  | "account_connected"
  | "account_disconnected"
  | "webhook_subscribed";

export interface ActivityEvent {
  id: string;
  type: ActivityType;
  title: string;
  description: string;
  timestamp: string;
  keyword?: string;
}

const typeLabels: Record<ActivityType, string> = {
  dm_sent: "DM Sent",
  dm_failed: "DM Failed",
  comment_received: "Comment Received",
  keyword_matched: "Keyword Matched",
  dm_pending: "DM Pending",
  lead_captured: "Lead Captured",
  rule_created: "Rule Created",
  rule_updated: "Rule Updated",
  account_connected: "Account Connected",
  account_disconnected: "Account Disconnected",
  webhook_subscribed: "Webhooks Enabled",
};

export function getActivityTypeLabel(type: string): string {
  return typeLabels[type as ActivityType] ?? type.replace(/_/g, " ");
}

export function filterEventsByDate(
  events: ActivityEvent[],
  dateFilter: string,
): ActivityEvent[] {
  if (!dateFilter) return events;

  const filterDate = new Date(dateFilter);
  const start = new Date(filterDate);
  start.setHours(0, 0, 0, 0);
  const end = new Date(filterDate);
  end.setHours(23, 59, 59, 999);

  return events.filter((event) => {
    const eventDate = new Date(event.timestamp);
    return eventDate >= start && eventDate <= end;
  });
}

/** Deterministic absolute format (same on server and client for a given timestamp). */
export function formatActivityTime(timestamp: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(new Date(timestamp));
}
