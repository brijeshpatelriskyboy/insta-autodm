import type {
  Campaign,
  CampaignClaimDeliveryStatus,
  CampaignCodeStatus,
  CampaignStatus,
  KeywordRule,
  Prisma,
  PrismaClient,
} from "@prisma/client";
import { Prisma as PrismaNamespace } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { AppError } from "../utils/errors";
import {
  assertValidCodeGenerationConfig,
  generateUniqueCampaignCodes,
  inferAutoCodeFormatFromSample,
  MAX_CAMPAIGN_CLAIMS_CAP,
} from "./campaignCodeGenerator";
import { firstInvariantMessage } from "./campaignValidation";

export { MAX_CAMPAIGN_CLAIMS_CAP };

/** Conservative PATCH allow-list by status. */
export const CAMPAIGN_EDIT_MATRIX = {
  DRAFT: [
    "name",
    "startsAt",
    "endsAt",
    "dmTemplate",
    "soldOutMessage",
    "alreadyClaimedMessage",
    "notStartedMessage",
    "endedMessage",
    "maxClaims",
  ],
  PAUSED: [
    "name",
    "dmTemplate",
    "soldOutMessage",
    "alreadyClaimedMessage",
    "notStartedMessage",
    "endedMessage",
  ],
  ACTIVE: [
    "soldOutMessage",
    "alreadyClaimedMessage",
    "notStartedMessage",
    "endedMessage",
  ],
  ENDED: [] as string[],
  ARCHIVED: [] as string[],
} as const;

export type CampaignEditField =
  | "name"
  | "startsAt"
  | "endsAt"
  | "dmTemplate"
  | "soldOutMessage"
  | "alreadyClaimedMessage"
  | "notStartedMessage"
  | "endedMessage"
  | "maxClaims";

export type CreateCampaignInput = {
  keywordRuleId: string;
  name: string;
  startsAt: Date;
  endsAt: Date;
  maxClaims: number;
  dmTemplate: string;
  soldOutMessage: string;
  alreadyClaimedMessage: string;
  notStartedMessage?: string | null;
  endedMessage?: string | null;
  codeGeneration: {
    mode: "AUTO";
    prefix: string;
    length: number;
  };
};

export type PatchCampaignInput = Partial<{
  name: string;
  startsAt: Date;
  endsAt: Date;
  dmTemplate: string;
  soldOutMessage: string;
  alreadyClaimedMessage: string;
  notStartedMessage: string | null;
  endedMessage: string | null;
  maxClaims: number;
}>;

export type CampaignListItem = {
  id: string;
  name: string;
  status: CampaignStatus;
  keywordRule: { id: string; keyword: string };
  startsAt: Date;
  endsAt: Date;
  maxClaims: number;
  claimedCount: number;
  remainingCount: number;
  createdAt: Date;
  updatedAt: Date;
};

export type CampaignDetail = CampaignListItem & {
  dmTemplate: string;
  soldOutMessage: string;
  alreadyClaimedMessage: string;
  notStartedMessage: string | null;
  endedMessage: string | null;
  redemptionEnabled: boolean;
  archivedAt: Date | null;
  codeCounts: Record<CampaignCodeStatus, number>;
  claimCount: number;
};

export type CampaignClaimListItem = {
  id: string;
  instagramUsername: string | null;
  code: string;
  claimedAt: Date;
  deliveryStatus: CampaignClaimDeliveryStatus;
};

type CodeGeneratorFn = typeof generateUniqueCampaignCodes;

let codeGenerator: CodeGeneratorFn = generateUniqueCampaignCodes;

/** Test-only: inject deterministic / failing generators. */
export function setCampaignCodeGeneratorForTests(fn: CodeGeneratorFn): void {
  codeGenerator = fn;
}

export function resetCampaignCodeGeneratorForTests(): void {
  codeGenerator = generateUniqueCampaignCodes;
}

function toListItem(
  campaign: Campaign & { keywordRule: Pick<KeywordRule, "id" | "keyword"> },
): CampaignListItem {
  return {
    id: campaign.id,
    name: campaign.name,
    status: campaign.status,
    keywordRule: {
      id: campaign.keywordRule.id,
      keyword: campaign.keywordRule.keyword,
    },
    startsAt: campaign.startsAt,
    endsAt: campaign.endsAt,
    maxClaims: campaign.maxClaims,
    claimedCount: campaign.claimedCount,
    remainingCount: Math.max(0, campaign.maxClaims - campaign.claimedCount),
    createdAt: campaign.createdAt,
    updatedAt: campaign.updatedAt,
  };
}

