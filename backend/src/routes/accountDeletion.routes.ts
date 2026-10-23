import { Router } from "express";
import bcrypt from "bcryptjs";
import Stripe from "stripe";
import { z } from "zod";
import { authenticate } from "../middleware/auth";
import { prisma } from "../lib/prisma";

const router = Router();
const schema = z.object({
  password: z.string().min(1),
  confirmation: z.literal("DELETE MY ACCOUNT"),
});

// Fail safely if billing cannot be cancelled; never erase records while a subscription
// could still renew. Prisma cascade removes all user-owned rows in one transaction.
router.delete("/", authenticate, async (req, res, next) => {
  try {
    const data = schema.parse(req.body);
    if (!req.user?.id) return void res.status(401).json({ error: "Authentication required" });
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        passwordHash: true,
        subscription: { select: { stripeSubscriptionId: true, stripeCustomerId: true } },
      },
    });
    if (!user || !(await bcrypt.compare(data.password, user.passwordHash))) {
      return void res.status(403).json({ error: "Incorrect password" });
    }
    const subscriptionId = user.subscription?.stripeSubscriptionId;
    if (subscriptionId) {
      if (!process.env.STRIPE_SECRET_KEY) {
        return void res.status(503).json({ error: "Billing unavailable; account was not deleted" });
      }
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
      // Stripe deletion is idempotent for inactive subscriptions; verify status first.
      const sub = await stripe.subscriptions.retrieve(subscriptionId);
      if (!["canceled", "incomplete_expired"].includes(sub.status)) {
        await stripe.subscriptions.cancel(subscriptionId, { prorate: false });
      }
    }
    const customerId = user.subscription?.stripeCustomerId;
    if (customerId && process.env.STRIPE_SECRET_KEY) {
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
      try {
        await stripe.customers.del(customerId);
      } catch {
        return void res.status(503).json({ error: "Billing profile could not be removed; account was not deleted" });
      }
    }
    await prisma.$transaction(async (tx) => {
      // Explicitly wipe all Comment2DM user-owned operational data before the user row.
      await tx.dmEvent.deleteMany({ where: { userId: user.id } });
      await tx.keywordRule.deleteMany({ where: { userId: user.id } });
      await tx.lead.deleteMany({ where: { userId: user.id } });
      await tx.instagramConnectionRequest.deleteMany({ where: { userId: user.id } });
      await tx.instagramAccount.deleteMany({ where: { userId: user.id } });
      await tx.activityEvent.deleteMany({ where: { userId: user.id } });
      await tx.planUsage.deleteMany({ where: { userId: user.id } });
      await tx.passwordResetToken.deleteMany({ where: { userId: user.id } });
      await tx.billingEvent.deleteMany({ where: { userId: user.id } });
      await tx.subscription.deleteMany({ where: { userId: user.id } });
      await tx.liteOfferClaim.deleteMany({ where: { userId: user.id } });
      await tx.launchOfferClaim.deleteMany({ where: { userId: user.id } });
      await tx.user.delete({ where: { id: user.id } });
    });
    res.setHeader("Cache-Control", "no-store");
    res.json({ deleted: true });
  } catch (error) { next(error); }
});

export default router;
