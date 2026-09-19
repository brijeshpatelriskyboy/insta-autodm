import type { Metadata } from "next";
import Link from "next/link";
import { siteConfig } from "@/lib/marketing-data";

export const metadata: Metadata = {
  title: "Data Deletion",
  description: `How to request deletion of your ${siteConfig.name} account and associated data.`,
};

export default function DataDeletionPage() {
  return (
    <section className="py-16 sm:py-24">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
          Data Deletion Instructions
        </h1>
        <p className="mt-4 text-sm text-slate-500">Last updated: September 2026</p>

        <div className="prose prose-slate mt-10 max-w-none space-y-6 text-sm leading-relaxed text-slate-600">
          <p>
            {siteConfig.name} lets you request deletion of your account and
            personal data associated with the service, including data obtained
            through Instagram / Meta login.
          </p>

          <h2 className="text-lg font-semibold text-slate-900">How to request deletion</h2>
          <ol className="list-decimal space-y-3 pl-5">
            <li>
              Sign in to your {siteConfig.name} account if you still have access.
            </li>
            <li>
              Submit a request through the{" "}
              <Link href="/contact" className="text-brand-600 hover:text-brand-700">
                contact form
              </Link>{" "}
              using the email address on your account. Use a subject such as{" "}
              <span className="font-medium text-slate-800">Data Deletion Request</span>.
            </li>
            <li>
              Include your account email and, if applicable, the Instagram username
              connected to {siteConfig.name}.
            </li>
          </ol>

          <h2 className="text-lg font-semibold text-slate-900">What we delete</h2>
          <p>Upon a verified request, we delete or anonymize:</p>
          <ul className="list-disc space-y-2 pl-5">
            <li>Your {siteConfig.name} account profile (name, email, consent timestamps)</li>
            <li>Keyword rules and automation settings</li>
            <li>Stored Instagram connection tokens and related integration data</li>
            <li>Activity logs and DM event records tied to your account</li>
            <li>Billing records we store, except where retention is required</li>
          </ul>

          <h2 className="text-lg font-semibold text-slate-900">Timeline</h2>
          <p>
            We process verified deletion requests in good faith. Some records may
            be retained longer when required by law, fraud prevention, or dispute
            resolution. We do not guarantee a fixed number of days.
          </p>

          <h2 className="text-lg font-semibold text-slate-900">Instagram / Meta</h2>
          <p>
            Removing your data from {siteConfig.name} does not delete your Instagram
            or Facebook account. To revoke app permissions in Meta, open Instagram
            or Facebook settings → Apps and websites (or Security and login → Apps
            and websites) and remove {siteConfig.name}.
          </p>

          <h2 className="text-lg font-semibold text-slate-900">Contact</h2>
          <p>
            Questions about this process? Use the{" "}
            <Link href="/contact" className="text-brand-600 hover:text-brand-700">
              contact form
            </Link>
            . See also our{" "}
            <Link href="/privacy" className="text-brand-600 hover:text-brand-700">
              Privacy Policy
            </Link>
            .
          </p>
        </div>
      </div>
    </section>
  );
}
