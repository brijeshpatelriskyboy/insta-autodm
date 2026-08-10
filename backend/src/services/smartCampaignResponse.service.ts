/**
 * Isolated V2 Smart Campaign response lifecycle.
 * Allocator → message → private reply → claim/code/DmEvent/Activity updates.
 *
 * NOT wired to ResponseRouter or InstagramWebhook in this milestone.
 */

import type { Campaign, CampaignClaim, CampaignCode, PrismaClient } from "@prisma/client";
import { DmEventStatus } from "@prisma/client";
import { prisma as defaultPrisma } from "../lib/prisma";
import { AppError, getMetaErrorDetails } from "../utils/errors";
import { decryptToken } from "../utils/tokenCrypto";
import { activityService } from "./activity.service";
import {
  CampaignClaimAllocator,
  campaignClaimAllocator as defaultAllocator,
  type AllocateClaimResult,
  type AllocatedClaimBundle,
} from "./campaignClaimAllocator";
import {
  DEFAULT_CAMPAIGN_MESSAGES,
  renderCampaignMessage,
} from "./campaignMessageRenderer";
import { metaGraphService } from "./metaGraph.service";
import {
  buildActivityMetadata,
  dmFailureActivityTitle,
  formatDmErrorSummary,
  MAX_DM_ATTEMPTS,
  resolveDmFailureStatus,
  sanitizeErrorSummary,
  type StandardDmAccount,
  type StandardDmClaim,
  type StandardDmComment,
  type StandardDmMatchedRule,
  type StandardDmResponseResult,
} from "./standardDmResponse.service";

export type CampaignOutcome =
  | AllocateClaimResult["outcome"]
  | "RENDER_FAILED"
  | "SEND_SKIPPED_INACTIVE";

export type SmartCampaignResponseResult = StandardDmResponseResult & {
  campaignOutcome: CampaignOutcome;
};

export type SmartCampaignExecuteParams = {
  account: StandardDmAccount;
  matchedRule: Pick<StandardDmMatchedRule, "id" | "keyword">;
  campaign: Campaign;
  comment: StandardDmComment;
  dmClaim: StandardDmClaim;
  /** Activity events already logged for this attempt. */
  priorEventsCreated?: number;
  now?: Date;
};

export type SmartCampaignResponseDeps = {
  db?: PrismaClient;
  allocator?: CampaignClaimAllocator;
  sendPrivateReply?: typeof metaGraphService.sendPrivateReplyToComment;
  decrypt?: typeof decryptToken;
  logActivity?: typeof activityService.log;
};

type PreparedMessage = {
  text: string;
  /** Present when this send is tied to a claim/code (allocated / duplicate / already-claimed). */
  bundle: AllocatedClaimBundle | null;
  /**
   * When true, success should mark claim SENT and code CLAIMED.
   * False for reminder / informational outcomes (already claimed, sold out, etc.).
   */
  finalizeClaimOnSuccess: boolean;
  campaignOutcome: AllocateClaimResult["outcome"];
};

function buildCampaignActivityMetadata(params: {
  keyword: string;
  ruleId: string;
  comment: StandardDmComment;
  campaign: Campaign;
  campaignOutcome: CampaignOutcome;
  dmStatus: "sent" | "failed" | "pending_match";
  claim?: CampaignClaim | null;
  code?: CampaignCode | null;
  messageId?: string | null;
  errorSummary?: string | null;
  attemptCount?: number;
  metaErrorCode?: number | null;
  metaErrorMessage?: string | null;
  failureStatus?: ReturnType<typeof resolveDmFailureStatus> | null;
}) {
  const base = buildActivityMetadata({
    keyword: params.keyword,
    ruleId: params.ruleId,
    comment: params.comment,
    dmStatus: params.dmStatus,
    messageId: params.messageId,
    errorSummary: params.errorSummary,
    attemptCount: params.attemptCount,
    metaErrorCode: params.metaErrorCode,
    metaErrorMessage: params.metaErrorMessage,
    failureStatus: params.failureStatus,
  });

  // Raw unique codes stay in CampaignClaim/CampaignCode tables — never Activity metadata.
  return {
    ...base,
    campaignId: params.campaign.id,
    campaignName: params.campaign.name,
    campaignClaimId: params.claim?.id ?? null,
    campaignOutcome: params.campaignOutcome,
    codeStatus: params.code?.status ?? null,
  };
}

