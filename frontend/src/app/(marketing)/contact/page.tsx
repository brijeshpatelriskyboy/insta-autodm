import type { Metadata } from "next";
import { AnimateIn } from "@/components/marketing/AnimateIn";
import { ContactForm } from "@/components/marketing/ContactForm";
import { SectionHeading } from "@/components/marketing/SectionHeading";

export const metadata: Metadata = {
  title: "Contact",
  description:
    "Send a message to the Comment2DM team using the contact form.",
};

export default function ContactPage() {
  return (
    <>
      <section className="border-b border-slate-200/80 bg-white py-16 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <SectionHeading
            eyebrow="Contact"
            title="Contact Comment2DM"
            description="Use this form to ask about the product, billing, or your account. There is no live chat, office walk-in, or guaranteed response time."
          />
        </div>
      </section>

      <section className="py-20 sm:py-28">
        <div className="mx-auto grid max-w-7xl gap-12 px-4 sm:px-6 lg:grid-cols-2 lg:gap-16 lg:px-8">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">How to reach us</h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-600">
              Messages are emailed to the Comment2DM support inbox when email
              delivery is configured. Success is shown only after the server
              confirms that the message was sent. We reply when we can; there is
              no dedicated account manager or SLA.
            </p>
            <p className="mt-4 text-sm leading-relaxed text-slate-600">
              For account or data deletion requests, include the email on your
              account. See also{" "}
              <a href="/data-deletion" className="font-medium text-brand-600 hover:text-brand-700">
                Data Deletion
              </a>
              .
            </p>
          </div>

          <AnimateIn delay={150}>
            <ContactForm />
          </AnimateIn>
        </div>
      </section>
    </>
  );
}
