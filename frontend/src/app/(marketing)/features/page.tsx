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
    "Keyword rules, automated private replies, activity records, and Instagram Business and Creator comment-to-DM automation through Meta's approved production permissions.",
};

const deepFeatures = [
  {
    title: "Keyword matching",
    description:
      "Create keyword rules such as GUIDE or START. A rule can apply across your content or be scoped to one post or reel. Matching uses the comment text and the rule you configured.",
  },
  {
    title: "Configured private replies",
    description:
      "When a comment matches, Comment2DM can send the message you wrote as an Instagram private reply. Delivery depends on the comment webhook and Meta private-reply eligibility.",
  },
  {
    title: "Activity records",
    description:
      "Comment matches and DM send outcomes are stored on your account so you can review what happened. This is not a live-chat inbox.",
  },
  {
    title: "Account analytics",
    description:
      "Dashboard totals come from your connected account data, such as keyword-rule counts and DM events. Marketing screenshots on this site are example / illustrative data.",
  },
];

export default function FeaturesPage() {
  return (
    <>
      <section className="border-b border-slate-200/80 bg-white py-16 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <SectionHeading
            eyebrow="Features"
            title="Comment-to-DM automation for professional Instagram accounts"
            description="Connect an Instagram Business or Creator account, set keyword rules, and send a private reply when someone comments a matching keyword."
            align="center"
          />
          <div className="mt-10 flex justify-center">
            <Link href="/register">
              <Button size="lg">
                Create Account
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
            eyebrow="How it works"
            title="What the product actually does"
            description="These capabilities match the current Comment2DM comment-to-DM flow."
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
