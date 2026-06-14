import type { Metadata } from "next";
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
        <p className="mt-4 text-sm text-slate-500">Last updated: June 2026</p>

        <div className="prose prose-slate mt-10 max-w-none space-y-6 text-sm leading-relaxed text-slate-600">
          <p>
            {siteConfig.name} (&ldquo;we,&rdquo; &ldquo;us,&rdquo; or &ldquo;our&rdquo;)
            respects your privacy. This policy explains how we collect, use, and
            protect your information.
          </p>

          <h2 className="text-lg font-semibold text-slate-900">Information We Collect</h2>
          <p>
            We collect account information (email, name), Instagram Business account
            data (with your permission), keyword rules, DM activity logs, and usage
            analytics to provide and improve our service.
          </p>

          <h2 className="text-lg font-semibold text-slate-900">How We Use Your Data</h2>
          <p>
            Your data is used to operate DM automations, display analytics, provide
            customer support, and improve product features. We do not sell your
            personal information to third parties.
          </p>

          <h2 className="text-lg font-semibold text-slate-900">Data Security</h2>
          <p>
            We use industry-standard encryption for data in transit and at rest.
            Access tokens are stored securely and never exposed in client-side code.
          </p>

          <h2 className="text-lg font-semibold text-slate-900">Data Retention</h2>
          <p>
            We retain your data while your account is active. Upon account deletion,
            personal data is removed within 30 days, except where retention is
            required by law.
          </p>

          <h2 className="text-lg font-semibold text-slate-900">Your Rights</h2>
          <p>
            You may request access, correction, or deletion of your personal data
            at any time by contacting{" "}
            <a href="mailto:privacy@instaautodm.com" className="text-brand-600 hover:text-brand-700">
              privacy@instaautodm.com
            </a>
            .
          </p>

          <h2 className="text-lg font-semibold text-slate-900">Contact</h2>
          <p>
            For privacy-related inquiries, email{" "}
            <a href="mailto:privacy@instaautodm.com" className="text-brand-600 hover:text-brand-700">
              privacy@instaautodm.com
            </a>
            .
          </p>
        </div>
      </div>
    </section>
  );
}
