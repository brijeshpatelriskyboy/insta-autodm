import { Router } from "express";
import { instagramIntegrationController } from "../controllers/integrations.controller";

/**
 * Public Meta / Instagram OAuth routes.
 * Mounted at /api/meta — no authentication middleware.
 */
const router = Router();

router.get("/callback", (req, res, next) =>
  instagramIntegrationController.callback(req, res, next),
);

export default router;
