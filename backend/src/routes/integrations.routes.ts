import { Router } from "express";
import {
  activityController,
  instagramIntegrationController,
} from "../controllers/integrations.controller";
import { authenticate } from "../middleware/auth";

const router = Router();

router.use(authenticate);

router.get("/instagram/status", (req, res, next) =>
  instagramIntegrationController.status(req, res, next),
);
router.post("/instagram/connect/mock", (req, res, next) =>
  instagramIntegrationController.connectMock(req, res, next),
);
router.delete("/instagram/disconnect", (req, res, next) =>
  instagramIntegrationController.disconnect(req, res, next),
);

export default router;
