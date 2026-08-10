import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { campaignService } from "../services/campaign.service";
import { AppError } from "../utils/errors";
import { getRouteParam } from "../utils/params";

const isoDate = z.coerce.date();

const createSchema = z.object({
  keywordRuleId: z.string().min(1),
  name: z.string().min(1).max(120),
  startsAt: isoDate,
  endsAt: isoDate,
  maxClaims: z.number().int(),
  dmTemplate: z.string().min(1).max(2000),
  soldOutMessage: z.string().min(1).max(2000),
  alreadyClaimedMessage: z.string().min(1).max(2000),
  notStartedMessage: z.string().max(2000).nullable().optional(),
  endedMessage: z.string().max(2000).nullable().optional(),
  codeGeneration: z.object({
    mode: z.literal("AUTO"),
    prefix: z.string().min(1).max(16),
    length: z.number().int().min(6).max(12).default(8),
  }),
});

const patchSchema = z
  .object({
    name: z.string().min(1).max(120).optional(),
    startsAt: isoDate.optional(),
    endsAt: isoDate.optional(),
    dmTemplate: z.string().min(1).max(2000).optional(),
    soldOutMessage: z.string().min(1).max(2000).optional(),
    alreadyClaimedMessage: z.string().min(1).max(2000).optional(),
    notStartedMessage: z.string().max(2000).nullable().optional(),
    endedMessage: z.string().max(2000).nullable().optional(),
  })
  .strict();

export class CampaignController {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new AppError(401, "Authentication required");
      const campaigns = await campaignService.listByUser(req.user.id);
      res.json(campaigns);
    } catch (error) {
      next(error);
    }
  }

  async getOne(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new AppError(401, "Authentication required");
      const id = getRouteParam(req, "id");
      const campaign = await campaignService.getById(req.user.id, id);
      res.json(campaign);
    } catch (error) {
      next(error);
    }
  }

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new AppError(401, "Authentication required");
      const body = createSchema.parse(req.body);
      const campaign = await campaignService.create(req.user.id, body);
      res.status(201).json(campaign);
    } catch (error) {
      next(error);
    }
  }

  async patch(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new AppError(401, "Authentication required");
      const id = getRouteParam(req, "id");
      const body = patchSchema.parse(req.body);
      const campaign = await campaignService.patch(req.user.id, id, body);
      res.json(campaign);
    } catch (error) {
      next(error);
    }
  }

  async activate(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new AppError(401, "Authentication required");
      const id = getRouteParam(req, "id");
      const campaign = await campaignService.activate(req.user.id, id);
      res.json(campaign);
    } catch (error) {
      next(error);
    }
  }

  async pause(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new AppError(401, "Authentication required");
      const id = getRouteParam(req, "id");
      const campaign = await campaignService.pause(req.user.id, id);
      res.json(campaign);
    } catch (error) {
      next(error);
    }
  }

  async archive(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new AppError(401, "Authentication required");
      const id = getRouteParam(req, "id");
      const campaign = await campaignService.archive(req.user.id, id);
      res.json(campaign);
    } catch (error) {
      next(error);
    }
  }

  async listClaims(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) throw new AppError(401, "Authentication required");
      const id = getRouteParam(req, "id");
      const rawLimit = typeof req.query.limit === "string" ? Number(req.query.limit) : 100;
      const limit = Number.isFinite(rawLimit) ? rawLimit : 100;
      const result = await campaignService.listClaims(req.user.id, id, limit);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
}

export const campaignController = new CampaignController();
