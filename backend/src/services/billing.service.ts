import Stripe from "stripe";
import { env, isStripeConfigured } from "../config/env";
import { getPlan, type PlanSlug } from "../config/plans";
import { prisma } from "../lib/prisma";
import { AppError } from "../utils/errors";

export function buildCheckoutSessionParams(params: {
  customerId: string;
  userId: string;
  plan: NonNullable<ReturnType<typeof getPlan>>;
  frontendUrl: string;
}): Stripe.Checkout.SessionCreateParams {
  const { customerId, userId, plan, frontendUrl } = params;
  if (!plan.priceId || (plan.slug === "starter" && !plan.couponId)) {
    throw new AppError(503, "Stripe price or Starter coupon is not configured");
  }

  return {
    customer: customerId,
    mode: "subscription",
    line_items: [{ price: plan.priceId, quantity: 1 }],
    ...(plan.couponId ? { discounts: [{ coupon: plan.couponId }] } : {}),
    client_reference_id: userId,
    success_url: `${frontendUrl}/dashboard/billing?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${frontendUrl}/dashboard/billing?checkout=canceled`,
    metadata: { userId, plan: plan.slug },
    subscription_data: {
      metadata: { userId, plan: plan.slug },
    },
  };
}

function getStripe(): Stripe {
  if (!env.STRIPE_SECRET_KEY) {
    throw new AppError(503, "Stripe is not configured. Add STRIPE_SECRET_KEY to backend .env");
  }
  return new Stripe(env.STRIPE_SECRET_KEY);
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
      standardPrice: plan?.standardPrice ?? null,
      introductoryMonths: plan?.introductoryMonths ?? null,
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
    if (!plan?.priceId || (plan.slug === "starter" && !plan.couponId)) {
      throw new AppError(400, "Invalid plan selected");
    }

    const stripe = getStripe();
    const record = await getOrCreateSubscriptionRecord(userId);

    if (
      record.stripeSubscriptionId &&
      (record.status === "active" || record.status === "trialing")
    ) {
      throw new AppError(409, "You already have an active subscription");
    }

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

    const session = await stripe.checkout.sessions.create(
      buildCheckoutSessionParams({
        customerId,
        userId,
        plan,
        frontendUrl: env.FRONTEND_URL.replace(/\/$/, ""),
      }),
    );

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

  async handleWebhook(rawBody: Buffer, signature: string | undefined) {
    if (!env.STRIPE_WEBHOOK_SECRET) {
      throw new AppError(503, "Stripe webhook secret is not configured");
    }

    if (!signature) {
      throw new AppError(400, "Missing Stripe webhook signature");
    }

    const stripe = getStripe();
    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(rawBody, signature, env.STRIPE_WEBHOOK_SECRET);
    } catch {
      throw new AppError(400, "Invalid Stripe webhook signature");
    }

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

      case "invoice.payment_failed": {
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
            amount: invoice.amount_due,
            currency: invoice.currency,
            status: "failed",
            description: invoice.lines.data[0]?.description ?? "Subscription payment failed",
            invoiceUrl: invoice.hosted_invoice_url ?? null,
          },
          update: {
            status: "failed",
            amount: invoice.amount_due,
          },
        });
        break;
      }
    }

    return { received: true };
  },
};
