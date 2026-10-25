import http from "http";
import type { AddressInfo } from "net";
import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import Stripe from "stripe";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  userFind: vi.fn(), transaction: vi.fn(), retrieve: vi.fn(), cancel: vi.fn(), customerDelete: vi.fn(),
  deletes: Object.fromEntries([
    "dmEvent", "keywordRule", "lead", "instagramConnectionRequest", "instagramAccount",
    "activityEvent", "planUsage", "passwordResetToken", "billingEvent", "subscription", "liteOfferClaim",
  ].map((name) => [name, vi.fn()])),
  detachClaim: vi.fn(), deleteUser: vi.fn(),
}));
vi.mock("../lib/prisma", () => ({ prisma: {
  user: { findUnique: mocks.userFind }, $transaction: mocks.transaction,
} }));
vi.mock("stripe", async (importOriginal) => {
  const actual = await importOriginal<typeof import("stripe")>();
  class MockStripe {
    subscriptions = { retrieve: mocks.retrieve, cancel: mocks.cancel };
    customers = { del: mocks.customerDelete };
    static errors = actual.default.errors;
  }
  return { default: MockStripe };
});
import router from "./accountDeletion.routes";
import { errorHandler } from "../middleware/errorHandler";

const fixturePassword = "test-fixture-password";
let passwordHash: string;
const previousKey = process.env.STRIPE_SECRET_KEY;

