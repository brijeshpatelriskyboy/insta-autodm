import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { keywordRuleService } from "../services/keywordRule.service";
import { AppError } from "../utils/errors";
import { getRouteParam } from "../utils/params";

const createSchema = z.object({
  keyword: z.string().min(1).max(50),
  dmMessage: z.string().min(1).max(1000),
  isActive: z.boolean().optional(),
});

const updateSchema = z.object({
  keyword: z.string().min(1).max(50).optional(),
  dmMessage: z.string().min(1).max(1000).optional(),
  isActive: z.boolean().optional(),
});

export class KeywordRuleController {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new AppError(401, "Authentication required");

      const rules = await keywordRuleService.listByUser(req.user.id);
      res.json(rules);
    } catch (error) {
      next(error);
    }
  }

  async getOne(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new AppError(401, "Authentication required");

      const ruleId = getRouteParam(req, "id");
      const rule = await keywordRuleService.getById(req.user.id, ruleId);
      res.json(rule);
    } catch (error) {
      next(error);
    }
  }

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new AppError(401, "Authentication required");

      const body = createSchema.parse(req.body);
      const rule = await keywordRuleService.create(req.user.id, body);
      res.status(201).json(rule);
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new AppError(401, "Authentication required");

      const ruleId = getRouteParam(req, "id");
      const body = updateSchema.parse(req.body);

      console.log(`[KeywordRules] PUT /api/keyword-rules/${ruleId}`, {
        userId: req.user.id,
        body,
      });

      const rule = await keywordRuleService.update(req.user.id, ruleId, body);
      res.json(rule);
    } catch (error) {
      console.error(`[KeywordRules] Update failed:`, error);
      next(error);
    }
  }

  async remove(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new AppError(401, "Authentication required");

      const ruleId = getRouteParam(req, "id");

      console.log(`[KeywordRules] DELETE /api/keyword-rules/${ruleId}`, {
        userId: req.user.id,
      });

      await keywordRuleService.delete(req.user.id, ruleId);
      res.status(204).send();
    } catch (error) {
      console.error(`[KeywordRules] Delete failed:`, error);
      next(error);
    }
  }
}

export const keywordRuleController = new KeywordRuleController();
