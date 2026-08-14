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

  it("DRAFT resize increase 50→75 appends AVAILABLE codes and preserves old pool", async () => {
    const created = await service.create(userId, {
      keywordRuleId: ruleId,
      name: "Resize Up",
      startsAt: new Date("2026-01-01T00:00:00.000Z"),
      endsAt: new Date("2026-06-01T00:00:00.000Z"),
      maxClaims: 50,
      dmTemplate: "Code {{code}}",
      soldOutMessage: "Sold out",
      alreadyClaimedMessage: "Already {{code}}",
      codeGeneration: { mode: "AUTO", prefix: "UP", length: 8 },
    });
    const before = await prisma.campaignCode.findMany({
      where: { campaignId: created.id },
      select: { code: true },
    });
    expect(before).toHaveLength(50);
    const beforeSet = new Set(before.map((c) => c.code));

    const patched = await service.patch(userId, created.id, { maxClaims: 75 });
    expect(patched.maxClaims).toBe(75);
    expect(patched.codeCounts.AVAILABLE).toBe(75);
    expect(JSON.stringify(patched)).not.toMatch(/UP-[A-Z0-9]{8}/);

    const after = await prisma.campaignCode.findMany({
      where: { campaignId: created.id },
    });
    expect(after).toHaveLength(75);
    expect(after.every((c) => c.status === "AVAILABLE")).toBe(true);
    for (const code of beforeSet) {
      expect(after.some((c) => c.code === code)).toBe(true);
    }
    expect(new Set(after.map((c) => c.code)).size).toBe(75);
  });

  it("DRAFT resize decrease 50→3 deletes only excess AVAILABLE codes", async () => {
    const created = await service.create(userId, {
      keywordRuleId: ruleId,
      name: "Resize Down",
      startsAt: new Date("2026-01-01T00:00:00.000Z"),
      endsAt: new Date("2026-06-01T00:00:00.000Z"),
      maxClaims: 50,
      dmTemplate: "Code {{code}}",
      soldOutMessage: "Sold out",
      alreadyClaimedMessage: "Already {{code}}",
      codeGeneration: { mode: "AUTO", prefix: "DN", length: 8 },
    });

    const patched = await service.patch(userId, created.id, { maxClaims: 3 });
    expect(patched.maxClaims).toBe(3);
    expect(patched.codeCounts.AVAILABLE).toBe(3);
    const after = await prisma.campaignCode.findMany({
      where: { campaignId: created.id },
    });
    expect(after).toHaveLength(3);
    expect(after.every((c) => c.status === "AVAILABLE")).toBe(true);
  });

  it("rolls back DRAFT increase when code generation fails", async () => {
    const created = await service.create(userId, {
      keywordRuleId: ruleId,
      name: "Resize Fail",
      startsAt: new Date("2026-01-01T00:00:00.000Z"),
      endsAt: new Date("2026-06-01T00:00:00.000Z"),
      maxClaims: 5,
      dmTemplate: "Code {{code}}",
      soldOutMessage: "Sold out",
      alreadyClaimedMessage: "Already {{code}}",
      codeGeneration: { mode: "AUTO", prefix: "RF", length: 8 },
    });
    setCampaignCodeGeneratorForTests(() => {
      throw new Error("code_generation_exhausted");
    });
    await expect(
      service.patch(userId, created.id, { maxClaims: 8 }),
    ).rejects.toMatchObject({ statusCode: 500 });
    resetCampaignCodeGeneratorForTests();

    const refreshed = await prisma.campaign.findUniqueOrThrow({
      where: { id: created.id },
    });
    expect(refreshed.maxClaims).toBe(5);
    expect(
      await prisma.campaignCode.count({ where: { campaignId: created.id } }),
    ).toBe(5);
  });

  it("rejects DRAFT decrease when any RESERVED code exists", async () => {
    const created = await service.create(userId, {
      keywordRuleId: ruleId,
      name: "Resize Reserved",
      startsAt: new Date("2026-01-01T00:00:00.000Z"),
      endsAt: new Date("2026-06-01T00:00:00.000Z"),
      maxClaims: 5,
      dmTemplate: "Code {{code}}",
      soldOutMessage: "Sold out",
      alreadyClaimedMessage: "Already {{code}}",
      codeGeneration: { mode: "AUTO", prefix: "RSV", length: 8 },
    });
    const one = await prisma.campaignCode.findFirstOrThrow({
      where: { campaignId: created.id },
    });
    await prisma.campaignCode.update({
      where: { id: one.id },
      data: { status: "RESERVED", reservedAt: new Date() },
    });

    await expect(
      service.patch(userId, created.id, { maxClaims: 2 }),
    ).rejects.toMatchObject({ statusCode: 409, message: /reserved/i });

    expect(
      await prisma.campaignCode.count({ where: { campaignId: created.id } }),
    ).toBe(5);
  });

  it("rejects DRAFT decrease when claimedCount > 0", async () => {
    const created = await service.create(userId, {
      keywordRuleId: ruleId,
      name: "Resize Claimed",
      startsAt: new Date("2026-01-01T00:00:00.000Z"),
      endsAt: new Date("2026-06-01T00:00:00.000Z"),
      maxClaims: 5,
      dmTemplate: "Code {{code}}",
      soldOutMessage: "Sold out",
      alreadyClaimedMessage: "Already {{code}}",
      codeGeneration: { mode: "AUTO", prefix: "CLM", length: 8 },
    });
    await prisma.campaign.update({
      where: { id: created.id },
      data: { claimedCount: 1 },
    });

    await expect(
      service.patch(userId, created.id, { maxClaims: 2 }),
    ).rejects.toMatchObject({ statusCode: 409, message: /claims have been recorded/ });
  });

  it("still requires codeCount === maxClaims on activate after resize", async () => {
    const created = await service.create(userId, {
      keywordRuleId: ruleId,
      name: "Activate After Resize",
      startsAt: new Date("2026-01-01T00:00:00.000Z"),
      endsAt: new Date("2026-06-01T00:00:00.000Z"),
      maxClaims: 4,
      dmTemplate: "Code {{code}}",
      soldOutMessage: "Sold out",
      alreadyClaimedMessage: "Already {{code}}",
      codeGeneration: { mode: "AUTO", prefix: "ACT", length: 8 },
    });
    await service.patch(userId, created.id, { maxClaims: 6 });
    // Pause any other ACTIVE for this rule first if needed — use archive path on prior
    const actives = await prisma.campaign.findMany({
      where: { userId, status: "ACTIVE" },
    });
    for (const active of actives) {
      await prisma.campaign.update({
        where: { id: active.id },
        data: { status: "PAUSED" },
      });
    }
    const activated = await service.activate(userId, created.id);
    expect(activated.status).toBe("ACTIVE");
    expect(activated.maxClaims).toBe(6);
    expect(
      await prisma.campaignCode.count({ where: { campaignId: created.id } }),
    ).toBe(6);
  });
});

if (skipReason) {
  describe("campaign CRUD integration (skipped)", () => {
    it(`skipped: ${skipReason}`, () => {
      expect(skipReason).toBeTruthy();
    });
  });
}
