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

/**
 * Read a query param exactly once as a plain string.
 * Does not trim, decode further, or otherwise modify the value.
 */
function readQueryParamOnce(value: unknown): string | undefined {
  if (typeof value === "string") {
    return value;
  }
  if (Array.isArray(value) && typeof value[0] === "string") {
    return value[0];
  }
  return undefined;
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
      // Return a structured OAuth error instead of a generic 500 so the UI can
      // explain exactly what is missing.
      console.error("[integrations] oauth-url failed:", {
        name: error instanceof Error ? error.name : "UnknownError",
        message: error instanceof Error ? error.message : String(error),
      });
      res.status(500).json({
        url: null,
        previewUrl: null,
        oauthEnabled: null,
        configured: null,
        setupError: {
          missing: [],
          message:
            error instanceof Error
              ? `Failed to build Meta OAuth URL: ${error.message}`
              : "Failed to build Meta OAuth URL",
        },
        message: "Failed to build Meta OAuth URL",
      });
    }
  }

  async callback(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Read OAuth params once from the query string. Do not decode/trim/mutate the code.
      const code = readQueryParamOnce(req.query.code);
      const state = readQueryParamOnce(req.query.state);
      const error = readQueryParamOnce(req.query.error);
      const error_description = readQueryParamOnce(req.query.error_description);

      const query = { code, state, error, error_description };

      console.log("[instagram-oauth] callback query received:", {
        hasCode: Boolean(code),
        codeLength: code?.length ?? 0,
        hasState: Boolean(state),
        hasError: Boolean(error),
      });

      if (req.headers.accept?.includes("application/json")) {
        const result = await metaOAuthService.handleCallback(query);
        res.json(result);
        return;
      }

      const redirectUrl = await metaOAuthService.handleCallbackRedirect(query);
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

  async subscribeWebhooks(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new AppError(401, "Authentication required");
      const result = await instagramIntegrationService.subscribeWebhooks(req.user.id);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  async syncFacebookPageId(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new AppError(401, "Authentication required");
      const result = await instagramIntegrationService.syncFacebookPageId(req.user.id);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  async listMedia(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new AppError(401, "Authentication required");
      const rawLimit = readQueryParamOnce(req.query.limit);
      const limit = rawLimit ? Number.parseInt(rawLimit, 10) : 25;
      const result = await instagramIntegrationService.listMedia(
        req.user.id,
        Number.isFinite(limit) ? limit : 25,
      );
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
        events.map((event) => {
          const metadata =
            event.metadata && typeof event.metadata === "object" && !Array.isArray(event.metadata)
              ? (event.metadata as Record<string, unknown>)
              : null;

          return {
            id: event.id,
            type: event.type,
            title: event.title,
            description: event.description ?? "",
            timestamp: event.createdAt.toISOString(),
            keyword: typeof metadata?.keyword === "string" ? metadata.keyword : undefined,
          };
        }),
      );
    } catch (error) {
      next(error);
    }
  }
}

export const instagramIntegrationController = new InstagramIntegrationController();
export const activityController = new ActivityController();
