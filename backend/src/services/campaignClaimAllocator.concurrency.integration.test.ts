/**
 * Mandatory concurrency proofs for CampaignClaimAllocator on isolated V2 PostgreSQL.
 * Uses real Postgres only — no SQLite / no mocks.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { CampaignClaimAllocator } from "./campaignClaimAllocator";
import {
  cleanupAllocatorUser,
  createV2PrismaClient,
  resolveV2TestDatabaseUrl,
  seedAllocatorFixture,
} from "./campaignClaimAllocator.testHelpers";

const v2Url = (() => {
  try {
    return resolveV2TestDatabaseUrl();
  } catch {
    return null;
  }
})();

const describeV2 = v2Url ? describe : describe.skip;

function countByOutcome(
  results: Array<{ outcome: string }>,
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const r of results) {
    counts[r.outcome] = (counts[r.outcome] ?? 0) + 1;
  }
  return counts;
}

describeV2("CampaignClaimAllocator concurrency (V2 PG)", () => {
  let prisma: PrismaClient;
  let allocator: CampaignClaimAllocator;
  const userIds: string[] = [];
  const timings: Record<string, number> = {};

  beforeAll(() => {
    prisma = createV2PrismaClient(v2Url!, 50);
    allocator = new CampaignClaimAllocator(prisma);
  });

  afterAll(async () => {
    for (const userId of userIds) {
      await cleanupAllocatorUser(prisma, userId);
    }
    await prisma.$disconnect();
    console.log("[allocator-concurrency] timings_ms", timings);
  });

  async function seed(maxClaims: number) {
    const fixture = await seedAllocatorFixture(prisma, {
      maxClaims,
      codeCount: maxClaims,
      status: "ACTIVE",
    });
    userIds.push(fixture.user.id);
    return fixture.campaign;
  }

  it("A. 100 unique commenters / 100 codes → 100 ALLOCATED, distinct codes", async () => {
    const campaign = await seed(100);
    const started = Date.now();
    const results = await Promise.all(
      Array.from({ length: 100 }, (_, i) =>
        allocator.allocate({
          campaignId: campaign.id,
          sourceCommentId: `a-comment-${i}`,
          instagramCommenterId: `a-user-${i}`,
        }),
      ),
    );
    timings.A_100_alloc = Date.now() - started;

    const counts = countByOutcome(results);
    expect(counts.ALLOCATED).toBe(100);
    expect(Object.keys(counts)).toEqual(["ALLOCATED"]);

    const claims = await prisma.campaignClaim.findMany({
      where: { campaignId: campaign.id },
    });
    expect(claims).toHaveLength(100);
    expect(new Set(claims.map((c) => c.campaignCodeId)).size).toBe(100);

    const refreshed = await prisma.campaign.findUniqueOrThrow({
      where: { id: campaign.id },
    });
    expect(refreshed.claimedCount).toBe(100);
    expect(refreshed.claimedCount).toBeLessThanOrEqual(refreshed.maxClaims);
  }, 120_000);

  it("B. 150 unique commenters / 100 codes → 100 ALLOCATED + 50 SOLD_OUT", async () => {
    const campaign = await seed(100);
    const started = Date.now();
    const results = await Promise.all(
      Array.from({ length: 150 }, (_, i) =>
        allocator.allocate({
          campaignId: campaign.id,
          sourceCommentId: `b-comment-${i}`,
          instagramCommenterId: `b-user-${i}`,
        }),
      ),
    );
    timings.B_150_to_100 = Date.now() - started;

    const counts = countByOutcome(results);
    expect(counts.ALLOCATED).toBe(100);
    expect(counts.SOLD_OUT).toBe(50);

    const claims = await prisma.campaignClaim.findMany({
      where: { campaignId: campaign.id },
    });
    expect(claims).toHaveLength(100);
    expect(new Set(claims.map((c) => c.campaignCodeId)).size).toBe(100);

    const refreshed = await prisma.campaign.findUniqueOrThrow({
      where: { id: campaign.id },
    });
    expect(refreshed.claimedCount).toBe(100);
  }, 180_000);

  it("C. 100 concurrent SAME sourceCommentId → 1 alloc, rest DUPLICATE_COMMENT", async () => {
    const campaign = await seed(50);
    const results = await Promise.all(
      Array.from({ length: 100 }, () =>
        allocator.allocate({
          campaignId: campaign.id,
          sourceCommentId: "same-comment-id",
          instagramCommenterId: "c-user-0",
        }),
      ),
    );

    const counts = countByOutcome(results);
    expect(counts.ALLOCATED).toBe(1);
    expect(counts.DUPLICATE_COMMENT).toBe(99);

    const claims = await prisma.campaignClaim.findMany({
      where: { campaignId: campaign.id },
    });
    expect(claims).toHaveLength(1);
    expect(
      (await prisma.campaign.findUniqueOrThrow({ where: { id: campaign.id } }))
        .claimedCount,
    ).toBe(1);

    const allocated = results.find((r) => r.outcome === "ALLOCATED");
    const duplicates = results.filter((r) => r.outcome === "DUPLICATE_COMMENT");
    expect(allocated && allocated.outcome === "ALLOCATED").toBe(true);
    if (allocated?.outcome === "ALLOCATED") {
      for (const d of duplicates) {
        if (d.outcome === "DUPLICATE_COMMENT") {
          expect(d.code.id).toBe(allocated.code.id);
          expect(d.claim.id).toBe(allocated.claim.id);
        }
      }
    }
  }, 120_000);

  it("D. 100 concurrent same commenterId / different comments → 1 claim", async () => {
    const campaign = await seed(50);
    const results = await Promise.all(
      Array.from({ length: 100 }, (_, i) =>
        allocator.allocate({
          campaignId: campaign.id,
          sourceCommentId: `d-comment-${i}`,
          instagramCommenterId: "same-commenter",
        }),
      ),
    );

    const counts = countByOutcome(results);
    expect(counts.ALLOCATED).toBe(1);
    expect(counts.ALREADY_CLAIMED).toBe(99);

    const claims = await prisma.campaignClaim.findMany({
      where: { campaignId: campaign.id },
    });
    expect(claims).toHaveLength(1);
    expect(
      (await prisma.campaign.findUniqueOrThrow({ where: { id: campaign.id } }))
        .claimedCount,
    ).toBe(1);
  }, 120_000);

  it("E. mixed duplicate comments + users + unique → no over-allocation", async () => {
    const campaign = await seed(30);
    const requests: Array<{
      sourceCommentId: string;
      instagramCommenterId: string;
    }> = [];

    // 10 unique users
    for (let i = 0; i < 10; i += 1) {
      requests.push({
        sourceCommentId: `e-unique-${i}`,
        instagramCommenterId: `e-user-${i}`,
      });
    }
    // 20 duplicate same comment
    for (let i = 0; i < 20; i += 1) {
      requests.push({
        sourceCommentId: "e-dup-comment",
        instagramCommenterId: "e-dup-user",
      });
    }
    // 15 same commenter different comments
    for (let i = 0; i < 15; i += 1) {
      requests.push({
        sourceCommentId: `e-same-user-${i}`,
        instagramCommenterId: "e-single-user",
      });
    }
    // 20 more unique
    for (let i = 10; i < 30; i += 1) {
      requests.push({
        sourceCommentId: `e-unique-${i}`,
        instagramCommenterId: `e-user-${i}`,
      });
    }

    // Shuffle for realism
    for (let i = requests.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [requests[i], requests[j]] = [requests[j]!, requests[i]!];
    }

    const results = await Promise.all(
      requests.map((req) =>
        allocator.allocate({
          campaignId: campaign.id,
          sourceCommentId: req.sourceCommentId,
          instagramCommenterId: req.instagramCommenterId,
        }),
      ),
    );

    const claims = await prisma.campaignClaim.findMany({
      where: { campaignId: campaign.id },
    });
    const refreshed = await prisma.campaign.findUniqueOrThrow({
      where: { id: campaign.id },
    });

    expect(claims.length).toBe(refreshed.claimedCount);
    expect(refreshed.claimedCount).toBeLessThanOrEqual(30);
    expect(new Set(claims.map((c) => c.campaignCodeId)).size).toBe(claims.length);
    expect(new Set(claims.map((c) => c.sourceCommentId)).size).toBe(claims.length);
    expect(
      new Set(
        claims
          .map((c) => c.instagramCommenterId)
          .filter((id): id is string => id != null),
      ).size,
    ).toBe(claims.length);

    // Expected unique users: 10 + 1 (dup comment user) + 1 (single user) + 20 = 32 potential,
    // but maxClaims=30 so at most 30 claims.
    expect(refreshed.claimedCount).toBeLessThanOrEqual(30);
    expect(countByOutcome(results).ALLOCATED ?? 0).toBe(refreshed.claimedCount);
  }, 180_000);
});

if (!v2Url) {
  describe("CampaignClaimAllocator concurrency (skipped)", () => {
    it("skipped: COMMENT2DM_V2_TEST_DATABASE_URL not set / unsafe", () => {
      expect(v2Url).toBeNull();
    });
  });
}
