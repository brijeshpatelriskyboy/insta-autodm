import { DmEventStatus, Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { activityService } from "./activity.service";
import { responseRouter } from "./responseRouter";
import {
  MAX_DM_ATTEMPTS,
  buildActivityMetadata,
  dmFailureActivityTitle,
  formatDmErrorSummary,
  resolveDmFailureStatus,
  sanitizeErrorSummary,
  truncateComment,
  type DmFailureStatus,
} from "./standardDmResponse.service";

// Re-export helpers for existing tests and callers (behaviour unchanged).
export {
  MAX_DM_ATTEMPTS,
  dmFailureActivityTitle,
  formatDmErrorSummary,
  resolveDmFailureStatus,
  sanitizeErrorSummary,
  truncateComment,
  type DmFailureStatus,
};

export interface ParsedComment {
  instagramAccountId: string;
  commentId: string;
  text: string;
  commenterUsername?: string;
  commenterId?: string;
  mediaId?: string;
  eventField?: string;
}

export interface WebhookProcessResult {
  processed: number;
  matched: number;
  skipped: number;
  sent: number;
  failed: number;
  duplicates: number;
  eventsCreated: number;
}

export function commentMatchesKeyword(commentText: string, keyword: string): boolean {
  return commentText.trim().toUpperCase().includes(keyword.toUpperCase());
}

/**
 * Prefer an exact post-scoped keyword rule; fall back to a global rule.
 * Cached thumbnail/caption are never used for matching.
 */
export function selectMatchingKeywordRule<
  T extends { keyword: string; instagramMediaId: string | null },
>(
  rules: T[],
  commentText: string,
  commentMediaId: string | null | undefined,
): T | null {
  const keywordMatches = rules.filter((rule) =>
    commentMatchesKeyword(commentText, rule.keyword),
  );
  if (keywordMatches.length === 0) {
    return null;
  }

  const mediaId = commentMediaId?.trim() || null;
  if (mediaId) {
    const postScoped = keywordMatches.find((rule) => rule.instagramMediaId === mediaId);
    if (postScoped) {
      return postScoped;
    }
  }

  const global = keywordMatches.find((rule) => rule.instagramMediaId == null);
  return global ?? null;
}

export function parseInstagramCommentWebhook(body: unknown): ParsedComment[] {
  if (!body || typeof body !== "object") {
    return [];
  }

  const payload = body as { object?: string; entry?: unknown[] };
  if (payload.object !== "instagram" || !Array.isArray(payload.entry)) {
    return [];
  }

  const comments: ParsedComment[] = [];

  for (const entry of payload.entry) {
    if (!entry || typeof entry !== "object") {
      continue;
    }

    const entryObj = entry as { id?: string; changes?: unknown[] };
    const accountId = entryObj.id?.trim();
    if (!accountId || !Array.isArray(entryObj.changes)) {
      continue;
    }

    for (const change of entryObj.changes) {
      if (!change || typeof change !== "object") {
        continue;
      }

      const changeObj = change as { field?: string; value?: unknown };
      if (changeObj.field !== "comments" && changeObj.field !== "live_comments") {
        continue;
      }

      const value = changeObj.value;
      if (!value || typeof value !== "object") {
        continue;
      }

      const valueObj = value as {
        id?: string;
        text?: string;
        from?: { id?: string; username?: string };
        media?: { id?: string };
      };

      const text = valueObj.text?.trim();
      const commentId = valueObj.id?.trim();
      if (!text || !commentId) {
        console.warn("[webhook] skipping comment missing text or commentId:", {
          accountId,
          hasText: Boolean(text),
          hasCommentId: Boolean(commentId),
          field: changeObj.field ?? null,
        });
        continue;
      }

      comments.push({
        instagramAccountId: accountId,
        commentId,
        text,
        commenterUsername: valueObj.from?.username,
        commenterId: valueObj.from?.id,
        mediaId: valueObj.media?.id,
        eventField: changeObj.field,
      });
    }
  }

  return comments;
}

async function findAccountByInstagramId(instagramAccountId: string) {
  return prisma.instagramAccount.findFirst({
    where: {
      connectionStatus: "connected",
      OR: [{ instagramUserId: instagramAccountId }, { pageId: instagramAccountId }],
    },
  });
}

/**
 * Atomically claim a comment ID before keyword matching or private-reply send.
 * - New row → create status=sending (ruleId set later after a match)
 * - sent / sending / skipped → duplicate (skip)
 * - failed with attempts remaining → conditional update failed→sending
 * Concurrent webhooks cannot both claim the same comment.
 */
export async function claimCommentForSend(params: {
  userId: string;
  instagramAccountId: string;
  commentId: string;
  mediaId?: string | null;
  ruleId?: string | null;
}): Promise<{ dmEventId: string; attemptCount: number; isRetry: boolean } | null> {
  const { userId, instagramAccountId, commentId, mediaId, ruleId } = params;

  try {
    return await prisma.$transaction(async (tx) => {
      const existing = await tx.dmEvent.findUnique({
        where: {
          instagramAccountId_commentId: { instagramAccountId, commentId },
        },
      });

      if (!existing) {
        const created = await tx.dmEvent.create({
          data: {
            userId,
            ruleId: ruleId ?? null,
            instagramAccountId,
            commentId,
            mediaId: mediaId ?? null,
            status: DmEventStatus.sending,
            attemptCount: 1,
            lastAttemptAt: new Date(),
          },
        });
        return { dmEventId: created.id, attemptCount: created.attemptCount, isRetry: false };
      }

      if (
        existing.status === DmEventStatus.sent ||
        existing.status === DmEventStatus.sending ||
        existing.status === DmEventStatus.skipped
      ) {
        return null;
      }

      if (existing.status === DmEventStatus.failed) {
        if (existing.attemptCount >= MAX_DM_ATTEMPTS) {
          return null;
        }

        const updated = await tx.dmEvent.updateMany({
          where: {
            id: existing.id,
            status: DmEventStatus.failed,
            attemptCount: { lt: MAX_DM_ATTEMPTS },
          },
          data: {
            status: DmEventStatus.sending,
            attemptCount: { increment: 1 },
            lastAttemptAt: new Date(),
            errorSummary: null,
            metaErrorCode: null,
            metaErrorMessage: null,
            mediaId: mediaId ?? existing.mediaId,
            ...(ruleId ? { ruleId } : {}),
          },
        });

        if (updated.count !== 1) {
          return null;
        }

        const row = await tx.dmEvent.findUniqueOrThrow({ where: { id: existing.id } });
        return { dmEventId: row.id, attemptCount: row.attemptCount, isRetry: true };
      }

      return null;
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      // Concurrent create lost the race — treat as duplicate unless a failed row can be claimed.
      return claimCommentForSendAfterConflict(params);
    }
    throw error;
  }
}

async function claimCommentForSendAfterConflict(params: {
  userId: string;
  instagramAccountId: string;
  commentId: string;
  mediaId?: string | null;
  ruleId?: string | null;
}): Promise<{ dmEventId: string; attemptCount: number; isRetry: boolean } | null> {
  const existing = await prisma.dmEvent.findUnique({
    where: {
      instagramAccountId_commentId: {
        instagramAccountId: params.instagramAccountId,
        commentId: params.commentId,
      },
    },
  });

  if (!existing) {
    return null;
  }

  if (
    existing.status === DmEventStatus.sent ||
    existing.status === DmEventStatus.sending ||
    existing.status === DmEventStatus.skipped
  ) {
    return null;
  }

  if (existing.status !== DmEventStatus.failed || existing.attemptCount >= MAX_DM_ATTEMPTS) {
    return null;
  }

  const updated = await prisma.dmEvent.updateMany({
    where: {
      id: existing.id,
      status: DmEventStatus.failed,
      attemptCount: { lt: MAX_DM_ATTEMPTS },
    },
    data: {
      status: DmEventStatus.sending,
      attemptCount: { increment: 1 },
      lastAttemptAt: new Date(),
      errorSummary: null,
      metaErrorCode: null,
      metaErrorMessage: null,
      mediaId: params.mediaId ?? existing.mediaId,
      ...(params.ruleId ? { ruleId: params.ruleId } : {}),
    },
  });

  if (updated.count !== 1) {
    return null;
  }

  const row = await prisma.dmEvent.findUniqueOrThrow({ where: { id: existing.id } });
  return { dmEventId: row.id, attemptCount: row.attemptCount, isRetry: true };
}

async function matchAndProcessComment(comment: ParsedComment): Promise<{
  matched: boolean;
  sent: boolean;
  failed: boolean;
  duplicate: boolean;
  eventsCreated: number;
}> {
  const empty = { matched: false, sent: false, failed: false, duplicate: false, eventsCreated: 0 };

  const account = await findAccountByInstagramId(comment.instagramAccountId);
  if (!account) {
    console.log("[webhook] no connected account for instagram id:", {
      eventType: comment.eventField ?? "comments",
      accountId: comment.instagramAccountId,
      commentId: comment.commentId,
      mediaId: comment.mediaId ?? null,
      matched: false,
      sendResult: "skipped_unknown_account",
    });
    return empty;
  }

  // Claim before keyword matching / private reply so concurrent and replayed
  // deliveries of the same Instagram comment ID cannot double-send.
  const claim = await claimCommentForSend({
    userId: account.userId,
    instagramAccountId: account.id,
    commentId: comment.commentId,
    mediaId: comment.mediaId,
  });

  if (!claim) {
    console.log("duplicate event ignored", {
      eventType: comment.eventField ?? "comments",
      accountId: comment.instagramAccountId,
      commentId: comment.commentId,
      mediaId: comment.mediaId ?? null,
      sendResult: "duplicate_event_ignored",
    });
    return { matched: false, sent: false, failed: false, duplicate: true, eventsCreated: 0 };
  }

  const rules = await prisma.keywordRule.findMany({
    where: { userId: account.userId, isActive: true },
  });

  const matchedRule = selectMatchingKeywordRule(rules, comment.text, comment.mediaId);
  if (!matchedRule) {
    await prisma.dmEvent.update({
      where: { id: claim.dmEventId },
      data: { status: DmEventStatus.skipped, errorSummary: null },
    });

    console.log("[webhook] comment received, no keyword match:", {
      eventType: comment.eventField ?? "comments",
      accountId: comment.instagramAccountId,
      commentId: comment.commentId,
      mediaId: comment.mediaId ?? null,
      matched: false,
      sendResult: "skipped_no_match",
      activeRuleCount: rules.length,
    });
    return empty;
  }

  await prisma.dmEvent.update({
    where: { id: claim.dmEventId },
    data: { ruleId: matchedRule.id },
  });

  const commenter = comment.commenterUsername ? `@${comment.commenterUsername}` : "A user";

  // Log match activity only for newly claimed attempts (not duplicate deliveries).
  // Retries of failed sends skip re-logging comment_received / keyword_matched.
  if (!claim.isRetry) {
    const matchMetadata = buildActivityMetadata({
      keyword: matchedRule.keyword,
      ruleId: matchedRule.id,
      comment,
      dmStatus: "pending_match",
    });

    await activityService.log(account.userId, {
      type: "comment_received",
      title: "Comment received",
      description: `${commenter} commented: "${truncateComment(comment.text)}"`,
      metadata: matchMetadata,
    });

    await activityService.log(account.userId, {
      type: "keyword_matched",
      title: `Keyword matched: ${matchedRule.keyword}`,
      description: `${commenter} triggered your "${matchedRule.keyword}" rule.`,
      metadata: matchMetadata,
    });
  }

  const priorEventsCreated = claim.isRetry ? 0 : 2;

  // Post-match / pre-send seam — STANDARD_DM via ResponseRouter (foundation).
  return responseRouter.dispatch({
    account: {
      id: account.id,
      userId: account.userId,
      instagramUserId: account.instagramUserId,
      accessTokenEncrypted: account.accessTokenEncrypted,
    },
    matchedRule: {
      id: matchedRule.id,
      keyword: matchedRule.keyword,
      dmMessage: matchedRule.dmMessage,
    },
    comment,
    claim,
    priorEventsCreated,
  });
}

export const instagramWebhookService = {
  parseInstagramCommentWebhook,
  commentMatchesKeyword,
  selectMatchingKeywordRule,
  claimCommentForSend,
  sanitizeErrorSummary,
  formatDmErrorSummary,
  resolveDmFailureStatus,
  dmFailureActivityTitle,

  async processWebhookPayload(body: unknown): Promise<WebhookProcessResult> {
    const payload = body as { object?: string; entry?: unknown[] };
    const comments = parseInstagramCommentWebhook(body);

    console.log("[webhook] processing payload:", {
      object: payload.object ?? "unknown",
      entryCount: Array.isArray(payload.entry) ? payload.entry.length : 0,
      commentCount: comments.length,
    });

    let matched = 0;
    let skipped = 0;
    let sent = 0;
    let failed = 0;
    let duplicates = 0;
    let eventsCreated = 0;

    for (const comment of comments) {
      const result = await matchAndProcessComment(comment);
      if (result.matched) matched++;
      else skipped++;
      if (result.sent) sent++;
      if (result.failed) failed++;
      if (result.duplicate) duplicates++;
      eventsCreated += result.eventsCreated;
    }

    return {
      processed: comments.length,
      matched,
      skipped,
      sent,
      failed,
      duplicates,
      eventsCreated,
    };
  },
};
