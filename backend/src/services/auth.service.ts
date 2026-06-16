import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { env } from "../config/env";
import { AppError } from "../utils/errors";
import {
  dbShapeService,
  type LoginUserRecord,
} from "./dbShape.service";

interface AuthResult {
  token: string;
  user: {
    id: string;
    email: string;
    name: string | null;
  };
}

function logPrismaError(context: string, error: unknown): void {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    console.error(`[auth] ${context}:`, {
      name: error.name,
      code: error.code,
      message: error.message,
      meta: error.meta,
    });
    return;
  }

  if (error instanceof Prisma.PrismaClientInitializationError) {
    console.error(`[auth] ${context}:`, {
      name: error.name,
      message: error.message,
    });
    return;
  }

  if (error instanceof Prisma.PrismaClientRustPanicError) {
    console.error(`[auth] ${context}:`, {
      name: error.name,
      message: error.message,
    });
    return;
  }

  console.error(`[auth] ${context}:`, {
    name: error instanceof Error ? error.name : "UnknownError",
    message: error instanceof Error ? error.message : String(error),
  });
}

function isDatabaseUnavailable(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return ["P1000", "P1001", "P1002", "P1003", "P1017", "P2021"].includes(error.code);
  }

  if (error instanceof Prisma.PrismaClientInitializationError) {
    return true;
  }

  const message = error instanceof Error ? error.message.toLowerCase() : "";
  return (
    message.includes("connect") ||
    message.includes("database") ||
    message.includes("openssl") ||
    message.includes("tls")
  );
}

async function findUserForLogin(email: string): Promise<LoginUserRecord | null> {
  const normalizedEmail = email.trim().toLowerCase();

  try {
    return await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: {
        id: true,
        email: true,
        passwordHash: true,
        name: true,
      },
    });
  } catch (error) {
    logPrismaError("user lookup failed (prisma)", error);

    try {
      const user = await dbShapeService.findUserByEmailQuoted(normalizedEmail);
      console.log("[auth] user lookup quoted raw fallback:", user ? "yes" : "no");
      if (user) {
        return user;
      }
    } catch (quotedError) {
      logPrismaError("user lookup quoted raw fallback failed", quotedError);
    }

    try {
      const user = await dbShapeService.findUserByEmailIntrospected(normalizedEmail);
      console.log("[auth] user lookup introspected raw fallback:", user ? "yes" : "no");
      return user;
    } catch (introspectedError) {
      logPrismaError("user lookup introspected raw fallback failed", introspectedError);
      if (isDatabaseUnavailable(error) || isDatabaseUnavailable(introspectedError)) {
        throw new AppError(503, "Database temporarily unavailable");
      }
      throw error;
    }
  }
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
    let user: LoginUserRecord | null;
    try {
      user = await findUserForLogin(email);
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      logPrismaError("login user lookup failed", error);
      throw new AppError(503, "Database temporarily unavailable");
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
