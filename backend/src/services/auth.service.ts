import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { Prisma } from "@prisma/client";
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

type LoginUserRecord = {
  id: string;
  email: string;
  passwordHash: string;
  name: string | null;
};

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

async function findUserForLogin(email: string): Promise<LoginUserRecord | null> {
  try {
    return await prisma.user.findUnique({
      where: { email },
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
      const rows = await prisma.$queryRaw<LoginUserRecord[]>(
        Prisma.sql`
          SELECT id, email, "passwordHash", name
          FROM users
          WHERE email = ${email}
          LIMIT 1
        `,
      );
      console.log("[auth] user lookup raw fallback:", rows[0] ? "yes" : "no");
      return rows[0] ?? null;
    } catch (rawError) {
      logPrismaError("user lookup raw fallback failed", rawError);
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
    const user = await findUserForLogin(email);

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
