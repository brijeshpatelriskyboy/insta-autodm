export const demoMetrics = {
  activeAutomations: 12,
  totalDmsSent: 2847,
  leadsGenerated: 634,
  conversionRate: 22.3,
};

export const demoTrends = {
  activeAutomations: { value: 18, direction: "up" as const },
  totalDmsSent: { value: 42, direction: "up" as const },
  leadsGenerated: { value: 31, direction: "up" as const },
  conversionRate: { value: 4.7, direction: "up" as const, isDecimal: true },
};

export const demoInstagramAccount = {
  accountName: "@creatorstudio",
  displayName: "Creator Studio",
  status: "connected" as const,
  followers: "24.8K",
  lastSync: "2 minutes ago",
  profileImage: null,
};

export const demoTopKeywords = [
  { keyword: "GUIDE", triggers: 1245, conversion: 24, isActive: true },
  { keyword: "START", triggers: 867, conversion: 21, isActive: true },
  { keyword: "PDF", triggers: 523, conversion: 18, isActive: true },
  { keyword: "COACHING", triggers: 321, conversion: 15, isActive: true },
];

export const demoActivityFeed = [
  {
    id: "a1",
    user: "Sarah",
    action: "commented GUIDE",
    result: "DM sent",
    detail: "Free guide link delivered",
    timestamp: new Date(Date.now() - 1000 * 60 * 4).toISOString(),
    type: "dm_sent" as const,
  },
  {
    id: "a2",
    user: "Mike",
    action: "commented START",
    result: "DM sent",
    detail: "Welcome sequence triggered",
    timestamp: new Date(Date.now() - 1000 * 60 * 18).toISOString(),
    type: "dm_sent" as const,
  },
  {
    id: "a3",
    user: "Emma",
    action: "downloaded Free Guide",
    result: "Lead captured",
    detail: "GUIDE keyword conversion",
    timestamp: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
    type: "lead" as const,
  },
  {
    id: "a4",
    user: "James",
    action: "commented COACHING",
    result: "DM sent",
    detail: "Coaching offer link sent",
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
    type: "dm_sent" as const,
  },
  {
    id: "a5",
    user: "Priya",
    action: "lead captured",
    result: "From Instagram",
    detail: "START keyword funnel",
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
    type: "lead" as const,
  },
  {
    id: "a6",
    user: "Alex",
    action: "commented PDF",
    result: "DM sent",
    detail: "PDF download link delivered",
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 8).toISOString(),
    type: "dm_sent" as const,
  },
];

export const demoOnboardingChecklist = [
  { id: "account", label: "Create account", completed: true },
  { id: "rule", label: "Create first keyword rule", completed: true },
  { id: "instagram", label: "Connect Instagram", completed: false },
  { id: "launch", label: "Launch first automation", completed: false },
  { id: "lead", label: "Capture first lead", completed: false },
];

function generate30DaySeries(
  total: number,
  variance: number,
  key: string,
): { date: string; label: string; [key: string]: string | number }[] {
  const days = 30;
  const data = [];
  const now = new Date();

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const label = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    const date = d.toISOString().split("T")[0];
    const base = total / days;
    const wave = Math.sin(i / 3) * variance;
    const noise = ((i * 7) % 13) - 6;
    const value = Math.max(0, Math.round(base + wave + noise));

    data.push({ date, label, [key]: value });
  }

  return data;
}

export function getDemoDmChart30Day() {
  return generate30DaySeries(2847, 40, "dms") as {
    date: string;
    label: string;
    dms: number;
  }[];
}

export function getDemoLeadsChart30Day() {
  return generate30DaySeries(634, 12, "leads") as {
    date: string;
    label: string;
    leads: number;
  }[];
}

export function getDemoConversionChart30Day() {
  const data = [];
  const now = new Date();

  for (let i = 29; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const label = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    const date = d.toISOString().split("T")[0];
    const rate = 18 + Math.sin(i / 4) * 3 + (29 - i) * 0.15;
    data.push({ date, label, rate: Math.round(rate * 10) / 10 });
  }

  return data;
}

export function formatNumber(n: number): string {
  return n.toLocaleString("en-US");
}

export function formatRelativeTime(timestamp: string): string {
  const diff = Date.now() - new Date(timestamp).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
