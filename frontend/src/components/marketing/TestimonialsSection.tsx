import { AnimateIn } from "./AnimateIn";
import { SectionHeading } from "./SectionHeading";

const betaNotes = [
  {
    title: "What ships today",
    body: "Keyword rules, Instagram Meta OAuth for approved and test accounts, and automatic DMs when a matching comment arrives.",
  },
  {
    title: "What is still in progress",
    body: "Meta App Review for public Instagram accounts, password reset, live Stripe trial, and Smart Campaigns as a generally available feature.",
  },
  {
    title: "Honest early access",
    body: "Comment2DM is in beta. We do not claim thousands of customers or millions of DMs sent. Join if you want to automate comment-to-DM on a professional Instagram account.",
  },
];

export function TestimonialsSection() {
  return (
    <section className="py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="Early access"
          title="Built for creators — still in beta"
          description="No fabricated reviews. Comment2DM is early access while we finish Meta App Review and production hardening."
        />

        <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {betaNotes.map((note, i) => (
            <AnimateIn key={note.title} delay={i * 80}>
              <div className="flex h-full flex-col rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
                <h3 className="text-sm font-semibold text-slate-900">{note.title}</h3>
                <p className="mt-3 flex-1 text-sm leading-relaxed text-slate-600">
                  {note.body}
                </p>
              </div>
            </AnimateIn>
          ))}
        </div>
      </div>
    </section>
  );
}
