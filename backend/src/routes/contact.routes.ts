import { Router } from "express";
import { CONTACT_RATE_LIMIT } from "../config/contact";
import { contactController } from "../controllers/contact.controller";
import { createAuthRateLimiter } from "../middleware/authRateLimit";

const router = Router();

const contactRateLimit = createAuthRateLimiter({
  name: "contact",
  windowMs: CONTACT_RATE_LIMIT.windowMs,
  max: CONTACT_RATE_LIMIT.max,
});

router.post("/", contactRateLimit, (req, res, next) =>
  contactController.submit(req, res, next),
);

export default router;
