"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { pricingPlans } from "@/lib/marketing-data";
import { getRegisterUrl } from "@/lib/plans";
import { AnimateIn } from "./AnimateIn";
import { SectionHeading } from "./SectionHeading";

interface PricingSectionProps {
  showHeading?: boolean;
}

export function PricingSection({ showHeading = true }: PricingSectionProps) {
  const [billingInterval, setBillingInterval] = useState<"monthly" | "annual">("monthly");

  return (
    <section className={showHeading ? "bg-white py-20 sm:py-28" : ""}>
      <div className={showHeading ? "mx-auto max-w-7xl px-4 sm:px-6 lg:px-8" : ""}>
        {showHeading && (
          <SectionHeading
            eyebrow="Pricing"
            title="Simple, transparent pricing"
            description="Choose monthly billing or save 20% with annual billing."
          />
        )}

        <div className="mx-auto mt-10 max-w-4xl rounded-2xl border border-brand-200 bg-brand-50/70 p-6 sm:p-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <span className="inline-flex rounded-full bg-brand-600 px-3 py-1 text-xs font-semibold text-white">
                LITE — FREE FOR 30 DAYS
              </span>
              <h3 className="mt-3 text-xl font-semibold text-slate-900">
                Start with no card and no payment details
              </h3>
              <p className="mt-2 text-sm text-slate-600">
                Follow @comment2dm.ai and comment <strong>LITE</strong> on our Lite offer post. We will send your private Lite access code directly to your Instagram DM. First-time users get 1 Instagram account, 2 keyword rules and 200 DMs for 30 days.
              </p>
              <p className="mt-2 text-xs text-slate-500">
                One Lite month per Comment2DM user and Instagram account. After 30 days, upgrade to continue automations.
              </p>
            </div>
            <Link href="/register" className="shrink-0">
              <Button>
                Start Lite free
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>

        <div className="mx-auto mt-6 flex w-fit items-center rounded-full border border-slate-200 bg-slate-50 p-1">
          <button
            type="button"
            onClick={() => setBillingInterval("monthly")}
            className={`rounded-full px-4 py-2 text-sm font-semibold ${billingInterval === "monthly" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}
          >
            Monthly
          </button>
          <button
            type="button"
            onClick={() => setBillingInterval("annual")}
            className={`rounded-full px-4 py-2 text-sm font-semibold ${billingInterval === "annual" ? "bg-brand-600 text-white shadow-sm" : "text-slate-500"}`}
          >
            Annual · Save 20%
          </button>
        </div>

        <p
          className={`text-center text-sm text-slate-600 ${
            showHeading ? "mt-6" : "mx-auto max-w-2xl px-4 sm:px-6 lg:px-8"
          }`}
        >
          Creating an account does not start billing. The 50% launch offer applies to
          monthly billing only and does not stack with annual savings.
        </p>

        <div
          className={
            showHeading
              ? "mt-16 grid gap-8 lg:grid-cols-3"
              : "mx-auto grid max-w-7xl gap-8 px-4 py-20 sm:px-6 sm:py-28 lg:grid-cols-3 lg:px-8"
          }
        >
          {pricingPlans.map((plan, i) => (
            <AnimateIn key={plan.name} delay={i * 100}>
              <div
                className={`relative flex h-full flex-col rounded-2xl border p-8 transition-shadow hover:shadow-elevated ${
                  plan.popular
                    ? "border-brand-300 bg-gradient-to-b from-brand-50/80 to-white shadow-card"
                    : "border-slate-200/80 bg-white shadow-sm"
                }`}
              >
                {plan.popular && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-brand-600 to-accent-500 px-4 py-1 text-xs font-semibold text-white">
                    Most Popular
                  </span>
                )}

                <h3 className="text-lg font-semibold text-slate-900">{plan.name}</h3>
                <p className="mt-2 text-sm text-slate-500">{plan.description}</p>

                <div className="mt-6 flex items-baseline gap-1">
                  <span className="text-4xl font-semibold tracking-tight text-slate-900">
                    USD ${billingInterval === "annual" ? plan.annualPrice.toFixed(2) : plan.price}
                  </span>
                  <span className="text-sm text-slate-500">
                    {billingInterval === "annual" ? "/year" : "/month"}
                  </span>
                </div>
                {billingInterval === "annual" ? (
                  <p className="mt-2 text-sm font-semibold text-emerald-700">
                    20% off · equivalent to USD ${(plan.annualPrice / 12).toFixed(2)}/month
                  </p>
                ) : plan.introductoryMonths && plan.offerPrice ? (
                  <p className="mt-2 text-sm font-semibold text-brand-700">
                    Instagram launch offer: 50% off — USD ${plan.offerPrice}/month for your first {plan.introductoryMonths} months
                  </p>
                ) : null}

                <ul className="mt-8 flex-1 space-y-3">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-3 text-sm text-slate-600">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
                      {feature}
                    </li>
                  ))}
                </ul>

                <Link href={`${getRegisterUrl(plan.slug)}&billing=${billingInterval}`} className="mt-8 block">
                  <Button
                    className="w-full"
                    variant={plan.popular ? "primary" : "secondary"}
                  >
                    {plan.cta}
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </AnimateIn>
          ))}
        </div>
      </div>
    </section>
  );
}