async function request(body: unknown, authenticated = true) {
  const app = express();
  app.use(express.json());
  app.use("/api/account", router);
  app.use(errorHandler);
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  try {
    const token = jwt.sign({ userId: "delete-test-user", email: "test@example.invalid", name: "Test" },
      process.env.JWT_SECRET!, { expiresIn: "1h" });
    const response = await fetch(`http://127.0.0.1:${port}/api/account`, {
      method: "DELETE", headers: { "Content-Type": "application/json", ...(authenticated ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(body),
    });
    return { status: response.status, body: await response.json() };
  } finally {
    await new Promise<void>((resolve, reject) => server.close((err) => err ? reject(err) : resolve()));
  }
}

function user(subscription: { stripeSubscriptionId?: string | null; stripeCustomerId?: string | null } | null = null) {
  return { id: "delete-test-user", passwordHash, subscription };
}
function missingResource() {
  return new Stripe.errors.StripeInvalidRequestError({ type: "invalid_request_error", code: "resource_missing", message: "No such resource" });
}
const confirmed = { password: fixturePassword, confirmation: "DELETE MY ACCOUNT" };

describe("account deletion (isolated database and Stripe fixtures)", () => {
  beforeEach(async () => {
    vi.resetAllMocks();
    passwordHash = await bcrypt.hash(fixturePassword, 4);
    process.env.STRIPE_SECRET_KEY = "sk_test_fixture_never_sent";
    mocks.userFind.mockResolvedValue(user());
    mocks.retrieve.mockResolvedValue({ id: "sub_fixture", status: "active" });
    mocks.cancel.mockResolvedValue({ id: "sub_fixture", status: "canceled" });
    mocks.customerDelete.mockResolvedValue({ id: "cus_fixture", deleted: true });
    mocks.transaction.mockImplementation(async (fn) => fn({
      ...Object.fromEntries(Object.entries(mocks.deletes).map(([name, deleteMany]) => [name, { deleteMany }])),
      launchOfferClaim: { updateMany: mocks.detachClaim }, user: { delete: mocks.deleteUser },
    }));
  });
  afterEach(() => {
    if (previousKey === undefined) delete process.env.STRIPE_SECRET_KEY;
    else process.env.STRIPE_SECRET_KEY = previousKey;
  });

  it("requires authentication before accessing account data", async () => {
    expect((await request(confirmed, false)).status).toBe(401);
    expect(mocks.userFind).not.toHaveBeenCalled();
  });
  it("requires the exact deletion phrase", async () => {
    expect((await request({ ...confirmed, confirmation: "DELETE" })).status).toBe(400);
    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(mocks.customerDelete).not.toHaveBeenCalled();
  });
  it("rejects a wrong password without billing or data changes", async () => {
    expect((await request({ ...confirmed, password: "wrong-password" })).status).toBe(403);
    expect(mocks.retrieve).not.toHaveBeenCalled();
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
  it("scopes all operational deletion to the authenticated user and detaches the launch marker", async () => {
    expect(await request(confirmed)).toEqual({ status: 200, body: { deleted: true } });
    for (const remove of Object.values(mocks.deletes)) expect(remove).toHaveBeenCalledWith({ where: { userId: "delete-test-user" } });
    expect(mocks.detachClaim).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId: "delete-test-user" }, data: { userId: null, checkoutSessionId: null, stripeSubscriptionId: null, reservedUntil: null },
    }));
    expect(mocks.deleteUser).toHaveBeenCalledWith({ where: { id: "delete-test-user" } });
    expect(mocks.customerDelete).not.toHaveBeenCalled();
  });
  it("cancels active billing and removes its customer before local deletion", async () => {
    mocks.userFind.mockResolvedValue(user({ stripeSubscriptionId: "sub_fixture", stripeCustomerId: "cus_fixture" }));
    expect((await request(confirmed)).status).toBe(200);
    expect(mocks.cancel).toHaveBeenCalledWith("sub_fixture", { prorate: false });
    expect(mocks.cancel.mock.invocationCallOrder[0]).toBeLessThan(mocks.customerDelete.mock.invocationCallOrder[0]);
    expect(mocks.customerDelete.mock.invocationCallOrder[0]).toBeLessThan(mocks.transaction.mock.invocationCallOrder[0]);
  });
  it("does not cancel an already canceled subscription again", async () => {
    mocks.userFind.mockResolvedValue(user({ stripeSubscriptionId: "sub_fixture", stripeCustomerId: "cus_fixture" }));
    mocks.retrieve.mockResolvedValue({ id: "sub_fixture", status: "canceled" });
    expect((await request(confirmed)).status).toBe(200);
    expect(mocks.cancel).not.toHaveBeenCalled();
  });
  it("can delete an account with historical Stripe IDs absent from the configured account", async () => {
    mocks.userFind.mockResolvedValue(user({ stripeSubscriptionId: "sub_old", stripeCustomerId: "cus_old" }));
    mocks.retrieve.mockRejectedValue(missingResource());
    mocks.customerDelete.mockRejectedValue(missingResource());
    expect((await request(confirmed)).status).toBe(200);
    expect(mocks.cancel).not.toHaveBeenCalled();
    expect(mocks.deleteUser).toHaveBeenCalledOnce();
  });
  it("can retry local deletion when the Stripe customer was already removed", async () => {
    mocks.userFind.mockResolvedValue(user({ stripeSubscriptionId: null, stripeCustomerId: "cus_fixture" }));
    mocks.customerDelete.mockRejectedValue(missingResource());
    expect((await request(confirmed)).status).toBe(200);
    expect(mocks.deleteUser).toHaveBeenCalledOnce();
  });
  it("fails closed when billing is configured on the user but the Stripe key is absent", async () => {
    delete process.env.STRIPE_SECRET_KEY;
    mocks.userFind.mockResolvedValue(user({ stripeSubscriptionId: null, stripeCustomerId: "cus_fixture" }));
    expect((await request(confirmed)).status).toBe(503);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
  it("does not delete local data during a Stripe lookup outage", async () => {
    mocks.userFind.mockResolvedValue(user({ stripeSubscriptionId: "sub_fixture", stripeCustomerId: "cus_fixture" }));
    mocks.retrieve.mockRejectedValue(new Error("Temporary Stripe outage"));
    expect((await request(confirmed)).status).toBe(503);
    expect(mocks.customerDelete).not.toHaveBeenCalled();
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
  it("does not delete local data when cancellation fails", async () => {
    mocks.userFind.mockResolvedValue(user({ stripeSubscriptionId: "sub_fixture", stripeCustomerId: "cus_fixture" }));
    mocks.cancel.mockRejectedValue(new Error("Temporary Stripe outage"));
    expect((await request(confirmed)).status).toBe(503);
    expect(mocks.customerDelete).not.toHaveBeenCalled();
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
  it("does not delete local data when customer cleanup fails", async () => {
    mocks.userFind.mockResolvedValue(user({ stripeSubscriptionId: null, stripeCustomerId: "cus_fixture" }));
    mocks.customerDelete.mockRejectedValue(new Error("Temporary Stripe outage"));
    expect((await request(confirmed)).status).toBe(503);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
});
