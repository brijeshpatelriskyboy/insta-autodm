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
      select: { id: true, passwordHash: true, subscription: { select: { stripeSubscriptionId: true } } },
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
    await prisma.user.delete({ where: { id: user.id } });
    res.setHeader("Cache-Control", "no-store");
    res.json({ deleted: true });
  } catch (error) { next(error); }
});

export default router;
