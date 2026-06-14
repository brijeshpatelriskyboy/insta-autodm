"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { faqs } from "@/lib/marketing-data";
import { AnimateIn } from "./AnimateIn";
import { SectionHeading } from "./SectionHeading";

interface FAQSectionProps {
  showHeading?: boolean;
  limit?: number;
}

export function FAQSection({ showHeading = true, limit }: FAQSectionProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(0);
  const items = limit ? faqs.slice(0, limit) : faqs;

  return (
    <section className={showHeading ? "bg-white py-20 sm:py-28" : ""}>
      <div className={showHeading ? "mx-auto max-w-3xl px-4 sm:px-6 lg:px-8" : "max-w-3xl"}>
        {showHeading && (
          <SectionHeading
            eyebrow="FAQ"
            title="Frequently asked questions"
            description="Everything you need to know about Insta AutoDM."
          />
        )}

        <div className={showHeading ? "mt-12 space-y-3" : "space-y-3"}>
          {items.map((faq, i) => {
            const isOpen = openIndex === i;
            return (
              <AnimateIn key={faq.question} delay={i * 60}>
                <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white">
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
                    onClick={() => setOpenIndex(isOpen ? null : i)}
                    aria-expanded={isOpen}
                  >
                    <span className="text-sm font-semibold text-slate-900 sm:text-base">
                      {faq.question}
                    </span>
                    <ChevronDown
                      className={`h-5 w-5 shrink-0 text-slate-400 transition-transform duration-200 ${
                        isOpen ? "rotate-180" : ""
                      }`}
                    />
                  </button>
                  <div
                    className={`grid transition-all duration-200 ${
                      isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                    }`}
                  >
                    <div className="overflow-hidden">
                      <p className="px-5 pb-4 text-sm leading-relaxed text-slate-600">
                        {faq.answer}
                      </p>
                    </div>
                  </div>
                </div>
              </AnimateIn>
            );
          })}
        </div>
      </div>
    </section>
  );
}
