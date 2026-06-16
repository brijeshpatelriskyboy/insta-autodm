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
  return (
    <section className={showHeading ? "bg-white py-20 sm:py-28" : ""}>
      <div className={showHeading ? "mx-auto max-w-7xl px-4 sm:px-6 lg:px-8" : ""}>
        {showHeading && (
          <SectionHeading
            eyebrow="Pricing"
            title="Simple, transparent pricing"
            description="Start free for 14 days. Scale as your audience grows. No hidden fees."
          />
        )}

        <p
          className={`text-center text-sm font-medium text-amber-800 ${
            showHeading ? "mt-6" : "mx-auto max-w-2xl px-4 sm:px-6 lg:px-8"
          }`}
        >
          Early Access Pricing — Instagram automation launching soon.
        </p>

        <div
          className={
            showHeading
              ? "mt-16 grid gap-8 lg:grid-cols-3"
              : "mx-auto max-w-7xl grid gap-8 px-4 py-20 sm:px-6 sm:py-28 lg:grid-cols-3 lg:px-8"
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
                    ${plan.price}
                  </span>
                  <span className="text-sm text-slate-500">/month</span>
                </div>

                <ul className="mt-8 flex-1 space-y-3">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-3 text-sm text-slate-600">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
                      {feature}
                    </li>
                  ))}
                </ul>

                <Link href={getRegisterUrl(plan.slug)} className="mt-8 block">
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
