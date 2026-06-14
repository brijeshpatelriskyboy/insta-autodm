import { Router } from "express";
import { analyticsController } from "../controllers/analytics.controller";
import { authenticate } from "../middleware/auth";

const router = Router();

router.use(authenticate);
router.get("/summary", (req, res, next) => analyticsController.summary(req, res, next));

export default router;
