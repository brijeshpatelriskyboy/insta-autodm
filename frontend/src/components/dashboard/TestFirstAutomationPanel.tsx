"use client";

import Link from "next/link";
import { Button } from "@/components/ui/Button";

type TestFirstAutomationPanelProps = {
  onEditRule?: () => void;
  onDismiss?: () => void;
  /** When no onEditRule handler is provided, secondary links here (default: rules page). */
  editHref?: string;
};

export function TestFirstAutomationPanel({
  onEditRule,
  onDismiss,
  editHref = "/dashboard/rules",
}: TestFirstAutomationPanelProps) {
  return (
    <div className="rounded-xl border border-brand-200/80 bg-brand-50/40 px-5 py-5">
      <div className="flex items-start justify-between gap-4">
        <h2 className="text-base font-semibold text-slate-900">
          Test your first automation
        </h2>
        {onDismiss ? (
          <button
            type="button"
            onClick={onDismiss}
            className="shrink-0 text-xs font-medium text-slate-500 hover:text-slate-700"
          >
            Dismiss
          </button>
        ) : null}
      </div>

      <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm leading-relaxed text-slate-700">
        <li>
          Open the Instagram post or Reel your rule applies to (or any post if you
          selected All posts).
        </li>
        <li>From a different Instagram account, comment the keyword you configured.</li>
        <li>
          Open Activity. You should see:
          <br />
          Comment received → Keyword matched → DM sent.
        </li>
      </ol>

      <p className="mt-4 text-sm text-slate-600">
        DMs use Instagram private replies. If sending fails, Activity will show the
        reason.
      </p>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <Link href="/dashboard/activity">
          <Button type="button">Open Activity</Button>
        </Link>
        {onEditRule ? (
          <Button type="button" variant="secondary" onClick={onEditRule}>
            Edit rule
          </Button>
        ) : (
          <Link href={editHref}>
            <Button type="button" variant="secondary">
              Edit rule
            </Button>
          </Link>
        )}
      </div>
    </div>
  );
}
