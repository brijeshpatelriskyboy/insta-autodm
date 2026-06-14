import { Router } from "express";
import { instagramController } from "../controllers/instagram.controller";
import { authenticate } from "../middleware/auth";

const router = Router();

router.use(authenticate);
router.get("/status", (req, res, next) => instagramController.status(req, res, next));
router.post("/connect", (req, res, next) => instagramController.connect(req, res, next));

export default router;
