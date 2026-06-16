import { Router } from "express";
import { debugController } from "../controllers/debug.controller";

const router = Router();

router.get("/db-shape", (req, res, next) => debugController.getDbShape(req, res, next));
router.post("/auth-check", (req, res, next) => debugController.postAuthCheck(req, res, next));

export default router;
