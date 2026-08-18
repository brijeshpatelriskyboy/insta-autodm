import type { Metadata } from "next";
import Link from "next/link";
import { DATA_DELETION_LAST_UPDATED } from "@/lib/data-deletion-copy";
import { siteConfig } from "@/lib/marketing-data";

export const metadata: Metadata = {
  title: "Data Deletion",
  description: `How to delete your ${siteConfig.name} account and Instagram-connected data.`,
};

export default function DataDeletionPage() {
  return (
    <section className="py-16 sm:py-24">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
          Data Deletion Instructions
        </h1>
        <p className="mt-4 text-sm text-slate-500">Last updated: {DATA_DELETION_LAST_UPDATED}</p>

        <div className="prose prose-slate mt-10 max-w-none space-y-6 text-sm leading-relaxed text-slate-600">
          <p>
            {siteConfig.name} lets you delete your account from Settings, disconnect
            Instagram without deleting your login, and processes Meta data-deletion
            callbacks for Instagram-sourced data.
          </p>

          <h2 className="text-lg font-semibold text-slate-900">Delete your Comment2DM account</h2>
          <ol className="list-decimal space-y-3 pl-5">
            <li>Sign in to {siteConfig.name}.</li>
            <li>
              Open <Link href="/dashboard/settings" className="text-brand-600 hover:text-brand-700">Settings</Link>{" "}
              → Account / Danger Zone.
            </li>
            <li>
              Enter your current password and type <span className="font-medium text-slate-800">DELETE</span>.
            </li>
            <li>
              After the server confirms deletion, you are signed out and returned to login.
            </li>
          </ol>
          <p>
            If you cannot sign in, use the{" "}
            <Link href="/contact" className="text-brand-600 hover:text-brand-700">
              contact form
            </Link>{" "}
            and describe the account email you want removed.
          </p>

          <h2 className="text-lg font-semibold text-slate-900">What Comment2DM deletes</h2>
          <p>When account deletion succeeds, Comment2DM deletes rows owned by that user:</p>
          <ul className="list-disc space-y-2 pl-5">
            <li>Login profile (email, name, password hash, consent timestamps)</li>
            <li>Password-reset tokens</li>
            <li>Keyword rules and Smart Campaigns (including codes and claims)</li>
            <li>DM event / activity / lead records tied to the account</li>
            <li>Instagram connection row and stored access token</li>
            <li>Local subscription and billing event rows stored in Comment2DM</li>
          </ul>

          <h2 className="text-lg font-semibold text-slate-900">What may remain</h2>
          <ul className="list-disc space-y-2 pl-5">
            <li>
              A leftover JWT on a device is unusable for account data after the user
              row is gone; Comment2DM does not keep a server session store to revoke.
            </li>
            <li>
              Stripe may retain customer, subscription, or invoice objects on Stripe
              systems. This deletion flow does not call Stripe to cancel a subscription.
            </li>
            <li>
              Meta data-deletion confirmation records (confirmation code and status
              only — no password or access token) may remain so a status URL still works.
            </li>
          </ul>

          <h2 className="text-lg font-semibold text-slate-900">Disconnect Instagram</h2>
          <p>
            Integrations → Disconnect Instagram removes the stored access token and
            marks the integration disconnected. Comment2DM then ignores webhooks for
            that account. Keyword rules, campaigns, and your login stay. Disconnecting
            twice is safe (already disconnected).
          </p>

          <h2 className="text-lg font-semibold text-slate-900">Instagram / Meta data deletion</h2>
          <p>
            If you remove {siteConfig.name} from Instagram or Facebook Apps and
            websites and request data deletion, Meta can POST a signed request to
            Comment2DM. Comment2DM verifies the HMAC-SHA256 signature with the
            Instagram app secret, then matches Meta&apos;s <span className="font-medium text-slate-800">user_id</span>{" "}
            against the Instagram user ID or Facebook Page ID stored for an
            integration. On a match, Comment2DM deletes Instagram-sourced DM event
            records for that integration and wipes stored credentials. Your
            Comment2DM email/password login is not deleted by that callback.
          </p>
          <p>
            If Meta sends an app-scoped ID Comment2DM does not store, the callback
            still acknowledges the request with a confirmation code and status{" "}
            <span className="font-medium text-slate-800">not_found</span>. No
            Instagram-sourced rows are changed in that case — use in-app account
            deletion or the contact form.
          </p>
          <p>
            Meta shows a confirmation code and a status URL. You can also open{" "}
            <Link href="/data-deletion/status" className="text-brand-600 hover:text-brand-700">
              /data-deletion/status
            </Link>{" "}
            with that code.
          </p>
          <p>
            Removing data from {siteConfig.name} does not delete your Instagram or
            Facebook account. Disconnect and Meta callbacks wipe credentials stored
            by Comment2DM; they do not call Meta to revoke the Graph token on
            Meta&apos;s side.
          </p>

          <h2 className="text-lg font-semibold text-slate-900">Support</h2>
          <p>
            Questions: use the{" "}
            <Link href="/contact" className="text-brand-600 hover:text-brand-700">
              contact form
            </Link>{" "}
            or email{" "}
            <a href="mailto:hello@comment2dm.com" className="text-brand-600 hover:text-brand-700">
              hello@comment2dm.com
            </a>
            . See also the{" "}
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
