"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ChevronDown,
  BookOpen,
  MessageCircle,
  ArrowRight,
  Sparkles,
} from "lucide-react";
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
        description="Everything you need to get started and make the most of Insta AutoDM."
      />

      <Card
        title="Getting Started"
        description="Follow these steps to launch your first keyword automation."
      >
        <div className="space-y-4">
          {gettingStartedSteps.map((step) => (
            <div
              key={step.step}
              className="flex gap-4 rounded-xl border border-slate-100 bg-slate-50/50 p-5 transition-colors hover:border-brand-200 hover:bg-brand-50/30"
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
              Create your first rule
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
          <Link href="/dashboard/integrations">
            <Button variant="secondary">View Integrations</Button>
          </Link>
        </div>
      </Card>

      <Card title="FAQ" description="Common questions about Insta AutoDM.">
        <div className="divide-y divide-slate-100">
          {faqItems.map((item, index) => {
            const isOpen = openFaq === index;
            return (
              <div key={item.question}>
                <button
                  type="button"
                  onClick={() => setOpenFaq(isOpen ? null : index)}
                  className="flex w-full items-center justify-between gap-4 py-4 text-left transition-colors hover:text-brand-600"
                >
                  <span className="font-medium text-slate-900">{item.question}</span>
                  <ChevronDown
                    className={`h-5 w-5 shrink-0 text-slate-400 transition-transform ${
                      isOpen ? "rotate-180" : ""
                    }`}
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

      <div className="grid gap-6 sm:grid-cols-2">
        <Card className="bg-gradient-to-br from-brand-50 to-white">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-100 text-brand-600">
            <BookOpen className="h-5 w-5" />
          </div>
          <h3 className="mt-4 text-lg font-semibold text-slate-900">Documentation</h3>
          <p className="mt-2 text-sm text-slate-500">
            In-depth guides for keyword rules, analytics, and integrations will be
            available as features roll out.
          </p>
          <Button variant="secondary" className="mt-4" disabled>
            Coming soon
          </Button>
        </Card>

        <Card className="bg-gradient-to-br from-pink-50 to-white">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-pink-100 text-pink-600">
            <MessageCircle className="h-5 w-5" />
          </div>
          <h3 className="mt-4 text-lg font-semibold text-slate-900">Contact Support</h3>
          <p className="mt-2 text-sm text-slate-500">
            Need help? Our support team will be available once we launch live
            Instagram integrations.
          </p>
          <Button variant="secondary" className="mt-4" disabled>
            Contact us
          </Button>
        </Card>
      </div>

      <div className="flex items-center justify-center gap-2 rounded-2xl border border-dashed border-brand-200 bg-brand-50/50 px-6 py-8 text-center">
        <Sparkles className="h-5 w-5 text-brand-500" />
        <p className="text-sm text-slate-600">
          Meta OAuth and live automation support are coming in the next release.
        </p>
      </div>
    </div>
  );
}
