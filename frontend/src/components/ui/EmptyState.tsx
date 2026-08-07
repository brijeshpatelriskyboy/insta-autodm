import Link from "next/link";
import { Sparkles } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "./Button";

interface EmptyStateProps {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  /** Prefer for navigation CTAs so empty states work without a click handler. */
  actionHref?: string;
  icon?: ReactNode;
  compact?: boolean;
}

export function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
  actionHref,
  icon,
  compact = false,
}: EmptyStateProps) {
  const showAction = Boolean(actionLabel && (onAction || actionHref));

  return (
    <div
      className={`animate-fade-in flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-gradient-to-b from-white via-brand-50/20 to-slate-50/80 text-center ${
        compact ? "px-4 py-10" : "px-6 py-16"
      }`}
    >
      <div className={`relative ${compact ? "mb-4" : "mb-6"}`}>
        <div className="absolute inset-0 animate-pulse rounded-2xl bg-gradient-to-br from-brand-200/40 to-accent-200/40 blur-xl" />
        <div
          className={`relative flex items-center justify-center rounded-2xl bg-gradient-to-br from-brand-100 to-accent-100 shadow-sm ${
            compact ? "h-14 w-14" : "h-20 w-20"
          }`}
        >
          {icon ?? <Sparkles className={compact ? "h-7 w-7 text-brand-600" : "h-9 w-9 text-brand-600"} />}
        </div>
        {!compact && (
          <>
            <div className="absolute -right-2 -top-2 h-6 w-6 animate-pulse rounded-full bg-accent-500/30" />
            <div className="absolute -bottom-1 -left-3 h-4 w-4 rounded-full bg-brand-500/30" />
          </>
        )}
      </div>
      <h3 className={`font-semibold text-slate-900 ${compact ? "text-base" : "text-lg"}`}>
        {title}
      </h3>
      <p className="mt-2 max-w-sm text-sm leading-relaxed text-slate-500">{description}</p>
      {showAction && actionHref && (
        <Link href={actionHref} className="mt-6">
          <Button type="button">{actionLabel}</Button>
        </Link>
      )}
      {showAction && !actionHref && onAction && (
        <Button className="mt-6" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
