import { Router } from "express";
import { webhookController } from "../controllers/webhook.controller";

const router = Router();

// GET verification challenge only. POST /instagram is registered in app.ts with
// express.raw + Meta X-Hub-Signature-256 verification before JSON parsing.
router.get("/instagram", (req, res) => webhookController.verify(req, res));

export default router;
