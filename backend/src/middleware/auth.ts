import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { AppError } from "../utils/errors";
import { prisma } from "../lib/prisma";

interface JwtPayload {
  userId: string;
  email: string;
  name: string | null;
}

export async function authenticate(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    next(new AppError(401, "Authentication required"));
    return;
  }

  const token = authHeader.slice(7);

  let payload: JwtPayload;
  try {
    payload = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
    if (typeof payload.userId !== "string" || !payload.userId) throw new Error("Invalid user");
  } catch {
    next(new AppError(401, "Invalid or expired token"));
    return;
  }

  try {
    // A signed token must not keep a deleted account authenticated for seven days.
    const account = await prisma.user.findUnique({ where: { id: payload.userId }, select: { id: true } });
    if (!account) {
      res.status(401).json({ error: "Your account session is no longer valid. Please sign in again.", code: "SESSION_INVALID" });
      return;
    }
    req.user = {
      id: payload.userId,
      email: payload.email,
      name: payload.name,
    };
    next();
  } catch (error) {
    // Infrastructure errors are not proof that the session/account is invalid.
    next(error);
  }
}
