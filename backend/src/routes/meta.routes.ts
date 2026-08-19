import { Router } from "express";
import { instagramIntegrationController } from "../controllers/integrations.controller";
import { metaDataDeletionController } from "../controllers/metaDataDeletion.controller";

/**
 * Public Meta / Instagram OAuth and data-deletion routes.
 * Mounted at /api/meta — no authentication middleware.
 * Data-deletion/deauthorize are isolated from webhook HMAC and comment→DM routing.
 */
const router = Router();

router.get("/callback", (req, res, next) =>
  instagramIntegrationController.callback(req, res, next),
);

router.post("/data-deletion", (req, res, next) =>
  metaDataDeletionController.dataDeletion(req, res, next),
);

router.get("/data-deletion/status", (req, res, next) =>
  metaDataDeletionController.status(req, res, next),
);

router.post("/deauthorize", (req, res, next) =>
  metaDataDeletionController.deauthorize(req, res, next),
);

export default router;
