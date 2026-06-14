import { MessageCircle, Search, Send, UserCheck } from "lucide-react";
import { howItWorksSteps } from "@/lib/marketing-data";
import { AnimateIn } from "./AnimateIn";
import { SectionHeading } from "./SectionHeading";

const stepIcons = [MessageCircle, Search, Send, UserCheck];

export function HowItWorksSection() {
  return (
    <section id="how-it-works" className="py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="How it works"
          title="From comment to conversion in seconds"
          description="Four simple steps. Zero manual work. Your audience gets instant value, and you capture every lead."
        />

        <div className="relative mt-16">
          <div className="absolute left-8 top-8 hidden h-[calc(100%-4rem)] w-px bg-gradient-to-b from-brand-300 via-accent-400 to-brand-300 lg:left-1/2 lg:block" />

          <div className="space-y-12 lg:space-y-0">
            {howItWorksSteps.map((step, i) => {
              const Icon = stepIcons[i];
              const isEven = i % 2 === 0;

              return (
                <AnimateIn key={step.step} delay={i * 120}>
                  <div
                    className={`relative flex flex-col gap-6 lg:flex-row lg:items-center lg:gap-12 ${
                      isEven ? "lg:flex-row" : "lg:flex-row-reverse"
                    }`}
                  >
                    <div className={`flex-1 ${isEven ? "lg:text-right" : "lg:text-left"}`}>
                      <div
                        className={`inline-flex items-center gap-2 rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700 ${
                          isEven ? "lg:ml-auto" : ""
                        }`}
                      >
                        Step {step.step}
                      </div>
                      <h3 className="mt-3 text-xl font-semibold text-slate-900">
                        {step.title}
                      </h3>
                      <p className="mt-2 text-slate-600">
                        {step.highlight ? (
                          <>
                            {step.description.split(step.highlight)[0]}
                            <span className="rounded-md bg-brand-100 px-1.5 py-0.5 font-mono text-sm font-semibold text-brand-700">
                              {step.highlight}
                            </span>
                            {step.description.split(step.highlight)[1]}
                          </>
                        ) : (
                          step.description
                        )}
                      </p>
                    </div>

                    <div className="relative z-10 flex shrink-0 justify-center lg:w-16">
                      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-accent-500 text-white shadow-lg shadow-brand-500/25">
                        <Icon className="h-6 w-6" />
                      </div>
                    </div>

                    <div className="hidden flex-1 lg:block" />
                  </div>
                </AnimateIn>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
