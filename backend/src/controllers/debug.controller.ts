import type { NextFunction, Request, Response } from "express";
import { z } from "zod";
import { isDebugDbShapeEnabled } from "../config/env";
import { getEnvDiagnostics } from "../utils/dbDiagnostics";
import { dbShapeService } from "../services/dbShape.service";

const authCheckSchema = z.object({
  email: z.string().email(),
});

export class DebugController {
  async getDbShape(_req: Request, res: Response, next: NextFunction): Promise<void> {
    if (!isDebugDbShapeEnabled()) {
      res.status(404).json({ error: "Not found" });
      return;
    }

    try {
      const shape = await dbShapeService.getDatabaseShape();
      res.json({
        ...shape,
        environment: getEnvDiagnostics(),
      });
    } catch (error) {
      next(error);
    }
  }

  async postAuthCheck(req: Request, res: Response, next: NextFunction): Promise<void> {
    if (!isDebugDbShapeEnabled()) {
      res.status(404).json({ error: "Not found" });
      return;
    }

    try {
      const body = authCheckSchema.parse(req.body);
      const result = await dbShapeService.getAuthCheck(body.email);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
}

export const debugController = new DebugController();
