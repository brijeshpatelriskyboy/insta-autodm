import { env } from "../config/env";

export type PlanSlug = "starter" | "creator" | "pro";

export interface PlanConfig {
  slug: PlanSlug;
  name: string;
  price: number;
  priceId: string | undefined;
}

export const PLANS: Record<PlanSlug, PlanConfig> = {
  starter: {
    slug: "starter",
    name: "Starter",
    price: 9.9,
    priceId: env.STRIPE_PRICE_STARTER,
  },
  creator: {
    slug: "creator",
    name: "Creator",
    price: 19,
    priceId: env.STRIPE_PRICE_CREATOR,
  },
  pro: {
    slug: "pro",
    name: "Pro",
    price: 49,
    priceId: env.STRIPE_PRICE_PRO,
  },
};

export function getPlan(slug: string): PlanConfig | null {
  if (slug in PLANS) {
    return PLANS[slug as PlanSlug];
  }
  return null;
}
