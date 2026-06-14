"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  LineChart,
  Line,
} from "recharts";

const chartTooltipStyle = {
  borderRadius: "12px",
  border: "1px solid #e2e8f0",
  boxShadow: "0 4px 6px -1px rgb(15 23 42 / 0.08)",
};

interface DmActivityChartProps {
  data: { label: string; dms: number }[];
}

export function DmActivityChart({ data }: DmActivityChartProps) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
        <defs>
          <linearGradient id="dmGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.35} />
            <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
        <XAxis
          dataKey="label"
          axisLine={false}
          tickLine={false}
          tick={{ fill: "#64748b", fontSize: 11 }}
          interval="preserveStartEnd"
          minTickGap={40}
        />
        <YAxis
          axisLine={false}
          tickLine={false}
          tick={{ fill: "#64748b", fontSize: 11 }}
        />
        <Tooltip
          contentStyle={chartTooltipStyle}
          labelStyle={{ color: "#0f172a", fontWeight: 600 }}
        />
        <Area
          type="monotone"
          dataKey="dms"
          stroke="#7c3aed"
          strokeWidth={2.5}
          fill="url(#dmGradient)"
          name="DMs Sent"
          animationDuration={1200}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

interface LeadsChartProps {
  data: { label: string; leads: number }[];
}

export function LeadsChart({ data }: LeadsChartProps) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
        <defs>
          <linearGradient id="leadsGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ec4899" stopOpacity={1} />
            <stop offset="100%" stopColor="#f472b6" stopOpacity={0.8} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
        <XAxis
          dataKey="label"
          axisLine={false}
          tickLine={false}
          tick={{ fill: "#64748b", fontSize: 11 }}
          interval="preserveStartEnd"
          minTickGap={40}
        />
        <YAxis
          axisLine={false}
          tickLine={false}
          tick={{ fill: "#64748b", fontSize: 11 }}
        />
        <Tooltip
          contentStyle={chartTooltipStyle}
          labelStyle={{ color: "#0f172a", fontWeight: 600 }}
          cursor={{ fill: "#fdf2f8" }}
        />
        <Bar
          dataKey="leads"
          fill="url(#leadsGradient)"
          radius={[6, 6, 0, 0]}
          name="Leads"
          animationDuration={1200}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

interface ConversionChartProps {
  data: { label: string; rate: number }[];
}

export function ConversionChart({ data }: ConversionChartProps) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
        <XAxis
          dataKey="label"
          axisLine={false}
          tickLine={false}
          tick={{ fill: "#64748b", fontSize: 11 }}
          interval="preserveStartEnd"
          minTickGap={40}
        />
        <YAxis
          axisLine={false}
          tickLine={false}
          tick={{ fill: "#64748b", fontSize: 11 }}
          domain={["dataMin - 2", "dataMax + 2"]}
          tickFormatter={(v) => `${v}%`}
        />
        <Tooltip
          contentStyle={chartTooltipStyle}
          labelStyle={{ color: "#0f172a", fontWeight: 600 }}
          formatter={(value) => [`${value}%`, "Conversion"]}
        />
        <Line
          type="monotone"
          dataKey="rate"
          stroke="#3b82f6"
          strokeWidth={2.5}
          dot={false}
          activeDot={{ r: 5, fill: "#3b82f6" }}
          name="Conversion Rate"
          animationDuration={1200}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

interface TopKeywordsProps {
  keywords: {
    keyword: string;
    isActive: boolean;
    triggers: number;
    conversion: number;
  }[];
}

export function TopKeywords({ keywords }: TopKeywordsProps) {
  if (keywords.length === 0) {
    return null;
  }

  const maxTriggers = Math.max(...keywords.map((k) => k.triggers), 1);

  return (
    <div className="space-y-4">
      {keywords.map((item, index) => (
        <div
          key={item.keyword}
          className="animate-fade-in flex items-center gap-4"
          style={{ animationDelay: `${index * 60}ms` }}
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-xs font-semibold text-slate-600">
            {index + 1}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <p className="truncate font-medium text-slate-900">{item.keyword}</p>
              <span className="text-sm text-slate-500">
                {item.triggers.toLocaleString()} triggers
              </span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-gradient-to-r from-brand-500 to-accent-500 transition-all duration-700"
                style={{ width: `${(item.triggers / maxTriggers) * 100}%` }}
              />
            </div>
            <p className="mt-1 text-xs text-slate-400">{item.conversion}% conversion</p>
          </div>
        </div>
      ))}
    </div>
  );
}
