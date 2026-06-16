"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Check, Circle, Loader2, PartyPopper, Sparkles } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { api, type QuickStartProgress } from "@/lib/api";
import { getToken } from "@/lib/auth";

const DEFAULT_QUICK_START: QuickStartProgress = {
  progress: 20,
  completedCount: 1,
  totalSteps: 5,
  showCelebration: false,
  celebrated: false,
  steps: [
    { id: "account", label: "Create Account", href: "/dashboard", completed: true, completedAt: null },
    { id: "first_rule", label: "Create First Rule", href: "/dashboard/rules", completed: false, completedAt: null },
    { id: "instagram", label: "Connect Instagram (Beta)", href: "/dashboard/integrations", completed: false, completedAt: null },
    { id: "plan", label: "Choose Plan", href: "/dashboard/billing", completed: false, completedAt: null },
    { id: "go_live", label: "Go Live", href: "/dashboard/rules", completed: false, completedAt: null },
  ],
};

function ChecklistSkeleton() {
  return (
    <Card title="Quick Start" description="Loading your setup progress...">
      <div className="mb-5 animate-pulse space-y-3">
        <div className="h-2 rounded-full bg-slate-100" />
        <div className="h-12 rounded-xl bg-slate-100" />
        <div className="h-12 rounded-xl bg-slate-100" />
        <div className="h-12 rounded-xl bg-slate-100" />
      </div>
    </Card>
  );
}

export function QuickStartChecklist() {
  const [data, setData] = useState<QuickStartProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [celebrationOpen, setCelebrationOpen] = useState(false);
  const [celebrating, setCelebrating] = useState(false);

  const loadProgress = useCallback(async () => {
    const token = getToken();
    if (!token) {
      setLoading(false);
      return;
    }

    try {
      const progress = await api.getQuickStartProgress(token);
      setData(progress);
      setCelebrationOpen(progress.showCelebration);
    } catch (err) {
      console.error("[QuickStart] Failed to load activation progress:", err);
      setData(DEFAULT_QUICK_START);
      setCelebrationOpen(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProgress();
  }, [loadProgress]);

  useEffect(() => {
    function handleFocus() {
      loadProgress();
    }

    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [loadProgress]);

  async function handleCelebrateClose() {
    const token = getToken();
    setCelebrationOpen(false);

    if (!token || !data?.showCelebration) return;

    setCelebrating(true);
    try {
      await api.celebrateQuickStart(token);
      setData((current) =>
        current
          ? { ...current, showCelebration: false, celebrated: true }
          : current,
      );
    } catch {
      // Keep modal dismissed even if persistence fails.
    } finally {
      setCelebrating(false);
    }
  }

  if (loading) {
    return <ChecklistSkeleton />;
  }

  const checklist = data ?? DEFAULT_QUICK_START;
  const allComplete = checklist.progress === 100;

  return (
    <>
      <Card
        title="Quick Start"
        description={
          allComplete
            ? "You're fully set up — automations are ready to roll."
            : "Complete these steps to activate your Instagram automations."
        }
      >
        <div className="mb-5">
          <div className="mb-2 flex items-center justify-between gap-3 text-sm">
            <span className="font-medium text-slate-700">Progress</span>
            <span className="text-slate-500">
              {checklist.completedCount}/{checklist.totalSteps} · {checklist.progress}% complete
            </span>
          </div>
          <div
            className="h-2 overflow-hidden rounded-full bg-slate-100"
            role="progressbar"
            aria-valuenow={checklist.progress}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Quick Start progress"
          >
            <div
              className="h-full rounded-full bg-gradient-to-r from-brand-500 to-accent-500 transition-all duration-700 ease-out"
              style={{ width: `${checklist.progress}%` }}
            />
          </div>
        </div>

        <ul className="space-y-2 sm:space-y-3">
          {checklist.steps.map((item) => (
            <li key={item.id}>
              <Link
                href={item.href}
                className={`group flex items-center gap-3 rounded-xl border px-3 py-3 transition-all sm:px-4 ${
                  item.completed
                    ? "border-emerald-100 bg-emerald-50/40 hover:border-emerald-200"
                    : "border-slate-100 bg-slate-50/50 hover:border-brand-200 hover:bg-brand-50/40"
                }`}
              >
                {item.completed ? (
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white">
                    <Check className="h-4 w-4" />
                  </span>
                ) : (
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-slate-300 text-slate-400">
                    <Circle className="h-3.5 w-3.5" />
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <span
                    className={`block text-sm font-medium ${
                      item.completed ? "text-slate-600" : "text-slate-900"
                    }`}
                  >
                    {item.label}
                  </span>
                  {item.completed && item.completedAt && (
                    <span className="mt-0.5 block text-xs text-slate-400">
                      Completed{" "}
                      {new Date(item.completedAt).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ul>

        {allComplete && (
          <div className="mt-4 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-800">
            <Sparkles className="h-4 w-4 shrink-0" />
            <span>All steps complete. You&apos;re live and ready to automate.</span>
          </div>
        )}
      </Card>

      <Modal
        open={celebrationOpen}
        onClose={handleCelebrateClose}
        title="You're all set!"
        description="You've completed every Quick Start step. Your workspace is fully activated."
        footer={
          <Button onClick={handleCelebrateClose} disabled={celebrating}>
            {celebrating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Saving
              </>
            ) : (
              <>
                <PartyPopper className="h-4 w-4" />
                Continue to dashboard
              </>
            )}
          </Button>
        }
      >
        <div className="flex flex-col items-center py-4 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-accent-500 text-white shadow-lg">
            <PartyPopper className="h-8 w-8" />
          </div>
          <p className="text-sm text-slate-600">
            Account, rules, Instagram, billing, and go-live are all in place. Time to
            turn comments into conversations.
          </p>
        </div>
      </Modal>
    </>
  );
}
