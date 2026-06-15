import type { Request, Response, NextFunction } from "express";
import { AppError } from "../utils/errors";
import { instagramIntegrationService } from "../services/instagramIntegration.service";
import { activityService } from "../services/activity.service";

export class InstagramIntegrationController {
  async status(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new AppError(401, "Authentication required");
      const status = await instagramIntegrationService.getStatus(req.user.id);
      res.json(status);
    } catch (error) {
      next(error);
    }
  }

  async connectMock(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new AppError(401, "Authentication required");
      const result = await instagramIntegrationService.connectMock(req.user.id);
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  }

  async disconnect(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new AppError(401, "Authentication required");
      const result = await instagramIntegrationService.disconnect(req.user.id);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
}

export class ActivityController {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new AppError(401, "Authentication required");
      const events = await activityService.listForUser(req.user.id);
      res.json(
        events.map((event) => ({
          id: event.id,
          type: event.type,
          title: event.title,
          description: event.description ?? "",
          timestamp: event.createdAt.toISOString(),
        })),
      );
    } catch (error) {
      next(error);
    }
  }
}

export const instagramIntegrationController = new InstagramIntegrationController();
export const activityController = new ActivityController();
