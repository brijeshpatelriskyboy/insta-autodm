import Stripe from "stripe";
import { env, isStripeConfigured } from "../config/env";
import { getPlan, type PlanSlug } from "../config/plans";
import { prisma } from "../lib/prisma";
import { AppError } from "../utils/errors";

export const ACCOUNT_DELETE_BILLING_UNAVAILABLE_MESSAGE =
  "Unable to cancel billing. Your account was not deleted. Try again later or contact support.";

/** Stripe statuses that can still collect payment. Local default is `inactive`. */
const BILLABLE_STRIPE_STATUSES = new Set([
  "active",
  "trialing",
  "past_due",
  "unpaid",
  "incomplete",
  "paused",
]);

export function isBillableStripeSubscription(sub: {
  stripeSubscriptionId: string | null;
  status: string;
} | null): boolean {
  if (!sub?.stripeSubscriptionId?.trim()) {
    return false;
  }
  return BILLABLE_STRIPE_STATUSES.has(sub.status.trim().toLowerCase());
}

function getStripe(): Stripe {
  if (!env.STRIPE_SECRET_KEY) {
    throw new AppError(503, "Stripe is not configured. Add STRIPE_SECRET_KEY to backend .env");
  }
  return new Stripe(env.STRIPE_SECRET_KEY);
}

/** Test-only Stripe client. Production checkout/cancel/webhook still use getStripe(). */
let stripeClientForTests: Stripe | null = null;

export function setStripeClientForTests(client: Stripe | null): void {
  stripeClientForTests = client;
}

function getStripeForAccountDeletion(): Stripe {
  if (stripeClientForTests) {
    return stripeClientForTests;
  }
  if (!env.STRIPE_SECRET_KEY) {
    throw new AppError(503, ACCOUNT_DELETE_BILLING_UNAVAILABLE_MESSAGE);
  }
  return new Stripe(env.STRIPE_SECRET_KEY);
}

function isStripeResourceMissing(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "resource_missing"
  );
}

async function getOrCreateSubscriptionRecord(userId: string) {
  return prisma.subscription.upsert({
    where: { userId },
    create: { userId, status: "inactive", plan: "starter" },
    update: {},
  });
}

