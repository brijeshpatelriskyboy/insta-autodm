import { Router } from "express";
import { featuresController } from "../controllers/features.controller";
import { authenticate } from "../middleware/auth";

const router = Router();

router.use(authenticate);
router.get("/", (req, res, next) => featuresController.getFeatures(req, res, next));

export default router;
