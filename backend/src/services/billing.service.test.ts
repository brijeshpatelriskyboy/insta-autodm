import { describe, expect, it } from "vitest";
import {
  buildCheckoutSessionParams,
  buildCancelSubscriptionParams,
  buildPlanChangeParams,
  buildResumeSubscriptionParams,
  invoiceDescription,
  invoiceHistoryAmount,
  subscriptionPeriodEnd,
} from "./billing.service";

describe("Stripe billing period compatibility", () => {
  const end = 1792540800;
  it("reads Acacia subscription-level billing periods", () => {
    expect(subscriptionPeriodEnd({ current_period_end: end }))
      .toEqual(new Date(end * 1000));
  });
  it("reads newer webhook item-level billing periods without a top-level field", () => {
    expect(subscriptionPeriodEnd({ items: { data: [{ current_period_end: end }] } }))
      .toEqual(new Date(end * 1000));
  });
  it("uses the next renewal when items have different periods", () => {
    expect(subscriptionPeriodEnd({ items: { data: [
      { current_period_end: end + 86400 }, { current_period_end: end },
    ] } })).toEqual(new Date(end * 1000));
  });
  it("returns null when no valid billing period is available", () => {
    expect(subscriptionPeriodEnd({})).toBeNull();
    expect(subscriptionPeriodEnd({ items: { data: [
      {}, { current_period_end: null }, { current_period_end: NaN },
      { current_period_end: 0 },
    ] } })).toBeNull();
  });
});

describe("billing checkout configuration", () => {
  it("lets customers enter the Instagram promotion code on every plan", () => {
    const params = buildCheckoutSessionParams({
      customerId: "cus_test",
      userId: "user-1",
      frontendUrl: "https://comment2dm.example",
      allowPromotionCodes: true,
      launchOfferInstagramUserId: "ig-123",
      expiresAt: new Date("2026-10-01T00:30:00.000Z"),
      plan: {
        slug: "starter",
        name: "Starter",
        price: 5,
        annualPrice: 86.4,
        annualPriceId: undefined,
        standardPrice: 9,
        introductoryMonths: 3,
        priceId: "price_9_usd_monthly",
        couponId: "coupon_4_usd_three_months",
      },
    });

    expect(params).toMatchObject({
      customer: "cus_test",
      client_reference_id: "user-1",
      mode: "subscription",
      line_items: [{ price: "price_9_usd_monthly", quantity: 1 }],
      allow_promotion_codes: true,
      metadata: {
        userId: "user-1",
        plan: "starter",
        billingInterval: "monthly",
        launchOfferInstagramUserId: "ig-123",
      },
      subscription_data: {
        metadata: {
          userId: "user-1",
          plan: "starter",
          launchOfferInstagramUserId: "ig-123",
        },
      },
      expires_at: 1790814600,
      success_url:
        "https://comment2dm.example/dashboard/billing?checkout=success&session_id={CHECKOUT_SESSION_ID}",
      cancel_url: "https://comment2dm.example/dashboard/billing?checkout=canceled",
    });
  });

  it("disables promotion codes when the Instagram account is not eligible", () => {
    const params = buildCheckoutSessionParams({
      customerId: "cus_test",
      userId: "user-1",
      frontendUrl: "https://comment2dm.example",
      allowPromotionCodes: false,
      plan: {
        slug: "starter",
        name: "Starter",
        price: 9,
        annualPrice: 86.4,
        annualPriceId: undefined,
        priceId: "price_9_usd_monthly",
        couponId: undefined,
        limits: { instagramAccounts: 1, keywordRules: 5, monthlyDms: 1_000 },
      },
    });

    expect(params.allow_promotion_codes).toBe(false);
    expect(params.metadata).toEqual({ userId: "user-1", plan: "starter", billingInterval: "monthly" });
    expect(params.subscription_data?.metadata).toEqual({
      userId: "user-1",
      plan: "starter",
      billingInterval: "monthly",
    });
    expect(params.expires_at).toBeUndefined();
  });

  it("does not require an automatically applied Starter coupon", () => {
    expect(() =>
      buildCheckoutSessionParams({
        customerId: "cus_test",
        userId: "user-1",
        frontendUrl: "https://comment2dm.example",
        plan: {
          slug: "starter",
          name: "Starter",
          price: 5,
          standardPrice: 9,
          introductoryMonths: 3,
          priceId: "price_9_usd_monthly",
          couponId: undefined,
        },
      }),
    ).not.toThrow();
  });

  it("also enables promotion codes for Creator and Pro", () => {
    const params = buildCheckoutSessionParams({
      customerId: "cus_test",
      userId: "user-1",
      frontendUrl: "https://comment2dm.example",
      allowPromotionCodes: true,
      plan: {
        slug: "creator",
        name: "Creator",
        price: 19,
        annualPrice: 182.4,
        annualPriceId: undefined,
        priceId: "price_creator_monthly",
        couponId: undefined,
      },
    });

    expect(params.line_items).toEqual([{ price: "price_creator_monthly", quantity: 1 }]);
    expect(params.discounts).toBeUndefined();
    expect(params.allow_promotion_codes).toBe(true);
  });
});

