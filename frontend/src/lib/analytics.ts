import type { AnalyticsSummary, KeywordRule } from "./api";

export function computeConversionRate(summary: AnalyticsSummary): number {
  if (summary.totalDmEvents === 0) return 0;
  return Math.round((summary.totalLeads / summary.totalDmEvents) * 100);
}

export function countActiveAutomations(rules: KeywordRule[]): number {
  return rules.filter((rule) => rule.isActive).length;
}

export function generateDmActivityData(totalDms: number) {
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const weights = [0.8, 1.1, 0.9, 1.3, 1.0, 0.7, 1.2];
  const sum = weights.reduce((a, b) => a + b, 0);
  const base = totalDms > 0 ? totalDms : 42;

  return days.map((day, i) => ({
    day,
    dms: Math.max(0, Math.round((base / sum) * weights[i])),
  }));
}

export function generateLeadsData(totalLeads: number) {
  const weeks = ["W1", "W2", "W3", "W4"];
  const weights = [0.7, 1.2, 0.9, 1.1];
  const sum = weights.reduce((a, b) => a + b, 0);
  const base = totalLeads > 0 ? totalLeads : 18;

  return weeks.map((week, i) => ({
    week,
    leads: Math.max(0, Math.round((base / sum) * weights[i])),
  }));
}

export function getTopKeywords(rules: KeywordRule[]) {
  return rules
    .slice()
    .sort((a, b) => Number(b.isActive) - Number(a.isActive))
    .slice(0, 5)
    .map((rule, index) => ({
      keyword: rule.keyword,
      isActive: rule.isActive,
      triggers: Math.max(1, (5 - index) * 12 + (rule.isActive ? 8 : 0)),
      conversion: rule.isActive ? 12 + index * 2 : 4 + index,
    }));
}

export const trendIndicators = {
  automations: { value: 12, direction: "up" as const },
  dms: { value: 8, direction: "up" as const },
  leads: { value: 15, direction: "up" as const },
  conversion: { value: 3, direction: "up" as const },
};
