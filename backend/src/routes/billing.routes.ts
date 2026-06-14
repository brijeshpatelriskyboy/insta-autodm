import { Router } from "express";
import { billingController } from "../controllers/billing.controller";
import { authenticate } from "../middleware/auth";

const router = Router();

router.use(authenticate);
router.get("/subscription", (req, res, next) =>
  billingController.getSubscription(req, res, next),
);
router.get("/history", (req, res, next) => billingController.getHistory(req, res, next));
router.post("/checkout", (req, res, next) => billingController.checkout(req, res, next));
router.post("/cancel", (req, res, next) => billingController.cancel(req, res, next));

export default router;
