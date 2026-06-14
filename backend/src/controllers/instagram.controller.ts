import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { instagramService } from "../services/instagram.service";
import { AppError } from "../utils/errors";

const connectSchema = z.object({
  instagramUsername: z.string().min(1).max(30),
});

export class InstagramController {
  async status(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new AppError(401, "Authentication required");
      const status = await instagramService.getStatus(req.user.id);
      res.json(status);
    } catch (error) {
      next(error);
    }
  }

  async connect(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new AppError(401, "Authentication required");
      const body = connectSchema.parse(req.body);
      const result = await instagramService.joinWaitlist(
        req.user.id,
        body.instagramUsername,
      );
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  }
}

export const instagramController = new InstagramController();
