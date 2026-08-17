import { Router } from "express";
import { AUTH_RATE_LIMITS } from "../config/authSecurity";
import { authController } from "../controllers/auth.controller";
import { authenticate } from "../middleware/auth";
import { createAuthRateLimiter } from "../middleware/authRateLimit";

const router = Router();

router.post(
  "/register",
  createAuthRateLimiter({ name: "register", ...AUTH_RATE_LIMITS.register }),
  (req, res, next) => authController.register(req, res, next),
);
router.post(
  "/login",
  createAuthRateLimiter({ name: "login", ...AUTH_RATE_LIMITS.login }),
  (req, res, next) => authController.login(req, res, next),
);
router.post(
  "/forgot-password",
  createAuthRateLimiter({ name: "forgot-password", ...AUTH_RATE_LIMITS.forgotPassword }),
  (req, res, next) => authController.forgotPassword(req, res, next),
);
router.post(
  "/reset-password",
  createAuthRateLimiter({ name: "reset-password", ...AUTH_RATE_LIMITS.resetPassword }),
  (req, res, next) => authController.resetPassword(req, res, next),
);
router.post(
  "/change-password",
  authenticate,
  (req, res, next) => authController.changePassword(req, res, next),
);
router.get("/me", authenticate, (req, res, next) => authController.me(req, res, next));

export default router;
