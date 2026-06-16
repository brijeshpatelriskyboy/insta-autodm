export type ActivityType =
  | "dm_sent"
  | "keyword_matched"
  | "lead_captured"
  | "rule_created"
  | "rule_updated"
  | "account_connected"
  | "account_disconnected";

export interface ActivityEvent {
  id: string;
  type: ActivityType;
  title: string;
  description: string;
  timestamp: string;
  keyword?: string;
  isSample?: boolean;
}

const typeLabels: Record<ActivityType, string> = {
  dm_sent: "DM Sent",
  keyword_matched: "Keyword Matched",
  lead_captured: "Lead Captured",
  rule_created: "Rule Created",
  rule_updated: "Rule Updated",
  account_connected: "Account Connected",
  account_disconnected: "Account Disconnected",
};

export function getActivityTypeLabel(type: ActivityType): string {
  return typeLabels[type];
}

export const mockActivityEvents: ActivityEvent[] = [
  {
    id: "mock-1",
    isSample: true,
    type: "keyword_matched",
    title: "Keyword matched: GUIDE",
    description: "User @creator_fan commented on your latest reel.",
    timestamp: new Date(Date.now() - 1000 * 60 * 25).toISOString(),
    keyword: "GUIDE",
  },
  {
    id: "mock-2",
    isSample: true,
    type: "dm_sent",
    title: "DM sent successfully",
    description: "Automated guide link delivered to @creator_fan.",
    timestamp: new Date(Date.now() - 1000 * 60 * 24).toISOString(),
    keyword: "GUIDE",
  },
  {
    id: "mock-3",
    isSample: true,
    type: "lead_captured",
    title: "New lead captured",
    description: "Lead added from GUIDE keyword conversation.",
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(),
    keyword: "GUIDE",
  },
  {
    id: "mock-4",
    isSample: true,
    type: "keyword_matched",
    title: "Keyword matched: START",
    description: "User @new_follower commented on your carousel post.",
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 8).toISOString(),
    keyword: "START",
  },
  {
    id: "mock-5",
    isSample: true,
    type: "dm_sent",
    title: "DM sent successfully",
    description: "Welcome sequence triggered for @new_follower.",
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 8 - 5000).toISOString(),
    keyword: "START",
  },
  {
    id: "mock-6",
    isSample: true,
    type: "rule_updated",
    title: "Rule updated: PDF",
    description: "PDF keyword rule set to inactive.",
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
    keyword: "PDF",
  },
  {
    id: "mock-7",
    isSample: true,
    type: "rule_created",
    title: "Rule created: GUIDE",
    description: "New automation rule added to your account.",
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3).toISOString(),
    keyword: "GUIDE",
  },
  {
    id: "mock-8",
    isSample: true,
    type: "keyword_matched",
    title: "Keyword matched: PDF",
    description: "User @design_lover requested a PDF download.",
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5).toISOString(),
    keyword: "PDF",
  },
];

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

export function formatActivityTime(timestamp: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(timestamp));
}
