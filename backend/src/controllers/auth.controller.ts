import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { PASSWORD_MIN_LENGTH } from "../config/authSecurity";
import { authService } from "../services/auth.service";
import { AppError } from "../utils/errors";

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(PASSWORD_MIN_LENGTH),
  name: z.string().min(1).optional(),
  acceptedTerms: z.literal(true, {
    errorMap: () => ({ message: "You must agree to the Terms of Service and Privacy Policy" }),
  }),
  acceptedPrivacy: z.literal(true, {
    errorMap: () => ({ message: "You must agree to the Terms of Service and Privacy Policy" }),
  }),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

const resetPasswordSchema = z.object({
  token: z.string().min(1),
  newPassword: z.string().min(PASSWORD_MIN_LENGTH),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(PASSWORD_MIN_LENGTH),
});

function assertNoSecretLeakage(payload: unknown): void {
  const serialized = JSON.stringify(payload);
  if (
    serialized.includes("passwordHash") ||
    serialized.includes("tokenHash") ||
    /"password"\s*:/.test(serialized)
  ) {
    throw new AppError(500, "Internal server error");
  }
}

export class AuthController {
  async register(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const body = registerSchema.parse(req.body);
      const result = await authService.register(body.email, body.password, {
        name: body.name,
        acceptedTerms: body.acceptedTerms,
        acceptedPrivacy: body.acceptedPrivacy,
      });
      assertNoSecretLeakage(result);
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  }

  async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const body = loginSchema.parse(req.body);
      const result = await authService.login(body.email, body.password);
      assertNoSecretLeakage(result);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  async me(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AppError(401, "Authentication required");
      }

      const profile = await authService.getProfile(req.user.id);
      assertNoSecretLeakage(profile);
      res.json(profile);
    } catch (error) {
      next(error);
    }
  }

  async forgotPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const body = forgotPasswordSchema.parse(req.body);
      const result = await authService.forgotPassword(body.email);
      assertNoSecretLeakage(result);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  async resetPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const body = resetPasswordSchema.parse(req.body);
      const result = await authService.resetPassword(body.token, body.newPassword);
      assertNoSecretLeakage(result);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  async changePassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AppError(401, "Authentication required");
      }
      const body = changePasswordSchema.parse(req.body);
      const result = await authService.changePassword(
        req.user.id,
        body.currentPassword,
        body.newPassword,
      );
      assertNoSecretLeakage(result);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
}

export const authController = new AuthController();
