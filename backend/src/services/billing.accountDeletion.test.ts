import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "../utils/errors";

const {
  mockSubscriptionFindUnique,
  mockSubscriptionUpdate,
  mockSubscriptionDelete,
  mockBillingEventDeleteMany,
  mockUserDelete,
} = vi.hoisted(() => ({
  mockSubscriptionFindUnique: vi.fn(),
  mockSubscriptionUpdate: vi.fn(),
  mockSubscriptionDelete: vi.fn(),
  mockBillingEventDeleteMany: vi.fn(),
  mockUserDelete: vi.fn(),
}));

vi.mock("../lib/prisma", () => ({
  prisma: {
    subscription: {
      findUnique: mockSubscriptionFindUnique,
      update: mockSubscriptionUpdate,
      delete: mockSubscriptionDelete,
    },
    billingEvent: { deleteMany: mockBillingEventDeleteMany },
    user: { delete: mockUserDelete },
  },
}));

import {
  ACCOUNT_DELETE_BILLING_UNAVAILABLE_MESSAGE,
  billingService,
  isBillableStripeSubscription,
  setStripeClientForTests,
} from "./billing.service";

function fakeStripe(cancel: ReturnType<typeof vi.fn>) {
  return {
    subscriptions: { cancel },
  } as unknown as import("stripe").default;
}

describe("isBillableStripeSubscription", () => {
  it("is false without a Stripe subscription id", () => {
    expect(isBillableStripeSubscription(null)).toBe(false);
    expect(isBillableStripeSubscription({ stripeSubscriptionId: null, status: "active" })).toBe(
      false,
    );
    expect(
      isBillableStripeSubscription({ stripeSubscriptionId: "", status: "trialing" }),
    ).toBe(false);
  });

  it("is true for billable Stripe statuses with an id", () => {
    expect(
      isBillableStripeSubscription({ stripeSubscriptionId: "sub_1", status: "active" }),
    ).toBe(true);
    expect(
      isBillableStripeSubscription({ stripeSubscriptionId: "sub_1", status: "trialing" }),
    ).toBe(true);
    expect(
      isBillableStripeSubscription({ stripeSubscriptionId: "sub_1", status: "past_due" }),
    ).toBe(true);
  });

  it("is false for canceled or local inactive rows", () => {
    expect(
      isBillableStripeSubscription({ stripeSubscriptionId: "sub_1", status: "canceled" }),
    ).toBe(false);
    expect(
      isBillableStripeSubscription({ stripeSubscriptionId: "sub_1", status: "inactive" }),
    ).toBe(false);
  });
});

describe("billingService.stopBillableSubscriptionForAccountDeletion", () => {
  const mockCancel = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    setStripeClientForTests(fakeStripe(mockCancel));
    mockCancel.mockResolvedValue({ id: "sub_user1", status: "canceled" });
  });

  afterEach(() => {
    setStripeClientForTests(null);
  });

  it("skips Stripe when there is no billable subscription and does not delete local billing", async () => {
    mockSubscriptionFindUnique.mockResolvedValue(null);
    await billingService.stopBillableSubscriptionForAccountDeletion("user-1");
    expect(mockCancel).not.toHaveBeenCalled();

    mockSubscriptionFindUnique.mockResolvedValue({
      stripeSubscriptionId: null,
      status: "inactive",
    });
    await billingService.stopBillableSubscriptionForAccountDeletion("user-1");
    expect(mockCancel).not.toHaveBeenCalled();
    expect(mockSubscriptionUpdate).not.toHaveBeenCalled();
    expect(mockSubscriptionDelete).not.toHaveBeenCalled();
    expect(mockBillingEventDeleteMany).not.toHaveBeenCalled();
    expect(mockUserDelete).not.toHaveBeenCalled();
  });

  it("immediately cancels the authenticated user's Stripe subscription id only", async () => {
    mockSubscriptionFindUnique.mockResolvedValue({
      stripeSubscriptionId: "sub_user1",
      status: "active",
    });

    await billingService.stopBillableSubscriptionForAccountDeletion("user-1");

    expect(mockSubscriptionFindUnique).toHaveBeenCalledWith({
      where: { userId: "user-1" },
      select: { stripeSubscriptionId: true, status: true },
    });
    expect(mockSubscriptionFindUnique).not.toHaveBeenCalledWith({
      where: { userId: "user-2" },
      select: expect.anything(),
    });
    expect(mockCancel).toHaveBeenCalledTimes(1);
    expect(mockCancel).toHaveBeenCalledWith("sub_user1");
    expect(mockCancel).not.toHaveBeenCalledWith("sub_user2");
    expect(mockSubscriptionDelete).not.toHaveBeenCalled();
    expect(mockBillingEventDeleteMany).not.toHaveBeenCalled();
  });

  it("cancels past_due and trialing subscriptions the same way", async () => {
    mockSubscriptionFindUnique.mockResolvedValue({
      stripeSubscriptionId: "sub_trial",
      status: "trialing",
    });
    await billingService.stopBillableSubscriptionForAccountDeletion("user-1");
    expect(mockCancel).toHaveBeenCalledWith("sub_trial");
  });

  it("fails closed when Stripe is unavailable and does not delete local billing", async () => {
    mockSubscriptionFindUnique.mockResolvedValue({
      stripeSubscriptionId: "sub_user1",
      status: "active",
    });
    mockCancel.mockRejectedValue(new Error("stripe down"));

    await expect(
      billingService.stopBillableSubscriptionForAccountDeletion("user-1"),
    ).rejects.toMatchObject({
      statusCode: 503,
      message: ACCOUNT_DELETE_BILLING_UNAVAILABLE_MESSAGE,
    });

    expect(mockSubscriptionDelete).not.toHaveBeenCalled();
    expect(mockSubscriptionUpdate).not.toHaveBeenCalled();
    expect(mockBillingEventDeleteMany).not.toHaveBeenCalled();
    expect(mockUserDelete).not.toHaveBeenCalled();
  });

  it("fails closed when Stripe does not confirm canceled status", async () => {
    mockSubscriptionFindUnique.mockResolvedValue({
      stripeSubscriptionId: "sub_user1",
      status: "active",
    });
    mockCancel.mockResolvedValue({ id: "sub_user1", status: "active" });

    await expect(
      billingService.stopBillableSubscriptionForAccountDeletion("user-1"),
    ).rejects.toBeInstanceOf(AppError);
    expect(mockSubscriptionDelete).not.toHaveBeenCalled();
  });

  it("fails closed when status is billable but no Stripe subscription id is stored", async () => {
    mockSubscriptionFindUnique.mockResolvedValue({
      stripeSubscriptionId: null,
      status: "active",
    });

    await expect(
      billingService.stopBillableSubscriptionForAccountDeletion("user-1"),
    ).rejects.toMatchObject({ statusCode: 503 });
    expect(mockCancel).not.toHaveBeenCalled();
    expect(mockSubscriptionDelete).not.toHaveBeenCalled();
  });

  it("treats a missing Stripe subscription as already canceled", async () => {
    mockSubscriptionFindUnique.mockResolvedValue({
      stripeSubscriptionId: "sub_gone",
      status: "active",
    });
    mockCancel.mockRejectedValue({ code: "resource_missing" });

    await expect(
      billingService.stopBillableSubscriptionForAccountDeletion("user-1"),
    ).resolves.toBeUndefined();
    expect(mockSubscriptionDelete).not.toHaveBeenCalled();
  });
});