function mapUniqueActiveConstraint(error: unknown): AppError | null {
  if (
    error instanceof PrismaNamespace.PrismaClientKnownRequestError &&
    error.code === "P2002"
  ) {
    return new AppError(
      409,
      "Another active campaign already exists for this keyword rule",
    );
  }
  return null;
}

function assertCreateInput(input: CreateCampaignInput): {
  prefix: string;
  length: number;
} {
  if (!input.name?.trim()) {
    throw new AppError(400, "name is required");
  }
  if (!input.soldOutMessage?.trim()) {
    throw new AppError(400, "soldOutMessage is required");
  }
  if (!input.alreadyClaimedMessage?.trim()) {
    throw new AppError(400, "alreadyClaimedMessage is required");
  }
  if (!input.codeGeneration || input.codeGeneration.mode !== "AUTO") {
    throw new AppError(400, "Only AUTO code generation is supported");
  }

  const invariantMessage = firstInvariantMessage({
    maxClaims: input.maxClaims,
    claimedCount: 0,
    startsAt: input.startsAt,
    endsAt: input.endsAt,
    dmTemplate: input.dmTemplate,
    enforceMaxClaimsCap: true,
  });
  if (invariantMessage) {
    throw new AppError(400, invariantMessage);
  }

  try {
    return assertValidCodeGenerationConfig(input.codeGeneration);
  } catch (error) {
    const code = error instanceof Error ? error.message : "";
    if (code === "prefix_invalid") {
      throw new AppError(
        400,
        "codeGeneration.prefix must be 1–16 alphanumeric characters",
      );
    }
    if (code === "length_invalid") {
      throw new AppError(400, "codeGeneration.length must be between 6 and 12");
    }
    throw new AppError(400, "Invalid codeGeneration config");
  }
}

async function getOwnedCampaignOrThrow(
  db: PrismaClient,
  userId: string,
  campaignId: string,
) {
  const campaign = await db.campaign.findFirst({
    where: { id: campaignId, userId },
    include: { keywordRule: { select: { id: true, keyword: true } } },
  });
  if (!campaign) {
    throw new AppError(404, "Campaign not found");
  }
  return campaign;
}

type DbTx = Prisma.TransactionClient;

/**
 * DRAFT-only: grow or shrink AVAILABLE code pool so codeCount === nextMaxClaims.
 * Never mutates non-AVAILABLE codes. Rolls back with the surrounding transaction.
 */
