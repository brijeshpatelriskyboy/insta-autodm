import {
  Activity,
  BarChart3,
  Camera,
  KeyRound,
  MessageSquare,
  Users,
} from "lucide-react";
import { features } from "@/lib/marketing-data";
import { AnimateIn } from "./AnimateIn";
import { SectionHeading } from "./SectionHeading";

const iconMap = {
  keyword: KeyRound,
  dm: MessageSquare,
  lead: Users,
  analytics: BarChart3,
  activity: Activity,
  instagram: Camera,
};

interface FeaturesGridProps {
  showHeading?: boolean;
  columns?: 2 | 3;
}

export function FeaturesGrid({ showHeading = true, columns = 3 }: FeaturesGridProps) {
  const gridClass =
    columns === 2
      ? "grid gap-6 sm:grid-cols-2"
      : "grid gap-6 sm:grid-cols-2 lg:grid-cols-3";

  const containerClass = showHeading
    ? "mx-auto max-w-7xl px-4 sm:px-6 lg:px-8"
    : "mx-auto max-w-7xl px-4 py-20 sm:px-6 sm:py-28 lg:px-8";

  return (
    <section className={showHeading ? "py-20 sm:py-28" : ""}>
      <div className={containerClass}>
        {showHeading && (
          <SectionHeading
            eyebrow="Features"
            title="Everything you need to automate Instagram DMs"
            description="Powerful tools built for creators who want to scale engagement without scaling their workload."
          />
        )}

        <div className={showHeading ? `mt-16 ${gridClass}` : gridClass}>
          {features.map((feature, i) => {
            const Icon = iconMap[feature.icon as keyof typeof iconMap];
            return (
              <AnimateIn key={feature.title} delay={i * 80}>
                <div className="group h-full rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm transition-all duration-300 hover:border-brand-200 hover:shadow-card">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-accent-500 text-white transition-transform duration-300 group-hover:scale-110">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="mt-4 text-lg font-semibold text-slate-900">
                    {feature.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-500">
                    {feature.description}
                  </p>
                </div>
              </AnimateIn>
            );
          })}
        </div>
      </div>
    </section>
  );
}
