import Link from "next/link";
import { ArrowRight, Play, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { audiences, siteConfig } from "@/lib/marketing-data";
import { BetaBadge } from "@/components/trust/BetaBadge";

export function HeroSection() {
  return (
    <section className="relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-1/2 top-0 h-[600px] w-[900px] -translate-x-1/2 rounded-full bg-gradient-to-b from-brand-100/80 via-accent-400/10 to-transparent blur-3xl" />
        <div className="absolute -left-32 top-40 h-72 w-72 rounded-full bg-brand-200/40 blur-3xl" />
        <div className="absolute -right-32 top-20 h-72 w-72 rounded-full bg-accent-400/20 blur-3xl" />
      </div>

      <div className="mx-auto max-w-7xl px-4 pb-20 pt-16 sm:px-6 sm:pb-28 sm:pt-24 lg:px-8">
        <div className="mx-auto max-w-4xl text-center">
          <div className="animate-fade-in inline-flex flex-wrap items-center justify-center gap-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-brand-200/80 bg-white/80 px-4 py-1.5 text-xs font-medium text-brand-700 shadow-sm backdrop-blur-sm">
              <Sparkles className="h-3.5 w-3.5" />
              Instagram DM Automation for Creators
            </div>
            <BetaBadge />
          </div>

          <h1 className="animate-slide-up mt-8 text-4xl font-semibold tracking-tight text-slate-900 sm:text-6xl lg:text-7xl">
            Turn Instagram Comments Into{" "}
            <span className="text-gradient">Conversations Automatically</span>
          </h1>

          <p
            className="animate-slide-up mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-slate-600 sm:text-xl"
            style={{ animationDelay: "0.1s" }}
          >
            {siteConfig.description}
          </p>

          <div
            className="animate-slide-up mt-10 flex flex-wrap items-center justify-center gap-4"
            style={{ animationDelay: "0.2s" }}
          >
            <Link href="/register">
              <Button size="lg">
                Start Free Trial
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="#how-it-works">
              <Button variant="secondary" size="lg">
                <Play className="h-4 w-4" />
                Watch Demo
              </Button>
            </Link>
          </div>

          <div
            className="animate-slide-up mt-12 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-slate-500"
            style={{ animationDelay: "0.3s" }}
          >
            <span>Built for</span>
            {audiences.map((audience, i) => (
              <span key={audience} className="flex items-center gap-2">
                {i > 0 && <span className="hidden text-slate-300 sm:inline">·</span>}
                <span className="font-medium text-slate-700">{audience}</span>
              </span>
            ))}
          </div>
        </div>

        <div
          className="animate-slide-up relative mx-auto mt-16 max-w-5xl"
          style={{ animationDelay: "0.35s" }}
        >
          <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-elevated">
            <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50/80 px-4 py-3">
              <div className="flex gap-1.5">
                <div className="h-3 w-3 rounded-full bg-red-400/80" />
                <div className="h-3 w-3 rounded-full bg-amber-400/80" />
                <div className="h-3 w-3 rounded-full bg-emerald-400/80" />
              </div>
              <span className="ml-2 text-xs font-medium text-slate-500">
                Insta AutoDM Dashboard
              </span>
            </div>
            <div className="grid gap-0 sm:grid-cols-5">
              <div className="border-b border-slate-100 bg-sidebar p-4 sm:col-span-1 sm:border-b-0 sm:border-r">
                <div className="space-y-2">
                  {["Overview", "Rules", "Analytics", "Activity"].map((item, i) => (
                    <div
                      key={item}
                      className={`rounded-lg px-3 py-2 text-xs font-medium ${
                        i === 0
                          ? "bg-sidebar-active text-white"
                          : "text-slate-400"
                      }`}
                    >
                      {item}
                    </div>
                  ))}
                </div>
              </div>
              <div className="bg-surface-muted p-6 sm:col-span-4">
                <div className="grid gap-4 sm:grid-cols-3">
                  {[
                    { label: "DMs Sent", value: "2,847", trend: "+42%" },
                    { label: "Leads", value: "634", trend: "+31%" },
                    { label: "Conversion", value: "22.3%", trend: "+4.7%" },
                  ].map((kpi) => (
                    <div
                      key={kpi.label}
                      className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm"
                    >
                      <p className="text-xs font-medium text-slate-500">{kpi.label}</p>
                      <p className="mt-1 text-2xl font-semibold text-slate-900">
                        {kpi.value}
                      </p>
                      <p className="mt-1 text-xs font-medium text-emerald-600">
                        {kpi.trend}
                      </p>
                    </div>
                  ))}
                </div>
                <div className="mt-4 rounded-xl border border-slate-200/80 bg-white p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-slate-900">Live Activity</p>
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                      Live
                    </span>
                  </div>
                  <div className="mt-3 space-y-2">
                    {[
                      '@maya_k commented "GUIDE" → DM sent',
                      '@coach_alex commented "START" → DM sent',
                      '@priya.s commented "PDF" → Lead captured',
                    ].map((line) => (
                      <div
                        key={line}
                        className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600"
                      >
                        {line}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
