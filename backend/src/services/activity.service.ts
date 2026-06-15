import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";

export const activityService = {
  async log(
    userId: string,
    data: {
      type: string;
      title: string;
      description?: string;
      metadata?: Prisma.InputJsonValue;
    },
  ) {
    return prisma.activityEvent.create({
      data: {
        userId,
        type: data.type,
        title: data.title,
        description: data.description,
        metadata: data.metadata,
      },
    });
  },

  async listForUser(userId: string, limit = 50) {
    return prisma.activityEvent.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
  },
};
