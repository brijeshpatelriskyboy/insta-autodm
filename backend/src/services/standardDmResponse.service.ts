import { DmEventStatus } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { AppError, getMetaErrorDetails } from "../utils/errors";
import { decryptToken } from "../utils/tokenCrypto";
import { activityService } from "./activity.service";
import { metaGraphService } from "./metaGraph.service";

/** Max private-reply send attempts per (instagramAccountId, commentId), including the first try. */
export const MAX_DM_ATTEMPTS = 3;

const ERROR_SUMMARY_MAX = 240;

export type DmFailureStatus = "retry_available" | "action_required";

export function resolveDmFailureStatus(attemptCount: number): DmFailureStatus {
  return attemptCount >= MAX_DM_ATTEMPTS ? "action_required" : "retry_available";
}

export function dmFailureActivityTitle(failureStatus: DmFailureStatus): string {
  return failureStatus === "retry_available"
    ? "Failed — retry available"
    : "Failed — action required";
}

/** Sanitize and length-limit error text for DB/logs — never store tokens or raw payloads. */
export function sanitizeErrorSummary(input: unknown): string {
  let text =
    input instanceof Error
      ? input.message
      : typeof input === "string"
        ? input
        : String(input ?? "Unknown error");

  text = text
    .replace(/Bearer\s+[A-Za-z0-9._\-]+/gi, "Bearer [REDACTED]")
    .replace(/access_token=[^&\s]+/gi, "access_token=[REDACTED]")
    .replace(/client_secret=[^&\s]+/gi, "client_secret=[REDACTED]")
    .replace(/IGQ[A-Za-z0-9]+/g, "[REDACTED_TOKEN]")
    .replace(/\s+/g, " ")
    .trim();

  if (text.length > ERROR_SUMMARY_MAX) {
    return `${text.slice(0, ERROR_SUMMARY_MAX - 1)}…`;
  }
  return text || "Unknown error";
}

/**
 * Build a sanitized, length-capped errorSummary that preserves Meta code when present.
 * Never includes tokens.
 */
export function formatDmErrorSummary(params: {
  metaCode?: number | null;
  metaMessage?: string | null;
  fallback?: unknown;
}): string {
  const rawMessage =
    params.metaMessage?.trim() ||
    (params.fallback !== undefined ? sanitizeErrorSummary(params.fallback) : "Unknown error");
  const sanitizedMessage = sanitizeErrorSummary(rawMessage);
  if (typeof params.metaCode === "number") {
    return sanitizeErrorSummary(`[${params.metaCode}] ${sanitizedMessage}`);
  }
  return sanitizedMessage;
}

export function truncateComment(text: string, max = 80): string {
  const trimmed = text.trim();
  return trimmed.length > max ? `${trimmed.slice(0, max)}…` : trimmed;
}

/** Comment fields required for STANDARD_DM (structurally compatible with ParsedComment). */
export type StandardDmComment = {
  instagramAccountId: string;
  commentId: string;
  text: string;
  commenterUsername?: string;
  commenterId?: string;
  mediaId?: string;
  eventField?: string;
};

export type StandardDmAccount = {
  id: string;
  userId: string;
  instagramUserId: string;
  accessTokenEncrypted: string | null;
};

export type StandardDmMatchedRule = {
  id: string;
  keyword: string;
  dmMessage: string;
};

export type StandardDmClaim = {
  dmEventId: string;
  attemptCount: number;
  isRetry: boolean;
};

export type StandardDmResponseResult = {
  matched: true;
  sent: boolean;
  failed: boolean;
  duplicate: false;
  eventsCreated: number;
};

