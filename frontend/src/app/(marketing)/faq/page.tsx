import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { CTASection } from "@/components/marketing/CTASection";
import { FAQSection } from "@/components/marketing/FAQSection";
import { SectionHeading } from "@/components/marketing/SectionHeading";
import { Button } from "@/components/ui/Button";

export const metadata: Metadata = {
  title: "FAQ",
  description:
    "Answers to common questions about Insta AutoDM — Instagram DM automation, pricing, compliance, and setup.",
};

export default function FAQPage() {
  return (
    <>
      <section className="border-b border-slate-200/80 bg-white py-16 sm:py-24">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <SectionHeading
            eyebrow="FAQ"
            title="Got questions? We've got answers."
            description="Can't find what you're looking for? Reach out to our team."
          />
          <div className="mt-8 flex justify-center">
            <Link href="/contact">
              <Button variant="secondary">
                Contact Support
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-3xl px-4 py-20 sm:px-6 lg:px-8">
        <FAQSection showHeading={false} />
      </div>

      <CTASection />
    </>
  );
}