function claimDeliveryOnFailure(attemptCount: number): "FAILED" | "EXHAUSTED" {
  return attemptCount >= MAX_DM_ATTEMPTS ? "EXHAUSTED" : "FAILED";
}

export class SmartCampaignResponseService {
  private readonly db: PrismaClient;
  private readonly allocator: CampaignClaimAllocator;
  private readonly sendPrivateReply: typeof metaGraphService.sendPrivateReplyToComment;
  private readonly decrypt: typeof decryptToken;
  private readonly logActivity: typeof activityService.log;

  constructor(deps: SmartCampaignResponseDeps = {}) {
    this.db = deps.db ?? defaultPrisma;
    this.allocator = deps.allocator ?? defaultAllocator;
    this.sendPrivateReply =
      deps.sendPrivateReply ??
      ((args) => metaGraphService.sendPrivateReplyToComment(args));
    this.decrypt = deps.decrypt ?? decryptToken;
    this.logActivity = deps.logActivity ?? ((userId, data) => activityService.log(userId, data));
  }

  async execute(params: SmartCampaignExecuteParams): Promise<SmartCampaignResponseResult> {
    const { account, matchedRule, campaign, comment, dmClaim } = params;
    const priorEventsCreated = params.priorEventsCreated ?? 0;
    const commenter = comment.commenterUsername
      ? `@${comment.commenterUsername}`
      : "A user";

    const allocation = await this.allocator.allocate({
      campaignId: campaign.id,
      sourceCommentId: comment.commentId,
      instagramCommenterId: comment.commenterId ?? null,
      instagramUsername: comment.commenterUsername ?? null,
      dmEventId: dmClaim.dmEventId,
      now: params.now,
    });

    const prepared = this.prepareMessage(campaign, allocation);
    if (!prepared.ok) {
      return this.handleRenderOrInactiveFailure({
        account,
        matchedRule,
        campaign,
        comment,
        dmClaim,
        commenter,
        priorEventsCreated,
        campaignOutcome: prepared.campaignOutcome,
        bundle: prepared.bundle,
        skipSend: prepared.skipSend,
        errorSummary: prepared.errorSummary,
      });
    }

    let accessToken: string;
    try {
      if (
        !account.accessTokenEncrypted ||
        account.accessTokenEncrypted === "mock_encrypted_token_placeholder"
      ) {
        throw new Error("Connected account has no usable Instagram access token");
      }
      accessToken = this.decrypt(account.accessTokenEncrypted);
    } catch (error) {
      return this.handleSendFailure({
        account,
        matchedRule,
        campaign,
        comment,
        dmClaim,
        commenter,
        priorEventsCreated,
        campaignOutcome: prepared.value.campaignOutcome,
        bundle: prepared.value.bundle,
        finalizeClaimOnSuccess: prepared.value.finalizeClaimOnSuccess,
        error,
        reasonPrefix: "Campaign private reply",
      });
    }

    try {
      const result = await this.sendPrivateReply({
        igUserId: account.instagramUserId,
        accessToken,
        commentId: comment.commentId,
        messageText: prepared.value.text,
      });

      await this.db.dmEvent.update({
        where: { id: dmClaim.dmEventId },
        data: {
          status: DmEventStatus.sent,
          messageId: result.messageId,
          errorSummary: null,
          metaErrorCode: null,
          metaErrorMessage: null,
        },
      });

      if (prepared.value.finalizeClaimOnSuccess && prepared.value.bundle) {
        const now = params.now ?? new Date();
        await this.db.campaignClaim.update({
          where: { id: prepared.value.bundle.claim.id },
          data: { deliveryStatus: "SENT" },
        });
        await this.db.campaignCode.update({
          where: { id: prepared.value.bundle.code.id },
          data: {
            status: "CLAIMED",
            claimedAt: prepared.value.bundle.code.claimedAt ?? now,
          },
        });
      }

      const codeAfter =
        prepared.value.finalizeClaimOnSuccess && prepared.value.bundle
          ? { ...prepared.value.bundle.code, status: "CLAIMED" as const }
          : prepared.value.bundle?.code ?? null;

      await this.logActivity(account.userId, {
        type: "dm_sent",
        title: "Campaign DM sent",
        description: `Campaign private reply sent to ${commenter} for keyword "${matchedRule.keyword}".`,
        metadata: buildCampaignActivityMetadata({
          keyword: matchedRule.keyword,
          ruleId: matchedRule.id,
          comment,
          campaign,
          campaignOutcome: prepared.value.campaignOutcome,
          dmStatus: "sent",
          claim: prepared.value.bundle?.claim ?? null,
          code: codeAfter,
          messageId: result.messageId,
          attemptCount: dmClaim.attemptCount,
        }),
      });

      return {
        matched: true,
        sent: true,
        failed: false,
        duplicate: false,
        eventsCreated: priorEventsCreated + 1,
        campaignOutcome: prepared.value.campaignOutcome,
      };
    } catch (error) {
      return this.handleSendFailure({
        account,
        matchedRule,
        campaign,
        comment,
        dmClaim,
        commenter,
        priorEventsCreated,
        campaignOutcome: prepared.value.campaignOutcome,
        bundle: prepared.value.bundle,
        finalizeClaimOnSuccess: prepared.value.finalizeClaimOnSuccess,
        error,
        reasonPrefix: "Campaign private reply",
      });
    }
  }

