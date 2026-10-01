import { env } from "../config/env";

export type PlanSlug = "starter" | "creator" | "pro";

export type BillingInterval = "monthly" | "annual";

export interface PlanConfig {
  slug: PlanSlug;
  name: string;
  price: number;
  annualPrice: number;
  standardPrice?: number;
  introductoryMonths?: number;
  priceId: string | undefined;
  annualPriceId: string | undefined;
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
    annualPrice: 86.4,
    priceId: env.STRIPE_PRICE_STARTER,
    annualPriceId: env.STRIPE_PRICE_STARTER_ANNUAL,
    couponId: env.STRIPE_STARTER_COUPON,
    limits: { instagramAccounts: 1, keywordRules: 5, monthlyDms: 1_000 },
  },
  creator: {
    slug: "creator",
    name: "Creator",
    price: 19,
    annualPrice: 182.4,
    priceId: env.STRIPE_PRICE_CREATOR,
    annualPriceId: env.STRIPE_PRICE_CREATOR_ANNUAL,
    couponId: undefined,
    limits: { instagramAccounts: 3, keywordRules: null, monthlyDms: 10_000 },
  },
  pro: {
    slug: "pro",
    name: "Pro",
    price: 49,
    annualPrice: 470.4,
    priceId: env.STRIPE_PRICE_PRO,
    annualPriceId: env.STRIPE_PRICE_PRO_ANNUAL,
    couponId: undefined,
    limits: { instagramAccounts: 15, keywordRules: null, monthlyDms: 100_000 },
  },
};

export function getPlan(slug: string): PlanConfig | null {
  if (slug in PLANS) {
    return PLANS[slug as PlanSlug];
  }
  return null;
}
