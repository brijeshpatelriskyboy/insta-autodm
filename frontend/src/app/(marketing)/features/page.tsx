import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { AnimateIn } from "@/components/marketing/AnimateIn";
import { FeaturesGrid } from "@/components/marketing/FeaturesGrid";
import { SectionHeading } from "@/components/marketing/SectionHeading";
import { Button } from "@/components/ui/Button";

export const metadata: Metadata = {
  title: "Features",
  description:
    "Keyword triggers, automated DMs, activity tracking, DM analytics, and Instagram Meta OAuth — Comment2DM beta for professional accounts.",
};

const deepFeatures = [
  {
    title: "Smart keyword matching",
    description:
      "Match comments to keyword rules, globally or scoped to a specific post. Each rule has its own DM message.",
  },
  {
    title: "Personalized DM templates",
    description:
      "Write the message Comment2DM sends when a keyword matches. Include links and the copy you want followers to receive.",
  },
  {
    title: "Real-time activity feed",
    description:
      "See comment and DM send attempts for your account. Filter by type and date in the activity log.",
  },
  {
    title: "DM analytics",
    description:
      "See keyword-rule counts and DMs sent for your account. Lead export and conversion funnels are not in this beta.",
  },
];

export default function FeaturesPage() {
  return (
    <>
      <section className="border-b border-slate-200/80 bg-white py-16 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <SectionHeading
            eyebrow="Features"
            title="Built for creators who mean business"
            description="Keyword rules, Instagram OAuth for approved and test accounts, and automatic DMs when someone comments your keyword."
            align="center"
          />
          <div className="mt-10 flex justify-center">
            <Link href="/register">
              <Button size="lg">
                Create account
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <FeaturesGrid showHeading={false} />

      <section className="bg-white py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <SectionHeading
            eyebrow="Deep dive"
            title="Power under the hood"
            description="Beyond the basics — features that separate hobby tools from professional automation."
          />
          <div className="mt-16 grid gap-8 sm:grid-cols-2">
            {deepFeatures.map((feature, i) => (
              <AnimateIn key={feature.title} delay={i * 100}>
                <div className="rounded-2xl border border-slate-200/80 bg-slate-50/50 p-8">
                  <h3 className="text-lg font-semibold text-slate-900">
                    {feature.title}
                  </h3>
                  <p className="mt-3 text-sm leading-relaxed text-slate-600">
                    {feature.description}
                  </p>
                </div>
              </AnimateIn>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
