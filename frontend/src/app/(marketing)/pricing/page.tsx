import type { Metadata } from "next";
import { CTASection } from "@/components/marketing/CTASection";
import { PricingSection } from "@/components/marketing/PricingSection";
import { SectionHeading } from "@/components/marketing/SectionHeading";
import { billingDisclosure } from "@/lib/marketing-data";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "Starter, Creator, and Pro plans for Instagram comment-to-DM automation. Creating an account does not start a paid subscription.",
};

const comparison = [
  { feature: "Instagram accounts", starter: "1", creator: "2", pro: "5" },
  { feature: "Keyword rules", starter: "3", creator: "15", pro: "Unlimited" },
  { feature: "DMs per month", starter: "500", creator: "5,000", pro: "25,000" },
  { feature: "Analytics", starter: "Basic", creator: "Advanced", pro: "Full suite" },
  { feature: "Activity tracking", starter: "—", creator: "✓", pro: "✓" },
  { feature: "Team seats", starter: "1", creator: "1", pro: "3" },
  { feature: "API access", starter: "—", creator: "—", pro: "✓" },
  { feature: "Support", starter: "Contact form", creator: "Contact form", pro: "Contact form" },
];

export default function PricingPage() {
  return (
    <>
      <section className="border-b border-slate-200/80 bg-white py-16 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <SectionHeading
            eyebrow="Pricing"
            title="Choose a plan when you are ready"
            description={billingDisclosure}
          />
        </div>
      </section>

      <PricingSection showHeading={false} />

      <section className="py-20 sm:py-28">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <SectionHeading
            title="Compare plans"
            description="Listed features describe the intended commercial tiers. Billing starts only after Stripe checkout when billing is enabled."
          />
          <div className="mt-12 overflow-x-auto rounded-2xl border border-slate-200/80 bg-white shadow-sm">
            <table className="w-full min-w-[600px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200/80 bg-slate-50/80">
                  <th className="px-6 py-4 font-semibold text-slate-900">Feature</th>
                  <th className="px-6 py-4 font-semibold text-slate-900">Starter</th>
                  <th className="px-6 py-4 font-semibold text-brand-700">Creator</th>
                  <th className="px-6 py-4 font-semibold text-slate-900">Pro</th>
                </tr>
              </thead>
              <tbody>
                {comparison.map((row) => (
                  <tr key={row.feature} className="border-b border-slate-100 last:border-0">
                    <td className="px-6 py-4 font-medium text-slate-700">{row.feature}</td>
                    <td className="px-6 py-4 text-slate-600">{row.starter}</td>
                    <td className="px-6 py-4 text-slate-600">{row.creator}</td>
                    <td className="px-6 py-4 text-slate-600">{row.pro}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <CTASection />
    </>
  );
}
