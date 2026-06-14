import type { Metadata } from "next";
import { Mail, MapPin, MessageSquare } from "lucide-react";
import { AnimateIn } from "@/components/marketing/AnimateIn";
import { ContactForm } from "@/components/marketing/ContactForm";
import { SectionHeading } from "@/components/marketing/SectionHeading";

export const metadata: Metadata = {
  title: "Contact",
  description:
    "Get in touch with the Insta AutoDM team. Questions about pricing, enterprise plans, or partnerships.",
};

const contactInfo = [
  {
    icon: Mail,
    title: "Email",
    value: "hello@instaautodm.com",
    href: "mailto:hello@instaautodm.com",
  },
  {
    icon: MessageSquare,
    title: "Live chat",
    value: "Mon–Fri, 9am–6pm EST",
    href: null,
  },
  {
    icon: MapPin,
    title: "Office",
    value: "San Francisco, CA",
    href: null,
  },
];

export default function ContactPage() {
  return (
    <>
      <section className="border-b border-slate-200/80 bg-white py-16 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <SectionHeading
            eyebrow="Contact"
            title="We'd love to hear from you"
            description="Questions about pricing, enterprise plans, or partnerships? Send us a message."
          />
        </div>
      </section>

      <section className="py-20 sm:py-28">
        <div className="mx-auto grid max-w-7xl gap-12 px-4 sm:px-6 lg:grid-cols-2 lg:gap-16 lg:px-8">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Get in touch</h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-600">
              Our team typically responds within 24 hours. For urgent issues,
              Pro customers can reach their dedicated account manager directly.
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
                        {item.href ? (
                          <a
                            href={item.href}
                            className="text-sm text-brand-600 hover:text-brand-700"
                          >
                            {item.value}
                          </a>
                        ) : (
                          <p className="text-sm text-slate-600">{item.value}</p>
                        )}
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
