import type { LucideIcon } from "lucide-react";
import { TrendingDown, TrendingUp } from "lucide-react";
import { Skeleton } from "./Skeleton";

interface KpiCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  trend?: { value: number; direction: "up" | "down"; isDecimal?: boolean };
  loading?: boolean;
  accent?: "violet" | "pink" | "emerald" | "blue";
  delay?: number;
}

const accents = {
  violet: "from-brand-500 to-brand-600",
  pink: "from-accent-500 to-accent-600",
  emerald: "from-emerald-500 to-emerald-600",
  blue: "from-blue-500 to-blue-600",
};

export function KpiCard({
  label,
  value,
  icon: Icon,
  trend,
  loading,
  accent = "violet",
  delay = 0,
}: KpiCardProps) {
  if (loading) {
    return <Skeleton className="h-[132px] w-full rounded-2xl" />;
  }

  const TrendIcon = trend?.direction === "up" ? TrendingUp : TrendingDown;
  const trendColor =
    trend?.direction === "up" ? "text-emerald-600" : "text-red-500";

  return (
    <div
      className="animate-fade-in group rounded-2xl border border-slate-200/80 bg-white p-6 shadow-card transition-all duration-300 hover:-translate-y-0.5 hover:border-brand-200/60 hover:shadow-elevated"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">{label}</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">
            {value}
          </p>
        </div>
        <div
          className={`flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br ${accents[accent]} text-white shadow-sm transition-transform duration-300 group-hover:scale-105`}
        >
          <Icon className="h-5 w-5" />
        </div>
      </div>
      {trend && (
        <div className={`mt-4 flex items-center gap-1.5 text-sm font-medium ${trendColor}`}>
          <TrendIcon className="h-4 w-4" />
          <span>+{trend.value}%</span>
          <span className="font-normal text-slate-400">vs last month</span>
        </div>
      )}
    </div>
  );
}