async function resizeDraftCodePool(
  tx: DbTx,
  campaign: Campaign,
  nextMaxClaims: number,
): Promise<void> {
  if (campaign.status !== "DRAFT") {
    throw new AppError(400, "maxClaims can only be changed on DRAFT campaigns");
  }
  if (campaign.claimedCount !== 0) {
    throw new AppError(
      409,
      "Cannot resize code pool after claims have been recorded",
    );
  }

  const existing = await tx.campaignCode.findMany({
    where: { campaignId: campaign.id },
    select: { id: true, code: true, status: true },
    orderBy: { id: "asc" },
  });

  if (existing.length !== campaign.maxClaims) {
    throw new AppError(
      409,
      "Campaign code pool is incomplete; create a new campaign",
    );
  }

  const nonAvailable = existing.filter((row) => row.status !== "AVAILABLE");
  if (nonAvailable.length > 0) {
    throw new AppError(
      409,
      "Cannot resize code pool while any code is reserved, claimed, redeemed, or disabled",
    );
  }

  if (nextMaxClaims === campaign.maxClaims) {
    return;
  }

  if (nextMaxClaims > campaign.maxClaims) {
    const delta = nextMaxClaims - campaign.maxClaims;
    if (existing.length === 0) {
      throw new AppError(409, "Campaign has no codes to infer AUTO format from");
    }
    const format = inferAutoCodeFormatFromSample(existing[0]!.code);
    let newCodes: string[];
    try {
      newCodes = codeGenerator({
        count: delta,
        prefix: format.prefix,
        length: format.length,
        exclude: existing.map((row) => row.code),
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : "";
      if (msg === "code_generation_exhausted") {
        throw new Error("code_generation_exhausted");
      }
      throw error;
    }
    if (newCodes.length !== delta || new Set(newCodes).size !== delta) {
      throw new AppError(500, "Code generation produced an incomplete unique pool");
    }

    await tx.campaignCode.createMany({
      data: newCodes.map((code) => ({
        campaignId: campaign.id,
        code,
        status: "AVAILABLE" as const,
      })),
    });
  } else {
    const excess = campaign.maxClaims - nextMaxClaims;
    const toDelete = existing.slice(0, excess);
    if (toDelete.length !== excess) {
      throw new AppError(409, "Not enough AVAILABLE codes to decrease maxClaims");
    }
    await tx.campaignCode.deleteMany({
      where: {
        campaignId: campaign.id,
        status: "AVAILABLE",
        id: { in: toDelete.map((row) => row.id) },
      },
    });
  }

  const codeCount = await tx.campaignCode.count({
    where: { campaignId: campaign.id },
  });
  if (codeCount !== nextMaxClaims) {
    throw new AppError(500, "Code pool resize failed invariant codeCount === maxClaims");
  }
}

async function buildDetail(
  db: PrismaClient,
  campaign: Campaign & { keywordRule: Pick<KeywordRule, "id" | "keyword"> },
): Promise<CampaignDetail> {
  const [grouped, claimCount] = await Promise.all([
    db.campaignCode.groupBy({
      by: ["status"],
      where: { campaignId: campaign.id },
      _count: { _all: true },
    }),
    db.campaignClaim.count({ where: { campaignId: campaign.id } }),
  ]);

  const codeCounts: Record<CampaignCodeStatus, number> = {
    AVAILABLE: 0,
    RESERVED: 0,
    CLAIMED: 0,
    REDEEMED: 0,
    DISABLED: 0,
  };
  for (const row of grouped) {
    codeCounts[row.status] = row._count._all;
  }

  return {
    ...toListItem(campaign),
    dmTemplate: campaign.dmTemplate,
    soldOutMessage: campaign.soldOutMessage,
    alreadyClaimedMessage: campaign.alreadyClaimedMessage,
    notStartedMessage: campaign.notStartedMessage,
    endedMessage: campaign.endedMessage,
    redemptionEnabled: campaign.redemptionEnabled,
    archivedAt: campaign.archivedAt,
    codeCounts,
    claimCount,
  };
}

export class CampaignService {
  constructor(private readonly db: PrismaClient = prisma) {}

  async listByUser(userId: string): Promise<CampaignListItem[]> {
    const rows = await this.db.campaign.findMany({
      where: { userId },
      include: { keywordRule: { select: { id: true, keyword: true } } },
      orderBy: { createdAt: "desc" },
    });
    return rows.map(toListItem);
  }

  async getById(userId: string, campaignId: string): Promise<CampaignDetail> {
    const campaign = await getOwnedCampaignOrThrow(this.db, userId, campaignId);
    return buildDetail(this.db, campaign);
  }

  /**
   * Atomically create DRAFT campaign + full AUTO code pool.
   * On any failure the transaction rolls back — no half-created campaign.
   */
  async create(userId: string, input: CreateCampaignInput): Promise<CampaignDetail> {
    const { prefix, length } = assertCreateInput(input);

    const rule = await this.db.keywordRule.findFirst({
      where: { id: input.keywordRuleId, userId },
      select: { id: true },
    });
    if (!rule) {
      throw new AppError(400, "Keyword rule not found for this account");
    }

    let codes: string[];
    try {
      codes = codeGenerator({
        count: input.maxClaims,
        prefix,
        length,
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : "";
      if (msg === "code_generation_exhausted") {
        throw new AppError(500, "Could not generate a unique code pool; try again");
      }
      throw new AppError(400, "Code generation failed");
    }

    if (codes.length !== input.maxClaims || new Set(codes).size !== input.maxClaims) {
      throw new AppError(500, "Code generation produced an incomplete unique pool");
    }

    try {
      const created = await this.db.$transaction(async (tx) => {
        const campaign = await tx.campaign.create({
          data: {
            userId,
            keywordRuleId: input.keywordRuleId,
            name: input.name.trim(),
            status: "DRAFT",
            startsAt: input.startsAt,
            endsAt: input.endsAt,
            maxClaims: input.maxClaims,
            claimedCount: 0,
            dmTemplate: input.dmTemplate,
            soldOutMessage: input.soldOutMessage,
            alreadyClaimedMessage: input.alreadyClaimedMessage,
            notStartedMessage: input.notStartedMessage?.trim()
              ? input.notStartedMessage.trim()
              : null,
            endedMessage: input.endedMessage?.trim()
              ? input.endedMessage.trim()
              : null,
          },
          include: { keywordRule: { select: { id: true, keyword: true } } },
        });

        await tx.campaignCode.createMany({
          data: codes.map((code) => ({
            campaignId: campaign.id,
            code,
            status: "AVAILABLE" as const,
          })),
        });

        return campaign;
      });

      return buildDetail(this.db, created);
    } catch (error) {
      const mapped = mapUniqueActiveConstraint(error);
      if (mapped) throw mapped;
      if (
        error instanceof PrismaNamespace.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new AppError(409, "Generated codes collided; please retry");
      }
      throw error;
    }
  }

  async patch(
    userId: string,
    campaignId: string,
    input: PatchCampaignInput,
  ): Promise<CampaignDetail> {
    const campaign = await getOwnedCampaignOrThrow(this.db, userId, campaignId);
    const allowed = new Set<string>(CAMPAIGN_EDIT_MATRIX[campaign.status]);

    if (allowed.size === 0) {
      throw new AppError(400, `Campaign in ${campaign.status} status is read-only`);
    }

    const requested = Object.keys(input).filter(
      (key) => input[key as keyof PatchCampaignInput] !== undefined,
    );
    const forbidden = requested.filter((key) => !allowed.has(key));
    if (forbidden.length > 0) {
      throw new AppError(
        400,
        `Cannot update fields on ${campaign.status} campaign: ${forbidden.join(", ")}`,
      );
    }

    const nextStartsAt = input.startsAt ?? campaign.startsAt;
    const nextEndsAt = input.endsAt ?? campaign.endsAt;
    const nextDmTemplate = input.dmTemplate ?? campaign.dmTemplate;
    const nextMaxClaims =
      input.maxClaims !== undefined ? input.maxClaims : campaign.maxClaims;

    if (input.maxClaims !== undefined) {
      if (!Number.isInteger(input.maxClaims) || input.maxClaims < 1) {
        throw new AppError(400, "maxClaims must be an integer >= 1");
      }
      if (input.maxClaims > MAX_CAMPAIGN_CLAIMS_CAP) {
        throw new AppError(
          400,
          `maxClaims cannot exceed ${MAX_CAMPAIGN_CLAIMS_CAP}`,
        );
      }
    }

    if (
      input.startsAt !== undefined ||
      input.endsAt !== undefined ||
      input.dmTemplate !== undefined ||
      input.maxClaims !== undefined
    ) {
      const msg = firstInvariantMessage({
        maxClaims: nextMaxClaims,
        claimedCount: campaign.claimedCount,
        startsAt: nextStartsAt,
        endsAt: nextEndsAt,
        dmTemplate: nextDmTemplate,
        enforceMaxClaimsCap: true,
      });
      if (msg) throw new AppError(400, msg);
    }

    const data: Prisma.CampaignUpdateInput = {};
    if (input.name !== undefined) data.name = input.name.trim();
    if (input.startsAt !== undefined) data.startsAt = input.startsAt;
    if (input.endsAt !== undefined) data.endsAt = input.endsAt;
    if (input.dmTemplate !== undefined) data.dmTemplate = input.dmTemplate;
    if (input.soldOutMessage !== undefined) data.soldOutMessage = input.soldOutMessage;
    if (input.alreadyClaimedMessage !== undefined) {
      data.alreadyClaimedMessage = input.alreadyClaimedMessage;
    }
    if (input.notStartedMessage !== undefined) {
      data.notStartedMessage = input.notStartedMessage;
    }
    if (input.endedMessage !== undefined) data.endedMessage = input.endedMessage;

    const needsResize =
      input.maxClaims !== undefined && input.maxClaims !== campaign.maxClaims;

    if (!needsResize) {
      if (Object.keys(data).length === 0) {
        return buildDetail(this.db, campaign);
      }
      const updated = await this.db.campaign.update({
        where: { id: campaign.id },
        data,
        include: { keywordRule: { select: { id: true, keyword: true } } },
      });
      return buildDetail(this.db, updated);
    }

    // DRAFT-only maxClaims resize (matrix already enforced).
    try {
      const updated = await this.db.$transaction(async (tx) => {
        await resizeDraftCodePool(tx, campaign, input.maxClaims!);

        return tx.campaign.update({
          where: { id: campaign.id },
          data: {
            ...data,
            maxClaims: input.maxClaims!,
          },
          include: { keywordRule: { select: { id: true, keyword: true } } },
        });
      });
      return buildDetail(this.db, updated);
    } catch (error) {
      if (error instanceof AppError) throw error;
      if (
        error instanceof PrismaNamespace.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new AppError(409, "Generated codes collided; please retry");
      }
      const msg = error instanceof Error ? error.message : "";
      if (msg === "code_generation_exhausted") {
        throw new AppError(500, "Could not generate a unique code pool; try again");
      }
      if (
        msg === "code_format_invalid" ||
        msg === "prefix_invalid" ||
        msg === "length_invalid"
      ) {
        throw new AppError(400, "Existing campaign codes have an unsupported format");
      }
      throw error;
    }
  }

  async activate(userId: string, campaignId: string): Promise<CampaignDetail> {
    const campaign = await getOwnedCampaignOrThrow(this.db, userId, campaignId);

    if (campaign.status === "ARCHIVED") {
      throw new AppError(400, "Archived campaigns cannot be activated");
    }
    if (campaign.status !== "DRAFT" && campaign.status !== "PAUSED") {
      throw new AppError(400, "Only DRAFT or PAUSED campaigns can be activated");
    }

    const invariantMessage = firstInvariantMessage({
      maxClaims: campaign.maxClaims,
      claimedCount: campaign.claimedCount,
      startsAt: campaign.startsAt,
      endsAt: campaign.endsAt,
      dmTemplate: campaign.dmTemplate,
      enforceMaxClaimsCap: true,
    });
    if (invariantMessage) {
      throw new AppError(400, invariantMessage);
    }

    const codeCount = await this.db.campaignCode.count({
      where: { campaignId: campaign.id },
    });
    if (codeCount !== campaign.maxClaims) {
      throw new AppError(
        400,
        "Campaign code pool is incomplete; create a new campaign",
      );
    }

    try {
      const updated = await this.db.campaign.update({
        where: { id: campaign.id },
        data: { status: "ACTIVE" },
        include: { keywordRule: { select: { id: true, keyword: true } } },
      });
      return buildDetail(this.db, updated);
    } catch (error) {
      const mapped = mapUniqueActiveConstraint(error);
      if (mapped) throw mapped;
      throw error;
    }
  }

  async pause(userId: string, campaignId: string): Promise<CampaignDetail> {
    const campaign = await getOwnedCampaignOrThrow(this.db, userId, campaignId);
    if (campaign.status !== "ACTIVE") {
      throw new AppError(400, "Only ACTIVE campaigns can be paused");
    }
    const updated = await this.db.campaign.update({
      where: { id: campaign.id },
      data: { status: "PAUSED" },
      include: { keywordRule: { select: { id: true, keyword: true } } },
    });
    return buildDetail(this.db, updated);
  }

  async archive(userId: string, campaignId: string): Promise<CampaignDetail> {
    const campaign = await getOwnedCampaignOrThrow(this.db, userId, campaignId);
    if (campaign.status === "ACTIVE") {
      throw new AppError(400, "Pause the campaign before archiving");
    }
    if (campaign.status === "ARCHIVED") {
      throw new AppError(400, "Campaign is already archived");
    }
    if (
      campaign.status !== "DRAFT" &&
      campaign.status !== "PAUSED" &&
      campaign.status !== "ENDED"
    ) {
      throw new AppError(400, "Campaign cannot be archived from this status");
    }

    const updated = await this.db.campaign.update({
      where: { id: campaign.id },
      data: { status: "ARCHIVED", archivedAt: new Date() },
      include: { keywordRule: { select: { id: true, keyword: true } } },
    });
    return buildDetail(this.db, updated);
  }

  async listClaims(
    userId: string,
    campaignId: string,
    limit = 100,
  ): Promise<{ claims: CampaignClaimListItem[]; limit: number }> {
    await getOwnedCampaignOrThrow(this.db, userId, campaignId);
    const safeLimit = Math.min(Math.max(1, limit), 500);

    const rows = await this.db.campaignClaim.findMany({
      where: { campaignId },
      include: { campaignCode: { select: { code: true } } },
      orderBy: { claimedAt: "desc" },
      take: safeLimit,
    });

    return {
      limit: safeLimit,
      claims: rows.map((row) => ({
        id: row.id,
        instagramUsername: row.instagramUsername,
        code: row.campaignCode.code,
        claimedAt: row.claimedAt,
        deliveryStatus: row.deliveryStatus,
      })),
    };
  }
}

export const campaignService = new CampaignService();
