/**
 * Isolated V2 atomic claim engine.
 * Assigns exactly one CampaignCode to a qualifying commenter/comment.
 * Does NOT send DMs or touch ResponseRouter / webhook.
 */

import type {
  Campaign,
  CampaignClaim,
  CampaignCode,
  PrismaClient,
} from "@prisma/client";
import { Prisma } from "@prisma/client";
import { prisma as defaultPrisma } from "../lib/prisma";

export type AllocateClaimInput = {
  campaignId: string;
  sourceCommentId: string;
  /** Webhook from.id — required for scarce-code campaigns. */
  instagramCommenterId: string | null;
  instagramUsername?: string | null;
  dmEventId?: string | null;
  now?: Date;
};

export type AllocatedClaimBundle = {
  claim: CampaignClaim;
  code: CampaignCode;
};

export type AllocateClaimResult =
  | ({ outcome: "ALLOCATED" } & AllocatedClaimBundle)
  | ({ outcome: "ALREADY_CLAIMED" } & AllocatedClaimBundle)
  | ({ outcome: "DUPLICATE_COMMENT" } & AllocatedClaimBundle)
  | { outcome: "SOLD_OUT" }
  | { outcome: "NOT_STARTED" }
  | { outcome: "ENDED" }
  | { outcome: "PAUSED" }
  | { outcome: "INACTIVE" }
  | { outcome: "MISSING_IDENTITY" };

type TxClient = Prisma.TransactionClient;

const RETRYABLE_PRISMA_CODES = new Set(["P2034", "P2028"]);
const MAX_TX_ATTEMPTS = 5;

function isRetryableTxError(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return RETRYABLE_PRISMA_CODES.has(error.code);
  }
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    return (
      msg.includes("deadlock") ||
      msg.includes("could not serialize") ||
      msg.includes("serialization failure") ||
      msg.includes("40001") ||
      msg.includes("40p01")
    );
  }
  return false;
}

async function lockCampaignForUpdate(
  tx: TxClient,
  campaignId: string,
): Promise<Campaign | null> {
  const rows = await tx.$queryRaw<Campaign[]>`
    SELECT *
    FROM campaigns
    WHERE id = ${campaignId}
    FOR UPDATE
  `;
  return rows[0] ?? null;
}

async function getClaimWithCode(
  tx: TxClient,
  where: Prisma.CampaignClaimWhereInput,
): Promise<AllocatedClaimBundle | null> {
  const claim = await tx.campaignClaim.findFirst({
    where,
    include: { campaignCode: true },
  });
  if (!claim) return null;
  const { campaignCode, ...rest } = claim;
  return { claim: rest, code: campaignCode };
}

async function reserveAvailableCode(
  tx: TxClient,
  campaignId: string,
  now: Date,
): Promise<CampaignCode | null> {
  const rows = await tx.$queryRaw<CampaignCode[]>`
    UPDATE campaign_codes
    SET
      status = 'RESERVED'::"CampaignCodeStatus",
      "reservedAt" = ${now},
      "updatedAt" = ${now}
    WHERE id = (
      SELECT id
      FROM campaign_codes
      WHERE "campaignId" = ${campaignId}
        AND status = 'AVAILABLE'::"CampaignCodeStatus"
      ORDER BY id
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    )
    RETURNING *
  `;
  return rows[0] ?? null;
}

function evaluateCampaignWindow(
  campaign: Campaign,
  now: Date,
): Extract<
  AllocateClaimResult,
  { outcome: "INACTIVE" | "PAUSED" | "NOT_STARTED" | "ENDED" }
> | null {
  if (campaign.status === "PAUSED") {
    return { outcome: "PAUSED" };
  }
  if (campaign.status !== "ACTIVE") {
    return { outcome: "INACTIVE" };
  }
  if (now.getTime() < campaign.startsAt.getTime()) {
    return { outcome: "NOT_STARTED" };
  }
  if (now.getTime() >= campaign.endsAt.getTime()) {
    return { outcome: "ENDED" };
  }
  return null;
}

function mapUniqueConflictToOutcome(
  error: Prisma.PrismaClientKnownRequestError,
): "DUPLICATE_COMMENT" | "ALREADY_CLAIMED" | "CODE_CONFLICT" | "UNKNOWN" {
  const target = error.meta?.target;
  const fields = Array.isArray(target)
    ? target.map(String)
    : typeof target === "string"
      ? [target]
      : [];
  const joined = fields.join(",");
  if (
    joined.includes("sourceCommentId") ||
    joined.includes("campaignId_sourceCommentId")
  ) {
    return "DUPLICATE_COMMENT";
  }
  if (
    joined.includes("instagramCommenterId") ||
    joined.includes("campaign_claims_one_per_commenter")
  ) {
    return "ALREADY_CLAIMED";
  }
  if (joined.includes("campaignCodeId")) {
    return "CODE_CONFLICT";
  }
  return "UNKNOWN";
}

