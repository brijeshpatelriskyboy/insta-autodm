import type { Metadata } from "next";
import { siteConfig } from "@/lib/marketing-data";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: `Terms of Service for ${siteConfig.name}.`,
};

export default function TermsPage() {
  return (
    <section className="py-16 sm:py-24">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
          Terms of Service
        </h1>
        <p className="mt-4 text-sm text-slate-500">Last updated: June 2026</p>

        <div className="prose prose-slate mt-10 max-w-none space-y-6 text-sm leading-relaxed text-slate-600">
          <p>
            Welcome to {siteConfig.name}. By using our service, you agree to these
            terms. Please read them carefully.
          </p>

          <h2 className="text-lg font-semibold text-slate-900">1. Service Description</h2>
          <p>
            {siteConfig.name} provides Instagram DM automation for Business and
            Creator accounts. The service monitors comments on your posts and sends
            automated direct messages based on keyword rules you configure.
          </p>

          <h2 className="text-lg font-semibold text-slate-900">2. Account Requirements</h2>
          <p>
            You must have a valid Instagram Business or Creator account connected
            to a Facebook Page. You are responsible for maintaining compliance with
            Meta&apos;s Platform Policies and Community Guidelines.
          </p>

          <h2 className="text-lg font-semibold text-slate-900">3. Acceptable Use</h2>
          <p>
            You agree not to use {siteConfig.name} for spam, harassment, or any
            activity that violates Instagram&apos;s terms. We reserve the right to
            suspend accounts that abuse the platform.
          </p>

          <h2 className="text-lg font-semibold text-slate-900">4. Billing</h2>
          <p>
            Paid plans are billed monthly. Free trials last 14 days. You may cancel
            at any time. Refunds are handled on a case-by-case basis within 30 days
            of purchase.
          </p>

          <h2 className="text-lg font-semibold text-slate-900">5. Limitation of Liability</h2>
          <p>
            {siteConfig.name} is provided &ldquo;as is.&rdquo; We are not liable for
            account restrictions imposed by Meta, data loss, or indirect damages
            arising from use of the service.
          </p>

          <h2 className="text-lg font-semibold text-slate-900">6. Contact</h2>
          <p>
            Questions about these terms? Email{" "}
            <a href="mailto:legal@instaautodm.com" className="text-brand-600 hover:text-brand-700">
              legal@instaautodm.com
            </a>
            .
          </p>
        </div>
      </div>
    </section>
  );
}
