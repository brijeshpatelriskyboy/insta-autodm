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
  limits: {
    instagramAccounts: number;
    keywordRules: number | null;
    monthlyDms: number;
  };
}

export const PLANS: Record<PlanSlug, PlanConfig> = {
  starter: {
    slug: "starter",
    name: "Starter",
    price: 9,
    priceId: env.STRIPE_PRICE_STARTER,
    couponId: env.STRIPE_STARTER_COUPON,
    limits: { instagramAccounts: 1, keywordRules: 3, monthlyDms: 500 },
  },
  creator: {
    slug: "creator",
    name: "Creator",
    price: 19,
    priceId: env.STRIPE_PRICE_CREATOR,
    couponId: undefined,
    limits: { instagramAccounts: 1, keywordRules: 15, monthlyDms: 5_000 },
  },
  pro: {
    slug: "pro",
    name: "Pro",
    price: 49,
    priceId: env.STRIPE_PRICE_PRO,
    couponId: undefined,
    limits: { instagramAccounts: 1, keywordRules: null, monthlyDms: 25_000 },
  },
};

export function getPlan(slug: string): PlanConfig | null {
  if (slug in PLANS) {
    return PLANS[slug as PlanSlug];
  }
  return null;
}
