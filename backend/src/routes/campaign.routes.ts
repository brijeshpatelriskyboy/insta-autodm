import { Router } from "express";
import { campaignController } from "../controllers/campaign.controller";
import { authenticate } from "../middleware/auth";
import { requireSmartCampaignsEnabled } from "../middleware/requireSmartCampaignsEnabled";

const router = Router();

router.use(authenticate);
router.use(requireSmartCampaignsEnabled);

router.get("/", (req, res, next) => void campaignController.list(req, res, next));
router.post("/", (req, res, next) => void campaignController.create(req, res, next));
router.get("/:id", (req, res, next) => void campaignController.getOne(req, res, next));
router.patch("/:id", (req, res, next) => void campaignController.patch(req, res, next));
router.post("/:id/activate", (req, res, next) =>
  void campaignController.activate(req, res, next),
);
router.post("/:id/pause", (req, res, next) => void campaignController.pause(req, res, next));
router.post("/:id/archive", (req, res, next) =>
  void campaignController.archive(req, res, next),
);
router.get("/:id/claims", (req, res, next) =>
  void campaignController.listClaims(req, res, next),
);

export default router;