export function buildActivityMetadata(params: {
  keyword: string;
  ruleId: string;
  comment: StandardDmComment;
  dmStatus: "sent" | "failed" | "pending_match";
  messageId?: string | null;
  errorSummary?: string | null;
  attemptCount?: number;
  metaErrorCode?: number | null;
  metaErrorMessage?: string | null;
  failureStatus?: DmFailureStatus | null;
}) {
  return {
    keyword: params.keyword,
    ruleId: params.ruleId,
    commentId: params.comment.commentId,
    commentText: truncateComment(params.comment.text, 200),
    commenterUsername: params.comment.commenterUsername ?? null,
    commenterId: params.comment.commenterId ?? null,
    mediaId: params.comment.mediaId ?? null,
    instagramAccountId: params.comment.instagramAccountId,
    dmStatus: params.dmStatus,
    messageId: params.messageId ?? null,
    errorSummary: params.errorSummary ?? null,
    attemptCount: params.attemptCount ?? null,
    metaErrorCode: params.metaErrorCode ?? null,
    metaErrorMessage: params.metaErrorMessage ?? null,
    failureStatus: params.failureStatus ?? null,
    timestamp: new Date().toISOString(),
  };
}

function buildDmFailedActivity(params: {
  commenter: string;
  keyword: string;
  ruleId: string;
  comment: StandardDmComment;
  attemptCount: number;
  metaErrorCode: number | null;
  metaErrorMessage: string | null;
  errorSummary: string;
  reasonPrefix?: string;
}) {
  const failureStatus = resolveDmFailureStatus(params.attemptCount);
  const title = dmFailureActivityTitle(failureStatus);
  const detail =
    typeof params.metaErrorCode === "number"
      ? `(${params.metaErrorCode}): ${params.metaErrorMessage ?? params.errorSummary}`
      : params.metaErrorMessage || params.errorSummary;
  const prefix = params.reasonPrefix ?? "Private reply";
  const description = sanitizeErrorSummary(
    `${prefix} to ${params.commenter} failed ${detail}`.replace(/\s+/g, " ").trim(),
  );

  return {
    type: "dm_failed" as const,
    title,
    description,
    metadata: buildActivityMetadata({
      keyword: params.keyword,
      ruleId: params.ruleId,
      comment: params.comment,
      dmStatus: "failed",
      errorSummary: params.errorSummary,
      attemptCount: params.attemptCount,
      metaErrorCode: params.metaErrorCode,
      metaErrorMessage: params.metaErrorMessage,
      failureStatus,
    }),
  };
}

export type StandardDmExecuteParams = {
  account: StandardDmAccount;
  matchedRule: StandardDmMatchedRule;
  comment: StandardDmComment;
  claim: StandardDmClaim;
  /** Activity events already logged for this attempt (comment_received / keyword_matched). */
  priorEventsCreated: number;
};

/**
 * V1 STANDARD_DM path — extraction only.
 * Preserves decrypt → private reply → DmEvent → Activity behaviour.
 * recipientId from Meta is intentionally ignored (V1 parity).
 */
