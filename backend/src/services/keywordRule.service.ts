import { prisma } from "../lib/prisma";
import { AppError } from "../utils/errors";

interface CreateKeywordRuleInput {
  keyword: string;
  dmMessage: string;
  isActive?: boolean;
}

interface UpdateKeywordRuleInput {
  keyword?: string;
  dmMessage?: string;
  isActive?: boolean;
}

export class KeywordRuleService {
  async listByUser(userId: string) {
    return prisma.keywordRule.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });
  }

  async getById(userId: string, ruleId: string) {
    const rule = await prisma.keywordRule.findFirst({
      where: { id: ruleId, userId },
    });

    if (!rule) {
      throw new AppError(404, "Keyword rule not found");
    }

    return rule;
  }

  async create(userId: string, input: CreateKeywordRuleInput) {
    const keyword = input.keyword.trim().toUpperCase();

    const existing = await prisma.keywordRule.findUnique({
      where: { userId_keyword: { userId, keyword } },
    });

    if (existing) {
      throw new AppError(409, "A rule with this keyword already exists");
    }

    return prisma.keywordRule.create({
      data: {
        userId,
        keyword,
        dmMessage: input.dmMessage.trim(),
        isActive: input.isActive ?? true,
      },
    });
  }

  async update(userId: string, ruleId: string, input: UpdateKeywordRuleInput) {
    await this.getById(userId, ruleId);

    if (input.keyword) {
      const keyword = input.keyword.trim().toUpperCase();
      const duplicate = await prisma.keywordRule.findFirst({
        where: {
          userId,
          keyword,
          NOT: { id: ruleId },
        },
      });

      if (duplicate) {
        throw new AppError(409, "A rule with this keyword already exists");
      }
    }

    const updated = await prisma.keywordRule.update({
      where: { id: ruleId },
      data: {
        ...(input.keyword !== undefined && {
          keyword: input.keyword.trim().toUpperCase(),
        }),
        ...(input.dmMessage !== undefined && {
          dmMessage: input.dmMessage.trim(),
        }),
        ...(input.isActive !== undefined && { isActive: input.isActive }),
      },
    });

    console.log(`[KeywordRules] Updated rule ${ruleId} for user ${userId}`);
    return updated;
  }

  async delete(userId: string, ruleId: string) {
    await this.getById(userId, ruleId);

    await prisma.keywordRule.delete({ where: { id: ruleId } });
    console.log(`[KeywordRules] Deleted rule ${ruleId} for user ${userId}`);
  }
}

export const keywordRuleService = new KeywordRuleService();
