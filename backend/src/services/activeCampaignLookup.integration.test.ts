/**
 * ActiveCampaignLookup against isolated V2 PostgreSQL.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PrismaClient } from "@prisma/client";
import { ActiveCampaignLookup } from "./activeCampaignLookup";
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

describeV2("ActiveCampaignLookup (V2 PG)", () => {
  let prisma: PrismaClient;
  let lookup: ActiveCampaignLookup;
  const userIds: string[] = [];

  beforeAll(() => {
    prisma = createV2PrismaClient(v2Url!, 10);
    lookup = new ActiveCampaignLookup({ db: prisma });
  });

  afterAll(async () => {
    for (const id of userIds) {
      await cleanupAllocatorUser(prisma, id);
    }
    await prisma.$disconnect();
  });

  it("returns ACTIVE regardless of time window (not-started / ended)", async () => {
    const future = await seedAllocatorFixture(prisma, {
      maxClaims: 2,
      status: "ACTIVE",
      startsAt: new Date("2090-01-01T00:00:00.000Z"),
      endsAt: new Date("2091-01-01T00:00:00.000Z"),
    });
    userIds.push(future.user.id);

    const foundFuture = await lookup.forKeywordRule({
      keywordRuleId: future.rule.id,
      userId: future.user.id,
    });
    expect(foundFuture.status).toBe("found");
    if (foundFuture.status === "found") {
      expect(foundFuture.campaign.id).toBe(future.campaign.id);
    }

    const past = await seedAllocatorFixture(prisma, {
      maxClaims: 2,
      status: "ACTIVE",
      startsAt: new Date("2020-01-01T00:00:00.000Z"),
      endsAt: new Date("2021-01-01T00:00:00.000Z"),
    });
    userIds.push(past.user.id);
    const foundPast = await lookup.forKeywordRule({
      keywordRuleId: past.rule.id,
      userId: past.user.id,
    });
    expect(foundPast.status).toBe("found");
  });

  it("DRAFT only → none; PAUSED → found; wrong user → none", async () => {
    const draft = await seedAllocatorFixture(prisma, {
      maxClaims: 2,
      status: "DRAFT",
    });
    userIds.push(draft.user.id);
    expect(
      await lookup.forKeywordRule({
        keywordRuleId: draft.rule.id,
        userId: draft.user.id,
      }),
    ).toEqual({ status: "none" });

    const paused = await seedAllocatorFixture(prisma, {
      maxClaims: 2,
      status: "PAUSED",
    });
    userIds.push(paused.user.id);
    const pausedResult = await lookup.forKeywordRule({
      keywordRuleId: paused.rule.id,
      userId: paused.user.id,
    });
    expect(pausedResult.status).toBe("found");

    expect(
      await lookup.forKeywordRule({
        keywordRuleId: paused.rule.id,
        userId: "not-the-owner",
      }),
    ).toEqual({ status: "none" });
  });

  it("prefers ACTIVE over PAUSED on same rule", async () => {
    const fixture = await seedAllocatorFixture(prisma, {
      maxClaims: 2,
      status: "PAUSED",
    });
    userIds.push(fixture.user.id);

    const active = await prisma.campaign.create({
      data: {
        userId: fixture.user.id,
        keywordRuleId: fixture.rule.id,
        name: "Active one",
        status: "ACTIVE",
        startsAt: new Date("2020-01-01T00:00:00.000Z"),
        endsAt: new Date("2099-01-01T00:00:00.000Z"),
        maxClaims: 2,
        claimedCount: 0,
        dmTemplate: "Code {{code}}",
        soldOutMessage: "Sold out",
        alreadyClaimedMessage: "Already {{code}}",
      },
    });
    await prisma.campaignCode.createMany({
      data: [
        { campaignId: active.id, code: `A-${active.id.slice(-4)}-1` },
        { campaignId: active.id, code: `A-${active.id.slice(-4)}-2` },
      ],
    });

    const result = await lookup.forKeywordRule({
      keywordRuleId: fixture.rule.id,
      userId: fixture.user.id,
    });
    expect(result.status).toBe("found");
    if (result.status === "found") {
      expect(result.campaign.id).toBe(active.id);
      expect(result.campaign.status).toBe("ACTIVE");
    }
  });
});

if (!v2Url) {
  describe("ActiveCampaignLookup (skipped)", () => {
    it("skipped: COMMENT2DM_V2_TEST_DATABASE_URL not set / unsafe", () => {
      expect(v2Url).toBeNull();
    });
  });
}
