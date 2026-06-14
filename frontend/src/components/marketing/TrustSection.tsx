import { trustStats } from "@/lib/marketing-data";
import { AnimateIn } from "./AnimateIn";

export function TrustSection() {
  return (
    <section className="border-y border-slate-200/80 bg-white py-12">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-8 sm:grid-cols-3">
          {trustStats.map((stat, i) => (
            <AnimateIn key={stat.label} delay={i * 100}>
              <div className="text-center">
                <p className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
                  {stat.value}
                </p>
                <p className="mt-2 text-sm font-medium text-slate-500">{stat.label}</p>
              </div>
            </AnimateIn>
          ))}
        </div>
      </div>
    </section>
  );
}
