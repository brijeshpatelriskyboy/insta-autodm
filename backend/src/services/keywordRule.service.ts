import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { AppError } from "../utils/errors";
import { decryptToken } from "../utils/tokenCrypto";
import { metaGraphService } from "./metaGraph.service";

/** Sentinel for global (all-posts) keyword rules — always stored non-null. */
export const MEDIA_SCOPE_GLOBAL = "__GLOBAL__";

const MEDIA_CAPTION_MAX = 280;

export function toMediaScopeKey(instagramMediaId: string | null | undefined): string {
  const id = instagramMediaId?.trim();
  return id ? id : MEDIA_SCOPE_GLOBAL;
}

function truncateCaption(caption: string | null | undefined): string | null {
  if (!caption?.trim()) return null;
  const trimmed = caption.trim();
  return trimmed.length > MEDIA_CAPTION_MAX
    ? `${trimmed.slice(0, MEDIA_CAPTION_MAX - 1)}…`
    : trimmed;
}

interface CreateKeywordRuleInput {
  keyword: string;
  dmMessage: string;
  isActive?: boolean;
  /** null/undefined = global scope */
  instagramMediaId?: string | null;
}

interface UpdateKeywordRuleInput {
  keyword?: string;
  dmMessage?: string;
  isActive?: boolean;
  /** Explicit null clears to global; undefined leaves unchanged */
  instagramMediaId?: string | null;
}

async function resolveMediaCache(
  userId: string,
  instagramMediaId: string | null,
): Promise<{
  instagramMediaId: string | null;
  mediaScopeKey: string;
  mediaType: string | null;
  mediaThumbnailUrl: string | null;
  mediaCaption: string | null;
  mediaPermalink: string | null;
}> {
  if (!instagramMediaId) {
    return {
      instagramMediaId: null,
      mediaScopeKey: MEDIA_SCOPE_GLOBAL,
      mediaType: null,
      mediaThumbnailUrl: null,
      mediaCaption: null,
      mediaPermalink: null,
    };
  }

  const account = await prisma.instagramAccount.findUnique({ where: { userId } });
  if (!account || account.connectionStatus !== "connected") {
    throw new AppError(400, "Connect Instagram before attaching a rule to a post");
  }
  if (
    !account.accessTokenEncrypted ||
    account.accessTokenEncrypted === "mock_encrypted_token_placeholder"
  ) {
    throw new AppError(400, "Connected Instagram account has no usable access token");
  }

  let accessToken: string;
  try {
    accessToken = decryptToken(account.accessTokenEncrypted);
  } catch {
    throw new AppError(400, "Stored Instagram access token could not be decrypted");
  }

  const media = await metaGraphService.getInstagramMediaById({
    mediaId: instagramMediaId,
    accessToken,
  });

  return {
    instagramMediaId: media.id,
    mediaScopeKey: media.id,
    mediaType: media.mediaType,
    mediaThumbnailUrl: media.thumbnailUrl,
    mediaCaption: truncateCaption(media.caption),
    mediaPermalink: media.permalink,
  };
}

function mapUniqueConstraintError(error: unknown): AppError | null {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    return new AppError(
      409,
      "A rule with this keyword already exists for the selected post scope",
    );
  }
  return null;
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
    const mediaId = input.instagramMediaId?.trim() || null;
    const mediaCache = await resolveMediaCache(userId, mediaId);

    try {
      return await prisma.keywordRule.create({
        data: {
          userId,
          keyword,
          dmMessage: input.dmMessage.trim(),
          isActive: input.isActive ?? true,
          ...mediaCache,
        },
      });
    } catch (error) {
      const mapped = mapUniqueConstraintError(error);
      if (mapped) throw mapped;
      throw error;
    }
  }

  async update(userId: string, ruleId: string, input: UpdateKeywordRuleInput) {
    const existing = await this.getById(userId, ruleId);

    const keyword =
      input.keyword !== undefined ? input.keyword.trim().toUpperCase() : existing.keyword;

    let mediaCache: Awaited<ReturnType<typeof resolveMediaCache>> | null = null;
    if (input.instagramMediaId !== undefined) {
      const mediaId = input.instagramMediaId?.trim() || null;
      mediaCache = await resolveMediaCache(userId, mediaId);
    }

    try {
      const updated = await prisma.keywordRule.update({
        where: { id: ruleId },
        data: {
          ...(input.keyword !== undefined && { keyword }),
          ...(input.dmMessage !== undefined && {
            dmMessage: input.dmMessage.trim(),
          }),
          ...(input.isActive !== undefined && { isActive: input.isActive }),
          ...(mediaCache
            ? {
                instagramMediaId: mediaCache.instagramMediaId,
                mediaScopeKey: mediaCache.mediaScopeKey,
                mediaType: mediaCache.mediaType,
                mediaThumbnailUrl: mediaCache.mediaThumbnailUrl,
                mediaCaption: mediaCache.mediaCaption,
                mediaPermalink: mediaCache.mediaPermalink,
              }
            : {}),
        },
      });

      console.log(`[KeywordRules] Updated rule ${ruleId} for user ${userId}`);
      return updated;
    } catch (error) {
      const mapped = mapUniqueConstraintError(error);
      if (mapped) throw mapped;
      throw error;
    }
  }

  async delete(userId: string, ruleId: string) {
    await this.getById(userId, ruleId);

    await prisma.keywordRule.delete({ where: { id: ruleId } });
    console.log(`[KeywordRules] Deleted rule ${ruleId} for user ${userId}`);
  }
}

export const keywordRuleService = new KeywordRuleService();
