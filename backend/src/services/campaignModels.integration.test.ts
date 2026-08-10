/**
 * Integration tests against the isolated V2 development database only.
 * Skips when COMMENT2DM_V2_TEST_DATABASE_URL is unset or fails V2 safety checks.
 *
 * Do not point these at production. Do not use usernames for uniqueness.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Prisma, PrismaClient } from "@prisma/client";
import { assertSafeV2DatabaseUrl } from "../lib/dbSafety";

const v2Url = process.env.COMMENT2DM_V2_TEST_DATABASE_URL?.trim();
let skipReason: string | null = null;
try {
  if (!v2Url) {
    skipReason = "COMMENT2DM_V2_TEST_DATABASE_URL not set";
  } else {
    assertSafeV2DatabaseUrl(v2Url);
  }
} catch (error) {
  skipReason = error instanceof Error ? error.message : String(error);
}

const describeV2 = skipReason ? describe.skip : describe;

describeV2("Campaign V2 models (isolated DB)", () => {
  if (skipReason) {
    // reachable only for type narrowing when not skipped
  }

  const prisma = new PrismaClient({
    datasources: { db: { url: v2Url! } },
  });

  let userId: string;
  let ruleId: string;
  let ruleIdB: string;

  beforeAll(async () => {
    const user = await prisma.user.create({
      data: {
        email: `v2-campaign-models-${Date.now()}@example.com`,
        passwordHash: "test-hash-not-for-login",
        name: "V2 Campaign Models Test",
      },
    });
    userId = user.id;

    const rule = await prisma.keywordRule.create({
      data: {
        userId,
        keyword: "CODE",
        dmMessage: "legacy v1 message",
      },
    });
    ruleId = rule.id;

    const ruleB = await prisma.keywordRule.create({
      data: {
        userId,
        keyword: "OTHER",
        dmMessage: "other rule",
      },
    });
    ruleIdB = ruleB.id;
  });

  afterAll(async () => {
    if (userId) {
      // CampaignClaim/Code use Restrict on campaign delete; delete claims/codes first.
      await prisma.campaignClaim.deleteMany({ where: { campaign: { userId } } });
      await prisma.campaignCode.deleteMany({ where: { campaign: { userId } } });
      await prisma.campaign.deleteMany({ where: { userId } });
      await prisma.keywordRule.deleteMany({ where: { userId } });
      await prisma.user.delete({ where: { id: userId } }).catch(() => undefined);
    }
    await prisma.$disconnect();
  });

  async function createCampaign(
    overrides: Partial<{
      keywordRuleId: string;
      status: "DRAFT" | "ACTIVE" | "PAUSED" | "ENDED" | "ARCHIVED";
      name: string;
    }> = {},
  ) {
    return prisma.campaign.create({
      data: {
        userId,
        keywordRuleId: overrides.keywordRuleId ?? ruleId,
        name: overrides.name ?? "Test campaign",
        status: overrides.status ?? "DRAFT",
        startsAt: new Date("2026-01-01T00:00:00.000Z"),
        endsAt: new Date("2026-12-31T00:00:00.000Z"),
        maxClaims: 100,
        claimedCount: 0,
        dmTemplate: "Your code: {{code}}",
        soldOutMessage: "Sold out",
        alreadyClaimedMessage: "Already claimed",
      },
    });
  }

  it("1. can create a Campaign in the V2 test/dev DB", async () => {
    const campaign = await createCampaign({ name: "Create smoke" });
    expect(campaign.id).toBeTruthy();
    expect(campaign.status).toBe("DRAFT");
    expect(campaign.redemptionEnabled).toBe(false);
  });

  it("2. enforces CampaignCode uniqueness per campaign", async () => {
    const campaign = await createCampaign({ name: "code-unique" });
    await prisma.campaignCode.create({
      data: { campaignId: campaign.id, code: "SAVE10" },
    });
    await expect(
      prisma.campaignCode.create({
        data: { campaignId: campaign.id, code: "SAVE10" },
      }),
    ).rejects.toMatchObject({ code: "P2002" });
  });

  it("3. allows the same code value across different campaigns", async () => {
    const a = await createCampaign({ name: "cross-a", keywordRuleId: ruleId });
    const b = await createCampaign({ name: "cross-b", keywordRuleId: ruleIdB });
    await prisma.campaignCode.create({
      data: { campaignId: a.id, code: "SHARED" },
    });
    const other = await prisma.campaignCode.create({
      data: { campaignId: b.id, code: "SHARED" },
    });
    expect(other.code).toBe("SHARED");
  });

  it("4. enforces sourceCommentId uniqueness per campaign", async () => {
    const campaign = await createCampaign({ name: "comment-unique" });
    const code1 = await prisma.campaignCode.create({
      data: { campaignId: campaign.id, code: "C1" },
    });
    const code2 = await prisma.campaignCode.create({
      data: { campaignId: campaign.id, code: "C2" },
    });
    await prisma.campaignClaim.create({
      data: {
        campaignId: campaign.id,
        campaignCodeId: code1.id,
        sourceCommentId: "ig_comment_1",
        claimedAt: new Date(),
      },
    });
    await expect(
      prisma.campaignClaim.create({
        data: {
          campaignId: campaign.id,
          campaignCodeId: code2.id,
          sourceCommentId: "ig_comment_1",
          claimedAt: new Date(),
        },
      }),
    ).rejects.toMatchObject({ code: "P2002" });
  });

  it("5. campaignCodeId cannot be claimed twice", async () => {
    const campaign = await createCampaign({ name: "code-once" });
    const code = await prisma.campaignCode.create({
      data: { campaignId: campaign.id, code: "ONCE" },
    });
    await prisma.campaignClaim.create({
      data: {
        campaignId: campaign.id,
        campaignCodeId: code.id,
        sourceCommentId: "c_a",
        claimedAt: new Date(),
      },
    });
    await expect(
      prisma.campaignClaim.create({
        data: {
          campaignId: campaign.id,
          campaignCodeId: code.id,
          sourceCommentId: "c_b",
          claimedAt: new Date(),
        },
      }),
    ).rejects.toMatchObject({ code: "P2002" });
  });

  it("6. allows only one ACTIVE campaign per KeywordRule", async () => {
    await createCampaign({ name: "active-1", status: "ACTIVE", keywordRuleId: ruleId });
    await expect(
      createCampaign({ name: "active-2", status: "ACTIVE", keywordRuleId: ruleId }),
    ).rejects.toBeInstanceOf(Prisma.PrismaClientKnownRequestError);

    // Different rule can also be ACTIVE
    const other = await createCampaign({
      name: "active-other-rule",
      status: "ACTIVE",
      keywordRuleId: ruleIdB,
    });
    expect(other.status).toBe("ACTIVE");

    // Same rule can have DRAFT alongside ACTIVE
    const draft = await createCampaign({
      name: "draft-same-rule",
      status: "DRAFT",
      keywordRuleId: ruleId,
    });
    expect(draft.status).toBe("DRAFT");
  });

  it("7. one claim per instagramCommenterId per campaign when ID is non-null", async () => {
    const campaign = await createCampaign({ name: "commenter-unique" });
    const code1 = await prisma.campaignCode.create({
      data: { campaignId: campaign.id, code: "U1" },
    });
    const code2 = await prisma.campaignCode.create({
      data: { campaignId: campaign.id, code: "U2" },
    });
    await prisma.campaignClaim.create({
      data: {
        campaignId: campaign.id,
        campaignCodeId: code1.id,
        sourceCommentId: "sc1",
        instagramCommenterId: "ig_user_42",
        claimedAt: new Date(),
      },
    });
    await expect(
      prisma.campaignClaim.create({
        data: {
          campaignId: campaign.id,
          campaignCodeId: code2.id,
          sourceCommentId: "sc2",
          instagramCommenterId: "ig_user_42",
          claimedAt: new Date(),
        },
      }),
    ).rejects.toBeInstanceOf(Prisma.PrismaClientKnownRequestError);
  });

  it("8. allows multiple null instagramCommenterId rows (partial unique index)", async () => {
    const campaign = await createCampaign({ name: "null-commenters" });
    const code1 = await prisma.campaignCode.create({
      data: { campaignId: campaign.id, code: "N1" },
    });
    const code2 = await prisma.campaignCode.create({
      data: { campaignId: campaign.id, code: "N2" },
    });
    const a = await prisma.campaignClaim.create({
      data: {
        campaignId: campaign.id,
        campaignCodeId: code1.id,
        sourceCommentId: "null_sc_1",
        instagramCommenterId: null,
        claimedAt: new Date(),
      },
    });
    const b = await prisma.campaignClaim.create({
      data: {
        campaignId: campaign.id,
        campaignCodeId: code2.id,
        sourceCommentId: "null_sc_2",
        instagramCommenterId: null,
        claimedAt: new Date(),
      },
    });
    expect(a.instagramCommenterId).toBeNull();
    expect(b.instagramCommenterId).toBeNull();
  });

  it("9. archive does not delete claims or codes", async () => {
    const campaign = await createCampaign({ name: "archive-keep", status: "DRAFT" });
    const code = await prisma.campaignCode.create({
      data: { campaignId: campaign.id, code: "KEEP" },
    });
    const claim = await prisma.campaignClaim.create({
      data: {
        campaignId: campaign.id,
        campaignCodeId: code.id,
        sourceCommentId: "keep_comment",
        claimedAt: new Date(),
      },
    });

    const archived = await prisma.campaign.update({
      where: { id: campaign.id },
      data: { status: "ARCHIVED", archivedAt: new Date() },
    });
    expect(archived.status).toBe("ARCHIVED");
    expect(archived.archivedAt).toBeTruthy();

    const codeStill = await prisma.campaignCode.findUnique({ where: { id: code.id } });
    const claimStill = await prisma.campaignClaim.findUnique({ where: { id: claim.id } });
    expect(codeStill).not.toBeNull();
    expect(claimStill).not.toBeNull();
  });
});

if (skipReason) {
  describe("Campaign V2 models (skipped)", () => {
    it(`skipped: ${skipReason}`, () => {
      expect(skipReason).toBeTruthy();
    });
  });
}
