import type { Request, Response, NextFunction } from "express";
import { metaDataDeletionService } from "../services/metaDataDeletion.service";

function readSignedRequest(req: Request): string | undefined {
  const body = req.body as { signed_request?: unknown } | undefined;
  if (typeof body?.signed_request === "string") {
    return body.signed_request;
  }
  const query = req.query.signed_request;
  if (typeof query === "string") {
    return query;
  }
  return undefined;
}

export class MetaDataDeletionController {
  async dataDeletion(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await metaDataDeletionService.handleDataDeletion(readSignedRequest(req));
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  async deauthorize(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await metaDataDeletionService.handleDeauthorize(readSignedRequest(req));
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  async status(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const code = typeof req.query.code === "string" ? req.query.code : undefined;
      const result = await metaDataDeletionService.getStatus(code);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
}

export const metaDataDeletionController = new MetaDataDeletionController();
