import { describe, expect, it } from "vitest";
import { buildCheckoutSessionParams } from "./billing.service";

describe("billing checkout configuration", () => {
  it("applies the three-month Early Access coupon to the USD $9 recurring price", () => {
    const params = buildCheckoutSessionParams({
      customerId: "cus_test",
      userId: "user-1",
      frontendUrl: "https://comment2dm.example",
      plan: {
        slug: "starter",
        name: "Early Access",
        price: 5,
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
      discounts: [{ coupon: "coupon_4_usd_three_months" }],
      metadata: { userId: "user-1", plan: "starter" },
      subscription_data: {
        metadata: { userId: "user-1", plan: "starter" },
      },
      success_url:
        "https://comment2dm.example/dashboard/billing?checkout=success&session_id={CHECKOUT_SESSION_ID}",
      cancel_url: "https://comment2dm.example/dashboard/billing?checkout=canceled",
    });
  });

  it("fails closed when the price or coupon is missing", () => {
    expect(() =>
      buildCheckoutSessionParams({
        customerId: "cus_test",
        userId: "user-1",
        frontendUrl: "https://comment2dm.example",
        plan: {
          slug: "starter",
          name: "Early Access",
          price: 5,
          standardPrice: 9,
          introductoryMonths: 3,
          priceId: "price_9_usd_monthly",
          couponId: undefined,
        },
      }),
    ).toThrow("Stripe Early Access price or coupon is not configured");
  });
});
