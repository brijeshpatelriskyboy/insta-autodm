import { env } from "../config/env";

export type PlanSlug = "starter" | "creator" | "pro";

export interface PlanConfig {
  slug: PlanSlug;
  name: string;
  price: number;
  standardPrice?: number;
  introductoryMonths?: number;
  priceId: string | undefined;
  couponId: string | undefined;
}

export const PLANS: Record<PlanSlug, PlanConfig> = {
  starter: {
    slug: "starter",
    name: "Starter",
    price: 5,
    standardPrice: 9,
    introductoryMonths: 3,
    priceId: env.STRIPE_PRICE_STARTER,
    couponId: env.STRIPE_STARTER_COUPON,
  },
  creator: {
    slug: "creator",
    name: "Creator",
    price: 19,
    priceId: env.STRIPE_PRICE_CREATOR,
    couponId: undefined,
  },
  pro: {
    slug: "pro",
    name: "Pro",
    price: 49,
    priceId: env.STRIPE_PRICE_PRO,
    couponId: undefined,
  },
};

export function getPlan(slug: string): PlanConfig | null {
  if (slug in PLANS) {
    return PLANS[slug as PlanSlug];
  }
  return null;
}