  private prepareMessage(
    campaign: Campaign,
    allocation: AllocateClaimResult,
  ):
    | { ok: true; value: PreparedMessage }
    | {
        ok: false;
        campaignOutcome: CampaignOutcome;
        bundle: AllocatedClaimBundle | null;
        skipSend: boolean;
        errorSummary: string;
      } {
    switch (allocation.outcome) {
      case "ALLOCATED":
      case "DUPLICATE_COMMENT": {
        const rendered = renderCampaignMessage(
          campaign.dmTemplate,
          { code: allocation.code.code },
          { requireCode: true },
        );
        if (!rendered.ok) {
          return {
            ok: false,
            campaignOutcome: "RENDER_FAILED",
            bundle: { claim: allocation.claim, code: allocation.code },
            skipSend: false,
            errorSummary: `Campaign message render failed: ${rendered.reason}`,
          };
        }
        return {
          ok: true,
          value: {
            text: rendered.message,
            bundle: { claim: allocation.claim, code: allocation.code },
            finalizeClaimOnSuccess: true,
            campaignOutcome: allocation.outcome,
          },
        };
      }
      case "ALREADY_CLAIMED": {
        const rendered = renderCampaignMessage(campaign.alreadyClaimedMessage, {
          code: allocation.code.code,
        });
        if (!rendered.ok) {
          return {
            ok: false,
            campaignOutcome: "RENDER_FAILED",
            bundle: { claim: allocation.claim, code: allocation.code },
            skipSend: false,
            errorSummary: `Already-claimed message render failed: ${rendered.reason}`,
          };
        }
        return {
          ok: true,
          value: {
            text: rendered.message,
            bundle: { claim: allocation.claim, code: allocation.code },
            // Reminder on a different comment — do not mutate original claim/code lifecycle.
            finalizeClaimOnSuccess: false,
            campaignOutcome: "ALREADY_CLAIMED",
          },
        };
      }
      case "SOLD_OUT": {
        const rendered = renderCampaignMessage(campaign.soldOutMessage, {});
        if (!rendered.ok) {
          return {
            ok: false,
            campaignOutcome: "RENDER_FAILED",
            bundle: null,
            skipSend: false,
            errorSummary: `Sold-out message render failed: ${rendered.reason}`,
          };
        }
        return {
          ok: true,
          value: {
            text: rendered.message,
            bundle: null,
            finalizeClaimOnSuccess: false,
            campaignOutcome: "SOLD_OUT",
          },
        };
      }
      case "NOT_STARTED": {
        const template =
          campaign.notStartedMessage?.trim() || DEFAULT_CAMPAIGN_MESSAGES.notStarted;
        const rendered = renderCampaignMessage(template, {});
        if (!rendered.ok) {
          return {
            ok: false,
            campaignOutcome: "RENDER_FAILED",
            bundle: null,
            skipSend: false,
            errorSummary: `Not-started message render failed: ${rendered.reason}`,
          };
        }
        return {
          ok: true,
          value: {
            text: rendered.message,
            bundle: null,
            finalizeClaimOnSuccess: false,
            campaignOutcome: "NOT_STARTED",
          },
        };
      }
      case "ENDED": {
        const template = campaign.endedMessage?.trim() || DEFAULT_CAMPAIGN_MESSAGES.ended;
        const rendered = renderCampaignMessage(template, {});
        if (!rendered.ok) {
          return {
            ok: false,
            campaignOutcome: "RENDER_FAILED",
            bundle: null,
            skipSend: false,
            errorSummary: `Ended message render failed: ${rendered.reason}`,
          };
        }
        return {
          ok: true,
          value: {
            text: rendered.message,
            bundle: null,
            finalizeClaimOnSuccess: false,
            campaignOutcome: "ENDED",
          },
        };
      }
      case "PAUSED": {
        const rendered = renderCampaignMessage(DEFAULT_CAMPAIGN_MESSAGES.paused, {});
        if (!rendered.ok) {
          return {
            ok: false,
            campaignOutcome: "RENDER_FAILED",
            bundle: null,
            skipSend: false,
            errorSummary: "Paused message render failed",
          };
        }
        return {
          ok: true,
          value: {
            text: rendered.message,
            bundle: null,
            finalizeClaimOnSuccess: false,
            campaignOutcome: "PAUSED",
          },
        };
      }
      case "MISSING_IDENTITY": {
        const rendered = renderCampaignMessage(
          DEFAULT_CAMPAIGN_MESSAGES.missingIdentity,
          {},
        );
        if (!rendered.ok) {
          return {
            ok: false,
            campaignOutcome: "RENDER_FAILED",
            bundle: null,
            skipSend: false,
            errorSummary: "Missing-identity message render failed",
          };
        }
        return {
          ok: true,
          value: {
            text: rendered.message,
            bundle: null,
            finalizeClaimOnSuccess: false,
            campaignOutcome: "MISSING_IDENTITY",
          },
        };
      }
      case "INACTIVE":
        return {
          ok: false,
          campaignOutcome: "SEND_SKIPPED_INACTIVE",
          bundle: null,
          skipSend: true,
          errorSummary: "Campaign is inactive",
        };
      default: {
        const _exhaustive: never = allocation;
        void _exhaustive;
        return {
          ok: false,
          campaignOutcome: "INACTIVE",
          bundle: null,
          skipSend: true,
          errorSummary: "Unhandled campaign allocation outcome",
        };
      }
    }
  }

