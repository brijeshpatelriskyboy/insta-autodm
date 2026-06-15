import { Router } from "express";
import {
  activityController,
  instagramIntegrationController,
} from "../controllers/integrations.controller";
import { authenticate } from "../middleware/auth";

const router = Router();

router.get("/instagram/callback", (req, res, next) =>
  instagramIntegrationController.callback(req, res, next),
);

router.get("/instagram/meta-config", (req, res, next) =>
  instagramIntegrationController.metaConfig(req, res, next),
);

router.use(authenticate);

router.get("/instagram/status", (req, res, next) =>
  instagramIntegrationController.status(req, res, next),
);
router.get("/instagram/oauth-url", (req, res, next) =>
  instagramIntegrationController.oauthUrl(req, res, next),
);
router.post("/instagram/connect/mock", (req, res, next) =>
  instagramIntegrationController.connectMock(req, res, next),
);
router.delete("/instagram/disconnect", (req, res, next) =>
  instagramIntegrationController.disconnect(req, res, next),
);

export default router;
