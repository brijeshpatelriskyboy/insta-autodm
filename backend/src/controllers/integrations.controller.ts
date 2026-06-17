import type { Request, Response, NextFunction } from "express";
import { AppError } from "../utils/errors";
import { instagramIntegrationService } from "../services/instagramIntegration.service";
import { activityService } from "../services/activity.service";
import { metaOAuthService } from "../services/metaOAuth.service";

function getApiBaseUrl(req: Request): string {
  if (process.env.API_PUBLIC_URL) {
    return process.env.API_PUBLIC_URL.replace(/\/$/, "");
  }
  const protocol = req.headers["x-forwarded-proto"] ?? req.protocol;
  const host = req.headers["x-forwarded-host"] ?? req.get("host");
  return `${protocol}://${host}`;
}

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

  async metaConfig(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const config = metaOAuthService.getPublicConfig(getApiBaseUrl(req));
      res.json(config);
    } catch (error) {
      next(error);
    }
  }

  async oauthUrl(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new AppError(401, "Authentication required");
      const result = metaOAuthService.getOAuthUrl(req.user.id);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  async callback(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = {
        code: req.query.code as string | undefined,
        state: req.query.state as string | undefined,
        error: req.query.error as string | undefined,
        error_description: req.query.error_description as string | undefined,
      };

      if (req.headers.accept?.includes("application/json")) {
        const result = metaOAuthService.handleCallbackPlaceholder(query);
        res.json(result);
        return;
      }

      const redirectUrl = metaOAuthService.buildCallbackRedirect(query);
      res.redirect(redirectUrl);
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
