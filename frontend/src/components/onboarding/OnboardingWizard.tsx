"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Camera,
  Check,
  CheckCircle2,
  KeyRound,
  MessageSquare,
  PartyPopper,
  Sparkles,
  Zap,
} from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { useToast } from "@/components/providers/ToastProvider";
import { api } from "@/lib/api";
import { getStoredUser, getToken } from "@/lib/auth";
import {
  getOnboardingData,
  markOnboardingComplete,
  markOnboardingSkipped,
  ONBOARDING_STEPS,
  saveOnboardingData,
  TOTAL_STEPS,
} from "@/lib/onboarding";

export function OnboardingWizard() {
  const router = useRouter();
  const toast = useToast();
  const user = getStoredUser();
  const userId = user?.id ?? "";

  const [step, setStep] = useState(0);
  const [keyword, setKeyword] = useState("GUIDE");
  const [dmMessage, setDmMessage] = useState(
    "Hey! Here's your free guide:\nhttps://example.com",
  );
  const [instagramConnected, setInstagramConnected] = useState(false);
  const [activating, setActivating] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }

    if (!userId) return;

    const saved = getOnboardingData(userId);
    if (saved.completed || saved.skipped) {
      router.replace("/dashboard");
      return;
    }

    setStep(saved.currentStep);
    setKeyword(saved.keyword);
    setDmMessage(saved.dmMessage);
    setInstagramConnected(saved.instagramConnected);
    setReady(true);
  }, [router, userId]);

  useEffect(() => {
    if (!userId || step !== 3) return;
    const token = getToken();
    if (!token) return;
    api.getInstagramStatus(token).then((s) => {
      if (s.joinedWaitlist) setInstagramConnected(true);
    }).catch(() => {});
  }, [userId, step]);

  const persist = useCallback(
    (updates: {
      currentStep?: number;
      keyword?: string;
      dmMessage?: string;
      instagramConnected?: boolean;
    }) => {
      if (!userId) return;
      saveOnboardingData(userId, updates);
    },
    [userId],
  );

  function handleSkip() {
    if (!userId) return;
    markOnboardingSkipped(userId);
    toast.info("Onboarding skipped — you can set up automations anytime.");
    router.push("/dashboard");
  }

  function goNext() {
    const next = Math.min(step + 1, TOTAL_STEPS - 1);
    setStep(next);
    persist({ currentStep: next, keyword, dmMessage, instagramConnected });
  }

  function goBack() {
    const prev = Math.max(step - 1, 0);
    setStep(prev);
    persist({ currentStep: prev });
  }

  async function handleActivate() {
    const token = getToken();
    if (!token || !userId) return;

    setActivating(true);
    try {
      await api.createKeywordRule(token, {
        keyword: keyword.trim().toUpperCase(),
        dmMessage: dmMessage.trim(),
        isActive: true,
      });
      markOnboardingComplete(userId);
      setStep(5);
      persist({ currentStep: 5 });
      toast.success("Your first automation is live!");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to create automation";
      toast.error(message);
    } finally {
      setActivating(false);
    }
  }

  function handleFinish() {
    router.push("/dashboard");
  }

  const progressPercent = step === 5 ? 100 : ((step + 1) / (TOTAL_STEPS - 1)) * 100;

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface-muted">
        <p className="text-sm text-slate-500">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-muted">
      <header className="border-b border-slate-200/80 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4 sm:px-6">
          <Logo size="sm" />
          {step < 5 && (
            <button
              type="button"
              onClick={handleSkip}
              className="text-sm font-medium text-slate-500 transition-colors hover:text-slate-700"
            >
              Skip for now
            </button>
          )}
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
        {step < 5 && (
          <div className="mb-8">
            <div className="mb-3 flex items-center justify-between text-xs font-medium text-slate-500">
              <span>
                Step {step + 1} of {TOTAL_STEPS - 1}
              </span>
              <span>{Math.round(progressPercent)}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full rounded-full bg-gradient-to-r from-brand-500 to-accent-500 transition-all duration-500 ease-out"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <div className="mt-4 hidden gap-2 sm:flex">
              {ONBOARDING_STEPS.slice(0, -1).map((s, i) => (
                <div
                  key={s.id}
                  className={`flex-1 rounded-lg border px-2 py-1.5 text-center text-xs font-medium transition-colors ${
                    i === step
                      ? "border-brand-200 bg-brand-50 text-brand-700"
                      : i < step
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                        : "border-slate-200 bg-white text-slate-400"
                  }`}
                >
                  {i < step ? (
                    <Check className="mx-auto h-3.5 w-3.5" />
                  ) : (
                    s.label
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-card sm:p-10">
          {step === 0 && (
            <div className="animate-fade-in text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-accent-500 text-white shadow-lg">
                <Sparkles className="h-7 w-7" />
              </div>
              <h1 className="mt-6 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
                Welcome to Insta AutoDM
                {user?.name ? `, ${user.name.split(" ")[0]}` : ""}!
              </h1>
              <p className="mx-auto mt-4 max-w-md text-sm leading-relaxed text-slate-600 sm:text-base">
                In the next 2 minutes, you&apos;ll set up your first automation —
                turning Instagram comments into instant DMs and captured leads.
              </p>
              <div className="mx-auto mt-8 grid max-w-lg gap-3 text-left sm:grid-cols-3">
                {[
                  { icon: KeyRound, label: "Set a keyword" },
                  { icon: MessageSquare, label: "Write your DM" },
                  { icon: Zap, label: "Go live" },
                ].map((item) => {
                  const Icon = item.icon;
                  return (
                    <div
                      key={item.label}
                      className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/80 px-4 py-3"
                    >
                      <Icon className="h-4 w-4 shrink-0 text-brand-600" />
                      <span className="text-sm font-medium text-slate-700">{item.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="animate-fade-in">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                  <KeyRound className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-slate-900">Create your first keyword</h2>
                  <p className="text-sm text-slate-500">
                    When someone comments this word, your DM fires automatically.
                  </p>
                </div>
              </div>
              <div className="mt-8">
                <Input
                  label="Trigger keyword"
                  placeholder="e.g. GUIDE, START, PDF"
                  value={keyword}
                  onChange={(e) => {
                    const val = e.target.value.toUpperCase();
                    setKeyword(val);
                    persist({ keyword: val });
                  }}
                  hint="Use a short, memorable word your audience will comment"
                />
                <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50 p-4">
                  <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
                    Preview
                  </p>
                  <p className="mt-2 text-sm text-slate-700">
                    <span className="font-semibold">@follower</span> commented{" "}
                    <span className="rounded bg-brand-100 px-1.5 py-0.5 font-mono font-semibold text-brand-700">
                      {keyword || "GUIDE"}
                    </span>{" "}
                    on your post
                  </p>
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="animate-fade-in">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                  <MessageSquare className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-slate-900">Write your DM message</h2>
                  <p className="text-sm text-slate-500">
                    This message is sent instantly when the keyword is detected.
                  </p>
                </div>
              </div>
              <div className="mt-8">
                <Textarea
                  label="Automated DM"
                  rows={6}
                  value={dmMessage}
                  onChange={(e) => {
                    setDmMessage(e.target.value);
                    persist({ dmMessage: e.target.value });
                  }}
                  hint="Include links, offers, or a personal touch"
                />
                <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50 p-4">
                  <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
                    DM preview
                  </p>
                  <div className="mt-3 max-w-sm rounded-2xl rounded-bl-md bg-white px-4 py-3 text-sm leading-relaxed text-slate-700 shadow-sm ring-1 ring-slate-200/80">
                    {dmMessage.split("\n").map((line, i) => (
                      <p key={i} className={i > 0 ? "mt-1" : ""}>
                        {line}
                      </p>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="animate-fade-in">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                  <Camera className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-slate-900">Connect Instagram</h2>
                  <p className="text-sm text-slate-500">
                    Link your Business account to start sending automated DMs.
                  </p>
                </div>
              </div>
              <div className="mt-8 rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-8 text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-pink-500 via-purple-500 to-orange-400 text-white">
                  <Camera className="h-8 w-8" />
                </div>
                <p className="mt-4 text-sm font-medium text-slate-900">
                  Instagram Business connection
                </p>
                <p className="mx-auto mt-2 max-w-sm text-sm text-slate-500">
                  Meta OAuth integration coming soon. For now, connect your account
                  to enable live automations.
                </p>
                <Button
                  type="button"
                  className="mt-6"
                  variant={instagramConnected ? "secondary" : "primary"}
                  disabled={instagramConnected}
                  onClick={() => router.push("/connect-instagram")}
                >
                  {instagramConnected ? (
                    <>
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      Connected
                    </>
                  ) : (
                    "Connect Instagram"
                  )}
                </Button>
                <p className="mt-3 text-xs text-slate-400">
                  You can skip this step and connect later from Integrations.
                </p>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="animate-fade-in">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                  <Check className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-slate-900">Review your automation</h2>
                  <p className="text-sm text-slate-500">
                    Everything look good? Activate your first automation.
                  </p>
                </div>
              </div>
              <div className="mt-8 space-y-4">
                <div className="rounded-xl border border-slate-200/80 p-4">
                  <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
                    Keyword trigger
                  </p>
                  <p className="mt-1 font-mono text-lg font-semibold text-brand-700">
                    {keyword}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200/80 p-4">
                  <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
                    DM message
                  </p>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
                    {dmMessage}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200/80 p-4">
                  <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
                    Instagram
                  </p>
                  <p className="mt-1 flex items-center gap-2 text-sm font-medium text-slate-700">
                    {instagramConnected ? (
                      <>
                        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                        Connected (demo)
                      </>
                    ) : (
                      <span className="text-slate-500">Not connected — you can add later</span>
                    )}
                  </p>
                </div>
              </div>
            </div>
          )}

          {step === 5 && (
            <div className="animate-fade-in text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                <PartyPopper className="h-8 w-8" />
              </div>
              <h2 className="mt-6 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
                Your first automation is ready!
              </h2>
              <p className="mx-auto mt-4 max-w-md text-sm leading-relaxed text-slate-600">
                When someone comments{" "}
                <span className="font-mono font-semibold text-brand-700">{keyword}</span> on
                your post, they&apos;ll instantly receive your DM. You&apos;re all set.
              </p>
              <div className="mx-auto mt-6 max-w-sm rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                <CheckCircle2 className="mx-auto mb-2 h-5 w-5" />
                Automation active and saved to your dashboard
              </div>
            </div>
          )}

          <div className="mt-8 flex items-center justify-between gap-4 border-t border-slate-100 pt-6">
            {step > 0 && step < 5 ? (
              <Button type="button" variant="ghost" onClick={goBack}>
                <ArrowLeft className="h-4 w-4" />
                Back
              </Button>
            ) : (
              <div />
            )}

            {step === 0 && (
              <Button type="button" onClick={goNext} className="ml-auto">
                Get started
                <ArrowRight className="h-4 w-4" />
              </Button>
            )}

            {step >= 1 && step <= 3 && (
              <Button
                type="button"
                onClick={goNext}
                className="ml-auto"
                disabled={step === 1 && !keyword.trim()}
              >
                Continue
                <ArrowRight className="h-4 w-4" />
              </Button>
            )}

            {step === 4 && (
              <Button
                type="button"
                onClick={handleActivate}
                className="ml-auto"
                disabled={activating || !keyword.trim() || !dmMessage.trim()}
              >
                {activating ? "Activating..." : "Activate automation"}
                <Zap className="h-4 w-4" />
              </Button>
            )}

            {step === 5 && (
              <Button type="button" onClick={handleFinish} className="mx-auto" size="lg">
                Go to Dashboard
                <ArrowRight className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        {step < 5 && (
          <p className="mt-6 text-center text-xs text-slate-400">
            Progress is saved automatically ·{" "}
            <Link href="/dashboard" className="text-brand-600 hover:text-brand-700">
              Go to dashboard
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}
