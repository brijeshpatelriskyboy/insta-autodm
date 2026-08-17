import type { Metadata } from "next";
import { Mail } from "lucide-react";
import { AnimateIn } from "@/components/marketing/AnimateIn";
import { ContactForm } from "@/components/marketing/ContactForm";
import { SectionHeading } from "@/components/marketing/SectionHeading";

export const metadata: Metadata = {
  title: "Contact",
  description: "Contact the Comment2DM team.",
};

const contactInfo = [
  {
    icon: Mail,
    title: "Email",
    value: "hello@comment2dm.com",
    href: "mailto:hello@comment2dm.com",
  },
];

export default function ContactPage() {
  return (
    <>
      <section className="border-b border-slate-200/80 bg-white py-16 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <SectionHeading
            eyebrow="Contact"
            title="Contact the Comment2DM team"
            description="Use the form to send a support message. We do not offer live chat, a 24-hour SLA, or a dedicated account manager during beta."
          />
        </div>
      </section>

      <section className="py-20 sm:py-28">
        <div className="mx-auto grid max-w-7xl gap-12 px-4 sm:px-6 lg:grid-cols-2 lg:gap-16 lg:px-8">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Get in touch</h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-600">
              The form submits to Comment2DM. We email the team at the configured
              support address and set Reply-To to the address you enter so we can
              respond. You can also email{" "}
              <a href="mailto:hello@comment2dm.com" className="font-medium text-brand-600">
                hello@comment2dm.com
              </a>
              .
            </p>

            <div className="mt-8 space-y-6">
              {contactInfo.map((item, i) => {
                const Icon = item.icon;
                return (
                  <AnimateIn key={item.title} delay={i * 80}>
                    <div className="flex items-start gap-4">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                        <a
                          href={item.href}
                          className="text-sm text-brand-600 hover:text-brand-700"
                        >
                          {item.value}
                        </a>
                      </div>
                    </div>
                  </AnimateIn>
                );
              })}
            </div>
          </div>

          <AnimateIn delay={150}>
            <ContactForm />
          </AnimateIn>
        </div>
      </section>
    </>
  );
}
