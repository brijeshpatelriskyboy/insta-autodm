import { beforeEach, describe, expect, it, vi } from "vitest";

const { findUnique, update, stripeUpdate } = vi.hoisted(() => ({
  findUnique: vi.fn(),
  update: vi.fn(),
  stripeUpdate: vi.fn(),
}));

vi.mock("../lib/prisma", () => ({
  prisma: { subscription: { findUnique, update } },
}));
vi.mock("../config/env", () => ({
  env: { STRIPE_SECRET_KEY: "sk_test_mock_only" },
}));
vi.mock("stripe", () => {
  class StripeInvalidRequestError extends Error {
    code: string;
    constructor(code: string) {
      super("No such subscription");
      this.code = code;
    }
  }
  class MockStripe {
    subscriptions = { update: stripeUpdate };
    static errors = { StripeInvalidRequestError };
  }
  return { default: MockStripe };
});

import Stripe from "stripe";
import { billingService } from "./billing.service";
import { AppError } from "../utils/errors";

describe("billing cancellation with live and historical subscriptions", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    findUnique.mockResolvedValue({
      userId: "user-1",
      stripeSubscriptionId: "sub_historical",
      status: "active",
    });
    update.mockResolvedValue({});
  });

  it("returns 409 and preserves the database for a missing Stripe subscription", async () => {
    stripeUpdate.mockRejectedValueOnce(
      new Stripe.errors.StripeInvalidRequestError("resource_missing"),
    );
    await expect(billingService.cancelSubscription("user-1")).rejects.toMatchObject({
      statusCode: 409,
      message: expect.stringContaining("current billing account"),
    });
    expect(stripeUpdate).toHaveBeenCalledOnce();
    expect(update).not.toHaveBeenCalled();
  });

  it("schedules cancellation and records it for a valid subscription", async () => {
    stripeUpdate.mockResolvedValueOnce({ id: "sub_live", status: "active" });
    const result = await billingService.cancelSubscription("user-1");
    expect(result).toEqual({
      message: "Subscription will cancel at the end of the billing period",
    });
    expect(stripeUpdate).toHaveBeenCalledWith("sub_historical", {
      cancel_at_period_end: true,
      discounts: [],
    });
    expect(update).toHaveBeenCalledWith({
      where: { userId: "user-1" },
      data: { cancelAtPeriodEnd: true },
    });
  });

  it("does not mask unrelated Stripe failures or change database records", async () => {
    stripeUpdate.mockRejectedValueOnce(new Error("Temporary Stripe outage"));
    await expect(billingService.cancelSubscription("user-1")).rejects.toThrow(
      "Temporary Stripe outage",
    );
    expect(update).not.toHaveBeenCalled();
  });
});
