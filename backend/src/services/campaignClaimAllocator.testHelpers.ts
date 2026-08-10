/**
 * Shared fixtures for CampaignClaimAllocator V2 PostgreSQL integration tests.
 */
import { PrismaClient } from "@prisma/client";
import { assertSafeV2DatabaseUrl } from "../lib/dbSafety";

export function resolveV2TestDatabaseUrl(): string | null {
  const url = process.env.COMMENT2DM_V2_TEST_DATABASE_URL?.trim();
  if (!url) return null;
  assertSafeV2DatabaseUrl(url);
  return url;
}

export function createV2PrismaClient(url: string, connectionLimit = 40): PrismaClient {
  const sep = url.includes("?") ? "&" : "?";
  const withPool = url.includes("connection_limit=")
    ? url
    : `${url}${sep}connection_limit=${connectionLimit}`;
  return new PrismaClient({ datasources: { db: { url: withPool } } });
}

export async function seedAllocatorFixture(
  prisma: PrismaClient,
  options: {
    status?: "DRAFT" | "ACTIVE" | "PAUSED" | "ENDED" | "ARCHIVED";
    maxClaims: number;
    claimedCount?: number;
    startsAt?: Date;
    endsAt?: Date;
    codeCount?: number;
    /** Pre-mark first N codes as RESERVED (simulates depleted pool). */
    reservedCount?: number;
    name?: string;
  },
) {
  const user = await prisma.user.create({
    data: {
      email: `alloc-${Date.now()}-${Math.random().toString(16).slice(2)}@example.com`,
      passwordHash: "x",
      name: "Allocator Test",
    },
  });
  const rule = await prisma.keywordRule.create({
    data: {
      userId: user.id,
      keyword: `KW${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
      dmMessage: "v1",
    },
  });

  const startsAt = options.startsAt ?? new Date("2020-01-01T00:00:00.000Z");
  const endsAt = options.endsAt ?? new Date("2099-01-01T00:00:00.000Z");
  const codeCount = options.codeCount ?? options.maxClaims;

  const campaign = await prisma.campaign.create({
    data: {
      userId: user.id,
      keywordRuleId: rule.id,
      name: options.name ?? "Allocator campaign",
      status: options.status ?? "ACTIVE",
      startsAt,
      endsAt,
      maxClaims: options.maxClaims,
      claimedCount: options.claimedCount ?? 0,
      dmTemplate: "Your code is {{code}}",
      soldOutMessage: "Sold out",
      alreadyClaimedMessage: "Already {{code}}",
      archivedAt: options.status === "ARCHIVED" ? new Date() : null,
    },
  });

  const reservedCount = options.reservedCount ?? 0;
  const codes = [];
  for (let i = 0; i < codeCount; i += 1) {
    codes.push({
      campaignId: campaign.id,
      code: `T${campaign.id.slice(-6)}-${String(i).padStart(5, "0")}`,
      status: (i < reservedCount ? "RESERVED" : "AVAILABLE") as "AVAILABLE" | "RESERVED",
      reservedAt: i < reservedCount ? new Date() : null,
    });
  }
  if (codes.length > 0) {
    await prisma.campaignCode.createMany({ data: codes });
  }

  return { user, rule, campaign };
}

export async function cleanupAllocatorUser(
  prisma: PrismaClient,
  userId: string,
): Promise<void> {
  await prisma.campaignClaim.deleteMany({ where: { campaign: { userId } } });
  await prisma.campaignCode.deleteMany({ where: { campaign: { userId } } });
  await prisma.campaign.deleteMany({ where: { userId } });
  await prisma.keywordRule.deleteMany({ where: { userId } });
  await prisma.user.delete({ where: { id: userId } }).catch(() => undefined);
}
