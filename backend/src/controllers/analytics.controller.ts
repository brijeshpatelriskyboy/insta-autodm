import type { Request, Response, NextFunction } from "express";
import { analyticsService } from "../services/analytics.service";
import { AppError } from "../utils/errors";

export class AnalyticsController {
  async summary(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new AppError(401, "Authentication required");

      const summary = await analyticsService.getSummary(req.user.id);
      res.json(summary);
    } catch (error) {
      next(error);
    }
  }
}

export const analyticsController = new AnalyticsController();