describe("billing plan changes", () => {
  it("replaces the existing item, invoices prorations, and resumes cancellation", () => {
    const params = buildPlanChangeParams({
      itemId: "si_current",
      userId: "user-1",
      plan: {
        slug: "creator",
        name: "Creator",
        price: 19,
        annualPrice: 182.4,
        annualPriceId: undefined,
        priceId: "price_creator_monthly",
        couponId: undefined,
        limits: { instagramAccounts: 3, keywordRules: 15, monthlyDms: 5_000 },
      },
    });

    expect(params).toEqual({
      items: [{ id: "si_current", price: "price_creator_monthly", quantity: 1 }],
      metadata: { userId: "user-1", plan: "creator", billingInterval: "monthly" },
      cancel_at_period_end: false,
      proration_behavior: "always_invoice",
      payment_behavior: "error_if_incomplete",
    });
  });

  it("fails closed when the target plan has no Stripe price", () => {
    expect(() =>
      buildPlanChangeParams({
        itemId: "si_current",
        userId: "user-1",
        plan: {
          slug: "pro",
          name: "Pro",
          price: 49,
          annualPrice: 470.4,
          annualPriceId: undefined,
          priceId: undefined,
          couponId: undefined,
          limits: { instagramAccounts: 15, keywordRules: null, monthlyDms: 25_000 },
        },
      }),
    ).toThrow("Stripe price is not configured for this plan");
  });
});

describe("billing cancellation recovery", () => {
  it("removes promotional discounts when cancellation is scheduled", () => {
    expect(buildCancelSubscriptionParams()).toEqual({
      cancel_at_period_end: true,
      discounts: [],
    });
  });

  it("resumes renewal without changing the plan or billing cycle", () => {
    expect(buildResumeSubscriptionParams()).toEqual({
      cancel_at_period_end: false,
    });
  });
});

describe("billing history descriptions", () => {
  it("summarizes a prorated upgrade using both invoice lines", () => {
    expect(
      invoiceDescription([
        { description: "Unused time on Starter (with $4.00 off) after 22 Sep 2026" },
        { description: "Remaining time on Creator after 22 Sep 2026" },
      ]),
    ).toBe("Plan change: Starter → Creator");
  });

  it("keeps Stripe's normal recurring invoice description", () => {
    expect(invoiceDescription([{ description: "1 × Starter (at $9.00 / month)" }])).toBe(
      "1 × Starter (at $9.00 / month)",
    );
  });

  it("falls back safely when Stripe provides no description", () => {
    expect(invoiceDescription([])).toBe("Subscription payment");
  });
});

describe("billing history amounts", () => {
  it("shows a negative invoice total as customer credit", () => {
    expect(
      invoiceHistoryAmount({
        status: "paid",
        total: -1354,
        amountPaid: 0,
        amountDue: 0,
      }),
    ).toBe(-1354);
  });

  it("shows the amount actually collected for a paid invoice", () => {
    expect(
      invoiceHistoryAmount({
        status: "paid",
        total: 1355,
        amountPaid: 1355,
        amountDue: 0,
      }),
    ).toBe(1355);
  });
});
