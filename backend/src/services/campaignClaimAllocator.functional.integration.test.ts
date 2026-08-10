/**
 * Functional integration tests for CampaignClaimAllocator on isolated V2 PostgreSQL.
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

describeV2("CampaignClaimAllocator functional (V2 PG)", () => {
  let prisma: PrismaClient;
  let allocator: CampaignClaimAllocator;
  const userIds: string[] = [];

  beforeAll(() => {
    prisma = createV2PrismaClient(v2Url!, 10);
    allocator = new CampaignClaimAllocator(prisma);
  });

  afterAll(async () => {
    for (const userId of userIds) {
      await cleanupAllocatorUser(prisma, userId);
    }
    await prisma.$disconnect();
  });

  async function seed(
    options: Parameters<typeof seedAllocatorFixture>[1],
  ) {
    const fixture = await seedAllocatorFixture(prisma, options);
    userIds.push(fixture.user.id);
    return fixture;
  }

  it("1-4. ACTIVE valid comment → ALLOCATED, RESERVED, PENDING, claimedCount+1", async () => {
    const { campaign } = await seed({ maxClaims: 5, status: "ACTIVE" });
    const result = await allocator.allocate({
      campaignId: campaign.id,
      sourceCommentId: "comment-1",
      instagramCommenterId: "ig-1",
      instagramUsername: "alice",
    });
    expect(result.outcome).toBe("ALLOCATED");
    if (result.outcome !== "ALLOCATED") return;
    expect(result.code.status).toBe("RESERVED");
    expect(result.claim.deliveryStatus).toBe("PENDING");
    expect(result.claim.instagramCommenterId).toBe("ig-1");

    const refreshed = await prisma.campaign.findUniqueOrThrow({
      where: { id: campaign.id },
    });
    expect(refreshed.claimedCount).toBe(1);

    const code = await prisma.campaignCode.findUniqueOrThrow({
      where: { id: result.code.id },
    });
    expect(code.status).toBe("RESERVED");
    expect(code.reservedAt).toBeTruthy();
  });

  it("5. duplicate comment → same claim/code, no increment", async () => {
    const { campaign } = await seed({ maxClaims: 5 });
    const first = await allocator.allocate({
      campaignId: campaign.id,
      sourceCommentId: "dup-comment",
      instagramCommenterId: "ig-dup",
    });
    expect(first.outcome).toBe("ALLOCATED");
    const second = await allocator.allocate({
      campaignId: campaign.id,
      sourceCommentId: "dup-comment",
      instagramCommenterId: "ig-dup",
    });
    expect(second.outcome).toBe("DUPLICATE_COMMENT");
    if (first.outcome !== "ALLOCATED" || second.outcome !== "DUPLICATE_COMMENT") return;
    expect(second.claim.id).toBe(first.claim.id);
    expect(second.code.id).toBe(first.code.id);
    const refreshed = await prisma.campaign.findUniqueOrThrow({
      where: { id: campaign.id },
    });
    expect(refreshed.claimedCount).toBe(1);
  });

  it("6-7. same commenter new comment → ALREADY_CLAIMED; new commenter → new code", async () => {
    const { campaign } = await seed({ maxClaims: 5 });
    const first = await allocator.allocate({
      campaignId: campaign.id,
      sourceCommentId: "c-a",
      instagramCommenterId: "ig-same",
      instagramUsername: "bob",
    });
    expect(first.outcome).toBe("ALLOCATED");

    const sameUser = await allocator.allocate({
      campaignId: campaign.id,
      sourceCommentId: "c-b",
      instagramCommenterId: "ig-same",
      instagramUsername: "bob_renamed",
    });
    expect(sameUser.outcome).toBe("ALREADY_CLAIMED");
    if (first.outcome !== "ALLOCATED" || sameUser.outcome !== "ALREADY_CLAIMED") return;
    expect(sameUser.code.id).toBe(first.code.id);

    const other = await allocator.allocate({
      campaignId: campaign.id,
      sourceCommentId: "c-c",
      instagramCommenterId: "ig-other",
    });
    expect(other.outcome).toBe("ALLOCATED");
    if (other.outcome !== "ALLOCATED") return;
    expect(other.code.id).not.toBe(first.code.id);

    const refreshed = await prisma.campaign.findUniqueOrThrow({
      where: { id: campaign.id },
    });
    expect(refreshed.claimedCount).toBe(2);
  });

  it("8. null commenter → MISSING_IDENTITY, no claim/code consumed", async () => {
    const { campaign } = await seed({ maxClaims: 3 });
    const result = await allocator.allocate({
      campaignId: campaign.id,
      sourceCommentId: "c-null",
      instagramCommenterId: null,
      instagramUsername: "ghost",
    });
    expect(result).toEqual({ outcome: "MISSING_IDENTITY" });
    expect(await prisma.campaignClaim.count({ where: { campaignId: campaign.id } })).toBe(0);
    expect(
      await prisma.campaignCode.count({
        where: { campaignId: campaign.id, status: "AVAILABLE" },
      }),
    ).toBe(3);
    expect(
      (await prisma.campaign.findUniqueOrThrow({ where: { id: campaign.id } })).claimedCount,
    ).toBe(0);
  });

  it("9-13. status/window outcomes", async () => {
    const paused = await seed({ maxClaims: 2, status: "PAUSED" });
    expect(
      (
        await allocator.allocate({
          campaignId: paused.campaign.id,
          sourceCommentId: "x",
          instagramCommenterId: "ig",
        })
      ).outcome,
    ).toBe("PAUSED");

    const draft = await seed({ maxClaims: 2, status: "DRAFT" });
    expect(
      (
        await allocator.allocate({
          campaignId: draft.campaign.id,
          sourceCommentId: "x",
          instagramCommenterId: "ig",
        })
      ).outcome,
    ).toBe("INACTIVE");

    const archived = await seed({ maxClaims: 2, status: "ARCHIVED" });
    expect(
      (
        await allocator.allocate({
          campaignId: archived.campaign.id,
          sourceCommentId: "x",
          instagramCommenterId: "ig",
        })
      ).outcome,
    ).toBe("INACTIVE");

    const notStarted = await seed({
      maxClaims: 2,
      status: "ACTIVE",
      startsAt: new Date("2090-01-01T00:00:00.000Z"),
      endsAt: new Date("2091-01-01T00:00:00.000Z"),
    });
    expect(
      (
        await allocator.allocate({
          campaignId: notStarted.campaign.id,
          sourceCommentId: "x",
          instagramCommenterId: "ig",
          now: new Date("2026-01-01T00:00:00.000Z"),
        })
      ).outcome,
    ).toBe("NOT_STARTED");

    const ended = await seed({
      maxClaims: 2,
      status: "ACTIVE",
      startsAt: new Date("2020-01-01T00:00:00.000Z"),
      endsAt: new Date("2021-01-01T00:00:00.000Z"),
    });
    expect(
      (
        await allocator.allocate({
          campaignId: ended.campaign.id,
          sourceCommentId: "x",
          instagramCommenterId: "ig",
          now: new Date("2026-01-01T00:00:00.000Z"),
        })
      ).outcome,
    ).toBe("ENDED");
  });

  it("14. sold out by claimedCount", async () => {
    const { campaign } = await seed({
      maxClaims: 2,
      claimedCount: 2,
      codeCount: 2,
      reservedCount: 2,
    });
    const result = await allocator.allocate({
      campaignId: campaign.id,
      sourceCommentId: "c-full",
      instagramCommenterId: "ig-full",
    });
    expect(result.outcome).toBe("SOLD_OUT");
  });

  it("15. sold out by no available codes", async () => {
    const { campaign } = await seed({
      maxClaims: 5,
      claimedCount: 0,
      codeCount: 3,
      reservedCount: 3,
    });
    const result = await allocator.allocate({
      campaignId: campaign.id,
      sourceCommentId: "c-nocodes",
      instagramCommenterId: "ig-nocodes",
    });
    expect(result.outcome).toBe("SOLD_OUT");
    expect(
      (await prisma.campaign.findUniqueOrThrow({ where: { id: campaign.id } })).claimedCount,
    ).toBe(0);
  });

  it("16. username differences do not affect uniqueness", async () => {
    const { campaign } = await seed({ maxClaims: 3 });
    const first = await allocator.allocate({
      campaignId: campaign.id,
      sourceCommentId: "u1",
      instagramCommenterId: "ig-stable",
      instagramUsername: "name_a",
    });
    expect(first.outcome).toBe("ALLOCATED");
    const second = await allocator.allocate({
      campaignId: campaign.id,
      sourceCommentId: "u2",
      instagramCommenterId: "ig-stable",
      instagramUsername: "name_b",
    });
    expect(second.outcome).toBe("ALREADY_CLAIMED");
    if (first.outcome !== "ALLOCATED" || second.outcome !== "ALREADY_CLAIMED") return;
    expect(second.code.id).toBe(first.code.id);
  });
});

if (!v2Url) {
  describe("CampaignClaimAllocator functional (skipped)", () => {
    it("skipped: COMMENT2DM_V2_TEST_DATABASE_URL not set / unsafe", () => {
      expect(v2Url).toBeNull();
    });
  });
}
