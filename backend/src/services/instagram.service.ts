import { prisma } from "../lib/prisma";
import { AppError } from "../utils/errors";

function normalizeUsername(username: string): string {
  return username.trim().replace(/^@/, "").toLowerCase();
}

export const instagramService = {
  async getStatus(userId: string) {
    const request = await prisma.instagramConnectionRequest.findUnique({
      where: { userId },
    });

    return {
      connected: request?.status === "waitlist" || request?.status === "connected",
      status: request?.status ?? "not_connected",
      instagramUsername: request?.instagramUsername ?? null,
      joinedWaitlist: request?.status === "waitlist",
    };
  },

  async joinWaitlist(userId: string, instagramUsername: string) {
    const username = normalizeUsername(instagramUsername);

    if (!username || username.length < 1 || username.length > 30) {
      throw new AppError(400, "Instagram username must be 1–30 characters");
    }

    if (!/^[a-z0-9._]+$/.test(username)) {
      throw new AppError(
        400,
        "Username can only contain letters, numbers, periods, and underscores",
      );
    }

    const request = await prisma.instagramConnectionRequest.upsert({
      where: { userId },
      create: {
        userId,
        instagramUsername: username,
        status: "waitlist",
      },
      update: {
        instagramUsername: username,
        status: "waitlist",
      },
    });

    return {
      id: request.id,
      instagramUsername: request.instagramUsername,
      status: request.status,
      message: "You've joined the Instagram integration waitlist",
    };
  },
};
