import { Router } from "express";
import { accountController } from "../controllers/account.controller";
import { authenticate } from "../middleware/auth";

const router = Router();

router.delete("/", authenticate, (req, res, next) =>
  accountController.deleteAccount(req, res, next),
);

export default router;
