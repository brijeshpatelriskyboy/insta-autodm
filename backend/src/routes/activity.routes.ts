import { Router } from "express";
import { activityController } from "../controllers/integrations.controller";
import { authenticate } from "../middleware/auth";

const router = Router();

router.use(authenticate);
router.get("/events", (req, res, next) => activityController.list(req, res, next));

export default router;