  private async handleRenderOrInactiveFailure(params: {
    account: StandardDmAccount;
    matchedRule: Pick<StandardDmMatchedRule, "id" | "keyword">;
    campaign: Campaign;
    comment: StandardDmComment;
    dmClaim: StandardDmClaim;
    commenter: string;
    priorEventsCreated: number;
    campaignOutcome: CampaignOutcome;
    bundle: AllocatedClaimBundle | null;
    skipSend: boolean;
    errorSummary: string;
  }): Promise<SmartCampaignResponseResult> {
    const errorSummary = sanitizeErrorSummary(params.errorSummary);

    if (params.skipSend) {
      await this.db.dmEvent.update({
        where: { id: params.dmClaim.dmEventId },
        data: {
          status: DmEventStatus.skipped,
          errorSummary,
        },
      });

      await this.logActivity(params.account.userId, {
        type: "dm_failed",
        title: "Campaign inactive",
        description: sanitizeErrorSummary(
          `Campaign response skipped for ${params.commenter}: inactive campaign.`,
        ),
        metadata: buildCampaignActivityMetadata({
          keyword: params.matchedRule.keyword,
          ruleId: params.matchedRule.id,
          comment: params.comment,
          campaign: params.campaign,
          campaignOutcome: params.campaignOutcome,
          dmStatus: "failed",
          claim: params.bundle?.claim ?? null,
          code: params.bundle?.code ?? null,
          errorSummary,
          attemptCount: params.dmClaim.attemptCount,
          failureStatus: "action_required",
        }),
      });

      return {
        matched: true,
        sent: false,
        failed: false,
        duplicate: false,
        eventsCreated: params.priorEventsCreated + 1,
        campaignOutcome: params.campaignOutcome,
      };
    }

    // Render failure after allocation: keep code RESERVED; mark claim failed/exhausted.
    if (params.bundle) {
      await this.db.campaignClaim.update({
        where: { id: params.bundle.claim.id },
        data: {
          deliveryStatus: claimDeliveryOnFailure(params.dmClaim.attemptCount),
        },
      });
    }

    await this.db.dmEvent.update({
      where: { id: params.dmClaim.dmEventId },
      data: {
        status: DmEventStatus.failed,
        errorSummary,
        metaErrorCode: null,
        metaErrorMessage: errorSummary,
      },
    });

    const failureStatus = resolveDmFailureStatus(params.dmClaim.attemptCount);
    await this.logActivity(params.account.userId, {
      type: "dm_failed",
      title: dmFailureActivityTitle(failureStatus),
      description: sanitizeErrorSummary(
        `Campaign private reply to ${params.commenter} failed ${errorSummary}`,
      ),
      metadata: buildCampaignActivityMetadata({
        keyword: params.matchedRule.keyword,
        ruleId: params.matchedRule.id,
        comment: params.comment,
        campaign: params.campaign,
        campaignOutcome: params.campaignOutcome,
        dmStatus: "failed",
        claim: params.bundle?.claim ?? null,
        code: params.bundle?.code ?? null,
        errorSummary,
        attemptCount: params.dmClaim.attemptCount,
        failureStatus,
      }),
    });

    return {
      matched: true,
      sent: false,
      failed: true,
      duplicate: false,
      eventsCreated: params.priorEventsCreated + 1,
      campaignOutcome: params.campaignOutcome,
    };
  }

