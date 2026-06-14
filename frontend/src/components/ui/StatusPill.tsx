type StatusType = "connected" | "disconnected" | "pending" | "error" | "active";

interface StatusPillProps {
  status: StatusType;
  label?: string;
}

const config: Record<StatusType, { label: string; className: string; dot: string }> = {
  connected: {
    label: "Connected",
    className: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
    dot: "bg-emerald-500",
  },
  active: {
    label: "Active",
    className: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
    dot: "bg-emerald-500",
  },
  disconnected: {
    label: "Disconnected",
    className: "bg-slate-100 text-slate-600 ring-slate-500/10",
    dot: "bg-slate-400",
  },
  pending: {
    label: "Pending",
    className: "bg-amber-50 text-amber-700 ring-amber-600/20",
    dot: "bg-amber-500",
  },
  error: {
    label: "Error",
    className: "bg-red-50 text-red-700 ring-red-600/20",
    dot: "bg-red-500",
  },
};

export function StatusPill({ status, label }: StatusPillProps) {
  const item = config[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${item.className}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${item.dot}`} />
      {label ?? item.label}
    </span>
  );
}
