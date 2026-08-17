import crypto from "crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma } from "../lib/prisma";
import { env } from "../config/env";
import { isEmailDeliveryConfigured, readEmailRuntimeConfig } from "../config/email";
import {
  GENERIC_FORGOT_PASSWORD_MESSAGE,
  INVALID_RESET_TOKEN_MESSAGE,
  PASSWORD_MIN_LENGTH,
  PASSWORD_RESET_TTL_MS,
  isResetTokenTestHelperEnabled,
} from "../config/authSecurity";
import { EmailDeliveryError } from "../email/types";
import { logPasswordResetEmailOutcome, sendPasswordResetEmail } from "../email/emailService";
import { buildPasswordResetUrl } from "../email/resetUrl";
import { AppError } from "../utils/errors";

interface AuthResult {
  token: string;
  user: {
    id: string;
    email: string;
    name: string | null;
  };
}

export const GENERIC_FORGOT_RESPONSE = {
  message: GENERIC_FORGOT_PASSWORD_MESSAGE,
} as const;

function hashResetToken(plaintext: string): string {
  return crypto.createHash("sha256").update(plaintext, "utf8").digest("hex");
}

function generateResetToken(): string {
  return crypto.randomBytes(32).toString("base64url");
}

function assertPasswordPolicy(password: string): void {
  if (password.length < PASSWORD_MIN_LENGTH) {
    throw new AppError(400, `Password must be at least ${PASSWORD_MIN_LENGTH} characters`);
  }
}

export class AuthService {
  async register(
    email: string,
    password: string,
    options: {
      name?: string;
      acceptedTerms: boolean;
      acceptedPrivacy: boolean;
    },
  ): Promise<AuthResult> {
    if (!options.acceptedTerms || !options.acceptedPrivacy) {
      throw new AppError(
        400,
        "You must agree to the Terms of Service and Privacy Policy",
      );
    }

    assertPasswordPolicy(password);

    const existing = await prisma.user.findUnique({ where: { email } });

    if (existing) {
      throw new AppError(409, "Email already registered");
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const acceptedAt = new Date();

    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        name: options.name,
        termsAcceptedAt: acceptedAt,
        privacyAcceptedAt: acceptedAt,
      },
      select: { id: true, email: true, name: true },
    });

    return this.buildAuthResult(user);
  }

  async login(email: string, password: string): Promise<AuthResult> {
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      throw new AppError(401, "Invalid email or password");
    }

    const valid = await bcrypt.compare(password, user.passwordHash);

    if (!valid) {
      throw new AppError(401, "Invalid email or password");
    }

    return this.buildAuthResult({
      id: user.id,
      email: user.email,
      name: user.name,
    });
  }

  async getProfile(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true, createdAt: true },
    });

    if (!user) {
      throw new AppError(404, "User not found");
    }

    return user;
  }

  /**
   * Always returns the same generic payload. Does not reveal whether the email exists.
   * Never logs the plaintext token or reset URL.
   * If delivery fails or email is not configured, the newly issued token is invalidated.
   */
  async forgotPassword(email: string): Promise<{ message: string }> {
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true },
    });

    if (!user) {
      return { ...GENERIC_FORGOT_RESPONSE };
    }

    const plaintext = await this.issueResetToken(user.id);
    const tokenHash = hashResetToken(plaintext);

    const allowTestProvider = process.env.NODE_ENV === "test";
    if (!allowTestProvider && !isEmailDeliveryConfigured()) {
      await this.invalidateResetToken(tokenHash);
      logPasswordResetEmailOutcome({ outcome: "skipped", reason: "not_configured" });
      return { ...GENERIC_FORGOT_RESPONSE };
    }

    try {
      const resetUrl = buildPasswordResetUrl(readEmailRuntimeConfig().frontendUrl, plaintext);
      await sendPasswordResetEmail({ to: user.email, resetUrl });
      logPasswordResetEmailOutcome({ outcome: "sent" });
    } catch (error) {
      await this.invalidateResetToken(tokenHash);
      const httpStatus = error instanceof EmailDeliveryError ? error.httpStatus : undefined;
      const reason = error instanceof EmailDeliveryError ? error.code : "unexpected";
      logPasswordResetEmailOutcome({ outcome: "failed", reason, httpStatus });
    }

    return { ...GENERIC_FORGOT_RESPONSE };
  }

  async resetPassword(token: string, newPassword: string): Promise<{ message: string }> {
    assertPasswordPolicy(newPassword);

    const tokenHash = hashResetToken(token);
    const record = await prisma.passwordResetToken.findUnique({
      where: { tokenHash },
    });

    if (!record || record.usedAt || record.expiresAt.getTime() <= Date.now()) {
      throw new AppError(400, INVALID_RESET_TOKEN_MESSAGE);
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);

    await prisma.$transaction(async (tx) => {
      const consumed = await tx.passwordResetToken.updateMany({
        where: {
          id: record.id,
          usedAt: null,
          expiresAt: { gt: new Date() },
        },
        data: { usedAt: new Date() },
      });

      if (consumed.count !== 1) {
        throw new AppError(400, INVALID_RESET_TOKEN_MESSAGE);
      }

      await tx.user.update({
        where: { id: record.userId },
        data: { passwordHash },
      });
    });

    return { message: "Password updated" };
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<{ message: string }> {
    assertPasswordPolicy(newPassword);

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, passwordHash: true },
    });

    if (!user) {
      throw new AppError(404, "User not found");
    }

    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) {
      throw new AppError(401, "Current password is incorrect");
    }

    const same = await bcrypt.compare(newPassword, user.passwordHash);
    if (same) {
      throw new AppError(400, "New password must be different from the current password");
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });

    return { message: "Password updated" };
  }

  /**
   * Test/dev helper: create a reset token and return the plaintext.
   * Throws in production. Never log the return value.
   */
  async createResetTokenForTests(
    userId: string,
    options?: { expiresAt?: Date },
  ): Promise<string> {
    if (!isResetTokenTestHelperEnabled()) {
      throw new Error("createResetTokenForTests is not available in production");
    }
    return this.issueResetToken(userId, options);
  }

  private async invalidateResetToken(tokenHash: string): Promise<void> {
    await prisma.passwordResetToken.updateMany({
      where: { tokenHash, usedAt: null },
      data: { usedAt: new Date() },
    });
  }

  private async issueResetToken(
    userId: string,
    options?: { expiresAt?: Date },
  ): Promise<string> {
    const plaintext = generateResetToken();
    const tokenHash = hashResetToken(plaintext);
    const expiresAt = options?.expiresAt ?? new Date(Date.now() + PASSWORD_RESET_TTL_MS);

    await prisma.passwordResetToken.updateMany({
      where: { userId, usedAt: null },
      data: { usedAt: new Date() },
    });

    await prisma.passwordResetToken.create({
      data: {
        userId,
        tokenHash,
        expiresAt,
      },
    });

    return plaintext;
  }

  private buildAuthResult(user: {
    id: string;
    email: string;
    name: string | null;
  }): AuthResult {
    const token = jwt.sign(
      { userId: user.id, email: user.email, name: user.name },
      env.JWT_SECRET,
      { expiresIn: "7d" },
    );

    return { token, user };
  }
}

export const authService = new AuthService();

export const resetTokenInternalsForTests = {
  hashResetToken,
  generateResetToken,
};
