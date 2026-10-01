"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, MessageCircle, ArrowRight } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { faqItems, gettingStartedSteps } from "@/lib/help";

export default function HelpPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Help Center"
        description="Simple help for getting started with Comment2DM."
      />

      <Card title="Getting Started">
        <div className="space-y-4">
          {gettingStartedSteps.map((step) => (
            <div
              key={step.step}
              className="flex gap-4 rounded-xl border border-slate-100 bg-slate-50/50 p-5"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-accent-500 text-sm font-bold text-white">
                {step.step}
              </div>
              <div>
                <h3 className="font-semibold text-slate-900">{step.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-slate-500">
                  {step.description}
                </p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/dashboard/rules">
            <Button>
              Create a keyword rule
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
          <Link href="/dashboard/integrations">
            <Button variant="secondary">Connect Instagram</Button>
          </Link>
        </div>
      </Card>

      <Card title="FAQ">
        <div className="divide-y divide-slate-100">
          {faqItems.map((item, index) => {
            const isOpen = openFaq === index;
            return (
              <div key={item.question}>
                <button
                  type="button"
                  onClick={() => setOpenFaq(isOpen ? null : index)}
                  className="flex w-full items-center justify-between gap-4 py-4 text-left"
                >
                  <span className="font-medium text-slate-900">{item.question}</span>
                  <ChevronDown
                    className={`h-5 w-5 shrink-0 text-slate-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
                  />
                </button>
                {isOpen && (
                  <p className="pb-4 text-sm leading-relaxed text-slate-500">
                    {item.answer}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      <Card>
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-pink-100 text-pink-600">
            <MessageCircle className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Need help?</h3>
            <p className="mt-1 text-sm text-slate-500">
              Contact us if you need help connecting Instagram or setting up an automation.
            </p>
            <Link href="/contact">
              <Button variant="secondary" className="mt-4">
                Contact support
              </Button>
            </Link>
          </div>
        </div>
      </Card>
    </div>
  );
}
