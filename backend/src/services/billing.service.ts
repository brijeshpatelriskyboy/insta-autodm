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
  allowPromotionCodes?: boolean;
  launchOfferInstagramUserId?: string;
  expiresAt?: Date;
}): Stripe.Checkout.SessionCreateParams {
  const {
    customerId,
    userId,
    plan,
    frontendUrl,
    allowPromotionCodes = false,
    launchOfferInstagramUserId,
    expiresAt,
  } = params;
  if (!plan.priceId) {
    throw new AppError(503, "Stripe price is not configured");
  }

  return {
    customer: customerId,
    mode: "subscription",
    line_items: [{ price: plan.priceId, quantity: 1 }],
    allow_promotion_codes: allowPromotionCodes,
    client_reference_id: userId,
    success_url: `${frontendUrl}/dashboard/billing?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${frontendUrl}/dashboard/billing?checkout=canceled`,
    metadata: {
      userId,
      plan: plan.slug,
      ...(launchOfferInstagramUserId
        ? { launchOfferInstagramUserId }
        : {}),
    },
    subscription_data: {
      metadata: {
        userId,
        plan: plan.slug,
        ...(launchOfferInstagramUserId
          ? { launchOfferInstagramUserId }
          : {}),
      },
    },
    ...(expiresAt ? { expires_at: Math.floor(expiresAt.getTime() / 1000) } : {}),
  };
}

export function buildPlanChangeParams(params: {
  itemId: string;
  userId: string;
  plan: NonNullable<ReturnType<typeof getPlan>>;
}): Stripe.SubscriptionUpdateParams {
  const { itemId, userId, plan } = params;
  if (!plan.priceId) {
    throw new AppError(503, "Stripe price is not configured for this plan");
  }

  return {
    items: [{ id: itemId, price: plan.priceId, quantity: 1 }],
    metadata: { userId, plan: plan.slug },
    cancel_at_period_end: false,
    proration_behavior: "always_invoice",
    payment_behavior: "error_if_incomplete",
  };
}

export function buildResumeSubscriptionParams(): Stripe.SubscriptionUpdateParams {
  return { cancel_at_period_end: false };
}

