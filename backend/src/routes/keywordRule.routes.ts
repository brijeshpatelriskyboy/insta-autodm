import { Router } from "express";
import { keywordRuleController } from "../controllers/keywordRule.controller";
import { authenticate } from "../middleware/auth";

const router = Router();

router.use(authenticate);

router.get("/", (req, res, next) => keywordRuleController.list(req, res, next));
router.get("/:id", (req, res, next) => keywordRuleController.getOne(req, res, next));
router.post("/", (req, res, next) => keywordRuleController.create(req, res, next));
router.put("/:id", (req, res, next) => keywordRuleController.update(req, res, next));
router.delete("/:id", (req, res, next) => keywordRuleController.remove(req, res, next));

export default router;