  private async handleSendFailure(params: {
    account: StandardDmAccount;
    matchedRule: Pick<StandardDmMatchedRule, "id" | "keyword">;
    campaign: Campaign;
    comment: StandardDmComment;
    dmClaim: StandardDmClaim;
    commenter: string;
    priorEventsCreated: number;
    campaignOutcome: AllocateClaimResult["outcome"];
    bundle: AllocatedClaimBundle | null;
    finalizeClaimOnSuccess: boolean;
    error: unknown;
    reasonPrefix: string;
  }): Promise<SmartCampaignResponseResult> {
    const details = getMetaErrorDetails(params.error);
    const metaErrorCode = details.metaCode;
    const metaErrorMessage = details.metaMessage
      ? sanitizeErrorSummary(details.metaMessage)
      : sanitizeErrorSummary(
          params.error instanceof AppError ? params.error.message : params.error,
        );
    const errorSummary = formatDmErrorSummary({
      metaCode: metaErrorCode,
      metaMessage: metaErrorMessage,
      fallback: params.error instanceof AppError ? params.error.message : params.error,
    });

    // Critical: never RESERVED → AVAILABLE on DM failure.
    if (params.finalizeClaimOnSuccess && params.bundle) {
      await this.db.campaignClaim.update({
        where: { id: params.bundle.claim.id },
        data: {
          deliveryStatus: claimDeliveryOnFailure(params.dmClaim.attemptCount),
        },
      });
      // Code remains RESERVED intentionally.
    }

    await this.db.dmEvent.update({
      where: { id: params.dmClaim.dmEventId },
      data: {
        status: DmEventStatus.failed,
        errorSummary,
        metaErrorCode,
        metaErrorMessage,
      },
    });

    const failureStatus = resolveDmFailureStatus(params.dmClaim.attemptCount);
    await this.logActivity(params.account.userId, {
      type: "dm_failed",
      title: dmFailureActivityTitle(failureStatus),
      description: sanitizeErrorSummary(
        `${params.reasonPrefix} to ${params.commenter} failed ${
          typeof metaErrorCode === "number"
            ? `(${metaErrorCode}): ${metaErrorMessage}`
            : metaErrorMessage || errorSummary
        }`.replace(/\s+/g, " ").trim(),
      ),
      metadata: buildCampaignActivityMetadata({
        keyword: params.matchedRule.keyword,
        ruleId: params.matchedRule.id,
        comment: params.comment,
        campaign: params.campaign,
        campaignOutcome: params.campaignOutcome,
        dmStatus: "failed",
        claim: params.bundle?.claim ?? null,
        code: params.bundle?.code ?? null,
        errorSummary,
        attemptCount: params.dmClaim.attemptCount,
        metaErrorCode,
        metaErrorMessage,
        failureStatus,
      }),
    });

    return {
      matched: true,
      sent: false,
      failed: true,
      duplicate: false,
      eventsCreated: params.priorEventsCreated + 1,
      campaignOutcome: params.campaignOutcome,
    };
  }
}

export const smartCampaignResponseService = new SmartCampaignResponseService();
