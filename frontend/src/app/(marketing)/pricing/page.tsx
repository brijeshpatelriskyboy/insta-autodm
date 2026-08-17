import type { Metadata } from "next";
import { CTASection } from "@/components/marketing/CTASection";
import { PricingSection } from "@/components/marketing/PricingSection";
import { SectionHeading } from "@/components/marketing/SectionHeading";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "Early-access pricing for Comment2DM Instagram comment-to-DM automation. Starter, Creator, and Pro are billing options — the same beta product on every plan.",
};

const comparison = [
  { feature: "Keyword comment → DM", starter: "✓", creator: "✓", pro: "✓" },
  { feature: "Keyword rules", starter: "Included", creator: "Included", pro: "Included" },
  { feature: "Instagram accounts", starter: "1", creator: "1", pro: "1" },
  { feature: "Activity log", starter: "✓", creator: "✓", pro: "✓" },
  { feature: "DM send counts", starter: "✓", creator: "✓", pro: "✓" },
  { feature: "Plan limits enforced", starter: "Not yet", creator: "Not yet", pro: "Not yet" },
  { feature: "Smart Campaigns", starter: "Not GA", creator: "Not GA", pro: "Not GA" },
];

export default function PricingPage() {
  return (
    <>
      <section className="border-b border-slate-200/80 bg-white py-16 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <SectionHeading
            eyebrow="Pricing"
            title="Choose the plan that fits your growth"
            description="Comment2DM is in beta. Starter, Creator, and Pro are prices — every account currently gets the same product. There is no 14-day free trial."
          />
          <p className="mx-auto mt-6 max-w-2xl text-center text-sm font-medium text-amber-800">
            Early access — plan names are billing labels. Feature limits, extra Instagram accounts, team seats, and API access are not available yet.
          </p>
        </div>
      </section>

      <PricingSection showHeading={false} />

      <section className="py-20 sm:py-28">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <SectionHeading
            title="Compare plans"
            description="See what is actually included today versus what is still coming."
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
