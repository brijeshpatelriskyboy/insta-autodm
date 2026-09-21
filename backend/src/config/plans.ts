import { env } from "../config/env";

export type PlanSlug = "starter";

export interface PlanConfig {
  slug: PlanSlug;
  name: string;
  price: number;
  standardPrice: number;
  introductoryMonths: number;
  priceId: string | undefined;
  couponId: string | undefined;
}

export const PLANS: Record<PlanSlug, PlanConfig> = {
  starter: {
    slug: "starter",
    name: "Early Access",
    price: 5,
    standardPrice: 9,
    introductoryMonths: 3,
    priceId: env.STRIPE_PRICE_EARLY_ACCESS,
    couponId: env.STRIPE_EARLY_ACCESS_COUPON,
  },
};

export function getPlan(slug: string): PlanConfig | null {
  if (slug in PLANS) {
    return PLANS[slug as PlanSlug];
  }
  return null;
}