export const billingService = {
  async getSubscription(userId: string) {
    const sub = await prisma.subscription.findUnique({ where: { userId } });
    const plan = getPlan(sub?.plan ?? "starter");

    return {
      plan: sub?.plan ?? null,
      planName: plan?.name ?? null,
      price: plan?.price ?? null,
      status: sub?.status ?? "inactive",
      currentPeriodEnd: sub?.currentPeriodEnd?.toISOString() ?? null,
      cancelAtPeriodEnd: sub?.cancelAtPeriodEnd ?? false,
      stripeConfigured: isStripeConfigured(),
    };
  },

  async getBillingHistory(userId: string) {
    const events = await prisma.billingEvent.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 24,
    });

    return events.map((e) => ({
      id: e.id,
      amount: e.amount,
      currency: e.currency,
      status: e.status,
      description: e.description,
      invoiceUrl: e.invoiceUrl,
      createdAt: e.createdAt.toISOString(),
    }));
  },

  async createCheckoutSession(userId: string, email: string, planSlug: string) {
    if (!isStripeConfigured()) {
      throw new AppError(
        503,
        "Stripe billing is not configured yet. Add Stripe price IDs to backend .env",
      );
    }

    const plan = getPlan(planSlug);
    if (!plan?.priceId) {
      throw new AppError(400, "Invalid plan selected");
    }

    const stripe = getStripe();
    const record = await getOrCreateSubscriptionRecord(userId);

    let customerId = record.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email,
        metadata: { userId },
      });
      customerId = customer.id;
      await prisma.subscription.update({
        where: { userId },
        data: { stripeCustomerId: customerId },
      });
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      line_items: [{ price: plan.priceId, quantity: 1 }],
      success_url: `${env.FRONTEND_URL}/dashboard/billing?checkout=success`,
      cancel_url: `${env.FRONTEND_URL}/dashboard/billing?checkout=canceled`,
      metadata: { userId, plan: plan.slug },
      subscription_data: {
        metadata: { userId, plan: plan.slug },
      },
    });

    return { url: session.url };
  },

  async cancelSubscription(userId: string) {
    const sub = await prisma.subscription.findUnique({ where: { userId } });
    if (!sub?.stripeSubscriptionId) {
      throw new AppError(400, "No active subscription to cancel");
    }

    const stripe = getStripe();
    await stripe.subscriptions.update(sub.stripeSubscriptionId, {
      cancel_at_period_end: true,
    });

    await prisma.subscription.update({
      where: { userId },
      data: { cancelAtPeriodEnd: true },
    });

    return { message: "Subscription will cancel at the end of the billing period" };
  },

  /**
   * Account deletion only: immediately cancel a billable Stripe subscription.
   * Does not change the user-facing cancel-at-period-end billing action.
   * Does not write or delete local billing rows — caller deletes after this succeeds.
   */
  async stopBillableSubscriptionForAccountDeletion(userId: string): Promise<void> {
    const sub = await prisma.subscription.findUnique({
      where: { userId },
      select: {
        stripeSubscriptionId: true,
        status: true,
      },
    });

    const status = sub?.status?.trim().toLowerCase() ?? "";
    const hasSubscriptionId = Boolean(sub?.stripeSubscriptionId?.trim());

    if (BILLABLE_STRIPE_STATUSES.has(status) && !hasSubscriptionId) {
      console.info("[billing] account-deletion cancel", {
        outcome: "blocked",
        reason: "billable_without_subscription_id",
      });
      throw new AppError(503, ACCOUNT_DELETE_BILLING_UNAVAILABLE_MESSAGE);
    }

    if (!isBillableStripeSubscription(sub)) {
      return;
    }

    const subscriptionId = sub!.stripeSubscriptionId!.trim();

    try {
      const stripe = getStripeForAccountDeletion();
      const canceled = await stripe.subscriptions.cancel(subscriptionId);
      if (canceled.status !== "canceled") {
        console.info("[billing] account-deletion cancel", {
          outcome: "blocked",
          reason: "not_canceled",
          stripeStatus: canceled.status,
        });
        throw new AppError(503, ACCOUNT_DELETE_BILLING_UNAVAILABLE_MESSAGE);
      }
      console.info("[billing] account-deletion cancel", { outcome: "canceled" });
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      if (isStripeResourceMissing(error)) {
        console.info("[billing] account-deletion cancel", {
          outcome: "already_absent",
        });
        return;
      }
      console.info("[billing] account-deletion cancel", {
        outcome: "failed",
        reason: "stripe_unavailable",
      });
      throw new AppError(503, ACCOUNT_DELETE_BILLING_UNAVAILABLE_MESSAGE);
    }
  },

  async handleWebhook(rawBody: Buffer, signature: string | undefined) {
    if (!env.STRIPE_WEBHOOK_SECRET) {
      throw new AppError(503, "Stripe webhook secret is not configured");
    }

    const stripe = getStripe();
    const event = stripe.webhooks.constructEvent(
      rawBody,
      signature ?? "",
      env.STRIPE_WEBHOOK_SECRET,
    );

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.userId;
        const plan = session.metadata?.plan as PlanSlug | undefined;
        const subscriptionId =
          typeof session.subscription === "string"
            ? session.subscription
            : session.subscription?.id;

        if (userId && subscriptionId) {
          await prisma.subscription.upsert({
            where: { userId },
            create: {
              userId,
              stripeCustomerId:
                typeof session.customer === "string" ? session.customer : session.customer?.id,
              stripeSubscriptionId: subscriptionId,
              plan: plan ?? "starter",
              status: "active",
            },
            update: {
              stripeSubscriptionId: subscriptionId,
              plan: plan ?? "starter",
              status: "active",
              cancelAtPeriodEnd: false,
            },
          });
        }
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        const userId = subscription.metadata?.userId;
        if (!userId) break;

        const periodEnd = subscription.current_period_end;
        await prisma.subscription.updateMany({
          where: { userId },
          data: {
            status: subscription.status,
            cancelAtPeriodEnd: subscription.cancel_at_period_end,
            currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000) : null,
            ...(subscription.metadata?.plan
              ? { plan: subscription.metadata.plan as PlanSlug }
              : {}),
          },
        });
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const userId = subscription.metadata?.userId;
        if (!userId) break;

        await prisma.subscription.updateMany({
          where: { userId },
          data: {
            status: "canceled",
            cancelAtPeriodEnd: false,
            stripeSubscriptionId: null,
          },
        });
        break;
      }

      case "invoice.paid": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId =
          typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
        if (!customerId) break;

        const sub = await prisma.subscription.findFirst({
          where: { stripeCustomerId: customerId },
        });
        if (!sub) break;

        await prisma.billingEvent.upsert({
          where: { stripeInvoiceId: invoice.id },
          create: {
            userId: sub.userId,
            stripeInvoiceId: invoice.id,
            amount: invoice.amount_paid,
            currency: invoice.currency,
            status: "paid",
            description: invoice.lines.data[0]?.description ?? "Subscription payment",
            invoiceUrl: invoice.hosted_invoice_url ?? null,
          },
          update: {
            status: "paid",
            amount: invoice.amount_paid,
          },
        });
        break;
      }
    }

    return { received: true };
  },
};
