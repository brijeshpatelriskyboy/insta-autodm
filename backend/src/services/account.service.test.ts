import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockUserFindUnique,
  mockUserDelete,
  mockClaimDeleteMany,
  mockCodeDeleteMany,
  mockCampaignDeleteMany,
  mockTransaction,
  mockStopBilling,
} = vi.hoisted(() => ({
  mockUserFindUnique: vi.fn(),
  mockUserDelete: vi.fn(),
  mockClaimDeleteMany: vi.fn(),
  mockCodeDeleteMany: vi.fn(),
  mockCampaignDeleteMany: vi.fn(),
  mockTransaction: vi.fn(),
  mockStopBilling: vi.fn(),
}));

vi.mock("../lib/prisma", () => ({
  prisma: {
    user: { findUnique: mockUserFindUnique, delete: mockUserDelete },
    campaignClaim: { deleteMany: mockClaimDeleteMany },
    campaignCode: { deleteMany: mockCodeDeleteMany },
    campaign: { deleteMany: mockCampaignDeleteMany },
    $transaction: mockTransaction,
  },
}));

vi.mock("./billing.service", () => ({
  billingService: {
    stopBillableSubscriptionForAccountDeletion: mockStopBilling,
  },
}));

import { ACCOUNT_DELETE_CONFIRMATION, accountService } from "./account.service";
import { AppError } from "../utils/errors";

const BILLING_UNAVAILABLE =
  "Unable to cancel billing. Your account was not deleted. Try again later or contact support.";

const prismaTx = {
  campaignClaim: { deleteMany: mockClaimDeleteMany },
  campaignCode: { deleteMany: mockCodeDeleteMany },
  campaign: { deleteMany: mockCampaignDeleteMany },
  user: { delete: mockUserDelete },
};

describe("AccountService.deleteAccount", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    mockStopBilling.mockResolvedValue(undefined);
    mockTransaction.mockImplementation(async (fn: (tx: typeof prismaTx) => Promise<unknown>) =>
      fn(prismaTx),
    );
    const bcrypt = await import("bcryptjs");
    mockUserFindUnique.mockResolvedValue({
      id: "user-1",
      passwordHash: await bcrypt.hash("correct-password", 10),
    });
  });

  it("rejects an incorrect DELETE confirmation before touching the database", async () => {
    await expect(
      accountService.deleteAccount("user-1", {
        currentPassword: "correct-password",
        confirmation: "delete",
      }),
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(mockUserFindUnique).not.toHaveBeenCalled();
    expect(mockStopBilling).not.toHaveBeenCalled();
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it("rejects a wrong password and does not delete records", async () => {
    await expect(
      accountService.deleteAccount("user-1", {
        currentPassword: "wrong-password",
        confirmation: ACCOUNT_DELETE_CONFIRMATION,
      }),
    ).rejects.toMatchObject({ statusCode: 401, message: "Current password is incorrect" });
    expect(mockStopBilling).not.toHaveBeenCalled();
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it("deletes owned campaign children then the user; other users are not in the where clauses", async () => {
    const result = await accountService.deleteAccount("user-1", {
      currentPassword: "correct-password",
      confirmation: ACCOUNT_DELETE_CONFIRMATION,
    });

    expect(result).toEqual({ deleted: true });
    expect(mockStopBilling).toHaveBeenCalledWith("user-1");
    expect(mockStopBilling).not.toHaveBeenCalledWith("user-2");
    expect(mockClaimDeleteMany).toHaveBeenCalledWith({
      where: { campaign: { userId: "user-1" } },
    });
    expect(mockCodeDeleteMany).toHaveBeenCalledWith({
      where: { campaign: { userId: "user-1" } },
    });
    expect(mockCampaignDeleteMany).toHaveBeenCalledWith({ where: { userId: "user-1" } });
    expect(mockUserDelete).toHaveBeenCalledWith({ where: { id: "user-1" } });
    expect(mockUserDelete).not.toHaveBeenCalledWith({ where: { id: "user-2" } });
  });

  it("cancels billable Stripe billing before deleting local rows", async () => {
    const order: string[] = [];
    mockStopBilling.mockImplementation(async () => {
      order.push("stripe");
    });
    mockTransaction.mockImplementation(async (fn: (tx: typeof prismaTx) => Promise<unknown>) => {
      order.push("tx");
      return fn(prismaTx);
    });

    await accountService.deleteAccount("user-1", {
      currentPassword: "correct-password",
      confirmation: ACCOUNT_DELETE_CONFIRMATION,
    });

    expect(order).toEqual(["stripe", "tx"]);
  });

  it("does not delete the account when Stripe cancellation fails", async () => {
    mockStopBilling.mockRejectedValue(new AppError(503, BILLING_UNAVAILABLE));

    await expect(
      accountService.deleteAccount("user-1", {
        currentPassword: "correct-password",
        confirmation: ACCOUNT_DELETE_CONFIRMATION,
      }),
    ).rejects.toMatchObject({
      statusCode: 503,
      message: BILLING_UNAVAILABLE,
    });

    expect(mockTransaction).not.toHaveBeenCalled();
    expect(mockUserDelete).not.toHaveBeenCalled();
    expect(mockClaimDeleteMany).not.toHaveBeenCalled();
  });

  it("deleted user cannot log in after the user row is removed", async () => {
    await accountService.deleteAccount("user-1", {
      currentPassword: "correct-password",
      confirmation: ACCOUNT_DELETE_CONFIRMATION,
    });
    mockUserFindUnique.mockResolvedValue(null);
    const { authService } = await import("./auth.service");
    await expect(authService.login("ada@example.com", "correct-password")).rejects.toMatchObject({
      statusCode: 401,
      message: "Invalid email or password",
    });
  });
});
