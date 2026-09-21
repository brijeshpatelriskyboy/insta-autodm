import { pricingPlans } from "./marketing-data";

export type PlanSlug = "starter";

export interface SelectedPlan {
  slug: PlanSlug;
  name: string;
  price: number;
  standardPrice: number;
  introductoryMonths: number;
}

const planSlugs: Record<string, PlanSlug> = {
  starter: "starter",
};

export function getPlanBySlug(slug: string | null): SelectedPlan | null {
  if (!slug) return null;

  const normalized = slug.toLowerCase();
  const validSlug = planSlugs[normalized];
  if (!validSlug) return null;

  const plan = pricingPlans.find((p) => p.slug === validSlug);
  if (!plan) return null;

  return {
    slug: validSlug,
    name: plan.name,
    price: plan.price,
    standardPrice: plan.standardPrice,
    introductoryMonths: plan.introductoryMonths,
  };
}

export function getRegisterUrl(plan?: PlanSlug): string {
  return plan ? `/register?plan=${plan}` : "/register";
}
