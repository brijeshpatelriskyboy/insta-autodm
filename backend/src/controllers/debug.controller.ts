import type { NextFunction, Request, Response } from "express";
import { isDebugDbShapeEnabled } from "../config/env";
import { dbShapeService } from "../services/dbShape.service";

export class DebugController {
  async getDbShape(_req: Request, res: Response, next: NextFunction): Promise<void> {
    if (!isDebugDbShapeEnabled()) {
      res.status(404).json({ error: "Not found" });
      return;
    }

    try {
      const shape = await dbShapeService.getDatabaseShape();
      res.json(shape);
    } catch (error) {
      next(error);
    }
  }
}

export const debugController = new DebugController();
