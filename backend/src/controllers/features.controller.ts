import type { NextFunction, Request, Response } from "express";
import { getFeatureFlags } from "../config/smartCampaigns";
import { AppError } from "../utils/errors";

export class FeaturesController {
  async getFeatures(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        next(new AppError(401, "Authentication required"));
        return;
      }

      // Authoritative backend flag only — no DB, no campaign imports, no secrets.
      res.status(200).json(getFeatureFlags());
    } catch (error) {
      next(error);
    }
  }
}

export const featuresController = new FeaturesController();
