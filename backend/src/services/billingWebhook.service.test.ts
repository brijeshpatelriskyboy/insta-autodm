import Stripe from "stripe";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { row, updateMany } = vi.hoisted(() => ({
  row: { userId: "user-1", stripeSubscriptionId: "sub_current" as string | null, status: "active" },
  updateMany: vi.fn(),
}));
vi.mock("../lib/prisma", () => ({ prisma: { subscription: { updateMany } } }));
vi.mock("../config/env", () => ({
  env: { STRIPE_SECRET_KEY: "sk_test_fixture", STRIPE_WEBHOOK_SECRET: "whsec_fixture" },
}));
import { billingService } from "./billing.service";

async function deliver(type: string, subscriptionId: string) {
  const body = Buffer.from(JSON.stringify({ id: "evt_fixture", type, data: { object: {
    id: subscriptionId, status: "canceled", metadata: { userId: "user-1" },
    cancel_at_period_end: false,
  } } }));
  const signature = Stripe.webhooks.generateTestHeaderString({ payload: body.toString(), secret: "whsec_fixture" });
  return billingService.handleWebhook(body, signature);
}

describe("Stripe webhook subscription identity and signatures", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    Object.assign(row, { userId: "user-1", stripeSubscriptionId: "sub_current", status: "active" });
    updateMany.mockImplementation(async ({ where, data }) => {
      if (Object.entries(where).every(([key, value]) => row[key as keyof typeof row] === value)) {
        Object.assign(row, data);
        return { count: 1 };
      }
      return { count: 0 };
    });
  });

  it.each(["customer.subscription.updated", "customer.subscription.deleted"])(
    "ignores %s for a replaced subscription", async (type) => {
      await deliver(type, "sub_old");
      expect(row.status).toBe("active");
      expect(row.stripeSubscriptionId).toBe("sub_current");
    },
  );

  it("cancels the matching subscription and is safe to redeliver", async () => {
    await deliver("customer.subscription.deleted", "sub_current");
    await deliver("customer.subscription.deleted", "sub_current");
    expect(row.status).toBe("canceled");
    expect(row.stripeSubscriptionId).toBeNull();
  });

  it("rejects missing and invalid signatures before changing records", async () => {
    await expect(billingService.handleWebhook(Buffer.from("{}"), undefined)).rejects.toMatchObject({ statusCode: 400 });
    await expect(billingService.handleWebhook(Buffer.from("{}"), "invalid")).rejects.toMatchObject({ statusCode: 400 });
    expect(updateMany).not.toHaveBeenCalled();
  });
});
