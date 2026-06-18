import { Router } from "express";
import { webhookController } from "../controllers/webhook.controller";

const router = Router();

router.get("/instagram", (req, res) => webhookController.verify(req, res));
router.post("/instagram", (req, res, next) =>
  void webhookController.handleEvent(req, res, next),
);

export default router;
