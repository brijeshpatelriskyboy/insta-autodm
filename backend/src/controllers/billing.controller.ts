import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { billingService } from "../services/billing.service";
import { AppError } from "../utils/errors";

const checkoutSchema = z.object({
  plan: z.enum(["starter", "creator", "pro"]),
});

export class BillingController {
  async getSubscription(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new AppError(401, "Authentication required");
      const sub = await billingService.getSubscription(req.user.id);
      res.json(sub);
    } catch (error) {
      next(error);
    }
  }

  async getHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new AppError(401, "Authentication required");
      const history = await billingService.getBillingHistory(req.user.id);
      res.json(history);
    } catch (error) {
      next(error);
    }
  }

  async checkout(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new AppError(401, "Authentication required");
      const body = checkoutSchema.parse(req.body);
      const session = await billingService.createCheckoutSession(
        req.user.id,
        req.user.email,
        body.plan,
      );
      res.json(session);
    } catch (error) {
      next(error);
    }
  }

  async cancel(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new AppError(401, "Authentication required");
      const result = await billingService.cancelSubscription(req.user.id);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  async webhook(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const signature = req.headers["stripe-signature"];
      const result = await billingService.handleWebhook(
        req.body as Buffer,
        typeof signature === "string" ? signature : undefined,
      );
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
}

export const billingController = new BillingController();
