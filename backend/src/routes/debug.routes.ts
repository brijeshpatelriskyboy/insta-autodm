import { Router } from "express";
import { debugController } from "../controllers/debug.controller";

const router = Router();

router.get("/db-shape", (req, res, next) => debugController.getDbShape(req, res, next));

export default router;
