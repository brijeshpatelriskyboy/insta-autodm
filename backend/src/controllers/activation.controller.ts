import type { NextFunction, Request, Response } from "express";
import {
  activationService,
  getDefaultQuickStartProgress,
} from "../services/activation.service";
import { AppError } from "../utils/errors";

export class ActivationController {
  async getQuickStart(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new AppError(401, "Authentication required");

      const data = await activationService.getQuickStart(req.user.id);
      res.json(data);
    } catch (error) {
      if (error instanceof AppError) {
        next(error);
        return;
      }

      console.error("[activation] GET /quick-start failed:", error);
      res.json(getDefaultQuickStartProgress(true));
    }
  }

  async celebrateQuickStart(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new AppError(401, "Authentication required");

      const data = await activationService.markCelebrated(req.user.id);
      res.json(data);
    } catch (error) {
      if (error instanceof AppError) {
        next(error);
        return;
      }

      console.error("[activation] POST /quick-start/celebrate failed:", error);
      res.json({
        celebrated: false,
        showCelebration: false,
      });
    }
  }
}

export const activationController = new ActivationController();
