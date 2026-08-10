import type { NextFunction, Request, Response } from "express";
import { isSmartCampaignsEnabled } from "../config/smartCampaigns";
import { AppError } from "../utils/errors";

/**
 * Guard for future campaign HTTP routes.
 * When Smart Campaigns are disabled: 404 and handler/DB must not run.
 */
export function requireSmartCampaignsEnabled(
  _req: Request,
  _res: Response,
  next: NextFunction,
): void {
  if (!isSmartCampaignsEnabled()) {
    next(new AppError(404, "Not found"));
    return;
  }
  next();
}