export class CampaignClaimAllocator {
  constructor(private readonly db: PrismaClient = defaultPrisma) {}

  async allocate(input: AllocateClaimInput): Promise<AllocateClaimResult> {
    if (!input.instagramCommenterId) {
      return { outcome: "MISSING_IDENTITY" };
    }

    const now = input.now ?? new Date();
    let attempt = 0;
    let lastError: unknown;

    while (attempt < MAX_TX_ATTEMPTS) {
      attempt += 1;
      try {
        return await this.allocateOnce(input, now);
      } catch (error) {
        lastError = error;
        if (attempt < MAX_TX_ATTEMPTS && isRetryableTxError(error)) {
          continue;
        }
        throw error;
      }
    }

    throw lastError instanceof Error
      ? lastError
      : new Error("Campaign claim allocation failed after retries");
  }

  private async allocateOnce(
    input: AllocateClaimInput,
    now: Date,
  ): Promise<AllocateClaimResult> {
    try {
      return await this.db.$transaction(
        async (tx) => this.allocateInTransaction(tx, input, now),
        {
          maxWait: 15_000,
          timeout: 30_000,
          isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
        },
      );
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        const kind = mapUniqueConflictToOutcome(error);
        if (kind === "DUPLICATE_COMMENT") {
          const existing = await getClaimWithCode(this.db, {
            campaignId: input.campaignId,
            sourceCommentId: input.sourceCommentId,
          });
          if (existing) {
            return { outcome: "DUPLICATE_COMMENT", ...existing };
          }
        }
        if (kind === "ALREADY_CLAIMED" && input.instagramCommenterId) {
          const existing = await getClaimWithCode(this.db, {
            campaignId: input.campaignId,
            instagramCommenterId: input.instagramCommenterId,
          });
          if (existing) {
            return { outcome: "ALREADY_CLAIMED", ...existing };
          }
        }
      }
      throw error;
    }
  }

  private async allocateInTransaction(
    tx: TxClient,
    input: AllocateClaimInput,
    now: Date,
  ): Promise<AllocateClaimResult> {
    const campaign = await lockCampaignForUpdate(tx, input.campaignId);
    if (!campaign) {
      return { outcome: "INACTIVE" };
    }

    const windowResult = evaluateCampaignWindow(campaign, now);
    if (windowResult) {
      return windowResult;
    }

    const byComment = await getClaimWithCode(tx, {
      campaignId: input.campaignId,
      sourceCommentId: input.sourceCommentId,
    });
    if (byComment) {
      return { outcome: "DUPLICATE_COMMENT", ...byComment };
    }

    const byCommenter = await getClaimWithCode(tx, {
      campaignId: input.campaignId,
      instagramCommenterId: input.instagramCommenterId!,
    });
    if (byCommenter) {
      return { outcome: "ALREADY_CLAIMED", ...byCommenter };
    }

    if (campaign.claimedCount >= campaign.maxClaims) {
      return { outcome: "SOLD_OUT" };
    }

    const code = await reserveAvailableCode(tx, input.campaignId, now);
    if (!code) {
      if (campaign.claimedCount < campaign.maxClaims) {
        console.warn("[campaign-claim-allocator] SOLD_OUT with remaining claimedCount budget", {
          campaignId: input.campaignId,
          claimedCount: campaign.claimedCount,
          maxClaims: campaign.maxClaims,
        });
      }
      return { outcome: "SOLD_OUT" };
    }

    const claim = await tx.campaignClaim.create({
      data: {
        campaignId: input.campaignId,
        campaignCodeId: code.id,
        sourceCommentId: input.sourceCommentId,
        instagramCommenterId: input.instagramCommenterId,
        instagramUsername: input.instagramUsername ?? null,
        dmEventId: input.dmEventId ?? null,
        deliveryStatus: "PENDING",
        claimedAt: now,
      },
    });

    await tx.campaign.update({
      where: { id: input.campaignId },
      data: { claimedCount: { increment: 1 } },
    });

    return { outcome: "ALLOCATED", claim, code };
  }
}

export const campaignClaimAllocator = new CampaignClaimAllocator();
