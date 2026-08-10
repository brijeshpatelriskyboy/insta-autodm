/**
 * Optional live DB checks for campaign CRUD atomicity on isolated V2 DB only.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import { assertSafeV2DatabaseUrl } from "../lib/dbSafety";
import {
  CampaignService,
  resetCampaignCodeGeneratorForTests,
  setCampaignCodeGeneratorForTests,
} from "./campaign.service";

const v2Url = process.env.COMMENT2DM_V2_TEST_DATABASE_URL?.trim();
let skipReason: string | null = null;
try {
  if (!v2Url) skipReason = "COMMENT2DM_V2_TEST_DATABASE_URL not set";
  else assertSafeV2DatabaseUrl(v2Url);
} catch (error) {
  skipReason = error instanceof Error ? error.message : String(error);
}

const describeV2 = skipReason ? describe.skip : describe;

describeV2("campaign CRUD integration (V2 DB)", () => {
  const prisma = new PrismaClient({ datasources: { db: { url: v2Url! } } });
  const service = new CampaignService(prisma);
  let userId: string;
  let ruleId: string;

  beforeAll(async () => {
    const user = await prisma.user.create({
      data: {
        email: `v2-crud-${Date.now()}@example.com`,
        passwordHash: "x",
        name: "CRUD",
      },
    });
    userId = user.id;
    const rule = await prisma.keywordRule.create({
      data: { userId, keyword: "CRUD", dmMessage: "v1" },
    });
    ruleId = rule.id;
  });

  afterAll(async () => {
    resetCampaignCodeGeneratorForTests();
    if (userId) {
      await prisma.campaignClaim.deleteMany({ where: { campaign: { userId } } });
      await prisma.campaignCode.deleteMany({ where: { campaign: { userId } } });
      await prisma.campaign.deleteMany({ where: { userId } });
      await prisma.keywordRule.deleteMany({ where: { userId } });
      await prisma.user.delete({ where: { id: userId } }).catch(() => undefined);
    }
    await prisma.$disconnect();
  });

  it("creates exact unique code pool; incomplete generation leaves no campaign", async () => {
    const created = await service.create(userId, {
      keywordRuleId: ruleId,
      name: "CRUD Sale",
      startsAt: new Date("2026-01-01T00:00:00.000Z"),
      endsAt: new Date("2026-06-01T00:00:00.000Z"),
      maxClaims: 5,
      dmTemplate: "Code {{code}}",
      soldOutMessage: "Sold out",
      alreadyClaimedMessage: "Already {{code}}",
      codeGeneration: { mode: "AUTO", prefix: "CRUD", length: 8 },
    });

    expect(created.status).toBe("DRAFT");
    expect(created.codeCounts.AVAILABLE).toBe(5);
    expect(JSON.stringify(created)).not.toMatch(/CRUD-[A-Z0-9]{8}/);

    const codes = await prisma.campaignCode.findMany({
      where: { campaignId: created.id },
    });
    expect(codes).toHaveLength(5);
    expect(new Set(codes.map((c) => c.code)).size).toBe(5);

    setCampaignCodeGeneratorForTests(() => ["ONLY-ONE"]);
    const beforeCount = await prisma.campaign.count({ where: { userId } });
    await expect(
      service.create(userId, {
        keywordRuleId: ruleId,
        name: "Should fail",
        startsAt: new Date("2026-01-01T00:00:00.000Z"),
        endsAt: new Date("2026-06-01T00:00:00.000Z"),
        maxClaims: 3,
        dmTemplate: "Code {{code}}",
        soldOutMessage: "Sold out",
        alreadyClaimedMessage: "Already {{code}}",
        codeGeneration: { mode: "AUTO", prefix: "FAIL", length: 8 },
      }),
    ).rejects.toMatchObject({ statusCode: 500 });
    const afterCount = await prisma.campaign.count({ where: { userId } });
    expect(afterCount).toBe(beforeCount);
    resetCampaignCodeGeneratorForTests();

    await service.activate(userId, created.id);

    const second = await service.create(userId, {
      keywordRuleId: ruleId,
      name: "Second",
      startsAt: new Date("2026-01-01T00:00:00.000Z"),
      endsAt: new Date("2026-06-01T00:00:00.000Z"),
      maxClaims: 2,
      dmTemplate: "Code {{code}}",
      soldOutMessage: "Sold out",
      alreadyClaimedMessage: "Already {{code}}",
      codeGeneration: { mode: "AUTO", prefix: "SEC", length: 8 },
    });
    await expect(service.activate(userId, second.id)).rejects.toMatchObject({
      statusCode: 409,
    });
  });
});

if (skipReason) {
  describe("campaign CRUD integration (skipped)", () => {
    it(`skipped: ${skipReason}`, () => {
      expect(skipReason).toBeTruthy();
    });
  });
}
