/**
 * SmartCampaignResponseService tests — V2 PostgreSQL for claim/code/DmEvent state,
 * mocked Meta send + decrypt.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { Campaign, PrismaClient } from "@prisma/client";
import { encryptToken } from "../utils/tokenCrypto";
import { CampaignClaimAllocator } from "./campaignClaimAllocator";
import {
  cleanupAllocatorUser,
  createV2PrismaClient,
  resolveV2TestDatabaseUrl,
  seedAllocatorFixture,
} from "./campaignClaimAllocator.testHelpers";
import { SmartCampaignResponseService } from "./smartCampaignResponse.service";

const v2Url = (() => {
  try {
    return resolveV2TestDatabaseUrl();
  } catch {
    return null;
  }
})();

const describeV2 = v2Url ? describe : describe.skip;

describeV2("SmartCampaignResponseService (V2 PG + mocked Meta)", () => {
  let prisma: PrismaClient;
  let allocator: CampaignClaimAllocator;
  const userIds: string[] = [];
  const activities: Array<{ type: string; title: string; metadata: unknown }> = [];

  beforeAll(() => {
    process.env.JWT_SECRET =
      process.env.JWT_SECRET ?? "test-secret-min-16chars-vitest";
    prisma = createV2PrismaClient(v2Url!, 20);
    allocator = new CampaignClaimAllocator(prisma);
  });

  afterAll(async () => {
    for (const id of userIds) {
      await prisma.dmEvent.deleteMany({ where: { userId: id } });
      await prisma.instagramAccount.deleteMany({ where: { userId: id } });
      await prisma.activityEvent.deleteMany({ where: { userId: id } });
      await cleanupAllocatorUser(prisma, id);
    }
    await prisma.$disconnect();
  });

  async function seedCampaign(
    options: Parameters<typeof seedAllocatorFixture>[1],
  ) {
    const fixture = await seedAllocatorFixture(prisma, options);
    userIds.push(fixture.user.id);

    const account = await prisma.instagramAccount.create({
      data: {
        userId: fixture.user.id,
        instagramUserId: `ig-${fixture.user.id}`,
        username: "creator",
        accountType: "BUSINESS",
        accessTokenEncrypted: encryptToken("fake-access-token-for-tests"),
        connectionStatus: "connected",
      },
    });

    return { ...fixture, account };
  }

  async function createDmEvent(params: {
    userId: string;
    accountId: string;
    commentId: string;
    ruleId: string;
    attemptCount?: number;
  }) {
    return prisma.dmEvent.create({
      data: {
        userId: params.userId,
        instagramAccountId: params.accountId,
        commentId: params.commentId,
        ruleId: params.ruleId,
        status: "sending",
        attemptCount: params.attemptCount ?? 1,
      },
    });
  }

  function makeService(sendImpl: ReturnType<typeof vi.fn>) {
    activities.length = 0;
    return new SmartCampaignResponseService({
      db: prisma,
      allocator,
      sendPrivateReply: sendImpl as never,
      logActivity: async (_userId, data) => {
        activities.push({
          type: data.type,
          title: data.title,
          metadata: data.metadata,
        });
        return {} as never;
      },
    });
  }

  function baseParams(
    fixture: Awaited<ReturnType<typeof seedCampaign>>,
    campaign: Campaign,
    dmEventId: string,
    comment: { commentId: string; commenterId?: string; commenterUsername?: string },
    attemptCount = 1,
  ) {
    return {
      account: {
        id: fixture.account.id,
        userId: fixture.user.id,
        instagramUserId: fixture.account.instagramUserId,
        accessTokenEncrypted: fixture.account.accessTokenEncrypted,
      },
      matchedRule: { id: fixture.rule.id, keyword: fixture.rule.keyword },
      campaign,
      comment: {
        instagramAccountId: fixture.account.instagramUserId,
        commentId: comment.commentId,
        text: "SALE please",
        commenterId: comment.commenterId,
        commenterUsername: comment.commenterUsername,
      },
      dmClaim: {
        dmEventId,
        attemptCount,
        isRetry: attemptCount > 1,
      },
      priorEventsCreated: 2,
    };
  }

  it("1-5. ALLOCATED → {{code}} DM, CLAIMED/SENT, DmEvent sent + messageId; no raw code in Activity", async () => {
    const fixture = await seedCampaign({ maxClaims: 5, status: "ACTIVE" });
    const dm = await createDmEvent({
      userId: fixture.user.id,
      accountId: fixture.account.id,
      commentId: "c-alloc-1",
      ruleId: fixture.rule.id,
    });
    const send = vi.fn().mockResolvedValue({ messageId: "mid-1", recipientId: "r1" });
    const service = makeService(send);

    const result = await service.execute(
      baseParams(fixture, fixture.campaign, dm.id, {
        commentId: "c-alloc-1",
        commenterId: "ig-user-1",
        commenterUsername: "alice",
      }),
    );

    expect(result).toMatchObject({
      sent: true,
      failed: false,
      campaignOutcome: "ALLOCATED",
    });
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        commentId: "c-alloc-1",
        igUserId: fixture.account.instagramUserId,
      }),
    );
    const sentText = send.mock.calls[0]?.[0]?.messageText as string;
    expect(sentText).toContain("Your code is ");
    expect(sentText).not.toContain("{{code}}");
    expect(sentText).toMatch(/T[A-Za-z0-9]+-\d{5}/);

    const claim = await prisma.campaignClaim.findFirstOrThrow({
      where: { campaignId: fixture.campaign.id, sourceCommentId: "c-alloc-1" },
      include: { campaignCode: true },
    });
    expect(claim.deliveryStatus).toBe("SENT");
    expect(claim.campaignCode.status).toBe("CLAIMED");

    const dmEvent = await prisma.dmEvent.findUniqueOrThrow({ where: { id: dm.id } });
    expect(dmEvent.status).toBe("sent");
    expect(dmEvent.messageId).toBe("mid-1");

    expect(activities[0]?.type).toBe("dm_sent");
    expect(activities[0]?.title).toBe("Campaign DM sent");
    const meta = activities[0]?.metadata as Record<string, unknown>;
    expect(meta.campaignOutcome).toBe("ALLOCATED");
    expect(meta.campaignId).toBe(fixture.campaign.id);
    expect(JSON.stringify(meta)).not.toContain(claim.campaignCode.code);
  });

  it("6. duplicate retry uses same code and succeeds after prior failure", async () => {
    const fixture = await seedCampaign({ maxClaims: 3, status: "ACTIVE" });
    const dm1 = await createDmEvent({
      userId: fixture.user.id,
      accountId: fixture.account.id,
      commentId: "c-retry",
      ruleId: fixture.rule.id,
      attemptCount: 1,
    });

    const failSend = vi.fn().mockRejectedValue(new Error("Meta timeout"));
    const serviceFail = makeService(failSend);
    const failResult = await serviceFail.execute(
      baseParams(fixture, fixture.campaign, dm1.id, {
        commentId: "c-retry",
        commenterId: "ig-retry",
      }),
    );
    expect(failResult.failed).toBe(true);

    const claimAfterFail = await prisma.campaignClaim.findFirstOrThrow({
      where: { sourceCommentId: "c-retry" },
      include: { campaignCode: true },
    });
    expect(claimAfterFail.deliveryStatus).toBe("FAILED");
    expect(claimAfterFail.campaignCode.status).toBe("RESERVED");
    const reservedCodeId = claimAfterFail.campaignCodeId;

    await prisma.dmEvent.update({
      where: { id: dm1.id },
      data: { status: "sending", attemptCount: 2 },
    });

    const okSend = vi.fn().mockResolvedValue({ messageId: "mid-retry", recipientId: null });
    const serviceOk = makeService(okSend);
    const okResult = await serviceOk.execute(
      baseParams(
        fixture,
        fixture.campaign,
        dm1.id,
        { commentId: "c-retry", commenterId: "ig-retry" },
        2,
      ),
    );
    expect(okResult).toMatchObject({ sent: true, campaignOutcome: "DUPLICATE_COMMENT" });

    const claimAfterOk = await prisma.campaignClaim.findFirstOrThrow({
      where: { sourceCommentId: "c-retry" },
      include: { campaignCode: true },
    });
    expect(claimAfterOk.campaignCodeId).toBe(reservedCodeId);
    expect(claimAfterOk.deliveryStatus).toBe("SENT");
    expect(claimAfterOk.campaignCode.status).toBe("CLAIMED");
    expect(okSend.mock.calls[0]?.[0]?.messageText).toContain(claimAfterOk.campaignCode.code);
  });

  it("7-8. already-claimed reminder uses original code; claimedCount unchanged", async () => {
    const fixture = await seedCampaign({
      maxClaims: 5,
      status: "ACTIVE",
      name: "Already claim camp",
    });
    // Patch alreadyClaimedMessage with {{code}}
    const campaign = await prisma.campaign.update({
      where: { id: fixture.campaign.id },
      data: {
        alreadyClaimedMessage: "You already claimed. Your code is {{code}}",
      },
    });

    const dm1 = await createDmEvent({
      userId: fixture.user.id,
      accountId: fixture.account.id,
      commentId: "c-first",
      ruleId: fixture.rule.id,
    });
    const send = vi.fn().mockResolvedValue({ messageId: "m1", recipientId: null });
    const service = makeService(send);
    await service.execute(
      baseParams(fixture, campaign, dm1.id, {
        commentId: "c-first",
        commenterId: "ig-john",
        commenterUsername: "john",
      }),
    );
    const firstClaim = await prisma.campaignClaim.findFirstOrThrow({
      where: { sourceCommentId: "c-first" },
      include: { campaignCode: true },
    });
    const code = firstClaim.campaignCode.code;
    const countAfterFirst = (
      await prisma.campaign.findUniqueOrThrow({ where: { id: campaign.id } })
    ).claimedCount;

    const dm2 = await createDmEvent({
      userId: fixture.user.id,
      accountId: fixture.account.id,
      commentId: "c-second",
      ruleId: fixture.rule.id,
    });
    const reminder = await service.execute(
      baseParams(fixture, campaign, dm2.id, {
        commentId: "c-second",
        commenterId: "ig-john",
        commenterUsername: "john",
      }),
    );
    expect(reminder.campaignOutcome).toBe("ALREADY_CLAIMED");
    expect(reminder.sent).toBe(true);
    expect(send.mock.calls.at(-1)?.[0]?.messageText).toBe(
      `You already claimed. Your code is ${code}`,
    );

    expect(await prisma.campaignClaim.count({ where: { campaignId: campaign.id } })).toBe(1);
    expect(
      (await prisma.campaign.findUniqueOrThrow({ where: { id: campaign.id } })).claimedCount,
    ).toBe(countAfterFirst);

    const dm2row = await prisma.dmEvent.findUniqueOrThrow({ where: { id: dm2.id } });
    expect(dm2row.status).toBe("sent");
  });

  it("9-13. sold out / not started / ended / paused / missing identity messages; no code consumed", async () => {
    const sold = await seedCampaign({
      maxClaims: 2,
      claimedCount: 2,
      codeCount: 2,
      reservedCount: 2,
      status: "ACTIVE",
    });
    const dmSold = await createDmEvent({
      userId: sold.user.id,
      accountId: sold.account.id,
      commentId: "c-sold",
      ruleId: sold.rule.id,
    });
    const send = vi.fn().mockResolvedValue({ messageId: "ms", recipientId: null });
    const service = makeService(send);
    expect(
      (
        await service.execute(
          baseParams(sold, sold.campaign, dmSold.id, {
            commentId: "c-sold",
            commenterId: "ig-s",
          }),
        )
      ).campaignOutcome,
    ).toBe("SOLD_OUT");
    expect(send.mock.calls.at(-1)?.[0]?.messageText).toBe("Sold out");
    expect(await prisma.campaignClaim.count({ where: { campaignId: sold.campaign.id } })).toBe(0);

    const notStarted = await seedCampaign({
      maxClaims: 2,
      status: "ACTIVE",
      startsAt: new Date("2090-01-01T00:00:00.000Z"),
      endsAt: new Date("2091-01-01T00:00:00.000Z"),
    });
    const dmNs = await createDmEvent({
      userId: notStarted.user.id,
      accountId: notStarted.account.id,
      commentId: "c-ns",
      ruleId: notStarted.rule.id,
    });
    const nsResult = await service.execute({
      ...baseParams(notStarted, notStarted.campaign, dmNs.id, {
        commentId: "c-ns",
        commenterId: "ig-ns",
      }),
      now: new Date("2026-01-01T00:00:00.000Z"),
    });
    expect(nsResult.campaignOutcome).toBe("NOT_STARTED");
    expect(send.mock.calls.at(-1)?.[0]?.messageText).toMatch(/not started/i);

    const ended = await seedCampaign({
      maxClaims: 2,
      status: "ACTIVE",
      startsAt: new Date("2020-01-01T00:00:00.000Z"),
      endsAt: new Date("2021-01-01T00:00:00.000Z"),
    });
    const dmEnd = await createDmEvent({
      userId: ended.user.id,
      accountId: ended.account.id,
      commentId: "c-end",
      ruleId: ended.rule.id,
    });
    expect(
      (
        await service.execute({
          ...baseParams(ended, ended.campaign, dmEnd.id, {
            commentId: "c-end",
            commenterId: "ig-e",
          }),
          now: new Date("2026-01-01T00:00:00.000Z"),
        })
      ).campaignOutcome,
    ).toBe("ENDED");

    const paused = await seedCampaign({ maxClaims: 2, status: "PAUSED" });
    const dmP = await createDmEvent({
      userId: paused.user.id,
      accountId: paused.account.id,
      commentId: "c-p",
      ruleId: paused.rule.id,
    });
    expect(
      (
        await service.execute(
          baseParams(paused, paused.campaign, dmP.id, {
            commentId: "c-p",
            commenterId: "ig-p",
          }),
        )
      ).campaignOutcome,
    ).toBe("PAUSED");
    expect(send.mock.calls.at(-1)?.[0]?.messageText).toMatch(/temporarily unavailable/i);

    const identity = await seedCampaign({ maxClaims: 2, status: "ACTIVE" });
    const dmI = await createDmEvent({
      userId: identity.user.id,
      accountId: identity.account.id,
      commentId: "c-i",
      ruleId: identity.rule.id,
    });
    const missing = await service.execute(
      baseParams(identity, identity.campaign, dmI.id, {
        commentId: "c-i",
        commenterUsername: "ghost",
      }),
    );
    expect(missing.campaignOutcome).toBe("MISSING_IDENTITY");
    expect(await prisma.campaignClaim.count({ where: { campaignId: identity.campaign.id } })).toBe(
      0,
    );
    expect(
      (await prisma.campaign.findUniqueOrThrow({ where: { id: identity.campaign.id } }))
        .claimedCount,
    ).toBe(0);
  });

  it("14-16. Meta failure → claim FAILED, code RESERVED, DmEvent failure fields", async () => {
    const fixture = await seedCampaign({ maxClaims: 3, status: "ACTIVE" });
    const dm = await createDmEvent({
      userId: fixture.user.id,
      accountId: fixture.account.id,
      commentId: "c-fail",
      ruleId: fixture.rule.id,
    });
    const { AppError } = await import("../utils/errors");
    const metaErr = new AppError(
      400,
      "User not eligible",
      10,
      "User not eligible for private reply",
    );
    const send = vi.fn().mockRejectedValue(metaErr);
    const service = makeService(send);
    const result = await service.execute(
      baseParams(fixture, fixture.campaign, dm.id, {
        commentId: "c-fail",
        commenterId: "ig-fail",
      }),
    );
    expect(result.failed).toBe(true);

    const claim = await prisma.campaignClaim.findFirstOrThrow({
      where: { sourceCommentId: "c-fail" },
      include: { campaignCode: true },
    });
    expect(claim.deliveryStatus).toBe("FAILED");
    expect(claim.campaignCode.status).toBe("RESERVED");

    const dmEvent = await prisma.dmEvent.findUniqueOrThrow({ where: { id: dm.id } });
    expect(dmEvent.status).toBe("failed");
    expect(dmEvent.metaErrorCode).toBe(10);
    expect(dmEvent.errorSummary).toContain("10");
  });

  it("14b. token decrypt failure → claim FAILED, code RESERVED", async () => {
    const fixture = await seedCampaign({ maxClaims: 2, status: "ACTIVE" });
    await prisma.instagramAccount.update({
      where: { id: fixture.account.id },
      data: { accessTokenEncrypted: "mock_encrypted_token_placeholder" },
    });
    fixture.account.accessTokenEncrypted = "mock_encrypted_token_placeholder";
    const dm = await createDmEvent({
      userId: fixture.user.id,
      accountId: fixture.account.id,
      commentId: "c-decrypt",
      ruleId: fixture.rule.id,
    });
    const send = vi.fn();
    const service = makeService(send);
    const result = await service.execute(
      baseParams(fixture, fixture.campaign, dm.id, {
        commentId: "c-decrypt",
        commenterId: "ig-dec",
      }),
    );
    expect(result.failed).toBe(true);
    expect(send).not.toHaveBeenCalled();
    const claim = await prisma.campaignClaim.findFirstOrThrow({
      where: { sourceCommentId: "c-decrypt" },
      include: { campaignCode: true },
    });
    expect(claim.deliveryStatus).toBe("FAILED");
    expect(claim.campaignCode.status).toBe("RESERVED");
  });
  it("18. exhausted failure → claim EXHAUSTED + code RESERVED", async () => {
    const fixture = await seedCampaign({ maxClaims: 2, status: "ACTIVE" });
    const dm = await createDmEvent({
      userId: fixture.user.id,
      accountId: fixture.account.id,
      commentId: "c-exh",
      ruleId: fixture.rule.id,
      attemptCount: 3,
    });
    const send = vi.fn().mockRejectedValue(new Error("fail"));
    const service = makeService(send);
    await service.execute(
      baseParams(
        fixture,
        fixture.campaign,
        dm.id,
        { commentId: "c-exh", commenterId: "ig-exh" },
        3,
      ),
    );
    const claim = await prisma.campaignClaim.findFirstOrThrow({
      where: { sourceCommentId: "c-exh" },
      include: { campaignCode: true },
    });
    expect(claim.deliveryStatus).toBe("EXHAUSTED");
    expect(claim.campaignCode.status).toBe("RESERVED");
  });

  it("15 explicit: failed code never reused; next commenter gets different code", async () => {
    const fixture = await seedCampaign({ maxClaims: 5, status: "ACTIVE" });
    const dm1 = await createDmEvent({
      userId: fixture.user.id,
      accountId: fixture.account.id,
      commentId: "c-a",
      ruleId: fixture.rule.id,
    });
    const failSend = vi.fn().mockRejectedValue(new Error("boom"));
    const serviceFail = makeService(failSend);
    await serviceFail.execute(
      baseParams(fixture, fixture.campaign, dm1.id, {
        commentId: "c-a",
        commenterId: "ig-a",
      }),
    );
    const codeA = await prisma.campaignClaim.findFirstOrThrow({
      where: { sourceCommentId: "c-a" },
      include: { campaignCode: true },
    });
    expect(codeA.campaignCode.status).toBe("RESERVED");

    const dm2 = await createDmEvent({
      userId: fixture.user.id,
      accountId: fixture.account.id,
      commentId: "c-b",
      ruleId: fixture.rule.id,
    });
    const okSend = vi.fn().mockResolvedValue({ messageId: "mb", recipientId: null });
    const serviceOk = makeService(okSend);
    await serviceOk.execute(
      baseParams(fixture, fixture.campaign, dm2.id, {
        commentId: "c-b",
        commenterId: "ig-b",
      }),
    );
    const codeB = await prisma.campaignClaim.findFirstOrThrow({
      where: { sourceCommentId: "c-b" },
      include: { campaignCode: true },
    });
    expect(codeB.campaignCodeId).not.toBe(codeA.campaignCodeId);
    expect(codeA.campaignCode.status).toBe("RESERVED");
    expect(
      (
        await prisma.campaignCode.findUniqueOrThrow({
          where: { id: codeA.campaignCodeId },
        })
      ).status,
    ).toBe("RESERVED");
    expect(codeB.campaignCode.status).toBe("CLAIMED");
  });

  it("INACTIVE draft → skip send, no code", async () => {
    const fixture = await seedCampaign({ maxClaims: 2, status: "DRAFT" });
    const dm = await createDmEvent({
      userId: fixture.user.id,
      accountId: fixture.account.id,
      commentId: "c-draft",
      ruleId: fixture.rule.id,
    });
    const send = vi.fn();
    const service = makeService(send);
    const result = await service.execute(
      baseParams(fixture, fixture.campaign, dm.id, {
        commentId: "c-draft",
        commenterId: "ig-d",
      }),
    );
    expect(result).toMatchObject({
      sent: false,
      failed: false,
      campaignOutcome: "SEND_SKIPPED_INACTIVE",
    });
    expect(send).not.toHaveBeenCalled();
    expect((await prisma.dmEvent.findUniqueOrThrow({ where: { id: dm.id } })).status).toBe(
      "skipped",
    );
  });
});

if (!v2Url) {
  describe("SmartCampaignResponseService (skipped)", () => {
    it("skipped: COMMENT2DM_V2_TEST_DATABASE_URL not set / unsafe", () => {
      expect(v2Url).toBeNull();
    });
  });
}
