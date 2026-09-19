import type { Metadata } from "next";
import Link from "next/link";
import { siteConfig } from "@/lib/marketing-data";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: `Privacy Policy for ${siteConfig.name}.`,
};

export default function PrivacyPage() {
  return (
    <section className="py-16 sm:py-24">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
          Privacy Policy
        </h1>
        <p className="mt-4 text-sm text-slate-500">Last updated: September 2026</p>

        <div className="prose prose-slate mt-10 max-w-none space-y-6 text-sm leading-relaxed text-slate-600">
          <p>
            This policy describes the information {siteConfig.name} collects and
            how it is used to operate comment-to-DM automation. We do not sell
            your personal information.
          </p>

          <h2 className="text-lg font-semibold text-slate-900">Information we collect</h2>
          <ul className="list-disc space-y-2 pl-5">
            <li>
              Account data: email, optional name, password hash, and the times you
              accepted the Terms of Service and Privacy Policy.
            </li>
            <li>
              Connected Instagram professional account identifiers and profile
              metadata (for example Instagram user id, username, account type,
              profile picture URL, and related connection status).
            </li>
            <li>
              Encrypted Instagram access token storage used to call Meta APIs on
              your behalf.
            </li>
            <li>Keyword rules you create (keyword, message, and media scope).</li>
            <li>
              DM and activity records (comment identifiers, commenter identifiers,
              media identifiers, send outcomes, and related error summaries).
            </li>
            <li>
              Billing data if Stripe is enabled (customer and subscription
              identifiers, plan status, and invoice history stored for your
              account).
            </li>
            <li>
              Support and contact messages you submit through the contact form
              (name, email, subject, and message), which are emailed to our
              support inbox when email delivery is configured.
            </li>
          </ul>

          <h2 className="text-lg font-semibold text-slate-900">How we use information</h2>
          <p>
            We use this information to authenticate you, connect Instagram,
            match comments to keyword rules, send private replies, show your
            dashboard and activity, process billing when enabled, and respond to
            support requests. Access tokens are stored encrypted and are not
            exposed in client-side application code.
          </p>

          <h2 className="text-lg font-semibold text-slate-900">Processors and third parties</h2>
          <ul className="list-disc space-y-2 pl-5">
            <li>Meta APIs for Instagram professional login, webhooks, media, and private replies.</li>
            <li>Hosting and infrastructure providers that run the application and database.</li>
            <li>An email provider (Resend) when transactional email is configured, for password-reset and contact-form messages.</li>
            <li>Stripe when billing is enabled, for checkout and subscription processing.</li>
          </ul>

          <h2 className="text-lg font-semibold text-slate-900">Retention</h2>
          <p>
            We keep account and automation data while your account is active.
            After a verified deletion request, we delete or anonymize personal
            data we control, except where we must retain records for law, fraud
            prevention, or dispute resolution. Exact timing can vary; we do not
            publish a guaranteed deletion SLA beyond processing verified requests
            in good faith.
          </p>

          <h2 className="text-lg font-semibold text-slate-900">Your choices</h2>
          <p>
            You may request access, correction, or deletion of your personal data
            through the{" "}
            <Link href="/contact" className="text-brand-600 hover:text-brand-700">
              contact form
            </Link>
            . Follow the{" "}
            <Link href="/data-deletion" className="text-brand-600 hover:text-brand-700">
              data deletion instructions
            </Link>{" "}
            for account and Instagram-related data held by {siteConfig.name}.
            Removing data here does not delete your Instagram or Facebook account.
          </p>

          <h2 className="text-lg font-semibold text-slate-900">Contact</h2>
          <p>
            Privacy questions can be sent through the{" "}
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