export const standardDmResponseService = {
  async execute(params: StandardDmExecuteParams): Promise<StandardDmResponseResult> {
    const { account, matchedRule, comment, claim, priorEventsCreated } = params;
    const commenter = comment.commenterUsername ? `@${comment.commenterUsername}` : "A user";
    let eventsCreated = priorEventsCreated;

    let accessToken: string;
    try {
      if (
        !account.accessTokenEncrypted ||
        account.accessTokenEncrypted === "mock_encrypted_token_placeholder"
      ) {
        throw new Error("Connected account has no usable Instagram access token");
      }
      accessToken = decryptToken(account.accessTokenEncrypted);
    } catch (error) {
      const metaErrorCode = null;
      const metaErrorMessage = sanitizeErrorSummary(error);
      const errorSummary = formatDmErrorSummary({
        metaCode: metaErrorCode,
        metaMessage: metaErrorMessage,
        fallback: error,
      });
      await prisma.dmEvent.update({
        where: { id: claim.dmEventId },
        data: {
          status: DmEventStatus.failed,
          errorSummary,
          metaErrorCode,
          metaErrorMessage,
        },
      });

      const failedActivity = buildDmFailedActivity({
        commenter,
        keyword: matchedRule.keyword,
        ruleId: matchedRule.id,
        comment,
        attemptCount: claim.attemptCount,
        metaErrorCode,
        metaErrorMessage,
        errorSummary,
        reasonPrefix: "Private reply",
      });

      await activityService.log(account.userId, {
        type: failedActivity.type,
        title: failedActivity.title,
        description: failedActivity.description,
        metadata: failedActivity.metadata,
      });

      console.error("[webhook] token decrypt failed:", {
        eventType: comment.eventField ?? "comments",
        accountId: comment.instagramAccountId,
        commentId: comment.commentId,
        mediaId: comment.mediaId ?? null,
        matched: true,
        sendResult: "failed_decrypt",
        errorSummary,
        failureStatus: resolveDmFailureStatus(claim.attemptCount),
      });

      return {
        matched: true,
        sent: false,
        failed: true,
        duplicate: false,
        eventsCreated: eventsCreated + 1,
      };
    }

    try {
      /**
       * Private reply (not unrestricted outbound DM).
       * Meta eligibility windows still apply (≈7 days for feed/reel comments;
       * live comments only during broadcast). One private reply per comment context.
       */
      const result = await metaGraphService.sendPrivateReplyToComment({
        igUserId: account.instagramUserId,
        accessToken,
        commentId: comment.commentId,
        messageText: matchedRule.dmMessage,
      });

      // V1 parity: persist messageId only; ignore recipientId.
      await prisma.dmEvent.update({
        where: { id: claim.dmEventId },
        data: {
          status: DmEventStatus.sent,
          messageId: result.messageId,
          errorSummary: null,
          metaErrorCode: null,
          metaErrorMessage: null,
        },
      });

      await activityService.log(account.userId, {
        type: "dm_sent",
        title: "DM sent",
        description: `Private reply sent to ${commenter} for keyword "${matchedRule.keyword}".`,
        metadata: buildActivityMetadata({
          keyword: matchedRule.keyword,
          ruleId: matchedRule.id,
          comment,
          dmStatus: "sent",
          messageId: result.messageId,
          attemptCount: claim.attemptCount,
        }),
      });

      console.log("[webhook] private reply sent:", {
        eventType: comment.eventField ?? "comments",
        accountId: comment.instagramAccountId,
        commentId: comment.commentId,
        mediaId: comment.mediaId ?? null,
        matched: true,
        sendResult: "sent",
        attemptCount: claim.attemptCount,
        isRetry: claim.isRetry,
      });

      return {
        matched: true,
        sent: true,
        failed: false,
        duplicate: false,
        eventsCreated: eventsCreated + 1,
      };
    } catch (error) {
      const details = getMetaErrorDetails(error);
      const metaErrorCode = details.metaCode;
      const metaErrorMessage = details.metaMessage
        ? sanitizeErrorSummary(details.metaMessage)
        : sanitizeErrorSummary(error instanceof AppError ? error.message : error);
      const errorSummary = formatDmErrorSummary({
        metaCode: metaErrorCode,
        metaMessage: metaErrorMessage,
        fallback: error instanceof AppError ? error.message : error,
      });

      await prisma.dmEvent.update({
        where: { id: claim.dmEventId },
        data: {
          status: DmEventStatus.failed,
          errorSummary,
          metaErrorCode,
          metaErrorMessage,
        },
      });

      const failedActivity = buildDmFailedActivity({
        commenter,
        keyword: matchedRule.keyword,
        ruleId: matchedRule.id,
        comment,
        attemptCount: claim.attemptCount,
        metaErrorCode,
        metaErrorMessage,
        errorSummary,
      });

      await activityService.log(account.userId, {
        type: failedActivity.type,
        title: failedActivity.title,
        description: failedActivity.description,
        metadata: failedActivity.metadata,
      });

      console.error("[webhook] private reply failed:", {
        eventType: comment.eventField ?? "comments",
        accountId: comment.instagramAccountId,
        commentId: comment.commentId,
        mediaId: comment.mediaId ?? null,
        matched: true,
        sendResult: "failed",
        errorSummary,
        metaErrorCode,
        attemptCount: claim.attemptCount,
        failureStatus: resolveDmFailureStatus(claim.attemptCount),
      });

      return {
        matched: true,
        sent: false,
        failed: true,
        duplicate: false,
        eventsCreated: eventsCreated + 1,
      };
    }
  },
};
