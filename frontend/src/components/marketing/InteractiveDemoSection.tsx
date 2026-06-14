"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  CheckCircle2,
  Heart,
  MessageCircle,
  Play,
  RotateCcw,
  Search,
  Send,
  Sparkles,
  UserCheck,
  Zap,
} from "lucide-react";
import { SectionHeading } from "./SectionHeading";
import { Button } from "@/components/ui/Button";

type DemoStep = 0 | 1 | 2 | 3 | 4;

const steps = [
  { label: "Comment posted", icon: MessageCircle },
  { label: "Keyword detected", icon: Search },
  { label: "DM sent", icon: Send },
  { label: "Lead captured", icon: UserCheck },
];

const STEP_DURATION_MS = 2200;

export function InteractiveDemoSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const [step, setStep] = useState<DemoStep>(0);
  const [playing, setPlaying] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);

  const reset = useCallback(() => {
    setStep(0);
    setPlaying(false);
  }, []);

  const startDemo = useCallback(() => {
    setHasStarted(true);
    setStep(1);
    setPlaying(true);
  }, []);

  useEffect(() => {
    if (!playing || step === 0) return;

    const timer = setTimeout(() => {
      if (step < 4) {
        setStep((s) => (s + 1) as DemoStep);
      } else {
        setPlaying(false);
      }
    }, STEP_DURATION_MS);

    return () => clearTimeout(timer);
  }, [playing, step]);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el || hasStarted) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          startDemo();
          observer.disconnect();
        }
      },
      { threshold: 0.25 },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [hasStarted, startDemo]);

  return (
    <section ref={sectionRef} className="bg-white py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="Live demo"
          title="See Insta AutoDM in action"
          description="Watch the full flow in 30 seconds — from comment to captured lead, completely automatic."
        />

        {/* Step progress */}
        <div className="mx-auto mt-12 flex max-w-3xl flex-wrap items-center justify-center gap-2 sm:gap-3">
          {steps.map((s, i) => {
            const stepNum = (i + 1) as DemoStep;
            const active = step >= stepNum;
            const current = step === stepNum;
            const Icon = s.icon;

            return (
              <div
                key={s.label}
                className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-all duration-500 sm:px-4 sm:text-sm ${
                  active
                    ? "border-brand-200 bg-brand-50 text-brand-700"
                    : "border-slate-200 bg-slate-50 text-slate-400"
                } ${current ? "ring-2 ring-brand-300 ring-offset-2" : ""}`}
              >
                <Icon className={`h-3.5 w-3.5 ${current ? "animate-pulse" : ""}`} />
                <span className="hidden sm:inline">{s.label}</span>
                <span className="sm:hidden">{i + 1}</span>
              </div>
            );
          })}
        </div>

        {/* Demo stage */}
        <div className="relative mx-auto mt-10 max-w-6xl">
          <div className="grid gap-6 lg:grid-cols-2 lg:gap-8">
            {/* Left: Instagram post */}
            <div
              className={`overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-elevated transition-all duration-700 ${
                step >= 1 ? "opacity-100" : "opacity-60"
              }`}
            >
              <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-3">
                <div className="h-9 w-9 rounded-full bg-gradient-to-br from-pink-500 via-purple-500 to-orange-400" />
                <div>
                  <p className="text-sm font-semibold text-slate-900">coach_sarah</p>
                  <p className="text-xs text-slate-500">San Francisco, CA</p>
                </div>
              </div>

              <div className="aspect-square bg-gradient-to-br from-brand-100 via-accent-100 to-brand-50">
                <div className="flex h-full flex-col items-center justify-center p-8 text-center">
                  <p className="text-sm font-medium text-brand-700">Free Guide Post</p>
                  <p className="mt-2 text-2xl font-semibold text-slate-800">
                    Comment <span className="text-brand-600">GUIDE</span> below
                  </p>
                  <p className="mt-2 text-sm text-slate-500">I&apos;ll DM you the link instantly</p>
                </div>
              </div>

              <div className="flex items-center gap-4 border-b border-slate-100 px-4 py-3">
                <Heart className="h-5 w-5 text-slate-400" />
                <MessageCircle className="h-5 w-5 text-slate-400" />
                <Send className="h-5 w-5 text-slate-400" />
              </div>

              <div className="space-y-3 p-4">
                <p className="text-sm text-slate-700">
                  <span className="font-semibold">coach_sarah</span> Comment GUIDE and I&apos;ll
                  send you my free playbook
                </p>

                <div className="space-y-2">
                  <div className="flex items-start gap-2 text-sm text-slate-500">
                    <div className="h-7 w-7 shrink-0 rounded-full bg-slate-200" />
                    <p>
                      <span className="font-semibold text-slate-700">alex_runs</span> This looks
                      amazing!
                    </p>
                  </div>

                  <div
                    className={`flex items-start gap-2 text-sm transition-all duration-500 ${
                      step >= 1
                        ? "translate-y-0 opacity-100"
                        : "translate-y-4 opacity-0"
                    }`}
                  >
                    <div className="h-7 w-7 shrink-0 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500" />
                    <div className="flex-1">
                      <p>
                        <span className="font-semibold text-slate-700">maya_k</span>{" "}
                        <span
                          className={`rounded px-1 font-mono font-semibold transition-all duration-300 ${
                            step >= 2
                              ? "bg-brand-100 text-brand-700 ring-2 ring-brand-300"
                              : "text-slate-700"
                          }`}
                        >
                          GUIDE
                        </span>
                      </p>
                      {step >= 2 && (
                        <p className="mt-1 flex items-center gap-1 text-xs font-medium text-brand-600 animate-fade-in">
                          <Zap className="h-3 w-3" />
                          Keyword matched
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right: DM preview */}
            <div
              className={`flex flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-elevated transition-all duration-700 ${
                step >= 3 ? "opacity-100" : "opacity-40"
              }`}
            >
              <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/80 px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-accent-500 text-xs font-bold text-white">
                    IA
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">coach_sarah</p>
                    <p className="text-xs text-emerald-600">Active now</p>
                  </div>
                </div>
                <div className="flex items-center gap-1 rounded-full bg-brand-50 px-2 py-1 text-xs font-medium text-brand-700">
                  <Sparkles className="h-3 w-3" />
                  AutoDM
                </div>
              </div>

              <div className="flex flex-1 flex-col justify-end gap-3 bg-slate-50/50 p-4 sm:p-6">
                {step >= 2 && step < 3 && (
                  <div className="flex justify-center">
                    <div className="flex items-center gap-2 rounded-full border border-brand-200 bg-white px-4 py-2 text-xs font-medium text-brand-700 shadow-sm animate-fade-in">
                      <Search className="h-3.5 w-3.5 animate-pulse" />
                      Detecting keyword &quot;GUIDE&quot;...
                    </div>
                  </div>
                )}

                <div
                  className={`max-w-[85%] transition-all duration-700 ${
                    step >= 3
                      ? "translate-y-0 opacity-100"
                      : "translate-y-6 opacity-0"
                  }`}
                >
                  <div className="rounded-2xl rounded-bl-md bg-white px-4 py-3 shadow-card ring-1 ring-slate-200/80">
                    <p className="text-sm leading-relaxed text-slate-700">
                      Hey Maya! Here&apos;s your free guide as promised
                    </p>
                    <a
                      href="#"
                      className="mt-2 block text-sm font-medium text-brand-600 hover:text-brand-700"
                      onClick={(e) => e.preventDefault()}
                    >
                      instaautodm.com/guide
                    </a>
                    <p className="mt-2 text-sm text-slate-600">
                      Let me know if you have any questions!
                    </p>
                  </div>
                  <p className="mt-1.5 flex items-center gap-1 text-xs text-slate-400">
                    <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                    Sent automatically · just now
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Lead captured notification */}
          <div
            className={`mx-auto mt-6 max-w-md transition-all duration-700 ${
              step >= 4
                ? "translate-y-0 opacity-100"
                : "translate-y-4 opacity-0 pointer-events-none"
            }`}
          >
            <div className="flex items-center gap-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 shadow-card">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white">
                <UserCheck className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-emerald-900">Lead captured</p>
                <p className="text-sm text-emerald-700">
                  <span className="font-medium">@maya_k</span> · keyword{" "}
                  <span className="font-mono font-semibold">GUIDE</span> · added to dashboard
                </p>
              </div>
              <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                +1 lead
              </span>
            </div>
          </div>

          {/* Replay control */}
          <div className="mt-8 flex justify-center">
            {step === 0 || (!playing && step === 4) ? (
              <Button
                variant="secondary"
                onClick={step === 0 ? startDemo : () => { reset(); setTimeout(startDemo, 100); }}
              >
                {step === 0 ? (
                  <>
                    <Play className="h-4 w-4" />
                    Play demo
                  </>
                ) : (
                  <>
                    <RotateCcw className="h-4 w-4" />
                    Replay demo
                  </>
                )}
              </Button>
            ) : (
              <p className="text-sm text-slate-500">Demo playing...</p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