export function buildCancelSubscriptionParams(): Stripe.SubscriptionUpdateParams {
  return {
    cancel_at_period_end: true,
    // A launch discount rewards one continuous initial subscription. Once a
    // customer schedules cancellation, it must not return if they later resume.
    discounts: [],
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

function stripeId(value: string | { id: string } | null | undefined) {
  return typeof value === "string" ? value : value?.id;
}

const LAUNCH_OFFER_RESERVATION_MS = 30 * 60 * 1000;

type LaunchOfferCheckout = {
  eligible: boolean;
  instagramUserId?: string;
  reservedUntil?: Date;
  existingUrl?: string;
};

async function prepareLaunchOfferCheckout(
  userId: string,
  stripe: Stripe,
): Promise<LaunchOfferCheckout> {
  const account = await prisma.instagramAccount.findUnique({
    where: { userId },
    select: {
      instagramUserId: true,
      connectionStatus: true,
    },
  });

  if (!account || account.connectionStatus !== "connected") {
    return { eligible: false };
  }

  const instagramUserId = account.instagramUserId;
  const now = new Date();
  const existing = await prisma.launchOfferClaim.findUnique({
    where: { instagramUserId },
  });

  if (existing?.status === "redeemed") {
    return { eligible: false, instagramUserId };
  }

  if (
    existing?.status === "reserved" &&
    existing.reservedUntil &&
    existing.reservedUntil > now
  ) {
    if (existing.userId === userId && existing.checkoutSessionId) {
      try {
        const checkout = await stripe.checkout.sessions.retrieve(existing.checkoutSessionId);
        if (checkout.status === "open" && checkout.url) {
          return {
            eligible: true,
            instagramUserId,
            reservedUntil: existing.reservedUntil,
            existingUrl: checkout.url,
          };
        }

        if (
          checkout.status === "complete" &&
          (checkout.total_details?.amount_discount ?? 0) > 0
        ) {
          await prisma.launchOfferClaim.update({
            where: { instagramUserId },
            data: {
              status: "redeemed",
              redeemedAt: existing.redeemedAt ?? now,
              stripeSubscriptionId: stripeId(checkout.subscription),
              reservedUntil: null,
            },
          });
          return { eligible: false, instagramUserId };
        }
      } catch {
        // Treat an inaccessible/expired Stripe session like an expired reservation.
      }
    } else {
      return { eligible: false, instagramUserId };
    }
  }

  const reservedUntil = new Date(now.getTime() + LAUNCH_OFFER_RESERVATION_MS);

  if (!existing) {
    try {
      await prisma.launchOfferClaim.create({
        data: {
          instagramUserId,
          userId,
          status: "reserved",
          reservedUntil,
        },
      });
      return { eligible: true, instagramUserId, reservedUntil };
    } catch {
      // A concurrent checkout may have claimed this Instagram id first.
      return { eligible: false, instagramUserId };
    }
  }

  const refreshed = await prisma.launchOfferClaim.updateMany({
    where: {
      instagramUserId,
      status: "reserved",
      OR: [
        { reservedUntil: null },
        { reservedUntil: { lte: now } },
        { userId },
      ],
    },
    data: {
      userId,
      status: "reserved",
      checkoutSessionId: null,
      stripeSubscriptionId: null,
      reservedUntil,
      redeemedAt: null,
    },
  });

  return refreshed.count === 1
    ? { eligible: true, instagramUserId, reservedUntil }
    : { eligible: false, instagramUserId };
}

async function releaseLaunchOfferReservation(params: {
  instagramUserId?: string;
  userId: string;
  checkoutSessionId?: string;
}) {
  if (!params.instagramUserId) return;
  await prisma.launchOfferClaim.deleteMany({
    where: {
      instagramUserId: params.instagramUserId,
      userId: params.userId,
      status: "reserved",
      ...(params.checkoutSessionId
        ? { checkoutSessionId: params.checkoutSessionId }
        : { checkoutSessionId: null }),
    },
  });
}

export function subscriptionPeriodEnd(subscription: {
  current_period_end?: number | null;
  items?: { data: Array<{ id?: string; current_period_end?: number | null }> };
}) {
  // Acacia API responses use the subscription field; Basil and newer webhook
  // snapshots (including Dahlia) put billing periods on subscription items.
  const periods = [subscription.current_period_end,
    ...(subscription.items?.data ?? []).map((item) => item.current_period_end),
  ].filter((value): value is number =>
    typeof value === "number" && Number.isFinite(value) && value > 0,
  );
  // Plans currently have one item. If more are added, show the next renewal.
  return periods.length ? new Date(Math.min(...periods) * 1000) : null;
}

export function invoiceDescription(
  lines: Array<{ description?: string | null }>,
): string {
  const descriptions = lines
    .map((line) => line.description?.trim())
    .filter((description): description is string => Boolean(description));
  const unused = descriptions.find((description) =>
    description.toLowerCase().startsWith("unused time on "),
  );
  const remaining = descriptions.find((description) =>
    description.toLowerCase().startsWith("remaining time on "),
  );

  if (unused && remaining) {
    const fromPlan = unused
      .replace(/^Unused time on /i, "")
      .replace(/ after .*/i, "")
      .replace(/\s+\(.*\)$/, "");
    const toPlan = remaining
      .replace(/^Remaining time on /i, "")
      .replace(/ after .*/i, "")
      .replace(/\s+\(.*\)$/, "");

    if (fromPlan && toPlan) {
      return `Plan change: ${fromPlan} → ${toPlan}`;
    }
  }

  return descriptions[0] ?? "Subscription payment";
}

export function invoiceHistoryAmount(invoice: {
  status: string | null;
  total: number;
  amountPaid: number;
  amountDue: number;
}): number {
  if (invoice.total < 0) return invoice.total;
  return invoice.status === "paid" ? invoice.amountPaid : invoice.amountDue;
}

async function storeInvoice(userId: string, invoice: Stripe.Invoice) {
  const description = invoiceDescription(invoice.lines.data);
  const amount = invoiceHistoryAmount({
    status: invoice.status,
    total: invoice.total,
    amountPaid: invoice.amount_paid,
    amountDue: invoice.amount_due,
  });
  await prisma.billingEvent.upsert({
    where: { stripeInvoiceId: invoice.id },
    create: {
      userId,
      stripeInvoiceId: invoice.id,
      amount,
      currency: invoice.currency,
      status: invoice.status === "paid" ? "paid" : invoice.status ?? "open",
      description,
      invoiceUrl: invoice.hosted_invoice_url ?? null,
    },
    update: {
      amount,
      status: invoice.status === "paid" ? "paid" : invoice.status ?? "open",
      description,
      invoiceUrl: invoice.hosted_invoice_url ?? null,
    },
  });
}

/**
 * Webhooks remain the primary source of billing updates, but dashboard reads also
 * reconcile with Stripe. This repairs a missed or out-of-order webhook without
 * making the customer repeat Checkout.
 */
async function reconcileStripeBilling(userId: string) {
  if (!isStripeConfigured()) return;

  const local = await prisma.subscription.findUnique({ where: { userId } });
  if (!local?.stripeSubscriptionId || !local.stripeCustomerId) return;

  const stripe = getStripe();
  const [subscription, invoices] = await Promise.all([
    stripe.subscriptions.retrieve(local.stripeSubscriptionId),
    stripe.invoices.list({ customer: local.stripeCustomerId, limit: 24 }),
  ]);

  await prisma.subscription.update({
    where: { userId },
    data: {
      status: subscription.status,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      currentPeriodEnd: subscriptionPeriodEnd(subscription),
      ...(subscription.metadata?.plan
        ? { plan: subscription.metadata.plan as PlanSlug }
        : {}),
    },
  });

  await Promise.all(invoices.data.map((invoice) => storeInvoice(userId, invoice)));
}

async function reconcileStripeBillingForDashboard(userId: string) {
  try {
    await reconcileStripeBilling(userId);
  } catch (error) {
    // Keep the dashboard available during a temporary Stripe outage. Webhooks or
    // a later dashboard read will retry the reconciliation.
    console.error("[billing] Stripe reconciliation failed", {
      userId,
      error: error instanceof Error ? error.message : "Unknown Stripe error",
    });
  }
}

export const billingService = {
  async getSubscription(userId: string) {
    await reconcileStripeBillingForDashboard(userId);
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
    await reconcileStripeBillingForDashboard(userId);
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
    const billingUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, profileCompletedAt: true },
    });
    if (!billingUser?.profileCompletedAt) {
      throw new AppError(400, "Complete your email and password before starting checkout");
    }
    email = billingUser.email;
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

    const launchOffer = await prepareLaunchOfferCheckout(userId, stripe);
    if (launchOffer.existingUrl) {
      return {
        url: launchOffer.existingUrl,
        launchOfferEligible: true,
      };
    }

    let session: Stripe.Checkout.Session;
    try {
      session = await stripe.checkout.sessions.create(
        buildCheckoutSessionParams({
          customerId,
          userId,
          plan,
          frontendUrl: env.FRONTEND_URL.replace(/\/$/, ""),
          allowPromotionCodes: launchOffer.eligible,
          launchOfferInstagramUserId: launchOffer.eligible
            ? launchOffer.instagramUserId
            : undefined,
          expiresAt: launchOffer.eligible ? launchOffer.reservedUntil : undefined,
        }),
      );
    } catch (error) {
      await releaseLaunchOfferReservation({
        instagramUserId: launchOffer.eligible
          ? launchOffer.instagramUserId
          : undefined,
        userId,
      });
      throw error;
    }

    if (launchOffer.eligible && launchOffer.instagramUserId) {
      await prisma.launchOfferClaim.updateMany({
        where: {
          instagramUserId: launchOffer.instagramUserId,
          userId,
          status: "reserved",
        },
        data: {
          checkoutSessionId: session.id,
        },
      });
    }

    return {
      url: session.url,
      launchOfferEligible: launchOffer.eligible,
      ...(launchOffer.eligible
        ? {}
        : {
            launchOfferMessage:
              "This Instagram account has already used the 50% launch offer, or is not eligible. You can continue at the standard price.",
          }),
    };
  },

  async cancelSubscription(userId: string) {
    const sub = await prisma.subscription.findUnique({ where: { userId } });
    if (!sub?.stripeSubscriptionId) {
      throw new AppError(400, "No active subscription to cancel");
    }

    const stripe = getStripe();
    await stripe.subscriptions.update(
      sub.stripeSubscriptionId,
      buildCancelSubscriptionParams(),
    );

    await prisma.subscription.update({
      where: { userId },
      data: { cancelAtPeriodEnd: true },
    });

    return { message: "Subscription will cancel at the end of the billing period" };
  },

  async resumeSubscription(userId: string) {
    const record = await prisma.subscription.findUnique({ where: { userId } });
    if (!record?.stripeSubscriptionId) {
      throw new AppError(400, "No subscription to resume");
    }

    const stripe = getStripe();
    const current = await stripe.subscriptions.retrieve(record.stripeSubscriptionId);
    if (current.status !== "active" && current.status !== "trialing") {
      throw new AppError(400, "Only an active subscription can be resumed");
    }
    if (!current.cancel_at_period_end) {
      throw new AppError(409, "This subscription is already set to renew");
    }

    const updated = await stripe.subscriptions.update(
      record.stripeSubscriptionId,
      buildResumeSubscriptionParams(),
    );

    await prisma.subscription.update({
      where: { userId },
      data: {
        status: updated.status,
        cancelAtPeriodEnd: updated.cancel_at_period_end,
        currentPeriodEnd: subscriptionPeriodEnd(updated),
      },
    });

    return { message: "Subscription resumed successfully" };
  },

  async changePlan(userId: string, planSlug: string) {
    if (!isStripeConfigured()) {
      throw new AppError(503, "Stripe billing is not configured");
    }

    const plan = getPlan(planSlug);
    if (!plan?.priceId) {
      throw new AppError(400, "Invalid plan selected");
    }

    const record = await prisma.subscription.findUnique({ where: { userId } });
    if (
      !record?.stripeSubscriptionId ||
      (record.status !== "active" && record.status !== "trialing")
    ) {
      throw new AppError(400, "No active subscription to change");
    }
    if (record.plan === plan.slug) {
      throw new AppError(409, `You are already on the ${plan.name} plan`);
    }

    const stripe = getStripe();
    const current = await stripe.subscriptions.retrieve(record.stripeSubscriptionId);
    const item = current.items.data[0];
    if (!item) {
      throw new AppError(409, "The Stripe subscription has no plan to replace");
    }

    const updated = await stripe.subscriptions.update(
      record.stripeSubscriptionId,
      buildPlanChangeParams({ itemId: item.id, userId, plan }),
    );

    await prisma.subscription.update({
      where: { userId },
      data: {
        plan: plan.slug,
        status: updated.status,
        cancelAtPeriodEnd: updated.cancel_at_period_end,
        currentPeriodEnd: subscriptionPeriodEnd(updated),
      },
    });

    return {
      message: `Plan changed to ${plan.name} successfully`,
      plan: plan.slug,
      status: updated.status,
    };
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
          const stripeSubscription = await stripe.subscriptions.retrieve(subscriptionId);
          const launchOfferInstagramUserId =
            session.metadata?.launchOfferInstagramUserId;
          if (launchOfferInstagramUserId) {
            if ((session.total_details?.amount_discount ?? 0) > 0) {
              await prisma.launchOfferClaim.upsert({
                where: { instagramUserId: launchOfferInstagramUserId },
                create: {
                  instagramUserId: launchOfferInstagramUserId,
                  userId,
                  status: "redeemed",
                  checkoutSessionId: session.id,
                  stripeSubscriptionId: subscriptionId,
                  redeemedAt: new Date(),
                  reservedUntil: null,
                },
                update: {
                  userId,
                  status: "redeemed",
                  checkoutSessionId: session.id,
                  stripeSubscriptionId: subscriptionId,
                  redeemedAt: new Date(),
                  reservedUntil: null,
                },
              });
            } else {
              await releaseLaunchOfferReservation({
                instagramUserId: launchOfferInstagramUserId,
                userId,
                checkoutSessionId: session.id,
              });
            }
          }
          await prisma.subscription.upsert({
            where: { userId },
            create: {
              userId,
              stripeCustomerId:
                typeof session.customer === "string" ? session.customer : session.customer?.id,
              stripeSubscriptionId: subscriptionId,
              plan: plan ?? "starter",
              status: stripeSubscription.status,
              currentPeriodEnd: subscriptionPeriodEnd(stripeSubscription),
              cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
            },
            update: {
              stripeCustomerId: stripeId(session.customer),
              stripeSubscriptionId: subscriptionId,
              plan: plan ?? "starter",
              status: stripeSubscription.status,
              currentPeriodEnd: subscriptionPeriodEnd(stripeSubscription),
              cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
            },
          });
        }
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        const userId = subscription.metadata?.userId;
        if (!userId) break;

        await prisma.subscription.updateMany({
          where: { userId },
          data: {
            status: subscription.status,
            cancelAtPeriodEnd: subscription.cancel_at_period_end,
            currentPeriodEnd: subscriptionPeriodEnd(subscription),
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

      case "invoice.paid":
      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = stripeId(invoice.customer);
        if (!customerId) break;

        const sub = await prisma.subscription.findFirst({
          where: { stripeCustomerId: customerId },
        });
        if (!sub) break;

        await storeInvoice(sub.userId, invoice);
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
