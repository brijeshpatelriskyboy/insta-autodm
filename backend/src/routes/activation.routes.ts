import { Router } from "express";
import { activationController } from "../controllers/activation.controller";
import { authenticate } from "../middleware/auth";

const router = Router();

router.use(authenticate);

router.get("/quick-start", (req, res, next) =>
  activationController.getQuickStart(req, res, next),
);
router.post("/quick-start/celebrate", (req, res, next) =>
  activationController.celebrateQuickStart(req, res, next),
);

export default router;
