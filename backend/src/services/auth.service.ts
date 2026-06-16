import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma } from "../lib/prisma";
import { env } from "../config/env";
import { AppError } from "../utils/errors";

interface AuthResult {
  token: string;
  user: {
    id: string;
    email: string;
    name: string | null;
  };
}

export class AuthService {
  async register(email: string, password: string, name?: string): Promise<AuthResult> {
    const existing = await prisma.user.findUnique({ where: { email } });

    if (existing) {
      throw new AppError(409, "Email already registered");
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: { email, passwordHash, name },
      select: { id: true, email: true, name: true },
    });

    return this.buildAuthResult(user);
  }

  async login(email: string, password: string): Promise<AuthResult> {
    let user;
    try {
      user = await prisma.user.findUnique({ where: { email } });
    } catch (error) {
      console.error(
        "[auth] user lookup failed:",
        error instanceof Error ? error.message : error,
      );
      throw error;
    }

    console.log("[auth] user found:", user ? "yes" : "no");

    if (!user) {
      throw new AppError(401, "Invalid email or password");
    }

    console.log("[auth] password compare attempted: yes");

    let valid = false;
    try {
      valid = await bcrypt.compare(password, user.passwordHash);
    } catch (error) {
      console.error(
        "[auth] password compare failed:",
        error instanceof Error ? error.message : error,
      );
      throw new AppError(401, "Invalid email or password");
    }

    if (!valid) {
      throw new AppError(401, "Invalid email or password");
    }

    try {
      return this.buildAuthResult({
        id: user.id,
        email: user.email,
        name: user.name,
      });
    } catch (error) {
      console.error(
        "[auth] token sign failed:",
        error instanceof Error ? error.message : error,
      );
      throw error;
    }
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
