"use client";

import { Mail } from "lucide-react";
import { Button } from "@/components/ui/Button";

const SUPPORT_EMAIL = "hello@comment2dm.com";

export function ContactForm() {
  const mailto = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent("Comment2DM beta question")}`;

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-8 shadow-card">
      <h3 className="text-lg font-semibold text-slate-900">Email us</h3>
      <p className="mt-2 text-sm leading-relaxed text-slate-600">
        Comment2DM is in beta. We do not have an in-app ticket system yet, so
        this page does not send a message by itself. Open your email app and
        write to{" "}
        <a href={mailto} className="font-medium text-brand-600 hover:text-brand-700">
          {SUPPORT_EMAIL}
        </a>
        .
      </p>
      <a href={mailto} className="mt-6 block">
        <Button type="button" className="w-full" size="lg">
          <Mail className="h-4 w-4" />
          Open email to {SUPPORT_EMAIL}
        </Button>
      </a>
    </div>
  );
}
