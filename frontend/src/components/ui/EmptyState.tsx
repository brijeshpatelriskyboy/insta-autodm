import { Sparkles } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "./Button";

interface EmptyStateProps {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  icon?: ReactNode;
}

export function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
  icon,
}: EmptyStateProps) {
  return (
    <div className="animate-fade-in flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-gradient-to-b from-white via-brand-50/20 to-slate-50/80 px-6 py-16 text-center">
      <div className="relative mb-6">
        <div className="absolute inset-0 animate-pulse rounded-2xl bg-gradient-to-br from-brand-200/40 to-accent-200/40 blur-xl" />
        <div className="relative flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-100 to-accent-100 shadow-sm">
          {icon ?? <Sparkles className="h-9 w-9 text-brand-600" />}
        </div>
        <div className="absolute -right-2 -top-2 h-6 w-6 animate-pulse rounded-full bg-accent-500/30" />
        <div className="absolute -bottom-1 -left-3 h-4 w-4 rounded-full bg-brand-500/30" />
      </div>
      <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
      <p className="mt-2 max-w-sm text-sm leading-relaxed text-slate-500">{description}</p>
      {actionLabel && onAction && (
        <Button className="mt-6" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
