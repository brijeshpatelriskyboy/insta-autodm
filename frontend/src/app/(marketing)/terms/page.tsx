import type { Metadata } from "next";
import Link from "next/link";
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
        <p className="mt-4 text-sm text-slate-500">Last updated: September 2026</p>

        <div className="prose prose-slate mt-10 max-w-none space-y-6 text-sm leading-relaxed text-slate-600">
          <p>
            These terms describe how you may use {siteConfig.name}. By creating an
            account or using the service, you agree to them. If you do not agree,
            do not use the service.
          </p>

          <h2 className="text-lg font-semibold text-slate-900">1. The service</h2>
          <p>
            {siteConfig.name} provides Instagram Business and Creator
            comment-to-DM automation through Meta&apos;s approved production
            permissions. You connect a professional Instagram account, create
            keyword rules, and {siteConfig.name} can send a private reply when a
            matching comment is received on a post or reel you selected (or on
            your content generally, if a rule is not scoped to one media item).
          </p>
          <p>
            Delivery depends on Instagram delivering comment webhooks, Meta
            private-reply eligibility, and your keyword configuration. The service
            also stores activity and DM outcomes on your account. We do not
            guarantee that every comment will produce a DM, that delivery is
            instantaneous, or that Meta will never restrict an account.
          </p>

          <h2 className="text-lg font-semibold text-slate-900">2. Accounts and consent</h2>
          <p>
            You must provide an accurate email and a password, and you must agree
            to these Terms and the Privacy Policy at registration. You are
            responsible for keeping your credentials confidential and for activity
            on your account. You need an Instagram Business or Creator account to
            use Instagram messaging APIs. Personal Instagram accounts are not
            supported.
          </p>

          <h2 className="text-lg font-semibold text-slate-900">3. Acceptable use</h2>
          <p>
            You must follow Meta&apos;s platform policies and Community Guidelines.
            You agree not to use {siteConfig.name} for spam, harassment, deception,
            or any activity that violates Instagram or applicable law. We may
            suspend or terminate accounts that we reasonably believe are abusing
            the service or Meta&apos;s platform.
          </p>

          <h2 className="text-lg font-semibold text-slate-900">4. Billing</h2>
          <p>
            Creating an account does not start a paid subscription. Billing begins
            only after a paid plan is selected and Stripe checkout is completed
            when billing is enabled. There is no 14-day free trial. Plan names and
            listed prices on the marketing site describe intended commercial
            offerings; they do not by themselves charge your card. Refunds, if
            any, are handled case by case and are not guaranteed.
          </p>
          <p>
            The Instagram launch promotion provides 50% off an eligible
            customer&apos;s initial subscription for up to three consecutive
            monthly billing periods. It is limited to first-time customers and
            one redemption per customer. If you cancel or schedule cancellation
            during the promotional period, the promotion ends and cannot be
            restored, transferred, or reused if the subscription is resumed or a
            new subscription is created.
          </p>

          <h2 className="text-lg font-semibold text-slate-900">5. Support</h2>
          <p>
            Support is available through the{" "}
            <Link href="/contact" className="text-brand-600 hover:text-brand-700">
              contact form
            </Link>
            . There is no live chat, dedicated account manager, or guaranteed
            response time.
          </p>

          <h2 className="text-lg font-semibold text-slate-900">6. Limitation of liability</h2>
          <p>
            {siteConfig.name} is provided &ldquo;as is.&rdquo; To the extent
            permitted by law, we are not liable for account restrictions imposed
            by Meta, failed or delayed DMs, data loss, or indirect or
            consequential damages arising from use of the service.
          </p>

          <h2 className="text-lg font-semibold text-slate-900">7. Changes</h2>
          <p>
            We may update these terms as the product changes. Continued use after
            an update constitutes acceptance of the revised terms. The date at the
            top of this page is the latest revision.
          </p>

          <h2 className="text-lg font-semibold text-slate-900">8. Contact</h2>
          <p>
            Questions about these terms? Use the{" "}
            <Link href="/contact" className="text-brand-600 hover:text-brand-700">
              contact form
            </Link>
            .
          </p>
        </div>
      </div>
    </section>
  );
}
