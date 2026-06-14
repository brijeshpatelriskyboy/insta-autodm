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
    "Keyword triggers, automated DMs, lead capture, analytics, activity tracking, and Instagram integration — everything you need to grow on autopilot.",
};

const deepFeatures = [
  {
    title: "Smart keyword matching",
    description:
      "Case-insensitive matching with support for multiple keywords per campaign. Run GUIDE on one post and START on another — each with its own DM.",
  },
  {
    title: "Personalized DM templates",
    description:
      "Craft messages that feel human. Include links, emojis, and dynamic placeholders. Preview exactly what your audience will receive.",
  },
  {
    title: "Real-time activity feed",
    description:
      "Watch comments turn into DMs in real time. Filter by keyword, date, or status. Never wonder if your automation is working.",
  },
  {
    title: "Conversion analytics",
    description:
      "Track which keywords drive the most leads. Compare week-over-week performance. Make data-driven decisions about your content strategy.",
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
            description="Every feature is designed to save you time, capture more leads, and help you grow your Instagram audience on autopilot."
            align="center"
          />
          <div className="mt-10 flex justify-center">
            <Link href="/register">
              <Button size="lg">
                Start Free Trial
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
